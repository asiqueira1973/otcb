-- 8.12 (versão 1.0.2 do app, pedido do Alexandre: "o app é para ser divertido, não complexo"):
-- • "Não sei" na sugestão cadastra o bar como "a confirmar" (evidência sugestao_sem_certeza, peso 0) e conta no Informante;
-- • a sugestão devolve "carimbo" (a foto recente sem bar virou carimbo);
-- • selo Divulgador: compartilhar a imagem do Passaporte ou da nota, na confiança (tabela otcb_compartilhamentos);
--   o Passaporte só traz o selo com p_versao >= 2, para o app 1.0.1 não mostrar selo sem texto.
-- Corpos iguais aos anteriores mais essas mudanças.

-- otcb_regra_evidencia (regra 11.1; 24.11): + sugestao_sem_certeza / tem_brahma / positivo, peso 0 (o bar entra "a confirmar"
-- sem pontuar Brahma), meia-vida 60. Recebe: tipo, assunto, sinal. Devolve: peso e meia-vida.
create or replace function public.otcb_regra_evidencia(p_tipo public.otcb_tipo_evidencia,
                                                       p_assunto public.otcb_assunto_evidencia,
                                                       p_sinal public.otcb_sinal_evidencia,
                                                       out peso numeric, out meia_vida_dias integer)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_assunto = 'funcionamento' and p_tipo in ('confirmacao_usuario', 'status_google')
     and (p_sinal = 'fechado' or (p_tipo = 'status_google' and p_sinal = 'positivo')) then
    peso := 0; meia_vida_dias := 30; return;
  end if;
  case
    when p_tipo = 'foto_colarinhometro' and p_assunto = 'tem_brahma' and p_sinal = 'positivo' then
      peso := 1.0; meia_vida_dias := 90;
    when p_tipo = 'confirmacao_usuario' and p_assunto in ('tem_brahma', 'transmite_jogos') and p_sinal = 'positivo' then
      peso := 0.6; meia_vida_dias := 60;
    when p_tipo = 'confirmacao_usuario' and p_assunto in ('tem_brahma', 'transmite_jogos') and p_sinal = 'negativo' then
      peso := -0.6; meia_vida_dias := 60;
    when p_tipo = 'sugestao_usuario' and p_assunto = 'tem_brahma' and p_sinal = 'positivo' then
      peso := 0.3; meia_vida_dias := 60;
    when p_tipo = 'cardapio_site' and p_assunto = 'tem_brahma' and p_sinal = 'positivo' then
      peso := 0.8; meia_vida_dias := 180;
    when p_tipo = 'cardapio_site' and p_assunto = 'tem_brahma' and p_sinal = 'negativo' then
      peso := -0.5; meia_vida_dias := 180;
    when p_tipo = 'pagina_web' and p_assunto in ('tem_brahma', 'transmite_jogos') and p_sinal = 'positivo' then
      peso := 0.5; meia_vida_dias := 120;
    when p_tipo = 'avaliacao_google' and p_assunto in ('tem_brahma', 'transmite_jogos') and p_sinal = 'positivo' then
      peso := 0.4; meia_vida_dias := 365;
    when p_tipo = 'seed_otcb_antigo' and p_assunto = 'tem_brahma' and p_sinal = 'positivo' then
      peso := 0.2; meia_vida_dias := 180;
    when p_tipo = 'curadoria' and p_assunto = 'tem_brahma' and p_sinal = 'positivo' then
      peso := 1.2; meia_vida_dias := 36500;
    when p_tipo = 'sugestao_no_bar' and p_assunto = 'tem_brahma' and p_sinal = 'positivo' then
      peso := 1.0; meia_vida_dias := 90;
    when p_tipo = 'sugestao_sem_certeza' and p_assunto = 'tem_brahma' and p_sinal = 'positivo' then
      peso := 0; meia_vida_dias := 60;
    else
      raise exception 'evidencia_invalida' using errcode = '22023';
  end case;
end;
$$;

-- otcb_compartilhamentos (8.12): cada vez que a pessoa fecha a folha de compartilhar do app com a imagem do Passaporte
-- ou da nota. Só leitura dos próprios; gravação só pela RPC. Apagar o perfil apaga junto.
create table public.otcb_compartilhamentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.otcb_perfis (id) on delete cascade,
  origem text not null check (origem in ('colarinho', 'passaporte')),
  criado_em timestamptz not null default now()
);
create index otcb_compartilhamentos_usuario_idx on public.otcb_compartilhamentos (usuario_id, criado_em);
alter table public.otcb_compartilhamentos enable row level security;
revoke all on public.otcb_compartilhamentos from anon, authenticated;
grant select on public.otcb_compartilhamentos to authenticated;
grant all on public.otcb_compartilhamentos to service_role;
-- otcb_compartilhamentos_le_proprios: a pessoa lê só os próprios registros.
create policy otcb_compartilhamentos_le_proprios on public.otcb_compartilhamentos
  for select to authenticated using (usuario_id = (select auth.uid()));

