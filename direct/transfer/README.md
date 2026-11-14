# Direct-storage cutover tools — prepared, not activated

This directory adds an operator REST adapter and offline plan/execution boundary to the reviewed demo converter. It does **not** change the game, Rules, Firebase configuration, main, Pages, or either installed PC copy. The active client setting remains `pending-rules-and-data`. The existing `https://hyunjk11.github.io/hero-defense-3d/?stag` is protected; these tools do not choose its replacement or deploy it.

Target supported by the live adapter: `hero-defense-3d-independent`, Native/Standard Firestore `(default)`, official `https://firestore.googleapis.com`. This target comes from existing source, not a newly queried live database. Only the literal loopback `demo-hd3d-direct` endpoint is accepted for isolated rehearsal. No live export/import, OAuth issuance, IAM, Rules, Auth domain or activation operation has been performed for this candidate.

## Latest local preparation (2026-11-11)

See [the operation-by-operation Korean checklist](CUTOVER-CHECKLIST.ko.txt) for exact data scope, required approvals, backup/fence/journal conditions and rollback. This is not a deployment destination decision.

File-supplied inventories now fail before planning/writes if collection counts are missing/inconsistent, document identities are duplicated/foreign/malformed, or snapshot/update timestamps are invalid, sub-microsecond, or later than the pinned snapshot. Reverse planning preserves explicit zero-count direct collections rather than repairing/recounting invalid input. A new production-shaped JSON fixture exercises these boundaries, along with interrupted full readback and expiry failure. All synthetic fixtures remain local; no production data was exported.

