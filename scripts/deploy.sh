#!/usr/bin/env bash
# ==============================================================================
# ClubConnect - Production & Staging Deployment Orchestrator
# Executes pre-flight validation, image pulling, backup, migrations, and updates.
# ==============================================================================
set -euo pipefail

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

log_err() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [ERROR] $*" >&2
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -lt 2 ]; then
  log_err "Usage: $0 <staging|production> <image-tag> [options]"
  log_err "Options:"
  log_err "  --confirm                             Required for production deployments"
  log_err "  --verified-frontend-digest=<sha256>   Enforce exact staging-verified frontend digest"
  log_err "  --verified-backend-digest=<sha256>    Enforce exact staging-verified backend digest"
  log_err "Example: $0 staging sha-066e2eb8fd1c178d45d520967b93548551dd80db"
  exit 1
fi

ENVIRONMENT="$1"
IMAGE_TAG="$2"
CONFIRM_FLAG="false"
VERIFIED_FRONTEND_DIGEST=""
VERIFIED_BACKEND_DIGEST=""

shift 2
while [ $# -gt 0 ]; do
  case "$1" in
    --confirm)
      CONFIRM_FLAG="true"
      shift
      ;;
    --verified-frontend-digest=*)
      VERIFIED_FRONTEND_DIGEST="${1#*=}"
      shift
      ;;
    --verified-frontend-digest)
      VERIFIED_FRONTEND_DIGEST="${2:-}"
      shift 2 2>/dev/null || shift
      ;;
    --verified-backend-digest=*)
      VERIFIED_BACKEND_DIGEST="${1#*=}"
      shift
      ;;
    --verified-backend-digest)
      VERIFIED_BACKEND_DIGEST="${2:-}"
      shift 2 2>/dev/null || shift
      ;;
    *)
      log_err "Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
  log_err "Invalid environment '$ENVIRONMENT'. Must be 'staging' or 'production'."
  exit 1
fi

if [ -z "$IMAGE_TAG" ]; then
  log_err "Image tag cannot be empty."
  exit 1
fi

CLUBCONNECT_BASE_DIR="${CLUBCONNECT_BASE_DIR:-/opt/clubconnect}"
CONFIG_FILE="${CLUBCONNECT_BASE_DIR}/config/.env.${ENVIRONMENT}"
RELEASES_DIR="${CLUBCONNECT_BASE_DIR}/releases"
PROJECT_NAME="clubconnect-${ENVIRONMENT}"

# ------------------------------------------------------------------------------
# 1. Protected Environment File Handling
# ------------------------------------------------------------------------------
if [ ! -f "$CONFIG_FILE" ]; then
  log_err "Required environment file not found at: ${CONFIG_FILE}"
  exit 1
fi

export CONFIG_FILE

# ------------------------------------------------------------------------------
# 2. Versioned Compose Configuration Resolution
# ------------------------------------------------------------------------------
if [ -f "${SCRIPT_DIR}/../deploy/compose.${ENVIRONMENT}.yml" ]; then
  COMPOSE_FILE="${SCRIPT_DIR}/../deploy/compose.${ENVIRONMENT}.yml"
  log "Using versioned Compose template: ${COMPOSE_FILE}"
elif [ -f "${CLUBCONNECT_BASE_DIR}/compose.${ENVIRONMENT}.yml" ]; then
  COMPOSE_FILE="${CLUBCONNECT_BASE_DIR}/compose.${ENVIRONMENT}.yml"
  log "Using base directory Compose file: ${COMPOSE_FILE}"
else
  log_err "Compose file not found for '${ENVIRONMENT}'."
  exit 1
fi

# ------------------------------------------------------------------------------
# 3. Concurrency Lock (flock with atomic directory fallback)
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
    log_err "Another deployment is already in progress for environment '${ENVIRONMENT}' (lock: ${LOCK_FILE})."
    exit 1
  fi
  log "Acquired deployment lock on ${LOCK_FILE} via flock."
else
  LOCK_CLEANUP_DIR="${LOCK_FILE}.dirlock"
  if ! mkdir "$LOCK_CLEANUP_DIR" 2>/dev/null; then
    log_err "Another deployment is already in progress for environment '${ENVIRONMENT}' (lock: ${LOCK_CLEANUP_DIR})."
    exit 1
  fi
  log "Acquired deployment lock on ${LOCK_CLEANUP_DIR}."
