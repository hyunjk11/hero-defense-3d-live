// Bounded, metadata-only request diagnostics. No headers, identities, paths or payloads.
const PHASES = new Set(['request.body','auth.verify','auth.lookup.headers','auth.lookup.body',
  'oauth.wait','oauth.sign','oauth.token.headers','oauth.token.body','transaction.total',
  'transaction.execute','transaction.retry_wait','metadata.sync', ...['begin','read','query','commit','rollback','other']
    .flatMap(x => ['firestore.'+x+'.headers','firestore.'+x+'.body'])]);
const COUNTERS = new Set(['auth_cache_hit','auth_cache_miss','oauth_cache_hit','oauth_cache_miss',
  'oauth_shared_wait','transaction_attempt','transaction_retry','transaction_commit','transaction_rollback','read_only_transaction']);
const RPCS = new Set(['growth_status','growth_start','growth_progress','growth_invest','my_status',
  'claim_mail','dungeon_status','spire_status']);
const TABLES = new Set(['profiles','progress','owned','orders','mail','notices']);
let sequence = 0;
const ms = n => Math.round(Math.max(0, n) * 10) / 10;
const statusCode = n => Number.isInteger(n) && n >= 100 && n <= 599 ? n : undefined;
export const errorKind = e => e?.name === 'AbortError' ? 'aborted'
  : e?.name === 'TimeoutError' || e?.code === 'DEADLINE_EXCEEDED' || e?.status === 504 ? 'timeout' : 'error';
export const NO_TIMING = Object.freeze({ measure: (_phase, fn) => fn(), count() {}, operation() {}, finish() {} });

export function requestTiming(request, { now = () => performance.now(),
  write = (level, message) => console[level](message),
  schedule = (fn, delay) => setTimeout(fn, delay), cancel = id => clearTimeout(id),
  sampled = (sequence++ % 32) === 0 } = {}) {
  const start = now(), phases = {}, counts = {}, active = new Map();
  // Only the edge's fixed-format, nonidentity trace key is retained; never arbitrary request IDs.
  const ray = request.headers.get('cf-ray')?.match(/^([a-f0-9]{16})(?:-[A-Z]{3})?$/)?.[1];
  const requestId = ray ? 'cf:' + ray : 'local:' + crypto.randomUUID();
  let operation = 'unknown', serial = 0, ended = false, slow = false, failed = false, disconnected = false, timer;
  const emit = (event, outcome, status) => {
    const stamp = now(), pending = [...active.values()].slice(0,16).map(x => ({ phase: x.phase, elapsed_ms: ms(stamp-x.at) }));
    const data = { event: 'hd3d_timing_v1', request_id: requestId, kind: event, operation,
      elapsed_ms: ms(stamp-start), outcome, ...(statusCode(status) ? {status} : {}),
      counts, phases, pending, pending_count: active.size, ...(disconnected ? {client_aborted:true} : {}) };
    // String message survives the Sites log reader's source.message projection.
    try { write(event === 'slow' ? 'warn' : outcome === 'ok' ? 'log' : 'error', JSON.stringify(data)); } catch {} // Observability must not affect saving.
  };
  // A disconnect is not proof of commit failure. Keep the final cleanup/commit
  // outcome observable if the runtime lets the handler finish.
  const abort = () => { if (ended || disconnected) return; disconnected = true; cancel(timer); emit('disconnect', 'aborted'); };
  const finish = (outcome = 'ok', status) => {
    if (ended) return; ended = true;
    cancel(timer); request.signal?.removeEventListener('abort', abort);
    if (sampled || slow || failed || disconnected || outcome !== 'ok') emit('end', outcome, status);
  };
  timer = schedule(() => { if (!ended) { slow = true; emit('slow', 'pending'); } }, 5000);
  request.signal?.addEventListener('abort', abort, {once:true});
  if (request.signal?.aborted) abort();
  return {
    operation(op) {
      if (op?.kind === 'query') {
        const table = typeof op.table === 'string' && TABLES.has(op.table.slice(5)) && op.table.startsWith('hd3d_') ? op.table.slice(5) : 'other';
        operation = 'query.'+table+'.'+(['select','insert','update','upsert'].includes(op.action) ? op.action : 'other');
      } else if (op?.kind === 'rpc') operation = RPCS.has(String(op.name).replace(/^hd3d_/,'')) ? op.name.replace(/^hd3d_/,'') : 'rpc.other';
      else operation = 'other';
    },
    count(name) { if (COUNTERS.has(name)) counts[name] = (counts[name] || 0) + 1; },
    async measure(label, fn) {
      const phase = PHASES.has(label) ? label : 'other', at = now(), id = ++serial;
      active.set(id, {phase, at});
      let outcome = 'ok', status;
      try { const value = await fn(); status = statusCode(value?.status); return value; }
      catch (e) { outcome = errorKind(e); status = statusCode(e?.status); failed = true; throw e; }
      finally {
        active.delete(id);
        const dt = ms(now()-at), row = phases[phase] ||= {n:0, ms:0, max_ms:0, failures:0};
        row.n++; row.ms = ms(row.ms+dt); row.max_ms = Math.max(row.max_ms,dt);
        if (outcome !== 'ok') { row.failures++; row.last_failure = outcome; }
        if (status) row.last_status = status;
      }
    },
    finish,
  };
}

export async function timedJson(timing, phase, url, options) {
  const response = await timing.measure(phase+'.headers', () => fetch(url, options));
  const body = await timing.measure(phase+'.body', () => response.json());
  return {response, body};
}

export function firestorePhase(path) {
  const suffix = String(path).slice(String(path).lastIndexOf(':')+1);
  return 'firestore.'+({beginTransaction:'begin',batchGet:'read',runQuery:'query',commit:'commit',rollback:'rollback'}[suffix] || 'other');
}
