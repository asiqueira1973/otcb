import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { manipulateAsync } from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import Camera from '../../app/camera';
import { BarSheetProvider } from '../../src/features/bares/BarSheet';
import { juntar, lerLocais } from '../../src/features/chat/localMessages';
import type { ResultadoColarinho } from '../../src/features/chat/types';
import { prepararFoto } from '../../src/features/colarinhometro/api';
import { enfileirar, processarFila, tamanhoFila } from '../../src/features/colarinhometro/fila';
import { ResultCard, textoDoCarimbo } from '../../src/features/colarinhometro/ResultCard';
import { ouvirResultados } from '../../src/features/colarinhometro/resultados';
import { copy } from '../../src/lib/copy';
import { renderWithSafeArea } from '../../test-utils/render';

// Colarinhômetro (8.6): câmera sem galeria, "É chopp Brahma?", envio com localização, resultado no chat,
// motivos sem carimbo (11.4/11.12/15.8), compartilhar sem localização nem apelido, fila offline de 24 h.

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { back: () => mockBack(), push: jest.fn() } }));
jest.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) }, rpc: jest.fn() },
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: () => Promise.resolve({ status: 'granted' }),
  getLastKnownPositionAsync: () => Promise.resolve({ coords: { latitude: -23.6, longitude: -46.67 } }),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
const mockTrack = jest.fn();
jest.mock('../../src/lib/telemetry', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));
const mockFetch = jest.fn();
const resposta = (status: number, body: unknown) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

const BLOCO: ResultadoColarinho = {
  tipo: 'resultado_colarinho', foto_id: 'f1', nome_bar: 'Bar Original', nota_colarinho: 8.6, nota_altura: 9, nota_cremosidade: 8.5,
  nota_copo: 8, nota_gelado: 9, comentario_ia: 'Colarinho de dois dedos certinho.', carimbo_novo: true, motivo_sem_carimbo: null,
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  global.fetch = mockFetch as unknown as typeof fetch;
  ouvirResultados(null);
});