fi

# ------------------------------------------------------------------------------
# 4. First Deployment Onboarding Baseline
# ------------------------------------------------------------------------------
mkdir -p "$RELEASES_DIR"
CURRENT_RELEASE_FILE="${RELEASES_DIR}/${ENVIRONMENT}_current.release"
PREVIOUS_RELEASE_FILE="${RELEASES_DIR}/${ENVIRONMENT}_previous.release"

if [ ! -f "$CURRENT_RELEASE_FILE" ]; then
  log "No current release metadata found for '${ENVIRONMENT}'. Inspecting existing running containers for onboarding baseline..."
  running_api_id=$(docker ps --filter "label=com.docker.compose.project=${PROJECT_NAME}" --filter "label=com.docker.compose.service=api" --format '{{.ID}}' 2>/dev/null | head -n 1 || true)
  running_frontend_id=$(docker ps --filter "label=com.docker.compose.project=${PROJECT_NAME}" --filter "label=com.docker.compose.service=frontend" --format '{{.ID}}' 2>/dev/null | head -n 1 || true)

  if [ -n "$running_api_id" ] && [ -n "$running_frontend_id" ]; then
    baseline_api_image=$(docker inspect --format='{{.Config.Image}}' "$running_api_id" 2>/dev/null || true)
    baseline_frontend_image=$(docker inspect --format='{{.Config.Image}}' "$running_frontend_id" 2>/dev/null || true)
    baseline_api_digest=$(docker inspect --format='{{index .RepoDigests 0}}' "$baseline_api_image" 2>/dev/null || echo "$baseline_api_image")
    baseline_frontend_digest=$(docker inspect --format='{{index .RepoDigests 0}}' "$baseline_frontend_image" 2>/dev/null || echo "$baseline_frontend_image")
    baseline_tag=$(grep -oE 'sha-[0-9a-fA-F]+' <<< "$baseline_api_image" || echo "sha-066e2eb8fd1c178d45d520967b93548551dd80db")

    cat <<EOF > "$PREVIOUS_RELEASE_FILE"
DEPLOY_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
ENVIRONMENT=${ENVIRONMENT}
IMAGE_TAG=${baseline_tag}
FRONTEND_IMAGE=${baseline_frontend_image}
FRONTEND_DIGEST=${baseline_frontend_digest}
API_IMAGE=${baseline_api_image}
API_DIGEST=${baseline_api_digest}
DEPLOYED_BY=onboarding-baseline
EOF
    log "Successfully initialized rollback baseline in ${PREVIOUS_RELEASE_FILE} from running containers (tag: ${baseline_tag})."
  else
    log "No active containers detected for onboarding baseline. Proceeding with clean initial deployment."
  fi
fi

# ------------------------------------------------------------------------------
# 5. Image Pull & Immutable Digest Resolution
# ------------------------------------------------------------------------------
REGISTRY="${REGISTRY:-ghcr.io/yasinalpaltintas}"
export FRONTEND_IMAGE="${REGISTRY}/clubconnect-frontend:${IMAGE_TAG}"
export API_IMAGE="${REGISTRY}/clubconnect-backend:${IMAGE_TAG}"

log "Target release: ${IMAGE_TAG}"
log "Pulling frontend image: ${FRONTEND_IMAGE}..."
if ! docker pull "$FRONTEND_IMAGE"; then
  log_err "Failed to pull frontend image: ${FRONTEND_IMAGE}"
  exit 1
fi

log "Pulling API image: ${API_IMAGE}..."
if ! docker pull "$API_IMAGE"; then
  log_err "Failed to pull API image: ${API_IMAGE}"
  exit 1
fi

FRONTEND_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' "$FRONTEND_IMAGE" 2>/dev/null || true)
API_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' "$API_IMAGE" 2>/dev/null || true)

if [ -z "$FRONTEND_DIGEST" ] || [ -z "$API_DIGEST" ]; then
  log_err "Failed to resolve immutable digest for ${FRONTEND_IMAGE} or ${API_IMAGE}."
  log_err "Deployments must use resolvable, immutable container image digests. Refusing to proceed."
  exit 1
fi

log "Verified frontend image digest: ${FRONTEND_DIGEST}"
log "Verified API image digest: ${API_DIGEST}"

