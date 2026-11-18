#!/usr/bin/env bash
# ==========================================
#   Indoor Navigation - Linux APK Rebuild
# ==========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}  Indoor Navigation - Linux APK Rebuilder ${NC}"
echo -e "${CYAN}==========================================${NC}"
echo ""

if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./build_apk.sh <SERVER_URL_OR_IP>${NC}"
    echo -e "Example: ./build_apk.sh https://nav.ghrce.edu.in"
    echo -e "Example: ./build_apk.sh 192.168.1.50"
    exit 1
fi

TARGET_URL="$1"
if [[ ! "$TARGET_URL" =~ ^https?:// ]]; then
    if [[ "$TARGET_URL" =~ : ]]; then
        TARGET_URL="http://${TARGET_URL}"
    else
        TARGET_URL="http://${TARGET_URL}:8080"
    fi
fi

echo -e "Target Backend URL: ${GREEN}${TARGET_URL}${NC}"

# 1. Inject into .env
echo -e "\n${YELLOW}[1/4] Injecting VITE_BACKEND_URL...${NC}"
echo "VITE_BACKEND_URL=${TARGET_URL}" > ./frontend/.env

# 2. Compile Web Assets via Docker
echo -e "\n${YELLOW}[2/4] Compiling Web Assets via Docker...${NC}"
docker run --rm -v "${PWD}/frontend:/app" -w /app node:20-alpine sh -c "npm install && npm audit fix || true && npm run build"

# 3. Sync Assets to Android
echo -e "\n${YELLOW}[3/4] Syncing Assets to Android Project...${NC}"
rm -rf ./frontend/android/app/src/main/assets/public
mkdir -p ./frontend/android/app/src/main/assets/public
cp -r ./frontend/dist/* ./frontend/android/app/src/main/assets/public/

# 4. Gradle Assembly
echo -e "\n${YELLOW}[4/4] Building APK via Gradle...${NC}"
if [ -x ./frontend/android/gradlew ] || [ -f ./frontend/android/gradlew ]; then
    (cd ./frontend/android && ./gradlew assembleDebug)
    cp ./frontend/android/app/build/outputs/apk/debug/app-debug.apk ./backend/uploads/ghrce-nav.apk
    echo -e "${GREEN}SUCCESS: APK Built and deployed to backend/uploads/ghrce-nav.apk${NC}"
else
    echo -e "${YELLOW}Notice: Gradle not found in host environment. Web assets have been bundled and synced into Android assets.${NC}"
    echo -e "${YELLOW}Open frontend/android in Android Studio or run gradlew on a machine with Android SDK to finalize APK.${NC}"
fi

# Cleanup
rm -f ./frontend/.env
