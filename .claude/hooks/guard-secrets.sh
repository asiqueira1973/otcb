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
