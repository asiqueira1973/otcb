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
| `otcb_tipo_evidencia` | A fonte: `foto_colarinhometro`, `confirmacao_usuario`, `sugestao_usuario`, `cardapio_site`, `pagina_web`, `avaliacao_google`, `status_google` e `seed_otcb_antigo` (CSV antigo). `curadoria` (8.11): o dono do app atesta que o bar tem chopp. `sugestao_no_bar` (19/11/2026): bar sugerido por quem está nele. `sugestao_sem_certeza` (8.12): bar sugerido com "Não sei". |
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
- `bar_id` e `distancia_bar_metros`: nulos sem bar a até 300 m (era 150 m até 19/11/2026).
- `caminho_storage` = `{usuario_id}/{id}.jpg`. Um CHECK obriga a pasta a ser a do dono.
- `e_chopp` (resposta da IA) e `usuario_confirmou_brahma` (resposta do usuário).
- As quatro notas parciais (`nota_altura`, `nota_cremosidade`, `nota_copo`, `nota_gelado`) e `nota_colarinho`, a média ponderada calculada fora do modelo, todas de 0 a 10 (11.5).
- `comentario_ia` e `modelo_ia`.
- `excluido_em`: soft delete pelo dono.

**`otcb_carimbos`**: o Passaporte, com 1 carimbo por usuário por bar. Guarda a foto que o gerou, que fica nula se a foto for apagada.

**`otcb_opinioes`**: 1 por usuário por bar. Texto de 10 a 500 caracteres, `nota` de 1 a 5 ou vazia, `status`, `motivo_ocultacao` e `qtd_denuncias`.

**`otcb_denuncias`**: 1 por usuário por opinião, com `motivo` opcional.

**`otcb_mensagens`**: o histórico do chat (`papel`, `conteudo`, `blocos` em jsonb). Fica guardado por 30 dias.

**`otcb_jogos`**: os jogos do football-data.org (`id_externo` único), com `competicao` (nome em português), `mandante`, `visitante` e `inicio` (UTC). São apagados 2 dias depois do início.

**`otcb_execucoes_garimpo`**: o registro de cada execução do garimpo e da `otcb-jogos` (tipo `jogos`, desde o 8.9): `tipo`, `status`, `cursor`, `iniciado_em`, `concluido_em`, os contadores `bares_novos`, `evidencias_criadas`, `chamadas_google` e `chamadas_firecrawl`, e `erros` (sem chaves nem dado pessoal).

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
| `otcb_bar_mais_proximo(lat, lng)` | definer, só serviço | Colarinhômetro (8.6) | Bar não excluído e não fechado a até 300 m (era 150 m); empate vai para a maior pontuação (11.4). |
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
| `otcb_sugerir_bar` | nome, endereço, bairro, lat, lng, tem_brahma (nulo = "Não sei"), no_bar (opcional, padrão false) → `{bar_id, criado, carimbo}` | Se casa com um bar existente (até 80 m e similaridade ≥ 0,5), grava uma confirmação nele e devolve `criado: false`. Se não casa, cria o bar mais a evidência `sugestao_usuario` (fica `incerto`) ou, com `no_bar`, `sugestao_no_bar` (fica confirmado). Nos dois casos liga a foto recente sem bar (`carimbo` diz se virou carimbo). Com `tem_brahma` nulo, bar novo entra com `sugestao_sem_certeza` (peso 0) e bar existente não grava nada. Erros: `limite_sugestao` (5 por dia), `dados_invalidos` (inclusive bar novo com `tem_brahma = false`). |
| `otcb_buscar_bares` | lat/lng, raio, texto, bairro, filtros → até 8 `CardBar` | Invoker (11.9). Só aparece bar não excluído, com status confirmado, provavel ou incerto e pontuação ≥ 0,1. Raio de 2 km por padrão, até 10 km. Ordena por status e depois por distância. Sem localização, exige texto ou bairro (`localizacao_ou_bairro_obrigatorio`). |
| `otcb_agregados_confirmacao` | bar → última confirmação e pessoas distintas em 60 dias | Definer; devolve só números, sem dizer quem confirmou. Cada positiva anônima conta como uma pessoa (depois da anonimização resta no máximo uma por pessoa e bar). |
| `otcb_detalhes_bar` | bar → `CardBar` | Definer; erro `bar_inexistente`. |
| `otcb_opinioes_do_bar` (8.4) | bar, página → até 10 `{opiniao_id, apelido, nota, texto, criado_em}` | Definer; só opiniões `publicada` de bar não excluído, mais recentes primeiro. Expõe o apelido (seção 20) e nunca o id do autor. Usada pela Ficha e pelo agente. |
| `otcb_meu_passaporte` | p_versao (padrão 1) → `{carimbos, colecoes_bairro, colecao_classicos, selos}` | Definer, sempre filtrado por `auth.uid()` (11.11). Os selos são Primeira tirada, Explorador (3, 10 e 25), Andarilho, Olho clínico (nota ≥ 8 em 3 bares) e Informante (10 contribuições); com `p_versao >= 2`, também o Divulgador (1, 5 e 15 dias com compartilhamento). |
| `otcb_registrar_compartilhamento` | origem → `{dias}` | 8.12: registra um compartilhamento (na confiança), no máximo 10 por dia. Erros: `dados_invalidos`, `limite_compartilhamento`. |

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

### Funções dos cards (épico 8.5)

| Nome | Quem chama | O que faz |
|---|---|---|
| `otcb_checar_edicao(usuario, bar)` | serviço (`otcb-opinioes`) | Diz se é edição e aplica o limite de 5 edições por dia (11.6) antes de gastar IA. |
| `otcb_salvar_opiniao(usuario, bar, texto, nota)` | serviço | Upsert da opinião aprovada (uma por bar). `oculta_moderacao` volta a `publicada`; ocultas por denúncia ou admin continuam ocultas. Grava a mensagem `sistema`. |
| `otcb_recusar_edicao(usuario, bar)` | serviço | Edição recusada: a versão publicada vira `oculta_moderacao` (11.7). |
| `otcb_registrar_card(tipo, bar, resultado)` | app (`authenticated`) | Mensagem `sistema` (11.13) com texto montado no banco a partir de uma lista fixa de tipo e resultado (sem texto livre do cliente). Limite de 30 por dia. |

Colunas novas: `otcb_opinioes.edicoes_dia` e `edicoes_qtd`, que só o serviço grava e o cliente não lê.

### Funções do Colarinhômetro (épico 8.6; service-only)

| Nome | O que faz |
|---|---|
| `otcb_fotos_hoje(usuario)` | Conta as fotos do dia de SP, inclusive as que não eram chopp (limite de 10, 11.6). |
| `otcb_resultado_foto(foto)` | Depois do insert, devolve `{carimbo_novo, motivo_sem_carimbo, nome_bar, total_carimbos}` e grava a mensagem `sistema` (11.13). Os motivos são `nao_e_chopp`, `sem_bar`, `nao_confirmou`, `ja_tinha` e `limite_dia`. |

