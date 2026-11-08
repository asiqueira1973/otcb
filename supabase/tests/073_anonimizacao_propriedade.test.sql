-- Teste de propriedade da anonimização (seção 7.4 × regras 11.1, 11.2, 11.3 e CardBar da 13.2):
-- em 300 cenários aleatórios (semente fixa), apagar a conta de uma pessoa não muda status, pontuação,
-- transmite_jogos, ultima_confirmacao_em nem confirmacoes_60_dias de nenhum bar.
begin;
select plan(3);

select setseed(0.4242);

create temporary table t73_diferencas (cenario int, campo text, antes text, depois text);
create temporary table t73_contagem (cenarios int, evidencias_alvo int);

do $$
declare
  i int;
  j int;
  v_bar uuid;
  v_alvo uuid;
  v_outro uuid;
  v_antes record;
  v_depois record;
  v_tipo int;
  v_total_alvo int := 0;
  v_dias numeric;
begin
  for i in 1..300 loop
    v_bar := gen_random_uuid();
    v_alvo := gen_random_uuid();
    v_outro := gen_random_uuid();
    insert into auth.users (id, aud, role, is_anonymous, instance_id) values
      (v_alvo, 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000'),
      (v_outro, 'authenticated', 'authenticated', true, '00000000-0000-0000-0000-000000000000');
    insert into public.otcb_perfis (id, apelido, maioridade_confirmada_em) values
      (v_alvo, 't73a_' || i, now()), (v_outro, 't73o_' || i, now());
    insert into public.otcb_bares (id, nome, endereco, bairro, latitude, longitude)
    values (v_bar, 'Bar 73-' || i, 'R', 'Teste73', -17.0 - i * 0.001, -47.0);

    -- Contexto aleatório: semente, cardápio, Google fechado e um outro usuário.
    if random() < 0.5 then
      insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, data_evidencia, peso, meia_vida_dias)
      values (v_bar, 'tem_brahma', 'positivo', 'seed_otcb_antigo', 'seed', now() - (random() * 200) * interval '1 day', 0, 1);
    end if;
    if random() < 0.4 then
      insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, url_fonte, data_evidencia, peso, meia_vida_dias)
      values (v_bar, 'tem_brahma', case when random() < 0.7 then 'positivo' else 'negativo' end::public.otcb_sinal_evidencia,
              'cardapio_site', 'garimpo', 'https://t73.test/' || i, now() - (random() * 100) * interval '1 day', 0, 1);
    end if;
    if random() < 0.35 then
      insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, data_evidencia, peso, meia_vida_dias)
      values (v_bar, 'funcionamento', 'fechado', 'status_google', 'garimpo', now() - (random() * 60) * interval '1 day', 0, 1);
    end if;
    if random() < 0.5 then
      insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
      values (v_bar, 'tem_brahma', case when random() < 0.6 then 'positivo' else 'negativo' end::public.otcb_sinal_evidencia,
              'confirmacao_usuario', 'usuario', v_outro, now() - (random() * 70) * interval '1 day', 0, 1);
    end if;
    if random() < 0.3 then
      insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
      values (v_bar, 'funcionamento', 'fechado', 'confirmacao_usuario', 'usuario', v_outro, now() - (random() * 40) * interval '1 day', 0, 1);
    end if;

    -- Evidências da pessoa que vai apagar a conta: 1 a 6, de tipos e idades aleatórios.
    for j in 1..(1 + floor(random() * 6))::int loop
      v_tipo := floor(random() * 7)::int;
      v_dias := random() * 80;
      insert into public.otcb_evidencias (bar_id, assunto, sinal, tipo, origem, usuario_id, data_evidencia, peso, meia_vida_dias)
      values (v_bar,
              case v_tipo when 4 then 'transmite_jogos' when 5 then 'transmite_jogos' when 6 then 'funcionamento' else 'tem_brahma' end::public.otcb_assunto_evidencia,
              case v_tipo when 0 then 'positivo' when 1 then 'positivo' when 2 then 'negativo' when 3 then 'positivo'
                          when 4 then 'positivo' when 5 then 'negativo' else 'fechado' end::public.otcb_sinal_evidencia,
              case v_tipo when 0 then 'foto_colarinhometro' when 3 then 'sugestao_usuario' else 'confirmacao_usuario' end::public.otcb_tipo_evidencia,
              'usuario', v_alvo, now() - v_dias * interval '1 day', 0, 1);
      v_total_alvo := v_total_alvo + 1;
    end loop;

    select b.status, b.pontuacao_brahma, b.transmite_jogos, a.ultima_confirmacao_em, a.confirmacoes_60_dias
      into v_antes
      from public.otcb_bares b, lateral public.otcb_agregados_confirmacao(b.id) a where b.id = v_bar;

    delete from auth.users where id = v_alvo;
    perform public.otcb_recalcular_bar(v_bar);

    select b.status, b.pontuacao_brahma, b.transmite_jogos, a.ultima_confirmacao_em, a.confirmacoes_60_dias
      into v_depois
      from public.otcb_bares b, lateral public.otcb_agregados_confirmacao(b.id) a where b.id = v_bar;

    if v_antes is distinct from v_depois then
      insert into t73_diferencas values (i, 'cardbar', v_antes::text, v_depois::text);
    end if;
  end loop;
  insert into t73_contagem values (300, v_total_alvo);
end;
$$;

select is((select count(*)::int from t73_diferencas), 0,
  '7.4: em 300 cenários aleatórios, apagar a conta não muda status, pontuação, transmite_jogos nem o CardBar');
select ok((select evidencias_alvo from t73_contagem) > 600, 'sanidade: os cenários têm evidências suficientes da pessoa');
select is((select count(*)::int from public.otcb_evidencias e join public.otcb_bares b on b.id = e.bar_id
            where b.bairro = 'Teste73' and e.usuario_id is not null
              and e.usuario_id not in (select id from public.otcb_perfis where apelido like 't73o_%')), 0,
  '7.4: nenhuma evidência fica ligada a quem apagou a conta');

select * from finish();
rollback;
