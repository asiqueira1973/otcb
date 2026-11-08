import type { Bloco, CardBar, Jogo, StatusVisivel } from "./tipos.ts";

// Montagem e validação dos blocos (seções 13.1 e 13.2). O modelo só indica ids; o servidor monta cada card
// com dados que as ferramentas devolveram neste turno, e só para bares visíveis (regra 11.9: confirmado,
// provável ou incerto). Bloco inválido é descartado; o texto é mantido (13.1).

export const STATUS_VISIVEIS: StatusVisivel[] = ["confirmado", "provavel", "incerto"];

// Memória do turno: o que as ferramentas devolveram.
export class CacheTurno {
  bares = new Map<string, CardBar>();
  jogos = new Map<string, Jogo>();
  passaporte: { total_carimbos: number; bairros_conquistados: number; ultimo_selo: string | null } | null = null;
}

// Converte uma linha de otcb_buscar_bares / otcb_detalhes_bar em CardBar; null se o status não é visível.
// Recebe: linha e localização do usuário (para a distância quando a linha não traz). Devolve: CardBar ou null.
export function paraCardBar(linha: Record<string, unknown>, local: { latitude: number; longitude: number } | null): CardBar | null {
  const status = linha.status as string;
  if (!STATUS_VISIVEIS.includes(status as StatusVisivel)) return null;
  const lat = Number(linha.latitude);
  const lng = Number(linha.longitude);
  let distancia = linha.distancia_metros == null ? null : Number(linha.distancia_metros);
  if (distancia === null && local) distancia = Math.round(haversine(local.latitude, local.longitude, lat, lng));
  return {
    bar_id: String(linha.bar_id), nome: String(linha.nome), bairro: String(linha.bairro), endereco: String(linha.endereco),
    latitude: lat, longitude: lng, distancia_metros: distancia, status: status as StatusVisivel,
    tem_balcao: (linha.tem_balcao as boolean | null) ?? null, transmite_jogos: (linha.transmite_jogos as boolean | null) ?? null,
    classico: Boolean(linha.classico),
    nota_colarinho_media: linha.nota_colarinho_media == null ? null : Number(linha.nota_colarinho_media),
    nota_opinioes_media: linha.nota_opinioes_media == null ? null : Number(linha.nota_opinioes_media),
    qtd_opinioes: Number(linha.qtd_opinioes ?? 0),
    ultima_confirmacao_em: (linha.ultima_confirmacao_em as string | null) ?? null,
    confirmacoes_60_dias: Number(linha.confirmacoes_60_dias ?? 0),
    resumo_opinioes: (linha.resumo_opinioes as string | null) ?? null,
  };
}

// Distância haversine em metros (mesma fórmula de otcb_distancia_metros).
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (g: number) => (g * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

const ACOES = ["abrir_camera", "abrir_rota", "chamar_uber", "abrir_ficha", "abrir_passaporte"] as const;
const ACOES_COM_BAR = ["abrir_rota", "chamar_uber", "abrir_ficha"];

// Monta os blocos pedidos pelo modelo na ferramenta "mostrar". Recebe: pedidos e cache do turno.
// Devolve: blocos válidos da 13.2 e quantos foram descartados.
export function montarBlocos(pedidos: unknown, cache: CacheTurno): { blocos: Bloco[]; descartados: number } {
  const blocos: Bloco[] = [];
  let descartados = 0;
  const lista = Array.isArray(pedidos) ? pedidos : [];
  for (const p of lista) {
    const b = montarBloco(p as Record<string, unknown>, cache);
    if (b) blocos.push(b);
    else descartados += 1;
  }
  return { blocos, descartados };
}

function idsVisiveis(ids: unknown, cache: CacheTurno): CardBar[] {
  if (!Array.isArray(ids)) return [];
  const vistos = new Set<string>();
  const out: CardBar[] = [];
  for (const id of ids) {
    const bar = cache.bares.get(String(id));
    if (bar && !vistos.has(bar.bar_id)) { vistos.add(bar.bar_id); out.push(bar); }
  }
  return out;
}

function montarBloco(p: Record<string, unknown>, cache: CacheTurno): Bloco | null {
  switch (p?.tipo) {
    case "lista_bares": {
      const bares = idsVisiveis(p.bar_ids, cache).slice(0, 8);
      const titulo = typeof p.titulo === "string" && p.titulo.trim() ? p.titulo.trim().slice(0, 80) : "Bares";
      return bares.length > 0 ? { tipo: "lista_bares", titulo, bares } : null;
    }
    case "card_bar": {
      const bar = cache.bares.get(String(p.bar_id));
      return bar ? { tipo: "card_bar", bar } : null;
    }
    case "mapa": {
      const pontos = idsVisiveis(p.bar_ids, cache).slice(0, 8)
        .map(({ bar_id, nome, latitude, longitude, status }) => ({ bar_id, nome, latitude, longitude, status }));
      return pontos.length > 0 ? { tipo: "mapa", pontos } : null;
    }
    case "jogos": {
      const ids = Array.isArray(p.jogo_ids) ? p.jogo_ids.map(String) : [...cache.jogos.keys()];
      const jogos = ids.map((id) => cache.jogos.get(id)).filter((j): j is Jogo => !!j).slice(0, 10);
      return jogos.length > 0 ? { tipo: "jogos", jogos } : null;
    }
    case "passaporte":
      return cache.passaporte ? { tipo: "passaporte", ...cache.passaporte } : null;
    case "acao": {
      const acao = p.acao as (typeof ACOES)[number];
      const rotulo = typeof p.rotulo === "string" ? p.rotulo.trim().slice(0, 40) : "";
      if (!ACOES.includes(acao) || !rotulo) return null;
      if (ACOES_COM_BAR.includes(acao)) {
        const bar = cache.bares.get(String(p.bar_id));
        return bar ? { tipo: "acao", acao, bar_id: bar.bar_id, rotulo } : null;
      }
      return { tipo: "acao", acao, rotulo };
    }
    default:
      return null;
  }
}
