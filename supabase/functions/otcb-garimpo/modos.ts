import { dataDaEvidencia, type EvidenciaProposta, evidenciasDaClassificacao, tipoDaPagina } from "./classificacao.ts";
import type { BarCoordenadas, BarResumo, BarRevisita, Candidato, Contexto, Modo, Posicao } from "./tipos.ts";
import type { GooglePlace } from "../_shared/google.ts";

// Os quatro modos do garimpo (épico 8.3). Cada modo seleciona itens a partir da posição salva no cursor,
// processa um item por vez e diz quando acabou. Falha de um item é tratada pelo executor (critério 5).

export interface ModoGarimpo<Item> {
  selecionar(ctx: Contexto, pos: Posicao, n: number): Promise<Item[]>;
  processar(ctx: Contexto, item: Item): Promise<void>;
  marcarFeito(pos: Posicao, item: Item): void;
  acabou(ctx: Contexto, pos: Posicao, selecionados: number, n: number): boolean;
  rotulo(item: Item): string;
}

// URL fixa do status do Google por lugar: o último status prevalece (migration 0800).
export function urlStatusGoogle(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
}

async function gravar(ctx: Contexto, barId: string, e: EvidenciaProposta, url: string): Promise<void> {
  const r = await ctx.db.registrarEvidencia({ barId, assunto: e.assunto, sinal: e.sinal, tipo: e.tipo, url, trecho: e.trecho, data: e.data });
  if (r === "criada") ctx.contadores.evidencias_criadas += 1;
}

async function classificarPagina(ctx: Contexto, url: string, titulo: string, contexto: string): Promise<{
  evidencias: EvidenciaProposta[]; nomeBar: string;
}> {
  ctx.orcamento.consumir("firecrawl");
  const pagina = await ctx.firecrawl.scrape(url);
  if (pagina.markdown.trim().length < 50) return { evidencias: [], nomeBar: "" };
  const c = await ctx.claude.classify(pagina.markdown, contexto, () => ctx.orcamento.consumir("ia"));
  const tipo = tipoDaPagina(url, pagina.titulo || titulo);
  return { evidencias: evidenciasDaClassificacao(c, tipo, dataDaEvidencia(c, ctx.agora)), nomeBar: c.nome_bar };
}

// --------------------------------------------------------------------------------------------- revisita
// Bares não visitados há 7 dias: status do Google (CLOSED_PERMANENTLY → fechado na hora, critério 2) e
// até 2 URLs conhecidas reclassificadas. CLOSED_TEMPORARILY é ignorado (11.1).
export const revisita: ModoGarimpo<BarRevisita> = {
  selecionar: (ctx, pos, n) => ctx.db.baresParaRevisita(n, pos.feitos ?? []),
  async processar(ctx, bar) {
    if (bar.google_place_id) {
      ctx.orcamento.consumir("details_basico");
      const d = await ctx.google.detailsBasic(bar.google_place_id);
      const sinal = d.businessStatus === "CLOSED_PERMANENTLY" ? "fechado" : d.businessStatus === "OPERATIONAL" ? "positivo" : null;
      if (sinal) {
        const r = await ctx.db.registrarEvidencia({
          barId: bar.bar_id, assunto: "funcionamento", sinal, tipo: "status_google",
          url: urlStatusGoogle(bar.google_place_id), trecho: null, data: ctx.agora,
        });
        if (r === "criada") ctx.contadores.evidencias_criadas += 1;
      }
    }
    for (const url of bar.urls.slice(0, 2)) {
      const { evidencias } = await classificarPagina(ctx, url, "", `bar ${bar.nome}, bairro ${bar.bairro}, São Paulo`);
      for (const e of evidencias) await gravar(ctx, bar.bar_id, e, url);
    }
  },
  marcarFeito: (pos, bar) => { pos.feitos = [...(pos.feitos ?? []), bar.bar_id]; },
  acabou: (_ctx, _pos, selecionados, n) => selecionados < n,
  rotulo: (bar) => `bar:${bar.bar_id}`,
};

// ------------------------------------------------------------------------------------------ coordenadas
// Regra 11.10: renova coordenadas com mais de 25 dias.
export const coordenadas: ModoGarimpo<BarCoordenadas> = {
  selecionar: (ctx, pos, n) => ctx.db.baresParaCoordenadas(n, pos.feitos ?? []),
  async processar(ctx, bar) {
    ctx.orcamento.consumir("details_basico");
    const d = await ctx.google.detailsBasic(bar.google_place_id);
    if (d.latitude !== null && d.longitude !== null) await ctx.db.atualizarCoordenadas(bar.bar_id, d.latitude, d.longitude);
  },
  marcarFeito: (pos, bar) => { pos.feitos = [...(pos.feitos ?? []), bar.bar_id]; },
  acabou: (_ctx, _pos, selecionados, n) => selecionados < n,
  rotulo: (bar) => `bar:${bar.bar_id}`,
};

