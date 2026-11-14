// Chapter six owns its silhouettes, attack timings, roster and equipment catalog.
const base = { proc: 'desert', ws: .55, walk: 'Walking', dig: 'Attack', deathColor: 0xd7b36a, deathDebris: [0xbe914b, 0xf0d795, 0x476777] };
export const DESERT_ENEMIES = {
  sand_scout: { ...base, form: 'fennec', n: '사구 여우', icon: '🦊', h: 1.5, hp: 130, spd: 2.4, sprint: 4.8, ai: 'charger', profile: 'charger', gold: 5, core: 1, dps: 30, digDps: 8,
    desc: '큰 귀의 사막 여우. 파인 길에서는 빠르게 질주합니다.' },
  sand_burrower: { ...base, form: 'worm', n: '사암 굴착충', icon: '⛏', h: 1.55, hp: 240, spd: 1.85, profile: 'digger', gold: 8, core: 2, dps: 42, digDps: 90,
    desert: { kind: 'burrow', every: 8, first: 4, windup: 1, travel: 1, exposed: 1.5 },
    desc: '모래 고리 뒤 한 칸을 굴착합니다. 솟아오른 직후에는 잠깐 멈춥니다.' },
  sand_guard: { ...base, form: 'guard', n: '일륜 방패병', icon: '🛡', h: 2.7, hp: 440, spd: 1.65, gold: 10, core: 3, dps: 64, armor: .12,
    shieldDef: { arc: 65, side: 120, front: .7, melee: .25, sideRed: .15, back: -.15 },
    desert: { kind: 'cleave', every: 7, first: 2.5, windup: 1.15, range: 3.8, width: 1.6, tower: 48, hero: 44, exposed: 1.6 },
    desc: '정면 화살을 막습니다. 검을 휘두른 뒤 방패가 열린 틈을 노리세요.' },
  sand_priest: { ...base, form: 'priest', n: '모래시계 사제', icon: '⌛', h: 2.85, hp: 305, spd: 1.55, gold: 10, core: 2, dps: 36,
    desert: { kind: 'quicksand', every: 9, first: 4, windup: 1.6, range: 9, radius: 1.8, duration: 3.5, slow: .65, tower: 34, hero: 32, interrupt: .1 },
    desc: '원 안에 모래늪을 만듭니다. 시전 중 집중 공격하면 끊깁니다.' },
  sand_vulture: { ...base, form: 'vulture', n: '청동날개 독수리', icon: '🦅', h: 1.65, fly: true, hp: 165, spd: 2.25, gold: 8, core: 2, dps: 0,
    desert: { kind: 'dive', every: 9, first: 4, windup: 1.2, range: 6, radius: 1.5, tower: 28, hero: 28 },
    desc: '모래 표식에 급강하합니다. 대공 타워로 막고 원 밖으로 피하세요.' },
  sand_scarab: { ...base, form: 'scarab', n: '태양핵 풍뎅이', icon: '☀', h: .8, hp: 70, spd: 2.8, gold: 2, core: 1, dps: 22, child: true,
    desc: '사구왕의 갑주 아래에서 쏟아지는 작은 풍뎅이.' },
  sand_sentinel: { ...base, form: 'sphinx', n: '사암 스핑크스', icon: '🗿', h: 3.35, hp: 3600, spd: 1.15, gold: 120, core: 7, dps: 195, armor: .18, boss: true,
    desert: { kind: 'beam', every: 9, first: 5, windup: 1.7, range: 12, width: 1.75, tower: 72, hero: 78 },
    desc: '길게 표시된 선을 태양 광선으로 쓸어버립니다. 옆으로 피하세요.' },
  boss_desert: { ...base, form: 'scorpion', n: '사구왕 아크셰트', icon: '👑', h: 5.5, hp: 4400, spd: 1, gold: 230, core: 10, dps: 225, armor: .28, boss: true,
    desert: { kind: 'monarch', every: 9, first: 4, windup: 1.8, range: 12, width: 2.2, radius: 2, n: 2, tower: 84, hero: 75,
      phase: { at: .5, windup: 2, armor: .08, everyK: .75, summons: 3, type: 'sand_scarab' } },
    desc: '집게 충격파와 꼬리 표식을 번갈아 씁니다. 체력 절반에 황금 갑주가 벗겨지고 풍뎅이가 깨어납니다.' }
};
export const DESERT_ROSTER = { n: '사막', ready: true, boss: 'boss_desert', miniboss: 'sand_sentinel',
  pool: [['sand_scout', 1.8, 1], ['sand_burrower', 1.15, 1], ['sand_guard', 1, 2], ['sand_priest', .8, 4], ['sand_vulture', .7, 6]] };

export const DESERT_SET = { k: 'desert', n: '태양묘 수호자', badge: '☀', color: '#e4b773',
  subW: { atk: 3, critD: 3, hp: 2 }, accW: { crit: 3, spd: 2, skill: 1, cdr: 1 },
  bonuses: [{ pieces: 2, stats: { atk: 6 } }, { pieces: 3, stats: { critD: 12 } }],
  names: {
    archer: ['대추나무 단궁', '사구 순찰 복합궁', '사막매의 날개궁', '황금 태양륜 장궁', '지평선을 꿰뚫는 궁 라호르'],
    mage: ['사암 순례 지팡이', '유리모래 수정홀', '모래시계 예언홀', '일식 사제의 태양홀', '태양을 담은 홀 케프리'],
    warrior: ['대상단 호신검', '청동 갈고리검', '일륜 근위대 코페시', '왕묘 수호자의 월도', '사구왕의 단죄검 아크셰트'],
    gunner: ['대상단 경호 권총', '황동 사막쌍총', '청동매의 회전권총', '황금 묘역의 쌍권총', '여명을 쏘는 쌍총 솔라리스'],
    mechanic: ['오아시스 채굴암', '사암 굴착 드릴암', '태양석 압축 파쇄암', '피라미드 축조 거완', '태양기관 헬리오브레이커'],
    fighter: ['대상단 손붕대', '사구여우 가죽 너클', '전갈집게 청동권갑', '스핑크스 황금권갑', '사구왕의 집게 스콜피온'],
    armor: ['모래바람 두건옷', '대상단 사막 외투', '일륜병의 청동 흉갑', '태양묘 수호 판금', '불멸의 파라오 황금갑주'],
    acc: ['대추씨 매듭 부적', '유리모래 시계', '청금석 풍뎅이 인장', '태양묘의 일륜 펜던트', '다시 떠오르는 태양의 심장']
  }
};
