import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import Profile from '../../app/perfil';
import Privacy from '../../app/privacidade';
import Terms from '../../app/termos';
import { copy } from '../../src/lib/copy';
import { LEGAL_CONTACT, LEGAL_OWNER } from '../../src/lib/legal';
import { renderWithSafeArea } from '../../test-utils/render';

// T9 Perfil (épicos 8.4 e 8.10): limpar conversa, apelido e time editáveis, termos e privacidade e
// "Apagar meus dados" em duas etapas (15.21), com a limpeza do aparelho só depois do servidor confirmar.

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockDismissAll = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    replace: (...a: unknown[]) => mockReplace(...a),
    push: (...a: unknown[]) => mockPush(...a),
    canDismiss: () => true,
    dismissAll: () => mockDismissAll(),
  },
}));

const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn();
const mockInvoke = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockSignInAnon = jest.fn();
let mockPerfil: { apelido: string; time_do_coracao: string | null } | null = { apelido: 'ana_sp', time_do_coracao: 'Corinthians' };
let mockPerfilErro: unknown = null;
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      signOut: (...a: unknown[]) => mockSignOut(...a),
      getSession: () => mockGetSession(),
      signInAnonymously: () => mockSignInAnon(),
    },
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    from: (t: string) => ({
      delete: () => { mockDelete(t); return { eq: (...a: unknown[]) => mockEq(...a) }; },
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: mockPerfilErro ? null : mockPerfil, error: mockPerfilErro }) }) }),
      update: (v: unknown) => { mockUpdate(t, v); return { eq: (...a: unknown[]) => mockUpdateEq(...a) }; },
    }),
  },
}));

const mockTrack = jest.fn();
jest.mock('../../src/lib/telemetry', () => ({
  track: (...a: unknown[]) => mockTrack(...a),
  flushTelemetry: () => Promise.resolve(),
}));

const mockForget = jest.fn();
jest.mock('../../src/features/auth/profile-flag', () => ({ forgetProfile: () => mockForget() }));

// Pasta da fila de fotos (expo-file-system): registra a exclusão.
const mockDirDelete = jest.fn();
jest.mock('expo-file-system', () => ({
  Paths: { document: 'doc' },
  Directory: jest.fn().mockImplementation((_base: string, name: string) => ({ name, exists: true, delete: () => mockDirDelete(name) })),
}));

const LOCAL = ['otcb_fila_fotos', 'otcb_mensagens_locais', 'otcb_passaporte_cache', 'otcb_selos_vistos', 'otcb_card:abc', 'otcb_instalacao'];

beforeEach(async () => {
  jest.clearAllMocks();
  mockPerfil = { apelido: 'ana_sp', time_do_coracao: 'Corinthians' };
  mockPerfilErro = null;
  mockEq.mockResolvedValue({ error: null });
  mockUpdateEq.mockResolvedValue({ error: null });
  mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
  mockSignOut.mockResolvedValue({ error: null });
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockSignInAnon.mockResolvedValue({ data: { session: { user: { id: 'u2' } } }, error: null });
  mockForget.mockResolvedValue(undefined);
  await AsyncStorage.clear();
  await AsyncStorage.multiSet(LOCAL.map((k) => [k, '1']));
});

// Responde ao alerta tocando no botão com o rótulo dado.
function pressInAlert(label: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === label)?.onPress?.();
  });
}

it('Limpar conversa confirma, apaga as mensagens do próprio usuário e avisa', async () => {
  const alert = pressInAlert(copy.profile.clearAction);
  await renderWithSafeArea(<Profile />);
  expect(screen.getByText(copy.profile.footer)).toBeTruthy();
  expect(screen.getByText(copy.profile.passportNotice)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('limpar-conversa'));
  expect(alert).toHaveBeenCalledWith(copy.profile.clearChat, copy.profile.clearConfirm, expect.any(Array));
  await waitFor(() => expect(screen.getByText(copy.profile.cleared)).toBeTruthy());
  expect(mockDelete).toHaveBeenCalledWith('otcb_mensagens');
  expect(mockEq).toHaveBeenCalledWith('usuario_id', 'u1');
});

