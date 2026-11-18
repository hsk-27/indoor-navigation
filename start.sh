#!/usr/bin/env bash
# ==========================================
#   Indoor Navigation - Linux Server Start
#   GHRCE Indoor Navigation System
# ==========================================

set -e

# Colored output helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}==========================================${NC}"
echo -e "${CYAN}  Indoor Navigation - Linux Server Start  ${NC}"
echo -e "${CYAN}==========================================${NC}"
echo ""

# 1. Detect Network IP or Target Domain
echo -e "${YELLOW}[1/5] Resolving Server Host/IP...${NC}"
if [ -n "$1" ]; then
    SERVER_TARGET="$1"
    echo -e "  ${GREEN}OK${NC} Using specified server target: ${SERVER_TARGET}"
else
    # Auto-detect primary IP
    DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -z "$DETECTED_IP" ]; then
        DETECTED_IP=$(ip route get 1 2>/dev/null | awk '{print $7}')
    fi
    if [ -z "$DETECTED_IP" ]; then
        DETECTED_IP="localhost"
        echo -e "  ${YELLOW}WARN${NC} No network IP detected. Using localhost."
    else
        echo -e "  ${GREEN}OK${NC} Detected Server IP: ${DETECTED_IP}"
    fi
    SERVER_TARGET="$DETECTED_IP"
fi

# Format URL
if [[ "$SERVER_TARGET" =~ ^https?:// ]]; then
    FRONTEND_URL="$SERVER_TARGET"
    BACKEND_URL="$SERVER_TARGET"
elif [[ "$SERVER_TARGET" =~ : ]]; then
    FRONTEND_URL="http://${SERVER_TARGET}"
    BACKEND_URL="http://${SERVER_TARGET}"
elif [ "$SERVER_TARGET" = "localhost" ]; then
    FRONTEND_URL="http://localhost:5173"
    BACKEND_URL="http://localhost:8080"
else
    # Standard IP or domain
    FRONTEND_URL="http://${SERVER_TARGET}:5173"
    BACKEND_URL="http://${SERVER_TARGET}:8080"
fi

# 2. Check Docker Status
echo -e "\n${YELLOW}[2/5] Checking Docker & Docker Compose...${NC}"
if ! command -v docker >/dev/null 2>&1; then
    echo -e "  ${RED}FAIL${NC} Docker is not installed. Please install Docker Engine."
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo -e "  ${RED}FAIL${NC} Docker daemon is not running. Please start Docker (sudo systemctl start docker)."
    exit 1
fi
echo -e "  ${GREEN}OK${NC} Docker is active."

# 3. Boot Full Stack via Docker Compose
echo -e "\n${YELLOW}[3/5] Starting Docker Containers...${NC}"
# Remove any leftover temporary .env that might interfere
rm -f ./frontend/.env

# Detect compose command syntax (docker compose vs docker-compose)
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "  ${RED}FAIL${NC} Neither 'docker compose' nor 'docker-compose' found."
    exit 1
fi

$DOCKER_COMPOSE up -d --build
echo -e "  ${GREEN}OK${NC} Containers started."

# 4. Check & Restore Database
echo -e "\n${YELLOW}[4/5] Verifying Database Health & Schema...${NC}"
WAIT=0
MAX_WAIT=30
DB_READY=false
while [ $WAIT -lt $MAX_WAIT ]; do
    if docker exec indoor_nav_db pg_isready -h 127.0.0.1 -U postgres -d indoor_nav >/dev/null 2>&1; then
        DB_READY=true
        break
    fi
    sleep 2
    WAIT=$((WAIT + 2))
done

if [ "$DB_READY" = false ]; then
    echo -e "  ${RED}FAIL${NC} Database failed to become ready within ${MAX_WAIT}s."
    exit 1
fi
echo -e "  ${GREEN}OK${NC} PostgreSQL is ready."

# Check if restored_marker table exists
IS_RESTORED=$(docker exec indoor_nav_db psql -U postgres -d indoor_nav -tAc "SELECT 1 FROM pg_tables WHERE tablename='restored_marker';" 2>/dev/null || true)
if [ "$IS_RESTORED" != "1" ]; then
    if [ -f "./database_backup.sql" ]; then
        echo -e "  ${YELLOW}INFO${NC} Fresh database detected. Restoring initial database_backup.sql..."
        docker exec -i indoor_nav_db psql -U postgres -d indoor_nav -q < ./database_backup.sql
        docker exec -i indoor_nav_db psql -U postgres -d indoor_nav -c "CREATE TABLE IF NOT EXISTS restored_marker (id int);" >/dev/null 2>&1
        docker restart indoor_nav_backend >/dev/null 2>&1
        echo -e "  ${GREEN}OK${NC} Database restored and backend restarted."
    else
        docker exec -i indoor_nav_db psql -U postgres -d indoor_nav -c "CREATE TABLE IF NOT EXISTS restored_marker (id int);" >/dev/null 2>&1
    fi
fi

# 5. Update Deployment Configuration & QR
echo -e "\n${YELLOW}[5/5] Updating Deployment Configuration...${NC}"
CONFIG_PATH="./backend/config/deployment.json"
if [ -f "$CONFIG_PATH" ]; then
    if grep -qi '"isCustomUrl"[[:space:]]*:[[:space:]]*true' "$CONFIG_PATH"; then
        echo -e "  ${YELLOW}INFO${NC} Custom deployment URL preserved."
    else
        # Update deployment JSON with target URL
        cat <<EOF > "$CONFIG_PATH"
{
  "deploymentUrl": "${FRONTEND_URL}",
  "generatedBy": "start.sh",
  "isCustomUrl": false,
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deploymentVersion": 1
}
EOF
        echo -e "  ${GREEN}OK${NC} deployment.json updated to ${FRONTEND_URL}"
    fi
fi

# Print Final Summary Banner
echo ""
echo -e "${CYAN}==========================================${NC}"
echo -e "${GREEN}  Startup Complete! System is LIVE.       ${NC}"
echo -e "  Frontend Web:    ${FRONTEND_URL}"
echo -e "  Admin Dashboard: ${FRONTEND_URL}/admin/login"
echo -e "  Backend API:     ${BACKEND_URL}/api/v1/localization/buildings"
echo -e "  APK Download:    ${FRONTEND_URL}/uploads/ghrce-nav.apk"
echo -e "${CYAN}==========================================${NC}"
echo ""
