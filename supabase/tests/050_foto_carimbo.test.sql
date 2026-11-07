-- Regras 11.4, 11.5 (média) e 11.12 (dia de São Paulo): otcb_trg_foto_processa e otcb_bar_mais_proximo.
begin;
select plan(17);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000000050a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values
  ('00000000-0000-0000-0000-0000000050a1', 't50_a', now());

-- Bares 1–4 próximos entre si; 5 é 'fechado' e fica mais perto do ponto de teste.
insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude, pontuacao_brahma, status) values
  ('00000000-0000-0000-0000-000000500001', 'Bar 50-1', 'R', 'Teste50', -12.000000, -42.000000, 0.2, 'incerto'),
  ('00000000-0000-0000-0000-000000500002', 'Bar 50-2', 'R', 'Teste50', -12.000000, -42.000000, 0.9, 'provavel'),
  ('00000000-0000-0000-0000-000000500003', 'Bar 50-3', 'R', 'Teste50', -12.000500, -42.000000, 0.2, 'incerto'),
  ('00000000-0000-0000-0000-000000500004', 'Bar 50-4', 'R', 'Teste50', -12.001000, -42.000000, 0.2, 'incerto'),
  ('00000000-0000-0000-0000-000000500005', 'Bar 50-5', 'R', 'Teste50', -11.999950, -42.000000, 0.2, 'fechado');

-- otcb_bar_mais_proximo: ignora 'fechado'; empate de distância → maior pontuação; nada além de 150 m.
select is((select bar_id from public.otcb_bar_mais_proximo(-11.99990, -42.0)), '00000000-0000-0000-0000-000000500002'::uuid,
  '11.4: bar mais próximo ignora o fechado e desempata pela maior pontuação');
select is((select count(*)::int from public.otcb_bar_mais_proximo(-12.5, -42.0)), 0, '11.4: nenhum bar a até 150 m → sem bar');

create temporary view v50c as
  select bar_id from public.otcb_carimbos where usuario_id = '00000000-0000-0000-0000-0000000050a1';
create temporary view v50e as
  select bar_id, foto_id from public.otcb_evidencias
   where usuario_id = '00000000-0000-0000-0000-0000000050a1' and tipo = 'foto_colarinhometro';

-- Linha 1 da 11.4: e_chopp = false → sem nota, sem evidência, sem carimbo.
insert into public.otcb_fotos (id, usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma, modelo_ia)
values ('00000000-0000-0000-0000-0000005f0001', '00000000-0000-0000-0000-0000000050a1', '00000000-0000-0000-0000-000000500001', 5,
        '00000000-0000-0000-0000-0000000050a1/1.jpg', false, true, 'claude-haiku-5-5');
select is((select count(*)::int from v50e), 0, '11.4 linha 1: não é chopp → sem evidência');
select is((select count(*)::int from v50c), 0, '11.4 linha 1: não é chopp → sem carimbo');

-- Linha 2: chopp sem bar a até 150 m → só nota.
insert into public.otcb_fotos (id, usuario_id, caminho_storage, e_chopp, usuario_confirmou_brahma, nota_colarinho, modelo_ia)
values ('00000000-0000-0000-0000-0000005f0002', '00000000-0000-0000-0000-0000000050a1', '00000000-0000-0000-0000-0000000050a1/2.jpg', true, true, 8.0, 'claude-haiku-5-5');
select is((select count(*)::int from v50e), 0, '11.4 linha 2: sem bar → sem evidência');

-- Linha 3: chopp, bar perto, usuário NÃO confirmou Brahma → só nota (e entra na média do bar).
insert into public.otcb_fotos (id, usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma, nota_colarinho, modelo_ia)
values ('00000000-0000-0000-0000-0000005f0003', '00000000-0000-0000-0000-0000000050a1', '00000000-0000-0000-0000-000000500001', 5,
        '00000000-0000-0000-0000-0000000050a1/3.jpg', true, false, 6.0, 'claude-haiku-5-5');
select is((select count(*)::int from v50e), 0, '11.4 linha 3: sem confirmação de Brahma → sem evidência');
select is((select count(*)::int from v50c), 0, '11.4 linha 3: sem confirmação de Brahma → sem carimbo');
select is((select nota_colarinho_media from public.otcb_bares where id = '00000000-0000-0000-0000-000000500001'), 6.00,
  '11.5: a nota entra na média do bar mesmo sem confirmação');

