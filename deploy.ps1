# deploy.ps1
# Requisitos: Node/NPM, PowerShell, OpenSSH (ssh/scp) no PATH
# Uso: .\deploy.ps1 [-SkipInstall] [-SkipReleaseNotes]

param(
  [switch]$SkipInstall,
  [switch]$SkipReleaseNotes
)

# Forçar UTF-8 no console para evitar caracteres quebrados (ex: 'pós-login')
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  [Console]::InputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

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

# Identificador único do deploy/release
$releaseName = Get-Date -Format "yyyyMMddHHmmss"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Coletar versionLabel e itens do modal de novidades (interativo)
$versionLabel = ""
try {
  $rnPath = Join-Path $PSScriptRoot "src\lib\releaseNotes.js"
  if (Test-Path $rnPath) {
    $raw = Get-Content $rnPath -Raw -ErrorAction SilentlyContinue
    if ($raw) {
      $m = [regex]::Match($raw, "APP_VERSION\s*=\s*'([^']+)'", "IgnoreCase")
      if ($m.Success) { $versionLabel = $m.Groups[1].Value }
    }
  }
} catch {}

$items = @()
if (-not $SkipReleaseNotes) {
  Write-Host "\n=== Release Notes (Modal pós-login) ===" -ForegroundColor Cyan
  if ($versionLabel) {
    $versionInput = Read-Host "Versão para exibir (Enter mantém '$versionLabel')"
    if ($versionInput -and $versionInput.Trim()) { $versionLabel = $versionInput.Trim() }
  } else {
    $versionInput = Read-Host "Versão para exibir (ex: v2.5.1)"
    if ($versionInput -and $versionInput.Trim()) { $versionLabel = $versionInput.Trim() }
  }

  Write-Host "Digite os itens (1 por linha). Digite 'ok' ou deixe vazio para finalizar." -ForegroundColor Yellow
  while ($true) {
    $line = Read-Host "Item"
    if (-not $line) { break }
    $t = $line.Trim()
    if (-not $t) { break }
    if ($t.ToLower() -eq 'ok') { break }
    $items += $t
  }
}

if (-not $versionLabel) { $versionLabel = "v?" }

# Gerar release-notes.json dentro do dist (vai junto no scp)
try {
  $releaseObj = [ordered]@{
    releaseId = $releaseName
    builtAt = $ts
    versionLabel = $versionLabel
    items = $items
  }
  $json = $releaseObj | ConvertTo-Json -Depth 8
  Set-Content -Path "dist\release-notes.json" -Value $json -Encoding UTF8
  Write-Host "Release notes gerado: dist\\release-notes.json (releaseId=$releaseName)" -ForegroundColor Green
} catch {
  Write-Host "Falha ao gerar dist\\release-notes.json: $($_.Exception.Message)" -ForegroundColor Red
  throw
}

# Versão do deploy (vai junto no scp)
try {
  $deployInfo = @(
    "ReleaseId: $releaseName",
    "Version: $versionLabel",
    "BuiltAt: $ts"
  ) -join "`n"
  Set-Content -Path "dist\DEPLOY_VERSION.txt" -Value $deployInfo -Encoding UTF8
} catch {}

# Fase 1: preparar pastas remotas e enviar tudo para INCOMING/<release>
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