const d2 = (a,b) => (a.x-b.x)**2+(a.z-b.z)**2;
export const inStormCircle = (p,c,r) => d2(p,c) <= r*r;
export const inStormRing = (p,c,inner,outer) => d2(p,c) >= inner*inner && d2(p,c) <= outer*outer;
// IDs are entity references: a chain never visits an entity twice, including its primary hit.
export function stormChain(start, candidates, range, jumps, excluded = new Set()) {
  const seen = new Set(excluded), chain = []; let from = start;
  for(let i=0;i<jumps;i++) {
    const next=candidates.filter(c=>!seen.has(c.id)&&inStormCircle(c,from,range)).sort((a,b)=>d2(a,from)-d2(b,from))[0];
    if(!next)break;chain.push(next);seen.add(next.id);from=next;
  }
  return chain;
}
