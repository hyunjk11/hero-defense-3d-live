import * as THREE from 'three';

const MAX_PER_SIG = 4, LIFE = .44;
const BEAM_UP = new THREE.Vector3(0,1,0);
const clamp = n => Math.max(0,Math.min(1,n));
const patch = (color,opacity=1) => new THREE.MeshBasicMaterial({
  color,opacity,depthWrite:false,transparent:true,toneMapped:false,
});
const TIGER = [
  [0xe6f6ff,[
    [0,.19,-.31,.55,.46,1.22],[0,.31,.43,.58,.54,.61],[0,.54,.97,.46,.47,.51],
    [-.31,.88,1.0,.16,.21,.14],[.31,.88,1.0,.16,.21,.14],
    [-.34,-.09,.67,.19,.19,.53],[.34,-.09,.67,.19,.19,.53],
    [-.35,-.31,1.12,.19,.16,.34],[.35,-.31,1.12,.19,.16,.34],
    [-.35,-.05,-.85,.22,.22,.47],[.35,-.05,-.85,.22,.22,.47],
    [-.30,-.23,-1.1,.18,.17,.30],[.30,-.23,-1.1,.18,.17,.30],
    [.03,.16,-1.48,.16,.15,.25],[.16,.22,-1.73,.14,.13,.24],[.30,.30,-1.92,.13,.12,.22],
    [.42,.39,-2.09,.125,.12,.18]
  ]],
  [0x15779f,[
    [0,.62,-.82,.39,.11,.13,.23],[0,.68,-.40,.44,.11,.105,.23],
    [0,.65,-.01,.48,.13,.13,-.25],[0,.80,.46,.36,.11,.12,-.25],
    [-.46,.37,-.75,.11,.12,.20,-.4],[.46,.37,-.75,.11,.12,.20,.4],
    [-.47,.29,-.25,.12,.12,.25,-.4],[.47,.29,-.25,.12,.12,.25,.4],
    [-.50,.45,.35,.115,.16,.20,.25],[.50,.45,.35,.115,.16,.20,-.25],
    [-.35,.72,1.12,.10,.11,.16],[.35,.72,1.12,.10,.11,.16],
    [-.43,.40,1.02,.08,.065,.19],[.43,.40,1.02,.08,.065,.19],
    [0,.95,1.03,.09,.043,.22],[.49,.47,-2.19,.13,.10,.12]
  ]],
  [0x174254,[
    [-.22,.65,1.36,.14,.09,.082],[.22,.65,1.36,.14,.09,.082],
    [0,.51,1.49,.11,.08,.07],[0,.36,1.35,.23,.12,.17],
    [-.29,.90,1.113,.095,.13,.05],[.29,.90,1.113,.095,.13,.05],
  ]],
  [0xffffff,[
    [-.16,.48,1.37,.16,.13,.16],[.16,.48,1.37,.16,.13,.16],
    [-.15,.38,1.47,.035,.09,.04],[.15,.38,1.47,.035,.09,.04]
  ]],
  [0x66efff,[
    [-.22,.66,1.426,.072,.042,.039],[.22,.66,1.426,.072,.042,.039]
  ]],
];
const PETAL_VS = `
varying vec2 p;
void main(){
  p=uv*2.-1.;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;
const PETAL_FS = `
varying vec2 p;
uniform float alpha;
float petals(vec2 q,float r,float w,float n,float offset){
  float a=atan(q.y,q.x+.00001)+offset;
  return 1.-smoothstep(r+w*cos(n*a),r+w*cos(n*a)+.024,length(q));
}
void main(){
  float a=petals(p,.76,.18,5.,.32);
  float b=petals(p,.59,.14,5.,.90);
  float c=petals(p,.43,.103,5.,.34);
  float d=petals(p,.27,.075,4.,.87);
  float e=petals(p,.125,.05,3.,.34);
  vec3 ink=mix(vec3(.29,.016,.094),vec3(.95,.13,.45),a);
  ink=mix(ink,vec3(.56,.015,.22),b);
  ink=mix(ink,vec3(1.,.41,.69),c);
  ink=mix(ink,vec3(.78,.04,.34),d);
  ink=mix(ink,vec3(1.,.90,.94),e);
  float outline=petals(p,.794,.18,5.,.32);
  gl_FragColor=vec4(mix(vec3(.42,.015,.16),ink,a),outline*alpha);
}`;

export function createGearEmblems({scene,groundY}) {
  const tigers=[],roses=[];
  const dummy=new THREE.Object3D(), along=new THREE.Vector3();
  let sphere, tracerGeo;
  function tiger(){
    const g=new THREE.Group(); g.name='pc-gear-tiger-spirit';
    sphere ||= new THREE.SphereGeometry(1,10,7);
    const batches=TIGER.map(([color,parts])=>{
      const mesh=new THREE.InstancedMesh(sphere,patch(color),parts.length);
      mesh.frustumCulled=false; mesh.material.depthWrite=true;
      parts.forEach(([x,y,z,sx,sy,sz,rz=0],i)=>{
        dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,0,rz);
        dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      });
      g.add(mesh);return mesh;
    });
    return {g,batches,owner:null};
  }
  function rose(){
    const g=new THREE.Group(); g.name='pc-gear-rose-bloom';
    tracerGeo ||= new THREE.CylinderGeometry(.10,.28,1,7);
    const shot=new THREE.Mesh(tracerGeo,patch(0xff76b2));
    const bud=new THREE.Mesh(sphere ||= new THREE.SphereGeometry(1,10,7),patch(0xffbedb));bud.scale.setScalar(.27);
    // Ground-facing secondary petals plus a center flower that opens upwards.
    const flower=new THREE.Group();
    const mat=new THREE.ShaderMaterial({vertexShader:PETAL_VS,fragmentShader:PETAL_FS,
      side:THREE.DoubleSide,transparent:true,depthWrite:false,depthTest:false,uniforms:{alpha:{value:1}}});
    const disk=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);
    disk.rotation.x=-Math.PI*.37;disk.renderOrder=24; flower.add(disk);
    g.add(shot,bud,flower);return {g,shot,bud,flower,mat,owner:null};
  }
  function get(slots,make){
    let s=slots.find(o=>!o.owner);
    if(!s&&slots.length<MAX_PER_SIG){s=make();slots.push(s);}
    return s;
  }
  function state(owner,kind,h,p){
    const s=kind==='tigerdash'?get(tigers,tiger):kind==='rosebarrage'?get(roses,rose):null;
    if(!s)return;
    const q=h.g.position, dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz);
    const yaw=d>.001?Math.atan2(dx,dz):(h.face||0);
    s.owner=owner;s.x=p.x;s.z=p.z;s.yaw=yaw;s.fx=Math.sin(yaw);s.fz=Math.cos(yaw);s.dist=d;
    s.y=Math.max(groundY(p.x,p.z),p.y);s.fromX=q.x;s.fromY=q.y+1.55;s.fromZ=q.z;
    scene.add(s.g);
    return true;
  }
  function update(owner,time){
    const t=tigers.find(o=>o.owner===owner);
    if(t){
      const p=clamp(time/.31), ease=1-Math.pow(1-p,2);
      const back=1.37 + (1-ease)*Math.min(4.1,Math.max(2,t.dist*.73));
      t.g.position.set(t.x-t.fx*back,t.y+.59+Math.sin(Math.PI*p)*1.86,t.z-t.fz*back);
      t.g.rotation.set(.29*(2*p-1),t.yaw,0,'YXZ');
      t.g.scale.setScalar(.83+.24*ease);
      const a=.98*(1-clamp((time-.28)/(LIFE-.28)));
      for (const batch of t.batches) batch.material.opacity=a;
    }
    const r=roses.find(o=>o.owner===owner);
    if(r){
      const p=clamp(time/.112), tail=clamp(p-.47), y=r.y+.94;
      const x2=r.fromX+(r.x-r.fromX)*p, y2=r.fromY+(y-r.fromY)*p,z2=r.fromZ+(r.z-r.fromZ)*p;
      const x1=r.fromX+(r.x-r.fromX)*tail,y1=r.fromY+(y-r.fromY)*tail,z1=r.fromZ+(r.z-r.fromZ)*tail;
      along.set(x2-x1,y2-y1,z2-z1);
      const len=along.length();
      r.shot.visible=time<.18&&len>.01;r.bud.visible=time<.13;
      r.shot.position.set((x1+x2)/2,(y1+y2)/2,(z1+z2)/2);
      r.shot.scale.set(1,Math.max(.01,len),1);
      if(len>.01) r.shot.quaternion.setFromUnitVectors(BEAM_UP,along.normalize());
      r.shot.material.opacity=1-clamp((time-.112)/.068);
      r.bud.position.set(x2,y2,z2);
      const bloom=clamp((time-.075)/.14);
      r.flower.visible=time>=.075;
      r.flower.position.set(r.x,r.y+.65+.49*bloom,r.z);
      r.flower.rotation.y=.16 + bloom*.43;
      r.flower.scale.setScalar(.45+1.12*(1-(1-bloom)**2));
      r.mat.uniforms.alpha.value=.86*(1-clamp((time-.24)/(LIFE-.24)));
    }
  }
  return {
    show(owner,kind,h,p){if(!state(owner,kind,h,p))return false;update(owner,0);return true;},
    update,
    clear(owner){
      for(const slots of [tigers,roses]){
        const s=slots.find(o=>o.owner===owner);
        if(s){s.owner=null;s.g.removeFromParent();}
      }
    }
  };
}
