import assert from 'node:assert/strict';
import { readFile, appendFile } from 'node:fs/promises';
import { chromium } from '../.analytics-qa/node_modules/playwright/index.mjs';

const CANONICAL = 'https://hyunjk11.github.io/hero-defense-3d-live/';
const MID = 'G-QZCC28G70N';
const source = await readFile('src/analytics.js', 'utf8');
const HTML = '<!doctype html><html><head><title>QA document marker</title><script type="module" src="./src/analytics.js"></script></head><body style="min-height:2400px"><form onsubmit="event.preventDefault()"><input id="field" name="qa_field"><button id="submit">Check</button></form><p id="ready">Game shell ready</p></body></html>';
const browser = await chromium.launch({ headless: true });
const results = [];
const allowedEvents = new Set(['page_view', 'session_start', 'first_visit', 'user_engagement']);

function validateRequest(request) {
  const url = new URL(request.url());
  const records = (request.postData() || '').split('\n').filter(Boolean);
  if (!records.length) records.push('');
  return records.map(body => {
    const fields = new URLSearchParams(url.search);
    for (const [key, value] of new URLSearchParams(body)) fields.set(key, value);
    assert.equal(fields.get('tid'), MID, 'Unexpected measurement destination');
    assert.equal(fields.get('dl'), CANONICAL, 'Unexpected page location');
    assert.equal(fields.get('dt'), 'Hero Defense', 'Unexpected page title');
    assert.ok(!fields.get('dr'), 'Unexpected referrer');
    assert.ok(allowedEvents.has(fields.get('en')), 'Unexpected event type');
    for (const [key, value] of fields) {
      assert.ok(!/^(uid|user_id|user_data|email|nickname|game_account_id|em|ph|_ud|ud)$/i.test(key), 'Identity field prohibited');
      assert.ok(!/^(up|upn|ep|epn)\./.test(key), 'Custom event/user properties prohibited');
      assert.ok(!/qa-field-marker|QA document marker|nickname-marker|email-marker|access_token/i.test(value), 'Fixture data prohibited');
    }
    return {
      event: fields.get('en'), canonicalLocation: true, fixedTitle: true,
      noReferrer: true, noIdentityFields: true,
      hasAnonymousClientId: !!fields.get('cid'),
      hasSessionId: !!fields.get('sid'),
      hasDeviceResolution: !!fields.get('sr'),
    };
  });
}

async function verify(mode) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const collections = [], failures = [], responses = [];
  let loaderRequests = 0;
  const live = mode === 'live';
  const blockLoader = mode === 'loader-failure';
  await context.route('**/*', async route => {
    const request = route.request(), u = new URL(request.url());
    if (u.href === CANONICAL) return route.fulfill({ status: 200, contentType: 'text/html', body: HTML });
    if (u.href === CANONICAL + 'src/analytics.js') return route.fulfill({ status: 200, contentType: 'text/javascript', body: source });
    if (u.origin === 'https://www.googletagmanager.com' && u.pathname === '/gtag/js' && u.searchParams.get('id') === MID) {
      loaderRequests++;
      if (blockLoader) return route.abort();
      if (request.headers().referer) {
        failures.push('Loader carried a referrer');
        return route.abort();
      }
      return route.continue();
    }
    if (u.protocol === 'https:' && /(^|\.)google-analytics\.com$/.test(u.hostname) && u.pathname === '/g/collect') {
      try {
        const records = validateRequest(request);
        if (request.headers().referer && request.headers().referer !== 'https://hyunjk11.github.io/') {
          throw Error('Unexpected transport referrer');
        }
        collections.push(...records);
        if (!live) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        return route.continue();
      } catch (error) {
        failures.push(error.message);
        return route.abort();
      }
    }
    if (u.pathname.endsWith('/favicon.ico')) return route.fulfill({ status: 204 });
    failures.push('Unexpected external request to ' + u.hostname + u.pathname);
    return route.abort();
  });
  page.on('response', response => {
    const u = new URL(response.url());
    if (/(^|\.)google-analytics\.com$/.test(u.hostname) && u.pathname === '/g/collect') responses.push(response.status());
  });
  page.on('pageerror', () => failures.push('Uncaught browser error'));
  try {
    await page.goto(CANONICAL, { waitUntil: 'load', timeout: 45000 });
    await page.locator('#ready').waitFor();
    if (blockLoader) {
      await page.waitForTimeout(1000);
      assert.equal(collections.length, 0, 'No collections after loader failure');
      assert.equal(loaderRequests, 1, 'No loader retry');
    } else {
      await page.waitForFunction(() => !!window.google_tag_manager, null, { timeout: 45000 });
      await page.locator('#field').fill('qa-field-marker');
      await page.locator('#submit').click();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const deadline = Date.now() + 45000;
      while (!collections.some(x => x.event === 'page_view') && failures.length === 0 && Date.now() < deadline) await page.waitForTimeout(250);
      await page.waitForTimeout(3000);
      assert.equal(collections.filter(x => x.event === 'page_view').length, 1, 'Exactly one page_view');
      assert.equal(loaderRequests, 1, 'Exactly one loader');
      assert.ok(collections[0].hasAnonymousClientId, 'Standard anonymous client ID required');
      assert.ok(collections[0].hasSessionId, 'Standard session ID required');
      assert.ok(collections[0].hasDeviceResolution, 'Standard device resolution required');
      if (live) assert.ok(responses.some(status => status >= 200 && status < 300), 'Google collection endpoint must acknowledge a request');
    }
    assert.deepEqual(failures, [], 'Network privacy or browser errors');
    results.push({ mode, passed: true, loaderRequests, collections, statuses: live ? responses : [], actualGoogleCollection: live });
  } finally {
    await context.close();
  }
}

try {
  await verify('loader-failure');
  await verify('intercepted');
  await verify('live');
  const summary = { sourceCommit: '1d38bcb6e5a93e7aca7232af5b9e150f3f2ee679', measurementId: MID, results };
  console.log(JSON.stringify(summary, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, '### Analytics verification\n\n\`\`\`json\n' + JSON.stringify(summary, null, 2) + '\n\`\`\`\n');
} finally {
  await browser.close();
}
