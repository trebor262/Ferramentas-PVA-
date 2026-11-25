#!/usr/bin/env bash
# Backup diário dos dois bancos. Agende no cron:  0 3 * * * /caminho/clinica-deploy/scripts/backup.sh
# Copie a pasta backups/ para FORA do servidor (outro provedor/armazenamento criptografado).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups; chmod 700 backups
D="$(date +%F)"
docker compose exec -T cal-db pg_dump -U cal calendso | gzip > "backups/cal-$D.sql.gz"
docker compose exec -T chatwoot-db pg_dump -U postgres chatwoot_production | gzip > "backups/chatwoot-$D.sql.gz"
find backups -type f -mtime +14 -delete
echo "Backup de $D concluído."
