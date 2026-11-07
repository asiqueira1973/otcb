import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import NicknameScreen from '../../app/(onboarding)/apelido';
import LocationScreen from '../../app/(onboarding)/localizacao';
import AgeScreen from '../../app/(onboarding)/maioridade';
import WelcomeScreen from '../../app/(onboarding)/boas-vindas';
import { copy } from '../../src/lib/copy';

// Testes de tela do onboarding (épico 8.1): bloqueio/liberação por idade, erros inline do apelido,
// localização negada ainda chega ao Chat e nenhuma tela pede e-mail, telefone, senha ou login.

const mockRouter = { push: jest.fn(), replace: jest.fn() };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
}));

const mockInsert = jest.fn();
const mockInvoke = jest.fn();
const mockSignOut = jest.fn();
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'uid-a' } } }),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: () => ({ insert: (...args: unknown[]) => mockInsert(...args) }),
  },
}));

const mockRequestPermission = jest.fn();
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestPermission(...args),
}));

// Fixa "hoje" em 07/11/2026 15:00 de São Paulo.
beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-07T18:00:00Z'), doNotFake: ['setTimeout', 'setImmediate', 'nextTick'] });
  jest.clearAllMocks();
  mockParams = {};
  mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
  mockSignOut.mockResolvedValue({ error: null });
});
afterEach(() => jest.useRealTimers());

describe('T2 Maioridade', () => {
  it('17 anos e 364 dias: apaga a conta anônima e vai ao bloqueio', async () => {
    await render(<AgeScreen />);
    await fireEvent.changeText(screen.getByTestId('data-nascimento'), '08112008');
    await fireEvent.press(screen.getByTestId('confirmar-idade'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/bloqueio'));
    expect(mockInvoke).toHaveBeenCalledWith('otcb-apagar-conta', { method: 'POST' });
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('18 anos exatos: segue para o apelido levando só o instante da confirmação', async () => {
    await render(<AgeScreen />);
    await fireEvent.changeText(screen.getByTestId('data-nascimento'), '07112008');
    await fireEvent.press(screen.getByTestId('confirmar-idade'));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
    const [arg] = mockRouter.push.mock.calls[0];
    expect(arg.pathname).toBe('/apelido');
    expect(Object.keys(arg.params)).toEqual(['confirmadaEm']);
    // A data de nascimento não sai da tela (seção 20).
    expect(JSON.stringify(arg)).not.toContain('2008');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('data inválida mostra erro inline', async () => {
    await render(<AgeScreen />);
    await fireEvent.changeText(screen.getByTestId('data-nascimento'), '31022000');
    await fireEvent.press(screen.getByTestId('confirmar-idade'));
    expect(await screen.findByText(copy.age.invalidDate)).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('falha de rede ao apagar a conta ainda leva ao bloqueio', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('offline'));
    await render(<AgeScreen />);
    await fireEvent.changeText(screen.getByTestId('data-nascimento'), '01012015');
    await fireEvent.press(screen.getByTestId('confirmar-idade'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/bloqueio'));
    expect(mockSignOut).toHaveBeenCalled();
  });
});

describe('T3 Apelido', () => {
  beforeEach(() => {
    mockParams = { confirmadaEm: '2026-11-07T18:00:00.000Z' };
  });

  it('formato inválido mostra erro inline sem gravar', async () => {
    await render(<NicknameScreen />);
    await fireEvent.changeText(screen.getByTestId('apelido'), 'jo');
    await fireEvent.press(screen.getByTestId('salvar-apelido'));
    expect(await screen.findByText(copy.nickname.formatError)).toBeTruthy();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('apelido já usado (23505) mostra "Esse apelido já está em uso"', async () => {
    mockInsert.mockResolvedValueOnce({ error: { code: '23505' } });
    await render(<NicknameScreen />);
    await fireEvent.changeText(screen.getByTestId('apelido'), 'Fulano');
    await fireEvent.press(screen.getByTestId('salvar-apelido'));
    expect(await screen.findByText(copy.nickname.takenError)).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('grava o perfil com o instante da confirmação e vai à localização', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    await render(<NicknameScreen />);
    await fireEvent.changeText(screen.getByTestId('apelido'), ' Fulano_10 ');
    await fireEvent.changeText(screen.getByTestId('time'), 'Santos');
    await fireEvent.press(screen.getByTestId('salvar-apelido'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/localizacao'));
    expect(mockInsert).toHaveBeenCalledWith({
      id: 'uid-a',
      apelido: 'Fulano_10',
      maioridade_confirmada_em: '2026-11-07T18:00:00.000Z',
      time_do_coracao: 'Santos',
    });
  });

  it('time vazio é gravado como nulo', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    await render(<NicknameScreen />);
    await fireEvent.changeText(screen.getByTestId('apelido'), 'Fulano');
    await fireEvent.press(screen.getByTestId('salvar-apelido'));
    await waitFor(() => expect(mockInsert).toHaveBeenCalled());
    expect(mockInsert.mock.calls[0][0].time_do_coracao).toBeNull();
  });
});

describe('T4 Localização', () => {
  it('permissão negada ainda leva ao Chat', async () => {
    mockRequestPermission.mockResolvedValueOnce({ status: 'denied', granted: false });
    await render(<LocationScreen />);
    await fireEvent.press(screen.getByTestId('permitir-localizacao'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/chat'));
  });

  it('"Agora não" leva ao Chat sem pedir permissão', async () => {
    await render(<LocationScreen />);
    await fireEvent.press(screen.getByTestId('agora-nao'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/chat');
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });
});

describe('sem login (critério 1 do 8.1)', () => {
  it.each([
    ['Boas-vindas', WelcomeScreen],
    ['Maioridade', AgeScreen],
    ['Apelido', NicknameScreen],
    ['Localização', LocationScreen],
  ])('%s não pede e-mail, telefone, senha nem login social', async (_name, Component) => {
    const { toJSON } = await render(<Component />);
    const text = JSON.stringify(toJSON()).toLowerCase();
    for (const word of ['e-mail', 'email', 'telefone', 'senha', 'password', 'login', 'entrar com', 'google', 'apple']) {
      expect(text).not.toContain(word);
    }
  });
});
