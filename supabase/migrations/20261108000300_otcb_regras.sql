-- Épico 8.2 — lógica no banco da seção 7.5 (regras 11.1 a 11.4, 11.6, 11.7, 11.9, 11.11, 11.14, 11.16).
-- Toda função tem search_path fixo. Funções internas (recálculo, limpeza) só executam como serviço;
-- RPCs do app (13.4) só para authenticated. Triggers que escrevem em tabelas sem grant do usuário
-- são security definer.

-- ===================================================================== utilitárias

-- otcb_distancia_metros (7.5): distância haversine em metros entre dois pontos (sem PostGIS, 7.7).
-- Recebe: lat/lng de origem e destino. Devolve: metros (double precision).
create function public.otcb_distancia_metros(lat1 double precision, lng1 double precision,
                                             lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- otcb_hoje_sp(): dia civil corrente em America/Sao_Paulo (regra 11.12). Devolve: date.
create function public.otcb_hoje_sp()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date; $$;

-- otcb_dia_sp(instante): dia civil em São Paulo de um instante (regra 11.12). Devolve: date.
create function public.otcb_dia_sp(p_instante timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$ select (p_instante at time zone 'America/Sao_Paulo')::date; $$;

-- otcb_regra_evidencia (regra 11.1; assunção 24.11: pesos e meias-vidas num único lugar ajustável).
-- Recebe: tipo, assunto e sinal. Devolve: (peso, meia_vida_dias) da tabela 11.1.
-- Combinação fora da tabela → erro 'evidencia_invalida'. Para assunto 'funcionamento' o peso é 0
-- (a regra 11.2 trata o fechamento à parte) e a meia-vida, irrelevante, fica em 30 (janela da 11.2).
create function public.otcb_regra_evidencia(p_tipo public.otcb_tipo_evidencia,
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
    else
      raise exception 'evidencia_invalida' using errcode = '22023';
  end case;
end;
$$;

-- Trigger function otcb_definir_peso_evidencia — trigger otcb_trg_evidencia_define_peso (regra 11.1:
-- "peso e meia-vida copiados da tabela no insert"). Recebe: a linha nova. Devolve: a linha com peso e
-- meia_vida_dias preenchidos pela regra (ignora o que vier do chamador).
create function public.otcb_definir_peso_evidencia()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  r record;
begin
  select * into r from public.otcb_regra_evidencia(new.tipo, new.assunto, new.sinal);
  new.peso := r.peso;
  new.meia_vida_dias := r.meia_vida_dias;
  return new;
end;
$$;

create trigger otcb_trg_evidencia_define_peso
  before insert on public.otcb_evidencias
  for each row execute function public.otcb_definir_peso_evidencia();

-- ===================================================================== status do bar

-- otcb_recalcular_bar (7.5; regras 11.1, 11.2 e 11.3).
-- Recebe: id do bar. Devolve: o status resultante. Grava pontuacao_brahma, status, transmite_jogos e,
-- quando o status muda, status_atualizado_em.
-- 11.1: força = peso × 0,5^(idade_dias / meia_vida); de cada usuário só a evidência mais recente por assunto.
-- 11.2: (1) fechado → (2) ≤ −0,5 sem_brahma → (3) ≥ 1,0 confirmado → (4) ≥ 0,5 provavel → (5) incerto.
-- 11.3: transmite_jogos true (≥ 0,5), false (≤ −0,5) ou null.
create function public.otcb_recalcular_bar(p_bar_id uuid)
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
  -- Pontuações por assunto (11.1). Evidências sem usuário (garimpo, seed, contas apagadas) contam todas;
  -- de cada usuário entra só a mais recente daquele assunto ("um voto por pessoa").
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

  -- 11.2 (1): fechamento pelo Google (a qualquer tempo) ou por 2 usuários distintos nos últimos 30 dias.
  select max(e.data_evidencia) into v_fechado_google
    from public.otcb_evidencias e
   where e.bar_id = p_bar_id and e.assunto = 'funcionamento' and e.sinal = 'fechado' and e.tipo = 'status_google';

  select case when count(distinct e.usuario_id) >= 2 then max(e.data_evidencia) end
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

-- Trigger function otcb_recalcular_bar_da_evidencia — trigger otcb_trg_evidencia_recalcula (7.5).
-- Recebe: a evidência inserida ou apagada. Devolve: nada (after). Recalcula o bar afetado.
create function public.otcb_recalcular_bar_da_evidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.otcb_recalcular_bar(coalesce(new.bar_id, old.bar_id));
  return null;
end;
$$;

create trigger otcb_trg_evidencia_recalcula
  after insert or delete on public.otcb_evidencias
  for each row execute function public.otcb_recalcular_bar_da_evidencia();

-- otcb_recalcular_todos (7.5): recalcula todos os bares ativos — o decaimento muda a pontuação com o tempo.
-- Recebe: nada. Devolve: quantos bares foram recalculados. Agendada diariamente (otcb_cron_recalculo).
create function public.otcb_recalcular_todos()
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
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

-- ===================================================================== fotos e carimbos

-- otcb_bar_mais_proximo (regra 11.4): bar para a foto do Colarinhômetro. Usada pela Edge Function
-- otcb-colarinhometro (8.6) com credencial de serviço.
-- Recebe: lat/lng do momento da foto. Devolve: (bar_id, distancia_metros) do bar não excluído e não
-- 'fechado' mais próximo a até 150 m; empate desfeito pelo maior pontuacao_brahma. Nenhuma linha se não houver.
create function public.otcb_bar_mais_proximo(p_latitude double precision, p_longitude double precision)
returns table (bar_id uuid, distancia_metros integer)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, round(public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8))::integer
    from public.otcb_bares b
   where b.excluido_em is null and b.status <> 'fechado'
     and b.latitude between p_latitude - 0.002 and p_latitude + 0.002
     and b.longitude between p_longitude - 0.002 and p_longitude + 0.002
     and public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8) <= 150
   order by public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8),
            b.pontuacao_brahma desc
   limit 1;
