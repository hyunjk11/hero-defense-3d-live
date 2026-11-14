const rows={archer:'장궁',mage:'마법홀',warrior:'대검',gunner:'쌍총',mechanic:'파쇄암',fighter:'권갑',armor:'갑주',acc:'목걸이'};
const shapes={
 archer:'<path d="M13 8Q51 32 13 56L22 32Z"/><path d="M15 8L31 32L15 56M8 32H57" fill="none" stroke-width="3"/><path d="M49 26L59 32L49 38Z"/>',
 mage:'<path d="M17 59L31 29L36 32L23 62Z"/><path d="M29 6L43 4L53 19L41 35L24 26L20 13Z"/><path d="M32 11L42 11L46 20L39 28L29 23Z" class="egCore"/>',
 warrior:'<path d="M47 3L58 12L29 47L17 37Z"/><path d="M11 33L35 50L30 56L7 40Z"/><path d="M16 44L8 61L3 57L10 40Z"/><path d="M47 11L24 38" fill="none" stroke-width="3"/>',
 gunner:'<path d="M4 12H52V27H27L20 46H8L14 26H4Z"/><path d="M33 37H60V49H49L44 61H33L38 49H28Z"/><path d="M30 17H56M43 42H62" fill="none" stroke-width="4"/>',
 mechanic:'<path d="M13 23L45 19L55 40L43 59H17L6 43Z"/><path d="M24 26L23 14L34 3L48 14L39 29Z"/><path d="M20 36L40 31L45 43L30 52L16 43Z" class="egCore"/>',
 fighter:'<path d="M13 21H51L56 38L46 49V59H17V47L7 36Z"/><path d="M14 24L14 9L23 4L27 24M28 23L30 3L39 5L40 25M41 25L47 8L55 12L51 30"/><path d="M19 48H45" fill="none" stroke-width="4"/>',
 armor:'<path d="M19 7L31 14L44 7L61 19L53 34L46 30L50 58H14L18 30L9 35L2 19Z"/><path d="M23 29L32 23L42 30L38 46H26Z" class="egCore"/>',
 acc:'<path d="M12 3Q14 22 29 28M52 3Q50 22 35 28" fill="none" stroke-width="3"/><path d="M32 24L52 39L44 59H20L12 39Z"/><path d="M32 31L42 41L36 52H27L22 41Z" class="egCore"/>'
};
export function endgameIcon(it){if(![9,10].includes(+it?.c))return null;const row=it.s==='weapon'?it.h:it.s;if(!shapes[row])return null;const abyss=+it.c===9,body=abyss?'#796295':'#ad6141',edge=abyss?'#d7bee8':'#efc393',core=abyss?'#8fe8da':'#ffbd59';
 return `<svg class="endgameItemIcon" viewBox="0 0 64 64" role="img" aria-label="${abyss?'균열 봉인':'용화'} ${rows[row]}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="57" rx="26" ry="5" fill="#282238" opacity=".4"/><g fill="${body}" stroke="${edge}" stroke-width="1.5" stroke-linejoin="round">${shapes[row].replaceAll('class="egCore"',`fill="${core}"`)}</g>${abyss?`<circle cx="32" cy="32" r="7" fill="none" stroke="${core}" stroke-width="2"/>`:`<path d="M24 31L21 21L30 28L34 28L43 21L40 32L32 39Z" fill="${core}"/>`}${it.g>=3?`<path d="M2 13V2H13M51 2H62V13M2 51V62H13M51 62H62V51" fill="none" stroke="${edge}" stroke-width="2"/>`:''}</svg>`;
}
