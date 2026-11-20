import * as THREE from 'three';

// Rose's PC equipment proc: an amber fire-control reticle, a falling flare,
// then a pale impact front with a brief dust plume. No lights or gameplay state.
const VERT = `
varying vec2 p;
void main(){
  p=uv*2.-1.;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;
const GLYPH = `
varying vec2 p;
uniform float time;
uniform float mode;
float band(float d,float r,float w){return 1.-smoothstep(w,w+.022,abs(d-r));}
void main(){
  float r=length(p);
  float a=atan(p.y,p.x + .00001);
  vec3 ink;
  float alpha;
  if(mode<.5){
    float tick=step(.58,abs(cos(a*2.)));
    float outer=band(r,.82,.021)*step(.48,abs(cos(a*4.)));
    float inner=band(r,.61,.027);
    float crosshair=(1.-smoothstep(.022,.045,min(abs(p.x),abs(p.y))))*step(r,.40);
    float dots=band(r,.70,.07)*step(.985,abs(cos(a*2.)));
    float move=band(r,mix(.94,.24,time),.019)*.60;
    float line=max(max(outer,inner),max(max(crosshair,dots),move));
    float backing=max(band(r,.61,.075),band(r,.82,.065)*tick);
    float disk=(1.-smoothstep(.58,.66,r))*(.16+time*.16);
    ink=mix(vec3(.26,.065,.02),mix(vec3(1.,.53,.15),vec3(1.,.92,.57),max(inner,dots)),line);
    alpha=max(max(backing*.70,disk),line)*(.79+.21*sin(time*18.)*sin(time*18.));
  }else{
    float front=mix(.16,.91,1.-pow(1.-time,1.8));
    float wave=band(r,front,.047)*(1.-time);
    float echo=band(r,front*.64,.028)*(1.-time)*.54;
    float flash=(1.-smoothstep(0.,.56,r))*pow(1.-time,4.);
    ink=mix(vec3(1.,.37,.10),vec3(1.,.88,.53),clamp(wave+flash,0.,1.));
    alpha=clamp(wave+echo+flash,0.,1.);
  }
  gl_FragColor=vec4(ink,alpha);
}`;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const LIMIT = 4, IMPACT_TIME = .68, DUST = 8, SPARKS = 12;

export function createGearArtilleryFx({scene, groundY}) {
  const warnings = [], impacts = [];
  const at = new THREE.Object3D();
  const direction = new THREE.Vector3(-.30, -.94, .16).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  let shared, nextWarning = 0, nextImpact = 0;
  const height = (x,z) => { const y = groundY(x,z); return Number.isFinite(y) ? y : 0; };
  const extent = r => Number.isFinite(r) ? clamp(r,1.25,7) : 3;
  const assets = () => shared ||= {
    plane: new THREE.PlaneGeometry(2, 2),
    puff: new THREE.IcosahedronGeometry(1, 0),
    shard: new THREE.OctahedronGeometry(.22, 0),
    shell: new THREE.ConeGeometry(.24, 2, 10),
    fire: new THREE.MeshBasicMaterial({color:0xffd48c, toneMapped:false}),
    streak: new THREE.MeshBasicMaterial({color:0xff8140, transparent:true, opacity:.63, depthWrite:false, toneMapped:false}),
  };
  function group(kind) {
    const g = new THREE.Group(); g.name = kind; g.visible = false; scene.add(g);
    return g;
  }
  function ground(g, mode) {
    const m = new THREE.ShaderMaterial({vertexShader:VERT, fragmentShader:GLYPH, transparent:true,
      depthWrite:false, depthTest:false, uniforms:{time:{value:0},mode:{value:mode}}});
    const mesh = new THREE.Mesh(assets().plane,m);
    mesh.rotation.x = -Math.PI/2; mesh.position.y = .08; mesh.renderOrder = 26; g.add(mesh);
    return mesh;
  }
  function warning() {
    const g = group('rose-artillery-warning'), glyph = ground(g,0), shell = new THREE.Group();
    // Both cones point toward the floor: a gold nose and a tapered amber tail.
    shell.quaternion.setFromUnitVectors(up,direction);
    const nose = new THREE.Mesh(assets().shell,assets().fire);
    nose.position.y = .12; nose.scale.set(.88,.58,.88); shell.add(nose);
    const tail = new THREE.Mesh(assets().shell,assets().streak);
    tail.rotation.z = Math.PI; tail.position.y = -2.15; tail.scale.set(.89,1.85,.89); shell.add(tail);
    g.add(shell);
    return {g,glyph,shell,t:0,dur:0,r:0};
  }
  function impact() {
    const g = group('rose-artillery-impact'), glyph = ground(g,1);
    const dust = new THREE.InstancedMesh(assets().puff,new THREE.MeshBasicMaterial({
      color:0xb66845,transparent:true,depthWrite:false
    }),DUST);
    const sparks = new THREE.InstancedMesh(assets().shard,new THREE.MeshBasicMaterial({
      color:0xffa652,transparent:true,depthWrite:false,toneMapped:false
    }),SPARKS);
    for (const m of [dust,sparks]) {m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;g.add(m);}
    return {g,glyph,dust,sparks,t:0,dur:0,r:0};
  }
  function place(f,x,z,dur,r) {
    f.t=0; f.dur=dur; f.r=extent(r);
    f.g.position.set(x,height(x,z),z); f.glyph.scale.setScalar(f.r*1.25);
    f.glyph.material.uniforms.time.value=0; f.g.visible=true;
  }
  function tickWarning(w,p) {
    w.glyph.material.uniforms.time.value=p;
    const fall = clamp((p-.14)/.86,0,1), y = 12.0 *(1.-fall*fall);
    w.shell.visible=p>=.14;
    w.shell.position.set(-y*.32,y+.55,y*.17);
  }
  function tickImpact(w,p) {
    w.glyph.material.uniforms.time.value=p;
    w.dust.material.opacity=.53*(1.-p)*(1.-p);
    w.sparks.material.opacity=.97*(1.-p);
    for (let i=0;i<DUST;i++) {
      const a=i*2.39996, spread=(.08+p*.62)*w.r*(.62+(i%4)*.12);
      at.position.set(Math.cos(a)*spread,.22+Math.sin(p*Math.PI*.77)*(.84+(i%3)*.47),Math.sin(a)*spread);
      at.rotation.set(a+p*.8,0,a-p*.5);
      const size=(.31+p*.79)*(.82+(i%3)*.15);
      at.scale.set(size*1.25,size*.92,size*1.12);
      at.updateMatrix(); w.dust.setMatrixAt(i,at.matrix);
    }
    for (let i=0;i<SPARKS;i++) {
      const a=i*2.39996+.2, spread=(.06+p*.86)*w.r*(.63+(i%5)*.16);
      at.position.set(Math.cos(a)*spread,.28+4*p*(1.-p)*(.75+(i%4)*.48),Math.sin(a)*spread);
      at.rotation.set(p*5,a,a+p*2);
      at.scale.set(.9-p*.56,(2.4+(i%3)*.65)*(1.-p*.54),.9-p*.56);
      at.updateMatrix(); w.sparks.setMatrixAt(i,at.matrix);
    }
    w.dust.instanceMatrix.needsUpdate=true; w.sparks.instanceMatrix.needsUpdate=true;
  }
  function take(slots,build,cursor) {
    for(let i=0;i<slots.length;i++) if(!slots[i].g.visible) return slots[i];
    if(slots.length<LIMIT) { const w=build(); slots.push(w); return w; }
    return slots[cursor%LIMIT];
  }
  return {
    mark(x,z,delaySeconds=.52,radius) {
      if(!Number.isFinite(x)||!Number.isFinite(z))return;
      const w=take(warnings,warning,nextWarning++);
      place(w,x,z,Number.isFinite(delaySeconds)?clamp(delaySeconds,.016,4):.52,radius); tickWarning(w,0);
      const owner = Symbol(); w.owner=owner;
      return () => { if(w.owner===owner) w.g.visible=false; };
    },
    strike(x,z,radius) {
      if(!Number.isFinite(x)||!Number.isFinite(z))return;
      const w=take(impacts,impact,nextImpact++);
      place(w,x,z,IMPACT_TIME,radius); tickImpact(w,0);
    },
    update(dt) {
      if(!Number.isFinite(dt)||dt<=0)return;
      for(const w of warnings) if(w.g.visible) {w.t+=dt; if(w.t>=w.dur-1e-6)w.g.visible=false;else tickWarning(w,w.t/w.dur);}
      for(const w of impacts) if(w.g.visible) {w.t+=dt; if(w.t>=w.dur-1e-6)w.g.visible=false;else tickImpact(w,w.t/w.dur);}
    },
    clear() {
      for(const w of warnings) w.g.visible=false;
      for(const w of impacts) w.g.visible=false;
    },
  };
}
