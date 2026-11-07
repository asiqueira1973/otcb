-- RPCs do app (13.4) e demais regras de banco: otcb_confirmar_bar (11.6), otcb_sugerir_bar (11.16),
-- otcb_buscar_bares (11.9), otcb_detalhes_bar, otcb_meu_passaporte (11.11), agregação de opiniões (11.7/11.8),
-- denúncias (11.7) e limpeza (11.14). Só lê dados da fixture.
begin;
select plan(38);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000000060a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000060b2', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000060c3', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000060d4', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values
  ('00000000-0000-0000-0000-0000000060a1', 't60_a', now()),
  ('00000000-0000-0000-0000-0000000060b2', 't60_b', now()),
  ('00000000-0000-0000-0000-0000000060c3', 't60_c', now());
-- 60d4 é sessão anônima sem perfil (onboarding incompleto).

-- Bares em torno de (-13, -43). Nomes e bairros com acento para testar a busca sem acento.
insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude, tem_balcao, classico) values
  ('00000000-0000-0000-0000-000000600001', 'Bar do Zé Teste', 'Rua 1', 'Vila Teste Sessenta', -13.000000, -43.000000, true, true),
  ('00000000-0000-0000-0000-000000600002', 'Boteco Provável', 'Rua 2', 'Vila Teste Sessenta', -13.001000, -43.000000, null, false),
  ('00000000-0000-0000-0000-000000600003', 'Bar Incerto 60', 'Rua 3', 'Vila Teste Sessenta', -13.002000, -43.000000, null, false),
  ('00000000-0000-0000-0000-000000600004', 'Bar Velho 60', 'Rua 4', 'Vila Teste Sessenta', -13.000500, -43.000000, null, false),
  ('00000000-0000-0000-0000-000000600005', 'Bar Longe 60', 'Rua 5', 'Vila Teste Sessenta', -13.050000, -43.000000, null, false),
  ('00000000-0000-0000-0000-000000600006', 'Bar Sem Brahma 60', 'Rua 6', 'Vila Teste Sessenta', -13.000100, -43.000000, null, false),
  ('00000000-0000-0000-0000-000000600007', 'Bar Muito Longe 60', 'Rua 7', 'Outro Bairro 60', -13.120000, -43.000000, null, false);
