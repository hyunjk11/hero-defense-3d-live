const base={proc:'machine',ws:.5,walk:'Walking',dig:'Attack',deathColor:0xf1b96d,deathDebris:[0x476171,0xa0b1b9,0xc38948]};
export const MACHINE_ENEMIES={
 gear_hound:{...base,form:'hound',n:'태엽 추적견',icon:'⚙',h:1.65,hp:160,spd:2.3,sprint:4.6,ai:'charger',profile:'charger',gold:7,core:1,dps:38,desc:'네 개의 피스톤 다리로 질주합니다. 둔화로 선두를 끊으세요.'},
 repair_drone:{...base,form:'drone',n:'황동 정비 드론',icon:'✚',h:1.5,fly:true,hp:240,spd:1.65,gold:11,core:2,dps:0,
  machine:{kind:'repair',every:7,first:3,windup:1.3,range:5.5,heal:.045,targets:3,interrupt:.1},desc:'상처 입은 아군 셋을 수리합니다. 녹색 광선의 드론을 먼저 격추하세요.'},
 machine_guard:{...base,form:'bulwark',n:'장갑 수호병',icon:'▣',h:2.75,hp:545,spd:1.25,gold:14,core:3,dps:76,armor:.42,
  machine:{kind:'ram',every:8,first:3,windup:1.45,range:3.2,radius:2.1,tower:62,hero:54,exposed:2.2,openArmor:.02},desc:'방패를 내리친 뒤 냉각판이 열립니다. 노출된 동력핵을 공격하세요.'},
 siege_crawler:{...base,form:'crawler',n:'궤도 공성 전차',icon:'▰',h:2.35,hp:380,spd:1.25,gold:13,core:3,dps:58,armor:.14,
  machine:{kind:'shell',every:10,first:4,windup:2,range:11,radius:1.7,tower:72,hero:60,interrupt:.12},desc:'주황색 조준점에 포탄을 발사합니다. 집중 공격으로 장전을 끊을 수 있습니다.'},
 coil_wasp:{...base,form:'wasp',n:'전류 말벌',icon:'ϟ',h:1.5,fly:true,hp:220,spd:2.05,gold:10,core:2,dps:0,
  machine:{kind:'emp',every:11,first:5,windup:1.5,range:7,radius:2.4,duration:3,slow:.6,tower:28,hero:34},desc:'전자기장을 남겨 타워 연사를 늦춥니다. 대공 타워를 분산하세요.'},
 rivet_gunner:{...base,form:'riveter',n:'리벳 관통병',icon:'↟',h:2.8,hp:340,spd:1.75,gold:12,core:2,dps:54,
  machine:{kind:'beam',every:9,first:4,windup:1.7,range:9,length:11,width:.62,tower:54,hero:46},desc:'바닥의 직선을 따라 리벳을 연사합니다. 옆으로 피하면 빗나갑니다.'},
 foundry_warden:{...base,form:'foundry',n:'이동식 주조 감시자',icon:'♜',h:3.7,hp:3800,spd:.85,gold:140,core:6,dps:215,armor:.26,boss:true,
  machine:{kind:'forge',every:16,first:6,windup:2.2,range:9,radius:2,tower:70,hero:60,spawn:'gear_hound',count:2,exposed:2.8,openArmor:.02},desc:'용광로를 열어 추적견 둘을 조립합니다. 작업 직후에는 장갑이 열립니다.'},
 boss_machine:{...base,form:'overseer',n:'강철 총감독 아르곤',icon:'👑',h:5.4,hp:5200,spd:.95,gold:280,core:12,dps:265,armor:.24,boss:true,
  machine:{kind:'overseer',every:10,first:5,windup:2,range:12,length:14,width:1.05,radius:1.8,n:2,tower:110,hero:92,exposed:1.8,openArmor:.03,
   phase:{at:.5,windup:2.5,armor:.1,everyK:.74,spawn:'repair_drone',count:2}},desc:'표적 포격과 절단 광선을 교대합니다. 체력 절반에 동력로가 개방되고 정비 드론이 출격합니다.'}
};
export const MACHINE_ROSTER={n:'기계 요새',ready:true,boss:'boss_machine',miniboss:'foundry_warden',pool:[['gear_hound',1.8,1],['repair_drone',.7,2],['machine_guard',1.05,3],['siege_crawler',.8,5],['coil_wasp',.65,6],['rivet_gunner',1,8]]};
export const MACHINE_SET={k:'machine',n:'동력 공학자',badge:'⚙',color:'#e9a862',subW:{atk:3,crit:2,cdr:2},accW:{cdr:3,crit:2,skill:2},
 bonuses:[{pieces:2,stats:{hp:8}},{pieces:3,stats:{cdr:8}}],names:{
 archer:['정찰대 철궁','태엽 장전궁','피스톤 연동 복합궁','자기궤도 레일궁','성문을 꿰뚫는 궁 발리스타'],
 mage:['정비공 검전봉','황동 축전 지팡이','쌍코일 유도홀','동력로 제어 지팡이','영구기관의 홀 퍼페튬'],
 warrior:['작업용 절삭검','톱니 회전 장검','유압 피스톤 대검','동력핵 사슬톱검','강철을 찢는 검 기가브레이커'],
 gunner:['초계병 신호총','태엽 장전 쌍권총','리벳 관통 쌍총','고압 축전 연발쌍총','요새의 쌍포 오버드라이브'],
 mechanic:['정비 렌치암','유압 굴착암','주조로 파쇄 거완','삼중 피스톤 파일벙커','초중장 압쇄기 헤파이스토스'],
 fighter:['정비공 가죽장갑','황동 마디권갑','압축 피스톤 너클','동력핵 충격권갑','철문 분쇄권 타이탄'],
 armor:['정비사의 작업복','황동 보강 조끼','냉각판 전투흉갑','동력로 방호갑주','총감독의 중장 외골격'],
 acc:['철제 톱니 펜던트','정비사의 압력계','축전 코일 회중시계','소형 동력로 목걸이','멈추지 않는 심장 크로노스']}};
