// Sanitização de mensagens de erro e de log (critério 6 do épico 8.3; seção 20: segredos só no servidor).
// Recebe: uma mensagem e os segredos conhecidos. Devolve: a mensagem sem segredos, tokens, chaves de API nem
// query strings de URL. Usada antes de gravar em otcb_execucoes_garimpo.erros e antes de qualquer console.

const PADROES: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]+/g, // Anthropic
  /AIza[0-9A-Za-z_-]{20,}/g, // Google
  /fc-[A-Za-z0-9]{16,}/g, // Firecrawl
  /sb_secret_[A-Za-z0-9_-]+/g, // Supabase
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWT
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /(key|token|secret|api[_-]?key)=([^&\s]+)/gi,
];

export function sanitize(message: string, secrets: (string | undefined)[] = []): string {
  let out = message;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) out = out.split(secret).join("[redigido]");
  }
  for (const padrao of PADROES) out = out.replace(padrao, "[redigido]");
  // Query strings podem carregar chaves: mantém só origem + caminho.
  out = out.replace(/(https?:\/\/[^\s?#]+)\?[^\s]*/g, "$1?[redigido]");
  return out.slice(0, 500);
}

// Converte qualquer erro em texto sanitizado. Recebe: o erro e os segredos. Devolve: a mensagem limpa.
export function errorMessage(error: unknown, secrets: (string | undefined)[] = []): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return sanitize(raw, secrets);
}
