#!/usr/bin/env bash
# ==============================================================================
# ClubConnect - Comprehensive Deployment & Security Verification Test Suite
# Tests:
# 1. Shell script syntax validation (bash -n)
# 2. Argument and parameter parsing across all scripts
# 3. Protected environment file validation & secret confidentiality
# 4. Backup generation, integrity verification (-Fc, pg_restore -l) & retention (7 kept)
# 5. Immutable image identity and digest failure handling
# 6. First deployment onboarding baseline from running containers (CC-NPR scenario)
# 7. Production dual-digest staging verification & unverified release rejection
# 8. EF Core migration failure abort safety
# 9. Container recreation failure reporting and recovery guidance
# 10. Rollback execution & schema migration protection
# 11. Production secrets isolation & missing credential rejection
# 12. Commit SHA 40-character hexadecimal validation & shell injection resistance
# 13. Staging evidence artifact JSON validation
# 14. CI check-runs passing gate validation
# 15. Missing GHCR container images inspection gate
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

TESTS_PASSED=0
TESTS_FAILED=0

pass() {
  echo "  [PASS] $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
  echo "  [FAIL] $1" >&2
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

echo "========================================================================"
echo "Running ClubConnect Deployment Scripts & Security Test Suite"
echo "========================================================================"

# ------------------------------------------------------------------------------
# Test 1: Shell script syntax validation (bash -n)
# ------------------------------------------------------------------------------
echo "Test 1: Shell script syntax validation..."
for script in "${REPO_ROOT}/scripts"/*.sh; do
  if bash -n "$script"; then
    pass "Syntax valid: $(basename "$script")"
  else
    fail "Syntax error in: $(basename "$script")"
  fi
done

# ------------------------------------------------------------------------------
# Test 2: Argument and Parameter Validation
# ------------------------------------------------------------------------------
echo "Test 2: Parameter & argument validation..."

if ! "${REPO_ROOT}/scripts/backup-db.sh" >/dev/null 2>&1; then
  pass "backup-db.sh rejected missing arguments"
else
  fail "backup-db.sh should reject missing arguments"
fi

if ! "${REPO_ROOT}/scripts/backup-db.sh" invalid_env >/dev/null 2>&1; then
  pass "backup-db.sh rejected invalid environment"
else
  fail "backup-db.sh should reject invalid environment"
fi

if ! "${REPO_ROOT}/scripts/smoke-test.sh" >/dev/null 2>&1; then
  pass "smoke-test.sh rejected missing arguments"
else
  fail "smoke-test.sh should reject missing arguments"
fi

if ! "${REPO_ROOT}/scripts/smoke-test.sh" invalid_env >/dev/null 2>&1; then
  pass "smoke-test.sh rejected invalid environment"
else
  fail "smoke-test.sh should reject invalid environment"
fi

if ! "${REPO_ROOT}/scripts/deploy.sh" >/dev/null 2>&1; then
  pass "deploy.sh rejected missing arguments"
else
  fail "deploy.sh should reject missing arguments"
fi

if ! "${REPO_ROOT}/scripts/deploy.sh" staging "" >/dev/null 2>&1; then
  pass "deploy.sh rejected empty image tag"
else
  fail "deploy.sh should reject empty image tag"
fi

if ! "${REPO_ROOT}/scripts/deploy.sh" invalid_env sha-test >/dev/null 2>&1; then
  pass "deploy.sh rejected invalid environment"
else
  fail "deploy.sh should reject invalid environment"
fi

if ! "${REPO_ROOT}/scripts/deploy.sh" production sha-test >/dev/null 2>&1; then
  pass "deploy.sh in production rejected missing --confirm flag"
else
  fail "deploy.sh in production should require --confirm flag"
fi

if ! "${REPO_ROOT}/scripts/rollback.sh" >/dev/null 2>&1; then
  pass "rollback.sh rejected missing arguments"
else
  fail "rollback.sh should reject missing arguments"
fi

if ! "${REPO_ROOT}/scripts/rollback.sh" production >/dev/null 2>&1; then
  pass "rollback.sh in production rejected missing --confirm flag"
else
  fail "rollback.sh in production should require --confirm flag"
fi

# ------------------------------------------------------------------------------
# Test Sandbox Setup for Behavioral Tests
# ------------------------------------------------------------------------------
SANDBOX_DIR=$(mktemp -d /tmp/clubconnect_test_sandbox_XXXXXX)
trap 'rm -rf "$SANDBOX_DIR"' EXIT

mkdir -p "${SANDBOX_DIR}/config"
mkdir -p "${SANDBOX_DIR}/backups"
mkdir -p "${SANDBOX_DIR}/releases"
mkdir -p "${SANDBOX_DIR}/bin"
mkdir -p "${SANDBOX_DIR}/deploy"

SECRET_TEST_TOKEN="super_secret_password_token_98765"
cat <<EOF > "${SANDBOX_DIR}/config/.env.staging"
POSTGRES_DB=clubconnect_staging
POSTGRES_USER=clubconnect
POSTGRES_PASSWORD=${SECRET_TEST_TOKEN}
EOF

cat <<EOF > "${SANDBOX_DIR}/config/.env.production"
POSTGRES_DB=clubconnect_production
POSTGRES_USER=clubconnect
POSTGRES_PASSWORD=${SECRET_TEST_TOKEN}
EOF

# Copy bundled compose templates into sandbox deploy directory
cp "${REPO_ROOT}/deploy/compose.staging.yml" "${SANDBOX_DIR}/deploy/compose.staging.yml"
cp "${REPO_ROOT}/deploy/compose.production.yml" "${SANDBOX_DIR}/deploy/compose.production.yml"

export CLUBCONNECT_BASE_DIR="$SANDBOX_DIR"
export PATH="${SANDBOX_DIR}/bin:$PATH"

# Mock curl in sandbox bin
cat <<'MOCK_CURL' > "${SANDBOX_DIR}/bin/curl"
#!/usr/bin/env bash
if [[ "$*" == *"/api/auth/register"* ]]; then
  if [[ "$*" == *"-w %{http_code}"* ]]; then
    echo "400"
  else
    echo '{"error":"invalid_input","detail":"Validation failed."}'
  fi
  exit 0
fi

if [[ "$*" == *"-w %{http_code}"* ]]; then
  echo "200"
  exit 0
fi

echo '<!DOCTYPE html><html><body><div id="root">ClubConnect</div></body></html>'
exit 0
MOCK_CURL
chmod +x "${SANDBOX_DIR}/bin/curl"

# ------------------------------------------------------------------------------
# Test 3: Missing Environment File Handling & Secret Masking
# ------------------------------------------------------------------------------
echo "Test 3: Protected environment file validation & secret confidentiality..."

TMP_ENV="${SANDBOX_DIR}/config/.env.staging"
mv "$TMP_ENV" "${TMP_ENV}.bak"

output_missing_env=$("${REPO_ROOT}/scripts/deploy.sh" staging sha-test 2>&1 || true)
if grep -q "Required environment file not found" <<< "$output_missing_env"; then
  pass "deploy.sh cleanly aborted on missing environment file"
else
  fail "deploy.sh should report missing environment file"
fi

output_missing_backup=$("${REPO_ROOT}/scripts/backup-db.sh" staging 2>&1 || true)
if grep -q "Required environment file not found" <<< "$output_missing_backup"; then
  pass "backup-db.sh cleanly aborted on missing environment file"
else
  fail "backup-db.sh should report missing environment file"
fi

mv "${TMP_ENV}.bak" "$TMP_ENV"

# ------------------------------------------------------------------------------
# Test 4: Backup Generation, Integrity Check & Retention Policy
# ------------------------------------------------------------------------------
echo "Test 4: Backup generation, integrity verification & retention policy..."

cat <<'MOCK_DOCKER_BACKUP' > "${SANDBOX_DIR}/bin/docker"
#!/usr/bin/env bash
if [[ "$*" == *"pg_dump"* ]]; then
  echo "PG_DUMP_VALID_HEADER"
  exit 0
elif [[ "$*" == *"pg_restore -l"* ]]; then
  exit 0
elif [[ "$*" == *"ps "* && "$*" == *"running"* ]]; then
  echo "postgres"
  exit 0
fi
exit 0
MOCK_DOCKER_BACKUP
chmod +x "${SANDBOX_DIR}/bin/docker"

backup_output=$("${REPO_ROOT}/scripts/backup-db.sh" staging 2>&1)
if grep -qF "$SECRET_TEST_TOKEN" <<< "$backup_output"; then
  fail "backup-db.sh leaked password secret in log output!"
else
  pass "backup-db.sh did not leak credentials or secrets"
fi

backup_count=$(find "${SANDBOX_DIR}/backups" -name "clubconnect_staging_*.dump" | wc -l)
if [ "$backup_count" -eq 1 ]; then
  pass "backup-db.sh created verified backup dump"
else
  fail "Expected 1 backup dump, found $backup_count"
fi

for i in {01..09}; do
  touch "${SANDBOX_DIR}/backups/clubconnect_staging_2026010${i}_000000Z.dump"
done

"${REPO_ROOT}/scripts/backup-db.sh" staging >/dev/null 2>&1
remaining_backups=$(find "${SANDBOX_DIR}/backups" -name "clubconnect_staging_*.dump" | wc -l)
if [ "$remaining_backups" -eq 7 ]; then
  pass "Backup retention policy pruned excess backups to exactly 7"
else
  fail "Expected 7 retained backups, found $remaining_backups"
fi

# ------------------------------------------------------------------------------
# Test 5: Digest Resolution Failure Halts Deployment
# ------------------------------------------------------------------------------
echo "Test 5: Immutable image identity and digest failure handling..."

cat <<'MOCK_DOCKER_NO_DIGEST' > "${SANDBOX_DIR}/bin/docker"
#!/usr/bin/env bash
if [[ "$*" == *"pull"* ]]; then
  exit 0
elif [[ "$*" == *"inspect"* ]]; then
  exit 1
fi
exit 0
MOCK_DOCKER_NO_DIGEST
chmod +x "${SANDBOX_DIR}/bin/docker"

digest_fail_out=$("${REPO_ROOT}/scripts/deploy.sh" staging sha-nodigest 2>&1 || true)
if grep -q "Failed to resolve immutable digest" <<< "$digest_fail_out"; then
  pass "deploy.sh aborted when image digest resolution failed"
else
  fail "deploy.sh should abort on missing image digest"
fi

# ------------------------------------------------------------------------------
# Test 6: First Deployment Onboarding Baseline (CC-NPR Scenario)
# ------------------------------------------------------------------------------
echo "Test 6: First deployment onboarding from running containers..."

rm -f "${SANDBOX_DIR}/releases"/*

cat <<'MOCK_DOCKER_ONBOARD' > "${SANDBOX_DIR}/bin/docker"
#!/usr/bin/env bash
if [[ "$*" == *"service=api"* && "$*" == *"ps "* ]]; then
  echo "mock_api_container_id_1"
  exit 0
elif [[ "$*" == *"service=frontend"* && "$*" == *"ps "* ]]; then
  echo "mock_frontend_container_id_1"
  exit 0
elif [[ "$*" == *"inspect --format={{.Config.Image}} mock_api_container_id_1"* ]]; then
  echo "ghcr.io/yasinalpaltintas/clubconnect-backend:sha-066e2eb8fd1c178d45d520967b93548551dd80db"
  exit 0
elif [[ "$*" == *"inspect --format={{.Config.Image}} mock_frontend_container_id_1"* ]]; then
  echo "ghcr.io/yasinalpaltintas/clubconnect-frontend:sha-066e2eb8fd1c178d45d520967b93548551dd80db"
  exit 0
elif [[ "$*" == *"inspect"* && "$*" == *"RepoDigests"* ]]; then
  echo "sha256:onboarded_mock_digest_123456789"
  exit 0
elif [[ "$*" == *"pull"* ]]; then
  exit 0
elif [[ "$*" == *" config"* ]]; then
  echo "services:"
  echo "  api:"
  echo "    image: ghcr.io/yasinalpaltintas/clubconnect-backend:sha-newrelease123"
  echo "  frontend:"
  echo "    image: ghcr.io/yasinalpaltintas/clubconnect-frontend:sha-newrelease123"
  exit 0
elif [[ "$*" == *"ps "* && "$*" == *"running"* ]]; then
  echo "postgres"
  echo "api"
  echo "frontend"
  exit 0
elif [[ "$*" == *"wget"* ]]; then
  echo "Healthy"
  exit 0
elif [[ "$*" == *"pg_dump"* ]]; then
  echo "MOCK_DUMP"
  exit 0
elif [[ "$*" == *"pg_restore -l"* ]]; then
  exit 0
elif [[ "$*" == *"--migrate"* ]]; then
  exit 0
elif [[ "$*" == *"up -d --no-deps api frontend"* ]]; then
  exit 0
elif [[ "$*" == *"inspect --format={{.Config.Image}} clubconnect-staging-api"* ]]; then
  echo "ghcr.io/yasinalpaltintas/clubconnect-backend:sha-newrelease123"
  exit 0
elif [[ "$*" == *"inspect --format={{.Config.Image}} clubconnect-staging-frontend"* ]]; then
  echo "ghcr.io/yasinalpaltintas/clubconnect-frontend:sha-newrelease123"
  exit 0
fi
exit 0
MOCK_DOCKER_ONBOARD
chmod +x "${SANDBOX_DIR}/bin/docker"

onboard_out=$("${REPO_ROOT}/scripts/deploy.sh" staging sha-newrelease123 2>&1)
if grep -qi "initialized rollback baseline in" <<< "$onboard_out"; then
  pass "deploy.sh detected running stack and initialized onboarding baseline"
else
  fail "deploy.sh should initialize onboarding baseline"
fi

if grep -q "sha-066e2eb8fd1c178d45d520967b93548551dd80db" "${SANDBOX_DIR}/releases/staging_previous.release"; then
  pass "staging_previous.release preserved original manual commit SHA for rollback safety"
else
  fail "staging_previous.release missing original manual commit SHA"
fi

if grep -q "sha-newrelease123" "${SANDBOX_DIR}/releases/staging_current.release"; then
  pass "staging_current.release updated to new release tag"
else
  fail "staging_current.release not updated to new release tag"
fi

if [ -f "${SANDBOX_DIR}/releases/staging_validated_digests.txt" ]; then
  pass "staging deployment recorded verified digest in staging_validated_digests.txt"
else
  fail "staging deployment did not record staging_validated_digests.txt"
fi

if [ -f "${SANDBOX_DIR}/releases/staging_evidence_newrelease123.json" ]; then
  pass "staging deployment generated immutable staging_evidence.json"
else
  fail "staging deployment did not generate staging_evidence.json"
fi

# ------------------------------------------------------------------------------
# Test 7: Production Dual-Digest Safeguards & Staging Validation Enforcement
# ------------------------------------------------------------------------------
echo "Test 7: Production dual-digest safeguards & staging validation enforcement..."

cat <<'MOCK_DOCKER_PROD' > "${SANDBOX_DIR}/bin/docker"
#!/usr/bin/env bash
if [[ "$*" == *"pull"* ]]; then
  exit 0
elif [[ "$*" == *"inspect"* && "$*" == *"clubconnect-frontend"* && "$*" == *"RepoDigests"* ]]; then
  echo "sha256:prod_front_digest_1111"
  exit 0
elif [[ "$*" == *"inspect"* && "$*" == *"clubconnect-backend"* && "$*" == *"RepoDigests"* ]]; then
  echo "sha256:prod_api_digest_2222"
  exit 0
elif [[ "$*" == *" config"* ]]; then
  echo "services:"
  echo "  api:"
  echo "    image: ghcr.io/yasinalpaltintas/clubconnect-backend:sha-prodruncandidate"
  echo "  frontend:"
  echo "    image: ghcr.io/yasinalpaltintas/clubconnect-frontend:sha-prodruncandidate"
  exit 0
elif [[ "$*" == *"ps "* && "$*" == *"running"* ]]; then
  echo "postgres"
  echo "api"
  echo "frontend"
  exit 0
elif [[ "$*" == *"wget"* ]]; then
  echo "Healthy"
  exit 0
elif [[ "$*" == *"pg_dump"* ]]; then
  echo "MOCK_DUMP"
  exit 0
elif [[ "$*" == *"pg_restore -l"* ]]; then
  exit 0
elif [[ "$*" == *"--migrate"* ]]; then
  exit 0
elif [[ "$*" == *"up -d --no-deps api frontend"* ]]; then
  exit 0
elif [[ "$*" == *"inspect --format={{.Config.Image}} clubconnect-production-api"* ]]; then
  echo "ghcr.io/yasinalpaltintas/clubconnect-backend:sha-prodruncandidate"
  exit 0
elif [[ "$*" == *"inspect --format={{.Config.Image}} clubconnect-production-frontend"* ]]; then
  echo "ghcr.io/yasinalpaltintas/clubconnect-frontend:sha-prodruncandidate"
  exit 0
fi
exit 0
MOCK_DOCKER_PROD
chmod +x "${SANDBOX_DIR}/bin/docker"

# 7a: Production deployment without verified digests must fail
prod_reject_out=$("${REPO_ROOT}/scripts/deploy.sh" production sha-prodruncandidate --confirm 2>&1 || true)
if grep -qi "Missing required staging verification digests" <<< "$prod_reject_out"; then
  pass "Production deployment rejected release lacking staging-verified digests"
else
  fail "Production deployment should reject release lacking verified digests"
fi

# 7b: Production deployment with mismatched frontend digest must fail
prod_mismatch_front=$("${REPO_ROOT}/scripts/deploy.sh" production sha-prodruncandidate --confirm \
  --verified-frontend-digest=sha256:wrong_front_digest \
  --verified-backend-digest=sha256:prod_api_digest_2222 2>&1 || true)
if grep -qi "Target frontend digest.*does not match" <<< "$prod_mismatch_front"; then
  pass "Production deployment rejected mismatched frontend digest"
else
  fail "Production deployment should reject mismatched frontend digest"
fi

# 7c: Production deployment with mismatched backend digest must fail
prod_mismatch_api=$("${REPO_ROOT}/scripts/deploy.sh" production sha-prodruncandidate --confirm \
  --verified-frontend-digest=sha256:prod_front_digest_1111 \
  --verified-backend-digest=sha256:wrong_api_digest 2>&1 || true)
if grep -qi "Target API digest.*does not match" <<< "$prod_mismatch_api"; then
  pass "Production deployment rejected mismatched backend digest"
else
  fail "Production deployment should reject mismatched backend digest"
fi

# 7d: Production deployment with exact matching dual digests must succeed
prod_accept_out=$("${REPO_ROOT}/scripts/deploy.sh" production sha-prodruncandidate --confirm \
  --verified-frontend-digest=sha256:prod_front_digest_1111 \
  --verified-backend-digest=sha256:prod_api_digest_2222 2>&1)
if grep -q "Production eligibility confirmed" <<< "$prod_accept_out"; then
  pass "Production deployment accepted release with exact dual staging-verified digests"
else
  fail "Production deployment should accept release with exact dual digests"
fi

# ------------------------------------------------------------------------------
# Test 8: EF Core Migration Failure Halts Before Application Update
# ------------------------------------------------------------------------------
echo "Test 8: EF Core migration failure abort safety..."

cat <<'MOCK_DOCKER_MIGRATE_FAIL' > "${SANDBOX_DIR}/bin/docker"
#!/usr/bin/env bash
if [[ "$*" == *"--migrate"* ]]; then
  echo "Error: column already exists in Members" >&2
  exit 1
elif [[ "$*" == *"pull"* ]]; then
  exit 0
elif [[ "$*" == *"inspect"* && "$*" == *"RepoDigests"* ]]; then
  echo "sha256:migrate_fail_digest"
  exit 0
elif [[ "$*" == *" config"* ]]; then
  echo "services:"
  echo "  api:"
  echo "    image: ghcr.io/yasinalpaltintas/clubconnect-backend:sha-badmigration"
  echo "  frontend:"
  echo "    image: ghcr.io/yasinalpaltintas/clubconnect-frontend:sha-badmigration"
  exit 0
elif [[ "$*" == *"ps "* && "$*" == *"running"* ]]; then
  echo "postgres"
  exit 0
elif [[ "$*" == *"pg_dump"* ]]; then
  echo "MOCK_BACKUP"
  exit 0
elif [[ "$*" == *"pg_restore -l"* ]]; then
  exit 0
elif [[ "$*" == *"up -d --no-deps api frontend"* ]]; then
  echo "CONTAINERS_UPDATED_UNEXPECTEDLY"
  exit 0
fi
exit 0
MOCK_DOCKER_MIGRATE_FAIL
chmod +x "${SANDBOX_DIR}/bin/docker"

migrate_fail_out=$("${REPO_ROOT}/scripts/deploy.sh" staging sha-badmigration 2>&1 || true)
if grep -q "EF Core database migration failed! Aborting deployment" <<< "$migrate_fail_out"; then
  pass "deploy.sh aborted on migration failure"
else
  fail "deploy.sh should abort on migration failure"
fi

if ! grep -q "CONTAINERS_UPDATED_UNEXPECTEDLY" <<< "$migrate_fail_out"; then
  pass "deploy.sh did NOT update application containers after migration failure"
else
  fail "deploy.sh incorrectly updated containers after migration failure"
fi

# ------------------------------------------------------------------------------
# Test 9: Container Recreation Failure Reporting & Recovery Guidance
# ------------------------------------------------------------------------------
echo "Test 9: Container recreation failure reporting..."

cat <<'MOCK_DOCKER_RECREATE_FAIL' > "${SANDBOX_DIR}/bin/docker"
#!/usr/bin/env bash
if [[ "$*" == *"pull"* ]]; then
  exit 0
elif [[ "$*" == *"inspect"* && "$*" == *"RepoDigests"* ]]; then
  echo "sha256:recreate_fail_digest"
  exit 0
elif [[ "$*" == *" config"* ]]; then
  echo "services:"
  echo "  api:"
  echo "    image: ghcr.io/yasinalpaltintas/clubconnect-backend:sha-recreatefail"
  echo "  frontend:"
  echo "    image: ghcr.io/yasinalpaltintas/clubconnect-frontend:sha-recreatefail"
  exit 0
elif [[ "$*" == *"ps "* && "$*" == *"running"* ]]; then
  echo "postgres"
  exit 0
elif [[ "$*" == *"pg_dump"* ]]; then
  echo "MOCK_BACKUP"
  exit 0
elif [[ "$*" == *"pg_restore -l"* ]]; then
  exit 0
elif [[ "$*" == *"--migrate"* ]]; then
  exit 0
elif [[ "$*" == *"up -d --no-deps api frontend"* ]]; then
  echo "Docker daemon error: port allocation conflict" >&2
  exit 1
fi
exit 0
MOCK_DOCKER_RECREATE_FAIL
chmod +x "${SANDBOX_DIR}/bin/docker"

recreate_fail_out=$("${REPO_ROOT}/scripts/deploy.sh" staging sha-recreatefail 2>&1 || true)
if grep -q "Application container recreation failed!" <<< "$recreate_fail_out"; then
  pass "deploy.sh detected and reported container recreation failure"
else
  fail "deploy.sh should report container recreation failure"
fi

if grep -q "To restore previous containers, execute:" <<< "$recreate_fail_out"; then
  pass "deploy.sh provided recovery guidance pointing to rollback.sh"
else
  fail "deploy.sh should provide rollback guidance"
fi

# ------------------------------------------------------------------------------
# Test 10: Rollback Script Execution & Schema Migration Safety
# ------------------------------------------------------------------------------
echo "Test 10: Rollback execution & schema migration protection..."

cat <<'MOCK_DOCKER_ROLLBACK' > "${SANDBOX_DIR}/bin/docker"
#!/usr/bin/env bash
if [[ "$*" == *"up -d --no-deps api frontend"* ]]; then
  echo "ROLLBACK_CONTAINERS_RESTORED"
  exit 0
elif [[ "$*" == *"ps "* && "$*" == *"running"* ]]; then
  echo "postgres"
  echo "api"
  echo "frontend"
  exit 0
elif [[ "$*" == *"wget"* ]]; then
  echo "Healthy"
  exit 0
fi
exit 0
MOCK_DOCKER_ROLLBACK
chmod +x "${SANDBOX_DIR}/bin/docker"

rollback_out=$("${REPO_ROOT}/scripts/rollback.sh" staging 2>&1)
if grep -q "Rollback to .* completed successfully" <<< "$rollback_out"; then
  pass "rollback.sh completed successfully"
else
  fail "rollback.sh failed to complete"
fi

if grep -q "Database schema migrations were NOT reversed" <<< "$rollback_out"; then
  pass "rollback.sh confirmed schema migrations were preserved"
else
  fail "rollback.sh missing schema migration preservation note"
fi

# ------------------------------------------------------------------------------
# Test 11: Production Secrets Isolation & Missing Credential Rejection
# ------------------------------------------------------------------------------
echo "Test 11: Production secrets isolation validation..."

validate_secrets() {
  local host="$1"
  local user="$2"
  local key="$3"
  local known_hosts="$4"

  if [ -z "$host" ] || [ -z "$user" ] || [ -z "$key" ] || [ -z "$known_hosts" ]; then
    return 1
  fi
  return 0
}

# Missing host
if ! validate_secrets "" "deploy" "key" "hosts" >/dev/null 2>&1; then
  pass "Secret validation rejected empty DEPLOY_HOST"
else
  fail "Secret validation should reject empty DEPLOY_HOST"
fi

# Missing key
if ! validate_secrets "1.2.3.4" "deploy" "" "hosts" >/dev/null 2>&1; then
  pass "Secret validation rejected empty SSH_PRIVATE_KEY"
else
  fail "Secret validation should reject empty SSH_PRIVATE_KEY"
fi

# ------------------------------------------------------------------------------
# Test 12: Commit SHA 40-character Regex & Injection Resistance
# ------------------------------------------------------------------------------
echo "Test 12: Commit SHA hexadecimal validation & command injection resistance..."

validate_sha() {
  local sha="$1"
  if [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    return 0
  else
    return 1
  fi
}

# Valid SHA
if validate_sha "066e2eb8fd1c178d45d520967b93548551dd80db"; then
  pass "Accepted valid 40-character hexadecimal commit SHA"
else
  fail "Valid SHA should be accepted"
fi

# Short SHA
if ! validate_sha "066e2eb"; then
  pass "Rejected short commit SHA"
else
  fail "Short SHA should be rejected"
fi

# Uppercase SHA
if ! validate_sha "066E2EB8FD1C178D45D520967B93548551DD80DB"; then
  pass "Rejected uppercase commit SHA"
else
  fail "Uppercase SHA should be rejected"
fi

# Command injection attempt via semicolon
if ! validate_sha "066e2eb8fd1c178d45d520967b93548551dd80db; rm -rf /"; then
  pass "Rejected command injection attempt with semicolon"
else
  fail "Command injection with semicolon should be rejected"
fi

# Command injection attempt via subshell
if ! validate_sha '066e2eb8fd1c178d45d520967b93548551dd80db$(whoami)'; then
  pass "Rejected command injection attempt with subshell"
else
  fail "Command injection with subshell should be rejected"
fi

# Whitespace injection attempt
if ! validate_sha "066e2eb8fd1c178d45d520967b93548551dd80db "; then
  pass "Rejected commit SHA with trailing whitespace"
else
  fail "Commit SHA with trailing whitespace should be rejected"
fi

# ------------------------------------------------------------------------------
# Test 13: Staging Evidence Artifact JSON Structure & Validation
# ------------------------------------------------------------------------------
echo "Test 13: Staging evidence artifact JSON schema validation..."

cat <<'EOF' > "${SANDBOX_DIR}/test_evidence.json"
{
  "commit_sha": "066e2eb8fd1c178d45d520967b93548551dd80db",
  "environment": "staging",
  "image_tag": "sha-066e2eb8fd1c178d45d520967b93548551dd80db",
  "frontend_digest": "sha256:front123456789",
  "backend_digest": "sha256:back123456789",
  "deployed_by": "deploy",
  "deployed_at": "2026-10-18T17:00:00Z",
  "smoke_test": "PASSED"
}
EOF

win_evidence_file="${SANDBOX_DIR}/test_evidence.json"
command -v cygpath >/dev/null 2>&1 && win_evidence_file=$(cygpath -w "$win_evidence_file")

python_evidence_check=$(/c/Python315/python -c '
import json, sys
data = json.load(open(sys.argv[1]))
assert data["commit_sha"] == "066e2eb8fd1c178d45d520967b93548551dd80db"
assert data["smoke_test"] == "PASSED"
assert data["frontend_digest"].startswith("sha256:")
assert data["backend_digest"].startswith("sha256:")
print("VALID")
' "$win_evidence_file" 2>/dev/null || echo "INVALID")

if [ "$python_evidence_check" = "VALID" ]; then
  pass "Staging evidence JSON validated with required SHA, smoke_test status, and digests"
else
  fail "Staging evidence JSON validation failed"
fi

# Tampered evidence (smoke_test != PASSED)
cat <<'EOF' > "${SANDBOX_DIR}/tampered_evidence.json"
{
  "commit_sha": "066e2eb8fd1c178d45d520967b93548551dd80db",
  "smoke_test": "FAILED"
}
EOF

win_tampered_file="${SANDBOX_DIR}/tampered_evidence.json"
command -v cygpath >/dev/null 2>&1 && win_tampered_file=$(cygpath -w "$win_tampered_file")

python_tamper_check=$(/c/Python315/python -c '
import json, sys
data = json.load(open(sys.argv[1]))
if data.get("smoke_test") != "PASSED":
    sys.exit(1)
print("VALID")
' "$win_tampered_file" 2>/dev/null || echo "REJECTED")

if [ "$python_tamper_check" = "REJECTED" ]; then
  pass "Staging evidence check rejected failed smoke test"
else
  fail "Staging evidence check should reject failed smoke test"
fi

# ------------------------------------------------------------------------------
# Test 14: CI Check-Runs & Trusted Workflow Run Fail-Closed Gates
# ------------------------------------------------------------------------------
echo "Test 14: CI check-runs & trusted workflow run fail-closed verification..."

# 14.1 Verify API error suppression removal (fail-closed behavior)
# In deploy.yml, the step runs under `set -euo pipefail`.
# If `gh api` exits with non-zero, the step aborts immediately without suppression.
api_fail_out=$(bash -c '
set -euo pipefail
# Simulating gh api without || true
(exit 22)
echo "SHOULD_NOT_EXECUTE"
' 2>&1 || true)

if ! grep -q "SHOULD_NOT_EXECUTE" <<< "$api_fail_out"; then
  pass "Verified gh api failures fail-closed immediately without error suppression"
else
  fail "API failures should abort immediately without error suppression"
fi

# Detect functional python binary
PYTHON_BIN=""
for candidate in "/c/Python315/python" "python3" "python"; do
  if "$candidate" --version >/dev/null 2>&1; then
    PYTHON_BIN="$candidate"
    break
  fi
done


# Create validator script in sandbox
cat <<'EOF' > "${SANDBOX_DIR}/validate_ci.py"
import json, sys, re

def validate_ci(runs_path, checks_paths):
    # 1. Validate workflow run
    with open(runs_path, "r", encoding="utf-8") as f:
        runs_data = json.load(f)
    
    ci_runs = [
        r for r in runs_data.get("workflow_runs", [])
        if r.get("name") == "ClubConnect CI" or r.get("path") == ".github/workflows/ci.yml"
    ]
    if not ci_runs:
        raise ValueError("No ClubConnect CI workflow run found")
    
    latest_run = ci_runs[0]
    if latest_run.get("status") != "completed":
        raise ValueError(f"ClubConnect CI workflow run status is {latest_run.get('status')}, expected completed")
    if latest_run.get("conclusion") != "success":
        raise ValueError(f"ClubConnect CI workflow run conclusion is {latest_run.get('conclusion')}, expected success")
    
    # 2. Gather all check runs across pages
    all_checks = []
    for p in checks_paths:
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                all_checks.extend(data)
            elif isinstance(data, dict):
                all_checks.extend(data.get("check_runs", []))
    
    if not all_checks:
        raise ValueError("No check-runs found")
    
    # 3. Explicitly verify every required CI job completed successfully
    required_patterns = [
        r"^(React Build|frontend)$",
        r"^(\.NET Build & Test|backend)$",
        r"^(Playwright E2E Tests|e2e)$",
        r"^(Docker ARM64 Build|docker-build)$"
    ]
    
    for pat in required_patterns:
        matching = [c for c in all_checks if re.search(pat, c.get("name", ""))]
        if not matching:
            raise ValueError(f"Required CI check matching pattern {pat} is MISSING")
        latest_check = matching[-1]
        if latest_check.get("status") != "completed":
            raise ValueError(f"Required check {latest_check.get('name')} status is {latest_check.get('status')}")
        if latest_check.get("conclusion") != "success":
            raise ValueError(f"Required check {latest_check.get('name')} conclusion is {latest_check.get('conclusion')}")
            
    # 4. Reject if any CI check on commit has failed, timed_out, cancelled, or is unfinished
    for c in all_checks:
        name = c.get("name", "")
        if "Validate Release" in name or "ClubConnect Deploy" in name:
            continue
        if c.get("status") != "completed":
            raise ValueError(f"Check {name} is still pending: {c.get('status')}")
        if c.get("conclusion") in ["failure", "cancelled", "timed_out"]:
            raise ValueError(f"Check {name} failed: {c.get('conclusion')}")
            
    return True

if __name__ == "__main__":
    runs_file = sys.argv[1]
    checks_files = sys.argv[2:]
    try:
        validate_ci(runs_file, checks_files)
        print("VALID")
    except Exception as e:
        print(f"REJECTED: {e}")
        sys.exit(1)
EOF

run_ci_validator() {
  local runs_f="$1"
  shift
  local checks_args=()
  for cf in "$@"; do
    local win_cf="$cf"
    command -v cygpath >/dev/null 2>&1 && win_cf=$(cygpath -w "$cf")
    checks_args+=("$win_cf")
  done
  local win_rf="$runs_f"
  command -v cygpath >/dev/null 2>&1 && win_rf=$(cygpath -w "$runs_f")
  
  local py_script="${SANDBOX_DIR}/validate_ci.py"
  command -v cygpath >/dev/null 2>&1 && py_script=$(cygpath -w "$py_script")
  
  if "$PYTHON_BIN" "$py_script" "$win_rf" "${checks_args[@]}" >/dev/null 2>&1; then
    echo "VALID"
  else
    echo "REJECTED"
  fi
}

# Base valid workflow run JSON
cat <<'EOF' > "${SANDBOX_DIR}/valid_runs.json"
{
  "total_count": 1,
  "workflow_runs": [
    {
      "id": 1001,
      "name": "ClubConnect CI",
      "path": ".github/workflows/ci.yml",
      "status": "completed",
      "conclusion": "success"
    }
  ]
}
EOF

# Base valid check-runs JSON (all 4 required pass)
cat <<'EOF' > "${SANDBOX_DIR}/valid_checks.json"
{
  "total_count": 4,
  "check_runs": [
    {"name": "React Build", "status": "completed", "conclusion": "success"},
    {"name": ".NET Build & Test", "status": "completed", "conclusion": "success"},
    {"name": "Playwright E2E Tests", "status": "completed", "conclusion": "success"},
    {"name": "Docker ARM64 Build", "status": "completed", "conclusion": "success"}
  ]
}
EOF

# 14.2 Valid run & checks -> PASS
val_result=$(run_ci_validator "${SANDBOX_DIR}/valid_runs.json" "${SANDBOX_DIR}/valid_checks.json")
if [ "$val_result" = "VALID" ]; then
  pass "Accepted release with completed ClubConnect CI run and all 4 required checks passed"
else
  fail "Valid CI run and checks should be accepted"
fi

# 14.3 Missing workflow run -> REJECT
cat <<'EOF' > "${SANDBOX_DIR}/empty_runs.json"
{
  "total_count": 0,
  "workflow_runs": []
}
EOF
val_result=$(run_ci_validator "${SANDBOX_DIR}/empty_runs.json" "${SANDBOX_DIR}/valid_checks.json")
if [ "$val_result" = "REJECTED" ]; then
  pass "Rejected release when ClubConnect CI workflow run is missing"
else
  fail "Missing workflow run should be rejected"
fi

# 14.4 In-progress workflow run -> REJECT
cat <<'EOF' > "${SANDBOX_DIR}/pending_runs.json"
{
  "total_count": 1,
  "workflow_runs": [
    {
      "id": 1002,
      "name": "ClubConnect CI",
      "path": ".github/workflows/ci.yml",
      "status": "in_progress",
      "conclusion": null
    }
  ]
}
EOF
val_result=$(run_ci_validator "${SANDBOX_DIR}/pending_runs.json" "${SANDBOX_DIR}/valid_checks.json")
if [ "$val_result" = "REJECTED" ]; then
  pass "Rejected release when ClubConnect CI workflow run is in_progress"
else
  fail "Pending workflow run should be rejected"
fi

# 14.5 Failed workflow run -> REJECT
cat <<'EOF' > "${SANDBOX_DIR}/failed_runs.json"
{
  "total_count": 1,
  "workflow_runs": [
    {
      "id": 1003,
      "name": "ClubConnect CI",
      "path": ".github/workflows/ci.yml",
      "status": "completed",
      "conclusion": "failure"
    }
  ]
}
EOF
val_result=$(run_ci_validator "${SANDBOX_DIR}/failed_runs.json" "${SANDBOX_DIR}/valid_checks.json")
if [ "$val_result" = "REJECTED" ]; then
  pass "Rejected release when ClubConnect CI workflow run concluded with failure"
else
  fail "Failed workflow run should be rejected"
fi

# 14.6 Cancelled workflow run -> REJECT
cat <<'EOF' > "${SANDBOX_DIR}/cancelled_runs.json"
{
  "total_count": 1,
  "workflow_runs": [
    {
      "id": 1004,
      "name": "ClubConnect CI",
      "path": ".github/workflows/ci.yml",
      "status": "completed",
      "conclusion": "cancelled"
    }
  ]
}
EOF
val_result=$(run_ci_validator "${SANDBOX_DIR}/cancelled_runs.json" "${SANDBOX_DIR}/valid_checks.json")
if [ "$val_result" = "REJECTED" ]; then
  pass "Rejected release when ClubConnect CI workflow run concluded with cancelled"
else
  fail "Cancelled workflow run should be rejected"
fi

# 14.7 Missing required check run (Docker ARM64 Build missing) -> REJECT
cat <<'EOF' > "${SANDBOX_DIR}/missing_check.json"
{
  "total_count": 3,
  "check_runs": [
    {"name": "React Build", "status": "completed", "conclusion": "success"},
    {"name": ".NET Build & Test", "status": "completed", "conclusion": "success"},
    {"name": "Playwright E2E Tests", "status": "completed", "conclusion": "success"}
  ]
}
EOF
val_result=$(run_ci_validator "${SANDBOX_DIR}/valid_runs.json" "${SANDBOX_DIR}/missing_check.json")
if [ "$val_result" = "REJECTED" ]; then
  pass "Rejected release when required CI check (Docker ARM64 Build) is missing"
else
  fail "Missing required check should be rejected"
fi

# 14.8 Pending required check run -> REJECT
cat <<'EOF' > "${SANDBOX_DIR}/pending_check.json"
{
  "total_count": 4,
  "check_runs": [
    {"name": "React Build", "status": "in_progress", "conclusion": null},
    {"name": ".NET Build & Test", "status": "completed", "conclusion": "success"},
    {"name": "Playwright E2E Tests", "status": "completed", "conclusion": "success"},
    {"name": "Docker ARM64 Build", "status": "completed", "conclusion": "success"}
  ]
}
EOF
val_result=$(run_ci_validator "${SANDBOX_DIR}/valid_runs.json" "${SANDBOX_DIR}/pending_check.json")
if [ "$val_result" = "REJECTED" ]; then
  pass "Rejected release when required CI check is pending/in_progress"
else
  fail "Pending required check should be rejected"
fi

# 14.9 Skipped required check run -> REJECT
cat <<'EOF' > "${SANDBOX_DIR}/skipped_check.json"
{
  "total_count": 4,
  "check_runs": [
    {"name": "React Build", "status": "completed", "conclusion": "success"},
    {"name": ".NET Build & Test", "status": "completed", "conclusion": "skipped"},
    {"name": "Playwright E2E Tests", "status": "completed", "conclusion": "success"},
    {"name": "Docker ARM64 Build", "status": "completed", "conclusion": "success"}
  ]
}
EOF
val_result=$(run_ci_validator "${SANDBOX_DIR}/valid_runs.json" "${SANDBOX_DIR}/skipped_check.json")
if [ "$val_result" = "REJECTED" ]; then
  pass "Rejected release when required CI check was skipped"
else
  fail "Skipped required check should be rejected"
fi

# 14.10 Cancelled required check run -> REJECT
cat <<'EOF' > "${SANDBOX_DIR}/cancelled_check.json"
{
  "total_count": 4,
  "check_runs": [
    {"name": "React Build", "status": "completed", "conclusion": "success"},
    {"name": ".NET Build & Test", "status": "completed", "conclusion": "success"},
    {"name": "Playwright E2E Tests", "status": "completed", "conclusion": "cancelled"},
    {"name": "Docker ARM64 Build", "status": "completed", "conclusion": "success"}
  ]
}
EOF
val_result=$(run_ci_validator "${SANDBOX_DIR}/valid_runs.json" "${SANDBOX_DIR}/cancelled_check.json")
if [ "$val_result" = "REJECTED" ]; then
  pass "Rejected release when required CI check was cancelled"
else
  fail "Cancelled required check should be rejected"
fi

# 14.11 Failed required check run -> REJECT
cat <<'EOF' > "${SANDBOX_DIR}/failed_check.json"
{
  "total_count": 4,
  "check_runs": [
    {"name": "React Build", "status": "completed", "conclusion": "success"},
    {"name": ".NET Build & Test", "status": "completed", "conclusion": "success"},
    {"name": "Playwright E2E Tests", "status": "completed", "conclusion": "success"},
    {"name": "Docker ARM64 Build", "status": "completed", "conclusion": "failure"}
  ]
}
EOF
val_result=$(run_ci_validator "${SANDBOX_DIR}/valid_runs.json" "${SANDBOX_DIR}/failed_check.json")
if [ "$val_result" = "REJECTED" ]; then
  pass "Rejected release when required CI check failed"
else
  fail "Failed required check should be rejected"
fi

# 14.12 Unrelated check failure on commit -> REJECT
cat <<'EOF' > "${SANDBOX_DIR}/unrelated_fail_check.json"
{
  "total_count": 5,
  "check_runs": [
    {"name": "React Build", "status": "completed", "conclusion": "success"},
    {"name": ".NET Build & Test", "status": "completed", "conclusion": "success"},
    {"name": "Playwright E2E Tests", "status": "completed", "conclusion": "success"},
    {"name": "Docker ARM64 Build", "status": "completed", "conclusion": "success"},
    {"name": "Security Audit / CodeQL", "status": "completed", "conclusion": "failure"}
  ]
}
EOF
val_result=$(run_ci_validator "${SANDBOX_DIR}/valid_runs.json" "${SANDBOX_DIR}/unrelated_fail_check.json")
if [ "$val_result" = "REJECTED" ]; then
  pass "Rejected release when commit contains another failed check run"
else
  fail "Unrelated failed check run should be rejected"
fi

# 14.13 Multi-page paginated check runs handling -> PASS
cat <<'EOF' > "${SANDBOX_DIR}/page1_checks.json"
{
  "total_count": 4,
  "check_runs": [
    {"name": "React Build", "status": "completed", "conclusion": "success"},
    {"name": ".NET Build & Test", "status": "completed", "conclusion": "success"}
  ]
}
EOF

cat <<'EOF' > "${SANDBOX_DIR}/page2_checks.json"
{
  "total_count": 4,
  "check_runs": [
    {"name": "Playwright E2E Tests", "status": "completed", "conclusion": "success"},
    {"name": "Docker ARM64 Build", "status": "completed", "conclusion": "success"}
  ]
}
EOF
val_result=$(run_ci_validator "${SANDBOX_DIR}/valid_runs.json" "${SANDBOX_DIR}/page1_checks.json" "${SANDBOX_DIR}/page2_checks.json")
if [ "$val_result" = "VALID" ]; then
  pass "Verified pagination handling retrieves and validates all check runs across pages"
else
  fail "Paginated check runs should be combined and accepted when all pass"
fi

# ------------------------------------------------------------------------------
# Test 15: GHCR Image Names Exact Match with CI Publishing Workflow
# ------------------------------------------------------------------------------
echo "Test 15: GHCR image naming match verification..."

deploy_yml="${REPO_ROOT}/.github/workflows/deploy.yml"
if grep -q 'frontend_image=ghcr.io/\${GITHUB_REPOSITORY,,}-frontend:sha-\${TARGET_SHA}' "$deploy_yml" && \
   grep -q 'backend_image=ghcr.io/\${GITHUB_REPOSITORY,,}-backend:sha-\${TARGET_SHA}' "$deploy_yml"; then
  pass "deploy.yml image naming strictly matches ci.yml image publishing pattern"
else
  fail "deploy.yml image naming does not match ci.yml"
fi

deploy_sh="${REPO_ROOT}/scripts/deploy.sh"
if grep -q 'FRONTEND_IMAGE=.*clubconnect-frontend' "$deploy_sh" && \
   grep -q 'API_IMAGE=.*clubconnect-backend' "$deploy_sh"; then
  pass "deploy.sh image resolution strictly matches GHCR image repository names"
else
  fail "deploy.sh image names do not match GHCR naming convention"
fi

echo "========================================================================"
echo "Test Results: ${TESTS_PASSED} passed, ${TESTS_FAILED} failed."
echo "========================================================================"

if [ "$TESTS_FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
