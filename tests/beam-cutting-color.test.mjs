import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../lib/three.module.js';

const src=fs.readFileSync(new URL('../src/render/beam.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replaceAll('export ','');
function draw(mobileApp,cut,charges){
  const context=vm.createContext({THREE,mobileApp,scene:new THREE.Scene(),shareGeo:g=>g,disposeOwned:()=>{}});
  vm.runInContext(src+';this.drawBeam=drawBeam;this.v=createBeamVisual();',context);
  const {drawBeam,v}=context,a=new THREE.Vector3(0,2,0),b=new THREE.Vector3(0,1,5),color=cut?0xc18bff:0x72e4ff;
  return charges.map(charge=>{
    drawBeam(v,a,b,{cut,charge,color,heat:1+charge*1.6});
    return [v.halo,v.core,v.tip].map(m=>m.material.color.clone());
  });
}

test('PC Cutting starts pale and gradually deepens blue in every beam layer',()=>{
  const [start,mid,end]=draw(false,true,[0,.5,1]);
  for(let i=0;i<3;i++){
    assert.ok(start[i].r<start[i].g&&start[i].g<start[i].b);
    assert.ok(start[i].r>mid[i].r&&mid[i].r>end[i].r);
    assert.ok(start[i].g>mid[i].g&&mid[i].g>end[i].g);
    assert.ok(end[i].b>end[i].g*3&&end[i].b>end[i].r*10);
  }
});
test('mobile Cutting and regular beam on both platforms keep exact legacy red interpolation',()=>{
  const charges=[0,.25,.5,1];
  for(const [mobile,cut] of [[true,true],[true,false],[false,false]]){
    draw(mobile,cut,charges).forEach((layers,i)=>{
      const color=new THREE.Color(cut?0xc18bff:0x72e4ff).lerp(new THREE.Color(0xff2312),charges[i]);
      for(const layer of layers)assert.ok(layer.equals(color));
    });
  }
});
