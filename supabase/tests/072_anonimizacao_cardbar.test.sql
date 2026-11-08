-- Bug achado pelo verifier na 3ª rodada do épico 8.2 (7.4 × 13.2): quando a última evidência da pessoa no
-- bar é uma confirmação negativa e havia uma positiva sua nos últimos 60 dias, apagar a conta derrubava
-- confirmacoes_60_dias (1 → 0) e podia anular ultima_confirmacao_em. O CardBar não pode mudar.
begin;
select plan(4);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000000072a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values
  ('00000000-0000-0000-0000-0000000072a1', 't72_a', now());
insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude) values
  ('00000000-0000-0000-0000-000000720001', 'Bar 72-1', 'R', 'Teste72', -16.0, -46.0),
  ('00000000-0000-0000-0000-000000720002', 'Bar 72-2', 'R', 'Teste72', -16.1, -46.0);

-- R1 sem fechamento; R2 com Google fechado há 20 dias. Nos dois: foto positiva de A há 10 dias e
-- confirmação negativa de A há 1 dia.
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias) values
  ('00000000-0000-0000-0000-000000720002', 'funcionamento', 'fechado', 'status_google', 'garimpo', null, now() - interval '20 days', 0, 1),
  ('00000000-0000-0000-0000-000000720001', 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario', '00000000-0000-0000-0000-0000000072a1', now() - interval '10 days', 0, 1),
  ('00000000-0000-0000-0000-000000720001', 'tem_brahma', 'negativo', 'confirmacao_usuario', 'usuario', '00000000-0000-0000-0000-0000000072a1', now() - interval '1 day', 0, 1),
  ('00000000-0000-0000-0000-000000720002', 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario', '00000000-0000-0000-0000-0000000072a1', now() - interval '10 days', 0, 1),
  ('00000000-0000-0000-0000-000000720002', 'tem_brahma', 'negativo', 'confirmacao_usuario', 'usuario', '00000000-0000-0000-0000-0000000072a1', now() - interval '1 day', 0, 1);

create temporary table t72_antes as
  select b.id, b.status, b.pontuacao_brahma, a.ultima_confirmacao_em, a.confirmacoes_60_dias
    from public.otcb_bares b, lateral public.otcb_agregados_confirmacao(b.id) a
   where b.bairro = 'Teste72';

delete from auth.users where id = '00000000-0000-0000-0000-0000000072a1';
select public.otcb_recalcular_todos();

create temporary view t72_depois as
  select b.id, b.status, b.pontuacao_brahma, a.ultima_confirmacao_em, a.confirmacoes_60_dias
    from public.otcb_bares b, lateral public.otcb_agregados_confirmacao(b.id) a
   where b.bairro = 'Teste72';

select is((select (status, pontuacao_brahma, ultima_confirmacao_em, confirmacoes_60_dias)::text from t72_depois where id = '00000000-0000-0000-0000-000000720001'),
          (select (status, pontuacao_brahma, ultima_confirmacao_em, confirmacoes_60_dias)::text from t72_antes where id = '00000000-0000-0000-0000-000000720001'),
  '13.2: sem fechamento, positiva superada por negativa — CardBar igual depois de apagar a conta');
select is((select (status, pontuacao_brahma, ultima_confirmacao_em, confirmacoes_60_dias)::text from t72_depois where id = '00000000-0000-0000-0000-000000720002'),
          (select (status, pontuacao_brahma, ultima_confirmacao_em, confirmacoes_60_dias)::text from t72_antes where id = '00000000-0000-0000-0000-000000720002'),
  '13.2: com fechamento antigo, positiva superada por negativa — CardBar igual depois de apagar a conta');
select is((select confirmacoes_60_dias from t72_antes where id = '00000000-0000-0000-0000-000000720001'), 1,
  'sanidade: antes da exclusão, 1 pessoa confirmou em 60 dias');
select is((select count(*)::int from public.otcb_evidencias where bar_id in ('00000000-0000-0000-0000-000000720001', '00000000-0000-0000-0000-000000720002')
            and usuario_id is not null), 0,
  '7.4: nenhuma evidência fica ligada à pessoa');

select * from finish();
rollback;
