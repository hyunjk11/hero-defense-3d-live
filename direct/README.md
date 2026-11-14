# Current checkpoint: fresh live namespace (local review)

Read [FRESH-START.ko.txt](FRESH-START.ko.txt). Use `prepare-fresh-release.mjs` for offline initial-data preparation. The intended new repository name is `hero-defense-3d-live`; it has not been created or published. Existing saves are not an import/export/delete target. Runtime activation remains pending. The older migration checkpoints below are retained as history and are not the new-start procedure.

# Historical checkpoint: phase 22

Read [PHASE22.md](PHASE22.md) and [GIT-HANDOFF.md](GIT-HANDOFF.md). Hard economics are explicitly unchanged. Direct has no Sites API URL but stays pending real Rules/data activation. Older notes below are historical.

# Current checkpoint: phase 21

Read [PHASE21.md](PHASE21.md) and [GIT-HANDOFF.md](GIT-HANDOFF.md). The user selected normal-style hard rewards and a Sites-independent target. Older server-retention recommendations below are historical, not a pending choice. This is a local review candidate, not an activated production migration.

# Latest checkpoint: phase 19

Read [PHASE19.txt](PHASE19.txt) and `../../direct-firestore-evidence-19/REPORT.txt`.
Earlier checkpoints are history. No production-ready claim.

# Latest checkpoint: phase 18

Read [PHASE18.txt](PHASE18.txt) and `../../direct-firestore-evidence-18/REPORT.txt`.
Older checkpoints are historical. Local review only, not release ready.

# Latest checkpoint: phase 17

Read [PHASE17.txt](PHASE17.txt) and `../../direct-firestore-evidence-17/REPORT.txt`.
Older checkpoints below are historical. This is not a production release.

# Latest checkpoint: phase 16

Read [PHASE16.txt](PHASE16.txt) for current scope, verification and blockers.
The phase 11 and older sections below are historical, not the current feature matrix.

# Phase 11 — local review checkpoint, not deployable

This checkpoint closes DF10-01 with durable per-account start IDs and immutable
entry receipts. A committed tower start whose response is lost is resumed with
the same token and one daily charge after reconnect. Failed/uncertain starts no
longer silently become practice. Existing Worker mode remains unchanged.

The Rules also fix Korean-day integer arithmetic: add the UTC+9 offset before
dividing by the day length. Local emulators verified 7 day-boundary instants.
Offline cutover/reverse planners were exercised with an interrupted synthetic
import, ordinary authenticated reward transactions, a disabled writer gate and
exact local reverse readback. This is not a production migration implementation.

Current evidence is ../direct-firestore-evidence-11/FINAL-VERIFICATION.json.
Node 111/111; Rules suites initially 15/16 (one missing archived test fixture),
then all 16 effective suites pass after explicitly restoring that fixture.
A normal-speed browser tower floor, lost-entry-response/reload recovery and
XP8/result/town/reconnect were verified. Existing assets and game values stayed
unchanged. The local QA CSP texture-loading defect is fixed in its separate
loopback host, not in production game assets.

Remaining: trusted hard/dungeon random grants, challenge, privileged paid/admin
workflows, live ranking/weekly tower payout, production cutover/reverse and cost
controls. There is no fair-client-RNG or combat-truth guarantee. Client best_at
is not authoritative ranking order. All prototype Rules still require review.

## Historical phase 10 notes

# Phase 10 — review checkpoint, not deployable

This local-only checkpoint fixes DF9-01 and adds deterministic tower entry,
checkpoint and completion settlement. The historical sections below describe
older checkpoints and MUST NOT be used as the current feature matrix.

## Current changes

- Mail checks the entire unpaid suffix, including overflow dismantling at 200
  chests, before each bounded item transaction. Two receipt-linked Rules checks
  validate steel/crystal capacity separately to stay within expression limits.
  Known capacity deferral retains the unclaimed mail and already-paid receipts.
  The UI clears its pending guard only after an authoritative reload, allowing
  the player to spend currency and claim the remaining entitlement once.
