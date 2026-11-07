import AsyncStorage from '@react-native-async-storage/async-storage';

import { resolveBootState } from '../boot';
import { forgetProfile, rememberProfile } from '../profile-flag';

// Testes do roteamento inicial (épico 8.1): reabrir com sessão válida vai direto ao Chat,
// sem perfil vai ao onboarding, e sem rede na primeira abertura mostra a copy 15.9.

const mockGetSession = jest.fn();
const mockSignIn = jest.fn();
const mockMaybeSingle = jest.fn();
const mockSignOut = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signInAnonymously: () => mockSignIn(),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }) }),
  },
}));

const session = (id: string) => ({ data: { session: { user: { id } } } });

beforeEach(async () => {
  jest.clearAllMocks();
  await forgetProfile();
  // Por padrão o app já foi aberto antes neste aparelho (marca de instalação presente).
  await AsyncStorage.clear();
  await AsyncStorage.setItem('otcb_instalacao', '1');
  mockSignOut.mockResolvedValue({ error: null });
});

it('sessão guardada com perfil → Chat, sem criar usuário', async () => {
  mockGetSession.mockResolvedValue(session('uid-a'));
  mockMaybeSingle.mockResolvedValue({ data: { id: 'uid-a' }, error: null });
  await expect(resolveBootState()).resolves.toBe('chat');
  expect(mockSignIn).not.toHaveBeenCalled();
});

it('primeira abertura → cria sessão anônima e vai ao onboarding', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockSignIn.mockResolvedValue({ data: { session: { user: { id: 'uid-novo' } } }, error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  await expect(resolveBootState()).resolves.toBe('onboarding');
  expect(mockSignIn).toHaveBeenCalledTimes(1);
});

it('primeira abertura sem rede → offline', async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockSignIn.mockResolvedValue({ data: { session: null }, error: new Error('Network request failed') });
  await expect(resolveBootState()).resolves.toBe('offline');
});

it('reabrir sem rede com perfil já criado neste aparelho → Chat', async () => {
  await rememberProfile('uid-a');
  mockGetSession.mockResolvedValue(session('uid-a'));
  mockMaybeSingle.mockRejectedValue(new Error('Network request failed'));
  await expect(resolveBootState()).resolves.toBe('chat');
});

it('reabrir sem rede e sem perfil criado → offline', async () => {
  mockGetSession.mockResolvedValue(session('uid-b'));
  mockMaybeSingle.mockRejectedValue(new Error('Network request failed'));
  await expect(resolveBootState()).resolves.toBe('offline');
});

it('reinstalação: sessão que sobreviveu no Keychain é descartada e nasce usuário novo (critério 4 do 8.1)', async () => {
  // No iOS o Keychain (expo-secure-store) sobrevive à desinstalação; o AsyncStorage não.
  await AsyncStorage.clear();
  let stored: object | null = { user: { id: 'uid-antigo' } };
  mockGetSession.mockImplementation(() => Promise.resolve({ data: { session: stored } }));
  mockSignOut.mockImplementation(() => {
    stored = null;
    return Promise.resolve({ error: null });
  });
  mockSignIn.mockResolvedValue({ data: { session: { user: { id: 'uid-novo' } } }, error: null });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });

  await expect(resolveBootState()).resolves.toBe('onboarding');
  expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(mockSignIn).toHaveBeenCalledTimes(1);
  await expect(AsyncStorage.getItem('otcb_instalacao')).resolves.not.toBeNull();
});
