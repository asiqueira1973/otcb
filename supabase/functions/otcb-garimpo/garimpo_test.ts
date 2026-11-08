import { assert, assertEquals } from "jsr:@std/assert@1";

import type { Classificacao, ClaudeClient } from "../_shared/claude.ts";
import { ExternalServiceError } from "../_shared/errors.ts";
import type { FirecrawlClient } from "../_shared/firecrawl.ts";
import type { GoogleClient, GooglePlace } from "../_shared/google.ts";
import { dataDaEvidencia, evidenciasDaClassificacao, tipoDaPagina } from "./classificacao.ts";
import { executarLote, type Servicos } from "./executor.ts";
import { handleGarimpo } from "./handler.ts";
import { urlStatusGoogle } from "./modos.ts";
import type { BarRevisita, Cursor, GarimpoDb, Modo } from "./tipos.ts";

// Testes do garimpo (épico 8.3) com Google, Firecrawl e Claude simulados e um banco em memória que imita
// as funções SQL da migration 0800 (upsert por bar+assunto+url, casamento por place_id).

const fixture = (nome: string) => JSON.parse(Deno.readTextFileSync(new URL(`../_shared/fixtures/${nome}`, import.meta.url)));
const AGORA = Date.parse("2026-11-08T12:00:00Z");
const CHAVE_FALSA = "AIzaChaveFalsaDoGoogle1234567890XYZ";

type Evid = { barId: string; assunto: string; sinal: string; tipo: string; url: string; trecho: string | null; data: Date };

class FakeDb implements GarimpoDb {
  execucoes = new Map<string, { id: string; tipo: Modo; status: string; cursor: Cursor; erros: Record<string, unknown>[]; bares_novos: number; evidencias_criadas: number; chamadas_google: number; chamadas_firecrawl: number }>();
  evidencias: Evid[] = [];
  bares: { id: string; nome: string; placeId: string | null }[] = [];
  revisita: BarRevisita[] = [];
  disparos: string[] = [];
  usoDoMes: Record<string, number> = {};
  emAndamento = false;

  iniciarExecucao(tipo: Modo) {
    if (this.emAndamento) return Promise.resolve(null);
    const id = `exec-${this.execucoes.size + 1}`;
    this.execucoes.set(id, { id, tipo, status: "em_andamento", cursor: {}, erros: [], bares_novos: 0, evidencias_criadas: 0, chamadas_google: 0, chamadas_firecrawl: 0 });
    return Promise.resolve(id);
  }
  carregarExecucao(id: string) {
    const e = this.execucoes.get(id);
    return Promise.resolve(e ? structuredClone({ id: e.id, tipo: e.tipo, status: e.status, cursor: e.cursor, bares_novos: e.bares_novos, evidencias_criadas: e.evidencias_criadas }) : null);
  }
  salvarExecucao(id: string, d: Parameters<GarimpoDb["salvarExecucao"]>[1]) {
    const e = this.execucoes.get(id)!;
    Object.assign(e, { status: d.status, cursor: structuredClone(d.cursor), bares_novos: d.bares_novos, evidencias_criadas: d.evidencias_criadas,
      chamadas_google: d.chamadas_google, chamadas_firecrawl: d.chamadas_firecrawl });
    e.erros.push(...d.novosErros);
    return Promise.resolve();
  }
  usoMes() { return Promise.resolve(this.usoDoMes); }
  disparar(modo: Modo, id: string) { this.disparos.push(`${modo}:${id}`); return Promise.resolve(); }
  registrarEvidencia(e: Evid) {
    const atual = this.evidencias.find((x) => x.barId === e.barId && x.assunto === e.assunto && x.url === e.url);
    if (!atual) { this.evidencias.push({ ...e }); return Promise.resolve("criada" as const); }
    if (atual.sinal === e.sinal && atual.trecho === e.trecho && atual.data.getTime() === e.data.getTime()) return Promise.resolve("igual" as const);
    Object.assign(atual, e);
    return Promise.resolve("atualizada" as const);
  }
  casarOuCriarBar(c: Parameters<GarimpoDb["casarOuCriarBar"]>[0]) {
    const existente = this.bares.find((b) => c.placeId && b.placeId === c.placeId);
    if (existente) return Promise.resolve({ bar_id: existente.id, criado: false });
    if (!c.criar) return Promise.resolve({ bar_id: null, criado: false });
    const id = `bar-${this.bares.length + 1}`;
    this.bares.push({ id, nome: c.nome, placeId: c.placeId });
    return Promise.resolve({ bar_id: id, criado: true });
  }
  baresParaRevisita(limite: number, excluir: string[]) {
    return Promise.resolve(this.revisita.filter((b) => !excluir.includes(b.bar_id)).slice(0, limite));
  }
  baresParaCoordenadas() { return Promise.resolve([]); }
  atualizarCoordenadas() { return Promise.resolve(); }
  baresParaResumo() { return Promise.resolve([]); }
  opinioesPublicadas() { return Promise.resolve([]); }
  gravarResumo() { return Promise.resolve(true); }
}

