-- Épico 8.3 — apoio no banco ao garimpo automático (seções 7.5, 12.3, 13.6; regras 11.1, 11.8, 11.10,
-- 11.16 e 11.17). Tudo aqui é só para o serviço (Edge Function otcb-garimpo e pg_cron); o app não chama.
-- pg_net liberado pelo Alexandre em 07/11/2026; a URL das funções e o segredo do cron ficam no Vault.

create extension if not exists pg_net with schema extensions;

-- ===================================================================== casamento de bares (11.16)

-- otcb_casar_bar (regra 11.16, passo 2): bar existente a até 80 m com nome parecido (trigramas ≥ 0,5
-- sobre otcb_normalizar). Recebe: nome e lat/lng do candidato. Devolve: o id do bar mais próximo, ou nulo.
create function public.otcb_casar_bar(p_nome text, p_latitude double precision, p_longitude double precision)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
    from public.otcb_bares b
   where b.excluido_em is null
     and b.latitude between p_latitude - 0.001 and p_latitude + 0.001
     and b.longitude between p_longitude - 0.001 and p_longitude + 0.001
     and public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8) <= 80
     and extensions.similarity(public.otcb_normalizar(b.nome), public.otcb_normalizar(p_nome)) >= 0.5
   order by public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8)
   limit 1;
$$;

