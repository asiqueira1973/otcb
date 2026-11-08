-- Épico 8.7 — Passaporte (regra 11.11): números de otcb_meu_passaporte para um usuário com carimbos em 3
-- bairros, coleção do bairro conquistada com min(3, total), Clássicos vazia (25.5 adiada) e critério 3
-- (apagar a foto mantém o carimbo).
begin;
select plan(14);

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
          '(3,4,true)', '11.11: 3 de 4 → bairro conquistado (min(3, 4) = 3)');
select is((select (c ->> 'carimbos', c ->> 'total_bares', c ->> 'conquistado')::text from jsonb_array_elements(public.otcb_meu_passaporte() -> 'colecoes_bairro') c where c ->> 'bairro' = 'T120B'),
          '(2,2,true)', '11.11: 2 de 2 → conquistado (todos os bares)');
select is((select (c ->> 'carimbos', c ->> 'total_bares', c ->> 'conquistado')::text from jsonb_array_elements(public.otcb_meu_passaporte() -> 'colecoes_bairro') c where c ->> 'bairro' = 'T120C'),
          '(1,5,false)', '11.11: incerto não entra no total; 1 de 5 não conquista');
select is((public.otcb_meu_passaporte() -> 'colecao_classicos' ->> 'total')::int,
          (select count(*)::int from public.otcb_bares where classico and excluido_em is null), 'Clássicos: total = bares clássicos ativos (0 sem curadoria)');
select is((select (s ->> 'conquistado')::boolean from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'primeira_tirada'), true, 'selo Primeira tirada');
select is((select (s ->> 'nivel', s ->> 'meta')::text from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'explorador'), '(1,15)', 'Explorador nível 1, próxima meta 15');
select is((select (s ->> 'progresso')::int from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'andarilho'), 3, 'Andarilho: 3 bairros');
select is((select (s ->> 'progresso')::int from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'olho_clinico'), 1, 'Olho clínico: 1 bar com nota ≥ 9');

-- ===== critério 3: apagar a foto mantém o carimbo
update public.otcb_fotos set excluido_em = now() where id = '00000000-0000-0000-0000-00000120f001';
select is(jsonb_array_length(public.otcb_meu_passaporte() -> 'carimbos'), 6, 'critério 3: foto apagada pelo dono, carimbo mantido');
select is((select (s ->> 'progresso')::int from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'olho_clinico'), 1,
  'conquista não regride: foto apagada continua no Olho clínico, como o carimbo (critério 3)');
reset role;
delete from public.otcb_fotos where id = '00000000-0000-0000-0000-00000120f001';
select is((select foto_id from public.otcb_carimbos where bar_id = '00000000-0000-0000-0000-000001200001'), null::uuid, 'remoção de fato: foto_id vira nulo');
select is((select count(*)::int from public.otcb_carimbos where usuario_id = '00000000-0000-0000-0000-0000000120a1'), 6, 'critério 3: carimbo continua');

select * from finish();
rollback;
