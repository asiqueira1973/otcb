


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."otcb_assunto_evidencia" AS ENUM (
    'tem_brahma',
    'transmite_jogos',
    'funcionamento'
);


ALTER TYPE "public"."otcb_assunto_evidencia" OWNER TO "postgres";


CREATE TYPE "public"."otcb_origem_evidencia" AS ENUM (
    'usuario',
    'garimpo',
    'seed'
);


ALTER TYPE "public"."otcb_origem_evidencia" OWNER TO "postgres";


CREATE TYPE "public"."otcb_papel" AS ENUM (
    'usuario',
    'admin'
);


ALTER TYPE "public"."otcb_papel" OWNER TO "postgres";


CREATE TYPE "public"."otcb_papel_mensagem" AS ENUM (
    'usuario',
    'assistente',
    'sistema'
);


ALTER TYPE "public"."otcb_papel_mensagem" OWNER TO "postgres";


CREATE TYPE "public"."otcb_sinal_evidencia" AS ENUM (
    'positivo',
    'negativo',
    'fechado'
);


ALTER TYPE "public"."otcb_sinal_evidencia" OWNER TO "postgres";


CREATE TYPE "public"."otcb_status_bar" AS ENUM (
    'confirmado',
    'provavel',
    'incerto',
    'sem_brahma',
    'fechado'
);


ALTER TYPE "public"."otcb_status_bar" OWNER TO "postgres";


CREATE TYPE "public"."otcb_status_execucao" AS ENUM (
    'em_andamento',
    'concluida',
    'falhou'
);


ALTER TYPE "public"."otcb_status_execucao" OWNER TO "postgres";


CREATE TYPE "public"."otcb_status_opiniao" AS ENUM (
    'publicada',
    'oculta_moderacao',
    'oculta_denuncias',
    'oculta_admin'
);


ALTER TYPE "public"."otcb_status_opiniao" OWNER TO "postgres";


CREATE TYPE "public"."otcb_tipo_evidencia" AS ENUM (
    'foto_colarinhometro',
    'confirmacao_usuario',
    'sugestao_usuario',
    'cardapio_site',
    'pagina_web',
    'avaliacao_google',
    'status_google',
    'seed_otcb_antigo'
);


ALTER TYPE "public"."otcb_tipo_evidencia" OWNER TO "postgres";


CREATE TYPE "public"."otcb_tipo_execucao" AS ENUM (
    'descoberta',
    'revisita',
    'coordenadas',
    'resumos',
    'jogos'
);


ALTER TYPE "public"."otcb_tipo_execucao" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_agregados_confirmacao"("p_bar_id" "uuid") RETURNS TABLE("ultima_confirmacao_em" timestamp with time zone, "confirmacoes_60_dias" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select max(e.data_evidencia),
         count(distinct coalesce(e.usuario_id::text, e.id::text))
           filter (where e.data_evidencia >= now() - interval '60 days' and e.peso <> 0)::integer
    from public.otcb_evidencias e
    join public.otcb_bares b on b.id = e.bar_id and b.excluido_em is null
   where e.bar_id = p_bar_id and e.assunto = 'tem_brahma' and e.sinal = 'positivo'
     and e.tipo in ('foto_colarinhometro', 'confirmacao_usuario');
$$;


