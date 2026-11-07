import type { LegacyRow } from './parse-csv';
import type { Place } from './places';

// Persistência usada pela importação (implementada com o service role em scripts/import-seed.ts).
export type SeedRepo = {
  // Devolve o bar já existente com esse google_place_id e se ele já tem a evidência de semente, ou null.
  findBar(placeId: string): Promise<{ id: string; hasSeed: boolean } | null>;
  // Cria o bar (nasce 'incerto') e devolve o id.
  insertBar(bar: {
    nome: string; endereco: string; bairro: string; latitude: number; longitude: number;
    google_place_id: string; tem_balcao: boolean | null;
  }): Promise<string>;
  // Grava a evidência seed_otcb_antigo do bar (regra 11.1: +0,2, meia-vida 180 dias).
  insertSeedEvidence(barId: string, at: Date): Promise<void>;
};

export type ImportReport = {
  lidas: number;
  ignoradas_sem_nome: number;
  importadas: number;
  duplicadas: number;
  ja_existentes: number;
  sementes_completadas: number;
  sem_correspondencia: string[];
  fechadas: string[];
};

// Importa as linhas do CSV antigo como semente (seção 14.1).
// Recebe: linhas úteis, total lido, ignoradas, a busca no Google e o repositório.
// Devolve: o relatório (lidas, importadas, duplicadas, sem correspondência, fechadas).
// Regras: sem resultado → relatório, não importa; CLOSED_PERMANENTLY → não importa; duplicados por
// google_place_id (no arquivo ou já no banco) viram 1 bar; o bairro do Google substitui o do CSV se divergir;
// cada bar importado recebe 1 evidência seed_otcb_antigo com a data da importação; bar existente sem essa
// evidência (importação interrompida) é completado na rodada seguinte.
export async function importSeed(
  parsed: { totalLinhas: number; semNome: number; linhas: LegacyRow[] },
  search: (query: string) => Promise<Place | null>,
  repo: SeedRepo,
  now: Date = new Date(),
): Promise<ImportReport> {
  const report: ImportReport = {
    lidas: parsed.totalLinhas,
    ignoradas_sem_nome: parsed.semNome,
    importadas: 0,
    duplicadas: 0,
    ja_existentes: 0,
    sementes_completadas: 0,
    sem_correspondencia: [],
    fechadas: [],
  };
  const vistos = new Set<string>();

  for (const linha of parsed.linhas) {
    const place = await search(`${linha.nome} ${linha.endereco} São Paulo`);
    if (!place) {
      report.sem_correspondencia.push(linha.nome);
      continue;
    }
    if (place.businessStatus === 'CLOSED_PERMANENTLY') {
      report.fechadas.push(linha.nome);
      continue;
    }
    if (vistos.has(place.placeId)) {
      report.duplicadas += 1;
      continue;
    }
    vistos.add(place.placeId);
    const existente = await repo.findBar(place.placeId);
    if (existente) {
      // Recupera uma importação interrompida entre o bar e a evidência: completa a semente que faltou.
      if (!existente.hasSeed) {
        await repo.insertSeedEvidence(existente.id, now);
        report.sementes_completadas += 1;
      } else {
        report.ja_existentes += 1;
      }
      continue;
    }
    const barId = await repo.insertBar({
      nome: linha.nome,
      endereco: place.endereco || linha.endereco,
      bairro: place.bairro || linha.bairro,
      latitude: place.latitude,
      longitude: place.longitude,
      google_place_id: place.placeId,
      tem_balcao: linha.temBalcao,
    });
    await repo.insertSeedEvidence(barId, now);
    report.importadas += 1;
  }
  return report;
}
