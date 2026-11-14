# Rendering resource ownership

This cleanup changes resource lifetime only. Damage, growth, economy, save CAS,
write journals and server transactions are unchanged.

| Resource | Owner | Release / reuse |
| --- | --- | --- |
| Barricade geometry, outlines and five cap materials | One barricade | `removeBarricade` calls `disposeOwned`; its separate HP bar disposes itself |
| Wood/rope materials | Barricade module | `shareMat`; reused by neighboring and future barricades |
| Comet geometry/material | One comet | `disposeOwned` on impact, before its FX callback completes |
| Arrow/head, orb and bullet geometry; projectile color materials | Projectile module | `shareGeo` / `shareMat`; a piercing arrow must not release another projectile's resources |
| Cannon ball, tower piercing mesh and meteor geometry/material | One projectile | Existing `killProj` → `disposeOwned` |
| Hero clone materials, skeleton bone texture, attached owned effects | One hero clone | `disposeHeroModel` stops/uncaches the mixer and calls `disposeOwned` |
| Model template geometry/textures, toon gradient, outline materials | Page/module cache | Kept across clones. Do not recursively dispose all textures when a hero is removed |

`disposeObj` deduplicates geometry and skeleton references within one owner tree.
This is not cross-owner reference counting: any resource shared across owners
must be explicitly marked, or released by its own cache owner.

The main renderer/composer and shop preview renderer are page-owned. The shop
keeps at most one preview per configured product and stops updating while hidden.
Campaign/dungeon/tower navigation replaces the document; menu/hero changes within
the town must still release the old hero clone immediately.

Regression: `node tests/resource-lifecycle.test.mjs` uses actual teardown bodies
and real Three objects with inert rendering/audio/game side effects. Browser
evidence in the task artifact folder separately measures actual WebGL resources.
GPU counter increments, disposal events, transient allocations, bounded caches,
and JS heap retention are different measurements; do not infer one from another.
