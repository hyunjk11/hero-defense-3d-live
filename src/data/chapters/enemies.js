export const CAMPAIGN_VARIANTS = {
  "storm_shard": [
    "wisp",
    {
      "n": "갈라진 번개",
      "icon": "⚡",
      "hp": 50,
      "spd": 3.3,
      "gold": 1,
      "child": true,
      "ab": {},
      "wisp": [
        12119807,
        2711200,
        8580607,
        16772492
      ],
      "desc": "분열한 비행체. 대공 타워가 필요합니다."
    }
  ],
  "storm_splitter": [
    "wisp",
    {
      "n": "폭풍 날개",
      "icon": "⚡",
      "hp": 140,
      "spd": 2.6,
      "gold": 8,
      "ab": {
        "split": {
          "type": "storm_shard",
          "n": 2
        }
      },
      "wisp": [
        9817578,
        2251682,
        8842751,
        15394450
      ],
      "desc": "죽으면 작은 비행체 2개로 갈라집니다. 연쇄 마법이나 다중 사격이 효과적이에요."
    }
  ],
  "storm_runner": [
    "charger",
    {
      "n": "벼락 돌격병",
      "icon": "⚡",
      "tint": 9492717,
      "hp": 230,
      "gold": 9,
      "spd": 2.5,
      "sprint": 5.2,
      "ab": {
        "shield": {
          "every": 9,
          "first": 3,
          "r": 3,
          "n": 1,
          "pct": 0.15,
          "cap": 90,
          "dur": 5
        }
      },
      "desc": "열린 길을 질주하며 동료 하나를 보호합니다. 감속으로 대공 타워의 시간을 버세요."
    }
  ],
  "boss_storm": [
    "boss_ruins",
    {
      "n": "폭풍의 심판자",
      "hp": 4000,
      "gold": 230,
      "tint": 7982570,
      "ab": {
        "summon": {
          "every": 14,
          "first": 6,
          "windup": 1.6,
          "n": 2,
          "type": "storm_splitter",
          "hp": 0.5,
          "r": 3,
          "extra": 0
        },
        "snowball": {
          "every": 9,
          "first": 4,
          "windup": 1.2,
          "range": 9,
          "nova": 2,
          "dur": 2.5,
          "k": 0.6
        }
      },
      "desc": "비행 지원병을 부르고 타워 둘의 공격을 늦춥니다. 대공 화력을 나눠 배치하세요."
    }
  ],
  "repair_drone": [
    "wisp",
    {
      "n": "지원 드론",
      "icon": "⚙",
      "hp": 170,
      "gold": 9,
      "wisp": [
        12173256,
        4086389,
        16759378,
        7788011
      ],
      "ab": {
        "escort": {
          "r": 12
        },
        "shield": {
          "every": 7,
          "first": 2,
          "r": 4.5,
          "n": 2,
          "pct": 0.22,
          "cap": 140,
          "dur": 6
        },
        "heal": {
          "every": 10,
          "windup": 1,
          "r": 4,
          "pct": 0.07
        }
      },
      "desc": "보호막과 수리로 지상 병력을 지킵니다. 화살탑으로 드론부터 제거하세요."
    }
  ],
  "siege_crawler": [
    "siege",
    {
      "n": "공성 포대",
      "icon": "💣",
      "tint": 10464184,
      "hp": 460,
      "gold": 14,
      "ab": {
        "meteor": {
          "every": 10,
          "first": 5,
          "windup": 1.6,
          "fall": 0.6,
          "range": 9,
          "n": 1,
          "r": 1.8,
          "tower": 75,
          "hero": 40
        }
      },
      "desc": "빨간 원에 포탄이 떨어집니다. 타워를 흩어 놓고 공성 포대를 집중 공격하세요."
    }
  ],
  "boss_machine": [
    "boss_fire",
    {
      "n": "강철 총감독",
      "hp": 4300,
      "gold": 250,
      "tint": 11837836,
      "ab": {
        "meteor": {
          "every": 10,
          "first": 5,
          "windup": 1.8,
          "fall": 0.7,
          "range": 11,
          "n": 2,
          "r": 2.2,
          "tower": 85,
          "hero": 50
        },
        "shield": {
          "every": 9,
          "first": 3,
          "r": 5,
          "n": 3,
          "pct": 0.2,
          "cap": 170,
          "dur": 6
        },
        "enrage": {
          "at": 0.45,
          "spd": 1.2,
          "cd": 0.8,
          "extra": 1
        }
      },
      "desc": "장갑 지원과 다중 포격을 사용합니다. 체력 45% 아래에서 포탄이 하나 늘어요."
    }
  ],
  "rift_spawn": [
    "grunt",
    {
      "n": "균열 파편병",
      "tint": 12421354,
      "eye": 6750185,
      "hp": 100,
      "gold": 1,
      "child": true
    }
  ],
  "rift_caller": [
    "mushroom",
    {
      "n": "균열 소환사",
      "icon": "🌀",
      "tint": 10847172,
      "hp": 220,
      "gold": 10,
      "ab": {
        "summon": {
          "every": 12,
          "first": 5,
          "windup": 1.5,
          "n": 2,
          "type": "rift_spawn",
          "hp": 0.65,
          "r": 2.8,
          "extra": 0
        }
      },
      "desc": "보라 원에서 증원군을 소환합니다. 소환사가 살아 있으면 적이 계속 늘어나요."
    }
  ],
  "void_walker": [
    "gargoyle",
    {
      "n": "공허 추적자",
      "icon": "🌑",
      "hp": 400,
      "gold": 12,
      "tint": 8417709,
      "ab": {
        "phase": {
          "every": 10,
          "first": 5,
          "windup": 1,
          "dur": 1.4
        },
        "curse": {
          "every": 13,
          "first": 7,
          "windup": 1.4,
          "range": 6,
          "r": 2.2,
          "max": 1,
          "dur": 2
        }
      },
      "desc": "잠깐 실체를 지우고 가까운 타워 하나를 봉인합니다. 사거리 밖에서 공격하세요."
    }
  ],
  "boss_abyss": [
    "boss_ruins",
    {
      "n": "공허의 문지기",
      "hp": 4600,
      "gold": 270,
      "tint": 10383819,
      "ab": {
        "summon": {
          "every": 15,
          "first": 6,
          "windup": 1.6,
          "n": 3,
          "type": "rift_spawn",
          "hp": 0.75,
          "r": 3,
          "extra": 2
        },
        "dread": {
          "at": 0.45,
          "windup": 2.4,
          "r": 7,
          "tower": 75,
          "hero": 70,
          "stun": 1.5,
          "shield": 0.12,
          "cd": 0.8
        }
      },
      "desc": "체력 45%에서 예고된 어둠 파동 후 소환 수가 늘어납니다. 호위대는 범위 공격으로 정리하세요."
    }
  ],
  "dragon_guard": [
    "shield",
    {
      "n": "용비늘 근위대",
      "icon": "🐉",
      "hp": 400,
      "gold": 13,
      "tint": 13134930,
      "armor": 0.3,
      "desc": "두꺼운 비늘과 정면 방패를 두른 근위대. 저격·관통 전문화가 효과적입니다."
    }
  ],
  "ember_wing": [
    "storm_splitter",
    {
      "n": "불씨 날개",
      "icon": "🔥",
      "hp": 170,
      "gold": 10,
      "wisp": [
        15185051,
        11095589,
        16764018,
        16747621
      ],
      "ab": {
        "escort": {
          "r": 12
        },
        "shield": {
          "every": 8,
          "first": 3,
          "r": 4,
          "n": 2,
          "pct": 0.2,
          "cap": 160,
          "dur": 6
        }
      },
      "desc": "비행 지원병이 용비늘 근위대에 보호막을 줍니다. 지상·대공 화력을 함께 준비하세요."
    }
  ],
  "boss_dragon": [
    "boss_fire",
    {
      "n": "붉은 용 아르카온",
      "proc": "dragon",
      "fur": 11289912,
      "eye": 16767845,
      "h": 5.8,
      "hp": 5200,
      "gold": 350,
      "ab": {
        "meteor": {
          "every": 12,
          "first": 7,
          "windup": 2,
          "fall": 0.8,
          "range": 13,
          "n": 2,
          "r": 2.5,
          "tower": 95,
          "hero": 65
        },
        "summon": {
          "every": 18,
          "first": 9,
          "windup": 1.8,
          "n": 2,
          "type": "ember_wing",
          "hp": 0.6,
          "r": 3,
          "extra": 0
        },
        "enrage": {
          "at": 0.4,
          "spd": 1.35,
          "cd": 0.75,
          "extra": 1
        }
      },
      "desc": "40% 체력에서 분노합니다. 운석 예고를 피하고 비행 호위대를 제거한 뒤 저격으로 마무리하세요."
    }
  ]
};

