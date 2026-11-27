# Development and testing process

Every user story goes through the 14 steps below. The table shows where each step happens and what enforces it.

| # | Step | Where / how | Enforced by |
|---|------|-------------|-------------|
| 1 | Open the user story, read the acceptance criteria | Linear (`INC-XX`) | — |
| 2 | Review design doc and test plan | Linear / docs | — |
| 3 | Review test cases and steps (unclear → clarify the story) | Linear | — |
| 4 | Develop the feature on its own branch | `feature/INC-XX-...` | — |
| 5 | Review the code, merge after approval (rework → step 4) | Pull request into `develop` | PR template + `ci.yml` (build, unit, E2E, Docker) |
| 6 | Deploy to NON-PROD | Automatic on push to `develop` (`ci.yml`), or manual via `deploy.yml` (staging) | `deploy-staging` job |
| 7 | Run smoke tests | `scripts/smoke-test.sh` during the deploy | Staging evidence artifact |
| 8 | Execute the test cases, log results | Manual on NON-PROD; results in the PR / Linear | — |
| 9 | Run regression tests | Full Playwright suite against NON-PROD (`regression.yml`, runs automatically after every NON-PROD deploy) | `regression-evidence-<sha>` artifact |
| 10 | Perform acceptance testing (reject → log defect) | Review the story on NON-PROD against its acceptance criteria. Approve by merging `develop` into `main`. | Pull request `develop` → `main` |
| 11 | Deploy to PROD | **Automatic** once the CI run on `main` is green (`deploy.yml`, INC-61). It promotes the tested `develop` commit, not a new build. Manual runs of `deploy.yml` (production) remain possible. | `deploy-production` job — blocked without smoke and regression evidence |
| 12 | Run a sanity check (fail → roll back PROD) | Read-only Playwright `@sanity` checks against PROD, automatic rollback with `scripts/rollback.sh` | `production-sanity-evidence-<sha>` artifact |
| 13 | Verify the Definition of Done | Checklist in the pull request template | — |
| 14 | Close the user story | Linear → **Released to prod** | — |

## Release order

1. Merge the story into `develop` → NON-PROD deploy, smoke and regression tests run automatically.
2. Execute the test cases and review the story on NON-PROD (steps 8 and 10).
3. Merge `develop` into `main` → when CI on `main` is green, PROD deploys automatically and the sanity check runs.

If the NON-PROD smoke or regression tests did not pass for that commit, the automatic PROD deploy stops at the evidence check and PROD keeps the previous version.

## Defects

A failure in steps 7–10 or 12 is logged with the **Defect** issue template:

- **Blocking** — fix now; the story goes back to step 4.
- **Minor** — plan it for a later sprint.

## One-time setup

1. **Repository variables** (Settings → Secrets and variables → Actions → Variables):
   - `NONPROD_URL` — public URL of NON-PROD, used by the regression tests.
   - `PROD_URL` — public URL of PROD, used by the sanity check.

## Notes

- The regression suite creates its own uniquely named test accounts and clubs on NON-PROD.
- The PROD sanity check never creates data.
- A rollback restores the previous containers. Database migrations are **not** reversed.
