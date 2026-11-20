-- Pedido do Alexandre (19/11/2026, "deixar o jogo mais fácil"): quem tira a foto num bar que ainda não está no app
-- (sai sem carimbo) e logo depois cadastra ou confirma o bar pela sugestão ganha o carimbo: a foto dela dos últimos
-- 30 minutos, sem bar, de chopp e com "é Brahma", passa a ser do bar. O processamento de foto passa a tratar também
-- a foto que ganha bar depois. Corpos iguais aos anteriores mais essas mudanças; grants preservados.

-- otcb_ligar_foto_recente: liga a foto mais recente da pessoa, sem bar, dos últimos 30 minutos, ao bar.
-- Recebe: usuário e bar. Devolve: nada. O trigger otcb_trg_foto_processa gera evidência e carimbo.
create function public.otcb_ligar_foto_recente(p_usuario uuid, p_bar uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.otcb_fotos f set bar_id = p_bar
   where f.id = (select x.id from public.otcb_fotos x
                  where x.usuario_id = p_usuario and x.bar_id is null and x.excluido_em is null
                    and x.e_chopp and x.usuario_confirmou_brahma and x.criado_em > now() - interval '30 minutes'
                  order by x.criado_em desc limit 1);
$$;
revoke execute on function public.otcb_ligar_foto_recente(uuid, uuid) from public, anon, authenticated;
grant execute on function public.otcb_ligar_foto_recente(uuid, uuid) to service_role;

-- otcb_processar_foto (regras 11.4 e 11.5; trigger otcb_trg_foto_processa): evidência e carimbo da foto com bar,
-- inclusive quando o bar chega depois; recalcula a média de fotos do bar.
create or replace function public.otcb_processar_foto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.bar_id is null and new.bar_id is not null))
     and new.e_chopp and new.bar_id is not null and new.usuario_confirmou_brahma then
    -- Foto ligada depois (bar sugerido em seguida): a evidência vale a partir de agora (clock_timestamp), para ser
    -- o voto mais recente da pessoa no bar, acima da sugestão gravada na mesma transação.
    insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, foto_id, data_evidencia, peso, meia_vida_dias)
    values (new.bar_id, 'tem_brahma', 'positivo', 'foto_colarinhometro', 'usuario', new.usuario_id, new.id,
            case when tg_op = 'INSERT' then new.criado_em else clock_timestamp() end, 0, 1);

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

drop trigger if exists otcb_trg_foto_processa on public.otcb_fotos;
create trigger otcb_trg_foto_processa
  after insert or delete or update of excluido_em, bar_id on public.otcb_fotos
  for each row execute function public.otcb_processar_foto();

-- otcb_sugerir_bar (13.4; regra 11.16): sugestão de bar; agora também liga a foto recente sem bar.
create or replace function public.otcb_sugerir_bar(p_nome text, p_endereco text, p_bairro text,
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

  v_bar := public.otcb_casar_bar(v_nome, p_latitude, p_longitude);

  if v_bar is not null then
    perform public.otcb_inserir_confirmacao(v_uid, v_bar, 'tem_brahma',
                                            case when p_tem_brahma then 'positivo' else 'negativo' end::public.otcb_sinal_evidencia);
    if p_tem_brahma then perform public.otcb_ligar_foto_recente(v_uid, v_bar); end if;
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

  perform public.otcb_ligar_foto_recente(v_uid, v_bar);
  return jsonb_build_object('bar_id', v_bar, 'criado', true);
end;
$$;
