import * as THREE from 'three';

// Fixed, reusable presentation pool. No UUID allocation or random draw during a cast.
// The owning cast advances and clears its cues, including death/warp/map cancellation.
export function createSkillCues(scene, capacity = 24) {
  const ring = new THREE.RingGeometry(.88, 1, 32), ray = new THREE.PlaneGeometry(1, 1), star = new THREE.CircleGeometry(1, 4);
  const slots = Array.from({length: capacity}, () => {
    const material = new THREE.MeshBasicMaterial({transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, toneMapped:false});
    const group = new THREE.Group(), meshes = [ring, ray, star].map(g => new THREE.Mesh(g, material));
    group.name = 'skill-cue'; group.visible = false;
    for (const m of meshes) { m.userData.skillCuePool=true; m.rotation.x = -Math.PI/2; group.add(m); }
    return {group, meshes, material, owner:null, time:0, duration:0, kind:'', size:1};
  });
  const clear = owner => { for (const s of slots) if (s.owner === owner) { s.owner = null; s.group.visible = false; s.group.removeFromParent(); } };
  return {
    show(owner, kind, p, color, size=1, duration=.28, angle=0, length=0) {
      const s = slots.find(s => !s.owner); if (!s || !owner) return false;
      Object.assign(s,{owner,kind,size,duration:Math.max(.01,duration),time:0});
      const [r,l,b] = s.meshes;
      scene.add(s.group); s.group.visible = true; s.group.position.set(p.x,p.y,p.z); s.group.rotation.y = angle;
      s.material.color.setHex(color); s.material.opacity = kind === 'aim' ? .28 : .65;
      r.visible = !['aim','link','slash'].includes(kind); l.visible = ['aim','link','slash'].includes(kind); b.visible = kind === 'impact' || kind === 'aim';
      r.scale.setScalar(size*.5); b.position.set(0,0,kind === 'aim' ? length : 0); b.scale.setScalar(kind === 'aim' ? .16 : size*.5);
      l.position.set(0,0,kind==='slash'?0:length/2); l.scale.set(kind==='slash'?.12:.055,kind==='slash'?size*1.8:Math.max(.01,length),1);
      return true;
    },
    update(owner, dt) {
      for (const s of slots) if (s.owner === owner) {
        s.time += Math.max(0,dt); const k = Math.min(1,s.time/s.duration);
        if (k >= 1) { s.owner=null; s.group.visible=false; s.group.removeFromParent(); continue; }
        if (s.kind === 'aim') s.material.opacity = .16+.18*k;
        else {
          s.material.opacity = .65*(1-k)*(1-k);
          s.meshes[0].scale.setScalar(s.size*(.4+.6*k));
          s.meshes[2].scale.setScalar(s.size*(.65-.5*k));
        }
      }
    },
    clear,
    active: () => slots.filter(s => s.owner).length,
    dispose() { for (const s of slots) { s.group.removeFromParent(); s.material.dispose(); } ring.dispose(); ray.dispose(); star.dispose(); }
  };
}
