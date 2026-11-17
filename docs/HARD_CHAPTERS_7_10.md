# Hard chapters 7–10

Adds 24 stages to the existing sequential hard campaign (60 total). Each uses its normal chapter's map, waves, enemy roster and boss. Existing H1–6 definitions and rewards remain unchanged.

- H7 천둥의 군도: alternating thunder rings with safe inner/outer areas.
- H8 과열된 요새: three narrow, directional lanes; boss follow-up rotates 90°.
- H9 심연의 심장: crossing rifts; boss follow-up rotates 45°.
- H10 멸화의 성채: alternating dragonfire rings.

Warnings remain fixed after targeting, last 1.9–2 seconds, and can be interrupted by stun. Native enemy casts, awakenings and exposed recovery windows are not preempted. Extra attacks affect heroes only, with damage at 55% of the enemy's attack stat. Existing active-elite cap of two remains.

Normal completion still unlocks hard mode. H7-1 follows H6-6 and progression remains sequential through H10-6. Unknown H11 IDs remain locked. Reward receipts, duplicate-settlement protection and versioning are unchanged. H7–10 use the existing first-clear and wave rewards plus two repeat-clear collection chests. Collection grades are green 70% / blue 30%; no new white items. Previously issued chests are not rewritten.

Automated tests cover all 24 first/repeat settlements, duplicate requests, party XP, preservation of existing progress/rewards, collision/telegraph geometry and effect cleanup. Browser battle checks are separate from server settlement tests; no real player records are modified by these tests.