const SIM: Classificacao = fixture("claude_classificacao_sim.json");

function lugar(placeId: string, status = "OPERATIONAL"): GooglePlace {
  return { placeId, nome: `Bar ${placeId}`, endereco: "Rua X", latitude: -23.56, longitude: -46.68, businessStatus: status, bairro: "Pinheiros" };
}

function servicos(db: FakeDb, over: Partial<{ google: Partial<GoogleClient>; firecrawl: Partial<FirecrawlClient>; claude: Partial<ClaudeClient> }> = {}): Servicos {
  const google: GoogleClient = {
    searchText: () => Promise.resolve([lugar("p1")]),
    detailsBasic: () => Promise.resolve({ businessStatus: "OPERATIONAL", latitude: -23.5, longitude: -46.6 }),
    detailsReviews: () => Promise.resolve([{ id: "places/p1/reviews/r1", texto: "chopp Brahma ótimo", publicadoEm: "2026-10-01T20:00:00Z" }]),
    ...over.google,
  };
  const firecrawl: FirecrawlClient = {
    search: () => Promise.resolve([]),
    scrape: (url) => Promise.resolve({ url, titulo: "Cardápio", markdown: fixture("firecrawl_scrape.json").data.markdown }),
    ...over.firecrawl,
  };
  const claude: ClaudeClient = {
    classify: (_t, _c, onAttempt) => { onAttempt(); return Promise.resolve(SIM); },
    summarize: (_o, onAttempt) => { onAttempt(); return Promise.resolve("Resumo."); },
    ...over.claude,
  };
  return { db, google, firecrawl, claude, segredos: [CHAVE_FALSA] };
}

function barRevisita(i: number, urls: string[] = []): BarRevisita {
  return { bar_id: `b${i}`, nome: `Bar ${i}`, bairro: "Pinheiros", google_place_id: `p${i}`, urls };
}

// ------------------------------------------------------------------------------------------ handler
Deno.test("handler: sem o segredo do cron devolve 401; modo inválido 400; já em andamento 409", async () => {
  const db = new FakeDb();
  const deps = { segredoCron: "segredo-de-teste-123", servicos: () => servicos(db), emSegundoPlano: (t: Promise<unknown>) => t as never };
  const post = (headers: Record<string, string>, body: unknown) =>
    new Request("http://x/otcb-garimpo", { method: "POST", headers, body: JSON.stringify(body) });
  assertEquals((await handleGarimpo(post({}, { modo: "revisita" }), deps)).status, 401);
  assertEquals((await handleGarimpo(post({ "x-otcb-cron": "errado" }, { modo: "revisita" }), deps)).status, 401);
  assertEquals((await handleGarimpo(post({ "x-otcb-cron": "segredo-de-teste-123" }, { modo: "jogos" }), deps)).status, 400);
  db.emAndamento = true;
  assertEquals((await handleGarimpo(post({ "x-otcb-cron": "segredo-de-teste-123" }, { modo: "revisita" }), deps)).status, 409);
});

// ------------------------------------------------------------------------------------------ revisita
Deno.test("revisita: CLOSED_PERMANENTLY grava status_google fechado; OPERATIONAL positivo; CLOSED_TEMPORARILY nada (critério 2)", async () => {
  const db = new FakeDb();
  db.revisita = [barRevisita(1), barRevisita(2), barRevisita(3)];
  const status: Record<string, string> = { p1: "CLOSED_PERMANENTLY", p2: "OPERATIONAL", p3: "CLOSED_TEMPORARILY" };
  const s = servicos(db, { google: { detailsBasic: (id) => Promise.resolve({ businessStatus: status[id], latitude: null, longitude: null }) } });
  const id = (await db.iniciarExecucao("revisita"))!;
  const r = await executarLote(id, "revisita", s, () => AGORA);
  assertEquals(r.status, "concluida");
  assertEquals(db.evidencias.map((e) => [e.barId, e.assunto, e.sinal, e.tipo, e.url]), [
    ["b1", "funcionamento", "fechado", "status_google", urlStatusGoogle("p1")],
    ["b2", "funcionamento", "positivo", "status_google", urlStatusGoogle("p2")],
  ]);
});

