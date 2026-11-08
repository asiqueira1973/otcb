// Configura os segredos do garimpo (épico 8.3; seção 20). Roda na máquina do desenvolvedor:
//   npm run garimpo:configurar
// 1) Gera OTCB_CRON_SECRET (32 bytes aleatórios) se ainda não existir e grava em .env.local.
// 2) Grava no Vault do Supabase a URL base das Edge Functions e o segredo (otcb_configurar_garimpo),
//    usados pelo pg_cron/pg_net para chamar otcb-garimpo com o cabeçalho x-otcb-cron.
// Nunca imprime valores de segredos.
import { randomBytes } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const envLocal = resolve(__dirname, '../.env.local');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Faltam EXPO_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

let segredo = process.env.OTCB_CRON_SECRET ?? '';
if (!segredo) {
  segredo = randomBytes(32).toString('hex');
  const atual = readFileSync(envLocal, 'utf8');
  appendFileSync(envLocal, `${atual.endsWith('\n') ? '' : '\n'}# Segredo do cabeçalho x-otcb-cron (pg_cron → otcb-garimpo)\nOTCB_CRON_SECRET=${segredo}\n`);
  console.log('OTCB_CRON_SECRET gerado e gravado em .env.local.');
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
admin
  .rpc('otcb_configurar_garimpo', { p_url_funcoes: `${url}/functions/v1`, p_segredo: segredo })
  .then(({ error }) => {
    if (error) {
      console.error('Falha ao gravar no Vault:', error.code ?? '', error.message);
      process.exit(1);
    }
    console.log('Vault configurado (otcb_url_funcoes, otcb_cron_secret).');
  });
