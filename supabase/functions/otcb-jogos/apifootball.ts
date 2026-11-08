// Mapeamento da API-Football (api-sports.io) para otcb_jogos (13.9; emenda do 8.11: troca do football-data.org
// para cobrir Copa do Brasil, Série B, estaduais e Seleção). Puro, testável sem rede.
import type { JogoNovo } from "./jogos.ts";

type Fixture = {
  fixture: { id: number; timestamp: number; status: { short: string } };
  league: { id: number; name: string; country: string };
  teams: { home: { name: string | null }; away: { name: string | null } };
};
type Resposta = { errors?: unknown; response?: Fixture[] };

// Competições que entram no app, pelo id da API-Football, com o nome em português (seção 15). Fora da lista:
// divisões inferiores, base (sub-20, sub-17), feminino e torneios de outros continentes.
export const LIGAS: Record<number, string> = {
  71: "Brasileirão", 72: "Série B", 73: "Copa do Brasil", 632: "Supercopa do Brasil", 612: "Copa do Nordeste",
  13: "Libertadores", 11: "Sul-Americana", 541: "Recopa Sul-Americana",
  475: "Paulistão", 624: "Carioca", 629: "Mineiro", 477: "Gaúcho", 606: "Paranaense", 604: "Catarinense",
  602: "Baiano", 622: "Pernambucano", 609: "Cearense", 628: "Goiano",
  10: "Amistoso", 34: "Eliminatórias", 1: "Copa do Mundo", 9: "Copa América", 15: "Mundial de Clubes",
  2: "Champions League", 3: "Liga Europa", 39: "Premier League", 140: "La Liga", 135: "Serie A italiana",
  78: "Bundesliga", 61: "Ligue 1", 94: "Liga Portugal", 88: "Eredivisie",
};
// Competições de seleções: só entra o jogo em que o Brasil joga.
const SO_COM_BRASIL = new Set([10, 34, 1, 9]);
// Adiado, cancelado, abandonado, decidido fora de campo: some da lista (a API traz a nova data quando sair).
const ESTADOS_CANCELADOS = new Set(["PST", "CANC", "ABD", "AWD", "WO", "SUSP"]);

// Nomes como a API manda vêm com "DA", "DE", "DO" maiúsculos ("Vasco DA Gama"); o app mostra minúsculo.
function nome(n: string): string {
  return n.replace(/\b(DA|DE|DO|DAS|DOS)\b/g, (p) => p.toLowerCase());
}

// Converte as respostas de /fixtures?date= (uma por dia da janela). Recebe: lista de JSONs. Devolve: jogos a
// gravar e ids a apagar. id_externo leva o prefixo "af:" para não colidir com ids do football-data.
export function mapearFixtures(respostas: unknown): { jogos: JogoNovo[]; cancelados: string[] } {
  const lista = (Array.isArray(respostas) ? respostas : [respostas]) as Resposta[];
  const jogos: JogoNovo[] = [];
  const cancelados: string[] = [];
  for (const r of lista) {
    for (const f of r?.response ?? []) {
      const competicao = LIGAS[f.league?.id];
      if (!competicao) continue;
      const mandante = f.teams?.home?.name;
      const visitante = f.teams?.away?.name;
      if (!mandante || !visitante || !f.fixture?.timestamp) continue;
      if (SO_COM_BRASIL.has(f.league.id) && mandante !== "Brazil" && visitante !== "Brazil") continue;
      const id = `af:${f.fixture.id}`;
      if (ESTADOS_CANCELADOS.has(f.fixture.status?.short)) {
        cancelados.push(id);
        continue;
      }
      jogos.push({
        id_externo: id, competicao,
        mandante: mandante === "Brazil" ? "Brasil" : nome(mandante),
        visitante: visitante === "Brazil" ? "Brasil" : nome(visitante),
        inicio: new Date(f.fixture.timestamp * 1000).toISOString(),
      });
    }
  }
  return { jogos, cancelados };
}

// Dias da busca: hoje (em São Paulo) e os 7 seguintes, uma chamada por dia. Recebe: agora. Devolve: AAAA-MM-DD.
export function diasDaJanela(agora: Date): string[] {
  const hoje = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const base = Date.parse(`${hoje}T12:00:00-03:00`);
  return Array.from({ length: 8 }, (_, i) =>
    new Date(base + i * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
}

// A API-Football responde HTTP 200 com o erro no corpo (chave inválida, limite do dia). Recebe: JSON. Devolve: o
// nome do erro (sem a mensagem, que pode citar a chave) ou null.
export function erroDaApi(corpo: unknown): string | null {
  const erros = (corpo as Resposta)?.errors;
  if (!erros) return null;
  if (Array.isArray(erros)) return erros.length ? "erro" : null;
  const chaves = Object.keys(erros as Record<string, unknown>);
  return chaves.length ? chaves[0] : null;
}

type BuscaDia = (dia: string) => Promise<{ status: number; corpo: unknown }>;

// Busca dia a dia. Para no primeiro dia fora do plano (errors.plan: o grátis só libera ontem, hoje e amanhã) e
// fica com os anteriores; qualquer outro erro, ou erro já no primeiro dia, falha a carga (502, sem a mensagem).
// Recebe: os dias e a função que busca um dia. Devolve: status e a lista de respostas.
export async function buscarJanela(dias: string[], buscarDia: BuscaDia): Promise<{ status: number; corpo: unknown[] | null }> {
  const respostas: unknown[] = [];
  for (const dia of dias) {
    const r = await buscarDia(dia);
    if (r.status !== 200) return { status: r.status, corpo: null };
    const erro = erroDaApi(r.corpo);
    if (erro === "plan" && respostas.length > 0) break;
    if (erro) return { status: 502, corpo: null };
    respostas.push(r.corpo);
  }
  return { status: 200, corpo: respostas };
}
