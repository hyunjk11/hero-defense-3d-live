// Chapter five: independent silhouettes and combat roles. IDs of the earlier draft stay valid.
const base = { proc: 'swamp', ws: .55, walk: 'Walking', dig: 'Attack', deathColor: 0x84965b, deathDebris: [0x4a5842, 0xa4bf67] };
export const SWAMP_ENEMIES = {
  swamp_runner: { ...base, form: 'newt', n: '늪갈퀴 도마뱀', icon: '🦎', h: 1.25, hp: 110, spd: 3.8, gold: 4, core: 1, dps: 26, digDps: 12, profile: 'charger',
    desc: '낮게 엎드려 달리는 늪 도마뱀. 열린 길로 빠르게 파고듭니다.' },
  swamp_spitter: { ...base, form: 'toad', n: '독낭 두꺼비', icon: '🐸', h: 1.8, hp: 240, spd: 1.7, gold: 7, core: 2, dps: 38,
    swamp: { kind: 'spit', every: 7.5, first: 3, windup: 1.3, range: 9, n: 1, radius: 1.7, duration: 3.5, towerDps: 12, heroDps: 16 },
    desc: '목의 독낭이 부푼 뒤 독액을 뱉습니다. 노란 원을 피하세요.' },
  swamp_mender: { ...base, form: 'mender', n: '갈대 재생술사', icon: '🌾', h: 2.65, hp: 280, spd: 1.55, gold: 10, core: 2, dps: 32,
    swamp: { kind: 'mend', every: 8, first: 4, windup: 1.8, radius: 5.2, heal: .08, bossHeal: .35, interrupt: .08 },
    desc: '청록 등불로 주변 동료를 치유합니다. 시전 중 집중 공격하면 끊깁니다.' },
  swamp_beetle: { ...base, form: 'beetle', n: '이끼등 갑충', icon: '🐞', h: 1.85, hp: 440, spd: 1.5, gold: 10, core: 3, dps: 58, digDps: 75, shell: '갑각',
    ab: { crack: { armor: .5, at: .3, after: .08, spd: 1.3 } },
    desc: '단단한 등껍질이 피해를 절반 막습니다. 껍질이 깨지면 약해지지만 빨라집니다.' },
  swamp_moth: { ...base, form: 'moth', n: '독안개 나방', icon: '🦋', fly: true, h: 1.35, hp: 145, spd: 2.5, gold: 7, core: 2, dps: 0,
    swamp: { kind: 'spit', every: 9, first: 4, windup: 1.2, range: 6, n: 1, radius: 1.4, duration: 3, towerDps: 9, heroDps: 12 },
    desc: '벽 위를 날며 독가루를 떨굽니다. 대공 타워로 먼저 잡으세요.' },
  swamp_larva: { ...base, form: 'larva', n: '역병 뿌리벌레', icon: '🐛', h: .8, hp: 55, spd: 2.5, gold: 1, core: 1, dps: 18, child: true,
    desc: '거목의 포자낭에서 깨어난 뿌리벌레.' },
  boss_swamp: { ...base, form: 'heartwood', n: '역병의 거목', icon: '👑', h: 5.5, hp: 4000, spd: 1.05, gold: 200, core: 10, dps: 205, armor: .18, boss: true,
    swamp: { kind: 'spit', every: 10, first: 4, windup: 2, range: 11, n: 2, radius: 2, duration: 4, towerDps: 18, heroDps: 22,
      rupture: { at: .5, n: 3, type: 'swamp_larva', armor: .05, cooldown: .72 } },
    ab: { root: { every: 13, first: 9, windup: 1.6, r: 7, n: 2, dur: 2.5 } },
    desc: '뿌리와 독액으로 진지를 압박합니다. 체력 절반에 심장이 드러나고 뿌리벌레가 깨어납니다.' }
};
export const SWAMP_ROSTER = { n: '늪지', ready: true, boss: 'boss_swamp', miniboss: 'swamp_guardian',
  pool: [['swamp_runner', 1.8, 1], ['swamp_spitter', 1.1, 2], ['swamp_beetle', 1, 3], ['swamp_mender', .75, 4], ['swamp_moth', .65, 5]] };
SWAMP_ENEMIES.swamp_guardian = { ...SWAMP_ENEMIES.swamp_beetle, n: '늪지 갑충 수문장', h: 3.1, hp: 3400, spd: .95, dps: 185, gold: 110, core: 7, boss: true,
  ab: { crack: { armor: .45, at: .25, after: .05, spd: 1.2 } }, desc: '길목을 막는 거대한 갑충. 갑각을 깨고 집중 공격하세요.' };

export const SWAMP_SET = { k: 'swamp', n: '늪지 파수꾼', badge: '🌾', color: '#9bb94f',
  subW: { cdr: 3, hp: 3, skill: 2 }, accW: { cdr: 3, skill: 2, crit: 1, spd: 1 },
  bonuses: [{ pieces: 2, stats: { hp: 8 } }, { pieces: 3, stats: { cdr: 5 } }],
  names: {
    archer: ['갈대 단궁', '늪가시 활', '독낭 사냥궁', '이끼뿔 장궁', '침묵의 사냥꾼 미스트혼'],
    mage: ['물푸레 석장', '도깨비불 등불홀', '청록 포자 지팡이', '재생술사의 갈대홀', '늪의 등불 위스퍼룩'],
    warrior: ['나루터 녹슨 검', '갑충턱 장검', '이끼갑각 대검', '거목 뿌리 절단검', '역병을 베는 검 페일루트'],
    gunner: ['나루 경비 권총', '갈대총열 쌍권총', '독낭 압력 권총', '늪지 파수 쌍권총', '안개를 가르는 쌍총 헤이즈'],
    mechanic: ['배수장 작업암', '갈대절단 드릴암', '갑충턱 파쇄암', '거목뿌리 굴착암', '늪지 준설기 보그브레이커'],
    fighter: ['물풀 손붕대', '늪갈퀴 너클', '이끼갑각 권갑', '뿌리송곳 권갑', '늪의 맹수 모스팽'],
    armor: ['갈대 엮은 조끼', '늪도마뱀 가죽옷', '이끼갑충 흉갑', '재생수호자의 외투', '역병거목의 심장갑주'],
    acc: ['나루지기 매듭', '도깨비불 유리병', '독낭 호박석', '청록 등불 펜던트', '정화된 역병의 심장']
  }
};
