-- Emenda do 8.11 (pedido do Alexandre, 08/11/2026): aviso no chat do jogo do time do coração. Uma rotina diária,
-- depois da carga de jogos, grava uma mensagem do assistente com o card de jogos para quem tem jogo do time
-- hoje ou amanhã. O app já relê o histórico ao abrir o chat, então não muda nada no app.

-- otcb_time_canonico: normaliza o nome de um time para comparar o texto livre do perfil com o nome da API
-- (sem acento, minúsculo, hífen vira espaço, sem sufixo fc/ec/sc) e troca apelidos comuns pelo nome da API.
-- Recebe: texto. Devolve: nome canônico (ou null para texto vazio).
create function public.otcb_time_canonico(p_nome text)
returns text
language sql
immutable
set search_path = ''
as $$
  with n as (
    select trim(regexp_replace(regexp_replace(
             translate(lower(coalesce(p_nome, '')), 'áàãâäéèêëíìîïóòõôöúùûüç-', 'aaaaaeeeeiiiiooooouuuuc '),
             '\s+(fc|ec|sc)$', ''), '\s+', ' ', 'g')) as v
  )
  select case
    when v = '' then null
    when v in ('vasco', 'vascao', 'gigante da colina') then 'vasco da gama'
    when v in ('timao', 'coringao', 'corinthians paulista') then 'corinthians'
    when v in ('verdao', 'porco', 'palestra') then 'palmeiras'
    when v in ('spfc', 'tricolor paulista', 'soberano', 'sao paulo futebol clube') then 'sao paulo'
    when v = 'peixe' then 'santos'
    when v in ('mengao', 'mengo', 'fla') then 'flamengo'
    when v in ('flu', 'fluzao', 'tricolor carioca') then 'fluminense'
    when v in ('fogao', 'glorioso') then 'botafogo'
    when v in ('galo', 'atletico mineiro', 'atletico mg') then 'atletico mg'
    when v = 'raposa' then 'cruzeiro'
    when v in ('colorado', 'inter') then 'internacional'
    when v in ('tricolor gaucho', 'imortal') then 'gremio'
    when v in ('furacao', 'athletico', 'athletico paranaense', 'athletico pr') then 'atletico paranaense'
    when v in ('bragantino', 'red bull bragantino', 'massa bruta') then 'rb bragantino'
    when v = 'esquadrao' then 'bahia'
    when v = 'sport' then 'sport recife'
    when v = 'coxa' then 'coritiba'
    when v = 'chape' then 'chapecoense'
    when v = 'ponte' then 'ponte preta'
    when v = 'guarani' then 'guarani campinas'
    else v end
  from n;
$$;

-- otcb_avisar_jogos_do_time: para cada perfil com time do coração, procura jogo do time que ainda não começou,
-- hoje ou amanhã (dia de São Paulo), e grava uma mensagem do assistente com o card de jogos. Não repete o aviso
-- do mesmo jogo para a mesma pessoa. Recebe: nada. Devolve: quantos avisos gravou.
create function public.otcb_avisar_jogos_do_time()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := public.otcb_hoje_sp();
  v_total integer := 0;
  r record;
begin
  for r in
    select p.id as usuario_id, j.id as jogo_id, j.competicao, j.mandante, j.visitante, j.inicio,
           case when public.otcb_time_canonico(j.mandante) = public.otcb_time_canonico(p.time_do_coracao)
                then j.mandante else j.visitante end as time,
           public.otcb_dia_sp(j.inicio) = v_hoje as e_hoje
      from public.otcb_perfis p
      join public.otcb_jogos j
        on public.otcb_time_canonico(p.time_do_coracao) in (public.otcb_time_canonico(j.mandante), public.otcb_time_canonico(j.visitante))
     where p.time_do_coracao is not null
       and j.inicio > now()
       and public.otcb_dia_sp(j.inicio) in (v_hoje, v_hoje + 1)
       and not exists (
         select 1 from public.otcb_mensagens m
          where m.usuario_id = p.id and m.papel = 'assistente'
            and m.blocos @> jsonb_build_array(jsonb_build_object('tipo', 'jogos',
                  'jogos', jsonb_build_array(jsonb_build_object('jogo_id', j.id::text)))))
     order by j.inicio
  loop
    insert into public.otcb_mensagens (usuario_id, papel, conteudo, blocos)
    values (r.usuario_id, 'assistente',
            (case when r.e_hoje then 'Hoje tem ' else 'Amanhã tem ' end) || r.time || '! '
              || r.mandante || ' × ' || r.visitante || ', ' || r.competicao || ', às '
              || to_char(r.inicio at time zone 'America/Sao_Paulo', 'HH24"h"MI') || '. '
              || 'Quer que eu ache um bar com chopp Brahma que passe o jogo?',
            jsonb_build_array(jsonb_build_object('tipo', 'jogos', 'jogos', jsonb_build_array(jsonb_build_object(
              'jogo_id', r.jogo_id::text, 'competicao', r.competicao, 'mandante', r.mandante,
              'visitante', r.visitante, 'inicio', r.inicio)))));
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

revoke execute on function public.otcb_time_canonico(text) from public, anon, authenticated;
revoke execute on function public.otcb_avisar_jogos_do_time() from public, anon, authenticated;
grant execute on function public.otcb_time_canonico(text) to service_role;
grant execute on function public.otcb_avisar_jogos_do_time() to service_role;

-- Job do pg_cron: 08:45 UTC (05:45 em São Paulo), 15 minutos depois da carga de jogos.
select cron.schedule('otcb_cron_avisos_jogos', '45 8 * * *', $$select public.otcb_avisar_jogos_do_time()$$);
