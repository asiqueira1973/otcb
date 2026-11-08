// Lista de termos proibidos da moderação de opiniões (regra 11.7), aplicada antes do modelo. Determinística:
// pega o óbvio (dado pessoal de terceiro, links e spam, incentivo a beber em excesso, ofensa e ódio
// explícitos). O que passa daqui ainda vai ao claude-haiku-5-5.

export type MotivoRecusa = "ofensa" | "odio" | "dado_pessoal" | "consumo_excessivo" | "spam";

const PADROES: [MotivoRecusa, RegExp][] = [
  // Dado pessoal de terceiro: telefone, e-mail.
  ["dado_pessoal", /\b\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/],
  ["dado_pessoal", /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/],
  // Propaganda e spam: links, cupons, chamadas de WhatsApp/Instagram.
  ["spam", /\b(https?:\/\/|www\.)\S+/],
  ["spam", /\b(cupom|promocode|chama no (zap|whats)|segue (a gente|nosso perfil)|link na bio)\b/],
  // Incentivo a consumo excessivo (11.18 × 11.7).
  ["consumo_excessivo", /\b(encher a cara|tomar um porre|beber ate cair|ficar (muito )?bebad|open bar infinito|virar (\d+|dez|vinte) chop)/],
  // Ofensas e ódio explícitos (lista curta; o resto fica com o modelo).
  ["ofensa", /\b(filho da puta|fdp|vagabund[oa]s?|lixo humano|idiota|imbecil|otari[oa]s?|babaca)\b/],
  ["odio", /\b(macaco|viado|bicha|sapatao|traveco|retardad[oa])\b/],
];

// Normaliza: minúsculas e sem acento. Recebe: texto. Devolve: texto comparável.
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Aplica a lista. Recebe: o texto da opinião. Devolve: o motivo da recusa ou null se passou.
export function verificarTermos(texto: string): MotivoRecusa | null {
  const t = normalizar(texto);
  for (const [motivo, padrao] of PADROES) if (padrao.test(t)) return motivo;
  return null;
}
