import { loadHistory } from '../../src/features/chat/api';

// Bug B3 do verifier (8.4): o histórico precisa trazer as mensagens MAIS RECENTES (até o limite) em ordem
// cronológica, não as mais antigas.

const mockOrder = jest.fn();
const mockLimit = jest.fn();
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => ({
          order: (...a: unknown[]) => {
            mockOrder(...a);
            return { limit: (...b: unknown[]) => mockLimit(...b) };
          },
        }),
      }),
    }),
  },
}));

it('pede as mais recentes (decrescente com limite) e devolve em ordem cronológica', async () => {
  mockLimit.mockResolvedValue({
    data: [
      { id: 'm3', papel: 'assistente', conteudo: 'c', blocos: null, criado_em: '2026-11-08T03:00:00Z' },
      { id: 'm2', papel: 'usuario', conteudo: 'b', blocos: null, criado_em: '2026-11-08T02:00:00Z' },
    ],
    error: null,
  });
  const h = await loadHistory();
  expect(mockOrder).toHaveBeenCalledWith('criado_em', { ascending: false });
  expect(h.map((m) => m.id)).toEqual(['m2', 'm3']);
});
