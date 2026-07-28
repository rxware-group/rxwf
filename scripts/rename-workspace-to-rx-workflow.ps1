# Rename local workspace folder: d:\any-workflow -> d:\rx-workflow
# Close Cursor (and any terminal cd'd into the repo) before running.
$ErrorActionPreference = 'Stop'
$src = 'd:\any-workflow'
$dst = 'd:\rx-workflow'
if (-not (Test-Path $src)) {
  Write-Error "Source not found: $src"
}
if (Test-Path $dst) {
  Write-Error "Destination already exists: $dst"
}
Rename-Item -LiteralPath $src -NewName 'rx-workflow'
Write-Host "OK: $src -> $dst"
Write-Host "Reopen Cursor with folder: $dst"
