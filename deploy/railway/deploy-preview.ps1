<#
  Deploys the LFAR preview site to Railway.

    powershell -ExecutionPolicy Bypass -File .\deploy\railway\deploy-preview.ps1

  First run: logs in to Railway (opens your browser), creates a project "lfar-preview" with a
  MySQL database and a "web" service, gives it a public address, then uploads the site.
  Later runs: just uploads the site again (theme from this repo, uploads + database from Local).

  The database snapshot is the Local site's app\sql\local.sql. Local rewrites that file when the
  site is stopped, so stop the site in Local first if you've edited pages since.
  Nothing here is committed to git: the bundle is assembled in %LOCALAPPDATA%\lfar-railway.
#>
param(
  [string]$LocalSite = (Join-Path $HOME 'Local Sites\los-feliz-animal-rescue'),
  [string]$Service   = 'web',
  [string]$Project   = 'lfar-preview'
)
$ErrorActionPreference = 'Stop'
$kit   = $PSScriptRoot
$repo  = (Resolve-Path (Join-Path $kit '..\..')).Path
$build = Join-Path $env:LOCALAPPDATA 'lfar-railway'

function Step($msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }
function Run {
  # Runs a railway command, stops the script if it fails
  & railway @args
  if ($LASTEXITCODE -ne 0) { throw "railway $($args -join ' ') failed (exit $LASTEXITCODE)" }
}

# --- Railway CLI -------------------------------------------------------------
Step 'Railway CLI'
if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
  Write-Host 'Installing the Railway CLI with npm...'
  npm install -g @railway/cli
  if ($LASTEXITCODE -ne 0) { throw 'Could not install the Railway CLI (npm install -g @railway/cli).' }
}
& railway whoami 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Opening Railway login in your browser...'
  Run login
}
& railway whoami

# --- Database snapshot -------------------------------------------------------
Step 'Database snapshot'
$sql = Join-Path $LocalSite 'app\sql\local.sql'
if (-not (Test-Path $sql)) { throw "No database snapshot at $sql" }
$saved = (Get-Item $sql).LastWriteTime
Write-Host ("Using {0}`n  saved {1:dddd MMM d, h:mm tt}" -f $sql, $saved)
Write-Host '  If you changed pages, forms or settings after that, stop the site in Local (that refreshes'
Write-Host '  the snapshot), then run this script again.'
$answer = Read-Host 'Continue with this snapshot? (Y/n)'
if ($answer -match '^[nN]') { return }

# --- Assemble the bundle -----------------------------------------------------
Step 'Bundling the site'
New-Item -ItemType Directory -Force -Path $build | Out-Null
Get-ChildItem -Force $build | Where-Object { $_.Name -ne '.railway' } | Remove-Item -Recurse -Force
foreach ($f in 'Dockerfile', 'docker-entrypoint.sh', 'import-db.php', 'wp-config.php', 'htaccess', 'railway.json') {
  Copy-Item (Join-Path $kit $f) $build
}
function Copy-Tree($from, $to) {
  robocopy $from $to /E /XD node_modules .git /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Copy failed: $from" }
  $global:LASTEXITCODE = 0
}
Copy-Tree (Join-Path $repo 'theme\lfar') (Join-Path $build 'theme')
Copy-Tree (Join-Path $LocalSite 'app\public\wp-content\uploads') (Join-Path $build 'uploads')
Copy-Item $sql (Join-Path $build 'db.sql')
$mb = [math]::Round(((Get-ChildItem -Recurse -File $build | Measure-Object Length -Sum).Sum / 1MB), 1)
Write-Host "Bundle: $build ($mb MB)"

Push-Location $build
try {
  # --- First run: create the Railway project -------------------------------
  & railway status 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Step "Creating Railway project '$Project' (first run only)"
    Run init --name $Project
    Run add --database mysql
    Run add --service $Service
    # Point the web service at the MySQL service's connection details
    Run variables --service $Service `
      --set 'PORT=8080' `
      --set 'MYSQLHOST=${{MySQL.MYSQLHOST}}' `
      --set 'MYSQLPORT=${{MySQL.MYSQLPORT}}' `
      --set 'MYSQLUSER=${{MySQL.MYSQLUSER}}' `
      --set 'MYSQLPASSWORD=${{MySQL.MYSQLPASSWORD}}' `
      --set 'MYSQLDATABASE=${{MySQL.MYSQLDATABASE}}'
    & railway domain --service $Service --port 8080
    if ($LASTEXITCODE -ne 0) { Run domain --service $Service }
  }

  # --- Upload ----------------------------------------------------------------
  Step 'Uploading to Railway'
  Run up --service $Service --detach
  Write-Host ''
  & railway domain --service $Service 2>$null
  Write-Host "`nUploaded. Railway now builds and starts the site (about 3-5 minutes the first time)."
  Write-Host 'Watch it with:  railway logs --service web   (from the bundle folder), or open the dashboard:'
  & railway open
}
finally {
  Pop-Location
}
