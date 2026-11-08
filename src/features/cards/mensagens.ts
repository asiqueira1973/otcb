import { copy } from '../../lib/copy';
import type { Falha } from './api';
import type { EstadoCard } from './useCardSubmit';

// Converte a falha de gravação no estado do card com a copy da seção 15 (15.7, 15.8, 15.9) ou "(proposto 8.5)".
// Recebe: a falha. Devolve: o estado final do card.
export function estadoDaFalha(falha: Falha): EstadoCard {
  switch (falha) {
    case 'rede':
      return { fase: 'erro', mensagem: copy.errors.noNetwork };
    case 'ia':
    case 'erro':
      return { fase: 'erro', mensagem: copy.errors.aiDown };
    case 'limite_confirmacao':
      return { fase: 'aviso', mensagem: copy.cards.alreadyToday };
    case 'limite_sugestao':
      return { fase: 'aviso', mensagem: copy.cards.suggestionLimit };
    case 'limite_edicao':
      return { fase: 'aviso', mensagem: copy.cards.editLimit };
    case 'recusada':
      return { fase: 'recusado', mensagem: copy.cards.rejected };
    case 'ja_denunciou':
      return { fase: 'aviso', mensagem: copy.cards.alreadyReported };
    case 'propria':
      return { fase: 'aviso', mensagem: copy.cards.cantReportOwn };
  }
}
