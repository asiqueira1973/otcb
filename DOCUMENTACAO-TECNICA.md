# OTCB — Documentação técnica

Este documento descreve o sistema **como ele está implementado** (spec seção 19) e é atualizado no mesmo commit de cada mudança. Estado atual: épicos 8.0 a 8.3.

O banco é o Supabase "BANCO DE TESTE" (`jeesdmfcrmhyufwzwzwt`), compartilhado com outros apps. Por isso todo objeto do OTCB leva o prefixo `otcb_`.

Extensões usadas, liberadas pelo Alexandre: `pg_trgm`, `unaccent` e `pg_net` (no schema `extensions`) e `pg_cron`. Os segredos do cron (`otcb_url_funcoes`, `otcb_cron_secret`) ficam no Vault.

## 1. Modelo de dados

### Enums

| Enum | Valores e significado |
|---|---|
| `otcb_papel` | `usuario` é qualquer adulto que abriu o app (o padrão). `admin` opera a base pelo Studio e só é promovido por SQL (5.1). |
| `otcb_status_bar` | `confirmado`: tem chopp Brahma, com pontuação ≥ 1,0. `provavel`: ≥ 0,5. `incerto`: aparece como "a confirmar". `sem_brahma`: ≤ −0,5. `fechado`: o bar fechou. |
| `otcb_assunto_evidencia` | Sobre o que é a evidência: se `tem_brahma`, se `transmite_jogos` ou o `funcionamento` do bar (aberto ou fechado). |
| `otcb_sinal_evidencia` | `positivo` confirma, `negativo` nega, `fechado` diz que o bar fechou (só vale com `funcionamento`). |
| `otcb_tipo_evidencia` | A fonte: `foto_colarinhometro`, `confirmacao_usuario`, `sugestao_usuario`, `cardapio_site`, `pagina_web`, `avaliacao_google`, `status_google` e `seed_otcb_antigo` (CSV antigo). |
| `otcb_origem_evidencia` | Quem trouxe a evidência: `usuario`, `garimpo` ou `seed`. |
| `otcb_status_opiniao` | `publicada`, `oculta_moderacao` (recusada pela IA), `oculta_denuncias` (3 denúncias) ou `oculta_admin`. |
| `otcb_papel_mensagem` | Autor da mensagem do chat: `usuario`, `assistente` ou `sistema` (registro de ação feita por card). |
| `otcb_tipo_execucao` | Modo do garimpo: `descoberta`, `revisita`, `coordenadas`, `resumos` ou `jogos`. |
| `otcb_status_execucao` | `em_andamento`, `concluida` ou `falhou`. |

### Tabelas

**`otcb_perfis`**: o usuário no app, com uma linha por usuário anônimo.
- `id`: o mesmo id de `auth.users`. Se o usuário é apagado, o perfil vai junto.
- `apelido`: público nas opiniões. Tem de 3 a 20 caracteres (`[A-Za-z0-9_.]`) e é único sem diferenciar maiúsculas.
- `papel`.
- `maioridade_confirmada_em`: o instante da declaração de 18+. A data de nascimento **não é gravada**.
- `time_do_coracao`: opcional.
- `revisao_menor_em` (8.4): quando o guardrail da 11.18 detectou menção a idade abaixo de 18 no chat. Só o serviço grava, o cliente não lê (grant por coluna) e o admin consulta pelo Studio.
- `criado_em` e `atualizado_em`.

**`otcb_bares`**: cada bar conhecido.
- `nome`, `endereco` e `bairro`.
- `latitude` e `longitude`, renovadas pela regra 11.10. `coordenadas_atualizadas_em` registra quando.
- `google_place_id`: único; fica nulo enquanto o bar não foi casado com o Google.
- **Campos calculados, nunca editados à mão:**
  - `status`, `pontuacao_brahma` (regras 11.1 e 11.2) e `status_atualizado_em` (muda só quando o status muda);
  - `transmite_jogos` (11.3; nulo = sem informação);
  - `nota_colarinho_media` e `qtd_fotos_avaliadas` (11.5);
  - `nota_opinioes_media` e `qtd_opinioes` (só opiniões publicadas);
  - `resumo_opinioes` e `resumo_atualizado_em` (11.8; nulos com menos de 3 opiniões publicadas).
- `tem_balcao`: nulo = sem informação.
- `classico`: curadoria manual do admin.
- `excluido_em`: soft delete.
- `criado_em` e `atualizado_em`.

**`otcb_evidencias`**: tudo que indica se o bar tem Brahma, passa jogo ou está aberto.
- `bar_id`, `assunto`, `sinal`, `tipo` e `origem`.
- `usuario_id`: nulo para garimpo, seed e contas apagadas.
- `foto_id`: quando a evidência veio de uma foto.
- `url_fonte` e `trecho`: o trecho tem até 300 caracteres. `(bar, assunto, url_fonte)` é único quando a URL existe.
- `data_evidencia`: a data do conteúdo.
- `peso` e `meia_vida_dias`: copiados da regra 11.1 no insert.

**`otcb_fotos`**: cada foto do Colarinhômetro.
- `usuario_id`.
- `bar_id` e `distancia_bar_metros`: nulos sem bar a até 150 m.
- `caminho_storage` = `{usuario_id}/{id}.jpg`. Um CHECK obriga a pasta a ser a do dono.
- `e_chopp` (resposta da IA) e `usuario_confirmou_brahma` (resposta do usuário).
- As quatro notas parciais e `nota_colarinho`, todas de 0 a 10 (11.5).
- `comentario_ia` e `modelo_ia`.
- `excluido_em`: soft delete pelo dono.

