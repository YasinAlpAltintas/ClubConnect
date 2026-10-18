#!/usr/bin/env bash
# ==============================================================================
# ClubConnect - PostgreSQL Database Backup Script
# Creates verified, custom-format (-Fc) PostgreSQL dumps with automated retention.
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
BACKUPS_DIR="${CLUBCONNECT_BASE_DIR}/backups"
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

DB_NAME="clubconnect_${ENVIRONMENT}"
DB_USER="clubconnect"

# Parse DB name and user from protected environment file without printing secrets
env_db=$(grep -E '^[[:space:]]*POSTGRES_DB=' "$CONFIG_FILE" | cut -d '=' -f2- | tr -d ' "\r' || true)
env_user=$(grep -E '^[[:space:]]*POSTGRES_USER=' "$CONFIG_FILE" | cut -d '=' -f2- | tr -d ' "\r' || true)
[ -n "$env_db" ] && DB_NAME="$env_db"
[ -n "$env_user" ] && DB_USER="$env_user"

mkdir -p "$BACKUPS_DIR"
chmod 700 "$BACKUPS_DIR" 2>/dev/null || true

TIMESTAMP=$(date -u +%Y%m%d_%H%M%SZ)
BACKUP_FILENAME="clubconnect_${ENVIRONMENT}_${TIMESTAMP}.dump"
FINAL_BACKUP_PATH="${BACKUPS_DIR}/${BACKUP_FILENAME}"
TEMP_BACKUP_PATH="${BACKUPS_DIR}/${BACKUP_FILENAME}.tmp"

log "Initiating PostgreSQL backup for environment '${ENVIRONMENT}' (db: ${DB_NAME}, user: ${DB_USER})..."

# Dump database using --env-file to a temporary file first
if ! docker compose --env-file "$CONFIG_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" exec -T postgres \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$TEMP_BACKUP_PATH"; then
  log_err "pg_dump failed to create database dump."
  rm -f "$TEMP_BACKUP_PATH"
  exit 1
fi

# Verify non-empty file
if [ ! -s "$TEMP_BACKUP_PATH" ]; then
  log_err "Backup file is empty: $TEMP_BACKUP_PATH"
  rm -f "$TEMP_BACKUP_PATH"
  exit 1
fi

log "Verifying backup archive readability with pg_restore -l..."
if ! docker compose --env-file "$CONFIG_FILE" -f "$COMPOSE_FILE" --project-name "$PROJECT_NAME" exec -T postgres \
  pg_restore -l < "$TEMP_BACKUP_PATH" > /dev/null 2>&1; then
  log_err "Backup archive verification failed. File may be corrupt."
  rm -f "$TEMP_BACKUP_PATH"
  exit 1
fi

# Atomically move verified dump into place
mv "$TEMP_BACKUP_PATH" "$FINAL_BACKUP_PATH"
chmod 600 "$FINAL_BACKUP_PATH" 2>/dev/null || true
log "Backup successfully created and verified: $FINAL_BACKUP_PATH"

# Retention management: keep the last 7 backups, never prune if <= 1 exists
log "Applying backup retention policy (keeping last 7)..."
backups=()
while IFS= read -r file; do
  [ -n "$file" ] && backups+=("$file")
done < <(find "$BACKUPS_DIR" -maxdepth 1 -type f -name "clubconnect_${ENVIRONMENT}_*.dump" | sort -r)

total_backups=${#backups[@]}
if [ "$total_backups" -gt 7 ]; then
  for ((i=7; i<total_backups; i++)); do
    old_backup="${backups[$i]}"
    log "Pruning expired backup: $old_backup"
    rm -f "$old_backup"
  done
  log "Pruning complete. Total backups retained: 7"
else
  log "Total backups ($total_backups) within retention limit (7). No pruning needed."
fi

exit 0
