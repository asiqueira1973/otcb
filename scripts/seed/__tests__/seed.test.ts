import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { importSeed, type SeedRepo } from '../import';
import { parseLegacyCsv } from '../parse-csv';
import { neighborhoodOf, searchPlace, type Place } from '../places';

// Testes da importação da semente (épico 8.2, critérios 4 e 5; seção 14.1), com o Google simulado.

const csv = readFileSync(resolve(__dirname, '../../../supabase/seed/estabelecimentos_otcb_antigo.csv'), 'utf8');

describe('parseLegacyCsv', () => {
  it('lê o arquivo real: ignora a linha sem nome e converte TemBalcao', () => {
    const parsed = parseLegacyCsv(csv);
    expect(parsed.semNome).toBe(1);
    expect(parsed.linhas.length).toBe(parsed.totalLinhas - 1);
    expect(parsed.linhas.every((l) => l.nome.length > 0)).toBe(true);
    expect(parsed.linhas.filter((l) => l.temBalcao === true).length).toBe(4);
    expect(parsed.linhas.every((l) => l.temBalcao === true || l.temBalcao === null)).toBe(true);
  });

  it('aceita campo com quebra de linha entre aspas e apara espaços', () => {
    const text = 'Nome,Endereço,Bairro,TemBalcao,Texto para PDF\n" Bar A ","Rua 1",Pinheiros ,true,"linha 1\nlinha 2"\n,Rua 2,Centro,,x\n';
    expect(parseLegacyCsv(text)).toEqual({
      totalLinhas: 2,
      semNome: 1,
      linhas: [{ nome: 'Bar A', endereco: 'Rua 1', bairro: 'Pinheiros', temBalcao: true }],
    });
  });
});

function memoryRepo(existing: string[] = []) {
  const bares: { id: string; google_place_id: string; bairro: string; tem_balcao: boolean | null }[] = [];
  const evidencias: { barId: string; at: Date }[] = [];
  const repo: SeedRepo = {
    barExists: (placeId) => Promise.resolve(existing.includes(placeId) || bares.some((b) => b.google_place_id === placeId)),
    insertBar: (bar) => {
      const id = `bar-${bares.length + 1}`;
      bares.push({ id, google_place_id: bar.google_place_id, bairro: bar.bairro, tem_balcao: bar.tem_balcao });
      return Promise.resolve(id);
    },
    insertSeedEvidence: (barId, at) => {
      evidencias.push({ barId, at });
      return Promise.resolve();
    },
  };
  return { repo, bares, evidencias };
}

// Google simulado: place_id derivado do nome (o Belmonte repete), um fechado e um sem resultado.
function fakeSearch(query: string): Promise<Place | null> {
  const nome = query.replace(/ São Paulo$/, '');
  if (nome.startsWith('Bar Fantasma')) return Promise.resolve(null);
  const key = nome.split(' ')[0].toLowerCase();
  return Promise.resolve({
    placeId: `place-${key}`,
    nome,
    endereco: `${nome}, São Paulo`,
    latitude: -23.5,
    longitude: -46.6,
    businessStatus: key === 'fechadao' ? 'CLOSED_PERMANENTLY' : 'OPERATIONAL',
    bairro: key === 'belmonte' ? 'Itaim Bibi' : null,
  });
}

