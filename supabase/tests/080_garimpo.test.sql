-- Épico 8.3 — funções de banco do garimpo: upsert idempotente de evidência (critério 3), status do Google
-- (critério 2 e reabertura), casamento 11.16, seleção de trabalho (revisita, coordenadas 11.10, resumos 11.8),
-- execuções (12.3), uso do mês (11.17) e permissões (só serviço).
begin;
select plan(36);

insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude, google_place_id) values
  ('00000000-0000-0000-0000-000000800001', 'Bar do Garimpo', 'Rua G, 1', 'Teste80', -18.000000, -48.000000, 'place-80-1'),
  ('00000000-0000-0000-0000-000000800002', 'Boteco Oitenta', 'Rua G, 2', 'Teste80', -18.100000, -48.000000, null);

-- ===== otcb_registrar_evidencia_garimpo (critério 3)
select is(public.otcb_registrar_evidencia_garimpo('00000000-0000-0000-0000-000000800001', 'tem_brahma', 'positivo', 'cardapio_site',
          'https://t80.test/cardapio', 'Chopp Brahma 300 ml', now() - interval '1 day'), 'criada', 'primeira evidência da URL é criada');
select is(public.otcb_registrar_evidencia_garimpo('00000000-0000-0000-0000-000000800001', 'tem_brahma', 'positivo', 'cardapio_site',
          'https://t80.test/cardapio', 'Chopp Brahma 300 ml', (select data_evidencia from public.otcb_evidencias where url_fonte = 'https://t80.test/cardapio')),
          'igual', 'mesma evidência de novo → igual (não duplica)');
select is((select count(*)::int from public.otcb_evidencias where url_fonte = 'https://t80.test/cardapio'), 1, 'continua 1 evidência para a URL');
select is(public.otcb_registrar_evidencia_garimpo('00000000-0000-0000-0000-000000800001', 'tem_brahma', 'negativo', 'cardapio_site',
          'https://t80.test/cardapio', 'Chopp Heineken 300 ml', now()), 'atualizada', 'conteúdo mudou → atualizada');
select is((select (count(*), max(sinal::text), max(peso))::text from public.otcb_evidencias where url_fonte = 'https://t80.test/cardapio'),
          '(1,negativo,-0.50)', 'a atualização troca o sinal e o peso pela regra 11.1 sem duplicar');
