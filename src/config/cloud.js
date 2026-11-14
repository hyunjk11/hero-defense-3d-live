export const CLOUD = {
  provider: 'firebase',
  firebase: {
    projectId: 'hero-defense-3d-independent',
    appId: '1:90355678376:web:6287a4d2cc0cd7e9c5569d',
    apiKey: 'AIzaSyCJy0KeWByPrItUValVL75HJy7XsTrlras',
    authDomain: 'hero-defense-3d-independent.firebaseapp.com',
    messagingSenderId: '90355678376',
  },
  // Release preparation: no Sites or direct-Firestore fallback.
  storageMode: 'functions',
  functionsActivation: 'pending-deployment',
  apiUrl: 'https://asia-northeast3-hero-defense-3d-independent.cloudfunctions.net/gameApi',
  tables: { profiles: 'hd3d_profiles', progress: 'hd3d_progress' },
  storagePrefix: 'hd3d_live',
  authStorageKey: 'hd3dLiveFirebaseAuth',
  legacyAuthStorageKey: 'hd3dLiveUnusedLegacyAuth',
  saveDebounceMs: 3000,
  retryMs: [3000, 10000, 30000, 60000],
};
