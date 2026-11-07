// Edge Function otcb-apagar-conta (spec 13.8): POST sem corpo, autenticado pelo JWT do usuário anônimo.
// Liga o handler puro às operações reais com a credencial de serviço do ambiente da função (seção 20).
import { createClient } from "npm:@supabase/supabase-js@2";

import { handleDeleteAccount } from "./handler.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((req) =>
  handleDeleteAccount(req, {
    // Valida o token no Supabase Auth e devolve o id do dono.
    async getUserIdFromToken(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error || !data.user ? null : data.user.id;
    },
    // Apaga o perfil (seção 7.4: hard delete).
    async deleteProfile(userId) {
      const { error } = await admin.from("otcb_perfis").delete().eq("id", userId);
      if (error) throw error;
    },
    // Apaga o usuário anônimo de auth.users.
    async deleteAuthUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
  })
);
