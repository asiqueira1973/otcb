import { supabase } from './supabase';

// Telemetria do OTCB (seção 21; destino definido na 25.2: Visão de Produto). Eventos com prefixo otcb_,
// sem texto de mensagem, localização nem foto. A chave de ingest só grava eventos (seção 18).

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

type Prop = string | number | boolean;
type Pending = { id: string; nome: TelemetryEvent; ocorrido_em: string; propriedades: Record<string, Prop> };

// Propriedades permitidas por evento (tabela da seção 21). Qualquer outra é descartada antes do envio.
export const ALLOWED_PROPS: Record<TelemetryEvent, readonly string[]> = {
  otcb_primeiro_acesso: [],
  otcb_mensagem_enviada: ['teve_localizacao'],
  otcb_resposta_recebida: ['qtd_bares', 'tipos_bloco', 'bloqueada_guardrail'],
  otcb_card_registrado: ['tipo_card'],
  otcb_foto_avaliada: ['e_chopp', 'nota_faixa', 'teve_bar', 'carimbo_novo'],
  otcb_carimbo_ganho: ['qtd_total'],
  otcb_selo_ganho: ['selo'],
  otcb_ficha_aberta: ['status_bar'],
  otcb_rota_aberta: ['destino'],
  otcb_conta_apagada: [],
};

const FLUSH_MS = 3000;
const MAX_BATCH = 20;
let queue: Pending[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

// Gera um uuid v4 para o id do evento (idempotência no ingest). Devolve: string.
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Filtra as propriedades pela lista da seção 21. Recebe: evento e propriedades. Devolve: só as permitidas.
export function sanitizeProps(event: TelemetryEvent, props: Record<string, Prop>): Record<string, Prop> {
  const allowed = ALLOWED_PROPS[event];
  return Object.fromEntries(Object.entries(props).filter(([k, v]) => allowed.includes(k) && ['string', 'number', 'boolean'].includes(typeof v)));
}

// Envia o lote pendente. distinct_id = uid anônimo (nunca e-mail: não existe). Falha não volta a tentar
// (telemetria não pode atrapalhar o app). Devolve: quando termina.
export async function flushTelemetry(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  const url = process.env.EXPO_PUBLIC_VISAO_PRODUTO_URL;
  const key = process.env.EXPO_PUBLIC_VISAO_PRODUTO_KEY;
  const batch = queue.splice(0, MAX_BATCH);
  if (!url || !key || batch.length === 0) return;
  try {
    const { data } = await supabase.auth.getSession();
    const distinctId = data.session?.user.id;
    if (!distinctId) return;
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ eventos: batch.map((e) => ({ ...e, distinct_id: distinctId, tela: 'app' })) }),
    });
  } catch {
    // Sem rede ou endpoint fora: o evento se perde, o app segue.
  }
  if (queue.length > 0) schedule();
}

function schedule() {
  if (!timer) timer = setTimeout(() => void flushTelemetry(), FLUSH_MS);
}

// Registra um evento. Recebe: nome e propriedades simples. Devolve: nada; nunca lança nem bloqueia a tela.
export function track(event: TelemetryEvent, props: Record<string, Prop> = {}): void {
  try {
    queue.push({ id: uuid(), nome: event, ocorrido_em: new Date().toISOString(), propriedades: sanitizeProps(event, props) });
    if (queue.length >= MAX_BATCH) void flushTelemetry();
    else schedule();
  } catch {
    // nunca lança
  }
}

// Só para testes: esvazia a fila.
export function resetTelemetryForTests() {
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
}
