$ErrorActionPreference = "Stop"

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$target = Join-Path $root "docs"
$pages = @(
  "index.html",
  "cities.html",
  "route.html",
  "hotel.html",
  "community.html",
  "favicon.svg",
  "app-config.js",
  "LICENSE"
)

New-Item -ItemType Directory -Path $target -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $target "css") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $target "js") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $target "assets\videos") -Force | Out-Null

foreach ($name in $pages) {
  Copy-Item -LiteralPath (Join-Path $root $name) -Destination (Join-Path $target $name) -Force
}

Copy-Item -Path (Join-Path $root "css\*") -Destination (Join-Path $target "css") -Recurse -Force
Copy-Item -Path (Join-Path $root "js\*") -Destination (Join-Path $target "js") -Recurse -Force
Copy-Item -Path (Join-Path $root "assets\*") -Destination (Join-Path $target "assets") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $root "tmp-obs-video.mp4") -Destination (Join-Path $target "assets\videos\community-demo.mp4") -Force

$noJekyll = Join-Path $target ".nojekyll"
if (-not (Test-Path -LiteralPath $noJekyll)) {
  New-Item -ItemType File -Path $noJekyll | Out-Null
}

Write-Host "GitHub Pages files prepared in $target"
