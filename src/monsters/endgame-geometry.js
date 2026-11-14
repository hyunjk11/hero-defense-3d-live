// Closed collision shapes shared by warning meshes and actual hits.
export const inCircle=(p,q,r)=>(p.x-q.x)**2+(p.z-q.z)**2<=r*r;
export function inCone(p,q,heading,range,angle){const x=p.x-q.x,z=p.z-q.z,d=Math.hypot(x,z);return d<=range&&(d<1e-6||(x*Math.sin(heading)+z*Math.cos(heading))/d>=Math.cos(angle/2));}
export function inLine(p,a,b,width){const x=b.x-a.x,z=b.z-a.z,l=x*x+z*z;if(!l)return inCircle(p,a,width);const t=((p.x-a.x)*x+(p.z-a.z)*z)/l;return t>=0&&t<=1&&Math.hypot(p.x-a.x-t*x,p.z-a.z-t*z)<=width;}
export const inRing=(p,q,outer,inner)=>inCircle(p,q,outer)&&!inCircle(p,q,inner);
export function wardTargets(source,enemies,range,n){return enemies.filter(e=>e!==source&&!e.dead&&e.dying===undefined&&!e.E.child&&!(e.shield>0)&&inCircle(e.g.position,source.g.position,range)).sort((a,b)=>a.hp/a.max-b.hp/b.max).slice(0,n);}
export function summonRoom(enemies,type,cap,count){return Math.min(count,Math.max(0,cap-enemies.filter(e=>!e.dead&&e.type===type).length));}
