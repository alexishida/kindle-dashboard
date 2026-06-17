param(
  [ValidateSet('Install', 'Uninstall', 'Start', 'Stop', 'Status')]
  [string]$Action = 'Status'
)

$ErrorActionPreference = 'Stop'
$TaskName = 'Kindle Dashboard'
$Root = Split-Path -Parent $PSScriptRoot

function Get-ElectronPath {
  $electron = Join-Path $Root 'node_modules\electron\dist\electron.exe'
  if (-not (Test-Path $electron)) {
    throw 'Electron not found. Run `npm ci` before installing autostart.'
  }
  return $electron
}

function Build-ElectronApp {
  $npm = Get-Command npm.cmd -ErrorAction Stop
  Push-Location $Root
  try {
    & $npm.Source run build
    if ($LASTEXITCODE -ne 0) {
      throw "Electron build failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Stop-ProjectProcesses {
  $patterns = @(
    [regex]::Escape((Join-Path $Root 'scripts\supervisor.js')),
    'backend[\\/]server\.js',
    [regex]::Escape($Root)
  )

  Get-CimInstance Win32_Process |
    Where-Object {
      $commandLine = $_.CommandLine
      $commandLine -and
        $_.ProcessId -ne $PID -and
        ($patterns | Where-Object { $commandLine -match $_ })
    } |
    ForEach-Object {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Show-Status {
  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($task) {
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    $lastResult = switch ($info.LastTaskResult) {
      0 { 'Success (0x0)' }
      267009 { 'Running (0x41301)' }
      default { '{0} (0x{1:X})' -f $info.LastTaskResult, $info.LastTaskResult }
    }
    [pscustomobject]@{
      Installed = $true
      State = $task.State
      LastRun = $info.LastRunTime
      LastResult = $lastResult
      NextRun = $info.NextRunTime
    } | Format-List
  } else {
    [pscustomobject]@{ Installed = $false; State = 'Not installed' } | Format-List
  }

  try {
    $ping = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/ping' -TimeoutSec 3
    Write-Host "Backend: healthy ($($ping.t))"
  } catch {
    Write-Host 'Backend: unavailable'
  }

  $pidFile = Join-Path $Root 'out\supervisor.pid'
  if (Test-Path $pidFile) {
    Write-Host "Supervisor PID: $((Get-Content $pidFile -Raw).Trim())"
  }

  $electron = Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -eq 'electron.exe' -and
      $_.CommandLine -and
      $_.CommandLine -match [regex]::Escape($Root)
    } |
    Select-Object -First 1
  if ($electron) {
    Write-Host "Electron PID: $($electron.ProcessId)"
  }
}

switch ($Action) {
  'Install' {
    $electron = Get-ElectronPath
    Build-ElectronApp
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Stop-ProjectProcesses

    $taskAction = New-ScheduledTaskAction `
      -Execute $electron `
      -Argument "`"$Root`"" `
      -WorkingDirectory $Root
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $principal = New-ScheduledTaskPrincipal `
      -UserId "$env:USERDOMAIN\$env:USERNAME" `
      -LogonType Interactive `
      -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet `
      -AllowStartIfOnBatteries `
      -DontStopIfGoingOnBatteries `
      -StartWhenAvailable `
      -RestartCount 10 `
      -RestartInterval (New-TimeSpan -Minutes 1) `
      -ExecutionTimeLimit ([TimeSpan]::Zero) `
      -MultipleInstances IgnoreNew
    $task = New-ScheduledTask `
      -Action $taskAction `
      -Trigger $trigger `
      -Principal $principal `
      -Settings $settings `
      -Description 'Starts the Kindle Dashboard Electron app and PNG renderer.'

    Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 4
    Show-Status
  }
  'Uninstall' {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Stop-ProjectProcesses
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host 'Kindle Dashboard autostart removed.'
  }
  'Start' {
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 3
    Show-Status
  }
  'Stop' {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Stop-ProjectProcesses
    Write-Host 'Kindle Dashboard stopped.'
  }
  'Status' {
    Show-Status
  }
}
