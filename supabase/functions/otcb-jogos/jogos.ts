// Mapeamento do football-data.org (13.9) para otcb_jogos. Puro, testável sem rede.

type Partida = {
  id: number; utcDate: string; status: string;
  competition: { code: string; name: string };
  homeTeam: { name: string | null; shortName: string | null };
  awayTeam: { name: string | null; shortName: string | null };
};

export type JogoNovo = { id_externo: string; competicao: string; mandante: string; visitante: string; inicio: string };

// Nomes de competição em português para o app (seção 15); as demais ficam como o football-data manda.
const COMPETICOES: Record<string, string> = {
  BSA: "Brasileirão", CL: "Champions League", CLI: "Libertadores", WC: "Copa do Mundo", EC: "Eurocopa",
  PL: "Premier League", PD: "La Liga", SA: "Serie A italiana", BL1: "Bundesliga", FL1: "Ligue 1",
  PPL: "Liga Portugal", DED: "Eredivisie", ELC: "Championship",
};

const ESTADOS_CANCELADOS = ["CANCELLED", "POSTPONED", "SUSPENDED", "AWARDED"];

// Converte a resposta de /v4/matches. Recebe: o JSON. Devolve: jogos a gravar e ids a apagar (cancelados ou
// adiados sem data). Partida sem time definido ainda (mata-mata) fica de fora.
export function mapearPartidas(resposta: unknown): { jogos: JogoNovo[]; cancelados: string[] } {
  const partidas = ((resposta as { matches?: Partida[] })?.matches ?? []) as Partida[];
  const jogos: JogoNovo[] = [];
  const cancelados: string[] = [];
  for (const p of partidas) {
    const id = String(p.id);
    if (ESTADOS_CANCELADOS.includes(p.status)) {
      cancelados.push(id);
      continue;
    }
    const mandante = p.homeTeam?.shortName || p.homeTeam?.name;
    const visitante = p.awayTeam?.shortName || p.awayTeam?.name;
    if (!mandante || !visitante || !p.utcDate) continue;
    jogos.push({
      id_externo: id,
      competicao: COMPETICOES[p.competition?.code] ?? p.competition?.name ?? "",
      mandante, visitante, inicio: p.utcDate,
    });
  }
  return { jogos, cancelados };
}

// Janela da busca: hoje (em São Paulo) até hoje + 7 dias. Recebe: agora. Devolve: datas AAAA-MM-DD.
export function janela(agora: Date): { de: string; ate: string } {
  const hoje = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const ate = new Date(Date.parse(`${hoje}T12:00:00-03:00`) + 7 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return { de: hoje, ate };
}
