import * as SecureStore from 'expo-secure-store';

const KEY = 'otcb_perfil_criado';

// Marca no aparelho que o uid atual já tem otcb_perfis (épico 8.1: reabrir com sessão válida vai
// direto ao Chat, mesmo sem rede — seção 17, histórico legível offline). Guarda só o uid, nenhum dado pessoal.
// Recebe: o uid. Devolve: nada.
export async function rememberProfile(userId: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, userId);
}

// Recebe: o uid da sessão. Devolve: true se este aparelho já criou o perfil desse uid.
export async function hasRememberedProfile(userId: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY)) === userId;
}

// Esquece a marca (bloqueio de menor e "Apagar meus dados", 8.10). Recebe: nada. Devolve: nada.
export async function forgetProfile(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
