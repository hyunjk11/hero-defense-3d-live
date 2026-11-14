export default {
  "id": 5,
  "n": "5장 · 독안개 늪지",
  "short": "늪지",
  "theme": "swamp",
  "prop": "swamp",
  "propN": "독과 재생",
  "propD": "독 웅덩이 · 치유 차단 · 갑각 파괴",
  "color": "#9bb94f",
  "bg": "linear-gradient(160deg,#9bb94f55,#101c2b)",
  "stages": [
    {
      "id": "5-1",
      "n": "안개 둑길",
      "waves": 13,
      "core": [
        22,
        8
      ],
      "spawns": [
        [
          0,
          8
        ]
      ],
      "q": [
        0.27,
        0.55,
        0.8
      ],
      "bed": 0.025,
      "hp": 2.1,
      "seed": 50083,
      "startGold": 40,
      "lvUp": 2
    },
    {
      "id": "5-2",
      "n": "포자 군락",
      "waves": 14,
      "core": [
        22,
        3
      ],
      "spawns": [
        [
          0,
          12
        ],
        [
          12,
          15
        ]
      ],
      "q": [
        0.27,
        0.55,
        0.8
      ],
      "bed": 0.025,
      "hp": 2.15,
      "seed": 50802,
      "startGold": 60,
      "lvUp": 2,
      "enemyWeights": {
        "swamp_mender": 1.5
      }
    },
    {
      "id": "5-3",
      "n": "썩은 나루",
      "waves": 15,
      "core": [
        12,
        8
      ],
      "spawns": [
        [
          0,
          3
        ],
        [
          23,
          12
        ]
      ],
      "q": [
        0.27,
        0.55,
        0.8
      ],
      "bed": 0.025,
      "hp": 1.72,
      "seed": 51521,
      "startGold": 60,
      "lvUp": 2,
      "enemyWeights": {
        "swamp_beetle": 1.5
      }
    },
    {
      "id": "5-4",
      "n": "독수로 교차점",
      "waves": 15,
      "core": [
        2,
        8
      ],
      "spawns": [
        [
          23,
          2
        ],
        [
          23,
          14
        ],
        [
          12,
          0
        ]
      ],
      "q": [
        0.27,
        0.55,
        0.8
      ],
      "bed": 0.025,
      "hp": 1.91,
      "seed": 52240,
      "startGold": 60,
      "lvUp": 2,
      "enemyWeights": {
        "swamp_spitter": 1.5
      }
    },
    {
      "id": "5-5",
      "n": "나방의 둥지",
      "enemyWeights": {
        "swamp_moth": 3,
        "swamp_runner": 0.7
      },
      "waves": 15,
      "core": [
        12,
        13
      ],
      "spawns": [
        [
          0,
          1
        ],
        [
          23,
          1
        ],
        [
          12,
          0
        ]
      ],
      "q": [
        0.27,
        0.55,
        0.8
      ],
      "bed": 0.025,
      "hp": 1.72,
      "seed": 52959,
      "startGold": 60,
      "lvUp": 2
    },
    {
      "id": "5-6",
      "n": "역병의 심장",
      "waves": 15,
      "core": [
        22,
        8
      ],
      "spawns": [
        [
          0,
          1
        ],
        [
          0,
          8
        ],
        [
          0,
          15
        ],
        [
          12,
          15
        ]
      ],
      "q": [
        0.27,
        0.55,
        0.8
      ],
      "bed": 0.025,
      "hp": 2.35,
      "seed": 53678,
      "startGold": 60,
      "boss": true,
      "lvUp": 2,
      "enemyWeights": {
        "swamp_beetle": 1.2,
        "swamp_mender": 1.2
      }
    }
  ]
};
