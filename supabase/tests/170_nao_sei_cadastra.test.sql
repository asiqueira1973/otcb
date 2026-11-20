-- 8.12 (versão 1.0.2, pedido do Alexandre: "o app é para ser divertido, não complexo"): na sugestão de bar, "Não sei"
-- (p_tem_brahma nulo) cadastra o bar como "a confirmar", com a evidência sugestao_sem_certeza (peso 0: não pontua
-- Brahma); se casa com um bar existente, não grava nada; nunca liga foto. A sugestão também passa a devolver
-- "carimbo": se a foto recente sem bar virou carimbo.
begin;
select plan(11);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000001700a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values ('00000000-0000-0000-0000-0000001700a1', 't170_ana', now());
-- Foto recente da Ana sem bar (não pode ser ligada pelo "Não sei").
insert into public.otcb_fotos (id, usuario_id, bar_id, caminho_storage, e_chopp, usuario_confirmou_brahma,
                               nota_altura, nota_cremosidade, nota_copo, nota_gelado, nota_colarinho, modelo_ia, criado_em) values
  ('00000000-0000-0000-0000-0000001700f1', '00000000-0000-0000-0000-0000001700a1', null, '00000000-0000-0000-0000-0000001700a1/f1.jpg',
   true, true, 8, 8, 8, 8, 8.0, 'm', now() - interval '5 minutes');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001700a1","role":"authenticated"}', true);
create temporary table t170 as select public.otcb_sugerir_bar('Bar 170 Sem Certeza', 'Rua 170', 'Vila 170', -17.0, -47.0, null) as r;
reset role;

select is((select (r ->> 'criado')::boolean from t170), true, '"Não sei" cria o bar');
select is((select status::text from public.otcb_bares where id = (select (r ->> 'bar_id')::uuid from t170)), 'incerto',
  'o bar entra como a confirmar');
select is((select (tipo::text, peso)::text from public.otcb_evidencias where bar_id = (select (r ->> 'bar_id')::uuid from t170)),
  '(sugestao_sem_certeza,0.00)', 'evidência sugestao_sem_certeza com peso 0 (não pontua Brahma)');
select is((select bar_id from public.otcb_fotos where id = '00000000-0000-0000-0000-0000001700f1'), null,
  '"Não sei" não liga a foto recente');
select is((select (r ->> 'carimbo')::boolean from t170), false, 'sem foto ligada, carimbo = false');

-- "Não sei" num bar que já existe: não grava nada.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001700a1","role":"authenticated"}', true);
create temporary table t170b as select public.otcb_sugerir_bar('Bar 170 Sem Certeza', 'Rua 170', 'Vila 170', -17.0, -47.0, null) as r;
reset role;
select is((select (r ->> 'criado')::boolean from t170b), false, '"Não sei" num bar existente devolve criado = false');
select is((select count(*)::int from public.otcb_evidencias where bar_id = (select (r ->> 'bar_id')::uuid from t170)), 1,
  '… e não grava evidência nova');

-- O Informante conta a sugestão sem certeza.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001700a1","role":"authenticated"}', true);
select is((select (s ->> 'progresso')::int from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'informante'), 1,
  'Informante conta a sugestão com "Não sei"');

-- "Tem sim" estando no bar liga a foto recente e devolve carimbo = true.
create temporary table t170c as select public.otcb_sugerir_bar('Bar 170 Com Foto', 'Rua 170c', 'Vila 170', -17.5, -47.0, true, true) as r;
reset role;
select is((select (r ->> 'carimbo')::boolean from t170c), true, 'foto recente ligada → carimbo = true');
select is((select count(*)::int from public.otcb_carimbos where usuario_id = '00000000-0000-0000-0000-0000001700a1'), 1,
  'o carimbo existe');

-- Verifier do 8.12: "Não sei" conta no limite de 5 sugestões por dia (2 feitas acima: a de "Não sei" e a com foto).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001700a1","role":"authenticated"}', true);
select public.otcb_sugerir_bar('Bar 170 extra ' || g, 'Rua', 'Vila 170', -17.6 - g * 0.01, -47.0, null) from generate_series(1, 3) g;
select throws_ok($$ select public.otcb_sugerir_bar('Bar 170 sexto', 'Rua', 'Vila 170', -17.95, -47.0, null) $$,
  'P0001', 'limite_sugestao', '"Não sei" também conta no limite de 5 por dia');
reset role;

select * from finish();
rollback;
