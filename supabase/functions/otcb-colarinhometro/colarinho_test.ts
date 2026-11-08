// Testes da otcb-colarinhometro (13.5; regras 11.4–11.6; épico 8.6): banco e visão simulados, sem rede.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";

import { type ColarinhoDb, type FotoNova, handleColarinho } from "./handler.ts";
import { calcularNota, ehJpeg, faixaNota } from "./nota.ts";
import { type Avaliacao, criarVisao, validarAvaliacao, type Visao, VisaoIndisponivel } from "./visao.ts";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const CHOPP: Avaliacao = { e_chopp: true, nota_altura: 9, nota_cremosidade: 8, nota_copo: 7, nota_gelado: 8, comentario: "Colarinho de respeito!", pessoa_identificavel: false };

function fakeDb(opts: { hoje?: number; bar?: { bar_id: string; distancia_metros: number } | null; carimbo?: boolean } = {}) {
  const estado = { uploads: [] as string[], fotos: [] as FotoNova[] };
  const db: ColarinhoDb = {
    usuarioDoToken: (t) => Promise.resolve(t === "ok" ? "u1" : null),
    fotosHoje: () => Promise.resolve(opts.hoje ?? 0),
    barMaisProximo: () => Promise.resolve(opts.bar === undefined ? { bar_id: "b1", distancia_metros: 100 } : opts.bar),
    upload: (c) => { estado.uploads.push(c); return Promise.resolve(); },
    inserirFoto: (f) => { estado.fotos.push(f); return Promise.resolve(); },
    resultado: () => Promise.resolve({ carimbo_novo: !!opts.carimbo, motivo_sem_carimbo: opts.carimbo ? null : "sem_bar", nome_bar: "Bar b1", total_carimbos: 1 }),
  };
  return { db, estado };
}

function visao(v: Avaliacao | Error) {
  let chamadas = 0;
  const x: Visao = { avaliar: () => { chamadas++; return v instanceof Error ? Promise.reject(v) : Promise.resolve(v); } };
  return { x, chamadas: () => chamadas };
}

function req(campos: Record<string, string | Blob>, token = "ok") {
  const form = new FormData();
  for (const [k, v] of Object.entries(campos)) form.append(k, v);
  return new Request("http://x/otcb-colarinhometro", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
}
const foto = (bytes: Uint8Array = JPEG) => new File([bytes as Uint8Array<ArrayBuffer>], "f.jpg", { type: "image/jpeg" });
const base = () => ({ imagem: foto(), latitude: "-23.56", longitude: "-46.69", capturada_em: "2026-11-08T03:00:00Z", confirmou_brahma: "sim" });
const deps = (db: ColarinhoDb, v: Visao, logs: unknown[] = []) => ({ db, visao: () => v, modelo: "claude-haiku-5-5", novoId: () => "f1", log: (e: unknown) => logs.push(e) });

Deno.test("11.5: nota final com pesos 35/25/20/20 e 1 casa; faixas da telemetria", () => {
  assertEquals(calcularNota({ nota_altura: 9, nota_cremosidade: 8, nota_copo: 7, nota_gelado: 8 }), 8.2);
  assertEquals(calcularNota({ nota_altura: 10, nota_cremosidade: 10, nota_copo: 10, nota_gelado: 10 }), 10);
  assertEquals(calcularNota({ nota_altura: 7.5, nota_cremosidade: 6.5, nota_copo: 8.5, nota_gelado: 7.5 }), 7.5); // 7,45 → 7,5 (meio para cima)
  assertEquals([faixaNota(4.9), faixaNota(5), faixaNota(8)], ["0-4", "5-7", "8-10"]);
});

Deno.test("13.5: JPEG pelo conteúdo", () => {
  assert(ehJpeg(JPEG));
  assertFalse(ehJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47])));
});

Deno.test("critério 1/6: foto de chopp com 'Sim' grava em {usuario_id}/{foto_id}.jpg e devolve resultado_colarinho", async () => {
  const { db, estado } = fakeDb({ carimbo: true });
  const { x } = visao(CHOPP);
  const res = await handleColarinho(req(base()), deps(db, x));
  assertEquals(res.status, 200);
  const corpo = await res.json();
  assertEquals(corpo.bloco, {
    tipo: "resultado_colarinho", foto_id: "f1", nome_bar: "Bar b1", nota_colarinho: 8.2, nota_altura: 9, nota_cremosidade: 8,
    nota_copo: 7, nota_gelado: 8, comentario_ia: "Colarinho de respeito!", carimbo_novo: true, motivo_sem_carimbo: null,
  });
  assertEquals(estado.uploads, ["u1/f1.jpg"]);
  assertEquals(estado.fotos[0].confirmou, true);
  assertEquals(estado.fotos[0].barId, "b1");
});

