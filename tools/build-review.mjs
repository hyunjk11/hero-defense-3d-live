// Offline static review packaging only. No upload, activation, Firebase or Git calls.
import {readFile,readdir,mkdir,writeFile,copyFile,lstat} from 'node:fs/promises';
import {resolve,relative,dirname,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const root=fileURLToPath(new URL('../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const local=p=>relative(root,p).split(sep).join('/');
// Read module declarations without treating vendor documentation/strings as imports.
export function moduleSpecifiers(text){
 const tokens=[];let i=0;
 while(i<text.length){
  const c=text[i];
  if(/\s/.test(c)){i++;continue;}
  if(text.startsWith('//',i)){i=text.indexOf('\n',i+2);if(i<0)break;continue;}
  if(text.startsWith('/*',i)){const end=text.indexOf('*/',i+2);if(end<0)throw Error('Unclosed comment');i=end+2;continue;}
  if(c==='"'||c==="'"||c==='`'){
   const quote=c;let value='';i++;
   while(i<text.length&&text[i]!==quote){if(text[i]==='\\'){value+=text.slice(i,i+2);i+=2;}else value+=text[i++];}
   i++;tokens.push({kind:quote==='`'?'template':'string',value});continue;
  }
  if(/[A-Za-z_$]/.test(c)){let end=i+1;while(end<text.length&&/[A-Za-z0-9_$]/.test(text[end]))end++;tokens.push({kind:'word',value:text.slice(i,end)});i=end;continue;}
  tokens.push({kind:'punctuation',value:c});i++;
 }
 const found=[];
 for(let j=0;j<tokens.length;j++){
  const t=tokens[j];if(t.kind!=='word'||!['import','export'].includes(t.value)||tokens[j-1]?.value==='.')continue;
  const next=tokens[j+1];
  if(t.value==='import'&&next?.kind==='string'){found.push(next.value);continue;}
  if(t.value==='import'&&next?.value==='('){if(tokens[j+2]?.kind==='string')found.push(tokens[j+2].value);else throw Error('Nonliteral dynamic import requires explicit review');continue;}
  if(t.value==='import'&&next?.value==='.')continue;
  if(t.value==='export'&&!['*','{'].includes(next?.value))continue;
  for(let k=j+1;k<tokens.length&&tokens[k].value!==';';k++){
   if(tokens[k].kind==='word'&&tokens[k].value==='from'&&tokens[k+1]?.kind==='string'){found.push(tokens[k+1].value);break;}
  }
 }
 return [...new Set(found)];
}
export async function buildReview(output){
 if(!output)throw Error('Usage: node tools/build-review.mjs NEW-directory');
 const out=resolve(output),rel=relative(root,out);
 if(out===resolve(root)||!rel.startsWith('..')&& !['review-dist','dist'].some(n=>rel===n||rel.startsWith(n+sep)))throw Error('Use a new external directory or review-dist; never overwrite source');
 const config=await readFile(join(root,'src/config/cloud.js'),'utf8');
 if(!config.includes("storageMode: 'firestore-direct'")||!config.includes("directActivation: 'pending-rules-and-data'")||!config.includes("storagePrefix: 'hd3d_live'")||/apiUrl\s*:/.test(config))throw Error('This review builder requires the unchanged pending fresh profile');
 const files=new Set(['index.html','style.css','.nojekyll']);
 async function walk(path){for(const ent of await readdir(join(root,path),{withFileTypes:true})){const n=path+'/'+ent.name;if(ent.isSymbolicLink())throw Error('Symlink not allowed: '+n);if(ent.isDirectory())await walk(n);else if(ent.isFile())files.add(n);}}
 for(const n of ['src','lib','models','audio'])await walk(n);
 const imports=JSON.parse((await readFile(join(root,'index.html'),'utf8')).match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
 const scanned=new Set(),edges=[];
 for(const n of files){
  if(!/\.(?:m?js)$/.test(n)||scanned.has(n))continue;scanned.add(n);
  const text=await readFile(join(root,n),'utf8');
  for(const spec of moduleSpecifiers(text)){
   let dest;
   if(spec.startsWith('.'))dest=resolve(root,dirname(n),spec);
   else if(imports[spec])dest=resolve(root,imports[spec]);
   else {const prefix=Object.keys(imports).find(k=>k.endsWith('/')&&spec.startsWith(k));if(prefix)dest=resolve(root,imports[prefix]+spec.slice(prefix.length));else throw Error('Unsupported nonlocal module '+spec+' in '+n);}
   const d=local(dest);if(d.startsWith('../')||d.startsWith('/'))throw Error('Escaping module '+d);
   if(!(await lstat(dest)).isFile())throw Error('Missing module '+d);
   if(!files.has(d)){if(!d.startsWith('server/')||!/\.mjs$/.test(d))throw Error('Unexpected runtime dependency '+d);files.add(d);}
   edges.push({from:n,to:d});
  }
 }
 for(const denied of ['server/http.mjs','server/memory-store.mjs','server/backend.test.mjs'])if(files.has(denied))throw Error('Unexpected server/test entry in browser graph: '+denied);
 await mkdir(out); // fails on existing directory, even if empty
 const manifest={format:'hd3d-static-review-v1',productionReady:false,activation:'pending-rules-and-data',sourceFiles:{},moduleEdges:edges};
 for(const n of [...files].sort()){
  const source=join(root,n),target=join(out,n),b=await readFile(source);await mkdir(dirname(target),{recursive:true});await copyFile(source,target);manifest.sourceFiles[n]={sha256:hash(b),bytes:b.length};
 }
 await writeFile(join(out,'_review-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return {output:out,files:files.size,bytes:Object.values(manifest.sourceFiles).reduce((n,v)=>n+v.bytes,0),productionReady:false,network:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==3)throw Error('Usage: node tools/build-review.mjs NEW-directory');
 console.log(JSON.stringify(await buildReview(process.argv[2]),null,2));
}
