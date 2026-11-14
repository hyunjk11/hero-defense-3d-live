import { VISIBLE_HEROES, heroLabel } from './heroes.js';

// A row, never a grade or an arbitrary item definition. Paid weapons do not grant hero ownership.
export const REPEAT_ROWS = [...VISIBLE_HEROES, 'armor', 'acc'];
export const cleanTarget = value => typeof value === 'string' && REPEAT_ROWS.includes(value) ? value : null;
export const validTarget = value => value == null || !!cleanTarget(value);
export const targetGear = row => {
  row = cleanTarget(row);
  return row ? row === 'armor' || row === 'acc' ? { s: row } : { s: 'weapon', h: row } : null;
};

export const targetLabel = row => cleanTarget(row) ? row === 'armor' ? '방어구' : row === 'acc' ? '장신구' : heroLabel(row) + ' 무기' : '무작위';
