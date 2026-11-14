export default {
  "id": 6,
  "n": "6장 · 태양의 사막",
  "short": "사막",
  "theme": "desert",
  "prop": "desert",
  "propN": "잠복과 태양핵",
  "propD": "잠복 · 방패 빈틈 · 태양 광선",
  "color": "#e4b773",
  "bg": "linear-gradient(160deg,#e4b77355,#101c2b)",
  "stages": [
    {
      "id": "6-1",
      "n": "모래 바람길",
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
        0.3,
        0.6,
        0.66
      ],
      "bed": 0.025,
      "hp": 2.35,
      "seed": 60083,
      "startGold": 40,
      "lvUp": 2
    },
    {
      "id": "6-2",
      "n": "움직이는 모래",
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
        0.3,
        0.6,
        0.66
      ],
      "bed": 0.025,
      "hp": 2.4,
      "seed": 60802,
      "startGold": 60,
      "enemyWeights": {
        "sand_burrower": 2.2
      },
      "lvUp": 2
    },
    {
      "id": "6-3",
      "n": "사암 방벽",
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
        0.3,
        0.6,
        0.66
      ],
      "bed": 0.025,
      "hp": 1.91,
      "seed": 61521,
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
        "sand_guard": 2.2
      },
      "lvUp": 2
    },
    {
      "id": "6-4",
      "n": "묻힌 관문",
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
        0.3,
        0.6,
        0.66
      ],
      "bed": 0.025,
      "hp": 2.12,
      "seed": 62240,
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
        "sand_priest": 2
      },
      "lvUp": 2
    },
    {
      "id": "6-5",
      "n": "황금 묘역",
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
        0.3,
        0.6,
        0.66
      ],
      "bed": 0.025,
      "hp": 1.91,
      "seed": 62959,
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
        "sand_vulture": 2.3,
        "sand_scout": 0.7
      },
      "lvUp": 2
    },
    {
      "id": "6-6",
      "n": "사구왕의 무덤",
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
        0.3,
        0.6,
        0.66
      ],
      "bed": 0.025,
      "hp": 2.6,
      "seed": 63678,
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
      "lvUp": 2
    }
  ]
};
