// Faixa da nota para a telemetria (seção 21: 0–4, 5–7, 8–10). Recebe: nota. Devolve: a faixa.
export function faixaDaNota(nota: number): '0-4' | '5-7' | '8-10' {
  return nota < 5 ? '0-4' : nota < 8 ? '5-7' : '8-10';
}

// Nota com uma casa e vírgula. Recebe: número. Devolve: "8,6".
export function notaTexto(n: number): string {
  return n.toFixed(1).replace('.', ',');
}