**`otcb_carimbos`**: o Passaporte, com 1 carimbo por usuário por bar. Guarda a foto que o gerou, que fica nula se a foto for apagada.

**`otcb_opinioes`**: 1 por usuário por bar. Texto de 10 a 500 caracteres, `nota` de 1 a 5 ou vazia, `status`, `motivo_ocultacao` e `qtd_denuncias`.

**`otcb_denuncias`**: 1 por usuário por opinião, com `motivo` opcional.

**`otcb_mensagens`**: o histórico do chat (`papel`, `conteudo`, `blocos` em jsonb). Fica guardado por 30 dias.

**`otcb_jogos`**: os jogos do football-data.org (`id_externo` único). São apagados 2 dias depois do início.

**`otcb_execucoes_garimpo`**: o registro de cada execução do garimpo (tipo, status, cursor, contadores e `erros`).

**Bucket `otcb-fotos`**: privado, aceita só JPEG de até 1 MB e usa uma pasta por usuário.

## 2. Relacionamentos

```
auth.users 1──0..1 otcb_perfis
otcb_perfis 1──N otcb_fotos ──N──0..1 otcb_bares
otcb_perfis 1──N otcb_carimbos N──1 otcb_bares          (único por usuário+bar)
otcb_perfis 1──N otcb_opinioes N──1 otcb_bares          (único por usuário+bar)
otcb_opinioes 1──N otcb_denuncias N──1 otcb_perfis      (único por opinião+usuário)
otcb_bares 1──N otcb_evidencias N──0..1 otcb_perfis     (on delete set null)
otcb_evidencias N──0..1 otcb_fotos ; otcb_carimbos N──0..1 otcb_fotos   (on delete set null)
otcb_perfis 1──N otcb_mensagens
otcb_jogos e otcb_execucoes_garimpo: isoladas
```

Apagar o perfil apaga em cascata as fotos, carimbos, opiniões, denúncias e mensagens do usuário. As evidências do usuário são preservadas e ficam sem dono (7.4).

## 3. Regras de negócio no banco

### Funções e triggers

| Nome | Tipo | Onde / quando | O que faz |
|---|---|---|---|
| `otcb_e_admin()` | definer | políticas | Diz se o usuário atual é admin. |
| `otcb_normalizar(texto)` | imutável | buscas e casamento | Tira acentos, passa para minúsculas, junta espaços e remove os prefixos "bar", "boteco" e "restaurante". |
| `otcb_distancia_metros` | imutável | buscas, fotos e casamento | Distância haversine em metros. |
| `otcb_hoje_sp()` / `otcb_dia_sp(t)` | — | limites diários | Dia civil em `America/Sao_Paulo` (11.12). |
| `otcb_regra_evidencia(tipo, assunto, sinal)` | imutável, só serviço | — | A tabela 11.1, em um só lugar (24.11). Combinação fora dela gera `evidencia_invalida`. |
| trigger `otcb_trg_evidencia_define_peso` | before insert | `otcb_evidencias` | Preenche `peso` e `meia_vida_dias` pela regra, ignorando o que vier do chamador. |
| `otcb_recalcular_bar(bar)` | definer, só serviço | — | Regras 11.1, 11.2 e 11.3: soma as forças `peso × 0,5^(idade/meia-vida)`, contando só a evidência mais recente de cada usuário por assunto; decide o status na ordem fechado → sem_brahma → confirmado → provavel → incerto; grava a pontuação, o status, `transmite_jogos` e a data quando o status muda. |
| trigger `otcb_trg_evidencia_recalcula` | after insert/delete | `otcb_evidencias` | Recalcula o bar da evidência. |
| `otcb_recalcular_todos()` | definer, só serviço | cron diário | Recalcula status e pontuação dos bares ativos (decaimento) e reconstrói os agregados de fotos e opiniões. |
| `otcb_bar_mais_proximo(lat, lng)` | definer, só serviço | Colarinhômetro (8.6) | Bar não excluído e não fechado a até 150 m; empate vai para a maior pontuação (11.4). |
| trigger `otcb_trg_foto_processa` | after insert, update de `excluido_em` e delete | `otcb_fotos` | Regra 11.4: com chopp, bar e confirmação do usuário, cria a evidência `foto_colarinhometro` e o carimbo (no máximo 1 por bar e 2 por dia de SP). Também recalcula a média e a contagem de fotos não excluídas (11.5). |
| trigger `otcb_trg_opiniao_agrega` | after insert/update/delete | `otcb_opinioes` | Média e contagem das publicadas; abaixo de 3 publicadas, zera o resumo (11.8). |
| trigger `otcb_trg_denuncia_conta` | after insert | `otcb_denuncias` | Soma a denúncia; na 3ª, a opinião vira `oculta_denuncias` (11.7). |
| triggers `otcb_trg_atualizado_em` e `otcb_trg_perfil_protege_papel` | before update | perfis, bares, opiniões, jogos | `atualizado_em = now()`; o papel não muda para quem não é admin. |
| `otcb_usuario_atual()` | definer | RPCs | Devolve `auth.uid()` de quem tem perfil; sem perfil, erro `nao_autenticado`. |
| `otcb_inserir_confirmacao(...)` | definer, interna | RPCs | Grava a confirmação. Uma segunda do mesmo bar e assunto no dia de SP gera `limite_confirmacao`. |
| `otcb_limpeza_diaria()` | definer, só serviço | cron diário | Apaga mensagens com mais de 30 dias e jogos com mais de 2 dias desde o início. |
| `otcb_agregar_fotos_do_bar(bar)` / `otcb_agregar_opinioes_do_bar(bar)` | definer, só serviço | triggers e recálculo diário | Reconstroem os agregados de fotos (11.5) e de opiniões (11.7/11.8) a partir das tabelas filhas (7.7). |
| `otcb_anonimizar_evidencias(usuario)` | definer, só serviço | `otcb-apagar-conta` e trigger | De cada pessoa, por bar, ficam só: (a) a evidência mais recente de cada assunto, que mantém o peso (11.1); (b) a foto/confirmação positiva de `tem_brahma` mais recente, com peso 0 se não for a (a), que sustenta a anulação de fechamento (11.2), `ultima_confirmacao_em` e `confirmacoes_60_dias` (13.2). As demais são apagadas e as restantes perdem o `usuario_id`. Status, pontuação, `transmite_jogos` e CardBar não mudam (testes 070–072 e teste de propriedade 073 com 300 cenários). |
| trigger `otcb_trg_perfil_anonimiza` | before delete | `otcb_perfis` | Chama `otcb_anonimizar_evidencias`, inclusive quando o perfil é apagado pelo Studio. |