it('cancelar não apaga nada', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await renderWithSafeArea(<Profile />);
  await fireEvent.press(screen.getByTestId('limpar-conversa'));
  expect(mockDelete).not.toHaveBeenCalled();
});

describe('8.10 apelido e time', () => {
  it('mostra os atuais e salva só apelido e time', async () => {
    await renderWithSafeArea(<Profile />);
    await waitFor(() => expect(screen.getByTestId('perfil-apelido').props.value).toBe('ana_sp'));
    expect(screen.getByTestId('perfil-time').props.value).toBe('Corinthians');
    await fireEvent.changeText(screen.getByTestId('perfil-apelido'), ' ana.sp ');
    await fireEvent.changeText(screen.getByTestId('perfil-time'), '');
    await fireEvent.press(screen.getByTestId('salvar-perfil'));
    await waitFor(() => expect(screen.getByText(copy.profile.saved)).toBeTruthy());
    expect(mockUpdate).toHaveBeenCalledWith('otcb_perfis', { apelido: 'ana.sp', time_do_coracao: null });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'u1');
  });

  it('apelido fora do formato não vai ao banco; apelido em uso mostra o erro do onboarding', async () => {
    await renderWithSafeArea(<Profile />);
    await fireEvent.changeText(screen.getByTestId('perfil-apelido'), 'a!');
    await fireEvent.press(screen.getByTestId('salvar-perfil'));
    expect(await screen.findByText(copy.nickname.formatError)).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();

    mockUpdateEq.mockResolvedValue({ error: { code: '23505' } });
    await fireEvent.changeText(screen.getByTestId('perfil-apelido'), 'bia_sp');
    await fireEvent.press(screen.getByTestId('salvar-perfil'));
    expect(await screen.findByText(copy.nickname.takenError)).toBeTruthy();
  });
});

describe('8.10 termos e privacidade', () => {
  it('o Perfil abre as duas telas, que trazem a Dab Lab e o e-mail de contato (25.4)', async () => {
    await renderWithSafeArea(<Profile />);
    await fireEvent.press(screen.getByTestId('abrir-termos'));
    expect(mockPush).toHaveBeenCalledWith('/termos');
    await fireEvent.press(screen.getByTestId('abrir-privacidade'));
    expect(mockPush).toHaveBeenCalledWith('/privacidade');

    for (const Tela of [Terms, Privacy]) {
      const { unmount } = await renderWithSafeArea(<Tela />);
      const texto = JSON.stringify(screen.toJSON());
      expect(texto).toContain(LEGAL_OWNER);
      expect(texto).toContain(LEGAL_CONTACT);
      await unmount();
    }
  });
});

