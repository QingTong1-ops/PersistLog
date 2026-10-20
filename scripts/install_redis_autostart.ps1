$ErrorActionPreference = "Stop"
$taskName = "persistLog-Redis"
$script = Join-Path $PSScriptRoot "start_redis_hidden.ps1"
$user = "$env:USERDOMAIN\$env:USERNAME"

if (-not (Test-Path $script)) {
    throw "Startup script not found: $script"
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Start persistLog Redis at user logon" `
    -Force | Out-Null

Write-Host "Scheduled task '$taskName' installed for $user (at logon)."
Write-Host "Start now: Start-ScheduledTask -TaskName $taskName"
