import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';

// Estados de um card de entrada (8.5, passo 4): editando, enviando, registrado (não editável, check — A8),
// erro (com "tentar de novo"), recusado pela moderação (15.7, continua editável) e aviso (resultado final
// sem gravação nova, ex.: 15.8 ou "Não sei").
export type Fase = 'editando' | 'enviando' | 'registrado' | 'erro' | 'recusado' | 'aviso';
export type EstadoCard = { fase: Fase; mensagem?: string };

const PREFIXO = 'otcb_card:';

// Guarda o estado final do card no aparelho para que, ao recarregar o histórico, ele continue "registrado".
// Recebe: chave única (mensagem + posição do bloco). Devolve: estado, enviar(fn) e editar().
export function useCardSubmit(chave: string) {
  const [estado, setEstado] = useState<EstadoCard>({ fase: 'editando' });

  useEffect(() => {
    let vivo = true;
    AsyncStorage.getItem(PREFIXO + chave)
      .then((salvo) => {
        if (vivo && salvo) setEstado(JSON.parse(salvo) as EstadoCard);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [chave]);

  // Executa a gravação. Recebe: função que devolve o estado final. Registrado e aviso ficam salvos.
  const enviar = useCallback(
    async (fn: () => Promise<EstadoCard>) => {
      setEstado({ fase: 'enviando' });
      const final = await fn();
      setEstado(final);
      if (final.fase === 'registrado' || final.fase === 'aviso') {
        if (final.fase === 'registrado') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        AsyncStorage.setItem(PREFIXO + chave, JSON.stringify(final)).catch(() => undefined);
      }
    },
    [chave],
  );

  const editar = useCallback(() => setEstado({ fase: 'editando' }), []);
  return { estado, enviar, editar };
}
