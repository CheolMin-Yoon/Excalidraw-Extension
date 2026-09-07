param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId,
  [string]$NodePath,
  [string]$XeLaTeXPath,
  [string]$DvisvgmPath
)
$ErrorActionPreference = 'Stop'
function Resolve-Tool([string]$Provided, [string]$Name) {
  if ($Provided) { return (Resolve-Path -LiteralPath $Provided).Path }
  $tool = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $tool) { throw "$Name is not on PATH. Pass its full path to this script." }
  return $tool.Source
}
$resolvedNode = Resolve-Tool $NodePath 'node.exe'
$resolvedXeLaTeX = Resolve-Tool $XeLaTeXPath 'xelatex.exe'
$resolvedDvisvgm = Resolve-Tool $DvisvgmPath 'dvisvgm.exe'
$nodeVersion = & $resolvedNode --version
if ([int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 22) { throw 'Node.js 22 or newer is required.' }
$installDirectory = Join-Path $env:LOCALAPPDATA 'ExcalidrawVectorLatex'
New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
foreach ($file in @('host.mjs', 'renderer.mjs')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $installDirectory $file)
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
$config = @{ xelatex = $resolvedXeLaTeX; dvisvgm = $resolvedDvisvgm } | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $installDirectory 'config.json'), $config, $utf8)
$launcher = Join-Path $installDirectory 'host.cmd'
# CMD expands percent signs even inside quotes.
foreach ($path in @($resolvedNode, $installDirectory)) {
  if ($path -match '[%"!\r\n]') { throw 'Native host paths cannot contain %, !, quotes, or newlines.' }
}
$launcherText = '@echo off' + [Environment]::NewLine + ('"{0}" "{1}"' -f $resolvedNode, (Join-Path $installDirectory 'host.mjs')) + [Environment]::NewLine
[IO.File]::WriteAllText($launcher, $launcherText, $utf8)
$manifestPath = Join-Path $installDirectory 'com.excalidraw.vector_latex.json'
$origins = @("chrome-extension://$ExtensionId/")
if (Test-Path -LiteralPath $manifestPath) {
  $previous = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $origins += @($previous.allowed_origins | Where-Object { $_ -match '^chrome-extension://[a-p]{32}/$' })
}
$manifest = @{
  name = 'com.excalidraw.vector_latex'
  description = 'Local font rendering for Excalidraw Vector LaTeX'
  path = $launcher
  type = 'stdio'
  allowed_origins = @($origins | Select-Object -Unique)
} | ConvertTo-Json
[IO.File]::WriteAllText($manifestPath, $manifest, $utf8)
foreach ($browser in @('Google\Chrome', 'Microsoft\Edge', 'BraveSoftware\Brave-Browser')) {
  $registryPath = "HKCU:\Software\$browser\NativeMessagingHosts\com.excalidraw.vector_latex"
  New-Item -Path $registryPath -Force | Out-Null
  Set-Item -LiteralPath $registryPath -Value $manifestPath
}
Write-Output "Installed local renderer for extension $ExtensionId. Open the extension popup and try Preview."
