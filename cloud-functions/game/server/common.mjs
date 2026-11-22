import { BOSS_SETS, MORVIA_HEROES } from '../src/data/boss-sets.js';
// Supplied only by private runtime configuration; never by a request or browser.
export function getPrivateOwnerEmail() {
  const value=globalThis.process?.env?.HD3D_OWNER_EMAIL;
  return typeof value==='string' && value===value.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? value.toLowerCase() : '';
}
export const PREFIX = 'hd3d_';
export const table = name => PREFIX + name;
export const failure = (reason, extra = {}) => ({ ok: false, reason, ...extra });
export function denied(message = 'forbidden', code = '42501') { throw Object.assign(new Error(message), { code }); }
export const integer = (v, min = 0, max = 1000000) => Math.min(max, Math.max(min, Number.isFinite(+v) ? Math.floor(+v) : min));
export const text = (v, max = 1000) => String(v ?? '').slice(0, max);
export const reason = v => { const s = text(v, 201).trim(); return s.length >= 1 && s.length <= 200 ? s : null; };
export const newest = rows => rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || (b.id || 0) - (a.id || 0));
export const day = ms => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
export function week(ms) { const d = new Date(day(ms) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); }
export const shiftDay = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const paidHeroes = ['gunner', 'mechanic', 'fighter'];
export const heroes = ['warrior', 'archer', 'mage', ...paidHeroes];
export const itemNames = { hero_gunner: '총사 로즈', hero_mechanic: '메카닉 버들', hero_fighter: '격투가 서윤' };
export const itemReward = item => typeof item === 'string' && item !== 'hero_mechanic' && Object.hasOwn(itemNames, item) ? { hero: item.slice(5) } : null;
export function validItem(x) {
  return !!x && typeof x === 'object' && !Array.isArray(x) && x.k === 'gear' && Object.keys(x).every(k => ['k','s','h','g','c','set'].includes(k))
    && ['weapon','armor','acc'].includes(x.s) && Number.isInteger(x.g) && x.g >= 0 && x.g <= 4
    && (x.s === 'weapon' ? heroes.includes(x.h) : !('h' in x))
    && (!('c' in x) || Number.isInteger(x.c) && x.c >= 1 && x.c <= 10)
    && (!('set' in x) || Object.hasOwn(BOSS_SETS, x.set) && x.g === BOSS_SETS[x.set].grade && !('c' in x) && (x.s !== 'weapon' || MORVIA_HEROES.includes(x.h)));
}
export function validReward(r, { legacy = true } = {}) {
  if (r == null) return true;
  if (typeof r !== 'object' || Array.isArray(r) || Object.keys(r).some(k => !['souls','steel','crystal','hero','essence','items','medals'].includes(k))) return false;
  for (const k of ['souls','steel','crystal','essence','medals']) if (k in r && (!Number.isInteger(r[k]) || r[k] < 0 || r[k] > (['essence','medals'].includes(k) ? 10000 : 1000000))) return false;
  return (!('hero' in r) || paidHeroes.includes(r.hero) && (legacy || r.hero !== 'mechanic')) && (!('items' in r) || Array.isArray(r.items) && r.items.length >= 1 && r.items.length <= 10 && r.items.every(x=>validItem(x)&&(legacy||x.h!=='mechanic')));
}
export async function context(tx, user, { now = Date.now(), random = Math.random, uuid = () => crypto.randomUUID() } = {}) {
  if (!user?.id) denied('not authenticated');
  const uid = user.id, iso = new Date(now).toISOString();
  const c = { tx, uid, user, now, iso, random, uuid, day: day(now), week: week(now),
    get: (t, id) => tx.get(table(t), String(id)),
    list: (t, filters = {}) => tx.list(table(t), filters),
    mailWindow: tx.mailWindow ? (filters,options) => tx.mailWindow(filters,options) : null,
    put: (t, row) => tx.put(table(t), row),
    insert: (t, row) => tx.insert(table(t), { created_at: iso, ...row }),
    remove: (t, id) => tx.remove(table(t), String(id)),
  };
  [c.adminRow, c.ban] = await Promise.all([c.get('admins', uid), c.get('bans', uid)]);
  const expectedOwner=getPrivateOwnerEmail();
  c.admin = !!c.adminRow && !c.ban && (!c.adminRow.owner || !!expectedOwner && String(user.email || '').toLowerCase() === expectedOwner); c.owner = c.admin && !!c.adminRow.owner;
  c.requireAdmin = () => { if (!c.admin) denied(); };
  c.requireOwner = () => { if (!c.owner) denied(); };
  c.requirePlayer = () => { if (c.ban) denied('banned'); };
  c.wallet = async (id = uid) => await c.get('dungeon_wallet', id) || { user_id: id, medals: 0, earned: 0, spent: 0, titles: [], uniques: [], uq_pity: 0, updated_at: iso };
  c.mail = async (id, title, body, reward = null, extra = {}) => c.insert('mail', { user_id: id, title, body, reward, claimed: false, claimed_at: null, revoked: false, order_id: null, broadcast_id: null, ...extra });
  c.log = async (action, id, detail = null) => { const target = id ? await c.get('users', id) : null; return c.insert('admin_log', { admin_id: uid, admin_email: user.email || '', target_user: id, target_email: target?.email || null, action, detail }); };
  return c;
}
