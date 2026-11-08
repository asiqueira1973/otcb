// Testes do agente do chat (épico 8.4; seção 22): banco e modelo simulados, sem rede.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import type Anthropic from "npm:@anthropic-ai/sdk@^0";

import { montarBlocos, CacheTurno, paraCardBar } from "./blocos.ts";
import { MAX_RODADAS, type ModeloAgente } from "./agente.ts";
import { FERRAMENTAS } from "./ferramentas.ts";
import { verificarGuardrail } from "./guardrails.ts";
import { handleAgente, LIMITE_DIARIO, validarEntrada } from "./handler.ts";
import { TEXTOS } from "./textos.ts";
import type { AgenteDb } from "./tipos.ts";

const BAR = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  bar_id: id, nome: `Bar ${id}`, bairro: "Pinheiros", endereco: "Rua X, 1", latitude: -23.56, longitude: -46.68,
  distancia_metros: 300, status, tem_balcao: true, transmite_jogos: false, classico: false,
  nota_colarinho_media: 8.5, nota_opinioes_media: 4.2, qtd_opinioes: 3, ultima_confirmacao_em: null,
  confirmacoes_60_dias: 1, resumo_opinioes: null, ...extra,
});

type Gravada = { papel: string; conteudo: string; blocos: unknown };

function fakeDb(opts: { hoje?: number; bares?: Record<string, unknown>[] } = {}) {
  const estado = { gravadas: [] as Gravada[], revisaoMenor: 0, buscas: [] as Record<string, unknown>[] };
  const db: AgenteDb = {
    usuarioDoToken: (t) => Promise.resolve(t === "token-ok" ? "u1" : null),
    perfil: () => Promise.resolve({ apelido: "ana_sp", time_do_coracao: null }),
    mensagensHoje: () => Promise.resolve(opts.hoje ?? 0),
    contexto: () => Promise.resolve([]),
    gravarMensagens: (_u, msgs) => {
      estado.gravadas.push(...msgs);
      return Promise.resolve(msgs.map((_, i) => `m${estado.gravadas.length + i}`));
    },
    marcarRevisaoMenor: () => { estado.revisaoMenor += 1; return Promise.resolve(); },
    buscarBares: (p) => { estado.buscas.push(p); return Promise.resolve(opts.bares ?? []); },
    detalhesBar: (id) => Promise.resolve((opts.bares ?? []).find((b) => b.bar_id === id) ?? Promise.reject(new Error("bar_inexistente"))),
    opinioesDoBar: () => Promise.resolve([]),
    jogos: () => Promise.resolve([]),
    jogosAtualizados: () => Promise.resolve(true),
    meuPassaporte: () => Promise.resolve({ carimbos: [], colecoes_bairro: [], selos: [] }),
    minhaOpiniao: () => Promise.resolve(null),
  };
  return { db, estado };
}

// Modelo roteirizado: cada chamada devolve o próximo passo; registra os parâmetros recebidos.
function fakeModelo(passos: (Partial<Anthropic.Message> | Error)[]) {
  const chamadas: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const modelo: ModeloAgente = {
    criar(params) {
      chamadas.push(structuredClone(params));
      const passo = passos[Math.min(chamadas.length - 1, passos.length - 1)];
      if (passo instanceof Error) return Promise.reject(passo);
      return Promise.resolve({ id: "x", type: "message", role: "assistant", model: "m", stop_reason: "end_turn",
        stop_sequence: null, usage: {} as Anthropic.Usage, content: [], ...passo } as Anthropic.Message);
    },
  };
  return { modelo, chamadas };
}

const usoFerramenta = (id: string, name: string, input: unknown): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use", content: [{ type: "tool_use", id, name, input } as Anthropic.ToolUseBlock],
});
const textoFinal = (text: string): Partial<Anthropic.Message> => ({
  stop_reason: "end_turn", content: [{ type: "text", text, citations: null } as Anthropic.TextBlock],
});

function req(corpo: unknown, token = "token-ok") {
  return new Request("http://local/otcb-agente", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo),
  });
}

function deps(db: AgenteDb, modelo: ModeloAgente, logs: Record<string, unknown>[] = []) {
  return { db: () => db, modelo: () => modelo, log: (e: Record<string, unknown>) => logs.push(e) };
}

// ===================================================================== guardrails 11.18

Deno.test("11.18: guardrails detectam os quatro casos e deixam perguntas normais passarem", () => {
  assertEquals(verificarGuardrail("tenho 16 anos, onde tem chopp?")?.tipo, "menor");
  assertEquals(verificarGuardrail("Vou DIRIGIR depois, qual bar?")?.tipo, "dirigir");
  assertEquals(verificarGuardrail("quantos chopps preciso pra ficar bêbado")?.tipo, "quantidade");
  assertEquals(verificarGuardrail("vocês entregam chopp em casa?")?.tipo, "compra");
  assertEquals(verificarGuardrail("chopp perto de mim com balcão"), null);
  assertEquals(verificarGuardrail("Bar do Nico"), null);
  assertEquals(verificarGuardrail("onde passa o jogo do Corinthians?"), null);
});

