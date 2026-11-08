import { verificarTermos } from "./bloqueio.ts";
import { ModeracaoIndisponivel, type Moderador } from "./moderacao.ts";

// Lógica da Edge Function otcb-opinioes (13.7; regras 11.6 e 11.7; épico 8.5). Puro: dependências injetadas.

export interface OpinioesDb {
  usuarioDoToken(token: string): Promise<string | null>;
  // otcb_checar_edicao: true se já existe opinião (edição). Lança Error com 'bar_inexistente'/'limite_edicao'.
  checarEdicao(usuarioId: string, barId: string): Promise<boolean>;
  // otcb_salvar_opiniao: grava publicada (upsert) e a mensagem sistema. Devolve o id.
  salvar(usuarioId: string, barId: string, texto: string, nota: number | null): Promise<string>;
  // otcb_recusar_edicao: oculta a versão publicada quando a edição é recusada.
  recusarEdicao(usuarioId: string, barId: string): Promise<void>;
}

export type DepsOpinioes = { db: OpinioesDb; moderador: () => Moderador; log: (e: Record<string, unknown>) => void };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valida o corpo da 13.7. Recebe: JSON. Devolve: dados limpos ou null (422 dados_invalidos).
export function validarOpiniao(corpo: unknown): { barId: string; texto: string; nota: number | null } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  if (typeof c.bar_id !== "string" || !UUID.test(c.bar_id) || typeof c.texto !== "string") return null;
  const texto = c.texto.trim();
  if (texto.length < 10 || texto.length > 500) return null;
  const nota = c.nota === undefined || c.nota === null ? null : c.nota;
  if (nota !== null && !(Number.isInteger(nota) && (nota as number) >= 1 && (nota as number) <= 5)) return null;
  return { barId: c.bar_id, texto, nota: nota as number | null };
}

// Atende POST /otcb-opinioes. Ordem: JWT → validação → limite de edição (antes de gastar IA) → lista de
// termos → claude-haiku-5-5 → grava. Devolve: 200 {opiniao_id, status:"publicada"}; 401; 405; 404
// bar_inexistente; 422 dados_invalidos | recusada_moderacao (nada gravado; edição recusada oculta a versão
// publicada, 11.7); 429 limite_edicao; 503 moderacao_indisponivel (não publica, copy 15.9).
// O log nunca leva o texto da opinião (seção 20).
export async function handleOpinioes(req: Request, deps: DepsOpinioes): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { codigo: "metodo_nao_permitido" });
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const usuarioId = token ? await deps.db.usuarioDoToken(token).catch(() => null) : null;
  if (!usuarioId) return json(401, { codigo: "nao_autenticado" });

  let corpo: unknown;
  try { corpo = await req.json(); } catch { corpo = null; }
  const dados = validarOpiniao(corpo);
  if (!dados) return json(422, { codigo: "dados_invalidos" });

  try {
    let edicao: boolean;
    try {
      edicao = await deps.db.checarEdicao(usuarioId, dados.barId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("limite_edicao")) return json(429, { codigo: "limite_edicao" });
      if (msg.includes("bar_inexistente")) return json(404, { codigo: "bar_inexistente" });
      throw error;
    }

    const termo = verificarTermos(dados.texto);
    let permitida = termo === null;
    let motivo: string = termo ?? "nenhum";
    if (permitida) {
      try {
        const v = await deps.moderador().moderar(dados.texto);
        permitida = v.permitida;
        motivo = v.motivo;
      } catch (error) {
        if (error instanceof ModeracaoIndisponivel) {
          deps.log({ evento: "moderacao_indisponivel", motivo: error.message });
          return json(503, { codigo: "moderacao_indisponivel" });
        }
        throw error;
      }
    }
    if (!permitida) {
      if (edicao) await deps.db.recusarEdicao(usuarioId, dados.barId);
      deps.log({ evento: "recusada", origem: termo ? "lista" : "modelo", motivo, edicao });
      return json(422, { codigo: "recusada_moderacao" });
    }

    const id = await deps.db.salvar(usuarioId, dados.barId, dados.texto, dados.nota);
    deps.log({ evento: "publicada", edicao });
    return json(200, { opiniao_id: id, status: "publicada" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("limite_edicao")) return json(429, { codigo: "limite_edicao" });
    deps.log({ evento: "erro", nome: error instanceof Error ? error.name : "desconhecido" });
    return json(500, { codigo: "erro_interno" });
  }
}
