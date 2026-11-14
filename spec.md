# OTCB — Especificação de Software (SDD)

| Campo | Valor |
|---|---|
| Produto | OTCB ("Onde tem chopp Brahma") |
| Versão do documento | 1.2 (sem login; permanece no BANCO DE TESTE com login anônimo) |
| Responsável de produto | Alexandre Siqueira (Dab Lab) |
| Status | pronto para revisão |
| Data | 07/11/2026 |

## Como usar este documento

Este documento é a fonte única de verdade do OTCB. Ele foi escrito para ser consumido pelo Claude Code, que vai implementar o app a partir dele, épico por épico, na ordem da seção 8.

Antes de gerar qualquer código, revise a **seção 24 (Assunções declaradas)**. **Assunção não revisada vira verdade no minuto em que o agente começa a codar.** Os itens da **seção 25 (Perguntas abertas)** não podem ser decididos pelo agente: ao cruzar com um deles, ele pergunta.

As seções têm numeração estável. Referencie sempre pelo número ("regra 11.2", "épico 8.4").

### Nota sobre a marca

O nome "Brahma" é marca registrada da Ambev, e o OTCB não tem relação com ela. Por isso:

- **Na loja (App Store e Google Play)**, o produto aparece só como **OTCB**, sem a palavra "Brahma" em nome, subtítulo, descrição, palavras-chave, prints, vídeo ou ícone, e sem logos, cores ou tipografia que remetam à marca.
- **Dentro do app e nos canais próprios** (redes sociais, site), "chopp Brahma" aparece como descrição factual do que o app procura.

Esta regra é inegociável e tem guardrail executável (seção 18.1).

---

## 0. Princípios não-negociáveis

1. **O dado se mantém sozinho.** Nenhuma informação de bar depende de alguém lembrar de atualizar. Toda evidência tem data e perde força com o tempo (regra 11.1); o robô de garimpo é o motor principal e a comunidade é reforço. Se uma decisão obrigar a comunidade a fazer manutenção para o app funcionar, ela está errada.
2. **Uma conversa, não um app de telas.** A interface principal é o chat. Tudo que o usuário consulta ou informa acontece dentro dele, por texto ou por cards. Só sai do chat o que fisicamente exige outra tela: a câmera, o Passaporte completo e o perfil.
3. **Recompensa por descobrir, nunca por beber.** Nenhuma mecânica conta quantidade de chopp consumido. Carimbos, selos e notas premiam bares diferentes, tirada de qualidade e contribuição. Há limite diário de carimbos (regra 11.4).
4. **Um gesto, vários efeitos.** Cada ação do usuário alimenta o máximo de coisas possível sem pedir nada a mais: a foto do Colarinhômetro já é confirmação de Brahma, carimbo do Passaporte e nota do bar.
5. **Simplicidade antes de complexidade prematura.** Um banco, funções no próprio Supabase, sem painel administrativo no MVP, sem foto pública, sem mapa como aba. O que não é essencial para "achar um chopp Brahma bom perto de mim" vai para o roadmap (seção 28).

---

## 1. Visão e problema

**O que é.** O OTCB é um app para Android e iOS que responde, em conversa, onde tem chopp Brahma em São Paulo, se ele é bem tirado e se o bar passa o jogo. Por trás da conversa, um robô de garimpo encontra e revisita bares continuamente, e a comunidade reforça o dado com fotos avaliadas por IA (o Colarinhômetro), confirmações em um toque e opiniões.

**Para quem.** Adultos (18+) em São Paulo que preferem chopp Brahma e querem saber, no momento, para onde ir.

**A dor.** A primeira versão do OTCB (Glide, pré-IA) morreu porque o cadastro envelheceu: bares fecharam, outros trocaram de marca de chopp, muitos abriram, e ninguém atualizava. Guias e mapas genéricos não respondem "tem chopp Brahma ali hoje?" nem "é bem tirado?".

**Anti-escopo.** O OTCB não é:
- app de delivery nem de venda de bebida;
- programa de fidelidade de bar ou da Ambev;
- rede social com feed, seguidores ou fotos públicas;
- guia de cervejas em geral (outras marcas aparecem só como evidência negativa: "trocou de marca");
- app nacional no MVP (só a cidade de São Paulo).

---

## 2. Personas e cenários de uso

| Persona | Contexto | O que precisa |
|---|---|---|
| **O decidido** (30–55 anos, sai do trabalho) | Na rua, celular numa mão, pouco tempo | "Chopp Brahma perto de mim agora, com balcão" e ir. |
| **O organizador do jogo** | Em casa ou no trabalho, antes do jogo | "Onde ver o jogo do meu time hoje com Brahma em Pinheiros". |
| **O caçador de tirada** | Já no bar, com o chopp na mesa | Tirar a foto, ver a nota, ganhar o carimbo, comparar com outros bares. |

**Momento mais difícil de uso:** dentro do bar, à noite, barulho, rede móvel instável, uma mão ocupada. Isso define que: a foto precisa funcionar com um toque; o envio precisa tolerar rede ruim (seção 17); o texto dos cards precisa ser legível em tela escura; e nada pode exigir digitação longa.

---

## 3. Escopo do MVP

### Dentro

| # | Item | Épico |
|---|---|---|
| 1 | Identidade anônima por aparelho (sem login), confirmação de maioridade, apelido | 8.1 |
| 2 | Base de bares no Supabase com evidências, cálculo de status com decaimento | 8.2 |
| 3 | Importação do CSV antigo como semente | 8.2 |
| 4 | Garimpo automático: descoberta, revisita, coordenadas e status de funcionamento | 8.3 |
| 5 | Chat com agente (busca em linguagem natural) e respostas em cards | 8.4 |
| 6 | Entrada de dados por cards dentro do chat (confirmação em um toque, opinião, sugestão de bar) | 8.5 |
| 7 | Colarinhômetro (foto avaliada por IA) com carimbo e confirmação automáticos | 8.6 |
| 8 | Passaporte do Chopp (carimbos, coleções, selos) | 8.7 |
| 9 | Opiniões sobre o bar, com moderação e resumo por IA | 8.5 e 8.8 |
| 10 | Onde ver o jogo (jogos do dia + bares que transmitem) | 8.9 |
| 11 | Perfil, termos, privacidade e "Apagar meus dados" | 8.10 |
| 12 | Publicação nas duas lojas como OTCB | 8.11 |

### Fora

| Item | Destino | Motivo / dependência |
|---|---|---|
| Ranking "Garçom craque" | v2 | Exige identificar o garçom na foto ou no registro; sem desenho de privacidade ainda. |
| Índice do Chopp (preço) | v2 | Precisa de volume de usuários para ter dado confiável. |
| Rota do boteco (roteiro de vários bares) | v2 | Risco de leitura como incentivo a beber em sequência (guideline 1.4.3); exige desenho cuidadoso. |
| Confrarias (grupos de amigos) | v2 | Depende de base de usuários. |
| Cronista do bairro | v2 | Depende de volume de contribuições. |
| Fotos públicas na ficha do bar | v2 | Exige moderação de imagem e tratamento de pessoas identificáveis. |
| Mapa como aba própria | v2 | O MVP mostra mini mapa dentro dos cards do chat (princípio 2). |
| Painel administrativo | v2 | No MVP, administração pelo Supabase Studio (seção 5). |
| Login (e-mail, telefone, Apple, Google) | Descartado | Decisão do Alexandre (07/11/2026): o app não tem login; identidade anônima por aparelho (seção 6). |
| Recuperar Passaporte em outro aparelho | v2 | Ver "Salvar o Passaporte por telefone" na seção 28. |
| Notificações push | v2 | Sem caso de uso essencial no MVP. |
| Outras cidades | v2 | Garimpo e lista de bairros são de SP. |
| Parceria com a Ambev | Fora do produto | Decisão de negócio; não afeta o código do MVP. |
| Validade visível sustentada pela comunidade como mecanismo principal | Descartado | Depende de gente usando, o que não existe no início (decisão do Alexandre em 07/11/2026). O garimpo assume esse papel; a comunidade é reforço. |

---

## 4. Arquitetura

### 4.1 Stack

| Camada | Escolha | Por quê | Alternativa descartada |
|---|---|---|---|
| App | **React Native com Expo SDK 58** (React Native 0.88), TypeScript estrito, **Expo Router** | Nada no app depende de recurso exclusivo de sistema operacional; um código gera Android e iOS. SDK 58 é a versão estável atual (out/2026). | Swift nativo (só iOS); Flutter (fora do stack atual). |
| Build e publicação | **EAS Build** e **EAS Submit** | Builds das duas lojas sem máquina dedicada. | Builds locais com Xcode/Gradle. |
| Backend | **Supabase**, projeto **BANCO DE TESTE** (`jeesdmfcrmhyufwzwzwt`, us-east-2), tabelas com prefixo **`otcb_`** | Reaproveita o banco de testes já usado por outros apps (prefixos `oc_`, `ag_`, `livros_`); zero custo fixo novo. | Projeto Supabase dedicado (custo e gestão a mais no MVP). |
| Lógica de servidor | **Supabase Edge Functions** (Deno) + funções SQL + `pg_cron`/`pg_net` | Tudo num lugar só; segredos ficam no servidor. | n8n (mais uma peça para operar). |
| IA — agente do chat | **Claude API**, modelo `claude-sonnet-5-5`, com tool use | Precisa de raciocínio com ferramentas e boa conversa em pt-BR. | Modelo menor (pior na escolha de ferramentas). |
| IA — visão e classificação | **Claude API**, modelo `claude-haiku-5-5` | Colarinhômetro, classificação de evidência do garimpo e moderação exigem velocidade e custo baixo. | Sonnet (mais caro sem ganho perceptível nessas tarefas). |
| Coleta web | **Firecrawl** (search e scrape) | Já usado em outros projetos (Prelo); entrega texto limpo de cardápios e páginas. | Scraper próprio. |
| Lugares | **Google Places API (New)** — Text Search e Place Details | `businessStatus` detecta bar fechado; `reviews` traz menções; `location` dá coordenadas. | OpenStreetMap (sem status de funcionamento nem avaliações). |
| Jogos | **football-data.org** (plano gratuito) | Calendário do Brasileirão Série A sem custo. | API paga (Sportmonks etc.) — fica para v2 se faltar cobertura. |
| Animações | `react-native-reanimated`, `lottie-react-native`, `expo-haptics` | Microanimações da seção 16.6 com custo baixo; Reanimated já vem no Expo. | Animated API pura (menos fluida). |
| Mapas no app | `react-native-maps` (Apple Maps no iOS, Google Maps no Android) | Mini mapa dentro dos cards. | Mapbox (conta e custo a mais). |
| Telemetria | Visão de Produto, eventos com prefixo `otcb_` | Mesmo mecanismo dos outros apps do portfólio. | PostHog. |

**Premissas a validar** (marcadas também na seção 23):
- P1. Limite de tempo de execução das Edge Functions comporta lotes de até 20 itens do garimpo por invocação.
- P2. O plano gratuito do football-data.org inclui o Brasileirão Série A.
- P3. Os termos do Google Maps Platform permitem guardar `place_id` sem prazo e coordenadas por até 30 dias, desde que renovadas (regra 11.10).
- P4. **Decidido (Alexandre, 07/11/2026):** o OTCB fica no BANCO DE TESTE e o login anônimo será ligado nele, mesmo sabendo que tabelas de outros apps nesse banco têm políticas mais abertas do que deveriam. Motivo: evitar custo de um projeto novo; o app de livros é um experimento sem usuários e será aposentado (seção 23).

### 4.2 O que roda onde

```
┌───────────────────────────────┐        ┌──────────────────────────────────────────┐
│ App OTCB (Expo / RN)          │        │ Supabase — BANCO DE TESTE                │
│  • Chat + cards                │ HTTPS  │  • Postgres (tabelas otcb_*, RLS)         │
│  • Câmera do Colarinhômetro    │──────▶ │  • Auth (Apple, Google, OTP e-mail)        │
│  • Passaporte, Perfil          │        │  • Storage (bucket otcb-fotos, privado)   │
│  • Chave pública (anon) apenas │        │  • Edge Functions:                        │
└───────────────────────────────┘        │      otcb-agente ───────▶ Claude API      │
                                          │      otcb-colarinhometro ▶ Claude API     │
                                          │      otcb-opinioes ─────▶ Claude API      │
                                          │      otcb-garimpo ──────▶ Firecrawl,      │
                                          │                           Google Places,  │
                                          │                           Claude API      │
                                          │      otcb-jogos ────────▶ football-data   │
                                          │      otcb-apagar-conta                    │
                                          │  • pg_cron agenda garimpo, jogos, limpeza │
                                          └──────────────────────────────────────────┘
```

### 4.3 Repositório e deploy

- Repositório GitHub novo `otcb` (monorepo: app + `supabase/`).
- Migrations em `supabase/migrations/`, aplicadas ao BANCO DE TESTE pela CLI do Supabase.
- Edge Functions em `supabase/functions/`, publicadas pela CLI.
- App publicado via EAS (perfis `development`, `preview`, `production`).

---

## 5. Perfis de usuário e matriz de permissões

### 5.1 Perfis

| Perfil | Quem é | Como nasce |
|---|---|---|
| `usuario` | Qualquer adulto que abriu o app | Sessão anônima criada na primeira abertura + onboarding (épico 8.1). |
| `admin` | Alexandre (e quem ele indicar) | Seed: depois de abrir o app e escolher o apelido, executar no SQL Editor `update otcb_perfis set papel = 'admin' where lower(apelido) = '<apelido do Alexandre>';` (se reinstalar o app, repetir com o novo apelido) |
| Sistema | Edge Functions com credencial de serviço | Não é perfil de usuário; listado para deixar claro quem escreve o quê. |

No MVP não existe tela de administração. O `admin` opera pelo Supabase Studio; as políticas abaixo garantem que, se um painel for criado depois, ele já funciona com as permissões certas.

### 5.2 Matriz ação × perfil

| Ação | `usuario` | `admin` | Sistema (Edge Function) |
|---|---|---|---|
| Ver bares ativos (status confirmado, provável ou incerto acima do piso) | ✅ todos | ✅ todos, inclusive `sem_brahma`, `fechado` e excluídos | ✅ |
| Criar ou editar bar | ❌ (sugere via card, épico 8.5) | ✅ qualquer, via Studio | ✅ garimpo e sugestões |
| Excluir bar (soft delete / mesclar duplicado) | ❌ | ✅ qualquer | ❌ |
| Registrar confirmação de bar | ✅ só em nome próprio, 1 por bar por assunto por dia | ✅ | ❌ |
| Sugerir bar novo | ✅ só em nome próprio, até 5 por dia | ✅ | ❌ |
| Ver evidências cruas | ❌ (vê só agregados: última confirmação, total recente) | ✅ todas | ✅ |
| Enviar foto ao Colarinhômetro | ✅ só própria, até 10 por dia | ✅ | grava a foto e o resultado |
| Ver foto | ✅ só as próprias | ✅ todas | ✅ |
| Apagar foto | ✅ só as próprias (o carimbo permanece) | ✅ qualquer | ❌ |
| Ver carimbos | ✅ só os próprios | ✅ todos | ✅ |
| Criar carimbo | ❌ (nasce por trigger) | ❌ | ✅ via trigger |
| Publicar opinião | ✅ só própria, 1 por bar (editável) | ✅ | grava após moderação |
| Ver opiniões | ✅ publicadas de todos + todas as próprias | ✅ todas | ✅ |
| Apagar opinião | ✅ só a própria | ✅ qualquer | ❌ |
| Ocultar/reexibir opinião | ❌ | ✅ qualquer | ✅ (moderação e denúncias) |
| Denunciar opinião | ✅ 1 por opinião, não a própria | ✅ | ❌ |
| Ver denúncias | ❌ | ✅ todas | ✅ |
| Ver mensagens do chat | ✅ só as próprias | ❌ (privacidade) | ✅ só da conversa em atendimento |
| Apagar histórico do chat | ✅ só o próprio | ❌ | ✅ limpeza de 30 dias |
| Ver jogos | ✅ | ✅ | grava |
| Ver execuções do garimpo | ❌ | ✅ | grava |
| Editar o próprio perfil (apelido, time) | ✅ só o próprio | ✅ só o próprio | ❌ |
| Mudar papel de alguém | ❌ | ✅ via SQL no Studio | ❌ |
| Apagar os próprios dados ("Apagar meus dados") | ✅ | ✅ | executa |

