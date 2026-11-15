#!/usr/bin/env bash
# Instala e sobe o OpenWA (WhatsApp não oficial) para lembretes e avisos internos.
# NÃO use para atendimento ao público: para isso, use a API oficial do WhatsApp.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$DIR/OpenWA"

command -v git >/dev/null    || { echo "Erro: git não encontrado."; exit 1; }
command -v docker >/dev/null || { echo "Erro: Docker não encontrado. Instale o Docker Desktop."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Erro: 'docker compose' indisponível."; exit 1; }

if [ ! -d "$REPO/.git" ]; then
  git clone --depth 1 https://github.com/rmyndharis/OpenWA.git "$REPO"
else
  echo "OpenWA já clonado em $REPO (pulando clone)."
fi

# Configuração pensada para LEMBRETES: poucas mensagens, ritmo de humano.
# Só cria o .env se não existir, para não sobrescrever ajustes seus.
if [ ! -f "$REPO/.env" ]; then
  cat > "$REPO/.env" <<'ENV'
TZ=America/Sao_Paulo
# Expõe o MCP em http://localhost:2785/mcp (permite o Claude Code ler/enviar mensagens)
MCP_ENABLED=true
# false = libera também as ferramentas de envio (necessário para lembretes)
MCP_READONLY=false
# Limite diário que cresce com a idade da sessão (reduz risco de banimento)
SEND_PACING_ENABLED=true
# Simula "digitando..." antes de enviar (padrão, deixado explícito)
SIMULATE_TYPING=true
# Só acessível pelo próprio computador. NÃO mude para 0.0.0.0 sem saber o que faz.
BIND_HOST=127.0.0.1
ENV
  echo "Criado $REPO/.env"
fi

cd "$REPO"
docker compose -f docker-compose.dev.yml up -d --build

echo
echo "Aguardando o serviço ficar pronto..."
for _ in $(seq 1 60); do
  if curl -fs http://localhost:2785/api/health/ready >/dev/null 2>&1; then
    echo "OpenWA no ar: http://localhost:2785"
    break
  fi
  sleep 5
done

echo
echo "Chave de ADMIN (usada para entrar no painel):"
cat "$REPO/data/.api-key" 2>/dev/null || docker exec openwa-api cat /app/data/.api-key
echo
echo
echo "Próximos passos: veja openwa/README.md (a partir do passo 3)."
