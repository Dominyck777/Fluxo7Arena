# deploy-isis.ps1
param(
    [string]$ProjectRef = "dlfryxtyxqoacuunswuc",
    [string]$FunctionName = "chat-proxy"
)

Write-Host "== Deploy da Ísis ($FunctionName) para o projeto $ProjectRef ==" -ForegroundColor Cyan

# Controle simples de versão da Ísis por deploy
# A versão é armazenada em um arquivo de texto ao lado deste script e incrementada a cada execução.
$versionFile = Join-Path $PSScriptRoot "isis-version.txt"
$currentVersion = 0
if (Test-Path $versionFile) {
    $raw = Get-Content $versionFile -ErrorAction SilentlyContinue | Select-Object -First 1
    [int]::TryParse($raw, [ref]$currentVersion) | Out-Null
}
$newVersion = $currentVersion + 1
Set-Content -Path $versionFile -Value $newVersion
Write-Host "== Versão da Ísis ($FunctionName): $newVersion ==" -ForegroundColor Magenta

# Fail fast
$ErrorActionPreference = "Stop"

# Garantir que estamos na raiz do projeto (pasta acima de script)
$root = Join-Path $PSScriptRoot ".."
Push-Location $root

try {
    # 1) Mostrar versão do Supabase CLI
    supabase --version

    # 2) Garantir link com o projeto
    Write-Host "== Linkando projeto ==" -ForegroundColor Yellow
    supabase link --project-ref $ProjectRef

    # 3) Deploy da função
    Write-Host "== Fazendo deploy da função $FunctionName ==" -ForegroundColor Yellow
    supabase functions deploy $FunctionName

    Write-Host "== Deploy concluído (verifique mensagens acima para warnings/erros do Supabase) ==" -ForegroundColor Green
}
finally {
    Pop-Location
}