-- Épico 8.9 — jogos (seções 7.2, 13.9 e 11.14): gravação pelo serviço (otcb-jogos), disparo pelo pg_cron.

-- otcb_jogos_gravar (13.9): upsert por id_externo dos jogos vindos do football-data; os cancelados são
-- apagados. Recebe: jsonb com { jogos: [{id_externo, competicao, mandante, visitante, inicio}], cancelados:
-- [id_externo] }. Devolve: { gravados, apagados }.
create function public.otcb_jogos_gravar(p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gravados integer;
  v_apagados integer;
begin
  insert into public.otcb_jogos (id_externo, competicao, mandante, visitante, inicio)
  select j ->> 'id_externo', j ->> 'competicao', j ->> 'mandante', j ->> 'visitante', (j ->> 'inicio')::timestamptz
    from jsonb_array_elements(coalesce(p_dados -> 'jogos', '[]'::jsonb)) j
  on conflict (id_externo) do update
     set competicao = excluded.competicao, mandante = excluded.mandante, visitante = excluded.visitante,
         inicio = excluded.inicio
   where (public.otcb_jogos.competicao, public.otcb_jogos.mandante, public.otcb_jogos.visitante, public.otcb_jogos.inicio)
         is distinct from (excluded.competicao, excluded.mandante, excluded.visitante, excluded.inicio);
  get diagnostics v_gravados = row_count;
  delete from public.otcb_jogos
   where id_externo in (select jsonb_array_elements_text(coalesce(p_dados -> 'cancelados', '[]'::jsonb)));
  get diagnostics v_apagados = row_count;
  return jsonb_build_object('gravados', v_gravados, 'apagados', v_apagados);
end;
$$;

-- otcb_jogos_disparar (13.9): chama a Edge Function otcb-jogos via pg_net com o segredo do Vault no cabeçalho
-- x-otcb-cron (o mesmo do garimpo). Recebe: nada. Devolve: id da requisição do pg_net.
create function public.otcb_jogos_disparar()
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
    url := v_url || '/otcb-jogos',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-otcb-cron', v_segredo),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function public.otcb_jogos_gravar(jsonb) from public, anon, authenticated;
revoke execute on function public.otcb_jogos_disparar() from public, anon, authenticated;
grant execute on function public.otcb_jogos_gravar(jsonb) to service_role;
grant execute on function public.otcb_jogos_disparar() to service_role;

-- Job do pg_cron (13.9): diário às 08:30 UTC (05:30 em São Paulo), depois do garimpo.
select cron.schedule('otcb_cron_jogos', '30 8 * * *', $$select public.otcb_jogos_disparar()$$);