describe('Câmera (T7)', () => {
  it('foto → "É chopp Brahma?" → envia com localização e resposta; o resultado vai para o chat', async () => {
    mockFetch.mockReturnValue(resposta(200, { bloco: BLOCO, total_carimbos: 3 }));
    const recebidos: unknown[] = [];
    ouvirResultados((m) => recebidos.push(m));
    await renderWithSafeArea(<Camera />);
    expect(screen.getByText(copy.colarinho.hint)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tirar-foto'));
    await waitFor(() => expect(screen.getByText(copy.colarinho.question)).toBeTruthy());
    expect(manipulateAsync).toHaveBeenCalledWith('file:///foto.jpg', [{ resize: { height: 1280 } }], { compress: 0.7, format: 'jpeg' });
    await fireEvent.press(screen.getByTestId('foto-sim'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    const corpo = mockFetch.mock.calls[0][1].body as FormData;
    expect(mockFetch.mock.calls[0][0]).toMatch(/\/functions\/v1\/otcb-colarinhometro$/);
    expect(corpo.get('confirmou_brahma')).toBe('sim');
    expect(corpo.get('latitude')).toBe('-23.6');
    expect(recebidos).toHaveLength(1);
    expect(mockTrack).toHaveBeenCalledWith('otcb_foto_avaliada', { e_chopp: true, nota_faixa: '8-10', teve_bar: true, carimbo_novo: true });
    expect(mockTrack).toHaveBeenCalledWith('otcb_carimbo_ganho', { qtd_total: 3 });
    expect(JSON.stringify(mockTrack.mock.calls)).not.toContain('-23.6');
  });

  it('critério 4: não é chopp mostra a copy 15.6', async () => {
    mockFetch.mockReturnValue(resposta(422, { codigo: 'nao_e_chopp' }));
    await renderWithSafeArea(<Camera />);
    await fireEvent.press(screen.getByTestId('tirar-foto'));
    await waitFor(() => expect(screen.getByTestId('foto-nao_sei')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('foto-nao_sei'));
    await waitFor(() => expect(screen.getByText(copy.colarinho.notChopp)).toBeTruthy());
    expect((mockFetch.mock.calls[0][1].body as FormData).get('confirmou_brahma')).toBe('nao_sei');
  });

  it('sem rede: a foto entra na fila e o aviso aparece', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));
    await renderWithSafeArea(<Camera />);
    await fireEvent.press(screen.getByTestId('tirar-foto'));
    await waitFor(() => expect(screen.getByTestId('foto-nao')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('foto-nao'));
    await waitFor(() => expect(screen.getByText(copy.colarinho.queued)).toBeTruthy());
    expect(await tamanhoFila()).toBe(1);
  });

  it('limite de 10 fotos mostra o aviso', async () => {
    mockFetch.mockReturnValue(resposta(429, { codigo: 'limite_fotos' }));
    await renderWithSafeArea(<Camera />);
    await fireEvent.press(screen.getByTestId('tirar-foto'));
    await waitFor(() => expect(screen.getByTestId('foto-sim')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('foto-sim'));
    await waitFor(() => expect(screen.getByText(copy.colarinho.photoLimit)).toBeTruthy());
  });

  it('11.4: nenhuma galeria no Colarinhômetro', () => {
    const fs = jest.requireActual<typeof import('fs')>('fs');
    const fontes = ['app/camera.tsx', ...fs.readdirSync('src/features/colarinhometro').map((f) => `src/features/colarinhometro/${f}`)];
    for (const f of fontes) expect(fs.readFileSync(f, 'utf8')).not.toMatch(/launchImageLibraryAsync|MediaLibrary|ImagePicker/);
  });
});

describe('prepararFoto', () => {
  it('não aumenta foto pequena e redimensiona a maior para 1280 no lado maior', async () => {
    await prepararFoto('a', 800, 600);
    expect(manipulateAsync).toHaveBeenLastCalledWith('a', [], { compress: 0.7, format: 'jpeg' });
    await prepararFoto('b', 4032, 3024);
    expect(manipulateAsync).toHaveBeenLastCalledWith('b', [{ resize: { width: 1280 } }], { compress: 0.7, format: 'jpeg' });
  });
});

describe('Resultado (resultado_colarinho)', () => {
  it('mostra nota, parciais, comentário e "carimbo novo"', async () => {
    await renderWithSafeArea(<ResultCard bloco={BLOCO} animar={false} />);
    expect(screen.getByLabelText('Nota 8,6')).toBeTruthy();
    expect(screen.getByLabelText('Cremosidade 8,5')).toBeTruthy();
    expect(screen.getByText('“Colarinho de dois dedos certinho.”')).toBeTruthy();
    expect(screen.getByText(copy.colarinho.newStamp)).toBeTruthy();
  });

  it('motivos sem carimbo: sem bar, não confirmou, já tinha, limite do dia (15.8)', () => {
    const sem = (m: ResultadoColarinho['motivo_sem_carimbo']) => textoDoCarimbo({ ...BLOCO, carimbo_novo: false, motivo_sem_carimbo: m });
    expect(sem('sem_bar')).toBe(copy.colarinho.noBar);
    expect(sem('nao_confirmou')).toBe(copy.colarinho.notConfirmed);
    expect(sem('ja_tinha')).toBe(copy.colarinho.alreadyStamped);
    expect(sem('limite_dia')).toBe('Já foram 2 carimbos hoje. A nota ficou registrada; o carimbo deste bar te espera outro dia.');
  });

  it('sem bar oferece sugerir o bar com "estou no bar"', async () => {
    const onCard = jest.fn();
    await renderWithSafeArea(
      <BarSheetProvider onCard={onCard}>
        <ResultCard bloco={{ ...BLOCO, nome_bar: null, carimbo_novo: false, motivo_sem_carimbo: 'sem_bar' }} animar={false} onCard={onCard} />
      </BarSheetProvider>,
    );
    await fireEvent.press(screen.getByTestId('sugerir-bar-foto'));
    expect(onCard).toHaveBeenCalledWith({ tipo: 'formulario_sugestao_bar', nome: null, endereco: null, bairro: null, usar_localizacao_atual: true });
  });

  it('critério 7: a imagem de compartilhar só tem bar, nota e comentário', async () => {
    await renderWithSafeArea(<ResultCard bloco={BLOCO} animar={false} />);
    const textos = JSON.stringify(screen.getByTestId('share-card'));
    expect(textos).toContain('Bar Original');
    expect(textos).toContain('8,6');
    expect(textos).not.toMatch(/-23\.|-46\.|apelido|Altura|Cremosidade/);
    await fireEvent.press(screen.getByTestId('compartilhar-foto'));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///share.png', { mimeType: 'image/png' }));
    expect(captureRef).toHaveBeenCalled();
  });
});

describe('Fila offline e mensagens locais', () => {
  it('envia o que está na fila, mantém sem rede e descarta depois de 24 h', async () => {
    await enfileirar('file:///a.jpg', null, 'sim', new Date().toISOString());
    await enfileirar('file:///b.jpg', { latitude: 1, longitude: 2 }, 'nao', new Date(Date.now() - 25 * 3_600_000).toISOString());
    const enviar = jest.fn().mockResolvedValueOnce({ ok: false, falha: 'rede' });
    expect(await processarFila(enviar, jest.fn())).toBe(0);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(await tamanhoFila()).toBe(1);
    const aoEnviar = jest.fn();
    enviar.mockResolvedValueOnce({ ok: true, bloco: BLOCO, totalCarimbos: 1 });
    expect(await processarFila(enviar, aoEnviar)).toBe(1);
    expect(aoEnviar).toHaveBeenCalled();
    expect(await tamanhoFila()).toBe(0);
  });

  it('resultado guardado no aparelho volta junto do histórico, em ordem', async () => {
    const { publicarResultado } = jest.requireActual('../../src/features/colarinhometro/resultados');
    await publicarResultado(BLOCO);
    const locais = await lerLocais();
    expect(locais).toHaveLength(1);
    const banco = [{ id: 'm1', papel: 'usuario' as const, conteudo: 'oi', blocos: [], criado_em: '2000-01-01T00:00:00Z' }];
    expect(juntar(banco, locais).map((m) => m.id)).toEqual(['m1', 'foto-f1']);
  });
});