- The whole multi-item mail is **not one atomic transaction**. A second device
  can fill capacity between item commits. Existing item grants are then retained
  and the remainder stays claimable. Each item/receipt/budget/progress commit is
  atomic; final currency/claimed flags remain atomic. No cap truncation, rollback
  of owned equipment, new arbitrary reward, or receipt deletion was added.
- Permanent-training intent is inferred from reconciled authoritative saves,
  avoiding wire-format differences after a mail item grant. Rules still require
  exact price, level and unchanged equipment.
- Tower start/ping/finish use the original server operation implementation with
  owner-only direct storage and server-timestamp Rules. Daily 30 entries,
  checkpoint eligibility, max 30 floors/run, bounded elapsed time, cumulative XP,
  first-boss reward mail, medals and titles are checked. This does not prove
  actual combat. Rules Timestamp.date() is documented at
  https://firebase.google.com/docs/reference/rules/rules.Timestamp_ .
- Trusted offline migration now preserves historical tower daily entry counts.
  Activation version spireVersion=1 is required for direct tower entry; an old
  direct prototype must be upgraded from trusted full history, never reset by
  a player. Zero-save bootstrap emits the same version. No live import ran.

## Current incomplete areas

Hard settlement/random rewards; dungeon boss/unique random reward parity;
ordinary challenge; paid orders/other administrator workflows; tower weekly
claims and live public ranking maintenance; production export/import, mixed
writer cutover and verified reverse application remain incomplete. Private tower
best/week records are current, but the public ranking view is still trusted
imported data and can be stale. No full tower replacement is claimed.

Normal enhancement/crafting/reroll were already browser-random in v34; bounds
cannot enforce fair draws. Hard/dungeon server-random rewards cannot be replaced
by client-chosen results with the same trust claim. They remain closed rather
than silently weaker. Existing arithmetic and receipt checks also cannot attest
that a player fought after the minimum time. Original Worker limitations and
new incomplete paths are documented separately in TRUST-DECISIONS.md.

Only demo-hd3d-direct and literal 127.0.0.1 endpoints are enabled. Production
Firebase data/Rules, installed copies, Worker, Auth settings, billing and GitHub
were not changed. The release blockers above remain real feature regressions.

Evidence and commands: ../../direct-firestore-evidence-10/REPORT.txt and
FINAL-VERIFICATION.json. Phase 9 remains frozen for independent review.

---

# Historical checkpoint notes (not the current feature matrix)

# Firebase direct-storage prototype, phase 8 — NOT RELEASE READY

## Phase 8 checkpoint (current)

Town research, barricade research, steel exchange and all ten advancement
branches now use receipt-linked atomic direct transactions. Original costs,
caps, prerequisite checks and saved tree choices are preserved. Exchange day
uses Firestore request.time in Korea time, not the browser clock. Optional
legacy fields and unknown retained save fields are not cleaned away.

DF7-01 is fixed locally. Every normal boss drop is checked before asset grants.
Rules independently validate each typed item, then an immutable manifest, then
the linked settlement. There are at most four item slots and one manifest per
run. Receipts cannot be forged through the XP-investment ID namespace. Ordinary
no-drop returns add no preflight commit. A run with N drops adds N+1 preflight
commits; this is a correctness change, not a loading-speed claim. Rules' 1,000
expression limit is respected by splitting required checks across linked writes,
not by removing checks. SHA hashes are identifiers only; Rules validate the data.

An old sealed entry that cannot legally be granted can advance exactly its own
cursor with an explicit skipped/invalid_drop result and no asset change. Prior
currency, chests and statistics are retained. A valid unpaid item cannot be
skipped. Recovery, lost replies and repeated requests are tested separately.

