-- Guardrail de banco (seções 6 e 26): toda tabela otcb_ do schema public tem RLS ligado.
-- Recebe: nada. Devolve: 1 asserção pgTAP (lista de tabelas otcb_ sem RLS deve ser vazia).
-- Vale desde o épico 8.0 (vazio) e passa a pegar regressão a partir do 8.2.
begin;
select plan(1);

select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname like 'otcb\_%'
        and not c.relrowsecurity $$,
  'toda tabela otcb_ tem RLS habilitado'
);

select * from finish();
rollback;
