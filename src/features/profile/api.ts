import { nicknameErrorFromDb, validateNickname } from '../auth/nickname';
import { supabase } from '../../lib/supabase';

// Perfil editável (épico 8.10; T9): apelido e time do coração da própria linha em otcb_perfis.

export type MyProfile = { nickname: string; team: string };
export type SaveProfileResult = 'ok' | 'formato' | 'em_uso' | 'rede';

// Lê o próprio perfil com colunas explícitas (nunca select("*") com o cliente do usuário).
// Recebe: nada. Devolve: apelido e time, ou null sem sessão, sem rede ou sem perfil.
export async function loadMyProfile(): Promise<MyProfile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from('otcb_perfis').select('apelido, time_do_coracao').eq('id', auth.user.id).maybeSingle();
  if (error || !data) return null;
  return { nickname: data.apelido, team: data.time_do_coracao ?? '' };
}

// Grava apelido e time (grant por coluna do 8.1: o cliente só atualiza essas colunas e o papel).
// Recebe: apelido e time digitados. Devolve: 'ok', 'formato' / 'em_uso' (regra 11.7, como no onboarding) ou 'rede'.
export async function saveMyProfile(nickname: string, team: string): Promise<SaveProfileResult> {
  const value = nickname.trim();
  if (validateNickname(value)) return 'formato';
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 'rede';
  const { error } = await supabase.from('otcb_perfis')
    .update({ apelido: value, time_do_coracao: team.trim() || null })
    .eq('id', auth.user.id);
  if (!error) return 'ok';
  return nicknameErrorFromDb(error.code) ?? 'rede';
}