Current evidence: `../../direct-firestore-evidence-8/REPORT.txt` and
`FINAL-VERIFICATION.json`. Baseline phase7 remains frozen. Reproduce from the
task workspace with `python run-direct-regression-8.py`. The final fixed-UID
Rules suites used a separate disposable Firestore emulator on 127.0.0.1:9308:
set HD3D_DIRECT_TEST_PORT=9308, then run
`python run-phase8-rules.py --reset-ended-demo` ONLY after closing/archiving all
QA on that test-only instance. Browser QA is on 9298 and is never reset by this
command. `direct/town-test.mjs` and `direct/drop-validation-test.mjs` use 9298 by
default and unique fixture UIDs. The latter preserves/rechecks the original
pre-fix reproduction and explicit synthetic malformed legacy fixtures.

This is not a supported upgrade of an already-used phase7 direct namespace.
The trusted converter now extracts research/barLv/xch into typed authority.
Fresh migration from the original v34 snapshot and absence-preserving legacy
round-trips are tested; in-place phase7 prototype schema upgrade remains absent.
Do not point an old direct client at these Rules or activate production.

Production still fails closed. Hard/dungeon server-selected random grants,
ordinary challenge settlement, item mail/dungeon shop, paid hero order/admin
workflow, tower/live ranking writes and full live migration/cutover/rollback
remain incomplete. `TRUST-DECISIONS.md` separates the random trust choices.
Existing actual Firebase, Worker, saves, billing, GitHub and installed copies
have not been changed. Historical sections below are prior checkpoint records.

## Historical phase-6 checkpoint

Ordinary +0 through +10 enhancement, all existing crafting recipes and paid
reroll/apply/keep now use their original costs, probabilities and client RNG.
The original v34 browser already chose these three outcomes. Rules validate
legal values, ownership, exact costs and one atomic attempt; they cannot prove
that an adversarial client drew fairly. `random-boundary.json` now records this
limitation as an ACCEPTED paid forced success, not a denied cheat claim.

New crafted items have a fully typed, catalog-validated representation. Legacy
item JSON/unknown fields remain immutable; rerolled substats are a validated
override. Account-scoped journals retain the exact paid reroll candidate across
reload/lost response. Applying uses a fixed receipt ID derived from the paid
attempt. Keeping a candidate never refunds the paid cost.

Normal campaign returns below wave 5 with no item drops now settle souls and
statistics through a run-bound immutable receipt, after the XP checkpoint. The
existing result/statistics UI waits for authoritative confirmation. This closes
the observed ordinary first-wave return failure; it does NOT implement complete
stage rewards, challenge rewards, wave-5 chests or item-bearing returns. Those
remain closed, and no item is silently discarded to claim successful return.

Real local UI: normal-time 1-1 first wave, 11 kills/core30, souls11/XP10, return
and auth-restored reload with identical save and no pending journal. Separate
smith UI used an explicitly seeded synthetic emulator account: +1 to +2, craft,
paid reroll, refresh-before-apply, apply, keep, reload all observed. This is not
evidence of normal resource acquisition or production Firestore behavior.

Phase6 reproduction from the task workspace:
`python run-direct-regression-6.py`; once all local QA is closed and archived,
`python run-phase6-rules.py --reset-ended-demo`. The latter resets ONLY the
disposable `demo-hd3d-direct` emulator database at 127.0.0.1:9188. Do not run it
while another browser/test is using that database. Evidence and exact status:
`../../direct-firestore-evidence-6/REPORT.md`, `FINAL-VERIFICATION.json`.

Remaining release blockers: complete campaign/hard/dungeon grants and successful
full-clear parity, other economic/admin/tower/ranking paths, safe production
export/import/cutover/rollback. Hard and dungeon server-origin random rewards
cannot silently become client-origin draws with the same security claim.
Production is still fenced off; actual Firebase data/Rules, Worker, installed
copies, GitHub/Pages, authentication settings and billing were not changed.

Only `demo-hd3d-direct` on a literal `http://127.0.0.1:<port>` endpoint is allowed.
Production CLOUD, Worker, live Firestore Rules/data, billing, GitHub and the two
installed copies are unchanged. The phase-1 and phase-2 candidates are preserved.

## Phase-5 checkpoint and corrected trust comparison

