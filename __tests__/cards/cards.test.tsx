import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { BarSheetProvider } from '../../src/features/bares/BarSheet';
import { ConfirmationCard } from '../../src/features/cards/ConfirmationCard';
import { OpinionForm } from '../../src/features/cards/OpinionForm';
import { ReportForm } from '../../src/features/cards/ReportForm';
import { SuggestionForm } from '../../src/features/cards/SuggestionForm';
import { Blocks } from '../../src/features/chat/Blocks';
import { copy } from '../../src/lib/copy';
import { bar } from '../../test-utils/chat-fixtures';
import { renderWithSafeArea } from '../../test-utils/render';

// Cards de entrada do 8.5: confirmação (critérios 1 e 2), opinião (3, 4, 5), sugestão (6 e "Não sei"),
// denúncia, estado "registrado" persistente e Ficha → card no chat. Nenhum passa pelo agente (critério 7).

const mockRpc = jest.fn();
const mockInsert = jest.fn();
const mockOpiniaoBar = jest.fn();
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
    from: (t: string) => {
      if (t === 'otcb_denuncias') return { insert: (...a: unknown[]) => mockInsert(...a) };
      if (t === 'otcb_perfis') return { select: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { apelido: 'eu_mesmo' } }) }) }) };
      return { select: () => ({ eq: () => ({ maybeSingle: () => mockOpiniaoBar(), eq: () => ({ maybeSingle: () => mockOpiniaoBar() }) }) }) };
    },
  },
}));
const mockGeocode = jest.fn();
jest.mock('expo-location', () => ({
  geocodeAsync: (...a: unknown[]) => mockGeocode(...a),
  getForegroundPermissionsAsync: () => Promise.resolve({ status: 'granted' }),
  getLastKnownPositionAsync: () => Promise.resolve({ coords: { latitude: -23.56, longitude: -46.69 } }),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
const mockTrack = jest.fn();
jest.mock('../../src/lib/telemetry', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));
const mockFetch = jest.fn();
const resposta = (status: number, body: unknown = {}) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

let n = 0;
const chave = () => `m${++n}:0`;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  global.fetch = mockFetch as unknown as typeof fetch;
  mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
  mockOpiniaoBar.mockResolvedValue({ data: { bar_id: 'b1' } });
});

