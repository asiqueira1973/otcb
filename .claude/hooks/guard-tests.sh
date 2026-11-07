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
