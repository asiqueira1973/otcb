import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import type { Cursor, GarimpoDb, Modo } from "./tipos.ts";

// Implementação de GarimpoDb com o cliente de serviço (funções service-only da migration 0800).
// Recebe: cliente Supabase com service role. Devolve: GarimpoDb. Erros do banco sobem como Error.
export function createGarimpoDb(admin: SupabaseClient): GarimpoDb {
  async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await admin.rpc(nome, args);
    if (error) throw new Error(`db_${nome}: ${error.code ?? ""} ${error.message}`);
    return data as T;
  }

  return {
    iniciarExecucao: (tipo) => rpc<string | null>("otcb_garimpo_iniciar", { p_tipo: tipo }),
    async carregarExecucao(id) {
      const { data, error } = await admin.from("otcb_execucoes_garimpo")
        .select("id, tipo, status, cursor, bares_novos, evidencias_criadas").eq("id", id).maybeSingle();
      if (error) throw new Error(`db_execucao: ${error.message}`);
      if (!data) return null;
      let cursor: Cursor = {};
      try { cursor = data.cursor ? JSON.parse(data.cursor) : {}; } catch { cursor = {}; }
      return { id: data.id, tipo: data.tipo as Modo, status: data.status, cursor, bares_novos: data.bares_novos, evidencias_criadas: data.evidencias_criadas };
    },
    async salvarExecucao(id, d) {
      const { data: atual, error: e1 } = await admin.from("otcb_execucoes_garimpo").select("erros").eq("id", id).single();
      if (e1) throw new Error(`db_execucao: ${e1.message}`);
      const erros = [...((atual?.erros as unknown[]) ?? []), ...d.novosErros];
      const { error } = await admin.from("otcb_execucoes_garimpo").update({
        status: d.status,
        cursor: JSON.stringify(d.cursor),
        erros: erros.length > 0 ? erros : null,
        bares_novos: d.bares_novos,
        evidencias_criadas: d.evidencias_criadas,
        chamadas_google: d.chamadas_google,
        chamadas_firecrawl: d.chamadas_firecrawl,
        concluido_em: d.status === "em_andamento" ? null : new Date().toISOString(),
      }).eq("id", id);
      if (error) throw new Error(`db_execucao: ${error.message}`);
    },
    usoMes: () => rpc("otcb_garimpo_uso_mes", {}),
    async disparar(modo, execucaoId) {
      await rpc("otcb_garimpo_disparar", { p_modo: modo, p_execucao_id: execucaoId });
    },
    registrarEvidencia: (e) => rpc("otcb_registrar_evidencia_garimpo", {
      p_bar_id: e.barId, p_assunto: e.assunto, p_sinal: e.sinal, p_tipo: e.tipo,
      p_url_fonte: e.url, p_trecho: e.trecho, p_data_evidencia: e.data.toISOString(),
    }),
    casarOuCriarBar: (c) => rpc("otcb_casar_ou_criar_bar", {
      p_nome: c.nome, p_endereco: c.endereco, p_bairro: c.bairro, p_latitude: c.latitude, p_longitude: c.longitude,
      p_place_id: c.placeId, p_criar: c.criar,
    }),
    baresParaRevisita: (limite, excluir) => rpc("otcb_bares_para_revisita", { p_limite: limite, p_excluir: excluir }),
    baresParaCoordenadas: (limite, excluir) => rpc("otcb_bares_para_coordenadas", { p_limite: limite, p_excluir: excluir }),
    async atualizarCoordenadas(barId, latitude, longitude) {
      await rpc("otcb_atualizar_coordenadas", { p_bar_id: barId, p_latitude: latitude, p_longitude: longitude });
    },
    baresParaResumo: (limite, excluir) => rpc("otcb_bares_para_resumo", { p_limite: limite, p_excluir: excluir }),
    async opinioesPublicadas(barId) {
      const { data, error } = await admin.from("otcb_opinioes").select("texto, nota")
        .eq("bar_id", barId).eq("status", "publicada").order("criado_em", { ascending: false }).limit(50);
      if (error) throw new Error(`db_opinioes: ${error.message}`);
      return (data ?? []) as { texto: string; nota: number | null }[];
    },
    gravarResumo: (barId, resumo) => rpc("otcb_gravar_resumo", { p_bar_id: barId, p_resumo: resumo }),
  };
}
