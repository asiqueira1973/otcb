-- Regras 11.1, 11.2 e 11.3 (otcb_recalcular_bar, disparado por otcb_trg_evidencia_recalcula):
-- casos obrigatórios A–J da tabela 11.2.1 e a regra de transmissão de jogos.
-- Cada caso usa um bar próprio da fixture; nada conta a tabela inteira.
begin;
select plan(31);

-- Fixture: três usuários anônimos com perfil.
insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000000040a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000040b2', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000040c3', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values
  ('00000000-0000-0000-0000-0000000040a1', 't40_usuario_a', now()),
  ('00000000-0000-0000-0000-0000000040b2', 't40_usuario_b', now()),
  ('00000000-0000-0000-0000-0000000040c3', 't40_usuario_c', now());

-- Um bar por caso (coordenadas fora de SP para não colidir com dados reais).
insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude)
select ('00000000-0000-0000-0000-00000040000' || c)::uuid, 'Bar caso ' || c, 'Rua Teste', 'Teste40', -10.0, -40.0
  from unnest(array['a','b','c','d','e','f','9','8','7','6','5','4','3','2']) c;
-- 4 = voto entre tipos, 3 = limite exato −0,5, 2 = decaimento pelo recálculo diário
-- a=A b=B c=C d=D e=E f=F 9=G 8=H 7=I 6=J 5=transmite

-- Atalho de leitura.
create temporary view v40 as
  select right(id::text, 1) as caso, status, pontuacao_brahma, transmite_jogos
    from public.otcb_bares where bairro = 'Teste40';

-- Caso A: só a semente, hoje → incerto (0,2).
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-00000040000a', 'tem_brahma', 'positivo', 'seed_otcb_antigo', 'seed', now(), 0, 1);
select is((select status::text from v40 where caso = 'a'), 'incerto', 'A: só a semente hoje → incerto');
select is((select pontuacao_brahma from v40 where caso = 'a'), 0.200, 'A: pontuação 0,2');

-- Caso B: semente com 200 dias → incerto (≈0,09).
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-00000040000b', 'tem_brahma', 'positivo', 'seed_otcb_antigo', 'seed', now() - interval '200 days', 0, 1);
select is((select status::text from v40 where caso = 'b'), 'incerto', 'B: semente com 200 dias → incerto');
select is((select pontuacao_brahma from v40 where caso = 'b'), 0.093, 'B: pontuação ≈0,09 (0,2 × 0,5^(200/180))');

-- Caso C: 1 foto positiva hoje → confirmado (1,0).
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-00000040000c', 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario',
        '00000000-0000-0000-0000-0000000040a1', now(), 0, 1);
select is((select status::text from v40 where caso = 'c'), 'confirmado', 'C: 1 foto positiva hoje → confirmado');
select is((select pontuacao_brahma from v40 where caso = 'c'), 1.000, 'C: pontuação 1,0');

-- Caso D: 1 foto positiva há 90 dias → provavel (0,5).
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-00000040000d', 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario',
        '00000000-0000-0000-0000-0000000040a1', now() - interval '90 days', 0, 1);
select is((select status::text from v40 where caso = 'd'), 'provavel', 'D: foto há 90 dias → provavel');
select is((select pontuacao_brahma from v40 where caso = 'd'), 0.500, 'D: pontuação 0,5');

-- Caso E: 1 cardápio positivo hoje + 1 confirmação negativa hoje → incerto (0,2).
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, url_fonte, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-00000040000e', 'tem_brahma', 'positivo', 'cardapio_site', 'garimpo',
        'https://exemplo.test/cardapio', now(), 0, 1);
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-00000040000e', 'tem_brahma', 'negativo', 'confirmacao_usuario', 'usuario',
        '00000000-0000-0000-0000-0000000040a1', now(), 0, 1);
