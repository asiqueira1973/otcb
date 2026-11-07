# OTCB — Documentação técnica

Este documento descreve o sistema **como ele está implementado** (spec seção 19) e é atualizado no mesmo commit de cada mudança. Estado atual: épicos 8.0 e 8.1.

## 1. Modelo de dados

O banco é o Supabase "BANCO DE TESTE" (`jeesdmfcrmhyufwzwzwt`), compartilhado com outros apps. Por isso todo objeto do OTCB leva o prefixo `otcb_`.

### Enum `otcb_papel`
O papel do usuário no app.

| Valor | Significado |
|---|---|
| `usuario` | Qualquer adulto que abriu o app. É o padrão. |
| `admin` | Opera a base pelo Supabase Studio. Só é promovido por SQL (seção 5.1). |

### Tabela `otcb_perfis`
Dados do usuário no app, com uma linha por usuário anônimo.

| Coluna | Significado |
|---|---|
| `id` | O mesmo id do usuário anônimo em `auth.users`. Se o usuário é apagado, o perfil vai junto. |
| `apelido` | Nome público que aparece nas opiniões. Tem de 3 a 20 caracteres (letras sem acento, números, ponto e sublinhado) e é único sem diferenciar maiúsculas. |
| `papel` | `usuario` ou `admin`. |
| `maioridade_confirmada_em` | Instante em que a pessoa declarou ter 18 anos ou mais. A data de nascimento **não é gravada**. |
| `time_do_coracao` | Time de futebol, opcional. Fica nulo quando não informado. |
| `criado_em`, `atualizado_em` | Data de criação e da última alteração. |

## 2. Relacionamentos

```
auth.users (1) ──── (0..1) otcb_perfis
```

Cada usuário anônimo tem no máximo um perfil. O perfil só nasce depois da confirmação de maioridade e da escolha do apelido. Um usuário sem perfil está no meio do onboarding ou abandonou o app.

## 3. Regras de negócio no banco

| Nome | Tipo | Onde atua | Quando dispara | O que faz |
|---|---|---|---|---|
| `otcb_e_admin()` | Função `security definer`, `search_path` fixo | — | Chamada pelas políticas | Diz se o usuário atual tem papel `admin`. |
| `otcb_definir_atualizado_em()` + trigger `otcb_trg_atualizado_em` | Trigger before update | `otcb_perfis` | A cada update | Grava `atualizado_em = now()`. |
| `otcb_protege_papel()` + trigger `otcb_trg_perfil_protege_papel` | Trigger before update | `otcb_perfis` | Update que muda `papel` | Recusa com `papel_protegido` (42501) quando quem muda é um usuário logado sem papel admin. O service role passa, e é assim que o admin é promovido. |
| `otcb_perfis_apelido_unico` (índice) | Índice único | `otcb_perfis` | Insert/update | Garante apelido único em `lower(apelido)`. O erro chega como 23505. |
| `otcb_perfis_apelido_formato` (CHECK) | Restrição | `otcb_perfis` | Insert/update | Aplica a regra 11.7. O erro chega como 23514. |

**Políticas de RLS em `otcb_perfis`.** Todas valem só para `authenticated`, e o usuário anônimo é `authenticated`.

| Política | Operação | Regra |
|---|---|---|
| `otcb_perfis_le_proprio` | select | Lê só a própria linha (`id = auth.uid()`). |
| `otcb_perfis_admin_le_todos` | select | O admin lê todas as linhas. |
| `otcb_perfis_insere_proprio` | insert | Insere só a própria linha e sempre com `papel = 'usuario'`. |
| `otcb_perfis_atualiza_proprio` | update | Atualiza só a própria linha. O papel continua protegido pelo trigger. |

**Grants.** `authenticated` pode `select` e `insert`, e pode fazer `update` só nas colunas `apelido`, `time_do_coracao` e `papel` (migration `20261107210000`).
- `papel` fica no grant para que quem decide seja o trigger `otcb_trg_perfil_protege_papel`.
- `maioridade_confirmada_em` e `criado_em` não podem ser reescritos pelo cliente.
- Não há `delete`, que fica só com a Edge Function. `anon` não acessa nada.

**Jobs do `pg_cron`.** Nenhum ainda. A extensão não está instalada no BANCO DE TESTE e entra no 8.2/8.3.

## 4. Mapa tela → tabelas e funções

| Tela | Arquivo | Lê | Escreve / chama |
|---|---|---|---|
| Abertura (boot) | `app/index.tsx` + `src/features/auth/boot.ts` | `otcb_perfis` (`select id`) | Supabase Auth `signInAnonymously` |
| T1 Boas-vindas | `app/(onboarding)/boas-vindas.tsx` | — | — |
| T2 Maioridade | `app/(onboarding)/maioridade.tsx` | — | Edge Function `otcb-apagar-conta`, se menor de idade |
| T3 Apelido e time | `app/(onboarding)/apelido.tsx` | — | `insert` em `otcb_perfis` |
| T4 Localização | `app/(onboarding)/localizacao.tsx` | — | Permissão de localização do sistema |
| T10 Bloqueio | `app/(onboarding)/bloqueio.tsx` | — | — |
| T5 Chat (provisório) | `app/chat.tsx` | — | — (épico 8.4) |