### RPCs do app (13.4)

Todas exigem `authenticated` e nunca aceitam `anon`.

| RPC | Entrada → saída | Regras e erros |
|---|---|---|
| `otcb_confirmar_bar` | bar, assunto, sinal → `{ok: true}` | `bar_inexistente`, `sinal_invalido` (`funcionamento` só aceita `fechado`; os outros assuntos não aceitam `fechado`), `limite_confirmacao`. |
| `otcb_sugerir_bar` | nome, endereço, bairro, lat, lng, tem_brahma → `{bar_id, criado}` | Se casa com um bar existente (até 80 m e similaridade ≥ 0,5), grava uma confirmação nele e devolve `criado: false`. Se não casa, cria o bar como `incerto` mais a evidência `sugestao_usuario`. Erros: `limite_sugestao` (5 por dia), `dados_invalidos` (inclusive bar novo com `tem_brahma = false`). |
| `otcb_buscar_bares` | lat/lng, raio, texto, bairro, filtros → até 8 `CardBar` | Invoker (11.9). Só aparece bar não excluído, com status confirmado, provavel ou incerto e pontuação ≥ 0,1. Raio de 2 km por padrão, até 10 km. Ordena por status e depois por distância. Sem localização, exige texto ou bairro (`localizacao_ou_bairro_obrigatorio`). |
| `otcb_agregados_confirmacao` | bar → última confirmação e pessoas distintas em 60 dias | Definer; devolve só números, sem dizer quem confirmou. Cada positiva anônima conta como uma pessoa (depois da anonimização resta no máximo uma por pessoa e bar). |
| `otcb_detalhes_bar` | bar → `CardBar` | Definer; erro `bar_inexistente`. |
| `otcb_opinioes_do_bar` (8.4) | bar, página → até 10 `{opiniao_id, apelido, nota, texto, criado_em}` | Definer; só opiniões `publicada` de bar não excluído, mais recentes primeiro. Expõe o apelido (seção 20) e nunca o id do autor. Usada pela Ficha e pelo agente. |
| `otcb_meu_passaporte` | — → `{carimbos, colecoes_bairro, colecao_classicos, selos}` | Definer, sempre filtrado por `auth.uid()` (11.11). Os selos são Primeira tirada, Explorador (5, 15 e 30), Andarilho, Olho clínico e Informante. |

### Políticas (6.1)

Todas valem só para `authenticated` e usam `auth.uid()`.

| Tabela | Políticas |
|---|---|
| `otcb_perfis` | `otcb_perfis_le_proprio`, `otcb_perfis_admin_le_todos`, `otcb_perfis_insere_proprio` (sempre com `papel = 'usuario'`), `otcb_perfis_atualiza_proprio` |
| `otcb_bares` | `otcb_bares_le_ativos` (`excluido_em is null`), `otcb_bares_admin_tudo` |
| `otcb_evidencias` | `otcb_evidencias_admin_le` |
| `otcb_fotos` | `otcb_fotos_le_propria`, `otcb_fotos_admin_le`, `otcb_fotos_exclui_propria` (o grant só deixa alterar `excluido_em`, que só pode ser marcado: nunca nulo nem no futuro) |
| `otcb_carimbos` | `otcb_carimbos_le_proprios`, `otcb_carimbos_admin_le` |
| `otcb_opinioes` | `otcb_opinioes_le_publicadas`, `otcb_opinioes_le_proprias`, `otcb_opinioes_admin_tudo`, `otcb_opinioes_apaga_propria` |
| `otcb_denuncias` | `otcb_denuncias_insere_propria` (em nome próprio e nunca sobre a própria opinião), `otcb_denuncias_admin_le` |
| `otcb_mensagens` | `otcb_mensagens_le_proprias`, `otcb_mensagens_apaga_proprias`. O admin não lê mensagens. |
| `otcb_jogos` | `otcb_jogos_le` |
| `otcb_execucoes_garimpo` | `otcb_execucoes_admin_le` |
| `storage.objects` | `otcb_fotos_storage_le_proprias` (pasta `{uid}/` no bucket `otcb-fotos`) |

