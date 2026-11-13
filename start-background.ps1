$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\")
$port = 8000

$running = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($running) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 3
    if ($health.ok) {
      Start-Process "http://localhost:$port/"
      Write-Host "Jiuzhouxing is already running at http://localhost:$port/" -ForegroundColor Green
      exit 0
    }
  } catch {
    throw "Port $port is already used by another program."
  }
}

$stdout = Join-Path $root "server-output.log"
$stderr = Join-Path $root "server-error.log"
$process = Start-Process `
  -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $root "start-full.ps1")) `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr `
  -PassThru

for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Milliseconds 500
  if ($process.HasExited) {
    $details = if (Test-Path -LiteralPath $stderr) { Get-Content -LiteralPath $stderr -Raw } else { "" }
    throw "Jiuzhouxing failed to start.`n$details"
  }
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 1
    if ($health.ok) {
      Start-Process "http://localhost:$port/"
      Write-Host "Jiuzhouxing started in the background at http://localhost:$port/" -ForegroundColor Green
      Write-Host "Background process PID: $($process.Id)" -ForegroundColor DarkGray
      exit 0
    }
  } catch {}
}

throw "Jiuzhouxing did not start within 15 seconds. See $stderr"
