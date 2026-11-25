#!/usr/bin/env bash
# Gera os segredos que estiverem vazios no .env (não sobrescreve os que já existem).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env
fill() {  # fill NOME VALOR
  if grep -qE "^$1=$" .env; then
    sed -i "s|^$1=$|$1=$2|" .env
    echo "gerado: $1"
  fi
}
fill CAL_DB_PASSWORD            "$(openssl rand -hex 16)"
fill NEXTAUTH_SECRET            "$(openssl rand -base64 32)"
fill CALENDSO_ENCRYPTION_KEY    "$(openssl rand -base64 24)"
fill CHATWOOT_DB_PASSWORD       "$(openssl rand -hex 16)"
fill CHATWOOT_REDIS_PASSWORD    "$(openssl rand -hex 16)"
fill CHATWOOT_SECRET_KEY_BASE   "$(openssl rand -hex 64)"
fill CAL_WEBHOOK_SECRET         "$(openssl rand -hex 24)"
chmod 600 .env
echo "Pronto. Guarde uma cópia do .env em local seguro (gerenciador de senhas): sem ele não há como recuperar os dados criptografados."
