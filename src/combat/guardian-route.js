// Read-only reverse of the enemy route. No terrain or shared path field is mutated.
export function enemyMarchRoute(start, core, next, width=24, height=16) {
  const route=[start.slice()],seen=new Set([start.join(',')]);let p=start.slice();
  for(let n=0;n<width*height;n++) {
    if(p[0]===core[0]&&p[1]===core[1])return route;
    const q=next(...p);
    if(!q||q[0]<0||q[1]<0||q[0]>=width||q[1]>=height||seen.has(q.join(',')))break;
    route.push(q.slice());seen.add(q.join(','));p=q;
  }
  // An entirely sealed route still lets summoned soldiers pass; enemies keep their own field.
  while(p[0]!==core[0]||p[1]!==core[1]) {
    p=[p[0]+Math.sign(core[0]-p[0]),p[1]];
    if(p[0]===route.at(-1)[0])p[1]+=Math.sign(core[1]-p[1]);
    const prior=route.findIndex(q=>q[0]===p[0]&&q[1]===p[1]);
    if(prior>=0)route.splice(prior+1);else route.push(p.slice());
  }
  return route;
}
export function closestMarchIndex(route,x,z,tileX,tileZ) {
  let index=0,best=Infinity;
  for(let i=0;i<route.length;i++){const d=(tileX(route[i][0])-x)**2+(tileZ(route[i][1])-z)**2;if(d<best){best=d;index=i;}}
  return index;
}
