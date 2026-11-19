import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const input = read('../src/ui/input.js');
const begin = input.indexOf('function zoomCamera(');
const handlers = input.slice(begin, input.indexOf("\naddEventListener('keydown'", begin));
function setup() {
  const node = () => ({ addEventListener(name, callback) { this[name] = callback; } });
  const cam = { r: 58, theta: .22, phi: .9 }, cvs = node(), zoomIn = node(), zoomOut = node();
  vm.runInNewContext(handlers, { cam, cvs, $: id => ({ zoomIn, zoomOut })[id], Snd: { play() {} } });
  return { cam, cvs, zoomIn, zoomOut };
}
test('camera controls are labeled native buttons between rotation and settings', () => {
  const toolbar = read('../index.html').match(/id="camTop"[^>]*>(.*?)<\/div>/)[1];
  assert.match(toolbar, /id="rotR".*type="button" id="zoomIn" aria-label="카메라 확대".*>\+<.*type="button" id="zoomOut" aria-label="카메라 축소".*>−<.*id="sndBtn"/);
});
test('zoom buttons and scrolling share a radius and limits, leaving rotation unchanged', () => {
  const { cam, cvs, zoomIn, zoomOut } = setup();
  zoomIn.onclick(); assert.equal(cam.r, 52);
  cvs.wheel({ deltaY: 100 }); assert.equal(cam.r, 55);
  zoomOut.onclick(); assert.equal(cam.r, 61);
  for (let i = 0; i < 40; i++) zoomOut.onclick();
  assert.equal(cam.r, 90);
  cvs.wheel({ deltaY: -10000 }); assert.equal(cam.r, 14);
  zoomIn.onclick(); assert.deepEqual(cam, { r: 14, theta: .22, phi: .9 });
  cvs.wheel({ deltaY: 10000 }); assert.equal(cam.r, 90);
});
test('focused zoom buttons keep native Space activation out of battle shortcuts', () => {
  const { zoomIn, zoomOut } = setup();
  for (const button of [zoomIn, zoomOut]) {
    let stopped = 0;
    for (const key of [' ', 'Tab']) button.keydown({ key, stopPropagation() { stopped++; } });
    assert.equal(stopped, 1);
  }
});
