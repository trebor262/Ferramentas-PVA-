#!/usr/bin/env bash
# Envia uma mensagem de lembrete pelo OpenWA.
# Uso: OPENWA_API_KEY=... OPENWA_SESSION_ID=... ./enviar-lembrete.sh 5571999999999 "Reunião às 15h"
set -euo pipefail

NUMERO="${1:?Informe o número com DDI+DDD, só dígitos. Ex.: 5571999999999}"
TEXTO="${2:?Informe o texto do lembrete}"
: "${OPENWA_API_KEY:?Defina OPENWA_API_KEY (chave operador criada no painel)}"
: "${OPENWA_SESSION_ID:?Defina OPENWA_SESSION_ID (id da sessão, visível no painel/Swagger)}"
URL="${OPENWA_URL:-http://localhost:2785}"

# Monta o JSON com python3 para escapar aspas/quebras de linha com segurança.
PAYLOAD="$(python3 -c 'import json,sys; print(json.dumps({"chatId": sys.argv[1]+"@c.us", "text": sys.argv[2]}))' "$NUMERO" "$TEXTO")"

curl -fsS -X POST "$URL/api/sessions/$OPENWA_SESSION_ID/messages/send-text" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $OPENWA_API_KEY" \
  -d "$PAYLOAD"
echo