ALTER FUNCTION "public"."otcb_agregados_confirmacao"("p_bar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_agregar_fotos_do_bar"("p_bar_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  update public.otcb_bares b
     set nota_colarinho_media = a.media, qtd_fotos_avaliadas = a.qtd
    from (select round(avg(f.nota_colarinho), 2) as media, count(f.nota_colarinho)::integer as qtd
            from public.otcb_fotos f
           where f.bar_id = p_bar_id and f.excluido_em is null) a
   where b.id = p_bar_id;
$$;


ALTER FUNCTION "public"."otcb_agregar_fotos_do_bar"("p_bar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_agregar_opinioes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.otcb_agregar_opinioes_do_bar(coalesce(new.bar_id, old.bar_id));
  return null;
end;
$$;


ALTER FUNCTION "public"."otcb_agregar_opinioes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_agregar_opinioes_do_bar"("p_bar_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  update public.otcb_bares b
     set nota_opinioes_media = a.media,
         qtd_opinioes = a.qtd,
         resumo_opinioes = case when a.qtd < 3 then null else b.resumo_opinioes end,
         resumo_atualizado_em = case when a.qtd < 3 then null else b.resumo_atualizado_em end
    from (select round(avg(o.nota) filter (where o.nota is not null), 2) as media, count(*)::integer as qtd
            from public.otcb_opinioes o
           where o.bar_id = p_bar_id and o.status = 'publicada') a
   where b.id = p_bar_id;
$$;


ALTER FUNCTION "public"."otcb_agregar_opinioes_do_bar"("p_bar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_anonimizar_ao_apagar_perfil"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.otcb_anonimizar_evidencias(old.id);
  return old;
end;
$$;


ALTER FUNCTION "public"."otcb_anonimizar_ao_apagar_perfil"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_anonimizar_evidencias"("p_usuario" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_total integer;
begin
  -- 1) Superadas que anulam um fechamento mais antigo: ficam, com peso 0 (o peso não entra na ordenação,
  --    então o passo 2 enxerga o mesmo conjunto de superadas).
  with superadas as (
      select o.id,
             o.assunto = 'tem_brahma' and o.sinal = 'positivo'
             and o.tipo in ('foto_colarinhometro', 'confirmacao_usuario')
             and exists (select 1 from public.otcb_evidencias f
                          where f.bar_id = o.bar_id and f.assunto = 'funcionamento' and f.sinal = 'fechado'
                            and f.data_evidencia < o.data_evidencia) as preserva
        from (select e.id, e.bar_id, e.assunto, e.sinal, e.tipo, e.data_evidencia,
                     row_number() over (partition by e.bar_id, e.assunto
                                        order by e.data_evidencia desc, e.criado_em desc, e.id desc) as ordem
                from public.otcb_evidencias e
               where e.usuario_id = p_usuario) o
       where o.ordem > 1
    )
  update public.otcb_evidencias e set peso = 0
    from superadas s where e.id = s.id and s.preserva;

  -- 2) Demais superadas: apagadas.
  with superadas as (
      select o.id,
             o.assunto = 'tem_brahma' and o.sinal = 'positivo'
             and o.tipo in ('foto_colarinhometro', 'confirmacao_usuario')
             and exists (select 1 from public.otcb_evidencias f
                          where f.bar_id = o.bar_id and f.assunto = 'funcionamento' and f.sinal = 'fechado'
                            and f.data_evidencia < o.data_evidencia) as preserva
        from (select e.id, e.bar_id, e.assunto, e.sinal, e.tipo, e.data_evidencia,
                     row_number() over (partition by e.bar_id, e.assunto
                                        order by e.data_evidencia desc, e.criado_em desc, e.id desc) as ordem
                from public.otcb_evidencias e
               where e.usuario_id = p_usuario) o
       where o.ordem > 1
    )
  delete from public.otcb_evidencias e
   using superadas s where e.id = s.id and not s.preserva;

  -- 3) Desvincula as restantes.
  update public.otcb_evidencias set usuario_id = null where usuario_id = p_usuario;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;


ALTER FUNCTION "public"."otcb_anonimizar_evidencias"("p_usuario" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_bar_mais_proximo"("p_latitude" double precision, "p_longitude" double precision) RETURNS TABLE("bar_id" "uuid", "distancia_metros" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select b.id, round(public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8))::integer
    from public.otcb_bares b
   where b.excluido_em is null and b.status <> 'fechado'
     and b.latitude between p_latitude - 0.002 and p_latitude + 0.002
     and b.longitude between p_longitude - 0.002 and p_longitude + 0.002
     and public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8) <= 150
   order by public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8),
            b.pontuacao_brahma desc
   limit 1;
$$;


ALTER FUNCTION "public"."otcb_bar_mais_proximo"("p_latitude" double precision, "p_longitude" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_buscar_bares"("p_latitude" double precision DEFAULT NULL::double precision, "p_longitude" double precision DEFAULT NULL::double precision, "p_raio_metros" integer DEFAULT NULL::integer, "p_texto" "text" DEFAULT NULL::"text", "p_bairro" "text" DEFAULT NULL::"text", "p_tem_balcao" boolean DEFAULT NULL::boolean, "p_transmite_jogos" boolean DEFAULT NULL::boolean, "p_classico" boolean DEFAULT NULL::boolean) RETURNS TABLE("bar_id" "uuid", "nome" "text", "bairro" "text", "endereco" "text", "latitude" numeric, "longitude" numeric, "distancia_metros" integer, "status" "public"."otcb_status_bar", "tem_balcao" boolean, "transmite_jogos" boolean, "classico" boolean, "nota_colarinho_media" numeric, "nota_opinioes_media" numeric, "qtd_opinioes" integer, "ultima_confirmacao_em" timestamp with time zone, "confirmacoes_60_dias" integer, "resumo_opinioes" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
declare
  v_tem_local boolean := p_latitude is not null and p_longitude is not null;
  v_raio integer := least(greatest(coalesce(p_raio_metros, 2000), 1), 10000);
  v_texto text := nullif(public.otcb_normalizar(p_texto), '');
  v_bairro text := nullif(public.otcb_normalizar(p_bairro), '');
begin
  if not v_tem_local and v_texto is null and v_bairro is null then
    raise exception 'localizacao_ou_bairro_obrigatorio' using errcode = 'P0001';
  end if;

  return query
  with candidatos as (
    select b.*,
           case when v_tem_local
                then round(public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8))::integer
           end as dist
      from public.otcb_bares b
     where b.excluido_em is null
       and b.status in ('confirmado', 'provavel', 'incerto')
       and b.pontuacao_brahma >= 0.1
       and (v_texto is null or public.otcb_normalizar(b.nome) like '%' || v_texto || '%'
                            or public.otcb_normalizar(b.bairro) like '%' || v_texto || '%')
       and (v_bairro is null or public.otcb_normalizar(b.bairro) like '%' || v_bairro || '%')
       and (p_tem_balcao is null or b.tem_balcao = p_tem_balcao)
       and (p_transmite_jogos is null or b.transmite_jogos = p_transmite_jogos)
       and (p_classico is null or b.classico = p_classico)
  )
  select c.id, c.nome, c.bairro, c.endereco, c.latitude, c.longitude, c.dist, c.status, c.tem_balcao,
         c.transmite_jogos, c.classico, c.nota_colarinho_media, c.nota_opinioes_media, c.qtd_opinioes,
         a.ultima_confirmacao_em, coalesce(a.confirmacoes_60_dias, 0), c.resumo_opinioes
    from candidatos c
    left join lateral public.otcb_agregados_confirmacao(c.id) a on true
   where not v_tem_local or c.dist <= v_raio
   order by case c.status when 'confirmado' then 1 when 'provavel' then 2 else 3 end,
            c.dist nulls last, c.pontuacao_brahma desc, c.nome
   limit 8;
end;
$$;


ALTER FUNCTION "public"."otcb_buscar_bares"("p_latitude" double precision, "p_longitude" double precision, "p_raio_metros" integer, "p_texto" "text", "p_bairro" "text", "p_tem_balcao" boolean, "p_transmite_jogos" boolean, "p_classico" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_confirmar_bar"("p_bar_id" "uuid", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := public.otcb_usuario_atual();
begin
  if not exists (select 1 from public.otcb_bares b where b.id = p_bar_id and b.excluido_em is null) then
    raise exception 'bar_inexistente' using errcode = 'P0001';
  end if;
  if (p_assunto = 'funcionamento' and p_sinal <> 'fechado')
     or (p_assunto <> 'funcionamento' and p_sinal = 'fechado') then
    raise exception 'sinal_invalido' using errcode = 'P0001';
  end if;
  perform public.otcb_inserir_confirmacao(v_uid, p_bar_id, p_assunto, p_sinal);
  return jsonb_build_object('ok', true);
end;
$$;


ALTER FUNCTION "public"."otcb_confirmar_bar"("p_bar_id" "uuid", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_contar_denuncia"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.otcb_opinioes o
     set qtd_denuncias = o.qtd_denuncias + 1,
         status = case when o.qtd_denuncias + 1 >= 3 and o.status = 'publicada' then 'oculta_denuncias' else o.status end,
         motivo_ocultacao = case when o.qtd_denuncias + 1 >= 3 and o.status = 'publicada' then 'denuncias' else o.motivo_ocultacao end
   where o.id = new.opiniao_id;
  return null;
end;
$$;


ALTER FUNCTION "public"."otcb_contar_denuncia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_definir_atualizado_em"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."otcb_definir_atualizado_em"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_definir_peso_evidencia"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  r record;
begin
  select * into r from public.otcb_regra_evidencia(new.tipo, new.assunto, new.sinal);
  new.peso := r.peso;
  new.meia_vida_dias := r.meia_vida_dias;
  return new;
end;
$$;


ALTER FUNCTION "public"."otcb_definir_peso_evidencia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_detalhes_bar"("p_bar_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v jsonb;
begin
  perform public.otcb_usuario_atual();
  select jsonb_build_object(
           'bar_id', b.id, 'nome', b.nome, 'bairro', b.bairro, 'endereco', b.endereco,
           'latitude', b.latitude, 'longitude', b.longitude, 'distancia_metros', null,
           'status', b.status, 'tem_balcao', b.tem_balcao, 'transmite_jogos', b.transmite_jogos,
           'classico', b.classico, 'nota_colarinho_media', b.nota_colarinho_media,
           'nota_opinioes_media', b.nota_opinioes_media, 'qtd_opinioes', b.qtd_opinioes,
           'ultima_confirmacao_em', a.ultima_confirmacao_em,
           'confirmacoes_60_dias', coalesce(a.confirmacoes_60_dias, 0),
           'resumo_opinioes', b.resumo_opinioes)
    into v
    from public.otcb_bares b
    left join lateral public.otcb_agregados_confirmacao(b.id) a on true
   where b.id = p_bar_id and b.excluido_em is null;
  if v is null then
    raise exception 'bar_inexistente' using errcode = 'P0001';
  end if;
  return v;
end;
$$;


ALTER FUNCTION "public"."otcb_detalhes_bar"("p_bar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_dia_sp"("p_instante" timestamp with time zone) RETURNS "date"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$ select (p_instante at time zone 'America/Sao_Paulo')::date; $$;


ALTER FUNCTION "public"."otcb_dia_sp"("p_instante" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_distancia_metros"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) RETURNS double precision
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;


ALTER FUNCTION "public"."otcb_distancia_metros"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_e_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
      from public.otcb_perfis p
     where p.id = (select auth.uid())
       and p.papel = 'admin'
  );
$$;


ALTER FUNCTION "public"."otcb_e_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_hoje_sp"() RETURNS "date"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$ select (now() at time zone 'America/Sao_Paulo')::date; $$;


ALTER FUNCTION "public"."otcb_hoje_sp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_inserir_confirmacao"("p_usuario" "uuid", "p_bar_id" "uuid", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if exists (select 1 from public.otcb_evidencias e
              where e.usuario_id = p_usuario and e.bar_id = p_bar_id and e.assunto = p_assunto
                and e.tipo = 'confirmacao_usuario' and public.otcb_dia_sp(e.data_evidencia) = public.otcb_hoje_sp()) then
    raise exception 'limite_confirmacao' using errcode = 'P0001';
  end if;
  insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
  values (p_bar_id, p_assunto, p_sinal, 'confirmacao_usuario', 'usuario', p_usuario, now(), 0, 1);
end;
$$;


ALTER FUNCTION "public"."otcb_inserir_confirmacao"("p_usuario" "uuid", "p_bar_id" "uuid", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_limpeza_diaria"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_msgs integer;
  v_jogos integer;
begin
  delete from public.otcb_mensagens where criado_em < now() - interval '30 days';
  get diagnostics v_msgs = row_count;
  delete from public.otcb_jogos where inicio < now() - interval '2 days';
  get diagnostics v_jogos = row_count;
  return jsonb_build_object('mensagens', v_msgs, 'jogos', v_jogos);
end;
$$;


ALTER FUNCTION "public"."otcb_limpeza_diaria"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_meu_passaporte"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

  select coalesce(jsonb_agg(jsonb_build_object('bairro', t.bairro, 'carimbos', t.carimbos, 'total_bares', t.total,
                                               'conquistado', t.carimbos >= least(3, t.total))
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
   where f.usuario_id = v_uid and f.nota_colarinho >= 9.0 and f.bar_id is not null;

  select count(*)::integer into v_informante
    from public.otcb_evidencias e
    join public.otcb_bares b on b.id = e.bar_id
   where e.usuario_id = v_uid and e.tipo in ('confirmacao_usuario', 'sugestao_usuario')
     and e.assunto = 'tem_brahma' and e.sinal = 'positivo'
     and b.status in ('confirmado', 'provavel');

  return jsonb_build_object(
    'carimbos', v_carimbos,
    'colecoes_bairro', v_bairros,
    'colecao_classicos', v_classicos,
    'selos', jsonb_build_array(
      jsonb_build_object('selo', 'primeira_tirada', 'progresso', least(v_qtd_carimbos, 1), 'meta', 1,
                         'conquistado', v_qtd_carimbos >= 1),
      jsonb_build_object('selo', 'explorador', 'progresso', v_qtd_carimbos,
                         'meta', case when v_qtd_carimbos < 5 then 5 when v_qtd_carimbos < 15 then 15 else 30 end,
                         'nivel', case when v_qtd_carimbos >= 30 then 3 when v_qtd_carimbos >= 15 then 2
                                       when v_qtd_carimbos >= 5 then 1 else 0 end,
                         'conquistado', v_qtd_carimbos >= 5),
      jsonb_build_object('selo', 'andarilho', 'progresso', v_qtd_bairros, 'meta', 5, 'conquistado', v_qtd_bairros >= 5),
      jsonb_build_object('selo', 'olho_clinico', 'progresso', v_olho, 'meta', 5, 'conquistado', v_olho >= 5),
      jsonb_build_object('selo', 'informante', 'progresso', v_informante, 'meta', 10, 'conquistado', v_informante >= 10)
    )
  );
end;
$$;


ALTER FUNCTION "public"."otcb_meu_passaporte"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_normalizar"("p_texto" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  select trim(regexp_replace(
           regexp_replace(
             lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_texto, ''))),
             '\s+', ' ', 'g'),
           '^\s*(bar|boteco|restaurante)\s+', '', 'g'));
$$;


ALTER FUNCTION "public"."otcb_normalizar"("p_texto" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_processar_foto"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if tg_op = 'INSERT' and new.e_chopp and new.bar_id is not null and new.usuario_confirmou_brahma then
    insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, foto_id, data_evidencia, peso, meia_vida_dias)
    values (new.bar_id, 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario', new.usuario_id, new.id, new.criado_em, 0, 1);

    if not exists (select 1 from public.otcb_carimbos c where c.usuario_id = new.usuario_id and c.bar_id = new.bar_id)
       and (select count(*) from public.otcb_carimbos c
             where c.usuario_id = new.usuario_id and public.otcb_dia_sp(c.criado_em) = public.otcb_hoje_sp()) < 2 then
      insert into public.otcb_carimbos (usuario_id, bar_id, foto_id) values (new.usuario_id, new.bar_id, new.id);
    end if;
  end if;

  if tg_op = 'DELETE' then
    if old.bar_id is not null then
      perform public.otcb_agregar_fotos_do_bar(old.bar_id);
    end if;
  elsif new.bar_id is not null then
    perform public.otcb_agregar_fotos_do_bar(new.bar_id);
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."otcb_processar_foto"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_protege_papel"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.papel is distinct from old.papel
     and coalesce((select auth.role()), '') = 'authenticated'
     and not public.otcb_e_admin() then
    raise exception 'papel_protegido' using errcode = '42501';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."otcb_protege_papel"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_recalcular_bar"("p_bar_id" "uuid") RETURNS "public"."otcb_status_bar"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_brahma numeric;
  v_jogos numeric;
  v_fechado_google timestamptz;
  v_fechado_usuarios timestamptz;
  v_fechamento timestamptz;
  v_status public.otcb_status_bar;
  v_transmite boolean;
begin
  with ev as (
    select e.assunto, e.peso, e.meia_vida_dias, e.data_evidencia,
           case when e.usuario_id is null then 1
                else row_number() over (partition by e.assunto, e.usuario_id
                                        order by e.data_evidencia desc, e.criado_em desc, e.id desc)
           end as ordem
      from public.otcb_evidencias e
     where e.bar_id = p_bar_id and e.assunto in ('tem_brahma', 'transmite_jogos')
  )
  select round(coalesce(sum(peso * power(0.5::numeric,
                 greatest(0, extract(epoch from (now() - data_evidencia)) / 86400.0) / meia_vida_dias))
                 filter (where assunto = 'tem_brahma'), 0), 3),
         round(coalesce(sum(peso * power(0.5::numeric,
                 greatest(0, extract(epoch from (now() - data_evidencia)) / 86400.0) / meia_vida_dias))
                 filter (where assunto = 'transmite_jogos'), 0), 3)
    into v_brahma, v_jogos
    from ev
   where ordem = 1;

  select max(e.data_evidencia) into v_fechado_google
    from public.otcb_evidencias e
   where e.bar_id = p_bar_id and e.assunto = 'funcionamento' and e.sinal = 'fechado' and e.tipo = 'status_google';

  select case when count(distinct coalesce(e.usuario_id::text, e.id::text)) >= 2 then max(e.data_evidencia) end
    into v_fechado_usuarios
    from public.otcb_evidencias e
   where e.bar_id = p_bar_id and e.assunto = 'funcionamento' and e.sinal = 'fechado'
     and e.tipo = 'confirmacao_usuario' and e.data_evidencia >= now() - interval '30 days';

  v_fechamento := greatest(v_fechado_google, v_fechado_usuarios);

  if v_fechamento is not null and not exists (
       select 1 from public.otcb_evidencias e
        where e.bar_id = p_bar_id and e.assunto = 'tem_brahma' and e.sinal = 'positivo'
          and e.origem = 'usuario' and e.tipo in ('foto_colarinhometro', 'confirmacao_usuario')
          and e.data_evidencia > v_fechamento) then
    v_status := 'fechado';
  elsif v_brahma <= -0.5 then
    v_status := 'sem_brahma';
  elsif v_brahma >= 1.0 then
    v_status := 'confirmado';
  elsif v_brahma >= 0.5 then
    v_status := 'provavel';
  else
    v_status := 'incerto';
  end if;

  v_transmite := case when v_jogos >= 0.5 then true when v_jogos <= -0.5 then false else null end;

  update public.otcb_bares b
     set pontuacao_brahma = v_brahma,
         transmite_jogos = v_transmite,
         status_atualizado_em = case when b.status is distinct from v_status then now() else b.status_atualizado_em end,
         status = v_status
   where b.id = p_bar_id;

  return v_status;
end;
$$;


ALTER FUNCTION "public"."otcb_recalcular_bar"("p_bar_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_recalcular_bar_da_evidencia"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  perform public.otcb_recalcular_bar(coalesce(new.bar_id, old.bar_id));
  return null;
end;
$$;


ALTER FUNCTION "public"."otcb_recalcular_bar_da_evidencia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_recalcular_todos"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_id uuid;
  v_total integer := 0;
begin
  for v_id in select id from public.otcb_bares where excluido_em is null loop
    perform public.otcb_recalcular_bar(v_id);
    perform public.otcb_agregar_fotos_do_bar(v_id);
    perform public.otcb_agregar_opinioes_do_bar(v_id);
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;


ALTER FUNCTION "public"."otcb_recalcular_todos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_regra_evidencia"("p_tipo" "public"."otcb_tipo_evidencia", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia", OUT "peso" numeric, OUT "meia_vida_dias" integer) RETURNS "record"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
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
    else
      raise exception 'evidencia_invalida' using errcode = '22023';
  end case;
end;
$$;


ALTER FUNCTION "public"."otcb_regra_evidencia"("p_tipo" "public"."otcb_tipo_evidencia", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia", OUT "peso" numeric, OUT "meia_vida_dias" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_sugerir_bar"("p_nome" "text", "p_endereco" "text", "p_bairro" "text", "p_latitude" double precision, "p_longitude" double precision, "p_tem_brahma" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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

  -- Regra 11.16 (2): mesmo bar se a até 80 m e com nome parecido.
  select b.id into v_bar
    from public.otcb_bares b
   where b.excluido_em is null
     and b.latitude between p_latitude - 0.001 and p_latitude + 0.001
     and b.longitude between p_longitude - 0.001 and p_longitude + 0.001
     and public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8) <= 80
     and extensions.similarity(public.otcb_normalizar(b.nome), public.otcb_normalizar(v_nome)) >= 0.5
   order by public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8)
   limit 1;

  if v_bar is not null then
    perform public.otcb_inserir_confirmacao(v_uid, v_bar, 'tem_brahma',
                                            case when p_tem_brahma then 'positivo' else 'negativo' end::public.otcb_sinal_evidencia);
    return jsonb_build_object('bar_id', v_bar, 'criado', false);
  end if;

  if not p_tem_brahma then
    raise exception 'dados_invalidos' using errcode = 'P0001';
  end if;

  if (select count(*) from public.otcb_evidencias e
       where e.usuario_id = v_uid and e.tipo = 'sugestao_usuario'
         and public.otcb_dia_sp(e.data_evidencia) = public.otcb_hoje_sp()) >= 5 then
    raise exception 'limite_sugestao' using errcode = 'P0001';
  end if;

  insert into public.otcb_bares (nome, endereco, bairro, latitude, longitude)
  values (v_nome, v_endereco, v_bairro, round(p_latitude::numeric, 6), round(p_longitude::numeric, 6))
  returning id into v_bar;

  insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
  values (v_bar, 'tem_brahma', 'positivo', 'sugestao_usuario', 'usuario', v_uid, now(), 0, 1);

  return jsonb_build_object('bar_id', v_bar, 'criado', true);
end;
$$;


ALTER FUNCTION "public"."otcb_sugerir_bar"("p_nome" "text", "p_endereco" "text", "p_bairro" "text", "p_latitude" double precision, "p_longitude" double precision, "p_tem_brahma" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."otcb_usuario_atual"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.otcb_perfis p where p.id = v_uid) then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;


ALTER FUNCTION "public"."otcb_usuario_atual"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."otcb_bares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "endereco" "text" NOT NULL,
    "bairro" "text" NOT NULL,
    "latitude" numeric(9,6) NOT NULL,
    "longitude" numeric(9,6) NOT NULL,
    "coordenadas_atualizadas_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "google_place_id" "text",
    "status" "public"."otcb_status_bar" DEFAULT 'incerto'::"public"."otcb_status_bar" NOT NULL,
    "pontuacao_brahma" numeric(6,3) DEFAULT 0 NOT NULL,
    "status_atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "transmite_jogos" boolean,
    "tem_balcao" boolean,
    "classico" boolean DEFAULT false NOT NULL,
    "nota_colarinho_media" numeric(4,2),
    "qtd_fotos_avaliadas" integer DEFAULT 0 NOT NULL,
    "nota_opinioes_media" numeric(3,2),
    "qtd_opinioes" integer DEFAULT 0 NOT NULL,
    "resumo_opinioes" "text",
    "resumo_atualizado_em" timestamp with time zone,
    "excluido_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."otcb_bares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otcb_carimbos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "bar_id" "uuid" NOT NULL,
    "foto_id" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."otcb_carimbos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otcb_denuncias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opiniao_id" "uuid" NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "motivo" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."otcb_denuncias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otcb_evidencias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bar_id" "uuid" NOT NULL,
    "assunto" "public"."otcb_assunto_evidencia" NOT NULL,
    "sinal" "public"."otcb_sinal_evidencia" NOT NULL,
    "tipo" "public"."otcb_tipo_evidencia" NOT NULL,
    "origem" "public"."otcb_origem_evidencia" NOT NULL,
    "usuario_id" "uuid",
    "foto_id" "uuid",
    "url_fonte" "text",
    "trecho" "text",
    "data_evidencia" timestamp with time zone NOT NULL,
    "peso" numeric(4,2) NOT NULL,
    "meia_vida_dias" integer NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "otcb_evidencias_fechado_so_funcionamento" CHECK ((("sinal" <> 'fechado'::"public"."otcb_sinal_evidencia") OR ("assunto" = 'funcionamento'::"public"."otcb_assunto_evidencia"))),
    CONSTRAINT "otcb_evidencias_trecho_tamanho" CHECK ((("trecho" IS NULL) OR ("char_length"("trecho") <= 300)))
);


ALTER TABLE "public"."otcb_evidencias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otcb_execucoes_garimpo" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "public"."otcb_tipo_execucao" NOT NULL,
    "status" "public"."otcb_status_execucao" DEFAULT 'em_andamento'::"public"."otcb_status_execucao" NOT NULL,
    "cursor" "text",
    "iniciado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "concluido_em" timestamp with time zone,
    "bares_novos" integer DEFAULT 0 NOT NULL,
    "evidencias_criadas" integer DEFAULT 0 NOT NULL,
    "chamadas_google" integer DEFAULT 0 NOT NULL,
    "chamadas_firecrawl" integer DEFAULT 0 NOT NULL,
    "erros" "jsonb"
);


ALTER TABLE "public"."otcb_execucoes_garimpo" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otcb_fotos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "bar_id" "uuid",
    "distancia_bar_metros" integer,
    "caminho_storage" "text" NOT NULL,
    "e_chopp" boolean NOT NULL,
    "usuario_confirmou_brahma" boolean NOT NULL,
    "nota_altura" numeric(3,1),
    "nota_cremosidade" numeric(3,1),
    "nota_copo" numeric(3,1),
    "nota_gelado" numeric(3,1),
    "nota_colarinho" numeric(3,1),
    "comentario_ia" "text",
    "modelo_ia" "text" NOT NULL,
    "excluido_em" timestamp with time zone,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "otcb_fotos_caminho_do_dono" CHECK (("caminho_storage" ~~ (("usuario_id")::"text" || '/%'::"text"))),
    CONSTRAINT "otcb_fotos_distancia_com_bar" CHECK ((("bar_id" IS NOT NULL) OR ("distancia_bar_metros" IS NULL))),
    CONSTRAINT "otcb_fotos_notas_faixa" CHECK ((((COALESCE("nota_altura", (0)::numeric) >= (0)::numeric) AND (COALESCE("nota_altura", (0)::numeric) <= (10)::numeric)) AND ((COALESCE("nota_cremosidade", (0)::numeric) >= (0)::numeric) AND (COALESCE("nota_cremosidade", (0)::numeric) <= (10)::numeric)) AND ((COALESCE("nota_copo", (0)::numeric) >= (0)::numeric) AND (COALESCE("nota_copo", (0)::numeric) <= (10)::numeric)) AND ((COALESCE("nota_gelado", (0)::numeric) >= (0)::numeric) AND (COALESCE("nota_gelado", (0)::numeric) <= (10)::numeric)) AND ((COALESCE("nota_colarinho", (0)::numeric) >= (0)::numeric) AND (COALESCE("nota_colarinho", (0)::numeric) <= (10)::numeric))))
);


ALTER TABLE "public"."otcb_fotos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otcb_jogos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_externo" "text" NOT NULL,
    "competicao" "text" NOT NULL,
    "mandante" "text" NOT NULL,
    "visitante" "text" NOT NULL,
    "inicio" timestamp with time zone NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."otcb_jogos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otcb_mensagens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "papel" "public"."otcb_papel_mensagem" NOT NULL,
    "conteudo" "text" NOT NULL,
    "blocos" "jsonb",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."otcb_mensagens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otcb_opinioes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "bar_id" "uuid" NOT NULL,
    "texto" "text" NOT NULL,
    "nota" smallint,
    "status" "public"."otcb_status_opiniao" DEFAULT 'publicada'::"public"."otcb_status_opiniao" NOT NULL,
    "motivo_ocultacao" "text",
    "qtd_denuncias" integer DEFAULT 0 NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "otcb_opinioes_nota_faixa" CHECK ((("nota" IS NULL) OR (("nota" >= 1) AND ("nota" <= 5)))),
    CONSTRAINT "otcb_opinioes_texto_tamanho" CHECK ((("char_length"("texto") >= 10) AND ("char_length"("texto") <= 500)))
);


ALTER TABLE "public"."otcb_opinioes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."otcb_perfis" (
    "id" "uuid" NOT NULL,
    "apelido" "text" NOT NULL,
    "papel" "public"."otcb_papel" DEFAULT 'usuario'::"public"."otcb_papel" NOT NULL,
    "maioridade_confirmada_em" timestamp with time zone NOT NULL,
    "time_do_coracao" "text",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "otcb_perfis_apelido_formato" CHECK (((("char_length"("apelido") >= 3) AND ("char_length"("apelido") <= 20)) AND ("apelido" ~ '^[A-Za-z0-9_.]+$'::"text")))
);


ALTER TABLE "public"."otcb_perfis" OWNER TO "postgres";


COMMENT ON TABLE "public"."otcb_perfis" IS 'Perfil do usuário anônimo do OTCB (spec 7.2). Data de nascimento nunca é gravada; só o instante da confirmação de maioridade (seção 6).';



ALTER TABLE ONLY "public"."otcb_bares"
    ADD CONSTRAINT "otcb_bares_google_place_id_unico" UNIQUE ("google_place_id");



ALTER TABLE ONLY "public"."otcb_bares"
    ADD CONSTRAINT "otcb_bares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otcb_carimbos"
    ADD CONSTRAINT "otcb_carimbos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otcb_carimbos"
    ADD CONSTRAINT "otcb_carimbos_usuario_bar_unico" UNIQUE ("usuario_id", "bar_id");



ALTER TABLE ONLY "public"."otcb_denuncias"
    ADD CONSTRAINT "otcb_denuncias_opiniao_usuario_unico" UNIQUE ("opiniao_id", "usuario_id");



ALTER TABLE ONLY "public"."otcb_denuncias"
    ADD CONSTRAINT "otcb_denuncias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otcb_evidencias"
    ADD CONSTRAINT "otcb_evidencias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otcb_execucoes_garimpo"
    ADD CONSTRAINT "otcb_execucoes_garimpo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otcb_fotos"
    ADD CONSTRAINT "otcb_fotos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otcb_jogos"
    ADD CONSTRAINT "otcb_jogos_id_externo_unico" UNIQUE ("id_externo");



ALTER TABLE ONLY "public"."otcb_jogos"
    ADD CONSTRAINT "otcb_jogos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otcb_mensagens"
    ADD CONSTRAINT "otcb_mensagens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otcb_opinioes"
    ADD CONSTRAINT "otcb_opinioes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otcb_opinioes"
    ADD CONSTRAINT "otcb_opinioes_usuario_bar_unico" UNIQUE ("usuario_id", "bar_id");



ALTER TABLE ONLY "public"."otcb_perfis"
    ADD CONSTRAINT "otcb_perfis_pkey" PRIMARY KEY ("id");



CREATE INDEX "otcb_bares_bairro_idx" ON "public"."otcb_bares" USING "btree" ("bairro");



CREATE INDEX "otcb_bares_lat_lng_idx" ON "public"."otcb_bares" USING "btree" ("latitude", "longitude");



CREATE INDEX "otcb_bares_status_idx" ON "public"."otcb_bares" USING "btree" ("status");



CREATE INDEX "otcb_carimbos_bar_idx" ON "public"."otcb_carimbos" USING "btree" ("bar_id");



CREATE INDEX "otcb_carimbos_foto_idx" ON "public"."otcb_carimbos" USING "btree" ("foto_id") WHERE ("foto_id" IS NOT NULL);



CREATE INDEX "otcb_denuncias_usuario_idx" ON "public"."otcb_denuncias" USING "btree" ("usuario_id");



CREATE INDEX "otcb_evidencias_bar_assunto_idx" ON "public"."otcb_evidencias" USING "btree" ("bar_id", "assunto");



CREATE UNIQUE INDEX "otcb_evidencias_fonte_unica" ON "public"."otcb_evidencias" USING "btree" ("bar_id", "assunto", "url_fonte") WHERE ("url_fonte" IS NOT NULL);



CREATE INDEX "otcb_evidencias_foto_idx" ON "public"."otcb_evidencias" USING "btree" ("foto_id") WHERE ("foto_id" IS NOT NULL);



CREATE INDEX "otcb_evidencias_usuario_idx" ON "public"."otcb_evidencias" USING "btree" ("usuario_id", "criado_em") WHERE ("usuario_id" IS NOT NULL);



CREATE INDEX "otcb_fotos_bar_idx" ON "public"."otcb_fotos" USING "btree" ("bar_id");



CREATE INDEX "otcb_fotos_usuario_idx" ON "public"."otcb_fotos" USING "btree" ("usuario_id", "criado_em" DESC);



CREATE INDEX "otcb_jogos_inicio_idx" ON "public"."otcb_jogos" USING "btree" ("inicio");



CREATE INDEX "otcb_mensagens_usuario_criado_idx" ON "public"."otcb_mensagens" USING "btree" ("usuario_id", "criado_em" DESC);



CREATE INDEX "otcb_opinioes_bar_status_idx" ON "public"."otcb_opinioes" USING "btree" ("bar_id", "status");



CREATE UNIQUE INDEX "otcb_perfis_apelido_unico" ON "public"."otcb_perfis" USING "btree" ("lower"("apelido"));



CREATE OR REPLACE TRIGGER "otcb_trg_atualizado_em" BEFORE UPDATE ON "public"."otcb_bares" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_definir_atualizado_em"();



CREATE OR REPLACE TRIGGER "otcb_trg_atualizado_em" BEFORE UPDATE ON "public"."otcb_jogos" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_definir_atualizado_em"();



CREATE OR REPLACE TRIGGER "otcb_trg_atualizado_em" BEFORE UPDATE ON "public"."otcb_opinioes" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_definir_atualizado_em"();



CREATE OR REPLACE TRIGGER "otcb_trg_atualizado_em" BEFORE UPDATE ON "public"."otcb_perfis" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_definir_atualizado_em"();



CREATE OR REPLACE TRIGGER "otcb_trg_denuncia_conta" AFTER INSERT ON "public"."otcb_denuncias" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_contar_denuncia"();



CREATE OR REPLACE TRIGGER "otcb_trg_evidencia_define_peso" BEFORE INSERT ON "public"."otcb_evidencias" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_definir_peso_evidencia"();



CREATE OR REPLACE TRIGGER "otcb_trg_evidencia_recalcula" AFTER INSERT OR DELETE ON "public"."otcb_evidencias" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_recalcular_bar_da_evidencia"();



CREATE OR REPLACE TRIGGER "otcb_trg_foto_processa" AFTER INSERT OR DELETE OR UPDATE OF "excluido_em" ON "public"."otcb_fotos" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_processar_foto"();



CREATE OR REPLACE TRIGGER "otcb_trg_opiniao_agrega" AFTER INSERT OR DELETE OR UPDATE ON "public"."otcb_opinioes" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_agregar_opinioes"();



CREATE OR REPLACE TRIGGER "otcb_trg_perfil_anonimiza" BEFORE DELETE ON "public"."otcb_perfis" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_anonimizar_ao_apagar_perfil"();



CREATE OR REPLACE TRIGGER "otcb_trg_perfil_protege_papel" BEFORE UPDATE ON "public"."otcb_perfis" FOR EACH ROW EXECUTE FUNCTION "public"."otcb_protege_papel"();



ALTER TABLE ONLY "public"."otcb_carimbos"
    ADD CONSTRAINT "otcb_carimbos_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."otcb_bares"("id");



ALTER TABLE ONLY "public"."otcb_carimbos"
    ADD CONSTRAINT "otcb_carimbos_foto_id_fkey" FOREIGN KEY ("foto_id") REFERENCES "public"."otcb_fotos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."otcb_carimbos"
    ADD CONSTRAINT "otcb_carimbos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."otcb_perfis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otcb_denuncias"
    ADD CONSTRAINT "otcb_denuncias_opiniao_id_fkey" FOREIGN KEY ("opiniao_id") REFERENCES "public"."otcb_opinioes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otcb_denuncias"
    ADD CONSTRAINT "otcb_denuncias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."otcb_perfis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otcb_evidencias"
    ADD CONSTRAINT "otcb_evidencias_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."otcb_bares"("id");



ALTER TABLE ONLY "public"."otcb_evidencias"
    ADD CONSTRAINT "otcb_evidencias_foto_id_fkey" FOREIGN KEY ("foto_id") REFERENCES "public"."otcb_fotos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."otcb_evidencias"
    ADD CONSTRAINT "otcb_evidencias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."otcb_perfis"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."otcb_fotos"
    ADD CONSTRAINT "otcb_fotos_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."otcb_bares"("id");



ALTER TABLE ONLY "public"."otcb_fotos"
    ADD CONSTRAINT "otcb_fotos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."otcb_perfis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otcb_mensagens"
    ADD CONSTRAINT "otcb_mensagens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."otcb_perfis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otcb_opinioes"
    ADD CONSTRAINT "otcb_opinioes_bar_id_fkey" FOREIGN KEY ("bar_id") REFERENCES "public"."otcb_bares"("id");



ALTER TABLE ONLY "public"."otcb_opinioes"
    ADD CONSTRAINT "otcb_opinioes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."otcb_perfis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."otcb_perfis"
    ADD CONSTRAINT "otcb_perfis_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."otcb_bares" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otcb_bares_admin_tudo" ON "public"."otcb_bares" TO "authenticated" USING (( SELECT "public"."otcb_e_admin"() AS "otcb_e_admin")) WITH CHECK (( SELECT "public"."otcb_e_admin"() AS "otcb_e_admin"));



CREATE POLICY "otcb_bares_le_ativos" ON "public"."otcb_bares" FOR SELECT TO "authenticated" USING (("excluido_em" IS NULL));



ALTER TABLE "public"."otcb_carimbos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otcb_carimbos_admin_le" ON "public"."otcb_carimbos" FOR SELECT TO "authenticated" USING (( SELECT "public"."otcb_e_admin"() AS "otcb_e_admin"));



CREATE POLICY "otcb_carimbos_le_proprios" ON "public"."otcb_carimbos" FOR SELECT TO "authenticated" USING (("usuario_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."otcb_denuncias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otcb_denuncias_admin_le" ON "public"."otcb_denuncias" FOR SELECT TO "authenticated" USING (( SELECT "public"."otcb_e_admin"() AS "otcb_e_admin"));



CREATE POLICY "otcb_denuncias_insere_propria" ON "public"."otcb_denuncias" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = ( SELECT "auth"."uid"() AS "uid")) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."otcb_opinioes" "o"
  WHERE (("o"."id" = "otcb_denuncias"."opiniao_id") AND ("o"."usuario_id" = ( SELECT "auth"."uid"() AS "uid"))))))));



