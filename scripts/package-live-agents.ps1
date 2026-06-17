param(
  [string]$Configuration = "Release",
  [string]$RestoreSources = "https://api.nuget.org/v3/index.json"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$downloadsDir = Join-Path $root "frontend\public\downloads"
$artifactsDir = Join-Path $root "artifacts\live-agents"
$windowsPublishDir = Join-Path $artifactsDir "windows-x64"
$macPublishDir = Join-Path $artifactsDir "macos-arm64\publish"
$macAppDir = Join-Path $artifactsDir "macos-arm64\HamHub WSJT-X Agent.app"
$macContentsDir = Join-Path $macAppDir "Contents"
$macOsDir = Join-Path $macContentsDir "MacOS"
$macResourcesDir = Join-Path $macContentsDir "Resources"
$macAgentDir = Join-Path $macResourcesDir "agent"

New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $windowsPublishDir, $macPublishDir, $macAppDir

$windowsPublishArgs = @(
  "publish",
  (Join-Path $root "backend\HamHub.WsjtxTray\HamHub.WsjtxTray.csproj"),
  "-c", $Configuration,
  "-r", "win-x64",
  "--self-contained", "true",
  "-p:PublishSingleFile=true",
  "-p:EnableCompressionInSingleFile=true",
  "-p:DebugType=None",
  "-p:DebugSymbols=false",
  "-p:RestoreSources=$RestoreSources",
  "-o", $windowsPublishDir
)
& dotnet $windowsPublishArgs
if ($LASTEXITCODE -ne 0) { throw "Windows agent publish failed with exit code $LASTEXITCODE" }

Get-ChildItem $windowsPublishDir -Filter "*.pdb" -ErrorAction SilentlyContinue | Remove-Item -Force
$windowsZip = Join-Path $downloadsDir "HamHub-WSJTX-Agent-Windows-x64.zip"
Remove-Item -Force -ErrorAction SilentlyContinue $windowsZip
Compress-Archive -Path (Join-Path $windowsPublishDir "*") -DestinationPath $windowsZip

$macPublishArgs = @(
  "publish",
  (Join-Path $root "backend\HamHub.WsjtxMac\HamHub.WsjtxMac.csproj"),
  "-c", $Configuration,
  "-r", "osx-arm64",
  "--self-contained", "true",
  "-p:PublishSingleFile=true",
  "-p:EnableCompressionInSingleFile=true",
  "-p:DebugType=None",
  "-p:DebugSymbols=false",
  "-p:RestoreSources=$RestoreSources",
  "-o", $macPublishDir
)
& dotnet $macPublishArgs
if ($LASTEXITCODE -ne 0) { throw "macOS agent publish failed with exit code $LASTEXITCODE" }

New-Item -ItemType Directory -Force -Path $macOsDir, $macAgentDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $macPublishDir "*") $macAgentDir

@'
#!/bin/sh
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENT="$APP_DIR/Resources/agent/HamHub.WsjtxMac"

/usr/bin/osascript <<OSA
tell application "Terminal"
  activate
  do script quoted form of "$AGENT"
end tell
OSA
'@ | Set-Content -NoNewline -Encoding utf8 (Join-Path $macOsDir "hamhub-wsjtx-agent")

@'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>da</string>
  <key>CFBundleDisplayName</key>
  <string>HamHub WSJT-X Agent</string>
  <key>CFBundleExecutable</key>
  <string>hamhub-wsjtx-agent</string>
  <key>CFBundleIdentifier</key>
  <string>dk.hamhub.wsjtx-agent</string>
  <key>CFBundleName</key>
  <string>HamHub WSJT-X Agent</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
</dict>
</plist>
'@ | Set-Content -NoNewline -Encoding utf8 (Join-Path $macContentsDir "Info.plist")

Get-ChildItem $macAgentDir -Filter "*.pdb" -ErrorAction SilentlyContinue | Remove-Item -Force
$macZip = Join-Path $downloadsDir "HamHub-WSJTX-Agent-macOS-arm64.zip"
Remove-Item -Force -ErrorAction SilentlyContinue $macZip
Compress-Archive -Path $macAppDir -DestinationPath $macZip

$manifest = [ordered]@{
  builtAtUtc = (Get-Date).ToUniversalTime().ToString("o")
  files = @(
    [ordered]@{ name = "HamHub-WSJTX-Agent-Windows-x64.zip"; sizeBytes = (Get-Item $windowsZip).Length },
    [ordered]@{ name = "HamHub-WSJTX-Agent-macOS-arm64.zip"; sizeBytes = (Get-Item $macZip).Length }
  )
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $downloadsDir "live-agents-manifest.json")

Write-Host "Packaged live agents in $downloadsDir"
