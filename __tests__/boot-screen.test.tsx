import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Boot from '../app/index';
import { copy } from '../src/lib/copy';

// Tela de abertura (épico 8.1; substitui o teste de fumaça do 8.0, que renderizava a tela provisória).
// Confere o roteamento inicial e o estado sem rede da primeira abertura (copy 15.9).

const mockResolve = jest.fn();
jest.mock('../src/features/auth/boot', () => ({
  resolveBootState: () => mockResolve(),
}));

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text: RNText } = require('react-native');
    return <RNText>{`redirect:${href}`}</RNText>;
  },
}));

beforeEach(() => jest.clearAllMocks());

it('com perfil vai direto ao Chat', async () => {
  mockResolve.mockResolvedValue('chat');
  await render(<Boot />);
  expect(await screen.findByText('redirect:/chat')).toBeTruthy();
});

it('sem perfil vai à Boas-vindas', async () => {
  mockResolve.mockResolvedValue('onboarding');
  await render(<Boot />);
  expect(await screen.findByText('redirect:/boas-vindas')).toBeTruthy();
});

it('sem rede na primeira abertura mostra a copy 15.9 e tenta de novo', async () => {
  mockResolve.mockResolvedValueOnce('offline').mockResolvedValueOnce('onboarding');
  await render(<Boot />);
  expect(await screen.findByText(copy.errors.firstOpenNoNetwork)).toBeTruthy();
  await fireEvent.press(screen.getByText(copy.errors.retry));
  await waitFor(() => expect(screen.getByText('redirect:/boas-vindas')).toBeTruthy());
  expect(mockResolve).toHaveBeenCalledTimes(2);
});
