# Current direction (phase21)

The user selected normal-style hard reward processing to remove Sites dependence. Do not repeat the prior recommendation as a required server-retention decision. The client-RNG limitation remains factual; current owned-count/CAS/receipt checks still apply. Production activation and real Auth testing remain separate unperformed steps. See PHASE21.md.

## Historical analysis

# Unresolved reward trust decision — local phase 9

The prototype is still emulator-only. No option below has been deployed or
silently enabled for hard/dungeon rewards.

| Path | Existing v34 authority | Direct prototype state |
|---|---|---|
| Normal gear drops, enhancement, craft, reroll | Browser draws, Worker saves | Original outcomes/costs preserved; Rules bound legal values and receipts. A client can choose a legal favorable draw. |
| Hard clear/repeat items and additional collection boxes | `server/growth.mjs` calls `hardReward` with server RNG | Not enabled as a client-selected replacement. Existing quantity, first-clear guarantee, collection and repeat-target policies must remain intact. |
| Dungeon boss drop | `server/dungeon.mjs`, 30% decision and random slot on Worker | Not enabled as a client-selected replacement. |
| Dungeon finish XP/medals/soul mail | Time-bound server arithmetic | Prototype supports validated arithmetic, daily markers and once-only receipts. All 12 existing dungeon shop products and trusted item-mail descriptors now have local transaction paths; boss/unique combat drops remain incomplete. |
| Combat completion itself | Time-bound client wave/kill claims | Rules cap claims and use server time, but cannot prove that combat occurred. Existing Worker also accepts bounded completion reports. |

1. Keep the current trusted Worker only for server-origin reward grants. This
   best preserves original random trust and data contracts, uses no new Blaze
   billing, but is not a Worker-free design.
2. Move those draws to the client, keeping legal probabilities in normal play
   and validating quantity/cost/idempotence. This preserves visible features but
   an altered client can choose rare outcomes. This is a real security reduction
   for hard/dungeon rewards, unlike the already-client-random ordinary upgrades.
3. Use deterministic, server-time-derived or public-hash rewards. These can be
   predictable/manipulated by retry timing or IDs, and may change drop design;
   they are not a private random generator or a parity-preserving substitute.

Recommendation: do not remove the trusted reward executor until the parent/user
explicitly chooses the weaker trust of option 2 or a new reward design. Keeping
option 1 while other economic/admin/ranking/migration work continues is feasible.
Firestore transactions and Security Rules provide access/state validation, not
private computation or random secrets. App Check alone is not proof of combat
or a fair draw. No secret is placed in client code.

Other unfinished work is implementation work, not a reason to open permissions:
challenge currency/items, admin paid order approval and private-user projection,
tower progression/ranking updates, production export and writer freeze,
pending-receipt reconciliation, activation and full reverse migration.
These paths currently fail closed or are read-only, and are not feature-complete.

Phase 9 adds an offline reverse-plan builder, not a deployment/migration tool.
It requires frozen source and destination snapshots, no active runs or pending
receipts, exact target preservation, and no global numeric-ID collisions. It
refuses conflicting IDs rather than silently renumbering or overwriting them.
No actual production import/export or mixed-writer cutover has been tested.

Item-mail grants preserve the original client-known seeded draw. A modified
client can still select a different legal draw; the Rules validate descriptor,
quantity, cost, and once-only grants, not randomness fairness. Up to 10 item
grants are ordered independent atomic transactions with immutable receipts,
followed by the final currency/claim transaction. The entire mail is not one
atomic commit. Existing journals resume after a lost response; unresolved
partial mail prevents the offline reverse plan from declaring the account safe.


## Phase 11 checkpoint (2026-11-04)

The earlier phase-9 table above is historical. Tower progression, deterministic
first-boss rewards, ping/finish recovery and daily entry preservation are now
implemented and tested in the local emulator. Entry IDs are durable before the
request; an uncertain committed start resumes the same token after reconnect.
This does not restore a mid-combat attempt from a different device or recover
an intent erased with all browser storage. Web Locks serialize cross-tab starts
where available; browsers without Web Locks only have the same-context guard.

Weekly tower payouts and authoritative live-ranking projection are still
unfinished. Client-controlled best_at is NOT a trusted tie-break timestamp.
No claim of fair client randomness, combat truth or production readiness is made.

The new offline cutover planner supports exact-data verification, interrupted
imports and a separate activation step. The reverse planner now requires an
actually disabled activation record in the frozen export. A synthetic account
was imported, played through ordinary Rules transactions, frozen, reversed into
local legacy tables and read back exactly in the emulator. No production export,
remote import, activation, deployment, billing or credential change occurred.
Global projections, exclusive writer orchestration and collision remapping
remain separate reviewed work. Hashes alone do not prove export completeness.

Korean-day arithmetic in the prototype Rules was corrected by adding 9 hours
BEFORE integer division. This fixes otherwise-valid starts rejected between
KST midnight and 09:00, without changing game limits or security policy.
The graphics issue was a local QA HTTP server CSP missing blob: in connect-src;
corrected QA configuration restores embedded textures. Game assets are unchanged.


## Phase 12 checkpoint

Live tower score projections now commit atomically with private score updates.
New/improved tie timestamps use Firestore REQUEST_TIME and must equal the
private timestamp; copied private timestamps retain nanosecond precision.
A browser cannot backdate a new score. Trusted legacy projection imports
normalize date-only/offset exports, while preserving canonical nanoseconds.
Legacy prototype private string timestamps need trusted conversion; the client
does not silently invent an old timestamp or a different historical ordering.

Rank queries read a non-PII projection plus minimal ban flags. They are fresh
on request, not a push subscription. The prototype still fetches all matching
scores/flags to establish top50 and the caller's rank; this is not a validated
large-population, low-quota or performance solution. Rank names refresh with a
score update. Global projections/bans must be imported from a complete frozen
export; per-account migration alone is insufficient.

Admin ban/unban API writes a private reason, public exclusion and immutable
audit in one CAS-protected commit. Fresh role, owner-email binding and actor ban
checks apply in Rules. Lost replies retain a durable account-scoped intent.
This does not implement the full admin user-search/detail, paid orders, hero
grants/revocation, refunds, broadcast mail or rank-reset UI/operations.

Weekly claim consumes an immutable, trusted closed-week entitlement, writes
one claim receipt, marks the weekly record, creates the original mail, and
updates last-week titles atomically. Currency is then claimed by the existing
mail path. Missing entitlements defer without changing assets. The offline
weekly-awards planner reproduces original reward/title rules from a complete
frozen export; it performs no network writes. Its completeness/writer-fence
flags and hash do not prove the export is truthful. A trusted finalizer and
approved deployment/import workflow are STILL REQUIRED for automatic weekly
payouts. Client-provided rank queries cannot substitute for that finalizer.
Neither weekly end-to-end automation nor an entirely Worker-free production
replacement is complete.

DF11-01: the exhausted-entry UI now permits the current account's validated
pending start intent. Recovery uses the same ID/token and no extra entry.
Without that intent, left0 still blocks new entries; used/expired intents are
cleared through the existing terminal handling. This does not recover erased
local storage or another device's unknown entry intent.

Hard and dungeon private-RNG drops, challenges and remaining admin economic
paths are unchanged and incomplete. No weaker client RNG or predictable seed
was introduced to make their tests pass. Original ordinary browser draws retain
the already-documented favorable-draw limitation. Actual combat is not attested.
Existing v34 game assets, balances and production deployment are unchanged.
