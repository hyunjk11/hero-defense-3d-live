// A release endpoint is enabled only after deployment/readback. No Sites fallback.
export const FUNCTIONS_PROJECT='hero-defense-3d-independent';
export const FUNCTIONS_DEMO='demo-hd3d-direct';
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function resolveFunctionsConfig(config) {
  const emulated=config.storageMode==='functions-prototype';
  if(!emulated&&config.storageMode!=='functions')throw fail('FUNCTIONS_CONFIG_INVALID','Invalid Functions profile');
  const projectId=emulated?FUNCTIONS_DEMO:FUNCTIONS_PROJECT;
  if(config.firebase?.projectId!==projectId||config.firestoreEndpoint||config.firestoreEmulator)
    throw fail('FUNCTIONS_CONFIG_INVALID','Functions project or transport mismatch');
  if(emulated){
    if(!/^http:\/\/127\.0\.0\.1:\d+\/api\/game$/.test(config.apiUrl||'')||!/^http:\/\/127\.0\.0\.1:\d+$/.test(config.authEmulator||''))
      throw fail('FUNCTIONS_CONFIG_INVALID','Demo Functions requires loopback API and Auth');
  }else{
    if(config.authEmulator||config.firebase.authDomain!==projectId+'.firebaseapp.com')throw fail('FUNCTIONS_CONFIG_INVALID','Live Auth configuration mismatch');
    if(config.functionsActivation!=='deployment-verified')throw fail('FUNCTIONS_ACTIVATION_REQUIRED','새 서버 연결을 준비 중입니다.');
    const expected='https://asia-northeast3-'+projectId+'.cloudfunctions.net/gameApi';
    if(config.apiUrl!==expected)throw fail('FUNCTIONS_CONFIG_INVALID','Unverified Functions endpoint');
  }
  return Object.freeze({projectId,emulated,apiUrl:config.apiUrl});
}
