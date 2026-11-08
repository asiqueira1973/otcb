import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import Passaporte from '../../app/passaporte';
import type { Passaporte as Dados } from '../../src/features/passaporte/api';
import { selosNovos } from '../../src/features/passaporte/api';
import { copy } from '../../src/lib/copy';
import { renderWithSafeArea } from '../../test-utils/render';

// T8 Passaporte (8.7; 11.11): números iguais ao otcb_meu_passaporte (critério 1), nada contando chopp ou
// fotos (critério 2), Clássicos oculto sem curadoria (25.5), carimbo abre a Ficha, estado vazio (15.5),
// A7 + otcb_selo_ganho só para selo novo, último Passaporte sem rede.

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn() } }));
const mockRpc = jest.fn();
jest.mock('../../src/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
  },
}));
const mockTrack = jest.fn();
jest.mock('../../src/lib/telemetry', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));

const DADOS: Dados = {
  carimbos: [
    { carimbo_id: 'c1', bar_id: 'b1', nome_bar: 'Bar do juarez', bairro: 'Pinheiros', foto_id: null, criado_em: '2026-11-07T23:00:00Z' },
    { carimbo_id: 'c2', bar_id: 'b2', nome_bar: 'Bar Original', bairro: 'Moema', foto_id: 'f2', criado_em: '2026-11-06T23:00:00Z' },
    { carimbo_id: 'c3', bar_id: 'b3', nome_bar: 'Bar Leo', bairro: 'Santa Ifigênia', foto_id: 'f3', criado_em: '2026-11-05T23:00:00Z' },
  ],
  colecoes_bairro: [
    { bairro: 'Pinheiros', carimbos: 1, total_bares: 6, conquistado: false },
    { bairro: 'Moema', carimbos: 1, total_bares: 1, conquistado: true },
    { bairro: 'Santa Ifigênia', carimbos: 1, total_bares: 2, conquistado: false },
    { bairro: 'Itaim Bibi', carimbos: 0, total_bares: 5, conquistado: false },
  ],
  colecao_classicos: { carimbos: 0, total: 0 },
  selos: [
    { selo: 'primeira_tirada', progresso: 1, meta: 1, conquistado: true },
    { selo: 'explorador', progresso: 3, meta: 5, nivel: 0, conquistado: false },
    { selo: 'andarilho', progresso: 3, meta: 5, conquistado: false },
    { selo: 'olho_clinico', progresso: 1, meta: 5, conquistado: false },
    { selo: 'informante', progresso: 0, meta: 10, conquistado: false },
  ],
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockRpc.mockImplementation((nome: string) => Promise.resolve(nome === 'otcb_meu_passaporte' ? { data: DADOS, error: null } : { data: [], error: null }));
});

it('critério 1: mostra os números do otcb_meu_passaporte', async () => {
  await renderWithSafeArea(<Passaporte />);
  await waitFor(() => expect(screen.getByText('3 bares carimbados')).toBeTruthy());
  expect(screen.getByLabelText('Pinheiros: 1 de 6 bares')).toBeTruthy();
  expect(screen.getByLabelText('Moema: 1 de 1 bares')).toBeTruthy();
  expect(screen.getByLabelText('Itaim Bibi: 0 de 5 bares')).toBeTruthy(); // 11.11: bairro sem carimbo também aparece (correção do verifier)
  expect(screen.getByLabelText(`Andarilho, ${copy.passport.progress(3, 5)}`)).toBeTruthy();
  expect(screen.getByLabelText(`Primeira tirada, ${copy.passport.conquered}`)).toBeTruthy();
});

it('critério 2: nenhum texto conta chopp ou fotos', async () => {
  await renderWithSafeArea(<Passaporte />);
  await waitFor(() => expect(screen.getByText('3 bares carimbados')).toBeTruthy());
  const tudo = screen.getAllByText(/.+/).map((n) => [n.props.children].flat().join('')).join(' | ');
  expect(tudo).toContain('bares carimbados');
  expect(tudo).not.toMatch(/\d+\s*(chopps?|fotos?|copos?|tulipas?)/i);
  for (const t of Object.values(copy.passport.sealHow)) expect(t).not.toMatch(/foto/i);
});