-- Status por evidência (11.1/11.2): 1 confirmado, 2 provável, 3 incerto (0,2), 4 semente velha (caso B),
-- 5 longe (incerto 0,2), 6 sem_brahma.
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, url_fonte, data_evidencia, peso, meia_vida_dias) values
  ('00000000-0000-0000-0000-000000600001', 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario', '00000000-0000-0000-0000-0000000060c3', null, now(), 0, 1),
  ('00000000-0000-0000-0000-000000600002', 'tem_brahma', 'positivo', 'pagina_web', 'garimpo', null, 'https://t60.test/2', now(), 0, 1),
  ('00000000-0000-0000-0000-000000600003', 'tem_brahma', 'positivo', 'seed_otcb_antigo', 'seed', null, null, now(), 0, 1),
  ('00000000-0000-0000-0000-000000600004', 'tem_brahma', 'positivo', 'seed_otcb_antigo', 'seed', null, null, now() - interval '200 days', 0, 1),
  ('00000000-0000-0000-0000-000000600005', 'tem_brahma', 'positivo', 'seed_otcb_antigo', 'seed', null, null, now(), 0, 1),
  ('00000000-0000-0000-0000-000000600006', 'tem_brahma', 'negativo', 'cardapio_site', 'garimpo', null, 'https://t60.test/6', now(), 0, 1),
  ('00000000-0000-0000-0000-000000600007', 'tem_brahma', 'positivo', 'seed_otcb_antigo', 'seed', null, null, now(), 0, 1);

-- ===================================================================== usuário A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000060a1","role":"authenticated"}', true);

-- otcb_confirmar_bar (11.6: 1 por bar e assunto por dia)
select is(public.otcb_confirmar_bar('00000000-0000-0000-0000-000000600003', 'tem_brahma', 'positivo'), '{"ok": true}'::jsonb,
  'confirmar_bar devolve { ok: true }');
select throws_ok($$ select public.otcb_confirmar_bar('00000000-0000-0000-0000-000000600003', 'tem_brahma', 'negativo') $$,
  'P0001', 'limite_confirmacao', '11.6: 2ª confirmação do mesmo bar e assunto no dia é recusada');
select lives_ok($$ select public.otcb_confirmar_bar('00000000-0000-0000-0000-000000600003', 'transmite_jogos', 'positivo') $$,
  '11.6: outro assunto no mesmo bar é permitido');
select throws_ok($$ select public.otcb_confirmar_bar('00000000-0000-0000-0000-000000600003', 'funcionamento', 'positivo') $$,
  'P0001', 'sinal_invalido', 'funcionamento aceita só "fechado"');
select throws_ok($$ select public.otcb_confirmar_bar('00000000-0000-0000-0000-000000600003', 'tem_brahma', 'fechado') $$,
  'P0001', 'sinal_invalido', '"fechado" só vale para funcionamento');
select throws_ok($$ select public.otcb_confirmar_bar('00000000-0000-0000-0000-000000609999', 'tem_brahma', 'positivo') $$,
  'P0001', 'bar_inexistente', 'bar que não existe');

-- otcb_sugerir_bar: casamento (11.16) → confirmação no bar existente (copy 15.18)
select is(public.otcb_sugerir_bar('Boteco Provavel', 'Rua 2', 'Vila Teste Sessenta', -13.001100, -43.000000, true),
          jsonb_build_object('bar_id', '00000000-0000-0000-0000-000000600002', 'criado', false),
  '11.16: mesmo nome (sem acento/prefixo) a ~11 m casa com o bar existente');
select throws_ok($$ select public.otcb_sugerir_bar('Boteco Provável', 'Rua 2', 'Vila Teste Sessenta', -13.001000, -43.000000, true) $$,
  'P0001', 'limite_confirmacao', 'sugestão que casa conta como confirmação e respeita o limite');
-- Nome parecido mas a ~200 m → bar novo.
select is((public.otcb_sugerir_bar('Boteco Provável', 'Rua 2b', 'Vila Teste Sessenta', -13.003000, -43.000000, true) ->> 'criado')::boolean, true,
  '11.16: nome igual a mais de 80 m vira bar novo');
select is((select status::text from public.otcb_bares where nome = 'Boteco Provável' and endereco = 'Rua 2b'), 'incerto',
  'bar sugerido nasce incerto (0,3)');
select throws_ok($$ select public.otcb_sugerir_bar('Outro Bar', 'Rua X', 'Vila Teste Sessenta', -13.0040, -43.0, false) $$,
  'P0001', 'dados_invalidos', 'bar novo sem Brahma não é cadastrado');
select throws_ok($$ select public.otcb_sugerir_bar('  ', 'Rua X', 'Vila Teste Sessenta', -13.0040, -43.0, true) $$,
  'P0001', 'dados_invalidos', 'nome vazio é recusado');
-- Limite de 5 bares sugeridos por dia (já há 1).
select lives_ok($$ select public.otcb_sugerir_bar('Sugerido ' || g, 'Rua S', 'Vila Teste Sessenta', -13.1 - g * 0.01, -43.0, true)
                     from generate_series(1, 4) g $$, '4 sugestões a mais (total 5) são aceitas');
select throws_ok($$ select public.otcb_sugerir_bar('Sugerido 6', 'Rua S', 'Vila Teste Sessenta', -13.2, -43.0, true) $$,
  'P0001', 'limite_sugestao', '11.6: a 6ª sugestão de bar no dia é recusada');

-- otcb_buscar_bares (11.9)
select is((select array_agg(right(bar_id::text, 1) order by ordinality)
             from public.otcb_buscar_bares(p_latitude => -13.0, p_longitude => -43.0) with ordinality
            where bar_id::text like '00000000-0000-0000-0000-00000060000%'),
          array['1','2','3'],
  '11.9: ordena confirmado > provável > incerto; fora: semente velha (caso B), sem_brahma e o bar a 5,5 km');
select is((select count(*)::int from public.otcb_buscar_bares(p_latitude => -13.0, p_longitude => -43.0, p_raio_metros => 50000)
            where bar_id = '00000000-0000-0000-0000-000000600007'), 0,
  '11.9: raio máximo de 10 km (pedido de 50 km não alcança o bar a ~13 km)');
select is((select count(*)::int from public.otcb_buscar_bares(p_latitude => -13.0, p_longitude => -43.0, p_raio_metros => 7000)
            where bar_id = '00000000-0000-0000-0000-000000600005'), 1,
  '11.9: raio pedido de 7 km alcança o bar a 5,5 km');
select is((select count(*)::int from public.otcb_buscar_bares(p_texto => 'ze teste')), 1, '11.9: texto sem acento acha "Bar do Zé Teste"');
select is((select count(*)::int from public.otcb_buscar_bares(p_bairro => 'vila teste sessenta', p_tem_balcao => true)), 1,
  '11.9: filtro tem_balcao');
select is((select count(*)::int from public.otcb_buscar_bares(p_bairro => 'vila teste sessenta', p_classico => true)), 1,
  '11.9: filtro classico');
select throws_ok($$ select * from public.otcb_buscar_bares() $$, 'P0001', 'localizacao_ou_bairro_obrigatorio',
  '11.9: sem localização exige bairro ou texto');
select is((select count(*)::int from public.otcb_buscar_bares(p_bairro => 'vila teste sessenta')), 8, '11.9: limite de 8 por resposta');
select is((select distancia_metros from public.otcb_buscar_bares(p_latitude => -13.0, p_longitude => -43.0)
            where bar_id = '00000000-0000-0000-0000-000000600002'), 111, 'CardBar: distância em metros');

-- otcb_detalhes_bar: agregados sem expor quem confirmou
select is((public.otcb_detalhes_bar('00000000-0000-0000-0000-000000600001') ->> 'confirmacoes_60_dias')::int, 1,
  'detalhes: 1 pessoa confirmou nos últimos 60 dias');
select ok(public.otcb_detalhes_bar('00000000-0000-0000-0000-000000600001') ->> 'ultima_confirmacao_em' is not null,
  'detalhes: data da última confirmação');
select ok(not (public.otcb_detalhes_bar('00000000-0000-0000-0000-000000600001')::text like '%60c3%'),
  'detalhes não expõe o id de quem confirmou');
select throws_ok($$ select public.otcb_detalhes_bar('00000000-0000-0000-0000-000000609999') $$, 'P0001', 'bar_inexistente',
  'detalhes de bar inexistente');

-- otcb_meu_passaporte (11.11) — A ainda não tem carimbo
select is(jsonb_array_length(public.otcb_meu_passaporte() -> 'carimbos'), 0, 'passaporte vazio');
select is((public.otcb_meu_passaporte() -> 'selos' -> 0 ->> 'conquistado')::boolean, false, 'sem "Primeira tirada" ainda');

-- ===================================================================== sessão sem perfil
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000060d4","role":"authenticated"}', true);
select throws_ok($$ select public.otcb_confirmar_bar('00000000-0000-0000-0000-000000600001', 'tem_brahma', 'positivo') $$,
  '42501', 'nao_autenticado', 'sem perfil (onboarding incompleto) não confirma');

-- ===================================================================== serviço: carimbo, opiniões, denúncias, limpeza
reset role;
insert into public.otcb_fotos (usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma, nota_colarinho, modelo_ia)
values ('00000000-0000-0000-0000-0000000060a1', '00000000-0000-0000-0000-000000600001', 5,
        '00000000-0000-0000-0000-0000000060a1/p.jpg', true, true, 9.5, 'claude-haiku-5-5');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000060a1","role":"authenticated"}', true);
select is((public.otcb_meu_passaporte() -> 'selos' -> 0 ->> 'conquistado')::boolean, true, '11.11: 1º carimbo → "Primeira tirada"');
select is((select (c ->> 'carimbos')::int from jsonb_array_elements(public.otcb_meu_passaporte() -> 'colecoes_bairro') c
            where c ->> 'bairro' = 'Vila Teste Sessenta'), 1, '11.11: coleção do bairro conta o carimbo');
select is((public.otcb_meu_passaporte() -> 'colecao_classicos' ->> 'carimbos')::int, 1, '11.11: coleção Clássicos');
reset role;

-- Opiniões: média só das publicadas com nota; resumo volta a nulo abaixo de 3 (11.8).
update public.otcb_bares set resumo_opinioes = 'Resumo antigo', resumo_atualizado_em = now() where id = '00000000-0000-0000-0000-000000600001';
insert into public.otcb_opinioes (id, usuario_id, bar_id, texto, nota) values
  ('00000000-0000-0000-0000-0000006e00a1', '00000000-0000-0000-0000-0000000060a1', '00000000-0000-0000-0000-000000600001', 'Muito bom o chopp', 5),
  ('00000000-0000-0000-0000-0000006e00b2', '00000000-0000-0000-0000-0000000060b2', '00000000-0000-0000-0000-000000600001', 'Bom mas demorado', 3),
  ('00000000-0000-0000-0000-0000006e00c3', '00000000-0000-0000-0000-0000000060c3', '00000000-0000-0000-0000-000000600001', 'Opinião sem nota aqui', null);
select is((select (nota_opinioes_media, qtd_opinioes, resumo_opinioes)::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000600001'),
          '(4.00,3,"Resumo antigo")', '11.7: média 4,0 (sem contar a sem nota), 3 publicadas, resumo mantido');

-- Denúncias: 3 de usuários distintos ocultam (11.7) e o resumo cai (menos de 3 publicadas).
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values ('00000000-0000-0000-0000-0000000060d4', 't60_d', now());
insert into public.otcb_denuncias (opiniao_id, usuario_id) values
  ('00000000-0000-0000-0000-0000006e00b2', '00000000-0000-0000-0000-0000000060a1'),
  ('00000000-0000-0000-0000-0000006e00b2', '00000000-0000-0000-0000-0000000060c3');
select is((select status::text from public.otcb_opinioes where id = '00000000-0000-0000-0000-0000006e00b2'), 'publicada', '2 denúncias não ocultam');
insert into public.otcb_denuncias (opiniao_id, usuario_id) values ('00000000-0000-0000-0000-0000006e00b2', '00000000-0000-0000-0000-0000000060d4');
select is((select status::text from public.otcb_opinioes where id = '00000000-0000-0000-0000-0000006e00b2'), 'oculta_denuncias',
  '11.7: 3ª denúncia de usuário distinto oculta a opinião');
select is((select (nota_opinioes_media, qtd_opinioes, resumo_opinioes)::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000600001'),
          '(5.00,2,)', '11.8: com 2 publicadas o resumo volta a nulo e a média é recalculada');

-- Limpeza (11.14)
insert into public.otcb_mensagens (usuario_id, papel, conteudo, criado_em) values
  ('00000000-0000-0000-0000-0000000060a1', 'usuario', 't60 velha', now() - interval '31 days'),
  ('00000000-0000-0000-0000-0000000060a1', 'usuario', 't60 nova', now() - interval '29 days');
insert into public.otcb_jogos (id_externo, competicao, mandante, visitante, inicio) values
  ('t60-velho', 'X', 'A', 'B', now() - interval '3 days'), ('t60-novo', 'X', 'A', 'B', now() - interval '1 day');
select public.otcb_limpeza_diaria();
select is((select array_agg(conteudo order by conteudo) from public.otcb_mensagens where conteudo like 't60 %'), array['t60 nova'],
  '11.14: mensagens com mais de 30 dias são apagadas');

select * from finish();
rollback;
