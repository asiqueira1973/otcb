import { type Recurso, RECURSOS, TETO_POR_EXECUCAO, TETO_POR_MES } from "./tetos.ts";

// Erro de teto atingido (regra 11.17): a execução para e termina 'concluida' com o motivo em `erros`.
export class TetoAtingido extends Error {
  constructor(readonly recurso: Recurso, readonly escopo: "execucao" | "mes") {
    super(`teto_${escopo}_${recurso}`);
    this.name = "TetoAtingido";
  }
}

export type Uso = Record<Recurso, number>;

export function usoVazio(): Uso {
  return { text_search: 0, details_basico: 0, details_reviews: 0, firecrawl: 0, ia: 0 };
}

// Orçamento de chamadas de uma execução (regra 11.17).
// Recebe: o uso já acumulado nesta execução (lotes anteriores) e o uso do mês das OUTRAS execuções.
// consumir() lança TetoAtingido antes de estourar o teto por execução ou por mês.
export class Orcamento {
  readonly uso: Uso;
  constructor(usoExecucao: Partial<Uso>, private readonly usoOutrasNoMes: Partial<Uso>) {
    this.uso = { ...usoVazio(), ...usoExecucao };
  }

  consumir(recurso: Recurso, quantidade = 1): void {
    const depois = this.uso[recurso] + quantidade;
    if (depois > TETO_POR_EXECUCAO[recurso]) throw new TetoAtingido(recurso, "execucao");
    if ((this.usoOutrasNoMes[recurso] ?? 0) + depois > TETO_POR_MES[recurso]) throw new TetoAtingido(recurso, "mes");
    this.uso[recurso] = depois;
  }

  // Totais para as colunas chamadas_google e chamadas_firecrawl (7.2).
  totais(): { google: number; firecrawl: number } {
    return {
      google: this.uso.text_search + this.uso.details_basico + this.uso.details_reviews,
      firecrawl: this.uso.firecrawl,
    };
  }
}

export { RECURSOS };
