param([switch]$OpenBrowser)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
Set-Location $root

function Find-CodexNode {
  $runtimeRoot = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\runtimes\cua_node"
  if (-not (Test-Path -LiteralPath $runtimeRoot -PathType Container)) {
    return $null
  }

  Get-ChildItem -LiteralPath $runtimeRoot -Directory -ErrorAction SilentlyContinue |
    ForEach-Object {
      $nodePath = Join-Path $_.FullName "bin\node.exe"
      if (Test-Path -LiteralPath $nodePath -PathType Leaf) {
        [PSCustomObject]@{
          Path = $nodePath
          Modified = (Get-Item -LiteralPath $nodePath).LastWriteTimeUtc
        }
      }
    } |
    Sort-Object Modified -Descending |
    Select-Object -First 1 -ExpandProperty Path
}

$port = 8000
$probe = New-Object System.Net.Sockets.TcpClient
try {
  $probe.Connect("127.0.0.1", $port)
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
    if ($health.ok) {
      Write-Host "Jiuzhouxing is already running at http://localhost:$port/" -ForegroundColor Green
      if ($OpenBrowser) { Start-Process "http://localhost:$port/" }
      exit 0
    }
  } catch {}
  throw "Port $port is occupied by another service. Stop it before starting the API."
} catch {
  if ($_.Exception.Message -like "Port $port is occupied*") { throw }
} finally {
  try { $probe.Close() } catch {}
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$codeArts = "D:\CodeArts Agent\codearts-agent.exe"
if ($nodeCommand) {
  $node = $nodeCommand.Source
} elseif ($codexNode = Find-CodexNode) {
  $node = $codexNode
} elseif (Test-Path -LiteralPath $codeArts) {
  $env:ELECTRON_RUN_AS_NODE = "1"
  $node = $codeArts
  Write-Host "Node.js was not found. Using the CodeArts Agent runtime." -ForegroundColor Yellow
} else {
  throw "Node.js runtime was not found. Start Codex once or reinstall the application runtime."
}

if ($OpenBrowser) {
  Start-Job -ScriptBlock {
    param($url)
    Start-Sleep -Seconds 1
    Start-Process $url
  } -ArgumentList "http://localhost:8000/" | Out-Null
}
& $node "backend\server.js"
