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
