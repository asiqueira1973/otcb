-- Épico 8.2 — extensões usadas pelas regras do banco (liberadas pelo Alexandre em 07/11/2026).
-- pg_trgm: similaridade de nomes (regra 11.16). unaccent: comparação sem acento (regras 11.9 e 11.16).
-- pg_cron: jobs diários de recálculo e limpeza (seção 7.5). Nenhuma mexe em objetos de outros apps.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- otcb_normalizar(texto) — normaliza nomes para comparação (regras 11.9 e 11.16).
-- Recebe: um texto. Devolve: o texto sem acento, minúsculo, sem espaços repetidos e sem os prefixos
-- "bar", "boteco" e "restaurante" no início. Imutável para poder ser usada em índice.
create function public.otcb_normalizar(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select trim(regexp_replace(
           regexp_replace(
             lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_texto, ''))),
             '\s+', ' ', 'g'),
           '^\s*(bar|boteco|restaurante)\s+', '', 'g'));
$$;

revoke execute on function public.otcb_normalizar(text) from public, anon;
grant execute on function public.otcb_normalizar(text) to authenticated, service_role;
