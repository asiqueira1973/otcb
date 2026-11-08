// Tetos de custo do garimpo (regra 11.17). Constantes revisáveis: mudar aqui muda os limites.

export type Recurso = "text_search" | "details_basico" | "details_reviews" | "firecrawl" | "ia";

export const RECURSOS: Recurso[] = ["text_search", "details_basico", "details_reviews", "firecrawl", "ia"];

// Teto por execução (11.17).
export const TETO_POR_EXECUCAO: Record<Recurso, number> = {
  text_search: 150,
  details_reviews: 30,
  details_basico: 300,
  firecrawl: 200,
  ia: 300,
};

// Teto por mês (11.17).
export const TETO_POR_MES: Record<Recurso, number> = {
  text_search: 3000,
  details_reviews: 600,
  details_basico: 6000,
  firecrawl: 4000,
  ia: 6000,
};

// Itens por invocação (épico 8.3) e tempo máximo de trabalho por invocação (premissa P1).
export const ITENS_POR_INVOCACAO = 20;
export const TEMPO_MAXIMO_MS = 100_000;
