# Phase 21: hard rewards use normal-style direct settlement

Current user direction supersedes the phase20 recommendation: remove dependence on the ChatGPT Sites service; use normal-style client reward processing for hard mode and hand off further development in Git. No additional reward-server choice is required for this change.

## Scope
- New hard runs seal browser-drawn reward descriptors in an owned, immutable entitlement; currency, statistics and hardRewardSeq commit once with the receipt.
- Each chest and its monotonic cursor commit together using the same Rules chest-grant validator as normal mode. Full capacity keeps the existing automatic dismantle behavior.
- No numeric reward mail is created for new runs. Already-pending legacy mail entitlements retain their original recovery path. No old chest/item is transformed.
- H1–5 reward formulas, odds, target chest1, repeat collection chests2, first-clear guaranteed hero-grade chest, XP, stage progression and two-hero behavior remain unchanged.
- Known currency/material-capacity deferral retains the entitlement, reloads authoritative state and releases the purchase guard so space can be made. Unknown commit results remain pending; they are never called successful.
- No UI explanation, new modal, stage/balance change, production activation or Git write.

## Trust boundary
Like normal rewards, hard draws occur in client code. A modified client can choose an allowed grade/stat draw. Rules still enforce owner, entitlement, count, allowed item/grade pool, exact currency, cursor, CAS and once-only credit; they do not prove fair randomness or actual combat. The latest user chose this processing direction. The unchanged dungeon path has the same previously documented client-RNG limitation.

## Source and tests
See ../src/account/direct-hard-normal.js, direct-hard.js, direct-store.js, direct-normal-client.js and direct/firestore.rules. See direct/hard-rewards-test.mjs, hard-normal-test.mjs, hard-client-integration.mjs, hard-cost-test.mjs and tests/direct-hard-client.test.mjs. Historical v20 transport fixtures are local test-only files under direct/fixtures; never production imports.
Final results and raw logs are in the sibling direct-firestore-evidence-21 directory. The scripts use a standalone Firestore demo emulator and synthetic Auth. They do not establish real login/browser/production behavior.

## Rollback and handoff
Phase20 remains byte-for-byte preserved. Review-source only; default cloud.js remains the existing Sites configuration. The direct adapter and Rules deliberately remain demo-only until real Auth, Rules and migration review/activation are completed. See GIT-HANDOFF.md for the precise remaining transition work. Git upload is distinct from deploying Rules, migrating data or switching Pages.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for owner-scoped access, immutable reward entitlements, exact economic deltas, and atomic cursor/CAS checks. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

## Scope interpretation awaiting parent review
The latest phrase "하드보상은 노멀처럼" may also request equal reward quantities/probabilities. This candidate implements processing parity only and preserves the existing different economics. It is not evidence that the full requested meaning is complete. No further numbers have been chosen. See evidence REWARD-DIFFERENCES.txt.