$$;

-- Trigger function otcb_processar_foto — trigger otcb_trg_foto_processa (7.5; regras 11.4, 11.5 e 11.12).
-- Recebe: a foto inserida (ou com excluido_em alterado). Devolve: nada (after).
-- No insert, se e_chopp, há bar e o usuário confirmou Brahma: cria a evidência foto_colarinhometro e o
-- carimbo, se o usuário ainda não tem carimbo no bar e criou menos de 2 hoje (dia de São Paulo).
-- Em todos os casos recalcula nota_colarinho_media e qtd_fotos_avaliadas do bar (fotos não excluídas, 11.5).
create function public.otcb_processar_foto()
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

  if new.bar_id is not null then
    update public.otcb_bares b
       set nota_colarinho_media = a.media, qtd_fotos_avaliadas = a.qtd
      from (select round(avg(f.nota_colarinho), 2) as media, count(f.nota_colarinho)::integer as qtd
              from public.otcb_fotos f
             where f.bar_id = new.bar_id and f.excluido_em is null) a
     where b.id = new.bar_id;
  end if;
  return null;
end;
$$;

create trigger otcb_trg_foto_processa
  after insert or update of excluido_em on public.otcb_fotos
  for each row execute function public.otcb_processar_foto();

-- ===================================================================== opiniões e denúncias

-- Trigger function otcb_agregar_opinioes — trigger otcb_trg_opiniao_agrega (7.5; regras 11.7 e 11.8).
-- Recebe: a opinião inserida, alterada ou apagada. Devolve: nada (after).
-- Recalcula nota_opinioes_media (publicadas com nota) e qtd_opinioes (publicadas); abaixo de 3 publicadas
-- o resumo volta a nulo (11.8).
create function public.otcb_agregar_opinioes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bar uuid := coalesce(new.bar_id, old.bar_id);
begin
  update public.otcb_bares b
     set nota_opinioes_media = a.media,
         qtd_opinioes = a.qtd,
         resumo_opinioes = case when a.qtd < 3 then null else b.resumo_opinioes end,
         resumo_atualizado_em = case when a.qtd < 3 then null else b.resumo_atualizado_em end
    from (select round(avg(o.nota) filter (where o.nota is not null), 2) as media, count(*)::integer as qtd
            from public.otcb_opinioes o
           where o.bar_id = v_bar and o.status = 'publicada') a
   where b.id = v_bar;
  return null;