Deno.test("critério 5: guardrail responde o texto fixo sem chamar o modelo e loga só o tipo", async () => {
  const { db, estado } = fakeDb();
  const { modelo, chamadas } = fakeModelo([textoFinal("não devia")]);
  const logs: Record<string, unknown>[] = [];
  const res = await handleAgente(req({ mensagem: "vou dirigir, qual bar?" }), deps(db, modelo, logs));
  const corpo = await res.json();
  assertEquals(res.status, 200);
  assertEquals(corpo.texto, TEXTOS.guardrailDirigir);
  assertEquals(corpo.bloqueada_guardrail, true);
  assertEquals(chamadas.length, 0);
  assertEquals(logs, [{ evento: "guardrail", tipo: "dirigir" }]);
  assertEquals(estado.gravadas.map((g) => g.papel), ["usuario", "assistente"]);
});

Deno.test("11.18: menção a menor marca a conta para revisão", async () => {
  const { db, estado } = fakeDb();
  const { modelo, chamadas } = fakeModelo([textoFinal("x")]);
  const res = await handleAgente(req({ mensagem: "tenho 17 anos" }), deps(db, modelo));
  assertEquals((await res.json()).texto, TEXTOS.guardrailMenor);
  assertEquals(estado.revisaoMenor, 1);
  assertEquals(chamadas.length, 0);
});

// ===================================================================== limite 11.6

Deno.test("critério 6: a 41ª mensagem do dia recebe 429 com a copy 15.8 sem chamar o modelo", async () => {
  const { db, estado } = fakeDb({ hoje: LIMITE_DIARIO });
  const { modelo, chamadas } = fakeModelo([textoFinal("x")]);
  const res = await handleAgente(req({ mensagem: "chopp perto de mim" }), deps(db, modelo));
  assertEquals(res.status, 429);
  assertEquals(await res.json(), { codigo: "limite_mensagens", texto: TEXTOS.limiteMensagens });
  assertEquals(chamadas.length, 0);
  assertEquals(estado.gravadas.length, 0);
});

Deno.test("a 40ª mensagem do dia ainda passa", async () => {
  const { db } = fakeDb({ hoje: LIMITE_DIARIO - 1 });
  const { modelo } = fakeModelo([textoFinal("Opa!")]);
  assertEquals((await handleAgente(req({ mensagem: "oi" }), deps(db, modelo))).status, 200);
});

// ===================================================================== entrada e autenticação

Deno.test("13.1: 401 sem token válido, 422 para mensagem vazia, longa ou coordenada pela metade", async () => {
  const { db } = fakeDb();
  const { modelo } = fakeModelo([textoFinal("x")]);
  assertEquals((await handleAgente(req({ mensagem: "oi" }, "ruim"), deps(db, modelo))).status, 401);
  assertEquals((await handleAgente(req({ mensagem: "   " }), deps(db, modelo))).status, 422);
  assertEquals((await handleAgente(req({ mensagem: "a".repeat(1001) }), deps(db, modelo))).status, 422);
  assertEquals((await handleAgente(req({ mensagem: "oi", latitude: -23.5 }), deps(db, modelo))).status, 422);
  assertEquals(validarEntrada({ mensagem: "oi", latitude: -23.5, longitude: -46.6 })?.local, { latitude: -23.5, longitude: -46.6 });
});

// ===================================================================== fluxo com ferramentas

Deno.test("critério 1: busca perto usa a localização do turno e devolve lista_bares montada pelo servidor", async () => {
  const { db, estado } = fakeDb({ bares: [BAR("b1", "confirmado"), BAR("b2", "provavel")] });
  const { modelo, chamadas } = fakeModelo([
    usoFerramenta("t1", "buscar_bares", { tem_balcao: true }),
    usoFerramenta("t2", "mostrar", { blocos: [{ tipo: "lista_bares", titulo: "Com balcão perto", bar_ids: ["b1", "b2"] }] }),
    textoFinal("Achei dois com balcão."),
  ]);
  const res = await handleAgente(req({ mensagem: "chopp perto de mim com balcão", latitude: -23.56, longitude: -46.68 }), deps(db, modelo));
  const corpo = await res.json();
  assertEquals(res.status, 200);
  assertEquals(estado.buscas[0].p_latitude, -23.56);
  assertEquals(estado.buscas[0].p_tem_balcao, true);
  assertEquals(corpo.blocos.length, 1);
  assertEquals(corpo.blocos[0].tipo, "lista_bares");
  assertEquals(corpo.blocos[0].bares.map((b: { bar_id: string }) => b.bar_id), ["b1", "b2"]);
  assertEquals(corpo.texto, "Achei dois com balcão.");
  assertEquals(chamadas.length, 3);
});

