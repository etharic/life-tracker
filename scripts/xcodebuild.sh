#!/usr/bin/env bash
# Builds the generated iOS project (Codemagic, macOS).
#   scripts/xcodebuild.sh device      unsigned Release build for iPhone (packaged for SideStore afterwards)
#   scripts/xcodebuild.sh simulator   Release build for the iOS simulator (screenshots)
#
# Expo's module scanner gives up after 5 s on a busy build machine ("Scanning for @ExpoModule classes didn't
# complete ... Build again to retry the scan"). That one failure is retried once, as Expo advises; any other
# failure stops the build.
set -uo pipefail
KIND=${1:-device}
WS=$(ls -d ios/*.xcworkspace | head -1)
SCHEME=$(basename "$WS" .xcworkspace)
if [ "$KIND" = simulator ]; then
  DEST=(-sdk iphonesimulator -destination 'generic/platform=iOS Simulator')
  SIGN=()
else
  DEST=(-sdk iphoneos -destination 'generic/platform=iOS')
  SIGN=(CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' DEVELOPMENT_TEAM='')
fi

build() {
  xcodebuild -workspace "$WS" -scheme "$SCHEME" -configuration Release "${DEST[@]}" \
    -derivedDataPath "$CM_BUILD_DIR/derived" ${SIGN[@]+"${SIGN[@]}"} build 2>&1 | tee xcodebuild.log |
    grep -E '(error:|BUILD (SUCCEEDED|FAILED))' || true
  grep -q 'BUILD SUCCEEDED' xcodebuild.log
}

build && exit 0
if grep -q "Scanning for @ExpoModule classes didn't complete" xcodebuild.log; then
  echo "Expo module scan timed out; building once more."
  build && exit 0
fi
exit 1
