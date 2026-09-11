$ErrorActionPreference = 'Stop'
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
Remove-ItemProperty -Path $runKey -Name 'ExcalidrawVectorLatex' -ErrorAction SilentlyContinue
$pidPath = Join-Path $env:LOCALAPPDATA 'ExcalidrawVectorLatex\server.pid'
if (Test-Path -LiteralPath $pidPath) {
  $serverPid = [int](Get-Content -LiteralPath $pidPath -Raw)
  $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$serverPid" -ErrorAction SilentlyContinue
  if ($serverProcess -and $serverProcess.CommandLine -like '*ExcalidrawVectorLatex*server.mjs*') {
    Stop-Process -Id $serverPid -Force
  }
}
foreach ($browser in @('Google\Chrome', 'Microsoft\Edge', 'BraveSoftware\Brave-Browser')) {
  $registryPath = "HKCU:\Software\$browser\NativeMessagingHosts\com.excalidraw.vector_latex"
  if (Test-Path -LiteralPath $registryPath) { Remove-Item -LiteralPath $registryPath }
}
$installDirectory = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'ExcalidrawVectorLatex'))
$expectedParent = [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd('\')
if ((Split-Path $installDirectory -Parent) -ne $expectedParent -or (Split-Path $installDirectory -Leaf) -ne 'ExcalidrawVectorLatex') {
  throw 'Unexpected native host installation path.'
}
if (Test-Path -LiteralPath $installDirectory) { Remove-Item -LiteralPath $installDirectory -Recurse -Force }
Write-Output 'Removed the local renderer. The extension and TeX installation are unchanged.'
