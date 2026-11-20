import { copy } from '../../lib/copy';

// Faixa da nota para a telemetria (seção 21: 0–4, 5–7, 8–10). Recebe: nota. Devolve: a faixa.
export function faixaDaNota(nota: number): '0-4' | '5-7' | '8-10' {
  return nota < 5 ? '0-4' : nota < 8 ? '5-7' : '8-10';
}

// Nota com uma casa e vírgula. Recebe: número. Devolve: "8,6".
export function notaTexto(n: number): string {
  return n.toFixed(1).replace('.', ',');
}

// Faixa da nota mostrada à pessoa (8.12: nota por faixa, número em segundo plano). Recebe: nota.
// Devolve: "Tirada de mestre" (≥ 8, o mesmo corte do Olho clínico), "Boa tirada" (≥ 6) ou "Dá pra melhorar".
export function faixaNota(n: number): string {
  return n >= 8 ? copy.colarinho.bands.master : n >= 6 ? copy.colarinho.bands.good : copy.colarinho.bands.improve;
}
