import { encodeBase64 } from "jsr:@std/encoding@1/base64";

import { calcularNota, ehJpeg } from "./nota.ts";
import { type Visao, VisaoIndisponivel } from "./visao.ts";

// Lógica da Edge Function otcb-colarinhometro (13.5; regras 11.4, 11.5 e 11.6; épico 8.6). Puro: deps injetadas.

export const LIMITE_FOTOS_DIA = 10; // 11.6
export const TAMANHO_MAX = 1024 * 1024; // 13.5: JPEG ≤ 1 MB

export type FotoNova = {
  id: string; usuarioId: string; barId: string | null; distancia: number | null; caminho: string;
  eChopp: boolean; confirmou: boolean; notas: { altura: number; cremosidade: number; copo: number; gelado: number; final: number } | null;
  comentario: string | null; pessoaIdentificavel: boolean; modelo: string;
};

export interface ColarinhoDb {
  usuarioDoToken(token: string): Promise<string | null>;
  fotosHoje(usuarioId: string): Promise<number>;
  barMaisProximo(latitude: number, longitude: number): Promise<{ bar_id: string; distancia_metros: number } | null>;
  upload(caminho: string, bytes: Uint8Array): Promise<void>;
  inserirFoto(f: FotoNova): Promise<void>;
  // otcb_resultado_foto
  resultado(fotoId: string): Promise<{ carimbo_novo: boolean; motivo_sem_carimbo: string | null; nome_bar: string | null; total_carimbos: number }>;
}

export type DepsColarinho = { db: ColarinhoDb; visao: () => Visao; modelo: string; novoId: () => string; log: (e: Record<string, unknown>) => void };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Lê as coordenadas: as duas juntas e válidas, ou nenhuma (sem localização → sem bar). Recebe: form. Devolve: coords, null ou "invalida".
function lerCoordenadas(form: FormData): { latitude: number; longitude: number } | null | "invalida" {
  const la = form.get("latitude"), lo = form.get("longitude");
  if ((la === null || la === "") && (lo === null || lo === "")) return null;
  const latitude = Number(la), longitude = Number(lo);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return "invalida";
  return { latitude, longitude };
}

// Atende POST /otcb-colarinhometro (multipart: imagem, latitude, longitude, capturada_em, confirmou_brahma).
// Ordem: JWT → validação (JPEG pelo conteúdo, ≤ 1 MB) → limite de 10 fotos/dia → visão → nota (11.5) → bar a
// até 150 m → Storage {usuario_id}/{foto_id}.jpg → otcb_fotos (o trigger cuida de evidência e carimbo, 11.4)
// → resultado. Devolve: 200 { bloco resultado_colarinho, total_carimbos }; 401; 405; 413; 422 dados_invalidos
// | nao_e_chopp (15.6; foto gravada sem nota, conta no limite); 429 limite_fotos; 503 ia_indisponivel (nada
// gravado). O log nunca leva localização nem imagem (seção 20).
export async function handleColarinho(req: Request, deps: DepsColarinho): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { codigo: "metodo_nao_permitido" });
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const usuarioId = token ? await deps.db.usuarioDoToken(token).catch(() => null) : null;
  if (!usuarioId) return json(401, { codigo: "nao_autenticado" });

  let form: FormData;
  try { form = await req.formData(); } catch { return json(422, { codigo: "dados_invalidos" }); }
  const arquivo = form.get("imagem");
  const confirmou = form.get("confirmou_brahma");
  const coords = lerCoordenadas(form);
  if (!(arquivo instanceof File) || !["sim", "nao", "nao_sei"].includes(String(confirmou)) || coords === "invalida") {
    return json(422, { codigo: "dados_invalidos" });
  }
  if (arquivo.size > TAMANHO_MAX) return json(413, { codigo: "imagem_grande" });
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (bytes.length > TAMANHO_MAX) return json(413, { codigo: "imagem_grande" });
  if (!ehJpeg(bytes)) return json(422, { codigo: "dados_invalidos" });

  try {
    if (await deps.db.fotosHoje(usuarioId) >= LIMITE_FOTOS_DIA) return json(429, { codigo: "limite_fotos" });

    const inicio = Date.now();
    const [avaliacao, bar] = await Promise.all([
      deps.visao().avaliar(encodeBase64(bytes)),
      coords ? deps.db.barMaisProximo(coords.latitude, coords.longitude) : Promise.resolve(null),
    ]);
    const fotoId = deps.novoId();
    const caminho = `${usuarioId}/${fotoId}.jpg`;
    const notas = avaliacao.e_chopp
      ? {
          altura: avaliacao.nota_altura, cremosidade: avaliacao.nota_cremosidade, copo: avaliacao.nota_copo, gelado: avaliacao.nota_gelado,
          final: calcularNota(avaliacao),
        }
      : null;

    await deps.db.upload(caminho, bytes);
    await deps.db.inserirFoto({
      id: fotoId, usuarioId, barId: bar?.bar_id ?? null, distancia: bar?.distancia_metros ?? null, caminho,
      eChopp: avaliacao.e_chopp, confirmou: confirmou === "sim", notas,
      comentario: avaliacao.e_chopp ? avaliacao.comentario : null, pessoaIdentificavel: avaliacao.pessoa_identificavel, modelo: deps.modelo,
    });
    const r = await deps.db.resultado(fotoId);
    deps.log({ evento: "foto", ms: Date.now() - inicio, e_chopp: avaliacao.e_chopp, teve_bar: !!bar, carimbo_novo: r.carimbo_novo });

    if (!avaliacao.e_chopp || !notas) return json(422, { codigo: "nao_e_chopp" });
    return json(200, {
      bloco: {
        tipo: "resultado_colarinho", foto_id: fotoId, nome_bar: r.nome_bar,
        nota_colarinho: notas.final, nota_altura: notas.altura, nota_cremosidade: notas.cremosidade, nota_copo: notas.copo,
        nota_gelado: notas.gelado, comentario_ia: avaliacao.comentario || null, carimbo_novo: r.carimbo_novo,
        motivo_sem_carimbo: r.motivo_sem_carimbo,
      },
      total_carimbos: r.total_carimbos,
    });
  } catch (error) {
    if (error instanceof VisaoIndisponivel) {
      deps.log({ evento: "ia_indisponivel", motivo: error.message });
      return json(503, { codigo: "ia_indisponivel" });
    }
    deps.log({ evento: "erro", nome: error instanceof Error ? error.name : "desconhecido" });
    return json(500, { codigo: "erro_interno" });
  }
}
