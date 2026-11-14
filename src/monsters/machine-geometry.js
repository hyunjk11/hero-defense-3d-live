export const machineCircle=(p,q,r)=>(p.x-q.x)**2+(p.z-q.z)**2<=r*r;
export function machineBeam(p,a,b,width){const x=b.x-a.x,z=b.z-a.z,l=x*x+z*z;if(l===0)return machineCircle(p,a,width);const t=((p.x-a.x)*x+(p.z-a.z)*z)/l;return t>=0&&t<=1&&Math.hypot(p.x-a.x-x*t,p.z-a.z-z*t)<=width;}
export function repairTargets(source,enemies,range,limit){return enemies.filter(e=>e!==source&&!e.dead&&e.hp<e.max&&machineCircle(e.g.position,source.g.position,range)).sort((a,b)=>a.hp/a.max-b.hp/b.max).slice(0,limit);}
