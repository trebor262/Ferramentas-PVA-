# Instala e sobe o OpenWA no Windows (sem precisar de Git nem Bash).
# Requer o Docker Desktop instalado e aberto. Mensagens sem acento de proposito (compatibilidade).
$ErrorActionPreference = 'Stop'
$Aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Join-Path $Aqui 'OpenWA'

function Falha($msg) {
  Write-Host ""
  Write-Host "ERRO: $msg" -ForegroundColor Red
  exit 1
}

function DockerPronto {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  docker info 2>&1 | Out-Null
  $ok = ($LASTEXITCODE -eq 0)
  $ErrorActionPreference = $old
  return $ok
}

# 1. Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Falha "Docker nao encontrado. Instale o Docker Desktop (https://www.docker.com/products/docker-desktop/), abra-o e rode de novo."
}
if (-not (DockerPronto)) {
  Falha "O Docker Desktop esta fechado ou ainda iniciando. Abra-o, espere ate aparecer 'Engine running' e rode de novo."
}

# 2. Baixar o OpenWA (arquivo ZIP, nao precisa de Git)
if (-not (Test-Path (Join-Path $Repo 'docker-compose.dev.yml'))) {
  Write-Host "Baixando o OpenWA..."
  $zip = Join-Path $env:TEMP 'openwa.zip'
  $tmp = Join-Path $env:TEMP 'openwa-extract'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri 'https://github.com/rmyndharis/OpenWA/archive/refs/heads/main.zip' -OutFile $zip -UseBasicParsing
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $pasta = Get-ChildItem $tmp -Directory | Select-Object -First 1
  Move-Item $pasta.FullName $Repo
  Remove-Item $zip -Force
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
} else {
  Write-Host "OpenWA ja baixado (pulando)."
}

# 3. Configuracao para lembretes (so cria se nao existir)
$envFile = Join-Path $Repo '.env'
if (-not (Test-Path $envFile)) {
  $conteudo = @"
TZ=America/Sao_Paulo
MCP_ENABLED=true
MCP_READONLY=false
SEND_PACING_ENABLED=true
SIMULATE_TYPING=true
BIND_HOST=127.0.0.1
"@
  [IO.File]::WriteAllText($envFile, $conteudo, (New-Object Text.UTF8Encoding $false))
  Write-Host "Configuracao criada."
}

# 4. Subir (a primeira vez demora varios minutos)
Write-Host ""
Write-Host "Construindo e iniciando o OpenWA. Na primeira vez isso demora VARIOS MINUTOS. Nao feche esta janela."
Push-Location $Repo
$ErrorActionPreference = 'Continue'
docker compose -f docker-compose.dev.yml up -d --build
$codigo = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
Pop-Location
if ($codigo -ne 0) { Falha "A construcao falhou. Copie as ultimas linhas acima e envie para o suporte." }

# 5. Esperar ficar pronto
Write-Host ""
Write-Host "Aguardando o servico ficar pronto..."
$pronto = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $r = Invoke-WebRequest -Uri 'http://localhost:2785/api/health/ready' -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) { $pronto = $true; break }
  } catch { }
  Start-Sleep -Seconds 5
}
if (-not $pronto) { Falha "O servico nao respondeu em 5 minutos. Veja os logs: docker compose -f docker-compose.dev.yml logs (dentro da pasta OpenWA)." }

# 6. Chave de admin
$old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$chave = (docker exec openwa-api cat /app/data/.api-key 2>$null)
$ErrorActionPreference = $old

Write-Host ""
Write-Host "PRONTO! OpenWA no ar: http://localhost:2785" -ForegroundColor Green
Write-Host ""
Write-Host "Sua chave de ADMIN (para entrar no painel). GUARDE e NAO compartilhe com ninguem:"
Write-Host $chave -ForegroundColor Yellow
Write-Host ""
Start-Process 'http://localhost:2785'
