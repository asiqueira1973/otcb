import { useCallback, useEffect, useRef, useState } from 'react';

import { copy } from '../../lib/copy';
import { getCurrentCoords } from '../../lib/location';
import { track } from '../../lib/telemetry';
import { loadHistory, sendToAgent } from './api';
import { guardarLocal, juntar, lerLocais } from './localMessages';
import type { Bloco, BlocoEntrada, ChatMessage } from './types';

let localSeq = 0;
const localId = (p: string) => `${p}-${Date.now()}-${++localSeq}`;

// Quantos bares a resposta mostrou (seção 21, otcb_resposta_recebida.qtd_bares). Recebe: blocos. Devolve: número.
export function countBars(blocos: Bloco[]): number {
  const ids = new Set<string>();
  for (const b of blocos) {
    if (b.tipo === 'lista_bares') b.bares.forEach((x) => ids.add(x.bar_id));
    if (b.tipo === 'card_bar') ids.add(b.bar.bar_id);
    if (b.tipo === 'mapa') b.pontos.forEach((x) => ids.add(x.bar_id));
  }
  return ids.size;
}

// Estado da conversa (T5; 13.1). Carrega o histórico, envia com localização só na hora (seção 17), mostra
// "digitando" (A1), marca "não enviada" sem rede (15.9) com "tentar de novo", e traduz 429 (15.8) e 503 (15.9).
// Telemetria sem texto nem localização (seção 21). Recebe: nada. Devolve: mensagens, estado e ações.
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const busy = useRef(false);
  // Cópia síncrona da lista: o updater do setState roda depois (React 19), então o "tentar de novo"
  // não pode descobrir a mensagem alvo dentro dele.
  const current = useRef<ChatMessage[]>([]);
  useEffect(() => {
    current.current = messages;
  }, [messages]);

  // Recarrega do banco; offline mantém o que já está na tela (seção 17: histórico legível).
  const reload = useCallback(async () => {
    try {
      const [history, locais] = await Promise.all([loadHistory(), lerLocais()]);
      setMessages(juntar(history, locais));
    } catch {
      // sem rede: segue com o que tinha
    } finally {
      setLoaded(true);
    }
  }, []);

  const deliver = useCallback(async (userMsg: ChatMessage) => {
    busy.current = true;
    setTyping(true);
    const coords = await getCurrentCoords();
    track('otcb_mensagem_enviada', { teve_localizacao: coords !== null });
    const result = await sendToAgent(userMsg.conteudo, coords);
    setTyping(false);
    busy.current = false;

    if (result.ok) {
      track('otcb_resposta_recebida', {
        qtd_bares: countBars(result.blocos),
        tipos_bloco: result.blocos.map((b) => b.tipo).join(','),
        bloqueada_guardrail: result.bloqueada_guardrail,
      });
      setMessages((all) => [
        ...all.map((m) => (m.id === userMsg.id ? { ...m, estado: undefined, motivo: undefined } : m)),
        { id: result.mensagem_id ?? localId('a'), papel: 'assistente', conteudo: result.texto, blocos: result.blocos, criado_em: new Date().toISOString() },
      ]);
      return;
    }
    if (result.erro === 'limite') {
      setMessages((all) => [
        ...all.map((m) => (m.id === userMsg.id ? { ...m, estado: undefined } : m)),
        { id: localId('limite'), papel: 'assistente', conteudo: copy.chat.limit, blocos: [], criado_em: new Date().toISOString() },
      ]);
      return;
    }
    const motivo = result.erro === 'sem_rede' ? 'sem_rede' : 'ia';
    setMessages((all) => all.map((m) => (m.id === userMsg.id ? { ...m, estado: 'nao_enviada', motivo } : m)));
  }, []);

  // Envia uma pergunta (1–1000 caracteres, 13.1). Ignora enquanto outra está em andamento.
  const send = useCallback(
    async (text: string) => {
      const mensagem = text.trim().slice(0, 1000);
      if (!mensagem || busy.current) return;
      const userMsg: ChatMessage = { id: localId('u'), papel: 'usuario', conteudo: mensagem, blocos: [], criado_em: new Date().toISOString(), estado: 'enviando' };
      setMessages((all) => [...all, userMsg]);
      await deliver(userMsg);
    },
    [deliver],
  );

  // "Tentar de novo" numa mensagem não enviada (15.9).
  const retry = useCallback(
    async (id: string) => {
      if (busy.current) return;
      const found = current.current.find((m) => m.id === id);
      if (!found) return;
      const target: ChatMessage = { ...found, estado: 'enviando', motivo: undefined };
      setMessages((all) => all.map((m) => (m.id === id ? target : m)));
      await deliver(target);
    },
    [deliver],
  );

  // Card aberto pela Ficha (T6: "Dar opinião", "Tem Brahma?", "Denunciar"): entra no chat como fala
  // local do app, sem chamar o agente (8.5). Recebe: o bloco de entrada.
  const addLocalCard = useCallback((bloco: BlocoEntrada) => {
    const m: ChatMessage = { id: localId('card'), papel: 'assistente', conteudo: '', blocos: [bloco], criado_em: new Date().toISOString() };
    void guardarLocal(m);
    setMessages((all) => [...all, m]);
  }, []);

  // Resultado do Colarinhômetro chegando da Câmera ou da fila offline (8.6): entra no fim do chat.
  const addLocalMessage = useCallback((m: ChatMessage) => {
    setMessages((all) => (all.some((x) => x.id === m.id) ? all : [...all, m]));
  }, []);

  return { messages, typing, loaded, send, retry, reload, addLocalCard, addLocalMessage };
}
