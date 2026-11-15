import * as THREE from 'three';

// Caster signatures, not damage areas. Fixed meshes and deterministic geometry:
// no random draws, timers, particles, combat state writes or per-cast allocations.
export function createQFeedback(scene, ground, state, perf, capacity=6) {
  const polygon=(vertices,out)=>{for(let i=1;i<vertices.length-1;i++)out.push(...vertices[0],...vertices[i],...vertices[i+1]);};
  const blade=(x,z,a,length,width,out)=>{const c=Math.cos(a),s=Math.sin(a),pts=[[-width,0],[0,length],[width,0],[0,length*.2]].map(([u,v])=>[x+u*c+v*s,0,z-u*s+v*c]);polygon(pts,out);};
  const radial=(n,r,l,w,turn,out)=>{for(let i=0;i<n;i++){const a=i*Math.PI*2/n+turn;blade(Math.sin(a)*r,Math.cos(a)*r,a,l,w,out);}};
  const make=kind=>{const a=[];
    if(kind==='archer'){for(let i=-1;i<=1;i++)blade(i*.48,-.6-Math.abs(i)*.2,0,1.7,.22,a);}
    if(kind==='mage'){radial(6,.25,.95,.12,0,a);radial(6,.25,.45,.08,Math.PI/6,a);}
    if(kind==='warrior'){for(let j=0;j<3;j++)for(let i=0;i<9;i++){const x=j*2.094+i*.095,r=1.08;polygon([[Math.sin(x)*r,0,Math.cos(x)*r],[Math.sin(x+.1)*r,0,Math.cos(x+.1)*r],[Math.sin(x+.1)*.86,0,Math.cos(x+.1)*.86],[Math.sin(x)*.86,0,Math.cos(x)*.86]],a);}}
    if(kind==='gunner'){radial(5,.06,1.12,.32,0,a);radial(5,.04,.5,.14,Math.PI/5,a);}
    if(kind==='mechanic'){for(let i=0;i<8;i++){const q=i*Math.PI/4;blade(Math.sin(q)*.68,Math.cos(q)*.68,q,.55,.2,a);}radial(4,0,.5,.13,Math.PI/4,a);}
    if(kind==='fighter'){for(let i=-1;i<=1;i++)blade(i*.5,-.8,Math.PI*.12,1.8,.16,a);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.computeVertexNormals();return g;
  };
  const classes=['archer','mage','warrior','gunner','mechanic','fighter'],geos=Object.fromEntries(classes.map(k=>[k,make(k)]));
  const ring=new THREE.RingGeometry(.94,1,48);ring.rotateX(-Math.PI/2);
  const colors={archer:0x8affb7,mage:0xffa454,warrior:0xffce8e,gunner:0xff91c5,mechanic:0xa8ff68,fighter:0xffc58b};
  const slots=Array.from({length:capacity},()=>{const root=new THREE.Group(),mat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.AdditiveBlending}),echo=mat.clone(),rim=mat.clone();
    const symbol=new THREE.Mesh(geos.archer,mat),ghost=new THREE.Mesh(geos.archer,echo),edge=new THREE.Mesh(ring,rim);root.add(symbol,ghost,edge);root.name='q-signature';root.visible=false;return{root,mat,echo,rim,symbol,ghost,edge,h:null,t:0};});
  const clear=s=>{s.h=null;s.root.visible=false;s.root.removeFromParent();};
  return {
    show(h,target){
      const G=state();if(!h?.g||!geos[h.cls]||!['wave','build'].includes(G.phase)||G.screen==='town')return false;
      // Replace a prior signature from this hero rather than stacking visual noise.
      const s=slots.find(s=>s.h===h)||slots.find(s=>!s.h);if(!s)return false;
      s.h=h;s.terrain=G.tiles;s.t=0;s.duration=.9;s.follow=!['archer','mage'].includes(h.cls);s.low=!!perf();
      s.size=h.cls==='mage'?2.7:h.cls==='archer'?2.4:1.8;s.angle=h.face||0;
      const p=s.follow?h.g.position:target||h.g.position;s.x=p.x;s.z=p.z;
      s.symbol.geometry=s.ghost.geometry=geos[h.cls];const color=h.adv?.col||colors[h.cls];s.mat.color.setHex(color);s.echo.color.setHex(color);s.rim.color.setHex(color);
      s.root.rotation.y=s.angle;s.root.position.set(s.x,ground(s.x,s.z)+.28,s.z);s.root.visible=true;scene.add(s.root);
      s.ghost.visible=!s.low;s.edge.visible=!s.low;s.mat.opacity=.72;s.echo.opacity=.2;s.rim.opacity=.2;
      s.symbol.scale.setScalar(s.size*.62);s.ghost.scale.setScalar(s.size*.7);s.edge.scale.setScalar(s.size*.85);return true;
    },
    update(dt){const G=state();for(const s of slots)if(s.h){const h=s.h;s.t+=Math.max(0,dt);
      if(s.t>=s.duration||h.dead>0||h.warpT>0||!h.g.parent||G.tiles!==s.terrain||G.screen==='town'||!['build','wave'].includes(G.phase)||!(G.hero===h||G.heroes?.includes(h))){clear(s);continue;}
      const k=s.t/s.duration,appear=Math.min(1,k/.12),fade=(1-k)*(1-k);if(s.follow){s.x=h.g.position.x;s.z=h.g.position.z;}s.root.position.set(s.x,ground(s.x,s.z)+.28,s.z);
      const spin=h.cls==='warrior'?k*2.8:h.cls==='gunner'?k*.5:h.cls==='mage'?-k*.35:0;s.root.rotation.y=s.angle+spin;
      s.symbol.scale.setScalar(s.size*(.62+.16*appear));s.ghost.scale.setScalar(s.size*(.8+k*.35));s.edge.scale.setScalar(s.size*(.85+k*.3));
      s.mat.opacity=.72*appear*fade;s.echo.opacity=.22*appear*fade;s.rim.opacity=.22*appear*fade;
    }},
    active:()=>slots.filter(s=>s.h).length,
    dispose(){for(const s of slots){clear(s);s.mat.dispose();s.echo.dispose();s.rim.dispose();}for(const g of Object.values(geos))g.dispose();ring.dispose();}
  };
}
// Boot injects dependencies after settings DOM and scene modules are ready.
// Importing this module from skills must not initialize input/audio UI early.
let qCues=null;
export function initQFeedback(scene,ground,state,perf){qCues?.dispose();qCues=createQFeedback(scene,ground,state,perf);}
export const qFeedback=(h,target)=>qCues?.show(h,target)??false;
export const updateQFeedback=dt=>qCues?.update(dt);
