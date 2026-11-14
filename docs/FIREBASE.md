# Independent game backend

- Firebase project: `hero-defense-3d-independent`
- Firestore: Standard `(default)`, Seoul `asia-northeast3`, Spark free plan.
- Public game/API: https://legacy.example.invalid (`POST /api/game`).
- Email/password accounts keep their original UID. No email verification step.
- Browser SDK: `lib/firebase-auth.mjs`; configuration: `src/config/cloud.js`.
- Server implementation: `server/`. It verifies Firebase ID tokens and checks player/admin ownership before every operation.
- Firestore client reads/writes are denied. Only the server account uses `roles/datastore.user`.
- Sites secret name: `HD3D_FIREBASE_SERVICE_ACCOUNT`. Never put its value in this folder or public assets.
- Existing local save keys and CAS timestamps are preserved. The first Firebase login uses the existing email/password; old provider tokens are not migrated.
- Database records store the original row JSON in an unindexed `payload`; selected primitive fields are indexed. This preserves packed equipment arrays without changing the game save format.
- Daily dungeon entries, rewards, mail claims and save updates use Firestore transactions.
- `supabase/` is historical migration reference only. Runtime code does not call it.

Run server regression checks with `node --test server/backend.test.mjs`.