Não há escopo por organização: todos os usuários enxergam a mesma base de bares.

---

## 6. Autenticação e identidade

- **Sem login.** O OTCB não tem cadastro, e-mail, telefone, senha nem login social. A identidade é **anônima e por aparelho**.
- **Como funciona:** na primeira abertura, o app chama `signInAnonymously()` do Supabase Auth. Isso cria um usuário em `auth.users` (com `is_anonymous = true`) e devolve uma sessão normal (JWT). Para a pessoa, nada aparece: ela só abre o app.
- **Medição e limites de uso de IA:** tudo é contado por esse ID anônimo (`auth.uid()`), exatamente como seria com login: limites da regra 11.6, mensagens, fotos, carimbos, opiniões e telemetria.
- **Sessão:** guardada no aparelho com `expo-secure-store`; renovada automaticamente pelo cliente Supabase. Não existe "Sair": sair seria perder a identidade.
- **Reinstalar ou trocar de aparelho = começar do zero.** Passaporte, opiniões e histórico ficam presos ao ID antigo e não são recuperáveis. É uma decisão consciente (Alexandre, 07/11/2026): simplicidade acima de recuperação. Os limites diários também recomeçam numa reinstalação; aceito como risco baixo (seção 23).
- **Primeiro acesso:** depois da sessão anônima criada, o onboarding (épico 8.1) pede:
  1. confirmação de maioridade com data de nascimento digitada; a data **não é gravada**, só o instante da confirmação (`maioridade_confirmada_em`);
  2. apelido público (regra 11.7), porque as opiniões precisam de um nome;
  3. time do coração (opcional).
- **Menor de 18:** o app mostra a tela de bloqueio e chama `otcb-apagar-conta`, que remove o usuário anônimo. Não se cria `otcb_perfis`. Na próxima abertura, o fluxo recomeça.
- **Configuração do projeto:** "Allow anonymous sign-ins" ligado no Supabase Auth do BANCO DE TESTE, com a proteção contra abuso padrão do Supabase (limite de criação de usuários anônimos por IP). Ver o risco aceito sobre o banco compartilhado na seção 23.
- **Autorização no banco:** RLS habilitado em todas as tabelas `otcb_`. Todas as políticas usam `auth.uid()`; o usuário anônimo tem o papel `authenticated` do Supabase. Permissão só no app não é permissão.

### 6.1 Políticas por tabela

| Tabela | Leitura | Escrita | Nome previsto das políticas |
|---|---|---|---|
| `otcb_perfis` | própria linha; `admin` lê todas | insert/update só a própria linha, sem poder alterar `papel` (trigger `otcb_trg_perfil_protege_papel`) | `otcb_perfis_le_proprio`, `otcb_perfis_admin_le_todos`, `otcb_perfis_insere_proprio`, `otcb_perfis_atualiza_proprio` |
| `otcb_bares` | autenticados: `excluido_em is null`; `admin`: tudo | só `admin` (Studio) e serviço | `otcb_bares_le_ativos`, `otcb_bares_admin_tudo` |
| `otcb_evidencias` | só `admin` | usuários só via função `otcb_confirmar_bar` / `otcb_sugerir_bar` (security definer); serviço | `otcb_evidencias_admin_le` |
| `otcb_fotos` | própria; `admin` todas | insert só serviço; update de `excluido_em` só na própria | `otcb_fotos_le_propria`, `otcb_fotos_admin_le`, `otcb_fotos_exclui_propria` |
| `otcb_carimbos` | próprios; `admin` todos | só trigger | `otcb_carimbos_le_proprios`, `otcb_carimbos_admin_le` |
| `otcb_opinioes` | `status = 'publicada'` para autenticados + todas as próprias; `admin` todas | insert/update só serviço (após moderação); delete da própria | `otcb_opinioes_le_publicadas`, `otcb_opinioes_le_proprias`, `otcb_opinioes_admin_tudo`, `otcb_opinioes_apaga_propria` |
| `otcb_denuncias` | só `admin` | insert do próprio usuário, não sobre opinião própria | `otcb_denuncias_insere_propria`, `otcb_denuncias_admin_le` |
| `otcb_mensagens` | próprias | insert só serviço; delete das próprias | `otcb_mensagens_le_proprias`, `otcb_mensagens_apaga_proprias` |
| `otcb_jogos` | autenticados | só serviço | `otcb_jogos_le` |
| `otcb_execucoes_garimpo` | só `admin` | só serviço | `otcb_execucoes_admin_le` |
| `storage.objects` (bucket `otcb-fotos`) | dono lê a pasta `{usuario_id}/` | escrita só serviço | `otcb_fotos_storage_le_proprias` |

A função auxiliar `otcb_e_admin()` (security definer, `search_path` fixo) devolve se o usuário atual tem `papel = 'admin'` e é usada nas políticas de admin.

---

## 7. Modelo de dados

Convenção: tabelas, colunas, enums, funções, triggers e políticas em português, `snake_case`, prefixo `otcb_`. Datas em `timestamptz`. "Dia" é sempre o dia em `America/Sao_Paulo` (regra 11.12).

### 7.1 Enums

| Enum | Valores (nesta ordem) |
|---|---|
| `otcb_papel` | `usuario`, `admin` |
| `otcb_status_bar` | `confirmado`, `provavel`, `incerto`, `sem_brahma`, `fechado` |
| `otcb_assunto_evidencia` | `tem_brahma`, `transmite_jogos`, `funcionamento` |
| `otcb_sinal_evidencia` | `positivo`, `negativo`, `fechado` |
| `otcb_tipo_evidencia` | `foto_colarinhometro`, `confirmacao_usuario`, `sugestao_usuario`, `cardapio_site`, `pagina_web`, `avaliacao_google`, `status_google`, `seed_otcb_antigo` |
| `otcb_origem_evidencia` | `usuario`, `garimpo`, `seed` |
| `otcb_status_opiniao` | `publicada`, `oculta_moderacao`, `oculta_denuncias`, `oculta_admin` |
| `otcb_papel_mensagem` | `usuario`, `assistente`, `sistema` |
| `otcb_tipo_execucao` | `descoberta`, `revisita`, `coordenadas`, `resumos`, `jogos` |
| `otcb_status_execucao` | `em_andamento`, `concluida`, `falhou` |

### 7.2 Tabelas

#### `otcb_perfis` — dados do usuário no app
| Coluna | Tipo | Nulo | Default | Observação |
|---|---|---|---|---|
| `id` | uuid | não | — | PK; FK `auth.users.id` on delete cascade |
| `apelido` | text | não | — | único sem diferenciar maiúsculas; formato na regra 11.7 |
| `papel` | `otcb_papel` | não | `'usuario'` | |
| `maioridade_confirmada_em` | timestamptz | não | — | instante em que declarou 18+ |
| `time_do_coracao` | text | sim | — | nulo quando o usuário não informou |
| `criado_em` | timestamptz | não | `now()` | |
| `atualizado_em` | timestamptz | não | `now()` | |

#### `otcb_bares` — cada bar conhecido
| Coluna | Tipo | Nulo | Default | Observação |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `nome` | text | não | — | |
| `endereco` | text | não | — | |
| `bairro` | text | não | — | |
| `latitude` | numeric(9,6) | não | — | |
| `longitude` | numeric(9,6) | não | — | |
| `coordenadas_atualizadas_em` | timestamptz | não | `now()` | renovação na regra 11.10 |
| `google_place_id` | text | sim | — | único; nulo quando o bar ainda não foi casado com o Google |
| `status` | `otcb_status_bar` | não | `'incerto'` | calculado (regra 11.2), nunca editado à mão |
| `pontuacao_brahma` | numeric(6,3) | não | `0` | calculada (regra 11.1) |
| `status_atualizado_em` | timestamptz | não | `now()` | |
| `transmite_jogos` | boolean | sim | — | calculado (regra 11.3); nulo = sem informação |
| `tem_balcao` | boolean | sim | — | nulo = sem informação |
| `classico` | boolean | não | `false` | curadoria do admin (coleção "Clássicos") |
| `nota_colarinho_media` | numeric(4,2) | sim | — | nula enquanto não houver foto avaliada no bar |
| `qtd_fotos_avaliadas` | integer | não | `0` | |
| `nota_opinioes_media` | numeric(3,2) | sim | — | nula enquanto não houver opinião publicada com nota |
| `qtd_opinioes` | integer | não | `0` | só publicadas |
| `resumo_opinioes` | text | sim | — | nulo enquanto houver menos de 3 opiniões publicadas (regra 11.8) |
| `resumo_atualizado_em` | timestamptz | sim | — | nulo enquanto `resumo_opinioes` for nulo |
| `excluido_em` | timestamptz | sim | — | soft delete; nulo = ativo |
| `criado_em` | timestamptz | não | `now()` | |
| `atualizado_em` | timestamptz | não | `now()` | |

Constraints e índices: `unique (google_place_id)`; índice em `(status)`; índice em `(bairro)`; índice em `(latitude, longitude)`.

#### `otcb_evidencias` — tudo que indica se o bar tem Brahma, passa jogo ou está aberto
| Coluna | Tipo | Nulo | Default | Observação |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `bar_id` | uuid | não | — | FK `otcb_bares.id` |
| `assunto` | `otcb_assunto_evidencia` | não | — | |
| `sinal` | `otcb_sinal_evidencia` | não | — | `fechado` só com assunto `funcionamento` (check) |
| `tipo` | `otcb_tipo_evidencia` | não | — | |
| `origem` | `otcb_origem_evidencia` | não | — | |
| `usuario_id` | uuid | sim | — | FK `otcb_perfis.id` on delete set null; nulo para garimpo, seed e contas apagadas |
| `foto_id` | uuid | sim | — | FK `otcb_fotos.id` on delete set null; nulo quando a evidência não veio de foto |
| `url_fonte` | text | sim | — | nula para evidência de usuário e seed |
| `trecho` | text | sim | — | até 300 caracteres; nulo para evidência de usuário e seed |
| `data_evidencia` | timestamptz | não | — | data do conteúdo (regra 11.1) |
| `peso` | numeric(4,2) | não | — | copiado da tabela da regra 11.1 no insert |
| `meia_vida_dias` | integer | não | — | idem |
| `criado_em` | timestamptz | não | `now()` | |

Constraints e índices: `unique (bar_id, assunto, url_fonte)` quando `url_fonte` não é nula (índice único parcial); índice em `(bar_id, assunto)`; check `char_length(trecho) <= 300`.

#### `otcb_fotos` — cada foto enviada ao Colarinhômetro
| Coluna | Tipo | Nulo | Default | Observação |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `usuario_id` | uuid | não | — | FK `otcb_perfis.id` on delete cascade |
| `bar_id` | uuid | sim | — | FK `otcb_bares.id`; nulo quando não havia bar a até 150 m |
| `distancia_bar_metros` | integer | sim | — | nula quando `bar_id` é nulo |
| `caminho_storage` | text | não | — | `{usuario_id}/{id}.jpg` no bucket `otcb-fotos` |
| `e_chopp` | boolean | não | — | resposta da IA |
| `usuario_confirmou_brahma` | boolean | não | — | resposta do usuário no card |
| `nota_altura` | numeric(3,1) | sim | — | 0–10; nula quando `e_chopp = false` |
| `nota_cremosidade` | numeric(3,1) | sim | — | idem |
| `nota_copo` | numeric(3,1) | sim | — | idem |
| `nota_gelado` | numeric(3,1) | sim | — | idem |
| `nota_colarinho` | numeric(3,1) | sim | — | fórmula da regra 11.5; nula quando `e_chopp = false` |
| `comentario_ia` | text | sim | — | frase curta e bem-humorada; nula se a IA falhar |
| `modelo_ia` | text | não | — | ex.: `claude-haiku-5-5` |
| `excluido_em` | timestamptz | sim | — | soft delete pelo dono |
| `criado_em` | timestamptz | não | `now()` | |

#### `otcb_carimbos` — Passaporte
| Coluna | Tipo | Nulo | Default | Observação |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `usuario_id` | uuid | não | — | FK `otcb_perfis.id` on delete cascade |
| `bar_id` | uuid | não | — | FK `otcb_bares.id` |
| `foto_id` | uuid | sim | — | FK `otcb_fotos.id` on delete set null; nula se a foto foi apagada |
| `criado_em` | timestamptz | não | `now()` | |

Constraint: `unique (usuario_id, bar_id)`.

#### `otcb_opinioes`
| Coluna | Tipo | Nulo | Default | Observação |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `usuario_id` | uuid | não | — | FK `otcb_perfis.id` on delete cascade |
| `bar_id` | uuid | não | — | FK `otcb_bares.id` |
| `texto` | text | não | — | 10 a 500 caracteres (check) |
| `nota` | smallint | sim | — | 1 a 5 (check); nula quando o usuário não deu nota |
| `status` | `otcb_status_opiniao` | não | `'publicada'` | |
| `motivo_ocultacao` | text | sim | — | nulo enquanto `status = 'publicada'` |
| `qtd_denuncias` | integer | não | `0` | |
| `criado_em` | timestamptz | não | `now()` | |
| `atualizado_em` | timestamptz | não | `now()` | |

Constraint: `unique (usuario_id, bar_id)`.

#### `otcb_denuncias`
| Coluna | Tipo | Nulo | Default | Observação |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `opiniao_id` | uuid | não | — | FK `otcb_opinioes.id` on delete cascade |
| `usuario_id` | uuid | não | — | FK `otcb_perfis.id` on delete cascade |
| `motivo` | text | sim | — | nulo quando o usuário não escreveu motivo |
| `criado_em` | timestamptz | não | `now()` | |

Constraint: `unique (opiniao_id, usuario_id)`.

#### `otcb_mensagens` — histórico do chat
| Coluna | Tipo | Nulo | Default | Observação |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `usuario_id` | uuid | não | — | FK `otcb_perfis.id` on delete cascade |
| `papel` | `otcb_papel_mensagem` | não | — | `sistema` registra ações feitas por card (regra 11.13) |
| `conteudo` | text | não | — | |
| `blocos` | jsonb | sim | — | cards da resposta (seção 13.2); nulo em mensagens só de texto |
| `criado_em` | timestamptz | não | `now()` | |

Índice em `(usuario_id, criado_em desc)`. Retenção de 30 dias (regra 11.14).

#### `otcb_jogos`
| Coluna | Tipo | Nulo | Default | Observação |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `id_externo` | text | não | — | único; id do football-data.org |
| `competicao` | text | não | — | |
| `mandante` | text | não | — | |
| `visitante` | text | não | — | |
| `inicio` | timestamptz | não | — | |
| `atualizado_em` | timestamptz | não | `now()` | |

Jogos com `inicio` há mais de 2 dias são apagados (hard delete) pela limpeza diária.

#### `otcb_execucoes_garimpo`
| Coluna | Tipo | Nulo | Default | Observação |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | PK |
| `tipo` | `otcb_tipo_execucao` | não | — | |
| `status` | `otcb_status_execucao` | não | `'em_andamento'` | |
| `cursor` | text | sim | — | onde parar/continuar o lote; nulo quando concluída |
| `iniciado_em` | timestamptz | não | `now()` | |
| `concluido_em` | timestamptz | sim | — | nulo enquanto em andamento |
| `bares_novos` | integer | não | `0` | |
| `evidencias_criadas` | integer | não | `0` | |
| `chamadas_google` | integer | não | `0` | |
| `chamadas_firecrawl` | integer | não | `0` | |
| `erros` | jsonb | sim | — | nulo quando não houve erro |

### 7.3 Diagrama de relacionamento

