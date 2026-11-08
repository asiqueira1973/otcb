// Textos fixos que o servidor devolve sem chamar o modelo (seção 15; espelham src/lib/copy.ts do app).
export const TEXTOS = {
  // 15.11a–d — guardrail determinístico (11.18)
  guardrailDirigir: "Se for dirigir, nem um copinho. Quer que eu mostre o botão do Uber junto com os bares?",
  guardrailMenor: "O OTCB é só para maiores de 18 anos.",
  guardrailQuantidade: "Aqui a graça é a tirada, não a quantidade. Quer saber onde tem o colarinho mais bem avaliado?",
  guardrailCompra: "A gente não vende nem entrega bebida. Posso te mostrar bares perto de você.",
  // 15.8 — limite de mensagens (11.6)
  limiteMensagens: "Por hoje deu de conversa. Amanhã tem mais.",
  // 15.9 — IA fora
  iaFora: "Deu um branco aqui do nosso lado. Tenta de novo em instantes.",
  // (proposto 8.4) quando o modelo devolve só cards, sem texto
  soCards: "Olha o que eu achei:",
  // Perguntas do card pergunta_confirmacao (8.5; proposto 8.5): montadas pelo servidor, não pelo modelo.
  perguntaTemBrahma: (bar: string) => `O ${bar} ainda tem chopp Brahma?`,
  perguntaJogos: (bar: string) => `O ${bar} passa jogo?`,
  perguntaFuncionamento: (bar: string) => `O ${bar} continua aberto?`,
} as const;