end;
$$;

create trigger otcb_trg_opiniao_agrega
  after insert or update or delete on public.otcb_opinioes
  for each row execute function public.otcb_agregar_opinioes();

-- Trigger function otcb_contar_denuncia — trigger otcb_trg_denuncia_conta (7.5; regra 11.7).
-- Recebe: a denúncia inserida. Devolve: nada (after). Incrementa qtd_denuncias e, ao chegar a 3
-- (usuários distintos, garantido pelo unique), oculta a opinião publicada como 'oculta_denuncias'.
create function public.otcb_contar_denuncia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.otcb_opinioes o
     set qtd_denuncias = o.qtd_denuncias + 1,
         status = case when o.qtd_denuncias + 1 >= 3 and o.status = 'publicada' then 'oculta_denuncias' else o.status end,
         motivo_ocultacao = case when o.qtd_denuncias + 1 >= 3 and o.status = 'publicada' then 'denuncias' else o.motivo_ocultacao end
   where o.id = new.opiniao_id;
  return null;
end;
$$;

create trigger otcb_trg_denuncia_conta
  after insert on public.otcb_denuncias
  for each row execute function public.otcb_contar_denuncia();

-- ===================================================================== RPCs do app (13.4)

-- otcb_inserir_confirmacao (interna): grava a confirmação do usuário com os limites da 11.6.
-- Recebe: usuário, bar, assunto e sinal (já validados). Devolve: nada. Erro 'limite_confirmacao' se o
-- usuário já confirmou esse bar e assunto hoje (dia de São Paulo, 11.12).
create function public.otcb_inserir_confirmacao(p_usuario uuid, p_bar_id uuid,
                                                p_assunto public.otcb_assunto_evidencia,
                                                p_sinal public.otcb_sinal_evidencia)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.otcb_evidencias e
              where e.usuario_id = p_usuario and e.bar_id = p_bar_id and e.assunto = p_assunto
                and e.tipo = 'confirmacao_usuario' and public.otcb_dia_sp(e.data_evidencia) = public.otcb_hoje_sp()) then
    raise exception 'limite_confirmacao' using errcode = 'P0001';
  end if;
  insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
  values (p_bar_id, p_assunto, p_sinal, 'confirmacao_usuario', 'usuario', p_usuario, now(), 0, 1);
end;
$$;

-- otcb_usuario_atual (interna): garante que quem chama é um usuário com perfil (épico 8.1).
-- Recebe: nada. Devolve: auth.uid(). Erro 'nao_autenticado' sem sessão ou sem perfil.
create function public.otcb_usuario_atual()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.otcb_perfis p where p.id = v_uid) then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- otcb_confirmar_bar (7.5 e 13.4; regras 11.1 e 11.6): confirmação em um toque, em nome do usuário atual.
-- Recebe: bar, assunto e sinal. Devolve: { ok: true }.
-- Erros: bar_inexistente (não existe ou excluído), sinal_invalido (tem_brahma/transmite_jogos aceitam
-- positivo ou negativo; funcionamento aceita só fechado), limite_confirmacao (1 por bar e assunto por dia).
create function public.otcb_confirmar_bar(p_bar_id uuid,
                                          p_assunto public.otcb_assunto_evidencia,
                                          p_sinal public.otcb_sinal_evidencia)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.otcb_usuario_atual();
begin
  if not exists (select 1 from public.otcb_bares b where b.id = p_bar_id and b.excluido_em is null) then
    raise exception 'bar_inexistente' using errcode = 'P0001';
  end if;
  if (p_assunto = 'funcionamento' and p_sinal <> 'fechado')
     or (p_assunto <> 'funcionamento' and p_sinal = 'fechado') then
    raise exception 'sinal_invalido' using errcode = 'P0001';
  end if;
  perform public.otcb_inserir_confirmacao(v_uid, p_bar_id, p_assunto, p_sinal);
  return jsonb_build_object('ok', true);
