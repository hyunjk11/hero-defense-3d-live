export default {
  "id": 8,
  "n": "8장 · 기계 요새",
  "short": "요새",
  "theme": "machine",
  "prop": "machine",
  "propN": "동력과 장갑",
  "propD": "정비 드론 · 관통 사격 · 동력로 개방",
  "color": "#e9a862",
  "bg": "linear-gradient(160deg,#e9a86255,#101c2b)",
  "stages": [
    {
      "id": "8-1",
      "n": "외곽 철문",
      "waves": 13,
      "core": [
        1,
        8
      ],
      "spawns": [
        [
          23,
          8
        ]
      ],
      "q": [
        0.28,
        0.52,
        0.6
      ],
      "bed": 0.025,
      "hp": 2.9,
      "seed": 80083,
      "startGold": 40,
      "lvUp": 2
    },
    {
      "id": "8-2",
      "n": "정비 격납고",
      "waves": 14,
      "core": [
        1,
        3
      ],
      "spawns": [
        [
          23,
          12
        ],
        [
          11,
          15
        ]
      ],
      "q": [
        0.28,
        0.52,
        0.6
      ],
      "bed": 0.025,
      "hp": 2.95,
      "seed": 80802,
      "startGold": 60,
      "enemyWeights": {
        "repair_drone": 2.4,
        "gear_hound": 0.8
      },
      "lvUp": 2
    },
    {
      "id": "8-3",
      "n": "장갑 수송로",
      "waves": 15,
      "core": [
        11,
        8
      ],
      "spawns": [
        [
          23,
          3
        ],
        [
          0,
          12
        ]
      ],
      "q": [
        0.28,
        0.52,
        0.6
      ],
      "bed": 0.025,
      "hp": 2.34,
      "seed": 81521,
      "startGold": 60,
      "walls": [
        [
          [
            3,
            5
          ],
          [
            10,
            5
          ]
        ],
        [
          [
            14,
            5
          ],
          [
            21,
            5
          ]
        ],
        [
          [
            5,
            11
          ],
          [
            18,
            11
          ]
        ]
      ],
      "enemyWeights": {
        "machine_guard": 2.2
      },
      "lvUp": 2
    },
    {
      "id": "8-4",
      "n": "포격 제어실",
      "waves": 15,
      "core": [
        21,
        8
      ],
      "spawns": [
        [
          0,
          2
        ],
        [
          0,
          14
        ],
        [
          11,
          0
        ]
      ],
      "q": [
        0.28,
        0.52,
        0.6
      ],
      "bed": 0.025,
      "hp": 2.59,
      "seed": 82240,
      "startGold": 60,
      "walls": [
        [
          [
            7,
            0
          ],
          [
            7,
            5
          ]
        ],
        [
          [
            7,
            9
          ],
          [
            7,
            15
          ]
        ],
        [
          [
            16,
            3
          ],
          [
            16,
            12
          ]
        ]
      ],
      "enemyWeights": {
        "siege_crawler": 2.3,
        "rivet_gunner": 1.4
      },
      "lvUp": 2
    },
    {
      "id": "8-5",
      "n": "중앙 동력로",
      "waves": 15,
      "core": [
        11,
        13
      ],
      "spawns": [
        [
          23,
          1
        ],
        [
          0,
          1
        ],
        [
          11,
          0
        ]
      ],
      "q": [
        0.28,
        0.52,
        0.6
      ],
      "bed": 0.025,
      "hp": 2.33,
      "seed": 82959,
      "startGold": 60,
      "walls": [
        [
          [
            3,
            5
          ],
          [
            10,
            5
          ]
        ],
        [
          [
            14,
            5
          ],
          [
            21,
            5
          ]
        ],
        [
          [
            5,
            11
          ],
          [
            18,
            11
          ]
        ]
      ],
      "enemyWeights": {
        "coil_wasp": 2,
        "rivet_gunner": 1.5
      },
      "lvUp": 2
    },
    {
      "id": "8-6",
      "n": "총감독 아르곤",
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
        0.6
      ],
      "bed": 0.025,
      "hp": 3.15,
      "seed": 83678,
      "startGold": 60,
      "boss": true,
      "walls": [
        [
          [
            7,
            0
          ],
          [
            7,
            5
          ]
        ],
        [
          [
            7,
            9
          ],
          [
            7,
            15
          ]
        ],
        [
          [
            16,
            3
          ],
          [
            16,
            12
          ]
        ]
      ],
      "enemyWeights": {
        "repair_drone": 1.3,
        "machine_guard": 1.2
      },
      "lvUp": 2
    }
  ]
};
