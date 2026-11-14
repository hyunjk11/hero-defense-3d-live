# Hero Defense 3D live

New repository for the fresh-start Firebase Functions edition. The existing hero-defense-3d repository and its Pages/stag site remain separate.

The backend gameApi has been deployed to Firebase Functions v2, asia-northeast3, and is currently disabled. The approved first game administrator has been initialized in the new server namespace. The static client remains pending-deployment while production login/save/reward verification is unfinished; this is not a ready-to-play announcement.

Architecture: browser Firebase Auth -> Functions gameApi -> Firestore. No GPT/Sites API fallback is used by this client profile. All game records are pinned to hd3d_live_server/state; old records are not imported or deleted. Browser storage keys are separated from the old site. The API URL is the deployed function address in src/config/cloud.js.

Hard reward quantities, probabilities, first-clear guarantees and collection chests are preserved. Server-owned prices, balances, draws, transactions and receipts protect economic changes. Combat is not simulated on the server, so fabricated plausible combat progress remains a limitation.

Reviewed product regression: 145/145 files. Local real Auth and browser checks use isolated RAM Firestore and are not production verification. Release preparation verified all 908 source hashes, the static archive and inactive runtime/client gates. Private account identifiers, real saves, credentials and local QA reports are not included here.

Functions resources: Node22, asia-northeast3, CPU1, 256MiB, concurrency8, min0, max1, timeout180. Instance limits and budget alerts are not hard total-spend limits. Deployment-image cleanup policy is unchanged.

Use cloud-functions/ for the Functions backend. Historical direct/ and transfer/ tools describe the abandoned direct-Firestore design, not the live deployment path. Do not deploy their Rules or import legacy data. The historical tools/build-review.mjs targets that old profile and must not be used to bypass activation guards.

Activation requires verified production endpoint behavior and fresh-namespace account/save/reward checks. Rollback disables the new endpoint and reverts the new static client while preserving receipts. Never redirect new saves to the old Worker. Do not publish credentials, emulator accounts, real user data or local administrator bootstrap records.