```
auth.users 1──1 otcb_perfis
otcb_perfis 1──N otcb_fotos ──N──0..1 otcb_bares
otcb_perfis 1──N otcb_carimbos N──1 otcb_bares
otcb_perfis 1──N otcb_opinioes N──1 otcb_bares
otcb_opinioes 1──N otcb_denuncias N──1 otcb_perfis
otcb_bares 1──N otcb_evidencias N──0..1 otcb_perfis
otcb_evidencias N──0..1 otcb_fotos
otcb_carimbos N──0..1 otcb_fotos
otcb_perfis 1──N otcb_mensagens
otcb_jogos (isolada)   otcb_execucoes_garimpo (isolada)
```

### 7.4 Estratégia de exclusão

| Entidade | Estratégia | Motivo |
|---|---|---|
| Bar | soft delete (`excluido_em`) | Carimbos e evidências referenciam o bar; duplicados são mesclados movendo referências e marcando o duplicado como excluído. |
| Foto | soft delete pelo dono; hard delete em "Apagar meus dados" | O carimbo sobrevive à exclusão da foto. |
| Opinião, denúncia, mensagem, carimbo | hard delete | Sem histórico necessário. |
| Evidência de usuário | desvinculada (`usuario_id = null`) em "Apagar meus dados" | Preserva a qualidade da base sem guardar dado pessoal. |
| Jogo | hard delete 2 dias após o início | Dado efêmero. |

### 7.5 Lógica no banco

| Nome | Tipo | Onde atua | O que faz |
|---|---|---|---|
| `otcb_distancia_metros(lat1, lng1, lat2, lng2)` | função imutável | — | Distância haversine em metros. |
| `otcb_e_admin()` | função security definer | — | Verdadeiro se o usuário atual é admin. |
| `otcb_recalcular_bar(p_bar_id)` | função | `otcb_bares` | Aplica as regras 11.1, 11.2 e 11.3 e grava `pontuacao_brahma`, `status`, `transmite_jogos`, `status_atualizado_em`. |
| `otcb_trg_evidencia_recalcula` | trigger after insert/delete | `otcb_evidencias` | Chama `otcb_recalcular_bar` do bar afetado. |
| `otcb_recalcular_todos()` | função | `otcb_bares` | Recalcula todos os bares ativos (o decaimento muda a pontuação com o tempo); agendada diariamente. |
| `otcb_trg_foto_processa` | trigger after insert | `otcb_fotos` | Regra 11.4: se a foto é válida, cria evidência `foto_colarinhometro` positiva e o carimbo (respeitando o limite diário), e atualiza `nota_colarinho_media` e `qtd_fotos_avaliadas`. |
| `otcb_trg_opiniao_agrega` | trigger after insert/update/delete | `otcb_opinioes` | Recalcula `nota_opinioes_media` e `qtd_opinioes` do bar. |
| `otcb_trg_denuncia_conta` | trigger after insert | `otcb_denuncias` | Incrementa `qtd_denuncias` e oculta a opinião ao chegar a 3 (regra 11.7). |
| `otcb_trg_perfil_protege_papel` | trigger before update | `otcb_perfis` | Impede que um não admin altere `papel`. |
| `otcb_trg_atualizado_em` | trigger before update | todas com `atualizado_em` | Mantém `atualizado_em = now()`. |
| `otcb_confirmar_bar(p_bar_id, p_assunto, p_sinal)` | função security definer | `otcb_evidencias` | Valida limite (regra 11.6) e grava evidência `confirmacao_usuario` do usuário atual. |
| `otcb_sugerir_bar(p_nome, p_endereco, p_bairro, p_latitude, p_longitude, p_tem_brahma)` | função security definer | `otcb_bares`, `otcb_evidencias` | Valida limite, procura bar existente a até 80 m com nome parecido; se não houver, cria bar `incerto` e grava evidência `sugestao_usuario`. |
| `otcb_buscar_bares(...)` | função (invoker) | `otcb_bares` | Busca da regra 11.9; usada pelo agente. |
| `otcb_detalhes_bar(p_bar_id)` | função security definer | `otcb_bares`, `otcb_evidencias` | Devolve o card do bar com agregados de evidência (última confirmação, quantas pessoas confirmaram em 60 dias), sem expor quem confirmou. |
| `otcb_meu_passaporte()` | função (invoker) | `otcb_carimbos`, `otcb_bares` | Devolve carimbos, coleções e selos do usuário atual (regra 11.11). |
| `otcb_limpeza_diaria()` | função | `otcb_mensagens`, `otcb_jogos` | Apaga mensagens com mais de 30 dias e jogos com início há mais de 2 dias. |

Agendamentos com `pg_cron` (horários de São Paulo):

| Job | Quando | O que chama |
|---|---|---|
| `otcb_cron_recalculo` | todo dia 03:00 | `otcb_recalcular_todos()` |
| `otcb_cron_limpeza` | todo dia 03:30 | `otcb_limpeza_diaria()` |
| `otcb_cron_revisita` | todo dia 04:00 | Edge Function `otcb-garimpo` modo `revisita` |
| `otcb_cron_coordenadas` | todo dia 04:30 | `otcb-garimpo` modo `coordenadas` |
| `otcb_cron_resumos` | todo dia 05:00 | `otcb-garimpo` modo `resumos` |
| `otcb_cron_jogos` | todo dia 06:00 | Edge Function `otcb-jogos` |
| `otcb_cron_descoberta` | segunda 02:00 | `otcb-garimpo` modo `descoberta` |

### 7.6 Seed e migrations

- Migrations versionadas em `supabase/migrations/`, uma por mudança, nunca editadas depois de commitadas (guardrail na seção 18.1).
- Seed de bares: importação do CSV antigo (seção 14.1), executada uma vez pelo script `scripts/import-seed.ts` com credencial de serviço, rodado na máquina do desenvolvedor, nunca no app.
- Seed de admin: seção 5.1.

### 7.7 Trade-offs de modelagem declarados

- **Agregados desnormalizados em `otcb_bares`** (`nota_colarinho_media`, `qtd_opinioes`, `status` etc.): leitura rápida para o agente em troca de triggers que precisam ser mantidos. Fonte de verdade continua nas tabelas filhas; `otcb_recalcular_todos()` reconstrói tudo se divergir.
- **Sem PostGIS:** a distância é calculada por haversine em SQL. Com poucos milhares de bares numa cidade, é suficiente. Se a base passar de ~20 mil bares, migrar para PostGIS.
- **Uma conversa contínua por usuário**, sem tabela de conversas: o contexto do agente é a janela recente (regra 11.13). Impede "várias conversas salvas", que não é necessidade do MVP.
- **Coleções e selos calculados na hora** (função `otcb_meu_passaporte`), sem tabela própria: evita sincronização, ao custo de uma consulta um pouco maior.

---

## 8. Épicos e critérios de aceite

Ordem de implementação: 8.0 → 8.11. Cada épico só começa quando o anterior passou no loop de verificação (seção 22.1).

### 8.0 Guardrails e esqueleto do projeto
**Objetivo:** projeto criado, guardrails ativos e verificação rodando antes de qualquer feature.

Fluxo: criar o app Expo SDK 58 com Expo Router e TypeScript estrito; criar `supabase/` com a CLI ligada ao BANCO DE TESTE; criar os arquivos do Anexo B; configurar `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run test:functions`, `npm run build:check`; criar `CLAUDE.md`, `README.md` e `plans/`.

Critérios de aceite:
- [ ] Os seis comandos da seção 22.1 rodam e terminam com código 0 no projeto vazio.
- [ ] Cada hook do Anexo B foi provocado uma vez e bloqueou com a mensagem esperada (saída colada).
- [ ] `CLAUDE.md` existe, cabe em uma página e lista os comandos com exemplo de saída saudável.

### 8.1 Primeiro acesso: identidade anônima, maioridade e apelido
**Objetivo:** o usuário abre o app, declara 18+ e escolhe apelido em menos de 30 segundos, sem login.

Fluxo:
1. Na abertura, se não há sessão guardada, o app chama `signInAnonymously()` em segundo plano (seção 6).
2. Tela Boas-vindas com o aviso "Proibido para menores de 18 anos" e um único botão "Bora começar".
3. Tela Maioridade: data de nascimento → calcula a idade no app.
4. Menor de 18 → tela de bloqueio com copy 15.2; chama `otcb-apagar-conta`.
5. 18+ → tela Apelido (e time do coração opcional) → grava `otcb_perfis` → pede permissão de localização com explicação (copy 15.3) → abre o Chat.
6. Estados: sem rede na primeira abertura (copy 15.9 com "tentar de novo"; sem sessão não há como seguir), apelido em uso (mensagem inline).

Critérios de aceite:
- [ ] Nenhuma tela pede e-mail, telefone, senha ou login social.
- [ ] Na primeira abertura é criado exatamente 1 usuário em `auth.users` com `is_anonymous = true`.
- [ ] Fechar e reabrir o app mantém o mesmo `auth.uid()` (mesmo Passaporte, mesmo histórico).
- [ ] Desinstalar e reinstalar cria um usuário novo e o app volta ao onboarding (comportamento esperado, seção 6).
- [ ] Data de nascimento resultando em 17 anos e 364 dias bloqueia; 18 anos exatos no dia libera.
- [ ] A data de nascimento não aparece em nenhuma tabela nem log (verificado por busca no banco e nos logs da Edge Function).
- [ ] Apelido fora do formato da regra 11.7 ou já usado (sem diferenciar maiúsculas) é recusado com mensagem inline.
- [ ] Usuário que nega localização chega ao Chat mesmo assim; o agente pede bairro ou endereço quando precisar.
- [ ] Reabrir o app com sessão válida vai direto ao Chat.

### 8.2 Base de bares, evidências e semente
**Objetivo:** tabelas, enums, políticas e funções da seção 7 criados; CSV antigo importado.

Fluxo: migrations da seção 7 → políticas da seção 6.1 → funções e triggers da seção 7.5 → script `scripts/import-seed.ts` (seção 14.1).

Critérios de aceite:
- [ ] Todas as tabelas `otcb_` têm RLS habilitado e as políticas com os nomes da seção 6.1.
- [ ] Testes pgTAP cobrem cada linha da matriz 5.2 que envolve banco (usuário A não lê foto, carimbo, mensagem ou opinião oculta de usuário B; usuário comum não altera `papel`; usuário comum não insere em `otcb_bares` nem em `otcb_evidencias` direto).
- [ ] Testes pgTAP cobrem a regra 11.1 e 11.2 com os casos da tabela 11.2.1.
- [ ] A importação do CSV resulta em no máximo 1 bar por `google_place_id` (o Belmonte, repetido 3 vezes no arquivo, vira 1 bar) e ignora a linha vazia.
- [ ] Todo bar importado nasce com status `incerto` e uma evidência `seed_otcb_antigo`.
- [ ] Advisors de segurança e performance do Supabase sem alerta crítico relacionado a objetos `otcb_`.

### 8.3 Garimpo automático
**Objetivo:** a base se descobre e se atualiza sozinha (princípio 1).

Fluxo: Edge Function `otcb-garimpo` com quatro modos, chamada pelo `pg_cron` (seção 7.5):
- **descoberta:** para cada bairro da lista da regra 11.15, busca no Firecrawl e no Google Places (Text Search) por bares com chopp Brahma; para cada candidato, extrai texto (página, cardápio), classifica com `claude-haiku-5-5` (contrato 13.6) e grava evidências; cria bar novo quando não existe correspondente (regra 11.16).
- **revisita:** para os bares ativos cujo último garimpo foi há mais de 7 dias (prioridade para status `incerto` e para semente), consulta `businessStatus` no Google e o site/cardápio conhecido; grava evidências novas.
- **coordenadas:** renova coordenadas com mais de 25 dias (regra 11.10).
- **resumos:** gera `resumo_opinioes` dos bares que se enquadram na regra 11.8.
Cada invocação processa no máximo 20 itens, grava o `cursor` em `otcb_execucoes_garimpo` e se reagenda via `pg_net` até concluir; respeita os tetos de chamadas da regra 11.17.

Critérios de aceite:
- [ ] Rodando `descoberta` para um bairro de teste, surgem bares novos com evidência de `url_fonte` e `trecho` preenchidos.
- [ ] Um bar com `businessStatus = CLOSED_PERMANENTLY` vira `fechado` na mesma execução.
- [ ] Rodar o mesmo modo duas vezes seguidas não duplica evidências (índice único parcial da seção 7.2).
- [ ] Ao atingir o teto de chamadas, a execução termina com status `concluida` e registra o motivo em `erros`.
- [ ] Falha de um item (timeout de site, resposta inválida da IA) é registrada em `erros` e não interrompe o lote.
- [ ] Nenhuma chave de API aparece em log.

### 8.4 Chat com agente
**Objetivo:** a pessoa pergunta em linguagem natural e recebe resposta com cards.

Fluxo:
1. Tela Chat: histórico das mensagens (até 30 dias), campo de texto, botão de câmera fixo ao lado do campo, sugestões iniciais quando o histórico está vazio (copy 15.4).
2. Ao enviar, o app chama `otcb-agente` com o texto e a localização atual (se permitida).
3. A Edge Function aplica o filtro determinístico (regra 11.18); se não bloqueado, monta o contexto (regra 11.13), chama o Claude com as ferramentas da seção 13.3 e devolve texto + blocos.
4. O app renderiza o texto e os blocos (seção 13.2) como cards: lista de bares, card de bar, mini mapa, jogos, resumo do Passaporte, botões de ação e cards de entrada de dados (épico 8.5).
5. Tocar num card de bar abre a Ficha do bar (bottom sheet).
6. Estados: digitando (indicador animado), sem conexão (copy 15.9, mensagem fica marcada "não enviada" com "tentar de novo"), limite diário atingido (copy 15.8), erro do modelo (copy 15.9).

Critérios de aceite:
- [ ] "chopp perto de mim com balcão" com localização permitida devolve um bloco `lista_bares` só com bares a até 2 km, ordenados pela regra 11.9.
- [ ] "Bar do Nico" devolve um `card_bar` desse bar.
- [ ] Bares `sem_brahma` e `fechado` nunca aparecem em resposta.
- [ ] Bar `incerto` aparece com a etiqueta "a confirmar", e o texto do agente não afirma que ele tem Brahma.
- [ ] Mensagem que casa com a regra 11.18 recebe a resposta fixa correspondente sem chamar o modelo (verificado por log).
- [ ] A 41ª mensagem do dia recebe a copy 15.8 sem chamar o modelo.
- [ ] Botão "Limpar conversa" no Perfil apaga as mensagens do usuário; o próximo turno não tem contexto anterior.
- [ ] p95 do tempo de resposta abaixo de 8 s em 4G (seção 17).

### 8.5 Entrada de dados por cards no chat
**Objetivo:** toda informação que o usuário dá ao app entra por card dentro da conversa, no mesmo padrão do Agenda Psi: o agente oferece o card, o usuário preenche e confirma no próprio card, e o card grava direto (sem passar pelo modelo).

Cards de entrada:

| Card (bloco) | Quando aparece | Campos | Ao confirmar |
|---|---|---|---|
| `pergunta_confirmacao` | Agente pergunta se o bar ainda tem Brahma, se passa jogo ou se está funcionando | Botões: "Tem sim" / "Não tem mais" / "Fechou" (para `funcionamento`), ou "Passa" / "Não passa" | chama `otcb_confirmar_bar` |
| `formulario_opiniao` | Usuário pede para opinar ou toca "Dar opinião" na Ficha do bar | Nota 1–5 (opcional), texto (10–500) | chama `otcb-opinioes` |
| `formulario_sugestao_bar` | Usuário diz que conhece um bar que não está na base | Nome, endereço (preenchido pelo agente quando possível), bairro, "Tem Brahma?" (sim/não sei) | chama `otcb_sugerir_bar` |
| `formulario_denuncia` | Usuário toca "Denunciar" numa opinião | Motivo (opcional) | insere em `otcb_denuncias` |

Fluxo comum:
1. O agente devolve o bloco do card, já com o que ele conseguiu pré-preencher a partir da conversa.
2. O usuário edita e toca no botão principal do card.
3. O app grava, o card vira estado "registrado" (não editável, com check) e o app grava uma mensagem `sistema` no histórico (regra 11.13) para o agente saber o que aconteceu.
4. Estados do card: editando, enviando, registrado, erro (com "tentar de novo"), recusado pela moderação (copy 15.7).

