import type { ClaudeClient } from "../_shared/claude.ts";
import type { FirecrawlClient } from "../_shared/firecrawl.ts";
import type { GoogleClient, GooglePlace } from "../_shared/google.ts";
import type { Orcamento, Uso } from "./orcamento.ts";

// Tipos compartilhados do garimpo (épico 8.3; seção 13.6).

export type Modo = "descoberta" | "revisita" | "coordenadas" | "resumos";
export const MODOS: Modo[] = ["descoberta", "revisita", "coordenadas", "resumos"];

export type Assunto = "tem_brahma" | "transmite_jogos" | "funcionamento";
export type Sinal = "positivo" | "negativo" | "fechado";
export type TipoEvidencia = "cardapio_site" | "pagina_web" | "avaliacao_google" | "status_google";

export type BarRevisita = { bar_id: string; nome: string; bairro: string; google_place_id: string | null; urls: string[] };
export type BarCoordenadas = { bar_id: string; google_place_id: string };
export type BarResumo = { bar_id: string; nome: string };

export type Candidato =
  | { tipo: "lugar"; bairro: string; lugar: GooglePlace }
  | { tipo: "pagina"; bairro: string; url: string; titulo: string };

// Posição salva no cursor entre lotes (seção 7.2: "onde parar/continuar o lote").
export type Posicao = { feitos?: string[]; bairroIdx?: number; fila?: Candidato[] };
export type Cursor = { uso?: Partial<Uso>; posicao?: Posicao; bairros?: string[] };

// Acesso ao banco usado pelo garimpo (funções service-only da migration 0800).
export interface GarimpoDb {
  iniciarExecucao(tipo: Modo): Promise<string | null>;
  carregarExecucao(id: string): Promise<{ id: string; tipo: Modo; status: string; cursor: Cursor; bares_novos: number; evidencias_criadas: number } | null>;
  salvarExecucao(id: string, dados: {
    status: "em_andamento" | "concluida" | "falhou";
    cursor: Cursor;
    novosErros: Record<string, unknown>[];
    bares_novos: number;
    evidencias_criadas: number;
    chamadas_google: number;
    chamadas_firecrawl: number;
  }): Promise<void>;
  usoMes(): Promise<Partial<Uso>>;
  disparar(modo: Modo, execucaoId: string): Promise<void>;
  registrarEvidencia(e: { barId: string; assunto: Assunto; sinal: Sinal; tipo: TipoEvidencia; url: string; trecho: string | null; data: Date }):
    Promise<"criada" | "atualizada" | "igual">;
  casarOuCriarBar(c: { nome: string; endereco: string; bairro: string; latitude: number; longitude: number; placeId: string | null; criar: boolean }):
    Promise<{ bar_id: string | null; criado: boolean }>;
  baresParaRevisita(limite: number, excluir: string[]): Promise<BarRevisita[]>;
  baresParaCoordenadas(limite: number, excluir: string[]): Promise<BarCoordenadas[]>;
  atualizarCoordenadas(barId: string, latitude: number, longitude: number): Promise<void>;
  baresParaResumo(limite: number, excluir: string[]): Promise<BarResumo[]>;
  opinioesPublicadas(barId: string): Promise<{ texto: string; nota: number | null }[]>;
  gravarResumo(barId: string, resumo: string): Promise<boolean>;
}

// Contexto de um lote.
export type Contexto = {
  db: GarimpoDb;
  google: GoogleClient;
  firecrawl: FirecrawlClient;
  claude: ClaudeClient;
  orcamento: Orcamento;
  agora: Date;
  bairros: string[];
  contadores: { bares_novos: number; evidencias_criadas: number };
};
