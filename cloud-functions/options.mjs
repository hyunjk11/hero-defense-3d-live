// Resource settings are deployment proposals; this file does not provision them.
import {defineString} from 'firebase-functions/params';
export const PROJECT = 'hero-defense-3d-independent';
export const RUNTIME_SERVICE_ACCOUNT=defineString('HD3D_RUNTIME_SERVICE_ACCOUNT',{description:'Existing least-privilege runtime service account. No default account is permitted.',input:{text:{validationRegex:'^[a-z][a-z0-9-]*@'+PROJECT+'\\.iam\\.gserviceaccount\\.com$',validationErrorMessage:'Use the approved existing runtime identity in this project.'}}});
export const OWNER_EMAIL_CONFIG=defineString('HD3D_OWNER_EMAIL',{description:'Independently verified game owner email; private deployment configuration only.',input:{text:{validationRegex:'^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',validationErrorMessage:'A verified owner email is required.'}}});
export const AUTH_API_KEY_CONFIG=defineString('HD3D_FIREBASE_WEB_API_KEY',{description:'Existing Firebase Auth project API key. Supply privately; never a service-account key.',input:{text:{validationRegex:'^AIza[A-Za-z0-9_-]{35}$',validationErrorMessage:'Supply the existing approved Firebase Auth API key.'}}});
export const GAME_API_OPTIONS = Object.freeze({
  region: 'asia-northeast3',
  serviceAccount: RUNTIME_SERVICE_ACCOUNT,
  memory: '256MiB', cpu: 1, concurrency: 8,
  minInstances: 0, maxInstances: 1, timeoutSeconds: 180,
  invoker: 'public', cors: false,
});
