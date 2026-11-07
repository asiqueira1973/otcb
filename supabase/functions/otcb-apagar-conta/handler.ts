// Lógica da Edge Function otcb-apagar-conta (spec 13.8 e épico 8.10; usada também no bloqueio de menor, 8.1).
// O handler é puro: recebe as dependências por injeção para ser testado sem rede (seção 22).

// Operações de banco/Auth de que a exclusão precisa, todas executadas com credencial de serviço.
export interface DeleteAccountDeps {
  // Valida o JWT e devolve o id do usuário dono do token, ou null se o token não vale.
  getUserIdFromToken(token: string): Promise<string | null>;
  // Apaga todos os arquivos da pasta {userId}/ no bucket otcb-fotos.
  deleteStorageFolder(userId: string): Promise<void>;
  // Desvincula as evidências do usuário (usuario_id = null), preservando a base (seção 7.4).
  anonymizeEvidence(userId: string): Promise<void>;
  // Apaga a linha do usuário em otcb_perfis; fotos, carimbos, opiniões, denúncias e mensagens caem em cascata.
  deleteProfile(userId: string): Promise<void>;
  // Apaga o usuário de auth.users.
  deleteAuthUser(userId: string): Promise<void>;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// Executa "Apagar meus dados" na ordem da 13.8.
// Recebe: a requisição (só o cabeçalho Authorization importa; o corpo é ignorado) e as dependências.
// Devolve: 200 { ok: true }; 401 sem JWT válido; 405 fora de POST; 500 genérico em falha.
// Ordem da 13.8: arquivos do bucket otcb-fotos → anonimizar evidências → apagar otcb_perfis → apagar auth.users.
export async function handleDeleteAccount(req: Request, deps: DeleteAccountDeps): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "metodo_nao_permitido" }), { status: 405, headers: JSON_HEADERS });
  }

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  // O id vem só do JWT, nunca do corpo: ninguém apaga a conta de outra pessoa (matriz 5.2).
  const userId = token ? await deps.getUserIdFromToken(token) : null;
  if (!userId) {
    return new Response(JSON.stringify({ error: "nao_autenticado" }), { status: 401, headers: JSON_HEADERS });
  }

  try {
    await deps.deleteStorageFolder(userId);
    await deps.anonymizeEvidence(userId);
    await deps.deleteProfile(userId);
    await deps.deleteAuthUser(userId);
  } catch (_error) {
    // Sem detalhes no log: nada de dado pessoal fora do banco (seção 20).
    console.error("otcb-apagar-conta: falha na exclusão");
    return new Response(JSON.stringify({ error: "falha_exclusao" }), { status: 500, headers: JSON_HEADERS });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
}
