# Script de Importação PRODUÇÃO - Importa DE VERDADE no banco
# PowerShell Script

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Red
Write-Host "⚠️  ATENÇÃO: MODO PRODUÇÃO - VAI INSERIR NO BANCO DE VERDADE!" -ForegroundColor Red
Write-Host "================================================================================" -ForegroundColor Red
Write-Host ""
Write-Host "Este script vai:" -ForegroundColor Yellow
Write-Host "  • Ler o arquivo pessoas.csv" -ForegroundColor White
Write-Host "  • Processar 50 registros" -ForegroundColor White
Write-Host "  • INSERIR DE VERDADE na tabela clientes do Supabase" -ForegroundColor Red
Write-Host "  • Empresa: 1006" -ForegroundColor White
Write-Host ""

# Confirmação
$confirmacao = Read-Host "Tem certeza que deseja continuar? (digite SIM para confirmar)"

if ($confirmacao -ne "SIM") {
    Write-Host ""
    Write-Host "❌ Importação cancelada pelo usuário." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 0
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "INICIANDO IMPORTAÇÃO EM MODO PRODUÇÃO" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Lê o arquivo Python
$scriptPath = "importar_clientes.py"
if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ Arquivo importar_clientes.py não encontrado!" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

$conteudo = Get-Content $scriptPath -Raw

# Verifica se já está em modo produção
if ($conteudo -match "DRY_RUN = False") {
    Write-Host "✅ Script já está em modo PRODUÇÃO" -ForegroundColor Green
} else {
    Write-Host "🔄 Alterando script para modo PRODUÇÃO..." -ForegroundColor Yellow
    $conteudo = $conteudo -replace "DRY_RUN = True", "DRY_RUN = False"
    Set-Content $scriptPath -Value $conteudo -Encoding UTF8
    Write-Host "✅ Script alterado para DRY_RUN = False" -ForegroundColor Green
}

Write-Host ""

# Instala dependências
Write-Host "📦 Verificando dependências..." -ForegroundColor Yellow
pip install pandas supabase --quiet --disable-pip-version-check 2>&1 | Out-Null
Write-Host "✅ Dependências prontas!" -ForegroundColor Green
Write-Host ""

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "🚀 EXECUTANDO IMPORTAÇÃO REAL" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Executa o script Python
python importar_clientes.py

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Pergunta se quer voltar para modo DRY-RUN
$voltar = Read-Host "Deseja voltar o script para modo DRY-RUN? (S/N)"

if ($voltar -eq "S" -or $voltar -eq "s") {
    $conteudo = Get-Content $scriptPath -Raw
    $conteudo = $conteudo -replace "DRY_RUN = False", "DRY_RUN = True"
    Set-Content $scriptPath -Value $conteudo -Encoding UTF8
    Write-Host "✅ Script voltou para modo DRY-RUN (seguro)" -ForegroundColor Green
} else {
    Write-Host "⚠️  Script permanece em modo PRODUÇÃO" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Pressione Enter para sair"