Coluna nova: `otcb_fotos.pessoa_identificavel` (13.5 e seção 28). O cliente não lê.

### Jogos (épico 8.9; service-only)

| Nome | O que faz |
|---|---|
| `otcb_jogos_gravar(dados)` | Upsert por `id_externo`; só regrava o que mudou (remarcação de horário). Apaga os cancelados e adiados. |
| `otcb_jogos_disparar()` | `net.http_post` para a `otcb-jogos`, com o segredo `x-otcb-cron` do Vault. |

### Jobs do `pg_cron` (horários em UTC; São Paulo é UTC−3)

| Job | Quando | Chama |
|---|---|---|
| `otcb_cron_recalculo` | 06:00 UTC (03:00 SP) | `otcb_recalcular_todos()` |
| `otcb_cron_limpeza` | 06:30 UTC (03:30 SP) | `otcb_limpeza_diaria()` |
| `otcb_cron_revisita` | 07:00 UTC (04:00 SP) | `otcb_garimpo_disparar('revisita')` |
| `otcb_cron_coordenadas` | 07:30 UTC (04:30 SP) | `otcb_garimpo_disparar('coordenadas')` |
| `otcb_cron_resumos` | 08:00 UTC (05:00 SP) | `otcb_garimpo_disparar('resumos')` |
| `otcb_cron_descoberta` | segunda 05:00 UTC (02:00 SP) | `otcb_garimpo_disparar('descoberta')` |

| `otcb_cron_jogos` | 08:30 UTC (05:30 SP) | `otcb_jogos_disparar()` (8.9) |

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
| Cards de entrada (8.5) | `src/features/cards/` | `otcb_opinioes` (a própria) | `otcb_confirmar_bar`, `otcb_sugerir_bar`, `otcb_registrar_card`, insert em `otcb_denuncias`, Edge Function `otcb-opinioes` |
| T7 Câmera (8.6) | `app/camera.tsx` + `src/features/colarinhometro/` | — | Edge Function `otcb-colarinhometro` |
| T8 Passaporte (8.7) | `app/passaporte.tsx` + `src/features/passaporte/` | `otcb_meu_passaporte` | — |
| T9 Perfil (8.4 e 8.10) | `app/perfil.tsx` + `src/features/profile/` | `otcb_perfis` (`apelido, time_do_coracao`, a própria) | `update` de apelido e time, `delete` em `otcb_mensagens` (próprias), Edge Function `otcb-apagar-conta` |
| Termos e Privacidade (8.10) | `app/termos.tsx`, `app/privacidade.tsx` + `src/lib/legal.ts` | — | — |

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

### Perfil e "Apagar meus dados" (8.10)
- **Apelido e time:** lidos com colunas explícitas e gravados por `update` (grant por coluna do 8.1). A validação reusa `validateNickname` e `nicknameErrorFromDb`, com as mesmas mensagens do onboarding.
- **Termos de uso e Política de privacidade:** telas do app com o texto em `src/lib/legal.ts` (versão 1, 08/11/2026). Abrem sem rede.
  - 25.4 respondida pelo Alexandre (08/11/2026): assina a **Dab Lab**, contato **alexandre@dablab.com.br**.
  - O texto é um rascunho escrito no 8.10, seguindo a seção 20; **precisa de revisão jurídica** antes da publicação.
  - A URL pública que as lojas pedem fica para o 8.11.
- **"Apagar meus dados" (`deleteMyData`):**
  1. etapa 1: alerta com a 15.21; etapa 2: "Apagar tudo";
  2. `otcb-apagar-conta`, com limite de 10 s (critério 2);
  3. só com 200 (ou 401, conta já apagada): telemetria `otcb_conta_apagada` com o uid antigo;
  4. em seguida, apaga do AsyncStorage `otcb_fila_fotos`, `otcb_mensagens_locais`, `otcb_passaporte_cache`, `otcb_selos_vistos` e as chaves `otcb_card:*`, apaga a pasta `Documents/otcb-fila` e esquece a marca de perfil (a marca de instalação fica);
  5. `signOut` local, nova sessão anônima e Boas-vindas.

  Com falha (erro, sem rede ou mais de 10 s), nada é descartado e aparece a 15.9. É diferente do bloqueio de menor (8.1), que descarta a sessão mesmo com falha.
- **Correções do verifier (8.10):**
  - depois de apagar, a pilha é esvaziada (`router.dismissAll()`) antes da Boas-vindas: no Android, o voltar levaria a identidade nova ao Chat sem passar pelos 18+;
  - 401 da função conta como apagada: é a tentativa seguinte a uma que estourou os 10 s depois de o servidor já ter apagado;
  - `otcb_conta_apagada` só sai depois que o servidor apagou, ainda com o uid antigo e com teto de 2 s, para nunca segurar a tela;
  - sem rede ao abrir o Perfil, aparece a 15.9 e "Salvar" fica desligado; o valor carregado não sobrescreve o que a pessoa já digitou;
  - enquanto apaga, "Salvar" e "Limpar conversa" ficam desligados, e o leitor de tela anuncia "Apagando…".
- **Checagem real (08/11/2026):**
  - por script, um usuário com perfil, foto (com arquivo no bucket), carimbo, opinião, denúncia e mensagem foi apagado em 2,6 s;
  - zero linhas nas seis tabelas, pasta vazia no bucket, a evidência ficou com `usuario_id` nulo e o usuário saiu de `auth.users`;
  - no simulador, o fluxo Perfil → Apagar → Boas-vindas funcionou: a conta antiga sumiu e uma identidade anônima nova foi criada;
  - os dados de teste foram limpos e o bar, recalculado.

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

### Cards de entrada (8.5)
- **Estados** (`useCardSubmit`): editando → enviando → registrado (check verde com "pop", A8, haptics) | aviso (15.8, "Não sei", limites) | recusado (15.7, continua editável) | erro (15.9, com "tentar de novo").
- **Persistência:** registrado e aviso ficam no AsyncStorage pela chave mensagem + posição, e o card continua assim ao recarregar o histórico.
- **Confirmação:**
  - "Tem sim", "Não tem mais" e "Fechou", ou "Passa" e "Não passa", chamam `otcb_confirmar_bar`;
  - repetir no mesmo dia mostra a 15.8.
- **Opinião:**
  - texto de 10 a 500 caracteres (fora disso o botão fica desabilitado) e estrelas opcionais;
  - publica pela `otcb-opinioes`;
  - abrir pela Ficha traz a opinião atual (edição).
- **Sugestão:**
  - nome, endereço e bairro;
  - coordenadas: com "Estou no bar agora", o GPS do momento; sem isso, o `Location.geocodeAsync` do sistema;
  - "Não sei" não grava nada (decisão do Alexandre);
  - bar parecido a até 80 m mostra a 15.18.