-- otcb_registrar_compartilhamento (8.12): registra um compartilhamento (na confiança), no máximo 10 por dia.
-- Recebe: origem ('colarinho' ou 'passaporte'). Devolve: {dias} = dias diferentes com compartilhamento (selo Divulgador).
-- Erros: dados_invalidos, limite_compartilhamento.
create function public.otcb_registrar_compartilhamento(p_origem text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.otcb_usuario_atual();
  v_dias integer;
begin
  if p_origem is null or p_origem not in ('colarinho', 'passaporte') then
    raise exception 'dados_invalidos' using errcode = 'P0001';
  end if;
  if (select count(*) from public.otcb_compartilhamentos c
       where c.usuario_id = v_uid and public.otcb_dia_sp(c.criado_em) = public.otcb_hoje_sp()) >= 10 then
    raise exception 'limite_compartilhamento' using errcode = 'P0001';
  end if;
  insert into public.otcb_compartilhamentos (usuario_id, origem) values (v_uid, p_origem);
  select count(distinct public.otcb_dia_sp(c.criado_em))::integer into v_dias
    from public.otcb_compartilhamentos c where c.usuario_id = v_uid;
  return jsonb_build_object('dias', v_dias);
end;
$$;
revoke execute on function public.otcb_registrar_compartilhamento(text) from public, anon;
grant execute on function public.otcb_registrar_compartilhamento(text) to authenticated, service_role;

-- otcb_meu_passaporte (regra 11.11, flexibilizada): carimbos, coleções e selos da própria pessoa. Recebe: p_versao
-- (versão do contrato; 2 = app 1.0.2, que conhece o selo Divulgador). Devolve: jsonb do Passaporte.
drop function public.otcb_meu_passaporte();
create function public.otcb_meu_passaporte(p_versao integer default 1)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.otcb_usuario_atual();
  v_carimbos jsonb;
  v_bairros jsonb;
  v_classicos jsonb;
  v_qtd_carimbos integer;
  v_qtd_bairros integer;
  v_olho integer;
  v_informante integer;
  v_dias_compartilhou integer;
  v_selos jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('carimbo_id', c.id, 'bar_id', b.id, 'nome_bar', b.nome,
                                               'bairro', b.bairro, 'foto_id', c.foto_id, 'criado_em', c.criado_em)
                            order by c.criado_em desc), '[]'::jsonb),
         count(*)::integer,
         count(distinct b.bairro)::integer
    into v_carimbos, v_qtd_carimbos, v_qtd_bairros
    from public.otcb_carimbos c
    join public.otcb_bares b on b.id = c.bar_id
   where c.usuario_id = v_uid;

  -- Bairro conquistado com 2 carimbos (ou todos, se o bairro tiver 1 bar); total_bares devolve a meta.
  select coalesce(jsonb_agg(jsonb_build_object('bairro', t.bairro, 'carimbos', t.carimbos, 'total_bares', least(2, t.total),
                                               'conquistado', t.carimbos >= least(2, t.total))
                            order by t.bairro), '[]'::jsonb)
    into v_bairros
    from (select a.bairro,
                 count(*)::integer as total,
                 (select count(*)::integer
                    from public.otcb_carimbos c join public.otcb_bares cb on cb.id = c.bar_id
                   where c.usuario_id = v_uid and cb.bairro = a.bairro) as carimbos
            from public.otcb_bares a
           where a.excluido_em is null and a.status in ('confirmado', 'provavel')
           group by a.bairro) t;

  select jsonb_build_object('carimbos', count(c.id)::integer, 'total', count(*)::integer)
    into v_classicos
    from public.otcb_bares b
    left join public.otcb_carimbos c on c.bar_id = b.id and c.usuario_id = v_uid
   where b.excluido_em is null and b.classico;

  select count(distinct f.bar_id)::integer into v_olho
    from public.otcb_fotos f
   where f.usuario_id = v_uid and f.nota_colarinho >= 8.0 and f.bar_id is not null;

  -- Informante: contribuições quaisquer (confirmação, sugestão, opinião), sem depender do status do bar.
  select (select count(*)::integer from public.otcb_evidencias e
           where e.usuario_id = v_uid and e.tipo in ('confirmacao_usuario', 'sugestao_usuario', 'sugestao_no_bar', 'sugestao_sem_certeza'))
       + (select count(*)::integer from public.otcb_opinioes o where o.usuario_id = v_uid)
    into v_informante;

  v_selos := jsonb_build_array(
      jsonb_build_object('selo', 'primeira_tirada', 'progresso', least(v_qtd_carimbos, 1), 'meta', 1,
                         'conquistado', v_qtd_carimbos >= 1),
      jsonb_build_object('selo', 'explorador', 'progresso', v_qtd_carimbos,
                         'meta', case when v_qtd_carimbos < 3 then 3 when v_qtd_carimbos < 10 then 10 else 25 end,
                         'nivel', case when v_qtd_carimbos >= 25 then 3 when v_qtd_carimbos >= 10 then 2
                                       when v_qtd_carimbos >= 3 then 1 else 0 end,
                         'conquistado', v_qtd_carimbos >= 3),
      jsonb_build_object('selo', 'andarilho', 'progresso', v_qtd_bairros, 'meta', 5, 'conquistado', v_qtd_bairros >= 5),
      jsonb_build_object('selo', 'olho_clinico', 'progresso', v_olho, 'meta', 3, 'conquistado', v_olho >= 3),
      jsonb_build_object('selo', 'informante', 'progresso', v_informante, 'meta', 10, 'conquistado', v_informante >= 10)
    );

  -- Divulgador (8.12): dias diferentes em que a pessoa compartilhou a imagem do Passaporte ou da nota (na confiança).
  if p_versao >= 2 then
    select count(distinct public.otcb_dia_sp(c.criado_em))::integer into v_dias_compartilhou
      from public.otcb_compartilhamentos c where c.usuario_id = v_uid;
    v_selos := v_selos || jsonb_build_array(jsonb_build_object('selo', 'divulgador', 'progresso', v_dias_compartilhou,
      'meta', case when v_dias_compartilhou < 1 then 1 when v_dias_compartilhou < 5 then 5 else 15 end,
      'nivel', case when v_dias_compartilhou >= 15 then 3 when v_dias_compartilhou >= 5 then 2
                    when v_dias_compartilhou >= 1 then 1 else 0 end,
      'conquistado', v_dias_compartilhou >= 1));
  end if;

  return jsonb_build_object(
    'carimbos', v_carimbos,
    'colecoes_bairro', v_bairros,
    'colecao_classicos', v_classicos,
    'selos', v_selos
  );
