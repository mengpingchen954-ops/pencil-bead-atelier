param([string]$Creator = '')
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
if (-not $Creator) { $Creator = Join-Path $env:ProgramData "cocos\editors\Creator\$($package.creator.version)\CocosCreator.exe" }
if (-not (Test-Path -LiteralPath $Creator)) { throw '找不到 Cocos Creator，请使用 -Creator 指定 CocosCreator.exe。' }
$buildConfig = Join-Path $projectRoot 'buildConfig_web-mobile.json'
$started = Get-Date
$arguments = @('--project', ('"' + $projectRoot + '"'), '--build', ('"configPath=' + $buildConfig + '"'))
Start-Process -FilePath $Creator -ArgumentList $arguments -WindowStyle Hidden | Out-Null
$logRoot = Join-Path $projectRoot 'temp\builder\log'
for ($i = 0; $i -lt 180; $i++) {
  Start-Sleep -Seconds 1
  $log = Get-ChildItem -LiteralPath $logRoot -Filter 'web-mobile*.log' -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $started.AddSeconds(-2) } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $log) { continue }
  try { $content = Get-Content -LiteralPath $log.FullName -Raw -ErrorAction Stop } catch { continue }
  if ($content -match 'build success in' -and $content -match 'Finished in') {
    if ($content -match '(?m) - error:|Missing class:') { throw "构建包含脚本或资源错误：$($log.FullName)" }
    Write-Output ('构建完成：' + (Join-Path $projectRoot 'build\web-mobile'))
    exit 0
  }
  if ($content -match 'build failed|Build failed|Failed to build') { throw "构建失败：$($log.FullName)" }
}
throw ('构建未在三分钟内结束，请检查 ' + $logRoot)
