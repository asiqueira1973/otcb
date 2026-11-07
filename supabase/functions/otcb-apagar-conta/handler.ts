// Lógica da Edge Function otcb-apagar-conta (spec 13.8 e épico 8.10; usada também no bloqueio de menor, 8.1).
// O handler é puro: recebe as dependências por injeção para ser testado sem rede (seção 22).

// Operações de banco/Auth de que a exclusão precisa, todas executadas com credencial de serviço.
export interface DeleteAccountDeps {
  // Valida o JWT e devolve o id do usuário dono do token, ou null se o token não vale.
  getUserIdFromToken(token: string): Promise<string | null>;
  // Apaga a linha do usuário em otcb_perfis (as tabelas filhas caem em cascata a partir do 8.2).
  deleteProfile(userId: string): Promise<void>;
  // Apaga o usuário de auth.users.
  deleteAuthUser(userId: string): Promise<void>;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// Executa "Apagar meus dados" na ordem da 13.8.
// Recebe: a requisição (só o cabeçalho Authorization importa; o corpo é ignorado) e as dependências.
// Devolve: 200 { ok: true }; 401 sem JWT válido; 405 fora de POST; 500 genérico em falha.
// Ordem da 13.8 implementada até onde os objetos existem:
//   [8.6] arquivos do bucket otcb-fotos → [8.2] anonimizar evidências → apagar otcb_perfis → apagar auth.users.
// Os passos marcados entram no mesmo commit do épico que cria o bucket ou a tabela.
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
    await deps.deleteProfile(userId);
    await deps.deleteAuthUser(userId);
  } catch (_error) {
    // Sem detalhes no log: nada de dado pessoal fora do banco (seção 20).
    console.error("otcb-apagar-conta: falha na exclusão");
    return new Response(JSON.stringify({ error: "falha_exclusao" }), { status: 500, headers: JSON_HEADERS });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: JSON_HEADERS });
}
