import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import Profile from '../../app/perfil';
import { copy } from '../../src/lib/copy';
import { renderWithSafeArea } from '../../test-utils/render';

// T9 mínimo (épico 8.4, critério 7): "Limpar conversa" pede confirmação e apaga só as mensagens do usuário.

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
const mockDelete = jest.fn();
const mockEq = jest.fn();
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: (t: string) => ({ delete: () => { mockDelete(t); return { eq: (...a: unknown[]) => mockEq(...a) }; } }),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockResolvedValue({ error: null });
});

it('Limpar conversa confirma, apaga as mensagens do próprio usuário e avisa', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === copy.profile.clearAction)?.onPress?.();
  });
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
