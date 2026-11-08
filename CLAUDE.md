# CLAUDE.md — OTCB

Fonte única de verdade: `spec.md` (v1.2). Planos aprovados: `plans/8.X-<nome>.md`. Itens da seção 25 → **pare e pergunte**. Desempate: princípios da seção 0. Fora do escopo: tudo da seção 28.

## Regra de ouro
**Se um teste falhar, corrija o código, não o teste; nunca pule nem apague teste que falha.**
Bug: teste que reproduz → ver falhar → commit → `touch .claude/fix-mode` → corrigir → `rm .claude/fix-mode`.

## Convenções (seção 18)
- Banco em **português snake_case com prefixo `otcb_`** (tabelas, colunas, enums, funções, triggers, políticas), nomes exatos das seções 6.1 e 7. Código, variáveis e arquivos em **inglês**; `src/types/database.ts` (gerado) e contratos da 13 mantêm o português.
- Comentário de cabeçalho em português em toda função, hook, componente com lógica, Edge Function, função SQL, trigger e política: o que faz, recebe, devolve e a regra (`-- Implementa a regra 11.2`).
- Migrations em `supabase/migrations/`; nunca editar uma versionada. Depois de aplicar: `get_advisors` (security + performance) e regenerar `supabase/schema.sql`.
- Mudança de schema, função, política, Edge Function ou tela atualiza `DOCUMENTACAO-TECNICA.md` e este arquivo no mesmo commit.

## Arquitetura (seção 4)
App Expo SDK 58 + Expo Router (`app/`, `src/features/*`) → só chave publicável → Supabase BANCO DE TESTE (`jeesdmfcrmhyufwzwzwt`): Postgres `otcb_*` com RLS, Storage `otcb-fotos` privado, Edge Functions `otcb-agente`, `otcb-colarinhometro`, `otcb-opinioes`, `otcb-garimpo`, `otcb-jogos`, `otcb-apagar-conta` (segredos e APIs externas: Claude, Firecrawl, Google Places, football-data), `pg_cron` agenda garimpo/jogos/limpeza. Sem login: `signInAnonymously()` (seção 6).

## Comandos (22.1, na raiz)
| Comando | Saída saudável (código 0) |
|---|---|
| `npm run typecheck` | sem saída |
| `npm run lint` | só as linhas `env: load/export` do Expo (nomes, nunca valores) |
| `npm test` | `Tests: N passed, N total` |
| `npm run test:db` | `All tests successful.` / `Result: PASS` (exige `supabase start`) |
| `npm run test:functions` | `ok \| N passed \| 0 failed` |
| `npm run build:check` | `Exported: dist` (bundles ios e android) |

