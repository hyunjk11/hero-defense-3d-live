const bones = 'fill="#ded6e8" stroke="#514163" stroke-width="2" stroke-linejoin="round"';
const shapes = {
  warrior: `<path d="M42 4L53 7L48 27L27 46L18 38L35 17Z" ${bones}/><path d="M43 10L40 24L24 40" stroke="#a47af0" stroke-width="4"/><path d="M10 31L37 49L32 54L6 37Z" fill="#9574b4"/><path d="M18 43L8 58L3 54L13 39" fill="#40314e"/>`,
  archer: `<path d="M18 4Q59 16 35 32Q59 48 18 60L24 46Q42 41 27 32Q42 23 24 18Z" ${bones}/><path d="M18 4V60M7 32H56" fill="none" stroke="#c193fa" stroke-width="2"/><path d="M48 27L59 32L48 37Z" fill="#a878df"/>`,
  mage: `<path d="M15 59L32 24" stroke="#d6ccdf" stroke-width="6"/><path d="M20 21L14 8L28 14L33 2L39 14L52 8L46 26Z" ${bones}/><path d="M26 23Q23 40 35 39Q49 35 41 21Z" fill="#9870cc"/><path d="M31 19Q43 25 35 34Q27 31 31 19Z" fill="#a2f4e1"/>`,
  gunner: `<path d="M5 13H49L54 21L49 28H25L21 43H10L14 27H5Z" ${bones}/><path d="M9 18H47M28 15V28M36 15V28" stroke="#9165b9" stroke-width="3"/><path d="M30 40L55 34L61 42L47 49L43 61L33 57L37 46Z" fill="#b5a2c9"/><circle cx="25" cy="26" r="4" fill="#a2f4e1"/>`,
  fighter: `<path d="M15 29L19 18L40 18L49 30L44 43V58H19V44L10 36Z" fill="#473253"/><path d="M17 28L14 8L25 21L31 25L32 5L39 23L45 29L53 12L50 36Z" ${bones}/><path d="M19 47H44V54H19Z" fill="#9470b6"/><path d="M25 29L37 25L40 35L32 43L23 35Z" fill="#a2f4e1"/>`,
  armor: `<path d="M21 9L30 16H35L43 9L59 20L48 35L44 29L48 57H16L20 29L15 35L3 20Z" fill="#41304f"/><path d="M21 13L9 7L4 22L18 29L28 22ZM43 13L55 7L60 22L46 29L36 22Z" ${bones}/><path d="M23 31L32 35L41 31M22 38L32 42L42 38M21 45L32 49L43 45" fill="none" stroke="#c7b6d5" stroke-width="3"/><path d="M28 20L36 20L39 28L32 34L25 28Z" fill="#a2f4e1"/>`,
  acc: `<path d="M13 5Q7 28 24 32M51 5Q57 28 40 32" fill="none" stroke="#c8b4df" stroke-width="3"/><path d="M12 29L23 36L32 23L41 36L52 29L47 52H17Z" ${bones}/><path d="M19 46H45V54H19Z" fill="#9670bc"/><path d="M32 33L39 41L32 50L25 41Z" fill="#a2f4e1"/>`,
};
export function morviaIcon(it) {
  if (it?.set !== 'morvia') return null;
  const shape = shapes[it.s === 'weapon' ? it.h : it.s]; if (!shape) return null;
  return `<svg class="morviaItemIcon" viewBox="0 0 64 64" role="img" aria-label="모르비아 세트" xmlns="http://www.w3.org/2000/svg"><ellipse cx="32" cy="56" rx="25" ry="6" fill="#251634" opacity=".5"/>${shape}</svg>`;
}
