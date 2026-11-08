import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import Camera from '../../app/camera';
import type { ResultadoColarinho } from '../../src/features/chat/types';
import { enfileirar, processarFila, tamanhoFila } from '../../src/features/colarinhometro/fila';
import { copy } from '../../src/lib/copy';
import { renderWithSafeArea } from '../../test-utils/render';

// Pontos do verifier no 8.6: 12.5 (IA fora no Colarinhômetro → foto guardada, "a nota sai em instantes",
// até 3 tentativas com 1 min de intervalo, depois 15.9), 12.4 (descarte de 24 h com aviso) e corrida na fila.

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) } },
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => Promise.resolve({ status: 'denied' }),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('../../src/lib/telemetry', () => ({ track: jest.fn() }));

const BLOCO = { tipo: 'resultado_colarinho', foto_id: 'f1' } as ResultadoColarinho;
const agora = () => new Date().toISOString();

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

it('12.5: IA fora na Câmera guarda a foto e avisa que a nota sai em instantes', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({ codigo: 'ia_indisponivel' }) }) as never;
  await renderWithSafeArea(<Camera />);
  await fireEvent.press(screen.getByTestId('tirar-foto'));
  await waitFor(() => expect(screen.getByTestId('foto-sim')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('foto-sim'));
  await waitFor(() => expect(screen.getByText(copy.colarinho.scoreSoon)).toBeTruthy());
  expect(await tamanhoFila()).toBe(1);
});

it('12.5: falha de IA reprocessa só depois de 1 min e desiste na 3ª, avisando com 15.9', async () => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'setImmediate', 'nextTick'] });
  const inicio = Date.now();
  jest.setSystemTime(inicio);
  await enfileirar('file:///a.jpg', null, 'sim', agora(), 1);
  const enviar = jest.fn().mockResolvedValue({ ok: false, falha: 'ia' });
  const aoDesistir = jest.fn();
  await processarFila(enviar, jest.fn(), aoDesistir);
  expect(enviar).toHaveBeenCalledTimes(0); // a 1ª tentativa foi na Câmera, há menos de 1 min
  jest.setSystemTime(inicio + 61_000);
  await processarFila(enviar, jest.fn(), aoDesistir);
  expect(enviar).toHaveBeenCalledTimes(1);
  expect(await tamanhoFila()).toBe(1);
  jest.setSystemTime(inicio + 122_000);
  await processarFila(enviar, jest.fn(), aoDesistir);
  expect(enviar).toHaveBeenCalledTimes(2);
  expect(await tamanhoFila()).toBe(0);
  expect(aoDesistir).toHaveBeenCalledWith(expect.anything(), 'ia');
  jest.useRealTimers();
});

it('12.4: foto com mais de 24 h é descartada com aviso', async () => {
  await enfileirar('file:///velha.jpg', null, 'sim', new Date(Date.now() - 25 * 3_600_000).toISOString());
  const aoDesistir = jest.fn();
  await processarFila(jest.fn(), jest.fn(), aoDesistir);
  expect(aoDesistir).toHaveBeenCalledWith(expect.anything(), 'expirou');
  expect(await tamanhoFila()).toBe(0);
});

it('corrida: dois processamentos ao mesmo tempo enviam cada foto uma vez; foto que entra durante o envio não se perde', async () => {
  await enfileirar('file:///a.jpg', null, 'sim', agora());
  let soltar: () => void = () => undefined;
  const enviar = jest.fn(() => new Promise((r) => (soltar = () => r({ ok: true, bloco: BLOCO, totalCarimbos: 1 }))));
  const p1 = processarFila(enviar as never, jest.fn());
  const p2 = processarFila(enviar as never, jest.fn());
  await new Promise((r) => setTimeout(r, 10));
  await enfileirar('file:///b.jpg', null, 'sim', agora());
  soltar();
  await Promise.all([p1, p2]);
  expect(enviar).toHaveBeenCalledTimes(1);
  expect(await tamanhoFila()).toBe(1);
});