Independent findings DF3-02 and DF3-03 are fixed locally. The trusted offline
converter emits immutable dungeon-day markers for every historical run before
activation, using the saved Korean calendar day for done/active/abandoned runs.
Malformed days are rejected. Full authoritative history is still required: this
does not infer a missing/pruned run or make re-importing over live direct data
safe. Production import/cutover tooling is still absent.

Legacy items without `e` retain that absence through opening, storage and equip.
Only the requested deterministic enhancement/dismantle treats missing `e` as
zero. Equipment maps with absent hero keys are supported without granting extra
slots, duplicating ownership or changing unknown retained keys. +0 -> +1 writes
an explicit `e:1`; later random enhancement is still unsupported, a regression.

Final local checks: 104 Node files, 51 Rules cases, 100 tree choices, 13 equipment
cases, 50 chapter/grade opens, 17 notice cases, 12 new migration/legacy cases.
Forced random-upgrade writes remain denied. No new browser/production success
is claimed; the phase4 normal return failure below remains unresolved.

Correction to phase4's broad RNG comparison: original v34 ordinary enhancement,
crafting and reroll already draw in the browser and persist through the Worker
save endpoint. Original-code MemoryStore probes accepted chosen valid outcomes
in all three paths (`legacy-trust-results.json`). Their fair-draw limitation is
NOT newly introduced by Firebase direct storage. In contrast, hard settlement
and the dungeon boss-drop decision currently execute on the Worker. Those
server-origin decisions require separate treatment; do not conflate all loot.
The +1-only restriction must not be labelled required to preserve the original
ordinary enhancement trust level. It remains an unfinished stronger prototype
restriction. Phase5 did not silently remove it or relax the reviewed Rules.

Evidence: `../../direct-firestore-evidence-5/REPORT.txt`, before-defects.json,
migration-legacy-results.json, original-trust-comparison.txt and final manifest.
Frozen phase3/phase4 candidates and their manifests are preserved. A first
phase5 run exposed absent equipment-map keys; raw failing results are retained.

Reproduce final tests from the task workspace with:
`python run-direct-regression-5.py` and, only after ending every local QA session,
`python run-phase5-rules.py --reset-ended-demo`. The latter explicitly resets
only the local demo database and runs the suites sequentially. Individual
`direct/migration-legacy-test.mjs` uses unique fixture UIDs without a reset.

## Phase-4 checkpoint

Local QA 404 was a port collision (exclusive bind failed with WinError10048).
The dedicated exclusive server on port57484 served the correct candidate. Real
Auth signup, town, XP view, refresh/auth restoration and normal 1-1 wave1 were
observed. Return failed: XP10 committed, normal souls11/statistics did not, and
the prototype guard stopped navigation. This remains a feature-parity blocker.
The browser account snapshot is preserved; a later local test harness reset
ended that QA round. It is NOT a successful return/reconnect test.

New direct-notices.js implements only administrator notices, not the rest of
administration. Trusted existing roles are read fresh; Rules enforce role/ban,
notice schema, revision and immutable audit in one commit. A durable per-account
request survives unknown responses and refuses to overwrite another editor.
Scheduled drafts are unreadable before their start; expired notices are filtered
before limit. Public results page by publication range then retain created_at
ordering. The index file is supplied but only emulator query behavior is tested.
notice-migration.mjs is a pure trusted-export converter, not an importer.

The unresolved RNG/functionality choice is documented in
../../direct-firestore-evidence-4/DESIGN-DECISION.txt. The +1 enhancement limitation
is an unfinished regression, NOT an acceptable replacement for +10. Crafting,
reroll/new item issuance and full battle settlement remain closed. No alternative
trust model or game probability change was silently selected.

New evidence: direct-firestore-evidence-4, including notice-results.json,
rng-design-results.json, browser-return-state.json, TEST-INCIDENT.txt and the
candidate manifest. Earlier phase3 evidence below describes the historical state;
its security/tree JSON were overwritten by the documented phase4 test sequencing
incident. The frozen phase3 candidate itself is preserved.

### Phase-4 reproduction

