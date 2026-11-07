-- Épico 8.2 — correção apontada pelo verifier (teste 071): a anonimização (7.4) não pode mudar status,
-- pontuação nem agregados dos bares.
-- Antes: as evidências superadas da pessoa eram todas apagadas; mas uma foto/confirmação positiva de
-- tem_brahma superada ainda anula um fechamento mais antigo (11.2, condição 1), e o bar virava 'fechado'.
-- Agora: continuam sendo apagadas as superadas, exceto as positivas de tem_brahma (foto ou confirmação)
-- mais recentes que algum fechamento já registrado no bar — essas ficam, com peso 0 (já não somavam pela
-- 11.1) e seguem anulando o fechamento. E confirmacoes_60_dias conta pessoas, inclusive anônimas.

-- otcb_anonimizar_evidencias (seções 7.4 e 13.8; preserva as regras 11.1 e 11.2).
-- Recebe: o usuário que está apagando a conta. Devolve: quantas evidências ficaram desvinculadas.
-- 1) Superadas (por bar e assunto, não são a mais recente da pessoa) que anulam um fechamento mais antigo
--    do bar: peso 0. 2) Demais superadas: apagadas. 3) Desvincula as restantes (usuario_id = null).
-- Fechamentos futuros nascem com a data da coleta ou do toque (11.1), então não são anulados por elas.
create or replace function public.otcb_anonimizar_evidencias(p_usuario uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  -- 1) Superadas que anulam um fechamento mais antigo: ficam, com peso 0 (o peso não entra na ordenação,
  --    então o passo 2 enxerga o mesmo conjunto de superadas).
  with superadas as (
      select o.id,
             o.assunto = 'tem_brahma' and o.sinal = 'positivo'
             and o.tipo in ('foto_colarinhometro', 'confirmacao_usuario')
             and exists (select 1 from public.otcb_evidencias f
                          where f.bar_id = o.bar_id and f.assunto = 'funcionamento' and f.sinal = 'fechado'
                            and f.data_evidencia < o.data_evidencia) as preserva
        from (select e.id, e.bar_id, e.assunto, e.sinal, e.tipo, e.data_evidencia,
                     row_number() over (partition by e.bar_id, e.assunto
                                        order by e.data_evidencia desc, e.criado_em desc, e.id desc) as ordem
                from public.otcb_evidencias e
               where e.usuario_id = p_usuario) o
       where o.ordem > 1
    )
  update public.otcb_evidencias e set peso = 0
    from superadas s where e.id = s.id and s.preserva;

  -- 2) Demais superadas: apagadas.
  with superadas as (
      select o.id,
             o.assunto = 'tem_brahma' and o.sinal = 'positivo'
             and o.tipo in ('foto_colarinhometro', 'confirmacao_usuario')
             and exists (select 1 from public.otcb_evidencias f
                          where f.bar_id = o.bar_id and f.assunto = 'funcionamento' and f.sinal = 'fechado'
                            and f.data_evidencia < o.data_evidencia) as preserva
        from (select e.id, e.bar_id, e.assunto, e.sinal, e.tipo, e.data_evidencia,
                     row_number() over (partition by e.bar_id, e.assunto
                                        order by e.data_evidencia desc, e.criado_em desc, e.id desc) as ordem
                from public.otcb_evidencias e
               where e.usuario_id = p_usuario) o
       where o.ordem > 1
    )
  delete from public.otcb_evidencias e
   using superadas s where e.id = s.id and not s.preserva;

  -- 3) Desvincula as restantes.
  update public.otcb_evidencias set usuario_id = null where usuario_id = p_usuario;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

-- otcb_agregados_confirmacao (seções 5.2 e 13.2): agregados públicos das confirmações de um bar.
-- Recebe: bar. Devolve: ultima_confirmacao_em (foto ou confirmação positiva de tem_brahma mais recente)
-- e confirmacoes_60_dias (pessoas distintas em 60 dias: cada evidência anônima com peso conta como uma
-- pessoa; as superadas, de peso 0, não contam).
create or replace function public.otcb_agregados_confirmacao(p_bar_id uuid)
returns table (ultima_confirmacao_em timestamptz, confirmacoes_60_dias integer)
language sql
stable
security definer
set search_path = ''
as $$
  select max(e.data_evidencia),
         count(distinct coalesce(e.usuario_id::text, e.id::text))
           filter (where e.data_evidencia >= now() - interval '60 days' and e.peso <> 0)::integer
    from public.otcb_evidencias e
    join public.otcb_bares b on b.id = e.bar_id and b.excluido_em is null
   where e.bar_id = p_bar_id and e.assunto = 'tem_brahma' and e.sinal = 'positivo'
     and e.tipo in ('foto_colarinhometro', 'confirmacao_usuario');
$$;
