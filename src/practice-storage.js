// Runs before every module: practice writes stay in page memory, including direct Storage users.
(() => {
  if (new URLSearchParams(location.search).get('practice') !== '1') return;
  try {
    for (const name of ['localStorage', 'sessionStorage']) {
      const source = window[name], values = new Map();
      for (let i = 0; i < source.length; i++) { const k = source.key(i); values.set(k, source.getItem(k)); }
      const memory = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
        getItem: k => values.get(String(k)) ?? null, setItem: (k, v) => values.set(String(k), String(v)),
        removeItem: k => values.delete(String(k)), clear: () => values.clear() };
      Object.defineProperty(window, name, { value: memory, configurable: false });
    }
    window.practiceStorageReady = true;
  } catch { window.practiceStorageReady = false; }
})();