end;
$$;

-- otcb_sugerir_bar (7.5 e 13.4; regras 11.6 e 11.16; copy 15.18): sugestão de bar pelo usuário atual.
-- Recebe: nome, endereço, bairro, lat/lng (obtidos pelo app) e se tem Brahma.
-- Devolve: { bar_id, criado }.
-- Casa com bar existente a até 80 m e nome parecido (trigramas ≥ 0,5 sobre otcb_normalizar): grava uma
-- confirmação tem_brahma (positiva ou negativa) nesse bar, sujeita ao limite de confirmação → criado=false.
-- Sem casamento: com p_tem_brahma = true cria o bar 'incerto' e a evidência sugestao_usuario → criado=true;
-- com p_tem_brahma = false não há o que cadastrar (dados_invalidos).
-- Erros: dados_invalidos, limite_sugestao (5 bares sugeridos por dia), limite_confirmacao.
create function public.otcb_sugerir_bar(p_nome text, p_endereco text, p_bairro text,
                                        p_latitude double precision, p_longitude double precision,
                                        p_tem_brahma boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.otcb_usuario_atual();
  v_nome text := trim(coalesce(p_nome, ''));
  v_endereco text := trim(coalesce(p_endereco, ''));
  v_bairro text := trim(coalesce(p_bairro, ''));
  v_bar uuid;
begin
  if v_nome = '' or v_endereco = '' or v_bairro = '' or char_length(v_nome) > 120
     or char_length(v_endereco) > 200 or char_length(v_bairro) > 80 or p_tem_brahma is null
     or p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'dados_invalidos' using errcode = 'P0001';
  end if;

  -- Regra 11.16 (2): mesmo bar se a até 80 m e com nome parecido.
  select b.id into v_bar
    from public.otcb_bares b
   where b.excluido_em is null
     and b.latitude between p_latitude - 0.001 and p_latitude + 0.001
     and b.longitude between p_longitude - 0.001 and p_longitude + 0.001
     and public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8) <= 80
     and extensions.similarity(public.otcb_normalizar(b.nome), public.otcb_normalizar(v_nome)) >= 0.5
   order by public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8)
   limit 1;

  if v_bar is not null then
    perform public.otcb_inserir_confirmacao(v_uid, v_bar, 'tem_brahma',
                                            case when p_tem_brahma then 'positivo' else 'negativo' end::public.otcb_sinal_evidencia);
    return jsonb_build_object('bar_id', v_bar, 'criado', false);
  end if;

  if not p_tem_brahma then
    raise exception 'dados_invalidos' using errcode = 'P0001';
  end if;

  if (select count(*) from public.otcb_evidencias e
       where e.usuario_id = v_uid and e.tipo = 'sugestao_usuario'
         and public.otcb_dia_sp(e.data_evidencia) = public.otcb_hoje_sp()) >= 5 then
    raise exception 'limite_sugestao' using errcode = 'P0001';
  end if;

  insert into public.otcb_bares (nome, endereco, bairro, latitude, longitude)
  values (v_nome, v_endereco, v_bairro, round(p_latitude::numeric, 6), round(p_longitude::numeric, 6))
  returning id into v_bar;

  insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
  values (v_bar, 'tem_brahma', 'positivo', 'sugestao_usuario', 'usuario', v_uid, now(), 0, 1);

  return jsonb_build_object('bar_id', v_bar, 'criado', true);
end;
$$;

