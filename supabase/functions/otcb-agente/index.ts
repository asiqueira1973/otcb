// Edge Function otcb-agente (seção 13.1; épico 8.4): liga o handler ao banco e ao Claude reais.
// Segredos só do ambiente da função (seção 20); o log recebe só eventos sem texto, token ou localização.
import { createClient } from "npm:@supabase/supabase-js@2";

import { criarModeloAnthropic } from "./agente.ts";
import { createAgenteDb } from "./db.ts";
import { handleAgente } from "./handler.ts";

const env = (nome: string) => Deno.env.get(nome) ?? "";
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), opcoes);

Deno.serve((req) =>
  handleAgente(req, {
    db: (token) => createAgenteDb(admin, createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      ...opcoes,
      global: { headers: { Authorization: `Bearer ${token}` } },
    })),
    modelo: () => criarModeloAnthropic(env("ANTHROPIC_API_KEY")),
    log: (evento) => console.log(JSON.stringify({ funcao: "otcb-agente", ...evento })),
  })
);
