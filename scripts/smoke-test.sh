#!/usr/bin/env bash
# ==============================================================================
# ClubConnect - Deployment Smoke Test Script
# Verifies container health, frontend delivery, direct API health, and proxy routing.
# ==============================================================================
set -euo pipefail

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

log_err() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [ERROR] $*" >&2
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -lt 1 ]; then
  log_err "Usage: $0 <staging|production>"
  exit 1
fi

ENVIRONMENT="$1"
if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
  log_err "Invalid environment '$ENVIRONMENT'. Must be 'staging' or 'production'."
  exit 1
fi

CLUBCONNECT_BASE_DIR="${CLUBCONNECT_BASE_DIR:-/opt/clubconnect}"
CONFIG_FILE="${CLUBCONNECT_BASE_DIR}/config/.env.${ENVIRONMENT}"
PROJECT_NAME="clubconnect-${ENVIRONMENT}"

if [ ! -f "$CONFIG_FILE" ]; then
  log_err "Required environment file not found at: ${CONFIG_FILE}"
  exit 1
fi

export CONFIG_FILE

# Prioritize release-bundled Compose template if available
if [ -f "${SCRIPT_DIR}/../deploy/compose.${ENVIRONMENT}.yml" ]; then
  COMPOSE_FILE="${SCRIPT_DIR}/../deploy/compose.${ENVIRONMENT}.yml"
elif [ -f "${CLUBCONNECT_BASE_DIR}/compose.${ENVIRONMENT}.yml" ]; then
  COMPOSE_FILE="${CLUBCONNECT_BASE_DIR}/compose.${ENVIRONMENT}.yml"
else
  log_err "Compose file not found for '${ENVIRONMENT}'."
  exit 1
fi

if [ "$ENVIRONMENT" = "staging" ]; then
  FRONTEND_PORT="${FRONTEND_PORT:-8088}"
else
  FRONTEND_PORT="${FRONTEND_PORT:-8080}"
fi

FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"

log "Starting smoke tests for environment '${ENVIRONMENT}' at ${FRONTEND_URL}..."

# ------------------------------------------------------------------------------
# 1. Container Status Verification
# ------------------------------------------------------------------------------
log "Checking container statuses for project '${PROJECT_NAME}'..."
running_services=$(docker compose --env-file "$CONFIG_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" ps --status running --format '{{.Service}}' 2>/dev/null || true)

for service in postgres api frontend; do
  if ! grep -q "^${service}$" <<< "$running_services"; then
    log_err "Required service '${service}' is not running in project '${PROJECT_NAME}'."
    docker compose --env-file "$CONFIG_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" ps
    exit 1
  fi
  log "Service '${service}' is running."
done

# ------------------------------------------------------------------------------
# 2. Direct Backend Health Check (Preventing Nginx Routing False Positives)
# ------------------------------------------------------------------------------
log "Verifying direct backend /health endpoint on internal network..."
backend_healthy=0
for i in $(seq 1 30); do
  # Query api:8080/health directly via frontend container in the Docker network
  api_health_out=$(docker compose --env-file "$CONFIG_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" exec -T frontend wget -qO- http://api:8080/health 2>/dev/null || true)
  if grep -q "Healthy" <<< "$api_health_out"; then
    log "Direct backend health check passed: 'Healthy' received."
    backend_healthy=1
    break
  fi
  log "Attempt $i/30: direct backend not ready yet, retrying in 1s..."
  sleep 1
done

if [ "$backend_healthy" -ne 1 ]; then
  log_err "Direct backend health check failed after 30 attempts."
  log_err "Backend container logs:"
  docker compose --env-file "$CONFIG_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" logs --tail=50 api || true
  exit 1
fi

# ------------------------------------------------------------------------------
# 3. Frontend HTTP 200 & HTML Delivery Check
# ------------------------------------------------------------------------------
log "Checking frontend availability at ${FRONTEND_URL}..."
frontend_ready=0
for i in $(seq 1 15); do
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null || true)
  if [ "$http_code" = "200" ]; then
    frontend_html=$(curl -s "$FRONTEND_URL" 2>/dev/null || true)
    if grep -q "<html" <<< "$frontend_html" || grep -q 'id="root"' <<< "$frontend_html"; then
      log "Frontend HTTP 200 OK and HTML markup verified."
      frontend_ready=1
      break
    fi
  fi
  log "Attempt $i/15: frontend returned HTTP $http_code, retrying in 1s..."
  sleep 1
done

if [ "$frontend_ready" -ne 1 ]; then
  log_err "Frontend health check failed at ${FRONTEND_URL}."
  exit 1
fi

# ------------------------------------------------------------------------------
# 4. Reverse Proxy Integration Check (POST /api/auth/register -> HTTP 400)
# ------------------------------------------------------------------------------
log "Verifying reverse proxy routing to API via POST ${FRONTEND_URL}/api/auth/register..."
proxy_ready=0
for i in $(seq 1 15); do
  # Send an empty JSON object to test proxy pass + model validation without inserting data
  response_body=$(curl -s -X POST "${FRONTEND_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null || true)

  status_code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${FRONTEND_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null || true)

  if [ "$status_code" = "400" ] && grep -q "invalid_input" <<< "$response_body"; then
    log "Reverse proxy routing verified: API returned HTTP 400 with expected 'invalid_input' payload."
    proxy_ready=1
    break
  fi

  log "Attempt $i/15: proxy route returned HTTP $status_code ($response_body), retrying in 1s..."
  sleep 1
done

if [ "$proxy_ready" -ne 1 ]; then
  log_err "Reverse proxy verification failed. Nginx may not be routing /api/ to backend."
  exit 1
fi

log "All smoke tests passed successfully for environment '${ENVIRONMENT}'!"
exit 0