-- otcb_agregados_confirmacao (seções 5.2 e 13.2): agregados públicos das confirmações de um bar, sem
-- expor quem confirmou (evidências cruas são só do admin, 6.1).
-- Recebe: bar. Devolve: ultima_confirmacao_em (foto ou confirmação positiva de tem_brahma mais recente)
-- e confirmacoes_60_dias (pessoas distintas nos últimos 60 dias).
create function public.otcb_agregados_confirmacao(p_bar_id uuid)
returns table (ultima_confirmacao_em timestamptz, confirmacoes_60_dias integer)
language sql
stable
security definer
set search_path = ''
as $$
  select max(e.data_evidencia),
         count(distinct e.usuario_id) filter (where e.data_evidencia >= now() - interval '60 days')::integer
    from public.otcb_evidencias e
    join public.otcb_bares b on b.id = e.bar_id and b.excluido_em is null
   where e.bar_id = p_bar_id and e.assunto = 'tem_brahma' and e.sinal = 'positivo'
     and e.tipo in ('foto_colarinhometro', 'confirmacao_usuario');
$$;

-- otcb_buscar_bares (7.5 e 13.3; regra 11.9): busca do agente, com o JWT do usuário (invoker).
-- Recebe: localização opcional, raio, texto (nome ou bairro), bairro e filtros.
-- Devolve: até 8 linhas no formato CardBar (13.2), ordenadas por status e depois distância.
-- Visibilidade: não excluído, status confirmado/provavel/incerto e pontuação ≥ 0,1. Raio padrão 2 km,
-- máximo 10 km (só com localização). Sem localização exige texto ou bairro (erro localizacao_ou_bairro_obrigatorio).
create function public.otcb_buscar_bares(p_latitude double precision default null,
                                         p_longitude double precision default null,
                                         p_raio_metros integer default null,
                                         p_texto text default null,
                                         p_bairro text default null,
                                         p_tem_balcao boolean default null,
                                         p_transmite_jogos boolean default null,
                                         p_classico boolean default null)