Deno.test("critério 3: sem_brahma e fechado nunca chegam ao modelo nem aos blocos", async () => {
  const { db } = fakeDb({ bares: [BAR("ok", "confirmado"), BAR("sb", "sem_brahma"), BAR("fx", "fechado")] });
  const { modelo, chamadas } = fakeModelo([
    usoFerramenta("t1", "buscar_bares", { bairro: "Pinheiros" }),
    usoFerramenta("t2", "mostrar", { blocos: [{ tipo: "lista_bares", titulo: "X", bar_ids: ["ok", "sb", "fx"] }, { tipo: "card_bar", bar_id: "fx" }] }),
    textoFinal("Pronto."),
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "bares em Pinheiros" }), deps(db, modelo))).json();
  const resultadoFerramenta = JSON.stringify(chamadas[1].messages.at(-1));
  assertFalse(resultadoFerramenta.includes("sem_brahma"));
  assertFalse(resultadoFerramenta.includes("fechado"));
  assertEquals(corpo.blocos.length, 1, "o card_bar do bar fechado é descartado");
  assertEquals(corpo.blocos[0].bares.map((b: { bar_id: string }) => b.bar_id), ["ok"]);
});

Deno.test("critério 4: incerto chega ao modelo como a_confirmar e o card mantém status incerto", async () => {
  const { db } = fakeDb({ bares: [BAR("inc", "incerto")] });
  const { modelo, chamadas } = fakeModelo([
    usoFerramenta("t1", "buscar_bares", { texto: "Bar inc" }),
    usoFerramenta("t2", "mostrar", { blocos: [{ tipo: "card_bar", bar_id: "inc" }] }),
    textoFinal("Esse ainda está a confirmar."),
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "Bar inc" }), deps(db, modelo))).json();
  const resultadoFerramenta = JSON.stringify(chamadas[1].messages.at(-1));
  assert(resultadoFerramenta.includes("a_confirmar"));
  assertFalse(resultadoFerramenta.includes("incerto"));
  assertEquals(corpo.blocos[0].bar.status, "incerto");
});

Deno.test("13.1: bloco inválido ou com bar inventado é descartado e o texto é mantido", () => {
  const cache = new CacheTurno();
  cache.bares.set("b1", paraCardBar(BAR("b1", "confirmado"), null)!);
  const { blocos, descartados } = montarBlocos([
    { tipo: "card_bar", bar_id: "inventado" },
    { tipo: "lista_bares", titulo: "Vazio", bar_ids: [] },
    { tipo: "acao", acao: "chamar_uber", bar_id: "b1", rotulo: "Chamar Uber" },
    { tipo: "acao", acao: "explodir", rotulo: "x" },
    { tipo: "passaporte" },
    { tipo: "formulario_opiniao", bar_id: "b1" },
    "lixo",
  ], cache);
  assertEquals(blocos, [{ tipo: "acao", acao: "chamar_uber", bar_id: "b1", rotulo: "Chamar Uber" }]);
  assertEquals(descartados, 6);
});

Deno.test("13.1: no máximo 5 rodadas de ferramenta; a última chamada proíbe ferramentas", async () => {
  const { db } = fakeDb({ bares: [BAR("b1", "confirmado")] });
  const passos = Array.from({ length: MAX_RODADAS }, (_, i) => usoFerramenta(`t${i}`, "buscar_bares", { bairro: "Pinheiros" }));
  const { modelo, chamadas } = fakeModelo([...passos, textoFinal("Fim.")]);
  const res = await handleAgente(req({ mensagem: "bares" }), deps(db, modelo));
  assertEquals(res.status, 200);
  assertEquals(chamadas.length, MAX_RODADAS + 1);
  assertEquals(chamadas.at(-1)!.tool_choice, { type: "none" });
});

Deno.test("sem localização e sem bairro, buscar_bares devolve erro para o modelo pedir o bairro", async () => {
  const { db, estado } = fakeDb({ bares: [BAR("b1", "confirmado")] });
  const { modelo, chamadas } = fakeModelo([usoFerramenta("t1", "buscar_bares", {}), textoFinal("Em que bairro você está?")]);
  const corpo = await (await handleAgente(req({ mensagem: "chopp perto de mim" }), deps(db, modelo))).json();
  assertEquals(estado.buscas.length, 0);
  assert(JSON.stringify(chamadas[1].messages.at(-1)).includes("sem_localizacao"));
  assertEquals(corpo.blocos, []);
});

// ===================================================================== falhas e privacidade

Deno.test("erro do modelo → 503 ia_indisponivel e nada gravado", async () => {
  const { db, estado } = fakeDb();
  const { modelo } = fakeModelo([new Error("rede caiu")]);
  const res = await handleAgente(req({ mensagem: "oi" }), deps(db, modelo));
  assertEquals(res.status, 503);
  assertEquals((await res.json()).codigo, "ia_indisponivel");
  assertEquals(estado.gravadas.length, 0);
});

Deno.test("seção 17/20: a localização vai ao modelo mas não é gravada nem logada; nada de texto ou token no log", async () => {
  const { db, estado } = fakeDb({ bares: [BAR("b1", "confirmado")] });
  const { modelo, chamadas } = fakeModelo([textoFinal("Opa.")]);
  const logs: Record<string, unknown>[] = [];
  await handleAgente(req({ mensagem: "segredo da Ana", latitude: -23.123456, longitude: -46.654321 }), deps(db, modelo, logs));
  assert(JSON.stringify(chamadas[0].system).includes("-23.12346"));
  const gravado = JSON.stringify(estado.gravadas);
  assertFalse(gravado.includes("23.12"));
  assertFalse(gravado.includes("46.65"));
  const logado = JSON.stringify(logs);
  for (const proibido of ["segredo", "23.12", "token-ok", "Bearer"]) assertFalse(logado.includes(proibido), proibido);
});