ALTER TABLE "public"."otcb_evidencias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otcb_evidencias_admin_le" ON "public"."otcb_evidencias" FOR SELECT TO "authenticated" USING (( SELECT "public"."otcb_e_admin"() AS "otcb_e_admin"));



CREATE POLICY "otcb_execucoes_admin_le" ON "public"."otcb_execucoes_garimpo" FOR SELECT TO "authenticated" USING (( SELECT "public"."otcb_e_admin"() AS "otcb_e_admin"));



ALTER TABLE "public"."otcb_execucoes_garimpo" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."otcb_fotos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otcb_fotos_admin_le" ON "public"."otcb_fotos" FOR SELECT TO "authenticated" USING (( SELECT "public"."otcb_e_admin"() AS "otcb_e_admin"));



CREATE POLICY "otcb_fotos_exclui_propria" ON "public"."otcb_fotos" FOR UPDATE TO "authenticated" USING (("usuario_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ((("usuario_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("excluido_em" IS NOT NULL) AND ("excluido_em" <= ("now"() + '00:01:00'::interval))));



CREATE POLICY "otcb_fotos_le_propria" ON "public"."otcb_fotos" FOR SELECT TO "authenticated" USING (("usuario_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."otcb_jogos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otcb_jogos_le" ON "public"."otcb_jogos" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."otcb_mensagens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otcb_mensagens_apaga_proprias" ON "public"."otcb_mensagens" FOR DELETE TO "authenticated" USING (("usuario_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "otcb_mensagens_le_proprias" ON "public"."otcb_mensagens" FOR SELECT TO "authenticated" USING (("usuario_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."otcb_opinioes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otcb_opinioes_admin_tudo" ON "public"."otcb_opinioes" TO "authenticated" USING (( SELECT "public"."otcb_e_admin"() AS "otcb_e_admin")) WITH CHECK (( SELECT "public"."otcb_e_admin"() AS "otcb_e_admin"));



CREATE POLICY "otcb_opinioes_apaga_propria" ON "public"."otcb_opinioes" FOR DELETE TO "authenticated" USING (("usuario_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "otcb_opinioes_le_proprias" ON "public"."otcb_opinioes" FOR SELECT TO "authenticated" USING (("usuario_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "otcb_opinioes_le_publicadas" ON "public"."otcb_opinioes" FOR SELECT TO "authenticated" USING (("status" = 'publicada'::"public"."otcb_status_opiniao"));



ALTER TABLE "public"."otcb_perfis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "otcb_perfis_admin_le_todos" ON "public"."otcb_perfis" FOR SELECT TO "authenticated" USING (( SELECT "public"."otcb_e_admin"() AS "otcb_e_admin"));



CREATE POLICY "otcb_perfis_atualiza_proprio" ON "public"."otcb_perfis" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "otcb_perfis_insere_proprio" ON "public"."otcb_perfis" FOR INSERT TO "authenticated" WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) AND ("papel" = 'usuario'::"public"."otcb_papel")));



CREATE POLICY "otcb_perfis_le_proprio" ON "public"."otcb_perfis" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_agregados_confirmacao"("p_bar_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_agregados_confirmacao"("p_bar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_agregados_confirmacao"("p_bar_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_agregar_fotos_do_bar"("p_bar_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_agregar_fotos_do_bar"("p_bar_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_agregar_opinioes"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_agregar_opinioes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_agregar_opinioes_do_bar"("p_bar_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_agregar_opinioes_do_bar"("p_bar_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_anonimizar_ao_apagar_perfil"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_anonimizar_ao_apagar_perfil"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_anonimizar_evidencias"("p_usuario" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_anonimizar_evidencias"("p_usuario" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_bar_mais_proximo"("p_latitude" double precision, "p_longitude" double precision) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_bar_mais_proximo"("p_latitude" double precision, "p_longitude" double precision) TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_buscar_bares"("p_latitude" double precision, "p_longitude" double precision, "p_raio_metros" integer, "p_texto" "text", "p_bairro" "text", "p_tem_balcao" boolean, "p_transmite_jogos" boolean, "p_classico" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_buscar_bares"("p_latitude" double precision, "p_longitude" double precision, "p_raio_metros" integer, "p_texto" "text", "p_bairro" "text", "p_tem_balcao" boolean, "p_transmite_jogos" boolean, "p_classico" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_buscar_bares"("p_latitude" double precision, "p_longitude" double precision, "p_raio_metros" integer, "p_texto" "text", "p_bairro" "text", "p_tem_balcao" boolean, "p_transmite_jogos" boolean, "p_classico" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_confirmar_bar"("p_bar_id" "uuid", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_confirmar_bar"("p_bar_id" "uuid", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia") TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_confirmar_bar"("p_bar_id" "uuid", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia") TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_contar_denuncia"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_contar_denuncia"() TO "service_role";



GRANT ALL ON FUNCTION "public"."otcb_definir_atualizado_em"() TO "anon";
GRANT ALL ON FUNCTION "public"."otcb_definir_atualizado_em"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_definir_atualizado_em"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_definir_peso_evidencia"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_definir_peso_evidencia"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_detalhes_bar"("p_bar_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_detalhes_bar"("p_bar_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_detalhes_bar"("p_bar_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_dia_sp"("p_instante" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_dia_sp"("p_instante" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_dia_sp"("p_instante" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_distancia_metros"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_distancia_metros"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_distancia_metros"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_e_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_e_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_e_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_hoje_sp"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_hoje_sp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_hoje_sp"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_inserir_confirmacao"("p_usuario" "uuid", "p_bar_id" "uuid", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_inserir_confirmacao"("p_usuario" "uuid", "p_bar_id" "uuid", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia") TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_limpeza_diaria"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_limpeza_diaria"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_meu_passaporte"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_meu_passaporte"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_meu_passaporte"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_normalizar"("p_texto" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_normalizar"("p_texto" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_normalizar"("p_texto" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_processar_foto"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_processar_foto"() TO "service_role";



GRANT ALL ON FUNCTION "public"."otcb_protege_papel"() TO "anon";
GRANT ALL ON FUNCTION "public"."otcb_protege_papel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_protege_papel"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_recalcular_bar"("p_bar_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_recalcular_bar"("p_bar_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_recalcular_bar_da_evidencia"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_recalcular_bar_da_evidencia"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_recalcular_todos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_recalcular_todos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_regra_evidencia"("p_tipo" "public"."otcb_tipo_evidencia", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia", OUT "peso" numeric, OUT "meia_vida_dias" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_regra_evidencia"("p_tipo" "public"."otcb_tipo_evidencia", "p_assunto" "public"."otcb_assunto_evidencia", "p_sinal" "public"."otcb_sinal_evidencia", OUT "peso" numeric, OUT "meia_vida_dias" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_sugerir_bar"("p_nome" "text", "p_endereco" "text", "p_bairro" "text", "p_latitude" double precision, "p_longitude" double precision, "p_tem_brahma" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_sugerir_bar"("p_nome" "text", "p_endereco" "text", "p_bairro" "text", "p_latitude" double precision, "p_longitude" double precision, "p_tem_brahma" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_sugerir_bar"("p_nome" "text", "p_endereco" "text", "p_bairro" "text", "p_latitude" double precision, "p_longitude" double precision, "p_tem_brahma" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."otcb_usuario_atual"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."otcb_usuario_atual"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."otcb_usuario_atual"() TO "service_role";



GRANT ALL ON TABLE "public"."otcb_bares" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."otcb_bares" TO "authenticated";



GRANT ALL ON TABLE "public"."otcb_carimbos" TO "service_role";
GRANT SELECT ON TABLE "public"."otcb_carimbos" TO "authenticated";



GRANT ALL ON TABLE "public"."otcb_denuncias" TO "service_role";
GRANT SELECT ON TABLE "public"."otcb_denuncias" TO "authenticated";



GRANT INSERT("opiniao_id") ON TABLE "public"."otcb_denuncias" TO "authenticated";



GRANT INSERT("usuario_id") ON TABLE "public"."otcb_denuncias" TO "authenticated";



GRANT INSERT("motivo") ON TABLE "public"."otcb_denuncias" TO "authenticated";



GRANT ALL ON TABLE "public"."otcb_evidencias" TO "service_role";
GRANT SELECT ON TABLE "public"."otcb_evidencias" TO "authenticated";



GRANT ALL ON TABLE "public"."otcb_execucoes_garimpo" TO "service_role";
GRANT SELECT ON TABLE "public"."otcb_execucoes_garimpo" TO "authenticated";



GRANT ALL ON TABLE "public"."otcb_fotos" TO "service_role";
GRANT SELECT ON TABLE "public"."otcb_fotos" TO "authenticated";



GRANT UPDATE("excluido_em") ON TABLE "public"."otcb_fotos" TO "authenticated";



GRANT ALL ON TABLE "public"."otcb_jogos" TO "service_role";
GRANT SELECT ON TABLE "public"."otcb_jogos" TO "authenticated";



GRANT ALL ON TABLE "public"."otcb_mensagens" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."otcb_mensagens" TO "authenticated";



GRANT ALL ON TABLE "public"."otcb_opinioes" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."otcb_opinioes" TO "authenticated";



GRANT UPDATE("status") ON TABLE "public"."otcb_opinioes" TO "authenticated";



GRANT UPDATE("motivo_ocultacao") ON TABLE "public"."otcb_opinioes" TO "authenticated";



GRANT ALL ON TABLE "public"."otcb_perfis" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."otcb_perfis" TO "authenticated";



GRANT UPDATE("apelido") ON TABLE "public"."otcb_perfis" TO "authenticated";



GRANT UPDATE("papel") ON TABLE "public"."otcb_perfis" TO "authenticated";



GRANT UPDATE("time_do_coracao") ON TABLE "public"."otcb_perfis" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