describe('8.10 Apagar meus dados', () => {
  it('duas etapas (15.21): cancelar na etapa 1 não apaga', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithSafeArea(<Profile />);
    await fireEvent.press(screen.getByTestId('apagar-dados'));
    expect(alert).toHaveBeenCalledWith(copy.profile.deleteData, copy.profile.deleteConfirm, [
      expect.objectContaining({ text: copy.profile.cancel }),
      expect.objectContaining({ text: copy.profile.deleteAction, style: 'destructive' }),
    ]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('"Apagar tudo": servidor apaga → limpa o aparelho, sai, cria identidade nova e vai à Boas-vindas', async () => {
    pressInAlert(copy.profile.deleteAction);
    await renderWithSafeArea(<Profile />);
    await fireEvent.press(screen.getByTestId('apagar-dados'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/boas-vindas'));
    expect(mockTrack).toHaveBeenCalledWith('otcb_conta_apagada');
    expect(mockInvoke).toHaveBeenCalledWith('otcb-apagar-conta', { method: 'POST' });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockSignInAnon).toHaveBeenCalled();
    expect(mockForget).toHaveBeenCalled();
    expect(mockDirDelete).toHaveBeenCalledWith('otcb-fila');
    expect([...(await AsyncStorage.getAllKeys())].sort()).toEqual(['otcb_instalacao']);
    // A telemetria sai antes do signOut, ainda com o uid antigo.
    expect(mockTrack.mock.invocationCallOrder[0]).toBeLessThan(mockSignOut.mock.invocationCallOrder[0]);
  });

  it.each([
    ['500 do servidor', () => mockInvoke.mockResolvedValue({ data: null, error: new Error('500') })],
    ['sem rede', () => mockInvoke.mockRejectedValue(new TypeError('Network request failed'))],
  ])('%s: mantém sessão e dados do aparelho e mostra a 15.9', async (_nome, falhar) => {
    falhar();
    const alert = pressInAlert(copy.profile.deleteAction);
    await renderWithSafeArea(<Profile />);
    await fireEvent.press(screen.getByTestId('apagar-dados'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(copy.errors.noNetwork));
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockForget).not.toHaveBeenCalled();
    expect(mockDirDelete).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect([...(await AsyncStorage.getAllKeys())].sort()).toEqual([...LOCAL].sort());
  });

  it('servidor que não responde em 10 s conta como falha (critério 2)', async () => {
    jest.useFakeTimers();
    mockInvoke.mockReturnValue(new Promise(() => undefined));
    const alert = pressInAlert(copy.profile.deleteAction);
    await renderWithSafeArea(<Profile />);
    await fireEvent.press(screen.getByTestId('apagar-dados'));
    await jest.advanceTimersByTimeAsync(10_000);
    jest.useRealTimers();
    await waitFor(() => expect(alert).toHaveBeenCalledWith(copy.errors.noNetwork));
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});

// ===================================================================== verifier do 8.10

describe('verifier 8.10', () => {
  it('impedimento: depois de apagar, a pilha é esvaziada antes da Boas-vindas (o Chat antigo não fica atrás)', async () => {
    pressInAlert(copy.profile.deleteAction);
    await renderWithSafeArea(<Profile />);
    await fireEvent.press(screen.getByTestId('apagar-dados'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/boas-vindas'));
    expect(mockDismissAll).toHaveBeenCalled();
    expect(mockDismissAll.mock.invocationCallOrder[0]).toBeLessThan(mockReplace.mock.invocationCallOrder[0]);
  });

  it('401 da função (conta já apagada numa tentativa que estourou o tempo) conta como apagada', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: Object.assign(new Error('401'), { context: { status: 401 } }) });
    pressInAlert(copy.profile.deleteAction);
    await renderWithSafeArea(<Profile />);
    await fireEvent.press(screen.getByTestId('apagar-dados'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/boas-vindas'));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('otcb_conta_apagada só sai quando o servidor apagou', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: Object.assign(new Error('500'), { context: { status: 500 } }) });
    const alert = pressInAlert(copy.profile.deleteAction);
    await renderWithSafeArea(<Profile />);
    await fireEvent.press(screen.getByTestId('apagar-dados'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(copy.errors.noNetwork));
    expect(mockTrack).not.toHaveBeenCalledWith('otcb_conta_apagada');
  });

  it('sem rede ao abrir: mostra a 15.9 e não deixa salvar campos vazios', async () => {
    mockPerfilErro = { message: 'Network request failed' };
    await renderWithSafeArea(<Profile />);
    expect(await screen.findByText(copy.errors.noNetwork)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('salvar-perfil'));
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.queryByText(copy.nickname.formatError)).toBeNull();
  });

  it('enquanto apaga, Salvar e Limpar conversa ficam desativados', async () => {
    mockInvoke.mockReturnValue(new Promise(() => undefined));
    // Confirma qualquer alerta (apagar e limpar), para o teste não passar só porque o alerta não foi aceito.
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await renderWithSafeArea(<Profile />);
    await waitFor(() => expect(screen.getByTestId('perfil-apelido').props.value).toBe('ana_sp'));
    await fireEvent.press(screen.getByTestId('apagar-dados'));
    await fireEvent.press(screen.getByTestId('salvar-perfil'));
    await fireEvent.press(screen.getByTestId('limpar-conversa'));
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