Deno.test("resposta só com cards usa o texto padrão e grava os blocos", async () => {
  const { db, estado } = fakeDb({ bares: [BAR("b1", "confirmado")] });
  const { modelo } = fakeModelo([
    usoFerramenta("t1", "detalhes_bar", { bar_id: "b1" }),
    usoFerramenta("t2", "mostrar", { blocos: [{ tipo: "card_bar", bar_id: "b1" }] }),
    { stop_reason: "end_turn", content: [] },
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "Bar b1" }), deps(db, modelo))).json();
  assertEquals(corpo.texto, TEXTOS.soCards);
  assertEquals((estado.gravadas[1].blocos as unknown[]).length, 1);
});

// ===================================================================== latência (critério 8)

Deno.test("critério 8: rodada que só chama mostrar encerra o turno sem nova chamada ao modelo", async () => {
  const { db } = fakeDb({ bares: [BAR("b1", "confirmado")] });
  const { modelo, chamadas } = fakeModelo([
    usoFerramenta("t1", "buscar_bares", { texto: "Bar b1" }),
    { stop_reason: "tool_use", content: [
      { type: "text", text: "Achei o Bar b1.", citations: null } as Anthropic.TextBlock,
      { type: "tool_use", id: "t2", name: "mostrar", input: { blocos: [{ tipo: "card_bar", bar_id: "b1" }] } } as Anthropic.ToolUseBlock,
    ] },
    textoFinal("não devia ser chamado"),
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "Bar b1" }), deps(db, modelo))).json();
  assertEquals(chamadas.length, 2);
  assertEquals(corpo.texto, "Achei o Bar b1.");
  assertEquals(corpo.blocos[0].tipo, "card_bar");
});

// ===================================================================== verifier 8.4 (bugs B1 e B2)

Deno.test("B1: perguntas normais não disparam guardrail (números sem 'anos', 'vende chopp Brahma?', 'desafio' sem bebida)", () => {
  for (const ok of [
    "tenho 3 amigos comigo, qual bar?",
    "tenho 5 pessoas, cabe no balcão?",
    "tenho 1 hora livre, chopp perto?",
    "o Bar do Nico vende chopp Brahma?",
    "qual bar vende chopp perto de mim?",
    "onde ver o desafio de hoje no futebol?",
    "tem chopp Brahma no Bar Leo?",
  ]) assertEquals(verificarGuardrail(ok), null, ok);
  // os casos reais seguem disparando
  assertEquals(verificarGuardrail("tenho 16 anos")?.tipo, "menor");
  assertEquals(verificarGuardrail("tenho 17")?.tipo, "menor");
  assertEquals(verificarGuardrail("onde compro um barril de chopp?")?.tipo, "compra");
  assertEquals(verificarGuardrail("vocês vendem chopp pra levar?")?.tipo, "compra");
  assertEquals(verificarGuardrail("desafio de quem vira mais chopp")?.tipo, "quantidade");
});

Deno.test("B2 (critério 1): lista_bares e mapa saem na ordem da 11.9 (status, depois distância), seja qual for a ordem dos ids", () => {
  const cache = new CacheTurno();
  for (const b of [
    BAR("inc-perto", "incerto", { distancia_metros: 100 }),
    BAR("conf-longe", "confirmado", { distancia_metros: 1900 }),
    BAR("prov", "provavel", { distancia_metros: 50 }),
    BAR("conf-perto", "confirmado", { distancia_metros: 400 }),
  ]) cache.bares.set(b.bar_id, paraCardBar(b, null)!);
  const ids = ["inc-perto", "prov", "conf-longe", "conf-perto"];
  const { blocos } = montarBlocos([{ tipo: "lista_bares", titulo: "X", bar_ids: ids }, { tipo: "mapa", bar_ids: ids }], cache);
  const esperado = ["conf-perto", "conf-longe", "prov", "inc-perto"];
  assertEquals((blocos[0] as { bares: { bar_id: string }[] }).bares.map((b) => b.bar_id), esperado);
  assertEquals((blocos[1] as { pontos: { bar_id: string }[] }).pontos.map((b) => b.bar_id), esperado);
});

// ===================================================================== consultas adiantadas pelo sub (critério 8)

const jwtCom = (sub: string) => `x.${btoa(JSON.stringify({ sub })).replace(/=+$/, "")}.y`;

