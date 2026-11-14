import * as THREE from 'three';

// Procedural, self-owned geometry/materials; no texture downloads or random calls.
// Repeated details share instanced draws within each independently animated part.
function batchDetails(parent) {
  const groups=[];
  for(const child of [...parent.children])if(child.isMesh){let g=groups.find(g=>g.geo===child.geometry&&g.mat===child.material);if(!g)groups.push(g={geo:child.geometry,mat:child.material,items:[]});g.items.push(child);}
  for(const g of groups)if(g.items.length>1){const mesh=new THREE.InstancedMesh(g.geo,g.mat,g.items.length);g.items.forEach((m,i)=>{m.updateMatrix();mesh.setMatrixAt(i,m.matrix);parent.remove(m);});mesh.instanceMatrix.needsUpdate=true;parent.add(mesh);}
}
export function createCatSpirit() {
  const root=new THREE.Group();root.name='cat-spirit';
  const body=new THREE.Group();root.add(body);
  const sphere=new THREE.SphereGeometry(1,16,12),ear=new THREE.ConeGeometry(1,1,3);
  // Self-lit cool fur with strong dark features stays legible against bright terrain.
  const material=(c)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.98});
  const fur=material(0x86dfff),cream=material(0xf9fff0),ink=material(0x102c4c),pink=material(0xff91ad),blue=material(0x247ea8),gold=material(0xffd46b);
  const outline=new THREE.MeshBasicMaterial({color:0x163f67,side:THREE.BackSide,transparent:true,opacity:.92,depthWrite:false});
  const add=(parent,geo,mat,p,s)=>{const m=new THREE.Mesh(geo,mat);m.position.set(...p);m.scale.set(...s);parent.add(m);return m;};
  add(body,sphere,fur,[0,0,0],[.52,.46,.85]);
  add(body,sphere,outline,[0,0,0],[.555,.495,.885]);
  add(body,sphere,cream,[0,-.18,.22],[.43,.3,.6]);
  const head=new THREE.Group();head.position.set(0,.35,.72);body.add(head);
  add(head,sphere,fur,[0,0,0],[.59,.53,.48]);
  add(head,sphere,outline,[0,0,0],[.62,.56,.51]);
  for(const side of [-1,1]) {
    const m=add(head,ear,fur,[side*.39,.49,-.02],[.28,.53,.22]);m.rotation.y=Math.PI;
    const inner=add(head,ear,pink,[side*.39,.49,.12],[.15,.32,.045]);inner.rotation.y=Math.PI;
    add(head,sphere,cream,[side*.19,-.13,.39],[.25,.19,.13]);
    add(head,sphere,ink,[side*.24,.09,.417],[.12,.18,.06]);
    add(head,sphere,cream,[side*.26,.15,.462],[.035,.045,.02]);
    for(let i=0;i<2;i++) {const whisker=add(head,sphere,ink,[side*.54,-.12-i*.1,.32],[.23,.018,.018]);whisker.rotation.z=side*(i?.16:-.13);}
    add(body,sphere,blue,[side*.42,.2,-.18],[.08,.24,.33]).rotation.z=side*-.4;
  }
  add(head,sphere,pink,[0,-.08,.52],[.095,.06,.05]);
  add(head,sphere,ink,[0,-.22,.5],[.055,.018,.018]);
  for(const x of [-.18,0,.18])add(head,sphere,blue,[x,.36,.26],[.055,.13,.06]).rotation.z=-x;
  const collar=add(body,new THREE.TorusGeometry(.43,.055,6,24),gold,[0,.08,.49],[1,1,1]);collar.rotation.x=.25;
  add(body,sphere,gold,[0,-.3,.62],[.12,.14,.07]);
  const legs=[];
  for(const z of [.52,-.58])for(const x of [-.37,.37]) {
    const pivot=new THREE.Group();pivot.position.set(x,-.21,z);body.add(pivot);
    add(pivot,sphere,cream,[0,-.14,.04],[.18,.25,.22]);
    add(pivot,sphere,cream,[0,-.3,.13],[.2,.13,.26]);legs.push(pivot);
  }
  const tail=new THREE.Group();tail.position.set(0,.1,-.67);body.add(tail);
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.12,.25,-.45),new THREE.Vector3(.42,.65,-.9),new THREE.Vector3(.56,1,-.72)]);
  add(tail,new THREE.TubeGeometry(curve,16,.13,7,false),fur,[0,0,0],[1,1,1]);
  add(tail,sphere,blue,[.56,1,-.72],[.14,.16,.14]);
  const clawGeo=new THREE.TorusGeometry(.65,.055,5,20,1.6),clawMat=new THREE.MeshBasicMaterial({color:0xe9feff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const claws=new THREE.Group();claws.position.set(0,.25,1.2);body.add(claws);
  for(let i=0;i<3;i++){const m=add(claws,clawGeo,clawMat,[(i-1)*.2,0,0],[1,1,1]);m.rotation.z=-.6;}
  const wake=new THREE.Group();root.add(wake);
  const wakeMat=new THREE.MeshBasicMaterial({color:0x27b7ee,transparent:true,opacity:.65,depthWrite:false,toneMapped:false});
  for(const side of [-1,1]){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*.48,.1,.1),new THREE.Vector3(side*.7,.12,-.6),new THREE.Vector3(side*.56,.35,-1.3),new THREE.Vector3(side*.24,.22,-1.95)]);add(wake,new THREE.TubeGeometry(curve,12,.06,5,false),wakeMat,[0,0,0],[1,1,1]);}
  for(const part of [body,head,tail,claws,...legs])batchDetails(part);
  root.userData.cat={body,head,tail,legs,claws,clawMat,wake,wakeMat,materials:[fur,cream,ink,pink,blue,gold,outline]};return root;
}
export function animateCatSpirit(root,time,attack=0,fade=1) {
  const {body,head,tail,legs,claws,clawMat,wake,wakeMat,materials}=root.userData.cat;
  body.position.y=Math.sin(time*15)*.09;body.rotation.x=Math.sin(time*15)*.06;
  body.rotation.z=-attack*.18;
  head.rotation.x=-.12+attack*.16;tail.rotation.y=Math.sin(time*9)*.3;tail.rotation.z=Math.sin(time*7)*.12;
  legs.forEach((p,i)=>p.rotation.x=Math.sin(time*15+(i===0||i===3?0:Math.PI))*.65-(i<2?attack*1.1:0));
  claws.visible=attack>0;claws.rotation.z=-attack*.65;clawMat.opacity=attack*.85*fade;
  wake.rotation.z=Math.sin(time*11)*.08;wake.scale.z=1-attack*.24;wakeMat.opacity=(.6+attack*.2)*fade;
  for(const material of materials)material.opacity=.98*fade;
}
