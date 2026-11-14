# Firebase direct-storage review branch

This is a source handoff, not a live service cutover. The branch is `firebase-direct-review` in `hyunjk11/hero-defense-3d`, based on main commit `ff0b997c596305a8876991f8ca02bdb66878489d`. Main, Pages, Sites, live Firebase Rules, and live data are outside this publication.

The source comes from frozen phase 22. Its original 1,080-file manifest SHA256 is `20ba267045de900ece5ffe955651f0bed7b07d5bfea2843f05a3153e2167d259`. The inherited `firebase-debug.log` and machine-specific `QA-DEPENDENCIES.json` report are excluded. Runtime code is unchanged from that reviewed candidate. Publication-only changes are this document, the README notice, the Git handoff status, six registry documentation entries for the preserved legacy module, and a portable baseline fixture for the hard-5 regression. No raw local test logs or real account exports are included.

## Preserved remote files

All 13 remote-only files remain byte-identical to the base commit: four historical documents (`docs/HARD2_2026-10-23.md`, `HARD_2026-10-21.md`, `TOWER_AWAKEN_2026-10-24.md`, `TOWER_AWAKEN_PLAN_2026-10-24.md`), `src/config/supabase.js`, `src/heroes/unique.js`, and seven historical tests (`tests/awaken.py`, `awaken.test.mjs`, `growth.test.mjs`, `hard.py`, `hard.test.mjs`, `hard2.test.mjs`, `hard_balance.py`). Existing history and files are not deleted. The retained unique module is not imported by the current main entry point.

## Publication-tree checks

Node v22.23.4, offline fetch/net guard, filesystem read permission limited to the workspace, no filesystem write permission for test processes:

- Ran all 131 test files: the phase-22 suite of 127 plus four remote-only historical tests.
- Final publication-tree rerun: 127 passes and the four historical failures listed below. Initial raw run had 126 passes and five failures; the registry documentation was corrected and the hard-5 baseline made portable before the full rerun. Runtime and historical test assertions were not changed to obtain this result.
- Four preserved historical tests still fail: `awaken.test.mjs` and `growth.test.mjs` pass obsolete tower arguments; `hard.test.mjs` imports removed `UQ_DROP`; `hard2.test.mjs` assumes a former hard-vs-normal HP curve. These are not counted as passed or silently skipped. Updating legacy gameplay expectations is separate work.
- Source review confirmed these tests target the former three-level/awakening and research `start` systems, the former unique-item pool and first-chapter hard unlock. Current code uses five-level towers, `efficiency` research with legacy `start` migration, normal 10-6 hard unlock, and the reviewed H1-5 rules. Current coverage includes `growth-v2`, `hard-tree`, `hard-runtime`, `hard5-resume`, hard loot and collection tests. Reintroducing old mechanics or lowering assertions solely to pass historical tests would change the requested game. The original 13 remote files therefore remain unchanged.
- `hard5-resume.test.mjs` previously imported a sibling PC checkout. It now uses `tests/fixtures/hard5-v25-baseline.json`: 60 normal stage definitions, four hard chapters and 144 reward samples, generated from the unchanged frozen v25 source with source hashes recorded. The comparisons retain their old expectations; no new reward values were invented. JSON definitions are compared in serialized form. The final suite is run with filesystem reads limited to this publication tree (plus the offline preload), proving it needs no sibling candidate directory.
- Reproduce the union with `node tests/run-all.mjs` (126 passing test files, four historical failures), then `node server/backend.test.mjs` (passing). Run `node tests/gregistry.test.mjs` for the documentation correction.

The frozen phase-22 Firestore evidence is unchanged: 34 main commands (33 exit 0; the security command has 50 passes and one unavailable real Auth test), seven isolated commands passed, and one generated-target-rules command passed using local demo transport only. These were not rerun against production. Source scans found no stored private credentials or real account exports; the RSA private-key marker belongs to an offline test that generates a temporary key, and the public Web configuration/legacy anon token are intentional. Mock fixture passwords and upstream contact attribution remain source code.

## Activation and known limits

- Default `src/config/cloud.js` uses `firestore-direct` with `directActivation: 'pending-rules-and-data'`. It fails before the SDK/network while activation is pending and does not fall back to Sites. This branch is not ready for production play simply by enabling Pages.
- The existing Firebase project is `hero-defense-3d-independent`. Prepare and review target Rules/index/catalog offline using `node direct/prepare-release.mjs NEW-directory`. Live Rules deployment, full data export/import, and writer cutover have not run. Current operator execution tools intentionally accept only isolated demo data; a real import executor remains a cutover prerequisite.
- Real login, browser play, and real cutover remain unverified. Auth emulator startup was blocked by OS EPERM reading the Firebase CLI config, before listening or creating accounts. That access was not retried or bypassed. Restore authorized access or provide an independently authorized isolated Auth environment before that validation.
- Changing the hosting origin requires same-account login and handling pending journals at the old origin. Firebase Auth allowed-domain compatibility for the future Pages origin is unverified.
- Hard rewards use the same direct storage/recovery mechanism as normal rewards. Existing hard counts, odds, first-clear guarantee, target box, and collection boxes are preserved.
- A modified client can choose permitted random reward outcomes and cannot prove real combat. Quantity, ownership, currency bounds and receipt/idempotency checks do not solve this trust limitation. No recommendation to retain the Sites reward server is imposed.
- Two local matched H1-1 pairs reduced HTTP requests from 82 to 60, commits from 8 to 7, and document writes from 32 to 20. This is still a substantial request/write cost; it is not measured billing or live loading performance.
- Preserve the old deployment and verified exports for rollback. After direct writes, reconcile/reverse new data before restoring an old writer. Do not overwrite new progress with an old snapshot. No live weekly schedule has been enabled.

See [GIT-HANDOFF.md](GIT-HANDOFF.md) for the remaining cutover sequence. Earlier phase documents are historical evidence, not current activation instructions.
