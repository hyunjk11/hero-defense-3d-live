// Chapter seven: wind-borne creatures, conductive weapons and navigators' gear.
const base = { proc: 'storm', ws: .55, walk: 'Walking', dig: 'Attack', deathColor: 0x8acbd8, deathDebris: [0x355778, 0xb2e9ea, 0xd3b878] };
export const STORM_ENEMIES = {
  storm_runner: { ...base, form: 'gazelle', n: '갈바람 깃사슴', icon: '🦌', h: 2, hp: 150, spd: 2.45, sprint: 4.9, ai: 'charger', profile: 'charger', gold: 6, core: 1, dps: 34,
    desc: '갈라진 뿔과 깃털 꼬리의 사슴. 파인 길에서 질주합니다.' },
  storm_splitter: { ...base, form: 'manta', n: '구름가오리', icon: '◇', h: 1.1, fly: true, hp: 160, spd: 2.15, gold: 8, core: 2, dps: 0,
    ab: { split: { type: 'storm_shard', n: 2 } }, desc: '넓은 구름 날개로 날아오며, 쓰러지면 번개 치어 둘로 갈라집니다.' },
  storm_shard: { ...base, form: 'eel', n: '번개 치어', icon: 'ϟ', h: .55, fly: true, hp: 40, spd: 2.8, gold: 1, core: 1, dps: 0, child: true,
    desc: '가오리의 핵에서 풀려난 작은 번개 생명체.' },
  storm_pikeman: { ...base, form: 'heron', n: '피뢰창 병사', icon: 'ϟ', h: 3, hp: 305, spd: 1.85, gold: 10, core: 2, dps: 48,
    storm: { kind: 'lightning', every: 9, first: 4, windup: 1.5, range: 8, radius: 1.15, chainRange: 2.8, jumps: 2, chainK: .55, tower: 44, hero: 38 },
    desc: '표식에 낙뢰를 꽂습니다. 맞은 대상 주변으로 두 번 연쇄됩니다.' },
  storm_caller: { ...base, form: 'conch', n: '먹구름 소라술사', icon: '🌀', h: 2.65, hp: 330, spd: 1.55, gold: 11, core: 2, dps: 40,
    storm: { kind: 'gust', every: 11, first: 5, windup: 1.65, range: 9, radius: 2, duration: 3, slow: .7, tower: 32, hero: 30, interrupt: .1 },
    desc: '회오리 안의 타워를 느리게 합니다. 시전 중 집중 공격으로 끊을 수 있습니다.' },
  storm_anchor: { ...base, form: 'crab', n: '닻등 집게거인', icon: '⚓', h: 2.8, hp: 495, spd: 1.35, gold: 13, core: 3, dps: 70, armor: .38,
    storm: { kind: 'slam', every: 8, first: 3, windup: 1.4, range: 3.4, radius: 2, tower: 58, hero: 48, exposed: 1.8, openArmor: .06 },
    desc: '닻을 내려친 뒤 갑각이 열립니다. 열린 틈에 피해를 집중하세요.' },
  storm_sentinel: { ...base, form: 'medusa', n: '뇌운 해파리', icon: '◎', h: 3.2, fly: true, hp: 3400, spd: .65, gold: 125, core: 5, dps: 0, boss: true,
    storm: { kind: 'pulse', every: 9, first: 5, windup: 1.8, range: 4.6, radius: 4.6, inner: 1.6, tower: 120, hero: 100 },
    desc: '고리 모양의 뇌파를 뿜습니다. 중심이나 바깥으로 피하세요.' },
  boss_storm: { ...base, form: 'thunderlord', n: '폭풍의 심판자', icon: '👑', h: 5.2, hp: 4800, spd: 1, gold: 250, core: 10, dps: 245, armor: .2, boss: true,
    storm: { kind: 'judgment', every: 9, first: 4, windup: 1.9, range: 11, radius: 1.4, n: 2, chainRange: 2.8, jumps: 2, chainK: .5, tower: 78, hero: 68, pulseRadius: 6, inner: 1.8,
      phase: { at: .5, windup: 2.1, armor: .08, everyK: .76, summons: 3, type: 'storm_shard' } },
    desc: '연쇄 낙뢰와 고리 뇌파를 번갈아 씁니다. 체력 절반에 봉인이 풀리고 번개 치어가 깨어납니다.' }
};
export const STORM_ROSTER = { n: '폭풍', ready: true, boss: 'boss_storm', miniboss: 'storm_sentinel',
  pool: [['storm_runner', 1.9, 1], ['storm_splitter', .75, 1], ['storm_pikeman', 1.05, 3], ['storm_caller', .8, 4], ['storm_anchor', 1, 3]] };
export const STORM_SET = { k: 'storm', n: '폭풍 항해자', badge: 'ϟ', color: '#79cdea',
  subW: { atk: 3, spd: 3, crit: 2 }, accW: { crit: 3, spd: 2, skill: 1, cdr: 1 },
  bonuses: [{ pieces: 2, stats: { spd: 6 } }, { pieces: 3, stats: { rng: 8 } }],
  names: {
    archer: ['해안 순찰 단궁', '바람돛 복합궁', '구름가오리 날개궁', '천둥깃 항해 장궁', '수평선을 가르는 궁 에어로스'],
    mage: ['표류목 지팡이', '바람소라 마법봉', '뇌운 진주홀', '태풍눈 나선지팡이', '일곱 바람의 홀 제피로스'],
    warrior: ['선원의 곡도', '돌풍 갈고리검', '피뢰창 파편 대검', '폭풍깃 번개도', '하늘을 가르는 검 아스트라'],
    gunner: ['갑판 경비 권총', '풍압 쌍권총', '뇌전 코일쌍총', '태풍기관 연발쌍총', '천둥을 울리는 쌍총 볼테르'],
    mechanic: ['선박 수리암', '풍차 회전 드릴암', '구름핵 터빈암', '폭풍기관 압축거완', '천공추진기 템페스트'],
    fighter: ['돛천 손붕대', '갈바람 가죽권갑', '뇌조 발톱너클', '폭풍깃 날개권갑', '천둥매의 발톱 라이트닝'],
    armor: ['해안 망토옷', '항해사 방풍외투', '구름깃 경갑', '태풍눈 날개갑옷', '일곱 바람의 제독예복'],
    acc: ['선원의 매듭목걸이', '풍향계 나침반', '뇌운 진주나침반', '태풍눈 항해의장', '길 잃지 않는 별의 나침반']
  }
};
