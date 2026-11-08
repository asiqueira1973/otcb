# OTCB

App (Android e iOS) que responde, em conversa, onde tem chopp bem tirado em São Paulo e se o bar passa o jogo. A especificação completa está em [`spec.md`](spec.md), e os planos aprovados de cada épico ficam em [`plans/`](plans/).

## Requisitos

Node 22+, npm, Docker, [Supabase CLI](https://supabase.com/docs/guides/cli) 2.x, Deno 2.x e `jq`. O `jq` é usado pelos hooks de `.claude/hooks/`.

## Setup local

```bash
npm install
cp .env.example .env          # preencha as chaves públicas
supabase start                # stack local nas portas 563xx
npm start                     # Expo (dev server)
```

O projeto já está ligado ao BANCO DE TESTE (`supabase link --project-ref jeesdmfcrmhyufwzwzwt`). O stack local serve para rodar o pgTAP (`npm run test:db`) e testar migrations antes de aplicá-las no banco remoto.

## Verificação (spec 22.1)

```bash
npm run typecheck && npm run lint && npm test && npm run test:db && npm run test:functions && npm run build:check
```

## Variáveis de ambiente (spec 18)

| Variável | Onde | Pública? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | app (`.env`) | sim |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | app (`.env`) | sim (chave publicável) |
| `GOOGLE_MAPS_ANDROID_KEY` | EAS secret | embutida no app, restrita por pacote |
| `ANTHROPIC_API_KEY`, `GOOGLE_PLACES_API_KEY`, `FIRECRAWL_API_KEY`, `FOOTBALL_DATA_KEY`, `OTCB_CRON_SECRET` | secrets das Edge Functions | **secretas** |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions e `scripts/` | **secreta** |

Nenhum segredo vai para `app/` ou `src/`; o hook `guard-secrets` bloqueia isso.

## Migrations

1. Crie um arquivo novo em `supabase/migrations/<timestamp>_otcb_<nome>.sql`. Migration já versionada nunca se edita.
2. Teste localmente: `supabase db reset && npm run test:db`.
3. Aplique no BANCO DE TESTE pelo MCP do Supabase (`apply_migration`, com o mesmo SQL). O banco é compartilhado com outros apps, por isso **nunca use `supabase db push`**.
4. Rode os advisors (security e performance) e resolva os alertas sobre objetos `otcb_`.
5. Regenere o schema: `supabase db dump --local --schema public -f supabase/schema.sql`.

## Edge Functions

```bash
supabase functions deploy <nome> --project-ref jeesdmfcrmhyufwzwzwt
supabase secrets set --project-ref jeesdmfcrmhyufwzwzwt NOME=valor
```

## Checklist manual em aparelho real (spec 22)

- [ ] Primeira abertura cria 1 usuário anônimo; fechar e reabrir mantém o mesmo usuário (mesmo Passaporte).
- [ ] Desinstalar e reinstalar recomeça no onboarding com usuário novo.
- [ ] A câmera do Colarinhômetro abre e não oferece galeria.
- [ ] Localização negada: o app chega ao Chat e o agente pede o bairro.
- [ ] Localização usada só no momento da pergunta ou da foto, nunca em segundo plano.

## Publicação (épico 8.11)
- Conta Expo `alexsiq`, projeto `@alexsiq/otcb`; bundle e pacote `com.dablab.otcb`; só iPhone.
- Variáveis `EXPO_PUBLIC_*` ficam nos ambientes `production` e `preview` do EAS (`eas env:list`).
- Build: `npx eas-cli build --platform ios --profile production` (o primeiro precisa do login da Apple, interativo) e `--platform android`.
- Envio iOS: `npx eas-cli submit --platform ios --profile production --id <build>` (chave da API em `secrets/AuthKey_STNQW83D6N.p8`, fora do git). Android: baixar o `.aab` e subir no Play Console.
- Fichas e imagens: `store/` (textos pelo skill `app-store-dablab`; prints por `store/screenshots/compose.py` e `compose_play.py`).

## Guardrails do Claude Code

Ficam em `.claude/settings.json`, `.claude/hooks/`, `.claude/agents/verifier.md` e `REVIEW.md` (spec, Anexo B). Durante a correção de um bug, crie `.claude/fix-mode` para impedir edição de testes e remova o arquivo ao terminar.
