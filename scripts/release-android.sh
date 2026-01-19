#!/bin/bash
set -e

# Release script for Stuga Android app
# Usage: ./scripts/release-android.sh [internal|production]

TRACK="${1:-internal}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ANDROID_DIR="$PROJECT_DIR/android"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Stuga Android Release ===${NC}"
echo "Track: $TRACK"
echo ""

# Check for required files
if [ ! -f "$ANDROID_DIR/stuga_keystore_private.jks" ]; then
  echo -e "${RED}Error: Keystore not found at android/stuga_keystore_private.jks${NC}"
  exit 1
fi

if [ ! -f "$ANDROID_DIR/fastlane/play-store-credentials.json" ]; then
  echo -e "${RED}Error: Play Store credentials not found${NC}"
  echo ""
  echo "To set up Google Play deployment:"
  echo "1. Go to Google Play Console → Setup → API access"
  echo "2. Create a service account with 'Release to production' permission"
  echo "3. Download the JSON key and save it as:"
  echo "   android/fastlane/play-store-credentials.json"
  echo ""
  exit 1
fi

# Check for keystore password
if [ -z "$KEYSTORE_PASSWORD" ]; then
  echo -e "${YELLOW}Enter keystore password:${NC}"
  read -s KEYSTORE_PASSWORD
  export KEYSTORE_PASSWORD
  echo ""
fi

# Build web assets
echo -e "${GREEN}Building web assets...${NC}"
cd "$PROJECT_DIR"
npm run build

# Sync with Capacitor
echo -e "${GREEN}Syncing with Capacitor...${NC}"
npx cap sync android

# Run fastlane
echo -e "${GREEN}Building and uploading to $TRACK...${NC}"
cd "$ANDROID_DIR"
fastlane "$TRACK"

echo ""
echo -e "${GREEN}=== Release complete! ===${NC}"
echo "Check Google Play Console for the new release."
