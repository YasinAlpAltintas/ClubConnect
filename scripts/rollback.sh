#!/usr/bin/env bash
# ==============================================================================
# ClubConnect - Production & Staging Rollback Script
# Restores previous container images recorded in releases/${ENVIRONMENT}_previous.release
# Note: Does NOT rollback database schema migrations to prevent data loss.
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
  log_err "Usage: $0 <staging|production> [--confirm]"
  exit 1
fi

ENVIRONMENT="$1"
CONFIRM_FLAG="${2:-}"

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
  log_err "Invalid environment '$ENVIRONMENT'. Must be 'staging' or 'production'."
  exit 1
fi

if [ "$ENVIRONMENT" = "production" ] && [ "$CONFIRM_FLAG" != "--confirm" ]; then
  log_err "Production rollback requires explicit confirmation with the --confirm flag."
  log_err "Usage: $0 production --confirm"
  exit 1
fi

CLUBCONNECT_BASE_DIR="${CLUBCONNECT_BASE_DIR:-/opt/clubconnect}"
CONFIG_FILE="${CLUBCONNECT_BASE_DIR}/config/.env.${ENVIRONMENT}"
RELEASES_DIR="${CLUBCONNECT_BASE_DIR}/releases"
CURRENT_RELEASE_FILE="${RELEASES_DIR}/${ENVIRONMENT}_current.release"
PREVIOUS_RELEASE_FILE="${RELEASES_DIR}/${ENVIRONMENT}_previous.release"
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

if [ ! -f "$PREVIOUS_RELEASE_FILE" ]; then
  log_err "No previous release found at: $PREVIOUS_RELEASE_FILE"
  log_err "Rollback cannot be performed automatically because there is no recorded prior version."
  exit 1
fi

# ------------------------------------------------------------------------------
# Concurrency Lock (flock with atomic directory fallback)
# ------------------------------------------------------------------------------
LOCK_FILE="/tmp/clubconnect_${ENVIRONMENT}_deploy.lock"
LOCK_FD=200
LOCK_CLEANUP_DIR=""

cleanup_lock() {
  if [ -n "$LOCK_CLEANUP_DIR" ] && [ -d "$LOCK_CLEANUP_DIR" ]; then
    rm -rf "$LOCK_CLEANUP_DIR"
  fi
}
trap cleanup_lock EXIT INT TERM

if command -v flock >/dev/null 2>&1; then
  eval "exec ${LOCK_FD}>\"${LOCK_FILE}\""
  if ! flock -n "$LOCK_FD"; then
    log_err "Another deployment or rollback is already in progress for environment '${ENVIRONMENT}' (lock: ${LOCK_FILE})."
    exit 1
  fi
  log "Acquired lock on ${LOCK_FILE} via flock."
else
  LOCK_CLEANUP_DIR="${LOCK_FILE}.dirlock"
  if ! mkdir "$LOCK_CLEANUP_DIR" 2>/dev/null; then
    log_err "Another deployment or rollback is already in progress for environment '${ENVIRONMENT}' (lock: ${LOCK_CLEANUP_DIR})."
    exit 1
  fi
  log "Acquired lock on ${LOCK_CLEANUP_DIR}."
fi

# ------------------------------------------------------------------------------
# Parse Previous Release Data
# ------------------------------------------------------------------------------
log "Reading previous release metadata from ${PREVIOUS_RELEASE_FILE}..."

PREV_IMAGE_TAG=""
PREV_FRONTEND_IMAGE=""
PREV_API_IMAGE=""

while IFS='=' read -r key value || [ -n "$key" ]; do
  [[ "$key" =~ ^[[:space:]]*# ]] && continue
  [ -z "$key" ] && continue
  
  case "$key" in
    IMAGE_TAG) PREV_IMAGE_TAG="$value" ;;
    FRONTEND_IMAGE) PREV_FRONTEND_IMAGE="$value" ;;
    API_IMAGE) PREV_API_IMAGE="$value" ;;
  esac
done < "$PREVIOUS_RELEASE_FILE"

if [ -z "$PREV_FRONTEND_IMAGE" ] || [ -z "$PREV_API_IMAGE" ]; then
  log_err "Invalid release metadata in $PREVIOUS_RELEASE_FILE (missing image specifications)."
  exit 1
fi

log "Previous release target: ${PREV_IMAGE_TAG:-unknown}"
log "Rolling back frontend to: ${PREV_FRONTEND_IMAGE}"
log "Rolling back API to: ${PREV_API_IMAGE}"

export FRONTEND_IMAGE="$PREV_FRONTEND_IMAGE"
export API_IMAGE="$PREV_API_IMAGE"

# ------------------------------------------------------------------------------
# Redeploy Application Containers
# ------------------------------------------------------------------------------
log "Recreating application containers with previous release images..."
if ! docker compose --env-file "$CONFIG_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d --no-deps api frontend; then
  log_err "Rollback container recreation failed! Service may be in an inconsistent state."
  log_err "Manual inspection required via: docker compose --env-file '$CONFIG_FILE' -f '$COMPOSE_FILE' logs"
  exit 1
fi

# ------------------------------------------------------------------------------
# Smoke Tests Verification
# ------------------------------------------------------------------------------
log "Running smoke test suite on rolled-back environment..."
export CLUBCONNECT_BASE_DIR
if ! "${SCRIPT_DIR}/smoke-test.sh" "$ENVIRONMENT"; then
  log_err "Smoke tests FAILED following rollback! Manual intervention required."
  exit 1
fi
log "Smoke tests passed for rolled-back environment."

# ------------------------------------------------------------------------------
# Update Release Tracking
# ------------------------------------------------------------------------------
FAILED_RELEASE_FILE="${RELEASES_DIR}/${ENVIRONMENT}_failed_$(date -u +%Y%m%d_%H%M%SZ).release"
if [ -f "$CURRENT_RELEASE_FILE" ]; then
  mv "$CURRENT_RELEASE_FILE" "$FAILED_RELEASE_FILE"
  log "Archived failed release metadata to ${FAILED_RELEASE_FILE}."
fi
cp "$PREVIOUS_RELEASE_FILE" "$CURRENT_RELEASE_FILE"

HISTORY_LOG="${RELEASES_DIR}/history.log"
echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') | ${ENVIRONMENT} | ${PREV_IMAGE_TAG:-unknown} | ROLLBACK_SUCCESS | ${USER:-deploy}" >> "$HISTORY_LOG"

log "Rollback to ${PREV_IMAGE_TAG:-previous version} for environment '${ENVIRONMENT}' completed successfully!"
log "Reminder: Database schema migrations were NOT reversed to protect existing data."
exit 0
