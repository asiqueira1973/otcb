import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { BarSheetProvider } from '../../src/features/bares/BarSheet';
import { formatDistance } from '../../src/features/bares/format';
import { Blocks } from '../../src/features/chat/Blocks';
import type { Bloco } from '../../src/features/chat/types';
import { copy } from '../../src/lib/copy';
import { bar } from '../../test-utils/chat-fixtures';
import { renderWithSafeArea } from '../../test-utils/render';

// Blocos de exibição da 13.2 (épico 8.4): pílulas de status (critério 4: "a confirmar"), distância,
// etiquetas, mapa, jogos, passaporte, ações (Uber da 13.2) e a Ficha (T6) com 15.16.

const mockRpc = jest.fn();
jest.mock('../../src/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a), auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) } },
}));
const mockTrack = jest.fn();
jest.mock('../../src/lib/telemetry', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockRpc.mockResolvedValue({ data: [], error: null });
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
});

const renderBlocks = (blocos: Bloco[]) => renderWithSafeArea(<BarSheetProvider><Blocks blocos={blocos} /></BarSheetProvider>);

describe('Blocos do chat', () => {
  it('lista_bares mostra cada bar com status, distância e etiquetas; incerto vira "a confirmar"', async () => {
    await renderBlocks([{ tipo: 'lista_bares', titulo: 'Perto de você', bares: [bar('a'), bar('b', { status: 'incerto', distancia_metros: 1340, tem_balcao: null })] }]);
    expect(screen.getByText('Perto de você')).toBeTruthy();
    // 8.12 (versão 1.0.2): confirmado e provável aparecem como "tem chopp Brahma" (antes "confirmado").
    expect(screen.getByText('tem chopp Brahma')).toBeTruthy();
    expect(screen.getByText('a confirmar')).toBeTruthy();
    expect(screen.queryByText('incerto')).toBeNull();
    expect(screen.getByText('Pinheiros · a 300 m')).toBeTruthy();
    expect(screen.getByText('Pinheiros · a 1,3 km')).toBeTruthy();
    expect(screen.getAllByText(copy.bar.counter)).toHaveLength(1);
    expect(screen.getByLabelText(/Bar b, a confirmar/)).toBeTruthy();
  });

  it('formata a distância em metros e km', () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(1999)).toBe('a 2,0 km');
    expect(formatDistance(84)).toBe('a 80 m');
  });

  it('tocar no card abre a Ficha com endereço, opiniões vazias (15.16) e registra otcb_ficha_aberta', async () => {
    await renderBlocks([{ tipo: 'card_bar', bar: bar('a', { resumo_opinioes: 'Colarinho caprichado.' }) }]);
    await fireEvent.press(screen.getByTestId('card-bar-a'));
    expect(screen.getByTestId('ficha-bar')).toBeTruthy();
    expect(screen.getByText('Rua dos Pinheiros, 1')).toBeTruthy();
    expect(screen.getByText('Colarinho caprichado.')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(copy.sheet.noOpinions)).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('otcb_opinioes_do_bar', { p_bar_id: 'a', p_pagina: 0 });
    expect(mockTrack).toHaveBeenCalledWith('otcb_ficha_aberta', { status_bar: 'confirmado' });
  });

  it('a Ficha lista opiniões com apelido', async () => {
    mockRpc.mockResolvedValue({ data: [{ opiniao_id: 'o1', apelido: 'ana_sp', nota: 5, texto: 'Tirada perfeita', criado_em: '2026-11-06T22:00:00Z' }], error: null });
    await renderBlocks([{ tipo: 'card_bar', bar: bar('a') }]);
    await fireEvent.press(screen.getByTestId('card-bar-a'));
    await waitFor(() => expect(screen.getByText('Tirada perfeita')).toBeTruthy());
    expect(screen.getByText(/ana_sp/)).toBeTruthy();
  });

  it('Como chegar e Chamar Uber na Ficha abrem os links e registram otcb_rota_aberta', async () => {
    await renderBlocks([{ tipo: 'card_bar', bar: bar('a') }]);
    await fireEvent.press(screen.getByTestId('card-bar-a'));
    await fireEvent.press(screen.getByTestId('ficha-uber'));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=-23.56&dropoff[longitude]=-46.68'));
    expect(mockTrack).toHaveBeenCalledWith('otcb_rota_aberta', { destino: 'uber' });
    await fireEvent.press(screen.getByTestId('ficha-rota'));
    expect(mockTrack).toHaveBeenCalledWith('otcb_rota_aberta', { destino: 'mapas' });
  });

  it('ação chamar_uber usa as coordenadas do bar da mesma resposta', async () => {
    await renderBlocks([{ tipo: 'card_bar', bar: bar('a') }, { tipo: 'acao', acao: 'chamar_uber', bar_id: 'a', rotulo: 'Chamar Uber' }]);
    await fireEvent.press(screen.getByTestId('acao-chamar_uber'));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('dropoff[latitude]=-23.56'));
  });

  it('mapa, jogos e passaporte renderizam; selo aparece pelo nome', async () => {
    await renderBlocks([
      { tipo: 'mapa', pontos: [{ bar_id: 'a', nome: 'Bar a', latitude: -23.5, longitude: -46.6, status: 'provavel' }] },
      { tipo: 'jogos', jogos: [{ jogo_id: 'j1', competicao: 'Brasileirão', mandante: 'Corinthians', visitante: 'Palmeiras', inicio: '2026-11-08T00:30:00Z' }] },
      { tipo: 'passaporte', total_carimbos: 3, bairros_conquistados: 1, ultimo_selo: 'primeira_tirada' },
    ]);
    expect(screen.getByLabelText(copy.blocks.map(1))).toBeTruthy();
    expect(screen.getByText(/07\/11 21:30 · Corinthians × Palmeiras/)).toBeTruthy();
    expect(screen.getByText('3 carimbos')).toBeTruthy();
    expect(screen.getByText('Último selo: Primeira tirada')).toBeTruthy();
  });
});
