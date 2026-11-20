-- Pedido do Alexandre (19/11/2026, "deixar o jogo mais fácil"): a pessoa tira a foto num bar que ainda não existe
-- no app (sai sem carimbo) e, logo depois, cadastra o bar. A foto dela dos últimos 30 minutos, sem bar, passa a
-- ser do bar cadastrado: vira carimbo e confirmação (peso da foto), e o bar fica confirmado.
begin;
select plan(8);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000001600a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000001600a2', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values
  ('00000000-0000-0000-0000-0000001600a1', 't160_ana', now()),
  ('00000000-0000-0000-0000-0000001600a2', 't160_bia', now());

-- Fotos sem bar: a da Ana (há 10 min), uma antiga da Ana (há 2 h) e uma da Bia (há 5 min).
insert into public.otcb_fotos (id, usuario_id, bar_id, caminho_storage, e_chopp, usuario_confirmou_brahma,
                               nota_altura, nota_cremosidade, nota_copo, nota_gelado, nota_colarinho, modelo_ia, criado_em) values
  ('00000000-0000-0000-0000-0000001600f1', '00000000-0000-0000-0000-0000001600a1', null, '00000000-0000-0000-0000-0000001600a1/f1.jpg', true, true, 8, 8, 8, 8, 8.0, 'm', now() - interval '10 minutes'),
  ('00000000-0000-0000-0000-0000001600f2', '00000000-0000-0000-0000-0000001600a1', null, '00000000-0000-0000-0000-0000001600a1/f2.jpg', true, true, 7, 7, 7, 7, 7.0, 'm', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000001600f3', '00000000-0000-0000-0000-0000001600a2', null, '00000000-0000-0000-0000-0000001600a2/f3.jpg', true, true, 9, 9, 9, 9, 9.0, 'm', now() - interval '5 minutes');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001600a1","role":"authenticated"}', true);
create temporary table t160 as
  select (public.otcb_sugerir_bar('Bar Cento e Sessenta', 'Rua 160', 'Vila Teste 160', -16.0, -46.0, true) ->> 'bar_id')::uuid as bar_id;
reset role;

select is((select bar_id from public.otcb_fotos where id = '00000000-0000-0000-0000-0000001600f1'), (select bar_id from t160),
  'a foto recente da Ana passa a ser do bar cadastrado');
select is((select bar_id from public.otcb_fotos where id = '00000000-0000-0000-0000-0000001600f2'), null,
  'foto com mais de 30 minutos não é ligada');
select is((select bar_id from public.otcb_fotos where id = '00000000-0000-0000-0000-0000001600f3'), null,
  'foto de outra pessoa não é ligada');
select is((select count(*)::int from public.otcb_carimbos where usuario_id = '00000000-0000-0000-0000-0000001600a1' and bar_id = (select bar_id from t160)), 1,
  'a Ana ganha o carimbo do bar');
select is((select count(*)::int from public.otcb_evidencias where foto_id = '00000000-0000-0000-0000-0000001600f1'), 1,
  'a foto vira evidência do bar');
select is((select status::text from public.otcb_bares where id = (select bar_id from t160)), 'confirmado',
  'com a foto (peso 1,0) o bar fica confirmado');
select is((select nota_colarinho_media from public.otcb_bares where id = (select bar_id from t160)), 8.00,
  'a nota da foto entra na média do bar');

-- Sugerir um bar que já existe (casa com o cadastrado) também liga a foto recente da Bia.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001600a2","role":"authenticated"}', true);
select public.otcb_sugerir_bar('Bar Cento e Sessenta', 'Rua 160', 'Vila Teste 160', -16.0, -46.0, true);
reset role;
select is((select bar_id from public.otcb_fotos where id = '00000000-0000-0000-0000-0000001600f3'), (select bar_id from t160),
  'confirmar um bar existente pela sugestão também liga a foto recente');

select * from finish();
rollback;
