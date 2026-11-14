import assert from 'node:assert/strict';
import * as H from '../src/data/hero-growth.js';
import * as P from '../src/account/progress.js';
import { affordableLevel,growthPreview } from '../src/ui/growth-preview.js';
const save=P.empty(),g=H.initialGrowth();
for(const balance of [0,99,100,101,240,900,51939,51940,100000]) {
 g.balance=balance;const l=affordableLevel(g,'mage');assert.ok(H.totalXP(l)<=balance);
 if(l<50)assert.ok(H.totalXP(l+1)>balance);
 const p=growthPreview(save,g,'mage',l);assert.equal(p.after.dmg,34*(1+.012*(l-1)));
 assert.equal(p.before.dmg,34);assert.equal(g.xp.mage,0,'preview never spends XP');
}
g.xp.mage=H.totalXP(49);g.balance=2019;assert.equal(affordableLevel(g,'mage'),49);g.balance=2020;assert.equal(affordableLevel(g,'mage'),50);
assert.equal(growthPreview(save,g,'mage',50).quote.cost,2020);
for(const target of [NaN,Infinity,1.5,-1,51])assert.equal(growthPreview(save,g,'mage',target).quote.ok,false);
g.xp.mage=H.totalXP(50);assert.equal(growthPreview(save,g,'mage',50).quote.reason,'max');
console.log('Affordable maximum, exact/insufficient balance, level cap and actual stat previews passed.');
