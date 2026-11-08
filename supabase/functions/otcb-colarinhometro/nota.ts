// Nota do Colarinhômetro (regra 11.5) e conferência de JPEG pelo conteúdo (13.5).

export type NotasParciais = { nota_altura: number; nota_cremosidade: number; nota_copo: number; nota_gelado: number };

// nota_colarinho = arredondar(0,35·altura + 0,25·cremosidade + 0,20·copo + 0,20·gelado, 1 casa).
// Recebe: as quatro notas de 0 a 10. Devolve: a nota final com 1 casa.
export function calcularNota(n: NotasParciais): number {
  const bruta = 0.35 * n.nota_altura + 0.25 * n.nota_cremosidade + 0.2 * n.nota_copo + 0.2 * n.nota_gelado;
  return Math.round(bruta * 10 + 1e-9) / 10;
}

// JPEG começa com FF D8 FF (não confia na extensão nem no content-type). Recebe: bytes. Devolve: true se JPEG.
export function ehJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

// Faixa da nota para a telemetria (seção 21: 0–4, 5–7, 8–10). Recebe: nota. Devolve: a faixa.
export function faixaNota(nota: number): "0-4" | "5-7" | "8-10" {
  return nota < 5 ? "0-4" : nota < 8 ? "5-7" : "8-10";
}