describe('pergunta_confirmacao', () => {
  it('critério 1: "Tem sim" grava pela RPC, registra a nota do card e vira "registrado"', async () => {
    await renderWithSafeArea(<ConfirmationCard chave={chave()} barId="b1" assunto="tem_brahma" pergunta="O Bar b1 ainda tem chopp Brahma?" />);
    await fireEvent.press(screen.getByText(copy.cards.yes));
    await waitFor(() => expect(screen.getByText(copy.cards.registered)).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('otcb_confirmar_bar', { p_bar_id: 'b1', p_assunto: 'tem_brahma', p_sinal: 'positivo' });
    expect(mockRpc).toHaveBeenCalledWith('otcb_registrar_card', { p_tipo: 'confirmacao', p_bar_id: 'b1', p_resultado: 'tem_brahma_positivo' });
    expect(mockTrack).toHaveBeenCalledWith('otcb_card_registrado', { tipo_card: 'pergunta_confirmacao' });
    expect(screen.queryByText(copy.cards.noMore)).toBeNull();
  });

  it('critério 2: confirmação repetida no dia mostra a copy 15.8', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'limite_confirmacao', code: 'P0001' } });
    await renderWithSafeArea(<ConfirmationCard chave={chave()} barId="b1" assunto="tem_brahma" pergunta="?" />);
    await fireEvent.press(screen.getByText(copy.cards.noMore));
    await waitFor(() => expect(screen.getByText(copy.cards.alreadyToday)).toBeTruthy());
  });

  it('"Fechou" grava funcionamento/fechado; jogos mostra "Passa"/"Não passa"', async () => {
    await renderWithSafeArea(<ConfirmationCard chave={chave()} barId="b1" assunto="tem_brahma" pergunta="?" />);
    await fireEvent.press(screen.getByText(copy.cards.closed));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('otcb_confirmar_bar', { p_bar_id: 'b1', p_assunto: 'funcionamento', p_sinal: 'fechado' }));
    await renderWithSafeArea(<ConfirmationCard chave={chave()} barId="b1" assunto="transmite_jogos" pergunta="Passa jogo?" />);
    expect(screen.getByText(copy.cards.shows)).toBeTruthy();
    expect(screen.getByText(copy.cards.doesntShow)).toBeTruthy();
  });

  it('sem rede mostra 15.9 e deixa tentar de novo', async () => {
    mockRpc.mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderWithSafeArea(<ConfirmationCard chave={chave()} barId="b1" assunto="tem_brahma" pergunta="?" />);
    await fireEvent.press(screen.getByText(copy.cards.yes));
    await waitFor(() => expect(screen.getByText(copy.errors.noNetwork)).toBeTruthy());
    expect(screen.getByText(copy.cards.yes)).toBeTruthy();
  });

  it('o estado "registrado" persiste no aparelho', async () => {
    const k = chave();
    await renderWithSafeArea(<ConfirmationCard chave={k} barId="b1" assunto="tem_brahma" pergunta="?" />);
    await fireEvent.press(screen.getByText(copy.cards.yes));
    await waitFor(() => expect(screen.getByText(copy.cards.registered)).toBeTruthy());
    // Um card novo com a mesma chave (como ao recarregar o histórico) já nasce registrado.
    await renderWithSafeArea(<ConfirmationCard chave={k} barId="b1" assunto="tem_brahma" pergunta="?" />);
    await waitFor(() => expect(screen.getByText(copy.cards.registered)).toBeTruthy());
    expect(screen.queryByText(copy.cards.yes)).toBeNull();
  });
});

describe('formulario_opiniao', () => {
  it('critério 3: 9 e 501 caracteres não habilitam; 10 e 500 habilitam', async () => {
    await renderWithSafeArea(<OpinionForm chave={chave()} barId="b1" nomeBar="Bar b1" textoAtual={null} notaAtual={null} />);
    const campo = screen.getByTestId('opiniao-texto');
    for (const [texto, habilitado] of [['a'.repeat(9), false], ['a'.repeat(10), true], ['a'.repeat(500), true], ['a'.repeat(501), false]] as const) {
      await fireEvent.changeText(campo, texto);
      if (habilitado) expect(screen.getByTestId('publicar-opiniao')).toBeEnabled();
      else expect(screen.getByTestId('publicar-opiniao')).toBeDisabled();
    }
  });

  it('critério 5: vem preenchido com a opinião atual e publica pela otcb-opinioes', async () => {
    mockFetch.mockReturnValue(resposta(200, { opiniao_id: 'op1', status: 'publicada' }));
    await renderWithSafeArea(<OpinionForm chave={chave()} barId="b1" nomeBar="Bar b1" textoAtual="Minha opinião antiga" notaAtual={4} />);
    expect(screen.getByDisplayValue('Minha opinião antiga')).toBeTruthy();
    expect(screen.getByTestId('estrela-4').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('publicar-opiniao'));
    await waitFor(() => expect(screen.getByText(copy.cards.published)).toBeTruthy());
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ bar_id: 'b1', texto: 'Minha opinião antiga', nota: 4 });
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/functions\/v1\/otcb-opinioes$/);
  });

  it('critério 4: recusada pela moderação mostra 15.7 e continua editável', async () => {
    mockFetch.mockReturnValue(resposta(422, { codigo: 'recusada_moderacao' }));
    await renderWithSafeArea(<OpinionForm chave={chave()} barId="b1" nomeBar="Bar b1" textoAtual="Texto que vai ser recusado" notaAtual={null} />);
    await fireEvent.press(screen.getByTestId('publicar-opiniao'));
    await waitFor(() => expect(screen.getByText(copy.cards.rejected)).toBeTruthy());
    expect(screen.getByTestId('opiniao-texto')).toBeTruthy();
  });

  it('moderação fora → 15.9; limite de edição → aviso', async () => {
    mockFetch.mockReturnValueOnce(resposta(503)).mockReturnValueOnce(resposta(429, { codigo: 'limite_edicao' }));
    await renderWithSafeArea(<OpinionForm chave={chave()} barId="b1" nomeBar="Bar b1" textoAtual="Chopp muito bom aqui" notaAtual={null} />);
    await fireEvent.press(screen.getByTestId('publicar-opiniao'));
    await waitFor(() => expect(screen.getByText(copy.errors.aiDown)).toBeTruthy());
    await fireEvent.press(screen.getByLabelText(copy.errors.retry));
    await waitFor(() => expect(screen.getByText(copy.cards.editLimit)).toBeTruthy());
  });
});

