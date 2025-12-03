# copy-db-schema-and-data.ps1
# Requisitos: PowerShell 5+, Scoop (opcional), internet.
# Observação: use connection strings "Direct connection" (inclua ?sslmode=require).

$ErrorActionPreference = "Stop"

# 1) PREENCHA AQUI SUAS CONNECTION STRINGS (main → origem, dev → destino)
$CONN_MAIN = "postgres://postgres:(Fluxo740028922)@db.dlfryxtyxqoacuunswuc.supabase.co:5432/postgres"
$CONN_DEV  = "postgres://postgres:(Fluxo740028922)@db.xlbgopcindcsteymtwjp.supabase.co:5432/postgres"

# 2) CONFIGURAÇÕES
$CopySchema = $true          # Copiar esquema (tabelas, views, funções, RLS)
$CopyAllData = $false        # Copiar todos os dados do schema public
$Tables = @()                # OU liste tabelas específicas, ex: @("agendamentos","agendamento_participantes")
$WorkDir = Join-Path $PWD "db-transfer"
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
$SchemaFile = Join-Path $WorkDir "schema.sql"
$DataFile   = Join-Path $WorkDir "data.sql"

function Resolve-PgTool($exe) {
  $cmd = Get-Command $exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $prefix = $null
  try { $prefix = (scoop prefix postgresql) } catch {}
  if ($prefix) {
    $found = Get-ChildItem -Recurse -File -Filter $exe $prefix | Select-Object -First 1
    if ($found) { return $found.FullName }
  }
  throw "$exe não encontrado. Instale/atualize o pacote 'postgresql' via Scoop."
}

function EnsureSsl($conn) {
  if ($conn -match "sslmode=") { return $conn }
  if ($conn -match "\?") { return "$conn&sslmode=require" }
  else { return "$conn?sslmode=require" }
}

function NormalizeConn($conn) {
  if (-not $conn) { throw "Connection string vazia." }
  # Converter postgres:// → postgresql:// (algumas versões do libpq exigem o padrão completo)
  if ($conn.StartsWith("postgres://")) {
    $conn = $conn.Replace("postgres://", "postgresql://")
  }
  return $conn
}

function Check-Exit($step) {
  if ($LASTEXITCODE -ne 0) {
    throw "Falha no passo: $step (exit=$LASTEXITCODE)"
  }
}

function ParseConn($conn) {
  $raw = $conn
  if ($null -ne $raw -and $raw -match "\?") {
    $raw = $raw.Split('?',2)[0]
  }
  try {
    $u = [Uri]$raw
  } catch {
    $u = $null
  }

  if ($u -and $u.Host) {
    $ui = $u.UserInfo
    $user = $null
    $pass = ""
    if ([string]::IsNullOrEmpty($ui)) {
      $user = "postgres"
    } else {
      if ($ui.Contains(":")) {
        $parts = $ui.Split(":",2)
        $user = $parts[0]
        $pass = $parts[1]
      } else {
        $user = $ui
      }
    }
    $dbPath = $u.AbsolutePath
    if ([string]::IsNullOrEmpty($dbPath)) { $dbPath = "/postgres" }
    $db = $dbPath.TrimStart('/')
    if (-not $db) { $db = "postgres" }
    $port = if ($u.Port -gt 0) { $u.Port } else { 5432 }
    if (-not $user) { $user = "postgres" }
    return [PSCustomObject]@{ Host=$u.Host; Port=$port; User=$user; Pass=$pass; Db=$db }
  }
  # Fallback regex parsing
  $regex = '^(?<scheme>postgres(?:ql)?):\/\/(?:(?<user>[^:@\/\?]+)(?::(?<pass>[^@\/\?]*))?@)?(?<host>[^:\/\?]+)(?::(?<port>\d+))?\/(?<db>[^?\s]+)'
  $m = [regex]::Match($raw, $regex)

  if (-not $m.Success) {
    throw "Connection string inválida: $conn"
  }
  $host = $m.Groups['host'].Value
  $port = if ($m.Groups['port'].Success) { [int]$m.Groups['port'].Value } else { 5432 }
  $user = if ($m.Groups['user'].Success) { $m.Groups['user'].Value } else { 'postgres' }
  $pass = if ($m.Groups['pass'].Success) { $m.Groups['pass'].Value } else { '' }
  $db   = $m.Groups['db'].Value
  return [PSCustomObject]@{ Host=$host; Port=$port; User=$user; Pass=$pass; Db=$db }
}

# 3) Resolver caminhos dos binários e ajustar connection strings
$PgDump = Resolve-PgTool "pg_dump.exe"
$Psql   = Resolve-PgTool "psql.exe"
$CONN_MAIN_EFF = NormalizeConn $CONN_MAIN
$CONN_DEV_EFF  = NormalizeConn $CONN_DEV

$MAIN = ParseConn $CONN_MAIN_EFF
$DEV  = ParseConn $CONN_DEV_EFF
$prevPwd = $env:PGPASSWORD
$env:PGPASSWORD = $MAIN.Pass
$prevSsl = $env:PGSSLMODE

