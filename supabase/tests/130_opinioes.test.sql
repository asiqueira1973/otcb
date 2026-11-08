-- Épico 8.8 — opiniões: 3 denúncias distintas ocultam (11.7, critério 2), o dono ainda lê a oculta (critério 3,
-- 15.17), a opinião oculta some da lista pública, e o resumo só existe com 3+ publicadas (11.8, critério 4).
begin;
select plan(14);

insert into auth.users (id, aud, role, is_anonymous, instance_id)
select ('00000000-0000-0000-0000-00000013000' || g)::uuid, 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'
  from generate_series(1, 5) g;
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em)
select ('00000000-0000-0000-0000-00000013000' || g)::uuid, 't130_p' || g, now() from generate_series(1, 5) g;
insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude)
values ('00000000-0000-0000-0000-000001300001', 'Bar 130', 'R', 'T130', -22.0, -52.0);
-- 3 opiniões publicadas (p1, p2, p3) + resumo.
insert into public.otcb_opinioes (id, usuario_id, bar_id, texto, nota)
select ('00000000-0000-0000-0000-0000013e000' || g)::uuid, ('00000000-0000-0000-0000-00000013000' || g)::uuid,
       '00000000-0000-0000-0000-000001300001', 'Opinião de teste número ' || g, 4
  from generate_series(1, 3) g;
select ok(exists (select 1 from public.otcb_bares_para_resumo(500) where bar_id = '00000000-0000-0000-0000-000001300001'),
  '11.8: com 3 publicadas o bar precisa de resumo');
select is(public.otcb_gravar_resumo('00000000-0000-0000-0000-000001300001', 'Chopp bem tirado, atendimento rápido.'), true, 'resumo gravado');

-- ===== denúncias de p2, p4, p5 sobre a opinião de p1
create function pg_temp.denuncia(p_quem int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', format('{"sub":"00000000-0000-0000-0000-00000013000%s","role":"authenticated"}', p_quem), true);
  set local role authenticated;
  insert into public.otcb_denuncias (opiniao_id, usuario_id, motivo)
  values ('00000000-0000-0000-0000-0000013e0001', ('00000000-0000-0000-0000-00000013000' || p_quem)::uuid, 'teste');
  reset role;
end $$;
select pg_temp.denuncia(2);
select pg_temp.denuncia(4);
select is((select status::text from public.otcb_opinioes where id = '00000000-0000-0000-0000-0000013e0001'), 'publicada', '2 denúncias: ainda publicada');
select throws_ok($$ select pg_temp.denuncia(4) $$, '23505', null, '11.6: a mesma pessoa não denuncia duas vezes');
select pg_temp.denuncia(5);
select is((select (status, qtd_denuncias)::text from public.otcb_opinioes where id = '00000000-0000-0000-0000-0000013e0001'), '(oculta_denuncias,3)',
  'critério 2: 3 denúncias distintas → oculta_denuncias');

-- ===== resumo volta a nulo abaixo de 3 publicadas (11.8)
select is((select resumo_opinioes from public.otcb_bares where id = '00000000-0000-0000-0000-000001300001'), null::text,
  'critério 4: com 2 publicadas o resumo some');
select ok(not exists (select 1 from public.otcb_bares_para_resumo(500) where bar_id = '00000000-0000-0000-0000-000001300001'),
  'com 2 publicadas o bar não entra no resumo');
select is(public.otcb_gravar_resumo('00000000-0000-0000-0000-000001300001', 'Tentativa'), false, 'e o resumo não é gravado');

-- ===== visão de outra pessoa (p3) e do dono (p1)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000130003","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.otcb_opinioes_do_bar('00000000-0000-0000-0000-000001300001')), 2, 'a oculta some da lista pública');
select is((select count(*)::int from public.otcb_opinioes where id = '00000000-0000-0000-0000-0000013e0001'), 0, 'outra pessoa não lê a oculta');
select is((select resumo_opinioes from public.otcb_bares where id = '00000000-0000-0000-0000-000001300001'), null::text, 'ninguém vê resumo com 2 publicadas');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000130001","role":"authenticated"}', true);
set local role authenticated;
select is((select (texto, status)::text from public.otcb_opinioes where id = '00000000-0000-0000-0000-0000013e0001'),
  '("Opinião de teste número 1",oculta_denuncias)', 'critério 3: o dono lê a própria opinião oculta, com o status');
select throws_ok($$ select qtd_denuncias, edicoes_qtd from public.otcb_opinioes $$, '42501', null, 'mas não o contador de edições');
select lives_ok($$ select qtd_denuncias from public.otcb_opinioes $$, 'quantas denúncias ela teve ele pode ver');
reset role;

select * from finish();
rollback;
