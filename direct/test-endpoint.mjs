// Test-only endpoint selection. Production transport still requires the literal
// loopback emulator and demo project. Use a fresh process for fixed-UID suites.
const port=Number(process.env.HD3D_DIRECT_TEST_PORT||9398);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local test port');
export const testHost='http://127.0.0.1:'+port;