Critérios de aceite:
- [ ] Tocar "Tem sim" grava uma evidência `confirmacao_usuario` positiva e o card vira "registrado" em menos de 1 s com rede boa.
- [ ] Segunda confirmação do mesmo usuário, mesmo bar e assunto no mesmo dia é recusada com copy 15.8.
- [ ] Opinião com 9 caracteres não habilita o botão; com 501, também não.
- [ ] Opinião recusada pela moderação mostra copy 15.7 e não grava nada.
- [ ] Usuário que já opinou sobre o bar recebe o card preenchido com a opinião atual (edição, não duplicação).
- [ ] Sugestão de bar a menos de 80 m de bar existente com nome parecido não cria bar novo; grava a evidência no existente e o card informa isso.
- [ ] Nenhum card de entrada depende do modelo para gravar (verificado desligando a chave da Claude API: os cards continuam gravando).

### 8.6 Colarinhômetro
**Objetivo:** foto do chopp vira nota, confirmação de Brahma e carimbo num gesto só (princípio 4).

Fluxo:
1. Botão de câmera no Chat (ou bloco `acao: abrir_camera`) abre a tela Câmera, com guia na tela mostrando onde enquadrar o copo.
2. Foto só pela câmera do app (sem galeria). O app redimensiona para no máximo 1280 px no maior lado, JPEG qualidade 0,7.
3. Depois da foto, um card pergunta "É chopp Brahma?" (Sim / Não / Não sei).
4. O app envia a foto, a localização e a resposta para `otcb-colarinhometro`.
5. A função localiza o bar mais próximo a até 150 m, guarda a foto, chama o modelo de visão (contrato 13.5), calcula a nota (regra 11.5) e grava `otcb_fotos`; o trigger cuida de evidência e carimbo (regra 11.4).
6. O Chat recebe o card `resultado_colarinho`: nota grande, as quatro notas parciais, comentário bem-humorado, bar identificado e, se houve, a animação do carimbo novo. O card tem "Compartilhar", que gera uma imagem no próprio aparelho.
7. Estados: enviando (animação de chopp enchendo), sem bar por perto (nota dada, sem carimbo, card oferece sugerir o bar), não é chopp (copy 15.6), limite diário (copy 15.8), sem rede (foto guardada no aparelho e enviada quando a rede voltar, por até 24 h).

Critérios de aceite:
- [ ] Foto de chopp a 100 m de um bar ativo, com "Sim", gera nota, evidência positiva e carimbo (se for o primeiro naquele bar e dentro do limite diário).
- [ ] Mesma foto a 200 m gera nota, sem evidência e sem carimbo.
- [ ] Resposta "Não" ou "Não sei" gera nota, sem evidência de Brahma e sem carimbo.
- [ ] Foto que não é chopp devolve copy 15.6 e não grava nota.
- [ ] Terceiro carimbo novo no mesmo dia não é criado; o card explica (copy 15.8).
- [ ] A foto fica no bucket privado em `{usuario_id}/{foto_id}.jpg` e só o dono consegue baixá-la.
- [ ] O card de compartilhamento não contém localização exata nem o apelido, só nome do bar, nota e comentário.
- [ ] p95 do retorno abaixo de 6 s em 4G.

### 8.7 Passaporte do Chopp
**Objetivo:** mostrar a coleção de bares visitados.

Fluxo: tela Passaporte (acessada pelo ícone no topo do Chat e pelo bloco `passaporte`): total de bares carimbados, grade de carimbos (estilo carimbo de borracha com nome do bar e data), coleções por bairro com progresso, coleção Clássicos, selos (regra 11.11). Tocar num carimbo abre a Ficha do bar. Estado vazio com copy 15.5.

Critérios de aceite:
- [ ] Os números batem com `otcb_meu_passaporte()` para um usuário de teste com carimbos em 3 bairros.
- [ ] Nenhum número na tela representa quantidade de chopp ou de fotos (princípio 3).
- [ ] Apagar a foto que gerou um carimbo mantém o carimbo.

### 8.8 Opiniões e resumo
**Objetivo:** a comunidade opina e a IA resume.

Fluxo: entrada pelo card `formulario_opiniao` (8.5); moderação na Edge Function `otcb-opinioes` (regra 11.7); exibição na Ficha do bar (resumo da IA no topo quando existir, depois as opiniões mais recentes, 10 por página, com apelido, nota e data, e botão "Denunciar"); resumo gerado pelo garimpo (regra 11.8).

Critérios de aceite:
- [ ] Opinião com ofensa pessoal, discurso de ódio, dado pessoal de terceiro ou incentivo a beber em excesso é recusada.
- [ ] Três denúncias de usuários distintos ocultam a opinião (`oculta_denuncias`).
- [ ] O dono da opinião oculta continua vendo-a com o aviso "oculta".
- [ ] O resumo só aparece com 3 ou mais opiniões publicadas e não cita apelidos.

### 8.9 Onde ver o jogo
**Objetivo:** responder "onde ver o jogo X tomando Brahma".

Fluxo: `otcb-jogos` grava diariamente os jogos dos próximos 7 dias; o agente usa a ferramenta `jogos_de_hoje` e `buscar_bares` com `transmite_jogos = true`; o card `jogos` lista partidas do dia; se o usuário informou time do coração, os jogos dele aparecem primeiro.

Critérios de aceite:
- [ ] "onde ver o jogo do Corinthians hoje em Pinheiros" com jogo do Corinthians no dia devolve o card do jogo e bares de Pinheiros com `transmite_jogos = true`.
- [ ] Sem jogo do time no dia, o agente diz isso e oferece o próximo jogo dos 7 dias.
- [ ] Sem bar com `transmite_jogos = true` na região, o agente diz isso e oferece o card `pergunta_confirmacao` de jogos para bares próximos com Brahma.

### 8.10 Perfil, privacidade e "Apagar meus dados"
**Objetivo:** controle do usuário sobre os próprios dados.

Fluxo: tela Perfil com apelido e time (editáveis), "Limpar conversa", "Termos de uso", "Política de privacidade", "Beba com moderação. Se beber, não dirija.", o aviso fixo "Seu passaporte fica neste celular. Se reinstalar o app ou trocar de aparelho, ele não volta." e "Apagar meus dados" (confirmação em duas etapas). A exclusão chama `otcb-apagar-conta` (seção 13.8). Não há "Sair".

Critérios de aceite:
- [ ] Após "Apagar meus dados", não restam linhas do usuário em `otcb_perfis`, `otcb_fotos`, `otcb_carimbos`, `otcb_opinioes`, `otcb_denuncias`, `otcb_mensagens`; arquivos da pasta do usuário somem do bucket; evidências ficam com `usuario_id` nulo; o usuário some de `auth.users`.
- [ ] A exclusão funciona em até 10 s e o app volta à tela Boas-vindas, com uma nova identidade anônima.

Critério transversal de animação (vale para os épicos 8.4 a 8.7):
- [ ] As animações A1–A11 da seção 16.6 existem nos momentos indicados, nenhuma passa de 1,2 s e, com "reduzir movimento" ligado, todas viram transição de opacidade.

### 8.11 Publicação
**Objetivo:** OTCB nas duas lojas, sem a marca Brahma na ficha.

Fluxo: textos da loja em `store/` (seção 15.10), prints sem close de bebida, classificação 18+ na App Store e público-alvo 18+ no Google Play, builds via EAS, envio via EAS Submit.

Critérios de aceite:
- [ ] Nenhum arquivo em `store/` contém "brahma" (sem diferenciar maiúsculas) — garantido pelo hook da seção 18.1.
- [ ] `app.config.ts` usa `name: "OTCB"`.
- [ ] Classificação etária 18+ configurada nas duas lojas.
- [ ] Builds de produção instalados e testados em um iPhone e um Android reais antes do envio.

---

## 9. Fluxos principais ponta a ponta

### 9.1 Primeira noite de uso
1. Instala, toca "Bora começar" (sem login), declara 18+, escolhe apelido, permite localização.
2. Chat mostra sugestões; toca "Chopp Brahma perto de mim".
3. Recebe lista de 5 bares com mini mapa; toca no primeiro; vê a Ficha; toca "Como chegar".
4. No bar, toca na câmera, fotografa, responde "Sim".
5. Recebe nota 8,4, comentário e o primeiro carimbo, com animação.
6. Agente pergunta se o bar passa jogo (card `pergunta_confirmacao`); usuário toca "Passa".

### 9.2 Bar que trocou de marca
1. Usuário pergunta por um bar; ele aparece como `provavel`.
2. Ao chegar, vê que agora é outra marca; diz no chat "aqui trocou de chopp".
3. Agente oferece o card `pergunta_confirmacao`; usuário toca "Não tem mais".
4. Evidência negativa entra; a pontuação cai (regra 11.1); se cair abaixo de −0,5, o bar some das buscas.

### 9.3 Exceção: sem bar na base
1. Usuário pergunta por um bairro sem bares conhecidos.
2. Agente diz que ainda não conhece bares ali e oferece o card `formulario_sugestao_bar`.
3. A sugestão cria bar `incerto`; a próxima revisita do garimpo procura evidência sobre ele.

### 9.4 Exceção: sem rede no bar
1. Foto tirada sem rede fica na fila local com aviso "vai enviar quando a rede voltar".
2. Ao recuperar a rede (até 24 h), o app envia, e o resultado chega como nova mensagem no chat.
3. A distância é calculada com a localização do momento da foto, não do envio.

---

## 10. Inventário de telas

Todas as telas são do perfil `usuario` (o `admin` usa o Supabase Studio no MVP).

| # | Tela | Mostra | Ações (L = leitura, E = escrita) | Tabelas / funções |
|---|---|---|---|---|
| T1 | Boas-vindas | Logo OTCB, ilustração, aviso 18+, botão "Bora começar" | — (a sessão anônima já foi criada na abertura) | Supabase Auth (`signInAnonymously`) |
| T2 | Maioridade | Pergunta da data de nascimento | E: confirmar | — (cálculo no app); `otcb-apagar-conta` se menor |
| T3 | Apelido e time | Campos apelido e time do coração | E: salvar perfil | `otcb_perfis` |
| T4 | Permissão de localização | Explicação de uso da localização | E: permitir/agora não | — |
| T5 | Chat (principal) | Histórico, cards de resposta e de entrada, sugestões, campo de texto, botão câmera, atalhos para Passaporte e Perfil | L/E: enviar mensagem, preencher cards | `otcb-agente`, `otcb_mensagens`, `otcb_confirmar_bar`, `otcb_sugerir_bar`, `otcb-opinioes`, `otcb_denuncias` |
| T6 | Ficha do bar (bottom sheet) | Nome, bairro, endereço, status, etiquetas (balcão, passa jogo, clássico), nota média do colarinho, última confirmação, resumo das opiniões, opiniões | L; E: "Dar opinião" (abre card no chat), "Tem Brahma?" (card), "Denunciar"; navegação: "Como chegar", "Chamar Uber" | `otcb_detalhes_bar`, `otcb_opinioes` |
| T7 | Câmera do Colarinhômetro | Visor com guia de enquadramento; depois, card "É chopp Brahma?" | E: fotografar, responder | `otcb-colarinhometro` |
| T8 | Passaporte | Carimbos, coleções, selos | L | `otcb_meu_passaporte` |
| T9 | Perfil | Apelido, time, limpar conversa, termos, privacidade, aviso de moderação, aviso de que o passaporte fica no celular, apagar meus dados | E: editar perfil, limpar conversa, apagar meus dados | `otcb_perfis`, `otcb_mensagens`, `otcb-apagar-conta` |
| T10 | Bloqueio de menor | Mensagem de bloqueio | — | — |

O resultado do Colarinhômetro e todos os formulários aparecem como cards dentro de T5 (princípio 2).

---

## 11. Regras de negócio

### 11.1 Peso e decaimento das evidências — aplicada no banco (`otcb_recalcular_bar`)

Força de uma evidência hoje = `peso × 0,5 ^ (idade_em_dias / meia_vida_dias)`, onde `idade_em_dias = (now() − data_evidencia)` em dias.

| Tipo | Assunto | Sinal | Peso | Meia-vida (dias) | `data_evidencia` |
|---|---|---|---|---|---|
| `foto_colarinhometro` | `tem_brahma` | positivo | +1,0 | 90 | momento da foto |
| `confirmacao_usuario` | `tem_brahma` ou `transmite_jogos` | positivo | +0,6 | 60 | momento do toque |
| `confirmacao_usuario` | `tem_brahma` ou `transmite_jogos` | negativo | −0,6 | 60 | momento do toque |
| `confirmacao_usuario` | `funcionamento` | fechado | (regra 11.2) | — | momento do toque |
| `sugestao_usuario` | `tem_brahma` | positivo | +0,3 | 60 | momento da sugestão |
| `cardapio_site` | `tem_brahma` | positivo | +0,8 | 180 | data do conteúdo; se desconhecida, data da coleta − 90 dias |
| `cardapio_site` | `tem_brahma` | negativo (cita outra marca de chopp e não cita Brahma) | −0,5 | 180 | idem |
| `pagina_web` | `tem_brahma` ou `transmite_jogos` | positivo | +0,5 | 120 | data do conteúdo; se desconhecida, data da coleta − 90 dias |
| `avaliacao_google` | `tem_brahma` ou `transmite_jogos` | positivo | +0,4 | 365 | data da avaliação |
| `status_google` | `funcionamento` | fechado (CLOSED_PERMANENTLY) | (regra 11.2) | — | data da coleta |
| `status_google` | `funcionamento` | positivo (OPERATIONAL) | 0 (informativo) | — | data da coleta |
| `seed_otcb_antigo` | `tem_brahma` | positivo | +0,2 | 180 | data da importação |

Regras complementares:
- **Um voto por pessoa:** para cada bar e assunto, só a evidência **mais recente de cada usuário** entra na soma (vale para foto, confirmação e sugestão). Isso impede que uma pessoa infle o bar sozinha.
- `CLOSED_TEMPORARILY` do Google é ignorado.
- Pontuação do assunto = soma das forças das evidências válidas daquele assunto.

### 11.2 Status do bar — aplicada no banco (`otcb_recalcular_bar`)

Avaliado nesta ordem; a primeira condição verdadeira define o status:

| # | Condição | Status |
|---|---|---|
| 1 | Existe evidência `funcionamento/fechado` de `status_google` **ou** de 2 usuários distintos nos últimos 30 dias, **e** não existe evidência `tem_brahma` positiva de usuário (foto ou confirmação) mais recente que ela | `fechado` |
| 2 | Pontuação `tem_brahma` ≤ −0,5 | `sem_brahma` |
| 3 | Pontuação `tem_brahma` ≥ 1,0 | `confirmado` |
| 4 | Pontuação `tem_brahma` ≥ 0,5 | `provavel` |
| 5 | Qualquer outro caso | `incerto` |

#### 11.2.1 Casos de teste obrigatórios

| Caso | Evidências | Status esperado |
|---|---|---|
| A | Só a semente, hoje | `incerto` (0,2) |
| B | Semente com 200 dias | `incerto` (≈0,09) e **fora das buscas** (regra 11.9) |
| C | 1 foto positiva hoje | `confirmado` (1,0) |
| D | 1 foto positiva há 90 dias | `provavel` (0,5) |
| E | 1 cardápio positivo hoje + 1 confirmação negativa hoje | `incerto` (0,2) |
| F | 2 confirmações negativas de usuários distintos hoje | `sem_brahma` (−1,2) |
| G | 3 fotos positivas do **mesmo** usuário hoje | `confirmado` (1,0 — só a mais recente conta) |
| H | `status_google` fechado hoje + foto positiva de ontem | `fechado` |
| I | `status_google` fechado há 10 dias + foto positiva hoje | `confirmado` |
| J | 1 usuário diz "fechou" hoje | não muda por isso (precisa de 2) |

### 11.3 Transmite jogos — aplicada no banco

| Pontuação do assunto `transmite_jogos` | `otcb_bares.transmite_jogos` |
|---|---|
| ≥ 0,5 | `true` |
| ≤ −0,5 | `false` |
| entre −0,5 e 0,5 (exclusive) | `null` |

