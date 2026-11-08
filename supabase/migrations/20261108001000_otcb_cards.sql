-- Épico 8.5 — apoio no banco aos cards de entrada do chat (seções 6.1, 11.6, 11.7, 11.13, 13.4 e 13.7).

-- ===================================================================== edição de opinião (11.6)

-- Colunas novas (divergência registrada no plano 8.5): a 11.6 limita a 5 edições de opinião por dia e a
-- 7.2 não tem onde contar. Só o serviço grava (otcb_salvar_opiniao); o cliente não lê (grant por coluna).
alter table public.otcb_opinioes
  add column edicoes_dia date,
  add column edicoes_qtd smallint not null default 0;
comment on column public.otcb_opinioes.edicoes_dia is 'Dia de São Paulo das edições contadas em edicoes_qtd (11.6).';
comment on column public.otcb_opinioes.edicoes_qtd is 'Edições da opinião no dia edicoes_dia; no máximo 5 (11.6).';

revoke select on public.otcb_opinioes from authenticated;
grant select (id, usuario_id, bar_id, texto, nota, status, motivo_ocultacao, qtd_denuncias, criado_em, atualizado_em)
  on public.otcb_opinioes to authenticated;

-- otcb_checar_edicao (regra 11.6): diz se a pessoa já tem opinião no bar e se ainda pode editar hoje.
-- Recebe: usuário e bar. Devolve: true se já existe opinião (edição), false se é a primeira.
-- Erros: bar_inexistente; limite_edicao (5 edições no dia de SP). Chamada antes da moderação para não
-- gastar IA com edição que seria recusada pelo limite.
create function public.otcb_checar_edicao(p_usuario uuid, p_bar_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.otcb_opinioes%rowtype;
begin
  if not exists (select 1 from public.otcb_bares b where b.id = p_bar_id and b.excluido_em is null) then
    raise exception 'bar_inexistente' using errcode = 'P0001';
  end if;
  select * into v_op from public.otcb_opinioes where usuario_id = p_usuario and bar_id = p_bar_id;
  if not found then
    return false;
  end if;
  if v_op.edicoes_dia = public.otcb_hoje_sp() and v_op.edicoes_qtd >= 5 then
    raise exception 'limite_edicao' using errcode = 'P0001';
  end if;
  return true;
end;
$$;

-- otcb_salvar_opiniao (13.7; regras 11.6 e 11.7): grava a opinião já aprovada pela moderação.
-- Recebe: usuário, bar, texto (10–500, check do banco) e nota (1–5 ou nula). Devolve: o id da opinião.
-- Uma opinião por bar (unique): se já existe, é edição — conta no limite do dia e, se estava
-- 'oculta_moderacao', volta a 'publicada' (diagrama 11.7); ocultas por denúncia ou pelo admin continuam
-- ocultas. Grava a mensagem 'sistema' do card (11.13). Erros: bar_inexistente, limite_edicao.
create function public.otcb_salvar_opiniao(p_usuario uuid, p_bar_id uuid, p_texto text, p_nota smallint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edicao boolean := public.otcb_checar_edicao(p_usuario, p_bar_id);
  v_hoje date := public.otcb_hoje_sp();
  v_id uuid;
  v_nome text;
begin
  if v_edicao then
    update public.otcb_opinioes o
       set texto = p_texto,
           nota = p_nota,
           status = case when o.status in ('publicada', 'oculta_moderacao') then 'publicada' else o.status end,
           motivo_ocultacao = case when o.status = 'oculta_moderacao' then null else o.motivo_ocultacao end,
           edicoes_qtd = case when o.edicoes_dia = v_hoje then o.edicoes_qtd + 1 else 1 end,
           edicoes_dia = v_hoje
     where o.usuario_id = p_usuario and o.bar_id = p_bar_id
     returning o.id into v_id;
  else
    insert into public.otcb_opinioes (usuario_id, bar_id, texto, nota)
    values (p_usuario, p_bar_id, p_texto, p_nota)
    returning id into v_id;
  end if;
  select nome into v_nome from public.otcb_bares where id = p_bar_id;
  insert into public.otcb_mensagens (usuario_id, papel, conteudo)
  values (p_usuario, 'sistema',
          case when v_edicao then 'A pessoa editou a própria opinião sobre o bar ' else 'A pessoa publicou uma opinião sobre o bar ' end
          || v_nome || ' pelo card.');
  return v_id;
end;
$$;

-- otcb_recusar_edicao (regra 11.7, estado oculta_moderacao): a edição de uma opinião já publicada foi
-- recusada pela moderação — a versão anterior fica oculta até a pessoa editar de novo com sucesso.
-- Recebe: usuário e bar. Devolve: true se havia opinião publicada e ela foi ocultada.
create function public.otcb_recusar_edicao(p_usuario uuid, p_bar_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.otcb_opinioes
     set status = 'oculta_moderacao', motivo_ocultacao = 'moderacao'
   where usuario_id = p_usuario and bar_id = p_bar_id and status = 'publicada';
  return found;
end;
$$;

-- ===================================================================== mensagem 'sistema' do card (11.13)

-- otcb_registrar_card (8.5, passo 3 do fluxo comum; regra 11.13): registra no histórico, como mensagem
-- 'sistema', o que a pessoa fez num card (confirmação, sugestão ou denúncia), para o agente saber no turno
-- seguinte. O texto é montado aqui a partir de valores fixos: o cliente não escreve texto livre com papel
-- 'sistema' (evita injeção no contexto do agente). Recebe: tipo, bar e resultado. Devolve: o id da mensagem.
-- Erros: dados_invalidos (tipo/resultado fora da lista), bar_inexistente, limite_card (30 por dia).
create function public.otcb_registrar_card(p_tipo text, p_bar_id uuid, p_resultado text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.otcb_usuario_atual();
  v_nome text;
  v_texto text;
  v_id uuid;
begin
  v_texto := case p_tipo || ':' || p_resultado
    when 'confirmacao:tem_brahma_positivo' then 'A pessoa confirmou pelo card que o bar %s tem chopp Brahma.'
    when 'confirmacao:tem_brahma_negativo' then 'A pessoa informou pelo card que o bar %s não tem mais chopp Brahma.'
    when 'confirmacao:transmite_jogos_positivo' then 'A pessoa confirmou pelo card que o bar %s passa jogo.'
    when 'confirmacao:transmite_jogos_negativo' then 'A pessoa informou pelo card que o bar %s não passa jogo.'
    when 'confirmacao:funcionamento_fechado' then 'A pessoa informou pelo card que o bar %s fechou.'
    when 'sugestao:criado' then 'A pessoa sugeriu pelo card o bar %s, que entrou na base como a confirmar.'
    when 'sugestao:ja_existia' then 'A pessoa sugeriu pelo card o bar %s, que já estava na base; a sugestão contou como confirmação.'
    when 'denuncia:registrada' then 'A pessoa denunciou pelo card uma opinião sobre o bar %s.'
    else null end;
  if v_texto is null then
    raise exception 'dados_invalidos' using errcode = 'P0001';
  end if;
  select nome into v_nome from public.otcb_bares where id = p_bar_id and excluido_em is null;
  if v_nome is null then
    raise exception 'bar_inexistente' using errcode = 'P0001';
  end if;
  if (select count(*) from public.otcb_mensagens
       where usuario_id = v_uid and papel = 'sistema'
         and public.otcb_dia_sp(criado_em) = public.otcb_hoje_sp()) >= 30 then
    raise exception 'limite_card' using errcode = 'P0001';
  end if;
  insert into public.otcb_mensagens (usuario_id, papel, conteudo)
  values (v_uid, 'sistema', format(v_texto, v_nome))
  returning id into v_id;
  return v_id;
end;
$$;

-- ===================================================================== permissões

revoke execute on function public.otcb_checar_edicao(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.otcb_salvar_opiniao(uuid, uuid, text, smallint) from public, anon, authenticated;
revoke execute on function public.otcb_recusar_edicao(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.otcb_registrar_card(text, uuid, text) from public, anon;
grant execute on function public.otcb_checar_edicao(uuid, uuid) to service_role;
grant execute on function public.otcb_salvar_opiniao(uuid, uuid, text, smallint) to service_role;
grant execute on function public.otcb_recusar_edicao(uuid, uuid) to service_role;
grant execute on function public.otcb_registrar_card(text, uuid, text) to authenticated, service_role;