it('25.5: Clássicos fica oculto sem curadoria; aparece com bares clássicos', async () => {
  await renderWithSafeArea(<Passaporte />);
  await waitFor(() => expect(screen.getByText('3 bares carimbados')).toBeTruthy());
  expect(screen.queryByTestId('colecao-classicos')).toBeNull();
  mockRpc.mockResolvedValue({ data: { ...DADOS, colecao_classicos: { carimbos: 1, total: 4 } }, error: null });
  await renderWithSafeArea(<Passaporte />);
  await waitFor(() => expect(screen.getByTestId('colecao-classicos')).toBeTruthy());
});

it('tocar no carimbo abre a Ficha do bar', async () => {
  await renderWithSafeArea(<Passaporte />);
  await waitFor(() => expect(screen.getByTestId('carimbo-b2')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('carimbo-b2'));
  await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('otcb_detalhes_bar', { p_bar_id: 'b2' }));
});

it('15.5: estado vazio com botão para o Colarinhômetro', async () => {
  mockRpc.mockResolvedValue({ data: { ...DADOS, carimbos: [], colecoes_bairro: [] }, error: null });
  await renderWithSafeArea(<Passaporte />);
  await waitFor(() => expect(screen.getByText(copy.passport.empty)).toBeTruthy());
  await fireEvent.press(screen.getByTestId('abrir-colarinhometro'));
  expect(mockPush).toHaveBeenCalledWith('/camera');
});

it('sem rede mostra o último Passaporte carregado, com aviso', async () => {
  await renderWithSafeArea(<Passaporte />);
  await waitFor(() => expect(screen.getByText('3 bares carimbados')).toBeTruthy());
  mockRpc.mockRejectedValue(new TypeError('Network request failed'));
  await renderWithSafeArea(<Passaporte />);
  await waitFor(() => expect(screen.getByText(copy.passport.offline)).toBeTruthy());
  expect(screen.getAllByText('3 bares carimbados').length).toBeGreaterThan(0);
});

// Correção do verifier (8.7): na primeira abertura, os selos já conquistados também são novidade (A7 e seção
// 21) — a identidade é anônima por aparelho, então não há "outro aparelho" que já tenha mostrado.
it('A7: na primeira abertura os selos conquistados animam e registram otcb_selo_ganho; depois só os novos', async () => {
  expect(await selosNovos(DADOS.selos)).toEqual(['primeira_tirada']);
  expect(mockTrack).toHaveBeenCalledWith('otcb_selo_ganho', { selo: 'primeira_tirada' });
  mockTrack.mockClear();
  const depois = DADOS.selos.map((s) => (s.selo === 'explorador' ? { ...s, nivel: 1, conquistado: true } : s));
  expect(await selosNovos(depois)).toEqual(['explorador']);
  expect(mockTrack).toHaveBeenCalledWith('otcb_selo_ganho', { selo: 'explorador' });
  expect(await selosNovos(depois)).toEqual([]);
});

it('sem rede e sem cache: mostra a 15.9 e "Tentar de novo", não uma tela em branco', async () => {
  mockRpc.mockRejectedValue(new TypeError('Network request failed'));
  await renderWithSafeArea(<Passaporte />);
  await waitFor(() => expect(screen.getByText(copy.errors.noNetwork)).toBeTruthy());
  mockRpc.mockResolvedValue({ data: DADOS, error: null });
  await fireEvent.press(screen.getByTestId('passaporte-tentar'));
  await waitFor(() => expect(screen.getByText('3 bares carimbados')).toBeTruthy());
});

it('11.11: todos os bairros com bares ativos aparecem, com os que têm carimbo primeiro', async () => {
  await renderWithSafeArea(<Passaporte />);
  await waitFor(() => expect(screen.getByLabelText('Itaim Bibi: 0 de 5 bares')).toBeTruthy());
  const ordem = screen.getAllByTestId(/^bairro-/).map((n) => n.props.testID);
  expect(ordem).toEqual(['bairro-Moema', 'bairro-Santa Ifigênia', 'bairro-Pinheiros', 'bairro-Itaim Bibi']);
});