# 4) Copiar SCHEMA (DDL do schema public)
if ($CopySchema) {
  Write-Host "Gerando dump do SCHEMA (public) da MAIN..." -ForegroundColor Cyan
  Write-Host ("[DEBUG] MAIN → host={0} port={1} db={2} user={3}" -f $MAIN.Host,$MAIN.Port,$MAIN.Db,$MAIN.User) -ForegroundColor DarkGray
  $dumpSchemaArgs = @(
    "--no-owner","--no-acl",
    "--schema=public",
    "--schema-only",
    "-w",
    "-h", "$($MAIN.Host)", "-p", "$($MAIN.Port)", "-U", "$($MAIN.User)", "-d", "$($MAIN.Db)",
    "--file", "$SchemaFile"
  )
  & $PgDump @dumpSchemaArgs
  Check-Exit "pg_dump schema"

  # Ajuste: evitar erro se o schema "public" já existir na DEV
  if (Test-Path $SchemaFile) {
    $raw = Get-Content -Path $SchemaFile -Raw
    $raw = $raw -replace '(?im)^CREATE\s+SCHEMA\s+public\s*;','CREATE SCHEMA IF NOT EXISTS public;'
    # Separar CREATE VIEWs para aplicar depois
    $viewsPattern = '(?msi)^\s*CREATE\s+VIEW\b.*?;\s*'
    $viewsMatches = [regex]::Matches($raw, $viewsPattern)
    $viewsText = ""
    foreach ($m in $viewsMatches) { $viewsText += $m.Value + "`n" }
    $coreText = [regex]::Replace($raw, $viewsPattern, "")

    $SchemaCoreFile = Join-Path $WorkDir "schema.core.sql"
    $SchemaViewsFile = Join-Path $WorkDir "schema.views.sql"
    Set-Content -Path $SchemaCoreFile -Value $coreText -NoNewline -Encoding UTF8
    Set-Content -Path $SchemaViewsFile -Value $viewsText -NoNewline -Encoding UTF8
  }

  # 4.1 Aplicar núcleo (sem views)
  Write-Host "Aplicando SCHEMA (núcleo) na DEV..." -ForegroundColor Cyan
  $env:PGPASSWORD = $DEV.Pass
  $coreFileToApply = if (Test-Path $SchemaCoreFile) { $SchemaCoreFile } else { $SchemaFile }
  & $Psql -w -h "$($DEV.Host)" -p "$($DEV.Port)" -U "$($DEV.User)" -d "$($DEV.Db)" -v ON_ERROR_STOP=1 -f "$coreFileToApply"
  Check-Exit "psql apply schema core"

  # 4.2 Pré-cast para enums usados em views (ex.: payment_status)
  $preSql = @"
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_status' AND typnamespace = 'public'::regnamespace) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_cast c
      JOIN pg_type s ON s.oid=c.castsource
      JOIN pg_type t ON t.oid=c.casttarget
      WHERE s.typname='text' AND t.typname='payment_status'
    ) THEN
      CREATE CAST (text AS public.payment_status) WITH INOUT AS IMPLICIT;
    END IF;
  END IF;
END$$;
"@
  $PreCastFile = Join-Path $WorkDir "precast.sql"
  Set-Content -Path $PreCastFile -Value $preSql -Encoding UTF8 -NoNewline
  & $Psql -w -h "$($DEV.Host)" -p "$($DEV.Port)" -U "$($DEV.User)" -d "$($DEV.Db)" -v ON_ERROR_STOP=1 -f "$PreCastFile"
  Check-Exit "psql pre-cast payment_status"

  # 4.3 Aplicar VIEWS (se houver)
  if (Test-Path $SchemaViewsFile) {
    Write-Host "Aplicando VIEWS na DEV..." -ForegroundColor Cyan
    & $Psql -w -h "$($DEV.Host)" -p "$($DEV.Port)" -U "$($DEV.User)" -d "$($DEV.Db)" -v ON_ERROR_STOP=1 -f "$SchemaViewsFile"
    Check-Exit "psql apply views"
  }
  Write-Host "SCHEMA aplicado com sucesso." -ForegroundColor Green
}

# 5) Copiar DADOS (opcional)
if ($CopyAllData -or ($Tables.Count -gt 0)) {
  Write-Host "Gerando dump de DADOS..." -ForegroundColor Cyan
  $dumpDataArgs = @(
    "--no-owner", "--no-acl",
    "--data-only",
    "--schema=public",
    "-w",
    "-h", "$($MAIN.Host)", "-p", "$($MAIN.Port)", "-U", "$($MAIN.User)", "-d", "$($MAIN.Db)",
    "--file", "$DataFile"
  )
  if ($Tables.Count -gt 0) {
    foreach ($t in $Tables) { $dumpDataArgs += @("-t", $t) }
  }
  & $PgDump @dumpDataArgs
  Check-Exit "pg_dump data"
  Write-Host "Aplicando DADOS na DEV..." -ForegroundColor Cyan
  $env:PGPASSWORD = $DEV.Pass
  & $Psql -h $DEV.Host -p $DEV.Port -U $DEV.User -d $DEV.Db -v ON_ERROR_STOP=1 -f "$DataFile"
  Check-Exit "psql apply data"
  Write-Host "DADOS aplicados com sucesso." -ForegroundColor Green
} else {
  Write-Host "Cópia de dados DESATIVADA. Somente SCHEMA foi transferido." -ForegroundColor Yellow
}

Write-Host "✅ Concluído! Arquivos gerados em: $WorkDir" -ForegroundColor Green

# limpar env sensíveis
$env:PGPASSWORD = $prevPwd
$env:PGSSLMODE = $prevSsl