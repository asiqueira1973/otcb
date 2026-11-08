-- Épico 8.9 (verifier) — otcb_jogos_disparar acusava 'garimpo_nao_configurado' (copiado do garimpo). Mesmo
-- corpo da 20261108001300, só o nome do erro muda; permissões preservadas pelo create or replace.

-- otcb_jogos_disparar (13.9): chama a Edge Function otcb-jogos via pg_net com o segredo do Vault no cabeçalho
-- x-otcb-cron (o mesmo do garimpo). Recebe: nada. Devolve: id da requisição do pg_net.
-- Sem URL ou segredo no Vault: erro 'jogos_nao_configurado'.
create or replace function public.otcb_jogos_disparar()
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
    raise exception 'jogos_nao_configurado' using errcode = 'P0001';
  end if;
  return net.http_post(
    url := v_url || '/otcb-jogos',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-otcb-cron', v_segredo),
    timeout_milliseconds := 30000
  );
end;
$$;
