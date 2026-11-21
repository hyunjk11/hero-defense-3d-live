// Integrate over fixed ticks: legacy linear heat or a delayed quadratic Hard ramp.
export const BEAM_STEP = .2;
export function beamHeatIntegral(age, dt, warmup, maximum, delayed=false) {
  const w=Math.max(.01,warmup),r=maximum-1;
  if(!delayed){
    const area=t=>{const a=Math.max(0,t);return a<=w?a+r*a*a/(2*w):w+r*w/2+(a-w)*maximum;};
    return area(age+dt)-area(age);
  }
  const area=t=>{
    const a=Math.max(0,t),u=Math.min(a,w),ramp=u/w;
    return u+r*u*ramp*ramp/3+Math.max(0,a-w)*maximum;
  };
  return area(age+dt)-area(age);
}
export function beamTouches(a,b,p,radius=.65) {
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,l=dx*dx+dy*dy+dz*dz;
  if(l<1e-9)return false;
  const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/l));
  return (p.x-a.x-dx*u)**2+(p.y-a.y-dy*u)**2+(p.z-a.z-dz*u)**2<=radius*radius;
}
// Basic cut goes left-to-right, then resets during a brief dark recovery.
// Lv5 keeps emitting on the return sweep rather than resetting invisibly.
export function beamSweepAt(age, returning=false) {
  const travel=2.4,cycle=returning?travel*2:travel+.45,t=((age%cycle)+cycle)%cycle;
  return {active:returning||t<travel,offset:(returning&&t>travel?1-(t-travel)/travel:t/travel)*1.0-.5};
}
