# Builds a release APK into F:\j\dist.
#   .\scripts\build-apk.ps1 shared     → for friends: starts empty, runs on 32- and 64-bit phones
#   .\scripts\build-apk.ps1 personal   → your own phone: starts with your prescription
param([ValidateSet('shared', 'personal')][string]$Kind = 'shared')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$env:JAVA_HOME = 'F:\Mobile App\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

Set-Location $root
node scripts/use-seed.cjs $Kind
$version = (Get-Content app.json -Raw | ConvertFrom-Json).expo.version
$archs = if ($Kind -eq 'shared') { 'armeabi-v7a,arm64-v8a' } else { 'arm64-v8a' }

# The JS bundle isn't rebuilt when only the seed changes, so drop the old one.
Remove-Item -Recurse -Force "$root\android\app\build\generated\assets" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$root\android\app\build\intermediates\assets" -ErrorAction SilentlyContinue

Set-Location "$root\android"
.\gradlew.bat assembleRelease "-PreactNativeArchitectures=$archs" --console=plain
if ($LASTEXITCODE -ne 0) { throw "Gradle failed ($LASTEXITCODE)" }

New-Item -ItemType Directory -Force "$root\dist" | Out-Null
$name = if ($Kind -eq 'shared') { "Jugnu-$version.apk" } else { "Jugnu-$version-mine.apk" }
Copy-Item "$root\android\app\build\outputs\apk\release\app-release.apk" "$root\dist\$name" -Force
Set-Location $root
node scripts/use-seed.cjs personal | Out-Null
Write-Output "Built dist\$name"
