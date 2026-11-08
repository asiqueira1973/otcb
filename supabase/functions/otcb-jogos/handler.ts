import { janela, type JogoNovo, mapearPartidas } from "./jogos.ts";

// Lógica da Edge Function otcb-jogos (13.9; épico 8.9). Chamada só pelo pg_cron (cabeçalho x-otcb-cron).

export type DepsJogos = {
  segredoCron: string;
  // GET /v4/matches no football-data. Devolve: status e JSON.
  buscar: (de: string, ate: string) => Promise<{ status: number; corpo: unknown }>;
  gravar: (dados: { jogos: JogoNovo[]; cancelados: string[] }) => Promise<{ gravados: number; apagados: number }>;
  agora: () => Date;
  log: (e: Record<string, unknown>) => void;
};

const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

// Atende POST /otcb-jogos. Busca os jogos de hoje a hoje+7 (todas as competições do plano, P2) e grava.
// football-data fora → mantém os jogos já gravados (12.5) e responde 502 sem detalhes. Devolve: 200
// { gravados, apagados, recebidos }; 401 sem o segredo; 405 fora de POST.
export async function handleJogos(req: Request, deps: DepsJogos): Promise<Response> {
  if (req.method !== "POST") return json(405, { codigo: "metodo_nao_permitido" });
  const segredo = req.headers.get("x-otcb-cron") ?? "";
  if (!deps.segredoCron || segredo !== deps.segredoCron) return json(401, { codigo: "nao_autorizado" });

  const { de, ate } = janela(deps.agora());
  let r: { status: number; corpo: unknown };
  try {
    r = await deps.buscar(de, ate);
  } catch {
    deps.log({ evento: "football_data_indisponivel", status: 0 });
    return json(502, { codigo: "football_data_indisponivel" });
  }
  if (r.status !== 200) {
    deps.log({ evento: "football_data_indisponivel", status: r.status });
    return json(502, { codigo: "football_data_indisponivel" });
  }
  const dados = mapearPartidas(r.corpo);
  const res = await deps.gravar(dados);
  deps.log({ evento: "jogos", recebidos: dados.jogos.length, ...res });
  return json(200, { ...res, recebidos: dados.jogos.length });
}
