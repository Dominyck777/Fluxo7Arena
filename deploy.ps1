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

# (Opcional) Mitigar travas esporádicas do esbuild no Windows
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

# Remover artefatos indesejados
try { Remove-Item -Force -ErrorAction SilentlyContinue "dist\OneDrive - Personal - Atalho.lnk" } catch {}

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

# Fase 2: publicar assets e só então o index.html
Write-Host "Publicando release (assets primeiro, index.html por último)..." -ForegroundColor Cyan

# 2.1 Cria script POSIX local com LF
$remoteScript = @'
set -e

# 1) Segura o index.html
if [ -f "$REMOTE_INCOMING/index.html" ]; then
  mv "$REMOTE_INCOMING/index.html" "$REMOTE_INCOMING/index.html.deployhold"
fi

# 2) Copia tudo para a pasta atual (assets primeiro; o index está segurado)
mkdir -p "$CURRENT"
cp -r "$REMOTE_INCOMING/"* "$CURRENT/" 2>/dev/null || true

# 3) Publica o index.html por último
if [ -f "$REMOTE_INCOMING/index.html.deployhold" ]; then
  mv "$REMOTE_INCOMING/index.html.deployhold" "$CURRENT/index.html"
fi

# 4) Limpa pasta temporária
rm -rf "$REMOTE_INCOMING"

# 5) Normaliza permissões (dirs 755, arquivos 644)
find "$CURRENT" -type d -exec chmod 755 {} \;
find "$CURRENT" -type f -exec chmod 644 {} \;
'@

# Converte CRLF -> LF e grava em arquivo temporário
$remoteScriptLF = ($remoteScript -replace "`r`n", "`n") -replace "`r", "`n"
$tempScript = Join-Path $env:TEMP ("publish-" + $releaseName + ".sh")
[System.IO.File]::WriteAllText($tempScript, $remoteScriptLF, (New-Object System.Text.UTF8Encoding($false)))

# 2.2 Envia script para a VPS e executa com variáveis de ambiente
$remoteScriptPath = "/tmp/publish-$releaseName.sh"
scp $tempScript "${sshTarget}:${remoteScriptPath}"
if ($LASTEXITCODE -ne 0) { throw "Falha ao enviar script de publicação" }

$envRun = "REMOTE_INCOMING='$remoteIncoming' CURRENT='$CURRENT' bash '$remoteScriptPath' && rm -f '$remoteScriptPath'"
ssh $sshTarget $envRun
if ($LASTEXITCODE -ne 0) { throw "Falha ao publicar release" }

# Limpa o temp local
try { Remove-Item -Force $tempScript } catch {}

Write-Host "Deploy concluído com sucesso!" -ForegroundColor Green