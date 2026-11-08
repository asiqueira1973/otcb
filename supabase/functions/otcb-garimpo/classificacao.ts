import type { Classificacao } from "../_shared/claude.ts";

// Mapeamento da classificação para evidências (contrato 13.6; regra 11.1).

export type TipoFonte = "cardapio_site" | "pagina_web" | "avaliacao_google";

export type EvidenciaProposta = {
  assunto: "tem_brahma" | "transmite_jogos";
  sinal: "positivo" | "negativo";
  tipo: TipoFonte;
  trecho: string;
  data: Date;
};

// Data da evidência (regra 11.1): data do conteúdo; se desconhecida, data da coleta − 90 dias.
// Para avaliações do Google, a data da avaliação. Recebe: classificação, data da coleta e data conhecida.
export function dataDaEvidencia(c: Classificacao, coleta: Date, dataConhecida: string | null = null): Date {
  const fonte = dataConhecida ?? c.data_conteudo;
  if (fonte) {
    const d = new Date(fonte.length === 10 ? `${fonte}T12:00:00-03:00` : fonte);
    if (!Number.isNaN(d.getTime()) && d.getTime() <= coleta.getTime()) return d;
  }
  return new Date(coleta.getTime() - 90 * 86_400_000);
}

// Tipo da fonte web: cardápio quando a URL ou o título indicam cardápio/menu; senão, página.
export function tipoDaPagina(url: string, titulo: string): "cardapio_site" | "pagina_web" {
  return /card[aá]pio|menu/i.test(`${url} ${titulo}`) ? "cardapio_site" : "pagina_web";
}

// Evidências a gravar a partir de uma classificação (13.6):
// sim → positiva; nao com outra marca de chopp em cardápio → negativa (só tem_brahma); incerto → nada.
// Avaliações do Google só geram positivas (tabela 11.1). Recebe: classificação, tipo e data. Devolve: lista.
export function evidenciasDaClassificacao(c: Classificacao, tipo: TipoFonte, data: Date): EvidenciaProposta[] {
  const out: EvidenciaProposta[] = [];
  if (c.menciona_chopp_brahma === "sim") {
    out.push({ assunto: "tem_brahma", sinal: "positivo", tipo, trecho: c.trecho, data });
  } else if (c.menciona_chopp_brahma === "nao" && c.cita_outra_marca_de_chopp && tipo === "cardapio_site") {
    out.push({ assunto: "tem_brahma", sinal: "negativo", tipo, trecho: c.trecho, data });
  }
  if (c.transmite_jogos === "sim" && tipo !== "cardapio_site") {
    out.push({ assunto: "transmite_jogos", sinal: "positivo", tipo, trecho: c.trecho, data });
  }
  return out;
}
