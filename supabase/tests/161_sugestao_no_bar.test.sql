-- Flexibilização de 19/11/2026 (Alexandre: "quem sugerir estando no bar já pode ser confirmado"): sugestão com
-- p_no_bar = true (a pessoa está no bar, coordenadas do celular) vale como prova forte e o bar já sai confirmado.
-- Sem o parâmetro (app atual), continua como antes: "a confirmar".
begin;
select plan(4);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000001610a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values ('00000000-0000-0000-0000-0000001610a1', 't161_ana', now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001610a1","role":"authenticated"}', true);
create temporary table t161 as select
  (public.otcb_sugerir_bar('Bar 161 no bar', 'Rua 161', 'Vila 161', -16.1, -46.1, true, true) ->> 'bar_id')::uuid as no_bar,
  (public.otcb_sugerir_bar('Bar 161 de casa', 'Rua 161b', 'Vila 161', -16.2, -46.1, true) ->> 'bar_id')::uuid as de_casa;
reset role;

select is((select status::text from public.otcb_bares where id = (select no_bar from t161)), 'confirmado', 'sugerido estando no bar → confirmado');
select is((select tipo::text from public.otcb_evidencias where bar_id = (select no_bar from t161)), 'sugestao_no_bar', 'evidência do tipo sugestao_no_bar');
select is((select status::text from public.otcb_bares where id = (select de_casa from t161)), 'incerto', 'sugerido sem estar no bar → a confirmar (como antes)');
select ok(has_function_privilege('authenticated', 'public.otcb_sugerir_bar(text, text, text, double precision, double precision, boolean, boolean)', 'execute'),
  'o app pode chamar a versão com p_no_bar');

select * from finish();
rollback;