Start the existing local emulators only; load phase4 Rules using
python direct-browser-runtime/load-phase4-rules.py. Run notice-test.mjs with the
pinned Node22 from the workspace; it uses distinct synthetic fixture UIDs and
does not reset the browser account. rng-design-test.mjs is pure engine analysis.
python run-direct-regression-4.py runs the 104 current Node test files. Raw output
and structured results are in direct-firestore-evidence-4. Emulator test fixtures
are trusted test setup, not production migrations or normal browser progress.

## Phase-3 additions and limits

Existing pre-rolled chests, equipment moves/ownership, storage expansion,
dismantling and codex claims use typed authority, an atomic revision/receipt and
an account-scoped durable UI journal. The original item body and packed storage
are preserved. No new item minting is enabled.

**Random enhancement is NOT supported:** a raw emulator request proved that a
client could force +5 -> +6 while paying the correct cost. The final Rules deny
this; only deterministic +0 -> +1 is allowed. Crafting/rerolling and new battle
loot remain closed pending a trusted randomness/design decision. Correct ranges
and prices alone do not prove fair client randomness.

The Auth adapter now uses a separate emulator-capable SDK and verifies account
activation on signup/login/session restore. Real local Auth/Firestore tests cover
success, pre-commit failure and lost commit response. This is Node/in-memory
persistence evidence, not browser UI or persistent-session evidence.

Browser UI testing did not run: the dedicated 127.0.0.1:9180 static QA address
returned 404 even after formal local-server escalation. No production fallback
or different-URL workaround was attempted.

Full phase-3 evidence and exact remaining gaps are in
`../../direct-firestore-evidence-3/REPORT.txt` and `FINAL-VERIFICATION.json`.

## Earlier implemented and tested paths (retained)

- Auth ID tokens reach Firestore REST and actual local Security Rules, with no
  Worker or Admin credential in the player transport. Trusted emulator fixture
  writes seed imported state and catalog data; they are never player operations.
- Account-scoped consistent read snapshots + one revision/updateTime CAS protect
  all writes in an atomic commit. Only proven rejection/contention can retry;
  a timeout, 503 or lost commit response is never blindly replayed.
- `progress.authority` protects souls/materials/training/stages/advancement and
  a sealed canonical copy of the remaining legacy save. `saveJson` is explicitly
  untrusted and ignored on reload. Missing legacy optional fields are preserved.
- One-step HP/ATK training uses the existing exact prices/caps. XP investments
  use the exact 51,940 XP Lv1→50 total, immutable receipts and wallet invariants.
- Campaign/challenge XP progression is bounded by stage catalog and server-issued
  timestamps. First-clear XP, replay and mismatched amounts are checked.
- Tree choices/presets preserve XP and other heroes/branches; current advancement,
  permanent level and immutable option catalog bound each changed choice.
- Currency, medal, hero and informational mail claims apply the reward and claim
  in one transaction. Item mail remains unsupported and unconsumed. An imported
  already-claimed mail without `server_applied` or its saved mailLog is flagged as
  unresolved, never silently declared applied or paid again.
- Direct-only shop integration guards purchases before flush and commit, keeps
  a durable pending marker through response/reload loss, reloads authoritative
  state before success, and resumes the same receipt after account reconnection.
  The normal Worker UI path is unchanged (`atomicMail` capability is direct-only).
- Dungeon daily entry, server-time XP floors, completion medal/currency mail,
  expiry, previous active-run abandonment and zero-floor return are implemented.
- New-account zero bootstrap is atomic and cannot replace existing legacy or
  migrated account state. Real Auth emulator signup/login/token refresh and
  Firestore bootstrap were exercised; credentials stayed only in test memory.
- A separate authenticated ranking projection omits private saves/email and
  preserves sorting/ties/exclusion. Client writes to it are denied.

## Exact remaining gaps

This is NOT a playable full replacement for v34. Closing a forgery by denying a
write is not feature parity. Unsupported paths fail closed, not successful.

