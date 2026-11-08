import Anthropic from "npm:@anthropic-ai/sdk@^0";

// Avaliação da foto pelo modelo de visão (contrato 13.5): claude-haiku-5-5 com saída estruturada.
// Saída fora do contrato ganha 1 nova tentativa (12.5); falha → VisaoIndisponivel (503, nada gravado).
export const MODELO_VISAO = "claude-haiku-5-5";

export type Avaliacao = {
  e_chopp: boolean;
  nota_altura: number;
  nota_cremosidade: number;
  nota_copo: number;
  nota_gelado: number;
  comentario: string;
  pessoa_identificavel: boolean;
};

export interface Visao {
  avaliar(jpegBase64: string): Promise<Avaliacao>;
}

export class VisaoIndisponivel extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "VisaoIndisponivel";
  }
}

const SISTEMA = `Você avalia fotos de chopp para o Colarinhômetro do app OTCB.
Primeiro diga se a foto mostra um copo de chopp servido (e_chopp). Garrafa, lata, outra bebida, foto sem copo ou imagem que não é de bebida → e_chopp=false e todas as notas 0.
Se for chopp, dê notas de 0 a 10 (uma casa decimal):
- nota_altura: altura do colarinho; o ideal é cerca de dois dedos (2 a 3 cm). Sem colarinho ou colarinho ocupando metade do copo → nota baixa.
- nota_cremosidade: espuma fina e densa vale mais que bolhas grandes.
- nota_copo: copo limpo, apropriado para chopp, sem espuma escorrendo.
- nota_gelado: sinais visuais de chopp gelado (copo suado, espuma firme).
comentario: uma frase curta, de no máximo 100 caracteres, em português do Brasil, bem-humorado, sobre a tirada; nunca incentive beber mais, rodadas ou quantidade; não cite marcas nem pessoas.
pessoa_identificavel: true se aparece rosto de pessoa reconhecível.
Responda só com o JSON pedido.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["e_chopp", "nota_altura", "nota_cremosidade", "nota_copo", "nota_gelado", "comentario", "pessoa_identificavel"],
  properties: {
    e_chopp: { type: "boolean" },
    nota_altura: { type: "number" },
    nota_cremosidade: { type: "number" },
    nota_copo: { type: "number" },
    nota_gelado: { type: "number" },
    comentario: { type: "string" },
    pessoa_identificavel: { type: "boolean" },
  },
} as const;

// Corta o comentário em até 120 caracteres (13.5) no fim de uma palavra, com reticências (bug visto na
// checagem real: o modelo passa de 120 e o corte caía no meio da palavra). Recebe: texto. Devolve: texto ≤ 120.
export function cortarComentario(texto: string): string {
  const t = texto.trim().replace(/\s+/g, " ");
  if (t.length <= 120) return t;
  const ate = t.slice(0, 119);
  const espaco = ate.lastIndexOf(" ");
  const base = (espaco > 60 ? ate.slice(0, espaco) : ate).replace(/[\s,;:–-]+$/, "");
  return `${base}…`;
}

const nota = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10;

// Valida o contrato 13.5. Recebe: JSON. Devolve: avaliação limpa (notas com 1 casa, comentário ≤ 120) ou null.
export function validarAvaliacao(v: unknown): Avaliacao | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.e_chopp !== "boolean" || typeof o.pessoa_identificavel !== "boolean" || typeof o.comentario !== "string") return null;
  if (![o.nota_altura, o.nota_cremosidade, o.nota_copo, o.nota_gelado].every(nota)) return null;
  const um = (x: unknown) => Math.round((x as number) * 10) / 10;
  return {
    e_chopp: o.e_chopp,
    nota_altura: um(o.nota_altura), nota_cremosidade: um(o.nota_cremosidade), nota_copo: um(o.nota_copo), nota_gelado: um(o.nota_gelado),
    comentario: cortarComentario(o.comentario),
    pessoa_identificavel: o.pessoa_identificavel,
  };
}

export type CriarMensagem = (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>;

// Cria a visão real (ou com a chamada simulada dos testes). Recebe: chave e, opcional, a chamada. Devolve: Visao.
export function criarVisao(apiKey: string, criar?: CriarMensagem): Visao {
  const client = criar ? null : new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 });
  const chamar: CriarMensagem = criar ?? ((p) => client!.messages.create(p));
  return {
    async avaliar(jpegBase64) {
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        let resposta: Anthropic.Message;
        try {
          resposta = await chamar({
            model: MODELO_VISAO,
            max_tokens: 300,
            system: SISTEMA,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegBase64 } },
                { type: "text", text: "Avalie esta foto." },
              ],
            }],
            output_config: { format: { type: "json_schema", schema: SCHEMA } },
          } as Anthropic.MessageCreateParamsNonStreaming);
        } catch (error) {
          const status = error instanceof Anthropic.APIError ? error.status ?? 0 : 0;
          throw new VisaoIndisponivel(`modelo_${status}`);
        }
        if (resposta.stop_reason === "refusal") throw new VisaoIndisponivel("recusa");
        const saida = resposta.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
        try {
          const v = validarAvaliacao(JSON.parse(saida));
          if (v) return v;
        } catch { /* nova tentativa */ }
      }
      throw new VisaoIndisponivel("fora_do_contrato");
    },
  };
}
