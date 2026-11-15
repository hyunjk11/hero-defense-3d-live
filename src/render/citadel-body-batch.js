import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared geometry is opt-in and scoped to the caller's ownership registry callback.
// No eviction: live meshes can still reference cached shared geometry. Once full,
// new signatures fall back to owned geometry; they are never marked shared.
const SHARED_CACHES = new WeakMap();
const PER_SOURCE_LIMIT = 32, TOTAL_LIMIT = 128;
function geometryCache(shareGeometry, source) {
  if (typeof shareGeometry !== 'function') return null;
  let state = SHARED_CACHES.get(shareGeometry);
  if (!state) SHARED_CACHES.set(shareGeometry, state = { sources: new WeakMap(), count: 0 });
  let entries = state.sources.get(source);
  if (!entries) state.sources.set(source, entries = new Map());
  return { state, entries };
}

// Caller guarantees these sibling bodies are static and their source
// geometries are borrowed/shared. Animated Groups remain untouched. New merged
// geometries are owned by the returned scene graph (disposeObj/disposeOwned).
// Exclude any individually animated/referenced mesh through excludeMeshes.
export function batchCitadelBodies(root, { excludeMeshes = new Set(), shareGeometry } = {}) {
  const parents = [];
  root.traverse(o => { if (!o.isMesh) parents.push(o); });
  let bodiesRemoved = 0, batches = 0;
  for (const parent of parents) {
    const groups = [];
    for (const m of parent.children) {
      if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || m.userData.ol ||
          excludeMeshes.has(m) || !m.visible || Array.isArray(m.material) ||
          m.morphTargetInfluences || m.children.length !== 1 || !m.children[0].userData.ol) continue;
      if (m.matrixAutoUpdate) m.updateMatrix();
      if (!(m.matrix.determinant() > 0)) continue; // Do not change winding/degenerate scale.
      const o = m.children[0];
      if (!o.isMesh || o.children.length) continue;
      let list = groups.find(g => { const x = g[0]; return x.geometry === m.geometry &&
        x.material === m.material && x.castShadow === m.castShadow &&
        x.receiveShadow === m.receiveShadow && x.renderOrder === m.renderOrder &&
        x.layers.mask === m.layers.mask && x.frustumCulled === m.frustumCulled; });
      if (!list) groups.push(list = []);
      list.push(m);
    }
    for (const parts of groups) {
      if (parts.length < 2) continue;
      // Sources must be immutable shared geometry. Exact matrix values (not rounded)
      // distinguish dimensions; material is intentionally excluded to retain each
      // enemy's independently flashed/tinted material while sharing only geometry.
      const cache = geometryCache(shareGeometry, parts[0].geometry);
      const signature = cache ? parts.map(m => m.matrix.elements.join(',')).join(';') : null;
      let geometry = cache?.entries.get(signature);
      const copies = [];
      if (!geometry) {
      try {
        for (const m of parts) copies.push(m.geometry.clone().applyMatrix4(m.matrix));
        geometry = mergeGeometries(copies, false);
      } finally { for (const g of copies) g.dispose(); }
      if (!geometry) continue; // Fail closed: keep all source objects.
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      if (cache && cache.entries.size < PER_SOURCE_LIMIT && cache.state.count < TOTAL_LIMIT) {
        try { shareGeometry(geometry); } catch (error) { geometry.dispose(); throw error; }
        cache.entries.set(signature, geometry); cache.state.count++;
      }
      }
      const first = parts[0], merged = new THREE.Mesh(geometry, first.material);
      merged.name = 'citadel-static-bodies'; merged.userData.citadelBodyBatch = true;
      merged.castShadow = first.castShadow; merged.receiveShadow = first.receiveShadow;
      merged.renderOrder = first.renderOrder; merged.layers.mask = first.layers.mask;
      merged.frustumCulled = first.frustumCulled;
      for (const m of parts) {
        const outline = m.children[0];
        if (outline.matrixAutoUpdate) outline.updateMatrix();
        // Retain the source local scale for shader extrusion; baking the outline
        // vertices would silently alter outline thickness under nonuniform scale.
        const matrix = new THREE.Matrix4().multiplyMatrices(m.matrix, outline.matrix);
        parent.add(outline); outline.matrix.copy(matrix); outline.matrixAutoUpdate = false;
        outline.matrixWorldNeedsUpdate = true;
        parent.remove(m);
      }
      parent.add(merged); batches++; bodiesRemoved += parts.length - 1;
    }
  }
  return { batches, bodiesRemoved };
}
