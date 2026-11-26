## User story

Linear: INC-XX: <!-- paste the user story title -->

## What changed

<!-- Short summary of the change -->

## Test cases

<!-- List the test cases / steps from the story and their result -->

| # | Test case | Result |
|---|-----------|--------|
| 1 |           | ✅ / ❌ |

## Definition of Done

**Development (steps 4–5)**
- [ ] Built on its own branch (`feature/INC-XX-...`)
- [ ] All acceptance criteria of the story are implemented
- [ ] Unit/component tests added or updated, and passing
- [ ] E2E test added or updated for the user flow
- [ ] CI is green (React build, .NET build & test, Playwright E2E, Docker build)
- [ ] Translations (EN + NL) added for new texts
- [ ] Code reviewed and approved

**Testing on NON-PROD (steps 6–10)**
- [ ] Deployed to NON-PROD and smoke tests passed
- [ ] Test cases executed and results logged
- [ ] Regression tests passed on NON-PROD (`regression.yml`)
- [ ] Acceptance approved (`acceptance.yml`)

**Release (steps 11–14)**
- [ ] Deployed to PROD (`deploy.yml`)
- [ ] PROD sanity check passed
- [ ] Linear story moved to **Released to prod**
