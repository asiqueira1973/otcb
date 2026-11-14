// Bug real em produção (13/11/2026): no build da loja o fetch é o expo/fetch (Expo SDK 58), que não aceita o
// arquivo do FormData no formato { uri, name, type } do React Native: lança antes de enviar e o app tratava como
// "sem rede". A foto precisa ir como File do expo-file-system (implementa Blob, com bytes()).
import { enviarFoto } from '../../src/features/colarinhometro/api';

jest.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 't' } } }) } },
}));

const mockFetch = jest.fn();
beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ bloco: { nota_colarinho: 8 }, total_carimbos: 1 }) });
  global.fetch = mockFetch as unknown as typeof fetch;
});

it('a imagem vai no FormData como File (com bytes), não como { uri }', async () => {
  const r = await enviarFoto('file:///tmp/foto.jpg', { latitude: -23.5, longitude: -46.6 }, 'sim', '2026-11-13T22:00:00Z');
  expect(r.ok).toBe(true);
  const form = mockFetch.mock.calls[0][1].body as FormData & { getParts?: () => { fieldName: string; string?: string }[] };
  const partes = (form as unknown as { _parts: [string, unknown][] })._parts;
  const imagem = partes.find(([nome]) => nome === 'imagem')?.[1] as Record<string, unknown>;
  expect(imagem).toBeDefined();
  expect(typeof (imagem as { bytes?: unknown }).bytes).toBe('function');
  expect(imagem).not.toEqual(expect.objectContaining({ type: 'image/jpeg', name: 'foto.jpg', uri: 'file:///tmp/foto.jpg' }));
});
