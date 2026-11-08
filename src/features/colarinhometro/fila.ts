import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import type { Coords } from '../../lib/location';
import type { Confirmacao, EnvioFoto } from './api';

// Fila offline do Colarinhômetro (passo 7 da 8.6; seção 17): sem rede, a foto fica no aparelho por até 24 h e
// é enviada quando a rede voltar (ao abrir o chat ou voltar ao app). Só a própria pessoa vê.
const CHAVE = 'otcb_fila_fotos';
export const VALIDADE_MS = 24 * 3_600_000;

// 12.5: IA fora no Colarinhômetro → até 3 tentativas com 1 min de intervalo (a 1ª é a da Câmera).
export const MAX_TENTATIVAS_IA = 3;
export const INTERVALO_IA_MS = 60_000;

export type ItemFila = {
  id: string; uri: string; coords: Coords | null; confirmou: Confirmacao; capturadaEm: string;
  tentativasIa: number; ultimaTentativa: number | null;
};
export type MotivoDesistencia = 'expirou' | 'ia';

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
// Recebe: dados do envio e quantas tentativas já falharam por IA fora (12.5). Devolve: o item enfileirado.
export async function enfileirar(
  uri: string, coords: Coords | null, confirmou: Confirmacao, capturadaEm: string, tentativasIa = 0,
): Promise<ItemFila> {
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
  const item: ItemFila = { id, uri: destino, coords, confirmou, capturadaEm, tentativasIa, ultimaTentativa: tentativasIa > 0 ? Date.now() : null };
  await gravar([...(await ler()), item]);
  return item;
}

let emAndamento: Promise<number> | null = null;

// Envia o que está na fila (12.4 e 12.5). Só um processamento por vez (chamadas simultâneas esperam o
// mesmo); itens que entram na fila durante o envio são preservados. Mais de 24 h → descartada com aviso;
// sem rede → fica; IA fora → nova tentativa depois de 1 min, desistindo na 3ª (aviso 15.9).
// Recebe: envio, o que fazer com cada resultado e com cada desistência. Devolve: quantos foram enviados.
export function processarFila(
  enviar: (item: ItemFila) => Promise<EnvioFoto>,
  aoEnviar: (item: ItemFila, r: EnvioFoto) => void,
  aoDesistir: (item: ItemFila, motivo: MotivoDesistencia) => void = () => undefined,
): Promise<number> {
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    const itens = await ler();
    const vistos = new Set(itens.map((i) => i.id));
    const restantes: ItemFila[] = [];
    let enviados = 0;
    for (const item of itens) {
      const tentativasIa = item.tentativasIa ?? 0;
      if (Date.now() - Date.parse(item.capturadaEm) > VALIDADE_MS) {
        apagarArquivo(item.uri);
        aoDesistir(item, 'expirou');
        continue;
      }
      if (tentativasIa > 0 && item.ultimaTentativa && Date.now() - item.ultimaTentativa < INTERVALO_IA_MS) {
        restantes.push(item);
        continue;
      }
      const r = await enviar(item);
      if (!r.ok && r.falha === 'rede') {
        restantes.push(item);
        continue;
      }
      if (!r.ok && r.falha === 'ia') {
        const proxima = { ...item, tentativasIa: tentativasIa + 1, ultimaTentativa: Date.now() };
        if (proxima.tentativasIa >= MAX_TENTATIVAS_IA) {
          apagarArquivo(item.uri);
          aoDesistir(item, 'ia');
        } else {
          restantes.push(proxima);
        }
        continue;
      }
      apagarArquivo(item.uri);
      enviados += 1;
      aoEnviar(item, r);
    }
    const novos = (await ler()).filter((i) => !vistos.has(i.id));
    await gravar([...restantes, ...novos]);
    return enviados;
  })();
  return emAndamento.finally(() => {
    emAndamento = null;
  });
}

// Quantas fotos esperam na fila (para mostrar no chat). Devolve: número.
export async function tamanhoFila(): Promise<number> {
  return (await ler()).length;
}
