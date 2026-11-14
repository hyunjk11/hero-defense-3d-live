import { onRequest } from 'firebase-functions/v2/https';
import { Compute } from 'google-auth-library';
import { makeFirestoreRequest } from './game/server/http.mjs';
import { liveHandler } from './game/server/live.mjs';
import { createHttpBridge } from './bridge.mjs';
import { createRuntimeTokenProvider } from './runtime-auth.mjs';
import { PROJECT, GAME_API_OPTIONS } from './options.mjs';

const token = createRuntimeTokenProvider(new Compute({scopes:['https://www.googleapis.com/auth/datastore']}), PROJECT);
const handler=liveHandler({request:makeFirestoreRequest({},undefined,token),enabled:process.env.HD3D_LIVE_ENABLED==='true'});
export const gameApi = onRequest(GAME_API_OPTIONS,createHttpBridge(handler));
