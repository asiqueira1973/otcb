// Testes da otcb-opinioes (13.7; regras 11.6 e 11.7; critérios 4 e 5 do 8.5): banco e modelo simulados.
import { assertEquals, assertFalse } from "jsr:@std/assert@1";

import { verificarTermos } from "./bloqueio.ts";
import { handleOpinioes, type OpinioesDb, validarOpiniao } from "./handler.ts";
import { criarModerador, ModeracaoIndisponivel, type Moderador, validarVeredito } from "./moderacao.ts";

const BAR = "00000000-0000-0000-0000-000000000b01";

function fakeDb(opts: { existe?: boolean; limite?: boolean } = {}) {
  const estado = { salvas: [] as unknown[], recusadas: 0 };
  const db: OpinioesDb = {
    usuarioDoToken: (t) => Promise.resolve(t === "ok" ? "u1" : null),
    checarEdicao: () => opts.limite ? Promise.reject(new Error("db_otcb_checar_edicao: limite_edicao")) : Promise.resolve(!!opts.existe),
    salvar: (...a) => { estado.salvas.push(a); return Promise.resolve("op1"); },
    recusarEdicao: () => { estado.recusadas += 1; return Promise.resolve(); },
  };
  return { db, estado };
}

function moderador(v: { permitida: boolean; motivo: string } | Error) {
  const chamadas: string[] = [];
  const m: Moderador = {
    moderar: (t) => { chamadas.push(t); return v instanceof Error ? Promise.reject(v) : Promise.resolve(v as never); },
  };
  return { m, chamadas };
}

const req = (corpo: unknown, token = "ok") => new Request("http://x/otcb-opinioes", {
  method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo),
});

const deps = (db: OpinioesDb, m: Moderador, logs: unknown[] = []) => ({ db, moderador: () => m, log: (e: unknown) => logs.push(e) });

Deno.test("13.7: valida texto 10–500 e nota 1–5", () => {
  assertEquals(validarOpiniao({ bar_id: BAR, texto: "123456789" }), null);
  assertEquals(validarOpiniao({ bar_id: BAR, texto: "a".repeat(501) }), null);
  assertEquals(validarOpiniao({ bar_id: BAR, texto: "Chopp ótimo!", nota: 6 }), null);
  assertEquals(validarOpiniao({ bar_id: "x", texto: "Chopp ótimo!" }), null);
  assertEquals(validarOpiniao({ bar_id: BAR, texto: "  Chopp ótimo!  ", nota: 5 }), { barId: BAR, texto: "Chopp ótimo!", nota: 5 });
});

Deno.test("11.7: lista de termos pega telefone, e-mail, link, excesso e ofensa; crítica dura passa", () => {
  assertEquals(verificarTermos("Liga pro dono: (11) 98765-4321"), "dado_pessoal");
  assertEquals(verificarTermos("manda email pra joao@bar.com"), "dado_pessoal");
  assertEquals(verificarTermos("Promo em www.barx.com.br"), "spam");
  assertEquals(verificarTermos("Lugar bom pra encher a cara"), "consumo_excessivo");
  assertEquals(verificarTermos("O garçom é um babaca"), "ofensa");
  assertEquals(verificarTermos("Chopp quente e colarinho ralo, péssimo. Não volto."), null);
});

Deno.test("publica opinião aprovada pelo modelo", async () => {
  const { db, estado } = fakeDb();
  const { m, chamadas } = moderador({ permitida: true, motivo: "nenhum" });
  const res = await handleOpinioes(req({ bar_id: BAR, texto: "Colarinho caprichado", nota: 5 }), deps(db, m));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { opiniao_id: "op1", status: "publicada" });
  assertEquals(chamadas.length, 1);
  assertEquals(estado.salvas, [["u1", BAR, "Colarinho caprichado", 5]]);
});

Deno.test("critério 4: recusa pela lista não chama o modelo nem grava", async () => {
  const { db, estado } = fakeDb();
  const { m, chamadas } = moderador({ permitida: true, motivo: "nenhum" });
  const res = await handleOpinioes(req({ bar_id: BAR, texto: "Liga (11) 98765-4321 pra reservar" }), deps(db, m));
  assertEquals(res.status, 422);
  assertEquals((await res.json()).codigo, "recusada_moderacao");
  assertEquals(chamadas.length, 0);
  assertEquals(estado.salvas.length, 0);
});

