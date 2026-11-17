"""Isolated H7-H10 engine smoke/balance pass. No backend/network access beyond loopback.
Run: python tests/hard-upper-browser.py [hard-7-1,...] [output suffix]
Injected synthetic progression is documented by the existing party fixture; combat,
costs, waves, damage and 1/60 simulation remain production code.
"""
import sys,json,time,threading,http.server,functools,pathlib
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'tests'/'logs';OUT.mkdir(exist_ok=True)
STAGES=sys.argv[1].split(',') if len(sys.argv)>1 else [f'hard-{c}-{i}' for c in range(7,11) for i in range(1,7)]
SUFFIX=sys.argv[2] if len(sys.argv)>2 else 'initial'
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):
  self.rfile.read(int(self.headers.get('Content-Length',0)));self.send_response(200);self.end_headers();self.wfile.write(b'{"ok":true}')
server=http.server.ThreadingHTTPServer(('127.0.0.1',8990),functools.partial(Handler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
INIT='''async()=>{
 window.__isolatedReview={memoryOnly:true,errors:[]};
 const [P,HP,H]=await Promise.all([import('/src/account/progress.js'),import('/src/heroes/hard-party.js'),import('/src/heroes/hero.js')]);
 G.manual=true;G.pauseRender=true;G.screen='game';G.stage=G.STAGE_CFG;G.grow=true;G.gold+=G.stage.startGold||0;G.dropCh=G.stage.ch;G.runBossKills=[];G.runDrops=[];G.runStart=performance.now();G.completedWaves=0;
 G.onXPWave=null;G.onRunEnd=null;G.onStageClear=()=>{G.phase='over'};
 G.choose('mage');
 const run={party:['mage','fighter'],loadouts:{mage:{perm:{hp:0,atk:0}},fighter:{perm:{hp:0,atk:0}}}};
 await HP.prepareHardParty(run);HP.startHardParty(run);
 window.driver=await import('/tests/hard-party-balance.mjs');
 return G.heroes.length;
}'''
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
 for sid in STAGES:
  page=browser.new_page(viewport={'width':1280,'height':800});errors=[];blocked=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if r.request.url.startswith('http://127.0.0.1:8990/') or r.request.url.startswith(('data:','blob:')):r.continue_()
   else:blocked.append(r.request.url);r.abort()
  page.route('**/*',route);start=time.time()
  try:
   page.goto(f'http://127.0.0.1:8990/?test=1&stage={sid}&rng=12345',timeout=120000)
   page.wait_for_function('()=>window.G?.ready&&G.phase==="select"',timeout=120000)
   page.evaluate(INIT)
   result=page.evaluate('async()=>driver.runCase({count:2,seed:12345})')
   result['errors']=errors;result['blockedExternal']=blocked;result['wallSeconds']=round(time.time()-start,2)
   print(sid,result['clear'],result['core'],result['wave'],result['wallSeconds'],errors,flush=True)
   page.evaluate('()=>{G.pauseRender=false;G.sim(.1)}');page.wait_for_timeout(300)
   page.screenshot(path=str(OUT/f'{sid}-{SUFFIX}.png'))
  except Exception as e:
   result={'stage':sid,'error':str(e),'errors':errors,'blockedExternal':blocked};print(result,flush=True)
  results.append(result);(OUT/f'hard-upper-{SUFFIX}.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));page.close()
 browser.close()
server.shutdown()
