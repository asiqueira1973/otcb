// Testes da troca para a API-Football (emenda do 8.11): cobertura de Copa do Brasil, Série B, estaduais e
// Seleção, com resposta real gravada (fixture), sem rede.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";

import { diasDaJanela, erroDaApi, mapearFixtures } from "./apifootball.ts";

const FIXTURE = JSON.parse(await Deno.readTextFile(new URL("../_shared/fixtures/api-football-fixtures.json", import.meta.url)));

Deno.test("API-Football: Vasco x Palmeiras da Copa do Brasil entra, com nome e competição em português", () => {
  const { jogos } = mapearFixtures([FIXTURE]);
  const vasco = jogos.find((j) => j.id_externo === "af:1638198");
  assertEquals(vasco, {
    id_externo: "af:1638198", competicao: "Copa do Brasil", mandante: "Vasco da Gama", visitante: "Palmeiras",
    inicio: "2026-11-08T20:00:00.000Z",
  });
  assert(jogos.some((j) => j.competicao === "Série B"));
});

Deno.test("API-Football: sub-20, torneio asiático e amistoso sem o Brasil ficam de fora; amistoso da Seleção entra", () => {
  const { jogos } = mapearFixtures([FIXTURE]);
  assertFalse(jogos.some((j) => /U17|U20/.test(j.mandante + j.visitante)));
  assertFalse(jogos.some((j) => j.mandante === "Peru"));
  assertEquals(jogos.find((j) => j.id_externo === "af:999002")?.competicao, "Amistoso");
  assertEquals(jogos.length, 3);
});

Deno.test("API-Football: adiado vai para cancelados (apagar)", () => {
  const { cancelados, jogos } = mapearFixtures([FIXTURE]);
  assertEquals(cancelados, ["af:999001"]);
  assertFalse(jogos.some((j) => j.id_externo === "af:999001"));
});

Deno.test("API-Football: janela de 8 dias (hoje + 7) no dia de São Paulo", () => {
  const dias = diasDaJanela(new Date("2026-11-08T02:30:00Z")); // 23:30 do dia 7 em SP
  assertEquals(dias.length, 8);
  assertEquals(dias[0], "2026-11-07");
  assertEquals(dias[7], "2026-11-14");
});

Deno.test("API-Football: erro vem no corpo com HTTP 200 (chave, limite) e é detectado", () => {
  assertEquals(erroDaApi({ errors: { token: "Error/Missing application key." }, response: [] }), "token");
  assertEquals(erroDaApi({ errors: { requests: "You have reached the request limit for the day" }, response: [] }), "requests");
  assertEquals(erroDaApi({ errors: [], response: [] }), null);
});

Deno.test("API-Football: carga sem nenhum jogo é registrada como falha e mantém os jogos gravados", async () => {
  const { handleJogos } = await import("./handler.ts");
  const registros: string[] = [];
  let gravou = false;
  const res = await handleJogos(new Request("http://x/otcb-jogos", { method: "POST", headers: { "x-otcb-cron": "s" } }), {
    segredoCron: "s",
    buscar: () => Promise.resolve({ status: 200, corpo: [{ errors: [], response: [] }] }),
    mapear: mapearFixtures,
    gravar: () => { gravou = true; return Promise.resolve({ gravados: 0, apagados: 0 }); },
    agora: () => new Date("2026-11-08T12:00:00Z"),
    log: () => undefined,
    registrar: (status) => { registros.push(status); return Promise.resolve(); },
  });
  assertEquals(res.status, 502);
  assertFalse(gravou);
  assertEquals(registros, ["falhou"]);
});