**Grants do cliente.** Ninguém escreve evidências, fotos, carimbos, mensagens, jogos ou execuções direto; isso só acontece pelas RPCs, pelos triggers ou pelo serviço. O que o cliente pode fazer:
- perfis: update só em `apelido`, `time_do_coracao` e `papel`, este último controlado pelo trigger;
- fotos: update só em `excluido_em`;
- opiniões: update só em `status` e `motivo_ocultacao`, liberado pelo RLS apenas para o admin.

### Funções do garimpo (épico 8.3; todas service-only)

| Nome | O que faz |
|---|---|
| `otcb_casar_bar(nome, lat, lng)` | Regra 11.16 (2): bar a até 80 m com trigramas ≥ 0,5. Também usada por `otcb_sugerir_bar`. |
| `otcb_casar_ou_criar_bar(...)` | 11.16 completa: mesmo `place_id`, ou casamento por distância e nome (grava o `place_id` se faltava), senão cria o bar `incerto` quando `p_criar`. |
| `otcb_registrar_evidencia_garimpo(...)` | Insere, ou atualiza pela chave `(bar, assunto, url_fonte)`: sinal, trecho, data e peso pela 11.1, depois recalcula o bar. Devolve `criada`, `atualizada` ou `igual`, e nunca duplica. O `status_google` usa uma URL fixa por lugar, então o último status do Google prevalece. |
| `otcb_bares_para_revisita / _coordenadas / _resumo(limite, excluir)` | Seleção de trabalho: visita há mais de 7 dias (data do `status_google`), com prioridade para `incerto` e para bares só com a semente; coordenadas com mais de 25 dias (11.10); critério do resumo (11.8). |
| `otcb_atualizar_coordenadas`, `otcb_gravar_resumo` | Gravam coordenadas e o resumo (até 400 caracteres). |
| `otcb_garimpo_iniciar(tipo)` | 12.3: execução parada há mais de 2 h vira `falhou`; se já há uma em andamento, devolve nulo (a Edge Function responde 409). |
| `otcb_garimpo_uso_mes()` | Soma o uso do mês por recurso a partir do `cursor` das execuções (11.17). |
| `otcb_configurar_garimpo(url, segredo)` | Grava a URL e o segredo no Vault. Chamada por `npm run garimpo:configurar`. |
| `otcb_garimpo_disparar(modo, execucao?)` | `net.http_post` para `otcb-garimpo` com o cabeçalho `x-otcb-cron`. Usada pelos jobs e pelo reagendamento entre lotes. |

### Funções do chat (épico 8.4; service-only)

| Nome | O que faz |
|---|---|
| `otcb_mensagens_hoje(usuario)` | Conta as mensagens `usuario` do dia de São Paulo (11.6). |
| `otcb_contexto_chat(usuario)` | As últimas 20 mensagens das últimas 6 h, inclusive `sistema`, em ordem cronológica (11.13). |
| `otcb_marcar_revisao_menor(usuario)` | Preenche `revisao_menor_em` (11.18), sem sobrescrever a primeira marca. |

O cliente passou a ler `otcb_perfis` por coluna (todas menos `revisao_menor_em`).

### Jobs do `pg_cron` (horários em UTC; São Paulo é UTC−3)

| Job | Quando | Chama |
|---|---|---|
| `otcb_cron_recalculo` | 06:00 UTC (03:00 SP) | `otcb_recalcular_todos()` |
| `otcb_cron_limpeza` | 06:30 UTC (03:30 SP) | `otcb_limpeza_diaria()` |
| `otcb_cron_revisita` | 07:00 UTC (04:00 SP) | `otcb_garimpo_disparar('revisita')` |
| `otcb_cron_coordenadas` | 07:30 UTC (04:30 SP) | `otcb_garimpo_disparar('coordenadas')` |
| `otcb_cron_resumos` | 08:00 UTC (05:00 SP) | `otcb_garimpo_disparar('resumos')` |
| `otcb_cron_descoberta` | segunda 05:00 UTC (02:00 SP) | `otcb_garimpo_disparar('descoberta')` |

O `otcb_cron_jogos` entra no épico 8.9.

## 4. Mapa tela → tabelas e funções

| Tela | Arquivo | Lê | Escreve / chama |
|---|---|---|---|
| Abertura (boot) | `app/index.tsx` + `src/features/auth/boot.ts` | `otcb_perfis` (`select id`) | Supabase Auth `signInAnonymously` |
| T1 Boas-vindas | `app/(onboarding)/boas-vindas.tsx` | — | — |
| T2 Maioridade | `app/(onboarding)/maioridade.tsx` | — | Edge Function `otcb-apagar-conta`, se menor de idade |
| T3 Apelido e time | `app/(onboarding)/apelido.tsx` | — | `insert` em `otcb_perfis` |
| T4 Localização | `app/(onboarding)/localizacao.tsx` | — | Permissão de localização do sistema |
| T10 Bloqueio | `app/(onboarding)/bloqueio.tsx` | — | — |
| T5 Chat | `app/chat.tsx` + `src/features/chat/` | `otcb_mensagens` (histórico próprio) | Edge Function `otcb-agente` |
| T6 Ficha do bar | `src/features/bares/BarSheet.tsx` | `otcb_detalhes_bar`, `otcb_opinioes_do_bar` | Links de rota e Uber (13.2) |
| T9 Perfil (mínimo) | `app/perfil.tsx` | — | `delete` em `otcb_mensagens` (próprias) |

## 5. Lógica por tela, Edge Function e script

