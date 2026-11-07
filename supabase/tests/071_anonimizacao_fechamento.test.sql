-- Bug achado pelo verifier na 2ª rodada do épico 8.2 (7.4 × 11.2 e 13.2):
-- a anonimização apagava a foto positiva superada que anulava um fechamento do Google (11.2, condição 1),
-- e o bar virava 'fechado' só porque a pessoa apagou a conta. Também confirmacoes_60_dias caía.
begin;
select plan(4);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000000071a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values
  ('00000000-0000-0000-0000-0000000071a1', 't71_a', now());
insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude) values
  ('00000000-0000-0000-0000-000000710001', 'Bar 71-1', 'R', 'Teste71', -15.0, -45.0),
  ('00000000-0000-0000-0000-000000710002', 'Bar 71-2', 'R', 'Teste71', -15.1, -45.0);

-- Bar 1 (cenário do verifier): Google fechado há 5 dias; A: foto positiva há 3 dias e confirmação
-- negativa há 1 dia; cardápio e página positivos hoje.
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, url_fonte, data_evidencia, peso, meia_vida_dias) values
  ('00000000-0000-0000-0000-000000710001', 'funcionamento', 'fechado', 'status_google', 'garimpo', null, null, now() - interval '5 days', 0, 1),
  ('00000000-0000-0000-0000-000000710001', 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario', '00000000-0000-0000-0000-0000000071a1', null, now() - interval '3 days', 0, 1),
  ('00000000-0000-0000-0000-000000710001', 'tem_brahma', 'negativo', 'confirmacao_usuario', 'usuario', '00000000-0000-0000-0000-0000000071a1', null, now() - interval '1 day', 0, 1),
  ('00000000-0000-0000-0000-000000710001', 'tem_brahma', 'positivo', 'cardapio_site', 'garimpo', null, 'https://t71.test/c', now(), 0, 1),
  ('00000000-0000-0000-0000-000000710001', 'tem_brahma', 'positivo', 'pagina_web', 'garimpo', null, 'https://t71.test/p', now(), 0, 1);
-- Bar 2: A confirmou positivo duas vezes (hoje e há 2 dias).
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias) values
  ('00000000-0000-0000-0000-000000710002', 'tem_brahma', 'positivo', 'confirmacao_usuario', 'usuario', '00000000-0000-0000-0000-0000000071a1', now() - interval '2 days', 0, 1),
  ('00000000-0000-0000-0000-000000710002', 'tem_brahma', 'positivo', 'confirmacao_usuario', 'usuario', '00000000-0000-0000-0000-0000000071a1', now(), 0, 1);

create temporary table t71_antes as
  select id, status, pontuacao_brahma from public.otcb_bares where bairro = 'Teste71';
create temporary table t71_agreg_antes as
  select (public.otcb_agregados_confirmacao('00000000-0000-0000-0000-000000710002')).confirmacoes_60_dias as n;

delete from auth.users where id = '00000000-0000-0000-0000-0000000071a1';
select public.otcb_recalcular_todos();

select is((select (status, pontuacao_brahma)::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000710001'),
          (select (status, pontuacao_brahma)::text from t71_antes where id = '00000000-0000-0000-0000-000000710001'),
  '7.4 × 11.2: apagar a conta não reabre o fechamento do Google (status e pontuação iguais)');
select is((select (status, pontuacao_brahma)::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000710002'),
          (select (status, pontuacao_brahma)::text from t71_antes where id = '00000000-0000-0000-0000-000000710002'),
  '7.4 × 11.1: duas confirmações da mesma pessoa continuam valendo uma');
select is((public.otcb_agregados_confirmacao('00000000-0000-0000-0000-000000710002')).confirmacoes_60_dias,
          (select n from t71_agreg_antes),
  '13.2: confirmacoes_60_dias não cai quando a pessoa apaga a conta');
select is((select count(*)::int from public.otcb_evidencias where bar_id in ('00000000-0000-0000-0000-000000710001', '00000000-0000-0000-0000-000000710002')
            and usuario_id is not null), 0,
  '7.4: nenhuma evidência fica ligada à pessoa');

select * from finish();
rollback;
