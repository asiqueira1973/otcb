// Importação única do CSV antigo como semente (seção 14.1; seção 7.6).
// Roda na máquina do desenvolvedor com credencial de serviço, nunca no app:
//   npm run seed:import
// Lê EXPO_PUBLIC_SUPABASE_URL (.env), GOOGLE_PLACES_API_KEY e SUPABASE_SERVICE_ROLE_KEY (.env.local).
// Nunca imprime chaves. Idempotente: rodar de novo não duplica bares nem evidências.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { importSeed } from './seed/import';
import { parseLegacyCsv } from './seed/parse-csv';
import { searchPlace } from './seed/places';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleKey = process.env.GOOGLE_PLACES_API_KEY;
if (!url || !serviceKey || !googleKey) {
  console.error('Faltam variáveis: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e GOOGLE_PLACES_API_KEY.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const csv = readFileSync(resolve(__dirname, '../supabase/seed/estabelecimentos_otcb_antigo.csv'), 'utf8');

importSeed(parseLegacyCsv(csv), (q) => searchPlace(q, googleKey, fetch), {
  async barExists(placeId) {
    const { data, error } = await admin.from('otcb_bares').select('id').eq('google_place_id', placeId).maybeSingle();
    if (error) throw error;
    return !!data;
  },
  async insertBar(bar) {
    const { data, error } = await admin.from('otcb_bares').insert(bar).select('id').single();
    if (error) throw error;
    return data.id as string;
  },
  async insertSeedEvidence(barId, at) {
    const { error } = await admin.from('otcb_evidencias').insert({
      bar_id: barId,
      assunto: 'tem_brahma',
      sinal: 'positivo',
      tipo: 'seed_otcb_antigo',
      origem: 'seed',
      data_evidencia: at.toISOString(),
      // Peso e meia-vida são definidos pelo trigger otcb_trg_evidencia_define_peso (regra 11.1).
      peso: 0,
      meia_vida_dias: 1,
    });
    if (error) throw error;
  },
})
  .then((report) => {
    console.log(JSON.stringify(report, null, 2));
  })
  .catch((err: unknown) => {
    console.error('Falha na importação:', err instanceof Error ? err.message : 'erro desconhecido');
    process.exit(1);
  });
