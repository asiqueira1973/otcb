// Telemetria do OTCB (seção 21): eventos com prefixo otcb_, sem texto, localização nem foto.
// O destino (Visão de Produto) depende da pergunta aberta 25.2; até lá, track() não envia nada.

export type TelemetryEvent =
  | 'otcb_primeiro_acesso'
  | 'otcb_mensagem_enviada'
  | 'otcb_resposta_recebida'
  | 'otcb_card_registrado'
  | 'otcb_foto_avaliada'
  | 'otcb_carimbo_ganho'
  | 'otcb_selo_ganho'
  | 'otcb_ficha_aberta'
  | 'otcb_rota_aberta'
  | 'otcb_conta_apagada';

// Registra um evento. Recebe: nome e propriedades simples. Devolve: nada; nunca lança nem bloqueia.
export function track(_event: TelemetryEvent, _props: Record<string, string | number | boolean> = {}): void {
  // Pendente da 25.2: ligar ao endpoint da Visão de Produto.
}
