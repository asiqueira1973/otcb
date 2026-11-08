-- Épico 8.4 — apoio no banco ao chat com agente (seções 6.1, 11.6, 11.13, 11.18, 13.1, 13.3 e 20).

-- ===================================================================== marca de revisão (11.18)

-- Coluna nova (divergência registrada no plano 8.4): a 11.18 manda sinalizar para revisão do admin a conta
-- que declarar idade abaixo de 18 no chat, e a 7.2 não tem onde guardar a marca. Só o serviço grava;
-- o cliente não lê (grant de coluna abaixo); o admin consulta pelo Studio (5.1).
alter table public.otcb_perfis add column revisao_menor_em timestamptz;
comment on column public.otcb_perfis.revisao_menor_em is
  'Instante em que o guardrail 11.18 detectou menção a idade abaixo de 18 no chat (revisão do admin).';

-- O cliente passa a ler otcb_perfis por coluna, sem revisao_menor_em.
revoke select on public.otcb_perfis from authenticated;
grant select (id, apelido, papel, maioridade_confirmada_em, time_do_coracao, criado_em, atualizado_em)
  on public.otcb_perfis to authenticated;

-- otcb_marcar_revisao_menor (regra 11.18): sinaliza a conta para revisão. Recebe: usuário. Devolve: nada.
create function public.otcb_marcar_revisao_menor(p_usuario uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.otcb_perfis set revisao_menor_em = coalesce(revisao_menor_em, now()) where id = p_usuario;
$$;

-- ===================================================================== opiniões com apelido (seção 20)

-- otcb_opinioes_do_bar (13.3, ferramenta opinioes_do_bar; seção 20: apelido público nas opiniões).
-- Recebe: bar e página (10 por página). Devolve: opiniões publicadas com apelido, nota, texto e data —
-- sem o id do autor. Security definer porque o RLS de perfis só deixa ver o próprio apelido.
create function public.otcb_opinioes_do_bar(p_bar_id uuid, p_pagina integer default 0)
returns table (opiniao_id uuid, apelido text, nota smallint, texto text, criado_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, p.apelido, o.nota, o.texto, o.criado_em
    from public.otcb_opinioes o
    join public.otcb_perfis p on p.id = o.usuario_id
    join public.otcb_bares b on b.id = o.bar_id and b.excluido_em is null
   where o.bar_id = p_bar_id and o.status = 'publicada'
   order by o.criado_em desc
   limit 10 offset greatest(coalesce(p_pagina, 0), 0) * 10;
$$;

-- ===================================================================== limite e contexto (11.6, 11.13)

-- otcb_mensagens_hoje (regra 11.6; 11.12): mensagens do usuário ao agente no dia de São Paulo.
-- Recebe: usuário. Devolve: quantidade.
create function public.otcb_mensagens_hoje(p_usuario uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.otcb_mensagens
   where usuario_id = p_usuario and papel = 'usuario' and public.otcb_dia_sp(criado_em) = public.otcb_hoje_sp();
$$;

-- otcb_contexto_chat (regra 11.13): as últimas 20 mensagens do usuário (inclusive 'sistema') das últimas
-- 6 horas, em ordem cronológica. Recebe: usuário. Devolve: papel, conteúdo e data.
create function public.otcb_contexto_chat(p_usuario uuid)
returns table (papel public.otcb_papel_mensagem, conteudo text, criado_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.papel, m.conteudo, m.criado_em
    from (select papel, conteudo, criado_em
            from public.otcb_mensagens
           where usuario_id = p_usuario and criado_em >= now() - interval '6 hours'
           order by criado_em desc
           limit 20) m
   order by m.criado_em;
$$;

-- ===================================================================== permissões

revoke execute on function public.otcb_marcar_revisao_menor(uuid) from public, anon, authenticated;
revoke execute on function public.otcb_mensagens_hoje(uuid) from public, anon, authenticated;
revoke execute on function public.otcb_contexto_chat(uuid) from public, anon, authenticated;
revoke execute on function public.otcb_opinioes_do_bar(uuid, integer) from public, anon;
grant execute on function public.otcb_marcar_revisao_menor(uuid) to service_role;
grant execute on function public.otcb_mensagens_hoje(uuid) to service_role;
grant execute on function public.otcb_contexto_chat(uuid) to service_role;
grant execute on function public.otcb_opinioes_do_bar(uuid, integer) to authenticated, service_role;
