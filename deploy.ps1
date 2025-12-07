# deploy.ps1
# Requisitos: Node/NPM, PowerShell, OpenSSH (ssh/scp) no PATH

$VPS_IP   = "72.61.222.166"
$VPS_USER = "root"
$CURRENT  = "/opt/fluxo7arena/current"
$sshTarget = "$VPS_USER@$VPS_IP"

# (Opcional) Mitigar travas do esbuild no Windows
try { Stop-Process -Name node -Force -ErrorAction SilentlyContinue } catch {}
try { Stop-Process -Name esbuild -Force -ErrorAction SilentlyContinue } catch {}
try { Remove-Item -Recurse -Force ".\node_modules\esbuild" -ErrorAction SilentlyContinue } catch {}

Write-Host "Instalando dependências (npm ci)" -ForegroundColor Cyan
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci falhou" }

Write-Host "Gerando build (npm run build)" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build falhou" }

if (!(Test-Path -Path "dist")) { throw "Pasta 'dist' não encontrada." }

# Limpezas/artefatos locais (evita uploads indesejados e múltiplos ssh)
try { Remove-Item -Force -ErrorAction SilentlyContinue "dist\OneDrive - Personal - Atalho.lnk" } catch {}

# Grava versão do deploy localmente (vai junto no scp)
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
try { Set-Content -Path "dist\DEPLOY_VERSION.txt" -Value "Build: $ts" -Encoding UTF8 } catch {}

Write-Host "Enviando build (dist) para o servidor..." -ForegroundColor Cyan
# ÚNICA operação interativa (scp) => ÚNICO prompt de senha
scp -r -C ./dist/* "${sshTarget}:${CURRENT}/"
if ($LASTEXITCODE -ne 0) { throw "Falha no envio (scp)" }

Write-Host "Deploy concluído com sucesso!" -ForegroundColor Green