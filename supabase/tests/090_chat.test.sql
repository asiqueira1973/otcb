-- Épico 8.4 — banco do chat: opiniões com apelido sem expor o autor (seção 20), limite diário em dia de SP
-- (11.6/11.12), janela de contexto (11.13), marca de revisão de menor (11.18) invisível ao cliente.
begin;
select plan(12);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000000090a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000090b2', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values
  ('00000000-0000-0000-0000-0000000090a1', 't90_ana', now()), ('00000000-0000-0000-0000-0000000090b2', 't90_beto', now());
insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude)
values ('00000000-0000-0000-0000-000000900001', 'Bar 90', 'R', 'Teste90', -19.0, -49.0);
insert into public.otcb_opinioes (id, usuario_id, bar_id, texto, nota, status) values
  ('00000000-0000-0000-0000-0000009e0001', '00000000-0000-0000-0000-0000000090a1', '00000000-0000-0000-0000-000000900001', 'Chopp muito bem tirado', 5, 'publicada'),
  ('00000000-0000-0000-0000-0000009e0002', '00000000-0000-0000-0000-0000000090b2', '00000000-0000-0000-0000-000000900001', 'Opinião escondida aqui', 1, 'oculta_moderacao');

-- Mensagens de A: 3 hoje, 1 de ontem (SP), 25 recentes para a janela de 20.
insert into public.otcb_mensagens (usuario_id, papel, conteudo, criado_em) values
  ('00000000-0000-0000-0000-0000000090a1', 'usuario', 't90 ontem', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000090a1', 'usuario', 't90 velha', now() - interval '7 hours');
insert into public.otcb_mensagens (usuario_id, papel, conteudo, criado_em)
select '00000000-0000-0000-0000-0000000090a1', case when g % 2 = 0 then 'usuario' else 'assistente' end::public.otcb_papel_mensagem,
       't90 m' || lpad(g::text, 2, '0'), now() - (30 - g) * interval '1 minute'
  from generate_series(1, 25) g;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000090b2","role":"authenticated"}', true);

select is((select count(*)::int from public.otcb_opinioes_do_bar('00000000-0000-0000-0000-000000900001')), 1, 'só opiniões publicadas');
select is((select apelido from public.otcb_opinioes_do_bar('00000000-0000-0000-0000-000000900001')), 't90_ana',
  'seção 20: o apelido de quem opinou aparece para outro usuário');
select ok(not exists (select 1 from information_schema.routines r
                       join information_schema.parameters p on p.specific_name = r.specific_name
                      where r.routine_name = 'otcb_opinioes_do_bar' and p.parameter_mode = 'OUT' and p.parameter_name = 'usuario_id'),
  'a função não devolve o id do autor');
select is((select count(*)::int from public.otcb_perfis where id = '00000000-0000-0000-0000-0000000090a1'), 0,
  'o perfil de A continua invisível para B (RLS)');
select throws_ok($$ select revisao_menor_em from public.otcb_perfis $$, '42501', null,
  '11.18: o cliente não lê a marca de revisão');
select lives_ok($$ select id, apelido, time_do_coracao from public.otcb_perfis $$, 'o cliente lê as demais colunas do próprio perfil');
select ok(not has_function_privilege('authenticated', 'public.otcb_marcar_revisao_menor(uuid)', 'execute'), 'cliente não marca revisão');
select ok(not has_function_privilege('authenticated', 'public.otcb_contexto_chat(uuid)', 'execute'), 'cliente não lê contexto de terceiros');

reset role;
-- 11.6: hoje (SP) A tem 12 mensagens 'usuario' das 25 recentes + a "velha" de 7 h atrás (se ainda for hoje em SP).
select is(public.otcb_mensagens_hoje('00000000-0000-0000-0000-0000000090a1'),
          (select count(*)::int from public.otcb_mensagens where usuario_id = '00000000-0000-0000-0000-0000000090a1'
             and papel = 'usuario' and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date),
  '11.6: conta só as mensagens do usuário no dia de SP');
select ok(public.otcb_mensagens_hoje('00000000-0000-0000-0000-0000000090a1') < 15, 'a mensagem de ontem não conta');

-- 11.13: 20 mais recentes das últimas 6 h, em ordem cronológica (sem a de 7 h atrás).
select is((select array_agg(conteudo) from public.otcb_contexto_chat('00000000-0000-0000-0000-0000000090a1')),
          (select array_agg('t90 m' || lpad(g::text, 2, '0')) from generate_series(6, 25) g),
  '11.13: últimas 20 mensagens das 6 h, em ordem');

select public.otcb_marcar_revisao_menor('00000000-0000-0000-0000-0000000090b2');
select ok((select revisao_menor_em is not null from public.otcb_perfis where id = '00000000-0000-0000-0000-0000000090b2'),
  '11.18: a conta fica sinalizada para revisão');

select * from finish();
rollback;
