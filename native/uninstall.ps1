$ErrorActionPreference = 'Stop'
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