### 11.4 Foto válida, evidência e carimbo — aplicada no banco (`otcb_trg_foto_processa`)

| Condição | Nota | Evidência `tem_brahma` positiva | Carimbo |
|---|---|---|---|
| `e_chopp = false` | não | não | não |
| `e_chopp = true`, sem bar a até 150 m | sim | não | não |
| `e_chopp = true`, bar a até 150 m, `usuario_confirmou_brahma = false` | sim | não | não |
| `e_chopp = true`, bar a até 150 m, `usuario_confirmou_brahma = true` | sim | sim | sim, se: (a) o usuário ainda não tem carimbo nesse bar e (b) criou menos de 2 carimbos no dia (regra 11.12) |

- Distância medida entre a localização do momento da foto (enviada pelo app) e o bar mais próximo com status diferente de `fechado`.
- Fotos só pela câmera do app; o app não oferece galeria.
- O bar mais próximo é escolhido pela menor distância; empate é desfeito pelo maior `pontuacao_brahma`.

### 11.5 Nota do Colarinhômetro — aplicada na Edge Function `otcb-colarinhometro`

O modelo devolve quatro notas de 0 a 10 (contrato 13.5). A nota final é:

| Componente | Peso | O que avalia |
|---|---|---|
| `nota_altura` | 35% | Altura do colarinho; o ideal é cerca de dois dedos (≈ 2 a 3 cm). Sem colarinho ou colarinho ocupando metade do copo tira nota baixa. |
| `nota_cremosidade` | 25% | Espuma fina e densa vale mais que bolhas grandes. |
| `nota_copo` | 20% | Copo limpo, apropriado para chopp, sem espuma escorrendo. |
| `nota_gelado` | 20% | Sinais visuais de chopp gelado (copo suado, espuma firme). |

`nota_colarinho = arredondar(0,35·altura + 0,25·cremosidade + 0,20·copo + 0,20·gelado, 1 casa)`.

`nota_colarinho_media` do bar = média simples das `nota_colarinho` não nulas das fotos não excluídas do bar.

### 11.6 Limites de uso — aplicados no servidor (Edge Functions e funções SQL)

| Ação | Limite | Janela |
|---|---|---|
| Mensagens ao agente | 40 | por dia |
| Fotos ao Colarinhômetro | 10 | por dia |
| Carimbos novos | 2 | por dia |
| Confirmação (mesmo bar e assunto) | 1 | por dia |
| Sugestão de bar | 5 | por dia |
| Opinião | 1 por bar (editável) | sempre |
| Edição de opinião | 5 | por dia |
| Denúncia | 1 por opinião | sempre |

### 11.7 Apelido, opinião e moderação

| Item | Regra | Onde |
|---|---|---|
| Apelido | 3 a 20 caracteres, `^[A-Za-z0-9_.]+$`, único sem diferenciar maiúsculas | banco (check + índice único em `lower(apelido)`) |
| Texto da opinião | 10 a 500 caracteres | banco (check) e app |
| Nota da opinião | 1 a 5 ou vazia | banco (check) |
| Moderação | Recusa: ofensa pessoal ou a funcionário identificável, discurso de ódio, dado pessoal de terceiro (telefone, e-mail, nome completo), incentivo a consumo excessivo, propaganda/spam. Primeiro uma lista de termos proibidos (determinística), depois `claude-haiku-5-5` | Edge Function `otcb-opinioes` |
| Falha do modelo na moderação | A opinião **não** é publicada; o card mostra copy 15.9 | Edge Function |
| Denúncias | 3 denúncias de usuários distintos → `status = 'oculta_denuncias'` | banco (trigger) |
| Reexibir | Só `admin`, pelo Studio | — |

### 11.8 Resumo das opiniões — aplicada no garimpo (modo `resumos`)

- Gerado quando o bar tem 3 ou mais opiniões publicadas **e** (não tem resumo **ou** recebeu 3 opiniões novas desde `resumo_atualizado_em` **ou** o resumo tem mais de 30 dias).
- Até 400 caracteres, em pt-BR, sem citar apelidos, sem inventar o que não está nas opiniões.
- Se as opiniões publicadas caírem abaixo de 3, `resumo_opinioes` volta a nulo.

### 11.9 Busca de bares — aplicada no banco (`otcb_buscar_bares`)

| Parâmetro | Regra |
|---|---|
| Visibilidade | Só `excluido_em is null`, status `confirmado`, `provavel` ou `incerto`, e `pontuacao_brahma ≥ 0,1` |
| Raio | 2 km quando há localização e o usuário não pediu outro; máximo 10 km |
| Sem localização | Exige bairro ou endereço; o agente pergunta |
| Filtros | texto (nome ou bairro, sem acento e sem diferenciar maiúsculas), `tem_balcao`, `transmite_jogos`, `classico` |
| Ordenação | status (`confirmado` > `provavel` > `incerto`), depois distância |
| Limite | 8 por resposta |
| Etiqueta | `incerto` sempre exibido como "a confirmar" |

### 11.10 Coordenadas e dados do Google — aplicada no garimpo

- Guardamos `google_place_id` sem prazo.
- Coordenadas vindas do Google são renovadas quando `coordenadas_atualizadas_em` passa de 25 dias (margem sobre o limite de 30 dias, premissa P3).
- Avaliações do Google não são exibidas no app; viram só evidência com `trecho` curto (até 300 caracteres) e `url_fonte`.

### 11.11 Passaporte: coleções e selos — aplicada no banco (`otcb_meu_passaporte`)

| Item | Regra |
|---|---|
| Carimbo | 1 por bar (regra 11.4) |
| Coleção do bairro | Para cada bairro com bares ativos, progresso = carimbos no bairro / bares ativos `confirmado` ou `provavel` no bairro. "Bairro conquistado" ao atingir 3 carimbos ou todos os bares ativos, o que for menor. |
| Coleção Clássicos | Progresso = carimbos em bares `classico = true` / total de bares `classico = true` ativos |
| Selo "Primeira tirada" | 1º carimbo |
| Selo "Explorador" | 5, 15 e 30 bares distintos (três níveis) |
| Selo "Andarilho" | Carimbos em 5 bairros diferentes |
| Selo "Olho clínico" | 5 fotos com `nota_colarinho ≥ 9,0` em bares diferentes |
| Selo "Informante" | 10 confirmações ou sugestões que ajudaram (evidência do usuário em bar que hoje é `confirmado` ou `provavel`) |

Nenhum selo conta quantidade de chopp, fotos no mesmo bar ou noites seguidas (princípio 3).

### 11.12 Fuso e virada de dia

"Dia" = dia civil em `America/Sao_Paulo`. Limites diários (11.6) e carimbos por dia (11.4) zeram à meia-noite de São Paulo.

### 11.13 Contexto do agente — aplicada em `otcb-agente`

- Contexto enviado ao modelo: as últimas 20 mensagens do usuário (inclusive `sistema`) das últimas 6 horas.
- Ações feitas por card gravam uma mensagem `sistema` curta, por exemplo: "Usuário confirmou que o Bar do Nico tem Brahma."
- O perfil enviado ao modelo é só apelido e time do coração.
- Localização: enviada a cada mensagem pelo app quando permitida; não é gravada em `otcb_mensagens`.

### 11.14 Retenção

| Dado | Retenção |
|---|---|
| Mensagens do chat | 30 dias |
| Fotos | até o usuário apagar a foto ou usar "Apagar meus dados" |
| Jogos | 2 dias após o início |
| Evidências | sem prazo (de usuário, anonimizadas na exclusão da conta) |

### 11.15 Bairros do garimpo de descoberta

Lista inicial (configurável em `supabase/functions/otcb-garimpo/bairros.ts`): todos os bairros do CSV antigo (Pinheiros, Itaim, Vila Madalena, Centro, Moema, Pompeia, Vila Olímpia, Vila da Saúde, Aclimação, Ipiranga, Brooklin Novo, Vila Mariana, Barra Funda, Jardim Paulista, Vila Baruel, Vila Leopoldina, Higienópolis) mais Bela Vista, Consolação, Perdizes, Lapa, Butantã, Santana, Tatuapé, Mooca, Liberdade, Santa Cecília, República, Campo Belo, Saúde, Jabaquara, Penha e Vila Prudente.

### 11.16 Casamento de candidato com bar existente — aplicada no garimpo e em `otcb_sugerir_bar`

1. Mesmo `google_place_id` → mesmo bar.
2. Sem `place_id`: distância ≤ 80 m **e** nomes parecidos (similaridade de trigramas ≥ 0,5, comparando sem acento e sem prefixos "bar", "boteco", "restaurante") → mesmo bar.
3. Caso contrário → bar novo, status `incerto`.

### 11.17 Tetos de custo do garimpo — aplicada no garimpo

| Recurso | Teto por execução | Teto por mês |
|---|---|---|
| Google Text Search (Pro) | 150 chamadas | 3.000 |
| Google Place Details com `reviews` (Enterprise + Atmosphere) | 30 chamadas | 600 |
| Google Place Details só `location`/`businessStatus` | 300 chamadas | 6.000 |
| Firecrawl (search + scrape) | 200 créditos | 4.000 |
| Classificações com IA | 300 | 6.000 |

Ao bater o teto, a execução para, registra em `erros` e termina como `concluida`. Os tetos mensais ficam numa constante revisável.

### 11.18 Guardrail determinístico do chat — aplicada em `otcb-agente`, antes do modelo

| Detecção (lista de padrões em `guardrails.ts`, sem acento, sem diferenciar maiúsculas) | Resposta fixa |
|---|---|
| Menção a dirigir depois de beber ("vou dirigir", "volto de carro", "dirigir depois") | Copy 15.11a |
| Menção a idade abaixo de 18 ("tenho 16", "sou menor") | Copy 15.11b, e a conta é sinalizada para revisão do admin |
| Desafio ou meta de quantidade ("quantos chopps pra ficar bêbado", "virar", "desafio", "porre") | Copy 15.11c |
| Pedido de comprar bebida ou delivery | Copy 15.11d |

Além disso, o prompt de sistema do agente proíbe: incentivar quantidade, sugerir maratona de bares, afirmar que bar `incerto` tem Brahma, inventar bar ou informação fora das ferramentas, e falar em nome da Ambev.

### 11.19 O que NÃO é automático

- `classico` é marcado à mão pelo admin.
- Mesclar bares duplicados que o casamento (11.16) não pegou é tarefa manual do admin.
- Reexibir opinião oculta é manual.
- Não existe nota geral "do bar" calculada: o app mostra separadamente a média do colarinho e a média das opiniões.

---

## 12. Máquinas de estado e tratamento de erro

### 12.1 Status do bar
Não há transição manual: o status é sempre resultado de `otcb_recalcular_bar` (regra 11.2), executado a cada evidência nova e diariamente. Qualquer status pode ir para qualquer outro. Bar `fechado` volta a ser avaliado normalmente se surgir foto ou confirmação positiva mais recente que o fechamento.

### 12.2 Opinião
```
(novo) ──moderação ok──▶ publicada ──3 denúncias──▶ oculta_denuncias
   │                        │  ▲                       │
   │                        │  └──── admin reexibe ────┘
   └─moderação recusa─▶ (não gravada)   publicada ──admin oculta──▶ oculta_admin
```
`oculta_moderacao` existe para quando uma edição de opinião já publicada é recusada: a versão anterior é ocultada até o usuário editar de novo com sucesso.

### 12.3 Execução do garimpo
`em_andamento` → `concluida` (fim normal ou teto atingido) | `falhou` (erro que impede continuar, como chave inválida). Execução `em_andamento` há mais de 2 horas é marcada como `falhou` pela próxima execução do mesmo tipo.

### 12.4 Envio de foto (no app)
`capturada` → `na_fila` (sem rede) → `enviando` → `avaliada` | `erro`. Estado só local (não há tabela). Na fila por mais de 24 h → descartada com aviso.

### 12.5 Tratamento de erro por dependência

| Falha | Comportamento |
|---|---|
| Claude API indisponível no chat | Copy 15.9; mensagem fica com "tentar de novo"; cards de entrada continuam funcionando |
| Claude API indisponível no Colarinhômetro | Foto guardada; card diz que a nota sai em instantes; reprocesso automático em até 3 tentativas com intervalo de 1 min; depois copy 15.9 |
| Claude API indisponível na moderação | Opinião não publicada (regra 11.7) |
| Google ou Firecrawl indisponível no garimpo | Item registrado em `erros`; lote continua |
| football-data.org indisponível | Mantém os jogos já gravados; o agente diz que não conseguiu atualizar os jogos |
| Resposta da IA fora do contrato JSON | Uma nova tentativa; persistindo, trata como indisponível |

---

## 13. Contratos de API e tipos

Todas as Edge Functions chamadas pelo app exigem JWT do Supabase Auth (`Authorization: Bearer <token>`). Credencial de serviço e chaves de API existem só dentro das funções.

### 13.1 `POST /functions/v1/otcb-agente`

Entrada:
```json
{ "mensagem": "string, 1 a 1000 caracteres", "latitude": -23.56, "longitude": -46.69 }
```
`latitude` e `longitude` são opcionais (ausentes quando o usuário não permitiu localização).

Saída 200:
```json
{ "mensagem_id": "uuid", "texto": "string", "blocos": [ /* seção 13.2 */ ] }
```
Erros: `401` sem sessão; `422` mensagem inválida; `429` limite diário (`{"codigo":"limite_mensagens"}`); `503` modelo indisponível (`{"codigo":"ia_indisponivel"}`).

Comportamento: aplica 11.18 → 11.6 → monta contexto (11.13) → chama `claude-sonnet-5-5` com as ferramentas de 13.3 (no máximo 5 rodadas de ferramenta por mensagem) → valida os blocos contra o esquema 13.2 (blocos inválidos são descartados, o texto é mantido) → grava a mensagem do usuário e a resposta em `otcb_mensagens`.

### 13.2 Blocos (cards) da resposta

```ts
type CardBar = {
  bar_id: string; nome: string; bairro: string; endereco: string;
  latitude: number; longitude: number;
  distancia_metros: number | null;
  status: 'confirmado' | 'provavel' | 'incerto';
  tem_balcao: boolean | null; transmite_jogos: boolean | null; classico: boolean;
  nota_colarinho_media: number | null; nota_opinioes_media: number | null;
  qtd_opinioes: number;
  ultima_confirmacao_em: string | null;      // ISO; foto ou confirmação positiva mais recente
  confirmacoes_60_dias: number;               // pessoas distintas
  resumo_opinioes: string | null;
};

type Bloco =
  | { tipo: 'lista_bares'; titulo: string; bares: CardBar[] }                  // até 8
  | { tipo: 'card_bar'; bar: CardBar }
  | { tipo: 'mapa'; pontos: Pick<CardBar,'bar_id'|'nome'|'latitude'|'longitude'|'status'>[] }
  | { tipo: 'jogos'; jogos: { jogo_id: string; competicao: string; mandante: string; visitante: string; inicio: string }[] }
  | { tipo: 'passaporte'; total_carimbos: number; bairros_conquistados: number; ultimo_selo: string | null }
  | { tipo: 'acao'; acao: 'abrir_camera' | 'abrir_rota' | 'chamar_uber' | 'abrir_ficha' | 'abrir_passaporte'; bar_id?: string; rotulo: string }
  | { tipo: 'pergunta_confirmacao'; bar_id: string; nome_bar: string;
      assunto: 'tem_brahma' | 'transmite_jogos' | 'funcionamento'; pergunta: string }
  | { tipo: 'formulario_opiniao'; bar_id: string; nome_bar: string;
      texto_atual: string | null; nota_atual: number | null }
  | { tipo: 'formulario_sugestao_bar'; nome: string | null; endereco: string | null; bairro: string | null;
      usar_localizacao_atual: boolean }   // true quando o usuário disse que está no bar
  | { tipo: 'formulario_denuncia'; opiniao_id: string }
  | { tipo: 'resultado_colarinho'; foto_id: string; nome_bar: string | null; nota_colarinho: number;
      nota_altura: number; nota_cremosidade: number; nota_copo: number; nota_gelado: number;
      comentario_ia: string | null; carimbo_novo: boolean; motivo_sem_carimbo: string | null };
```

