-- Épico 8.2 — correções dos bugs apontados pelo verifier (teste 070).
-- (1) Seção 7.4 × regra 11.1: ao apagar a conta, as evidências do usuário são desvinculadas; sem cuidado,
--     todas as suas evidências passavam a contar (o "um voto por pessoa" depende do usuario_id).
--     Correção: antes de desvincular, apagam-se as evidências superadas da pessoa (as que já não contavam
--     pela 11.1 — só a mais recente por bar e assunto conta). E o "fechou" anônimo conta como uma pessoa.
-- (2) Regra 11.5 e seção 7.7: os agregados de fotos e opiniões passam a ser recalculados também no delete
--     (cascata de "Apagar meus dados") e reconstruídos pelo recálculo diário.

-- ===================================================================== agregados

-- otcb_agregar_fotos_do_bar (regra 11.5): recalcula nota_colarinho_media e qtd_fotos_avaliadas do bar a
-- partir das fotos não excluídas. Recebe: bar. Devolve: nada.
create function public.otcb_agregar_fotos_do_bar(p_bar_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.otcb_bares b
     set nota_colarinho_media = a.media, qtd_fotos_avaliadas = a.qtd
    from (select round(avg(f.nota_colarinho), 2) as media, count(f.nota_colarinho)::integer as qtd
            from public.otcb_fotos f
           where f.bar_id = p_bar_id and f.excluido_em is null) a
   where b.id = p_bar_id;
$$;

-- otcb_agregar_opinioes_do_bar (regras 11.7 e 11.8): recalcula nota_opinioes_media e qtd_opinioes das
-- opiniões publicadas; abaixo de 3 publicadas o resumo volta a nulo. Recebe: bar. Devolve: nada.
create function public.otcb_agregar_opinioes_do_bar(p_bar_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.otcb_bares b
     set nota_opinioes_media = a.media,
         qtd_opinioes = a.qtd,
         resumo_opinioes = case when a.qtd < 3 then null else b.resumo_opinioes end,
         resumo_atualizado_em = case when a.qtd < 3 then null else b.resumo_atualizado_em end
    from (select round(avg(o.nota) filter (where o.nota is not null), 2) as media, count(*)::integer as qtd
            from public.otcb_opinioes o
           where o.bar_id = p_bar_id and o.status = 'publicada') a
   where b.id = p_bar_id;
$$;

-- Trigger function otcb_processar_foto — trigger otcb_trg_foto_processa (7.5; regras 11.4, 11.5 e 11.12).
-- Agora também no DELETE (cascata de "Apagar meus dados"). Recebe: a foto inserida, alterada (excluido_em)
-- ou apagada. Devolve: nada (after). Insert: evidência e carimbo da 11.4. Sempre: agregados do bar (11.5).
create or replace function public.otcb_processar_foto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.e_chopp and new.bar_id is not null and new.usuario_confirmou_brahma then
    insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, foto_id, data_evidencia, peso, meia_vida_dias)
    values (new.bar_id, 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario', new.usuario_id, new.id, new.criado_em, 0, 1);

    if not exists (select 1 from public.otcb_carimbos c where c.usuario_id = new.usuario_id and c.bar_id = new.bar_id)
       and (select count(*) from public.otcb_carimbos c
             where c.usuario_id = new.usuario_id and public.otcb_dia_sp(c.criado_em) = public.otcb_hoje_sp()) < 2 then
      insert into public.otcb_carimbos (usuario_id, bar_id, foto_id) values (new.usuario_id, new.bar_id, new.id);
    end if;
  end if;

  if tg_op = 'DELETE' then
    if old.bar_id is not null then
      perform public.otcb_agregar_fotos_do_bar(old.bar_id);
    end if;
  elsif new.bar_id is not null then
    perform public.otcb_agregar_fotos_do_bar(new.bar_id);
  end if;
  return null;
end;
$$;

drop trigger otcb_trg_foto_processa on public.otcb_fotos;
create trigger otcb_trg_foto_processa
  after insert or update of excluido_em or delete on public.otcb_fotos
  for each row execute function public.otcb_processar_foto();

-- Trigger function otcb_agregar_opinioes — trigger otcb_trg_opiniao_agrega (7.5): passa a usar a função
-- de agregação compartilhada com o recálculo diário. Recebe: a opinião. Devolve: nada (after).
create or replace function public.otcb_agregar_opinioes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.otcb_agregar_opinioes_do_bar(coalesce(new.bar_id, old.bar_id));
  return null;
end;
$$;

-- otcb_recalcular_todos (7.5 e 7.7): recalcula status e pontuação dos bares ativos e reconstrói os
-- agregados de fotos e opiniões ("a fonte de verdade continua nas tabelas filhas").
-- Recebe: nada. Devolve: quantos bares foram recalculados. Agendada diariamente (otcb_cron_recalculo).
create or replace function public.otcb_recalcular_todos()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_total integer := 0;
begin
  for v_id in select id from public.otcb_bares where excluido_em is null loop
    perform public.otcb_recalcular_bar(v_id);
    perform public.otcb_agregar_fotos_do_bar(v_id);
    perform public.otcb_agregar_opinioes_do_bar(v_id);
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

-- ===================================================================== anonimização (7.4 × 11.1)

-- otcb_anonimizar_evidencias (seção 7.4 e 13.8; preserva a regra 11.1).
-- Recebe: o usuário que está apagando a conta. Devolve: quantas evidências ficaram desvinculadas.
-- 1) Apaga as evidências superadas da pessoa: por bar e assunto, só a mais recente contava (11.1);
--    as outras já tinham peso zero na soma e, sem usuario_id, passariam a contar.
-- 2) Desvincula as restantes (usuario_id = null). A pontuação e o status dos bares não mudam.
create function public.otcb_anonimizar_evidencias(p_usuario uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  delete from public.otcb_evidencias e
   using (select id,
                 row_number() over (partition by bar_id, assunto
                                    order by data_evidencia desc, criado_em desc, id desc) as ordem
            from public.otcb_evidencias
           where usuario_id = p_usuario) r
   where e.id = r.id and r.ordem > 1;

  update public.otcb_evidencias set usuario_id = null where usuario_id = p_usuario;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

-- Trigger function otcb_anonimizar_ao_apagar_perfil — trigger otcb_trg_perfil_anonimiza (7.4).
-- Recebe: o perfil sendo apagado. Devolve: a linha antiga (before delete, segue com a exclusão).
-- Garante a anonimização correta mesmo quando o perfil é apagado fora da Edge Function (ex.: Studio).
create function public.otcb_anonimizar_ao_apagar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.otcb_anonimizar_evidencias(old.id);
  return old;
end;
$$;

create trigger otcb_trg_perfil_anonimiza
  before delete on public.otcb_perfis
  for each row execute function public.otcb_anonimizar_ao_apagar_perfil();

-- otcb_recalcular_bar (7.5; regras 11.1–11.3): única mudança — no "fechou" de 2 usuários distintos
-- (11.2, condição 1), cada evidência anônima conta como uma pessoa (após a anonimização só sobra a mais
-- recente de cada pessoa por bar e assunto). Recebe: bar. Devolve: o status.
create or replace function public.otcb_recalcular_bar(p_bar_id uuid)
returns public.otcb_status_bar
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brahma numeric;
  v_jogos numeric;
  v_fechado_google timestamptz;
  v_fechado_usuarios timestamptz;
  v_fechamento timestamptz;
  v_status public.otcb_status_bar;
  v_transmite boolean;
begin
  with ev as (
    select e.assunto, e.peso, e.meia_vida_dias, e.data_evidencia,
           case when e.usuario_id is null then 1
                else row_number() over (partition by e.assunto, e.usuario_id
                                        order by e.data_evidencia desc, e.criado_em desc, e.id desc)
           end as ordem
      from public.otcb_evidencias e
     where e.bar_id = p_bar_id and e.assunto in ('tem_brahma', 'transmite_jogos')
  )
  select round(coalesce(sum(peso * power(0.5::numeric,
                 greatest(0, extract(epoch from (now() - data_evidencia)) / 86400.0) / meia_vida_dias))
                 filter (where assunto = 'tem_brahma'), 0), 3),
         round(coalesce(sum(peso * power(0.5::numeric,
                 greatest(0, extract(epoch from (now() - data_evidencia)) / 86400.0) / meia_vida_dias))
                 filter (where assunto = 'transmite_jogos'), 0), 3)
    into v_brahma, v_jogos
    from ev
   where ordem = 1;

  select max(e.data_evidencia) into v_fechado_google
    from public.otcb_evidencias e
   where e.bar_id = p_bar_id and e.assunto = 'funcionamento' and e.sinal = 'fechado' and e.tipo = 'status_google';

  select case when count(distinct coalesce(e.usuario_id::text, e.id::text)) >= 2 then max(e.data_evidencia) end
    into v_fechado_usuarios
    from public.otcb_evidencias e
   where e.bar_id = p_bar_id and e.assunto = 'funcionamento' and e.sinal = 'fechado'
     and e.tipo = 'confirmacao_usuario' and e.data_evidencia >= now() - interval '30 days';

  v_fechamento := greatest(v_fechado_google, v_fechado_usuarios);

  if v_fechamento is not null and not exists (
       select 1 from public.otcb_evidencias e
        where e.bar_id = p_bar_id and e.assunto = 'tem_brahma' and e.sinal = 'positivo'
          and e.origem = 'usuario' and e.tipo in ('foto_colarinhometro', 'confirmacao_usuario')
          and e.data_evidencia > v_fechamento) then
    v_status := 'fechado';
  elsif v_brahma <= -0.5 then
    v_status := 'sem_brahma';
  elsif v_brahma >= 1.0 then
    v_status := 'confirmado';
  elsif v_brahma >= 0.5 then
    v_status := 'provavel';
  else
    v_status := 'incerto';
  end if;

  v_transmite := case when v_jogos >= 0.5 then true when v_jogos <= -0.5 then false else null end;

  update public.otcb_bares b
     set pontuacao_brahma = v_brahma,
         transmite_jogos = v_transmite,
         status_atualizado_em = case when b.status is distinct from v_status then now() else b.status_atualizado_em end,
         status = v_status
   where b.id = p_bar_id;

  return v_status;
end;
$$;

-- Permissões: funções internas só para o serviço (a Edge Function otcb-apagar-conta chama a anonimização).
revoke execute on function public.otcb_agregar_fotos_do_bar(uuid) from public, anon, authenticated;
revoke execute on function public.otcb_agregar_opinioes_do_bar(uuid) from public, anon, authenticated;
revoke execute on function public.otcb_anonimizar_evidencias(uuid) from public, anon, authenticated;
revoke execute on function public.otcb_anonimizar_ao_apagar_perfil() from public, anon, authenticated;
grant execute on function public.otcb_agregar_fotos_do_bar(uuid) to service_role;
grant execute on function public.otcb_agregar_opinioes_do_bar(uuid) to service_role;
grant execute on function public.otcb_anonimizar_evidencias(uuid) to service_role;
