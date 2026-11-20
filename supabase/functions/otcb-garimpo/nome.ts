// Nome do bar que vem do Google Places (displayName). Alguns cadastros no Google usam o nome como título de SEO
// ("Bar do Juarez Itaim Bibi: Chopp, Picanha, Feijoada…"); o app mostra só o nome curto (pedido do Alexandre,
// 19/11/2026). Nome curto com separador ("Sao Conrado - Vila Madalena", filial) fica como está.

const LIMITE_CURTO = 40;
const LIMITE_MAXIMO = 60;
const SEPARADOR = /\s*(?::|\||–|—|\s-\s)\s*/;

// Recebe: nome do Google. Devolve: o nome curto (corta no primeiro separador quando passa de 40 caracteres e, se
// ainda passar de 60, no fim de palavra).
export function limparNomeBar(nome: string): string {
  let n = nome.replace(/\s+/g, " ").trim();
  if (n.length > LIMITE_CURTO) {
    const [primeiro] = n.split(SEPARADOR);
    if (primeiro && primeiro.trim().length >= 3) n = primeiro.trim();
  }
  if (n.length > LIMITE_MAXIMO) {
    const corte = n.slice(0, LIMITE_MAXIMO + 1);
    n = corte.slice(0, corte.lastIndexOf(" ")).trim();
  }
  return n;
}
