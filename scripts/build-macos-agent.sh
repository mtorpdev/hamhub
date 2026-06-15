#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RID="${1:-osx-arm64}"
CONFIGURATION="${CONFIGURATION:-Release}"
PUBLISH_DIR="$ROOT/artifacts/hamhub-wsjtx-mac/$RID/publish"
APP_DIR="$ROOT/artifacts/hamhub-wsjtx-mac/HamHub WSJT-X Agent.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
AGENT_DIR="$RESOURCES_DIR/agent"

rm -rf "$PUBLISH_DIR" "$APP_DIR"

dotnet publish "$ROOT/backend/HamHub.WsjtxMac/HamHub.WsjtxMac.csproj" \
  -c "$CONFIGURATION" \
  -r "$RID" \
  --self-contained true \
  -p:PublishSingleFile=true \
  -p:EnableCompressionInSingleFile=true \
  -o "$PUBLISH_DIR"

mkdir -p "$MACOS_DIR" "$AGENT_DIR"
cp -R "$PUBLISH_DIR"/. "$AGENT_DIR/"

cat > "$MACOS_DIR/hamhub-wsjtx-agent" <<'SH'
#!/bin/sh
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AGENT="$APP_DIR/Resources/agent/HamHub.WsjtxMac"

/usr/bin/osascript <<OSA
tell application "Terminal"
  activate
  do script quoted form of "$AGENT"
end tell
OSA
SH
chmod +x "$MACOS_DIR/hamhub-wsjtx-agent"

cat > "$CONTENTS_DIR/Info.plist" <<'PLIST'
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
PLIST

echo "Built: $APP_DIR"