Deno.test("critério 8: consultas começam pelo sub do JWT, mas sub diferente do usuário confirmado pelo Auth → 401 sem modelo nem gravação", async () => {
  const { db, estado } = fakeDb();
  const sub = "11111111-1111-1111-1111-111111111111";
  const outro = "22222222-2222-2222-2222-222222222222";
  const consultados: string[] = [];
  db.mensagensHoje = (id) => { consultados.push(id); return Promise.resolve(0); };
  db.usuarioDoToken = () => Promise.resolve(outro);
  const { modelo, chamadas } = fakeModelo([textoFinal("x")]);
  const res = await handleAgente(req({ mensagem: "oi" }, jwtCom(sub)), deps(db, modelo));
  assertEquals(res.status, 401);
  assertEquals(chamadas.length, 0);
  assertEquals(estado.gravadas.length, 0);
  assertEquals(consultados, [sub]);
});

Deno.test("critério 8: com o sub confirmado, o turno usa as consultas adiantadas", async () => {
  const { db, estado } = fakeDb();
  const sub = "11111111-1111-1111-1111-111111111111";
  let consultas = 0;
  db.mensagensHoje = () => { consultas += 1; return Promise.resolve(0); };
  db.usuarioDoToken = () => Promise.resolve(sub);
  const { modelo } = fakeModelo([textoFinal("Opa.")]);
  const res = await handleAgente(req({ mensagem: "oi" }, jwtCom(sub)), deps(db, modelo));
  assertEquals(res.status, 200);
  assertEquals(consultas, 1);
  assertEquals(estado.gravadas.length, 2);
});

Deno.test("P1: 'você sabe se o bar vende chopp Brahma?' não é compra; 'você(s) vende(m)/entrega(m)' é", () => {
  for (const ok of [
    "você sabe se o Bar do Nico vende chopp Brahma?",
    "vc sabe qual bar perto vende chopp Brahma?",
    "voce sabe se o bar do juarez ainda vende brahma?",
  ]) assertEquals(verificarGuardrail(ok), null, ok);
  for (const compra of ["vocês vendem chopp?", "vc vende barril?", "voces entregam?", "o app entrega chopp em casa?"]) {
    assertEquals(verificarGuardrail(compra)?.tipo, "compra", compra);
  }
});

// ===================================================================== cards de entrada (8.5)

Deno.test("8.5: oferecer_card monta pergunta_confirmacao com pergunta do servidor e só para bar do turno", async () => {
  const { db } = fakeDb({ bares: [BAR("b1", "incerto")] });
  const { modelo } = fakeModelo([
    usoFerramenta("t1", "buscar_bares", { texto: "Bar b1" }),
    { stop_reason: "tool_use", content: [
      { type: "text", text: "Confirma pra mim?", citations: null } as Anthropic.TextBlock,
      { type: "tool_use", id: "t2", name: "oferecer_card", input: { tipo: "pergunta_confirmacao", bar_id: "b1", assunto: "tem_brahma" } } as Anthropic.ToolUseBlock,
      { type: "tool_use", id: "t3", name: "oferecer_card", input: { tipo: "pergunta_confirmacao", bar_id: "inventado", assunto: "tem_brahma" } } as Anthropic.ToolUseBlock,
    ] },
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "o Bar b1 tem Brahma" }), deps(db, modelo))).json();
  assertEquals(corpo.blocos, [{ tipo: "pergunta_confirmacao", bar_id: "b1", nome_bar: "Bar b1", assunto: "tem_brahma", pergunta: "O Bar b1 ainda tem chopp Brahma?" }]);
});

Deno.test("critério 5: formulario_opiniao vem preenchido com a opinião atual da pessoa", async () => {
  const { db } = fakeDb({ bares: [BAR("b1", "confirmado")] });
  db.minhaOpiniao = () => Promise.resolve({ texto: "Minha opinião antiga", nota: 4 });
  const { modelo } = fakeModelo([
    usoFerramenta("t1", "detalhes_bar", { bar_id: "b1" }),
    usoFerramenta("t2", "oferecer_card", { tipo: "formulario_opiniao", bar_id: "b1" }),
    textoFinal("Só editar."),
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "quero mudar minha opinião do Bar b1" }), deps(db, modelo))).json();
  assertEquals(corpo.blocos[0], { tipo: "formulario_opiniao", bar_id: "b1", nome_bar: "Bar b1", texto_atual: "Minha opinião antiga", nota_atual: 4 });
});

Deno.test("8.5: denúncia só de opinião vista no turno; sugestão corta campos longos", async () => {
  const { db } = fakeDb({ bares: [BAR("b1", "confirmado")] });
  db.opinioesDoBar = () => Promise.resolve([{ opiniao_id: "op9", apelido: "x", nota: null, texto: "t", criado_em: "2026-11-08T00:00:00Z" }]);
  const { modelo } = fakeModelo([
    usoFerramenta("t1", "opinioes_do_bar", { bar_id: "b1" }),
    { stop_reason: "tool_use", content: [
      { type: "tool_use", id: "t2", name: "oferecer_card", input: { tipo: "formulario_denuncia", opiniao_id: "op9" } } as Anthropic.ToolUseBlock,
      { type: "tool_use", id: "t3", name: "oferecer_card", input: { tipo: "formulario_denuncia", opiniao_id: "op-inventada" } } as Anthropic.ToolUseBlock,
      { type: "tool_use", id: "t4", name: "oferecer_card", input: { tipo: "formulario_sugestao_bar", nome: "N".repeat(200), bairro: "Moema" } } as Anthropic.ToolUseBlock,
    ] },
    textoFinal("Pronto pra você."),
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "denunciar" }), deps(db, modelo))).json();
  assertEquals(corpo.blocos.map((b: { tipo: string }) => b.tipo), ["formulario_denuncia", "formulario_sugestao_bar"]);
  assertEquals(corpo.blocos[1].nome.length, 120);
  assertEquals(corpo.blocos[1].endereco, null);
  assertEquals(corpo.blocos[1].usar_localizacao_atual, false);
});

