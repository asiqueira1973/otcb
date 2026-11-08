-- Épico 8.9 (verifier) — otcb_jogos_disparar sem o Vault configurado acusa a falha com o nome da própria
-- função (jogos_nao_configurado), não com o erro do garimpo.
begin;
select plan(1);

delete from vault.secrets where name in ('otcb_url_funcoes', 'otcb_cron_secret');
select throws_ok('select public.otcb_jogos_disparar()', 'P0001', 'jogos_nao_configurado',
  'sem URL/segredo no Vault, o erro diz que os jogos não estão configurados');

select * from finish();
rollback;
