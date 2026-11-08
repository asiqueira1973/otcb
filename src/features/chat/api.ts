import { supabase } from '../../lib/supabase';
import type { Coords } from '../../lib/location';
import type { Bloco, ChatMessage } from './types';

// Acesso do chat ao backend (seção 13.1 e 6.1). Mensagens só são gravadas pela Edge Function;
// o app lê e apaga as próprias.

export type SendResult =
  | { ok: true; mensagem_id: string; texto: string; blocos: Bloco[]; bloqueada_guardrail: boolean }
  | { ok: false; erro: 'sem_rede' | 'limite' | 'ia' | 'sessao' | 'invalida' };

// Envia a pergunta ao agente. Recebe: texto e coordenadas opcionais (não gravadas). Devolve: a resposta
// ou o tipo de erro (sem rede → "não enviada"; 429 → 15.8; 503/5xx → 15.9 "IA fora").
export async function sendToAgent(mensagem: string, coords: Coords | null): Promise<SendResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, erro: 'sessao' };
  let res: Response;
  try {
    res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/otcb-agente`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mensagem, ...(coords ?? {}) }),
    });
  } catch {
    return { ok: false, erro: 'sem_rede' };
  }
  if (res.status === 429) return { ok: false, erro: 'limite' };
  if (res.status === 401) return { ok: false, erro: 'sessao' };
  if (res.status === 422) return { ok: false, erro: 'invalida' };
  if (!res.ok) return { ok: false, erro: 'ia' };
  try {
    const body = await res.json();
    return { ok: true, mensagem_id: body.mensagem_id, texto: body.texto, blocos: body.blocos ?? [], bloqueada_guardrail: !!body.bloqueada_guardrail };
  } catch {
    return { ok: false, erro: 'ia' };
  }
}

// Histórico do chat (T5; 11.14: o banco guarda 30 dias). Recebe: nada. Devolve: mensagens em ordem
// cronológica, sem as de papel 'sistema'. Offline lança, e a tela segue com o que já tinha (seção 17).
export async function loadHistory(): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('otcb_mensagens')
    .select('id, papel, conteudo, blocos, criado_em')
    .in('papel', ['usuario', 'assistente'])
    .order('criado_em', { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.id,
    papel: m.papel as ChatMessage['papel'],
    conteudo: m.conteudo,
    blocos: Array.isArray(m.blocos) ? (m.blocos as unknown as Bloco[]) : [],
    criado_em: m.criado_em,
  }));
}

// "Limpar conversa" (T9; 6.1 otcb_mensagens_apaga_proprias; critério 7). Recebe: nada. Devolve: true se apagou.
export async function clearConversation(): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return false;
  const { error } = await supabase.from('otcb_mensagens').delete().eq('usuario_id', uid);
  return !error;
}
