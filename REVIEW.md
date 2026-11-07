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
