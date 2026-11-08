// Contratos do chat no app (seção 13.1 e 13.2). Os nomes dos campos espelham o banco (seção 18).

export type BarStatus = 'confirmado' | 'provavel' | 'incerto';

export type CardBar = {
  bar_id: string;
  nome: string;
  bairro: string;
  endereco: string;
  latitude: number;
  longitude: number;
  distancia_metros: number | null;
  status: BarStatus;
  tem_balcao: boolean | null;
  transmite_jogos: boolean | null;
  classico: boolean;
  nota_colarinho_media: number | null;
  nota_opinioes_media: number | null;
  qtd_opinioes: number;
  ultima_confirmacao_em: string | null;
  confirmacoes_60_dias: number;
  resumo_opinioes: string | null;
};

export type Jogo = { jogo_id: string; competicao: string; mandante: string; visitante: string; inicio: string };

export type AcaoTipo = 'abrir_camera' | 'abrir_rota' | 'chamar_uber' | 'abrir_ficha' | 'abrir_passaporte';

// Blocos de exibição do 8.4; os de entrada (pergunta_confirmacao, formulários, resultado_colarinho) chegam no 8.5/8.6.
export type Bloco =
  | { tipo: 'lista_bares'; titulo: string; bares: CardBar[] }
  | { tipo: 'card_bar'; bar: CardBar }
  | { tipo: 'mapa'; pontos: Pick<CardBar, 'bar_id' | 'nome' | 'latitude' | 'longitude' | 'status'>[] }
  | { tipo: 'jogos'; jogos: Jogo[] }
  | { tipo: 'passaporte'; total_carimbos: number; bairros_conquistados: number; ultimo_selo: string | null }
  | { tipo: 'acao'; acao: AcaoTipo; bar_id?: string; rotulo: string };

// Mensagem exibida no chat. `estado` só existe no aparelho: 'enviando' e 'nao_enviada' (15.9) não estão no banco.
export type ChatMessage = {
  id: string;
  papel: 'usuario' | 'assistente';
  conteudo: string;
  blocos: Bloco[];
  criado_em: string;
  estado?: 'enviando' | 'nao_enviada';
  motivo?: 'sem_rede' | 'ia'; // por que não foi enviada (15.9)
  erro?: boolean; // resposta de erro mostrada pela Bolacha triste (A9), não gravada
};
