#!/bin/bash
# Packs SnipMD.app into the release .dmg (SPEC §13). With a Developer ID in the environment it signs
# the app with the hardened runtime first, and with an Apple ID it notarizes and staples the .dmg;
# without them the app keeps the ad-hoc signature from the build. Only Apple's tools run here, so
# the release workflow can hand this step the signing secrets without exposing them to any
# dependency's code.
#
#   tools/release/macos-package.sh <SnipMD.app> <out folder> <version>
#
# Developer ID signing:  APPLE_CERTIFICATE (base64 .p12), APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY
# Notarization:          APPLE_ID, APPLE_PASSWORD (app-specific), APPLE_TEAM_ID
set -euo pipefail
APP="$1"
OUT="$2"
VERSION="$3"
# Without a Developer ID the name says so: the release text sends a .preview build to the first-start
# steps in RELEASE-MACOS.md.
if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
  DMG="$OUT/SnipMD_${VERSION}_universal.dmg"
else
  DMG="$OUT/SnipMD_${VERSION}_universal.preview.dmg"
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
  echo "== Signing with the Developer ID"
  KEYCHAIN="$TMP/signing.keychain-db"
  KEYCHAIN_PW="$(uuidgen)"
  echo "$APPLE_CERTIFICATE" | base64 --decode >"$TMP/cert.p12"
  security create-keychain -p "$KEYCHAIN_PW" "$KEYCHAIN"
  security set-keychain-settings -lut 3600 "$KEYCHAIN"
  security unlock-keychain -p "$KEYCHAIN_PW" "$KEYCHAIN"
  security import "$TMP/cert.p12" -k "$KEYCHAIN" -P "$APPLE_CERTIFICATE_PASSWORD" -T /usr/bin/codesign
  rm "$TMP/cert.p12"
  security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PW" "$KEYCHAIN" >/dev/null
  # shellcheck disable=SC2046 # the existing keychains, one word each
  security list-keychains -d user -s "$KEYCHAIN" $(security list-keychains -d user | tr -d '"')
  # The hardened runtime is what notarization requires.
  codesign --force --options runtime --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$APP"
else
  echo "== No Developer ID: the app keeps its ad-hoc signature"
fi
codesign --verify --strict --verbose=2 "$APP"

echo "== Making $(basename "$DMG")"
# The window shows the app next to a link to /Applications, to drag it across.
mkdir "$TMP/dmg"
cp -R "$APP" "$TMP/dmg/"
ln -s /Applications "$TMP/dmg/Applications"
hdiutil create -volname SnipMD -srcfolder "$TMP/dmg" -fs HFS+ -format UDZO -ov "$DMG"

if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
  codesign --force --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$DMG"
fi
if [ -n "${APPLE_ID:-}" ]; then
  echo "== Notarizing"
  xcrun notarytool submit "$DMG" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
  xcrun stapler staple "$DMG"
fi
echo "$DMG"