Os nomes dos campos espelham o banco (fronteira de idioma na camada de dados). `chamar_uber` abre `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=…&dropoff[longitude]=…`; `abrir_rota` abre o app de mapas padrão do sistema.

### 13.3 Ferramentas do agente

| Ferramenta | Entrada | Executa | Devolve ao modelo |
|---|---|---|---|
| `buscar_bares` | `texto?`, `bairro?`, `latitude?`, `longitude?`, `raio_metros?`, `tem_balcao?`, `transmite_jogos?`, `classico?` | `otcb_buscar_bares` (com o JWT do usuário) | lista de `CardBar` |
| `detalhes_bar` | `bar_id` | `otcb_detalhes_bar` | `CardBar` |
| `opinioes_do_bar` | `bar_id`, `pagina?` | select em `otcb_opinioes` publicadas | até 10 opiniões (apelido, nota, texto, data) |
| `jogos_de_hoje` | `time?`, `dias_a_frente?` (0–7) | select em `otcb_jogos` | lista de jogos |
| `meu_passaporte` | — | `otcb_meu_passaporte` | resumo |
| `oferecer_card` | `tipo` (um dos blocos de entrada de 13.2) e campos pré-preenchidos | nada no banco | eco; o bloco vai para a resposta |
| `mostrar` | blocos de exibição (`lista_bares`, `card_bar`, `mapa`, `jogos`, `passaporte`, `acao`) | nada no banco | eco; os blocos vão para a resposta |

O agente **não** tem ferramenta que grava dado: toda escrita do usuário passa por card (épico 8.5).

### 13.4 Funções SQL chamadas pelo app (RPC)

| Função | Entrada | Saída | Erros |
|---|---|---|---|
| `otcb_confirmar_bar` | `p_bar_id uuid`, `p_assunto otcb_assunto_evidencia`, `p_sinal otcb_sinal_evidencia` | `{ ok: true }` | `limite_confirmacao`, `bar_inexistente`, `sinal_invalido` |
| `otcb_sugerir_bar` | `p_nome`, `p_endereco`, `p_bairro`, `p_latitude`, `p_longitude`, `p_tem_brahma boolean` | `{ bar_id, criado: boolean }` | `limite_sugestao`, `dados_invalidos` |
| `otcb_detalhes_bar` | `p_bar_id` | `CardBar` | `bar_inexistente` |
| `otcb_meu_passaporte` | — | `{ carimbos[], colecoes_bairro[], colecao_classicos, selos[] }` | — |

Latitude e longitude de `otcb_sugerir_bar` são obtidas pelo app no momento do envio do card: a localização atual quando `usar_localizacao_atual = true`, ou a geocodificação do endereço pelo geocodificador do próprio aparelho (`expo-location`, `geocodeAsync`). Se a geocodificação falhar, o card pede para conferir o endereço.

### 13.5 `POST /functions/v1/otcb-colarinhometro`

Entrada (multipart): `imagem` (JPEG ≤ 1 MB), `latitude`, `longitude`, `capturada_em` (ISO), `confirmou_brahma` (`sim` | `nao` | `nao_sei`; `nao_sei` grava `usuario_confirmou_brahma = false`).

Contrato com o modelo de visão (`claude-haiku-5-5`), resposta obrigatoriamente em JSON:
```json
{ "e_chopp": true, "nota_altura": 8.5, "nota_cremosidade": 7.0, "nota_copo": 9.0, "nota_gelado": 8.0,
  "comentario": "até 120 caracteres, bem-humorado, sem incentivar quantidade",
  "pessoa_identificavel": false }
```
Saída 200: bloco `resultado_colarinho` (13.2). Erros: `413` imagem grande; `422` não é chopp (`{"codigo":"nao_e_chopp"}`); `429` (`limite_fotos`); `503` IA indisponível.

`pessoa_identificavel` não muda nada no MVP (as fotos não são públicas); é gravado para orientar a v2 de fotos públicas.

### 13.6 `otcb-garimpo` (chamada só pelo `pg_cron`, com segredo próprio no cabeçalho `x-otcb-cron`)

Entrada: `{ "modo": "descoberta" | "revisita" | "coordenadas" | "resumos", "execucao_id?": "uuid" }`.

Contrato de classificação de texto (`claude-haiku-5-5`):
```json
{ "nome_bar": "string", "menciona_chopp_brahma": "sim" | "nao" | "incerto",
  "cita_outra_marca_de_chopp": true, "transmite_jogos": "sim" | "nao" | "incerto",
  "data_conteudo": "AAAA-MM-DD" | null, "trecho": "até 300 caracteres copiados da fonte" }
```
Mapeamento: `sim` → evidência positiva; `nao` com `cita_outra_marca_de_chopp = true` em cardápio → negativa; `incerto` → nenhuma evidência.

### 13.7 `POST /functions/v1/otcb-opinioes`
Entrada: `{ "bar_id": "uuid", "texto": "string", "nota": 1-5 | null }`. Saída 200: `{ "opiniao_id": "uuid", "status": "publicada" }`. Erros: `422 {"codigo":"recusada_moderacao"}`; `429 {"codigo":"limite_edicao"}`; `503`.

### 13.8 `POST /functions/v1/otcb-apagar-conta`
Sem corpo. Executa a exclusão da seção 8.10 com credencial de serviço, nesta ordem: arquivos do bucket → anonimiza evidências → apaga `otcb_perfis` (cascata) → apaga o usuário de `auth.users`. Saída 200 `{ "ok": true }`.

### 13.9 `otcb-jogos` (só `pg_cron`)
Busca no football-data.org os jogos dos próximos 7 dias das competições disponíveis no plano (premissa P2) e faz upsert por `id_externo`.

---

## 14. Relatórios, exportação e importação

### 14.1 Importação do CSV antigo (semente, uma vez)

Arquivo: `supabase/seed/estabelecimentos_otcb_antigo.csv` (cópia do `Estabelecimentos.csv` exportado do Glide), UTF-8, separador vírgula, campos com quebra de linha entre aspas.

| Coluna do CSV | Uso |
|---|---|
| `Nome` | `nome` (aparar espaços) |
| `Endereço` | texto de busca no Google Text Search (`"{Nome} {Endereço} São Paulo"`) |
| `Bairro` | `bairro` (aparar espaços); substituído pelo bairro do Google se divergir |
| `TemBalcao` | `true` → `true`; vazio → `null` |
| `NomeComEmoji`, `LinkMaps`, `Bora tomar um chopp`, `MediaNotas`, `Endereço Formatado`, `Foto`, `Texto para PDF`, `Chave PDF` | ignoradas |

Regras: linha com `Nome` vazio é ignorada; candidato sem resultado no Google é registrado no relatório do script e não é importado; `CLOSED_PERMANENTLY` não é importado; duplicados por `google_place_id` viram 1 bar. Cada bar importado recebe evidência `seed_otcb_antigo`. O script imprime o resumo: lidas, importadas, duplicadas, sem correspondência, fechadas.

### 14.2 Exportação
Não há exportação no MVP.

---

## 15. Copy e tom de voz

Tom: amigo de boteco que entende de chopp. Bem-humorado, direto, frases curtas, gírias leves de SP ("bora", "tirada", "colarinho"), nunca vulgar e nunca incentivando beber mais. Trata por "você". Os textos abaixo são finais, não placeholders.

| # | Onde | Texto |
|---|---|---|
| 15.1 | Boas-vindas | Título: "Onde tem chopp bem tirado?" · Subtítulo: "Pergunta pra gente. A gente garimpa os bares de SP pra você." · Rodapé: "Proibido para menores de 18 anos." |
| 15.2 | Bloqueio de menor | "Aqui é só pra maiores de 18. Volta daqui a pouco, que o chopp espera." |
| 15.3 | Pedido de localização | "Pra achar o chopp mais perto, a gente usa sua localização só na hora da pergunta ou da foto. Não guardamos por onde você anda." |
| 15.4 | Sugestões iniciais do chat | "Chopp perto de mim" · "Onde ver o jogo hoje?" · "Bar com balcão em Pinheiros" · "Meu Passaporte" |
| 15.5 | Passaporte vazio | "Seu passaporte tá em branco. Tira a foto do próximo chopp e ganha o primeiro carimbo." |
| 15.6 | Colarinhômetro — não é chopp | "Hmm, isso não parece um chopp. Tenta de novo com o copo bem no meio da foto." |
| 15.7 | Opinião recusada | "Não deu pra publicar essa opinião. Tenta reescrever sem ofensas nem dados pessoais." |
| 15.8 | Limites | Mensagens: "Por hoje deu de conversa. Amanhã tem mais." · Carimbo: "Já foram 2 carimbos hoje. A nota ficou registrada; o carimbo deste bar te espera outro dia." · Confirmação: "Você já contou isso hoje. Valeu!" |
| 15.9 | Erros | Sem rede: "Sem sinal por aqui. Tenta de novo quando a rede voltar." · IA fora: "Deu um branco aqui do nosso lado. Tenta de novo em instantes." · Primeira abertura sem rede: "Pra começar a gente precisa de internet. Tenta de novo quando tiver sinal." |
| 15.10 | Loja | Nome: "OTCB" · Subtítulo: "Chopp bem tirado em SP" · Descrição: começa com "Pergunta onde tem chopp bem tirado e o OTCB responde." e lista: busca por conversa, Colarinhômetro, Passaporte, onde ver o jogo, opiniões. Termina com "Beba com moderação. Proibido para menores de 18 anos." Sem a palavra Brahma. |
| 15.11a | Guardrail dirigir | "Se for dirigir, nem um copinho. Quer que eu mostre o botão do Uber junto com os bares?" |
| 15.11b | Guardrail menor | "O OTCB é só para maiores de 18 anos." |
| 15.11c | Guardrail quantidade | "Aqui a graça é a tirada, não a quantidade. Quer saber onde tem o colarinho mais bem avaliado?" |
| 15.11d | Guardrail compra | "A gente não vende nem entrega bebida. Posso te mostrar bares perto de você." |
| 15.12 | Rodapé fixo do Perfil | "Beba com moderação. Se beber, não dirija." |
| 15.13 | Campo do chat | "Pergunta onde tem chopp…" |
| 15.14 | Botão da tela Apelido | "Bora" |
| 15.15 | Dica da Câmera | "Copo no meio, colarinho à vista" |
| 15.16 | Ficha sem opiniões | "Ninguém opinou ainda. Seja o primeiro." |
| 15.17 | Opinião própria oculta | "Sua opinião está oculta." |
| 15.18 | Sugestão que já existia | "Esse bar já estava aqui — sua confirmação foi registrada." |
| 15.19 | Botão da Boas-vindas | "Bora começar" |
| 15.20 | Aviso fixo do Perfil | "Seu passaporte fica neste celular. Se reinstalar o app ou trocar de aparelho, ele não volta." |
| 15.21 | Confirmação de "Apagar meus dados" | Etapa 1: "Isso apaga seu apelido, fotos, carimbos, opiniões e conversa. Não dá pra desfazer." · Etapa 2: "Apagar tudo" |

---

## 16. Direção visual / design system

**Objetivo:** cara de boteco paulistano com alma de app de jogo. Divertido e caloroso, nunca sério nem corporativo, e também nunca infantil.

### 16.1 Referências
| Referência | O que tirar dela |
|---|---|
| **Duolingo** | Formas arredondadas, botões "gordinhos" com sombra sólida embaixo (efeito de botão de jogo), texto em peso forte, cores chapadas, mascote como voz do produto e celebrações (confete, carimbo pulando) quando o usuário conquista algo. |
| **Bar Ovo, Estúdio Sarau (SP)** | Identidade de boteco retrô despretensioso, com letreiro "escrito à mão" e expressões locais nos textos. |
| **Boteco da Mario, 268 Estúdio** | Selo informal como elemento gráfico, a rua como parte da experiência. |
| **Vernáculo de boteco** | Azulejo português, copo americano, toalha xadrez, comanda e guardanapo de papel, letreiro pintado à mão, bolacha de chopp. |

### 16.2 Paleta
Sem vermelho como cor principal (evita associação com a identidade visual da marca de cerveja).

| Papel | Cor | Uso |
|---|---|---|
| Marca — âmbar | `#F2A900` | botão principal, destaques, mascote |
| Marca — colarinho | `#FFF6E3` | fundo claro, cards |
| Marca — verde-garrafa | `#1F6F5C` | elementos secundários, cabeçalhos |
| Marca — azul-azulejo | `#2B59C3` | padrões decorativos e links |
| Tinta | `#22201C` | texto principal; fundo do modo escuro |

| Semântica (só significado) | Cor |
|---|---|
| Confirmado | `#2E8B57` |
| Provável | `#6B7FD7` |
| A confirmar | `#8A8578` |
| Erro | `#D64545` |

### 16.3 Tipografia
- Títulos e números grandes: fonte sem serifa arredondada e encorpada (sugestão: Baloo 2 ExtraBold ou equivalente gratuita).
- Texto: sem serifa arredondada legível (sugestão: Nunito), peso mínimo 500.
- Acento "letreiro pintado à mão" só em títulos especiais (Passaporte, carimbos, selos).

### 16.4 Componentes-chave
- **Bolhas do chat** arredondadas; o assistente fala com o mascote ao lado.
- **Mascote:** a **Bolacha**, uma bolacha de chopp com rosto simples. Aparece no chat, nos estados vazios, de erro e nas celebrações. Original, sem semelhança com mascotes existentes.
- **Card de bar** como uma comanda: nome em destaque, etiquetas em pílula ("confirmado", "passa jogo", "balcão", "clássico"), nota do colarinho com ícone de copo.
- **Resultado do Colarinhômetro** como um guardanapo de papel com a nota grande escrita à mão e as quatro notas parciais em barrinhas.
- **Carimbos do Passaporte** como carimbo de borracha levemente torto, com tinta falhada.
- **Cards de entrada** com o mesmo visual dos cards do chat, botão principal âmbar com sombra sólida e estado "registrado" com check verde.
- **Padrão de azulejo** como textura discreta em fundos de telas vazias e da Boas-vindas.
- **Celebração:** carimbo batendo na tela com leve tremida e confete âmbar quando sai carimbo ou selo.

### 16.5 Modo escuro
Obrigatório e seguindo o sistema. Fundo tinta `#22201C`, cards em marrom-escuro, âmbar mantido. O app é usado de noite dentro do bar.

### 16.6 Microanimações

Animações curtas que dão vida ao app sem atrapalhar o uso. Todas feitas com `react-native-reanimated` (já incluído no Expo) e, para o mascote, arquivos Lottie (`lottie-react-native`). Nenhuma passa de 1,2 s nem bloqueia o toque seguinte. Com "reduzir movimento" ligado no sistema, todas viram transição simples de opacidade (≤ 200 ms).

| # | Momento | Animação | Duração |
|---|---|---|---|
| A1 | Agente "digitando" | Três bolhas de espuma subindo dentro de um copinho, em loop | loop |
| A2 | Mensagem e card chegando | Entra de baixo com leve mola (spring) | ~300 ms |
| A3 | Botão principal tocado | Botão afunda na sombra sólida e volta (efeito botão de jogo) | ~120 ms |
| A4 | Enviando foto ao Colarinhômetro | Copo enchendo de chopp até formar o colarinho | até a resposta |
| A5 | Nota do Colarinhômetro | Número sobe de 0 até a nota; barrinhas das notas parciais crescem em sequência | ~900 ms |
| A6 | Carimbo novo | Carimbo desce, "bate" com leve tremida da tela e respingo de tinta; confete âmbar | ~1,2 s |
| A7 | Selo novo | Selo gira de lado e pousa, com brilho | ~1 s |
| A8 | Card de entrada registrado | Botão vira check verde com pequeno "pop" | ~400 ms |
| A9 | Mascote Bolacha | Piscar ocasional no chat; rosto triste em erro; comemoração em carimbo e selo (Lottie) | variável |
| A10 | Abrir Ficha do bar | Bottom sheet sobe com mola | ~300 ms |
| A11 | Puxar para atualizar no Passaporte | Bolacha girando | loop curto |