### Abertura (`resolveBootState`)
1. Na primeira abertura da instalação, descarta a sessão herdada (`install-marker.ts`).
   - O Keychain do iOS sobrevive à desinstalação; o AsyncStorage não. A marca `otcb_instalacao` fica no AsyncStorage.
   - Sem a marca, o app faz `signOut` local e apaga a marca de perfil.
2. Garante a sessão anônima com `ensureAnonymousSession`. A função é single-flight, então cria um único usuário mesmo com chamadas simultâneas.
3. Com perfil, vai ao Chat; sem perfil, vai à Boas-vindas.
4. Sem rede:
   - se este aparelho já criou o perfil desse uid (marca `otcb_perfil_criado` no SecureStore), vai ao Chat (seção 17);
   - senão, mostra a copy 15.9 com "Tentar de novo".

### T2 Maioridade
- A data é digitada em DD/MM/AAAA e fica só no estado da tela.
- A idade civil é calculada no "hoje" de São Paulo. Quem nasceu em 29/02 faz anos em 01/03 nos anos não bissextos.
- 18+ vai à T3 levando só o instante da confirmação.
- Menor de idade: chama `otcb-apagar-conta`, faz `signOut` local (mesmo se a chamada falhar) e mostra a T10.
- Data inválida ou futura: erro inline.

### T3 Apelido
- Valida o formato no app e faz `insert`.
- O erro 23505 vira "Esse apelido já está em uso"; o 23514 vira o erro de formato.
- No sucesso: grava a marca de perfil e chama `track('otcb_primeiro_acesso')`, que ainda não faz nada porque depende da 25.2. Depois vai à T4.

### T4 Localização
"Permitir" pede a permissão em primeiro plano. Concedida, negada ou "Agora não", o destino é sempre o Chat.

### Edge Function `otcb-apagar-conta` (13.8)
- `POST`, sem corpo. O id do usuário vem só do JWT.
- Ordem:
  1. arquivos de `{uid}/` no bucket (só arquivos, então uma subpasta não trava o laço);
  2. `otcb_anonimizar_evidencias`;
  3. o perfil, com as filhas em cascata (o trigger de fotos atualiza as médias);
  4. o usuário em `auth.users`.
- Respostas: 200 `{ok: true}`; 401 sem JWT válido; 405 fora de POST; 500 `{error: 'falha_exclusao'}`, sem dado pessoal no log.
- No app, `deleteAccountAndSignOut` também trata o `error` que o supabase-js devolve em vez de lançar.

### Edge Function `otcb-garimpo` (13.6; épico 8.3)

**Autenticação e entrada:**
- O gateway não exige JWT (`verify_jwt = false` em `config.toml`). A função exige o cabeçalho `x-otcb-cron` igual ao `OTCB_CRON_SECRET`, comparado em tempo constante; sem ele, 401.
- `POST { modo, execucao_id?, bairros? }`. O parâmetro `bairros` serve só para rodada de teste da descoberta.
- Responde 202 e processa o lote em segundo plano (`EdgeRuntime.waitUntil`).

**Lote:**
- No máximo 20 itens **e** cerca de 100 s; tetos da 11.17 por execução e por mês (`tetos.ts`).
- Teto atingido: termina `concluida`, com `{motivo: 'teto_atingido', recurso, escopo}` em `erros`.
- Falha de um item: entra em `erros` (`{item, erro}`, sanitizado) e o lote segue.
- Erro fatal termina `falhou`. São fatais: Google 401/402/403 e 400 `API_KEY_INVALID`, Firecrawl 401/402, Claude 401/403 ou falta de crédito. O **403 do Firecrawl no scrape** é site bloqueado e conta como falha do item.
- Na descoberta, cada busca do bairro é isolada: a falha vira `{etapa: 'busca:{bairro}:{servico}'}` em `erros`, e o bairro avança.
- O lote segue para o próximo bairro na mesma invocação até 20 itens ou 100 s.
- Timeouts: Google 30 s, Firecrawl 45 s, Claude 60 s.
- Se sobra trabalho, salva a posição no `cursor` e se reagenda via `otcb_garimpo_disparar`.
- Ao concluir, o `cursor` guarda só `{uso}`, o uso por recurso que serve de base para os tetos mensais.

**Modos:**
- **descoberta:**
  - para cada bairro da 11.15, faz um Google Text Search ("bar chopp Brahma {bairro} São Paulo") e uma Firecrawl search;
  - **lugar:** busca até 5 avaliações (Place Details com reviews), classifica cada uma com o Claude e grava `avaliacao_google` (a `url_fonte` traz o id da avaliação; a data é a da avaliação);
  - **página:** faz o scrape, classifica, localiza no Google pelo `nome_bar` + bairro e grava `pagina_web` ou `cardapio_site`;
  - o bar novo só nasce com evidência positiva de Brahma.
- **revisita:** consulta o status no Google (`CLOSED_PERMANENTLY` → `fechado` na hora; OPERATIONAL fica registrado como visita; `CLOSED_TEMPORARILY` é ignorado) e reclassifica até 2 URLs conhecidas.
- **coordenadas:** renova lat/lng (11.10).
- **resumos:** gera o resumo das opiniões publicadas (11.8).

**Classificação (13.6):**
- `claude-haiku-5-5` pelo SDK oficial, com saída em JSON schema, validação local e 1 nova tentativa (12.5).
- `sim` → evidência positiva; `nao` com outra marca de chopp num cardápio → negativa; `incerto` → nada.
- A data é a do conteúdo, ou a da coleta − 90 dias.
- Cardápio não gera `transmite_jogos`; avaliação do Google só gera positivas (tabela 11.1).