Deno.test("8.5: o agente não tem ferramenta que grava", () => {
  const nomes = FERRAMENTAS.map((f) => f.name);
  assertEquals(nomes.sort(), ["buscar_bares", "detalhes_bar", "jogos_de_hoje", "meu_passaporte", "mostrar", "oferecer_card", "opinioes_do_bar"]);
});

Deno.test("problema 6 do verifier: pergunta de funcionamento é 'fechou?', coerente com o único botão 'Fechou'", async () => {
  const { db } = fakeDb({ bares: [BAR("b1", "confirmado")] });
  const { modelo } = fakeModelo([
    usoFerramenta("t1", "detalhes_bar", { bar_id: "b1" }),
    usoFerramenta("t2", "oferecer_card", { tipo: "pergunta_confirmacao", bar_id: "b1", assunto: "funcionamento" }),
    textoFinal("Me conta."),
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "o Bar b1 fechou" }), deps(db, modelo))).json();
  assertEquals(corpo.blocos[0].pergunta, "O Bar b1 fechou?");
});

// ===================================================================== onde ver o jogo (8.9)

Deno.test("8.9: jogos_de_hoje separa os jogos do time pedido; o card jogos traz só o escolhido", async () => {
  const { db } = fakeDb();
  db.jogos = () => Promise.resolve([
    { jogo_id: "j1", competicao: "Brasileirão", mandante: "Corinthians", visitante: "Palmeiras", inicio: "2026-11-08T22:00:00Z" },
    { jogo_id: "j2", competicao: "Premier League", mandante: "Chelsea", visitante: "Arsenal", inicio: "2026-11-08T17:00:00Z" },
  ]);
  const { modelo, chamadas } = fakeModelo([
    usoFerramenta("t1", "jogos_de_hoje", { time: "corinthians" }),
    { stop_reason: "tool_use", content: [
      { type: "text", text: "Tem Corinthians hoje.", citations: null } as Anthropic.TextBlock,
      { type: "tool_use", id: "t2", name: "mostrar", input: { blocos: [{ tipo: "jogos", jogo_ids: ["j1"] }] } } as Anthropic.ToolUseBlock,
    ] },
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "onde ver o jogo do Corinthians hoje" }), deps(db, modelo))).json();
  const resultado = JSON.parse((chamadas[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0].content as string);
  assertEquals(resultado.jogos_do_time.map((j: { jogo_id: string }) => j.jogo_id), ["j1"]);
  assertEquals(resultado.outros_jogos.map((j: { jogo_id: string }) => j.jogo_id), ["j2"]);
  assertEquals(corpo.blocos[0].jogos.map((j: { jogo_id: string }) => j.jogo_id), ["j1"]);
});

Deno.test("8.9 (critério 3): sem bar que passe jogo, a pergunta de transmissão é do servidor", async () => {
  const { db } = fakeDb({ bares: [BAR("b1", "confirmado")] });
  const { modelo } = fakeModelo([
    usoFerramenta("t1", "buscar_bares", { bairro: "Pinheiros" }),
    { stop_reason: "tool_use", content: [
      { type: "text", text: "Nenhum bar confirmou que passa jogo aqui.", citations: null } as Anthropic.TextBlock,
      { type: "tool_use", id: "t2", name: "oferecer_card", input: { tipo: "pergunta_confirmacao", bar_id: "b1", assunto: "transmite_jogos" } } as Anthropic.ToolUseBlock,
    ] },
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "onde ver o jogo em Pinheiros" }), deps(db, modelo))).json();
  assertEquals(corpo.blocos[0], { tipo: "pergunta_confirmacao", bar_id: "b1", nome_bar: "Bar b1", assunto: "transmite_jogos", pergunta: "O Bar b1 passa jogo?" });
});

Deno.test("bug real do 8.9: texto de rodadas intermediárias (rascunho) não vai para a resposta", async () => {
  const { db } = fakeDb({ bares: [BAR("b1", "confirmado")] });
  const { modelo } = fakeModelo([
    { stop_reason: "tool_use", content: [
      { type: "text", text: "Horário UTC 23:30 = 20:30 em São Paulo.", citations: null } as Anthropic.TextBlock,
      { type: "tool_use", id: "t1", name: "buscar_bares", input: { bairro: "Pinheiros" } } as Anthropic.ToolUseBlock,
    ] },
    textoFinal("Hoje tem jogo às 20h30 e o Bar b1 passa."),
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "jogo hoje?" }), deps(db, modelo))).json();
  assertEquals(corpo.texto, "Hoje tem jogo às 20h30 e o Bar b1 passa.");
});