## Pegadinhas
- O banco é **compartilhado** (tabelas `livros_`, `oc_`, `ag_`, `precos_acoes`…) e tem **login anônimo ligado**: toda política usa `auth.uid()`; nunca criar, alterar ou ler objeto fora de `otcb_`; filtrar advisors para `otcb_`.
- Migrations no remoto **só via MCP `apply_migration`** (mesmo SQL do arquivo); nunca `supabase db push`.
- Supabase local usa as portas **563xx** (API 56321, DB 56322, Studio 56323, Mailpit 56324); 543xx/553xx/554xx são de outros projetos.
- "Brahma" nunca entra em `store/`, `app.json`, `app.config.ts`, `eas.json` (hook `guard-store-brand`). Dentro do app, só como descrição factual.
- Colarinhômetro: nunca galeria, só câmera do app (regra 11.4, hook `guard-gallery`).
- Status do bar nunca é escrito à mão: só `otcb_recalcular_bar` (regras 11.1–11.2). Peso/meia-vida vêm de `otcb_regra_evidencia` (trigger sobrescreve o que o chamador mandar).
- Evidência de usuário só via RPC (`otcb_confirmar_bar`/`otcb_sugerir_bar`) ou trigger de foto; cliente não tem grant de insert. Limites diários usam o dia de SP (`otcb_hoje_sp`).
- Semente: `npm run seed:import` (lê `.env` + `.env.local`; idempotente). `.env.local` tem segredos e nunca é exibido.
- pg_cron roda em UTC (SP = UTC−3). Garimpo: `npm run garimpo:configurar` (segredo do cron → .env.local + Vault); secrets das funções via `supabase secrets set --env-file` com arquivo temporário filtrado (nunca exibir).
- `otcb-garimpo` usa `verify_jwt = false` (autentica por `x-otcb-cron`). Erro 403 do Firecrawl no scrape é do item, não fatal.
- Deno: rodar com `--config supabase/functions/deno.json` (sem isso ele procura npm no node_modules do app).
- Anonimizar evidência só por `otcb_anonimizar_evidencias` (apaga as superadas antes de anular `usuario_id`; senão quebra o "um voto por pessoa").
- O agente de IA não grava nada no banco; toda escrita do usuário passa por card (8.5, 13.3).
- Nenhuma mecânica conta quantidade de chopp (princípio 3).
- Segredos só em `supabase/functions/` e `scripts/` (hook `guard-secrets`); o app só tem `EXPO_PUBLIC_*`.
- Data de nascimento nunca é gravada nem logada; localização e texto do chat fora de log e telemetria (seção 20).
- Expo muda a cada SDK: antes de usar API do Expo/RN, ler a doc da versão 58 (`docs.expo.dev/versions/v58.0.0/`); instalar pacote com `npx expo install`.
- RNTL 14: `render` **e** `fireEvent` são assíncronos (`await` nos dois). Reanimated 4 no jest: mock mínimo em `jest.setup.ts` (o oficial exige o runtime do Worklets).
- iOS: o Keychain (`expo-secure-store`) sobrevive à desinstalação; "reinstalar = começar do zero" depende da marca `otcb_instalacao` no AsyncStorage (`install-marker.ts`). Não remova.
- Textos de tela só em `src/lib/copy.ts`; microtexto fora da seção 15 leva a marca "(proposto 8.X)" até o Alexandre aprovar.
- Testes no simulador: Expo Go via `npx expo start --ios --port 8091`; apague os usuários anônimos de teste do remoto no fim.
- `tsconfig.json` exclui `supabase/functions` (Deno tem `supabase/functions/deno.json` próprio).
- Testes de banco nunca contam a tabela inteira: filtre pelos dados da fixture.
- Hooks de `.claude/settings.json` só valem em sessão do Claude Code aberta nesta pasta.
- Agente: `npm run agente:avaliar` gasta ~20 chamadas ao Sonnet; o p95 está perto do teto de 8 s, então meça de novo depois de mexer no prompt ou no loop. Prompt novo = arquivo `agente.vN+1.ts`.
- Textos do app dizem "chopp Brahma", nunca "chopp" genérico (emenda 8.4); a loja segue sem Brahma.
- Helpers de teste ficam em `test-utils/` (o jest roda tudo dentro de `__tests__/`); render com `renderWithSafeArea`.
- Teste real de card no remoto: apagar a conta anonimiza as evidências, que continuam valendo no status. Apague as `confirmacao_usuario`/`sugestao_usuario` do teste e rode `otcb_recalcular_bar`.
- `claude-haiku-5-5` raciocina antes de responder: `max_tokens` pequeno (200–400) termina no raciocínio, sem JSON (`stop_reason: max_tokens`). Use ≥ 2048 e `effort: "low"`; corte de texto sempre no fim de palavra.
- Quando o agente errar a mesma coisa duas vezes, a correção entra aqui.
- Submissão à Apple (8.11): as notas de revisão e a descrição precisam explicar o app inteiro (agente de IA no chat, Colarinhômetro, Passaporte, confirmação colaborativa, localização) — nunca "lista de bares". O Alexandre já foi reprovado (guideline 4.2) com "poderia ser um site".
- Cache local novo com dado da pessoa (AsyncStorage ou arquivo) entra em `clearLocalData` (`src/features/profile/deleteMyData.ts`), senão "Apagar meus dados" deixa resto no aparelho.
- Deploy de Edge Function no CLI pede `--yes` em modo agente (o Alexandre deixou autorizado para as `otcb-*`).
- Metro do OTCB: `npx expo start --port 8091` (a 8081 é de outro projeto); o atalho "Perfil" do Chat fica sob a engrenagem do Expo no simulador; use o deep link `exp://127.0.0.1:8091/--/perfil`.