Deno.test("revisita duas vezes não duplica evidências (critério 3)", async () => {
  const db = new FakeDb();
  db.revisita = [barRevisita(1, ["https://exemplo.test/cardapio"])];
  const s = servicos(db);
  await executarLote((await db.iniciarExecucao("revisita"))!, "revisita", s, () => AGORA);
  const depoisDaPrimeira = db.evidencias.length;
  await executarLote((await db.iniciarExecucao("revisita"))!, "revisita", s, () => AGORA);
  // status_google + tem_brahma do cardápio (cardápio não gera transmite_jogos, tabela 11.1)
  assertEquals(depoisDaPrimeira, 2);
  assertEquals(db.evidencias.length, depoisDaPrimeira);
});

Deno.test("falha de um item vai para erros e o lote segue (critério 5)", async () => {
  const db = new FakeDb();
  db.revisita = [barRevisita(1), barRevisita(2)];
  const s = servicos(db, { google: { detailsBasic: (id) => id === "p1"
    ? Promise.reject(new ExternalServiceError("google", 500, false, "timeout"))
    : Promise.resolve({ businessStatus: "OPERATIONAL", latitude: null, longitude: null }) } });
  const id = (await db.iniciarExecucao("revisita"))!;
  const r = await executarLote(id, "revisita", s, () => AGORA);
  assertEquals(r.status, "concluida");
  assertEquals(db.execucoes.get(id)!.erros.map((e) => e.item), ["bar:b1"]);
  assertEquals(db.evidencias.map((e) => e.barId), ["b2"]);
});

Deno.test("resposta inválida da IA vira erro do item, não interrompe (critério 5)", async () => {
  const db = new FakeDb();
  db.revisita = [barRevisita(1, ["https://exemplo.test/a"]), barRevisita(2)];
  const s = servicos(db, { claude: { classify: (_t, _c, onAttempt) => { onAttempt(); onAttempt();
    return Promise.reject(new ExternalServiceError("claude", 0, false, "resposta_fora_do_contrato")); } } });
  const id = (await db.iniciarExecucao("revisita"))!;
  const r = await executarLote(id, "revisita", s, () => AGORA);
  assertEquals(r.status, "concluida");
  assertEquals(db.execucoes.get(id)!.erros.length, 1);
  assertEquals(db.execucoes.get(id)!.cursor.uso?.ia, 2);
});

Deno.test("teto por execução: termina concluida com o motivo em erros (critério 4)", async () => {
  const db = new FakeDb();
  db.revisita = [barRevisita(1), barRevisita(2)];
  const id = (await db.iniciarExecucao("revisita"))!;
  db.execucoes.get(id)!.cursor = { uso: { details_basico: 299 } };
  const r = await executarLote(id, "revisita", servicos(db), () => AGORA);
  assertEquals(r.status, "concluida");
  assertEquals(db.execucoes.get(id)!.erros.at(-1), { motivo: "teto_atingido", recurso: "details_basico", escopo: "execucao" });
  assertEquals(db.evidencias.length, 1);
});

Deno.test("teto mensal: termina concluida com o motivo (critério 4)", async () => {
  const db = new FakeDb();
  db.revisita = [barRevisita(1)];
  db.usoDoMes = { details_basico: 6000 };
  const id = (await db.iniciarExecucao("revisita"))!;
  const r = await executarLote(id, "revisita", servicos(db), () => AGORA);
  assertEquals(r.status, "concluida");
  assertEquals(db.execucoes.get(id)!.erros.at(-1), { motivo: "teto_atingido", recurso: "details_basico", escopo: "mes" });
});

