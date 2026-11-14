// Endpoint policy only. This never activates Rules, migrates data or creates credentials.
export const DEMO_PROJECT = 'demo-hd3d-direct';
export const LIVE_PROJECT = 'hero-defense-3d-independent';
export const DIRECT_READY = 'rules-and-data-verified';
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function resolveDirectConfig(config) {
  const projectId=config.firebase?.projectId;
  const mode=config.storageMode;
  if(mode==='firestore-direct') {
    if(projectId!==LIVE_PROJECT || config.firebase?.authDomain!==LIVE_PROJECT+'.firebaseapp.com' || config.firestoreEmulator || config.authEmulator || config.firestoreEndpoint)
      throw fail('DIRECT_CONFIG_INVALID','Direct Firebase project or endpoint configuration mismatch');
    if(config.directActivation!==DIRECT_READY)
      throw fail('DIRECT_ACTIVATION_REQUIRED','Firebase 직접 저장 전환을 준비 중입니다.');
    return Object.freeze({projectId,root:`projects/${projectId}/databases/(default)/documents`,endpoint:'https://firestore.googleapis.com',emulated:false});
  }
  // Historical test helpers omit storageMode. They remain demo/loopback only.
  if((mode && mode!=='firestore-direct-prototype') || projectId!==DEMO_PROJECT || !/^http:\/\/127\.0\.0\.1:\d+$/.test(config.firestoreEmulator||'') || config.firestoreEndpoint)
    throw fail('DIRECT_NOT_RELEASED','Prototype storage is emulator-only; use an explicit reviewed direct profile');
  return Object.freeze({projectId,root:`projects/${projectId}/databases/(default)/documents`,endpoint:config.firestoreEmulator,emulated:true});
}
