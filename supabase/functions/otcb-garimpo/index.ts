// Edge Function otcb-garimpo (seção 13.6; épico 8.3): liga o handler aos serviços reais.
// Segredos só do ambiente da função (seção 20); nada é logado sem sanitização.
import { createClient } from "npm:@supabase/supabase-js@2";

import { createClaudeClient } from "../_shared/claude.ts";
import { createFirecrawlClient } from "../_shared/firecrawl.ts";
import { createGoogleClient } from "../_shared/google.ts";
import { errorMessage } from "../_shared/sanitize.ts";
import { createGarimpoDb } from "./db.ts";
import type { ResultadoLote } from "./executor.ts";
import { handleGarimpo } from "./handler.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const env = (nome: string) => Deno.env.get(nome) ?? "";
const segredos = ["ANTHROPIC_API_KEY", "GOOGLE_PLACES_API_KEY", "FIRECRAWL_API_KEY", "OTCB_CRON_SECRET", "SUPABASE_SERVICE_ROLE_KEY"].map(env);

Deno.serve((req) =>
  handleGarimpo(req, {
    segredoCron: env("OTCB_CRON_SECRET"),
    servicos: () => ({
      db: createGarimpoDb(createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: { persistSession: false, autoRefreshToken: false },
      })),
      google: createGoogleClient(env("GOOGLE_PLACES_API_KEY")),
      firecrawl: createFirecrawlClient(env("FIRECRAWL_API_KEY")),
      claude: createClaudeClient(env("ANTHROPIC_API_KEY")),
      segredos,
    }),
    // O lote roda depois da resposta 202 (o pg_net não espera); falhas inesperadas só vão sanitizadas ao log.
    emSegundoPlano: (tarefa: Promise<ResultadoLote>) => {
      const protegida = tarefa.catch((error) => {
        console.error("otcb-garimpo lote:", errorMessage(error, segredos));
        return null;
      });
      if (typeof EdgeRuntime !== "undefined") {
        EdgeRuntime.waitUntil(protegida);
        return Promise.resolve(null);
      }
      return protegida;
    },
  })
);