Deno.test("critério 3: 'Não sei' grava usuario_confirmou_brahma = false", async () => {
  const { db, estado } = fakeDb();
  const { x } = visao(CHOPP);
  await handleColarinho(req({ ...base(), confirmou_brahma: "nao_sei" }), deps(db, x));
  assertEquals(estado.fotos[0].confirmou, false);
});

Deno.test("sem localização: avalia sem bar", async () => {
  const { db, estado } = fakeDb();
  const { x } = visao(CHOPP);
  const { latitude: _a, longitude: _b, ...semLocal } = base();
  const res = await handleColarinho(req(semLocal), deps(db, x));
  assertEquals(res.status, 200);
  assertEquals(estado.fotos[0].barId, null);
});

Deno.test("critério 4: não é chopp → 422 nao_e_chopp, foto gravada sem nota", async () => {
  const { db, estado } = fakeDb();
  const { x } = visao({ ...CHOPP, e_chopp: false });
  const res = await handleColarinho(req(base()), deps(db, x));
  assertEquals(res.status, 422);
  assertEquals((await res.json()).codigo, "nao_e_chopp");
  assertEquals(estado.fotos[0].notas, null);
  assertEquals(estado.fotos[0].comentario, null);
});

Deno.test("11.6: 11ª foto do dia → 429 sem chamar a IA", async () => {
  const { db, estado } = fakeDb({ hoje: 10 });
  const v = visao(CHOPP);
  const res = await handleColarinho(req(base()), deps(db, v.x));
  assertEquals(res.status, 429);
  assertEquals((await res.json()).codigo, "limite_fotos");
  assertEquals(v.chamadas(), 0);
  assertEquals(estado.uploads.length, 0);
});

Deno.test("13.5: imagem > 1 MB → 413; não-JPEG ou confirmação inválida → 422; sem token → 401", async () => {
  const { db } = fakeDb();
  const { x } = visao(CHOPP);
  const grande = new Uint8Array(1024 * 1024 + 1); grande.set(JPEG);
  assertEquals((await handleColarinho(req({ ...base(), imagem: foto(grande) }), deps(db, x))).status, 413);
  assertEquals((await handleColarinho(req({ ...base(), imagem: foto(new Uint8Array([1, 2, 3, 4])) }), deps(db, x))).status, 422);
  assertEquals((await handleColarinho(req({ ...base(), confirmou_brahma: "talvez" }), deps(db, x))).status, 422);
  assertEquals((await handleColarinho(req(base(), "ruim"), deps(db, x))).status, 401);
});

Deno.test("falha da IA → 503 e nada gravado", async () => {
  const { db, estado } = fakeDb();
  const { x } = visao(new VisaoIndisponivel("modelo_500"));
  const res = await handleColarinho(req(base()), deps(db, x));
  assertEquals(res.status, 503);
  assertEquals(estado.uploads.length + estado.fotos.length, 0);
});

Deno.test("seção 20: o log não leva localização nem imagem", async () => {
  const { db } = fakeDb({ carimbo: true });
  const { x } = visao(CHOPP);
  const logs: unknown[] = [];
  await handleColarinho(req(base()), deps(db, x, logs));
  const s = JSON.stringify(logs);
  assertFalse(s.includes("-23.56"));
  assertFalse(s.includes("-46.69"));
  assertFalse(s.includes("/9j/"));
});

Deno.test("12.5: saída fora do contrato ganha 1 nova tentativa; comentário cortado em 120", async () => {
  const saidas = ['{"e_chopp":"sim"}', JSON.stringify({ ...CHOPP, comentario: "x".repeat(200) })];
  let n = 0;
  const v = criarVisao("k", () => Promise.resolve({ stop_reason: "end_turn", content: [{ type: "text", text: saidas[n++] }] } as never));
  const a = await v.avaliar("AAAA");
  assertEquals(n, 2);
  assertEquals(a.comentario.length, 120);
  assertEquals(validarAvaliacao({ ...CHOPP, nota_altura: 11 }), null);
});

Deno.test("bug real do 8.6: comentário longo é cortado no fim de palavra, com reticências, até 120 caracteres", () => {
  const longo = "Colarinho de dois dedos certinho, copo suado de tanto gelar e um balcão de madeira caprichado. Esse chopp está pedindo para ser fotografado.";
  const v = validarAvaliacao({ ...CHOPP, comentario: longo })!;
  assert(v.comentario.length <= 120, `${v.comentario.length}`);
  assert(v.comentario.endsWith("…"));
  assertFalse(/\s\S{1,2}…$/.test(v.comentario) && !longo.includes(v.comentario.slice(0, -1) + " "));
  assert(longo.startsWith(v.comentario.slice(0, -1).trimEnd()));
  assert(/[\p{L}.,!]…$/u.test(v.comentario), v.comentario);
  assertEquals(validarAvaliacao({ ...CHOPP, comentario: "Curto e bom." })!.comentario, "Curto e bom.");
  assert(longo.charAt(v.comentario.length - 1) === " " || /[.,!]/.test(v.comentario.at(-2)!), "termina numa palavra inteira");
});
