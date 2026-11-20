import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';

import Passaporte from '../../app/passaporte';
import { formatScore } from '../../src/features/bares/format';
import { SuggestionForm } from '../../src/features/cards/SuggestionForm';
import type { ResultadoColarinho } from '../../src/features/chat/types';
import { faixaNota } from '../../src/features/colarinhometro/nota';
import { ResultCard } from '../../src/features/colarinhometro/ResultCard';
import { ShareCard } from '../../src/features/colarinhometro/ShareCard';
import type { Passaporte as Dados } from '../../src/features/passaporte/api';
import { copy } from '../../src/lib/copy';
import { renderWithSafeArea } from '../../test-utils/render';

// 8.12 — versão 1.0.2 (pedido do Alexandre: "o app é para ser divertido, não complexo"): sugestão feita no bar
// confirma (p_no_bar), "Não sei" cadastra como a confirmar, status com 2 rótulos, nota por faixa, descrições dos
// selos com as regras novas e selo Divulgador (compartilhar o Passaporte ou a nota, na base da confiança).

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
const mockRpc = jest.fn();
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
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

let n = 0;
const chave = () => `k102-${++n}`;

const DADOS: Dados = {
  carimbos: [{ carimbo_id: 'c1', bar_id: 'b1', nome_bar: 'Bar do Juarez', bairro: 'Pinheiros', foto_id: null, criado_em: '2026-11-07T23:00:00Z' }],
  colecoes_bairro: [{ bairro: 'Pinheiros', carimbos: 1, total_bares: 2, conquistado: false }],
  colecao_classicos: { carimbos: 0, total: 0 },
  selos: [
    { selo: 'primeira_tirada', progresso: 1, meta: 1, conquistado: true },
    { selo: 'divulgador', progresso: 0, meta: 1, nivel: 0, conquistado: false },
  ],
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('sugestão de bar', () => {
  it('"Estou no bar agora" manda p_no_bar e avisa que o bar ficou confirmado', async () => {
    mockRpc.mockResolvedValueOnce({ data: { bar_id: 'b1', criado: true, carimbo: false }, error: null });
    await renderWithSafeArea(<SuggestionForm chave={chave()} nome="Bar Novo" endereco="Rua B, 2" bairro="Pinheiros" usarLocalizacaoAtual />);
    await fireEvent.press(screen.getByTestId('tem-brahma-sim'));
    await fireEvent.press(screen.getByTestId('enviar-sugestao'));
    await waitFor(() => expect(screen.getByText(copy.cards.suggestedHere)).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('otcb_sugerir_bar', expect.objectContaining({ p_no_bar: true, p_tem_brahma: true }));
  });

  it('com a foto recente ligada, avisa que o carimbo é da pessoa', async () => {
    mockRpc.mockResolvedValueOnce({ data: { bar_id: 'b1', criado: true, carimbo: true }, error: null });
    await renderWithSafeArea(<SuggestionForm chave={chave()} nome="Bar Novo" endereco="Rua B, 2" bairro="Pinheiros" usarLocalizacaoAtual />);
    await fireEvent.press(screen.getByTestId('tem-brahma-sim'));
    await fireEvent.press(screen.getByTestId('enviar-sugestao'));
    await waitFor(() => expect(screen.getByText(copy.cards.suggestedStamp)).toBeTruthy());
  });

  it('de casa manda p_no_bar = false e o bar entra como a confirmar', async () => {
    mockGeocode.mockResolvedValue([{ latitude: -23.6, longitude: -46.67 }]);
    mockRpc.mockResolvedValueOnce({ data: { bar_id: 'b2', criado: true, carimbo: false }, error: null });
    await renderWithSafeArea(<SuggestionForm chave={chave()} nome="Bar Novo" endereco="Rua A, 1" bairro="Moema" usarLocalizacaoAtual={false} />);
    await fireEvent.press(screen.getByTestId('tem-brahma-sim'));
    await fireEvent.press(screen.getByTestId('enviar-sugestao'));
    await waitFor(() => expect(screen.getByText(copy.cards.suggested)).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('otcb_sugerir_bar', expect.objectContaining({ p_no_bar: false }));
  });

  // Verifier do 8.12: "Não sei" num bar que já existe não grava nada; não pode dizer "cadastrei".
  it('"Não sei" num bar que já existe agradece sem dizer que cadastrou', async () => {
    mockGeocode.mockResolvedValue([{ latitude: -23.6, longitude: -46.67 }]);
    mockRpc.mockResolvedValueOnce({ data: { bar_id: 'b4', criado: false, carimbo: false }, error: null });
    await renderWithSafeArea(<SuggestionForm chave={chave()} nome="Bar Jobim" endereco="Rua A, 1" bairro="Moema" usarLocalizacaoAtual={false} />);
    await fireEvent.press(screen.getByTestId('tem-brahma-nao_sei'));
    await fireEvent.press(screen.getByTestId('enviar-sugestao'));
    await waitFor(() => expect(screen.getByText(copy.cards.dontKnowExisting)).toBeTruthy());
  });

  it('"Não sei" cadastra como a confirmar (p_tem_brahma nulo)', async () => {
    mockGeocode.mockResolvedValue([{ latitude: -23.6, longitude: -46.67 }]);
    mockRpc.mockResolvedValueOnce({ data: { bar_id: 'b3', criado: true, carimbo: false }, error: null });
    await renderWithSafeArea(<SuggestionForm chave={chave()} nome="Bar Talvez" endereco="Rua A, 1" bairro="Moema" usarLocalizacaoAtual={false} />);
    await fireEvent.press(screen.getByTestId('tem-brahma-nao_sei'));
    await fireEvent.press(screen.getByTestId('enviar-sugestao'));
    await waitFor(() => expect(screen.getByText(copy.cards.dontKnowNotice)).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('otcb_sugerir_bar', expect.objectContaining({ p_nome: 'Bar Talvez', p_tem_brahma: null }));
  });
});

describe('textos mais simples', () => {
  it('status do bar com 2 rótulos: provável conta como "tem chopp Brahma"', () => {
    expect(copy.bar.status.confirmado).toBe('tem chopp Brahma');
    expect(copy.bar.status.provavel).toBe(copy.bar.status.confirmado);
    expect(copy.bar.status.incerto).toBe('a confirmar');
  });

  it('nota por faixa: ≥ 8 mestre, ≥ 6 boa, abaixo "dá pra melhorar"', () => {
    expect(faixaNota(8)).toBe(copy.colarinho.bands.master);
    expect(faixaNota(9.4)).toBe(copy.colarinho.bands.master);
    expect(faixaNota(7.9)).toBe(copy.colarinho.bands.good);
    expect(faixaNota(6)).toBe(copy.colarinho.bands.good);
    expect(faixaNota(5.9)).toBe(copy.colarinho.bands.improve);
    expect(formatScore(7.4)).toBe('7,4');
  });

  it('a ficha mostra a faixa e o número', () => {
    expect(copy.bar.collar('7,4', faixaNota(7.4))).toBe('Colarinho: Boa tirada (7,4)');
  });

  it('descrições dos selos com as regras novas', () => {
    expect(copy.passport.sealHow.explorador).toBe('Carimbos em 3, 10 e 25 bares.');
    expect(copy.passport.sealHow.olho_clinico).toBe('Colarinho nota 8 ou mais em 3 bares.');
    expect(copy.passport.sealHow.informante).toBe('10 ajudas: confirmar, sugerir bar ou opinar.');
    expect(copy.seals.divulgador).toBe('Divulgador');
    expect(copy.passport.sealHow.divulgador).toBeTruthy();
  });
});

describe('Colarinhômetro', () => {
  const BLOCO: ResultadoColarinho = {
    tipo: 'resultado_colarinho', foto_id: 'f1', nome_bar: 'Bar Original', nota_colarinho: 8.6, nota_altura: 9, nota_cremosidade: 8.5,
    nota_copo: 8, nota_gelado: 9, comentario_ia: 'Colarinho de dois dedos.', carimbo_novo: true, motivo_sem_carimbo: null,
  };

  it('resultado e imagem de compartilhar mostram a faixa', async () => {
    await renderWithSafeArea(<ResultCard bloco={BLOCO} animar={false} />);
    expect(screen.getAllByText(copy.colarinho.bands.master).length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(screen.getByTestId('share-card'))).toContain(copy.colarinho.bands.master);
    expect(JSON.stringify(screen.getByTestId('share-card'))).not.toMatch(/brahma/i);
  });

  // Verifier do 8.12: a base tem o "Bar Brahma"; a imagem compartilhada nunca leva a marca.
  it('nome de bar com a marca fica fora da imagem de compartilhar', async () => {
    await renderWithSafeArea(<ResultCard bloco={{ ...BLOCO, nome_bar: 'Bar Brahma' }} animar={false} />);
    expect(JSON.stringify(screen.getByTestId('share-card'))).not.toMatch(/brahma/i);
    expect(screen.getByText('Bar Brahma')).toBeTruthy(); // no app o nome continua aparecendo
  });

  it('na imagem e no resultado a faixa é maior que o número', async () => {
    await renderWithSafeArea(<ShareCard nomeBar="Bar Original" nota={8.6} comentario={null} />);
    const tamanho = (t: string) => [screen.getByText(t).props.style].flat().reduce((acc: number, st: { fontSize?: number }) => st?.fontSize ?? acc, 0);
    expect(tamanho(copy.colarinho.bands.master)).toBeGreaterThan(tamanho('8,6'));
  });

  it('compartilhar a nota registra o compartilhamento (selo Divulgador)', async () => {
    mockRpc.mockResolvedValue({ data: { dias: 1 }, error: null });
    await renderWithSafeArea(<ResultCard bloco={BLOCO} animar={false} />);
    await fireEvent.press(screen.getByTestId('compartilhar-foto'));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('otcb_registrar_compartilhamento', { p_origem: 'colarinho' }));
    expect(Sharing.shareAsync).toHaveBeenCalled();
    expect(mockTrack).toHaveBeenCalledWith('otcb_compartilhou', { origem: 'colarinho' });
  });

  it('sem bar: o botão diz "Estou num bar que não está no app"', async () => {
    await renderWithSafeArea(<ResultCard bloco={{ ...BLOCO, nome_bar: null, carimbo_novo: false, motivo_sem_carimbo: 'sem_bar' }} animar={false} onCard={jest.fn()} />);
    expect(screen.getByText(copy.colarinho.suggestBar)).toBeTruthy();
    expect(copy.colarinho.suggestBar).toBe('Estou num bar que não está no app');
  });
});

describe('Passaporte', () => {
  it('pede a versão 2 do passaporte e mostra o Divulgador', async () => {
    mockRpc.mockResolvedValue({ data: DADOS, error: null });
    await renderWithSafeArea(<Passaporte />);
    await waitFor(() => expect(screen.getByTestId('selo-divulgador')).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('otcb_meu_passaporte', { p_versao: 2 });
  });

  it('Compartilhar gera a imagem, registra e recarrega o passaporte', async () => {
    mockRpc.mockImplementation((nome: string) =>
      Promise.resolve(nome === 'otcb_meu_passaporte' ? { data: DADOS, error: null } : { data: { dias: 1 }, error: null }));
    await renderWithSafeArea(<Passaporte />);
    await waitFor(() => expect(screen.getByTestId('compartilhar-passaporte')).toBeTruthy());
    // A imagem do Passaporte fica escondida do leitor de tela (está fora da tela); por isso includeHiddenElements.
    const imagem = JSON.stringify(screen.getByTestId('passport-share-card', { includeHiddenElements: true }));
    expect(imagem).toContain('1 bar carimbado');
    expect(imagem).not.toMatch(/brahma|-23\.|-46\./i);
    const antes = mockRpc.mock.calls.filter((c) => c[0] === 'otcb_meu_passaporte').length;
    await fireEvent.press(screen.getByTestId('compartilhar-passaporte'));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('otcb_registrar_compartilhamento', { p_origem: 'passaporte' }));
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///share.png', { mimeType: 'image/png' });
    await waitFor(() => expect(mockRpc.mock.calls.filter((c) => c[0] === 'otcb_meu_passaporte').length).toBeGreaterThan(antes));
  });
});
