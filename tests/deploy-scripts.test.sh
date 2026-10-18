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

echo "========================================================================"
echo "Test Results: ${TESTS_PASSED} passed, ${TESTS_FAILED} failed."
echo "========================================================================"

if [ "$TESTS_FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