`readTime` online reads follow the documented microsecond/last-hour contract (PITR's additional whole-minute window is not enabled or assumed). An API expiry/error aborts the entire snapshot without a latest-read fallback. An older offline archive can still be inspected; its age does not authorize execution. Every online apply starts with a new pinned full inventory and uses exact conditional writes/readback. Operator fence assertions and a matching file hash are not proof of completeness or authorization.

The historical Auth-blocked and guest-return paragraphs below describe earlier evidence. Subsequent `direct-auth-qa-resume` verification used the user-started demo Auth service and real local Firestore Rules: A login/logout, normal-time first wave and return, reload, A→B→A account separation, and two cross-account reads denied with HTTP403. A kept 11 souls, unallocated XP10 and one run; B stayed at zero with distinct cosmetics. Product/UI/Rules bytes are unchanged here, so that evidence remains applicable. The user Auth process was left running. Initial model/module loading delay remains unresolved; this does not establish production login or cutover readiness.

Current validation: 12 new file/inventory groups, existing transfer26, journal/CLI6 and real pinned Firestore-emulator6. The emulator uses synthetic identities and is separate from the real local Auth UI evidence. Full regression and exact per-file results are in `direct-cutover-final-evidence`; the four historical failures remain explicitly recorded. No runtime settings, security Rules or game/reward behavior changes are included.

## What is implemented

- Recursive inventory, including subcollections whose parent document is missing, all pages, explicit collection counts, bounded calls/depth/documents, and one server `readTime` for the entire snapshot. Duplicate documents/pages, foreign names, malformed responses and unknown legacy collections stop the operation.
- Existing converters still validate account saves, inventory/chest identities, sequences, references, catalogs, and active runs. Pending investment receipts and unfinished hard reward receipts also block an import. Client/device journals cannot be discovered by a server export: zero pending journals and stopped/exclusive writers are **operator attestations**, not something these tools prove.
- Rebuilt, content-hashed plans preserve source backups. Every create uses `exists:false`; every changed/deleted document uses the observed `updateTime`. Unknown or concurrently changed data is never silently replaced. Typed references are relocated, arbitrary strings are not rewritten.
- Import data stops before activation. Activation is a separate command, requires complete exact data, a reviewed matching data hash and explicit Auth/Rules/origin/fence confirmations, and uses one atomic commit for at most 400 accounts. More accounts require a reviewed global gate; this tool refuses partial activation.
- Durable intent-before-write journal, hash chain, `fsync`, exclusive local lock, readback after every commit, no blind retry after response loss. Unconfirmed/mixed results or inaccessible readback stop execution. Resume uses the same immutable job and current inventory. A stale `.lock` is not automatically stolen/deleted.
- Rollback preserves the direct typed archive and current saves. All direct writers/accounts must be fenced first. Legacy drift, unresolved runs and unsupported ID collisions stop. Explicit one-to-one mapping is supported only for the previously reviewed subset: **new, finalized currency/hero mail**, not item mail, opaque receipt seeds or arbitrary numeric IDs. No automatic renumbering.

The hash is an integrity/diff aid, not a signature or authorization system. A permit/review JSON is an operator confirmation, not IAM or proof that all writers stopped. The real OAuth identity still needs the applicable IAM rights; end-user Firebase ID tokens must not be used as migration-owner credentials. No credential discovery, Firebase CLI, ADC file or login is used by these tools.

## Offline commands (no network)

Run from the candidate root with Node 22. Output paths must not exist. Keep actual exports/plans outside Git in an access-controlled, encrypted backup location; they contain private account data. POSIX file mode `0600` does not establish a Windows ACL.

```text
node direct/transfer/cli.mjs prepare --source legacy-export.json --assurance fence.json --out import-job.json
node direct/transfer/cli.mjs inspect --job import-job.json --inventory inventory.json --stage data --out preflight.json
node direct/transfer/cli.mjs reverse-input --job import-job.json --inventory frozen-direct-and-legacy.json --assurance rollback-fence.json --out reverse-source.json
node direct/review-mapping.mjs --inspect reverse-source.json collision-report.json
node direct/transfer/cli.mjs reverse --job import-job.json --inventory frozen-direct-and-legacy.json --assurance rollback-fence.json --mapping reviewed-mapping.json --out reverse-job.json
```

Omit `--mapping` when there is no collision. Mapping `directHash` and `targetHash` bind the normalized `direct` and `target` objects in `reverse-source.json`; never hand-edit the converter's internal demo names. Existing `reviewed-mail-mapping.mjs` enforces historical occupancy, sequence high-water, distinct destinations and known references. Unsupported collisions must be separately reviewed.

`fence.json` has `writersStopped:true`, `pendingClientJournals:0`, `exclusiveWriterConfirmed:true`, and a nonempty `fenceId`. These values must be based on a real approved cutover procedure, not copied from test fixtures. Browser local/session-storage journals on old origins, offline devices, in-flight Worker requests, active runs, partially delivered mail and administrators require reconciliation before that assertion is true.

## Future real execution — separate approval required

The CLI supports the following commands, but they are **not authorized by local preparation and have not been run on the live project**:

```text
node direct/transfer/cli.mjs export --network --permit export-permit.json --assurance fence.json --out legacy-export.json
node direct/transfer/cli.mjs export --network --stage inventory --permit export-permit.json --assurance fence.json --out inventory.json
node direct/transfer/cli.mjs apply --network --job import-job.json --stage data --permit inspect-permit.json --out live-preflight.json
node direct/transfer/cli.mjs apply --network --execute --job import-job.json --stage data --permit data-permit.json --journal data.jsonl --out data-result.json
node direct/transfer/cli.mjs apply --network --execute --job import-job.json --stage activate --review activation-review.json --permit activate-permit.json --journal activate.jsonl --out activation-result.json
node direct/transfer/cli.mjs apply --network --execute --job reverse-job.json --stage reverse --permit reverse-permit.json --journal reverse.jsonl --out reverse-result.json
```

A permit names the exact `project`, `database:"(default)"`, `action` (`export`, `inspect`, `data`, `activate` or `reverse`), nonempty `reviewId`, future `expiresAt`, and `jobHash` for apply. Do not fabricate approval by writing a permit. Supply an already authorized ephemeral access token via stdin, never a command argument, file, report, environment/global config or Git. The tool does not issue it. Network reads also require the explicit `--network` flag and permit; an online dry-run still reads private data and is not the same as offline preparation.

Activation review fields: matching `jobHash`, `dataHash` (the real-project data phase inventory hash), matching `fenceId`, and `rulesVerified`, `authVerified`, `originApproved`, `writersStillStopped`, `pendingJournalsZero` all true. Do not use the synthetic emulator review as live evidence.

Live approval must separately identify:

1. Read/export private collections for this project into a protected backup; retention/access and estimated read cost.
2. Reconcile journals and stop **both** legacy and direct writers, including in-flight requests/admin writes. This tool cannot enforce an external writer fence.
3. Review/deploy the exact generated Rules/index/catalog artifacts, including owner-only access and administrator boundaries; no rule broadening as a workaround.
4. Conditionally write the reviewed data; verify counts, saves/codex/assets, references, sequence/ID mapping and hashes while still disabled.
5. Confirm the selected hosting/origin, Firebase Auth allowed domain, actual login and game tests. Host/URL selection remains undecided; preserve the current Pages URL until explicitly decided.
6. Enable account activation last; then explicitly change the reviewed client activation setting and deploy the chosen client. No automatic fallback to Sites. Test actual save/reconnect and retain rollback material before resuming normal writes.

## Rollback and failure conditions

Before activation, keep legacy writers fenced until partially imported data is reviewed. Data import is non-destructive to the legacy namespace. Do not delete partial direct data or blindly restore the old dump; resume the same job or obtain a reviewed recovery plan.

After direct play, restoring the pre-cutover legacy dump would discard new progress. Freeze direct writers, complete pending journals, disable direct activations through a separately reviewed action, take a fresh complete inventory, build a reverse plan, inspect collisions/mappings and verify all current saves. Run the conditional reverse only while frozen, preserve the direct archive, verify exact reconstruction, then deliberately restore the approved legacy client/writer. This tool does not automatically disable live accounts or restart the old Worker. Unsupported schemas, live drift or unresolved collisions block reversal rather than lose data.

Readback failure after commit means **uncertain**, not failed/no-write. Inspect the same job and journal before retrying. A local journal lock can remain after process death; verify the original process/outcome before an authorized manual recovery. Do not start a second job or remove a lock to get around it.

## Tests and known limits

`tests/direct-transfer.test.mjs` covers pure/mocked HTTP boundaries; `direct/transfer/io-test.mjs` covers local journal/CLI; `direct/transfer/emulator-test.mjs` exercises the real local Firestore adapter. The isolated game scenarios use actual Account/HG/settlement modules with synthetic Auth/DOM and time-aged runs. They are not real Auth login, graphical gameplay or normal-time battles.

The Firestore emulator used here is **1.22.0**, verified against the cached firebase-tools 15.34.2 download metadata and the JAR SHA256 `9b6498b7f62714d67f48f59b3818883cd682dbcd46b9f59511de81c97bb5166c`. The original HTTP 400 was narrowed to its REST GET timestamp transcoding: a valid server-returned `2026-11-11T08:14:07.472157Z` (1794384847 seconds, 472157000 nanos) fails as `?readTime=<RFC3339>`, including 0/3/6/9-digit and explicit UTC-offset variants. The same instant works through gRPC ListDocuments, REST POST JSON batchGet/listCollectionIds, and REST GET structured `readTime.seconds`/`readTime.nanos`. After a subsequent document update/new collection, these successful requests return the old document and exclude the new collection; a current read returns the changed value. Thus snapshot support exists; the generic epoch error does not mean the actual timestamp was pre-epoch. Full router/converter bytecode inspection was not completed because javap encountered an OS AccessDeniedException; the diagnosis rests on the paired public-protocol requests.

The adapter uses exact seconds/nanos query fields **only for the literal demo loopback endpoint**. Production still sends the documented RFC3339 string. It validates calendar dates and microsecond alignment without rounding, and has no fallback to a current read. The six real-emulator transfer checks now use this strict pinned adapter, including missing parents, conditional writes, response-loss reconciliation, separate activation and reversal. Production IAM/REST compatibility is still unexecuted, not inferred from local success.

The executor reuses a complete post-commit inventory as the next batch's preflight. Every invocation still reads afresh; every commit still receives complete pinned readback; all conditional preconditions and unrelated-drift checks remain. It does not skip unknown collections or leaf subcollection discovery. An exclusive external writer fence is still required and is not established by these tools. Snapshot validity/budget errors stop rather than weaken consistency.

On the identical synthetic two-account/20-source-document fixture (same job, batch size 200 and lost-response injection), one export takes 31 HTTP calls. A single import of 239 new documents in two commits fell from **1,089 to 561** calls; separate activation from **884 to 589**; the entire repeated export/import/retry/activation/reverse test sequence from **4,955 to 3,837** (19 to 15 full snapshots). Write attempts are unchanged (265 across that whole fixture, including setup/freeze); result hashes are identical. The earlier 5,526 result was another cumulative test sequence with an extra CAS probe and an unpinned local inventory, so it is not the direct comparison baseline. Most remaining calls discover child collections, including empty leaf results. Removing them would stop proving inventory completeness. HTTP counts, returned-document counts and document write attempts are distinct metrics, not a Firestore bill or a per-player cost. Single-run wall time includes warmup and local scheduling, and is not a production latency claim.

Final Node regression: **128/132 files pass**, with the same preserved baseline failures (`awaken`, `growth`, `hard`, `hard2`). Transfer boundaries: 26 groups; local journal/CLI: 5; strict pinned emulator transfer: 6; actual Account/HG hard and normal-challenge recovery: 2. The latter use synthetic Auth/DOM and time-aged runs, not actual login or played battles. This is developer verification, not independent acceptance.

The existing Auth CLI EPERM on `<user-profile>/.config/configstore/firebase-tools.json` was neither retried nor bypassed. A presence-only request to the previously known local Auth endpoint (127.0.0.1:9199) timed out; no already-authorized functioning Auth service was verified. No alternate Auth config, new credentials or account creation was used. A person must restore the normal permission/environment for that existing setup or provide an independently authorized running demo Auth service before real authentication QA can proceed.

A fresh local guest UI session at 127.0.0.1:10632 rendered WebGL, entered town and ordinary stage 1-1, completed its first wave at core 30/30, and saved 11 souls/11 kills/1 run. Return remained on model loading; a single explicit reload recovered town and the existing reward popup with those values unchanged. The loading stall is not diagnosed as a product regression. This verifies local guest persistence only, not authenticated Firestore, hard unlocks or a complete stage. The local QA server blocked external connections, and its initial blob restriction was corrected before the game run; that fixture error is separate from the later return delay. Actual Auth, live IAM/REST/Rules/data, production cardinality, hosting/domain and URL readiness remain unverified.

Client RNG/combat claims retain the already documented serverless trust limitation. This tool does not add a trusted reward server or change normal/hard quantities, probabilities or first-clear guarantees. Full inventories and readback after every batch are deliberately conservative and potentially expensive; report emulator HTTP counts separately from real billing/performance. Snapshot expiry or budget limits stop without returning a misleading complete export.

REST contracts: [ListDocuments](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/list), [ListCollectionIds](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/listCollectionIds), [atomic Commit](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/commit), [write preconditions](https://firebase.google.com/docs/firestore/reference/rest/v1/Precondition). These contracts are not evidence that this candidate has run against production.
