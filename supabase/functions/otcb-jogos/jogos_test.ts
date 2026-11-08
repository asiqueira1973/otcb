// Testes da otcb-jogos (13.9; épico 8.9) com a resposta gravada do football-data (fixture), sem rede.
import { assertEquals, assertFalse } from "jsr:@std/assert@1";

import { handleJogos } from "./handler.ts";
import { janela, mapearPartidas } from "./jogos.ts";

const FIXTURE = JSON.parse(await Deno.readTextFile(new URL("../_shared/fixtures/football-matches.json", import.meta.url)));
const req = (segredo = "s3gredo") => new Request("http://x/otcb-jogos", { method: "POST", headers: { "x-otcb-cron": segredo } });

function deps(status = 200, corpo: unknown = FIXTURE) {
  const gravados: unknown[] = [];
  const logs: unknown[] = [];
  return {
    gravados, logs,
    d: {
      segredoCron: "s3gredo",
      buscar: () => Promise.resolve({ status, corpo }),
      gravar: (dados: unknown) => { gravados.push(dados); return Promise.resolve({ gravados: 1, apagados: 0 }); },
      agora: () => new Date("2026-11-08T03:30:00Z"), // 00:30 em SP
      log: (e: unknown) => logs.push(e),
    },
  };
}

Deno.test("13.9: mapeia nome curto, competição em português e apaga cancelados", () => {
  const { jogos, cancelados } = mapearPartidas(FIXTURE);
  const fora = FIXTURE.matches.filter((m: { status: string }) => ["CANCELLED", "POSTPONED", "SUSPENDED", "AWARDED"].includes(m.status))
    .map((m: { id: number }) => String(m.id));
  assertEquals(cancelados, fora);
  assertEquals(cancelados.includes(String(FIXTURE.matches[1].id)), true);
  const corinthians = jogos.find((j) => j.id_externo === "999")!;
  assertEquals(corinthians, { id_externo: "999", competicao: "Brasileirão", mandante: "Corinthians", visitante: "SE Palmeiras", inicio: "2026-11-10T22:00:00Z" });
  assertEquals(jogos.length, FIXTURE.matches.length - fora.length);
});

Deno.test("janela de 7 dias no dia de São Paulo (00:30 em SP ainda é dia 8)", () => {
  assertEquals(janela(new Date("2026-11-08T03:30:00Z")), { de: "2026-11-08", ate: "2026-11-15" });
  assertEquals(janela(new Date("2026-11-08T02:30:00Z")), { de: "2026-11-07", ate: "2026-11-14" });
});

Deno.test("grava o que veio; sem o segredo do cron → 401 sem buscar", async () => {
  const x = deps();
  const res = await handleJogos(req(), x.d);
  assertEquals(res.status, 200);
  assertEquals(x.gravados.length, 1);
  const y = deps();
  assertEquals((await handleJogos(req("errado"), y.d)).status, 401);
  assertEquals(y.gravados.length, 0);
});

Deno.test("12.5: football-data fora (4xx/5xx) mantém os jogos gravados e o log não leva chave", async () => {
  for (const status of [403, 429, 500]) {
    const x = deps(status, null);
    assertEquals((await handleJogos(req(), x.d)).status, 502);
    assertEquals(x.gravados.length, 0);
    assertFalse(JSON.stringify(x.logs).includes("s3gredo"));
  }
});

// ===================================================================== verifier do 8.9 (12.5)

// Cada execução fica registrada em otcb_execucoes_garimpo (tipo 'jogos'): é por ela que o agente sabe que
// não conseguiu atualizar os jogos.
function depsComRegistro(buscar: () => Promise<{ status: number; corpo: unknown }>, gravar?: () => Promise<{ gravados: number; apagados: number }>) {
  const x = deps();
  const registros: { status: string; erros: unknown }[] = [];
  const d = {
    ...x.d, buscar,
    ...(gravar ? { gravar } : {}),
    registrar: (status: "concluida" | "falhou", erros: unknown) => { registros.push({ status, erros }); return Promise.resolve(); },
  };
  return { ...x, d, registros };
}

Deno.test("verifier 8.9 (12.5): execução concluída e falha ficam registradas", async () => {
  const ok = depsComRegistro(() => Promise.resolve({ status: 200, corpo: FIXTURE }));
  assertEquals((await handleJogos(req(), ok.d)).status, 200);
  assertEquals(ok.registros.map((r) => r.status), ["concluida"]);

  const fora = depsComRegistro(() => Promise.resolve({ status: 503, corpo: null }));
  assertEquals((await handleJogos(req(), fora.d)).status, 502);
  assertEquals(fora.registros, [{ status: "falhou", erros: { football_data: 503 } }]);
});

Deno.test("verifier 8.9: falha ao gravar → 500, registra falha e não vaza detalhe", async () => {
  const x = depsComRegistro(() => Promise.resolve({ status: 200, corpo: FIXTURE }), () => Promise.reject(new Error("db_jogos: boom")));
  const res = await handleJogos(req(), x.d);
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { codigo: "falha_ao_gravar" });
  assertEquals(x.registros.map((r) => r.status), ["falhou"]);
});

Deno.test("verifier 8.9: erro de rede com a chave na mensagem não vai ao log", async () => {
  const x = depsComRegistro(() => Promise.reject(new Error("X-Auth-Token CHAVE-FD-123 recusado")));
  assertEquals((await handleJogos(req(), x.d)).status, 502);
  assertFalse(JSON.stringify(x.logs).includes("CHAVE-FD-123"));
  assertFalse(JSON.stringify(x.registros).includes("CHAVE-FD-123"));
});
