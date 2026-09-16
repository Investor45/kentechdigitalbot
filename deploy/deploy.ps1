param(
  [string]$AppDir = (Get-Location).Path,
  [string]$AppName = ''
)

$ErrorActionPreference = 'Stop'
Set-Location $AppDir

if (-not (Test-Path 'package.json')) {
  throw "package.json was not found in $AppDir"
}
if (-not (Test-Path 'config.env')) {
  throw "Create config.env from config.env.example before deployment."
}

if (-not $AppName) {
  $botNameLine = Get-Content 'config.env' | Where-Object { $_ -match '^BOT_NAME=' } | Select-Object -First 1
  if ($botNameLine -match '^BOT_NAME="?(.*?)"?$' -and $matches[1].Trim()) {
    $AppName = $matches[1].Trim()
  }
}
$AppName = if ($AppName) { $AppName } else { 'kentech-ai' }

corepack yarn install --frozen-lockfile --production=false
node --check index.js
foreach ($runtimeFile in @('lib/client.js', 'lib/kentech-runtime.js', 'lib/short-session.js', 'lib/import-session-bundle.js', 'lib/download-groups.js', 'plugins/auto-social-download.js')) {
  node --check $runtimeFile
  if ($LASTEXITCODE -ne 0) { throw "Runtime validation failed: $runtimeFile" }
}

$pm2 = Join-Path $AppDir 'node_modules\.bin\pm2.cmd'
if (-not (Test-Path $pm2)) {
  throw "PM2 was not installed. Run: npm install -g pm2"
}

& $pm2 describe $AppName *> $null
if ($LASTEXITCODE -eq 0) {
  & $pm2 restart $AppName --update-env
} else {
  & $pm2 start $AppDir --name $AppName --cwd $AppDir
}

& $pm2 save
& $pm2 status
