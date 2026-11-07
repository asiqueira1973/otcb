-- Critério 2 do épico 8.2: matriz de permissões 5.2 (linhas que envolvem banco) e políticas da 6.1,
-- simulando dois usuários (A, B) e um admin. Perfis e confirmações/sugestões têm testes próprios
-- (010 e 060). Só lê dados da fixture.
begin;
select plan(51);

-- ===== Fixture (como superusuário) =====
insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000000030a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000030b2', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000030ad', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values
  ('00000000-0000-0000-0000-0000000030a1', 't30_a', now()),
  ('00000000-0000-0000-0000-0000000030b2', 't30_b', now()),
  ('00000000-0000-0000-0000-0000000030ad', 't30_admin', now());
update public.otcb_perfis set papel = 'admin' where id = '00000000-0000-0000-0000-0000000030ad';

insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude, excluido_em) values
  ('00000000-0000-0000-0000-000000300001', 'Bar ativo 30', 'Rua A', 'Teste30', -11.0, -41.0, null),
  ('00000000-0000-0000-0000-000000300002', 'Bar excluido 30', 'Rua B', 'Teste30', -11.0, -41.0, now());

insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-000000300001', 'tem_brahma', 'positivo', 'seed_otcb_antigo', 'seed', now(), 0, 1);

insert into public.otcb_fotos (id, usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma, nota_colarinho, modelo_ia) values
  ('00000000-0000-0000-0000-0000003f00a1', '00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-000000300001', 10,
   '00000000-0000-0000-0000-0000000030a1/00000000-0000-0000-0000-0000003f00a1.jpg', true, true, 8.0, 'claude-haiku-5-5'),
  ('00000000-0000-0000-0000-0000003f00b2', '00000000-0000-0000-0000-0000000030b2', '00000000-0000-0000-0000-000000300001', 10,
   '00000000-0000-0000-0000-0000000030b2/00000000-0000-0000-0000-0000003f00b2.jpg', true, true, 7.0, 'claude-haiku-5-5');
-- (o trigger da 11.4 cria as evidências e os carimbos de A e B)

insert into public.otcb_opinioes (id, usuario_id, bar_id, texto, nota, status) values
  ('00000000-0000-0000-0000-0000003e00a1', '00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-000000300001', 'Chopp muito bem tirado', 5, 'publicada'),
  ('00000000-0000-0000-0000-0000003e00b2', '00000000-0000-0000-0000-0000000030b2', '00000000-0000-0000-0000-000000300001', 'Opinião oculta de B', 2, 'oculta_moderacao'),
  ('00000000-0000-0000-0000-0000003e00b3', '00000000-0000-0000-0000-0000000030b2', '00000000-0000-0000-0000-000000300002', 'Outra oculta de B aqui', 1, 'oculta_admin');

insert into public.otcb_mensagens (usuario_id, papel, conteudo) values
  ('00000000-0000-0000-0000-0000000030a1', 'usuario', 'mensagem de A'),
  ('00000000-0000-0000-0000-0000000030b2', 'usuario', 'mensagem de B');

insert into public.otcb_jogos (id_externo, competicao, mandante, visitante, inicio)
values ('t30-jogo', 'Brasileirão', 'Time A', 'Time B', now() + interval '1 day');
insert into public.otcb_execucoes_garimpo (id, tipo) values ('00000000-0000-0000-0000-0000003c0001', 'revisita');

insert into storage.objects (bucket_id, name, owner_id) values
  ('otcb-fotos', '00000000-0000-0000-0000-0000000030a1/00000000-0000-0000-0000-0000003f00a1.jpg', '00000000-0000-0000-0000-0000000030a1'),
  ('otcb-fotos', '00000000-0000-0000-0000-0000000030b2/00000000-0000-0000-0000-0000003f00b2.jpg', '00000000-0000-0000-0000-0000000030b2');

