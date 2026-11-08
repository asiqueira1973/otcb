import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../../lib/supabase';
import { track } from '../../lib/telemetry';

// Passaporte (8.7; regra 11.11). O cálculo é todo do banco (otcb_meu_passaporte); o app só mostra.

export type Carimbo = { carimbo_id: string; bar_id: string; nome_bar: string; bairro: string; foto_id: string | null; criado_em: string };
export type ColecaoBairro = { bairro: string; carimbos: number; total_bares: number; conquistado: boolean };
export type Selo = { selo: string; progresso: number; meta: number; nivel?: number; conquistado: boolean };
export type Passaporte = {
  carimbos: Carimbo[];
  colecoes_bairro: ColecaoBairro[];
  colecao_classicos: { carimbos: number; total: number };
  selos: Selo[];
};

const CACHE = 'otcb_passaporte_cache';
const VISTOS = 'otcb_selos_vistos';

// Carrega o Passaporte. Sem rede, devolve o último carregado (seção 17). Devolve: dados e se vieram do cache,
// ou null se nunca carregou.
export async function carregarPassaporte(): Promise<{ dados: Passaporte; doCache: boolean } | null> {
  try {
    const { data, error } = await supabase.rpc('otcb_meu_passaporte');
    if (error || !data) throw new Error(error?.message ?? 'vazio');
    const dados = data as unknown as Passaporte;
    AsyncStorage.setItem(CACHE, JSON.stringify(dados)).catch(() => undefined);
    return { dados, doCache: false };
  } catch {
    try {
      const salvo = await AsyncStorage.getItem(CACHE);
      return salvo ? { dados: JSON.parse(salvo) as Passaporte, doCache: true } : null;
    } catch {
      return null;
    }
  }
}

// Chave do selo conquistado (o Explorador conta por nível). Recebe: selo. Devolve: "explorador:2".
function chaveDoSelo(s: Selo): string {
  return s.nivel ? `${s.selo}:${s.nivel}` : s.selo;
}

// Selos conquistados desde a última vez que a pessoa abriu o Passaporte neste aparelho (A7). Na primeira
// abertura, todos os conquistados são novidade (a identidade é anônima por aparelho, seção 6; o selo do 1º
// carimbo costuma chegar antes de abrir a tela). Registra otcb_selo_ganho para cada novo (seção 21).
// Recebe: selos atuais. Devolve: os nomes (selo) dos novos.
export async function selosNovos(selos: Selo[]): Promise<string[]> {
  const agora = selos.filter((s) => s.conquistado).map(chaveDoSelo);
  let vistos: string[] | null = null;
  try {
    const bruto = await AsyncStorage.getItem(VISTOS);
    vistos = bruto ? (JSON.parse(bruto) as string[]) : null;
  } catch {
    vistos = null;
  }
  await AsyncStorage.setItem(VISTOS, JSON.stringify(agora)).catch(() => undefined);
  const jaVistos = vistos ?? [];
  const novos = agora.filter((k) => !jaVistos.includes(k)).map((k) => k.split(':')[0]);
  for (const selo of novos) track('otcb_selo_ganho', { selo });
  return novos;
}
