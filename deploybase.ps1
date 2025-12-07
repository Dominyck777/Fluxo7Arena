# ========================================
# UPLOAD FRONTEND PARA VPS (API DISTRIBUÍDA)
# ========================================

$VPS_IP = "72.61.42.198"
$VPS_USER = "root"
$FRONTEND_DIR = "$PSScriptRoot\dist"
$VPS_DEST = "/opt/bi-web/"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "   UPLOAD FRONTEND - API DISTRIBUÍDA" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Fazer build do frontend
Write-Host "[INFO] Fazendo build do frontend..." -ForegroundColor Cyan
Write-Host ""
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERROR] Falha no build!" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "[INFO] Build concluído com sucesso!" -ForegroundColor Green

# Verificar se pasta dist existe
if (-Not (Test-Path $FRONTEND_DIR)) {
    Write-Host "[ERROR] Pasta dist não foi criada!" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host "[INFO] Verificando arquivos..." -ForegroundColor Cyan
$fileCount = (Get-ChildItem -Path $FRONTEND_DIR -Recurse -File).Count
Write-Host "       Encontrados $fileCount arquivos na pasta dist/" -ForegroundColor Green
Write-Host ""

Write-Host "[INFO] Fazendo upload via SCP..." -ForegroundColor Cyan
Write-Host "       Origem: $FRONTEND_DIR" -ForegroundColor Gray
Write-Host "       Destino: ${VPS_USER}@${VPS_IP}:${VPS_DEST}" -ForegroundColor Gray
Write-Host ""

# Upload usando SCP (recursivo)
scp -r "$FRONTEND_DIR" "${VPS_USER}@${VPS_IP}:${VPS_DEST}"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host "   ✓ FRONTEND ENVIADO COM SUCESSO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Arquivos em: /opt/bi-web/dist/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "PRÓXIMOS PASSOS:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Configurar Nginx na VPS" -ForegroundColor Gray
    Write-Host "2. Atualizar Supabase com IPs das APIs" -ForegroundColor Gray
    Write-Host "3. Configurar firewall nas máquinas com API" -ForegroundColor Gray
    Write-Host "4. Iniciar bi_api.exe em cada máquina" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Ver guia completo: CONFIGURAR_API_DISTRIBUIDA.md" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "[ERROR] Falha no upload!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifique:" -ForegroundColor Yellow
    Write-Host "  - SSH funcionando: ssh root@72.61.42.198" -ForegroundColor Gray
    Write-Host "  - Senha correta" -ForegroundColor Gray
    Write-Host "  - Pasta /opt/bi-web/ existe na VPS" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
