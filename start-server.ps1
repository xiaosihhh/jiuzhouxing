# 环游志 · 本地开发服务器  http://localhost:8000
# 使用：双击启动九州行.bat，或 powershell -ExecutionPolicy Bypass -File start-server.ps1
# 停止：关闭本窗口，或按 Ctrl+C
param([switch]$OpenBrowser)

$nodeRuntime = Get-Command node -ErrorAction SilentlyContinue
$codeArtsRuntime = "D:\CodeArts Agent\codearts-agent.exe"
$codexNodeRoot = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\runtimes\cua_node"
$codexNodeRuntime = Get-ChildItem -LiteralPath $codexNodeRoot -Directory -ErrorAction SilentlyContinue |
  ForEach-Object { Join-Path $_.FullName "bin\node.exe" } |
  Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
  Select-Object -First 1
if ($nodeRuntime -or $codexNodeRuntime -or (Test-Path -LiteralPath $codeArtsRuntime)) {
  & (Join-Path $PSScriptRoot "start-full.ps1") -OpenBrowser:$OpenBrowser
  exit $LASTEXITCODE
}

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd("\")
$rootPrefix = $root + "\"
$port = 8000
$lanIp = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
  Where-Object {
    $_.OperationalStatus -eq [System.Net.NetworkInformation.OperationalStatus]::Up -and
    $_.NetworkInterfaceType -notin @("Loopback", "Tunnel")
  } |
  ForEach-Object { $_.GetIPProperties().UnicastAddresses } |
  Where-Object {
    $_.Address.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
    -not [System.Net.IPAddress]::IsLoopback($_.Address) -and
    $_.Address.ToString() -notmatch "^169\.254\."
  } |
  Select-Object -First 1 -ExpandProperty Address
$lanIp = if ($lanIp) { $lanIp.ToString() } else { "127.0.0.1" }

$mime = @{
  ".html"="text/html"; ".css"="text/css"; ".js"="application/javascript"
  ".json"="application/json"; ".png"="image/png"; ".jpg"="image/jpeg"
  ".jpeg"="image/jpeg"; ".svg"="image/svg+xml"; ".ico"="image/x-icon"
  ".webp"="image/webp"; ".woff2"="font/woff2"; ".txt"="text/plain"
}

$probe = New-Object System.Net.Sockets.TcpClient
try { $probe.Connect("127.0.0.1", $port); $probe.Close(); Write-Host "端口 $port 已有服务器在运行，本实例退出。" -ForegroundColor Yellow; exit } catch { try { $probe.Close() } catch {} }

$log = Join-Path $root "server.log"
function Write-Log($m){ try { Add-Content -Path $log -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $m) -Encoding UTF8 } catch {} }

$server = $null
try {
  $server = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::IPv6Any, $port)
  $server.Server.DualMode = $true
  $server.Start()
} catch {
  try { if ($server) { $server.Stop() } } catch {}
  $server = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
  $server.Start()
}
Write-Log "服务器启动 PID=$PID 端口=$port 双栈监听"

Write-Host ""
Write-Host "  ◈ 九州行 · 本地服务器已启动" -ForegroundColor Cyan
Write-Host "  ➜ 浏览器访问: http://localhost:$port/" -ForegroundColor Green
Write-Host "  关闭本窗口即停止服务" -ForegroundColor DarkGray
Write-Host ""
if ($OpenBrowser) { Start-Process "http://localhost:$port/" }

while ($true) {
  $client = $null
  $stream = $null
  try {
    $client = $server.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
    $requestLine = $reader.ReadLine()
    $path = "/index.html"
    if ($requestLine -match "^(GET|HEAD)\s+(\S+)") { $path = $Matches[2] }
    $path = ($path -split "\?")[0]
    $rel = [System.Uri]::UnescapeDataString($path.TrimStart("/"))
    if ($rel -eq "") { $rel = "index.html" }

    $status = "200 OK"
    $ct = "application/octet-stream"
    $bytes = $null

    if ($rel -eq "app-config.js") {
      $config = @{ lanIp = $lanIp; port = $port } | ConvertTo-Json -Compress
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("window.APP_CONFIG=$config;")
      $ct = "application/javascript"
    } else {
      $fp = [System.IO.Path]::GetFullPath((Join-Path $root ($rel -replace "/", "\")))
      $insideRoot = $fp.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
      if ($insideRoot -and (Test-Path -LiteralPath $fp -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($fp)
        $ext = [System.IO.Path]::GetExtension($fp).ToLowerInvariant()
        $ct = $mime[$ext]
        if (-not $ct) { $ct = "application/octet-stream" }
      } else {
        $status = "404 Not Found"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $ct = "text/plain"
      }
    }

    $charset = if ($ct -match "^(text/|application/(javascript|json)|image/svg)") { "; charset=utf-8" } else { "" }
    $head = "HTTP/1.1 $status`r`nContent-Type: $ct$charset`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nReferrer-Policy: no-referrer`r`nX-Frame-Options: SAMEORIGIN`r`nAccess-Control-Allow-Origin: *`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($hb, 0, $hb.Length)
    if ($requestLine -notmatch "^HEAD\s") {
      $stream.Write($bytes, 0, $bytes.Length)
    }

    $statusCode = $status.Substring(0, 3)
    $color = if ($statusCode -eq "200") { "DarkGray" } else { "Red" }
    Write-Host ("  " + $statusCode + "  /" + $rel) -ForegroundColor $color
    Write-Log ($statusCode + " /" + $rel)
  } catch {
    # Keep serving after malformed requests or transient client disconnects.
  } finally {
    try { if ($stream) { $stream.Close() } } catch {}
    try { if ($client) { $client.Close() } } catch {}
  }
}
