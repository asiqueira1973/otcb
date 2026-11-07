// Validação do apelido (regra 11.7), espelhando o CHECK e o índice único do banco.

export type NicknameError = 'formato' | 'em_uso';

const NICKNAME_PATTERN = /^[A-Za-z0-9_.]+$/;

// Confere o formato antes de enviar: 3 a 20 caracteres de [A-Za-z0-9_.].
// Recebe: o apelido digitado. Devolve: null se válido, ou 'formato'.
export function validateNickname(nickname: string): NicknameError | null {
  const value = nickname.trim();
  if (value.length < 3 || value.length > 20 || !NICKNAME_PATTERN.test(value)) return 'formato';
  return null;
}

// Traduz o erro do insert em otcb_perfis para o erro de tela.
// Recebe: o código Postgres devolvido pelo PostgREST. Devolve: 'em_uso' (23505, índice único em
// lower(apelido)), 'formato' (23514, CHECK) ou null para qualquer outro erro.
export function nicknameErrorFromDb(code: string | undefined): NicknameError | null {
  if (code === '23505') return 'em_uso';
  if (code === '23514') return 'formato';
  return null;
}
