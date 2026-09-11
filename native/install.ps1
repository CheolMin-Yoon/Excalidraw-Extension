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
$launcher = Join-Path $installDirectory 'host.exe'
$pidPath = Join-Path $installDirectory 'server.pid'
if (Test-Path -LiteralPath $pidPath) {
  $serverPid = [int](Get-Content -LiteralPath $pidPath -Raw)
  $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$serverPid" -ErrorAction SilentlyContinue
  if ($serverProcess -and $serverProcess.CommandLine -like "*$installDirectory*server.mjs*") {
    Stop-Process -Id $serverPid -Force
  }
}
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -eq $launcher -and $_.CommandLine -like '*--server*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
foreach ($file in @('host.mjs', 'server.mjs', 'renderer.mjs', 'launcher.cs')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $installDirectory $file)
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
$origins = @("chrome-extension://$ExtensionId/")
$manifestPath = Join-Path $installDirectory 'com.excalidraw.vector_latex.json'
if (Test-Path -LiteralPath $manifestPath) {
  $previous = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $origins += @($previous.allowed_origins | Where-Object { $_ -match '^chrome-extension://[a-p]{32}/$' })
}
$origins = @($origins | Select-Object -Unique)
$config = @{ xelatex = $resolvedXeLaTeX; dvisvgm = $resolvedDvisvgm; allowedOrigins = $origins } | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $installDirectory 'config.json'), $config, $utf8)
$nodePathFile = Join-Path $installDirectory 'node-path.txt'
[IO.File]::WriteAllText($nodePathFile, $resolvedNode, $utf8)
if (Test-Path -LiteralPath $launcher) { Remove-Item -LiteralPath $launcher -Force }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) {
  $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows C# compiler was not found.' }
& $compiler /nologo /target:exe "/out:$launcher" (Join-Path $installDirectory 'launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Failed to compile native host launcher.' }
if (-not (Test-Path -LiteralPath $launcher)) { throw 'Failed to build native host launcher.' }
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
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runCommand = '"{0}" --server' -f $launcher
New-ItemProperty -Path $runKey -Name 'ExcalidrawVectorLatex' -Value $runCommand -PropertyType String -Force | Out-Null
Start-Process -FilePath $launcher -ArgumentList '--server' -WindowStyle Hidden
Write-Output "Installed local renderer for extension $ExtensionId. Open the extension popup and try Preview."
