import { parse } from 'csv-parse/sync';

// Linha útil do CSV antigo do Glide (seção 14.1).
export type LegacyRow = { nome: string; endereco: string; bairro: string; temBalcao: boolean | null };

export type ParsedCsv = { totalLinhas: number; semNome: number; linhas: LegacyRow[] };

// Lê o CSV antigo (UTF-8, vírgula, campos com quebra de linha entre aspas) — seção 14.1.
// Recebe: o texto do arquivo. Devolve: total de linhas de dados, quantas foram ignoradas por nome vazio e as
// linhas úteis com nome/bairro aparados e TemBalcao convertido (true → true; vazio → null).
// As colunas NomeComEmoji, LinkMaps, Bora tomar um chopp, MediaNotas, Endereço Formatado, Foto,
// Texto para PDF e Chave PDF são ignoradas.
export function parseLegacyCsv(text: string): ParsedCsv {
  const records: Record<string, string>[] = parse(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  const linhas: LegacyRow[] = [];
  let semNome = 0;
  for (const r of records) {
    const nome = (r['Nome'] ?? '').trim();
    if (!nome) {
      semNome += 1;
      continue;
    }
    linhas.push({
      nome,
      endereco: (r['Endereço'] ?? '').trim(),
      bairro: (r['Bairro'] ?? '').trim(),
      temBalcao: (r['TemBalcao'] ?? '').trim().toLowerCase() === 'true' ? true : null,
    });
  }
  return { totalLinhas: records.length, semNome, linhas };
}
