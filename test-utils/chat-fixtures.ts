import type { CardBar } from '../src/features/chat/types';

// Bar de exemplo para os testes do chat (épico 8.4).
export function bar(id: string, extra: Partial<CardBar> = {}): CardBar {
  return {
    bar_id: id, nome: `Bar ${id}`, bairro: 'Pinheiros', endereco: 'Rua dos Pinheiros, 1', latitude: -23.56, longitude: -46.68,
    distancia_metros: 300, status: 'confirmado', tem_balcao: true, transmite_jogos: false, classico: false,
    nota_colarinho_media: 8.5, nota_opinioes_media: 4, qtd_opinioes: 0, ultima_confirmacao_em: null,
    confirmacoes_60_dias: 0, resumo_opinioes: null, ...extra,
  };
}
