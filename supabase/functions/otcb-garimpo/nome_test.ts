// Nome do bar vindo do Google (displayName) com título de SEO (pedido do Alexandre, 19/11/2026): só o nome curto.
import { assertEquals } from "jsr:@std/assert@1";

import { limparNomeBar } from "./nome.ts";

Deno.test("nome com título de SEO vira o nome curto", () => {
  assertEquals(limparNomeBar("Bar do Juarez Itaim Bibi: Chopp, Picanha, Feijoada, Almoço, Drinks, Delivery SP"), "Bar do Juarez Itaim Bibi");
  assertEquals(limparNomeBar("Bar Dois Irmãos - O melhor bar da zona sul de São Paulo, música ao vivo, pizza crocante e chopp gelado"), "Bar Dois Irmãos");
  assertEquals(limparNomeBar("Boteco do Zé | Chopp gelado, petiscos e futebol na TV todo dia"), "Boteco do Zé");
});

Deno.test("nome de filial curto com separador fica como está", () => {
  assertEquals(limparNomeBar("Sao Conrado - Vila Madalena"), "Sao Conrado - Vila Madalena");
  assertEquals(limparNomeBar("  Pirajá Faria Lima  "), "Pirajá Faria Lima");
});

Deno.test("nome longo sem separador é cortado no fim de palavra", () => {
  const n = limparNomeBar("Bar e Restaurante Tradicional da Esquina com Chopp Gelado e Música Ao Vivo Toda Sexta");
  assertEquals(n, "Bar e Restaurante Tradicional da Esquina com Chopp Gelado e");
});
