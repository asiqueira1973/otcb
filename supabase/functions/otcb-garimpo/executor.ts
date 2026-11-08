import { ExternalServiceError } from "../_shared/errors.ts";
import { errorMessage } from "../_shared/sanitize.ts";
import type { ClaudeClient } from "../_shared/claude.ts";
import type { FirecrawlClient } from "../_shared/firecrawl.ts";
import type { GoogleClient } from "../_shared/google.ts";
import { BAIRROS_DESCOBERTA } from "./bairros.ts";
import { MODOS_GARIMPO } from "./modos.ts";
import { Orcamento, TetoAtingido } from "./orcamento.ts";
import { ITENS_POR_INVOCACAO, RECURSOS, TEMPO_MAXIMO_MS } from "./tetos.ts";
import type { Contexto, Cursor, GarimpoDb, Modo } from "./tipos.ts";

export type Servicos = { db: GarimpoDb; google: GoogleClient; firecrawl: FirecrawlClient; claude: ClaudeClient; segredos: string[] };

export type ResultadoLote = {
  execucao_id: string;
  status: "em_andamento" | "concluida" | "falhou";
  itens: number;
  erros: number;
  motivo?: string;
};

// Executa um lote de uma execução do garimpo (épico 8.3; seções 12.3 e 13.6; regra 11.17).
// Recebe: execução já aberta, modo, serviços e relógio. Devolve: o resultado do lote.
// - processa no máximo ITENS_POR_INVOCACAO itens e TEMPO_MAXIMO_MS;
// - teto atingido → 'concluida' com o motivo em erros (critério 4);
// - falha de um item → registrada em erros (sanitizada) e o lote segue (critério 5);
// - erro fatal (chave inválida, sem crédito) → 'falhou';
// - sobrou trabalho → salva o cursor e se reagenda via pg_net (otcb_garimpo_disparar).
export async function executarLote(execucaoId: string, modo: Modo, s: Servicos, agora: () => number = Date.now): Promise<ResultadoLote> {
  const inicio = agora();
  const execucao = await s.db.carregarExecucao(execucaoId);
  if (!execucao || execucao.status !== "em_andamento") {
    return { execucao_id: execucaoId, status: (execucao?.status as ResultadoLote["status"]) ?? "falhou", itens: 0, erros: 0, motivo: "execucao_indisponivel" };
  }
  const cursor: Cursor = execucao.cursor ?? {};
  const pos = cursor.posicao ?? {};
  const usoMes = await s.db.usoMes();
  const usoOutras = Object.fromEntries(RECURSOS.map((r) => [r, Math.max(0, (usoMes[r] ?? 0) - (cursor.uso?.[r] ?? 0))]));
  const orcamento = new Orcamento(cursor.uso ?? {}, usoOutras);
  const ctx: Contexto = {
    db: s.db, google: s.google, firecrawl: s.firecrawl, claude: s.claude, orcamento,
    agora: new Date(inicio), bairros: cursor.bairros ?? BAIRROS_DESCOBERTA,
    contadores: { bares_novos: 0, evidencias_criadas: 0 },
  };
  const m = MODOS_GARIMPO[modo];
  const novosErros: Record<string, unknown>[] = [];
  let processados = 0;
  let selecionados: unknown[] = [];
  let teto: TetoAtingido | null = null;
  let fatal: string | null = null;
  let pausou = false;

  try {
    selecionados = await m.selecionar(ctx, pos, ITENS_POR_INVOCACAO);
  } catch (error) {
    if (error instanceof TetoAtingido) teto = error;
    else if (error instanceof ExternalServiceError && error.fatal) fatal = errorMessage(error, s.segredos);
    else novosErros.push({ etapa: "selecao", erro: errorMessage(error, s.segredos) });
  }

  for (const item of selecionados) {
    if (teto || fatal) break;
    if (agora() - inicio > TEMPO_MAXIMO_MS) { pausou = true; break; }
    try {
      await m.processar(ctx, item);
    } catch (error) {
      if (error instanceof TetoAtingido) { teto = error; break; }
      if (error instanceof ExternalServiceError && error.fatal) { fatal = errorMessage(error, s.segredos); break; }
      novosErros.push({ item: m.rotulo(item), erro: errorMessage(error, s.segredos) });
    }
    m.marcarFeito(pos, item);
    processados += 1;
  }

  let status: ResultadoLote["status"];
  let motivo: string | undefined;
  if (fatal) {
    status = "falhou";
    motivo = "erro_fatal";
    novosErros.push({ motivo, erro: fatal });
  } else if (teto) {
    status = "concluida";
    motivo = teto.message;
    novosErros.push({ motivo: "teto_atingido", recurso: teto.recurso, escopo: teto.escopo });
  } else if (!pausou && processados === selecionados.length && m.acabou(ctx, pos, selecionados.length, ITENS_POR_INVOCACAO)) {
    status = "concluida";
  } else {
    status = "em_andamento";
  }

  const totais = orcamento.totais();
  // Ao concluir, a posição sai do cursor e fica só o uso por recurso (base dos tetos mensais, 11.17).
  const novoCursor: Cursor = status === "em_andamento"
    ? { ...cursor, uso: orcamento.uso, posicao: pos }
    : { uso: orcamento.uso };
  await s.db.salvarExecucao(execucaoId, {
    status, cursor: novoCursor, novosErros,
    bares_novos: execucao.bares_novos + ctx.contadores.bares_novos,
    evidencias_criadas: execucao.evidencias_criadas + ctx.contadores.evidencias_criadas,
    chamadas_google: totais.google, chamadas_firecrawl: totais.firecrawl,
  });
  if (status === "em_andamento") await s.db.disparar(modo, execucaoId);

  return { execucao_id: execucaoId, status, itens: processados, erros: novosErros.length, motivo };
}
