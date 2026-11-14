export default {
  "id": 7,
  "n": "7장 · 폭풍 군도",
  "short": "폭풍",
  "theme": "storm",
  "prop": "storm",
  "propN": "분열과 연쇄",
  "propD": "대공 방어 · 연쇄 번개 · 고리 뇌파",
  "color": "#79cdea",
  "bg": "linear-gradient(160deg,#79cdea55,#101c2b)",
  "stages": [
    {
      "id": "7-1",
      "n": "바람의 해안",
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
        0.28,
        0.52,
        0.68
      ],
      "bed": 0.025,
      "hp": 2.6,
      "seed": 70083,
      "startGold": 40,
      "lvUp": 2
    },
    {
      "id": "7-2",
      "n": "갈라진 날개",
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
        0.28,
        0.52,
        0.68
      ],
      "bed": 0.025,
      "hp": 2.65,
      "seed": 70802,
      "startGold": 60,
      "enemyWeights": {
        "storm_splitter": 2.2,
        "storm_runner": 0.8
      },
      "lvUp": 2
    },
    {
      "id": "7-3",
      "n": "쌍둥이 절벽",
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
        0.28,
        0.52,
        0.68
      ],
      "bed": 0.025,
      "hp": 2.11,
      "seed": 71521,
      "startGold": 60,
      "enemyWeights": {
        "storm_pikeman": 2.2
      },
      "walls": [
        [
          [
            8,
            2
          ],
          [
            8,
            5
          ]
        ],
        [
          [
            15,
            10
          ],
          [
            15,
            14
          ]
        ]
      ],
      "lvUp": 2
    },
    {
      "id": "7-4",
      "n": "번개 회랑",
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
        0.28,
        0.52,
        0.68
      ],
      "bed": 0.025,
      "hp": 2.34,
      "seed": 72240,
      "startGold": 60,
      "enemyWeights": {
        "storm_caller": 2.2
      },
      "walls": [
        [
          [
            8,
            2
          ],
          [
            8,
            6
          ]
        ],
        [
          [
            8,
            10
          ],
          [
            8,
            14
          ]
        ],
        [
          [
            16,
            6
          ],
          [
            16,
            10
          ]
        ]
      ],
      "lvUp": 2
    },
    {
      "id": "7-5",
      "n": "폭풍의 눈",
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
        0.28,
        0.52,
        0.68
      ],
      "bed": 0.025,
      "hp": 2.1,
      "seed": 72959,
      "startGold": 60,
      "enemyWeights": {
        "storm_anchor": 2,
        "storm_splitter": 1.3
      },
      "walls": [
        [
          [
            4,
            6
          ],
          [
            9,
            6
          ]
        ],
        [
          [
            15,
            6
          ],
          [
            20,
            6
          ]
        ]
      ],
      "lvUp": 2
    },
    {
      "id": "7-6",
      "n": "하늘의 심판자",
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
        0.28,
        0.52,
        0.68
      ],
      "bed": 0.025,
      "hp": 2.85,
      "seed": 73678,
      "startGold": 60,
      "boss": true,
      "enemyWeights": {
        "storm_pikeman": 1.2,
        "storm_anchor": 1.2
      },
      "walls": [
        [
          [
            7,
            1
          ],
          [
            7,
            5
          ]
        ],
        [
          [
            7,
            11
          ],
          [
            7,
            14
          ]
        ],
        [
          [
            15,
            4
          ],
          [
            15,
            6
          ]
        ],
        [
          [
            15,
            10
          ],
          [
            15,
            12
          ]
        ]
      ],
      "lvUp": 2
    }
  ]
};
