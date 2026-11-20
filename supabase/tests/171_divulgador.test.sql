-- 8.12 (versão 1.0.2, ideia do Alexandre): selo Divulgador por compartilhar a imagem do Passaporte ou da nota, na base
-- da confiança (o app registra quando a folha de compartilhar fecha). Conta dias diferentes (níveis 1, 5 e 15), no
-- máximo 10 registros por dia. O selo só aparece com p_versao >= 2, para o app 1.0.1 não mostrar selo sem texto.
begin;
select plan(13);

insert into auth.users (id, aud, role, is_anonymous, instance_id) values
  ('00000000-0000-0000-0000-0000001710a1', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000001710a2', 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values
  ('00000000-0000-0000-0000-0000001710a1', 't171_ana', now()),
  ('00000000-0000-0000-0000-0000001710a2', 't171_bia', now());

select ok(not has_function_privilege('anon', 'public.otcb_registrar_compartilhamento(text)', 'execute'), 'anon não registra');
select ok(has_function_privilege('authenticated', 'public.otcb_registrar_compartilhamento(text)', 'execute'), 'o app registra');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001710a1","role":"authenticated"}', true);
select is((select s from jsonb_array_elements(public.otcb_meu_passaporte() -> 'selos') s where s ->> 'selo' = 'divulgador'), null,
  'sem p_versao (app 1.0.1) o Divulgador não aparece');
select is((select (s ->> 'progresso', s ->> 'meta', s ->> 'conquistado')::text from jsonb_array_elements(public.otcb_meu_passaporte(2) -> 'selos') s
            where s ->> 'selo' = 'divulgador'), '(0,1,false)', 'com p_versao 2 aparece, meta 1');
select is((public.otcb_registrar_compartilhamento('passaporte') ->> 'dias')::int, 1, 'primeiro compartilhamento → 1 dia');
select is((public.otcb_registrar_compartilhamento('colarinho') ->> 'dias')::int, 1, 'outro no mesmo dia continua 1 dia');
select is((select (s ->> 'progresso', s ->> 'meta', s ->> 'nivel', s ->> 'conquistado')::text from jsonb_array_elements(public.otcb_meu_passaporte(2) -> 'selos') s
            where s ->> 'selo' = 'divulgador'), '(1,5,1,true)', 'Divulgador conquistado (nível 1), próxima meta 5');
select throws_ok($$ select public.otcb_registrar_compartilhamento('tiktok') $$, 'P0001', 'dados_invalidos', 'origem desconhecida é recusada');
reset role;

-- Um compartilhamento de ontem conta como outro dia.
insert into public.otcb_compartilhamentos (usuario_id, origem, criado_em)
values ('00000000-0000-0000-0000-0000001710a1', 'passaporte', now() - interval '1 day');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001710a1","role":"authenticated"}', true);
select is((select (s ->> 'progresso')::int from jsonb_array_elements(public.otcb_meu_passaporte(2) -> 'selos') s where s ->> 'selo' = 'divulgador'), 2,
  'conta dias diferentes');
-- Limite de 10 registros por dia (2 feitos + 8 = 10; o 11º é barrado).
select public.otcb_registrar_compartilhamento('colarinho') from generate_series(1, 8);
select throws_ok($$ select public.otcb_registrar_compartilhamento('colarinho') $$, 'P0001', 'limite_compartilhamento', 'no máximo 10 por dia');

-- RLS: a Bia não vê os registros da Ana.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000001710a2","role":"authenticated"}', true);
select is((select count(*)::int from public.otcb_compartilhamentos where usuario_id = '00000000-0000-0000-0000-0000001710a1'), 0,
  'ninguém vê os compartilhamentos dos outros');
select throws_ok($$ insert into public.otcb_compartilhamentos (usuario_id, origem) values ('00000000-0000-0000-0000-0000001710a2', 'colarinho') $$,
  '42501', null, 'o cliente não grava direto (só pela RPC)');
reset role;

-- Apagar o perfil apaga os compartilhamentos ("Apagar meus dados").
delete from public.otcb_perfis where id = '00000000-0000-0000-0000-0000001710a1';
select is((select count(*)::int from public.otcb_compartilhamentos where usuario_id = '00000000-0000-0000-0000-0000001710a1'), 0,
  'apagar o perfil apaga os compartilhamentos');

select * from finish();
rollback;
