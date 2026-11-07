import { assertEquals } from "jsr:@std/assert@1";

// Teste de fumaça do épico 8.0: prova que `deno test supabase/functions` encontra e roda testes.
// As Edge Functions da seção 13 trazem seus próprios testes a partir do épico 8.3.
Deno.test("esqueleto das Edge Functions roda no Deno", () => {
  assertEquals(typeof Deno.version.deno, "string");
});
