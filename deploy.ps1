# deploy.ps1
# Uso: .\deploy.ps1
# Pré-requisitos locais: Node/NPM, PowerShell, scp e ssh no PATH (ou use PuTTY pscp/plink e ajuste os comandos)

$VPS_IP      = "72.61.222.166"
$VPS_USER    = "root"
$APP_ROOT    = "/opt/fluxo7arena"
$RELEASES    = "$APP_ROOT/releases"
$CURRENT     = "$APP_ROOT/current"
$PM2_ECOS    = "$APP_ROOT/ecosystem.config.js"

# Identificador da release
$ts = Get-Date -Format "yyyyMMddHHmmss"
$REMOTE_RELEASE = "$RELEASES/$ts"

# 1) Build local
# Ajuste os comandos conforme seu projeto
npm ci
npm run build

# 2) Montar pacote a enviar (ajuste a lista conforme seu projeto)
# Para SSR/server (ex. Next.js/Express): enviar código + arquivos necessários para rodar 'npm ci' no servidor
$STAGE = Join-Path $env:TEMP "fluxo7arena-$ts"
New-Item -ItemType Directory -Force -Path $STAGE | Out-Null

# Copie os arquivos relevantes (ajuste conforme a sua estrutura)
Copy-Item -Recurse -Force package.json $STAGE
if (Test-Path "package-lock.json") { Copy-Item -Force package-lock.json $STAGE }
if (Test-Path "pnpm-lock.yaml")   { Copy-Item -Force pnpm-lock.yaml   $STAGE }
if (Test-Path "yarn.lock")        { Copy-Item -Force yarn.lock        $STAGE }
# Código do app
Copy-Item -Recurse -Force public $STAGE -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force src $STAGE -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force dist $STAGE -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force build $STAGE -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force .next $STAGE -ErrorAction SilentlyContinue
# Arquivo de server, caso exista
if (Test-Path "server.js") { Copy-Item -Force server.js $STAGE }
# Configs do framework, se necessário
Get-ChildItem -Path . -Include "*next.config.*","*.config.*" -File | ForEach-Object { Copy-Item -Force $_.FullName $STAGE }

# 3) (Opcional) Enviar .env se você quiser manter no servidor junto do current
# Recomendo manter .env em /opt/fluxo7arena/shared/.env e ler no start. Se quiser enviar:
# Copy-Item -Force .env $STAGE

# 4) Upload para a VPS (usa scp nativo)
# Se estiver no Windows sem scp, instale OpenSSH Client ou troque por pscp.exe (PuTTY)
${remoteTarget} = "${VPS_USER}@${VPS_IP}:$REMOTE_RELEASE"
scp -r "$STAGE/*" $remoteTarget

# 5) Preparar release no servidor e ativar
$remoteCmd = @"
set -e
# Se for app SSR/server: instalar deps de produção
if [ -f "$REMOTE_RELEASE/package.json" ]; then
  cd "$REMOTE_RELEASE"
  # Priorize um gerenciador (npm abaixo). Se usar pnpm/yarn, ajuste:
  npm ci --omit=dev
fi

# Linkar .env compartilhado (se estiver usando /opt/fluxo7arena/shared/.env)
if [ -f "$APP_ROOT/shared/.env" ]; then
  ln -sfn "$APP_ROOT/shared/.env" "$REMOTE_RELEASE/.env"
fi

# Apontar 'current' para a nova release
ln -sfn "$REMOTE_RELEASE" "$CURRENT"

# Iniciar ou recarregar via PM2
if [ -f "$PM2_ECOS" ]; then
  pm2 startOrReload "$PM2_ECOS"
  pm2 save
else
  # fallback: iniciar direto no 'current' com npm start (ajuste se quiser)
  cd "$CURRENT"
  pm2 start npm --name fluxo7arena -- start
  pm2 save
fi
"@

$sshTarget = "${VPS_USER}@${VPS_IP}"
ssh $sshTarget "$remoteCmd"
Write-Host "✅ Deploy concluído: $ts"