# Local phase 20 — not a production release

The prototype remains restricted to literal loopback and `demo-hd3d-direct`.
Production Firebase, credentials, Rules, existing saves, PC installations and GitHub were not changed.

## Explicit collision mapping

`review-mapping.mjs --inspect bundle.json NEW-report.json` reads a supplied frozen export and reports collisions. It does not allocate IDs.

The operator supplies a separate JSON object:

```json
{
  "mapping": {
    "version": 1,
    "directHash": "hash from inspection",
    "targetHash": "hash from inspection",
    "reviewedBy": "operator reference",
    "reason": "reviewed decision",
    "entries": [{"table":"hd3d_mail","uid":"fixture-user","from":101,"to":1001}]
  },
  "assurance": {"writersStopped":true,"pendingClientJournals":0,"exclusiveWriterConfirmed":true}
}
```

`review-mapping.mjs --plan bundle.json reviewed-mapping-and-assurance.json NEW-plan.json` validates the explicit mapping, produces a review ledger and a resumable **demo-only** job. Existing output files are never overwritten. Assurance flags are operator assertions, not an implementation or proof of a production writer fence.

Supported subset: new, already claimed and server-applied mail with no item reward, no broadcast and no dependent global audit. The destination must be explicitly supplied, unoccupied, unique, and above every relevant historical/scoped mail high-water mark. Historical mail, pending mail, item-bearing mail, opaque mail receipt references, unsupported reference fields, other numeric tables and unresolved collisions fail closed.

Known live references in ownership, dungeon purchases, run results, investment results and save mail-log/read lists are updated within their owner only. This is a versioned schema-specific mapping, **not a generic search/replace or proof that arbitrary future custom fields contain no references**. Any new reference format requires review. Direct snapshots and audits are archived unchanged. Existing gear is never regenerated. The row ledger supports verified offline undo; its collision-bearing restored view is archival and cannot be directly imported into global legacy tables.

Review every changed row and reference before a separately authorized application. The tested `localStore` / `runLocalJob` executor operates only on isolated demo data, verifies the full inventory, preserves update-time preconditions, and reads back an unknown commit before resuming. Real writer fencing, IAM/export completeness and a production executor are not established by these tests.

## Snapshot request batching

`direct-snapshot-batch.js` combines concurrent one-document reads only when snapshot token, endpoint and cancellation signal match. Responses are matched by exact document identity, including missing rows. Duplicate, foreign or incomplete responses fail. There is no cross-request or permission cache, automatic retry, omitted document read, altered commit, changed Rules or reward change.

The activation and revision are fetched concurrently; both remain mandatory. Existing bans/roles and CAS checks remain fresh. Challenge settlement comparison uses equal synthetic initial saves, wave 55, 11 drops, fixed draw and identical outcome assertions. HTTP counts are not billed Firestore reads and one sequential local timing is not a production latency claim.

## Essential decisions and blocks

The demo intentionally demonstrates that a modified browser can choose maximum permitted hard rarity or force a dungeon boss draw. Formula, ownership and immutable-receipt checks do not establish RNG fairness. Original ordinary enhancement was also client-drawn; hard/dungeon draw trust is a downgrade from the existing Worker. No decision to accept it has been made.

Recommended next decision: retain trusted settlement/RNG (the existing Worker is the least disruptive current option), or explicitly accept client-selectable draws with direct-only storage. Firebase Functions is a separate billing/architecture decision and is not enabled here. Deterministic reward redesign would be a game-design change, not a transparent security fix. Trusted weekly sealing also needs an authorized operator or trusted scheduled executor.

Real Auth startup is still blocked by the previously denied protected firebase-tools configuration read. It was not retried or bypassed. Synthetic tokens and module/DOM recovery tests are not actual Auth login or browser gameplay. A normal authorized Auth environment must be established before real login/cutover validation. Do not remove the demo-only rollout barrier based on this checkpoint alone.
