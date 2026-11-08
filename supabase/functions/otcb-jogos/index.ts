// Edge Function otcb-jogos (13.9; épico 8.9; fonte trocada na emenda do 8.11): API-Football → otcb_jogos.
// Chamada só pelo pg_cron.
// Chave e segredo só do ambiente da função (seção 20); o log não leva a chave.
import { createClient } from "npm:@supabase/supabase-js@2";

import { buscarJanela, diasDaJanela, mapearFixtures } from "./apifootball.ts";
import { handleJogos } from "./handler.ts";

const env = (nome: string) => Deno.env.get(nome) ?? "";
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve((req) =>
  handleJogos(req, {
    segredoCron: env("OTCB_CRON_SECRET"),
    // Emenda do 8.11: API-Football, uma chamada por dia da janela; no plano grátis só ontem, hoje e amanhã.
    buscar: () =>
      buscarJanela(diasDaJanela(new Date()), async (dia) => {
        const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dia}&timezone=America/Sao_Paulo`, {
          headers: { "x-apisports-key": env("API_FOOTBALL_KEY") },
          signal: AbortSignal.timeout(20_000),
        });
        return { status: res.status, corpo: res.ok ? await res.json() : null };
      }),
    mapear: mapearFixtures,
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