# ------------------------------------------------------------------------------
# 6. Rendered Compose Configuration Image Verification
# ------------------------------------------------------------------------------
log "Validating rendered Docker Compose configuration..."
rendered_config=$(docker compose --env-file "$CONFIG_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" config 2>/dev/null || true)

if [ -z "$rendered_config" ]; then
  log_err "Failed to validate Docker Compose configuration for ${COMPOSE_FILE}."
  exit 1
fi

if ! grep -qF "$FRONTEND_IMAGE" <<< "$rendered_config" && ! grep -qF "$FRONTEND_DIGEST" <<< "$rendered_config"; then
  log_err "Rendered Compose configuration does not match requested frontend image: ${FRONTEND_IMAGE}"
  exit 1
fi

if ! grep -qF "$API_IMAGE" <<< "$rendered_config" && ! grep -qF "$API_DIGEST" <<< "$rendered_config"; then
  log_err "Rendered Compose configuration does not match requested API image: ${API_IMAGE}"
  exit 1
fi
log "Docker Compose configuration verified: all services bound to target images."

# ------------------------------------------------------------------------------
# 7. Production Eligibility & Staging Digest Verification
# ------------------------------------------------------------------------------
if [ "$ENVIRONMENT" = "production" ]; then
  log "Enforcing production deployment safeguards..."
  if [ "$CONFIRM_FLAG" != "true" ]; then
    log_err "Production deployment requires explicit confirmation with the '--confirm' flag."
    exit 1
  fi

  if [ -z "$VERIFIED_FRONTEND_DIGEST" ] || [ -z "$VERIFIED_BACKEND_DIGEST" ]; then
    log_err "Production deployment REJECTED: Missing required staging verification digests."
    log_err "Must provide --verified-frontend-digest and --verified-backend-digest."
    exit 1
  fi

  if [ "$FRONTEND_DIGEST" != "$VERIFIED_FRONTEND_DIGEST" ]; then
    log_err "Production deployment REJECTED: Target frontend digest ($FRONTEND_DIGEST) does not match staging verified digest ($VERIFIED_FRONTEND_DIGEST)."
    exit 1
  fi

  if [ "$API_DIGEST" != "$VERIFIED_BACKEND_DIGEST" ]; then
    log_err "Production deployment REJECTED: Target API digest ($API_DIGEST) does not match staging verified digest ($VERIFIED_BACKEND_DIGEST)."
    exit 1
  fi

  log "Production eligibility confirmed: Target image digests match staging-tested artifacts exactly."
fi

# ------------------------------------------------------------------------------
# 8. PostgreSQL Pre-flight & Pre-deployment Backup
# ------------------------------------------------------------------------------
log "Checking PostgreSQL health for project '${PROJECT_NAME}'..."
if ! docker compose --env-file "$CONFIG_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" ps --status running --format '{{.Service}}' 2>/dev/null | grep -q "^postgres$"; then
  log "Starting PostgreSQL service..."
  docker compose --env-file "$CONFIG_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d postgres
fi

log "Creating pre-deployment database backup..."
export CLUBCONNECT_BASE_DIR
"${SCRIPT_DIR}/backup-db.sh" "$ENVIRONMENT"
log "Database backup confirmed healthy."

# ------------------------------------------------------------------------------
# 9. EF Core Database Migration
# ------------------------------------------------------------------------------
log "Executing database migrations with newly pulled image (${API_IMAGE})..."
if ! docker compose --env-file "$CONFIG_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" run --rm --no-deps api --migrate; then
  log_err "EF Core database migration failed! Aborting deployment."
  log_err "Application containers were NOT updated. Database migrations are NOT automatically reversed."
  exit 1
fi
log "EF Core migrations applied successfully."

# ------------------------------------------------------------------------------
# 10. Application Container Recreation
# ------------------------------------------------------------------------------
log "Recreating application containers (api, frontend)..."
if ! docker compose --env-file "$CONFIG_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" up -d --no-deps api frontend; then
  log_err "Application container recreation failed! Service may be in an inconsistent state."
  log_err "EF Core database migrations were applied and will NOT be automatically reversed."
  log_err "To restore previous containers, execute: ${SCRIPT_DIR}/rollback.sh ${ENVIRONMENT}"
  exit 1
fi