**Segredos e logs:**
- Os segredos vivem só no ambiente da função.
- Toda mensagem de erro e de log passa por `sanitize` (chaves conhecidas, padrões de chave, `Bearer`, query strings).
- O log do gateway do Supabase registra só o **prefixo** da chave de serviço (`authorization.prefix`, 15 caracteres), comportamento da plataforma.

**Rodada real de 08/11/2026:**

| Execução | Resultado |
|---|---|
| Descoberta em Pinheiros | 1 bar novo (Bar do Juarez); evidências com `url_fonte` e `trecho`. A 1ª rodada falhou por um 403 do Firecrawl, que foi corrigido. |
| Revisita | 34 bares em 2 lotes, reagendados via `pg_net`; 33 `status_google`, sem erros. |
| 2ª descoberta | Nenhuma evidência duplicada (41/41 distintas); 3 evidências web novas; 2 páginas com erro registrado como item (Instagram 403, site da marca 500). |

Gasto total: cerca de 58 chamadas ao Google, 16 créditos do Firecrawl e 103 classificações.

### T5 Chat (`useChat`, épico 8.4)
- Ao abrir e a cada volta à tela, carrega o histórico próprio (`usuario` e `assistente`, até 300). Sem rede, mantém o que já está na tela.
- **Envio:**
  - pega a localização só se a permissão de primeiro plano já existe (última posição conhecida de até 2 min, senão GPS com teto de 2,5 s), sem pedir de novo;
  - chama `otcb-agente` com o JWT;
  - mostra o A1 enquanto espera.
- **Erros:**
  - sem rede: a mensagem fica "Não enviada · Sem sinal por aqui…" com "Tentar de novo";
  - 503 ou outra falha: "Não enviada · Deu um branco…" com "Tentar de novo";
  - 429: resposta local com a copy 15.8.
- Chat vazio mostra as sugestões da 15.4. Câmera e Passaporte avisam "em breve" até o 8.6 e o 8.7.
- **Blocos (13.2):**
  - `lista_bares` e `card_bar`: comanda com pílulas ("confirmado", "provável", "a confirmar") e etiquetas, distância e colarinho;
  - `mapa`: `react-native-maps` estático, pinos na cor do status;
  - `jogos` e `passaporte`;
  - `acao`: rota, Uber e ficha usam as coordenadas dos bares da mesma resposta.
- Tocar no card abre a Ficha (A10).
- **Telemetria (Visão de Produto, 25.2):**
  - lote a cada 3 s, com `x-api-key` e `distinct_id` = uid anônimo;
  - só as propriedades da tabela da seção 21;
  - nunca envia texto nem localização, e falha de rede não lança.

### Edge Function `otcb-agente` (13.1; épico 8.4)
- **Entrada:** POST com JWT do usuário e `{mensagem 1–1000, latitude?, longitude?}`, as duas coordenadas juntas ou nenhuma.
- **Saída:** `{mensagem_id, texto, blocos, bloqueada_guardrail}`.
- **Erros:** 401, 422, 429 `limite_mensagens` (com `texto` 15.8) e 503 `ia_indisponivel` (com `texto` 15.9). No 503 nada é gravado.
- **Ordem:**
  1. **Guardrail 11.18** (`guardrails.ts`): regex sem acento, na ordem menor → dirigir → quantidade → compra. "Tenho N" só conta como idade com "anos" ou no fim da frase; "compra" exige comprar, pedir que o OTCB venda ou entregue, ou levar para casa ("o bar vende chopp Brahma?" e "você sabe se o bar vende…?" passam; "você(s)" só conta colado ao verbo); "desafio" só com bebida. Responde o texto fixo da 15.11 e não chama o modelo. O log leva só `{evento:'guardrail', tipo}`; "menor" também marca `revisao_menor_em`.
  2. **Limite, contexto e perfil**, consultados em paralelo e adiantados pelo `sub` do JWT enquanto o Auth valida o token. Nada é usado antes da confirmação; `sub` diferente do usuário confirmado → 401. Risco aceito: um token forjado provoca 3 leituras de serviço antes de ser recusado (o resultado é descartado e nada vaza). Com 40 mensagens no dia → 429.
  3. **Modelo** `claude-sonnet-5-5`, com esforço `low`:
     - o prompt fixo `prompts/agente.v4.ts` e as ferramentas ficam em cache; o contexto do turno (apelido, time, localização e hora de SP) vem num bloco de sistema separado;
     - no máximo 5 rodadas de ferramenta; a 6ª chamada usa `tool_choice: none`;
     - se a rodada traz texto e só chama `mostrar`, o turno termina ali (critério 8).
- **Ferramentas (13.3):**
  - `buscar_bares`, `detalhes_bar` e `meu_passaporte` rodam com o JWT do usuário; `opinioes_do_bar` e `jogos_de_hoje` também.
  - Sem texto e sem bairro, `buscar_bares` usa a localização do turno; sem localização, devolve `sem_localizacao` para o modelo pedir o bairro.
  - Status fora de confirmado/provavel/incerto são descartados antes de chegar ao modelo, e `incerto` chega como `a_confirmar`.
