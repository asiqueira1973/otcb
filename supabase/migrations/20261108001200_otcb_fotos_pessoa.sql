-- Épico 8.6 — coluna pessoa_identificavel em otcb_fotos (13.5 e seção 28: "é gravado para orientar a v2 de
-- fotos públicas"; a 7.2 não a lista — divergência registrada no plano 8.6). Gravada só pelo serviço
-- (otcb-colarinhometro); o cliente não lê (grant por coluna), pois não muda nada no MVP.
alter table public.otcb_fotos add column pessoa_identificavel boolean;
comment on column public.otcb_fotos.pessoa_identificavel is 'A IA viu rosto de pessoa reconhecível (13.5); orienta a v2 de fotos públicas.';

revoke select on public.otcb_fotos from authenticated;
grant select (id, usuario_id, bar_id, distancia_bar_metros, caminho_storage, e_chopp, usuario_confirmou_brahma,
              nota_altura, nota_cremosidade, nota_copo, nota_gelado, nota_colarinho, comentario_ia, modelo_ia,
              excluido_em, criado_em)
  on public.otcb_fotos to authenticated;