- **Denúncia:**
  - insert com RLS, uma por opinião;
  - "Denunciar" não aparece na própria opinião, que o app identifica pelo apelido.
- **Ficha:** "Dar opinião" e "Tem Brahma?" fecham a ficha e colocam o card no chat como fala local, sem chamar o agente.
- **Depois de gravar:** confirmação, sugestão e denúncia chamam `otcb_registrar_card` para o agente saber o que aconteceu; a opinião grava a nota pela própria função.

### Edge Function `otcb-opinioes` (13.7; regra 11.7)
- **Entrada:** JWT e `{bar_id, texto 10–500, nota 1–5|null}` (fora disso, 422 `dados_invalidos`).
- **Ordem:**
  1. limite de edição (429 `limite_edicao`, sem gastar IA);
  2. lista de termos (`bloqueio.ts`: telefone, e-mail, links e spam, consumo excessivo, ofensas e ódio explícitos);
  3. `claude-haiku-5-5` com saída estruturada `{permitida, motivo}`; o texto vai entre `<opiniao>` e é tratado só como conteúdo.
- **Respostas:**
  - recusa → 422 `recusada_moderacao`, nada é gravado, e numa edição a versão publicada é ocultada;
  - falha da IA → 503 e não publica;
  - sucesso → 200 `{opiniao_id, status:"publicada"}`.
- **Log:** só evento, origem e motivo; nunca o texto.

### Agente: `oferecer_card` (8.5)
- O servidor monta o bloco de entrada:
  - `pergunta_confirmacao` só para bar do turno, com a pergunta escrita pelo servidor;
  - `formulario_opiniao` com a opinião atual da pessoa;
  - `formulario_sugestao_bar` com os campos cortados no tamanho do banco;
  - `formulario_denuncia` só para opinião vista no turno.
- O agente continua sem ferramenta que grava. Prompt v5.

### Colarinhômetro: app (8.6)
- **Câmera (`expo-camera`):**
  - só a câmera traseira, sem galeria (11.4; hook `guard-gallery` e teste jest);
  - guia tracejada com a dica 15.15;
  - permissão negada mostra a explicação e "Abrir ajustes".
- **Depois da foto:**
  - `prepararFoto` redimensiona para 1280 px no lado maior, JPEG 0,7;
  - pergunta "É chopp Brahma?" (Sim / Não / Não sei);
  - envia com a localização do momento (ou sem ela) e mostra o A4.
- **Resultado:**
  - vira uma fala local do app com o bloco `resultado_colarinho`, guardada em `otcb_mensagens_locais` (AsyncStorage, 30 dias) e misturada ao histórico em ordem;
  - os cards abertos pela Ficha usam o mesmo mecanismo;
  - "Limpar conversa" apaga essas mensagens também.
- **Card de resultado:**
  - A5: a nota sobe e as barrinhas crescem;
  - A6: o carimbo bate, com tremida, confete âmbar e haptics médio;
  - motivo quando não sai carimbo (15.8 do carimbo); "sem bar" oferece sugerir o bar com "estou no bar";
  - "Compartilhar" captura um `ShareCard` fora da tela, só com bar, nota e comentário (`react-native-view-shot` + `expo-sharing`).
- **Fila offline:**
  - sem rede (12.4) ou com a IA fora (12.5), o JPEG é copiado para `Documents/otcb-fila` e entra em `otcb_fila_fotos`;
  - a fila é enviada quando o chat ganha foco, a cada minuto com ele aberto e ao voltar ao app, um processamento por vez;
  - IA fora: até 3 tentativas com 1 min de intervalo; depois, aviso 15.9;
  - mais de 24 h: descartada com aviso.
- **Telemetria:** `otcb_foto_avaliada` e `otcb_carimbo_ganho`, sem foto nem localização.

### Edge Function `otcb-colarinhometro` (13.5; regras 11.4–11.6)
- **Entrada:** multipart com `imagem` (JPEG conferido pelos bytes `FF D8 FF`, de até 1 MB, senão 413), `latitude` e `longitude` (opcionais, juntas), `capturada_em` e `confirmou_brahma`.
- **Ordem:**
  1. JWT.
  2. Validação.
  3. Limite de 10 por dia (429 `limite_fotos`, sem gastar IA).
  4. Visão (`claude-haiku-5-5`, contrato 13.5, 1 nova tentativa) em paralelo com `otcb_bar_mais_proximo`.
  5. Nota da 11.5.
  6. Upload em `{usuario_id}/{foto_id}.jpg`.
  7. Insert em `otcb_fotos` (o trigger cuida de evidência e carimbo); se o insert falha, o arquivo é removido.
  8. `otcb_resultado_foto`.
- **Não é chopp:** a foto é gravada sem nota e devolve 422 `nao_e_chopp` (15.6).
- **Falha da IA:** 503, sem gravar nada.
- **Comentário:** até 120 caracteres, cortado no fim de uma palavra com reticências.
- **Log:** só evento, tempo, `e_chopp`, se teve bar e se saiu carimbo.
- **Checagem real em 08/11/2026:**
  - ~100 m com "Sim" → nota 8,6 e carimbo;
  - ~200 m → sem bar;
  - "Não sei" → `nao_confirmou`;
  - ilustração → `nao_e_chopp`;
  - 3º carimbo do dia → `limite_dia`;
  - o dono baixa a foto e outra conta não;
  - tempo de 2,7 a 4,1 s (6,5 s com a função fria);
  - os dados de teste foram limpos.

### T8 Passaporte (8.7; regra 11.11)
- **Dados:** a tela só mostra o que `otcb_meu_passaporte` devolve. A última resposta fica em cache no aparelho (`otcb_passaporte_cache`) e é mostrada com aviso quando não há rede.
- **O que aparece:**
  - "N bares carimbados";
  - grade de carimbos de borracha (16.4), em que tocar abre a Ficha; os cards da Ficha voltam para o chat como mensagens locais;
  - coleções de todos os bairros com bares ativos, com conquistados e com progresso primeiro;
  - coleção Clássicos, só quando `total > 0` (25.5 adiada pelo Alexandre: sem clássicos por enquanto);
  - os 5 selos, com progresso e nível do Explorador.
- **Princípio 3:** nenhum texto conta chopp ou fotos; o "Olho clínico" fala em "bares".
- **A7:** detecta o selo novo comparando com `otcb_selos_vistos` no aparelho. Na primeira abertura, todos os conquistados contam como novos. Cada novo anima e dispara `otcb_selo_ganho`.
- **Sem rede e sem cache:** 15.9 com "Tentar de novo". Todos os bairros com bares ativos aparecem, os com carimbo primeiro.
- **A11:** a Bolacha gira enquanto carrega e ao puxar para atualizar.
- **Vazio:** a 15.5, com um botão para o Colarinhômetro.
- **Checagem real (08/11/2026):**
  - 3 bares em 3 bairros (2 pelo Colarinhômetro e 1 inserido com data de ontem, por causa do limite de 2 por dia);
  - os números do RPC conferem com a 11.11;
  - apagar a foto manteve os carimbos;
  - os dados foram limpos.

