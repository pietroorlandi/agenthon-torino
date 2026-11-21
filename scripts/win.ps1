# Windows (PowerShell) equivalent of the Makefile. Guide: docs/setup.md "Windows".
# Usage (from the repo root):
#   powershell -ExecutionPolicy Bypass -File scripts\win.ps1 setup
#   powershell -ExecutionPolicy Bypass -File scripts\win.ps1 dev
#   powershell -ExecutionPolicy Bypass -File scripts\win.ps1 join bottega-brain-1121-21996
#   powershell -ExecutionPolicy Bypass -File scripts\win.ps1 check | test | demo
#   powershell -ExecutionPolicy Bypass -File scripts\win.ps1 smoke [https://<service>.run.app]
param(
  [Parameter(Position = 0)][string]$Task = "help",
  [Parameter(Position = 1)][string]$Project = ""
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Backend = Join-Path $Root "src\backend"
$Frontend = Join-Path $Root "src\frontend"
$Py = Join-Path $Backend ".venv\Scripts\python.exe"

function Need($cmd, $hint) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "'$cmd' non trovato. $hint" }
}
function Run($exe, [string[]]$argv) {
  & $exe @argv
  if ($LASTEXITCODE -ne 0) { throw "Comando fallito: $exe $($argv -join ' ')" }
}
function Quiet([scriptblock]$block) {
  # Windows PowerShell 5.1 turns native stderr into terminating errors under "Stop": relax it here
  $old = $ErrorActionPreference; $ErrorActionPreference = "Continue"
  try { $out = & $block 2>$null; return @{ out = $out; ok = ($LASTEXITCODE -eq 0) } }
  finally { $ErrorActionPreference = $old }
}
function Set-EnvVar($name, $value) {
  $envFile = Join-Path $Root ".env"
  $lines = Get-Content $envFile -Encoding UTF8
  if ($lines -match "^$name=") { $lines = $lines -replace "^$name=\S*", "$name=$value" }
  else { $lines += "$name=$value" }
  [IO.File]::WriteAllLines($envFile, $lines)  # UTF-8 without BOM
}

switch ($Task) {
  "setup" {
    Need "py" "Installa Python 3.12 da python.org (spunta 'Add python.exe to PATH')."
    Need "npm" "Installa Node.js 22 LTS da nodejs.org."
    if (-not (Test-Path $Py)) { Run "py" @("-3", "-m", "venv", (Join-Path $Backend ".venv")) }
    Run $Py @("-m", "pip", "install", "-q", "-r", (Join-Path $Backend "requirements-dev.txt"))
    Push-Location $Frontend; Run "npm" @("install", "--no-audit", "--no-fund"); Pop-Location
    if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
    Write-Host "Setup ok. Ora: powershell -ExecutionPolicy Bypass -File scripts\win.ps1 dev"
  }
  "dev" {
    # Backend in a second window, Vite in this one. Close both windows to stop.
    # --reload-dir app: watch only our code (changes in .venv / OneDrive otherwise confuse the reloader)
    $be = "Set-Location '$Backend'; & '$Py' -m uvicorn app.main:app --reload --reload-dir app --port 8000"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $be
    Write-Host "Backend avviato in un'altra finestra (:8000). Apri http://localhost:5173"
    Push-Location $Frontend; npm run dev; Pop-Location
  }
  "demo" {
    Push-Location $Frontend; Run "npm" @("run", "build"); Pop-Location
    Push-Location $Backend; & $Py -m uvicorn app.main:app --port 8000; Pop-Location
  }
  "test" {
    Push-Location $Backend; Run $Py @("-m", "pytest", "-q"); Pop-Location
    Push-Location $Frontend; Run "npx" @("tsc", "--noEmit"); Pop-Location
  }
  "check" {
    Push-Location $Backend; Run $Py @("check_vertex.py"); Pop-Location
  }
  "smoke" {
    # Full demo script + attacks over HTTP against the running backend (resets the demo). Optional URL as 2nd arg.
    $env:PYTHONIOENCODING = "utf-8"
    $argv = @((Join-Path $Root "scripts\smoke.py")); if ($Project) { $argv += $Project }
    Run $Py $argv
  }
  "join" {
    if (-not $Project) { throw "Uso: scripts\win.ps1 join <project-id>" }
    Need "gcloud" "Installa Google Cloud CLI: https://cloud.google.com/sdk/docs/install (poi riapri PowerShell)."
    $active = Quiet { gcloud auth list --filter=status:ACTIVE --format="value(account)" }
    if (-not $active.out) { Run "gcloud" @("auth", "login") }
    Run "gcloud" @("config", "set", "project", $Project)
    Write-Host "==> Credenziali locali: nel browser spunta TUTTE le caselle dei permessi (anche Google Cloud)"
    $adc = Quiet { gcloud auth application-default print-access-token }
    if (-not $adc.ok) { Run "gcloud" @("auth", "application-default", "login") }
    Run "gcloud" @("auth", "application-default", "set-quota-project", $Project)
    if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
    Set-EnvVar "GOOGLE_CLOUD_PROJECT" $Project
    Set-EnvVar "GOOGLE_CLOUD_LOCATION" "global"
    Write-Host "==> .env aggiornata: GOOGLE_CLOUD_PROJECT=$Project, GOOGLE_CLOUD_LOCATION=global"
    Write-Host "Fatto. Verifica con: powershell -ExecutionPolicy Bypass -File scripts\win.ps1 check"
  }
  default {
    Write-Host "Comandi: setup | dev | demo | test | check | smoke [url] | join <project-id>"
  }
}
