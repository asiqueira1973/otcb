import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChatMessage } from './types';

// Mensagens que só existem no aparelho (cards abertos pela Ficha, 8.5; resultado do Colarinhômetro, 8.6):
// guardadas para continuar no chat depois de recarregar o histórico do banco, por 30 dias (11.14).
const CHAVE = 'otcb_mensagens_locais';
const TRINTA_DIAS = 30 * 86_400_000;

// Lê as mensagens locais ainda dentro de 30 dias. Devolve: lista (vazia se não houver ou der erro).
export async function lerLocais(): Promise<ChatMessage[]> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE);
    const lista = bruto ? (JSON.parse(bruto) as ChatMessage[]) : [];
    return lista.filter((m) => Date.now() - Date.parse(m.criado_em) < TRINTA_DIAS);
  } catch {
    return [];
  }
}

// Acrescenta uma mensagem local. Recebe: a mensagem. Devolve: quando gravou (falha é ignorada).
export async function guardarLocal(m: ChatMessage): Promise<void> {
  try {
    const lista = await lerLocais();
    await AsyncStorage.setItem(CHAVE, JSON.stringify([...lista, m].slice(-100)));
  } catch {
    // sem armazenamento: a mensagem fica só nesta sessão
  }
}

// Apaga as mensagens locais ("Limpar conversa", critério 7 do 8.4).
export async function limparLocais(): Promise<void> {
  await AsyncStorage.removeItem(CHAVE).catch(() => undefined);
}

// Junta o histórico do banco com as locais, em ordem cronológica. Recebe: as duas listas. Devolve: a lista única.
export function juntar(banco: ChatMessage[], locais: ChatMessage[]): ChatMessage[] {
  return [...banco, ...locais].sort((a, b) => a.criado_em.localeCompare(b.criado_em));
}
