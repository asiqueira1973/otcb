import { ExternalServiceError, isFatalStatus } from "./errors.ts";

// Cliente mínimo do Google Places API (New) para o garimpo (seções 4.1, 8.3; regras 11.10 e 11.17).
// Cada método corresponde a um SKU contado separadamente no teto da 11.17.

export type GooglePlace = {
  placeId: string;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
  businessStatus: string | null;
  bairro: string | null;
};

export type GoogleReview = { id: string; texto: string; publicadoEm: string | null };

export interface GoogleClient {
  // Text Search (Pro): até `pageSize` lugares para um texto livre.
  searchText(query: string, pageSize: number): Promise<GooglePlace[]>;
  // Place Details só com businessStatus e location (SKU básico da 11.17).
  detailsBasic(placeId: string): Promise<{ businessStatus: string | null; latitude: number | null; longitude: number | null }>;
  // Place Details com reviews (Enterprise + Atmosphere).
  detailsReviews(placeId: string): Promise<GoogleReview[]>;
}

type Fetch = typeof fetch;

type RawPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  businessStatus?: string;
  addressComponents?: { longText?: string; types?: string[] }[];
  reviews?: { name: string; text?: { text?: string }; originalText?: { text?: string }; publishTime?: string }[];
};

// Extrai o bairro dos componentes de endereço (sublocality_level_1, sublocality, neighborhood).
export function neighborhoodOf(components: { longText?: string; types?: string[] }[]): string | null {
  for (const type of ["sublocality_level_1", "sublocality", "neighborhood"]) {
    const c = components.find((x) => x.types?.includes(type) && x.longText);
    if (c?.longText) return c.longText;
  }
  return null;
}

// Cria o cliente com a chave do ambiente da função. Recebe: chave e fetch (injetável). Devolve: GoogleClient.
// Erros HTTP viram ExternalServiceError sem a chave na mensagem; 401/402/403 são fatais.
export function createGoogleClient(apiKey: string, fetchFn: Fetch = fetch): GoogleClient {
  async function call(url: string, init: RequestInit, fieldMask: string): Promise<RawPlace & { places?: RawPlace[] }> {
    const res = await fetchFn(url, {
      ...init,
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fieldMask },
    });
    if (!res.ok) {
      await res.body?.cancel();
      throw new ExternalServiceError("google", res.status, isFatalStatus(res.status), "places");
    }
    return await res.json();
  }

  return {
    async searchText(query, pageSize) {
      const body = await call("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        body: JSON.stringify({ textQuery: query, languageCode: "pt-BR", regionCode: "BR", pageSize }),
      }, "places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.addressComponents");
      return (body.places ?? [])
        .filter((p) => p.location)
        .map((p) => ({
          placeId: p.id,
          nome: p.displayName?.text ?? "",
          endereco: p.formattedAddress ?? "",
          latitude: p.location!.latitude,
          longitude: p.location!.longitude,
          businessStatus: p.businessStatus ?? null,
          bairro: neighborhoodOf(p.addressComponents ?? []),
        }));
    },
    async detailsBasic(placeId) {
      const p = await call(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, { method: "GET" },
        "id,businessStatus,location");
      return { businessStatus: p.businessStatus ?? null, latitude: p.location?.latitude ?? null, longitude: p.location?.longitude ?? null };
    },
    async detailsReviews(placeId) {
      const p = await call(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`, { method: "GET" },
        "id,reviews");
      return (p.reviews ?? [])
        .map((r) => ({ id: r.name, texto: r.originalText?.text ?? r.text?.text ?? "", publicadoEm: r.publishTime ?? null }))
        .filter((r) => r.texto.trim().length > 0);
    },
  };
}
