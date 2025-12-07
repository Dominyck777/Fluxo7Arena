# deploy.ps1
# Requisitos: Node/NPM, PowerShell, OpenSSH (ssh/scp) no PATH
# Uso: .\deploy.ps1 [-SkipInstall]

param(
  [switch]$SkipInstall
)

$VPS_IP   = "72.61.222.166"
$VPS_USER = "root"
$ROOT_DIR = "/opt/fluxo7arena"
$CURRENT  = "$ROOT_DIR/current"
$INCOMING = "$ROOT_DIR/incoming"
$sshTarget = "$VPS_USER@$VPS_IP"

# (Opcional) Mitigar travas do esbuild no Windows
try { Stop-Process -Name node -Force -ErrorAction SilentlyContinue } catch {}
try { Stop-Process -Name esbuild -Force -ErrorAction SilentlyContinue } catch {}
try { Remove-Item -Recurse -Force ".\node_modules\esbuild" -ErrorAction SilentlyContinue } catch {}

if (-not $SkipInstall) {
  Write-Host "Instalando dependências (npm ci)" -ForegroundColor Cyan
  npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm ci falhou" }
} else {
  Write-Host "Pulando instalação de dependências (SkipInstall)" -ForegroundColor Yellow
}

Write-Host "Gerando build (npm run build)" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build falhou" }

if (!(Test-Path -Path "dist")) { throw "Pasta 'dist' não encontrada." }

# Versão do deploy (vai junto no scp)
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
try { Set-Content -Path "dist\DEPLOY_VERSION.txt" -Value "Build: $ts" -Encoding UTF8 } catch {}

# Fase 1: preparar pastas remotas e enviar tudo para INCOMING/<release>
$releaseName = Get-Date -Format "yyyyMMddHHmmss"
$remoteIncoming = "$INCOMING/$releaseName"

Write-Host "Preparando pastas remotas..." -ForegroundColor Cyan
ssh $sshTarget "mkdir -p '$remoteIncoming' '$CURRENT'"
if ($LASTEXITCODE -ne 0) { throw "Falha ao preparar pastas no servidor" }

Write-Host "Enviando build para pasta temporária: $remoteIncoming" -ForegroundColor Cyan
scp -r -C ./dist/* "${sshTarget}:${remoteIncoming}/"
if ($LASTEXITCODE -ne 0) { throw "Falha no envio (scp)" }

# Fase 2: publicar assets e só então o index.html (evita MIME text/html em scripts)
Write-Host "Publicando release (assets primeiro, index.html por último)..." -ForegroundColor Cyan

# Construir comando remoto em uma única linha para evitar problemas de here-string/EOF
$remoteCmd = "set -e; " +
  "if [ -f '$remoteIncoming/index.html' ]; then mv '$remoteIncoming/index.html' '$remoteIncoming/index.html.deployhold'; fi; " +
  "mkdir -p '$CURRENT'; " +
  "cp -r '$remoteIncoming/'* '$CURRENT/' 2>/dev/null || true; " +
  "if [ -f '$remoteIncoming/index.html.deployhold' ]; then mv '$remoteIncoming/index.html.deployhold' '$CURRENT/index.html'; fi; " +
  "rm -rf '$remoteIncoming'"

# Use sh -lc para garantir execução consistente
ssh $sshTarget "sh -lc ""$remoteCmd"""
if ($LASTEXITCODE -ne 0) { throw "Falha ao publicar release" }

Write-Host "Deploy concluído com sucesso!" -ForegroundColor Green