import * as THREE from 'three';
const COLOR={paladin:0xffe7a0,frost:0x86d8ff,dragon:0x7be8cf};
export function addAwakeningAura(parent,branch) {
 const aura=new THREE.Group();aura.name='awakening-aura';aura.visible=false;
 const material=new THREE.MeshBasicMaterial({color:COLOR[branch],transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 for(const [radius,width] of [[1.25,.035],[1.48,.02]]){
  const band=new THREE.Mesh(new THREE.RingGeometry(radius-width,radius,36),material);
  band.rotation.x=-Math.PI/2;band.renderOrder=1;aura.add(band);
 }
 aura.position.y=.078;parent.add(aura);return aura;
}
export function updateAwakeningAura(hero,G) {
 const aura=hero.awakeningAura;if(!aura)return;
 aura.visible=!!hero.g.parent&&hero.hp>0&&!(hero.dead>0)&&!G.navigating&&G.screen!=='town'&&G.screen!=='menu'&&['build','wave'].includes(G.phase);
 if(!aura.visible)return;
 const tier=Math.floor(hero.awakeningLevel/10),left=Math.max(0,(aura.userData.pulseUntil||0)-G.t);
 const pulse=left>0?Math.sin(Math.PI*Math.max(0,1-left/.55)):0;
 aura.scale.setScalar(1+tier*.018+pulse*.42);aura.children[0].material.opacity=.19+tier*.012+pulse*.17;
}
export function pulseAwakeningAura(hero,now) {if(hero.awakeningAura)hero.awakeningAura.userData.pulseUntil=now+.55;}