select is((select status::text from v40 where caso = 'e'), 'incerto', 'E: cardápio + confirmação negativa → incerto');
select is((select pontuacao_brahma from v40 where caso = 'e'), 0.200, 'E: pontuação 0,2');

-- Caso F: 2 confirmações negativas de usuários distintos hoje → sem_brahma (−1,2).
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-00000040000f', 'tem_brahma', 'negativo', 'confirmacao_usuario', 'usuario', '00000000-0000-0000-0000-0000000040a1', now(), 0, 1),
       ('00000000-0000-0000-0000-00000040000f', 'tem_brahma', 'negativo', 'confirmacao_usuario', 'usuario', '00000000-0000-0000-0000-0000000040b2', now(), 0, 1);
select is((select status::text from v40 where caso = 'f'), 'sem_brahma', 'F: 2 negativas de usuários distintos → sem_brahma');
select is((select pontuacao_brahma from v40 where caso = 'f'), -1.200, 'F: pontuação −1,2');

-- Caso G: 3 fotos positivas do mesmo usuário hoje → confirmado (1,0: só a mais recente conta).
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
select '00000000-0000-0000-0000-000000400009', 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario',
       '00000000-0000-0000-0000-0000000040a1', now() - (g || ' minutes')::interval, 0, 1
  from generate_series(0, 2) g;
select is((select status::text from v40 where caso = '9'), 'confirmado', 'G: 3 fotos do mesmo usuário → confirmado');
select is((select pontuacao_brahma from v40 where caso = '9'), 1.000, 'G: só a mais recente conta (1,0, não 3,0)');

-- Caso H: status_google fechado hoje + foto positiva de ontem → fechado.
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-000000400008', 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario',
        '00000000-0000-0000-0000-0000000040a1', now() - interval '1 day', 0, 1);
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-000000400008', 'funcionamento', 'fechado', 'status_google', 'garimpo', now(), 0, 1);
select is((select status::text from v40 where caso = '8'), 'fechado', 'H: Google fechado hoje + foto de ontem → fechado');

-- Caso I: status_google fechado há 10 dias + foto positiva hoje → confirmado.
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-000000400007', 'funcionamento', 'fechado', 'status_google', 'garimpo', now() - interval '10 days', 0, 1);
select is((select status::text from v40 where caso = '7'), 'fechado', 'I (antes da foto): Google fechado há 10 dias → fechado');
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-000000400007', 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario',
        '00000000-0000-0000-0000-0000000040a1', now(), 0, 1);
select is((select status::text from v40 where caso = '7'), 'confirmado', 'I: Google fechado há 10 dias + foto hoje → confirmado');

-- Caso J: 1 usuário diz "fechou" hoje → não muda por isso (precisa de 2).
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-000000400006', 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario',
        '00000000-0000-0000-0000-0000000040a1', now() - interval '2 days', 0, 1);
select is((select status::text from v40 where caso = '6'), 'provavel', 'J (antes): foto há 2 dias → provavel');
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-000000400006', 'funcionamento', 'fechado', 'confirmacao_usuario', 'usuario',
        '00000000-0000-0000-0000-0000000040b2', now(), 0, 1);
select is((select status::text from v40 where caso = '6'), 'provavel', 'J: 1 usuário diz que fechou → status não muda');
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-000000400006', 'funcionamento', 'fechado', 'confirmacao_usuario', 'usuario',
        '00000000-0000-0000-0000-0000000040c3', now(), 0, 1);
select is((select status::text from v40 where caso = '6'), 'fechado', 'J (complemento): 2º usuário distinto → fechado');

-- Regra 11.3: transmite_jogos.
select is((select transmite_jogos from v40 where caso = '5'), null::boolean, '11.3: sem evidência → null');
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, url_fonte, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-000000400005', 'transmite_jogos', 'positivo', 'pagina_web', 'garimpo',
        'https://exemplo.test/jogos', now(), 0, 1);