select is((select status::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000800001'), 'sem_brahma',
  'a atualização recalcula o bar');
select is(public.otcb_registrar_evidencia_garimpo('00000000-0000-0000-0000-000000800001', 'tem_brahma', 'positivo', 'pagina_web',
          'https://t80.test/materia', repeat('x', 400), now() - interval '2 hours'), 'criada', 'outra URL é outra evidência');
select is((select char_length(trecho) from public.otcb_evidencias where url_fonte = 'https://t80.test/materia'), 300, 'trecho cortado em 300 (11.10)');
select throws_ok($$ select public.otcb_registrar_evidencia_garimpo('00000000-0000-0000-0000-000000800001', 'tem_brahma', 'positivo', 'pagina_web', null, 'x', now()) $$,
  '22023', 'url_fonte_obrigatoria', 'evidência do garimpo exige url_fonte');

-- ===== status_google (critério 2 e reabertura)
select public.otcb_registrar_evidencia_garimpo('00000000-0000-0000-0000-000000800002', 'tem_brahma', 'positivo', 'pagina_web',
       'https://t80.test/boteco', 'Chopp Brahma gelado', now());
select is((select status::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000800002'), 'provavel', 'boteco provável (0,5)');
select is(public.otcb_registrar_evidencia_garimpo('00000000-0000-0000-0000-000000800002', 'funcionamento', 'fechado', 'status_google',
          'https://www.google.com/maps/place/?q=place_id:p80', null, now()), 'criada', 'Google CLOSED_PERMANENTLY grava fechado');
select is((select status::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000800002'), 'fechado', 'critério 2: fechado na mesma execução');
select is(public.otcb_registrar_evidencia_garimpo('00000000-0000-0000-0000-000000800002', 'funcionamento', 'positivo', 'status_google',
          'https://www.google.com/maps/place/?q=place_id:p80', null, now() + interval '1 second'), 'atualizada', 'Google volta a OPERATIONAL');
select is((select status::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000800002'), 'provavel', 'o último status do Google prevalece: reabriu');

-- ===== casamento 11.16
select is((public.otcb_casar_ou_criar_bar('Outro nome', 'R', 'Teste80', -18.5, -48.0, 'place-80-1', true) ->> 'bar_id')::uuid,
          '00000000-0000-0000-0000-000000800001'::uuid, '11.16 (1): mesmo place_id → mesmo bar');
select is((public.otcb_casar_ou_criar_bar('Boteco Oitenta', 'R', 'Teste80', -18.100300, -48.0, 'place-80-2', true) ->> 'bar_id')::uuid,
          '00000000-0000-0000-0000-000000800002'::uuid, '11.16 (2): ~33 m e mesmo nome → mesmo bar');
select is((select google_place_id from public.otcb_bares where id = '00000000-0000-0000-0000-000000800002'), 'place-80-2',
  'o place_id é gravado no bar casado que não tinha');
select is(public.otcb_casar_ou_criar_bar('Bar Novo 80', 'R', 'Teste80', -18.3, -48.0, 'place-80-3', false),
          '{"bar_id": null, "criado": false}'::jsonb, 'sem casamento e sem permissão de criar → nada');
select is((public.otcb_casar_ou_criar_bar('Bar Novo 80', 'R', 'Teste80', -18.3, -48.0, 'place-80-3', true) ->> 'criado')::boolean, true,
  '11.16 (3): sem casamento → bar novo');
select is((select status::text from public.otcb_bares where google_place_id = 'place-80-3'), 'incerto', 'bar novo nasce incerto');

-- ===== seleção de trabalho
select ok(not exists (select 1 from public.otcb_bares_para_revisita(500) r where r.bar_id = '00000000-0000-0000-0000-000000800002'),
  'revisita: bar visitado (status_google de hoje) não é selecionado');
select ok(exists (select 1 from public.otcb_bares_para_revisita(500) r where r.bar_id = '00000000-0000-0000-0000-000000800001'),
  'revisita: bar nunca visitado é selecionado');
select is((select urls from public.otcb_bares_para_revisita(500) r where r.bar_id = '00000000-0000-0000-0000-000000800001'),
          array['https://t80.test/cardapio', 'https://t80.test/materia'], 'revisita traz as URLs conhecidas, mais recentes primeiro');
select ok(not exists (select 1 from public.otcb_bares_para_revisita(500, array['00000000-0000-0000-0000-000000800001'::uuid]) r
                       where r.bar_id = '00000000-0000-0000-0000-000000800001'), 'revisita respeita os já processados');

update public.otcb_bares set coordenadas_atualizadas_em = now() - interval '26 days' where id = '00000000-0000-0000-0000-000000800001';
select is((select array_agg(bar_id) from public.otcb_bares_para_coordenadas(500) where bar_id in ('00000000-0000-0000-0000-000000800001', '00000000-0000-0000-0000-000000800002')),
          array['00000000-0000-0000-0000-000000800001'::uuid], '11.10: só coordenadas com mais de 25 dias');
select public.otcb_atualizar_coordenadas('00000000-0000-0000-0000-000000800001', -18.000123, -48.000456);
select ok((select coordenadas_atualizadas_em > now() - interval '1 minute' and latitude = -18.000123
             from public.otcb_bares where id = '00000000-0000-0000-0000-000000800001'), '11.10: coordenadas renovadas');

-- Resumo 11.8: 3 opiniões publicadas sem resumo → selecionado; gravar corta em 400.
insert into auth.users (id, aud, role, is_anonymous, instance_id)
select ('00000000-0000-0000-0000-00000080000' || g)::uuid, 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000' from generate_series(5, 7) g;
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em)
select ('00000000-0000-0000-0000-00000080000' || g)::uuid, 't80_' || g, now() from generate_series(5, 7) g;
insert into public.otcb_opinioes (usuario_id, bar_id, texto, nota)
select ('00000000-0000-0000-0000-00000080000' || g)::uuid, '00000000-0000-0000-0000-000000800001', 'Opinião de teste ' || g, 4 from generate_series(5, 7) g;
select ok(exists (select 1 from public.otcb_bares_para_resumo(500) where bar_id = '00000000-0000-0000-0000-000000800001'), '11.8: 3 publicadas sem resumo → precisa de resumo');
select is(public.otcb_gravar_resumo('00000000-0000-0000-0000-000000800001', repeat('r', 450)), true, 'resumo gravado');
select is((select char_length(resumo_opinioes) from public.otcb_bares where id = '00000000-0000-0000-0000-000000800001'), 400, '11.8: até 400 caracteres');

-- ===== execuções (12.3) e uso do mês (11.17)
insert into public.otcb_execucoes_garimpo (id, tipo, status, iniciado_em, cursor)
values ('00000000-0000-0000-0000-0000008e0001', 'coordenadas', 'em_andamento', now() - interval '3 hours',
        '{"uso": {"text_search": 7, "details_basico": 40, "details_reviews": 2, "firecrawl": 11, "ia": 9}}');
select ok(public.otcb_garimpo_iniciar('coordenadas') is not null, '12.3: abre nova execução depois de marcar a antiga');
select is((select status::text from public.otcb_execucoes_garimpo where id = '00000000-0000-0000-0000-0000008e0001'), 'falhou',
  '12.3: em_andamento há mais de 2 h vira falhou');

select is((public.otcb_garimpo_uso_mes() ->> 'details_basico')::int
          - coalesce((select sum((cursor::jsonb -> 'uso' ->> 'details_basico')::int) from public.otcb_execucoes_garimpo
                       where id <> '00000000-0000-0000-0000-0000008e0001' and cursor ~ '^\s*\{'), 0)::int,
          40, '11.17: uso do mês soma os contadores gravados no cursor');

-- ===== permissões: nada disto é chamável pelo app
select ok(not has_function_privilege('authenticated', 'public.otcb_garimpo_disparar(text, uuid)', 'execute'), 'cliente não dispara o garimpo');
select ok(not has_function_privilege('authenticated', 'public.otcb_configurar_garimpo(text, text)', 'execute'), 'cliente não configura segredos');
select ok(not has_function_privilege('authenticated',
  'public.otcb_registrar_evidencia_garimpo(uuid, public.otcb_assunto_evidencia, public.otcb_sinal_evidencia, public.otcb_tipo_evidencia, text, text, timestamptz)', 'execute'),
  'cliente não grava evidência do garimpo');

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('otcb_casar_bar', 'otcb_casar_ou_criar_bar', 'otcb_registrar_evidencia_garimpo',
            'otcb_bares_para_revisita', 'otcb_bares_para_coordenadas', 'otcb_atualizar_coordenadas', 'otcb_bares_para_resumo',
            'otcb_gravar_resumo', 'otcb_garimpo_iniciar', 'otcb_garimpo_uso_mes', 'otcb_configurar_garimpo', 'otcb_garimpo_disparar')
      and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))),
  null::text[],
  'nenhuma das 12 funções do garimpo é executável por anon ou authenticated');

select * from finish();
rollback;