create temporary table t30_ids as
  select '00000000-0000-0000-0000-000000300001'::uuid as bar_ativo, '00000000-0000-0000-0000-000000300002'::uuid as bar_excluido;
grant select on t30_ids to authenticated;

-- ===================================================================== Usuário A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000030a1","role":"authenticated"}', true);

-- Bares (5.2: ver ativos; não cria, não edita, não exclui)
select is((select count(*)::int from public.otcb_bares where bairro = 'Teste30'), 1, 'A vê só o bar ativo (não o excluído)');
select throws_ok($$ insert into public.otcb_bares (nome, endereco, bairro, latitude, longitude) values ('X', 'Y', 'Teste30', 0, 0) $$,
  '42501', null, 'A não cria bar');
update public.otcb_bares set nome = 'Hackeado' where id = '00000000-0000-0000-0000-000000300001';
update public.otcb_bares set excluido_em = now() where id = '00000000-0000-0000-0000-000000300001';
select is((select count(*)::int from public.otcb_bares where id = '00000000-0000-0000-0000-000000300001' and nome = 'Bar ativo 30' and excluido_em is null), 1,
  'A não edita nem exclui bar (update afeta 0 linhas)');

-- Evidências (5.2: não vê cruas; não insere direto)
select is((select count(*)::int from public.otcb_evidencias where bar_id = '00000000-0000-0000-0000-000000300001'), 0, 'A não vê evidências cruas');
select throws_ok($$ insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, data_evidencia, peso, meia_vida_dias)
                    values ('00000000-0000-0000-0000-000000300001', 'tem_brahma', 'positivo', 'confirmacao_usuario', 'usuario', now(), 1, 1) $$,
  '42501', null, 'A não insere evidência direto');

-- Fotos (5.2: vê e apaga só as próprias; não envia direto)
select is((select count(*)::int from public.otcb_fotos where bar_id = '00000000-0000-0000-0000-000000300001'), 1, 'A vê só a própria foto');
select is((select usuario_id from public.otcb_fotos where bar_id = '00000000-0000-0000-0000-000000300001'),
          '00000000-0000-0000-0000-0000000030a1'::uuid, 'a foto visível é a de A');
select throws_ok($$ insert into public.otcb_fotos (usuario_id, caminho_storage, e_chopp, usuario_confirmou_brahma, modelo_ia)
                    values ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000030a1/x.jpg', true, true, 'x') $$,
  '42501', null, 'A não insere foto direto (só a Edge Function)');
select throws_ok($$ update public.otcb_fotos set nota_colarinho = 10 where id = '00000000-0000-0000-0000-0000003f00a1' $$,
  '42501', null, 'A não altera a nota da própria foto');
update public.otcb_fotos set excluido_em = now() where id = '00000000-0000-0000-0000-0000003f00b2';
select lives_ok($$ update public.otcb_fotos set excluido_em = now() where id = '00000000-0000-0000-0000-0000003f00a1' $$,
  'A apaga (soft delete) a própria foto');
select throws_ok($$ update public.otcb_fotos set excluido_em = null where id = '00000000-0000-0000-0000-0000003f00a1' $$,
  '42501', null, 'A não "desapaga" a foto (soft delete só marca a exclusão)');
select throws_ok($$ update public.otcb_fotos set excluido_em = now() + interval '100 years' where id = '00000000-0000-0000-0000-0000003f00a1' $$,
  '42501', null, 'A não grava data de exclusão no futuro');

-- Carimbos (5.2: vê só os próprios; nascem só por trigger)
select is((select count(*)::int from public.otcb_carimbos where bar_id = '00000000-0000-0000-0000-000000300001'), 1, 'A vê só o próprio carimbo');
select is((select foto_id from public.otcb_carimbos where bar_id = '00000000-0000-0000-0000-000000300001'),
          '00000000-0000-0000-0000-0000003f00a1'::uuid, 'o carimbo de A permanece após apagar a foto');
select throws_ok($$ insert into public.otcb_carimbos (usuario_id, bar_id) values ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-000000300002') $$,
  '42501', null, 'A não cria carimbo direto');

