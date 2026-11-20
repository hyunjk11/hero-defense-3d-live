// Terrain uses fixed logical grid indices; only occupied instances reach WebGL.
// Compact in logical order to keep drawing, blending and any ray hit IDs stable.
export function terrainInstances(mesh, outline, capacity) {
  const matrices=new Float32Array(capacity*16);
  const colors=new Float32Array(capacity*3).fill(1);
  const occupied=new Uint8Array(capacity), drawn=new Uint8Array(capacity);
  const slotById=new Int32Array(capacity).fill(-1), idBySlot=new Int32Array(capacity);
  const changed=new Set();
  const compact=()=>{
    if(!changed.size)return;
    let repack=false;
    for(const id of changed)if(occupied[id]!==drawn[id]){repack=true;break;}
    const write=id=>{
      const slot=slotById[id];if(slot<0)return;
      mesh.instanceMatrix.array.set(matrices.subarray(id*16,id*16+16),slot*16);
      mesh.instanceColor.array.set(colors.subarray(id*3,id*3+3),slot*3);
    };
    if(repack){
      let count=0;
      for(let id=0;id<capacity;id++){
        if(!occupied[id]){slotById[id]=-1;continue;}
        slotById[id]=count;idBySlot[count++]=id;write(id);
      }
      drawn.set(occupied);
      mesh.count=count;if(outline)outline.count=count;
    }else for(const id of changed)write(id);
    changed.clear();
    mesh.instanceMatrix.needsUpdate=mesh.instanceColor.needsUpdate=true;
    mesh.boundingSphere=null;if(outline)outline.boundingSphere=null;
  };
  mesh.count=0;if(outline)outline.count=0;
  for(const object of [mesh,outline])if(object){
    const raycast=object.raycast;
    object.raycast=function(raycaster,hits){
      compact();
      const start=hits.length;raycast.call(this,raycaster,hits);
      for(let i=start;i<hits.length;i++)hits[i].instanceId=idBySlot[hits[i].instanceId];
    };
  }
  return {
    material:mesh.material,compact,
    setMatrixAt(id,m){
      const a=m.elements;matrices.set(a,id*16);
      occupied[id]=Number(!!(a[0]||a[1]||a[2]||a[4]||a[5]||a[6]||a[8]||a[9]||a[10]));
      changed.add(id);
    },
    setColorAt(id,c){c.toArray(colors,id*3);changed.add(id);}
  };
}
