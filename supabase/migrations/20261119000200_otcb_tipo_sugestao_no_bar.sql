-- Flexibilização do jogo (19/11/2026, pedido do Alexandre): novo tipo de evidência para a sugestão feita estando no
-- bar (coordenadas do celular). Só o valor do enum; a regra de peso vem na migration seguinte.
alter type public.otcb_tipo_evidencia add value if not exists 'sugestao_no_bar';
