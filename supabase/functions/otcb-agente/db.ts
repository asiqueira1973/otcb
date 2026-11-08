import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import type { AgenteDb, Jogo } from "./tipos.ts";

// Implementação de AgenteDb (seções 6.1 e 13.3). `usuario` carrega o JWT de quem pergunta: as consultas de
// bares, ficha e Passaporte passam pelo RLS e pelas funções invoker como o próprio usuário (13.3).
// `admin` (service role) só faz o que o cliente não pode: contar o dia, ler o contexto, gravar mensagens
// (só o serviço insere, 6.1) e sinalizar a revisão de menor (11.18).
// Recebe: os dois clientes. Devolve: AgenteDb. Erros do banco sobem como Error com o código da função.
export function createAgenteDb(admin: SupabaseClient, usuario: SupabaseClient): AgenteDb {
  async function rpc<T>(cliente: SupabaseClient, nome: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await cliente.rpc(nome, args);
    if (error) throw new Error(`db_${nome}: ${error.code ?? ""} ${error.message}`);
    return data as T;
  }

  return {
    async usuarioDoToken(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error || !data.user ? null : data.user.id;
    },
    async perfil(usuarioId) {
      const { data, error } = await admin.from("otcb_perfis").select("apelido, time_do_coracao").eq("id", usuarioId).maybeSingle();
      if (error) throw new Error(`db_perfil: ${error.message}`);
      return data;
    },
    mensagensHoje: (usuarioId) => rpc<number>(admin, "otcb_mensagens_hoje", { p_usuario: usuarioId }),
    contexto: (usuarioId) => rpc(admin, "otcb_contexto_chat", { p_usuario: usuarioId }),
    async gravarMensagens(usuarioId, msgs) {
      // Instantes crescentes para a ordem do histórico ficar estável (a pergunta antes da resposta).
      const base = Date.now();
      const { data, error } = await admin.from("otcb_mensagens").insert(msgs.map((m, i) => ({
        usuario_id: usuarioId, papel: m.papel, conteudo: m.conteudo, blocos: m.blocos,
        criado_em: new Date(base + i).toISOString(),
      }))).select("id, criado_em");
      if (error) throw new Error(`db_mensagens: ${error.message}`);
      return [...(data ?? [])].sort((a, b) => a.criado_em.localeCompare(b.criado_em)).map((r) => r.id as string);
    },
    async marcarRevisaoMenor(usuarioId) {
      await rpc(admin, "otcb_marcar_revisao_menor", { p_usuario: usuarioId });
    },
    async buscarBares(p) {
      return (await rpc<Record<string, unknown>[]>(usuario, "otcb_buscar_bares", p)) ?? [];
    },
    detalhesBar: (barId) => rpc(usuario, "otcb_detalhes_bar", { p_bar_id: barId }),
    async opinioesDoBar(barId, pagina) {
      return (await rpc(usuario, "otcb_opinioes_do_bar", { p_bar_id: barId, p_pagina: pagina })) ?? [];
    },
    // jogos_de_hoje (13.3; seção 9 jogos): do início de hoje (SP) até o fim do dia hoje + dias; jogos do
    // time pedido primeiro (time do coração quando o modelo passa), depois por horário.
    // Com time, lê a janela inteira antes de filtrar (verifier do 8.9: o limite de 50 escondia o jogo do time
    // num dia cheio); a tabela só guarda 7 dias (13.9), então o teto de 2000 nunca corta na prática.
    async jogos(time, dias) {
      const hojeSp = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const inicio = new Date(`${hojeSp}T00:00:00-03:00`);
      const fim = new Date(inicio.getTime() + (dias + 1) * 86_400_000);
      const { data, error } = await usuario.from("otcb_jogos")
        .select("id, competicao, mandante, visitante, inicio")
        .gte("inicio", inicio.toISOString()).lt("inicio", fim.toISOString())
        .order("inicio").limit(time ? 2000 : 50);
      if (error) throw new Error(`db_jogos: ${error.message}`);
      const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const alvo = time ? norm(time) : null;
      const jogos: Jogo[] = (data ?? []).map((j) => ({ jogo_id: j.id, competicao: j.competicao, mandante: j.mandante, visitante: j.visitante, inicio: j.inicio }));
      if (!alvo) return jogos;
      const doTime = (j: Jogo) => norm(j.mandante).includes(alvo) || norm(j.visitante).includes(alvo);
      return [...jogos.filter(doTime), ...jogos.filter((j) => !doTime(j))];
    },
    // Regra 12.5: os jogos estão em dia se a última execução da otcb-jogos (otcb_execucoes_garimpo, tipo
    // 'jogos') foi concluída há menos de 36 h (o cron é diário). Sem execução, ou com falha, não estão.
    async jogosAtualizados() {
      const { data, error } = await admin.from("otcb_execucoes_garimpo").select("status, iniciado_em")
        .eq("tipo", "jogos").order("iniciado_em", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(`db_execucoes: ${error.message}`);
      if (!data || data.status !== "concluida") return false;
      return Date.now() - new Date(data.iniciado_em).getTime() < 36 * 3_600_000;
    },
    meuPassaporte: () => rpc(usuario, "otcb_meu_passaporte", {}),
    // RLS otcb_opinioes_le_proprias: com o JWT da pessoa, só a própria opinião (de qualquer status) volta.
    async minhaOpiniao(barId) {
      const { data: u } = await usuario.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await usuario.from("otcb_opinioes").select("texto, nota")
        .eq("bar_id", barId).eq("usuario_id", u.user.id).maybeSingle();
      if (error) throw new Error(`db_minha_opiniao: ${error.message}`);
      return data;
    },
  };
}