// ===================================================================== verifier do 8.9

// Regex do c4-incerto (avaliacao.json): a negação só vale quando nega a afirmação de perto ("não sei se o
// Bar Leo tem…"); "Confirmado: … tem chopp Brahma" e "Ainda não confirmamos, mas … tem chopp Brahma" são
// afirmação de Brahma para bar a confirmar e precisam reprovar.
Deno.test("verifier 8.9: regex do c4-incerto reprova afirmação e aceita dúvida", async () => {
  const aval = JSON.parse(await Deno.readTextFile(new URL("./avaliacao.json", import.meta.url)));
  const caso = aval.perguntas.find((c: { id: string }) => c.id === "c4-incerto");
  const re = new RegExp(caso.espera.texto_nao_contem[0], "i");
  for (const ruim of [
    "Confirmado: o Bar Leo tem chopp Brahma.",
    "Ainda não confirmamos, mas o Bar Leo tem chopp Brahma",
    "Não tenho dúvida: o Bar Leo tem chopp Brahma",
    "Sim, o Bar Leo tem chopp Brahma.",
    "Não, o Bar Leo serve chopp Brahma sim.",
  ]) assert(re.test(ruim), `deveria reprovar: ${ruim}`);
  for (const boa of [
    "Não sei se o Bar Leo tem chopp Brahma hoje: ainda falta confirmar.",
    "Ninguém confirmou ainda se ele tem chopp Brahma.",
    "Você pode ver se eles servem chopp Brahma e me contar?",
    "Está a confirmar. Você sabe se o Bar Leo ainda tem chopp Brahma?",
  ]) assertFalse(re.test(boa), `deveria aceitar: ${boa}`);
});

Deno.test("verifier 8.9: jogos_de_hoje aceita dias_a_frente 7 e corta acima de 7", async () => {
  const { db } = fakeDb();
  const pedidos: number[] = [];
  db.jogos = (_t, dias) => { pedidos.push(dias); return Promise.resolve([]); };
  const { modelo } = fakeModelo([
    { stop_reason: "tool_use", content: [
      { type: "tool_use", id: "t1", name: "jogos_de_hoje", input: { time: "Corinthians", dias_a_frente: 7 } } as Anthropic.ToolUseBlock,
      { type: "tool_use", id: "t2", name: "jogos_de_hoje", input: { time: "Corinthians", dias_a_frente: 30 } } as Anthropic.ToolUseBlock,
    ] },
    textoFinal("Não tem jogo."),
  ]);
  await handleAgente(req({ mensagem: "quando joga o Corinthians?" }), deps(db, modelo));
  assertEquals(pedidos, [7, 7]);
});

// Regra 12.5: football-data fora → o agente diz que não conseguiu atualizar os jogos (o servidor garante a
// frase mesmo se o modelo esquecer) e a ferramenta avisa o modelo.
Deno.test("verifier 8.9 (12.5): jogos desatualizados → resposta diz que não conseguiu atualizar", async () => {
  const { db } = fakeDb();
  Object.assign(db, { jogosAtualizados: () => Promise.resolve(false) });
  db.jogos = () => Promise.resolve([
    { jogo_id: "j1", competicao: "Brasileirão", mandante: "Corinthians", visitante: "Palmeiras", inicio: "2026-11-08T22:00:00Z" },
  ]);
  const { modelo, chamadas } = fakeModelo([
    usoFerramenta("t1", "jogos_de_hoje", { time: "Corinthians" }),
    textoFinal("Tem Corinthians x Palmeiras às 19h."),
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "jogo do Corinthians hoje" }), deps(db, modelo))).json();
  const resultado = JSON.parse((chamadas[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0].content as string);
  assertEquals(resultado.atualizacao_falhou, true);
  assert(/não consegui atualizar os jogos/i.test(corpo.texto), corpo.texto);
});

Deno.test("verifier 8.9 (12.5): jogos em dia → nada de aviso", async () => {
  const { db } = fakeDb();
  Object.assign(db, { jogosAtualizados: () => Promise.resolve(true) });
  const { modelo, chamadas } = fakeModelo([
    usoFerramenta("t1", "jogos_de_hoje", { time: "Corinthians" }),
    textoFinal("Hoje não tem jogo do Corinthians."),
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "jogo do Corinthians hoje" }), deps(db, modelo))).json();
  const resultado = JSON.parse((chamadas[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0].content as string);
  assertFalse("atualizacao_falhou" in resultado);
  // A intenção do teste é não haver o aviso da 12.5. Desde o bug do 8.11 o aviso de cobertura pode vir junto.
  assertFalse(/não consegui atualizar/i.test(corpo.texto), corpo.texto);
  assert(corpo.texto.startsWith("Hoje não tem jogo do Corinthians."), corpo.texto);
});

