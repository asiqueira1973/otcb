import { IaIndisponivel, rodarAgente, type ModeloAgente } from "./agente.ts";
import { temVocabularioDoApp } from "./escopo.ts";
import { verificarGuardrail } from "./guardrails.ts";
import { TEXTOS } from "./textos.ts";
import type { AgenteDb } from "./tipos.ts";

// Lógica da Edge Function otcb-agente (seção 13.1; épico 8.4). Puro: dependências injetadas (seção 22).

// 11.6: até 40 mensagens do usuário ao agente por dia (dia de São Paulo).
export const LIMITE_DIARIO = 40;
// 8.11 (custo): teto diário de mensagens ao agente somando todas as contas (contas anônimas em massa).
export const LIMITE_GLOBAL_DIARIO = 2000;

export type DepsAgente = {
  // Banco com o JWT do usuário para as ferramentas e serviço para o resto (ver db.ts).
  db: (token: string) => AgenteDb;
  modelo: () => ModeloAgente;
  log: (evento: Record<string, unknown>) => void;
  // 8.11: porteiro de escopo (true = mensagem sobre o app). Ausente ou com falha, a mensagem passa.
  escopo?: (mensagem: string) => Promise<boolean>;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Lê o `sub` do JWT sem validar a assinatura, só para adiantar consultas; a identidade vale apenas depois de
// confirmada pelo Auth (handleAgente). Recebe: token. Devolve: o uuid do sub ou null se não for um JWT legível.
export function subDoToken(token: string): string | null {
  try {
    const parte = token.split(".")[1];
    if (!parte) return null;
    const json = atob(parte.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parte.length / 4) * 4, "="));
    const sub = JSON.parse(json).sub;
    return typeof sub === "string" && /^[0-9a-f-]{36}$/i.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

// Valida o corpo da 13.1. Recebe: JSON. Devolve: mensagem e localização, ou null se inválido (422).
export function validarEntrada(corpo: unknown): { mensagem: string; local: { latitude: number; longitude: number } | null } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  if (typeof c.mensagem !== "string") return null;
  const mensagem = c.mensagem.trim();
  if (mensagem.length < 1 || mensagem.length > 1000) return null;
  const temLat = c.latitude !== undefined && c.latitude !== null;
  const temLng = c.longitude !== undefined && c.longitude !== null;
  if (temLat !== temLng) return null;
  if (!temLat) return { mensagem, local: null };
  const latitude = Number(c.latitude);
  const longitude = Number(c.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { mensagem, local: { latitude, longitude } };
}

// Atende POST /otcb-agente. Ordem da 13.1: autenticação → validação → guardrail 11.18 → limite 11.6 →
// contexto 11.13 → modelo com ferramentas → grava mensagem do usuário e resposta em otcb_mensagens.
// Devolve: 200 { mensagem_id, texto, blocos, bloqueada_guardrail }; 401; 405; 422; 429 limite_mensagens;
// 503 ia_indisponivel (nada é gravado nesse caso, e o app mostra "tentar de novo").
export async function handleAgente(req: Request, deps: DepsAgente): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { codigo: "metodo_nao_permitido" });

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json(401, { codigo: "nao_autenticado" });
  const db = deps.db(token);
  // Critério 8: a validação no Auth corre em paralelo com a leitura do corpo e as consultas do turno, que
  // começam pelo `sub` do JWT; nada é usado nem gravado antes de o Auth confirmar o mesmo usuário.
  const verificacao = db.usuarioDoToken(token).catch(() => null);
  const sub = subDoToken(token);

  let corpo: unknown;
  try { corpo = await req.json(); } catch { corpo = null; }
  const entrada = validarEntrada(corpo);
  const guardrail = entrada ? verificarGuardrail(entrada.mensagem) : null;
  const consultar = (id: string) => Promise.all([db.mensagensHoje(id), db.contexto(id), db.perfil(id)]);
  const adiantadas = entrada && !guardrail && sub ? consultar(sub) : null;
  adiantadas?.catch(() => undefined); // evita rejeição sem tratamento se o token não valer
  // 8.11: o porteiro corre em paralelo com as consultas; falha ou ausência = no escopo (o prompt v11 segura).
  const noEscopo = entrada && !guardrail && deps.escopo && !temVocabularioDoApp(entrada.mensagem)
    ? deps.escopo(entrada.mensagem).catch(() => true)
    : Promise.resolve(true);

  const usuarioId = await verificacao;
  if (!usuarioId || (sub !== null && sub !== usuarioId)) return json(401, { codigo: "nao_autenticado" });
  if (!entrada) return json(422, { codigo: "mensagem_invalida" });

  try {
    // 11.18: filtro determinístico antes de tudo; o modelo não é chamado. Só o tipo vai ao log.
    if (guardrail) {
      deps.log({ evento: "guardrail", tipo: guardrail.tipo });
      if (guardrail.tipo === "menor") await db.marcarRevisaoMenor(usuarioId);
      const [, respostaId] = await db.gravarMensagens(usuarioId, [
        { papel: "usuario", conteudo: entrada.mensagem, blocos: null },
        { papel: "assistente", conteudo: guardrail.resposta, blocos: null },
      ]);
      return json(200, { mensagem_id: respostaId, texto: guardrail.resposta, blocos: [], bloqueada_guardrail: true });
    }

    // Limite, contexto e perfil em paralelo (critério 8: cada ida ao banco soma na latência).
    const [hoje, historico, perfil] = await (adiantadas ?? consultar(usuarioId));
    // 11.6: a 41ª mensagem do dia não chega ao modelo nem é gravada.
    if (hoje >= LIMITE_DIARIO) {
      deps.log({ evento: "limite_mensagens" });
      return json(429, { codigo: "limite_mensagens", texto: TEXTOS.limiteMensagens });
    }

    // 8.11: pedido fora do assunto do app não chega ao agente; a resposta fixa é gravada e conta no limite.
    if (!(await noEscopo)) {
      deps.log({ evento: "fora_do_escopo" });
      const [, respostaId] = await db.gravarMensagens(usuarioId, [
        { papel: "usuario", conteudo: entrada.mensagem, blocos: null },
        { papel: "assistente", conteudo: TEXTOS.foraDoEscopo, blocos: null },
      ]);
      return json(200, { mensagem_id: respostaId, texto: TEXTOS.foraDoEscopo, blocos: [], bloqueada_guardrail: true });
    }

    // 8.11: teto diário de todas as contas; passou dele, o app mostra "tenta de novo" e a IA não é chamada.
    if ((await db.mensagensHojeTotal()) >= LIMITE_GLOBAL_DIARIO) {
      deps.log({ evento: "teto_global" });
      return json(503, { codigo: "ia_indisponivel", texto: TEXTOS.iaFora });
    }

    const inicio = Date.now();
    let resultado;
    try {
      resultado = await rodarAgente({ mensagem: entrada.mensagem, historico, perfil, local: entrada.local }, db, deps.modelo());
    } catch (error) {
      if (error instanceof IaIndisponivel) {
        deps.log({ evento: "ia_indisponivel", motivo: error.message });
        return json(503, { codigo: "ia_indisponivel", texto: TEXTOS.iaFora });
      }
      throw error;
    }
    const texto = resultado.texto || TEXTOS.soCards;
    const [, respostaId] = await db.gravarMensagens(usuarioId, [
      { papel: "usuario", conteudo: entrada.mensagem, blocos: null },
      { papel: "assistente", conteudo: texto, blocos: resultado.blocos.length > 0 ? resultado.blocos : null },
    ]);
    deps.log({ evento: "resposta", ms: Date.now() - inicio, blocos: resultado.blocos.map((b) => b.tipo), ...resultado.uso });
    return json(200, { mensagem_id: respostaId, texto, blocos: resultado.blocos, bloqueada_guardrail: false });
  } catch (error) {
    // Sem detalhes: nada de texto da pessoa, token ou chave no log (seção 20).
    deps.log({ evento: "erro", nome: error instanceof Error ? error.name : "desconhecido" });
    return json(500, { codigo: "erro_interno" });
  }
}
