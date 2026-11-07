-- Épico 8.1 — perfil do usuário anônimo (spec seções 5, 6, 6.1, 7.1, 7.2, 7.5 e regra 11.7).
-- Cria só os objetos do perfil; o restante do modelo de dados entra no épico 8.2.
-- Banco compartilhado (BANCO DE TESTE): todo objeto leva o prefixo otcb_ e nada fora dele é tocado.

-- Enum otcb_papel (seção 7.1): perfil do usuário no app.
create type public.otcb_papel as enum ('usuario', 'admin');

-- Tabela otcb_perfis (seção 7.2): dados do usuário no app, 1 linha por usuário anônimo de auth.users.
create table public.otcb_perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  apelido text not null,
  papel public.otcb_papel not null default 'usuario',
  maioridade_confirmada_em timestamptz not null,
  time_do_coracao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Regra 11.7: apelido com 3 a 20 caracteres, só letras sem acento, números, ponto e sublinhado.
  constraint otcb_perfis_apelido_formato check (
    char_length(apelido) between 3 and 20 and apelido ~ '^[A-Za-z0-9_.]+$'
  )
);

comment on table public.otcb_perfis is
  'Perfil do usuário anônimo do OTCB (spec 7.2). Data de nascimento nunca é gravada; só o instante da confirmação de maioridade (seção 6).';

-- Regra 11.7: apelido único sem diferenciar maiúsculas.
create unique index otcb_perfis_apelido_unico on public.otcb_perfis (lower(apelido));

-- otcb_e_admin() (seção 6.1 e 7.5): diz se o usuário atual tem papel 'admin'.
-- Recebe: nada (usa auth.uid()). Devolve: boolean.
-- Security definer para ler otcb_perfis sem recursão de RLS; search_path fixo.
create function public.otcb_e_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.otcb_perfis p
     where p.id = (select auth.uid())
       and p.papel = 'admin'
  );
$$;

revoke execute on function public.otcb_e_admin() from public, anon;
grant execute on function public.otcb_e_admin() to authenticated, service_role;

-- otcb_definir_atualizado_em() — função do trigger otcb_trg_atualizado_em (seção 7.5).
-- Recebe: a linha nova de um UPDATE. Devolve: a mesma linha com atualizado_em = now().
-- Reutilizada por todas as tabelas otcb_ que têm a coluna atualizado_em.
create function public.otcb_definir_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- Trigger otcb_trg_atualizado_em (seção 7.5): mantém atualizado_em em otcb_perfis.
create trigger otcb_trg_atualizado_em
  before update on public.otcb_perfis
  for each row execute function public.otcb_definir_atualizado_em();

-- otcb_protege_papel() — função do trigger otcb_trg_perfil_protege_papel (seções 6.1 e 7.5).
-- Recebe: linhas antiga e nova de um UPDATE em otcb_perfis.
-- Devolve: a linha nova, ou erro 'papel_protegido' se um não admin tenta mudar papel.
-- Service role (Studio/SQL e Edge Functions) passa: é assim que o admin é promovido (seção 5.1).
create function public.otcb_protege_papel()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.papel is distinct from old.papel
     and coalesce((select auth.role()), '') = 'authenticated'
     and not public.otcb_e_admin() then
    raise exception 'papel_protegido' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Trigger otcb_trg_perfil_protege_papel (seção 7.5): impede que um não admin altere papel.
create trigger otcb_trg_perfil_protege_papel
  before update on public.otcb_perfis
  for each row execute function public.otcb_protege_papel();

-- RLS (seção 6): habilitado; toda política usa auth.uid().
alter table public.otcb_perfis enable row level security;

-- Política otcb_perfis_le_proprio (6.1): o usuário lê só a própria linha.
create policy otcb_perfis_le_proprio on public.otcb_perfis
  for select to authenticated
  using (id = (select auth.uid()));

-- Política otcb_perfis_admin_le_todos (6.1): admin lê todas as linhas.
create policy otcb_perfis_admin_le_todos on public.otcb_perfis
  for select to authenticated
  using ((select public.otcb_e_admin()));

-- Política otcb_perfis_insere_proprio (6.1): insere só a própria linha e sempre como 'usuario'
-- (o trigger de papel só cobre UPDATE; sem isto alguém poderia nascer admin).
create policy otcb_perfis_insere_proprio on public.otcb_perfis
  for insert to authenticated
  with check (id = (select auth.uid()) and papel = 'usuario');

-- Política otcb_perfis_atualiza_proprio (6.1): atualiza só a própria linha (papel protegido pelo trigger).
create policy otcb_perfis_atualiza_proprio on public.otcb_perfis
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Grants (seção 6): só authenticated (inclui o usuário anônimo); anon não acessa.
-- Sem delete para o cliente: exclusão só via Edge Function otcb-apagar-conta (13.8).
revoke all on public.otcb_perfis from anon, authenticated;
grant select, insert, update on public.otcb_perfis to authenticated;
