import assert from 'node:assert/strict';
import { readFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = 'https://hyunjk11.github.io/hero-defense-3d-live/';
const suffix = '?qa=deployment-1d38bcb';
const options = { headers: { 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(30000) };
const [indexResponse, analyticsResponse] = await Promise.all([
  fetch(base + suffix, options),
  fetch(base + 'src/analytics.js' + suffix, options),
]);
assert.equal(indexResponse.status, 200, 'Production HTML must return HTTP 200');
assert.equal(analyticsResponse.status, 200, 'Production analytics module must return HTTP 200');
const [html, actual, expected] = await Promise.all([
  indexResponse.text(), analyticsResponse.text(), readFile('src/analytics.js', 'utf8'),
]);
const tags = html.match(/<script\b[^>]*\bsrc=["']\.\/src\/analytics\.js["'][^>]*>/g) || [];
assert.equal(tags.length, 1, 'Exactly one analytics module is wired into production');
assert.match(tags[0], /\btype=["']module["']/, 'Analytics must load as a module');
assert.equal(actual, expected, 'Production analytics must exactly match the verified source');
assert.match(html, /<div id="app"><\/div>/, 'Game entry point is preserved');
const result = {
  passed: true,
  sourceCommit: '1d38bcb6e5a93e7aca7232af5b9e150f3f2ee679',
  productionUrl: base,
  htmlStatus: indexResponse.status,
  analyticsStatus: analyticsResponse.status,
  analyticsModuleTags: tags.length,
  exactVerifiedSource: true,
  sourceSha256: createHash('sha256').update(actual).digest('hex'),
  executesBrowserScripts: false,
};
console.log(JSON.stringify(result, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, '### Production deployment verification\n\n\`\`\`json\n' + JSON.stringify(result, null, 2) + '\n\`\`\`\n');
