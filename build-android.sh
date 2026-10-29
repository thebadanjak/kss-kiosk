#!/usr/bin/env bash
# Gradi Android APK za jedan način rada: kiosk | blagajna
# Treba: Node 20, Java 17, Android SDK (na GitHub Actionsu je sve već tu).
set -euo pipefail
FLAVOR="${1:?Upotreba: build-android.sh kiosk|blagajna}"
case "$FLAVOR" in
  kiosk)    APP_ID="hr.d2m.kss.kiosk";    APP_NAME="KSS Kiosk";    BG="#ff4a1c" ;;
  blagajna) APP_ID="hr.d2m.kss.blagajna"; APP_NAME="KSS Blagajna"; BG="#17151a" ;;
  *) echo "Nepoznat način: $FLAVOR"; exit 1 ;;
esac
cd "$(dirname "$0")/.."

node scripts/build-web.mjs "$FLAVOR"
rm -rf android www
cp -r "dist/$FLAVOR" www

cat > capacitor.config.json <<EOF
{
  "appId": "$APP_ID",
  "appName": "$APP_NAME",
  "webDir": "www",
  "android": { "allowMixedContent": false },
  "server": { "androidScheme": "https" }
}
EOF

npx cap add android

# ekran uvijek upaljen + prikaz preko cijelog zaslona
MA_DIR="android/app/src/main/java/$(echo "$APP_ID" | tr . /)"
sed "s/__PKG__/$APP_ID/" android-template/MainActivity.java > "$MA_DIR/MainActivity.java"

# ikona aplikacije (ako ne uspije, ostaje zadana ikona)
if [ -f "assets/icon-$FLAVOR.png" ]; then
  rm -rf cap-assets && mkdir -p cap-assets
  cp "assets/icon-$FLAVOR.png" cap-assets/icon-only.png
  cp "assets/icon-$FLAVOR.png" cap-assets/icon-foreground.png
  npx --yes @capacitor/assets@3.0.5 generate --android --assetPath cap-assets \
    --iconBackgroundColor "$BG" --iconBackgroundColorDark "$BG" || echo "! Ikona nije generirana, koristi se zadana"
fi

npx cap sync android

# isti potpisni ključ za svaku gradnju na GitHubu, da se nova verzija instalira preko stare
if [ "${CI:-}" = "true" ]; then mkdir -p ~/.android && cp android-template/debug.keystore ~/.android/debug.keystore; fi
(cd android && chmod +x gradlew && ./gradlew assembleDebug --no-daemon)

mkdir -p out
cp android/app/build/outputs/apk/debug/app-debug.apk "out/KSS-$FLAVOR.apk"
echo "✓ out/KSS-$FLAVOR.apk"
