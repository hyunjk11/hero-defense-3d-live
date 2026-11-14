// Chapters 9/10 reuse the normal economy. New shapes and telegraphed roles,
// never permanent immunity or unbounded paid summons.
const base={proc:'endgame',ws:.5,walk:'Walking',dig:'Attack'};
const abyss={...base,family:'abyss',deathColor:0xbc8cff,deathDebris:[0x504264,0x9473b8,0x9de7db]};
const citadel={...base,family:'citadel',deathColor:0xffb16c,deathDebris:[0x85483d,0xdb9b63,0xffd092]};
export const ABYSS_ENEMIES={
 rift_runner:{...abyss,form:'skitter',n:'균열 가위벌레',icon:'⋈',h:1.55,hp:175,spd:2.35,sprint:4.7,ai:'charger',profile:'charger',gold:8,core:1,dps:40,desc:'여섯 다리와 가위턱으로 열린 길을 질주합니다. 감속과 길목 화력으로 먼저 끊으세요.'},
 rift_spawn:{...abyss,form:'shardling',n:'균열 파편충',icon:'◇',h:.85,hp:82,spd:2.6,gold:0,core:1,dps:20,child:true,desc:'소환된 작은 파편충. 골드·처치 보상을 주지 않습니다. 시전자당 최대 12마리까지 소환됩니다.'},
 rift_caller:{...abyss,form:'gate',n:'균열 직조자',icon:'🌀',h:2.6,hp:335,spd:1.55,gold:12,core:2,dps:38,
  endgame:{kind:'gate',every:15,first:5,windup:2,range:11,radius:2.5,spawn:'rift_spawn',count:2,cap:12,interrupt:.08},desc:'2초 동안 고리를 엮어 파편충 둘을 소환합니다. 시전 중 최대 체력 8% 피해로 소환을 끊을 수 있습니다.'},
 void_lantern:{...abyss,form:'lantern',n:'공허 등불해파리',icon:'◉',h:1.8,fly:true,hp:265,spd:1.75,gold:12,core:2,dps:0,
  endgame:{kind:'ward',every:9,first:3,windup:1.4,range:5.2,targets:2,shield:.12,capHP:130,duration:5,interrupt:.1},desc:'청록 고리 안 동료 둘에게 5초 보호막을 부여합니다. 중첩되지 않으며 대공 공격으로 끊을 수 있습니다.'},
 void_walker:{...abyss,form:'sentinel',n:'공허 집게수문장',icon:'⋔',h:2.8,hp:570,spd:1.25,gold:15,core:3,dps:78,armor:.38,
  endgame:{kind:'cleave',every:9,first:4,windup:1.6,range:3.6,angle:1.5,tower:65,hero:55,exposed:2.5,openArmor:.03},desc:'집게를 벌린 방향에 부채꼴 공격을 합니다. 공격 후 2.5초 동안 보랏빛 핵이 노출됩니다.'},
 rift_lancer:{...abyss,form:'prism',n:'심연 삼각창',icon:'△',h:2.7,hp:355,spd:1.7,gold:13,core:2,dps:56,
  endgame:{kind:'line',every:10,first:5,windup:1.8,range:9,length:11,width:.6,tower:60,hero:50},desc:'고정된 보라색 직선에 균열창을 발사합니다. 예고 후에는 조준 방향을 바꾸지 않습니다.'},
 rift_keeper:{...abyss,form:'obelisk',n:'공명 제단지기',icon:'♜',h:3.8,hp:4000,spd:.85,gold:150,core:6,dps:220,armor:.2,boss:true,
  endgame:{kind:'cycle',pattern:['gate','ring'],every:12,first:5,windup:2,range:9,radius:4.8,inner:1.7,spawn:'rift_spawn',count:2,cap:12,tower:95,hero:80,interrupt:.1},desc:'소환과 고리 파동을 교대합니다. 고리 중심과 바깥은 안전하며, 소환은 집중 공격으로 끊을 수 있습니다.'},
 boss_abyss:{...abyss,form:'riftking',n:'공허의 문지기 네메시스',icon:'👑',h:5.5,hp:5500,spd:.92,gold:300,core:12,dps:275,armor:.22,boss:true,
  endgame:{kind:'cycle',pattern:['gate','line','ring'],every:11,first:5,windup:2.2,range:12,length:14,width:.85,radius:6,inner:2,spawn:'rift_spawn',count:3,cap:12,tower:105,hero:88,exposed:1.6,openArmor:.04,
   phase:{at:.5,windup:2.8,everyK:.8,armor:.1}},desc:'소환·균열창·고리 파동을 순서대로 사용합니다. 체력 절반에서 핵이 열려 방어가 낮아지고 패턴 간격이 20% 짧아집니다.'}
};
export const CITADEL_ENEMIES={
 ash_stalker:{...citadel,form:'raptor',n:'잿불 갈퀴룡',icon:'♞',h:1.85,hp:190,spd:2.4,sprint:4.8,ai:'charger',profile:'charger',gold:8,core:1,dps:44,desc:'두 발과 긴 꼬리로 달리는 척후룡. 파인 길을 빠르게 따라옵니다.'},
 dragon_guard:{...citadel,form:'shieldscale',n:'용비늘 근위대',icon:'🛡',h:2.9,hp:600,spd:1.3,gold:16,core:3,dps:82,armor:.4,
  endgame:{kind:'cleave',every:9,first:3.5,windup:1.7,range:3.8,angle:1.55,tower:70,hero:60,exposed:2.5,openArmor:.04},desc:'비늘 방패를 든 근위대. 정면을 크게 베고 2.5초간 방패를 내립니다. 옆으로 피한 뒤 반격하세요.'},
 ember_wing:{...citadel,form:'bannerwing',n:'불씨 깃발룡',icon:'⚑',h:1.8,fly:true,hp:285,spd:1.8,gold:13,core:2,dps:0,
  endgame:{kind:'ward',every:9,first:3,windup:1.5,range:5,targets:2,shield:.12,capHP:140,duration:5,interrupt:.1},desc:'붉은 날개로 동료 둘에게 5초 보호막을 보냅니다. 보호막은 중첩되지 않습니다. 대공 화력을 확보하세요.'},
 cinder_artillery:{...citadel,form:'tortoise',n:'화로등 용거북',icon:'♨',h:2.5,hp:410,spd:1.2,gold:14,core:3,dps:62,armor:.14,
  endgame:{kind:'salvo',every:12,first:5,windup:2.2,range:11,radius:1.8,n:1,tower:80,hero:68,interrupt:.1},desc:'등의 화로에서 예고된 원에 불탄을 쏩니다. 원 밖으로 피하거나 장전을 끊으세요.'},
 ember_wyvern:{...citadel,form:'wyvern',n:'홍염 비룡',icon:'♨',h:2.5,fly:true,hp:315,spd:1.9,gold:14,core:2,dps:0,
  endgame:{kind:'breath',every:11,first:5,windup:1.9,range:6,angle:1.1,tower:55,hero:48},desc:'공중에서 고정된 방향으로 짧은 브레스를 뿜습니다. 부채꼴 바깥으로 이동하고 대공 타워를 분산하세요.'},
 drake_captain:{...citadel,form:'lancer',n:'왕좌의 용창대장',icon:'♜',h:4,hp:4250,spd:.9,gold:165,core:6,dps:235,armor:.24,boss:true,
  endgame:{kind:'cycle',pattern:['line','cleave'],every:10,first:4.5,windup:2,range:9,length:12,width:.7,angle:1.4,tower:100,hero:85,exposed:2,openArmor:.04},desc:'긴 창의 찌르기와 부채꼴 베기를 교대합니다. 바닥 예고를 피하면 공격 후 빈틈이 생깁니다.'},
 boss_dragon:{...citadel,form:'dragon',n:'붉은 용 아르카온',icon:'🐉',h:6,hp:5900,spd:.85,gold:350,core:12,dps:290,armor:.24,boss:true,
  endgame:{kind:'cycle',pattern:['breath','salvo','ring'],every:12,first:5.5,windup:2.4,range:12,angle:1.15,radius:2,n:2,ringRadius:6.5,inner:2,tower:115,hero:96,exposed:2,openArmor:.05,
   phase:{at:.45,windup:3,everyK:.8,armor:.1}},desc:'브레스·표적 불탄·꼬리 고리파동을 순서대로 씁니다. 체력 45%에서 날개를 펼치고 공격 간격이 20% 짧아집니다. 예고 중 측면이나 고리 안쪽으로 피하세요.'}
};
export const ABYSS_ROSTER={n:'심연의 균열',ready:true,boss:'boss_abyss',miniboss:'rift_keeper',pool:[['rift_runner',1.9,1],['rift_caller',.7,2],['void_walker',1,3],['void_lantern',.65,5],['rift_lancer',.9,7]]};
export const CITADEL_ROSTER={n:'용의 성채',ready:true,boss:'boss_dragon',miniboss:'drake_captain',pool:[['ash_stalker',1.9,1],['dragon_guard',1,2],['ember_wing',.65,4],['cinder_artillery',.8,5],['ember_wyvern',.75,7]]};
export const ABYSS_SET={k:'abyss',n:'균열 봉인자',badge:'◈',color:'#b58bea',subW:{skill:3,cdr:2,rng:2},accW:{skill:3,cdr:2,crit:1,spd:1},bonuses:[{pieces:2,stats:{rng:6}},{pieces:3,stats:{skill:12}}],names:{
 archer:['균열 사냥 단궁','공허실 장궁','삼각창 파편궁','봉인문 나선궁','경계를 꿰는 궁 파라독스'],
 mage:['금간 수정봉','등불핵 마법봉','공명 제단홀','균열 직조 지팡이','공허를 닫는 홀 실렌티움'],
 warrior:['경계 순찰검','공허실 장검','집게핵 대검','균열 봉인 대검','끝을 가르는 검 테르미누스'],
 gunner:['균열 신호 쌍총','공명탄 쌍권총','등불핵 연발쌍총','공허문 봉인쌍총','경계의 쌍성 제미니'],
 mechanic:['파편 수거암','공허 결정 드릴','공명 파쇄 거완','균열 고정 파일벙커','차원 봉쇄기 앵커'],
 fighter:['경계 수련 붕대','공허실 권갑','파편 집게너클','공명 봉인권갑','허공 분쇄권 네메시스'],
 armor:['경계 순찰 로브','공허실 경갑','공명 결정 흉갑','균열 봉인갑주','문지기의 밤 장막'],
 acc:['금간 수정 부적','등불핵 펜던트','공명 삼각패','균열 좌표 목걸이','닫힌 차원의 눈']}};
