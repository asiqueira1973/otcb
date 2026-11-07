-- Testes de otcb_perfis (épico 8.1): matriz 5.2 (perfil), políticas 6.1, triggers 7.5 e regra 11.7.
-- Simula dois usuários anônimos (A e B) e um admin trocando role e request.jwt.claims.
-- Só lê dados criados pela própria fixture (nunca conta a tabela inteira).
begin;
select plan(22);

-- Fixture: três usuários em auth.users (anônimos, como no app).
insert into auth.users (id, aud, role, email, is_anonymous, instance_id)
values
  ('00000000-0000-0000-0000-00000000a001', 'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-00000000b002', 'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-00000000ad03', 'authenticated', 'authenticated', null, true, '00000000-0000-0000-0000-000000000000');

-- Admin nasce por SQL de serviço (seção 5.1): insere como usuario e promove fora do RLS.
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em)
values ('00000000-0000-0000-0000-00000000ad03', 'teste_admin_8_1', now());
update public.otcb_perfis set papel = 'admin' where id = '00000000-0000-0000-0000-00000000ad03';

-- ===== Usuário A =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em, time_do_coracao)
     values ('00000000-0000-0000-0000-00000000a001', 'Teste_A.81', now(), 'Corinthians') $$,
  'A insere o próprio perfil'
);

select throws_ok(
  $$ insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em)
     values ('00000000-0000-0000-0000-00000000b002', 'teste_intruso', now()) $$,
  '42501', null,
  'A não insere perfil em nome de B'
);

select is(
  (select count(*)::int from public.otcb_perfis
    where id in ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-00000000b002','00000000-0000-0000-0000-00000000ad03')),
  1,
  'A enxerga só a própria linha entre os perfis da fixture'
);

select is(
  (select public.otcb_e_admin()), false, 'otcb_e_admin() é falso para A'
);

select throws_ok(
  $$ update public.otcb_perfis set papel = 'admin' where id = '00000000-0000-0000-0000-00000000a001' $$,
  '42501', 'papel_protegido',
  'A não consegue se promover a admin'
);

select lives_ok(
  $$ update public.otcb_perfis set time_do_coracao = 'Palmeiras' where id = '00000000-0000-0000-0000-00000000a001' $$,
  'A edita o próprio time'
);

select throws_ok(
  $$ update public.otcb_perfis set maioridade_confirmada_em = now() - interval '10 years' where id = '00000000-0000-0000-0000-00000000a001' $$,
  '42501', null,
  'A não reescreve o instante da confirmação de maioridade (só apelido e time são editáveis, 8.10)'
);

select throws_ok(
  $$ delete from public.otcb_perfis where id = '00000000-0000-0000-0000-00000000a001' $$,
  '42501', null,
  'cliente não apaga perfil (só a Edge Function otcb-apagar-conta)'
);

-- ===== Usuário B =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b002","role":"authenticated"}', true);

select throws_ok(
  $$ insert into public.otcb_perfis (id, apelido, papel, maioridade_confirmada_em)
     values ('00000000-0000-0000-0000-00000000b002', 'teste_b_admin', 'admin', now()) $$,
  '42501', null,
  'B não nasce admin'
);

select throws_ok(
  $$ insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em)
     values ('00000000-0000-0000-0000-00000000b002', 'teste_a.81', now()) $$,
  '23505', null,
  'apelido repetido com outra caixa é recusado (regra 11.7)'
);

select throws_ok(
  $$ insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em)
     values ('00000000-0000-0000-0000-00000000b002', 'ab', now()) $$,
  '23514', null,
  'apelido com 2 caracteres é recusado'
);

select throws_ok(
  $$ insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em)
     values ('00000000-0000-0000-0000-00000000b002', 'abcdefghijklmnopqrstu', now()) $$,
  '23514', null,
  'apelido com 21 caracteres é recusado'
);

select throws_ok(
  $$ insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em)
     values ('00000000-0000-0000-0000-00000000b002', 'joão silva', now()) $$,
  '23514', null,
  'apelido com acento ou espaço é recusado'
);

select lives_ok(
  $$ insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em)
     values ('00000000-0000-0000-0000-00000000b002', 'tb8', now()) $$,
  'apelido com 3 caracteres é aceito'
);

select lives_ok(
  $$ update public.otcb_perfis set apelido = 'abcdefghij_klmnop.qr' where id = '00000000-0000-0000-0000-00000000b002' $$,
  'apelido com 20 caracteres, ponto e sublinhado é aceito'
);

update public.otcb_perfis set time_do_coracao = 'Hackeado' where id = '00000000-0000-0000-0000-00000000a001';
select is(
  (select count(*)::int from public.otcb_perfis where id = '00000000-0000-0000-0000-00000000a001'),
  0,
  'B não enxerga o perfil de A'
);

-- ===== Admin =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000ad03","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.otcb_perfis
    where id in ('00000000-0000-0000-0000-00000000a001','00000000-0000-0000-0000-00000000b002','00000000-0000-0000-0000-00000000ad03')),
  3,
  'admin lê todos os perfis da fixture'
);

select is(
  (select time_do_coracao from public.otcb_perfis where id = '00000000-0000-0000-0000-00000000a001'),
  'Palmeiras',
  'update de B no perfil de A não teve efeito'
);

-- Matriz 5.2: admin edita só o próprio perfil.
update public.otcb_perfis set time_do_coracao = 'Admin mexeu' where id = '00000000-0000-0000-0000-00000000a001';
select is(
  (select time_do_coracao from public.otcb_perfis where id = '00000000-0000-0000-0000-00000000a001'),
  'Palmeiras',
  'admin autenticado não edita o perfil de outra pessoa'
);

-- ===== anon =====
set local role anon;
select throws_ok(
  $$ select count(*) from public.otcb_perfis $$,
  '42501', null,
  'anon não lê otcb_perfis'
);

-- ===== atualizado_em e papel via serviço =====
reset role;
update public.otcb_perfis set criado_em = now() - interval '1 day', atualizado_em = now() - interval '1 day'
 where id = '00000000-0000-0000-0000-00000000a001';
select ok(
  (select atualizado_em > now() - interval '1 minute' from public.otcb_perfis where id = '00000000-0000-0000-0000-00000000a001'),
  'otcb_trg_atualizado_em mantém atualizado_em = now()'
);

select is(
  (select papel::text from public.otcb_perfis where id = '00000000-0000-0000-0000-00000000ad03'),
  'admin',
  'promoção a admin por SQL de serviço funciona (seção 5.1)'
);

select * from finish();
rollback;
