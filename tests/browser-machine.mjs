import * as THREE from 'three';
import { MACHINE_ENEMIES } from '../src/data/chapters/machine.js';
import { makeMachineEnemy } from '../src/render/machine-monsters.js';
import { renderer } from '../src/render/scene.js';
import { disposeOwned } from '../src/render/toon.js';
function guard(){if(location.hostname!=='127.0.0.1'||location.port!=='8784'||!location.search.includes('test=1')||G.gear.Acc.A.mode!=='guest'||G.gear.Acc.A.user)throw Error('Disposable guest only');G.manual=true;G.Snd.cfg.bgmOn=G.Snd.cfg.sfxOn=false;G.Snd.apply();}
export function gallery(){
 guard();G.pauseRender=true;for(const el of [...document.body.children])if(el.tagName!=='SCRIPT')el.style.display='none';
 const wrap=document.createElement('div');wrap.style.cssText='position:fixed;inset:0;background:#242735;color:#f4e0b8;font-family:Malgun Gothic,sans-serif';document.body.append(wrap);
 renderer.setPixelRatio(1.5);renderer.setSize(innerWidth,innerHeight);wrap.append(renderer.domElement);
 const label=(text,x,y,size)=>{const d=document.createElement('div');d.textContent=text;d.style.cssText=`position:absolute;left:${x}px;top:${y}px;font-size:${size}px;font-weight:bold`;wrap.append(d);};
 label('8장 · 기계 요새',24,12,24);const W=innerWidth/4,H=(innerHeight-58)/2;renderer.setScissorTest(true);
 Object.entries(MACHINE_ENEMIES).forEach(([type,E],i)=>{const row=Math.floor(i/4),col=i%4,s=new THREE.Scene();s.background=new THREE.Color(row?0x28313b:0x303b45);s.add(new THREE.HemisphereLight(0xf1f5ff,0x737281,2));const sun=new THREE.DirectionalLight(0xffe3a4,3);sun.position.set(-4,8,5);s.add(sun);const m=makeMachineEnemy(E);m.inner.position.y=0;m.g.rotation.y=.45;s.add(m.g);const b=new THREE.Box3().setFromObject(m.g),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());const cam=new THREE.PerspectiveCamera(34,W/H,.1,100);const distance=Math.max(size.y,size.x*H/W,size.z)*2.05;cam.position.copy(center).add(new THREE.Vector3(.28,.25,1).multiplyScalar(distance));cam.lookAt(center);const y=innerHeight-58-(row+1)*H;renderer.setViewport(col*W,y,W,H);renderer.setScissor(col*W,y,W,H);renderer.render(s,cam);label(E.n,col*W+18,61+row*H,17);});renderer.setScissorTest(false);return{models:8,muted:true};
}
export async function gearGallery(){
 guard();const C=await import('../src/render/characters.js'),CG=await import('../src/render/chapter-gear.js'),E=await import('../src/account/equip.js');
 const heroes=['archer','mage','warrior','gunner','fighter'];await C.ensureModels(heroes.flatMap(h=>C.heroAssets(h)));
 G.pauseRender=true;for(const el of [...document.body.children])if(el.tagName!=='SCRIPT')el.style.display='none';
 const wrap=document.createElement('div');wrap.style.cssText='position:fixed;inset:0;background:#252c38;color:#f2dca2;font-family:Malgun Gothic,sans-serif';document.body.append(wrap);renderer.setPixelRatio(1.5);renderer.setSize(innerWidth,innerHeight);wrap.append(renderer.domElement);const title=document.createElement('h2');title.textContent='동력 공학자 · 영웅별 착용 외형';title.style.cssText='position:absolute;top:0;left:22px';wrap.append(title);
 const results=[],W=innerWidth/5,H=innerHeight-60;renderer.setScissorTest(true);
 for(const[h,index]of heroes.map((h,i)=>[h,i])){
  const ch=C.makeHeroModel(h),items=E.SLOT_KEYS.map(slot=>E.makeItem(slot,h,4,()=>.4,8));C.play(ch,'Idle');ch.mixer.update(.4);CG.updateChapterGear(ch,items);const nodes=ch.machineGearNodes.length; if(nodes<(h==='gunner'||h==='fighter'?6:5))throw Error(h+' missing attachment');
  const first=[...ch.machineGearNodes];CG.updateChapterGear(ch,items);if(ch.machineGearNodes.some((p,i)=>p!==first[i]))throw Error('needless rebuild');CG.updateChapterGear(ch,[{...items[0],c:5},items[1],items[2]]);if(ch.swampGearNodes.length<1)throw Error('mixed set missing');CG.updateChapterGear(ch,[]);if(first.some(p=>p.parent)||ch.mats.some(m=>m.userData.machineGear||m.userData.swampGear))throw Error('unequip leaked');CG.updateChapterGear(ch,items);
  ch.g.updateMatrixWorld(true);const tips=ch.machineGearNodes.map(p=>p.getWorldPosition(new THREE.Vector3()).toArray());if(!tips.flat().every(Number.isFinite))throw Error(h+' invalid attachment position');results.push({hero:h,nodes,tips});
  const s=new THREE.Scene();s.background=new THREE.Color(index%2?0x303945:0x28313b);s.add(new THREE.HemisphereLight(0xf0f5ff,0x627080,2));const sun=new THREE.DirectionalLight(0xffe3af,2.7);sun.position.set(-4,8,5);s.add(sun);s.add(ch.g);ch.g.rotation.y=.18;
  const cam=new THREE.PerspectiveCamera(30,W/H,.1,100);cam.position.set(.3,2.2,7);cam.lookAt(0,1.4,0);renderer.setViewport(index*W,0,W,H);renderer.setScissor(index*W,0,W,H);renderer.render(s,cam);
  const label=document.createElement('div');label.textContent=items[0].n;label.style.cssText=`position:absolute;top:70px;left:${index*W+12}px;width:${W-24}px;font-size:15px;text-align:center`;wrap.append(label);
 }
 renderer.setScissorTest(false);return results;
}
