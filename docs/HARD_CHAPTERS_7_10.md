# Hard chapters 7–10

Adds 24 stages to the existing sequential hard campaign (60 total). Each uses its normal chapter's map, waves, enemy roster and boss. Existing H1–6 definitions and rewards remain unchanged.

- H7 천둥의 군도: alternating thunder rings with safe inner/outer areas.
- H8 과열된 요새: three narrow, directional lanes; boss follow-up rotates 90°.
- H9 심연의 심장: crossing rifts; boss follow-up rotates 45°.
- H10 멸화의 성채: alternating dragonfire rings.

Warnings remain fixed after targeting, last 1.9–2 seconds, and can be interrupted by stun. Native enemy casts, awakenings and exposed recovery windows are not preempted. Extra attacks affect heroes only, with damage at 55% of the enemy's attack stat. Existing active-elite cap of two remains.

Normal completion still unlocks hard mode. H7-1 follows H6-6 and progression remains sequential through H10-6. Unknown H11 IDs remain locked. Reward receipts, duplicate-settlement protection and versioning are unchanged. H7–10 use the existing first-clear and wave rewards plus two repeat-clear collection chests. Collection grades are green 70% / blue 30%; no new white items. Previously issued chests are not rewritten.

Automated tests cover all 24 first/repeat settlements, duplicate requests, party XP, preservation of existing progress/rewards, collision/telegraph geometry and effect cleanup. Browser battle checks are separate from server settlement tests; no real player records are modified by these tests.


## Release verification (2026-11-17)

41 isolated browser battles at fixed 1/60-second engine steps, seed 12345; all 24 new stages have a completed battle, with zero JavaScript runtime errors. Failures are retained, not reclassified as successes. The fixed bot is not representative of every hero, equipment set or human strategy.

Best verified core HP (stage 1 through 6, maximum 30):
- H7: 30, 28, 13, 30, 9, 25
- H8: 30, 30, 24, 16, 4, 2
- H9: 30, 30, 28, 30, 30, 10
- H10: 30, 10, 28, 16, 30, 30

Profiles use synthetic progress, not a live save. The base profile has mage 45/archer 30 and the first-clear XP/soul budget through H6. The geared profile generates prior H1–6 first rewards, opens equipment, dismantles unused gear and pays enhancement costs including failures. The later mobile profile includes prior H1–9 rewards and mage 50/archer 40 within that XP budget; it prioritizes legendary archer weapons and anti-air multi-shot towers with hero movement. H10-3/5/6 completed with that later profile. No combat HP, enemy death, gold or damage cheats are used.

H7-5 alone was reduced from HP multiplier 4.305 to 3.99 after three late-wave failures; the same geared mixed-tower profile then finished with core 9. H10 mixed-tower failures became victories with the same gear/stats and the mobile anti-air strategy, without reducing H10 enemy stats.

Visual checks: all four new warnings, 800×600 battle HUD, ten chapter tabs, sequential locks, H10 reward preview and equipment tooltip. Existing victory animation is preserved. Browser battles suppress server settlement callbacks: live account saving/rewards, standard settlement result modal and audible sound were not verified by these runs. MemoryStore tests independently cover reward/XP settlement and duplicate requests.

Reproduce a local battle with `python tests/hard-upper-browser.py hard-7-5` and a local Chromium executable in `BROWSER_EXECUTABLE`. Set `QA_FIXTURE` to `hard-upper-geared-qa.mjs` or `hard-upper-mobile-qa.mjs` for the other profiles. These fixtures are loopback-only and block non-local requests.
