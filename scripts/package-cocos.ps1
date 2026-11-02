param([Parameter(Mandatory=$true)][string]$Project)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$projectRoot = (Resolve-Path -LiteralPath $Project).Path
$sourceRoot = Join-Path $repoRoot 'cocos'
$releaseRoot = Join-Path $repoRoot 'cocos-web'
$builtRoot = Join-Path $projectRoot 'build\web-mobile'
if (-not (Test-Path -LiteralPath (Join-Path $builtRoot 'index.html'))) { throw 'Creator build is missing. Run build-game.ps1 first.' }
foreach ($folder in @('assets','tests','tools')) {
  robocopy (Join-Path $projectRoot $folder) (Join-Path $sourceRoot $folder) /E /NFL /NDL /NJH /NJS | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "Cannot copy $folder" }
}
foreach ($file in @('.gitignore','README.md','build-game.ps1','buildConfig_web-mobile.json','package.json','tsconfig.json','settings/v2/packages/builder.json','settings/v2/packages/engine.json','settings/v2/packages/project.json')) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination (Join-Path $sourceRoot $file) -Force
}
# Delete only this repository's generated browser output, after validating its absolute path.
if ([IO.Path]::GetFullPath($releaseRoot) -ne (Join-Path $repoRoot 'cocos-web')) { throw 'Unexpected release directory.' }
if (Test-Path -LiteralPath $releaseRoot) { Remove-Item -LiteralPath $releaseRoot -Recurse -Force }
Copy-Item -LiteralPath $builtRoot -Destination $releaseRoot -Recurse
New-Item -Path (Join-Path $releaseRoot '.nojekyll') -ItemType File -Force | Out-Null
function Hashes([string]$base) {
  $hashes = [ordered]@{}
  Get-ChildItem -LiteralPath $base -Recurse -File | Sort-Object FullName | ForEach-Object {
    $relative = [IO.Path]::GetRelativePath($base,$_.FullName).Replace('\','/')
    if ($relative -eq 'build-manifest.json') { return }
    $hashes[$relative] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  return $hashes
}
$manifest = [ordered]@{engine='Cocos Creator 3.8.2'; sourceHashes=(Hashes $sourceRoot); webHashes=(Hashes $releaseRoot)}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $releaseRoot 'build-manifest.json') -Encoding utf8
Write-Output "Packaged $($manifest.sourceHashes.Count) source files and $($manifest.webHashes.Count) browser files."
