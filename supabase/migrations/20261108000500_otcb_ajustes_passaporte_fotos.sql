-- Épico 8.2 — ajustes apontados pelo verifier (não bloqueantes).
-- (a) Política otcb_fotos_exclui_propria (6.1): o soft delete só marca a exclusão agora; não "desapaga"
--     (excluido_em = null) nem grava data futura.
-- (b) otcb_meu_passaporte (regra 11.11): a coleção do bairro conta todos os carimbos do usuário no bairro;
--     o selo Informante conta só confirmações/sugestões positivas de tem_brahma (as que "ajudaram").

-- (a) otcb_fotos_exclui_propria (6.1): o dono marca a própria foto como excluída, com data até agora.
drop policy otcb_fotos_exclui_propria on public.otcb_fotos;
create policy otcb_fotos_exclui_propria on public.otcb_fotos
  for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid())
              and excluido_em is not null
              and excluido_em <= now() + interval '1 minute');

-- (b) otcb_meu_passaporte (7.5 e 13.4; regra 11.11; princípio 3): Passaporte do usuário atual.
-- Security definer (o selo Informante lê as próprias evidências, reservadas ao admin pelo RLS); tudo
-- filtrado por auth.uid(). Recebe: nada. Devolve: { carimbos[], colecoes_bairro[], colecao_classicos, selos[] }.
-- Coleção do bairro: para cada bairro com bares ativos confirmado/provavel, carimbos do usuário no bairro
-- / bares ativos confirmado/provavel; conquistado com min(3, total). Nenhum selo conta quantidade de chopp.
create or replace function public.otcb_meu_passaporte()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.otcb_usuario_atual();
  v_carimbos jsonb;
  v_bairros jsonb;
  v_classicos jsonb;
  v_qtd_carimbos integer;
  v_qtd_bairros integer;
  v_olho integer;
  v_informante integer;
begin
  select coalesce(jsonb_agg(jsonb_build_object('carimbo_id', c.id, 'bar_id', b.id, 'nome_bar', b.nome,
                                               'bairro', b.bairro, 'foto_id', c.foto_id, 'criado_em', c.criado_em)
                            order by c.criado_em desc), '[]'::jsonb),
         count(*)::integer,
         count(distinct b.bairro)::integer
    into v_carimbos, v_qtd_carimbos, v_qtd_bairros
    from public.otcb_carimbos c
    join public.otcb_bares b on b.id = c.bar_id
   where c.usuario_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object('bairro', t.bairro, 'carimbos', t.carimbos, 'total_bares', t.total,
                                               'conquistado', t.carimbos >= least(3, t.total))
                            order by t.bairro), '[]'::jsonb)
    into v_bairros
    from (select a.bairro,
                 count(*)::integer as total,
                 (select count(*)::integer
                    from public.otcb_carimbos c join public.otcb_bares cb on cb.id = c.bar_id
                   where c.usuario_id = v_uid and cb.bairro = a.bairro) as carimbos
            from public.otcb_bares a
           where a.excluido_em is null and a.status in ('confirmado', 'provavel')
           group by a.bairro) t;

  select jsonb_build_object('carimbos', count(c.id)::integer, 'total', count(*)::integer)
    into v_classicos
    from public.otcb_bares b
    left join public.otcb_carimbos c on c.bar_id = b.id and c.usuario_id = v_uid
   where b.excluido_em is null and b.classico;

  select count(distinct f.bar_id)::integer into v_olho
    from public.otcb_fotos f
   where f.usuario_id = v_uid and f.nota_colarinho >= 9.0 and f.bar_id is not null;

  select count(*)::integer into v_informante
    from public.otcb_evidencias e
    join public.otcb_bares b on b.id = e.bar_id
   where e.usuario_id = v_uid and e.tipo in ('confirmacao_usuario', 'sugestao_usuario')
     and e.assunto = 'tem_brahma' and e.sinal = 'positivo'
     and b.status in ('confirmado', 'provavel');

  return jsonb_build_object(
    'carimbos', v_carimbos,
    'colecoes_bairro', v_bairros,
    'colecao_classicos', v_classicos,
    'selos', jsonb_build_array(
      jsonb_build_object('selo', 'primeira_tirada', 'progresso', least(v_qtd_carimbos, 1), 'meta', 1,
                         'conquistado', v_qtd_carimbos >= 1),
      jsonb_build_object('selo', 'explorador', 'progresso', v_qtd_carimbos,
                         'meta', case when v_qtd_carimbos < 5 then 5 when v_qtd_carimbos < 15 then 15 else 30 end,
                         'nivel', case when v_qtd_carimbos >= 30 then 3 when v_qtd_carimbos >= 15 then 2
                                       when v_qtd_carimbos >= 5 then 1 else 0 end,
                         'conquistado', v_qtd_carimbos >= 5),
      jsonb_build_object('selo', 'andarilho', 'progresso', v_qtd_bairros, 'meta', 5, 'conquistado', v_qtd_bairros >= 5),
      jsonb_build_object('selo', 'olho_clinico', 'progresso', v_olho, 'meta', 5, 'conquistado', v_olho >= 5),
      jsonb_build_object('selo', 'informante', 'progresso', v_informante, 'meta', 10, 'conquistado', v_informante >= 10)
    )
  );
end;
$$;
