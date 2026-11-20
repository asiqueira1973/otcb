-- Épico 8.7 — Passaporte (regra 11.11, flexibilizada em 19/11/2026 a pedido do Alexandre): números de
-- otcb_meu_passaporte para um usuário com carimbos em 3 bairros; bairro conquistado com 2 carimbos (ou todos, se o
-- bairro tiver 1 bar) e total_bares = a meta; Explorador 3/10/25; Olho clínico nota ≥ 8 em 3 bares; Informante
-- com 10 contribuições quaisquer; Clássicos vazia (25.5 adiada) e critério 3 (apagar a foto mantém o carimbo).
begin;
select plan(17);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000000120a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values ('00000000-0000-0000-0000-0000000120a1', 't120_ana', now());

-- T120A: 4 bares ativos; T120B: 2; T120C: 5 (+1 incerto, que não conta no total).
insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude, status)
select ('00000000-0000-0000-0000-0000012000' || lpad(g::text, 2, '0'))::uuid, 'Bar 120 ' || g, 'R',
       case when g <= 4 then 'T120A' when g <= 6 then 'T120B' else 'T120C' end, -21.0 - g * 0.01, -51.0,
       case when g = 12 then 'incerto' else (case when g % 2 = 0 then 'confirmado' else 'provavel' end) end::public.otcb_status_bar
  from generate_series(1, 12) g;

-- Carimbos: 3 em T120A, 2 em T120B, 1 em T120C (6 bares distintos). O 1º veio de uma foto.
insert into public.otcb_fotos (id, usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma, nota_colarinho, modelo_ia)
values ('00000000-0000-0000-0000-00000120f001', '00000000-0000-0000-0000-0000000120a1', '00000000-0000-0000-0000-000001200001', 10,
        '00000000-0000-0000-0000-0000000120a1/00000000-0000-0000-0000-00000120f001.jpg', true, true, 9.5, 'claude-haiku-5-5');
insert into public.otcb_carimbos (usuario_id, bar_id, criado_em)
select '00000000-0000-0000-0000-0000000120a1', ('00000000-0000-0000-0000-0000012000' || lpad(g::text, 2, '0'))::uuid, now() - interval '3 days'
  from unnest(array[2, 3, 5, 6, 7]) g;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000120a1","role":"authenticated"}', true);

select is(jsonb_array_length(public.otcb_meu_passaporte() -> 'carimbos'), 6, 'critério 1: 6 bares carimbados');
select is((select array_agg(c ->> 'bairro' order by c ->> 'bairro') from jsonb_array_elements(public.otcb_meu_passaporte() -> 'carimbos') c
            where c ->> 'bairro' like 'T120%')::text,
          '{T120A,T120A,T120A,T120B,T120B,T120C}', 'carimbos com o bairro de cada bar');
select is((select (c ->> 'carimbos', c ->> 'total_bares', c ->> 'conquistado')::text from jsonb_array_elements(public.otcb_meu_passaporte() -> 'colecoes_bairro') c where c ->> 'bairro' = 'T120A'),
          '(3,2,true)', '11.11: 2 carimbos conquistam o bairro (meta 2)');
select is((select (c ->> 'carimbos', c ->> 'total_bares', c ->> 'conquistado')::text from jsonb_array_elements(public.otcb_meu_passaporte() -> 'colecoes_bairro') c where c ->> 'bairro' = 'T120B'),
          '(2,2,true)', '11.11: 2 carimbos → conquistado');
select is((select (c ->> 'carimbos', c ->> 'total_bares', c ->> 'conquistado')::text from jsonb_array_elements(public.otcb_meu_passaporte() -> 'colecoes_bairro') c where c ->> 'bairro' = 'T120C'),
          '(1,2,false)', '11.11: 1 carimbo de meta 2 não conquista');
select is((public.otcb_meu_passaporte() -> 'colecao_classicos' ->> 'total')::int,
          (select count(*)::int from public.otcb_bares where classico and excluido_em is null), 'Clássicos: total = bares clássicos ativos (0 sem curadoria)');
