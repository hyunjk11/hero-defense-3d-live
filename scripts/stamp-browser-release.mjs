// Keep the complete browser module graph on one versioned cache namespace.
// Changing only main.js's URL does not version its relative imports.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export function releaseMap(root){
 const files=[];
 const walk=dir=>{for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())walk(p);else if(p.endsWith('.js'))files.push(p);}};
 walk('src');files.sort();const hash=createHash('sha256');
 for(const p of ['style.css',...files])hash.update(p+'\0').update(fs.readFileSync(path.join(root,p))).update('\0');
 const version=hash.digest('hex').slice(0,16),imports={three:'./lib/three.module.js','three/addons/':'./lib/addons/'};
 for(const p of files)imports['./'+p]='./'+p+'?v='+version;
 return {version,imports,files};
}
export function stamp(root){
 const {version,imports,files}=releaseMap(root),p=path.join(root,'index.html');let html=fs.readFileSync(p,'utf8');
 html=html.replace(/href="style\.css(?:\?v=[^"]*)?"/,`href="style.css?v=${version}"`);
 html=html.replace(/<script type="importmap">[^<]*<\/script>/,`<script type="importmap">${JSON.stringify({imports})}</script>`);
 for(const name of ['practice-storage','analytics'])html=html.replace(new RegExp('src="\\./src/'+name+'\\.js(?:\\?v=[^"]*)?"'),`src="./src/${name}.js?v=${version}"`);
 fs.writeFileSync(p,html);return {version,modules:files.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(stamp(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'))));
