-- Épico 8.6 — Colarinhômetro no banco: bar a até 150 m (11.4), tabela da 11.4 (nota, evidência, carimbo),
-- 2 carimbos novos por dia (11.12), contagem de fotos do dia (11.6) e permissões.
begin;
select plan(20);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000000110a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values ('00000000-0000-0000-0000-0000000110a1', 't110_ana', now());
-- Três bares bem separados (~1 km) em latitude -20.x; o 4º fica fechado.
insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude, status) values
  ('00000000-0000-0000-0000-000001100001', 'Bar 110 A', 'R', 'T110', -20.000000, -50.000000, 'confirmado'),
  ('00000000-0000-0000-0000-000001100002', 'Bar 110 B', 'R', 'T110', -20.010000, -50.000000, 'incerto'),
  ('00000000-0000-0000-0000-000001100003', 'Bar 110 C', 'R', 'T110', -20.020000, -50.000000, 'incerto'),
  ('00000000-0000-0000-0000-000001100004', 'Bar 110 F', 'R', 'T110', -20.030000, -50.000000, 'fechado');

-- ===== 11.4: bar mais próximo a até 150 m
select is((select bar_id from public.otcb_bar_mais_proximo(-20.000900, -50.0)), '00000000-0000-0000-0000-000001100001'::uuid,
  'critério 1: a ~100 m acha o bar');
select is((select count(*)::int from public.otcb_bar_mais_proximo(-20.001800, -50.0)), 0, 'critério 2: a ~200 m não acha bar');
select is((select count(*)::int from public.otcb_bar_mais_proximo(-20.030000, -50.0)), 0, 'bar fechado não conta');

-- Helper do teste: insere a foto como a Edge Function faria.
create function pg_temp.foto(p_id text, p_bar uuid, p_dist int, p_chopp boolean, p_conf boolean)
returns uuid language sql as $$
  insert into public.otcb_fotos (id, usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma,
                                 nota_altura, nota_cremosidade, nota_copo, nota_gelado, nota_colarinho, modelo_ia)
  values (p_id::uuid, '00000000-0000-0000-0000-0000000110a1', p_bar, p_dist, '00000000-0000-0000-0000-0000000110a1/' || p_id || '.jpg',
          p_chopp, p_conf,
          case when p_chopp then 8 end, case when p_chopp then 7 end, case when p_chopp then 9 end, case when p_chopp then 8 end,
          case when p_chopp then 8.0 end, 'claude-haiku-5-5')
  returning id;
$$;

-- ===== não é chopp
select pg_temp.foto('00000000-0000-0000-0000-0000011f0001', '00000000-0000-0000-0000-000001100001', 100, false, true);
select is(public.otcb_resultado_foto('00000000-0000-0000-0000-0000011f0001') ->> 'motivo_sem_carimbo', 'nao_e_chopp', 'não é chopp: sem carimbo');
select is((select count(*)::int from public.otcb_evidencias where foto_id = '00000000-0000-0000-0000-0000011f0001'), 0, 'critério 4: sem evidência');
-- ===== sem bar
select pg_temp.foto('00000000-0000-0000-0000-0000011f0002', null, null, true, true);
select is(public.otcb_resultado_foto('00000000-0000-0000-0000-0000011f0002') ->> 'motivo_sem_carimbo', 'sem_bar', 'critério 2: sem bar, sem carimbo');
-- ===== não confirmou (Não / Não sei)
select pg_temp.foto('00000000-0000-0000-0000-0000011f0003', '00000000-0000-0000-0000-000001100001', 100, true, false);
select is(public.otcb_resultado_foto('00000000-0000-0000-0000-0000011f0003') ->> 'motivo_sem_carimbo', 'nao_confirmou', 'critério 3: sem carimbo');
select is((select count(*)::int from public.otcb_evidencias where foto_id = '00000000-0000-0000-0000-0000011f0003'), 0, 'critério 3: sem evidência');
-- ===== confirmou: evidência e carimbo
select pg_temp.foto('00000000-0000-0000-0000-0000011f0004', '00000000-0000-0000-0000-000001100001', 100, true, true);
select is(public.otcb_resultado_foto('00000000-0000-0000-0000-0000011f0004'),
  '{"carimbo_novo": true, "motivo_sem_carimbo": null, "nome_bar": "Bar 110 A", "total_carimbos": 1}'::jsonb, 'critério 1: carimbo novo');
select is((select (assunto, sinal, tipo)::text from public.otcb_evidencias where foto_id = '00000000-0000-0000-0000-0000011f0004'),
  '(tem_brahma,positivo,foto_colarinhometro)', 'critério 1: evidência positiva');
-- ===== mesmo bar de novo
select pg_temp.foto('00000000-0000-0000-0000-0000011f0005', '00000000-0000-0000-0000-000001100001', 100, true, true);
select is(public.otcb_resultado_foto('00000000-0000-0000-0000-0000011f0005') ->> 'motivo_sem_carimbo', 'ja_tinha', 'carimbo repetido no bar não sai');
-- ===== 2º carimbo do dia sai, 3º não (11.12)
select pg_temp.foto('00000000-0000-0000-0000-0000011f0006', '00000000-0000-0000-0000-000001100002', 50, true, true);
select is((public.otcb_resultado_foto('00000000-0000-0000-0000-0000011f0006') ->> 'carimbo_novo')::boolean, true, '2º carimbo do dia sai');
select pg_temp.foto('00000000-0000-0000-0000-0000011f0007', '00000000-0000-0000-0000-000001100003', 50, true, true);
select is(public.otcb_resultado_foto('00000000-0000-0000-0000-0000011f0007') ->> 'motivo_sem_carimbo', 'limite_dia', 'critério 5: 3º carimbo do dia não sai');
select is((select count(*)::int from public.otcb_carimbos where usuario_id = '00000000-0000-0000-0000-0000000110a1'), 2, 'só 2 carimbos');
select is((select count(*)::int from public.otcb_evidencias where foto_id = '00000000-0000-0000-0000-0000011f0007'), 1,
  'a evidência sai mesmo sem carimbo (11.4)');

-- ===== contagem do dia (11.6) e mensagem sistema (11.13)
select is(public.otcb_fotos_hoje('00000000-0000-0000-0000-0000000110a1'), 7, 'conta as 7 fotos de hoje, inclusive não-chopp');
select is((select count(*)::int from public.otcb_mensagens where usuario_id = '00000000-0000-0000-0000-0000000110a1' and papel = 'sistema'
            and conteudo like 'A pessoa avaliou um chopp%'), 6, 'nota sistema para cada foto de chopp, não para a não-chopp');
select is((select nota_colarinho_media from public.otcb_bares where id = '00000000-0000-0000-0000-000001100001'), 8.00,
  '11.5: a média do bar ignora a foto sem nota');

-- ===== permissões
select ok(not has_function_privilege('authenticated', 'public.otcb_resultado_foto(uuid)', 'execute'), 'cliente não chama otcb_resultado_foto');
select ok(not has_function_privilege('authenticated', 'public.otcb_fotos_hoje(uuid)', 'execute'), 'cliente não chama otcb_fotos_hoje');

select * from finish();
rollback;
