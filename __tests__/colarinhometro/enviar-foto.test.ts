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
  // Captura o valor bruto passado ao append (o FormData do Node, nos testes, converte objetos em texto).
  const anexos: [string, unknown][] = [];
  const append = jest.spyOn(FormData.prototype, 'append').mockImplementation(function (nome: string, valor: unknown) {
    anexos.push([nome, valor]);
  } as unknown as typeof FormData.prototype.append);
  const r = await enviarFoto('file:///tmp/foto.jpg', { latitude: -23.5, longitude: -46.6 }, 'sim', '2026-11-13T22:00:00Z');
  append.mockRestore();
  expect(r.ok).toBe(true);
  const imagem = anexos.find(([nome]) => nome === 'imagem')?.[1] as Record<string, unknown>;
  expect(imagem).toBeDefined();
  expect(typeof (imagem as { bytes?: unknown }).bytes).toBe('function');
  expect((imagem as { uri?: string }).uri).toBe('file:///tmp/foto.jpg');
});