-- Linha 4: chopp, bar perto, confirmou → evidência e carimbo.
insert into public.otcb_fotos (id, usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma, nota_colarinho, modelo_ia)
values ('00000000-0000-0000-0000-0000005f0004', '00000000-0000-0000-0000-0000000050a1', '00000000-0000-0000-0000-000000500001', 5,
        '00000000-0000-0000-0000-0000000050a1/4.jpg', true, true, 9.0, 'claude-haiku-5-5');
select is((select foto_id from v50e where bar_id = '00000000-0000-0000-0000-000000500001'), '00000000-0000-0000-0000-0000005f0004'::uuid,
  '11.4 linha 4: evidência foto_colarinhometro ligada à foto');
select is((select count(*)::int from v50c), 1, '11.4 linha 4: carimbo criado');
select is((select status::text from public.otcb_bares where id = '00000000-0000-0000-0000-000000500001'), 'confirmado',
  'a evidência da foto recalcula o bar (1,0 → confirmado)');

-- Mesmo bar de novo: nova evidência, mas não repete carimbo.
insert into public.otcb_fotos (usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma, nota_colarinho, modelo_ia)
values ('00000000-0000-0000-0000-0000000050a1', '00000000-0000-0000-0000-000000500001', 5,
        '00000000-0000-0000-0000-0000000050a1/5.jpg', true, true, 7.0, 'claude-haiku-5-5');
select is((select count(*)::int from v50c), 1, '11.4 (a): não repete carimbo no mesmo bar');

-- Limite de 2 carimbos novos por dia de São Paulo: 2º bar ganha, 3º não.
insert into public.otcb_fotos (usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma, nota_colarinho, modelo_ia)
values ('00000000-0000-0000-0000-0000000050a1', '00000000-0000-0000-0000-000000500003', 5, '00000000-0000-0000-0000-0000000050a1/6.jpg', true, true, 7.0, 'claude-haiku-5-5');
insert into public.otcb_fotos (usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma, nota_colarinho, modelo_ia)
values ('00000000-0000-0000-0000-0000000050a1', '00000000-0000-0000-0000-000000500004', 5, '00000000-0000-0000-0000-0000000050a1/7.jpg', true, true, 7.0, 'claude-haiku-5-5');
select is((select count(*)::int from v50c), 2, '11.4 (b): no máximo 2 carimbos novos por dia');
select is((select count(*)::int from v50e where bar_id = '00000000-0000-0000-0000-000000500004'), 1,
  '11.4: a 3ª foto ainda vira evidência (só o carimbo espera, copy 15.8)');

-- 11.12: carimbo de ontem (dia de SP) não conta no limite de hoje.
update public.otcb_carimbos set criado_em = now() - interval '1 day' where usuario_id = '00000000-0000-0000-0000-0000000050a1';
insert into public.otcb_fotos (usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma, nota_colarinho, modelo_ia)
values ('00000000-0000-0000-0000-0000000050a1', '00000000-0000-0000-0000-000000500004', 5, '00000000-0000-0000-0000-0000000050a1/8.jpg', true, true, 7.0, 'claude-haiku-5-5');
select is((select count(*)::int from v50c), 3, '11.12: carimbos de ontem não contam no limite de hoje');

-- 11.5: média e quantidade só das fotos não excluídas; recalculada ao apagar.
-- Bar 1 tem notas 6, 9 e 7 (a não-chopp não tem nota) → 7,33 com 3 fotos.
select is((select qtd_fotos_avaliadas from public.otcb_bares where id = '00000000-0000-0000-0000-000000500001'), 3,
  '11.5: 3 fotos avaliadas no bar');
update public.otcb_fotos set excluido_em = now() where id = '00000000-0000-0000-0000-0000005f0004';
select is((select nota_colarinho_media from public.otcb_bares where id = '00000000-0000-0000-0000-000000500001'), 6.50,
  '11.5: apagar a foto de nota 9 recalcula a média (6 e 7 → 6,5)');

select * from finish();
rollback;