| Area | Remaining work |
|---|---|
| Remaining economy | Research/advancement purchases, crafting/rerolling, random enhancement, new item rewards and hard settlement remain unsupported. Existing-item deterministic transactions are implemented as described above. |
| Dungeon | Purchases, item/boss drops and their inventory application remain unsupported. Direct Rules tests do not prove actual gameplay completion. |
| Tower/ranking | Tower entry/progress/weekly rewards are unsupported. Ranking projection is trusted offline input, not a live maintained leaderboard. |
| Administration | Notice CRUD/audit is implemented above. Other admin/owner RPCs are unsupported. The existing UI reads other accounts' email/private save summaries; a separate admin projection/workflow is required rather than opening private documents. No self-role grant is allowed. |
| New account/browser | Adapter signup/login and interrupted zero bootstrap are tested with actual emulators. Browser signup/town/auth restoration were observed in phase4; guest-save reconciliation remains unverified. No live Auth fallback is allowed. |
| Migration | Trusted offline converter only; no production exporter/importer, pending-journal reconciliation, cutover tool or verified reverse migration exists. |
| UI | Actual shop/account modules passed Node orchestration tests with a simulated API. Phase4 real-browser normal battle return FAILED as documented above; no end-to-end successful return/reconnect is claimed. |
| Security | Arithmetic, ownership, timestamps and receipts do not prove combat truth, fair browser random draws or completed gameplay. Deep schema/resource limits, forged snapshots and every remaining economic transition require further audit. |

The current protocol can reject direct XP/currency field edits. It cannot certify
that a player really fought the waves claimed after the minimum elapsed time.
The original Worker also accepts time-bounded self-reported wave completion;
this is an inherited limitation, not proof that the migration introduced it.

## Rules/data model

`hd3d_direct/{uid}/{legacyTable}/{id}` contains owner, version, typed row,
commitRevision; run documents also have immutable server `issuedAt` timestamps.
`hd3d_sequences/_revision` holds a bounded operation proof plus the account CAS.
`_activation` is a trusted migration/zero-bootstrap marker. Permission documents
are owner-readable, never owner-writable. Legacy production paths remain denied.

`hd3d_direct_catalog` is authenticated read-only trusted stage/tree/bootstrap
configuration. `hd3d_direct_ranks` contains only uid/nick/floor/time/kind/week and
exclusion, never email or private saves, and is client read-only. Detailed field
requirements are in the path-specific validator functions in `firestore.rules`.
Every mutable document is independently validated and linked to the same commit.

Rules are now dispatched by collection instead of one large generic expression.
The former repeated mail validation exceeded the 1,000-expression limit; the
redundant second check was removed only because the required atomic progress
write independently performs that same check. Explicit boolean predicates and
path dispatch also removed an emulator ternary/lock error. This local result does
not identify or fix the historical production 97-second latency. A later paid-hero
tree test also reached the limit; inlining identical XP integer/range checks and
reusing key sets fixed that case without removing ownership or economic checks.

I've set up prototype Security Rules to keep the data in Firestore safe. They are
designed to be secure for owner-only private data, immutable permission grants,
validated economic deltas and atomic receipt-linked writes. However, you should
review and verify them before broadly sharing your app. If you'd like, I can help
you harden these rules.

## Phase 7 checkpoint (not release-ready)

Normal campaign stages now use a receipt-linked, recoverable settlement path.
Currency/progress commits once; a monotonic entitlement cursor grants each chest
exactly once. The existing result/statistics/town screens are reused. This keeps
the original ordinary-campaign CLIENT draw; it does not make it a trusted draw.
Normal challenge mode and the remaining hard/dungeon item grants are not enabled.

DF6-01 now rejects nonzero zero-wave kills and oversized per-stage kill reports.
The envelope is intentionally conservative for renewable spawns, not an attestation
of actual combat. An elapsed, bounded, fabricated run can still succeed. DF6-02
now rejects crafting IDs that collide with unopened chest items. New normal loot
uses the game's existing 16-character item ID contract so cleaning/UI opening
addresses the same stored chest. Paid economic transitions still validate costs,
ownership, legal item values, revision and atomic receipt linkage.

