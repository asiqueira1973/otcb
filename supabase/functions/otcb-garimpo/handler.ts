import { errorMessage } from "../_shared/sanitize.ts";
import { executarLote, type ResultadoLote, type Servicos } from "./executor.ts";
import { type Modo, MODOS } from "./tipos.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };

// Compara dois textos em tempo constante (o segredo do cron não vaza por tempo de resposta).
export function iguaisEmTempoConstante(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export type DepsHandler = {
  segredoCron: string;
  servicos: () => Servicos;
  // Agenda o lote em segundo plano (EdgeRuntime.waitUntil em produção; nos testes, aguarda).
  emSegundoPlano: (tarefa: Promise<ResultadoLote>) => Promise<ResultadoLote | null>;
};

// Edge Function otcb-garimpo (seção 13.6): chamada só pelo pg_cron/pg_net com o cabeçalho x-otcb-cron.
// Recebe: POST { modo, execucao_id?, bairros? } (bairros só para rodada de teste). Devolve: 202 com a
// execução aceita (ou 200 com o resultado, nos testes); 401 sem segredo; 400 modo inválido; 409 se já há
// execução do mesmo modo em andamento.
export async function handleGarimpo(req: Request, deps: DepsHandler): Promise<Response> {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "metodo_nao_permitido" }), { status: 405, headers: JSON_HEADERS });
  const segredo = req.headers.get("x-otcb-cron") ?? "";
  if (!deps.segredoCron || !iguaisEmTempoConstante(segredo, deps.segredoCron)) {
    return new Response(JSON.stringify({ error: "nao_autorizado" }), { status: 401, headers: JSON_HEADERS });
  }

  let body: { modo?: string; execucao_id?: string; bairros?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "corpo_invalido" }), { status: 400, headers: JSON_HEADERS });
  }
  if (!MODOS.includes(body.modo as Modo)) {
    return new Response(JSON.stringify({ error: "modo_invalido" }), { status: 400, headers: JSON_HEADERS });
  }
  const modo = body.modo as Modo;
  const s = deps.servicos();

  try {
    let execucaoId = body.execucao_id ?? null;
    if (!execucaoId) {
      execucaoId = await s.db.iniciarExecucao(modo);
      if (!execucaoId) return new Response(JSON.stringify({ error: "execucao_em_andamento" }), { status: 409, headers: JSON_HEADERS });
      const bairros = Array.isArray(body.bairros) ? body.bairros.filter((b): b is string => typeof b === "string").slice(0, 40) : null;
      if (bairros && bairros.length > 0 && modo === "descoberta") {
        await s.db.salvarExecucao(execucaoId, {
          status: "em_andamento", cursor: { bairros }, novosErros: [],
          bares_novos: 0, evidencias_criadas: 0, chamadas_google: 0, chamadas_firecrawl: 0,
        });
      }
    }
    const resultado = await deps.emSegundoPlano(executarLote(execucaoId, modo, s));
    return new Response(JSON.stringify(resultado ?? { execucao_id: execucaoId, aceito: true }), {
      status: resultado ? 200 : 202, headers: JSON_HEADERS,
    });
  } catch (error) {
    console.error("otcb-garimpo:", errorMessage(error, s.segredos));
    return new Response(JSON.stringify({ error: "falha_garimpo" }), { status: 500, headers: JSON_HEADERS });
  }
}