### Opiniões e resumo (8.8)
- **Ficha:**
  - resumo da IA no topo, quando existe (11.8);
  - depois as opiniões publicadas, 10 por página com "Ver mais" (`otcb_opinioes_do_bar` com `p_pagina`);
  - a opinião da própria pessoa aparece à parte, lida pela política `otcb_opinioes_le_proprias`; se estiver oculta (moderação, denúncias ou admin), mostra a 15.17 só para o dono, sem "Denunciar".
- **Denúncias:** a 3ª, de pessoas distintas, oculta a opinião (`oculta_denuncias`, trigger da 8.2). Com menos de 3 publicadas, o resumo volta a nulo.
- **Resumo (garimpo, modo `resumos`):** recebe só texto e nota, nunca o apelido. Sai com até 400 caracteres, cortado no fim de frase ou palavra.
- **Chamadas ao `claude-haiku-5-5`:** usam `max_tokens: 2048` e `effort: "low"`. O modelo raciocina antes de responder, e com 200 tokens o texto de ódio parava em `max_tokens` e virava 503 (bug achado na checagem real).
- **Checagem real (08/11/2026):**
  - ofensa a funcionário, ódio, nome completo de terceiro e incentivo ao excesso foram recusados;
  - a crítica dura foi publicada;
  - o resumo real não citou apelidos;
  - 3 denúncias ocultaram a opinião; o dono continuou vendo e as outras pessoas não;
  - o resumo sumiu com 2 publicadas;
  - os dados foram limpos.

### Edge Function `otcb-jogos` (13.9; épico 8.9)
- **Chamada:** só pelo `pg_cron`, com o cabeçalho `x-otcb-cron` e `verify_jwt = false`.
- **Busca:** uma chamada a `GET /v4/matches` do football-data, de hoje a hoje + 7 no dia de SP, com todas as competições do plano gratuito. A P2 foi confirmada: inclui o Brasileirão Série A.
- **Gravação:**
  - mandante e visitante pelo nome curto;
  - competição em português (Brasileirão, Champions League…);
  - cancelados e adiados são apagados;
  - partida sem time definido fica de fora.
- **football-data fora:** responde 502 e mantém os jogos gravados (12.5). O log leva só o status.
- **Falha ao gravar:** responde 500 (`falha_ao_gravar`), sem detalhe.
- **Registro (12.5):** cada execução vira uma linha em `otcb_execucoes_garimpo` com tipo `jogos` e status `concluida` ou `falhou`. Em `erros` vai só o status do football-data ou `{gravar: true}`, nunca a chave.
- **Erro do disparo:** sem URL ou segredo no Vault, `otcb_jogos_disparar` levanta `jogos_nao_configurado` (migration `20261108001400`).
- **Primeira execução real (08/11/2026):** 36 jogos, 2 do Brasileirão.

### Troca da fonte de jogos para a API-Football (emenda do 8.11)
- **Por quê:** o plano grátis do football-data.org só tinha o Brasileirão Série A entre as competições brasileiras; no dia 08/11/2026 o Vasco jogou a Copa do Brasil e o app não mostrava. Pesquisa de alternativas e decisão do Alexandre no mesmo dia.
- **Fonte:** API-Football (api-sports.io), chave `API_FOOTBALL_KEY` nos segredos da função e no `.env.local`. `GET /fixtures?date=AAAA-MM-DD&timezone=America/Sao_Paulo`, uma chamada por dia (`buscarJanela` em `otcb-jogos/apifootball.ts`).
- **Competições** (lista fechada `LIGAS`, por id): Brasileirão A e B, Copa do Brasil, Supercopa, Copa do Nordeste, Libertadores, Sul-Americana, Recopa, os estaduais de primeira divisão (Paulistão, Carioca, Mineiro, Gaúcho, Paranaense, Catarinense, Baiano, Pernambucano, Cearense, Goiano), Seleção (amistosos, Eliminatórias, Copa do Mundo, Copa América, só jogos do Brasil), Mundial de Clubes, Champions, Liga Europa e as ligas europeias de antes. Fora: Série C e D, divisões inferiores dos estaduais, base e feminino.
- **Gravação:** `id_externo` = `af:<fixture.id>`; nome com "da/de/do" em minúsculo ("Vasco da Gama"); `Brazil` vira `Brasil`; adiado, cancelado, abandonado, suspenso e decidido fora de campo vão para `cancelados` (apagados).
- **Plano grátis (descoberto na carga real):** 100 chamadas por dia, mas só **ontem, hoje e amanhã**. Do 3º dia em diante a API devolve `errors.plan`; a busca para ali e fica com os dias que vieram. Qualquer outro erro (chave, limite) ou carga sem nenhum jogo é falha (12.5): os jogos gravados ficam e o agente avisa.
- **Agente:** `COBERTURA_JOGOS` e `TEXTOS.coberturaJogos` com o novo alcance; prompt v10.
- **Checagem real (08/11/2026):** a carga gravou 44 jogos de hoje e amanhã (Copa do Brasil, Série B, Pernambucano, ligas europeias) e "o vasco joga hoje?" respondeu "Joga sim! Vasco x Palmeiras, pela Copa do Brasil, hoje às 17h" com o card de jogos. Os jogos antigos do football-data (sem prefixo `af:`) foram apagados na troca.

### Nome curto do bar na busca automática (19/11/2026)
- **Caso:** alguns cadastros no Google usam o nome como título de SEO ("Bar do Juarez Itaim Bibi: Chopp, Picanha, Feijoada, Almoço, Drinks, Delivery SP"), e a descoberta gravava o `displayName` inteiro.
- **Regra:** `limparNomeBar` (`otcb-garimpo/nome.ts`) corta no primeiro separador (`:`, `|`, `–`, `—`, ` - `) quando o nome passa de 40 caracteres e, se ainda passar de 60, no fim de palavra. Nomes curtos de filial ("Sao Conrado - Vila Madalena") ficam. Teste `nome_test.ts`.
- **Dados:** "Bar Dois Irmãos" e "Bar do Juarez Itaim Bibi" corrigidos no remoto.

