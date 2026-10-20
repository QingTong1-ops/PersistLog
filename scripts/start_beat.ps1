$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"
$schedule = Join-Path $root ".redis\celerybeat-schedule"

if (-not (Test-Path $python)) {
    throw "Python virtual environment not found: $python"
}

$pidfile = Join-Path $root ".redis\celerybeat.pid"

if (Test-Path $pidfile) {
    $oldPid = Get-Content $pidfile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($oldPid -and -not (Get-Process -Id ([int]$oldPid) -ErrorAction SilentlyContinue)) {
        Remove-Item $pidfile -Force
    }
}

Write-Host "Celery beat"
& $python -m celery -A app.worker.celery_app beat --loglevel=info --schedule $schedule --pidfile $pidfile
