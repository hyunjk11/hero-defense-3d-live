import { ls } from '../core/store.js';

// ls intentionally tolerates unavailable storage; transactions must not do that.
export function durableSet(key, value) {
  ls.set(key, value);
  if (ls.get(key) !== value) throw new Error('기기에 진행 기록을 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.');
}
