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
    // Lista e remove os arquivos da pasta do usuário no bucket (o caminho é sempre {userId}/..., 7.2).
    async deleteStorageFolder(userId) {
      const bucket = admin.storage.from("otcb-fotos");
      for (;;) {
        const { data, error } = await bucket.list(userId, { limit: 100 });
        if (error) throw error;
        if (!data || data.length === 0) return;
        const { error: removeError } = await bucket.remove(data.map((file) => `${userId}/${file.name}`));
        if (removeError) throw removeError;
      }
    },
    // Desvincula as evidências do usuário (seção 7.4).
    async anonymizeEvidence(userId) {
      const { error } = await admin.from("otcb_evidencias").update({ usuario_id: null }).eq("usuario_id", userId);
      if (error) throw error;
    },
    // Apaga o perfil (seção 7.4: hard delete; as tabelas filhas caem em cascata).
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
