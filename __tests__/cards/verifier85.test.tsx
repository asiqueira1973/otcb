import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { apelidoProprio } from '../../src/features/bares/api';
import { ConfirmationCard } from '../../src/features/cards/ConfirmationCard';
import { copy } from '../../src/lib/copy';
import { renderWithSafeArea } from '../../test-utils/render';

// Bugs apontados pelo verifier no 8.5 (problemas 5 e 6).

const mockRpc = jest.fn();
const mockEq = jest.fn();
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    from: () => ({
      select: () => ({
        eq: (...a: unknown[]) => { mockEq(...a); return { maybeSingle: () => Promise.resolve({ data: { apelido: 'eu' } }) }; },
        limit: () => ({ maybeSingle: () => Promise.resolve({ data: { apelido: 'qualquer_um' } }) }),
      }),
    }),
  },
}));
jest.mock('../../src/lib/telemetry', () => ({ track: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
});

it('problema 5: o apelido próprio é buscado pelo id da pessoa (admin lê todos os perfis)', async () => {
  expect(await apelidoProprio()).toBe('eu');
  expect(mockEq).toHaveBeenCalledWith('id', 'u1');
});

it('problema 6: card de funcionamento só oferece "Fechou" e grava funcionamento/fechado', async () => {
  await renderWithSafeArea(<ConfirmationCard chave="v85:0" barId="b1" assunto="funcionamento" pergunta="O Bar b1 fechou?" />);
  expect(screen.queryByText(copy.cards.yes)).toBeNull();
  expect(screen.queryByText(copy.cards.noMore)).toBeNull();
  await fireEvent.press(screen.getByText(copy.cards.closed));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('otcb_confirmar_bar', { p_bar_id: 'b1', p_assunto: 'funcionamento', p_sinal: 'fechado' }));
});
