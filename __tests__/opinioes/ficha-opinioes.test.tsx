import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { BarSheetProvider } from '../../src/features/bares/BarSheet';
import { Blocks } from '../../src/features/chat/Blocks';
import { copy } from '../../src/lib/copy';
import { bar } from '../../test-utils/chat-fixtures';
import { renderWithSafeArea } from '../../test-utils/render';

// Ficha do bar no 8.8: 10 opiniões por página com "Ver mais", resumo da IA antes das opiniões, e a opinião da
// própria pessoa à parte — oculta, com a 15.17 (critério 3), e sem "Denunciar".

const mockRpc = jest.fn();
const mockMinha = jest.fn();
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: (t: string) =>
      t === 'otcb_perfis'
        ? { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { apelido: 'eu' } }) }) }) }
        : { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => mockMinha() }) }) }) },
  },
}));
jest.mock('../../src/lib/telemetry', () => ({ track: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const op = (i: number) => ({ opiniao_id: `op${i}`, apelido: `pessoa${i}`, nota: 4, texto: `Opinião ${i}`, criado_em: '2026-11-07T22:00:00Z' });

beforeEach(() => {
  jest.clearAllMocks();
  mockMinha.mockResolvedValue({ data: null });
});

async function abrir(resumo: string | null = null) {
  await renderWithSafeArea(
    <BarSheetProvider onCard={jest.fn()}>
      <Blocks blocos={[{ tipo: 'card_bar', bar: bar('b1', { resumo_opinioes: resumo }) }]} />
    </BarSheetProvider>,
  );
  await fireEvent.press(screen.getByTestId('card-bar-b1'));
}

it('10 por página: "Ver mais" busca a página 1 e some quando vem menos de 10', async () => {
  mockRpc.mockImplementation((_n: string, args: { p_pagina: number }) =>
    Promise.resolve({ data: args.p_pagina === 0 ? Array.from({ length: 10 }, (_, i) => op(i)) : [op(10), op(11)], error: null }));
  await abrir();
  await waitFor(() => expect(screen.getByText('Opinião 9')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('ficha-ver-mais'));
  await waitFor(() => expect(screen.getByText('Opinião 11')).toBeTruthy());
  expect(mockRpc).toHaveBeenCalledWith('otcb_opinioes_do_bar', { p_bar_id: 'b1', p_pagina: 1 });
  expect(screen.queryByTestId('ficha-ver-mais')).toBeNull();
});

it('critério 3: a própria opinião oculta aparece só para o dono, com a 15.17 e sem "Denunciar"', async () => {
  mockRpc.mockResolvedValue({ data: [op(1)], error: null });
  mockMinha.mockResolvedValue({ data: { id: 'op-minha', texto: 'Minha opinião escondida', nota: 2, status: 'oculta_denuncias', criado_em: '2026-11-06T20:00:00Z' } });
  await abrir();
  await waitFor(() => expect(screen.getByText(copy.sheet.yoursHidden)).toBeTruthy());
  expect(screen.getByText('Minha opinião escondida')).toBeTruthy();
  expect(screen.queryByTestId('denunciar-op-minha')).toBeNull();
  expect(screen.getByTestId('denunciar-op1')).toBeTruthy();
});

it('a própria publicada aparece destacada, sem repetir na lista e sem aviso', async () => {
  mockRpc.mockResolvedValue({ data: [{ ...op(1), opiniao_id: 'op-minha', apelido: 'eu', texto: 'Minha publicada' }, op(2)], error: null });
  mockMinha.mockResolvedValue({ data: { id: 'op-minha', texto: 'Minha publicada', nota: 5, status: 'publicada', criado_em: '2026-11-06T20:00:00Z' } });
  await abrir();
  await waitFor(() => expect(screen.getByTestId('minha-opiniao')).toBeTruthy());
  expect(screen.getAllByText('Minha publicada')).toHaveLength(1);
  expect(screen.queryByText(copy.sheet.yoursHidden)).toBeNull();
});

it('o resumo da IA vem antes das opiniões', async () => {
  mockRpc.mockResolvedValue({ data: [op(1)], error: null });
  await abrir('Colarinho caprichado e atendimento rápido.');
  await waitFor(() => expect(screen.getByText('Opinião 1')).toBeTruthy());
  const textos = screen.getAllByText(/.+/).map((n) => [n.props.children].flat().join(''));
  expect(textos.indexOf('Colarinho caprichado e atendimento rápido.')).toBeLessThan(textos.indexOf(copy.sheet.opinions));
});