select is((select (s ->> 'conquistado')::boolean from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'primeira_tirada'), true, 'selo Primeira tirada');
select is((select (s ->> 'nivel', s ->> 'meta')::text from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'explorador'), '(1,10)', 'Explorador: 6 bares = nível 1 (3), próxima meta 10');
select is((select (s ->> 'progresso')::int from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'andarilho'), 3, 'Andarilho: 3 bairros');
select is((select (s ->> 'progresso', s ->> 'meta')::text from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'olho_clinico'), '(1,3)', 'Olho clínico: 1 bar com nota ≥ 8, meta 3');

-- ===== critério 3: apagar a foto mantém o carimbo
update public.otcb_fotos set excluido_em = now() where id = '00000000-0000-0000-0000-00000120f001';
select is(jsonb_array_length(public.otcb_meu_passaporte() -> 'carimbos'), 6, 'critério 3: foto apagada pelo dono, carimbo mantido');
select is((select (s ->> 'progresso')::int from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'olho_clinico'), 1,
  'conquista não regride: foto apagada continua no Olho clínico, como o carimbo (critério 3)');
reset role;
delete from public.otcb_fotos where id = '00000000-0000-0000-0000-00000120f001';
select is((select foto_id from public.otcb_carimbos where bar_id = '00000000-0000-0000-0000-000001200001'), null::uuid, 'remoção de fato: foto_id vira nulo');
select is((select count(*)::int from public.otcb_carimbos where usuario_id = '00000000-0000-0000-0000-0000000120a1'), 6, 'critério 3: carimbo continua');

-- ===== flexibilização de 19/11/2026: nota 8,0 conta no Olho clínico; bairro de 1 bar conquista com 1 carimbo;
-- Informante conta contribuições quaisquer (confirmação, sugestão, opinião), mesmo em bar que não está confirmado.
reset role;
insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude, status) values
  ('00000000-0000-0000-0000-000001200099', 'Bar 120 solo', 'R', 'T120D', -21.5, -51.0, 'confirmado'),
  ('00000000-0000-0000-0000-000001200098', 'Bar 120 incerto', 'R', 'T120E', -21.6, -51.0, 'incerto');
insert into public.otcb_fotos (id, usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma, nota_colarinho, modelo_ia)
values ('00000000-0000-0000-0000-00000120f002', '00000000-0000-0000-0000-0000000120a1', '00000000-0000-0000-0000-000001200099', 10,
        '00000000-0000-0000-0000-0000000120a1/00000000-0000-0000-0000-00000120f002.jpg', true, true, 8.0, 'claude-haiku-5-5');
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias) values
  ('00000000-0000-0000-0000-000001200098', 'tem_brahma', 'positivo', 'confirmacao_usuario', 'usuario', '00000000-0000-0000-0000-0000000120a1', now(), 0, 1),
  ('00000000-0000-0000-0000-000001200098', 'transmite_jogos', 'positivo', 'confirmacao_usuario', 'usuario', '00000000-0000-0000-0000-0000000120a1', now(), 0, 1);
insert into public.otcb_opinioes (usuario_id, bar_id, texto, nota) values
  ('00000000-0000-0000-0000-0000000120a1', '00000000-0000-0000-0000-000001200099', 'Opinião de teste do 120', 4);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000120a1","role":"authenticated"}', true);
select is((select (s ->> 'progresso')::int from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'olho_clinico'), 1,
  'Olho clínico: nota 8,0 conta (a foto de 9,5 foi removida acima)');
select is((select (c ->> 'carimbos', c ->> 'total_bares', c ->> 'conquistado')::text from jsonb_array_elements(public.otcb_meu_passaporte() -> 'colecoes_bairro') c where c ->> 'bairro' = 'T120D'),
          '(1,1,true)', 'bairro com 1 bar: 1 carimbo conquista');
select is((select (s ->> 'progresso', s ->> 'meta')::text from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'informante'),
          '(3,10)', 'Informante: 2 confirmações em bar a confirmar + 1 opinião = 3 contribuições');

reset role;

select * from finish();
rollback;
