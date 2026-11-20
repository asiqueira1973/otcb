import { copy } from '../../lib/copy';
import { faixaNota, notaTexto } from '../colarinhometro/nota';

// Distância legível (16.4: comanda). Recebe: metros ou null. Devolve: "a 300 m", "a 1,3 km" ou null.
export function formatDistance(m: number | null): string | null {
  if (m === null || m === undefined) return null;
  if (m < 1000) return copy.bar.distanceM(Math.round(m / 10) * 10);
  return copy.bar.distanceKm((m / 1000).toFixed(1).replace('.', ','));
}

// Nota com uma casa e vírgula. Recebe: número. Devolve: "8,5".
export function formatScore(n: number): string {
  return notaTexto(n);
}

// Colarinho médio do bar com faixa e número (8.12). Recebe: nota. Devolve: "Colarinho: Boa tirada (7,4)".
export function formatCollar(n: number): string {
  return copy.bar.collar(notaTexto(n), faixaNota(n));
}

// Data curta no fuso de SP. Recebe: ISO. Devolve: "07/11".
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
}

// Dia e hora de um jogo. Recebe: ISO. Devolve: "07/11 21:30".
export function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  return `${dia} ${hora}`;
}