# ------------------------------------------------------------------------------
# 11. Container Post-Deployment Image Verification
# ------------------------------------------------------------------------------
log "Verifying running containers match requested release..."
running_api_img=$(docker inspect --format='{{.Config.Image}}' "${PROJECT_NAME}-api" 2>/dev/null || true)
running_frontend_img=$(docker inspect --format='{{.Config.Image}}' "${PROJECT_NAME}-frontend" 2>/dev/null || true)

if [ -n "$running_api_img" ] && [ "$running_api_img" != "$API_IMAGE" ] && [ "$running_api_img" != "$API_DIGEST" ]; then
  log_err "Running API container image ($running_api_img) does not match requested image ($API_IMAGE)."
  exit 1
fi

if [ -n "$running_frontend_img" ] && [ "$running_frontend_img" != "$FRONTEND_IMAGE" ] && [ "$running_frontend_img" != "$FRONTEND_DIGEST" ]; then
  log_err "Running frontend container image ($running_frontend_img) does not match requested image ($FRONTEND_IMAGE)."
  exit 1
fi
log "Running container image identities successfully verified."

# ------------------------------------------------------------------------------
# 12. Smoke Tests Verification
# ------------------------------------------------------------------------------
log "Running smoke test suite..."
if ! "${SCRIPT_DIR}/smoke-test.sh" "$ENVIRONMENT"; then
  log_err "Smoke tests FAILED for environment '${ENVIRONMENT}'!"
  log_err "You can rollback to the previous version using: ${SCRIPT_DIR}/rollback.sh ${ENVIRONMENT}"
  exit 1
fi
log "Smoke tests passed successfully."

# ------------------------------------------------------------------------------
# 13. Release Recording & Evidence Generation
# ------------------------------------------------------------------------------
if [ -f "$CURRENT_RELEASE_FILE" ]; then
  cp "$CURRENT_RELEASE_FILE" "$PREVIOUS_RELEASE_FILE"
  log "Rotated previous release metadata to ${PREVIOUS_RELEASE_FILE}."
fi

cat <<EOF > "$CURRENT_RELEASE_FILE"
DEPLOY_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
ENVIRONMENT=${ENVIRONMENT}
IMAGE_TAG=${IMAGE_TAG}
FRONTEND_IMAGE=${FRONTEND_IMAGE}
FRONTEND_DIGEST=${FRONTEND_DIGEST}
API_IMAGE=${API_IMAGE}
API_DIGEST=${API_DIGEST}
DEPLOYED_BY=${USER:-deploy}
EOF

HISTORY_LOG="${RELEASES_DIR}/history.log"
echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') | ${ENVIRONMENT} | ${IMAGE_TAG} | SUCCESS | ${USER:-deploy} | ${API_DIGEST}" >> "$HISTORY_LOG"

# Generate immutable verification evidence for promotion gating
CLEAN_SHA="${IMAGE_TAG#sha-}"
EVIDENCE_FILE="${RELEASES_DIR}/${ENVIRONMENT}_evidence_${CLEAN_SHA}.json"
cat <<EOF > "$EVIDENCE_FILE"
{
  "commit_sha": "${CLEAN_SHA}",
  "environment": "${ENVIRONMENT}",
  "image_tag": "${IMAGE_TAG}",
  "frontend_digest": "${FRONTEND_DIGEST}",
  "backend_digest": "${API_DIGEST}",
  "deployed_by": "${USER:-deploy}",
  "deployed_at": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "smoke_test": "PASSED"
}
EOF

if [ -f "${SCRIPT_DIR}/../staging_evidence.json" ] || [ -d "${SCRIPT_DIR}/.." ]; then
  cp "$EVIDENCE_FILE" "${SCRIPT_DIR}/../staging_evidence.json" 2>/dev/null || true
fi

if [ "$ENVIRONMENT" = "staging" ]; then
  STAGING_VALIDATED_FILE="${RELEASES_DIR}/staging_validated_digests.txt"
  echo "${API_DIGEST} | ${FRONTEND_DIGEST} | ${IMAGE_TAG} | $(date -u +'%Y-%m-%dT%H:%M:%SZ')" >> "$STAGING_VALIDATED_FILE"
  log "Recorded verified staging digests in ${STAGING_VALIDATED_FILE}."
fi

log "Deployment of ${IMAGE_TAG} to '${ENVIRONMENT}' completed successfully!"
exit 0
