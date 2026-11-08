-- Emenda do 8.11 (decisão do Alexandre, 08/11/2026): novo tipo de evidência 'curadoria' — o dono do app atesta
-- que o bar tem chopp. Só o valor do enum aqui; a regra de peso vem na migration seguinte (o Postgres não usa
-- um valor de enum na mesma transação que o criou).
alter type public.otcb_tipo_evidencia add value if not exists 'curadoria';
