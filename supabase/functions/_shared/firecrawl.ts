import { ExternalServiceError, isFatalStatus } from "./errors.ts";

// Cliente mínimo do Firecrawl para o garimpo (seções 4.1 e 8.3; regra 11.17: créditos contados por chamada).

export type FirecrawlResult = { url: string; titulo: string };
export type FirecrawlPage = { url: string; titulo: string; markdown: string };

export interface FirecrawlClient {
  // Busca na web. Devolve até `limit` resultados (URL e título).
  search(query: string, limit: number): Promise<FirecrawlResult[]>;
  // Extrai o texto principal (markdown) de uma página.
  scrape(url: string): Promise<FirecrawlPage>;
}

// Cria o cliente. Recebe: chave e fetch (injetável). Devolve: FirecrawlClient.
// Erros viram ExternalServiceError sem a chave. Fatais (chave ou crédito): 401 e 402. No scrape, 403 é
// site bloqueado/não suportado pelo Firecrawl — falha só daquele item (critério 5 do 8.3).
export function createFirecrawlClient(apiKey: string, fetchFn: typeof fetch = fetch): FirecrawlClient {
  async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetchFn(`https://api.firecrawl.dev/v1/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      await res.body?.cancel();
      const fatal = isFatalStatus(res.status) && !(path === "scrape" && res.status === 403);
      throw new ExternalServiceError("firecrawl", res.status, fatal, path);
    }
    return await res.json();
  }

  return {
    async search(query, limit) {
      const body = await post("search", { query, limit, lang: "pt", country: "br" });
      const data = (body.data ?? []) as { url?: string; title?: string }[];
      return data.filter((d) => d.url).map((d) => ({ url: d.url!, titulo: d.title ?? "" }));
    },
    async scrape(url) {
      const body = await post("scrape", { url, formats: ["markdown"], onlyMainContent: true, timeout: 30000 });
      const data = (body.data ?? {}) as { markdown?: string; metadata?: { title?: string; sourceURL?: string } };
      return { url: data.metadata?.sourceURL ?? url, titulo: data.metadata?.title ?? "", markdown: data.markdown ?? "" };
    },
  };
}
