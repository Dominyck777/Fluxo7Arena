@echo off
chcp 65001 >nul
echo ================================================================================
echo IMPORTAÇÃO DE CLIENTES/FORNECEDORES - FLUXO7ARENA
echo ================================================================================
echo.

echo [1/3] Verificando Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python não encontrado! Instale Python 3.8+ primeiro.
    echo    Download: https://www.python.org/downloads/
    pause
    exit /b 1
)
echo ✅ Python encontrado!
echo.

echo [2/3] Instalando dependências...
pip install pandas supabase --quiet
if errorlevel 1 (
    echo ❌ Erro ao instalar dependências!
    pause
    exit /b 1
)
echo ✅ Dependências instaladas!
echo.

echo [3/3] Executando importação (DRY-RUN)...
echo.
python importar_clientes.py
echo.

echo ================================================================================
echo.
echo Para importar DE VERDADE no banco:
echo   1. Abra o arquivo importar_clientes.py
echo   2. Mude a linha: DRY_RUN = False
echo   3. Execute novamente: python importar_clientes.py
echo.
echo ================================================================================
pause
