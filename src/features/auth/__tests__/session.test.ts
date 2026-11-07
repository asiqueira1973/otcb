import { deleteAccountAndSignOut, ensureAnonymousSession } from '../session';

// Testes da identidade anônima (seção 6 e critérios do 8.1).
function fakeClient(existing: object | null = null) {
  const session = { user: { id: 'uid-novo' } };
  const auth = {
    getSession: jest.fn().mockResolvedValue({ data: { session: existing } }),
    signInAnonymously: jest
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ data: { session }, error: null }), 10))),
    signOut: jest.fn().mockResolvedValue({ error: null }),
  };
  return { auth } as never as Parameters<typeof ensureAnonymousSession>[0] & { auth: typeof auth };
}

describe('ensureAnonymousSession', () => {
  it('chamadas simultâneas criam exatamente 1 usuário anônimo', async () => {
    const client = fakeClient();
    const [a, b, c] = await Promise.all([
      ensureAnonymousSession(client),
      ensureAnonymousSession(client),
      ensureAnonymousSession(client),
    ]);
    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('reabrir com sessão guardada não cria usuário novo', async () => {
    const stored = { user: { id: 'uid-antigo' } };
    const client = fakeClient(stored);
    await expect(ensureAnonymousSession(client)).resolves.toBe(stored);
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('sem rede e sem sessão lança erro (copy 15.9 de primeira abertura)', async () => {
    const client = fakeClient();
    client.auth.signInAnonymously.mockResolvedValueOnce({ data: { session: null }, error: new Error('Network request failed') });
    await expect(ensureAnonymousSession(client)).rejects.toThrow('Network request failed');
  });
});

describe('deleteAccountAndSignOut', () => {
  it('chama otcb-apagar-conta e limpa a sessão local mesmo se a função falhar', async () => {
    const client = fakeClient() as never as Parameters<typeof deleteAccountAndSignOut>[0] & {
      auth: { signOut: jest.Mock };
      functions: { invoke: jest.Mock };
    };
    (client as { functions: object }).functions = { invoke: jest.fn().mockRejectedValue(new Error('offline')) };
    await expect(deleteAccountAndSignOut(client)).rejects.toThrow('offline');
    expect(client.functions.invoke).toHaveBeenCalledWith('otcb-apagar-conta', { method: 'POST' });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('erro devolvido pela função (sem exceção) também é sinalizado e a sessão local é limpa', async () => {
    const client = fakeClient() as never as Parameters<typeof deleteAccountAndSignOut>[0] & {
      auth: { signOut: jest.Mock };
    };
    (client as { functions: object }).functions = {
      invoke: jest.fn().mockResolvedValue({ data: null, error: new Error('FunctionsHttpError') }),
    };
    await expect(deleteAccountAndSignOut(client)).rejects.toThrow('FunctionsHttpError');
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
