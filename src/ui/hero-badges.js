// Shapes, numbers and accessible labels carry the meaning independently of color.
const shapes={level:'M12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8Z',hp:'M12 21C8 17 2 13 2 8C2 2 9 1 12 6C15 1 22 2 22 8C22 13 16 17 12 21Z',atk:'M15 2 22 2 22 9 10 19 5 14ZM4 11 13 20M3 21 7 17'};
const labels={level:'영웅 레벨',hp:'체력 강화',atk:'공격 강화'};
export function heroBadges(level,hp,atk){return `<span class="heroBadges">${Object.entries({level,hp,atk}).map(([k,v])=>{const n=Number.isSafeInteger(v)&&v>=0?v:'—',label=`${labels[k]} ${n==='—'?'확인 중':n}`;return `<span class="heroBadge ${k}" role="img" aria-label="${label}" title="${label}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="${shapes[k]}"/></svg><b>${n}</b></span>`;}).join('')}</span>`;}
