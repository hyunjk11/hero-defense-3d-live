import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {gameApi} from '../cloud-functions/index.mjs';
test('real Firebase Functions v2 export has expected resource and public transport metadata',()=>{
  assert.equal(typeof gameApi,'function');
  assert.equal(gameApi.__endpoint.platform,'gcfv2');
  assert.deepEqual(gameApi.__endpoint.region,['asia-northeast3']);
  assert.deepEqual(gameApi.__endpoint.httpsTrigger.invoker,['public']);
  assert.equal(gameApi.__endpoint.minInstances,0);assert.equal(gameApi.__endpoint.maxInstances,1);
  assert.equal(gameApi.__endpoint.serviceAccountEmail.name,'HD3D_RUNTIME_SERVICE_ACCOUNT');
  assert.equal(gameApi.__endpoint.serviceAccountEmail.options.default,undefined);
  assert.equal(gameApi.__endpoint.serviceAccountEmail.value(),process.env.HD3D_RUNTIME_SERVICE_ACCOUNT);
});
test('real Functions export remains gated before verified deployment without runtime credential access',async()=>{
  for(const [method,status] of [['OPTIONS',503],['POST',503]]){
    const req=Object.assign(new EventEmitter(),{method,headers:{origin:'https://legacy.example.invalid','content-type':'application/json'},rawBody:Buffer.from('{}')});
    const res=Object.assign(new EventEmitter(),{headers:{},statusCode:200,ends:0,
      status(s){this.statusCode=s;return this;},set(o){Object.assign(this.headers,o);return this;},setHeader(k,v){this.headers[k]=v;},
      end(b){this.body=b?.toString();this.ends++;this.writableFinished=this.writableEnded=true;this.emit('finish');return this;},send(b){return this.end(b);}});
    await gameApi(req,res);assert.equal(res.statusCode,status);assert.equal(res.ends,1);
  }
});