## 5. Lógica por tela e por Edge Function

### Abertura (`resolveBootState`)
1. Na primeira abertura da instalação, descarta qualquer sessão herdada (`install-marker.ts`).
   - O motivo: no iOS, o Keychain (onde o `expo-secure-store` guarda a sessão) sobrevive à desinstalação. O AsyncStorage não sobrevive e guarda a marca `otcb_instalacao`.
   - Sem essa marca, o app faz `signOut({ scope: 'local' })` e apaga a marca de perfil. Assim, reinstalar começa do zero, como manda a seção 6.
2. Garante a sessão anônima (`ensureAnonymousSession`). A função é single-flight: chamadas simultâneas compartilham a mesma promessa e criam um único usuário.
3. Procura o perfil do uid:
   - com perfil, vai ao Chat;
   - sem perfil, vai à Boas-vindas.
4. Sem rede:
   - se este aparelho já criou o perfil desse uid (marca `otcb_perfil_criado` no SecureStore), vai ao Chat (seção 17);
   - senão, mostra a copy 15.9 de primeira abertura com "Tentar de novo".

### T2 Maioridade
- A data é digitada em DD/MM/AAAA, com máscara. Ela vive só no estado da tela: nunca é enviada, gravada nem logada.
- A idade civil é calculada no "hoje" de `America/Sao_Paulo` (regra 11.12). Quem nasceu em 29/02 faz anos em 01/03 nos anos não bissextos.
- 18 anos ou mais: vai à T3 levando só o instante da confirmação.
- Menor de idade:
  - chama `otcb-apagar-conta`;
  - faz `signOut` local, mesmo se a chamada falhar;
  - mostra a T10.
- Data inválida ou futura: erro inline.

### T3 Apelido
- Valida o formato no app, depois faz `insert` em `otcb_perfis`.
- O erro 23505 vira "Esse apelido já está em uso"; o 23514 vira o erro de formato. Outros erros mostram a copy de sem rede.
- No sucesso: grava a marca de perfil e chama `track('otcb_primeiro_acesso')`. Essa chamada ainda não faz nada, porque depende da pergunta 25.2. Depois vai à T4.

### T4 Localização
"Permitir" pede a permissão em primeiro plano. Tanto "Permitir" (concedida ou negada) quanto "Agora não" levam ao Chat.

### Edge Function `otcb-apagar-conta` (13.8)
- `POST`, sem corpo. O id do usuário vem só do JWT, validado com `auth.getUser`.
- No app, `deleteAccountAndSignOut` também trata o `error` que o supabase-js devolve (em vez de lançar) e limpa a sessão local mesmo se a exclusão falhar.
- Hoje ela apaga `otcb_perfis` e depois o usuário em `auth.users`, com o service role.
- Ainda faltam dois passos da 13.8, que entram com a tabela ou o bucket correspondente: arquivos do bucket (8.6) e anonimização de evidências (8.2).
- Respostas:

| Código | Quando |
|---|---|
| 200 `{ ok: true }` | Exclusão feita. |
| 401 | Sem JWT válido. |
| 405 | Método diferente de POST. |
| 500 `{ error: 'falha_exclusao' }` | Falha na exclusão. O log não registra nenhum dado pessoal. |

## 6. Divergências em relação ao spec

| Item | O que mudou | Motivo |
|---|---|---|
| `otcb_perfis` criada no 8.1 | O spec lista a tabela no 8.2. | O onboarding do 8.1 grava o perfil; o resto do banco continua no 8.2 (plano 8.1). |
| Política `otcb_perfis_insere_proprio` | Exige também `papel = 'usuario'`. | O trigger de papel só cobre update. Sem isso, alguém poderia se inserir como admin. |
| Update por coluna em `otcb_perfis` | O cliente só altera `apelido`, `time_do_coracao` e `papel` (este controlado pelo trigger). | O verifier apontou que o cliente podia reescrever `maioridade_confirmada_em`. A edição do perfil no 8.10 é só apelido e time. |
| Marca de instalação no AsyncStorage | Mecanismo novo, não previsto no spec. | O Keychain do iOS sobrevive à desinstalação e quebrava "reinstalar = começar do zero" (seção 6, critério 4 do 8.1). Bug reproduzido no simulador e coberto por teste. |
| Marca de perfil no SecureStore | Mecanismo novo. | Reabrir sem rede precisa ir ao Chat (seção 17) sem consultar o banco. |
| Microtextos fora da seção 15 | Estão em `src/lib/copy.ts`, marcados como "(design)" ou "(proposto 8.1)". | O spec não traz texto para rótulos e erros de formato. Aguardam revisão do Alexandre. |
| Advisors de `otcb_` | Ficaram três avisos aceitos: `otcb_e_admin()` executável por `authenticated`, políticas que valem para o usuário anônimo e duas políticas permissivas de select. | Os três vêm direto do spec: as políticas de admin usam a função, a identidade do app é anônima e os dois nomes de política estão na 6.1. |
| Mascote | Ilustrações geradas no Higgsfield (`assets/images/bolacha-*.png`, `azulejo.png`). No modo escuro a Bolacha ganha um halo claro. | Os traços cor de tinta sumiriam no fundo escuro (16.5). |