Também há feedback tátil (`expo-haptics`): leve em A3 e A8, médio em A6 e A7.

### 16.7 Livre para o design decidir
Ilustrações, a expressão exata do mascote, ícones, microanimações, a fonte final dentro das características de 16.3, desde que respeitem paleta, semântica e acessibilidade (seção 17).

---

## 17. Requisitos não-funcionais

| Item | Alvo |
|---|---|
| Abertura a frio | ≤ 2,5 s em Android intermediário (ex.: Galaxy A35) |
| Resposta do agente | p95 ≤ 8 s em 4G |
| Colarinhômetro | p95 ≤ 6 s em 4G (foto de até 1 MB) |
| Card de entrada gravando | ≤ 1 s com rede boa |
| Offline | Histórico do chat legível; foto em fila por até 24 h; demais ações pedem rede |
| Plataformas | Mínimos suportados pelo Expo SDK 58 em iOS e Android |
| Acessibilidade | Tamanho de fonte do sistema respeitado; contraste AA; área de toque ≥ 44 pt; rótulos de leitor de tela em cards, botões e carimbos; animações respeitam "reduzir movimento" |
| Idioma | pt-BR apenas |
| Volume esperado | até 5.000 bares e 10.000 usuários no primeiro ano |
| Bateria e dados | Localização só no momento da pergunta ou da foto, nunca em segundo plano |
| Tamanho | Fotos redimensionadas antes do envio (≤ 1 MB) |

---

## 18. Convenções de código, documentação e estrutura do repositório

- **Idioma:** banco (tabelas, colunas, enums, funções, triggers, políticas) em português, `snake_case`, prefixo `otcb_`. Código, variáveis, componentes e nomes de arquivo em inglês. Os tipos que espelham o banco (`src/types/database.ts`, gerado pela CLI) e os contratos da seção 13 mantêm os nomes em português.
- **Comentários obrigatórios:** toda função, hook, componente com lógica, Edge Function, função SQL, trigger e política tem comentário de cabeçalho em português dizendo o que faz, o que recebe, o que devolve e a regra do spec que implementa (ex.: `-- Implementa a regra 11.2 (status do bar)`). Lógica não óbvia leva comentário inline com a regra.
- **Pastas:**
```
app/                      # rotas do Expo Router (telas T1–T10)
src/features/
  auth/  chat/  cards/  colarinhometro/  passaporte/  bares/  perfil/
src/components/           # componentes visuais compartilhados (design system)
src/lib/                  # cliente Supabase, localização, fila de fotos, telemetria
src/types/database.ts     # gerado
supabase/migrations/
supabase/functions/
  otcb-agente/  otcb-colarinhometro/  otcb-opinioes/
  otcb-garimpo/  otcb-jogos/  otcb-apagar-conta/  _shared/
supabase/tests/           # pgTAP
supabase/seed/
scripts/import-seed.ts
store/                    # textos e prints das lojas
plans/
```
- **Documentação viva:** `supabase/schema.sql` gerado do banco real a cada migration; `README.md` com setup local, variáveis e como aplicar migrations e publicar funções; `DOCUMENTACAO-TECNICA.md` (seção 19).
- **`CLAUDE.md` na raiz:** convenções acima, mapa da arquitetura, comandos de verificação com exemplo de saída saudável, pegadinhas (ex.: "nunca use galeria no Colarinhômetro", "Brahma não entra em `store/`", "status do bar nunca é escrito à mão", "o banco é compartilhado e tem login anônimo: toda política usa `auth.uid()` e nunca se toca em objeto fora de `otcb_`"). Cabe em uma página. Quando o agente errar a mesma coisa duas vezes, a correção entra em "Pegadinhas". Atualizado no mesmo commit da mudança.
- **Variáveis de ambiente:**

| Variável | Onde | Pública? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | app | sim |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | app | sim (chave publicável) |
| `GOOGLE_MAPS_ANDROID_KEY` | build (EAS secret), restrita ao app | embutida no app, restrita por pacote |
| `ANTHROPIC_API_KEY` | Edge Functions | **secreta** |
| `GOOGLE_PLACES_API_KEY` | Edge Functions | **secreta** |
| `FIRECRAWL_API_KEY` | Edge Functions | **secreta** |
| `FOOTBALL_DATA_KEY` | Edge Functions | **secreta** |
| `OTCB_CRON_SECRET` | Edge Functions e `pg_cron` | **secreta** |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions e `scripts/` | **secreta** |
| `VISAO_PRODUTO_*` | app | a definir (pergunta aberta 25.2) |

### 18.1 Guardrails executáveis

| Regra | Seção de origem | Mecanismo |
|---|---|---|
| Credencial privilegiada e chaves de API nunca em código do app | 20 | Hook `guard-secrets.sh` |
| Migration commitada não se edita | 7.6 | Hook `guard-migrations.sh` |
| Teste não se edita durante correção de bug | 22.1 | Hook `guard-tests.sh` |
| Advisors após migration | 20 | Hook `remind-advisors.sh` |
| "Brahma" nunca nos textos da loja nem no nome do app | Nota sobre a marca, 8.11 | Hook `guard-store-brand.sh` |
| Colarinhômetro sem galeria | 11.4 | Hook `guard-gallery.sh` (bloqueia `launchImageLibraryAsync` em `src/features/colarinhometro/`) |
| Critérios de aceite, matriz de permissões, regras de negócio | 5, 8, 11 | Subagente `verifier` + `REVIEW.md` |
| Convenções de idioma e comentários | 18 | `CLAUDE.md` + `REVIEW.md` |

Conteúdo dos arquivos no Anexo B.

---

## 19. Documento de documentação técnica (entregável ao fim da implementação)

Ao terminar, o agente gera `DOCUMENTACAO-TECNICA.md` na raiz, em português, descrevendo o sistema **como ficou**:
1. Modelo de dados explicado em português (cada tabela, coluna e valor de enum em linguagem de negócio).
2. Relacionamento entre tabelas, com diagrama em texto e a cardinalidade explicada.
3. Regras de negócio no banco: todas as funções, triggers, políticas e jobs do `pg_cron`, com nome exato, onde atuam, quando disparam e o que fazem.
4. Mapa tela → tabelas/funções (T1–T10 e cada card).
5. Lógica das funcionalidades por tela e por Edge Function: validação, gravação, cálculo e onde acontece, e o que o usuário vê em erro.
6. Divergências em relação ao spec, com o motivo.

Toda mudança de schema, função, política, Edge Function ou lógica de tela atualiza este documento no mesmo commit.

---

## 20. Privacidade, segurança e conformidade

| Dado | Por quê | Onde | Quem acessa | Retenção |
|---|---|---|---|---|
| ID anônimo do aparelho | Contar uso e limites, ligar Passaporte e opiniões à mesma pessoa | Supabase Auth | sistema | até "Apagar meus dados" (ou para sempre órfão se o app for desinstalado; ver 24.13) |
| Apelido, time do coração | Exibição e personalização | `otcb_perfis` | apelido: público nas opiniões; resto: o próprio | até "Apagar meus dados" |
| Confirmação de maioridade (instante) | Exigência de loja e cuidado com menores | `otcb_perfis` | o próprio, admin | até "Apagar meus dados" |
| Data de nascimento | Cálculo da idade | **não gravada** | — | — |
| Localização precisa | Busca por proximidade e validação da foto | memória da Edge Function no momento; só `distancia_bar_metros` é gravada | — | não retida |
| Fotos | Colarinhômetro | bucket privado | o próprio, admin | até o usuário apagar |
| Mensagens do chat | Contexto do agente | `otcb_mensagens` | o próprio | 30 dias |
| Opiniões | Comunidade | `otcb_opinioes` | públicas | até apagar |

- Base legal (LGPD): execução do serviço solicitado pelo usuário (art. 7º, V) para identidade anônima, chat, fotos e Passaporte; o app não coleta e-mail, telefone nem nome; legítimo interesse para telemetria sem dado pessoal sensível.
- Exportação e exclusão: exclusão pelo app (8.10); pedido de cópia dos dados pelo e-mail de contato da política de privacidade, atendido manualmente em até 15 dias.
- Envio a terceiros: textos do chat e fotos vão à Claude API (Anthropic) para processamento; a política de privacidade declara isso.
- Segredos só no servidor; o app só tem a chave publicável. RLS em todas as tabelas.
- **Advisors do Supabase** (segurança e performance) rodados após cada migration; nenhum alerta crítico pendente sobre objetos `otcb_`.
- **Guardrails de IA que não dependem do modelo:** filtro determinístico do chat (11.18), limites diários (11.6), validação de esquema dos blocos (13.1), proibição de ferramenta de escrita no agente (13.3), lista de termos proibidos antes da moderação (11.7), cálculo da nota fora do modelo (11.5).
- Lojas: classificação 18+; nenhuma mecânica recompensa quantidade (guideline 1.4.3 da App Store); metadados de loja apropriados para todas as idades e sem a marca.

---

## 21. Métricas de sucesso e telemetria

| Métrica | Alvo | Prazo |
|---|---|---|
| Bares `confirmado` ou `provavel` nos 17 bairros da semente | ≥ 150 | 30 dias após o primeiro garimpo |
| Respostas do agente com pelo menos 1 bar | ≥ 80% das buscas | 60 dias após lançamento |
| Usuários ativos na semana que fazem ao menos 1 foto | ≥ 25% | 60 dias |
| Bares cujo status mudou por contribuição de usuário | ≥ 10% da base | 90 dias |

Eventos (prefixo `otcb_`, sem texto de mensagem, sem localização, sem foto):

| Evento | Propriedades |
|---|---|
| `otcb_primeiro_acesso` | — |
| `otcb_mensagem_enviada` | `teve_localizacao` |
| `otcb_resposta_recebida` | `qtd_bares`, `tipos_bloco`, `bloqueada_guardrail` |
| `otcb_card_registrado` | `tipo_card` |
| `otcb_foto_avaliada` | `e_chopp`, `nota_faixa` (0–4, 5–7, 8–10), `teve_bar`, `carimbo_novo` |
| `otcb_carimbo_ganho` | `qtd_total` |
| `otcb_selo_ganho` | `selo` |
| `otcb_ficha_aberta` | `status_bar` |
| `otcb_rota_aberta` | `destino` (`mapas` ou `uber`) |
| `otcb_conta_apagada` | — |

---

## 22. Estratégia de teste

| O que | Como |
|---|---|
| Regras 11.1–11.4, 11.6, 11.7, 11.9, 11.11 | pgTAP em `supabase/tests/`, com os casos de 11.2.1 |
| Matriz de permissões (5.2) e políticas (6.1) | pgTAP simulando dois usuários e um admin |
| Edge Functions | `deno test` com Claude, Google, Firecrawl e football-data simulados (respostas gravadas em `supabase/functions/_shared/fixtures/`) |
| Nota do Colarinhômetro (11.5) e guardrail (11.18) | testes unitários em Deno |
| Renderização dos blocos (13.2) e cards de entrada | testes de componente com `jest-expo` |
| Fila de fotos offline | teste unitário do módulo `src/lib/photo-queue` com relógio simulado |
| Identidade anônima (reabrir mantém, reinstalar recomeça), câmera e localização | manual em aparelho real (checklist no `README.md`) |
| Qualidade do agente | 20 perguntas de referência em `supabase/functions/otcb-agente/avaliacao.json`, rodadas contra o banco de teste antes de cada release, com o resultado esperado de cada uma |

### 22.1 Loop de verificação

| Comando | O que faz |
|---|---|
| `npm run typecheck` | `tsc --noEmit` no app |
| `npm run lint` | `expo lint` |
| `npm test` | testes do app (`jest-expo`) |
| `npm run test:db` | pgTAP contra o banco (`supabase test db`) |
| `npm run test:functions` | `deno test supabase/functions` |
| `npm run build:check` | `npx expo export --platform all` (compila o bundle das duas plataformas) |

- Nenhum épico é declarado pronto sem rodar os seis comandos e colar a saída.
- Critério quantificável por épico: todos os critérios de 8.X marcados com evidência pelo `verifier`.
- Bug se corrige com teste primeiro: reproduzir como teste, confirmar a falha, commitar, criar `.claude/fix-mode`, corrigir sem editar o teste, remover `.claude/fix-mode`.
- UI: quando houver ferramenta de captura de tela disponível ao agente, comparar as telas com o design aprovado no Claude Design.
- Regra de ouro (literal no `CLAUDE.md`): **se um teste falhar, corrija o código, não o teste; nunca pule nem apague teste que falha.**

---

## 23. Riscos e mitigação

| Risco | Impacto | Prob. | Mitigação |
|---|---|---|---|
| Ambev contestar o uso da marca | Alto | Média | Marca fora da loja (guardrail); app não usa logo nem identidade; pronto para renomear o texto interno se preciso. |
| Rejeição na App Store pela guideline 1.4.3 | Alto | Média | Nenhuma mecânica de quantidade; limite de 2 carimbos/dia; classificação 18+; copy de moderação; rota de bares fora do MVP. |
| Garimpo trazer pouca evidência fresca (cardápios sem data, Instagram inacessível) | Alto | Média | Várias fontes; data desconhecida já penalizada (11.1); medir a métrica 21.1 nas primeiras semanas e ajustar fontes. |
| Termos do Google sobre armazenamento (P3) diferentes do previsto | Médio | Média | Validar antes do épico 8.3; se necessário, guardar só `place_id` e buscar coordenadas na hora. |
| Custo de API acima do esperado | Médio | Média | Tetos da regra 11.17, limites 11.6, Haiku nas tarefas de volume; acompanhar `otcb_execucoes_garimpo`. |
| Edge Function estourar tempo (P1) | Médio | Média | Lotes de 20 com cursor e reagendamento. |
| Plano gratuito do football-data sem a competição desejada (P2) | Baixo | Média | Agente avisa que não tem o jogo; API paga na v2. |
| Nota do Colarinhômetro inconsistente entre fotos parecidas | Médio | Média | Pesos fixos fora do modelo; conjunto de 30 fotos de referência para calibrar o prompt antes do lançamento. |
| Uso por menores | Alto | Baixa | Classificação 18+, declaração de idade, guardrail 11.18. |
| Banco de teste compartilhado com outros apps | Médio | Baixa | Prefixo `otcb_`; migrations só tocam objetos `otcb_`; revisar advisors; migrar para projeto próprio se o app crescer. |
| Ligar login anônimo no BANCO DE TESTE expor dados de outros apps (P4) | Alto | **Confirmado em 07/11/2026**: tabelas de outros apps no mesmo banco têm políticas abertas a usuários autenticados. | **Risco aceito** pelo Alexandre (07/11/2026): o app de livros é experimento sem usuários e será aposentado. O agente de código **não altera** objetos fora do prefixo `otcb_`. Regra para o futuro: nenhum app novo neste projeto cria política que libere acesso a qualquer `authenticated` sem `auth.uid()`. |
| Usuário reinstala o app para ganhar limites novos de IA | Baixo | Baixa | Aceito; limite padrão do Supabase de criação de usuários anônimos por IP segura abuso em massa. |
| Usuário perde Passaporte ao trocar de celular e reclama | Baixo | Média | Aviso fixo no Perfil (8.10); recuperação por telefone fica no roadmap (seção 28). |

---

## 24. Assunções declaradas

**Assunção não revisada vira verdade no minuto em que o agente começa a codar.** Se discordar de alguma, é só avisar que eu ajusto.

