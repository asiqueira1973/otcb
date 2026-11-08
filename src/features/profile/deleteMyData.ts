import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, Paths } from 'expo-file-system';

import { forgetProfile } from '../auth/profile-flag';
import { ensureAnonymousSession } from '../auth/session';
import { supabase } from '../../lib/supabase';
import { flushTelemetry, track } from '../../lib/telemetry';

// "Apagar meus dados" (épico 8.10; seção 13.8; critério 2: até 10 s).
export const DELETE_TIMEOUT_MS = 10_000;

// Chaves locais com dados da pessoa (fila de fotos, mensagens locais, cache do Passaporte, selos vistos e
// cards já registrados). A marca de instalação fica: o app não foi reinstalado.
const LOCAL_KEYS = ['otcb_fila_fotos', 'otcb_mensagens_locais', 'otcb_passaporte_cache', 'otcb_selos_vistos'];
const LOCAL_PREFIXES = ['otcb_card:'];

// Apaga do aparelho o que é da pessoa: chaves locais e as fotos da fila (Documents/otcb-fila).
// Recebe: nada. Devolve: nada; falhas locais não impedem o resto.
export async function clearLocalData(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const doomed = keys.filter((k) => LOCAL_KEYS.includes(k) || LOCAL_PREFIXES.some((p) => k.startsWith(p)));
    if (doomed.length > 0) await AsyncStorage.multiRemove(doomed);
  } catch {
    // Sem AsyncStorage não há o que apagar.
  }
  try {
    const queueDir = new Directory(Paths.document, 'otcb-fila');
    if (queueDir.exists) queueDir.delete();
  } catch {
    // Pasta já ausente.
  }
  await forgetProfile().catch(() => undefined);
}

// Teto da telemetria antes de sair da sessão: ela nunca segura a tela (rede ruim).
const TELEMETRY_CAP_MS = 2_000;

// Recebe: o erro do supabase-js. Devolve: true se a função respondeu 401 — o JWT já não vale porque a conta
// foi apagada numa tentativa anterior que estourou o tempo (verifier do 8.10): conta como apagada.
function alreadyDeleted(error: unknown): boolean {
  const status = (error as { context?: { status?: number } } | null)?.context?.status;
  return status === 401;
}

// Executa a exclusão. Ordem: otcb-apagar-conta (até 10 s) → só com sucesso: telemetria (ainda com o uid
// antigo, até 2 s) → limpa o aparelho → sai da sessão → cria a identidade anônima nova.
// Diferente do bloqueio de menor (8.1): se o servidor falhar, nada é descartado e a pessoa vê o erro,
// para não sair achando que apagou. Recebe: nada. Devolve: true se apagou; false se falhou.
export async function deleteMyData(): Promise<boolean> {
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('tempo_esgotado')), DELETE_TIMEOUT_MS);
    });
    const call = supabase.functions.invoke('otcb-apagar-conta', { method: 'POST' });
    const { error } = await Promise.race([call, timeout]).finally(() => clearTimeout(timer));
    if (error && !alreadyDeleted(error)) return false;
  } catch {
    return false;
  }
  track('otcb_conta_apagada');
  await Promise.race([flushTelemetry().catch(() => undefined), new Promise((r) => setTimeout(r, TELEMETRY_CAP_MS))]);
  await clearLocalData();
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  // Sem rede aqui, a Boas-vindas segue e a abertura cria a sessão depois (8.1).
  await ensureAnonymousSession(supabase).catch(() => undefined);
  return true;
}
