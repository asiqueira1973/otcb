// Cliente mínimo do Google Places API (New) — Text Search (seção 14.1; regra 11.10).

export type Place = {
  placeId: string;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
  businessStatus: string | null;
  bairro: string | null;
};

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.addressComponents';

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  businessStatus?: string;
  addressComponents?: { longText?: string; types?: string[] }[];
};

// Busca o primeiro resultado do Text Search para um texto livre.
// Recebe: o texto ("{Nome} {Endereço} São Paulo"), a chave e um fetch (injetável para teste).
// Devolve: o lugar normalizado ou null quando não há resultado. Lança em erro HTTP (sem expor a chave).
export async function searchPlace(query: string, apiKey: string, fetchFn: FetchLike): Promise<Place | null> {
  const res = await fetchFn('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
    body: JSON.stringify({ textQuery: query, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 1 }),
  });
  if (!res.ok) throw new Error(`google_places_http_${res.status}`);
  const body = (await res.json()) as { places?: GooglePlace[] };
  const p = body.places?.[0];
  if (!p || !p.location) return null;
  return {
    placeId: p.id,
    nome: p.displayName?.text ?? '',
    endereco: p.formattedAddress ?? '',
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    businessStatus: p.businessStatus ?? null,
    bairro: neighborhoodOf(p.addressComponents ?? []),
  };
}

// Extrai o bairro dos componentes de endereço do Google (sublocality_level_1, depois neighborhood).
// Recebe: addressComponents. Devolve: o bairro ou null.
export function neighborhoodOf(components: { longText?: string; types?: string[] }[]): string | null {
  for (const type of ['sublocality_level_1', 'sublocality', 'neighborhood']) {
    const c = components.find((x) => x.types?.includes(type) && x.longText);
    if (c?.longText) return c.longText;
  }
  return null;
}
