-- Flexibilização do jogo (19/11/2026, pedido do Alexandre: "o app é para ser divertido, não complexo"):
-- • carimbo com o bar a até 300 m (era 150 m; GPS dentro de bar erra fácil);
-- • bairro conquistado com 2 carimbos (ou todos, se tiver 1 bar), sempre a mesma meta;
-- • Explorador em 3, 10 e 25 bares; Olho clínico com nota ≥ 8 em 3 bares;
-- • Informante com 10 contribuições quaisquer (confirmação, sugestão, opinião);
-- • sugestão feita estando no bar (novo parâmetro p_no_bar, mandado pela próxima versão do app) confirma o bar.
-- Corpos iguais aos anteriores mais essas mudanças.

-- otcb_regra_evidencia (regra 11.1; 24.11): + sugestao_no_bar / tem_brahma / positivo, peso 1,0, meia-vida 90 (como a foto).
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
    else
      raise exception 'evidencia_invalida' using errcode = '22023';
  end case;
end;
$$;

-- otcb_bar_mais_proximo (regra 11.4): bar ativo mais próximo a até 300 m. Recebe: coordenadas. Devolve: bar e distância.
create or replace function public.otcb_bar_mais_proximo(p_latitude double precision, p_longitude double precision)
returns table(bar_id uuid, distancia_metros integer)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, round(public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8))::integer
    from public.otcb_bares b
   where b.excluido_em is null and b.status <> 'fechado'
     and b.latitude between p_latitude - 0.003 and p_latitude + 0.003
     and b.longitude between p_longitude - 0.003 and p_longitude + 0.003
     and public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8) <= 300
   order by public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8),
            b.pontuacao_brahma desc
   limit 1;
$$;

-- otcb_meu_passaporte (regra 11.11, flexibilizada): carimbos, coleções e selos da própria pessoa.
create or replace function public.otcb_meu_passaporte()
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
           where e.usuario_id = v_uid and e.tipo in ('confirmacao_usuario', 'sugestao_usuario', 'sugestao_no_bar'))
       + (select count(*)::integer from public.otcb_opinioes o where o.usuario_id = v_uid)
    into v_informante;

  return jsonb_build_object(
    'carimbos', v_carimbos,
    'colecoes_bairro', v_bairros,
    'colecao_classicos', v_classicos,
    'selos', jsonb_build_array(
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
    )
  );
end;
$$;

-- otcb_sugerir_bar (13.4; regra 11.16): + p_no_bar (padrão false: o app atual segue como antes).
drop function public.otcb_sugerir_bar(text, text, text, double precision, double precision, boolean);
create function public.otcb_sugerir_bar(p_nome text, p_endereco text, p_bairro text,
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
begin
  if v_nome = '' or v_endereco = '' or v_bairro = '' or char_length(v_nome) > 120
     or char_length(v_endereco) > 200 or char_length(v_bairro) > 80 or p_tem_brahma is null
     or p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'dados_invalidos' using errcode = 'P0001';
  end if;

  v_bar := public.otcb_casar_bar(v_nome, p_latitude, p_longitude);

  if v_bar is not null then
    perform public.otcb_inserir_confirmacao(v_uid, v_bar, 'tem_brahma',
                                            case when p_tem_brahma then 'positivo' else 'negativo' end::public.otcb_sinal_evidencia);
    if p_tem_brahma then perform public.otcb_ligar_foto_recente(v_uid, v_bar); end if;
    return jsonb_build_object('bar_id', v_bar, 'criado', false);
  end if;

  if not p_tem_brahma then
    raise exception 'dados_invalidos' using errcode = 'P0001';
  end if;

  if (select count(*) from public.otcb_evidencias e
       where e.usuario_id = v_uid and e.tipo in ('sugestao_usuario', 'sugestao_no_bar')
         and public.otcb_dia_sp(e.data_evidencia) = public.otcb_hoje_sp()) >= 5 then
    raise exception 'limite_sugestao' using errcode = 'P0001';
  end if;

  insert into public.otcb_bares (nome, endereco, bairro, latitude, longitude)
  values (v_nome, v_endereco, v_bairro, round(p_latitude::numeric, 6), round(p_longitude::numeric, 6))
  returning id into v_bar;

  -- Sugestão feita estando no bar (p_no_bar, coordenadas do celular) vale como prova forte: o bar sai confirmado.
  insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
  values (v_bar, 'tem_brahma', 'positivo',
          case when p_no_bar then 'sugestao_no_bar' else 'sugestao_usuario' end::public.otcb_tipo_evidencia,
          'usuario', v_uid, now(), 0, 1);

  perform public.otcb_ligar_foto_recente(v_uid, v_bar);
  return jsonb_build_object('bar_id', v_bar, 'criado', true);
end;
$$;
revoke execute on function public.otcb_sugerir_bar(text, text, text, double precision, double precision, boolean, boolean) from public, anon;
grant execute on function public.otcb_sugerir_bar(text, text, text, double precision, double precision, boolean, boolean) to authenticated, service_role;
