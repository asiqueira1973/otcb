-- Critério 1 do épico 8.2: todas as tabelas otcb_ com RLS e as políticas com os nomes exatos da seção 6.1.
begin;
select plan(13);

select is(
  (select array_agg(c.relname::text order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'otcb\_%' and c.relrowsecurity),
  array['otcb_bares','otcb_carimbos','otcb_compartilhamentos','otcb_denuncias','otcb_evidencias','otcb_execucoes_garimpo',
        'otcb_fotos','otcb_jogos','otcb_mensagens','otcb_opinioes','otcb_perfis'],
  'as 10 tabelas da seção 7.2 (mais otcb_compartilhamentos, 8.12) existem com RLS habilitado'
);

select policies_are('public', 'otcb_perfis',
  array['otcb_perfis_le_proprio','otcb_perfis_admin_le_todos','otcb_perfis_insere_proprio','otcb_perfis_atualiza_proprio'],
  '6.1: políticas de otcb_perfis');
select policies_are('public', 'otcb_bares', array['otcb_bares_le_ativos','otcb_bares_admin_tudo'],
  '6.1: políticas de otcb_bares');
select policies_are('public', 'otcb_evidencias', array['otcb_evidencias_admin_le'],
  '6.1: políticas de otcb_evidencias');
select policies_are('public', 'otcb_fotos', array['otcb_fotos_le_propria','otcb_fotos_admin_le','otcb_fotos_exclui_propria'],
  '6.1: políticas de otcb_fotos');
select policies_are('public', 'otcb_carimbos', array['otcb_carimbos_le_proprios','otcb_carimbos_admin_le'],
  '6.1: políticas de otcb_carimbos');
select policies_are('public', 'otcb_opinioes',
  array['otcb_opinioes_le_publicadas','otcb_opinioes_le_proprias','otcb_opinioes_admin_tudo','otcb_opinioes_apaga_propria'],
  '6.1: políticas de otcb_opinioes');
select policies_are('public', 'otcb_denuncias', array['otcb_denuncias_insere_propria','otcb_denuncias_admin_le'],
  '6.1: políticas de otcb_denuncias');
select policies_are('public', 'otcb_mensagens', array['otcb_mensagens_le_proprias','otcb_mensagens_apaga_proprias'],
  '6.1: políticas de otcb_mensagens');
select policies_are('public', 'otcb_jogos', array['otcb_jogos_le'], '6.1: políticas de otcb_jogos');
select policies_are('public', 'otcb_execucoes_garimpo', array['otcb_execucoes_admin_le'],
  '6.1: políticas de otcb_execucoes_garimpo');

select ok(
  exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                                     and policyname = 'otcb_fotos_storage_le_proprias'),
  '6.1: política otcb_fotos_storage_le_proprias no bucket otcb-fotos'
);

select is(
  (select public from storage.buckets where id = 'otcb-fotos'),
  false,
  'bucket otcb-fotos é privado'
);

select * from finish();
rollback;