end;
$$;

revoke execute on function public.otcb_meu_passaporte(integer) from public, anon;
grant execute on function public.otcb_meu_passaporte(integer) to authenticated, service_role;

-- otcb_sugerir_bar (13.4; regra 11.16): sugestão de bar. Recebe: nome, endereço, bairro, coordenadas, tem_brahma
-- (true, false ou nulo = "Não sei") e no_bar. Devolve: {bar_id, criado, carimbo}. "Não sei": bar novo entra com
-- sugestao_sem_certeza (peso 0, "a confirmar"); bar existente não grava nada; nunca liga foto.
create or replace function public.otcb_sugerir_bar(p_nome text, p_endereco text, p_bairro text,
                                                   p_latitude double precision, p_longitude double precision,
                                                   p_tem_brahma boolean, p_no_bar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.otcb_usuario_atual();
  v_nome text := trim(coalesce(p_nome, ''));
  v_endereco text := trim(coalesce(p_endereco, ''));
  v_bairro text := trim(coalesce(p_bairro, ''));
  v_bar uuid;
  v_criado boolean := false;
  v_tinha_carimbo boolean;
begin
  if v_nome = '' or v_endereco = '' or v_bairro = '' or char_length(v_nome) > 120
     or char_length(v_endereco) > 200 or char_length(v_bairro) > 80
     or p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'dados_invalidos' using errcode = 'P0001';
  end if;

  v_bar := public.otcb_casar_bar(v_nome, p_latitude, p_longitude);

  if v_bar is not null then
    if p_tem_brahma is null then
      return jsonb_build_object('bar_id', v_bar, 'criado', false, 'carimbo', false);
    end if;
    perform public.otcb_inserir_confirmacao(v_uid, v_bar, 'tem_brahma',
                                            case when p_tem_brahma then 'positivo' else 'negativo' end::public.otcb_sinal_evidencia);
  else
    if p_tem_brahma is false then
      raise exception 'dados_invalidos' using errcode = 'P0001';
    end if;

    if (select count(*) from public.otcb_evidencias e
         where e.usuario_id = v_uid and e.tipo in ('sugestao_usuario', 'sugestao_no_bar', 'sugestao_sem_certeza')
           and public.otcb_dia_sp(e.data_evidencia) = public.otcb_hoje_sp()) >= 5 then
      raise exception 'limite_sugestao' using errcode = 'P0001';
    end if;

    insert into public.otcb_bares (nome, endereco, bairro, latitude, longitude)
    values (v_nome, v_endereco, v_bairro, round(p_latitude::numeric, 6), round(p_longitude::numeric, 6))
    returning id into v_bar;
    v_criado := true;

    -- Sugestão feita estando no bar (p_no_bar) vale como prova forte: o bar sai confirmado. "Não sei" não pontua.
    insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
    values (v_bar, 'tem_brahma', 'positivo',
            case when p_tem_brahma is null then 'sugestao_sem_certeza'
                 when p_no_bar then 'sugestao_no_bar' else 'sugestao_usuario' end::public.otcb_tipo_evidencia,
            'usuario', v_uid, now(), 0, 1);
  end if;

  if p_tem_brahma is not true then
    return jsonb_build_object('bar_id', v_bar, 'criado', v_criado, 'carimbo', false);
  end if;

  v_tinha_carimbo := exists (select 1 from public.otcb_carimbos c where c.usuario_id = v_uid and c.bar_id = v_bar);
  perform public.otcb_ligar_foto_recente(v_uid, v_bar);
  return jsonb_build_object('bar_id', v_bar, 'criado', v_criado,
    'carimbo', not v_tinha_carimbo and exists (select 1 from public.otcb_carimbos c where c.usuario_id = v_uid and c.bar_id = v_bar));
end;
$$;