### Jogo mais simples (19/11/2026)
- **Pedido do Alexandre:** "o objetivo do app é ser divertido e não complexo". Grupo 1, só no servidor (migrations `20261119000200` e `20261119000300`):
  - **Carimbo:** o bar pode estar a até 300 m da foto (era 150 m; o GPS dentro de bar erra fácil).
  - **Bairro:** conquistado com 2 carimbos, ou com todos se o bairro tiver 1 bar só. `total_bares` passa a devolver essa meta, então a tela atual mostra "1 de 2" sem mudar o app.
  - **Explorador:** níveis em 3, 10 e 25 bares (eram 5, 15 e 30).
  - **Olho clínico:** nota 8,0 ou mais em 3 bares (eram 9,0 em 5).
  - **Informante:** 10 contribuições quaisquer (confirmação, sugestão de bar, opinião), sem esperar o bar ficar confirmado.
  - **Sugestão feita no bar:** `otcb_sugerir_bar` ganhou `p_no_bar boolean default false`. Com `true`, a evidência é `sugestao_no_bar` (peso 1,0, meia-vida 90, como a foto) e o bar novo já sai confirmado. O app 1.0.1 não manda o campo, então segue como antes; a próxima versão manda quando a pessoa disser que está no bar. O limite de 5 sugestões por dia conta os dois tipos.
- **Testes:** pgTAP 161 (5 casos); 110, 120 e 060 atualizados com a regra nova escrita no comentário.
- **No app:** feito na 1.0.2 (seção seguinte).

### Versão 1.0.2 do app (8.12, 20/11/2026)
- **Plano:** `plans/8.12-versao-1.0.2.md`. Migrations `20261120000100` (enum `sugestao_sem_certeza`) e `20261120000200`; pgTAP 170 (10 casos) e 171 (13 casos); Jest `__tests__/v102/versao-1-0-2.test.tsx`.
- **Sugestão feita no bar:** o card manda `p_no_bar` quando "Estou no bar agora" está ligado; o bar novo sai confirmado. A RPC devolve também `carimbo` (a foto recente sem bar virou carimbo), e o card avisa "o carimbo é seu".
- **"Não sei" cadastra:** `p_tem_brahma` nulo cria o bar com a evidência `sugestao_sem_certeza` (peso 0, meia-vida 60): fica "a confirmar" sem pontuar Brahma, conta no limite de 5 por dia e no Informante, e nunca liga foto. Nulo num bar existente não grava nada. O app 1.0.1 não manda nulo.
- **Resultado da foto sem bar:** o botão vira "Estou num bar que não está no app" e abre a sugestão com a localização do momento.
- **Status na tela:** confirmado e provável aparecem iguais, "tem chopp Brahma", na cor de confirmado (`copy.bar.status`, `Pill.tsx`, `MiniMap.tsx`); incerto segue "a confirmar". A regra interna não mudou.
- **Nota por faixa:** `faixaNota` (`colarinhometro/nota.ts`): ≥ 8 "Tirada de mestre", ≥ 6 "Boa tirada", abaixo "Dá pra melhorar". Aparece logo abaixo do número no resultado, em destaque na imagem de compartilhar e na ficha ("Colarinho: Boa tirada (7,4)", `formatCollar`). `formatScore` passou a reutilizar `notaTexto`.
- **Selo Divulgador:**
  - **Tabela `otcb_compartilhamentos`:** só leitura dos próprios (política `otcb_compartilhamentos_le_proprios`), cascade com o perfil.
  - **RPC `otcb_registrar_compartilhamento(p_origem)`:** origem `colarinho` ou `passaporte`, no máximo 10 por dia; devolve `{dias}`.
  - **No app:** `compartilharImagem` (`src/features/compartilhar/compartilhar.ts`) captura a imagem, abre a folha do sistema e, quando ela fecha, registra na confiança (o sistema não diz se a pessoa postou) e dispara `otcb_compartilhou {origem}`.
  - **Passaporte:** ganhou o botão "Compartilhar" e a `PassportShareCard` (Bolacha comemorando, bares carimbados e selos conquistados; sem apelido, localização, nomes de bar ou marca de cerveja). Depois de compartilhar, recarrega para animar o selo (A7).
  - **Níveis:** 1, 5 e 15 dias diferentes com compartilhamento.
- **Versão do contrato do Passaporte:** `otcb_meu_passaporte(p_versao integer default 1)`; o selo Divulgador só vem com `p_versao >= 2`, que a 1.0.2 manda. O 1.0.1 e o agente (que chama sem argumento) continuam com os 5 selos.
- **Descrições dos selos** em `copy.ts` com as regras do Grupo 1, mais a do Divulgador.

### Foto sem bar ligada ao bar sugerido em seguida (19/11/2026)
- **Caso real:** o Alexandre tirou a foto num bar que não estava no app (saiu sem carimbo, nota 7,9) e cadastrou o bar 2 minutos depois; a foto ficou solta e ele não ganhou o carimbo.
- **Regra nova (pedido dele: "deixar o jogo mais fácil"):** ao sugerir um bar (novo ou que casa com um existente, "tem Brahma"), `otcb_sugerir_bar` chama `otcb_ligar_foto_recente`: a foto mais recente da pessoa, sem bar, de chopp e com "é Brahma", dos últimos 30 minutos, passa a ser do bar. O trigger `otcb_trg_foto_processa` agora também roda quando a foto ganha bar (`update of bar_id`, de nulo para um bar): cria a evidência de foto (peso 1,0, com data de agora, para ser o voto mais recente da pessoa) e o carimbo, e recalcula a média. Migration `20261119000100`, pgTAP 160 (8 casos). Só no servidor.
- **Dados:** a foto do Alexandre foi ligada ao Bar do Brenno (Cidade Monções), que ficou confirmado com nota 7,9; ele ganhou o 2º carimbo.

### Bug da foto em produção e versão 1.0.1 (13/11/2026)
- **Sintoma:** no app da loja, a foto do Colarinhômetro (pela câmera ou pelo chat) dava "sem rede" e ia para a fila, com rede boa. Nenhuma requisição chegava à `otcb-colarinhometro`.
- **Causa:** no Expo SDK 58 o `fetch` global é o `expo/fetch`, que não aceita a parte de arquivo `{ uri, name, type }` do FormData do React Native (lança antes de enviar; o app tratava como rede). No Expo Go e nos testes isso não aparecia.
- **Correção:** a foto vai como `File` do `expo-file-system` (implementa Blob, lido por `bytes()`). Teste `__tests__/colarinhometro/enviar-foto.test.ts`. Versão 1.0.1 (build novo nas duas lojas).
- **Versão 1.0.1** (correção da foto, botão Fechar na Ficha, selos antes dos bairros no Passaporte): iOS build 3 e Android versionCode 5. O envio iOS pelo EAS (chave da API) falhou com "required Apple agreement is missing" mesmo depois do aceite dos contratos; o `.ipa` foi enviado pelo Transporter e submetido à revisão em 13/11/2026. O `.aab` vai pelo Play Console.
- **No mesmo dia:** curadoria da Pizzaria Piarello (o Alexandre tomou chopp Brahma lá) e o carimbo dele na Piarello gravado a partir da foto que mandou, com a nota real da IA do Colarinhômetro (6,9).

