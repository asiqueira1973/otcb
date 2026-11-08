-- Épico 8.9 — jogos (13.9): upsert idempotente por id_externo, cancelados apagados, só o serviço grava/dispara.
begin;
select plan(7);

select is(public.otcb_jogos_gravar('{"jogos":[
  {"id_externo":"t140-1","competicao":"Brasileirão","mandante":"Corinthians","visitante":"Palmeiras","inicio":"2026-11-08T22:00:00Z"},
  {"id_externo":"t140-2","competicao":"Brasileirão","mandante":"Santos","visitante":"São Paulo","inicio":"2026-11-09T22:00:00Z"}]}'::jsonb) ->> 'gravados',
  '2', 'grava 2 jogos');
select is(public.otcb_jogos_gravar('{"jogos":[
  {"id_externo":"t140-1","competicao":"Brasileirão","mandante":"Corinthians","visitante":"Palmeiras","inicio":"2026-11-08T22:00:00Z"}]}'::jsonb) ->> 'gravados',
  '0', 'mesmo jogo de novo: nada muda (idempotente)');
select is((select count(*)::int from public.otcb_jogos where id_externo like 't140-%'), 2, 'sem duplicar');
select public.otcb_jogos_gravar('{"jogos":[
  {"id_externo":"t140-1","competicao":"Brasileirão","mandante":"Corinthians","visitante":"Palmeiras","inicio":"2026-11-08T23:00:00Z"}]}'::jsonb);
select is((select inicio from public.otcb_jogos where id_externo = 't140-1'), '2026-11-08T23:00:00Z'::timestamptz, 'horário remarcado é atualizado');
select is(public.otcb_jogos_gravar('{"cancelados":["t140-2"]}'::jsonb) ->> 'apagados', '1', 'cancelado é apagado');
select ok(not has_function_privilege('authenticated', 'public.otcb_jogos_gravar(jsonb)', 'execute'), 'cliente não grava jogos');
select ok(not has_function_privilege('authenticated', 'public.otcb_jogos_disparar()', 'execute'), 'cliente não dispara a otcb-jogos');

select * from finish();
rollback;
