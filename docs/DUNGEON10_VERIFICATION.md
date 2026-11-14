# Dungeon 10-floor expansion verification

Baseline: 11efa8cadaea02f0becad8682331bdf1392c17ed.

Implemented floors6-10, versioned server opt-in and guest entries, compatible legacy5-floor receipts, and Abyssal legendary set. New full clear pays6600 souls and one set item. Existing tokens and old clients retain their5-floor completion/reward contract. Infinite tower behavior is unchanged.

Passed: dungeon44 assertions; dungeon-account; dungeon-auto; dungeon-souls; dungeon10-backend7 tests; abyssal-set storage/mail and actual combat module for5 classes; morvia-set; set-status53; legend; legend-feedback7; hero-growth11; functions-economy22. New dungeon/set tests also passed Node22.23.4.

Known baseline failures: server/backend.test.mjs admin/auth5 failures; Functions live-contract admin assertion and entry resource default assertion also fail on unchanged baseline under Node22. These are not represented as passes.

Functions source mirror regenerated58 modules. Removed obsolete unreachable staged dungeon data from manifest; actual source remains. No production data, credentials, Firebase resources or remote refs changed during implementation.

Remaining: real muted-browser playthrough/visual QA, integration with latest remote main, backend deployment first, client publication and live save/reward verification. Do not call this deployed.

Integration: upstream8bcbea254590ee78956b0a8b0fbba560435fe375 included. Muted fresh Edge local browser booted practice mode with3 heroes,10 floors, no page errors; controlled direct floor10 entry rendered10/10 and enemy spawns. This is not a natural10-floor playthrough or production-account reward verification. Production API routes were blocked in the browser test.
