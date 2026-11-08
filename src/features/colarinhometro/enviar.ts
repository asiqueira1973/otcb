import { copy } from '../../lib/copy';
import { track } from '../../lib/telemetry';
import { faixaDaNota } from './nota';
import { enviarFoto, type EnvioFoto } from './api';
import { processarFila } from './fila';
import { publicarResultado } from './resultados';

// Registra a telemetria da foto (seção 21; sem foto nem localização). Recebe: resultado. Devolve: nada.
export function registrarTelemetria(r: EnvioFoto, teveBarEsperado = false): void {
  if (r.ok) {
    track('otcb_foto_avaliada', {
      e_chopp: true, nota_faixa: faixaDaNota(r.bloco.nota_colarinho), teve_bar: !!r.bloco.nome_bar || teveBarEsperado, carimbo_novo: r.bloco.carimbo_novo,
    });
    if (r.bloco.carimbo_novo) track('otcb_carimbo_ganho', { qtd_total: r.totalCarimbos });
  } else if (r.falha === 'nao_e_chopp') {
    track('otcb_foto_avaliada', { e_chopp: false, teve_bar: false, carimbo_novo: false });
  }
}

// Texto de erro de uma falha de envio (15.6, 15.8, 15.9 e "(proposto 8.6)"). Recebe: falha. Devolve: texto.
export function mensagemDaFalha(falha: Exclude<EnvioFoto, { ok: true }>['falha']): string {
  switch (falha) {
    case 'nao_e_chopp':
      return copy.colarinho.notChopp;
    case 'limite_fotos':
      return copy.colarinho.photoLimit;
    case 'grande':
      return copy.colarinho.tooBig;
    case 'rede':
      return copy.colarinho.queued;
    default:
      return copy.errors.aiDown;
  }
}

// Envia as fotos que ficaram na fila (8.6, passo 7) e publica os resultados no chat. Nunca lança.
export async function enviarFila(): Promise<void> {
  try {
    await processarFila(
      (item) => enviarFoto(item.uri, item.coords, item.confirmou, item.capturadaEm),
      (_item, r) => {
        registrarTelemetria(r);
        if (r.ok) void publicarResultado(r.bloco);
      },
    );
  } catch {
    // tenta de novo na próxima abertura
  }
}
