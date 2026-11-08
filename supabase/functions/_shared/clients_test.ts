import { assertEquals, assertRejects } from "jsr:@std/assert@1";

import { validarClassificacao } from "./claude.ts";
import { ExternalServiceError } from "./errors.ts";
import { createFirecrawlClient } from "./firecrawl.ts";
import { createGoogleClient } from "./google.ts";
import { errorMessage, sanitize } from "./sanitize.ts";

// Testes dos clientes externos com respostas gravadas (seção 22) e da sanitização (critério 6 do 8.3).
const fixture = (nome: string) => Deno.readTextFileSync(new URL(`./fixtures/${nome}`, import.meta.url));

function fakeFetch(body: string, status = 200, chamadas: { url: string; init?: RequestInit }[] = []): typeof fetch {
  return ((url: string, init?: RequestInit) => {
    chamadas.push({ url, init });
    return Promise.resolve(new Response(body, { status }));
  }) as unknown as typeof fetch;
}

Deno.test("google.searchText normaliza o Text Search e manda a chave só no cabeçalho", async () => {
  const chamadas: { url: string; init?: RequestInit }[] = [];
  const g = createGoogleClient("AIzaChaveDeTesteGoogle0000000000", fakeFetch(fixture("google_text_search.json"), 200, chamadas));
  const lugares = await g.searchText("bar chopp Brahma Pinheiros São Paulo", 10);
  assertEquals(lugares.length, 2);
  assertEquals(lugares[0], {
    placeId: "ChIJ_bar_da_esquina", nome: "Bar da Esquina", endereco: "R. dos Pinheiros, 100 - Pinheiros, São Paulo - SP",
    latitude: -23.565, longitude: -46.683, businessStatus: "OPERATIONAL", bairro: "Pinheiros",
  });
  assertEquals(chamadas[0].url.includes("AIza"), false);
});

Deno.test("google.detailsReviews devolve avaliações com id e data", async () => {
  const g = createGoogleClient("k", fakeFetch(fixture("google_details_reviews.json")));
  const reviews = await g.detailsReviews("ChIJ_bar_da_esquina");
  assertEquals(reviews.length, 2);
  assertEquals(reviews[0].id, "places/ChIJ_bar_da_esquina/reviews/r1");
  assertEquals(reviews[0].publicadoEm, "2026-10-01T20:00:00Z");
});

Deno.test("google: 403 é fatal; 500 não é", async () => {
  const e403 = await assertRejects(() => createGoogleClient("k", fakeFetch("{}", 403)).detailsBasic("x"), ExternalServiceError);
  assertEquals(e403.fatal, true);
  const e500 = await assertRejects(() => createGoogleClient("k", fakeFetch("{}", 500)).detailsBasic("x"), ExternalServiceError);
  assertEquals(e500.fatal, false);
});

Deno.test("firecrawl: search e scrape normalizados; 402 (sem crédito) é fatal", async () => {
  const busca = await createFirecrawlClient("fc-k", fakeFetch(fixture("firecrawl_search.json"))).search("q", 5);
  assertEquals(busca, [{ url: "https://exemplo.test/cardapio-bar-da-esquina", titulo: "Cardápio — Bar da Esquina" }]);
  const pagina = await createFirecrawlClient("fc-k", fakeFetch(fixture("firecrawl_scrape.json"))).scrape("https://exemplo.test/x");
  assertEquals(pagina.titulo, "Cardápio — Bar da Esquina");
  assertEquals(pagina.markdown.includes("Chopp Brahma 300 ml"), true);
  const e = await assertRejects(() => createFirecrawlClient("fc-k", fakeFetch("{}", 402)).scrape("u"), ExternalServiceError);
  assertEquals(e.fatal, true);
});

Deno.test("validarClassificacao aceita o contrato 13.6 e recusa fora dele", () => {
  assertEquals(validarClassificacao(JSON.parse(fixture("claude_classificacao_sim.json")))?.menciona_chopp_brahma, "sim");
  assertEquals(validarClassificacao({ nome_bar: "x", menciona_chopp_brahma: "talvez", cita_outra_marca_de_chopp: false, transmite_jogos: "sim", data_conteudo: null, trecho: "" }), null);
  assertEquals(validarClassificacao({ nome_bar: "x", menciona_chopp_brahma: "sim", cita_outra_marca_de_chopp: false, transmite_jogos: "sim", data_conteudo: "ontem", trecho: "" }), null);
  assertEquals(validarClassificacao({ nome_bar: "x", menciona_chopp_brahma: "sim", cita_outra_marca_de_chopp: false, transmite_jogos: "nao", data_conteudo: null, trecho: "a".repeat(400) })?.trecho.length, 300);
});

Deno.test("sanitize remove chaves conhecidas, padrões de chave, Bearer e query strings", () => {
  const segredo = "segredo-do-cron-1234567890";
  const msg = `falhou com sk-ant-api03-ABCDEF e AIzaSyD1234567890123456789012 e fc-abcdef1234567890abcd ` +
    `Bearer eyJhbGciOi.eyJzdWIi.assinatura ${segredo} em https://api.test/x?key=AIzaQQQ&a=1`;
  const limpo = sanitize(msg, [segredo]);
  for (const vazado of ["sk-ant-api03", "AIzaSyD", "fc-abcdef", "eyJhbGciOi", segredo, "key=AIzaQQQ"]) {
    assertEquals(limpo.includes(vazado), false, `vazou ${vazado}`);
  }
  assertEquals(errorMessage(new Error("x")).startsWith("Error: x"), true);
});

Deno.test("firecrawl: 403 no scrape é site bloqueado, falha só do item (não é fatal)", async () => {
  // Achado na rodada real do 8.3: a busca funcionou e o scrape de uma página devolveu 403; a execução inteira falhou.
  const e = await assertRejects(() => createFirecrawlClient("fc-k", fakeFetch("{}", 403)).scrape("https://instagram.test/bar"), ExternalServiceError);
  assertEquals(e.fatal, false);
  const e401 = await assertRejects(() => createFirecrawlClient("fc-k", fakeFetch("{}", 401)).scrape("https://x.test"), ExternalServiceError);
  assertEquals(e401.fatal, true);
});

Deno.test("google: 400 com API_KEY_INVALID é fatal (chave inválida); outros 400 não", async () => {
  // Achado do verifier no 8.3: o Google responde 400 (não 401/403) para chave inválida.
  const corpo = JSON.stringify({ error: { code: 400, status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } });
  const e = await assertRejects(() => createGoogleClient("k", fakeFetch(corpo, 400)).detailsBasic("x"), ExternalServiceError);
  assertEquals(e.fatal, true);
  const outro = await assertRejects(() => createGoogleClient("k", fakeFetch(JSON.stringify({ error: { status: "INVALID_ARGUMENT" } }), 400)).detailsBasic("x"), ExternalServiceError);
  assertEquals(outro.fatal, false);
});
