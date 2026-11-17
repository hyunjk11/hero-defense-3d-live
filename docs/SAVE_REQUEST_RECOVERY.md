# Bounded request recovery

The Functions/HTTP transport bounds token acquisition, response headers and JSON
body consumption to 30 seconds per dispatched request. It aborts the client
request and returns `REQUEST_TIMEOUT` with `uncertain: true`. This does **not**
mean a server write failed or was rolled back. It does not change server timeouts.

There is no transport replay. Existing account CAS and durable gear/mail/growth
receipts remain responsible for recovery. Queued writes captured before a write
timeout are rejected without dispatch; callers retain their journal/dirty input.
New reads remain available for reconciliation. A late token cannot launch a
request, and a late response cannot replace the already returned unknown result.
Normal requests keep FIFO order; per-account/session checks remain in place.
The archived direct-Firestore transport retains its separate transaction lifecycle.

`tests/functions-timeout.test.mjs` covers hanging fetch/body/token, queued-write
fencing, normal order, account changes, late responses, repeated gear clicks, and
real account+gear reconciliation against the in-memory Firestore transport. A
batch committed before response loss is recovered with the same receipt and pays
once. An aborted uncommitted batch retains its journal and can later complete.
These tests use no live account, credentials, or production network.
