// Express/Functions HTTP -> the existing Fetch API handler. No gameplay state here.
const envelope = (code, message) => ({data:null,error:{code,message}});
export function createHttpBridge(handle) {
  return async (req,res) => {
    const abort = new AbortController();
    const disconnect = () => { if (!res.writableFinished) abort.abort(); };
    req.once('aborted', disconnect);res.once('close', disconnect);
    try {
      if (req.aborted || res.destroyed) { disconnect(); return; }
      const method = req.method || 'GET', headers = new Headers();
      for (const [key,value] of Object.entries(req.headers || {})) {
        if (value !== undefined) headers.set(key,Array.isArray(value)?value.join(', '):String(value));
      }
      // Preserve the original JSON bytes and size checks, including malformed JSON.
      const bodyMethod = !['GET','HEAD'].includes(method) && Buffer.isBuffer(req.rawBody);
      if (method === 'POST' && !Buffer.isBuffer(req.rawBody)) {
        res.status(400).set({'content-type':'application/json; charset=utf-8','cache-control':'no-store'}).send(JSON.stringify(envelope('INVALID_BODY','Request body unavailable')));return;
      }
      const request = new Request('https://game-api.invalid/api/game', {
        method,headers,signal:abort.signal,...(bodyMethod?{body:req.rawBody}:{}),
      });
      const response = await handle(request);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (abort.signal.aborted || res.destroyed || res.writableEnded) return;
      res.status(response.status);
      response.headers.forEach((value,key)=>res.setHeader(key,value));
      res.end(bytes);
    } catch {
      if (!abort.signal.aborted && !res.destroyed && !res.headersSent) {
        res.status(503).set({'content-type':'application/json; charset=utf-8','cache-control':'no-store'}).send(JSON.stringify(envelope('BACKEND_ERROR','서버에 연결할 수 없습니다.')));
      }
    } finally {
      req.removeListener('aborted',disconnect);res.removeListener('close',disconnect);
    }
  };
}
