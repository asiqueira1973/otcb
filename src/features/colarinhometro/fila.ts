import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import type { Coords } from '../../lib/location';
import type { Confirmacao, EnvioFoto } from './api';

// Fila offline do Colarinhômetro (passo 7 da 8.6; seção 17): sem rede, a foto fica no aparelho por até 24 h e
// é enviada quando a rede voltar (ao abrir o chat ou voltar ao app). Só a própria pessoa vê.
const CHAVE = 'otcb_fila_fotos';
export const VALIDADE_MS = 24 * 3_600_000;

export type ItemFila = { id: string; uri: string; coords: Coords | null; confirmou: Confirmacao; capturadaEm: string };

async function ler(): Promise<ItemFila[]> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as ItemFila[]) : [];
  } catch {
    return [];
  }
}

async function gravar(itens: ItemFila[]): Promise<void> {
  await AsyncStorage.setItem(CHAVE, JSON.stringify(itens)).catch(() => undefined);
}

function apagarArquivo(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // arquivo já não existe
  }
}

// Guarda a foto na fila: copia o JPEG para a pasta de documentos (o cache pode ser limpo pelo sistema).
// Recebe: dados do envio. Devolve: o item enfileirado.
export async function enfileirar(uri: string, coords: Coords | null, confirmou: Confirmacao, capturadaEm: string): Promise<ItemFila> {
  const id = `${Date.parse(capturadaEm)}-${Math.random().toString(36).slice(2, 8)}`;
  let destino = uri;
  try {
    const pasta = new Directory(Paths.document, 'otcb-fila');
    if (!pasta.exists) pasta.create({ idempotent: true });
    const copia = new File(pasta, `${id}.jpg`);
    new File(uri).copy(copia);
    destino = copia.uri;
  } catch {
    // sem cópia: usa a original (pode sumir se o sistema limpar o cache)
  }
  const item: ItemFila = { id, uri: destino, coords, confirmou, capturadaEm };
  await gravar([...(await ler()), item]);
  return item;
}

// Envia o que está na fila. Itens com mais de 24 h são descartados; sem rede, ficam para a próxima.
// Recebe: a função de envio e o que fazer com cada resultado. Devolve: quantos foram enviados.
export async function processarFila(
  enviar: (item: ItemFila) => Promise<EnvioFoto>,
  aoEnviar: (item: ItemFila, r: EnvioFoto) => void,
): Promise<number> {
  const itens = await ler();
  const restantes: ItemFila[] = [];
  let enviados = 0;
  for (const item of itens) {
    if (Date.now() - Date.parse(item.capturadaEm) > VALIDADE_MS) {
      apagarArquivo(item.uri);
      continue;
    }
    const r = await enviar(item);
    if (!r.ok && r.falha === 'rede') {
      restantes.push(item);
      continue;
    }
    apagarArquivo(item.uri);
    enviados += 1;
    aoEnviar(item, r);
  }
  await gravar(restantes);
  return enviados;
}

// Quantas fotos esperam na fila (para mostrar no chat). Devolve: número.
export async function tamanhoFila(): Promise<number> {
  return (await ler()).length;
}