Deno.test("verifier 8.9 (menor): só cards com jogos desatualizados → texto padrão e o aviso", async () => {
  const { db } = fakeDb();
  db.jogosAtualizados = () => Promise.resolve(false);
  db.jogos = () => Promise.resolve([
    { jogo_id: "j1", competicao: "Brasileirão", mandante: "Corinthians", visitante: "Palmeiras", inicio: "2026-11-08T22:00:00Z" },
  ]);
  const { modelo } = fakeModelo([
    usoFerramenta("t1", "jogos_de_hoje", { time: "Corinthians" }),
    { stop_reason: "tool_use", content: [
      { type: "tool_use", id: "t2", name: "mostrar", input: { blocos: [{ tipo: "jogos", jogo_ids: ["j1"] }] } } as Anthropic.ToolUseBlock,
    ] },
    textoFinal(""),
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "jogo do Corinthians" }), deps(db, modelo))).json();
  assertEquals(corpo.texto, `${TEXTOS.soCards}\n\n${TEXTOS.jogosDesatualizados}`);
});

// Bug real do 8.11 (print da loja): com o horário em UTC, o modelo fazia a conta de fuso em voz alta
// ("23:30 UTC = 20:30 em SP.") e isso virava a resposta. A ferramenta entrega o horário já em São Paulo.
Deno.test("bug do 8.11: jogos_de_hoje entrega o horário em São Paulo (inicio_sp)", async () => {
  const { db } = fakeDb();
  db.jogos = () => Promise.resolve([
    { jogo_id: "j1", competicao: "Brasileirão", mandante: "Chapecoense", visitante: "Vasco da Gama", inicio: "2026-11-14T23:30:00Z" },
  ]);
  const { modelo, chamadas } = fakeModelo([usoFerramenta("t1", "jogos_de_hoje", { time: "Vasco" }), textoFinal("Sábado tem Vasco.")]);
  await handleAgente(req({ mensagem: "quando joga o Vasco?" }), deps(db, modelo));
  const resultado = JSON.parse((chamadas[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0].content as string);
  assertEquals(resultado.jogos_do_time[0].inicio_sp, "sáb 14/11 20:30");
  assertFalse("inicio" in resultado.jogos_do_time[0]);
});

// Bug real do 8.11: o Vasco jogava hoje fora do Brasileirão e o agente afirmou "Hoje o Vasco não joga". A base
// só tem as competições do plano grátis do football-data; a ferramenta diz isso ao modelo para ele não
// afirmar ausência de jogo.
Deno.test("bug do 8.11: jogos_de_hoje informa a cobertura", async () => {
  const { db } = fakeDb();
  const { modelo, chamadas } = fakeModelo([usoFerramenta("t1", "jogos_de_hoje", { time: "Vasco" }), textoFinal("Não achei.")]);
  await handleAgente(req({ mensagem: "o Vasco joga hoje?" }), deps(db, modelo));
  const resultado = JSON.parse((chamadas[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0].content as string);
  // Emenda do 8.11 (API-Football): Copa do Brasil e estaduais passam a ser cobertos; o que fica de fora é Série C, base e feminino.
  assert(/Copa do Brasil/.test(resultado.cobertura) && /Paulistão/.test(resultado.cobertura) && /Não inclui Série C/.test(resultado.cobertura), resultado.cobertura);
});

// Bug real do 8.11 (2ª parte): mesmo com a cobertura no resultado e o prompt v9, o modelo respondeu "Hoje o
// Vasco não joga, Alexandre." O servidor reescreve a afirmação e garante o aviso de cobertura.
Deno.test("bug do 8.11: sem jogo hoje na base, a resposta não afirma que o time não joga", async () => {
  const { db } = fakeDb();
  db.jogos = () => Promise.resolve([
    { jogo_id: "j1", competicao: "Brasileirão", mandante: "Chapecoense", visitante: "Vasco da Gama", inicio: new Date(Date.now() + 6 * 86_400_000).toISOString() },
  ]);
  const { modelo } = fakeModelo([
    usoFerramenta("t1", "jogos_de_hoje", { time: "Vasco", dias_a_frente: 7 }),
    textoFinal("Hoje o Vasco não joga, Alexandre. O próximo jogo é Chapecoense x Vasco, sábado (14/11) às 20h30."),
  ]);
  const corpo = await (await handleAgente(req({ mensagem: "o vasco joga hoje?" }), deps(db, modelo))).json();
  assertFalse(/não joga/i.test(corpo.texto), corpo.texto);
  assert(corpo.texto.includes(TEXTOS.coberturaJogos), corpo.texto);
  assert(/O próximo jogo é Chapecoense x Vasco/.test(corpo.texto), corpo.texto);
});

Deno.test("bug do 8.11: com jogo do time hoje, nada é reescrito", async () => {
  const { db } = fakeDb();
  db.jogos = () => Promise.resolve([
    { jogo_id: "j1", competicao: "Brasileirão", mandante: "Vasco da Gama", visitante: "Bahia", inicio: new Date(Date.now() + 60_000).toISOString() },
  ]);
  const { modelo } = fakeModelo([usoFerramenta("t1", "jogos_de_hoje", { time: "Vasco" }), textoFinal("Tem Vasco hoje.")]);
  const corpo = await (await handleAgente(req({ mensagem: "o vasco joga hoje?" }), deps(db, modelo))).json();
  assertEquals(corpo.texto, "Tem Vasco hoje.");
});