// -------------------------------------------------------------------------------------------- resumos
// Regra 11.8: resumo das opiniões publicadas.
export const resumos: ModoGarimpo<BarResumo> = {
  selecionar: (ctx, pos, n) => ctx.db.baresParaResumo(n, pos.feitos ?? []),
  async processar(ctx, bar) {
    const opinioes = await ctx.db.opinioesPublicadas(bar.bar_id);
    if (opinioes.length < 3) return;
    const texto = await ctx.claude.summarize(opinioes, () => ctx.orcamento.consumir("ia"));
    await ctx.db.gravarResumo(bar.bar_id, texto);
  },
  marcarFeito: (pos, bar) => { pos.feitos = [...(pos.feitos ?? []), bar.bar_id]; },
  acabou: (_ctx, _pos, selecionados, n) => selecionados < n,
  rotulo: (bar) => `bar:${bar.bar_id}`,
};

// ------------------------------------------------------------------------------------------ descoberta
// Regra 11.15: para cada bairro, Google Text Search e Firecrawl search geram candidatos. Lugar do Google →
// avaliações classificadas (avaliacao_google). Página → classificação, localização no Google pelo nome e
// evidência pagina_web/cardapio_site. Bar novo só nasce com evidência positiva de Brahma (11.16).
async function gerarFila(ctx: Contexto, bairro: string): Promise<Candidato[]> {
  ctx.orcamento.consumir("text_search");
  const lugares = await ctx.google.searchText(`bar chopp Brahma ${bairro} São Paulo`, 10);
  ctx.orcamento.consumir("firecrawl", 5);
  const paginas = await ctx.firecrawl.search(`chopp Brahma bar ${bairro} São Paulo`, 5);
  return [
    ...lugares.filter((l) => l.businessStatus !== "CLOSED_PERMANENTLY").map((lugar) => ({ tipo: "lugar" as const, bairro, lugar })),
    ...paginas.map((p) => ({ tipo: "pagina" as const, bairro, url: p.url, titulo: p.titulo })),
  ];
}

async function gravarNoBar(ctx: Contexto, lugar: GooglePlace, bairro: string, evidencias: { e: EvidenciaProposta; url: string }[]) {
  if (evidencias.length === 0) return;
  const criar = evidencias.some(({ e }) => e.assunto === "tem_brahma" && e.sinal === "positivo");
  const bar = await ctx.db.casarOuCriarBar({
    nome: lugar.nome, endereco: lugar.endereco, bairro: lugar.bairro ?? bairro,
    latitude: lugar.latitude, longitude: lugar.longitude, placeId: lugar.placeId, criar,
  });
  if (!bar.bar_id) return;
  if (bar.criado) ctx.contadores.bares_novos += 1;
  for (const { e, url } of evidencias) await gravar(ctx, bar.bar_id, e, url);
}

export const descoberta: ModoGarimpo<Candidato> = {
  async selecionar(ctx, pos, n) {
    pos.bairroIdx ??= 0;
    pos.fila ??= [];
    while (pos.fila.length === 0 && pos.bairroIdx < ctx.bairros.length) {
      pos.fila = await gerarFila(ctx, ctx.bairros[pos.bairroIdx]);
      pos.bairroIdx += 1;
    }
    return pos.fila.slice(0, n);
  },
  async processar(ctx, item) {
    if (item.tipo === "lugar") {
      ctx.orcamento.consumir("details_reviews");
      const reviews = await ctx.google.detailsReviews(item.lugar.placeId);
      const evidencias: { e: EvidenciaProposta; url: string }[] = [];
      for (const r of reviews.slice(0, 5)) {
        const c = await ctx.claude.classify(r.texto, `avaliação do Google sobre ${item.lugar.nome}, ${item.bairro}, São Paulo`,
          () => ctx.orcamento.consumir("ia"));
        for (const e of evidenciasDaClassificacao(c, "avaliacao_google", dataDaEvidencia(c, ctx.agora, r.publicadoEm))) {
          evidencias.push({ e, url: `${urlStatusGoogle(item.lugar.placeId)}#${r.id}` });
        }
      }
      await gravarNoBar(ctx, item.lugar, item.bairro, evidencias);
      return;
    }
    const { evidencias, nomeBar } = await classificarPagina(ctx, item.url, item.titulo, `página sobre bares em ${item.bairro}, São Paulo`);
    if (evidencias.length === 0 || !nomeBar) return;
    ctx.orcamento.consumir("text_search");
    const [lugar] = await ctx.google.searchText(`${nomeBar} ${item.bairro} São Paulo`, 1);
    if (!lugar) throw new Error("sem_correspondencia_google");
    if (lugar.businessStatus === "CLOSED_PERMANENTLY") return;
    await gravarNoBar(ctx, lugar, item.bairro, evidencias.map((e) => ({ e, url: item.url })));
  },
  marcarFeito: (pos) => { pos.fila = (pos.fila ?? []).slice(1); },
  acabou: (ctx, pos) => (pos.fila ?? []).length === 0 && (pos.bairroIdx ?? 0) >= ctx.bairros.length,
  rotulo: (item) => item.tipo === "lugar" ? `lugar:${item.lugar.placeId}` : `pagina:${item.url.split("?")[0]}`,
};

export const MODOS_GARIMPO: Record<Modo, ModoGarimpo<unknown>> = {
  descoberta: descoberta as ModoGarimpo<unknown>,
  revisita: revisita as ModoGarimpo<unknown>,
  coordenadas: coordenadas as ModoGarimpo<unknown>,
  resumos: resumos as ModoGarimpo<unknown>,
};