returns table (bar_id uuid, nome text, bairro text, endereco text, latitude numeric, longitude numeric,
               distancia_metros integer, status public.otcb_status_bar, tem_balcao boolean,
               transmite_jogos boolean, classico boolean, nota_colarinho_media numeric,
               nota_opinioes_media numeric, qtd_opinioes integer, ultima_confirmacao_em timestamptz,
               confirmacoes_60_dias integer, resumo_opinioes text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tem_local boolean := p_latitude is not null and p_longitude is not null;
  v_raio integer := least(greatest(coalesce(p_raio_metros, 2000), 1), 10000);
  v_texto text := nullif(public.otcb_normalizar(p_texto), '');
  v_bairro text := nullif(public.otcb_normalizar(p_bairro), '');
begin
  if not v_tem_local and v_texto is null and v_bairro is null then
    raise exception 'localizacao_ou_bairro_obrigatorio' using errcode = 'P0001';
  end if;

  return query
  with candidatos as (
    select b.*,
           case when v_tem_local
                then round(public.otcb_distancia_metros(p_latitude, p_longitude, b.latitude::float8, b.longitude::float8))::integer
           end as dist
      from public.otcb_bares b
     where b.excluido_em is null
       and b.status in ('confirmado', 'provavel', 'incerto')
       and b.pontuacao_brahma >= 0.1
       and (v_texto is null or public.otcb_normalizar(b.nome) like '%' || v_texto || '%'
                            or public.otcb_normalizar(b.bairro) like '%' || v_texto || '%')
       and (v_bairro is null or public.otcb_normalizar(b.bairro) like '%' || v_bairro || '%')
       and (p_tem_balcao is null or b.tem_balcao = p_tem_balcao)
       and (p_transmite_jogos is null or b.transmite_jogos = p_transmite_jogos)
       and (p_classico is null or b.classico = p_classico)
  )
  select c.id, c.nome, c.bairro, c.endereco, c.latitude, c.longitude, c.dist, c.status, c.tem_balcao,
         c.transmite_jogos, c.classico, c.nota_colarinho_media, c.nota_opinioes_media, c.qtd_opinioes,
         a.ultima_confirmacao_em, coalesce(a.confirmacoes_60_dias, 0), c.resumo_opinioes
    from candidatos c
    left join lateral public.otcb_agregados_confirmacao(c.id) a on true
   where not v_tem_local or c.dist <= v_raio
   order by case c.status when 'confirmado' then 1 when 'provavel' then 2 else 3 end,
            c.dist nulls last, c.pontuacao_brahma desc, c.nome
   limit 8;
end;
$$;

-- otcb_detalhes_bar (7.5 e 13.4): card do bar com agregados, sem expor quem confirmou.
-- Recebe: bar. Devolve: CardBar (13.2) em jsonb, com distancia_metros nulo (sem localização na assinatura).
-- O status vem como está no banco (o agente só mostra os visíveis da 11.9). Erro bar_inexistente.
create function public.otcb_detalhes_bar(p_bar_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform public.otcb_usuario_atual();
  select jsonb_build_object(
           'bar_id', b.id, 'nome', b.nome, 'bairro', b.bairro, 'endereco', b.endereco,
           'latitude', b.latitude, 'longitude', b.longitude, 'distancia_metros', null,
           'status', b.status, 'tem_balcao', b.tem_balcao, 'transmite_jogos', b.transmite_jogos,
           'classico', b.classico, 'nota_colarinho_media', b.nota_colarinho_media,
           'nota_opinioes_media', b.nota_opinioes_media, 'qtd_opinioes', b.qtd_opinioes,
           'ultima_confirmacao_em', a.ultima_confirmacao_em,
           'confirmacoes_60_dias', coalesce(a.confirmacoes_60_dias, 0),
           'resumo_opinioes', b.resumo_opinioes)
    into v
    from public.otcb_bares b
    left join lateral public.otcb_agregados_confirmacao(b.id) a on true
   where b.id = p_bar_id and b.excluido_em is null;
  if v is null then
    raise exception 'bar_inexistente' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

-- otcb_meu_passaporte (7.5 e 13.4; regra 11.11; princípio 3): Passaporte do usuário atual.
-- Security definer (diverge da 7.5, que diz invoker) porque o selo "Informante" lê as próprias evidências,
-- que o RLS reserva ao admin; tudo é filtrado por auth.uid().
-- Recebe: nada. Devolve: { carimbos[], colecoes_bairro[], colecao_classicos, selos[] }.
-- Nenhum selo conta quantidade de chopp, fotos no mesmo bar ou noites seguidas.
create function public.otcb_meu_passaporte()
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

  -- Coleção do bairro: bairros com bares ativos confirmado/provavel; conquista com min(3, total) carimbos.
  select coalesce(jsonb_agg(jsonb_build_object('bairro', t.bairro, 'carimbos', t.carimbos, 'total_bares', t.total,
                                               'conquistado', t.carimbos >= least(3, t.total))
                            order by t.bairro), '[]'::jsonb)
    into v_bairros
    from (select b.bairro,
                 count(*)::integer as total,
                 count(c.id)::integer as carimbos
            from public.otcb_bares b
            left join public.otcb_carimbos c on c.bar_id = b.id and c.usuario_id = v_uid
           where b.excluido_em is null and b.status in ('confirmado', 'provavel')
           group by b.bairro) t;

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

-- ===================================================================== limpeza e agendamentos

-- otcb_limpeza_diaria (7.5; regra 11.14): apaga mensagens com mais de 30 dias e jogos com início há
-- mais de 2 dias. Recebe: nada. Devolve: { mensagens, jogos } apagados. Agendada (otcb_cron_limpeza).
create function public.otcb_limpeza_diaria()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msgs integer;
  v_jogos integer;
begin
  delete from public.otcb_mensagens where criado_em < now() - interval '30 days';
  get diagnostics v_msgs = row_count;
  delete from public.otcb_jogos where inicio < now() - interval '2 days';
  get diagnostics v_jogos = row_count;
  return jsonb_build_object('mensagens', v_msgs, 'jogos', v_jogos);
end;
$$;

-- ===================================================================== permissões de execução
-- Internas: só serviço (e as próprias funções security definer, que rodam como dono).
revoke execute on function public.otcb_regra_evidencia(public.otcb_tipo_evidencia, public.otcb_assunto_evidencia, public.otcb_sinal_evidencia) from public, anon, authenticated;
revoke execute on function public.otcb_recalcular_bar(uuid) from public, anon, authenticated;
revoke execute on function public.otcb_recalcular_todos() from public, anon, authenticated;
revoke execute on function public.otcb_bar_mais_proximo(double precision, double precision) from public, anon, authenticated;
revoke execute on function public.otcb_inserir_confirmacao(uuid, uuid, public.otcb_assunto_evidencia, public.otcb_sinal_evidencia) from public, anon, authenticated;
revoke execute on function public.otcb_limpeza_diaria() from public, anon, authenticated;
revoke execute on function public.otcb_definir_peso_evidencia() from public, anon, authenticated;
revoke execute on function public.otcb_recalcular_bar_da_evidencia() from public, anon, authenticated;
revoke execute on function public.otcb_processar_foto() from public, anon, authenticated;
revoke execute on function public.otcb_agregar_opinioes() from public, anon, authenticated;
revoke execute on function public.otcb_contar_denuncia() from public, anon, authenticated;
grant execute on function public.otcb_regra_evidencia(public.otcb_tipo_evidencia, public.otcb_assunto_evidencia, public.otcb_sinal_evidencia) to service_role;
grant execute on function public.otcb_recalcular_bar(uuid) to service_role;
grant execute on function public.otcb_recalcular_todos() to service_role;
grant execute on function public.otcb_bar_mais_proximo(double precision, double precision) to service_role;
grant execute on function public.otcb_limpeza_diaria() to service_role;

-- Utilitárias e RPCs do app (13.4): authenticated (o usuário anônimo); nunca anon.
revoke execute on function public.otcb_distancia_metros(double precision, double precision, double precision, double precision) from public, anon;
revoke execute on function public.otcb_hoje_sp() from public, anon;
revoke execute on function public.otcb_dia_sp(timestamptz) from public, anon;
revoke execute on function public.otcb_usuario_atual() from public, anon;
revoke execute on function public.otcb_confirmar_bar(uuid, public.otcb_assunto_evidencia, public.otcb_sinal_evidencia) from public, anon;
revoke execute on function public.otcb_sugerir_bar(text, text, text, double precision, double precision, boolean) from public, anon;
revoke execute on function public.otcb_agregados_confirmacao(uuid) from public, anon;
revoke execute on function public.otcb_buscar_bares(double precision, double precision, integer, text, text, boolean, boolean, boolean) from public, anon;
revoke execute on function public.otcb_detalhes_bar(uuid) from public, anon;
revoke execute on function public.otcb_meu_passaporte() from public, anon;
grant execute on function public.otcb_distancia_metros(double precision, double precision, double precision, double precision) to authenticated, service_role;
grant execute on function public.otcb_hoje_sp() to authenticated, service_role;
grant execute on function public.otcb_dia_sp(timestamptz) to authenticated, service_role;
grant execute on function public.otcb_usuario_atual() to authenticated, service_role;
grant execute on function public.otcb_confirmar_bar(uuid, public.otcb_assunto_evidencia, public.otcb_sinal_evidencia) to authenticated;
grant execute on function public.otcb_sugerir_bar(text, text, text, double precision, double precision, boolean) to authenticated;
grant execute on function public.otcb_agregados_confirmacao(uuid) to authenticated, service_role;
grant execute on function public.otcb_buscar_bares(double precision, double precision, integer, text, text, boolean, boolean, boolean) to authenticated, service_role;
grant execute on function public.otcb_detalhes_bar(uuid) to authenticated;
grant execute on function public.otcb_meu_passaporte() to authenticated;

-- Jobs do pg_cron (7.5; assunção 24.12). pg_cron roda em UTC; São Paulo é UTC−3 sem horário de verão.
-- Os jobs que chamam Edge Functions (revisita, coordenadas, resumos, jogos, descoberta) entram no 8.3.
select cron.schedule('otcb_cron_recalculo', '0 6 * * *', 'select public.otcb_recalcular_todos()');
select cron.schedule('otcb_cron_limpeza', '30 6 * * *', 'select public.otcb_limpeza_diaria()');
