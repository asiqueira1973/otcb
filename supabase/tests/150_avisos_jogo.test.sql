-- Emenda do 8.11 (pedido do Alexandre, 08/11/2026): aviso no chat do jogo do time do coração (hoje ou amanhã),
-- gravado pelo servidor como mensagem do assistente com o card de jogos. Idempotente; apelidos de times.
begin;
select plan(12);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000001500a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000001500a2', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000001500a3', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000001500a4', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000001500a5', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em, time_do_coracao) values
  ('00000000-0000-0000-0000-0000001500a1', 't150_vasco', now(), 'Vasco'),
  ('00000000-0000-0000-0000-0000001500a2', 't150_timao', now(), 'Timão'),
  ('00000000-0000-0000-0000-0000001500a3', 't150_semtime', now(), null),
  ('00000000-0000-0000-0000-0000001500a4', 't150_botafogo', now(), 'Botafogo'),
  ('00000000-0000-0000-0000-0000001500a5', 't150_spfc', now(), 'São Paulo');

-- Jogos de teste (ids com prefixo t150): hoje mais tarde, amanhã, um que já começou e um do Botafogo-SP.
insert into public.otcb_jogos (id_externo, competicao, mandante, visitante, inicio) values
  ('t150-1', 'Copa do Brasil', 'Vasco da Gama', 'Palmeiras', date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' + interval '23 hours 50 minutes'),
  ('t150-2', 'Brasileirão', 'Corinthians', 'Santos', date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' + interval '1 day 20 hours'),
  ('t150-3', 'Brasileirão', 'Sao Paulo', 'Gremio', now() - interval '30 minutes'),
  ('t150-4', 'Série B', 'Botafogo SP', 'Ponte Preta', date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' + interval '1 day 16 hours');

create temporary view v150 as
  select p.apelido, m.conteudo, m.blocos from public.otcb_mensagens m join public.otcb_perfis p on p.id = m.usuario_id
   where p.apelido like 't150_%' and m.papel = 'assistente';

select ok(public.otcb_avisar_jogos_do_time() >= 2, 'grava os avisos');
select is((select count(*)::int from v150 where apelido = 't150_vasco'), 1, 'Vasco: 1 aviso');
select ok((select conteudo from v150 where apelido = 't150_vasco') like 'Hoje tem Vasco da Gama! Vasco da Gama × Palmeiras, Copa do Brasil, às 23h50.%',
  'texto do aviso de hoje');
select is((select blocos -> 0 -> 'jogos' -> 0 ->> 'jogo_id' from v150 where apelido = 't150_vasco'),
  (select id::text from public.otcb_jogos where id_externo = 't150-1'), 'card de jogos com o jogo');
select ok((select conteudo from v150 where apelido = 't150_timao') like 'Amanhã tem Corinthians!%', 'apelido "Timão" casa com Corinthians; aviso de amanhã');
select is((select count(*)::int from v150 where apelido = 't150_semtime'), 0, 'sem time, sem aviso');
select is((select count(*)::int from v150 where apelido = 't150_botafogo'), 0, 'Botafogo não recebe jogo do Botafogo SP');
select is((select count(*)::int from v150 where apelido = 't150_spfc'), 0, 'jogo que já começou não gera aviso');

select public.otcb_avisar_jogos_do_time();
select is((select count(*)::int from v150 where apelido = 't150_vasco'), 1, 'rodar de novo não repete o aviso');

select is(public.otcb_time_canonico('Atlético Mineiro'), public.otcb_time_canonico('Atletico-MG'), 'Atlético Mineiro = Atletico-MG');
select is(public.otcb_time_canonico('Chapecoense-sc'), 'chapecoense', 'sufixo -sc sai');
select ok(not has_function_privilege('authenticated', 'public.otcb_avisar_jogos_do_time()', 'execute'), 'cliente não dispara avisos');

select * from finish();
rollback;
