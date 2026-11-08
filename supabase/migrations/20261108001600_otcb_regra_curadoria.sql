-- Emenda do 8.11 (decisão do Alexandre, 08/11/2026): regra 11.1 ganha a linha 'curadoria' / tem_brahma /
-- positivo, peso +1,2 (acima do limite 1,0 de confirmado mesmo após o decaimento mínimo) e meia-vida de 36.500 dias (na prática não decai: o app começa sem usuários, e a
-- curadoria não pode cair sozinha). Mesmo corpo da 20261108000300 mais essa linha; grants preservados.

-- otcb_regra_evidencia (regra 11.1; assunção 24.11: pesos e meias-vidas num único lugar ajustável).
-- Recebe: tipo, assunto e sinal. Devolve: peso e meia-vida. Combinação fora da tabela → 'evidencia_invalida'.
create or replace function public.otcb_regra_evidencia(p_tipo public.otcb_tipo_evidencia,
                                                       p_assunto public.otcb_assunto_evidencia,
                                                       p_sinal public.otcb_sinal_evidencia,
                                                       out peso numeric, out meia_vida_dias integer)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_assunto = 'funcionamento' and p_tipo in ('confirmacao_usuario', 'status_google')
     and (p_sinal = 'fechado' or (p_tipo = 'status_google' and p_sinal = 'positivo')) then
    peso := 0; meia_vida_dias := 30; return;
  end if;
  case
    when p_tipo = 'foto_colarinhometro' and p_assunto = 'tem_brahma' and p_sinal = 'positivo' then
      peso := 1.0; meia_vida_dias := 90;
    when p_tipo = 'confirmacao_usuario' and p_assunto in ('tem_brahma', 'transmite_jogos') and p_sinal = 'positivo' then
      peso := 0.6; meia_vida_dias := 60;
    when p_tipo = 'confirmacao_usuario' and p_assunto in ('tem_brahma', 'transmite_jogos') and p_sinal = 'negativo' then
      peso := -0.6; meia_vida_dias := 60;
    when p_tipo = 'sugestao_usuario' and p_assunto = 'tem_brahma' and p_sinal = 'positivo' then
      peso := 0.3; meia_vida_dias := 60;
    when p_tipo = 'cardapio_site' and p_assunto = 'tem_brahma' and p_sinal = 'positivo' then
      peso := 0.8; meia_vida_dias := 180;
    when p_tipo = 'cardapio_site' and p_assunto = 'tem_brahma' and p_sinal = 'negativo' then
      peso := -0.5; meia_vida_dias := 180;
    when p_tipo = 'pagina_web' and p_assunto in ('tem_brahma', 'transmite_jogos') and p_sinal = 'positivo' then
      peso := 0.5; meia_vida_dias := 120;
    when p_tipo = 'avaliacao_google' and p_assunto in ('tem_brahma', 'transmite_jogos') and p_sinal = 'positivo' then
      peso := 0.4; meia_vida_dias := 365;
    when p_tipo = 'seed_otcb_antigo' and p_assunto = 'tem_brahma' and p_sinal = 'positivo' then
      peso := 0.2; meia_vida_dias := 180;
    when p_tipo = 'curadoria' and p_assunto = 'tem_brahma' and p_sinal = 'positivo' then
      peso := 1.2; meia_vida_dias := 36500;
    else
      raise exception 'evidencia_invalida' using errcode = '22023';
  end case;
end;
$$;
