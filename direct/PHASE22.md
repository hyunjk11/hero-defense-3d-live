# Phase 22 — Sites-independent connection preparation

The user clarified that only the hard storage method changes. All hard quantities, grade probabilities, first-clear guarantees and target/collection chest policies remain unchanged. Phase21 reward processing is retained exactly.

The default src/config/cloud.js no longer contains a Sites API URL. It selects firestore-direct for the existing hero-defense-3d-independent project. directActivation intentionally remains pending-rules-and-data: login stops before SDK/network until the real Rules/data cutover has been verified. This is review source, not a working live migration.

src/account/direct-config.js supplies one endpoint policy for game, bootstrap, order, administrator, mail, notice, moderation, broadcast and ranking paths. Live direct accepts only the existing project/authDomain and official Firestore HTTPS endpoint; rejects emulator overrides; never falls back to Worker. Demo helpers remain restricted to demo-hd3d-direct on literal loopback. Existing Firebase app name, Auth persistence, UID checks, CAS and reward validators remain intact.

Offline node direct/prepare-release.mjs NEW-directory emits the exact target Rules/indexes/catalog and manifest. Only the Rules audience/header and catalog resource-name prefix change; validators and all 197 catalog values are preserved. No service, credential or CLI config is accessed. The generated artifact still requires independent review and approved activation.

Final 127 Node test files pass. Existing local Firestore suites plus generated target-audience Rules and production-shaped requests redirected exclusively to demo verify hard two-hero entry, lost committed loot reply, account isolation and exact recovery. They use synthetic JWT/SDK and aged runs, not real login/browser combat. Raw failures and final results: ../../direct-firestore-evidence-22.

The separate direct/firestore.rules stays demo-only. I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for owner-scoped access, immutable reward entitlements, exact economic deltas, and atomic cursor/CAS checks. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

Client-selected legal random outcomes and unverifiable combat claims remain weaker than trusted server adjudication. No fair-draw guarantee. No reward-server choice is being asked again. See GIT-HANDOFF.md for exact remaining actions. No Git mutation, Pages/Sites deployment, real Firebase change, new credential or installed-PC change occurred.
