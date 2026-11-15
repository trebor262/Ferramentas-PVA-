# Instala e roda o OpenWA no Windows SEM Docker (usa Node.js 22).
# Mensagens sem acento de proposito (compatibilidade com o PowerShell do Windows).
$ErrorActionPreference = 'Stop'
$Aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Join-Path $Aqui 'OpenWA'

function Falha($msg) {
  Write-Host ""
  Write-Host "ERRO: $msg" -ForegroundColor Red
  exit 1
}

# 1. Node.js 22.19 ou mais novo
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Falha "Node.js nao encontrado. Instale a versao LTS em https://nodejs.org (baixe o instalador .msi, avance ate o fim), feche esta janela e rode de novo."
}
$ver = (node -v).TrimStart('v')
$partes = $ver.Split('.')
$maior = [int]$partes[0]; $menor = [int]$partes[1]
if (($maior -lt 22) -or (($maior -eq 22) -and ($menor -lt 19))) {
  Falha "Seu Node.js e o v$ver, mas o OpenWA precisa do v22.19 ou mais novo. Instale o LTS atual em https://nodejs.org e rode de novo."
}
Write-Host "Node.js v$ver OK."

# 2. Baixar o OpenWA (ZIP, nao precisa de Git)
if (-not (Test-Path (Join-Path $Repo 'package.json'))) {
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
"@
  [IO.File]::WriteAllText($envFile, $conteudo, (New-Object Text.UTF8Encoding $false))
  Write-Host "Configuracao criada."
}

# 4. Instalar dependencias (so na primeira vez)
Set-Location $Repo
$completo = (Test-Path (Join-Path $Repo 'node_modules\.bin\concurrently.cmd')) -and `
            (Test-Path (Join-Path $Repo 'dashboard\node_modules\.bin\vite.cmd'))
if (-not $completo) {
  Write-Host ""
  if (Test-Path (Join-Path $Repo 'node_modules')) {
    Write-Host "Instalacao anterior incompleta. Limpando e refazendo..."
    Remove-Item (Join-Path $Repo 'node_modules') -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $Repo 'dashboard\node_modules') -Recurse -Force -ErrorAction SilentlyContinue
  }
  Write-Host "Instalando dependencias. Na primeira vez demora VARIOS MINUTOS. Nao feche esta janela."
  $ErrorActionPreference = 'Continue'
  npm ci
  $codigo = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($codigo -ne 0) {
    Falha "A instalacao das dependencias falhou. Copie as ultimas linhas acima e envie para o suporte. Dica: se o erro falar de 'gyp', 'Visual Studio' ou 'prebuild', instale o Node.js 22 LTS (nodejs.org/en/download, versao 22.x) no lugar da versao atual."
  }
  if (-not (Test-Path (Join-Path $Repo 'node_modules\.bin\concurrently.cmd'))) {
    Falha "A instalacao terminou mas faltam arquivos (concurrently). Feche, apague a pasta OpenWA\node_modules e rode de novo."
  }
}

# 5. Iniciar (esta janela precisa ficar aberta enquanto o OpenWA estiver em uso)
Write-Host ""
Write-Host "Iniciando o OpenWA. Quando aparecer 'ready' ou 'listening', abra:  http://localhost:2886" -ForegroundColor Green
Write-Host "A chave de ADMIN fica no arquivo: $Repo\data\.api-key  (aparece tambem aqui na primeira vez). NAO compartilhe." -ForegroundColor Yellow
Write-Host "Para parar o OpenWA, feche esta janela."
Write-Host ""
Start-Job -ScriptBlock { Start-Sleep -Seconds 45; Start-Process 'http://localhost:2886' } | Out-Null
npm run dev
