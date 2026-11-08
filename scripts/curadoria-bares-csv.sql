-- Curadoria do Alexandre (épico 8.11, 08/11/2026): todos os bares do CSV original do OTCB (os que têm a
-- evidência 'seed_otcb_antigo') têm chopp Brahma. Grava uma evidência 'curadoria' por bar (peso 1,2, sem
-- decaimento na prática; regra em 20261108001600_otcb_regra_curadoria.sql). Idempotente: não duplica.
-- Aplicado no BANCO DE TESTE em 08/11/2026 (33 bares → confirmado). Rodar com credencial de serviço.
insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, trecho, data_evidencia, peso, meia_vida_dias)
select distinct e.bar_id, 'tem_brahma', 'positivo', 'curadoria', 'seed',
       'Curadoria do Alexandre: bar do CSV original do OTCB', now(), 0, 1
  from public.otcb_evidencias e
 where e.tipo = 'seed_otcb_antigo'
   and not exists (select 1 from public.otcb_evidencias c where c.bar_id = e.bar_id and c.tipo = 'curadoria');
