// Tipos do agente do chat (seções 13.1–13.3).

export type StatusVisivel = "confirmado" | "provavel" | "incerto";

// CardBar da seção 13.2 (nomes espelham o banco).
export type CardBar = {
  bar_id: string; nome: string; bairro: string; endereco: string;
  latitude: number; longitude: number;
  distancia_metros: number | null;
  status: StatusVisivel;
  tem_balcao: boolean | null; transmite_jogos: boolean | null; classico: boolean;
  nota_colarinho_media: number | null; nota_opinioes_media: number | null;
  qtd_opinioes: number;
  ultima_confirmacao_em: string | null;
  confirmacoes_60_dias: number;
  resumo_opinioes: string | null;
};

export type Jogo = { jogo_id: string; competicao: string; mandante: string; visitante: string; inicio: string };

// Blocos de exibição da 13.2 que o 8.4 produz (os de entrada entram no 8.5).
export type Bloco =
  | { tipo: "lista_bares"; titulo: string; bares: CardBar[] }
  | { tipo: "card_bar"; bar: CardBar }
  | { tipo: "mapa"; pontos: Pick<CardBar, "bar_id" | "nome" | "latitude" | "longitude" | "status">[] }
  | { tipo: "jogos"; jogos: Jogo[] }
  | { tipo: "passaporte"; total_carimbos: number; bairros_conquistados: number; ultimo_selo: string | null }
  | { tipo: "acao"; acao: "abrir_camera" | "abrir_rota" | "chamar_uber" | "abrir_ficha" | "abrir_passaporte"; bar_id?: string; rotulo: string };

// Acesso a dados usado pelo agente. As consultas de bares usam o JWT do usuário (RLS; 13.3); o resto, serviço.
export interface AgenteDb {
  usuarioDoToken(token: string): Promise<string | null>;
  perfil(usuarioId: string): Promise<{ apelido: string; time_do_coracao: string | null } | null>;
  mensagensHoje(usuarioId: string): Promise<number>;
  contexto(usuarioId: string): Promise<{ papel: "usuario" | "assistente" | "sistema"; conteudo: string }[]>;
  gravarMensagens(usuarioId: string, msgs: { papel: "usuario" | "assistente"; conteudo: string; blocos: Bloco[] | null }[]): Promise<string[]>;
  marcarRevisaoMenor(usuarioId: string): Promise<void>;
  buscarBares(p: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  detalhesBar(barId: string): Promise<Record<string, unknown>>;
  opinioesDoBar(barId: string, pagina: number): Promise<{ opiniao_id: string; apelido: string; nota: number | null; texto: string; criado_em: string }[]>;
  jogos(time: string | null, diasAFrente: number): Promise<Jogo[]>;
  meuPassaporte(): Promise<Record<string, unknown>>;
}