Deno.test("critério 4 + 11.7: recusa do modelo numa edição oculta a versão publicada e não grava", async () => {
  const { db, estado } = fakeDb({ existe: true });
  const { m } = moderador({ permitida: false, motivo: "ofensa" });
  const res = await handleOpinioes(req({ bar_id: BAR, texto: "Texto que o modelo recusa" }), deps(db, m));
  assertEquals(res.status, 422);
  assertEquals(estado.recusadas, 1);
  assertEquals(estado.salvas.length, 0);
});

Deno.test("11.7: falha do modelo → 503 e não publica", async () => {
  const { db, estado } = fakeDb();
  const { m } = moderador(new ModeracaoIndisponivel("modelo_500"));
  const res = await handleOpinioes(req({ bar_id: BAR, texto: "Chopp bom demais aqui" }), deps(db, m));
  assertEquals(res.status, 503);
  assertEquals(estado.salvas.length, 0);
});

Deno.test("11.6: limite de edição → 429 antes de gastar IA", async () => {
  const { db } = fakeDb({ limite: true });
  const { m, chamadas } = moderador({ permitida: true, motivo: "nenhum" });
  const res = await handleOpinioes(req({ bar_id: BAR, texto: "Sexta edição do dia" }), deps(db, m));
  assertEquals(res.status, 429);
  assertEquals((await res.json()).codigo, "limite_edicao");
  assertEquals(chamadas.length, 0);
});

Deno.test("401 sem token, 422 com dados inválidos; o log nunca leva o texto", async () => {
  const { db } = fakeDb();
  const { m } = moderador({ permitida: false, motivo: "spam" });
  const logs: unknown[] = [];
  assertEquals((await handleOpinioes(req({ bar_id: BAR, texto: "Chopp bom" }, "ruim"), deps(db, m, logs))).status, 401);
  assertEquals((await handleOpinioes(req({ bar_id: BAR, texto: "curto" }), deps(db, m, logs))).status, 422);
  await handleOpinioes(req({ bar_id: BAR, texto: "Segredo do texto da opinião" }), deps(db, m, logs));
  assertFalse(JSON.stringify(logs).includes("Segredo"));
});

Deno.test("contrato do veredito", () => {
  assertEquals(validarVeredito({ permitida: true, motivo: "nenhum" }), { permitida: true, motivo: "nenhum" });
  assertEquals(validarVeredito({ permitida: "sim", motivo: "nenhum" }), null);
  assertEquals(validarVeredito({ permitida: false, motivo: "outro" }), null);
});

Deno.test("problema 4 do verifier (12.5): saída fora do contrato ganha 1 nova tentativa antes do 503", async () => {
  const respostas = ['{"permitida":"talvez"}', '{"permitida":true,"motivo":"nenhum"}'];
  let chamadas = 0;
  const m = criarModerador("x", () => {
    const t = respostas[chamadas++];
    return Promise.resolve({ stop_reason: "end_turn", content: [{ type: "text", text: t }] } as never);
  });
  assertEquals(await m.moderar("Chopp muito bom"), { permitida: true, motivo: "nenhum" });
  assertEquals(chamadas, 2);
});

Deno.test("bug real do 8.8: a moderação reserva tokens para o raciocínio do modelo (texto de ódio parava em max_tokens)", async () => {
  const pedidos: { max_tokens: number }[] = [];
  const m = criarModerador("x", (p) => {
    pedidos.push(p as never);
    return Promise.resolve({ stop_reason: "end_turn", content: [{ type: "text", text: '{"permitida":false,"motivo":"odio"}' }] } as never);
  });
  assertEquals(await m.moderar("texto"), { permitida: false, motivo: "odio" });
  if (pedidos[0].max_tokens < 2048) throw new Error(`max_tokens ${pedidos[0].max_tokens} não deixa espaço para o raciocínio`);
});
