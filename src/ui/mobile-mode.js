const origin = 'https://hyunjk11.github.io';
const path = '/hero-defense-3d-live';

export function isMobilePage(url) {
  if (!url || url.origin !== origin || ![path + '/', path + '/index.html'].includes(url.pathname)) return false;
  return new URLSearchParams(url.search).get('mobileApp') === '1';
}

export const mobileApp = isMobilePage(globalThis.location);