-- otcb_casar_ou_criar_bar (regra 11.16 completa, usada pelo garimpo).
-- Recebe: nome, endereço, bairro, lat/lng, google_place_id do candidato e se pode criar bar novo.
-- Devolve: { bar_id, criado } — bar_id nulo quando não casou e p_criar = false.
-- 1) mesmo place_id → mesmo bar; 2) até 80 m + nome parecido → mesmo bar (grava o place_id se faltava);
-- 3) senão, se p_criar, cria o bar 'incerto'.
create function public.otcb_casar_ou_criar_bar(p_nome text, p_endereco text, p_bairro text,
                                               p_latitude double precision, p_longitude double precision,
                                               p_place_id text, p_criar boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bar uuid;
begin
  if p_place_id is not null then
    select b.id into v_bar from public.otcb_bares b where b.google_place_id = p_place_id;
    if v_bar is not null then
      return jsonb_build_object('bar_id', v_bar, 'criado', false);
    end if;
  end if;

  v_bar := public.otcb_casar_bar(p_nome, p_latitude, p_longitude);
  if v_bar is not null then
    if p_place_id is not null then
      update public.otcb_bares set google_place_id = p_place_id where id = v_bar and google_place_id is null;
    end if;
    return jsonb_build_object('bar_id', v_bar, 'criado', false);
  end if;

  if not p_criar then
    return jsonb_build_object('bar_id', null, 'criado', false);
  end if;

  insert into public.otcb_bares (nome, endereco, bairro, latitude, longitude, google_place_id)
  values (trim(p_nome), trim(p_endereco), trim(p_bairro), round(p_latitude::numeric, 6), round(p_longitude::numeric, 6), p_place_id)
  returning id into v_bar;
  return jsonb_build_object('bar_id', v_bar, 'criado', true);
end;
$$;

-- otcb_sugerir_bar passa a usar otcb_casar_bar (mesmo comportamento da migration 0300; só reaproveita a regra).
-- Recebe/devolve/erros: ver 20261108000300_otcb_regras.sql (13.4).
create or replace function public.otcb_sugerir_bar(p_nome text, p_endereco text, p_bairro text,
                                                   p_latitude double precision, p_longitude double precision,
                                                   p_tem_brahma boolean)
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

-- ===================================================================== evidências do garimpo

-- otcb_registrar_evidencia_garimpo (regras 11.1 e 13.6; critério 3 do 8.3: não duplica).
-- Recebe: bar, assunto, sinal, tipo, url_fonte (obrigatória), trecho e data do conteúdo.
-- Devolve: 'criada', 'atualizada' ou 'igual'. Se já existe evidência do mesmo bar, assunto e url_fonte
-- (índice único parcial da 7.2), atualiza sinal, trecho, data e peso/meia-vida (regra 11.1) e recalcula o bar.
-- Para status_google a url_fonte é fixa por lugar: o último status do Google prevalece.
create function public.otcb_registrar_evidencia_garimpo(p_bar_id uuid,
                                                        p_assunto public.otcb_assunto_evidencia,
                                                        p_sinal public.otcb_sinal_evidencia,
                                                        p_tipo public.otcb_tipo_evidencia,
                                                        p_url_fonte text,
                                                        p_trecho text,
                                                        p_data_evidencia timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual record;
  v_regra record;
  v_trecho text := nullif(left(trim(coalesce(p_trecho, '')), 300), '');
begin
  if p_url_fonte is null or trim(p_url_fonte) = '' then
    raise exception 'url_fonte_obrigatoria' using errcode = '22023';
  end if;

  select id, sinal, tipo, trecho, data_evidencia into v_atual
    from public.otcb_evidencias
   where bar_id = p_bar_id and assunto = p_assunto and url_fonte = p_url_fonte;

  if v_atual.id is null then
    insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, url_fonte, trecho, data_evidencia, peso, meia_vida_dias)
    values (p_bar_id, p_assunto, p_sinal, p_tipo, 'garimpo', p_url_fonte, v_trecho, p_data_evidencia, 0, 1);
    return 'criada';
  end if;

  if v_atual.sinal = p_sinal and v_atual.tipo = p_tipo and v_atual.trecho is not distinct from v_trecho
     and v_atual.data_evidencia = p_data_evidencia then
    return 'igual';
  end if;

  select * into v_regra from public.otcb_regra_evidencia(p_tipo, p_assunto, p_sinal);
  update public.otcb_evidencias
     set sinal = p_sinal, tipo = p_tipo, trecho = v_trecho, data_evidencia = p_data_evidencia,
         peso = v_regra.peso, meia_vida_dias = v_regra.meia_vida_dias
   where id = v_atual.id;
  perform public.otcb_recalcular_bar(p_bar_id);
  return 'atualizada';
end;
$$;

-- ===================================================================== seleção de trabalho

-- otcb_bares_para_revisita (épico 8.3, modo revisita): bares não excluídos cuja última visita do garimpo
-- (data da evidência status_google) foi há mais de 7 dias ou nunca aconteceu.
-- Recebe: limite e ids já processados nesta execução. Devolve: bar, nome, place_id e até 2 URLs conhecidas
-- (cardápio/página). Prioridade: status 'incerto', depois bares só com a semente, depois a visita mais antiga.
create function public.otcb_bares_para_revisita(p_limite integer, p_excluir uuid[] default '{}')
returns table (bar_id uuid, nome text, bairro text, google_place_id text, urls text[])
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.nome, b.bairro, b.google_place_id,
         coalesce((select array_agg(u.url_fonte order by u.d desc) from (
                     select e.url_fonte, max(e.data_evidencia) as d
                       from public.otcb_evidencias e
                      where e.bar_id = b.id and e.tipo in ('cardapio_site', 'pagina_web')
                      group by e.url_fonte order by d desc limit 2) u), '{}') as urls
    from public.otcb_bares b
    left join lateral (select max(e.data_evidencia) as visita
                         from public.otcb_evidencias e
                        where e.bar_id = b.id and e.tipo = 'status_google') v on true
   where b.excluido_em is null
     and not (b.id = any(p_excluir))
     and (v.visita is null or v.visita < now() - interval '7 days')
   order by (b.status = 'incerto') desc,
            (not exists (select 1 from public.otcb_evidencias e where e.bar_id = b.id and e.origem = 'garimpo')) desc,
            v.visita nulls first, b.criado_em
   limit p_limite;
$$;

-- otcb_bares_para_coordenadas (regra 11.10): bares com place_id cujas coordenadas têm mais de 25 dias.
-- Recebe: limite e ids já processados. Devolve: bar e place_id.
create function public.otcb_bares_para_coordenadas(p_limite integer, p_excluir uuid[] default '{}')
returns table (bar_id uuid, google_place_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.google_place_id
    from public.otcb_bares b
   where b.excluido_em is null and b.google_place_id is not null
     and b.coordenadas_atualizadas_em < now() - interval '25 days'
     and not (b.id = any(p_excluir))
   order by b.coordenadas_atualizadas_em
   limit p_limite;
$$;

-- otcb_atualizar_coordenadas (regra 11.10): grava lat/lng renovadas do Google.
-- Recebe: bar, lat, lng. Devolve: nada.
create function public.otcb_atualizar_coordenadas(p_bar_id uuid, p_latitude double precision, p_longitude double precision)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.otcb_bares
     set latitude = round(p_latitude::numeric, 6), longitude = round(p_longitude::numeric, 6),
         coordenadas_atualizadas_em = now()
   where id = p_bar_id;
$$;

-- otcb_bares_para_resumo (regra 11.8): bares com 3+ opiniões publicadas e (sem resumo, ou 3+ publicadas
-- novas desde o resumo, ou resumo com mais de 30 dias). Recebe: limite e ids já processados. Devolve: bar e nome.
create function public.otcb_bares_para_resumo(p_limite integer, p_excluir uuid[] default '{}')
returns table (bar_id uuid, nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.nome
    from public.otcb_bares b
   where b.excluido_em is null and b.qtd_opinioes >= 3
     and not (b.id = any(p_excluir))
     and (b.resumo_opinioes is null
          or b.resumo_atualizado_em < now() - interval '30 days'
          or (select count(*) from public.otcb_opinioes o
               where o.bar_id = b.id and o.status = 'publicada' and o.criado_em > b.resumo_atualizado_em) >= 3)
   order by b.resumo_atualizado_em nulls first
   limit p_limite;
$$;

-- otcb_gravar_resumo (regra 11.8): grava o resumo (até 400 caracteres) se o bar ainda tem 3+ publicadas.
-- Recebe: bar e texto. Devolve: true se gravou.
create function public.otcb_gravar_resumo(p_bar_id uuid, p_resumo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.otcb_bares
     set resumo_opinioes = left(trim(p_resumo), 400), resumo_atualizado_em = now()
   where id = p_bar_id and qtd_opinioes >= 3 and nullif(trim(p_resumo), '') is not null;
  return found;
end;
$$;

-- ===================================================================== execuções (12.3) e tetos (11.17)

-- otcb_garimpo_iniciar (seção 12.3): abre uma execução do tipo. Antes, marca como 'falhou' a execução
-- 'em_andamento' do mesmo tipo com mais de 2 horas. Se ainda houver uma em andamento recente, não abre outra.
-- Recebe: tipo. Devolve: id da nova execução, ou nulo se já há uma em andamento.
create function public.otcb_garimpo_iniciar(p_tipo public.otcb_tipo_execucao)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.otcb_execucoes_garimpo
     set status = 'falhou', concluido_em = now(),
         erros = coalesce(erros, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('motivo', 'tempo_esgotado'))
   where tipo = p_tipo and status = 'em_andamento' and iniciado_em < now() - interval '2 hours';

  if exists (select 1 from public.otcb_execucoes_garimpo where tipo = p_tipo and status = 'em_andamento') then
    return null;
  end if;

  insert into public.otcb_execucoes_garimpo (tipo, cursor) values (p_tipo, '{}') returning id into v_id;
  return v_id;
end;
$$;

-- otcb_garimpo_uso_mes (regra 11.17): soma, por recurso, o uso registrado no cursor das execuções do mês
-- corrente (São Paulo). Recebe: nada. Devolve: { text_search, details_basico, details_reviews, firecrawl, ia }.
create function public.otcb_garimpo_uso_mes()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'text_search', coalesce(sum((c -> 'uso' ->> 'text_search')::int), 0),
    'details_basico', coalesce(sum((c -> 'uso' ->> 'details_basico')::int), 0),
    'details_reviews', coalesce(sum((c -> 'uso' ->> 'details_reviews')::int), 0),
    'firecrawl', coalesce(sum((c -> 'uso' ->> 'firecrawl')::int), 0),
    'ia', coalesce(sum((c -> 'uso' ->> 'ia')::int), 0))
    from (select case when cursor ~ '^\s*\{' then cursor::jsonb else '{}'::jsonb end as c
            from public.otcb_execucoes_garimpo
           where date_trunc('month', iniciado_em at time zone 'America/Sao_Paulo')
                 = date_trunc('month', now() at time zone 'America/Sao_Paulo')) x;
$$;

-- ===================================================================== disparo via pg_net + Vault

-- otcb_configurar_garimpo (épico 8.3): grava no Vault a URL base das Edge Functions e o segredo do cron
-- (cabeçalho x-otcb-cron, 13.6). Recebe: url base (…/functions/v1) e segredo. Devolve: nada.
create function public.otcb_configurar_garimpo(p_url_funcoes text, p_segredo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'otcb_url_funcoes';
  if v_id is null then
    perform vault.create_secret(p_url_funcoes, 'otcb_url_funcoes', 'OTCB: URL base das Edge Functions');
  else
    perform vault.update_secret(v_id, p_url_funcoes);
  end if;

  select id into v_id from vault.secrets where name = 'otcb_cron_secret';
  if v_id is null then
    perform vault.create_secret(p_segredo, 'otcb_cron_secret', 'OTCB: segredo do cabeçalho x-otcb-cron');
  else
    perform vault.update_secret(v_id, p_segredo);
  end if;
end;
$$;

-- otcb_garimpo_disparar (seções 7.5 e 8.3): chama a Edge Function otcb-garimpo via pg_net, com o segredo
-- do Vault no cabeçalho x-otcb-cron. Usada pelos jobs do pg_cron e pelo reagendamento entre lotes.
-- Recebe: modo e, opcionalmente, a execução a continuar. Devolve: id da requisição do pg_net.
create function public.otcb_garimpo_disparar(p_modo text, p_execucao_id uuid default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'otcb_url_funcoes';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'otcb_cron_secret';
  if v_url is null or v_segredo is null then
    raise exception 'garimpo_nao_configurado' using errcode = 'P0001';
  end if;
  return net.http_post(
    url := v_url || '/otcb-garimpo',
    body := jsonb_strip_nulls(jsonb_build_object('modo', p_modo, 'execucao_id', p_execucao_id)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-otcb-cron', v_segredo),
    timeout_milliseconds := 5000
  );
end;
$$;

-- ===================================================================== permissões e agendamentos

revoke execute on function public.otcb_casar_bar(text, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.otcb_casar_ou_criar_bar(text, text, text, double precision, double precision, text, boolean) from public, anon, authenticated;
revoke execute on function public.otcb_registrar_evidencia_garimpo(uuid, public.otcb_assunto_evidencia, public.otcb_sinal_evidencia, public.otcb_tipo_evidencia, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.otcb_bares_para_revisita(integer, uuid[]) from public, anon, authenticated;
revoke execute on function public.otcb_bares_para_coordenadas(integer, uuid[]) from public, anon, authenticated;
revoke execute on function public.otcb_atualizar_coordenadas(uuid, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.otcb_bares_para_resumo(integer, uuid[]) from public, anon, authenticated;
revoke execute on function public.otcb_gravar_resumo(uuid, text) from public, anon, authenticated;
revoke execute on function public.otcb_garimpo_iniciar(public.otcb_tipo_execucao) from public, anon, authenticated;
revoke execute on function public.otcb_garimpo_uso_mes() from public, anon, authenticated;
revoke execute on function public.otcb_configurar_garimpo(text, text) from public, anon, authenticated;
revoke execute on function public.otcb_garimpo_disparar(text, uuid) from public, anon, authenticated;
grant execute on function public.otcb_casar_bar(text, double precision, double precision) to service_role;
grant execute on function public.otcb_casar_ou_criar_bar(text, text, text, double precision, double precision, text, boolean) to service_role;
grant execute on function public.otcb_registrar_evidencia_garimpo(uuid, public.otcb_assunto_evidencia, public.otcb_sinal_evidencia, public.otcb_tipo_evidencia, text, text, timestamptz) to service_role;
grant execute on function public.otcb_bares_para_revisita(integer, uuid[]) to service_role;
grant execute on function public.otcb_bares_para_coordenadas(integer, uuid[]) to service_role;
grant execute on function public.otcb_atualizar_coordenadas(uuid, double precision, double precision) to service_role;
grant execute on function public.otcb_bares_para_resumo(integer, uuid[]) to service_role;
grant execute on function public.otcb_gravar_resumo(uuid, text) to service_role;
grant execute on function public.otcb_garimpo_iniciar(public.otcb_tipo_execucao) to service_role;
grant execute on function public.otcb_garimpo_uso_mes() to service_role;
grant execute on function public.otcb_configurar_garimpo(text, text) to service_role;
grant execute on function public.otcb_garimpo_disparar(text, uuid) to service_role;

-- Jobs do pg_cron (7.5; horários de São Paulo convertidos para UTC, SP = UTC−3).
select cron.schedule('otcb_cron_revisita', '0 7 * * *', $$select public.otcb_garimpo_disparar('revisita')$$);
select cron.schedule('otcb_cron_coordenadas', '30 7 * * *', $$select public.otcb_garimpo_disparar('coordenadas')$$);
select cron.schedule('otcb_cron_resumos', '0 8 * * *', $$select public.otcb_garimpo_disparar('resumos')$$);
select cron.schedule('otcb_cron_descoberta', '0 5 * * 1', $$select public.otcb_garimpo_disparar('descoberta')$$);
