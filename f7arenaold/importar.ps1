# Script de Importação de Clientes/Fornecedores - Fluxo7Arena
# PowerShell Script

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "IMPORTAÇÃO DE CLIENTES/FORNECEDORES - FLUXO7ARENA" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Verifica Python
Write-Host "[1/4] Verificando Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python não encontrado!" -ForegroundColor Red
    Write-Host "   Instale Python 3.8+ de: https://www.python.org/downloads/" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host ""

# Verifica arquivo CSV
Write-Host "[2/4] Verificando arquivo pessoas.csv..." -ForegroundColor Yellow
if (Test-Path "pessoas.csv") {
    $linhas = (Get-Content "pessoas.csv" | Measure-Object -Line).Lines
    Write-Host "✅ Arquivo encontrado ($linhas linhas)" -ForegroundColor Green
} else {
    Write-Host "❌ Arquivo pessoas.csv não encontrado!" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host ""

# Verifica credenciais
Write-Host "[3/4] Verificando credenciais do Supabase..." -ForegroundColor Yellow
if (Test-Path ".env.python") {
    Write-Host "✅ Arquivo .env.python encontrado" -ForegroundColor Green
} else {
    Write-Host "❌ Arquivo .env.python não encontrado!" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host ""

# Instala dependências
Write-Host "[4/4] Instalando/Verificando dependências..." -ForegroundColor Yellow
Write-Host "   Instalando pandas..." -ForegroundColor Gray
pip install pandas --quiet --disable-pip-version-check 2>&1 | Out-Null
Write-Host "   Instalando supabase..." -ForegroundColor Gray
pip install supabase --quiet --disable-pip-version-check 2>&1 | Out-Null
Write-Host "✅ Dependências prontas!" -ForegroundColor Green
Write-Host ""

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "EXECUTANDO IMPORTAÇÃO (MODO DRY-RUN)" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Executa o script Python
python importar_clientes.py

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Se os dados estão corretos e você quer importar DE VERDADE:" -ForegroundColor White
Write-Host ""
Write-Host "   1. Abra o arquivo: importar_clientes.py" -ForegroundColor White
Write-Host "   2. Encontre a linha: DRY_RUN = True" -ForegroundColor White
Write-Host "   3. Mude para: DRY_RUN = False" -ForegroundColor Green
Write-Host "   4. Execute novamente: python importar_clientes.py" -ForegroundColor White
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Pressione Enter para sair"
