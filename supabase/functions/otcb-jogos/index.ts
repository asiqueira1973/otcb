// Edge Function otcb-jogos (13.9; épico 8.9): football-data.org → otcb_jogos. Chamada só pelo pg_cron.
// Chave e segredo só do ambiente da função (seção 20); o log não leva a chave.
import { createClient } from "npm:@supabase/supabase-js@2";

import { handleJogos } from "./handler.ts";

const env = (nome: string) => Deno.env.get(nome) ?? "";
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve((req) =>
  handleJogos(req, {
    segredoCron: env("OTCB_CRON_SECRET"),
    async buscar(de, ate) {
      const res = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${de}&dateTo=${ate}`, {
        headers: { "X-Auth-Token": env("FOOTBALL_DATA_KEY") },
        signal: AbortSignal.timeout(20_000),
      });
      return { status: res.status, corpo: res.ok ? await res.json() : null };
    },
    async gravar(dados) {
      const { data, error } = await admin.rpc("otcb_jogos_gravar", { p_dados: dados });
      if (error) throw new Error(`db_jogos: ${error.message}`);
      return data as { gravados: number; apagados: number };
    },
    async registrar(status, erros) {
      const agora = new Date().toISOString();
      const { error } = await admin.from("otcb_execucoes_garimpo")
        .insert({ tipo: "jogos", status, iniciado_em: agora, concluido_em: agora, erros });
      if (error) throw new Error(`db_execucoes: ${error.message}`);
    },
    agora: () => new Date(),
    log: (e) => console.log(JSON.stringify({ funcao: "otcb-jogos", ...e })),
  })
);
