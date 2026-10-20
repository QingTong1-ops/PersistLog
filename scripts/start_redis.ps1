param(
    [int]$Port = 6379
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$redisDir = Join-Path $root ".redis\redis"
$exe = Join-Path $redisDir "redis-server.exe"
$conf = Join-Path $redisDir "redis.windows.conf"
$data = Join-Path $root ".redis\data"
$log = Join-Path $root ".redis\redis.log"

if (-not (Test-Path $exe)) {
    throw "Redis is not installed: $exe. See the Redis section in README."
}

New-Item -ItemType Directory -Force -Path $data | Out-Null
Write-Host "Redis 127.0.0.1:$Port (Ctrl+C to stop)"
& $exe $conf --bind 127.0.0.1 --port $Port --protected-mode yes --dir $data --logfile $log
