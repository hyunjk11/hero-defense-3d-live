// An attached runtime identity supplies short-lived access tokens. No key file is loaded.
export function createRuntimeTokenProvider(client, expectedProject) {
  let pending = null;
  return async () => {
    const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
    if (project !== expectedProject || !process.env.K_SERVICE || process.env.FUNCTIONS_EMULATOR === 'true') {
      throw Object.assign(new Error('Runtime identity unavailable'),{status:503});
    }
    if (!pending) pending = Promise.resolve().then(()=>client.getAccessToken()).then(result=>{
      const token = typeof result === 'string' ? result : result?.token;
      if (!token || typeof token !== 'string') throw Object.assign(new Error('Runtime identity unavailable'),{status:503});
      return token;
    }).finally(()=>{pending=null;});
    return pending;
  };
}
