-- Épico 8.2 — correção apontada pelo verifier (teste 072): a anonimização (7.4) não pode mudar o CardBar
-- (13.2). Regra final: de cada pessoa, por bar, ficam só
--   (a) a evidência mais recente de cada assunto — a única que soma na pontuação (11.1); e
--   (b) a sua foto/confirmação positiva de tem_brahma mais recente, com peso 0 se não for a (a) —
--       ela sustenta a anulação de fechamentos (11.2), ultima_confirmacao_em e confirmacoes_60_dias (13.2).
-- As demais são apagadas e as que ficam perdem o usuario_id. Assim cada evidência positiva anônima
-- corresponde a uma pessoa, e pontuação, status e agregados ficam idênticos.

-- otcb_anonimizar_evidencias (seções 7.4 e 13.8; preserva as regras 11.1, 11.2 e o CardBar da 13.2).
-- Recebe: o usuário que está apagando a conta. Devolve: quantas evidências ficaram desvinculadas.
create or replace function public.otcb_anonimizar_evidencias(p_usuario uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  -- Classifica as evidências da pessoa: ordem por bar+assunto (a mais recente soma) e, entre as positivas
  -- de tem_brahma por foto/confirmação, a mais recente por bar.
  with classificadas as (
    select e.id,
           row_number() over (partition by e.bar_id, e.assunto
                              order by e.data_evidencia desc, e.criado_em desc, e.id desc) as ordem,
           case when e.assunto = 'tem_brahma' and e.sinal = 'positivo'
                     and e.tipo in ('foto_colarinhometro', 'confirmacao_usuario')
                then row_number() over (partition by e.bar_id,
                                                     (e.assunto = 'tem_brahma' and e.sinal = 'positivo'
                                                      and e.tipo in ('foto_colarinhometro', 'confirmacao_usuario'))
                                        order by e.data_evidencia desc, e.criado_em desc, e.id desc)
           end as ordem_positiva
      from public.otcb_evidencias e
     where e.usuario_id = p_usuario
  )
  update public.otcb_evidencias e
     set peso = 0
    from classificadas c
   where e.id = c.id and c.ordem > 1 and c.ordem_positiva = 1;

  with classificadas as (
    select e.id,
           row_number() over (partition by e.bar_id, e.assunto
                              order by e.data_evidencia desc, e.criado_em desc, e.id desc) as ordem,
           case when e.assunto = 'tem_brahma' and e.sinal = 'positivo'
                     and e.tipo in ('foto_colarinhometro', 'confirmacao_usuario')
                then row_number() over (partition by e.bar_id,
                                                     (e.assunto = 'tem_brahma' and e.sinal = 'positivo'
                                                      and e.tipo in ('foto_colarinhometro', 'confirmacao_usuario'))
                                        order by e.data_evidencia desc, e.criado_em desc, e.id desc)
           end as ordem_positiva
      from public.otcb_evidencias e
     where e.usuario_id = p_usuario
  )
  delete from public.otcb_evidencias e
   using classificadas c
   where e.id = c.id and c.ordem > 1 and coalesce(c.ordem_positiva, 0) <> 1;

  update public.otcb_evidencias set usuario_id = null where usuario_id = p_usuario;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

-- otcb_agregados_confirmacao (seções 5.2 e 13.2): agregados públicos das confirmações de um bar.
-- Recebe: bar. Devolve: ultima_confirmacao_em (foto ou confirmação positiva de tem_brahma mais recente) e
-- confirmacoes_60_dias (pessoas distintas em 60 dias; após a anonimização resta no máximo uma positiva
-- por pessoa e bar, então cada positiva anônima conta como uma pessoa).
create or replace function public.otcb_agregados_confirmacao(p_bar_id uuid)
returns table (ultima_confirmacao_em timestamptz, confirmacoes_60_dias integer)
language sql
stable
security definer
set search_path = ''
as $$
  select max(e.data_evidencia),
         count(distinct coalesce(e.usuario_id::text, e.id::text))
           filter (where e.data_evidencia >= now() - interval '60 days')::integer
    from public.otcb_evidencias e
    join public.otcb_bares b on b.id = e.bar_id and b.excluido_em is null
   where e.bar_id = p_bar_id and e.assunto = 'tem_brahma' and e.sinal = 'positivo'
     and e.tipo in ('foto_colarinhometro', 'confirmacao_usuario');
$$;
