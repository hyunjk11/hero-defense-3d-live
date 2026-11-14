import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(root,'cloud-functions/game'),seen=new Map();
function visit(relative) {
  relative=relative.replaceAll('\\','/');if(seen.has(relative))return;
  if(!relative.startsWith('server/')&&!relative.startsWith('src/'))throw new Error('Unexpected dependency '+relative);
  const source=path.resolve(root,relative);if(!source.startsWith(root+path.sep))throw new Error('Outside source');
  const bytes=fs.readFileSync(source),text=bytes.toString('utf8');
  seen.set(relative,crypto.createHash('sha256').update(bytes).digest('hex'));
  const refs=[...text.matchAll(/(?:^|[;\r\n])\s*(?:import|export)\s+(?:[^'";\r\n]+?\s+from\s*)?['"]([^'"]+)['"]/g)].map(m=>m[1]);
  refs.push(...[...text.matchAll(/\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g)].map(m=>m[1]));
  for(const spec of refs){if(!spec.startsWith('.'))throw new Error('Unexpected external dependency '+spec);visit(path.relative(root,path.resolve(path.dirname(source),spec)));}
}
visit('server/live.mjs');
// Reject stale extras instead of silently including unrelated source in deployment.
if(fs.existsSync(destination)) for(const item of fs.readdirSync(destination,{recursive:true,withFileTypes:true})){
  if(item.isFile()){
    const full=path.join(item.parentPath,item.name),rel=path.relative(destination,full).replaceAll('\\','/');
    if(!seen.has(rel))throw new Error('Unexpected staged file '+rel);
  }
}
for(const relative of seen.keys()){
  const out=path.join(destination,relative);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(path.join(root,relative),out);
}
fs.writeFileSync(path.join(root,'cloud-functions/game-manifest.json'),JSON.stringify(Object.fromEntries([...seen].sort()),null,2)+'\n');
console.log(JSON.stringify({modules:seen.size,destination}));
