import { TEXTOS } from "./textos.ts";

// Guardrail determinístico do chat (regra 11.18), aplicado antes do modelo e antes do limite (13.1).
// Padrões comparados sem acento e sem diferenciar maiúsculas. Ordem: menor, dirigir, quantidade, compra.

export type TipoGuardrail = "menor" | "dirigir" | "quantidade" | "compra";

const PADROES: Record<TipoGuardrail, RegExp[]> = {
  menor: [
    // "tenho N anos", ou "tenho N" no fim da frase; "tenho 3 amigos" não é idade (bug B1 do verifier).
    /\btenho ([0-9]|1[0-7])( anos\b|\s*([.,!?]|$))/,
    /\bsou menor\b/,
    /\bmenor de idade\b/,
    /\b([0-9]|1[0-7]) anos (de idade )?(e )?(quero|posso|da pra)\b/,
  ],
  dirigir: [
    /\b(vou|vamos|vai|preciso|tenho que|tenho de) dirigir\b/,
    /\bvolto de carro\b/,
    /\bdirigir depois\b/,
    /\bdepois (eu )?(dirijo|volto dirigindo)\b/,
    /\bvou de carro\b/,
  ],
  quantidade: [
    /\bquantos? chop+s?\b.*\b(bebad|chapad|ficar louco|derrubar)/,
    /\bficar bebad/,
    /\bvirar (o|um|uns|dois|tres|quatro|cinco|[0-9]+)?\s*(chop+|copo|caneco|tulipa|cerveja)/,
    // "desafio" só com bebida por perto ("desafio de hoje no futebol" passa).
    /\bdesafio\b.*\b(chop+s?|cervejas?|beber|bebe|copos?|vira|virar)\b/,
    /\b(chop+s?|cervejas?|beber|copos?)\b.*\bdesafio\b/,
    /\bporre\b/,
    /\bencher a cara\b/,
  ],
  compra: [
    /\b(delivery|ifood|rappi|ze delivery)\b/,
    // Comprar bebida, ou pedir que o OTCB venda/entregue. "O bar vende chopp Brahma?" é a pergunta do app (B1).
    /\b(comprar|compro|compra)\b.*\b(chop+|cerveja|bebida|barril|brahma)\b/,
    // "Você(s)" ou o app como sujeito colado ao verbo ("vocês vendem?"); "você sabe se o bar vende…?" passa (P1).
    /\b(voces|vcs|voce|vc|o app|otcb) (tambem |ai |nao )?(vende|vendem|vender|entrega|entregam|entregar)\b/,
    /\b(chop+|cerveja|bebida|barril)\b.*\b(em casa|pra levar|para levar|pra entregar)\b/,
  ],
};

const RESPOSTAS: Record<TipoGuardrail, string> = {
  menor: TEXTOS.guardrailMenor,
  dirigir: TEXTOS.guardrailDirigir,
  quantidade: TEXTOS.guardrailQuantidade,
  compra: TEXTOS.guardrailCompra,
};

// Normaliza para comparação: minúsculas, sem acento, espaços simples.
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Aplica a 11.18. Recebe: a mensagem do usuário. Devolve: o tipo e a resposta fixa, ou null se não casar.
export function verificarGuardrail(mensagem: string): { tipo: TipoGuardrail; resposta: string } | null {
  const texto = normalizar(mensagem);
  for (const tipo of ["menor", "dirigir", "quantidade", "compra"] as TipoGuardrail[]) {
    if (PADROES[tipo].some((p) => p.test(texto))) return { tipo, resposta: RESPOSTAS[tipo] };
  }
  return null;
}