- **`mostrar`:** recebe ids. O servidor monta o `CardBar` a partir do cache do turno, ordena `lista_bares` e `mapa` pela 11.9 (status, depois distância) e descarta bloco inválido ou com bar inventado.
- **Grava** a mensagem do usuário e a resposta (com blocos) com instantes crescentes. A localização nunca é gravada.
- **Log:** `{evento:'resposta', ms, blocos, chamadas, cache_lido, cache_gravado, entrada}`, só números.
- **Avaliação:**
  - `avaliacao.json` tem 20 perguntas com o esperado de cada uma, e `npm run agente:avaliar [-- --repetir N]` roda contra o BANCO DE TESTE com um usuário descartável;
  - o script faz uma chamada de aquecimento fora da conta;
  - resultado final em 08/11/2026: 40/40, p50 5,2 s, p95 6,9 s (Wi-Fi, 34 respostas do modelo, função aquecida). Não foi medido em 4G; o Alexandre aceitou a medida em Wi-Fi para o critério 8 (08/11/2026).

### Script `scripts/import-seed.ts` (14.1)
- Roda com `npm run seed:import`, usando `.env` e `.env.local`. Usa o service role e nunca imprime chaves.
1. Lê `supabase/seed/estabelecimentos_otcb_antigo.csv`, ignorando linhas sem nome.
2. Para cada linha, faz uma Text Search na Places API (New) com `"{Nome} {Endereço} São Paulo"`.
3. Sem resultado ou com `CLOSED_PERMANENTLY`, a linha vai para o relatório e não é importada.
4. Duplicados por `place_id` viram 1 bar. O bairro do Google vale quando existe.
5. Cada bar importado ganha uma evidência `seed_otcb_antigo`.
6. É idempotente: rodar de novo pula os `place_id` que já existem.
- **Resultado em 08/11/2026:**
  - 36 linhas lidas, 1 sem nome;
  - 33 bares importados, 2 duplicados (Belmonte), nenhum sem correspondência, nenhum fechado;
  - todos `incerto` com pontuação 0,2;
  - a segunda execução importou 0 (33 já existentes).

## 6. Divergências em relação ao spec

