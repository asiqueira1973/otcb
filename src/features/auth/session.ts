import type { Session, SupabaseClient } from '@supabase/supabase-js';

// Subconjunto do cliente Supabase usado aqui (facilita testar com um cliente simulado).
type AuthClient = Pick<SupabaseClient, 'auth'>;

let inFlight: Promise<Session> | null = null;

// Garante uma sessão anônima no aparelho (spec seção 6 e épico 8.1, passo 1).
// Recebe: o cliente Supabase. Devolve: a sessão guardada, ou uma nova criada por signInAnonymously().
// Single-flight: chamadas simultâneas compartilham a mesma promessa, então a primeira abertura cria
// exatamente 1 usuário anônimo mesmo com montagem dupla ou toques repetidos (critério do 8.1).
// Lança erro quando não há rede e ainda não existe sessão (copy 15.9, primeira abertura).
export function ensureAnonymousSession(client: AuthClient): Promise<Session> {
  if (!inFlight) {
    inFlight = (async () => {
      const { data } = await client.auth.getSession();
      if (data.session) return data.session;
      const { data: created, error } = await client.auth.signInAnonymously();
      if (error || !created.session) throw error ?? new Error('sem_sessao');
      return created.session;
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

// Descarta a identidade anônima atual: apaga a conta no servidor (13.8) e limpa a sessão do aparelho.
// Recebe: o cliente Supabase. Devolve: nada; lança se a exclusão no servidor falhar (a sessão local
// é limpa mesmo assim). Usada no bloqueio de menor (8.1, passo 4) e em 8.10.
export async function deleteAccountAndSignOut(client: AuthClient & Pick<SupabaseClient, 'functions'>) {
  try {
    // O supabase-js devolve a falha em `error` em vez de lançar: relança para o chamador saber.
    const { error } = await client.functions.invoke('otcb-apagar-conta', { method: 'POST' });
    if (error) throw error;
  } finally {
    // Mesmo se a chamada falhar, o aparelho esquece a identidade; o usuário órfão é aceito (24.13).
    await client.auth.signOut({ scope: 'local' });
  }
}
