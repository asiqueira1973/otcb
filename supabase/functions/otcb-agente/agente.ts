import Anthropic from "npm:@anthropic-ai/sdk@^0";

import { CacheTurno } from "./blocos.ts";
import { executarFerramenta, FERRAMENTAS, type Turno } from "./ferramentas.ts";
import { PROMPT_AGENTE_V6 } from "./prompts/agente.v6.ts";
import type { AgenteDb, Bloco } from "./tipos.ts";

// Loop do agente do chat (seções 4.1, 13.1 e 13.3). Modelo da seção 4.1: claude-sonnet-5-5.
export const MODELO_AGENTE = "claude-sonnet-5-5";
// 13.1: no máximo 5 rodadas de ferramenta por mensagem; depois disso o modelo responde só com texto.
export const MAX_RODADAS = 5;

// O modelo, abstraído para os testes (seção 22: sem rede nos testes).
export interface ModeloAgente {
  criar(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
}

// Falha do modelo (rede, 5xx, chave, recusa): o handler devolve 503 ia_indisponivel (13.1).
export class IaIndisponivel extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "IaIndisponivel";
  }
}

// Cria o modelo real. Recebe: chave. Devolve: ModeloAgente com timeout curto (critério 8: p95 < 8 s).
export function criarModeloAnthropic(apiKey: string): ModeloAgente {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 });
  return { criar: (params) => client.messages.create(params) };
}

// Contagem de tokens do turno, só números (vai ao log para acompanhar latência e cache; seção 20).
export type UsoTurno = { chamadas: number; cache_lido: number; cache_gravado: number; entrada: number };

export type EntradaAgente = {
  mensagem: string;
  historico: { papel: "usuario" | "assistente" | "sistema"; conteudo: string }[];
  perfil: { apelido: string; time_do_coracao: string | null } | null;
  local: { latitude: number; longitude: number } | null;
};

// Converte o histórico 11.13 em mensagens da API: 'sistema' vira nota de usuário; papéis iguais seguidos
// são unidos; a conversa começa sempre pelo usuário.
export function montarMensagens(entrada: EntradaAgente): Anthropic.MessageParam[] {
  const brutas: { role: "user" | "assistant"; text: string }[] = entrada.historico.map((m) => ({
    role: m.papel === "assistente" ? "assistant" : "user",
    text: m.papel === "sistema" ? `[nota do app] ${m.conteudo}` : m.conteudo,
  }));
  brutas.push({ role: "user", text: entrada.mensagem });
  const out: { role: "user" | "assistant"; text: string }[] = [];
  for (const m of brutas) {
    if (out.length === 0 && m.role === "assistant") continue;
    const ultima = out.at(-1);
    if (ultima && ultima.role === m.role) ultima.text += `\n\n${m.text}`;
    else out.push({ ...m });
  }
  return out.map((m) => ({ role: m.role, content: m.text }));
}

// Contexto do turno (11.13): apelido, time e localização. A localização só vai ao modelo; nunca é gravada.
export function contextoDoTurno(entrada: EntradaAgente): string {
  const linhas = [
    `Apelido da pessoa: ${entrada.perfil?.apelido ?? "desconhecido"}.`,
    `Time do coração: ${entrada.perfil?.time_do_coracao ?? "não informado"}.`,
    entrada.local
      ? `Localização atual disponível: latitude ${entrada.local.latitude.toFixed(5)}, longitude ${entrada.local.longitude.toFixed(5)}.`
      : "Localização atual: não disponível (a pessoa não permitiu ou não enviou).",
    `Agora em São Paulo: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
  ];
  return linhas.join("\n");
}

// Executa o turno. Recebe: entrada, banco (para as ferramentas) e modelo. Devolve: texto e blocos.
// Lança IaIndisponivel se o modelo falhar ou não produzir texto nem blocos.
export async function rodarAgente(entrada: EntradaAgente, db: AgenteDb, modelo: ModeloAgente): Promise<{ texto: string; blocos: Bloco[]; uso: UsoTurno }> {
  const turno: Turno = { cache: new CacheTurno(), blocos: [], local: entrada.local };
  const messages = montarMensagens(entrada);
  // O prompt fixo e as ferramentas ficam em cache (prefixo estável); o contexto do turno vem depois.
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: PROMPT_AGENTE_V6, cache_control: { type: "ephemeral" } },
    { type: "text", text: contextoDoTurno(entrada) },
  ];
  const textos: string[] = [];
  const rascunhos: string[] = [];
  const uso: UsoTurno = { chamadas: 0, cache_lido: 0, cache_gravado: 0, entrada: 0 };

  for (let rodada = 0; rodada <= MAX_RODADAS; rodada++) {
    let resposta: Anthropic.Message;
    try {
      resposta = await modelo.criar({
        model: MODELO_AGENTE,
        max_tokens: 2048,
        system,
        tools: FERRAMENTAS,
        tool_choice: rodada === MAX_RODADAS ? { type: "none" } : { type: "auto" },
        messages,
        // Critério 8: esforço baixo. O claude-sonnet-5-5 não aceita thinking desligado (400, testado em 8.4).
        output_config: { effort: "low" },
      } as Anthropic.MessageCreateParamsNonStreaming);
    } catch (error) {
      const status = error instanceof Anthropic.APIError ? error.status ?? 0 : 0;
      throw new IaIndisponivel(`modelo_${status}`);
    }
    if (resposta.stop_reason === "refusal") throw new IaIndisponivel("recusa");
    uso.chamadas += 1;
    uso.cache_lido += resposta.usage?.cache_read_input_tokens ?? 0;
    uso.cache_gravado += resposta.usage?.cache_creation_input_tokens ?? 0;
    uso.entrada += resposta.usage?.input_tokens ?? 0;

    const texto = resposta.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    const usos = resposta.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    // Bug real do 8.9: texto escrito junto com uma consulta (buscar_bares, jogos_de_hoje…) é rascunho do modelo
    // ("Horário UTC 23:30 = 20:30…") e não vai para a pessoa; só vale o texto de rodada sem consulta.
    const soExibe = usos.every((u) => u.name === "mostrar" || u.name === "oferecer_card");
    if (texto && soExibe) textos.push(texto);
    else if (texto) rascunhos.push(texto);
    if (resposta.stop_reason !== "tool_use" || usos.length === 0) break;

    messages.push({ role: "assistant", content: resposta.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const uso of usos) {
      const conteudo = await executarFerramenta(uso.name, (uso.input ?? {}) as Record<string, unknown>, db, turno);
      resultados.push({ type: "tool_result", tool_use_id: uso.id, content: conteudo });
    }
    // Critério 8 (p95 < 8 s): "mostrar" e "oferecer_card" só ecoam; se a rodada já trouxe o texto e só mostrou cards, a
    // resposta está pronta e não há outra chamada ao modelo (o prompt v2 pede o texto junto com o mostrar).
    // Sem texto, segue mais uma rodada para o modelo escrever.
    if (texto && usos.every((u) => u.name === "mostrar" || u.name === "oferecer_card")) break;
    messages.push({ role: "user", content: resultados });
  }

  // Sem texto final: com cards, o handler usa o texto padrão; sem nada, o último rascunho é melhor que vazio.
  const texto = (textos.join("\n\n") || (turno.blocos.length === 0 ? rascunhos.at(-1) ?? "" : "")).trim();
  if (!texto && turno.blocos.length === 0) throw new IaIndisponivel("resposta_vazia");
  return { texto, blocos: turno.blocos, uso };
}
