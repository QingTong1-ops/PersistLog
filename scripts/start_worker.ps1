$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    throw "Python virtual environment not found: $python"
}

Write-Host "Celery worker (pool=solo)"
& $python -m celery -A app.worker.celery_app worker --loglevel=info --pool=solo --concurrency=1
