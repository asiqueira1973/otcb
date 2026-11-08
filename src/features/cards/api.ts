import { supabase } from '../../lib/supabase';
import type { Assunto } from '../chat/types';

// Gravação dos cards de entrada (8.5). Nenhuma passa pelo agente (critério 7): RPCs do banco
// (13.4), insert com RLS (denúncia, 6.1) e a Edge Function otcb-opinioes (13.7, moderação 11.7).

export type Falha =
  | 'rede' // sem sinal (15.9)
  | 'ia' // moderação indisponível (15.9)
  | 'limite_confirmacao' // 15.8
  | 'limite_sugestao'
  | 'limite_edicao'
  | 'recusada' // 15.7
  | 'ja_denunciou'
  | 'propria'
  | 'erro';
export type Resultado<T = undefined> = { ok: true; valor: T } | { ok: false; falha: Falha };

// Traduz um erro do supabase-js. Recebe: mensagem e código. Devolve: a falha conhecida.
export function traduzirErro(mensagem: string, codigo?: string): Falha {
  if (/network request failed|failed to fetch|network/i.test(mensagem)) return 'rede';
  for (const f of ['limite_confirmacao', 'limite_sugestao', 'limite_edicao'] as const) if (mensagem.includes(f)) return f;
  if (codigo === '23505') return 'ja_denunciou';
  if (codigo === '42501' || /row-level security/i.test(mensagem)) return 'propria';
  return 'erro';
}

// Registra o card no histórico como mensagem 'sistema' (otcb_registrar_card, 11.13). Nunca bloqueia.
async function registrarCard(tipo: string, barId: string, resultado: string): Promise<void> {
  try {
    await supabase.rpc('otcb_registrar_card', { p_tipo: tipo, p_bar_id: barId, p_resultado: resultado });
  } catch {
    // o card já gravou; a nota para o agente é acessória
  }
}

// pergunta_confirmacao → otcb_confirmar_bar. Recebe: bar, assunto e sinal. Devolve: ok ou falha (15.8).
export async function confirmar(barId: string, assunto: Assunto, sinal: 'positivo' | 'negativo' | 'fechado'): Promise<Resultado> {
  try {
    const { error } = await supabase.rpc('otcb_confirmar_bar', { p_bar_id: barId, p_assunto: assunto, p_sinal: sinal });
    if (error) return { ok: false, falha: traduzirErro(error.message, error.code) };
  } catch (e) {
    return { ok: false, falha: traduzirErro(e instanceof Error ? e.message : '') };
  }
  void registrarCard('confirmacao', barId, `${assunto}_${sinal}`);
  return { ok: true, valor: undefined };
}

// formulario_sugestao_bar → otcb_sugerir_bar (11.16; 15.18). Recebe: dados e coordenadas.
// Devolve: { criado } (false = casou com bar existente) ou falha.
export async function sugerir(d: { nome: string; endereco: string; bairro: string; latitude: number; longitude: number }): Promise<Resultado<{ criado: boolean }>> {
  try {
    const { data, error } = await supabase.rpc('otcb_sugerir_bar', {
      p_nome: d.nome, p_endereco: d.endereco, p_bairro: d.bairro, p_latitude: d.latitude, p_longitude: d.longitude, p_tem_brahma: true,
    });
    if (error) return { ok: false, falha: traduzirErro(error.message, error.code) };
    const r = data as unknown as { bar_id: string; criado: boolean };
    void registrarCard('sugestao', r.bar_id, r.criado ? 'criado' : 'ja_existia');
    return { ok: true, valor: { criado: r.criado } };
  } catch (e) {
    return { ok: false, falha: traduzirErro(e instanceof Error ? e.message : '') };
  }
}

// formulario_opiniao → Edge Function otcb-opinioes (13.7). Recebe: bar, texto, nota.
// Devolve: ok ou falha (recusada 15.7, limite_edicao, ia 15.9, rede).
export async function opinar(barId: string, texto: string, nota: number | null): Promise<Resultado> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, falha: 'erro' };
  let res: Response;
  try {
    res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/otcb-opinioes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ bar_id: barId, texto, nota }),
    });
  } catch {
    return { ok: false, falha: 'rede' };
  }
  if (res.ok) return { ok: true, valor: undefined };
  if (res.status === 429) return { ok: false, falha: 'limite_edicao' };
  if (res.status === 503) return { ok: false, falha: 'ia' };
  const corpo = await res.json().catch(() => ({}));
  return { ok: false, falha: corpo.codigo === 'recusada_moderacao' ? 'recusada' : 'erro' };
}

// formulario_denuncia → insert em otcb_denuncias (6.1; 1 por opinião; o trigger oculta com 3, 11.7).
// Recebe: opinião e motivo opcional. Devolve: ok ou falha (ja_denunciou, propria, rede).
export async function denunciar(opiniaoId: string, motivo: string | null): Promise<Resultado> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { ok: false, falha: 'erro' };
    const { error } = await supabase.from('otcb_denuncias').insert({ opiniao_id: opiniaoId, usuario_id: u.user.id, motivo: motivo?.trim() || null });
    if (error) return { ok: false, falha: traduzirErro(error.message, error.code) };
    const { data: op } = await supabase.from('otcb_opinioes').select('bar_id').eq('id', opiniaoId).maybeSingle();
    if (op?.bar_id) void registrarCard('denuncia', op.bar_id, 'registrada');
    return { ok: true, valor: undefined };
  } catch (e) {
    return { ok: false, falha: traduzirErro(e instanceof Error ? e.message : '') };
  }
}

// Opinião atual da pessoa no bar (critério 5), para o card aberto pela Ficha. Recebe: bar. Devolve: texto/nota ou null.
export async function minhaOpiniao(barId: string): Promise<{ texto: string; nota: number | null } | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from('otcb_opinioes').select('texto, nota').eq('bar_id', barId).eq('usuario_id', u.user.id).maybeSingle();
  return data ?? null;
}