| Item | O que mudou | Motivo |
|---|---|---|
| `otcb_perfis` criada no 8.1 | O spec lista a tabela no 8.2. | O onboarding do 8.1 grava o perfil. |
| `otcb_perfis_insere_proprio` | Exige `papel = 'usuario'`. | O trigger de papel só cobre update. |
| Update por coluna em perfis, fotos e opiniões | Grants por coluna. | O cliente não reescreve maioridade, notas ou contadores. |
| Marca de instalação (AsyncStorage) e marca de perfil (SecureStore) | Mecanismos novos. | Reinstalar precisa começar do zero no iOS; reabrir sem rede precisa ir ao Chat. |
| Trigger `otcb_trg_evidencia_define_peso` e função `otcb_regra_evidencia` | Não estão na 7.5. | A 11.1 manda copiar peso e meia-vida no insert sem dizer como; a 24.11 pede pesos ajustáveis num só lugar. |
| `otcb_trg_foto_processa` também roda no update de `excluido_em` | A 7.5 fala só em insert. | A média da 11.5 é sobre fotos não excluídas. |
| `otcb_meu_passaporte` como security definer | A 7.5 diz invoker. | O selo Informante lê as próprias evidências, que o RLS reserva ao admin; o filtro é `auth.uid()`. |
| `otcb_agregados_confirmacao` e `otcb_bar_mais_proximo` | Funções novas. | Agregados do `CardBar` sem expor evidências (5.2); a regra 11.4 aplicada no banco para a Edge Function do 8.6. |
| `otcb_sugerir_bar` | Bar novo com `tem_brahma = false` gera `dados_invalidos`; sugestão que casa vira confirmação. | A copy 15.18 diz "sua confirmação foi registrada"; sem Brahma não há o que cadastrar. Assim o limite de 5 por dia conta as evidências `sugestao_usuario`. |
| `otcb_detalhes_bar` | Devolve o status real (pode ser `sem_brahma` ou `fechado`). | A assinatura não traz contexto; o agente só mostra os visíveis da 11.9. |
| Fechamento pelo Google | Interpretação literal: um `status_google` fechado só é anulado por foto ou confirmação positiva de usuário mais recente. | O spec não trata o Google voltar a dizer OPERATIONAL; ponto registrado no plano 8.2. |
| CHECK `otcb_fotos_caminho_do_dono` | Restrição a mais. | Garante a pasta `{usuario_id}/` exigida pela 7.2 e pela política de storage. |
| Advisors de `otcb_` (rodados depois das 9 migrations, em 08/11/2026) | Avisos aceitos, nenhum ERROR. As políticas padrão do `pg_cron` (`cron.job`, `cron.job_run_details`) também aparecem no aviso de acesso anônimo; elas vêm da extensão, filtram por `username = current_user`, e o schema `cron` não é exposto na API. Os demais avisos: RPCs `security definer` executáveis por `authenticated` (a 13.4 exige), políticas acessíveis ao usuário anônimo (a identidade do app é anônima), políticas permissivas múltiplas (nomes da 6.1) e índices ainda sem uso. | Todos vêm do próprio spec. |
| Microtextos fora da seção 15 | Em `src/lib/copy.ts`, aprovados pelo Alexandre em 07/11/2026. | O spec não traz texto para rótulos e erros de formato. |
| Mascote | Ilustrações do Higgsfield; no modo escuro a Bolacha ganha um halo claro. | Os traços cor de tinta sumiriam no fundo escuro (16.5). |
| Anonimização (7.4 × 11.1 × 11.2 × 13.2) | Antes de desvincular, ficam de cada pessoa por bar só a última de cada assunto e a última positiva (esta com `peso = 0` se não for a última); o resto é apagado. | A 7.4 fala só em desvincular, mas sem `usuario_id` todas as evidências da pessoa passariam a somar (11.1) ou deixariam de anular o fechamento (11.2), dois bugs achados pelo verifier. O peso só é alterado nessa situação. |
| 5.2 × 6.1 (visibilidade de bares) | O RLS segue a 6.1 (`excluido_em is null`); o filtro "confirmado/provavel/incerto acima do piso" fica na busca (11.9). | Os nomes e as regras da 6.1 são literais; o app e o agente chegam aos bares pela busca. |
| 5.2 × 6.1 ("admin apaga qualquer foto") | Sem política extra. | A 6.1 não a prevê; o admin opera pelo Studio (5.1). |
| 11.2 (1), janela de 30 dias | Aplicada só ao "fechou" de usuários; o `status_google` fechado vale a qualquer tempo. | Leitura do texto da 11.2 (caso I da 11.2.1). |
| Semente | O relatório tem `ja_existentes` e `sementes_completadas` (recuperação de importação interrompida). | Idempotência e atomicidade sem transação entre chamadas. |
| `status_google` com URL fixa (8.3) | O último status do Google prevalece: se ele volta a dizer OPERATIONAL, o fechamento cai. | Resolve o caso que a 11.2 não trata e que ficou pendente no 8.2. |
| Contadores por recurso no `cursor` (8.3) | Ao concluir, o `cursor` guarda `{uso}` em vez de ficar nulo. | A 7.2 só tem `chamadas_google` e `chamadas_firecrawl`, mas a 11.17 tem tetos mensais por SKU. |
| Descoberta cria bar só com evidência positiva de Brahma (8.3) | — | Evita encher a base de bares sem relação com o produto. |
| Uma página com vários bares (8.3) | A classificação 13.6 devolve um único `nome_bar`; listas tipo "10 bares com Brahma" geram evidência para um bar só. | Limitação do contrato 13.6. |
| `otcb-garimpo` com `verify_jwt = false` (8.3) | A autenticação é o segredo `x-otcb-cron`. | O `pg_net` não manda JWT; a 13.6 define o segredo próprio. |
| Apelido nas opiniões (resolvido no 8.4) | Função `otcb_opinioes_do_bar` (definer), aprovada pelo Alexandre. | O RLS de perfis só deixa ver o próprio; a seção 20 quer o apelido público. |
| `otcb_perfis.revisao_menor_em` (8.4) | Coluna nova. | A 11.18 manda sinalizar a conta para revisão, e a 7.2 não tem onde guardar. |
| `bloqueada_guardrail` na resposta do agente (8.4) | Campo a mais na saída da 13.1. | A propriedade `bloqueada_guardrail` do evento `otcb_resposta_recebida` (seção 21) precisa vir do servidor. |
| `texto` nos erros 429/503 do agente (8.4) | Campo a mais no corpo de erro. | O app mostra a copy da seção 15 mesmo sem mapear o código. |
| `mostrar` recebe ids (8.4) | O spec diz "blocos de exibição"; o servidor monta os cards a partir do cache do turno. | Garante que o modelo não invente bar nem status (critério 3; 11.18 "não inventar"). |
| Encerrar no `mostrar` com texto e prompt v2 (8.4) | Otimização do loop da 13.1. | O p95 estava em 8,7 s; o critério 8 pede menos de 8 s. O `claude-sonnet-5-5` recusa thinking desligado. |
| "Chopp Brahma" nos textos (8.4) | 15.1 "Onde tem chopp Brahma bem tirado?", 15.3 "Pra achar o chopp Brahma mais perto…", 15.4 "Chopp Brahma perto de mim", 15.13 "Pergunta onde tem chopp Brahma…". | Emenda do Alexandre: o app é só sobre chopp Brahma. A loja (15.10) continua sem a palavra. |
| Perfil mínimo e "em breve" (8.4) | T9 só com "Limpar conversa", aviso 15.20 e rodapé 15.12; câmera e Passaporte mostram "em breve". | O resto entra no 8.10, 8.6 e 8.7. |
| Prompt do agente em `.ts` | O plano dizia `prompts/agente.v1.md`. | O bundle da Edge Function não lê arquivos `.md` sem configuração extra; a regra de versionamento vale igual (`agente.vN.ts`). |
| Paleta (emenda do Alexandre, 08/11/2026) | O creme pastel e o âmbar principal da 16.2 saíram: fundo branco-frio `#F4F7FB`, azul `#1F4AA8` como cor principal (botões, bolhas do usuário, links), vermelho `#D22630` só como acento (a marca "OTCB"), âmbar só no chopp (copinho A1, Bolacha). As cores de status (16.2) continuam. Modo escuro em azul-marinho. | O app é só sobre chopp Brahma; o Alexandre pediu branco, azul e vermelho sem copiar a marca e sem o vermelho dominante. |
| Prompt do agente v3 e v4 (8.4) | "Chopp Brahma" no texto e nos títulos; o texto se sustenta sozinho e não fala de "card". | Pedido do Alexandre (só Brahma); a v3 gerou textos como "Mostrei o bar no card acima". |
| Mascote A9 | Bolacha ao lado das respostas e triste na mensagem não enviada; sem Lottie nem piscar. | As ilustrações são PNG; o piscar entra quando houver Lottie (16.7 deixa a animação livre). |
