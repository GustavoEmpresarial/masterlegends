#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"

if ! command -v java >/dev/null 2>&1; then
  echo "Java não encontrado. Instale OpenJDK 17, ex.:"
  echo "  sudo apt-get install -y openjdk-17-jdk"
  exit 1
fi

npm install
npx cap add android 2>/dev/null || true
npx cap sync android

# Cleartext + LAN para device físico: edite capacitor.config.json server.url
# Emulador Android usa 10.0.2.2 → host localhost.
cd android
./gradlew assembleDebug
APK="app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "APK: $ROOT/android/$APK"
ls -lah "$APK"
mkdir -p "$ROOT/release"
cp "$APK" "$ROOT/release/MLL-Stadium-Live-1.0.0-android-debug.apk"
echo "Cópia: $ROOT/release/MLL-Stadium-Live-1.0.0-android-debug.apk"