-- Opiniões (5.2: vê publicadas + todas as próprias; não vê oculta de B; não publica direto; apaga só a própria)
select is((select count(*)::int from public.otcb_opinioes where bar_id = '00000000-0000-0000-0000-000000300001'), 1,
  'A vê a própria publicada e não vê a oculta de B');
select throws_ok($$ insert into public.otcb_opinioes (usuario_id, bar_id, texto) values ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-000000300002', 'Texto com mais de dez') $$,
  '42501', null, 'A não publica opinião direto (só após moderação)');
update public.otcb_opinioes set status = 'oculta_admin' where id = '00000000-0000-0000-0000-0000003e00a1';
delete from public.otcb_opinioes where id = '00000000-0000-0000-0000-0000003e00b2';

-- Denúncias (5.2: 1 por opinião, não a própria, em nome próprio)
select throws_ok($$ insert into public.otcb_denuncias (opiniao_id, usuario_id) values ('00000000-0000-0000-0000-0000003e00a1', '00000000-0000-0000-0000-0000000030a1') $$,
  '42501', null, 'A não denuncia a própria opinião');
select throws_ok($$ insert into public.otcb_denuncias (opiniao_id, usuario_id) values ('00000000-0000-0000-0000-0000003e00b2', '00000000-0000-0000-0000-0000000030b2') $$,
  '42501', null, 'A não denuncia em nome de B');
select is((select count(*)::int from public.otcb_denuncias where opiniao_id in ('00000000-0000-0000-0000-0000003e00a1', '00000000-0000-0000-0000-0000003e00b2')), 0, 'A não lê denúncias');

-- Mensagens (5.2: vê e apaga só as próprias)
select is((select count(*)::int from public.otcb_mensagens where conteudo like 'mensagem de %'), 1, 'A vê só as próprias mensagens');
delete from public.otcb_mensagens where conteudo = 'mensagem de B';
select lives_ok($$ delete from public.otcb_mensagens where conteudo = 'mensagem de A' $$, 'A apaga o próprio histórico');
select throws_ok($$ insert into public.otcb_mensagens (usuario_id, papel, conteudo) values ('00000000-0000-0000-0000-0000000030a1', 'usuario', 'x') $$,
  '42501', null, 'A não grava mensagem direto (só serviço)');

-- Jogos e execuções
select is((select count(*)::int from public.otcb_jogos where id_externo = 't30-jogo'), 1, 'A vê os jogos');
select throws_ok($$ insert into public.otcb_jogos (id_externo, competicao, mandante, visitante, inicio) values ('x', 'x', 'x', 'x', now()) $$,
  '42501', null, 'A não grava jogos');
select is((select count(*)::int from public.otcb_execucoes_garimpo where id = '00000000-0000-0000-0000-0000003c0001'), 0, 'A não vê execuções do garimpo');

-- Storage (6.1: dono lê a própria pasta; escrita só serviço)
select is((select count(*)::int from storage.objects where bucket_id = 'otcb-fotos' and name like '00000000-0000-0000-0000-0000000030%'), 1,
  'A lê só o arquivo da própria pasta no bucket');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('otcb-fotos', '00000000-0000-0000-0000-0000000030a1/novo.jpg') $$,
  '42501', null, 'A não grava no bucket (só serviço)');

-- ===================================================================== Usuário B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000030b2","role":"authenticated"}', true);

select is((select excluido_em is null from public.otcb_fotos where id = '00000000-0000-0000-0000-0000003f00b2'), true,
  'o soft delete que A tentou na foto de B não teve efeito');
select is((select count(*)::int from public.otcb_opinioes where bar_id = '00000000-0000-0000-0000-000000300001'), 2,
  'B vê a publicada de A e a própria oculta (copy 15.17)');
select is((select status::text from public.otcb_opinioes where id = '00000000-0000-0000-0000-0000003e00a1'), 'publicada',
  'A não conseguiu ocultar a própria opinião (só admin)');