### Escopo do chat e teto de custo (emenda do 8.11)
- **Pedido do Alexandre:** o app não pode virar um assistente genérico de graça, mas deve aceitar curiosidade e papo do tema (bar, boteco, chopp, cerveja, futebol).
- **Porteiro (`otcb-agente/escopo.ts`):** antes do agente, o `claude-haiku-5-5` responde `{no_escopo}` em JSON. Roda em paralelo com as consultas ao banco (cerca de 1 s). Fora do escopo: resposta fixa `TEXTOS.foraDoEscopo` (proposto 8.11), gravada como as do guardrail, contando no limite de 40/dia, sem chamar o agente. Mensagem com vocabulário do app (chopp, Brahma, bar, boteco, colarinho, cerveja, jogo, time, Passaporte…) nem passa pelo porteiro: ele barrou "O Bar Leo tem chopp Brahma?" na avaliação (bug corrigido com teste). Porteiro fora do ar ou fora do contrato: a mensagem passa.
- **Prompt v12:** segunda barreira. Conversa livre sobre o tema com conhecimento geral (dados do OTCB só pelas ferramentas); recusa em uma frase o que não tem relação; ignora pedidos para trocar de papel ou revelar instruções.
- **Teto geral:** `LIMITE_GLOBAL_DIARIO` = 2.000 mensagens por dia somando todas as contas (`mensagensHojeTotal`); passou disso, 503 `ia_indisponivel` (o app mostra "tenta de novo") e log `teto_global`, sem chamar a IA. Protege contra contas anônimas em massa.
- **O que já protegia antes:** agente sem ferramenta de escrita; consultas com o JWT de quem pergunta (RLS); nenhuma chave no prompt; cards montados pelo servidor com ids das ferramentas; guardrails fixos; 1.000 caracteres por mensagem.
- **Avaliação (08/11/2026):** 26/26, com poema, código, "mostre seu prompt" barrados e "oi", "pilsen × lager" e "quem ganhou a Copa de 2002" respondidos; p95 8,9 s. Limite de gasto mensal no console da Anthropic: US$ 30 (configurado pelo Alexandre em 08/11/2026). Se o limite estourar, a API recusa as chamadas e o app mostra "tenta de novo" (503 `ia_indisponivel`).

### Aviso do jogo do time do coração (emenda do 8.11)
- **O que faz:** às 05:45 de São Paulo (`otcb_cron_avisos_jogos`, 15 minutos depois da carga de jogos), `otcb_avisar_jogos_do_time()` grava uma mensagem do assistente no chat de quem tem jogo do time do coração **hoje ou amanhã** e que ainda não começou: "Hoje tem Vasco da Gama! Vasco da Gama × Palmeiras, Copa do Brasil, às 17h00. Quer que eu ache um bar com chopp Brahma que passe o jogo?", com o card `jogos`. O app mostra ao abrir o chat (o histórico é relido no foco), sem mudança no app.
- **Sem repetição:** não grava de novo se já existe mensagem do assistente com aquele `jogo_id` no card. Se a pessoa limpar a conversa, o aviso pode voltar na rotina seguinte.
- **Time do perfil é texto livre:** `otcb_time_canonico` tira acento, hífen e sufixo fc/ec/sc e troca apelidos comuns pelo nome da API (Timão → Corinthians, Verdão → Palmeiras, Galo → Atletico-MG, Mengão → Flamengo…). A comparação é exata depois disso, então "Botafogo" não casa com "Botafogo SP".
- **Funções só do serviço;** pgTAP `150_avisos_jogo` (12 casos). Primeira execução no remoto (08/11/2026): 0 avisos, porque o jogo do Vasco do dia já tinha começado.

### Agente: onde ver o jogo (8.9)
- **`jogos_de_hoje`:** com time, devolve `jogos_do_time` e `outros_jogos`. Com time, a busca lê a janela inteira antes de filtrar (o limite de 50 escondia o jogo do time).
- **Jogos desatualizados (12.5):** a última execução da `otcb-jogos` falhou, passou de 36 h ou não existe. Então `jogos_de_hoje` traz `atualizacao_falhou` e a resposta sempre diz "Não consegui atualizar os jogos hoje…": o prompt v7 pede isso e, se o modelo esquecer, o servidor acrescenta a frase.
- **Prompt v6 (v7 = v6 + o aviso da 12.5):**
  - procura o jogo do time hoje;
  - se não tiver, procura nos próximos 7 dias e diz quando é o próximo;
  - depois `buscar_bares` com `transmite_jogos`;
  - sem bar que passa jogo, diz isso e oferece "Passa jogo?" (`pergunta_confirmacao`) para 1 a 3 bares com Brahma da região;
  - converte o horário de UTC para SP e entende apelidos de time (Timão, Verdão…).
- **Texto de rascunho:** o escrito junto com uma consulta (`buscar_bares`, `jogos_de_hoje`…) não vai para a pessoa (bug achado na checagem real).
- **Checagem real (08/11/2026),** com um jogo de teste do Corinthians hoje, um do Santos daqui a 3 dias e o Bar do Juarez passando jogo por duas confirmações de teste:
  - critério 1: jogo e o bar de Pinheiros que passa jogo;
  - critério 2: "Hoje o Santos não entra em campo. O próximo é…";
  - critério 3: no Itaim, nenhum bar que passa jogo, com 3 cards "Passa jogo?".

  Os dados de teste foram limpos.
- **Avaliação:** 20/20 com o prompt v6 (p95 8,2 s) e de novo com o v7 (p50 5,9 s, p95 11,4 s em Wi-Fi). O prompt cresceu; o tempo foi aceito sem rigor pelo Alexandre.
- **Horário dos jogos em São Paulo (bug do 8.11, prompt v8):** com o horário em UTC, o modelo escrevia a conta de fuso ("23:30 UTC = 20:30 em SP.") e isso virava a resposta. Agora `jogos_de_hoje` entrega `inicio_sp` ("sáb 14/11 20:30", função `horarioSp` em `ferramentas.ts`) e o prompt v8 proíbe conta de fuso; o card `jogos` continua com o `inicio` UTC do cache.
- **Cobertura dos jogos (bug do 8.11, prompt v9):** com o Vasco jogando fora do Brasileirão, o agente afirmou "Hoje o Vasco não joga". Agora `jogos_de_hoje` devolve `cobertura` (Brasileirão Série A, ligas europeias e Champions; sem Copa do Brasil, Libertadores, Série B nem estaduais) e o prompt v9 proíbe afirmar que o time não joga: o agente diz que não achou jogo nessas competições. Como o modelo ainda escreveu "Hoje o Vasco não joga" com o v9, o servidor garante: quando o time pedido não tem jogo hoje na base (`timeSemJogoHoje`), `semAfirmarQueNaoJoga` reescreve "hoje o X não joga" e variações e acrescenta `TEXTOS.coberturaJogos` (proposto 8.11). Checagem real em 08/11/2026: "Hoje não tem jogo do Vasco nas competições que o app cobre…" com o aviso de cobertura. Trocar de API para cobrir as outras competições fica para depois.

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

