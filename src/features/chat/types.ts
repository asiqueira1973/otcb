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

export type Assunto = 'tem_brahma' | 'transmite_jogos' | 'funcionamento';

// Blocos de entrada (8.5): a pessoa preenche e grava no próprio card, sem o modelo.
export type BlocoEntrada =
  | { tipo: 'pergunta_confirmacao'; bar_id: string; nome_bar: string; assunto: Assunto; pergunta: string }
  | { tipo: 'formulario_opiniao'; bar_id: string; nome_bar: string; texto_atual: string | null; nota_atual: number | null }
  | { tipo: 'formulario_sugestao_bar'; nome: string | null; endereco: string | null; bairro: string | null; usar_localizacao_atual: boolean }
  | { tipo: 'formulario_denuncia'; opiniao_id: string };

// Resultado do Colarinhômetro (13.2; 8.6). motivo_sem_carimbo é o código da otcb_resultado_foto.
export type ResultadoColarinho = {
  tipo: 'resultado_colarinho'; foto_id: string; nome_bar: string | null; nota_colarinho: number;
  nota_altura: number; nota_cremosidade: number; nota_copo: number; nota_gelado: number;
  comentario_ia: string | null; carimbo_novo: boolean;
  motivo_sem_carimbo: 'sem_bar' | 'nao_confirmou' | 'ja_tinha' | 'limite_dia' | null;
};

// Blocos de exibição (8.4), de entrada (8.5) e o resultado do Colarinhômetro (8.6).
export type Bloco =
  | BlocoEntrada
  | ResultadoColarinho
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