select is((select transmite_jogos from v40 where caso = '5'), true, '11.3: +0,5 → true');
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-000000400005', 'transmite_jogos', 'negativo', 'confirmacao_usuario', 'usuario',
        '00000000-0000-0000-0000-0000000040a1', now(), 0, 1),
       ('00000000-0000-0000-0000-000000400005', 'transmite_jogos', 'negativo', 'confirmacao_usuario', 'usuario',
        '00000000-0000-0000-0000-0000000040b2', now(), 0, 1);
select is((select transmite_jogos from v40 where caso = '5'), false, '11.3: +0,5 − 1,2 = −0,7 → false');
select is((select status::text from v40 where caso = '5'), 'incerto', '11.3: transmite_jogos não afeta o status de Brahma');

-- Peso e meia-vida vêm da regra 11.1, não do chamador; combinação fora da tabela é recusada.
select is((select peso from public.otcb_evidencias where bar_id = '00000000-0000-0000-0000-00000040000a'), 0.20,
          '11.1: peso da semente copiado da regra (0,2), ignorando o valor enviado');
select throws_ok(
  $$ insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, data_evidencia, peso, meia_vida_dias)
     values ('00000000-0000-0000-0000-00000040000a', 'tem_brahma', 'negativo', 'seed_otcb_antigo', 'seed', now(), 0, 1) $$,
  '22023', 'evidencia_invalida',
  '11.1: combinação fora da tabela é recusada'
);

-- 11.1: "um voto por pessoa" vale entre tipos — foto de ontem e confirmação negativa de hoje do mesmo
-- usuário: só a negativa (mais recente) conta.
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias) values
  ('00000000-0000-0000-0000-000000400004', 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario', '00000000-0000-0000-0000-0000000040a1', now() - interval '1 day', 0, 1),
  ('00000000-0000-0000-0000-000000400004', 'tem_brahma', 'negativo', 'confirmacao_usuario', 'usuario', '00000000-0000-0000-0000-0000000040a1', now(), 0, 1);
select is((select pontuacao_brahma from v40 where caso = '4'), -0.600, '11.1: foto e depois negativa do mesmo usuário → só a negativa conta');

-- 11.2 (2): limite exato de −0,5 já é sem_brahma.
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, url_fonte, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-000000400003', 'tem_brahma', 'negativo', 'cardapio_site', 'garimpo', 'https://exemplo.test/outra-marca', now(), 0, 1);
select is((select (status, pontuacao_brahma)::text from v40 where caso = '3'), '(sem_brahma,-0.500)', '11.2: pontuação −0,5 exata → sem_brahma');

-- 7.5: o recálculo diário aplica o decaimento; status_atualizado_em só muda quando o status muda.
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
values ('00000000-0000-0000-0000-000000400002', 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario',
        '00000000-0000-0000-0000-0000000040a1', now(), 0, 1);
update public.otcb_bares set status_atualizado_em = now() - interval '5 days' where id = '00000000-0000-0000-0000-000000400002';
select public.otcb_recalcular_todos();
select ok((select status_atualizado_em < now() - interval '4 days' from public.otcb_bares where id = '00000000-0000-0000-0000-000000400002'),
  '7.5: recalcular sem mudar o status não mexe em status_atualizado_em');
update public.otcb_evidencias set data_evidencia = now() - interval '120 days' where bar_id = '00000000-0000-0000-0000-000000400002';
select public.otcb_recalcular_todos();
select is((select (status, pontuacao_brahma)::text from v40 where caso = '2'), '(incerto,0.397)',
  '7.5: o recálculo diário aplica o decaimento (1,0 × 0,5^(120/90) ≈ 0,397)');
select ok((select status_atualizado_em > now() - interval '1 minute' from public.otcb_bares where id = '00000000-0000-0000-0000-000000400002'),
  '7.5: status mudou (confirmado → incerto) → status_atualizado_em atualizado');

select * from finish();
rollback;