### Publicação (8.11)
- **Status nas lojas:** App Store aprovada em 08/11/2026 (mesmo dia do envio). Google Play: o 1º envio (versionCode 3, 08/11) foi recusado por "Invalid Data safety form" (localização aproximada e exata não declaradas; o app manda a posição ao servidor na hora da pergunta ou da foto). Formulário refeito em 10/11 (localização aproximada e exata coletadas, efêmeras, opcionais, funcionalidade do app; User IDs, mensagens, fotos, interações e conteúdo do usuário; nada compartilhado; exclusão de dados pelo app e por https://suportedablab.carrd.co/) e o 2º envio saiu como **Published** em 10/11/2026, sem build novo.
- **`app.config.ts`** (no lugar do `app.json`):
  - `name: 'OTCB'`, `owner: 'alexsiq'`, bundle e pacote `com.dablab.otcb` (24.8);
  - só iPhone (`supportsTablet: false`, decisão do Alexandre);
  - `usesNonExemptEncryption: false`;
  - permissões só de câmera e localização em uso; o Android bloqueia microfone e localização em segundo plano;
  - splash pelo plugin `expo-splash-screen` (no SDK 58 não fica mais na raiz do config);
  - projeto EAS `@alexsiq/otcb`.
- **`eas.json`:** perfis `development`, `preview` e `production` (`autoIncrement`) e um perfil `screenshots` (build de simulador para os prints); a numeração de build fica no EAS (`appVersionSource: remote`, porque o `autoIncrement` não funciona com `app.config.ts` e numeração local). O envio iOS usa a chave da API do App Store Connect da Dab Lab em `secrets/` (fora do git). O Android sai para teste interno, como rascunho.
- **Ícone e splash:** a bolacha sobre o azul `#1F4AA8` (ícone) e sobre `#F4F7FB` (splash), sem texto e sem copo.
- **Fichas das lojas** em `store/`, geradas com o skill `app-store-dablab`:
  - Support URL do Carrd e política no documento da Dab Lab no Notion, com uma seção do OTCB;
  - questionário de privacidade com localização efêmera, fotos, conteúdo do usuário, ID anônimo e uso;
  - notas de revisão que explicam o app inteiro;
  - classificação esperada 18+.
- **Prints das lojas:** capturas reais do app (build de simulador, iPhone 17 Pro Max) montadas por `store/screenshots/compose.py` (App Store 1320×2868 e 1206×2622) e `compose_play.py` (Play: ícone 512, destaque 1024×500, prints 1080×1920). Para as telas não ficarem vazias, foram criados dados de vitrine temporários (3 usuários de teste com opiniões, fotos e confirmações; carimbos no perfil do simulador) e **apagados** depois das capturas, com recálculo dos bares (08/11/2026).
- **Curadoria dos 33 bares do CSV:** `scripts/curadoria-bares-csv.sql` (idempotente) grava a evidência `curadoria`; aplicado no remoto em 08/11/2026.
- **Marca fora da loja:** o teste `__tests__/store-brand.test.ts` falha se "brahma" aparecer em `store/`, `app.config.ts` ou `eas.json`. Ele reforça o hook `guard-store-brand.sh`, que só age quando o Claude Code roda a partir da pasta do OTCB.

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
| `otcb_sugerir_bar` | Bar novo com `tem_brahma = false` gera `dados_invalidos`; sugestão que casa vira confirmação. | A copy 15.18 diz "sua confirmação foi registrada"; sem Brahma não há o que cadastrar. Assim o limite de 5 por dia conta as evidências `sugestao_usuario`, `sugestao_no_bar` e `sugestao_sem_certeza`. |
| `otcb_detalhes_bar` | Devolve o status real (pode ser `sem_brahma` ou `fechado`). | A assinatura não traz contexto; o agente só mostra os visíveis da 11.9. |
| Fechamento pelo Google | Interpretação literal: um `status_google` fechado só é anulado por foto ou confirmação positiva de usuário mais recente. | O spec não trata o Google voltar a dizer OPERATIONAL; ponto registrado no plano 8.2. |
| CHECK `otcb_fotos_caminho_do_dono` | Restrição a mais. | Garante a pasta `{usuario_id}/` exigida pela 7.2 e pela política de storage. |
| Advisors de `otcb_` (rodados depois de cada migration, a última a da curadoria, 20261108001600, em 08/11/2026; 9 avisos de segurança, os mesmos de antes) | Avisos aceitos, nenhum ERROR. As políticas padrão do `pg_cron` (`cron.job`, `cron.job_run_details`) também aparecem no aviso de acesso anônimo; elas vêm da extensão, filtram por `username = current_user`, e o schema `cron` não é exposto na API. Os demais avisos: RPCs `security definer` executáveis por `authenticated` (a 13.4 exige), políticas acessíveis ao usuário anônimo (a identidade do app é anônima), políticas permissivas múltiplas (nomes da 6.1) e índices ainda sem uso. | Todos vêm do próprio spec. |
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
| Fonte dos títulos (emenda do Alexandre, 08/11/2026) | Bebas Neue no lugar da Baloo 2 (16.3); o texto segue em Nunito. Os tamanhos de título subiram ~20%, porque a Bebas é condensada e só tem maiúsculas. | Combina com a paleta nova (cara de letreiro e de rótulo). |
| Prompt do agente v3 e v4 (8.4) | "Chopp Brahma" no texto e nos títulos; o texto se sustenta sozinho e não fala de "card". | Pedido do Alexandre (só Brahma); a v3 gerou textos como "Mostrei o bar no card acima". |
| Contador de edição de opinião (8.5) | Colunas `edicoes_dia` e `edicoes_qtd` em `otcb_opinioes`. | A 11.6 limita a 5 edições por dia, e a 7.2 não tem onde contar. |
| `otcb_registrar_card` (8.5) | Função nova para a mensagem `sistema` do card. | O passo 3 da 8.5 manda o app gravar a mensagem `sistema`, mas a 6.1 só deixa o serviço inserir mensagens; a função grava texto fixo do servidor, sem texto livre do cliente. |
| "Não sei" na sugestão (8.5) | Não cadastra o bar. | Decisão do Alexandre: o OTCB só lista onde tem chopp Brahma. |
| Opinião × critério 7 (8.5) | Os cards gravam sem o agente. A opinião depende da moderação por IA (11.7) e, sem ela, não publica (15.9). | É a própria regra 11.7. |
| `pessoa_identificavel` (8.6) | Coluna nova em `otcb_fotos`. | A 13.5 e a seção 28 dizem que é gravada; a 7.2 não a lista. |
| Foto "não é chopp" (8.6) | É gravada sem nota (e o arquivo também). | Conta no limite de 10 por dia (11.6) e não gera nota nem evidência (critério 4). |
| Localização opcional na 13.5 (8.6) | Sem coordenadas, a foto é avaliada sem bar. | A seção 17 deixa negar a localização; a nota continua valendo. |
| A6 sem Lottie (8.6) | Carimbo e confete feitos com o Reanimated. | Mesma decisão da A9. |
| Selo novo no resultado (8.6) | `otcb_resultado_foto` não diz se saiu selo. | Fica para o Passaporte (8.7), que calcula os selos. |
| Mensagens locais no aparelho (8.6) | Resultado do Colarinhômetro e cards da Ficha guardados no AsyncStorage por 30 dias. | O bloco de resultado não é gravado em `otcb_mensagens`, porque só o agente grava lá (6.1). |
| Selo e foto apagada (8.7) | O selo "Olho clínico" continua contando a foto apagada pelo dono. | A 11.11 não trata o caso; segue o critério 3 do 8.7, em que a conquista não regride, como o carimbo. Confirmado pelo Alexandre (08/11/2026). |
| Clássicos (8.7) | A coleção só aparece quando há bar clássico. | A 25.5 foi adiada pelo Alexandre (começar sem clássicos). |
| Mascote A9 | Bolacha ao lado das respostas e triste na mensagem não enviada; sem Lottie nem piscar. | As ilustrações são PNG; o piscar entra quando houver Lottie (16.7 deixa a animação livre). |
| Jogos desatualizados (8.9) | Critério de "não atualizou": última execução da `otcb-jogos` com falha, com mais de 36 h ou ausente; o texto do aviso é proposto ("Não consegui atualizar os jogos hoje…"). | A 12.5 pede o aviso, mas não diz quando nem com que texto; o cron é diário, então 36 h dá folga para um atraso. |
| `jogos_de_hoje` com `outros_jogos` (8.9) | A ferramenta devolve até 10 jogos de outros times além dos do time pedido. | O modelo usa como contexto; o card `jogos` mostra só o que ele escolheu. |
| Falha em "Apagar meus dados" (8.10) | A sessão e os dados do aparelho ficam; aparece a 15.9. | O spec não trata a falha. Descartar a sessão faria a pessoa achar que apagou com os dados ainda no servidor. |
| Termos e Privacidade (8.10) | Telas do app com texto embutido, e não links externos. | Funcionam sem rede; a URL pública para as lojas fica para o 8.11. |
| Configuração em `app.config.ts` sem a marca (8.11) | Os textos de permissão do sistema dizem "chopp", sem a marca. | O hook e o teste de marca cobrem `app.config.ts`; o texto de permissão aparece também na revisão da loja. |
| Disponibilidade na loja (8.11) | Só Brasil (decisão do Alexandre). | O conteúdo cobre só São Paulo (anti-escopo "app nacional"); o padrão da Dab Lab é todos os países. |
| Evidência `curadoria` (8.11) | Tipo novo, peso +1,2 e meia-vida de 36.500 dias (na prática não decai). Gravada para os 33 bares do CSV original, que ficam `confirmado`. A semente (caso A da 11.2.1) não muda. | Decisão do Alexandre (08/11/2026): todos os bares do CSV têm chopp Brahma, e no lançamento, sem usuários, nada deve cair sozinho. Peso 1,2 porque com 1,0 o decaimento mínimo já deixava o bar abaixo do limite de confirmado. Uma confirmação negativa (−0,6) ainda derruba para provável. |
| Marca dentro dos prints da loja (8.11) | As capturas do app mostram "chopp Brahma" no chat, no título da lista e no campo de texto, e "Tem Brahma?" na ficha. Os textos da ficha, o nome, o ícone e a imagem de destaque seguem sem a marca. | Decisão do Alexandre (08/11/2026): "pode manter a tela real. falar a palavra brahma em um chat nao é problema". Contraria a nota sobre a marca do spec; risco conhecido de reclamação de marca (Apple 5.2.1). Se a loja recusar, refazer os prints com as telas sem a palavra. |
| Prints com dados de vitrine (8.11) | Opiniões, notas e carimbos de usuários de teste nas telas dos prints, apagados depois. | O plano pedia dados reais, mas a base ainda não tem uso; sem eles as telas ficavam vazias. |
| Numeração de build no EAS (8.11) | `appVersionSource: remote` em vez de local. | O `autoIncrement` não funciona com `app.config.ts` dinâmico e numeração local. |
| Envio antes do teste em aparelho (8.11) | Os builds foram enviados para revisão antes do teste num iPhone e num Android físicos (critério 4 do 8.11); os dois apps já estão publicados (Apple 08/11, Play 10/11). | iPhone: testado pelo Alexandre em 08/11/2026 com o build de produção (TestFlight 1.0.0 (1)), tudo funcionando, inclusive o "Chamar Uber" (abre o Uber com o destino no bar e a origem na localização atual). Android: pendente (teste interno da Play). |
| Fonte de jogos: API-Football no plano grátis (emenda do 8.11) | Troca do football-data.org (13.9 e premissa P2) pela API-Football. No plano grátis a janela é só hoje e amanhã, não 7 dias. | Decisão do Alexandre (08/11/2026) para cobrir Copa do Brasil, estaduais e Seleção. Efeito: o critério 2 do 8.9 ("oferece o próximo jogo dos 7 dias") fica limitado a amanhã até assinar o plano Pro (US$ 19/mês, pré-pago), que libera os 7 dias sem mudar o código. |
| Versão 1.0.2 (8.12) | "Não sei" na sugestão cadastra o bar como a confirmar (a 8.5 dizia que não grava); status "provável" exibido como "tem chopp Brahma" (16.2/16.4 tinham três pílulas); nota mostrada por faixa; selo novo Divulgador fora da 11.11, com a tabela `otcb_compartilhamentos` fora da seção 7; `otcb_meu_passaporte` com `p_versao`. | Pedido do Alexandre: jogo mais simples e estímulo a compartilhar. |
| Jogo mais simples (19/11/2026) | Carimbo a 300 m (11.4 diz 150 m); bairro com 2 carimbos, Explorador 3/10/25, Olho clínico ≥ 8,0 em 3 bares, Informante com qualquer contribuição (11.11); nova evidência `sugestao_no_bar` com peso 1,0 (11.1). | Decisão do Alexandre: o jogo tem que ser divertido e com menos regras. |
| Agente do chat no Haiku (8.11) | `MODELO_AGENTE` = `claude-haiku-5-5`, não o `claude-sonnet-5-5` da seção 4.1. | Decisão do Alexandre (08/11/2026) por custo. Avaliação 26/26 (p50 3,7 s, p95 5,5 s, contra 4,9 s e 8,9 s com o Sonnet). Na troca, o Haiku esqueceu o card do Passaporte; o servidor passou a acrescentá-lo quando `meu_passaporte` é consultado (teste). Duas perguntas da avaliação foram corrigidas: o Bar Leo virou confirmado com a curadoria (o caso c4 usa agora o Bar Brahma Paulista, ainda a confirmar) e a expressão do caso ambev casava com "não sou da Ambev". |