| # | Assunção | Por quê | Alternativa |
|---|---|---|---|
| 24.1 | Só a cidade de São Paulo no MVP | O CSV e a ideia original são de SP | Incluir outras capitais desde o início |
| 24.2 | Identidade anônima por aparelho, sem login; reinstalar perde tudo | Decisão do Alexandre: simplicidade; os limites de IA continuam por usuário | Telefone com código opcional para salvar o Passaporte (seção 28) |
| 24.3 | Fotos nunca públicas no MVP | Evita moderação de imagem e pessoas identificáveis | Fotos públicas na Ficha com moderação |
| 24.4 | Sem painel admin; admin via Supabase Studio | Simplicidade (princípio 5) | Painel web simples já no MVP |
| 24.5 | Limite de 2 carimbos novos por dia | Afasta a leitura de "maratona de bares" (guideline 1.4.3) | 1 por dia, ou sem limite |
| 24.6 | Raio padrão de 2 km e foto válida a até 150 m | Distâncias de caminhada e erro típico do GPS em área urbana | Outros valores |
| 24.7 | Mascote "Bolacha" (bolacha de chopp) | Elemento de boteco, original, sem marca | Outro mascote ou nenhum |
| 24.8 | Bundle/pacote com o prefixo de bundle ID da Dab Lab + `.otcb` | Padrão dos outros apps | Outro identificador |
| 24.9 | Competições de futebol limitadas ao que o plano gratuito oferece | Custo zero | API paga com Copa do Brasil, Libertadores e Seleção |
| 24.10 | Fonte: Baloo 2 + Nunito (sugestão) | Gratuitas, arredondadas, combinam com a direção 16 | O Claude Design propõe outra |
| 24.11 | Pesos e meias-vidas da regra 11.1 | Ponto de partida razoável; ajustáveis numa constante | Calibrar depois de 30 dias de dados |
| 24.12 | Dados de jogos e garimpo agendados nos horários da seção 7.5 | Madrugada, fora do uso | Outros horários |
| 24.14 | OTCB no BANCO DE TESTE com login anônimo ligado, sem corrigir as políticas das tabelas de outros apps | Sem custo novo; decisão do Alexandre | Projeto Supabase próprio, ou corrigir as políticas das tabelas dos outros apps |
| 24.13 | Usuários anônimos abandonados (app desinstalado) não são limpos no MVP | Volume pequeno; simplicidade | Limpeza anual de usuários sem atividade há 12 meses |

---

## 25. Perguntas abertas

O agente de código **pergunta em vez de assumir** quando cruzar com qualquer item abaixo.

| # | Pergunta | Quem decide | Até quando |
|---|---|---|---|
| 25.1 | Qual conta do Google Cloud (faturamento) e do Firecrawl serão usadas? | Alexandre | Antes do épico 8.3 |
| 25.2 | Qual o endpoint e a chave da Visão de Produto para o projeto `otcb`? | Alexandre | Antes do épico 8.4 |
| 25.3 | Nome do repositório e organização no GitHub | Alexandre | Antes do épico 8.0 |
| 25.4 | Quem assina termos de uso e política de privacidade (Dab Lab?) e qual e-mail de contato | Alexandre | Antes do épico 8.10 |
| 25.5 | Quais bares entram como `classico` na primeira curadoria | Alexandre | Antes do épico 8.7 |

---

## 26. Definition of Done

- [ ] Épicos 8.0 a 8.11 com todos os critérios de aceite "cumprido" pelo `verifier`, com a saída dos comandos de 22.1 colada.
- [ ] Banco em português, `snake_case`, prefixo `otcb_`, sem objeto fora do padrão.
- [ ] RLS em todas as tabelas `otcb_`, com as políticas da seção 6.1; testes pgTAP da matriz 5.2 passando.
- [ ] Todas as funções, triggers, políticas, Edge Functions e componentes com lógica comentados.
- [ ] Advisors de segurança e performance rodados após o último DDL, sem alerta crítico sobre `otcb_`.
- [ ] Guardrails do Anexo B instalados e cada hook testado uma vez.
- [ ] `plans/` com o plano aprovado de cada épico, consistente com o código.
- [ ] `DOCUMENTACAO-TECNICA.md` gerado e conferido contra o sistema implementado.
- [ ] `CLAUDE.md` (uma página) e `README.md` atualizados.
- [ ] Nenhuma ocorrência de "brahma" em `store/` nem no nome do app.
- [ ] Classificação 18+ nas duas lojas; "Apagar meus dados" funcionando.
- [ ] Nenhuma tela pede e-mail, telefone, senha ou login social.
- [ ] 20 perguntas de referência do agente com resultado esperado.
- [ ] Builds de produção testados em iPhone e Android reais.

---

## 27. Próximos passos operacionais

1. Alexandre revisa as seções 24 e 25.
2. Gerar as telas no Claude Design com `prompt-design-otcb.md` e aprovar.
3. Criar o repositório e colar o prompt de implementação no Claude Code.
4. Épicos 8.0 a 8.2 (estrutura, banco, semente).
5. Épico 8.3 e deixar o garimpo rodar 1 a 2 semanas antes de abrir para usuários, para a base nascer fresca.
6. Épicos 8.4 a 8.10, teste fechado (TestFlight e teste interno do Play) com amigos.
7. Épico 8.11: publicação.

---

## 28. Roadmap: próximas releases

| Item | Detalhe já definido |
|---|---|
| Garçom craque | Ranking dos tiradores por nota média do colarinho; exige que o usuário informe o garçom no card de resultado (campo opcional) e consentimento do bar; nunca foto de pessoa. |
| Índice do Chopp | Preço do chopp informado por card (valor e tamanho do copo); mapa e ranking de preço por bairro; publicação de conteúdo a partir disso. |
| Rota do boteco | Roteiro de até 3 bares a pé com botão de Uber; precisa de desenho que não incentive quantidade (revisar 1.4.3). |
| Confrarias | Grupos de amigos com mapa próprio, histórico e votação "bora hoje?". |
| Cronista do bairro | Destaque para quem mais contribui com confirmações e sugestões úteis num bairro. |
| Fotos públicas | Exibir fotos na Ficha do bar, usando `pessoa_identificavel` (já gravado) para filtrar; moderação de imagem. |
| Mapa como aba | Mapa com todos os bares e filtros. |
| Painel admin | Web, com o menu lateral padrão: moderação, mescla de duplicados, curadoria de clássicos, saúde do garimpo. |
| Outras cidades | Lista de bairros por cidade; descoberta por cidade. |
| Notificações | Ex.: "o bar que você salvou passa o jogo do seu time hoje". |
| Salvar o Passaporte por telefone | Botão opcional no Perfil: número + código por SMS ou WhatsApp vinculado ao mesmo usuário anônimo (`updateUser({ phone })` do Supabase), para recuperar tudo em outro aparelho. Ninguém é obrigado a usar. |

---

## 29. Protocolo de mudanças incrementais

1. Commit de checkpoint antes de qualquer mudança.
2. Não colar o spec inteiro de novo; colar só o trecho novo ou alterado, ou um spec adicional da feature.
3. Escrever a instrução como diff: o projeto existe e funciona.
4. Dizer nominalmente o que não deve mudar.
5. Pedir o plano em plan mode (arquivos, ordem, testes) antes do código; aprovar e commitar em `plans/<feature>.md`. Se for bug, o plano começa pelo teste que reproduz a falha.
6. Revisar o `git diff` contra o plano; reverter o que passou do escopo.
7. Exigir a atualização do `DOCUMENTACAO-TECNICA.md` e do `CLAUDE.md` no mesmo commit.

Modelo de prompt:
```
O OTCB já está implementado e funcionando conforme spec.md e DOCUMENTACAO-TECNICA.md.
Quero esta mudança: <descrição ou trecho de spec>.
Não altere: <telas, tabelas ou funções que não devem mudar>.
Antes de codar, entre em plan mode, me mostre o plano (arquivos, ordem, testes que provam)
e, depois de aprovado, salve em plans/<feature>.md.
Rode os comandos de verificação do CLAUDE.md e cole a saída. Chame o verifier.
Atualize DOCUMENTACAO-TECNICA.md e CLAUDE.md no mesmo commit.
```

---

## Anexo — Fontes (consultadas em 07/11/2026)

- Expo — How to upgrade to SDK 58 (React Native 0.88): https://expo.dev/blog/how-to-upgrade-to-sdk-58
- Apple — guideline 1.4.3 (consumo de álcool) e metadados apropriados para todas as idades: https://conductatlas.com/platform/apple/apple-app-store-review-guidelines/provision/CA-P-018800/prohibition-on-apps-encouraging-substance-consumption/ e https://conductatlas.com/platform/apple/apple-app-store-review-guidelines/provision/CA-P-018841/app-metadata-must-be-appropriate-for-all-audiences/
- Apple — faixas etárias 13+, 16+, 18+: https://newly.app/how-to/app-store-age-rating
- Google Places API (New) — campos e SKUs: https://developers.google.com/maps/documentation/places/web-service/data-fields e https://developers.google.com/maps/documentation/places/web-service/text-search
- Preços do Google Places em 2026: https://openplacesapi.com/blog/google-places-api-pricing
- football-data.org — plano gratuito em 2026: https://www.thestatsapi.com/blog/football-data-org-free-tier-limits-2026
- Duolingo como referência de design lúdico: https://www.webdesignhot.com/design.md/duolingo/
- Bar Ovo (Estúdio Sarau): https://www.itsnicethat.com/features/the-view-from-sao-paulo-retro-bar-and-restaurant-branding-graphic-design-140926
- Boteco da Mario (268 Estúdio): https://worldbranddesign.com/?p=428120
- Contexto Brahma 2026 ("Pelos Bares", Bar Brahma Paulista): https://gironews.com/tag/brahma/ e https://exame.com/arquivo/brahma

---

## Anexo B — Kit de guardrails do Claude Code

### `.claude/settings.json`
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-secrets.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-migrations.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-tests.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-store-brand.sh" },
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/guard-gallery.sh" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/remind-advisors.sh" }
        ]
      }
    ]
  }
}
```

### `.claude/hooks/guard-secrets.sh`
```bash
#!/bin/bash
# Bloqueia credencial privilegiada ou chave de API em código que roda no app.
# Implementa a seção 20: segredos só existem nas Edge Functions e em scripts/.
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

# Pastas de código do app (seção 18).
case "$path" in
  */app/*|*/src/*|*/app.config.ts|*/app.json) ;;
  *) exit 0 ;;
esac

if echo "$content" | grep -qiE 'service_role|SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|GOOGLE_PLACES_API_KEY|FIRECRAWL_API_KEY|FOOTBALL_DATA_KEY|OTCB_CRON_SECRET|sk-ant-|fc-[a-z0-9]{20,}'; then
  echo "Bloqueado: segredo ou credencial privilegiada em código do app (seção 20). Mova a operação para uma Edge Function (seção 13) e chame-a do app com o JWT do usuário." >&2
  exit 2
fi
exit 0
```

### `.claude/hooks/guard-migrations.sh`
```bash
#!/bin/bash
# Impede editar migration já versionada; mudança de schema vira migration nova (seção 7.6).
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

case "$path" in
  */supabase/migrations/*) ;;
  *) exit 0 ;;
esac

rel="${path#"$CLAUDE_PROJECT_DIR"/}"
if git -C "$CLAUDE_PROJECT_DIR" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
  echo "Bloqueado: $rel já está versionada. Não se edita migration aplicada; crie uma nova migration com a alteração (seção 7.6)." >&2
  exit 2
fi
exit 0
```

### `.claude/hooks/guard-tests.sh`
```bash
#!/bin/bash
# Em modo de correção (.claude/fix-mode), impede editar testes para "fazer passar" (seção 22.1).
[ -f "$CLAUDE_PROJECT_DIR/.claude/fix-mode" ] || exit 0

command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

case "$path" in
  *.test.ts|*.test.tsx|*_test.ts|*/__tests__/*|*/supabase/tests/*|*/fixtures/*|*/avaliacao.json)
    echo "Bloqueado: modo de correção ativo (.claude/fix-mode). Corrija o código, não o teste (seção 22.1). Se o teste estiver errado de fato, pare e explique ao humano." >&2
    exit 2 ;;
esac
exit 0
```
Uso: `touch .claude/fix-mode` depois de commitar o teste que reproduz o bug; `rm .claude/fix-mode` ao terminar. `.claude/fix-mode` vai no `.gitignore`.

### `.claude/hooks/guard-store-brand.sh`
```bash
#!/bin/bash
# Impede a palavra "Brahma" nos textos da loja e na configuração do app (nota sobre a marca, épico 8.11).
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

case "$path" in
  */store/*|*/app.config.ts|*/app.json|*/eas.json) ;;
  *) exit 0 ;;
esac

if echo "$content" | grep -qi 'brahma'; then
  echo "Bloqueado: a marca Brahma não pode aparecer na ficha da loja nem na configuração do app. Na loja o produto é só 'OTCB' (nota sobre a marca no início do spec)." >&2
  exit 2
fi
exit 0
```

### `.claude/hooks/guard-gallery.sh`
```bash
#!/bin/bash
# O Colarinhômetro aceita só foto tirada pela câmera do app, nunca da galeria (regra 11.4).
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // empty')

case "$path" in
  */src/features/colarinhometro/*|*/app/*camera*) ;;
  *) exit 0 ;;
esac

if echo "$content" | grep -qE 'launchImageLibraryAsync|MediaLibrary|ImagePicker\.launchImageLibrary'; then
  echo "Bloqueado: o Colarinhômetro não pode usar a galeria; a foto vem só da câmera do app (regra 11.4)." >&2
  exit 2
fi
exit 0
```

### `.claude/hooks/remind-advisors.sh`
```bash
#!/bin/bash
# Depois de escrever migration, lembra de rodar os advisors do Supabase (seção 20).
command -v jq >/dev/null || { echo "Guardrail inativo: jq não está instalado. Instale o jq (brew install jq) antes de continuar." >&2; exit 2; }
input=$(cat)
path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
case "$path" in
  */supabase/migrations/*)
    echo "Migration escrita. Depois de aplicá-la, rode get_advisors (security e performance) e resolva alertas críticos sobre objetos otcb_ antes de seguir (seção 20)." >&2
    exit 2 ;;
esac
exit 0
```

### `.claude/agents/verifier.md`
```markdown
---
name: verifier
description: Confere em contexto limpo se o épico implementado cumpre os critérios de aceite do spec. Use ao terminar cada épico, antes de declarar pronto.
tools: Bash, Read, Grep
---
Você verifica; não corrige nada.

1. Leia no spec.md a seção 8.X do épico indicado, a matriz de permissões (seção 5.2), as políticas (6.1) e as regras da seção 11 que o épico toca.
2. Leia o plano em plans/ correspondente e o git diff do épico.
3. Rode: npm run typecheck, npm run lint, npm test, npm run test:db, npm run test:functions, npm run build:check. Guarde a saída.
4. Para cada critério de aceite, responda: cumprido / não cumprido / não verificável — sempre com evidência (saída de comando ou arquivo:linha).
5. Para cada tabela ou card tocado, confira se o que o usuário pode ler e escrever bate com 5.2 e 6.1, inclusive o escopo ("só os próprios").
6. Confira que nenhuma mecânica nova conta quantidade de chopp (princípio 3) e que a marca não aparece em store/.
7. Liste divergências entre o diff e o plano.

Termine com uma linha: PRONTO ou NÃO PRONTO, e os itens que impedem.
```

### `REVIEW.md`
```markdown
# Instruções de revisão — OTCB

## Passes
Faça três passes e marque cada achado com o passe:
- Bugs: erro de lógica, caso de borda quebrado (fuso de São Paulo, limites diários, decaimento), regressão.
- Segurança: matriz de permissões (spec 5.2) e políticas (6.1) respeitadas; segredos só nas Edge Functions; localização, data de nascimento e texto do chat fora de log e de telemetria (seção 20).
- Conformidade: bate com spec.md (épicos da seção 8, regras da seção 11, contratos da seção 13), com o plano em plans/ e com as convenções da seção 18 — banco em português snake_case com prefixo otcb_, rotinas comentadas com a regra que implementam, nenhuma escrita feita pelo agente de IA (só por card), nenhuma mecânica que conte quantidade de chopp.

## O que é Importante
Importante é o que quebra comportamento, vaza dado, viola regra do spec ou põe a publicação em risco (marca na loja, incentivo a consumo). Estilo e nome são detalhe.

## Limite de detalhes
No máximo cinco detalhes por revisão; resuma o resto como contagem.

## Não reportar
Arquivos gerados (src/types/database.ts, supabase/schema.sql) e o que o lint já garante.
```
