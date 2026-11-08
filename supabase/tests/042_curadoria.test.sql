-- Emenda do 8.11 (decisão do Alexandre, 08/11/2026): evidência 'curadoria' (o dono do app atesta que o bar
-- tem chopp), peso +1,0 e meia-vida 180 dias. Hoje confirma; com 90 dias fica provável; com 200 dias cai
-- para incerto. A semente (caso A da 11.2.1) não muda.
begin;
select plan(6);

insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude)
select ('00000000-0000-0000-0000-00000042000' || c)::uuid, 'Bar curadoria ' || c, 'Rua Teste', 'Teste42', -10.0, -40.0
  from unnest(array['a','b','c','d']) c;
create temporary view v42 as
  select right(id::text, 1) as caso, status, pontuacao_brahma from public.otcb_bares where bairro = 'Teste42';

insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, data_evidencia, peso, meia_vida_dias) values
  ('00000000-0000-0000-0000-00000042000a', 'tem_brahma', 'positivo', 'curadoria', 'seed', now(), 0, 1),
  ('00000000-0000-0000-0000-00000042000b', 'tem_brahma', 'positivo', 'curadoria', 'seed', now() - interval '90 days', 0, 1),
  ('00000000-0000-0000-0000-00000042000c', 'tem_brahma', 'positivo', 'curadoria', 'seed', now() - interval '200 days', 0, 1);

select is((select status::text from v42 where caso = 'a'), 'confirmado', 'curadoria hoje → confirmado');
select is((select (peso, meia_vida_dias)::text from public.otcb_evidencias where bar_id = '00000000-0000-0000-0000-00000042000a'),
  '(1.00,180)', 'peso e meia-vida vêm da regra (1,0 e 180)');
select is((select status::text from v42 where caso = 'b'), 'provavel', 'curadoria com 90 dias → provável (≈0,71)');
select is((select status::text from v42 where caso = 'c'), 'incerto', 'curadoria com 200 dias → incerto (≈0,46)');
select throws_ok($$ insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, data_evidencia, peso, meia_vida_dias)
  values ('00000000-0000-0000-0000-00000042000d', 'tem_brahma', 'negativo', 'curadoria', 'seed', now(), 0, 1) $$,
  '22023', 'evidencia_invalida', 'curadoria só existe positiva');
select throws_ok($$ insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, data_evidencia, peso, meia_vida_dias)
  values ('00000000-0000-0000-0000-00000042000d', 'transmite_jogos', 'positivo', 'curadoria', 'seed', now(), 0, 1) $$,
  '22023', 'evidencia_invalida', 'curadoria só vale para tem_brahma');

select * from finish();
rollback;
