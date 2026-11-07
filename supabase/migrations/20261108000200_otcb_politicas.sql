-- Épico 8.2 — políticas de RLS da seção 6.1 (nomes exatos) e bucket otcb-fotos.
-- Toda política usa auth.uid() (seção 6; banco compartilhado com login anônimo, risco 23).
-- otcb_e_admin() (8.1) é security definer e evita recursão nas políticas de admin.

-- ===== otcb_bares =====
-- otcb_bares_le_ativos (6.1): autenticados leem bares não excluídos. A visibilidade por status/pontuação
-- das buscas é da regra 11.9 (otcb_buscar_bares), não do RLS.
create policy otcb_bares_le_ativos on public.otcb_bares
  for select to authenticated using (excluido_em is null);
-- otcb_bares_admin_tudo (6.1 e 5.2): admin lê tudo (inclusive excluídos) e cria, edita e exclui.
create policy otcb_bares_admin_tudo on public.otcb_bares
  for all to authenticated using ((select public.otcb_e_admin())) with check ((select public.otcb_e_admin()));

-- ===== otcb_evidencias =====
-- otcb_evidencias_admin_le (6.1): só admin lê evidências cruas; usuários veem só agregados (5.2).
create policy otcb_evidencias_admin_le on public.otcb_evidencias
  for select to authenticated using ((select public.otcb_e_admin()));

-- ===== otcb_fotos =====
-- otcb_fotos_le_propria (6.1): o usuário lê só as próprias fotos.
create policy otcb_fotos_le_propria on public.otcb_fotos
  for select to authenticated using (usuario_id = (select auth.uid()));
-- otcb_fotos_admin_le (6.1): admin lê todas.
create policy otcb_fotos_admin_le on public.otcb_fotos
  for select to authenticated using ((select public.otcb_e_admin()));
-- otcb_fotos_exclui_propria (6.1): soft delete (excluido_em) só na própria; o grant de coluna limita o update.
create policy otcb_fotos_exclui_propria on public.otcb_fotos
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- ===== otcb_carimbos =====
-- otcb_carimbos_le_proprios (6.1): o usuário lê só os próprios carimbos.
create policy otcb_carimbos_le_proprios on public.otcb_carimbos
  for select to authenticated using (usuario_id = (select auth.uid()));
-- otcb_carimbos_admin_le (6.1): admin lê todos.
create policy otcb_carimbos_admin_le on public.otcb_carimbos
  for select to authenticated using ((select public.otcb_e_admin()));

-- ===== otcb_opinioes =====
-- otcb_opinioes_le_publicadas (6.1): autenticados leem opiniões publicadas de todos.
create policy otcb_opinioes_le_publicadas on public.otcb_opinioes
  for select to authenticated using (status = 'publicada');
-- otcb_opinioes_le_proprias (6.1): o autor lê todas as próprias, inclusive ocultas (copy 15.17).
create policy otcb_opinioes_le_proprias on public.otcb_opinioes
  for select to authenticated using (usuario_id = (select auth.uid()));
-- otcb_opinioes_admin_tudo (6.1): admin lê, oculta/reexibe e apaga qualquer opinião.
create policy otcb_opinioes_admin_tudo on public.otcb_opinioes
  for all to authenticated using ((select public.otcb_e_admin())) with check ((select public.otcb_e_admin()));
-- otcb_opinioes_apaga_propria (6.1): o autor apaga a própria (hard delete, 7.4).
create policy otcb_opinioes_apaga_propria on public.otcb_opinioes
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- ===== otcb_denuncias =====
-- otcb_denuncias_insere_propria (6.1 e 5.2): denuncia em nome próprio e nunca a própria opinião.
create policy otcb_denuncias_insere_propria on public.otcb_denuncias
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and not exists (
      select 1 from public.otcb_opinioes o
       where o.id = opiniao_id and o.usuario_id = (select auth.uid())
    )
  );
-- otcb_denuncias_admin_le (6.1): só admin lê denúncias.
create policy otcb_denuncias_admin_le on public.otcb_denuncias
  for select to authenticated using ((select public.otcb_e_admin()));

-- ===== otcb_mensagens =====
-- otcb_mensagens_le_proprias (6.1): o usuário lê só as próprias; admin não lê (privacidade, 5.2).
create policy otcb_mensagens_le_proprias on public.otcb_mensagens
  for select to authenticated using (usuario_id = (select auth.uid()));
-- otcb_mensagens_apaga_proprias (6.1): "Limpar conversa" apaga só as próprias.
create policy otcb_mensagens_apaga_proprias on public.otcb_mensagens
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- ===== otcb_jogos =====
-- otcb_jogos_le (6.1): autenticados leem os jogos; escrita só serviço.
create policy otcb_jogos_le on public.otcb_jogos
  for select to authenticated using (true);

-- ===== otcb_execucoes_garimpo =====
-- otcb_execucoes_admin_le (6.1): só admin lê as execuções do garimpo.
create policy otcb_execucoes_admin_le on public.otcb_execucoes_garimpo
  for select to authenticated using ((select public.otcb_e_admin()));

-- ===== Storage: bucket privado otcb-fotos (seções 4.2, 6.1 e 17: fotos de até 1 MB, JPEG) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('otcb-fotos', 'otcb-fotos', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

-- otcb_fotos_storage_le_proprias (6.1): o dono lê a própria pasta {usuario_id}/; escrita só serviço.
create policy otcb_fotos_storage_le_proprias on storage.objects
  for select to authenticated
  using (bucket_id = 'otcb-fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
