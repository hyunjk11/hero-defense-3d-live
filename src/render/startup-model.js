// Only PC startup uses this bounded path; in-game and mobile loading keep their existing path.
export const STARTUP_MODEL_TIMEOUT_MS = 12000;

// Each GLB parse owns its resources; a timed-out parse can still finish in Three.js.
function disposeLateModel(model) {
  const objects = new Set(), images = new Set();
  for (const scene of model?.scenes ?? (model?.scene ? [model.scene] : [])) scene.traverse(node => {
    if (node.geometry) objects.add(node.geometry);
    if (node.skeleton) objects.add(node.skeleton);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      objects.add(material);
      for (const value of Object.values(material)) {
        if (!value?.isTexture) continue;
        objects.add(value);
        if (typeof value.source?.data?.close === 'function') images.add(value.source.data);
      }
    }
  });
  for (const object of objects) object.dispose?.();
  for (const image of images) image.close();
}

export async function loadStartupModel(loader, path, {
  base = globalThis.location.href, fetchModel = globalThis.fetch,
  timeout = STARTUP_MODEL_TIMEOUT_MS,
} = {}) {
  const url = new URL(path, base);
  const resourcePath = new URL('.', url).href;

  async function attempt(cache) {
    const request = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('Startup model timed out: ' + path);
        reject(error);
        request.abort();
      }, timeout);
    });
    const load = async () => {
      const response = await fetchModel(url.href, { signal: request.signal, cache });
      if (!response.ok) throw new Error('Startup model HTTP ' + response.status + ': ' + path);
      const data = await response.arrayBuffer();
      request.signal.throwIfAborted();
      const model = await loader.parseAsync(data, resourcePath);
      if (request.signal.aborted) disposeLateModel(model);
      request.signal.throwIfAborted();
      return model;
    };
    try { return await Promise.race([deadline, load()]); }
    finally { clearTimeout(timer); }
  }

  try { return await attempt('default'); }
  catch { return attempt('reload'); }
}
