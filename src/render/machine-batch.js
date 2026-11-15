import * as THREE from 'three';
// Batch only static siblings. Animated parents and per-enemy materials stay independent.
export function batchMachineParts(root) {
 const parents=[];root.traverse(o=>{if(!o.isMesh)parents.push(o);});
 for(const parent of parents){
  const groups=new Map();
  for(const mesh of parent.children){
   if(!mesh.isMesh||mesh.isInstancedMesh||mesh.userData.ol||mesh.children.length!==1||!mesh.children[0].userData.ol)continue;
   let byMat=groups.get(mesh.geometry);if(!byMat)groups.set(mesh.geometry,byMat=new Map());
   let byOutline=byMat.get(mesh.material);if(!byOutline)byMat.set(mesh.material,byOutline=new Map());
   const outline=mesh.children[0];let parts=byOutline.get(outline.material);if(!parts)byOutline.set(outline.material,parts=[]);parts.push(mesh);
  }
  for(const [geometry,byMat] of groups)for(const [material,byOutline]of byMat)for(const [outlineMaterial,parts]of byOutline){
   if(parts.length<2)continue;
   const body=new THREE.InstancedMesh(geometry,material,parts.length);
   const outline=new THREE.InstancedMesh(parts[0].children[0].geometry,outlineMaterial,parts.length);
   body.userData.machineBatch=true;outline.userData.machineBatch=true;
   body.castShadow=true;body.receiveShadow=true;outline.userData.ol=true;
   outline.castShadow=false;outline.receiveShadow=false;outline.frustumCulled=false;outline.raycast=()=>{};
   parts.forEach((mesh,i)=>{mesh.updateMatrix();body.setMatrixAt(i,mesh.matrix);outline.setMatrixAt(i,mesh.matrix);parent.remove(mesh);});
   body.instanceMatrix.needsUpdate=true;outline.instanceMatrix.needsUpdate=true;
   body.computeBoundingSphere();parent.add(body,outline);
  }
 }
}
