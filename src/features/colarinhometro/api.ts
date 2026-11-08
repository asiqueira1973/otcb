import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type { Coords } from '../../lib/location';
import { supabase } from '../../lib/supabase';
import type { ResultadoColarinho } from '../chat/types';

export type Confirmacao = 'sim' | 'nao' | 'nao_sei';
export type FalhaFoto = 'rede' | 'nao_e_chopp' | 'limite_fotos' | 'grande' | 'ia' | 'erro';
export type EnvioFoto = { ok: true; bloco: ResultadoColarinho; totalCarimbos: number } | { ok: false; falha: FalhaFoto };

// Passo 2 da 8.6: redimensiona para no máximo 1280 px no maior lado, JPEG qualidade 0,7.
// Recebe: uri da foto e tamanho original. Devolve: uri do JPEG pronto.
export async function prepararFoto(uri: string, largura: number, altura: number): Promise<string> {
  const maior = Math.max(largura, altura);
  const acoes = maior > 1280 ? [{ resize: largura >= altura ? { width: 1280 } : { height: 1280 } }] : [];
  const r = await manipulateAsync(uri, acoes, { compress: 0.7, format: SaveFormat.JPEG });
  return r.uri;
}

// Envia a foto à otcb-colarinhometro (13.5). Recebe: uri do JPEG, coordenadas (ou null), resposta e instante.
// Devolve: o bloco resultado_colarinho ou a falha (sem rede → fila offline).
export async function enviarFoto(uri: string, coords: Coords | null, confirmou: Confirmacao, capturadaEm: string): Promise<EnvioFoto> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, falha: 'erro' };
  const form = new FormData();
  form.append('imagem', { uri, name: 'foto.jpg', type: 'image/jpeg' } as unknown as Blob);
  if (coords) {
    form.append('latitude', String(coords.latitude));
    form.append('longitude', String(coords.longitude));
  }
  form.append('capturada_em', capturadaEm);
  form.append('confirmou_brahma', confirmou);
  let res: Response;
  try {
    res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/otcb-colarinhometro`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '' },
      body: form,
    });
  } catch {
    return { ok: false, falha: 'rede' };
  }
  const corpo = await res.json().catch(() => ({}));
  if (res.ok && corpo.bloco) return { ok: true, bloco: corpo.bloco as ResultadoColarinho, totalCarimbos: Number(corpo.total_carimbos ?? 0) };
  if (res.status === 413) return { ok: false, falha: 'grande' };
  if (res.status === 429) return { ok: false, falha: 'limite_fotos' };
  if (res.status === 422 && corpo.codigo === 'nao_e_chopp') return { ok: false, falha: 'nao_e_chopp' };
  if (res.status === 503) return { ok: false, falha: 'ia' };
  return { ok: false, falha: 'erro' };
}
