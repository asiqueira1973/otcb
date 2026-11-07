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