Deno.test("chave inválida (403) é fatal: a execução falha (12.3)", async () => {
  const db = new FakeDb();
  db.revisita = [barRevisita(1), barRevisita(2)];
  const s = servicos(db, { google: { detailsBasic: () => Promise.reject(new ExternalServiceError("google", 403, true, "places")) } });
  const id = (await db.iniciarExecucao("revisita"))!;
  const r = await executarLote(id, "revisita", s, () => AGORA);
  assertEquals(r.status, "falhou");
  assertEquals(db.disparos.length, 0);
});

Deno.test("nenhuma chave aparece em erros nem no console (critério 6)", async () => {
  const db = new FakeDb();
  db.revisita = [barRevisita(1)];
  const logs: string[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => { logs.push(a.join(" ")); };
  try {
    const s = servicos(db, { google: { detailsBasic: () => Promise.reject(new Error(`falha em https://places.googleapis.com/v1/places/p1?key=${CHAVE_FALSA} usando ${CHAVE_FALSA}`)) } });
    const id = (await db.iniciarExecucao("revisita"))!;
    await executarLote(id, "revisita", s, () => AGORA);
    const tudo = JSON.stringify(db.execucoes.get(id)) + logs.join("\n");
    assertEquals(tudo.includes(CHAVE_FALSA), false);
    assert(tudo.includes("[redigido]"));
  } finally {
    console.error = original;
  }
});

Deno.test("no máximo 20 itens por invocação; o resto vai num novo lote reagendado via pg_net", async () => {
  const db = new FakeDb();
  db.revisita = Array.from({ length: 25 }, (_, i) => barRevisita(i + 1));
  const id = (await db.iniciarExecucao("revisita"))!;
  const r1 = await executarLote(id, "revisita", servicos(db), () => AGORA);
  assertEquals([r1.status, r1.itens], ["em_andamento", 20]);
  assertEquals(db.disparos, [`revisita:${id}`]);
  const r2 = await executarLote(id, "revisita", servicos(db), () => AGORA);
  assertEquals([r2.status, r2.itens], ["concluida", 5]);
  assertEquals(db.execucoes.get(id)!.cursor.posicao, undefined);
  assertEquals(db.execucoes.get(id)!.cursor.uso?.details_basico, 25);
  assertEquals(db.execucoes.get(id)!.chamadas_google, 25);
});

Deno.test("tempo esgotado pausa o lote e reagenda", async () => {
  const db = new FakeDb();
  db.revisita = [barRevisita(1), barRevisita(2), barRevisita(3)];
  let t = AGORA;
  const relogio = () => { const v = t; t += 60_000; return v; };
  const id = (await db.iniciarExecucao("revisita"))!;
  const r = await executarLote(id, "revisita", servicos(db), relogio);
  assertEquals(r.status, "em_andamento");
  assert(r.itens < 3);
});

// ------------------------------------------------------------------------------------------ descoberta
Deno.test("descoberta: cria bar com evidências de url_fonte e trecho (critério 1); fechado não entra", async () => {
  const db = new FakeDb();
  const s = servicos(db, {
    google: {
      searchText: (q) => Promise.resolve(q.startsWith("bar chopp Brahma") ? [lugar("p1"), lugar("p9", "CLOSED_PERMANENTLY")] : [lugar("p2")]),
    },
    firecrawl: { search: () => Promise.resolve([{ url: "https://exemplo.test/cardapio-bar-dois", titulo: "Cardápio do Bar Dois" }]) },
  });
  const id = (await db.iniciarExecucao("descoberta"))!;
  db.execucoes.get(id)!.cursor = { bairros: ["Pinheiros"] };
  const r = await executarLote(id, "descoberta", s, () => AGORA);
  assertEquals(r.status, "concluida");
  assertEquals(db.bares.map((b) => b.placeId), ["p1", "p2"]);
  assertEquals(db.execucoes.get(id)!.bares_novos, 2);
  for (const e of db.evidencias) {
    assert(e.url.length > 0, "url_fonte preenchida");
    assert((e.trecho ?? "").length > 0, "trecho preenchido");
  }
  assertEquals(db.evidencias.find((e) => e.barId === "bar-1")?.tipo, "avaliacao_google");
  assertEquals(db.evidencias.find((e) => e.barId === "bar-2")?.tipo, "cardapio_site");
});

Deno.test("descoberta: sem evidência positiva de Brahma não cria bar", async () => {
  const db = new FakeDb();
  const incerto: Classificacao = { ...SIM, menciona_chopp_brahma: "incerto", transmite_jogos: "incerto" };
  const s = servicos(db, { claude: { classify: (_t, _c, onAttempt) => { onAttempt(); return Promise.resolve(incerto); } } });
  const id = (await db.iniciarExecucao("descoberta"))!;
  db.execucoes.get(id)!.cursor = { bairros: ["Pinheiros"] };
  await executarLote(id, "descoberta", s, () => AGORA);
  assertEquals(db.bares.length, 0);
  assertEquals(db.evidencias.length, 0);
});

// --------------------------------------------------------------------------------------- mapeamento 13.6
Deno.test("mapeamento 13.6: sim → positiva; nao + outra marca em cardápio → negativa; incerto → nada", () => {
  const coleta = new Date(AGORA);
  assertEquals(evidenciasDaClassificacao(SIM, "pagina_web", coleta).map((e) => `${e.assunto}:${e.sinal}`), ["tem_brahma:positivo", "transmite_jogos:positivo"]);
  assertEquals(evidenciasDaClassificacao({ ...SIM, menciona_chopp_brahma: "nao", cita_outra_marca_de_chopp: true }, "cardapio_site", coleta)
    .map((e) => `${e.assunto}:${e.sinal}`), ["tem_brahma:negativo"]);
  assertEquals(evidenciasDaClassificacao({ ...SIM, menciona_chopp_brahma: "nao", cita_outra_marca_de_chopp: true }, "pagina_web", coleta)
    .filter((e) => e.assunto === "tem_brahma").length, 0);
  assertEquals(evidenciasDaClassificacao({ ...SIM, menciona_chopp_brahma: "incerto", transmite_jogos: "incerto" }, "pagina_web", coleta), []);
  assertEquals(evidenciasDaClassificacao({ ...SIM, menciona_chopp_brahma: "nao", cita_outra_marca_de_chopp: true }, "avaliacao_google", coleta), [
    { assunto: "transmite_jogos", sinal: "positivo", tipo: "avaliacao_google", trecho: SIM.trecho, data: coleta },
  ]);
});

Deno.test("data da evidência (11.1): data do conteúdo, senão coleta − 90 dias; data futura é ignorada", () => {
  const coleta = new Date(AGORA);
  assertEquals(dataDaEvidencia(SIM, coleta).toISOString().slice(0, 10), "2026-10-20");
  assertEquals(dataDaEvidencia({ ...SIM, data_conteudo: null }, coleta).getTime(), AGORA - 90 * 86_400_000);
  assertEquals(dataDaEvidencia({ ...SIM, data_conteudo: "2027-01-01" }, coleta).getTime(), AGORA - 90 * 86_400_000);
  assertEquals(dataDaEvidencia(SIM, coleta, "2026-09-15T20:00:00Z").toISOString(), "2026-09-15T20:00:00.000Z");
  assertEquals(tipoDaPagina("https://x.test/menu", ""), "cardapio_site");
  assertEquals(tipoDaPagina("https://x.test/blog", "10 bares"), "pagina_web");
});

Deno.test("descoberta: falha persistente na busca de um bairro não trava a execução (critério 5 / 12.5)", async () => {
  // Achado do verifier no 8.3: com o Firecrawl search sempre em 500, o mesmo bairro era reagendado até o teto.
  const db = new FakeDb();
  const buscasGoogle: string[] = [];
  const s = servicos(db, {
    google: { searchText: (q) => { buscasGoogle.push(q); return Promise.resolve(q.startsWith("bar chopp Brahma") ? [lugar(`p-${buscasGoogle.length}`)] : []); } },
    firecrawl: { search: () => Promise.reject(new ExternalServiceError("firecrawl", 500, false, "search")) },
  });
  const id = (await db.iniciarExecucao("descoberta"))!;
  db.execucoes.get(id)!.cursor = { bairros: ["Pinheiros", "Moema"] };
  const r = await executarLote(id, "descoberta", s, () => AGORA);
  assertEquals(r.status, "concluida");
  assertEquals(db.disparos.length, 0);
  assertEquals(buscasGoogle.filter((q) => q.startsWith("bar chopp Brahma")).length, 2, "cada bairro buscado uma vez");
  assertEquals(db.bares.length, 2, "o resultado do Google é aproveitado mesmo com o Firecrawl falhando");
  assertEquals(db.execucoes.get(id)!.erros.filter((e) => String(e.etapa).startsWith("busca:")).length, 2);
});
