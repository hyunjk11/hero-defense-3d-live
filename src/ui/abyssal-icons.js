// Presentation only: derive from the saved set/slot/hero, never item name or ID.
const star = (x,y,r=7) => `<path d="M${x} ${y-r}L${x+2} ${y-2}L${x+r} ${y}L${x+2} ${y+2}L${x} ${y+r}L${x-2} ${y+2}L${x-r} ${y}L${x-2} ${y-2}Z" fill="#edffff" stroke="#62dfff" stroke-width="1"/>`;
const shapes = {
 warrior:'<path d="M44 3L55 7L48 27L26 47L17 38L35 18Z"/><path d="M45 10L40 25L23 41" stroke="#9df3ff" stroke-width="3"/><path d="M11 32L38 48L33 54L6 38Z" fill="#688db4"/><path d="M17 43L7 57L12 61L23 48Z"/>',
 archer:'<path d="M19 3L43 13L49 25L39 32L49 39L43 51L19 61L27 46L35 39L30 32L35 25L27 18Z"/><path d="M19 3L27 32L19 61M5 32H58" fill="none" stroke="#c8faff"/><path d="M50 26L61 32L50 38Z" fill="#8deaff"/>',
 mage:'<path d="M16 60L33 26" stroke="#86a9ca" stroke-width="6"/><path d="M16 13L26 5L40 4L52 16L44 31L29 35L17 26L25 20Z"/><circle cx="34" cy="19" r="10" fill="#0c203e" stroke="#78dcff"/><path d="M26 41L20 49" stroke="#9b8aff" stroke-width="3"/>',
 gunner:'<path d="M3 10H44L52 17L46 25H24L19 41H8L12 24H3Z"/><path d="M23 34H55L62 41L55 49H42L37 61H27L31 47H23Z"/><path d="M8 16H43M29 40H54" stroke="#8ceaff" stroke-width="4"/><path d="M18 28L14 36M37 51L34 57" stroke="#9481cd" stroke-width="3"/>',
 fighter:'<path d="M11 19L21 10L27 17L33 7L40 17L49 12L55 27L47 42L46 59H18L17 43L8 31Z"/><path d="M12 23L20 21L25 32L33 20L40 31L49 23" fill="none" stroke="#9df3ff" stroke-width="3"/><path d="M19 47H46V54H19Z" fill="#537ca5"/>',
 armor:'<path d="M22 9L31 16H35L43 9L59 20L48 34L43 29L48 58H16L21 29L15 34L3 20Z"/><path d="M4 18L12 6L26 18L18 28ZM38 18L52 6L60 18L46 28Z" fill="#557ea6"/><path d="M21 37L32 44L43 37M20 48L32 55L44 48" fill="none" stroke="#8bcdf2" stroke-width="2"/>',
 acc:'<path d="M16 4Q7 19 23 29M48 4Q57 19 41 29" fill="none" stroke="#9db8d8" stroke-width="3"/><path d="M32 18L48 28L50 43L32 60L14 43L16 28Z"/><ellipse cx="32" cy="39" rx="20" ry="8" fill="none" stroke="#88dfff" stroke-width="2" transform="rotate(-28 32 39)"/><path d="M32 24L42 37L32 52L22 37Z" fill="#5b52a0"/>'
};
const cores={warrior:[39,24],archer:[37,32],mage:[34,19],gunner:[23,20],fighter:[32,38],armor:[32,28],acc:[32,37]};
const labels={warrior:'성운 대검',archer:'궤도 활',mage:'별고리 지팡이',gunner:'쌍성 권총',fighter:'성핵 권갑',armor:'별빛 흉갑',acc:'공명석'};
export function abyssalIcon(it){
 if(it?.set!=='abyssal')return null;
 const key=it.s==='weapon'?it.h:it.s;if(!Object.hasOwn(shapes,key))return null;
 return `<svg class="abyssalItemIcon" viewBox="0 0 64 64" role="img" aria-label="심연의 별 ${labels[key]}" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="29" fill="#10213c"/><circle cx="32" cy="32" r="26" fill="none" stroke="#44729c" stroke-dasharray="2 6"/><g fill="#243957" stroke="#b5dafa" stroke-width="1.6" stroke-linejoin="round">${shapes[key]}</g>${star(...cores[key])}<path d="M3 13V3H13M51 3H61V13M3 51V61H13M51 61H61V51" fill="none" stroke="#87dfff" stroke-width="1.5"/></svg>`;
}
