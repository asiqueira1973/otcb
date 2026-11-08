import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import Chat from '../../app/chat';
import { copy } from '../../src/lib/copy';
import { bar } from '../../test-utils/chat-fixtures';
import { renderWithSafeArea } from '../../test-utils/render';

// T5 Chat (épico 8.4): sugestões 15.4 com chat vazio, envio com localização só na hora, resposta com cards,
// "não enviada" sem rede com "tentar de novo" (15.9), limite 15.8 (429), IA fora (503), câmera "em breve"
// e telemetria sem texto nem localização (seção 21).

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: (...a: unknown[]) => mockPush(...a) },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

let mockHistory: unknown[] = [];
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok', user: { id: 'u1' } } } }) },
    from: () => ({ select: () => ({ in: () => ({ order: () => ({ limit: () => Promise.resolve({ data: mockHistory, error: null }) }) }) }) }),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

const mockPermission = jest.fn();
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => mockPermission(),
  getLastKnownPositionAsync: () => Promise.resolve({ coords: { latitude: -23.567, longitude: -46.693 } }),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const mockTrack = jest.fn();
jest.mock('../../src/lib/telemetry', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));

const mockFetch = jest.fn();
const okResponse = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

beforeEach(() => {
  jest.clearAllMocks();
  mockHistory = [];
  mockPermission.mockResolvedValue({ status: 'granted' });
  global.fetch = mockFetch as unknown as typeof fetch;
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

async function ask(text: string) {
  await fireEvent.changeText(screen.getByTestId('campo-chat'), text);
  await fireEvent.press(screen.getByTestId('enviar'));
}

describe('T5 Chat', () => {
  it('chat vazio mostra as quatro sugestões da 15.4; tocar envia a pergunta', async () => {
    mockFetch.mockReturnValue(okResponse({ mensagem_id: 'm2', texto: 'Achei dois.', blocos: [], bloqueada_guardrail: false }));
    await renderWithSafeArea(<Chat />);
    for (const s of copy.chat.suggestions) expect(await screen.findByText(s)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sugestao-Chopp Brahma perto de mim'));
    await waitFor(() => expect(screen.getByText('Achei dois.')).toBeTruthy());
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).mensagem).toBe('Chopp Brahma perto de mim');
  });

  it('envia com a localização do momento e mostra texto e cards da resposta', async () => {
    mockFetch.mockReturnValue(okResponse({
      mensagem_id: 'm2', texto: 'Olha esses.', bloqueada_guardrail: false,
      blocos: [{ tipo: 'lista_bares', titulo: 'Com balcão', bares: [bar('a'), bar('b', { status: 'incerto' })] }],
    }));
    await renderWithSafeArea(<Chat />);
    await ask('chopp perto de mim com balcão');
    await waitFor(() => expect(screen.getByText('Olha esses.')).toBeTruthy());
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/functions\/v1\/otcb-agente$/);
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ mensagem: 'chopp perto de mim com balcão', latitude: -23.567, longitude: -46.693 });
    expect(screen.getByText('a confirmar')).toBeTruthy();
    expect(mockTrack).toHaveBeenCalledWith('otcb_mensagem_enviada', { teve_localizacao: true });
    expect(mockTrack).toHaveBeenCalledWith('otcb_resposta_recebida', { qtd_bares: 2, tipos_bloco: 'lista_bares', bloqueada_guardrail: false });
    const props = JSON.stringify(mockTrack.mock.calls);
    expect(props).not.toContain('chopp perto');
    expect(props).not.toContain('-23.5');
  });

  it('sem permissão de localização envia sem coordenadas', async () => {
    mockPermission.mockResolvedValue({ status: 'denied' });
    mockFetch.mockReturnValue(okResponse({ mensagem_id: 'm2', texto: 'Qual bairro?', blocos: [], bloqueada_guardrail: false }));
    await renderWithSafeArea(<Chat />);
    await ask('chopp perto de mim');
    await waitFor(() => expect(screen.getByText('Qual bairro?')).toBeTruthy());
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ mensagem: 'chopp perto de mim' });
    expect(mockTrack).toHaveBeenCalledWith('otcb_mensagem_enviada', { teve_localizacao: false });
  });

  it('sem rede a mensagem fica "não enviada" (15.9) e "tentar de novo" reenvia', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderWithSafeArea(<Chat />);
    await ask('Bar do Nico');
    await waitFor(() => expect(screen.getByText(`${copy.chat.notSent} · ${copy.errors.noNetwork}`)).toBeTruthy());
    expect(screen.getByText('Bar do Nico')).toBeTruthy();
    mockFetch.mockReturnValue(okResponse({ mensagem_id: 'm2', texto: 'Achei o Bar do Nico.', blocos: [], bloqueada_guardrail: false }));
    await fireEvent.press(screen.getByLabelText(copy.errors.retry));
    await waitFor(() => expect(screen.getByText('Achei o Bar do Nico.')).toBeTruthy());
    expect(screen.queryByText(`${copy.chat.notSent} · ${copy.errors.noNetwork}`)).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('429 mostra a copy 15.8 de limite', async () => {
    mockFetch.mockReturnValue(okResponse({ codigo: 'limite_mensagens' }, 429));
    await renderWithSafeArea(<Chat />);
    await ask('mais uma');
    await waitFor(() => expect(screen.getByText(copy.chat.limit)).toBeTruthy());
  });

  it('503 mostra "IA fora" (15.9) com tentar de novo', async () => {
    mockFetch.mockReturnValue(okResponse({ codigo: 'ia_indisponivel' }, 503));
    await renderWithSafeArea(<Chat />);
    await ask('oi');
    await waitFor(() => expect(screen.getByText(`${copy.chat.notSent} · ${copy.errors.aiDown}`)).toBeTruthy());
    expect(screen.getByLabelText(copy.errors.retry)).toBeTruthy();
  });

  it('mostra o histórico carregado e o "digitando" (A1) enquanto espera', async () => {
    mockHistory = [
      { id: 'h1', papel: 'usuario', conteudo: 'Bar do Juarez', blocos: null, criado_em: '2026-11-07T20:00:00Z' },
      { id: 'h2', papel: 'assistente', conteudo: 'Tá confirmado.', blocos: [{ tipo: 'card_bar', bar: bar('j', { nome: 'Bar do juarez' }) }], criado_em: '2026-11-07T20:00:01Z' },
    ];
    let resolve: (v: unknown) => void = () => undefined;
    mockFetch.mockReturnValue(new Promise((r) => (resolve = r)));
    await renderWithSafeArea(<Chat />);
    expect(await screen.findByText('Tá confirmado.')).toBeTruthy();
    expect(screen.getByText('Bar do juarez')).toBeTruthy();
    await ask('e opiniões?');
    await waitFor(() => expect(screen.getByTestId('digitando')).toBeTruthy());
    await act(async () => resolve({ ok: true, status: 200, json: () => Promise.resolve({ mensagem_id: 'm3', texto: 'Ninguém opinou.', blocos: [], bloqueada_guardrail: false }) }));
    await waitFor(() => expect(screen.queryByTestId('digitando')).toBeNull());
  });

  // 8.6: a câmera deixou de ser "em breve" e abre o Colarinhômetro; o Passaporte segue "em breve" até o 8.7.
  it('câmera abre o Colarinhômetro; Passaporte avisa "em breve"; Perfil abre a tela', async () => {
    await renderWithSafeArea(<Chat />);
    await fireEvent.press(screen.getByTestId('botao-camera'));
    expect(mockPush).toHaveBeenCalledWith('/camera');
    await fireEvent.press(screen.getByTestId('atalho-passaporte'));
    expect(Alert.alert).toHaveBeenCalledWith(copy.chat.comingSoonTitle, copy.chat.comingSoon);
    await fireEvent.press(screen.getByTestId('atalho-perfil'));
    expect(mockPush).toHaveBeenCalledWith('/perfil');
  });
});
