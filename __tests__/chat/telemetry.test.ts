import { flushTelemetry, resetTelemetryForTests, sanitizeProps, track } from '../../src/lib/telemetry';

// Telemetria (seção 21; 25.2 Visão de Produto): só propriedades da tabela, distinct_id = uid anônimo,
// cabeçalho x-api-key, nunca texto nem localização, e falha de rede nunca lança.

jest.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'uid-anon' } } } }) } },
}));

const mockFetch = jest.fn();
beforeEach(() => {
  resetTelemetryForTests();
  mockFetch.mockReset().mockResolvedValue({ ok: true });
  global.fetch = mockFetch as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_VISAO_PRODUTO_URL = 'https://ingest.test/ingest';
  process.env.EXPO_PUBLIC_VISAO_PRODUTO_KEY = 'ing_teste';
});

it('descarta propriedades fora da seção 21', () => {
  expect(sanitizeProps('otcb_mensagem_enviada', { teve_localizacao: true, texto: 'oi', latitude: -23.5 })).toEqual({ teve_localizacao: true });
  expect(sanitizeProps('otcb_primeiro_acesso', { qualquer: 'x' })).toEqual({});
});

it('envia em lote para a Visão de Produto com x-api-key e distinct_id anônimo', async () => {
  track('otcb_mensagem_enviada', { teve_localizacao: false, texto: 'segredo' } as never);
  track('otcb_ficha_aberta', { status_bar: 'incerto' });
  await flushTelemetry();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, init] = mockFetch.mock.calls[0];
  expect(url).toBe('https://ingest.test/ingest');
  expect(init.headers['x-api-key']).toBe('ing_teste');
  const body = JSON.parse(init.body);
  expect(body.eventos.map((e: { nome: string }) => e.nome)).toEqual(['otcb_mensagem_enviada', 'otcb_ficha_aberta']);
  expect(body.eventos[0].distinct_id).toBe('uid-anon');
  expect(body.eventos[0].propriedades).toEqual({ teve_localizacao: false });
  expect(init.body).not.toContain('segredo');
});

it('falha de rede não lança', async () => {
  mockFetch.mockRejectedValue(new TypeError('Network request failed'));
  track('otcb_primeiro_acesso');
  await expect(flushTelemetry()).resolves.toBeUndefined();
});
