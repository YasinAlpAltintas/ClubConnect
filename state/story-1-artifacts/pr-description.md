# Pull Request: INC-5 — Creating a Club Member Account

## Overview
This PR delivers the end-to-end vertical slice for **INC-5 (Story 1)**, enabling new club members to register for an account via the frontend and backend API.

---

## Acceptance Criteria & Status

| Acceptance Criteria | Status | Notes |
| :--- | :---: | :--- |
| **AC1:** Register endpoint `POST /api/auth/register` creates member account | **PASS** | Returns `201 Created` with `memberId` and canonical email |
| **AC2:** Input validation for email format and password strength | **PASS** | Validates email syntax; requires password ≥ 8 chars with ≥ 1 letter and ≥ 1 digit |
| **AC3:** Duplicate email rejection | **PASS** | Returns `409 Conflict` (`email_conflict`) both on domain pre-check and concurrency unique-constraint race |
| **AC4:** Secure password hashing | **PASS** | Argon2id implementation with OWASP-recommended parameters (19 MiB, 2 iterations, 1 parallelism) |
| **AC5:** Responsive, localized registration UI | **PASS** | Built with React 19, Tailwind CSS v4, React Hook Form, Zod v4, and i18n (`en` and `nl-BE`) |
| **AC6:** Frontend test coverage ≥ 75% | **PASS** | **98.61%** line coverage across components, schemas, and API clients |
| **AC7:** Backend test coverage ≥ 75% per module | **PASS** | **95.04%** total backend line coverage (**100%** Api, **98.41%** Application, **100%** Domain, **93.08%** Infrastructure) |
| **AC8:** Playwright E2E test coverage | **PASS** | E2E specs for registration success, validation errors, and duplicate handling |
| **AC9:** Isolated test environment & CI enforcement | **PASS** | Standalone `docker-compose.yml` and GitHub Actions pipeline enforcing all gates |

---

## Test & Verification Results

### 1. Backend (.NET 10 / xUnit / Coverlet)
- **Status:** **PASS** (98 tests passed, 0 failed, 0 skipped)
- **Duration:** 3.0 seconds
- **Coverage Breakdown:**

| Module | Line Coverage | Branch Coverage | Method Coverage | Gate (≥75% line) |
| :--- | :---: | :---: | :---: | :---: |
| `ClubConnect.Api` | **100%** | **90.00%** | **100%** | **PASS** |
| `ClubConnect.Application` | **98.41%** | **100.0%** | **87.50%** | **PASS** |
| `ClubConnect.Domain` | **100%** | **100.0%** | **100%** | **PASS** |
| `ClubConnect.Infrastructure` | **93.08%** | **72.41%** | **100%** | **PASS** |
| **Total Backend** | **95.04%** | **85.08%** | **96.55%** | **PASS** |

### 2. Frontend (React 19 / Vitest / Testing Library)
- **Status:** **PASS** (32 tests passed, 0 failed, 0 skipped)
- **Duration:** 7.9 seconds
- **Coverage Breakdown:**
  - Statements: **97.26%** (≥75% gate)
  - Branches: **88.05%** (≥75% gate)
  - Functions: **100%** (≥75% gate)
  - Lines: **98.61%** (≥75% gate)
- **Linter (oxlint):** 0 errors
- **TypeScript build:** Clean production bundle generated in 347ms

### 3. End-to-End (Playwright)
- **Suite:** `frontend/e2e/register.spec.ts`
- **Scenarios covered:**
  1. `successfully registers a new club member account` (Verifies positive registration flow and welcome confirmation)
  2. `displays validation errors on invalid input` (Verifies client-side validation triggers for email and password)
  3. `displays conflict error when registering duplicate email` (Verifies server-side 409 conflict banner presentation)

---

## Changes Included in this PR

- **Backend:**
  - `backend/ClubConnect.Api.Tests/ClubConnect.Api.Tests.csproj`: Corrected Coverlet exclusion configuration (`Exclude`, `ExcludeByFile`, `ExcludeByAttribute`) to cleanly separate Roslyn OpenAPI generator output without touching application logic.
  - `backend/ClubConnect.Api.Tests/AuthControllerTests.cs`: Added direct unit tests covering `AuthController` registration and EF Core unique-constraint race condition handling.
- **Frontend & E2E:**
  - `frontend/playwright.config.ts`: Configured isolated Playwright runner with Vite webServer and Chromium support.
  - `frontend/e2e/register.spec.ts`: Implemented end-to-end registration flow tests.
- **Environment & Infrastructure:**
  - `docker-compose.yml`: Added standalone PostgreSQL 17 test environment configuration for isolated local testing.
  - `.github/workflows/ci.yml`: Updated CI pipeline to enforce frontend coverage (Vitest), backend coverage (Coverlet), and Playwright E2E execution with PostgreSQL service container, while preserving existing ARM64 builds, GHCR publishing, and staging SSH verification.

---

## Deployment & Risk Assessment
- **Breaking Changes:** None.
- **Database Migrations:** Schema generated dynamically on Development startup via `EnsureCreatedAsync()`; full migrations slated for upcoming story.
- **Deployment Pipeline:** Preserved existing single deployment pipeline and staging verification on develop push.
