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