`migration-plan.mjs` is offline-only. It checks supplied complete-export metadata,
identity/ownership/counts, sequence high-water marks, active-run reconciliation,
duplicate inventory/chest IDs and round-trip data preservation; activation writes
are separated and last. It does not export/import a real database or prove that
an operator supplied every document. Production readiness remains false.

Final phase7 test commands, from the task workspace:

```powershell
python .\run-direct-regression-7.py
# ONLY after archiving/closing every QA round on the disposable localhost:9288
# demo-hd3d-direct emulator. This resets that emulator's test documents.
python .\run-phase7-rules.py --reset-ended-demo
python .\direct-browser-runtime\serve-phase7.py 57484
```

Use Java 21 and the already installed official Firestore emulator, locale `en/US`,
host `127.0.0.1`, port `9288`, project `demo-hd3d-direct`; Auth emulator stays on
9199. Do not run the reset command while browser QA is active. Test runner raw
results are in `direct-firestore-evidence-7`. Tests do not contact production.
Security suite fixtures age run timestamps explicitly; these are not normal-time
play. The first browser full-clear was normal-time; the final ID/UI recheck used
the actual product engine's G.sim with ordinary costs, explicitly accelerated.

Hard/dungeon random rewards were Worker-selected in v34, unlike ordinary item
rolls. Moving those draws into a client would reduce trust. This checkpoint does
not silently enable them: either retain a trusted execution path for those grants,
or explicitly choose a weaker client-trust/different reward design. Firestore
Rules validate state transitions; they do not provide a private random generator.
Remaining admin, live ranking writes, challenge, research/shop and complete
hard/dungeon reward parity are release blockers. Existing Worker is retained.

## Historical phase 3 reproduction

Run from the task workspace. Start local emulators (one of each only):

```powershell
& '.\direct-test-runtime\jdk-21.0.13.0.2+1\bin\java.exe' '-Duser.language=en' '-Duser.country=US' -jar '.\direct-test-runtime\firestore.jar' --host 127.0.0.1 --port 9188 --project_id demo-hd3d-direct --single_project_mode true --single_project_mode_error true --rules '.\candidate-v34-firestore-direct-3\direct\firestore.rules'
& '.\firebase-cli-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe' '.\firebase-cli-cache\_npx\ba4f1959e38407b5\node_modules\firebase-tools\lib\bin\firebase.js' emulators:start --only auth --project demo-hd3d-direct --config '.\candidate-v34-firestore-direct-3\direct\firebase.json'
```

Wait for the emulator-ready messages before running the security suite. The suite
resets only the dedicated demo project's local in-memory database; do not run
another suite against it concurrently. Timestamp-aging fixtures are explicitly
trusted test setup, not normal-time UI/production tests.

```powershell
& '.\firebase-cli-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe' '.\candidate-v34-firestore-direct-3\direct\security-test.mjs'
python .\run-direct-regression-2.py
```

The regression runner disables network, runs actual checked-in test files and
writes each raw stdout/stderr to `direct-firestore-evidence-2/regression`.
Emulator suite output is `direct-firestore-evidence-2/security-results.json`.
Earlier failing and passing snapshots are preserved separately.

## Migration and rollback gates

Keep the current Worker + deny-all client Rules until feature parity, browser
recovery, adversarial review and a coordinated migration are complete. Trusted
migration must first reconcile old pending mail/save receipts; do not infer an
unpaid reward from a missing browser journal. The converter preserves the supplied
legacy snapshot and trusted sequence high-water marks without opening a live DB.

A future cutover must stop mixed writers, take a validated backup, import once,
verify counts/ownership/balances/receipts, then activate the matching client and
Rules. Before any direct writes, rollback is simply retaining the current Worker.
After direct writes, switching URLs alone would discard the newer namespace:
freeze writers and reconcile/back-port the verified deltas before rollback.
Neither live cutover nor reverse migration is implemented or authorized here.
