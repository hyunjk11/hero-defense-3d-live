// Visual-only gun grips. Bone lengths, attack timing, targets and damage stay unchanged.
import * as THREE from 'three';
const UP=new THREE.Vector3(0,1,0),FWD=new THREE.Vector3(0,0,1);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rotateToward(bone,from,to){
  const q=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
  const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.premultiply(parent.clone().invert().multiply(q).multiply(parent));
  bone.updateWorldMatrix(false,true);
}
function armTo(arm,target,pole,handWorld){
  const {upper,fore,hand}=arm,a=upper.getWorldPosition(new THREE.Vector3()),b=fore.getWorldPosition(new THREE.Vector3()),c=hand.getWorldPosition(new THREE.Vector3());
  const l1=a.distanceTo(b),l2=b.distanceTo(c),axis=target.clone().sub(a),raw=axis.length();if(raw<1e-6||l1<1e-6||l2<1e-6)return;
  axis.divideScalar(raw);const d=clamp(raw,Math.abs(l1-l2)+1e-4,l1+l2-1e-4),along=(l1*l1-l2*l2+d*d)/(2*d);
  const bend=pole.clone().sub(a).addScaledVector(axis,-pole.clone().sub(a).dot(axis));
  if(bend.lengthSq()<1e-6)bend.copy(UP).addScaledVector(axis,-UP.dot(axis));
  bend.normalize();const elbow=a.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
  rotateToward(upper,b.sub(a),elbow.sub(a));
  const actualElbow=fore.getWorldPosition(b);rotateToward(fore,hand.getWorldPosition(c).sub(actualElbow),a.copy(target).sub(actualElbow));
  const parent=hand.parent.getWorldQuaternion(new THREE.Quaternion());hand.quaternion.copy(parent.invert().multiply(handWorld));hand.updateWorldMatrix(false,true);
}
export function gunPose(ch,rifle=null){
  const arms=['Left','Right'].map(side=>({upper:ch.root.getObjectByName(side+'Arm'),fore:ch.root.getObjectByName(side+'ForeArm'),hand:ch.root.getObjectByName(side+'Hand')}));
  if(arms.some(a=>!a.upper||!a.fore||!a.hand))return;
  const kick=[0,0],gripOffsets=[new THREE.Vector3(0,6,-1.4),new THREE.Vector3(0,6,-1.4)];
  if(rifle)rifle.grips=arms.map((a,i)=>{const p=new THREE.Object3D();p.name='rifle-grip';p.position.copy(gripOffsets[i]);a.hand.add(p);return p;});
  const aimNames=rifle?['AimR','AimRun']:['ShootStand','ShootWalk','ShootLoop'];
  let dtLast=0;
  ch.gunKick=k=>{kick[k]=1;};
  ch.aimWeapons=(worldYaw)=>{
    const clip=ch.cur?.getClip().name,aim=aimNames.includes(clip),carry=rifle&&['IdleR','Run'].includes(clip);
    if(!aim&&!carry){
      ch.root.rotation.y*=Math.max(0,1-dtLast*14);
      if(rifle){
        const {gun}=rifle,hand=arms[1].hand;
        ch.g.updateWorldMatrix(true,true);
        if(!rifle.relative)rifle.relative=hand.matrixWorld.clone().invert().multiply(gun.matrixWorld);
        const m=ch.g.matrixWorld.clone().invert().multiply(hand.matrixWorld).multiply(rifle.relative);
        m.decompose(gun.position,gun.quaternion,new THREE.Vector3());
      }
      return false;
    }
    if(rifle)rifle.relative=null;
    ch.g.updateWorldMatrix(true,true);
    // The visual body follows the same target angle as the shot, including the first frame of a turn.
    const groupYaw=Math.atan2(new THREE.Vector3(0,0,1).transformDirection(ch.g.matrixWorld).x,new THREE.Vector3(0,0,1).transformDirection(ch.g.matrixWorld).z);
    ch.root.rotation.y=aim&&Number.isFinite(worldYaw)?Math.atan2(Math.sin(worldYaw-groupYaw),Math.cos(worldYaw-groupYaw)):0;
    ch.g.updateWorldMatrix(true,true);
    const frameQ=ch.g.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(UP,ch.root.rotation.y));
    const toWorld=v=>v.applyQuaternion(frameQ).add(ch.g.getWorldPosition(new THREE.Vector3()));
    const handQ=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(-1,0,0),FWD,UP)).premultiply(frameQ);
    if(rifle){
      const {gun,R}=rifle,pitch=aim?Math.min(.12,(ch.recoil||0)*.07):-.18;
      const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch,Math.PI/2,0,'XYZ'));
      const anchor=new THREE.Vector3(-.08,aim?1.52:1.38,.12-(ch.recoil||0)*.035);
      gun.quaternion.copy(q);gun.position.copy(anchor).sub(new THREE.Vector3(...R.grip).multiplyScalar(R.s).applyQuaternion(q));
      // Gun stays rigid; each hand reaches its own grip instead of steering the entire spine from the hand line.
      gun.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(UP,ch.root.rotation.y));gun.position.applyAxisAngle(UP,ch.root.rotation.y);gun.updateWorldMatrix(true,true);
      for(let i=0;i<2;i++){
        const grip=new THREE.Vector3(...(i?R.grip:R.fore)).multiplyScalar(R.s);gun.localToWorld(grip);
        const ws=arms[i].hand.getWorldScale(new THREE.Vector3()).x;
        const holdQ=i?handQ:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(-.76,0,-.65).normalize(),new THREE.Vector3(-.65,0,.76).normalize(),UP)).premultiply(frameQ);
        const wrist=grip.sub(gripOffsets[i].clone().multiplyScalar(ws).applyQuaternion(holdQ));
        armTo(arms[i],wrist,toWorld(new THREE.Vector3(i?-.55:.48,1.18,.1)),holdQ);
      }
      rifle.dir.set(-1,0,0).applyQuaternion(gun.quaternion).normalize();
    }else for(let i=0;i<2;i++){
      const side=i?-1:1,shoulder=arms[i].upper.getWorldPosition(new THREE.Vector3());
      const height=shoulder.y-ch.g.getWorldPosition(new THREE.Vector3()).y;
      const wrist=toWorld(new THREE.Vector3(side*.34,height-.07,.56-kick[i]*.055));
      armTo(arms[i],wrist,toWorld(new THREE.Vector3(side*.66,height-.35,.26)),handQ);
    }
    ch.g.updateWorldMatrix(true,true);return true;
  };
  const update=ch.mixer.update.bind(ch.mixer);
  ch.mixer.update=dt=>{dtLast=dt;for(let i=0;i<2;i++)kick[i]=Math.max(0,kick[i]-dt*9);const r=update(dt);ch.aimWeapons();return r;};
}