describe('formulario_sugestao_bar', () => {
  it('"Não sei" não grava nada', async () => {
    await renderWithSafeArea(<SuggestionForm chave={chave()} nome="Bar Novo" endereco="Rua A, 1" bairro="Moema" usarLocalizacaoAtual={false} />);
    await fireEvent.press(screen.getByTestId('tem-brahma-nao_sei'));
    await fireEvent.press(screen.getByTestId('enviar-sugestao'));
    await waitFor(() => expect(screen.getByText(copy.cards.dontKnowNotice)).toBeTruthy());
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGeocode).not.toHaveBeenCalled();
  });

  it('critério 6: bar que já existia mostra 15.18', async () => {
    mockGeocode.mockResolvedValue([{ latitude: -23.6, longitude: -46.67 }]);
    mockRpc.mockResolvedValueOnce({ data: { bar_id: 'b9', criado: false }, error: null });
    await renderWithSafeArea(<SuggestionForm chave={chave()} nome="Bar Jobim" endereco="Rua A, 1" bairro="Moema" usarLocalizacaoAtual={false} />);
    await fireEvent.press(screen.getByTestId('tem-brahma-sim'));
    await fireEvent.press(screen.getByTestId('enviar-sugestao'));
    await waitFor(() => expect(screen.getByText(copy.cards.alreadyExisted)).toBeTruthy());
    expect(mockGeocode).toHaveBeenCalledWith('Rua A, 1, Moema, São Paulo, SP');
    expect(mockRpc).toHaveBeenCalledWith('otcb_sugerir_bar', expect.objectContaining({ p_nome: 'Bar Jobim', p_latitude: -23.6, p_tem_brahma: true }));
    expect(mockRpc).toHaveBeenCalledWith('otcb_registrar_card', { p_tipo: 'sugestao', p_bar_id: 'b9', p_resultado: 'ja_existia' });
  });

  it('no bar usa a localização do momento; endereço não encontrado pede para conferir', async () => {
    mockRpc.mockResolvedValueOnce({ data: { bar_id: 'b10', criado: true }, error: null });
    await renderWithSafeArea(<SuggestionForm chave={chave()} nome="Bar Novo" endereco="Rua B, 2" bairro="Pinheiros" usarLocalizacaoAtual />);
    await fireEvent.press(screen.getByTestId('tem-brahma-sim'));
    await fireEvent.press(screen.getByTestId('enviar-sugestao'));
    await waitFor(() => expect(screen.getByText(copy.cards.suggested)).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('otcb_sugerir_bar', expect.objectContaining({ p_latitude: -23.56, p_longitude: -46.69 }));

    mockGeocode.mockResolvedValue([]);
    await renderWithSafeArea(<SuggestionForm chave={chave()} nome="Bar X" endereco="Rua inexistente" bairro="Lugar" usarLocalizacaoAtual={false} />);
    await fireEvent.press(screen.getAllByTestId('tem-brahma-sim').at(-1)!);
    await fireEvent.press(screen.getAllByTestId('enviar-sugestao').at(-1)!);
    await waitFor(() => expect(screen.getByText(copy.cards.addressNotFound)).toBeTruthy());
  });

  it('botão só habilita com nome, endereço, bairro e a resposta de Brahma', async () => {
    await renderWithSafeArea(<SuggestionForm chave={chave()} nome={null} endereco={null} bairro="Moema" usarLocalizacaoAtual={false} />);
    expect(screen.getByTestId('enviar-sugestao')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('sugestao-nome'), 'Bar');
    await fireEvent.changeText(screen.getByTestId('sugestao-endereco'), 'Rua');
    expect(screen.getByTestId('enviar-sugestao')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('tem-brahma-sim'));
    expect(screen.getByTestId('enviar-sugestao')).toBeEnabled();
  });
});

