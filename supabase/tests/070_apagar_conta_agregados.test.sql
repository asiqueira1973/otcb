-- Bugs achados pelo verifier no épico 8.2 (reproduzidos antes da correção):
-- (1) Regra 11.1 "um voto por pessoa" × 7.4 (evidências desvinculadas em "Apagar meus dados"):
--     apagar a conta não pode mudar a pontuação nem o status do bar.
-- (2) Regra 11.5 / 7.7: média e contagem de fotos do bar ficam certas quando as fotos somem em cascata,
--     e otcb_recalcular_todos reconstrói os agregados se divergirem.
begin;
select plan(9);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000000070a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000070b2', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000070c3', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values
  ('00000000-0000-0000-0000-0000000070a1', 't70_a', now()),
  ('00000000-0000-0000-0000-0000000070b2', 't70_b', now()),
  ('00000000-0000-0000-0000-0000000070c3', 't70_c', now());
insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude) values
  ('00000000-0000-0000-0000-000000700001', 'Bar 70-1', 'R', 'Teste70', -14.0, -44.0),
  ('00000000-0000-0000-0000-000000700002', 'Bar 70-2', 'R', 'Teste70', -14.1, -44.0),
  ('00000000-0000-0000-0000-000000700003', 'Bar 70-3', 'R', 'Teste70', -14.2, -44.0);

-- (1a) A confirma o bar 1 em três dias diferentes: só a mais recente conta (0,6 → provavel).
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
select '00000000-0000-0000-0000-000000700001', 'tem_brahma', 'positivo', 'confirmacao_usuario', 'usuario',
       '00000000-0000-0000-0000-0000000070a1', now() - (d || ' days')::interval, 0, 1
  from generate_series(0, 2) d;
select is((select pontuacao_brahma from public.otcb_bares where id = '00000000-0000-0000-0000-000000700001'), 0.600,
  '11.1: três confirmações da mesma pessoa valem uma (0,6)');

-- (1b) B e C dizem que o bar 2 fechou (2 usuários distintos → fechado).
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias) values
  ('00000000-0000-0000-0000-000000700002', 'funcionamento', 'fechado', 'confirmacao_usuario', 'usuario', '00000000-0000-0000-0000-0000000070b2', now(), 0, 1),
  ('00000000-0000-0000-0000-000000700002', 'funcionamento', 'fechado', 'confirmacao_usuario', 'usuario', '00000000-0000-0000-0000-0000000070c3', now(), 0, 1);
select is((select status::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000700002'), 'fechado',
  '11.2: 2 usuários distintos dizem que fechou → fechado');

-- (2) Foto de A no bar 3 com nota 9.
insert into public.otcb_fotos (usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma, nota_colarinho, modelo_ia)
values ('00000000-0000-0000-0000-0000000070a1', '00000000-0000-0000-0000-000000700003', 5,
        '00000000-0000-0000-0000-0000000070a1/f.jpg', true, true, 9.0, 'claude-haiku-5-5');

-- "Apagar meus dados" de A e de B: o perfil sai (fotos em cascata, evidências desvinculadas — 7.4).
delete from public.otcb_perfis where id in ('00000000-0000-0000-0000-0000000070a1', '00000000-0000-0000-0000-0000000070b2');
select public.otcb_recalcular_todos();

select is((select pontuacao_brahma from public.otcb_bares where id = '00000000-0000-0000-0000-000000700001'), 0.600,
  '7.4 × 11.1: apagar a conta não multiplica os votos da pessoa (continua 0,6)');
select is((select status::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000700001'), 'provavel',
  '7.4 × 11.1: o status não muda com a exclusão da conta');
select is((select count(*)::int from public.otcb_evidencias
            where bar_id = '00000000-0000-0000-0000-000000700001' and usuario_id is null and tipo = 'confirmacao_usuario'), 1,
  '7.4: a evidência que contava fica desvinculada (usuario_id nulo)');
select is((select status::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000700002'), 'fechado',
  '7.4 × 11.2: o "fechou" de quem apagou a conta continua contando como uma pessoa');
select is((select (nota_colarinho_media, qtd_fotos_avaliadas)::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000700003'),
          '(,0)', '11.5: fotos apagadas em cascata saem da média e da contagem');

-- (2b) otcb_recalcular_todos reconstrói agregados divergentes (7.7).
update public.otcb_bares set nota_colarinho_media = 3.33, qtd_fotos_avaliadas = 7, nota_opinioes_media = 1.00, qtd_opinioes = 9
 where id = '00000000-0000-0000-0000-000000700003';
select public.otcb_recalcular_todos();
select is((select (nota_colarinho_media, qtd_fotos_avaliadas)::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000700003'),
          '(,0)', '7.7: recálculo diário reconstrói os agregados de fotos');
select is((select (nota_opinioes_media, qtd_opinioes)::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000700003'),
          '(,0)', '7.7: recálculo diário reconstrói os agregados de opiniões');

select * from finish();
rollback;
