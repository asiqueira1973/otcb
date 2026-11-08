import Anthropic from "npm:@anthropic-ai/sdk@^0";

import { ExternalServiceError } from "./errors.ts";

// Cliente da Claude API para o garimpo (seções 4.1, 13.6; regras 11.8 e 12.5).
// Modelo da seção 4.1 para classificação e resumos: claude-haiku-5-5.
export const MODELO_CLASSIFICACAO = "claude-haiku-5-5";

// Contrato de classificação da seção 13.6.
export type Classificacao = {
  nome_bar: string;
  menciona_chopp_brahma: "sim" | "nao" | "incerto";
  cita_outra_marca_de_chopp: boolean;
  transmite_jogos: "sim" | "nao" | "incerto";
  data_conteudo: string | null;
  trecho: string;
};

export interface ClaudeClient {
  // Classifica um texto (página, cardápio ou avaliação). `onAttempt` é chamado antes de cada tentativa
  // (conta no teto de classificações da 11.17). Lança ExternalServiceError se a saída não respeitar o
  // contrato após 1 nova tentativa (12.5).
  classify(texto: string, contexto: string, onAttempt: () => void): Promise<Classificacao>;
  // Resume opiniões publicadas (regra 11.8): até 400 caracteres, pt-BR, sem apelidos, sem inventar.
  summarize(opinioes: { texto: string; nota: number | null }[], onAttempt: () => void): Promise<string>;
}

const SCHEMA_CLASSIFICACAO = {
  type: "object",
  additionalProperties: false,
  required: ["nome_bar", "menciona_chopp_brahma", "cita_outra_marca_de_chopp", "transmite_jogos", "data_conteudo", "trecho"],
  properties: {
    nome_bar: { type: "string" },
    menciona_chopp_brahma: { type: "string", enum: ["sim", "nao", "incerto"] },
    cita_outra_marca_de_chopp: { type: "boolean" },
    transmite_jogos: { type: "string", enum: ["sim", "nao", "incerto"] },
    data_conteudo: { anyOf: [{ type: "string", format: "date" }, { type: "null" }] },
    trecho: { type: "string" },
  },
} as const;

// Prompt de classificação v1 (contrato 13.6). Não citar o modelo nem custos para o usuário final.
const SISTEMA_CLASSIFICACAO = `Você analisa textos sobre bares de São Paulo para o app OTCB, que mapeia onde há chopp Brahma.
Responda só com o JSON pedido, sobre o bar principal do texto:
- nome_bar: nome do bar como aparece no texto ("" se não houver).
- menciona_chopp_brahma: "sim" se o texto diz que o bar serve chopp (draft) da marca Brahma; "nao" se fica claro que não serve; "incerto" se não dá para saber. Cerveja Brahma em garrafa ou lata não conta como chopp.
- cita_outra_marca_de_chopp: true se o texto cita chopp de outra marca no bar.
- transmite_jogos: "sim" se o bar passa jogos de futebol na TV; "nao" se diz que não passa; "incerto" caso contrário.
- data_conteudo: data do conteúdo (AAAA-MM-DD) se estiver explícita no texto; senão null.
- trecho: até 300 caracteres copiados literalmente do texto que sustentam a classificação.
Não invente nada que não esteja no texto.`;

const SISTEMA_RESUMO = `Você resume opiniões de clientes sobre um bar para o app OTCB.
Escreva em português do Brasil, em até 400 caracteres, um resumo neutro do que as opiniões dizem (chopp, colarinho, atendimento, ambiente).
Não cite nomes nem apelidos de quem opinou. Não invente nada que não esteja nas opiniões. Responda só com o texto do resumo.`;

// Valida a saída contra o contrato 13.6. Recebe: o JSON parseado. Devolve: a classificação ou null.
export function validarClassificacao(v: unknown): Classificacao | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const enumSNI = (x: unknown) => x === "sim" || x === "nao" || x === "incerto";
  if (typeof o.nome_bar !== "string" || !enumSNI(o.menciona_chopp_brahma) || typeof o.cita_outra_marca_de_chopp !== "boolean"
      || !enumSNI(o.transmite_jogos) || typeof o.trecho !== "string") return null;
  if (o.data_conteudo !== null && !(typeof o.data_conteudo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.data_conteudo))) return null;
  return {
    nome_bar: o.nome_bar.trim(),
    menciona_chopp_brahma: o.menciona_chopp_brahma as Classificacao["menciona_chopp_brahma"],
    cita_outra_marca_de_chopp: o.cita_outra_marca_de_chopp,
    transmite_jogos: o.transmite_jogos as Classificacao["transmite_jogos"],
    data_conteudo: o.data_conteudo as string | null,
    trecho: o.trecho.slice(0, 300),
  };
}

// Converte erros do SDK em ExternalServiceError (sem detalhes sensíveis). 401/403 e falta de crédito são fatais.
function traduzirErro(error: unknown): never {
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0;
    const fatal = status === 401 || status === 403 || (status === 400 && /credit|billing/i.test(error.message));
    throw new ExternalServiceError("claude", status, fatal, "messages");
  }
  throw error;
}

// Cria o cliente. Recebe: chave da API. Devolve: ClaudeClient.
export function createClaudeClient(apiKey: string): ClaudeClient {
  const client = new Anthropic({ apiKey, maxRetries: 2 });

  function textoDe(response: Anthropic.Message): string {
    return response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
  }

  return {
    async classify(texto, contexto, onAttempt) {
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        onAttempt();
        let response: Anthropic.Message;
        try {
          response = await client.messages.create({
            model: MODELO_CLASSIFICACAO,
            max_tokens: 1024,
            system: SISTEMA_CLASSIFICACAO,
            messages: [{ role: "user", content: `Contexto: ${contexto}\n\nTexto:\n${texto.slice(0, 20000)}` }],
            output_config: { format: { type: "json_schema", schema: SCHEMA_CLASSIFICACAO } },
          } as Anthropic.MessageCreateParamsNonStreaming);
        } catch (error) {
          traduzirErro(error);
        }
        if (response.stop_reason === "refusal") continue;
        try {
          const ok = validarClassificacao(JSON.parse(textoDe(response)));
          if (ok) return ok;
        } catch { /* JSON inválido: nova tentativa (12.5) */ }
      }
      throw new ExternalServiceError("claude", 0, false, "resposta_fora_do_contrato");
    },
    async summarize(opinioes, onAttempt) {
      onAttempt();
      const lista = opinioes.map((o, i) => `${i + 1}. ${o.nota ? `(nota ${o.nota}) ` : ""}${o.texto}`).join("\n");
      try {
        const response = await client.messages.create({
          model: MODELO_CLASSIFICACAO,
          max_tokens: 400,
          system: SISTEMA_RESUMO,
          messages: [{ role: "user", content: `Opiniões:\n${lista}` }],
        });
        const texto = textoDe(response);
        if (!texto || response.stop_reason === "refusal") throw new ExternalServiceError("claude", 0, false, "resumo_vazio");
        return texto.slice(0, 400);
      } catch (error) {
        if (error instanceof ExternalServiceError) throw error;
        traduzirErro(error);
      }
    },
  };
}
