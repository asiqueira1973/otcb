import { janela, type JogoNovo, mapearPartidas } from "./jogos.ts";

// Lógica da Edge Function otcb-jogos (13.9; épico 8.9). Chamada só pelo pg_cron (cabeçalho x-otcb-cron).

export type DepsJogos = {
  segredoCron: string;
  // GET /v4/matches no football-data. Devolve: status e JSON.
  buscar: (de: string, ate: string) => Promise<{ status: number; corpo: unknown }>;
  gravar: (dados: { jogos: JogoNovo[]; cancelados: string[] }) => Promise<{ gravados: number; apagados: number }>;
  agora: () => Date;
  log: (e: Record<string, unknown>) => void;
  // Regra 12.5: grava a execução em otcb_execucoes_garimpo (tipo 'jogos'); o agente lê para avisar a pessoa.
  registrar: (status: "concluida" | "falhou", erros: Record<string, unknown> | null) => Promise<void>;
};

const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

// Atende POST /otcb-jogos. Busca os jogos de hoje a hoje+7 (todas as competições do plano, P2) e grava.
// football-data fora → mantém os jogos já gravados (12.5) e responde 502 sem detalhes; falha ao gravar → 500.
// Toda execução que passou do segredo fica registrada (concluida/falhou). Devolve: 200
// { gravados, apagados, recebidos }; 401 sem o segredo; 405 fora de POST.
export async function handleJogos(req: Request, deps: DepsJogos): Promise<Response> {
  if (req.method !== "POST") return json(405, { codigo: "metodo_nao_permitido" });
  const segredo = req.headers.get("x-otcb-cron") ?? "";
  if (!deps.segredoCron || segredo !== deps.segredoCron) return json(401, { codigo: "nao_autorizado" });

  const { de, ate } = janela(deps.agora());
  // O registro nunca derruba a resposta; erros guardam só o status, nunca a chave nem a mensagem do fetch.
  const registrar = (status: "concluida" | "falhou", erros: Record<string, unknown> | null) =>
    deps.registrar(status, erros).catch(() => deps.log({ evento: "registro_execucao_falhou" }));
  let r: { status: number; corpo: unknown };
  try {
    r = await deps.buscar(de, ate);
  } catch {
    r = { status: 0, corpo: null };
  }
  if (r.status !== 200) {
    deps.log({ evento: "football_data_indisponivel", status: r.status });
    await registrar("falhou", { football_data: r.status });
    return json(502, { codigo: "football_data_indisponivel" });
  }
  const dados = mapearPartidas(r.corpo);
  let res: { gravados: number; apagados: number };
  try {
    res = await deps.gravar(dados);
  } catch {
    deps.log({ evento: "falha_ao_gravar", recebidos: dados.jogos.length });
    await registrar("falhou", { gravar: true });
    return json(500, { codigo: "falha_ao_gravar" });
  }
  deps.log({ evento: "jogos", recebidos: dados.jogos.length, ...res });
  await registrar("concluida", null);
  return json(200, { ...res, recebidos: dados.jogos.length });
}
