import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../lib/three.module.js';
import {terrainInstances} from '../src/render/terrain-instances.js';

test('terrain slots compact in grid order, retain hidden colors and map ray hits to logical IDs',()=>{
 const mesh=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshBasicMaterial(),8),outline=mesh.clone();
 for(let i=0;i<8;i++)mesh.setColorAt(i,new T.Color(0xffffff));
 outline.instanceMatrix=mesh.instanceMatrix;
 const batch=terrainInstances(mesh,outline,8),m=new T.Matrix4();
 batch.setColorAt(5,new T.Color(0xff0000));batch.setMatrixAt(5,m.makeTranslation(0,0,0));
 batch.setMatrixAt(2,m.makeTranslation(3,0,0));batch.compact();
 assert.equal(mesh.count,2);assert.equal(outline.count,2);
 const ray=new T.Raycaster(new T.Vector3(0,0,4),new T.Vector3(0,0,-1));
 const colorAt=(i)=>{const color=new T.Color();mesh.getColorAt(i,color);return color.getHex();};
 assert.equal(ray.intersectObject(mesh)[0].instanceId,5);
 assert.equal(colorAt(1),0xff0000);
 batch.setMatrixAt(2,m.makeScale(0,0,0));assert.equal(ray.intersectObject(mesh)[0].instanceId,5);
 assert.equal(mesh.count,1);assert.equal(colorAt(0),0xff0000);
 batch.setMatrixAt(5,m.makeScale(0,0,0));batch.compact();assert.equal(mesh.count,0);
 batch.setMatrixAt(5,m.makeTranslation(1,0,0));batch.compact();
 assert.equal(colorAt(0),0xff0000);
 assert.equal(ray.intersectObject(mesh).length,0);
});
