// Testes de createAgenteDb (verifier do 8.9) com um cliente Supabase falso que respeita o limit, sem rede.
import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { createAgenteDb } from "./db.ts";

// Cliente falso: from(tabela) devolve um construtor encadeável; o resultado respeita limit() como o PostgREST.
function fakeCliente(tabelas: Record<string, Record<string, unknown>[]>) {
  return {
    from(tabela: string) {
      let n: number | null = null;
      let unico = false;
      const linhas = () => (n === null ? tabelas[tabela] ?? [] : (tabelas[tabela] ?? []).slice(0, n));
      const q: Record<string, unknown> = {};
      for (const m of ["select", "gte", "lt", "eq", "order", "or", "ilike", "in"]) q[m] = () => q;
      q.limit = (x: number) => { n = x; return q; };
      q.maybeSingle = () => { unico = true; return q; };
      q.then = (ok: (r: unknown) => unknown) => ok({ data: unico ? linhas()[0] ?? null : linhas(), error: null });
      return q;
    },
  } as unknown as SupabaseClient;
}

const jogo = (i: number, mandante = `Time ${i}`) => ({
  id: `j${i}`, competicao: "Premier League", mandante, visitante: `Rival ${i}`, inicio: new Date(Date.now() + i * 60_000).toISOString(),
});

Deno.test("verifier 8.9 (critério 2): o jogo do time aparece mesmo depois de 50 outros jogos na janela", async () => {
  const jogos = Array.from({ length: 60 }, (_, i) => jogo(i));
  jogos[55] = jogo(55, "Corinthians");
  const db = createAgenteDb(fakeCliente({}), fakeCliente({ otcb_jogos: jogos }));
  const r = await db.jogos("corinthians", 7);
  assertEquals(r[0].jogo_id, "j55");
});

Deno.test("verifier 8.9 (12.5): jogos em dia só com a última execução concluída há menos de 36 h", async () => {
  const exec = (status: string, horas: number) => ({ status, iniciado_em: new Date(Date.now() - horas * 3_600_000).toISOString() });
  const caso = (linhas: Record<string, unknown>[]) =>
    createAgenteDb(fakeCliente({ otcb_execucoes_garimpo: linhas }), fakeCliente({})).jogosAtualizados();
  assertEquals(await caso([exec("concluida", 2)]), true);
  assertEquals(await caso([exec("falhou", 2)]), false);
  assertEquals(await caso([exec("concluida", 40)]), false);
  assertEquals(await caso([]), false);
});
