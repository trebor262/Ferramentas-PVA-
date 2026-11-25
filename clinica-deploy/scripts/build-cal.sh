#!/usr/bin/env bash
# Constrói a imagem do cal.diy a partir do código-fonte (não existe imagem pronta publicada).
# Requisitos: Docker, git, ~8 GB de RAM livre durante o build, ~15 GB de disco. Leva 10-20 min.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

CAL_COMMIT=ae027bb70e694e2d2c44569f398d6cbcee0389b1   # versão testada
if [ ! -d cal.diy ]; then
  git clone https://github.com/calcom/cal.diy.git cal.diy
fi
git -C cal.diy fetch --depth 1 origin "$CAL_COMMIT" 2>/dev/null || git -C cal.diy fetch origin
git -C cal.diy checkout -q "$CAL_COMMIT"

# O build do Next.js precisa de um banco acessível: sobe um Postgres temporário só para isso.
TMP_PW="$(openssl rand -hex 8)"
docker rm -f cal-build-db >/dev/null 2>&1 || true
docker run -d --name cal-build-db -p 127.0.0.1:5433:5432 \
  -e POSTGRES_USER=build -e POSTGRES_PASSWORD="$TMP_PW" -e POSTGRES_DB=calendso postgres:16 >/dev/null
trap 'docker rm -f cal-build-db >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 30); do docker exec cal-build-db pg_isready -U build >/dev/null 2>&1 && break; sleep 1; done
DBURL="postgresql://build:${TMP_PW}@localhost:5433/calendso"

( cd cal.diy && docker build --network host -t cal-diy:prod \
    --build-arg DATABASE_URL="$DBURL" \
    --build-arg NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
    --build-arg CALENDSO_ENCRYPTION_KEY="$CALENDSO_ENCRYPTION_KEY" \
    --build-arg CALCOM_TELEMETRY_DISABLED=1 \
    --build-arg NEXT_PUBLIC_WEBAPP_URL="https://${CAL_HOST}" \
    -f Dockerfile . )
echo "Imagem cal-diy:prod criada."
