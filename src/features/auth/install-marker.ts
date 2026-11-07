import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { forgetProfile } from './profile-flag';

const KEY = 'otcb_instalacao';

// Garante "reinstalar = começar do zero" (seção 6 e critério 4 do épico 8.1).
// No iOS o Keychain (expo-secure-store, onde a sessão fica) sobrevive à desinstalação; o AsyncStorage não.
// Sem a marca de instalação no AsyncStorage, esta é a primeira abertura desta instalação: descarta
// qualquer sessão e marca de perfil herdadas do Keychain e grava a marca.
// Recebe: o cliente Supabase. Devolve: nada.
export async function discardSessionFromPreviousInstall(client: Pick<SupabaseClient, 'auth'>): Promise<void> {
  if (await AsyncStorage.getItem(KEY)) return;
  await client.auth.signOut({ scope: 'local' });
  await forgetProfile();
  await AsyncStorage.setItem(KEY, '1');
}
