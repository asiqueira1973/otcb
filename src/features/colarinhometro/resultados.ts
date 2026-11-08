import type { ChatMessage, ResultadoColarinho } from '../chat/types';
import { guardarLocal } from '../chat/localMessages';

// Ponte entre a tela da Câmera e o Chat (8.6, passo 6): o resultado vira uma fala local do app com o bloco
// resultado_colarinho, guardada no aparelho (o banco guarda a foto; o chat do banco só tem a nota 'sistema').
type Ouvinte = (m: ChatMessage) => void;
let ouvinte: Ouvinte | null = null;

// O Chat se inscreve para receber resultados. Recebe: função ou null (ao sair). Devolve: nada.
export function ouvirResultados(fn: Ouvinte | null): void {
  ouvinte = fn;
}

// Publica um resultado: guarda e entrega ao chat aberto. Recebe: o bloco. Devolve: a mensagem criada.
export async function publicarResultado(bloco: ResultadoColarinho): Promise<ChatMessage> {
  const m: ChatMessage = { id: `foto-${bloco.foto_id}`, papel: 'assistente', conteudo: '', blocos: [bloco], criado_em: new Date().toISOString() };
  await guardarLocal(m);
  ouvinte?.(m);
  return m;
}

// Publica um aviso da fila de fotos (12.4/12.5) como fala local do app. Recebe: o texto. Devolve: a mensagem.
export async function publicarTexto(texto: string): Promise<ChatMessage> {
  const m: ChatMessage = { id: `aviso-${Date.now()}`, papel: 'assistente', conteudo: texto, blocos: [], criado_em: new Date().toISOString() };
  await guardarLocal(m);
  ouvinte?.(m);
  return m;
}
