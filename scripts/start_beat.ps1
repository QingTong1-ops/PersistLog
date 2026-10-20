$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"
$schedule = Join-Path $root ".redis\celerybeat-schedule"

if (-not (Test-Path $python)) {
    throw "Python virtual environment not found: $python"
}

$pidfile = Join-Path $root ".redis\celerybeat.pid"

Write-Host "Celery beat"
& $python -m celery -A app.worker.celery_app beat --loglevel=info --schedule $schedule --pidfile $pidfile
