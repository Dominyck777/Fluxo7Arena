# deploy.ps1
# Uso: .\deploy.ps1
# Pré-requisitos locais: Node/NPM, PowerShell, scp e ssh no PATH (ou use PuTTY pscp/plink e ajuste os comandos)

$VPS_IP      = "72.61.222.166"
$VPS_USER    = "root"
$APP_ROOT    = "/opt/fluxo7arena"
$CURRENT     = "$APP_ROOT/current"

# 1) Build local
# Ajuste os comandos conforme seu projeto
npm run build

# 2) Validar build
if (-not (Test-Path "dist")) { throw "Pasta 'dist' não encontrada. Confirme se 'npm run build' gerou o build." }

# 3) Enviar usando scp (uma única cópia). Pode pedir a senha uma vez.
${remoteTarget} = "${VPS_USER}@${VPS_IP}:$CURRENT/"
Write-Host " Enviando dist/ para $remoteTarget ..."
scp -r "dist/*" $remoteTarget
if ($LASTEXITCODE -ne 0) { throw "Falha no scp (código $LASTEXITCODE)." }

Write-Host " Deploy concluído (SPA copiada para $CURRENT). Se precisar, normalize permissões na VPS:"
Write-Host "   find $CURRENT -type d -print0 | xargs -0 chmod 755"
Write-Host "   find $CURRENT -type f -print0 | xargs -0 chmod 644"