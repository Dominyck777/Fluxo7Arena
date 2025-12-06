# copy-db-schema-and-data.ps1
# Requisitos: PowerShell 5+, Scoop (opcional), internet.
# Observação: use connection strings "Direct connection" (inclua ?sslmode=require).

$ErrorActionPreference = "Stop"

# 1) PREENCHA AQUI SUAS CONNECTION STRINGS (main → origem, dev → destino)
$CONN_MAIN = "postgresql://postgres.dlfryxtyxqoacuunswuc:(Fluxo740028922)@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
$CONN_DEV  = "postgresql://postgres.xlbgopcindcsteymtwjp:(Fluxo740028922)@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"

# 2) CONFIGURAÇÕES
$CopySchema = $true          # Copiar esquema (tabelas, views, funções, RLS)
$CopyAllData = $true        # Copiar todos os dados do schema public
$Tables = @()                # OU liste tabelas específicas, ex: @("agendamentos","agendamento_participantes")
$TruncateDevBeforeImport = $true
$DropBeforeApply = $true     # Usar --clean/--if-exists no dump do SCHEMA para dropar objetos existentes na DEV
$ResetDevPublicSchema = $true # Drop schema public CASCADE e recria antes de aplicar o SCHEMA core (DEV será limpado)
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

function Assert-DnsResolvable($dnsHost, $label) {
  try {
    $addresses = [System.Net.Dns]::GetHostAddresses($dnsHost)
    if (-not $addresses -or $addresses.Count -eq 0) {
      throw "no addresses"
    }
  } catch {
    throw "Host $dnsHost ($label) não resolve via DNS. Se sua rede é IPv4, use a Connection String do 'Shared Pooler' no Supabase (Direct connection pode ser IPv6-only)."
  }
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
$env:PGSSLMODE = "require"

Assert-DnsResolvable $MAIN.Host "MAIN"
Assert-DnsResolvable $DEV.Host "DEV"

# Safety: prevent same source and target (identical URIs)
$normMain = ($CONN_MAIN_EFF -split '\?')[0]
$normDev  = ($CONN_DEV_EFF -split '\?')[0]
if ($normMain -eq $normDev) {
  throw "As conexões MAIN e DEV são idênticas. Abortei por segurança. Ajuste as connection strings."
}

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
  if ($DropBeforeApply) {
    $dumpSchemaArgs = @("--clean","--if-exists") + $dumpSchemaArgs
  }
  & $PgDump @dumpSchemaArgs
  Check-Exit "pg_dump schema"

  # Ajuste: evitar erro se o schema "public" já existir na DEV
  if (Test-Path $SchemaFile) {
    $raw = Get-Content -Path $SchemaFile -Raw
    $raw = $raw -replace '(?im)^CREATE\s+SCHEMA\s+public\s*;','CREATE SCHEMA IF NOT EXISTS public;'
    # Separar CREATE VIEWs para aplicar depois
    $viewsPattern = '(?msi)^\s*CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\b.*?;\s*'
    $viewsMatches = [regex]::Matches($raw, $viewsPattern)
    $viewsText = ""
    foreach ($m in $viewsMatches) { $viewsText += $m.Value + "`n" }
    $coreText = [regex]::Replace($raw, $viewsPattern, "")
    # Mover também os COMMENT ON VIEW para o arquivo de views (precisam rodar após CREATE VIEW)
    $commentViewPattern = '(?msi)^\s*COMMENT\s+ON\s+(?:MATERIALIZED\s+)?VIEW\b.*?;\s*'
    $commentViewMatches = [regex]::Matches($coreText, $commentViewPattern)
    foreach ($m in $commentViewMatches) { $viewsText += $m.Value + "`n" }
    $coreText = [regex]::Replace($coreText, $commentViewPattern, "")

    # Remover DROP POLICY (depende da existência da tabela e falha após reset do schema)
    $coreText = [regex]::Replace($coreText, '(?im)^\s*DROP\s+POLICY\b.*?;\s*', '')
    # Remover DROP TRIGGER (mesmo com IF EXISTS, o comando exige a tabela existente)
    $coreText = [regex]::Replace($coreText, '(?im)^\s*DROP\s+TRIGGER\b.*?ON\s+public\.(?:"[^"]+"|\w+)\s*;\s*', '')
    # Remover QUALQUER DROP remanescente (como DROP TABLE/INDEX/SEQUENCE/FUNCTION) já que resetamos o schema
    $coreText = [regex]::Replace($coreText, '(?im)^\s*DROP\s+.*?;\s*', '')
    # Ajustar opclass trigram para o schema 'extensions' do Supabase
    $coreText = [regex]::Replace($coreText, '(?im)\bpublic\.gin_trgm_ops\b', 'extensions.gin_trgm_ops')
    $coreText = [regex]::Replace($coreText, '(?im)\bpublic\.gist_trgm_ops\b', 'extensions.gist_trgm_ops')
    $coreText = [regex]::Replace($coreText, '(?im)(\(|,|\s)gin_trgm_ops\b', '$1extensions.gin_trgm_ops')
    $coreText = [regex]::Replace($coreText, '(?im)(\(|,|\s)gist_trgm_ops\b', '$1extensions.gist_trgm_ops')

    $SchemaCoreFile = Join-Path $WorkDir "schema.core.sql"
    $SchemaViewsFile = Join-Path $WorkDir "schema.views.sql"
    Set-Content -Path $SchemaCoreFile -Value $coreText -NoNewline -Encoding UTF8
    Set-Content -Path $SchemaViewsFile -Value $viewsText -NoNewline -Encoding UTF8

    # Pré-drop de ENUMs/TYPEs que existam na DEV (evita 'type already exists')
    if ($DropBeforeApply) {
      $typeRegex = '(?im)^\s*CREATE\s+TYPE\s+public\.(?:"(?<t>[^"]+)"|(?<t>\w+))\s+AS\s+ENUM\s*\('
      $typeMatches = [regex]::Matches($coreText, $typeRegex)
      if ($typeMatches.Count -gt 0) {
        $dropList = @()
        foreach ($tm in $typeMatches) {
          $tname = $tm.Groups['t'].Value
          if ($tname) { $dropList += $tname }
        }
        $dropList = $dropList | Select-Object -Unique
        if ($dropList.Count -gt 0) {
          $dropSql = 'DO $$ BEGIN '
          foreach ($tn in $dropList) {
            $dropSql += " EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident('public') || '.' || quote_ident('$tn') || ' CASCADE';"
          }
          $dropSql += ' END $$;'
          $DropTypesFile = Join-Path $WorkDir "pre_drop_types.sql"
          Set-Content -Path $DropTypesFile -Value $dropSql -NoNewline -Encoding UTF8
          Write-Host "Droppando tipos ENUM existentes na DEV..." -ForegroundColor DarkYellow
          $env:PGPASSWORD = $DEV.Pass
          & $Psql -w -h "$($DEV.Host)" -p "$($DEV.Port)" -U "$($DEV.User)" -d "$($DEV.Db)" -v ON_ERROR_STOP=1 -f "$DropTypesFile"
          Check-Exit "psql pre-drop types"
        }
      }
    }
  }

  # 4.1 Aplicar núcleo (sem views)
  Write-Host "Aplicando SCHEMA (núcleo) na DEV..." -ForegroundColor Cyan
  $env:PGPASSWORD = $DEV.Pass
  if ($ResetDevPublicSchema) {
    Write-Host "Resetando schema public na DEV (DROP CASCADE -> CREATE SCHEMA public)..." -ForegroundColor DarkYellow
    & $Psql -w -h "$($DEV.Host)" -p "$($DEV.Port)" -U "$($DEV.User)" -d "$($DEV.Db)" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
    Check-Exit "psql reset schema public"
  }
  # 4.1.1 Garantir extensões necessárias (Supabase mantém opclasses em 'extensions')
  $preExtSql = @"
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
"@
  $PreExtFile = Join-Path $WorkDir "pre_extensions.sql"
  Set-Content -Path $PreExtFile -Value $preExtSql -Encoding UTF8 -NoNewline
  & $Psql -w -h "$($DEV.Host)" -p "$($DEV.Port)" -U "$($DEV.User)" -d "$($DEV.Db)" -v ON_ERROR_STOP=1 -f "$PreExtFile"
  Check-Exit "psql ensure extensions"

  $coreFileToApply = if (Test-Path $SchemaCoreFile) { $SchemaCoreFile } else { $SchemaFile }
  & $Psql -w -h "$($DEV.Host)" -p "$($DEV.Port)" -U "$($DEV.User)" -d "$($DEV.Db)" -v ON_ERROR_STOP=1 -f "$coreFileToApply"
  Check-Exit "psql apply schema core"

  # 4.2 Pré-cast para enums usados em views (ex.: payment_status)
  $preSql = @'
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
'@

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
  $env:PGPASSWORD = $MAIN.Pass
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
  # Remover linhas duplicadas e inválidas do dump de dados
  if (Test-Path $DataFile) {
    Write-Host "Limpando duplicatas e linhas inválidas do dump de dados..." -ForegroundColor DarkYellow
    $lines = @(Get-Content -Path $DataFile)
    $cleanedLines = @()
    $seen = @{}
    $seenByKey = @{}  # Para rastrear chaves únicas (ex: codigo_empresa + codigo_produto)
    $inCopyBlock = $false
    $currentTable = ""
    
    foreach ($line in $lines) {
      # Detectar início de bloco COPY
      if ($line -match '^\s*COPY\s+public\.(\S+)\s+') {
        $currentTable = $matches[1]
        $inCopyBlock = $true
        $cleanedLines += $line
        continue
      }
      
      # Detectar fim de bloco COPY
      if ($inCopyBlock -and $line -eq '\.') {
        $inCopyBlock = $false
        $cleanedLines += $line
        continue
      }
      
      # Se estamos em um bloco COPY, filtrar linhas inválidas
      if ($inCopyBlock) {
        # Pular linhas vazias ou que começam com tab (UUID vazio)
        if ($line -match '^\s*$' -or $line -match '^\t') {
          continue
        }
        
        # Para tabela 'produtos', verificar chave única (codigo_empresa + lower(codigo_produto))
        if ($currentTable -eq 'produtos') {
          $fields = $line -split "`t"
          if ($fields.Count -ge 13) {
            # Campo 7 = codigo_empresa, Campo 13 = codigo_produto
            $empresa = $fields[6]
            $codigo = $fields[12].ToLower()
            $uniqueKey = "$empresa|$codigo"
            
            if ($seenByKey[$uniqueKey]) {
              Write-Host "  Pulando duplicata de produto: empresa=$empresa, codigo=$codigo" -ForegroundColor DarkGray
              continue
            }
            $seenByKey[$uniqueKey] = $true
          }
        }
        
        # Pular duplicatas exatas
        if ($seen[$line]) {
          continue
        }
        $seen[$line] = $true
        $cleanedLines += $line
      } else {
        # Fora de blocos COPY, manter como está
        $cleanedLines += $line
      }
    }
    
    Set-Content -Path $DataFile -Value $cleanedLines -Encoding UTF8
  }
  Write-Host "Aplicando DADOS na DEV..." -ForegroundColor Cyan
  $env:PGPASSWORD = $DEV.Pass
  if ($TruncateDevBeforeImport) {
    $tableList = @()
    if ($Tables.Count -gt 0) {
      $tableList = $Tables
    } else {
      $rawData = Get-Content -Path $DataFile -Raw
      $h = @{}
      $m1 = [regex]::Matches($rawData,'(?im)^\s*COPY\s+public\."([^"]+)"\s*\(')
      foreach ($m in $m1) { $h[$m.Groups[1].Value] = $true }
      $m2 = [regex]::Matches($rawData,'(?im)^\s*COPY\s+public\.([^\s\(]+)\s*\(')
      foreach ($m in $m2) { $h[$m.Groups[1].Value] = $true }
      $tableList = @($h.Keys)
    }
    if ($tableList.Count -gt 0) {
      $quoted = $tableList | ForEach-Object { '"public"."{0}"' -f $_ }
      $truncateSql = 'TRUNCATE TABLE ' + ($quoted -join ', ') + ' CASCADE;'
      & $Psql -h $DEV.Host -p $DEV.Port -U $DEV.User -d $DEV.Db -v ON_ERROR_STOP=1 -c "$truncateSql"
      Check-Exit "psql truncate dev data"
    }
  }
  
  # Criar arquivo com dados precedido de SET session_replication_role = replica
  Write-Host "Preparando dados com triggers desabilitados..." -ForegroundColor DarkYellow
  $dataWithSettings = @"
SET session_replication_role = replica;
SET row_security = off;
"@
  $dataContent = Get-Content -Path $DataFile -Raw
  $dataWithSettings += $dataContent
  $dataWithSettings += @"

SET session_replication_role = DEFAULT;
SET row_security = on;
"@
  
  $DataFileWithSettings = Join-Path $WorkDir "data.with_settings.sql"
  Set-Content -Path $DataFileWithSettings -Value $dataWithSettings -Encoding UTF8 -NoNewline
  
  Write-Host "Aplicando DADOS na DEV (com triggers desabilitados)..." -ForegroundColor Cyan
  & $Psql -h $DEV.Host -p $DEV.Port -U $DEV.User -d $DEV.Db -v ON_ERROR_STOP=1 -f "$DataFileWithSettings"
  Check-Exit "psql apply data"

  Write-Host "DADOS aplicados com sucesso." -ForegroundColor Green
} else {
  Write-Host "Cópia de dados DESATIVADA. Somente SCHEMA foi transferido." -ForegroundColor Yellow
}

Write-Host "✅ Concluído! Arquivos gerados em: $WorkDir" -ForegroundColor Green

# limpar env sensíveis
$env:PGPASSWORD = $prevPwd
$env:PGSSLMODE = $prevSsl