describe('formulario_denuncia', () => {
  it('grava a denúncia; segunda vez avisa que já denunciou', async () => {
    mockInsert.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'duplicate key', code: '23505' } });
    await renderWithSafeArea(<ReportForm chave={chave()} opiniaoId="op1" />);
    await fireEvent.changeText(screen.getByTestId('denuncia-motivo'), 'ofensa ao garçom');
    await fireEvent.press(screen.getByTestId('enviar-denuncia'));
    await waitFor(() => expect(screen.getByText(copy.cards.reported)).toBeTruthy());
    expect(mockInsert).toHaveBeenCalledWith({ opiniao_id: 'op1', usuario_id: 'u1', motivo: 'ofensa ao garçom' });
    expect(mockRpc).toHaveBeenCalledWith('otcb_registrar_card', { p_tipo: 'denuncia', p_bar_id: 'b1', p_resultado: 'registrada' });
    await renderWithSafeArea(<ReportForm chave={chave()} opiniaoId="op1" />);
    await fireEvent.press(screen.getAllByTestId('enviar-denuncia').at(-1)!);
    await waitFor(() => expect(screen.getByText(copy.cards.alreadyReported)).toBeTruthy());
  });
});

describe('Ficha → card no chat', () => {
  it('"Tem Brahma?" e "Dar opinião" (com a opinião atual) viram cards; "Denunciar" some na própria opinião', async () => {
    mockRpc.mockImplementation((nome: string) =>
      Promise.resolve(nome === 'otcb_opinioes_do_bar'
        ? { data: [
            { opiniao_id: 'op-minha', apelido: 'eu_mesmo', nota: 5, texto: 'Minha opinião', criado_em: '2026-11-07T22:00:00Z' },
            { opiniao_id: 'op-outra', apelido: 'outro', nota: 2, texto: 'Opinião de outro', criado_em: '2026-11-07T21:00:00Z' },
          ], error: null }
        : { data: null, error: null }));
    mockOpiniaoBar.mockResolvedValue({ data: { texto: 'Minha opinião', nota: 5 } });
    const onCard = jest.fn();
    await renderWithSafeArea(<BarSheetProvider onCard={onCard}><Blocks blocos={[{ tipo: 'card_bar', bar: bar('b1') }]} /></BarSheetProvider>);
    await fireEvent.press(screen.getByTestId('card-bar-b1'));
    await waitFor(() => expect(screen.getByText('Opinião de outro')).toBeTruthy());
    expect(screen.getByTestId('denunciar-op-outra')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('denunciar-op-minha')).toBeNull());
    await fireEvent.press(screen.getByTestId('ficha-tem-brahma'));
    expect(onCard).toHaveBeenCalledWith({ tipo: 'pergunta_confirmacao', bar_id: 'b1', nome_bar: 'Bar b1', assunto: 'tem_brahma', pergunta: 'O Bar b1 ainda tem chopp Brahma?' });
    await fireEvent.press(screen.getByTestId('card-bar-b1'));
    await fireEvent.press(screen.getByTestId('ficha-dar-opiniao'));
    await waitFor(() => expect(onCard).toHaveBeenCalledWith({ tipo: 'formulario_opiniao', bar_id: 'b1', nome_bar: 'Bar b1', texto_atual: 'Minha opinião', nota_atual: 5 }));
  });
});
