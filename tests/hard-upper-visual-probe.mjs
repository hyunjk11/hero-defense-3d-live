import * as THREE from '/lib/three.module.js';
import {G} from '/src/core/state.js';
import {renderer,scene,camera} from '/src/render/scene.js';
import {hardTick} from '/src/monsters/hard.js';
import {hardEnemy} from '/src/data/hard.js';
import {ETYPES} from '/src/data/monsters.js';
export function show(){
 if(location.hostname!=='127.0.0.1'||location.port!=='8854'||!window.__isolatedReview?.memoryOnly||G.phase!=='build'||!['ice-fracture','ash-eruption'].includes(G.stage.rule))throw Error('isolated upper hard build stage required');
 G.manual=true;G.pauseRender=true;G.setAutoSkill(false,false);
 const e={g:new THREE.Group(),E:hardEnemy(ETYPES.grunt,true,false,0),hardCd:0};
 e.g.position.copy(G.hero.g.position).add(new THREE.Vector3(-6,0,3));hardTick(e,.01);
 renderer.render(scene,camera);
 return {kind:'visual-only product hardTick trigger; no battle/reward claim',rule:G.stage.rule,hero:G.hero.g.position.toArray(),caster:e.g.position.toArray(),fxs:G.fxs.length};
}
