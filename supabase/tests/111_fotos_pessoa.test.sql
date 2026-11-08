-- Épico 8.6 — pessoa_identificavel em otcb_fotos: existe e o cliente não lê (13.5; seção 28).
begin;
select plan(3);
select has_column('public', 'otcb_fotos', 'pessoa_identificavel', 'coluna pessoa_identificavel existe');
set local role authenticated;
select throws_ok($$ select pessoa_identificavel from public.otcb_fotos $$, '42501', null, 'o cliente não lê pessoa_identificavel');
select lives_ok($$ select id, nota_colarinho, comentario_ia from public.otcb_fotos $$, 'o cliente lê as demais colunas da própria foto');
reset role;
select * from finish();
rollback;