export const CITADEL_SET={k:'citadel',n:'용화 근위대',badge:'♜',color:'#ef967a',subW:{atk:3,critD:2,hp:2},accW:{crit:3,spd:2,skill:1,cdr:1},bonuses:[{pieces:2,stats:{hp:8}},{pieces:3,stats:{atk:8}}],names:{
 archer:['성문 경비궁','용힘줄 장궁','비룡 날개궁','왕좌 근위 장궁','붉은 새벽의 궁 아우로라'],
 mage:['잿불 수련봉','화로핵 지팡이','비룡 뿔 마법홀','용심장 왕실홀','태초의 불꽃 이그니스'],
 warrior:['성문 경비검','용비늘 장검','용창 파편 대검','왕좌 근위 대검','붉은 왕의 검 레갈리스'],
 gunner:['성채 경비 쌍총','잿불 탄창 쌍총','용거북 화로쌍총','왕실 용탄 쌍총','새벽을 알리는 쌍포 솔라리스'],
 mechanic:['성문 수리암','용비늘 파쇄암','용거북 화로거완','왕좌 공성 파일벙커','용심장 파쇄기 발칸'],
 fighter:['성문 수련 붕대','용힘줄 권갑','비룡 갈퀴너클','왕실 용화권갑','홍염 용아권 아르카온'],
 armor:['성채 경비복','용비늘 조끼','비룡 날개흉갑','왕좌 근위 판금','붉은 용왕의 갑주'],
 acc:['잿불 인장','용비늘 펜던트','비룡 눈 목걸이','왕좌의 용심장','꺼지지 않는 왕의 불씨']}};