describe('importSeed', () => {
  it('arquivo real: Belmonte (3×) vira 1 bar e cada bar importado tem 1 evidência seed', async () => {
    const parsed = parseLegacyCsv(csv);
    const belmontes = parsed.linhas.filter((l) => l.nome === 'Belmonte').length;
    expect(belmontes).toBe(3);
    const { repo, bares, evidencias } = memoryRepo();
    const search = (q: string) =>
      Promise.resolve<Place>({
        placeId: q.startsWith('Belmonte') ? 'place-belmonte' : `place-${q}`,
        nome: q, endereco: q, latitude: -23.5, longitude: -46.6, businessStatus: 'OPERATIONAL', bairro: null,
      });
    const report = await importSeed(parsed, search, repo, new Date('2026-11-08T12:00:00Z'));
    expect(bares.filter((b) => b.google_place_id === 'place-belmonte')).toHaveLength(1);
    expect(report.duplicadas).toBe(2);
    expect(report.importadas).toBe(parsed.linhas.length - 2);
    expect(new Set(bares.map((b) => b.google_place_id)).size).toBe(bares.length);
    expect(evidencias).toHaveLength(bares.length);
    expect(report.lidas).toBe(parsed.totalLinhas);
    expect(report.ignoradas_sem_nome).toBe(1);
  });

  it('sem resultado e CLOSED_PERMANENTLY vão para o relatório e não são importados; bairro do Google vale', async () => {
    const { repo, bares } = memoryRepo();
    const report = await importSeed(
      {
        totalLinhas: 3,
        semNome: 0,
        linhas: [
          { nome: 'Bar Fantasma', endereco: 'Rua X', bairro: 'Centro', temBalcao: null },
          { nome: 'Fechadao', endereco: 'Rua Y', bairro: 'Centro', temBalcao: null },
          { nome: 'Belmonte', endereco: 'Rua Z', bairro: 'Itaim', temBalcao: true },
        ],
      },
      fakeSearch,
      repo,
    );
    expect(report.sem_correspondencia).toEqual(['Bar Fantasma']);
    expect(report.fechadas).toEqual(['Fechadao']);
    expect(report.importadas).toBe(1);
    expect(bares[0]).toMatchObject({ google_place_id: 'place-belmonte', bairro: 'Itaim Bibi', tem_balcao: true });
  });

  it('rodar duas vezes não duplica bar nem evidência', async () => {
    const parsed = { totalLinhas: 1, semNome: 0, linhas: [{ nome: 'Belmonte', endereco: 'Rua Z', bairro: 'Itaim', temBalcao: null }] };
    const { repo, bares, evidencias } = memoryRepo();
    await importSeed(parsed, fakeSearch, repo);
    const second = await importSeed(parsed, fakeSearch, repo);
    expect(bares).toHaveLength(1);
    expect(evidencias).toHaveLength(1);
    expect(second).toMatchObject({ importadas: 0, ja_existentes: 1 });
  });
});

describe('searchPlace', () => {
  it('monta a chamada da Places API (New) e normaliza o resultado', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          places: [{
            id: 'abc', displayName: { text: 'Belmonte' }, formattedAddress: 'R. X, 1 - Itaim Bibi',
            location: { latitude: -23.58, longitude: -46.68 }, businessStatus: 'OPERATIONAL',
            addressComponents: [{ longText: 'Itaim Bibi', types: ['sublocality_level_1', 'sublocality'] }],
          }],
        }),
    });
    const place = await searchPlace('Belmonte Rua X São Paulo', 'chave-teste', fetchFn);
    expect(place).toEqual({
      placeId: 'abc', nome: 'Belmonte', endereco: 'R. X, 1 - Itaim Bibi', latitude: -23.58, longitude: -46.68,
      businessStatus: 'OPERATIONAL', bairro: 'Itaim Bibi',
    });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(init.headers['X-Goog-FieldMask']).toContain('places.businessStatus');
    expect(JSON.parse(init.body)).toMatchObject({ textQuery: 'Belmonte Rua X São Paulo', pageSize: 1 });
  });

  it('sem resultado devolve null; erro HTTP lança sem expor a chave', async () => {
    const empty = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) });
    await expect(searchPlace('x', 'k', empty)).resolves.toBeNull();
    const fail = jest.fn().mockResolvedValue({ ok: false, status: 403, json: () => Promise.resolve({}) });
    await expect(searchPlace('x', 'chave-secreta', fail)).rejects.toThrow('google_places_http_403');
  });

  it('bairro: sublocality_level_1, depois neighborhood', () => {
    expect(neighborhoodOf([{ longText: 'Pinheiros', types: ['neighborhood'] }])).toBe('Pinheiros');
    expect(neighborhoodOf([{ longText: 'São Paulo', types: ['locality'] }])).toBeNull();
  });
});
