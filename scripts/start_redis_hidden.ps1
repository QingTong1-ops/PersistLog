$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$redisDir = Join-Path $root ".redis\redis"
$exe = Join-Path $redisDir "redis-server.exe"
$conf = Join-Path $redisDir "redis.windows.conf"
$data = Join-Path $root ".redis\data"
$log = Join-Path $root ".redis\redis.log"

if (-not (Test-Path $exe)) {
    throw "Redis is not installed: $exe"
}

# Do not start a second instance when something is already listening on 6379.
$alreadyRunning = $false
try {
    $client = [System.Net.Sockets.TcpClient]::new()
    $client.Connect("127.0.0.1", 6379)
    $alreadyRunning = $client.Connected
    $client.Close()
} catch {
    $alreadyRunning = $false
}
if ($alreadyRunning) {
    exit 0
}

New-Item -ItemType Directory -Force -Path $data | Out-Null
Start-Process -FilePath $exe `
    -WorkingDirectory $redisDir `
    -WindowStyle Hidden `
    -ArgumentList @(
        $conf,
        "--bind", "127.0.0.1",
        "--port", "6379",
        "--protected-mode", "yes",
        "--dir", $data,
        "--logfile", $log
    )
