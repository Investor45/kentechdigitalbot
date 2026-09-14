param(
  [string]$AppDir = (Get-Location).Path,
  [string]$AppName = 'kentech-ai'
)

$ErrorActionPreference = 'Stop'
Set-Location $AppDir

if (-not (Test-Path 'package.json')) {
  throw "package.json was not found in $AppDir"
}
if (-not (Test-Path 'config.env')) {
  throw "Create config.env from config.env.example before deployment."
}

corepack yarn install --frozen-lockfile --production=false
node --check index.js

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