select lives_ok($$ insert into public.otcb_denuncias (opiniao_id, usuario_id, motivo) values ('00000000-0000-0000-0000-0000003e00a1', '00000000-0000-0000-0000-0000000030b2', 'ofensa') $$,
  'B denuncia a opinião de A');
select throws_ok($$ insert into public.otcb_denuncias (opiniao_id, usuario_id) values ('00000000-0000-0000-0000-0000003e00a1', '00000000-0000-0000-0000-0000000030b2') $$,
  '23505', null, 'B não denuncia a mesma opinião duas vezes');
select is((select count(*)::int from public.otcb_mensagens where conteudo = 'mensagem de B'), 1, 'o delete de A não apagou a mensagem de B');
select lives_ok($$ delete from public.otcb_opinioes where id = '00000000-0000-0000-0000-0000003e00b2' $$, 'B apaga a própria opinião');

-- ===================================================================== Admin
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000030ad","role":"authenticated"}', true);

select is((select count(*)::int from public.otcb_bares where bairro = 'Teste30'), 2, 'admin vê bares ativos e excluídos');
select lives_ok($$ update public.otcb_bares set classico = true where id = '00000000-0000-0000-0000-000000300001' $$, 'admin edita bar (curadoria de clássicos)');
select lives_ok($$ insert into public.otcb_bares (nome, endereco, bairro, latitude, longitude) values ('Bar do admin 30', 'Rua C', 'Teste30', -11.0, -41.0) $$,
  'admin cria bar');
select is((select count(*)::int from public.otcb_evidencias where bar_id = '00000000-0000-0000-0000-000000300001'), 3,
  'admin vê as evidências cruas (semente + 2 fotos)');
select is((select count(*)::int from public.otcb_fotos where bar_id = '00000000-0000-0000-0000-000000300001'), 2, 'admin vê todas as fotos');
select is((select count(*)::int from public.otcb_carimbos where bar_id = '00000000-0000-0000-0000-000000300001'), 2, 'admin vê todos os carimbos');
select is((select count(*)::int from public.otcb_denuncias where motivo = 'ofensa'), 1, 'admin lê denúncias');
select lives_ok($$ update public.otcb_opinioes set status = 'oculta_admin', motivo_ocultacao = 'teste' where id = '00000000-0000-0000-0000-0000003e00a1' $$,
  'admin oculta opinião');
select is((select count(*)::int from public.otcb_mensagens where conteudo like 'mensagem de %'), 0, 'admin NÃO lê mensagens de ninguém (privacidade, 5.2)');
select is((select count(*)::int from public.otcb_execucoes_garimpo where id = '00000000-0000-0000-0000-0000003c0001'), 1, 'admin vê execuções do garimpo');
select is((select count(*)::int from public.otcb_opinioes where id = '00000000-0000-0000-0000-0000003e00b3'), 1, 'admin vê opinião oculta de outra pessoa');
select lives_ok($$ delete from public.otcb_opinioes where id = '00000000-0000-0000-0000-0000003e00b3' $$, 'admin apaga opinião de outra pessoa');
select is((select count(*)::int from public.otcb_opinioes where id = '00000000-0000-0000-0000-0000003e00b3'), 0, 'a opinião apagada pelo admin sumiu');
select throws_ok($$ insert into public.otcb_carimbos (usuario_id, bar_id) values ('00000000-0000-0000-0000-0000000030ad', '00000000-0000-0000-0000-000000300001') $$,
  '42501', null, 'admin também não cria carimbo (só trigger)');
select lives_ok($$ update public.otcb_bares set excluido_em = now() where id = '00000000-0000-0000-0000-000000300001' $$, 'admin exclui bar (soft delete)');

-- ===================================================================== anon
set local role anon;
select throws_ok($$ select count(*) from public.otcb_bares $$, '42501', null, 'anon não lê bares');

select * from finish();
rollback;
