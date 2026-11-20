-- 8.12 (versão 1.0.2): "Não sei" na sugestão de bar passa a cadastrar o bar como "a confirmar". Tipo de evidência
-- novo, em migration separada porque o valor de enum não pode ser usado na mesma transação em que é criado.
alter type public.otcb_tipo_evidencia add value if not exists 'sugestao_sem_certeza';
