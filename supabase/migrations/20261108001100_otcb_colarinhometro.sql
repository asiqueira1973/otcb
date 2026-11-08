-- Épico 8.6 — apoio no banco ao Colarinhômetro (seções 11.4, 11.6, 11.12, 11.13 e 13.5). A foto, a evidência
-- e o carimbo já são tratados por otcb_fotos + otcb_trg_foto_processa (8.2); aqui só o que a Edge Function
-- otcb-colarinhometro precisa antes e depois do insert.

-- otcb_fotos_hoje (regra 11.6): fotos enviadas pela pessoa ao Colarinhômetro no dia de São Paulo (inclusive
-- as que não eram chopp). Recebe: usuário. Devolve: quantidade. Limite de 10 aplicado na Edge Function.
create function public.otcb_fotos_hoje(p_usuario uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.otcb_fotos
   where usuario_id = p_usuario and public.otcb_dia_sp(criado_em) = public.otcb_hoje_sp();
$$;

-- otcb_resultado_foto (regras 11.4 e 11.12; bloco resultado_colarinho da 13.2): lê o que o trigger fez com a
-- foto recém-inserida e grava a mensagem 'sistema' para o agente (11.13).
-- Recebe: foto. Devolve: { carimbo_novo, motivo_sem_carimbo, nome_bar, total_carimbos }.
-- motivo_sem_carimbo: null (saiu carimbo), 'nao_e_chopp', 'sem_bar', 'nao_confirmou', 'ja_tinha' (já havia
-- carimbo nesse bar) ou 'limite_dia' (2 carimbos novos no dia, 11.12).
create function public.otcb_resultado_foto(p_foto_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_foto public.otcb_fotos%rowtype;
  v_nome text;
  v_carimbo boolean;
  v_motivo text;
  v_total integer;
begin
  select * into v_foto from public.otcb_fotos where id = p_foto_id;
  if not found then
    raise exception 'foto_inexistente' using errcode = 'P0001';
  end if;
  select nome into v_nome from public.otcb_bares where id = v_foto.bar_id;
  v_carimbo := exists (select 1 from public.otcb_carimbos where foto_id = p_foto_id);
  v_motivo := case
    when v_carimbo then null
    when not v_foto.e_chopp then 'nao_e_chopp'
    when v_foto.bar_id is null then 'sem_bar'
    when not v_foto.usuario_confirmou_brahma then 'nao_confirmou'
    when exists (select 1 from public.otcb_carimbos where usuario_id = v_foto.usuario_id and bar_id = v_foto.bar_id) then 'ja_tinha'
    else 'limite_dia' end;
  select count(*)::integer into v_total from public.otcb_carimbos where usuario_id = v_foto.usuario_id;

  if v_foto.e_chopp then
    insert into public.otcb_mensagens (usuario_id, papel, conteudo)
    values (v_foto.usuario_id, 'sistema',
            'A pessoa avaliou um chopp no Colarinhômetro: nota ' || coalesce(v_foto.nota_colarinho::text, '?')
            || coalesce(' no bar ' || v_nome, ', sem bar identificado por perto')
            || case when v_carimbo then ', e ganhou carimbo novo.' else '.' end);
  end if;

  return jsonb_build_object('carimbo_novo', v_carimbo, 'motivo_sem_carimbo', v_motivo,
                            'nome_bar', v_nome, 'total_carimbos', v_total);
end;
$$;

revoke execute on function public.otcb_fotos_hoje(uuid) from public, anon, authenticated;
revoke execute on function public.otcb_resultado_foto(uuid) from public, anon, authenticated;
grant execute on function public.otcb_fotos_hoje(uuid) to service_role;
grant execute on function public.otcb_resultado_foto(uuid) to service_role;
