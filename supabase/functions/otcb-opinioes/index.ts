// Edge Function otcb-opinioes (13.7; épico 8.5): liga o handler ao banco (serviço) e ao claude-haiku-5-5.
// Segredos só do ambiente da função (seção 20); o log não leva o texto da opinião.
import { createClient } from "npm:@supabase/supabase-js@2";

import { handleOpinioes } from "./handler.ts";
import { criarModerador } from "./moderacao.ts";

const env = (nome: string) => Deno.env.get(nome) ?? "";
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Chama uma função service-only. Recebe: nome e argumentos. Devolve: o resultado; erro com o código do banco.
async function rpc<T>(nome: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(nome, args);
  if (error) throw new Error(`db_${nome}: ${error.message}`);
  return data as T;
}

Deno.serve((req) =>
  handleOpinioes(req, {
    db: {
      async usuarioDoToken(token) {
        const { data, error } = await admin.auth.getUser(token);
        return error || !data.user ? null : data.user.id;
      },
      checarEdicao: (u, b) => rpc<boolean>("otcb_checar_edicao", { p_usuario: u, p_bar_id: b }),
      salvar: (u, b, texto, nota) => rpc<string>("otcb_salvar_opiniao", { p_usuario: u, p_bar_id: b, p_texto: texto, p_nota: nota }),
      async recusarEdicao(u, b) {
        await rpc("otcb_recusar_edicao", { p_usuario: u, p_bar_id: b });
      },
    },
    moderador: () => criarModerador(env("ANTHROPIC_API_KEY")),
    log: (evento) => console.log(JSON.stringify({ funcao: "otcb-opinioes", ...evento })),
  })
);
