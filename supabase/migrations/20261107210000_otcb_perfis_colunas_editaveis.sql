-- Épico 8.1 (correção do verifier) — matriz 5.2 e épico 8.10: no próprio perfil o cliente só altera
-- apelido e time do coração; papel continua no grant para que a regra seja a do trigger
-- otcb_trg_perfil_protege_papel (seções 6.1 e 7.5: não admin não altera papel; admin pode).
-- Sem isto, o cliente podia reescrever maioridade_confirmada_em e criado_em da própria linha.

-- Grant de UPDATE por coluna para authenticated (o usuário anônimo); select e insert não mudam.
revoke update on public.otcb_perfis from authenticated;
grant update (apelido, time_do_coracao, papel) on public.otcb_perfis to authenticated;
