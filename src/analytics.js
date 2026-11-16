// Basic site usage only. No account, save, UI, or gameplay modules are imported.
// Deployment prerequisite: enhanced measurement and user-provided data collection
// are OFF in this GA web stream. See docs/analytics-privacy.md.
export const MEASUREMENT_ID = 'G-QZCC28G70N';
export const CANONICAL_URL = 'https://hyunjk11.github.io/hero-defense-3d-live/';
const MODE_PARAMS = new Set(['town', 'stage', 'run', 'hard', 'dungeon', 'spire', 'challenge', 'seed']);
const INIT_KEY = '__heroBasicAnalyticsStarted';
export function permittedLocation(href) {
  try {
    const u = new URL(href), canonical = new URL(CANONICAL_URL);
    return u.origin === canonical.origin && [canonical.pathname, canonical.pathname + 'index.html'].includes(u.pathname)
      && !u.hash && [...u.searchParams.keys()].every(key => MODE_PARAMS.has(key));
  } catch { return false; }
}
function analyticsDenied(layer) {
  // Preserve existing consent decisions, including region-specific denials.
  // Never manufacture an analytics_storage grant.
  return layer.some(command => command?.[0] === 'consent' && command?.[2]?.analytics_storage === 'denied');
}
export function initAnalytics(win = window, doc = document) {
  try {
    if (win[INIT_KEY] || win['ga-disable-' + MEASUREMENT_ID] || win.navigator?.globalPrivacyControl
      || win.navigator?.doNotTrack === '1' || !permittedLocation(win.location.href)) return false;
    const layer = win.dataLayer || [];
    if (!Array.isArray(layer) || analyticsDenied(layer)) return false;
    // Avoid adding a second configuration if another integration owns this tag.
    if (layer.some(command => command?.[0] === 'config' && command?.[1] === MEASUREMENT_ID)) return false;
    win[INIT_KEY] = true;
    win.dataLayer = layer;
    const gtag = win.gtag || function () { layer.push(arguments); };
    if (!win.gtag) win.gtag = gtag;
    const privacy = {
      page_location: CANONICAL_URL, page_title: 'Hero Defense', page_referrer: '',
      send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
      allow_enhanced_conversions: false, ads_data_redaction: true, url_passthrough: false,
    };
    gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    gtag('set', privacy);
    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID, privacy);
    gtag('event', 'page_view', { send_to: MEASUREMENT_ID, page_location: CANONICAL_URL, page_title: 'Hero Defense', page_referrer: '' });
    const script = doc.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
    script.onerror = () => {}; // Analytics is optional; never block or retry game startup.
    doc.head.appendChild(script);
    return true;
  } catch { return false; }
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') initAnalytics();
