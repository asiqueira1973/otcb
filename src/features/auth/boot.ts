import { supabase } from '../../lib/supabase';
import { discardSessionFromPreviousInstall } from './install-marker';
import { hasRememberedProfile, rememberProfile } from './profile-flag';
import { ensureAnonymousSession } from './session';

export type BootState = 'loading' | 'offline' | 'onboarding' | 'chat';

// Decide a primeira tela (épico 8.1, passos 1 e 6; seção 6). Antes de tudo, descarta a sessão
// herdada de uma instalação anterior (reinstalar = começar do zero).
// Recebe: nada. Devolve: 'chat' com perfil (reabrir com sessão válida vai direto ao Chat);
// 'onboarding' sem perfil; sem rede, 'chat' se este aparelho já criou o perfil desse uid (seção 17)
// ou 'offline' (copy 15.9 de primeira abertura).
export async function resolveBootState(): Promise<BootState> {
  let userId: string | null = null;
  try {
    await discardSessionFromPreviousInstall(supabase);
    const session = await ensureAnonymousSession(supabase);
    userId = session.user.id;
    // Colunas explícitas, nunca select("*") com o cliente do usuário.
    const { data, error } = await supabase.from('otcb_perfis').select('id').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (data) await rememberProfile(userId);
    return data ? 'chat' : 'onboarding';
  } catch {
    return userId && (await hasRememberedProfile(userId)) ? 'chat' : 'offline';
  }
}
