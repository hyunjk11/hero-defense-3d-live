import * as THREE from 'three';

// Visual-only builders. Local +Z is the dragon's flight direction. Every mesh
// owns its geometry; materials may be shared within one root (disposeOwned).
const solid = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false, toneMapped: false });
const mesh = (g, geo, mat, pos = [0, 0, 0], scale = [1, 1, 1], name = '') => {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.scale.set(...scale); m.name = name; g.add(m); return m;
};
const orb = (g, m, pos, scale, name) => mesh(g, new THREE.SphereGeometry(1, 12, 8), m, pos, scale, name);
function curve(g, points, radius, material, name, segments = 12) {
  const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(g, new THREE.TubeGeometry(path, segments, radius, 5, false), material, undefined, undefined, name);
}

export function drawTigerFace(x) {
  // Broad white-tiger cheek ruffs, small rounded ears, heavy brow and angular
  // ink stripes remain readable when the whole sprite is only ~70 pixels tall.
  const path = (pts, color) => { x.fillStyle = color; x.beginPath(); x.moveTo(...pts[0]); for (const p of pts.slice(1)) x.lineTo(...p); x.closePath(); x.fill(); };
  const ellipse = (cx, cy, rx, ry, color) => { x.fillStyle = color; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
  const glow = x.createRadialGradient(128, 130, 45, 128, 130, 126); glow.addColorStop(0, 'rgba(95,205,255,.25)'); glow.addColorStop(1, 'rgba(60,150,255,0)'); x.fillStyle = glow; x.fillRect(0, 0, 256, 256);
  for (const s of [-1, 1]) { ellipse(128+s*64, 52, 24, 26, '#123247'); ellipse(128+s*64, 52, 17, 18, '#e5f6ff'); ellipse(128+s*64, 53, 10, 12, '#426578'); }
  path([[128,38],[166,43],[191,62],[211,91],[219,113],[239,126],[225,133],[243,157],[219,154],[231,183],[207,176],[207,202],[181,196],[162,223],[128,239],[94,223],[75,196],[49,202],[49,176],[25,183],[37,154],[13,157],[31,133],[17,126],[37,113],[45,91],[65,62],[90,43]], '#15364c');
  const fur=x.createLinearGradient(0,45,0,235);fur.addColorStop(0,'#f8fdff');fur.addColorStop(.58,'#d8eff6');fur.addColorStop(1,'#6fa2bd');
  path([[128,44],[163,50],[186,68],[202,98],[208,121],[227,130],[214,138],[229,151],[208,151],[218,174],[199,167],[200,190],[178,184],[157,215],[128,229],[99,215],[78,184],[56,190],[57,167],[38,174],[48,151],[27,151],[42,138],[29,130],[48,121],[54,98],[70,68],[93,50]],fur);
  // Crown and inward-pointing cheek stripes; no round cartoon line caps.
  path([[121,47],[135,47],[132,72],[148,65],[145,79],[131,86],[131,100],[125,100],[124,86],[110,79],[107,65],[124,72]],'#123247');
  for(const s of [-1,1]){
    const p=a=>a.map(([a,b])=>[128+s*a,b]);
    path(p([[29,53],[47,61],[42,82],[20,96],[28,75]]),'#20465a');
    path(p([[57,76],[70,91],[56,103],[30,106],[45,92]]),'#16384a');
    path(p([[81,117],[91,131],[59,143],[43,136],[67,128]]),'#1c4156');
    path(p([[82,148],[88,162],[60,163],[44,151],[63,155]]),'#254f63');
    path(p([[69,176],[67,188],[47,183],[34,168]]),'#2b5668');
    path(p([[13,116],[58,100],[71,107],[54,125],[25,130]]),'#102c40');
    path(p([[19,117],[56,108],[49,118],[26,123]]),'#71e5ff');
    path(p([[36,112],[42,111],[39,121],[35,120]]),'#061b2b');
    path(p([[10,132],[27,126],[46,136],[45,155],[25,165],[8,154]]),'#f7fcff');
  }
  path([[110,135],[128,130],[146,135],[139,147],[128,154],[117,147]],'#16364b');
  path([[92,157],[112,159],[128,168],[144,159],[164,157],[159,196],[143,216],[128,222],[113,216],[97,196]],'#102235');
  path([[107,199],[128,202],[149,199],[140,213],[128,217],[116,213]],'#47718c');
  for(const s of [-1,1]){
    path([[128+s*31,157],[128+s*20,163],[128+s*23,188],[128+s*29,178]],'#ffffff');
    path([[128+s*23,207],[128+s*14,203],[128+s*20,191]],'#cce8f5');
    x.strokeStyle='#c8efff';x.lineWidth=1.7;for(let i=0;i<2;i++){x.beginPath();x.moveTo(128+s*38,150+i*7);x.quadraticCurveTo(128+s*67,142+i*10,128+s*96,143+i*17);x.stroke();}
  }
}

export function createDragonHead(color, scale) {
  const g=new THREE.Group();g.name='celestial-dragon-head';
  const blue=solid(0x157db4,.97),light=solid(0x63dcf1,.97),dark=solid(0x10344e),ivory=solid(0xf2f9dc),eye=solid(0xffdf77),mane=solid(0xc5f5ff,.9);
  orb(g,blue,[0,.08,-.35],[.64,.59,.85],'skull');
  orb(g,light,[0,-.03,.72],[.46,.29,.88],'long-muzzle');
  orb(g,blue,[0,.06,1.35],[.49,.24,.27],'nose');
  orb(g,dark,[0,-.31,.65],[.43,.14,.83],'open-mouth');
  orb(g,light,[0,-.47,.66],[.38,.13,.8],'lower-jaw');
  for(const s of [-1,1]){
    orb(g,dark,[s*.22,.19,1.52],[.085,.045,.06],'nostril');
    orb(g,dark,[s*.51,.23,.19],[.16,.13,.31],'eye-socket');
    orb(g,eye,[s*.57,.25,.27],[.075,.075,.17],'gold-eye');
    const brow=orb(g,blue,[s*.52,.39,.18],[.15,.10,.38],'brow');brow.rotation.z=s*-.3;
    curve(g,[[s*.42,.48,-.5],[s*.6,.92,-.8],[s*.66,1.36,-1.12],[s*.54,1.59,-1.38]],.09,ivory,'antler');
    curve(g,[[s*.62,1.13,-.97],[s*.89,1.35,-1.08],[s*1.02,1.43,-1.35]],.055,ivory,'antler-tine',8);
    curve(g,[[s*.38,-.08,1.24],[s*.85,-.08,1.04],[s*1.14,.10,.45],[s*1.08,.25,-.17]],.045,mane,'whisker');
    const ear=mesh(g,new THREE.ConeGeometry(.23,.76,4),light,[s*.69,.34,-.65]);ear.rotation.set(-.8,0,s*-.8);
    for(const z of [.65,1.1]){const fang=mesh(g,new THREE.ConeGeometry(.085,.32,6),ivory,[s*.34,-.25,z]);fang.rotation.z=Math.PI;}
    for(let i=0;i<3;i++){const fin=mesh(g,new THREE.ConeGeometry(.18,.7,4),mane,[s*(.5+i*.05),.19-i*.14,-.68-i*.21]);fin.rotation.set(-1,0,s*-.7);}
  }
  curve(g,[[0,-.52,.73],[0,-.72,.48],[0,-.73,-.1],[0,-.52,-.53]],.10,mane,'flowing-beard');
  for(let i=0;i<3;i++){const fin=mesh(g,new THREE.ConeGeometry(.2,.65,4),mane,[0,.57,-.35-i*.38]);fin.rotation.x=-.65;}
  const aura=solid(color,.11);aura.blending=THREE.AdditiveBlending;orb(g,aura,[0,0,-.1],[.88,.78,1.6],'aura');
  g.scale.setScalar(scale);return g;
}

export function createDragonSegment(i,n,scale,low=false) {
  const r=.59*scale*(1-i/(n+2)),g=new THREE.Group();g.name='celestial-dragon-segment';
  const blue=solid(i%2?0x258ab7:0x2caacb,.94-i*.018),belly=solid(0xa9e3df,.93-i*.018),ivory=solid(0xe7fbef,.92);
  orb(g,blue,[0,0,0],[r,r*.8,.72],'flowing-body');
  orb(g,belly,[0,-r*.57,.02],[r*.69,r*.26,.71],'belly');
  if(i<n-2&&(i%2===0||!low)){const fin=mesh(g,new THREE.ConeGeometry(r*.28,r*.9,4),ivory,[0,r*.75,-.2]);fin.rotation.x=-.65;}
  if(i===2||i===Math.floor(n*.58))for(const s of [-1,1]){
    curve(g,[[s*r*.6,-r*.2,0],[s*r*1.15,-r*.65,-.24],[s*r*1.34,-r*.72,.12]],r*.14,blue,'swept-leg',6);
    for(const z of [-.04,.17]){const claw=mesh(g,new THREE.ConeGeometry(r*.09,r*.36,5),ivory,[s*r*1.34,-r*.76,z]);claw.rotation.x=Math.PI*.5;}
  }
  if(i===n-1){const tail=mesh(g,new THREE.ConeGeometry(r*1.1,1.25,6),ivory,[0,0,-.55]);tail.rotation.x=-Math.PI/2;tail.name='tail-tip';}
  return g;
}
