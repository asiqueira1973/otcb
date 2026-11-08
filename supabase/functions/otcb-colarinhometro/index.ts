// Edge Function otcb-colarinhometro (13.5; épico 8.6): liga o handler ao banco/Storage (serviço) e ao
// claude-haiku-5-5. Segredos só do ambiente da função (seção 20); o log não leva localização nem imagem.
import { createClient } from "npm:@supabase/supabase-js@2";

import { handleColarinho } from "./handler.ts";
import { criarVisao, MODELO_VISAO } from "./visao.ts";

const env = (nome: string) => Deno.env.get(nome) ?? "";
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Chama uma função service-only. Recebe: nome e argumentos. Devolve: o resultado; erro sem dados sensíveis.
async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(nome, args);
  if (error) throw new Error(`db_${nome}: ${error.message}`);
  return data as T;
}

Deno.serve((req) =>
  handleColarinho(req, {
    db: {
      async usuarioDoToken(token) {
        const { data, error } = await admin.auth.getUser(token);
        return error || !data.user ? null : data.user.id;
      },
      fotosHoje: (u) => rpc<number>("otcb_fotos_hoje", { p_usuario: u }),
      async barMaisProximo(latitude, longitude) {
        const linhas = await rpc<{ bar_id: string; distancia_metros: number }[]>("otcb_bar_mais_proximo", { p_latitude: latitude, p_longitude: longitude });
        return linhas?.[0] ?? null;
      },
      async upload(caminho, bytes) {
        const { error } = await admin.storage.from("otcb-fotos").upload(caminho, bytes, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error(`storage: ${error.message}`);
      },
      async inserirFoto(f) {
        const { error } = await admin.from("otcb_fotos").insert({
          id: f.id, usuario_id: f.usuarioId, bar_id: f.barId, distancia_bar_metros: f.distancia, caminho_storage: f.caminho,
          e_chopp: f.eChopp, usuario_confirmou_brahma: f.confirmou,
          nota_altura: f.notas?.altura ?? null, nota_cremosidade: f.notas?.cremosidade ?? null, nota_copo: f.notas?.copo ?? null,
          nota_gelado: f.notas?.gelado ?? null, nota_colarinho: f.notas?.final ?? null,
          comentario_ia: f.comentario, pessoa_identificavel: f.pessoaIdentificavel, modelo_ia: f.modelo,
        });
        if (error) {
          await admin.storage.from("otcb-fotos").remove([f.caminho]); // não deixa arquivo órfão
          throw new Error(`db_foto: ${error.message}`);
        }
      },
      resultado: (fotoId) => rpc("otcb_resultado_foto", { p_foto_id: fotoId }),
    },
    visao: () => criarVisao(env("ANTHROPIC_API_KEY")),
    modelo: MODELO_VISAO,
    novoId: () => crypto.randomUUID(),
    log: (evento) => console.log(JSON.stringify({ funcao: "otcb-colarinhometro", ...evento })),
  })
);
