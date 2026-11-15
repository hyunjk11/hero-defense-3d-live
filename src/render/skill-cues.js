import * as THREE from 'three';

// Bounded presentation pool. Geometry/materials are created only at startup;
// casting never consumes game RNG, creates a timer or changes combat state.
export function createSkillCues(scene, capacity = 24) {
  const ring = new THREE.RingGeometry(.88, 1, 32), ray = new THREE.PlaneGeometry(1, 1), star = new THREE.CircleGeometry(1, 4);
  const outline=(points,width=.14)=>{const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const h=new THREE.Path();[...points].reverse().forEach(([x,y],i)=>i?h.lineTo(x*(1-width),y*(1-width)):h.moveTo(x*(1-width),y*(1-width)));h.closePath();s.holes.push(h);return new THREE.ShapeGeometry(s);};
  const radial=(n,inner,phase=0)=>Array.from({length:n*2},(_,i)=>{const a=phase+i*Math.PI/n,r=i%2?inner:1;return [Math.sin(a)*r,Math.cos(a)*r];});
  const signatures={
    arrow:outline([[0,1],[.8,-.5],[.25,-.28],[0,-1],[-.25,-.28],[-.8,-.5]]),
    frost:outline(radial(6,.38)), flame:outline([[0,1.2],[.42,.3],[.8,.5],[.7,-.5],[0,-1],[-.7,-.5],[-.8,.5],[-.32,.1]]),
    shield:outline([[-.75,.8],[.75,.8],[.65,-.35],[0,-1],[-.65,-.35]]),
    blade:new THREE.RingGeometry(.72,1,24,1,.12,Math.PI*1.65),
    rose:outline(radial(5,.62)), claw:outline([[-.85,1],[-.55,-.7],[-.4,-1],[-.52,.85],[-.1,1],[-.02,-.8],[.1,-1],[.2,.85],[.65,1],[.55,-.7],[.7,-1],[.9,.75]]),
    arcane:outline(radial(4,.6,Math.PI/4)), gear:outline(radial(12,.78)), paw:outline(radial(4,.7))
  };
  const profiles={wind:'arrow',hawk:'arrow',flame:'flame',frost:'frost',paladin:'shield',berserk:'blade',duel:'rose',thorn:'rose',tiger:'claw',dragon:'paw',...Object.fromEntries(Object.keys(signatures).map(k=>[k,k]))};
  const slots = Array.from({length: capacity}, () => {
    const material = new THREE.MeshBasicMaterial({transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, toneMapped:false});
    const group = new THREE.Group(), meshes = [ring, ray, star,signatures.arrow].map(g => new THREE.Mesh(g, material));
    group.name = 'skill-cue'; group.visible = false;
    for (const m of meshes) { m.userData.skillCuePool=true; m.rotation.x = -Math.PI/2; group.add(m); }
    return {group, meshes, material, owner:null, time:0, duration:0, kind:'', size:1};
  });
  const clear = owner => { for (const s of slots) if (s.owner === owner) { s.owner = null; s.group.visible = false; s.group.removeFromParent(); } };
  return {
    show(owner, kind, p, color, size=1, duration=.28, angle=0, length=0,profile=null) {
      const s = slots.find(s => !s.owner); if (!s || !owner) return false;
      Object.assign(s,{owner,kind,size,duration:Math.max(.01,duration),time:0});
      const [r,l,b,crest] = s.meshes, signature=signatures[profiles[profile]];
      scene.add(s.group); s.group.visible = true; s.group.position.set(p.x,p.y,p.z); s.group.rotation.y = angle;
      s.material.color.setHex(color); s.material.opacity = kind === 'aim' ? .28 : .65;
      r.visible = !['aim','link','slash'].includes(kind); l.visible = ['aim','link','slash'].includes(kind); b.visible = !signature&&(kind === 'impact' || kind === 'aim');
      crest.visible=!!signature&&kind!=='aim'&&kind!=='link';if(signature)crest.geometry=signature;
      crest.position.set(0,.06,0);crest.rotation.z=0;crest.scale.setScalar(size*.8);
      r.scale.setScalar(size*.5); b.position.set(0,0,kind === 'aim' ? length : 0); b.scale.setScalar(kind === 'aim' ? .16 : size*.5);
      l.position.set(0,0,kind==='slash'?0:length/2); l.scale.set(kind==='slash'?.14:.065,kind==='slash'?size*1.8:Math.max(.01,length),1);
      return true;
    },
    update(owner, dt) {
      for (const s of slots) if (s.owner === owner) {
        s.time += Math.max(0,dt); const k = Math.min(1,s.time/s.duration);
        if (k >= 1) { s.owner=null; s.group.visible=false; s.group.removeFromParent(); continue; }
        if (s.kind === 'aim') s.material.opacity = .16+.18*k;
        else {
          // Brief strong onset then a readable outline, not a filled screen flash.
          s.material.opacity = .65*Math.pow(1-k,1.35);
          s.meshes[0].scale.setScalar(s.size*(.4+.6*k));
          s.meshes[2].scale.setScalar(s.size*(.65-.5*k));
          s.meshes[3].scale.setScalar(s.size*(.65+.35*Math.min(1,k*4)));
          s.meshes[3].rotation.z=s.kind==='slash'?(k-.5)*.55:k*.18;
        }
      }
    },
    clear,
    // A completed cast must retain only its own presentation tail.
    has: owner => slots.some(s => s.owner === owner),
    active: () => slots.filter(s => s.owner).length,
    dispose() { for (const s of slots) { s.group.removeFromParent(); s.material.dispose(); } ring.dispose(); ray.dispose(); star.dispose();for(const g of Object.values(signatures))g.dispose(); }
  };
}
