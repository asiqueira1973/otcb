import { supabase } from '../../lib/supabase';
import type { CardBar } from '../chat/types';

export type Opiniao = { opiniao_id: string; apelido: string; nota: number | null; texto: string; criado_em: string };

// Ficha do bar (T6; 13.4 otcb_detalhes_bar). Recebe: id. Devolve: CardBar ou null (bar inexistente/sem rede).
export async function fetchBar(barId: string): Promise<CardBar | null> {
  const { data, error } = await supabase.rpc('otcb_detalhes_bar', { p_bar_id: barId });
  if (error || !data) return null;
  const bar = data as unknown as CardBar;
  // Só status visíveis aparecem (regra 11.9; critério 3 do 8.4).
  return ['confirmado', 'provavel', 'incerto'].includes(bar.status) ? bar : null;
}

// Opiniões publicadas com apelido (seção 20; otcb_opinioes_do_bar). Recebe: id e página. Devolve: até 10.
export async function fetchOpinions(barId: string, pagina = 0): Promise<Opiniao[]> {
  const { data, error } = await supabase.rpc('otcb_opinioes_do_bar', { p_bar_id: barId, p_pagina: pagina });
  if (error) throw new Error(error.message);
  return (data ?? []) as Opiniao[];
}

// Apelido da própria pessoa, para não oferecer "Denunciar" na própria opinião.
// Devolve: o apelido ou '' se não achar.
export async function apelidoProprio(): Promise<string> {
  try {
    // Filtra pelo próprio id: para o admin, o RLS deixa ler todos os perfis.
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return '';
    const { data } = await supabase.from('otcb_perfis').select('apelido').eq('id', u.user.id).maybeSingle();
    return data?.apelido ?? '';
  } catch {
    return '';
  }
}