export const CAMPAIGN_ROSTERS = {
  "7": {
    "n": "폭풍",
    "ready": true,
    "boss": "boss_storm",
    "pool": [
      [
        "storm_splitter",
        1.3,
        1
      ],
      [
        "grunt",
        1.2,
        1
      ],
      [
        "bat",
        1,
        2
      ],
      [
        "storm_runner",
        0.8,
        3
      ],
      [
        "shield",
        0.6,
        5
      ]
    ]
  },
  "8": {
    "n": "요새",
    "ready": true,
    "boss": "boss_machine",
    "pool": [
      [
        "repair_drone",
        1.3,
        1
      ],
      [
        "grunt",
        1.2,
        1
      ],
      [
        "shield",
        1,
        2
      ],
      [
        "siege_crawler",
        0.8,
        3
      ],
      [
        "bomber",
        0.6,
        5
      ]
    ]
  },
  "9": {
    "n": "심연",
    "ready": true,
    "boss": "boss_abyss",
    "pool": [
      [
        "rift_caller",
        1.3,
        1
      ],
      [
        "grunt",
        1.2,
        1
      ],
      [
        "wraith",
        1,
        2
      ],
      [
        "void_walker",
        0.8,
        3
      ],
      [
        "siege",
        0.6,
        5
      ]
    ]
  },
  "10": {
    "n": "성채",
    "ready": true,
    "boss": "boss_dragon",
    "pool": [
      [
        "dragon_guard",
        1.3,
        1
      ],
      [
        "grunt",
        1.2,
        1
      ],
      [
        "siege_crawler",
        1,
        2
      ],
      [
        "ember_wing",
        0.8,
        3
      ],
      [
        "rift_caller",
        0.6,
        5
      ]
    ]
  }
};
