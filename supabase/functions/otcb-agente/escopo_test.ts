// Testes do porteiro de escopo (8.11): resposta do modelo simulada, sem rede.
import { assertEquals } from "jsr:@std/assert@1";
import type Anthropic from "npm:@anthropic-ai/sdk@^0";

import { criarPorteiroEscopo } from "./escopo.ts";

const resposta = (text: string) => Promise.resolve({ content: [{ type: "text", text }], stop_reason: "end_turn" } as unknown as Anthropic.Message);

Deno.test("porteiro: lê o JSON do modelo", async () => {
  assertEquals(await criarPorteiroEscopo("k", () => resposta('{"no_escopo": false}'))("faz meu TCC"), false);
  assertEquals(await criarPorteiroEscopo("k", () => resposta('{"no_escopo": true}'))("bar no Itaim"), true);
});

Deno.test("porteiro: resposta fora do contrato lança (o handler deixa passar)", async () => {
  let lançou = false;
  try { await criarPorteiroEscopo("k", () => resposta("talvez"))("oi"); } catch { lançou = true; }
  assertEquals(lançou, true);
});
