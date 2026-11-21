# 전역 `G` 레지스트리 (C-7, 2026-10-23)

`window.G` (src/core/state.js) 는 상태 + 모듈 간 함수 훅을 담는 공용 객체. 여러 모듈이 런타임에 속성을 붙이고, 테스트(tests/*.py)가 `G.` 이름을 직접 씀 → **이름은 API 로 고정** (바꾸지 말 것).

규칙
- 새 속성/훅을 붙이면 `node tests/gregistry.mjs --write` 로 아래 표를 갱신하고 설명 칸을 채운다 (`tests/gregistry.test.mjs` 가 빠진 이름을 잡음).
- 런타임 동작은 바꾸지 않음: state.js 에 null 로 미리 선언하지 않는다 (`G.x === undefined`·`'x' in G` 검사가 있을 수 있어서). 이 문서가 선언 목록.
- 영웅별 스냅샷(`Object.assign(G, L)` — hero.js withHero, dungeon/run.js 파티)은 영웅 상태 키를 통째로 바꿔 끼움: `hero perm equip legend adv` 등.
- 설명 칸이 자동 추정(함수 훅/계측/던전 상태…)인 줄은 정의 위치를 보고 고쳐도 됨 — `--write` 가 고친 설명을 유지함.

<!-- AUTO -->
| 속성 | 설정하는 모듈 (src/) | 테스트 참조 수 | 설명 |
|---|---|---:|---|
| `adv` | ui/flow.js | 3 |  |
| `advBar` | ui/flow.js | 1 |  |
| `advDmg` | heroes/advfx.js | 2 | 계측/카운터 (테스트·통계용) |
| `advHeal` | heroes/advfx.js · heroes/fighter.js | 2 |  |
| `advModelFail` | dungeon/run.js · heroes/hard-party.js · heroes/practice-party.js · ui/flow.js · ui/select.js | 1 |  |
| `advN` | heroes/advfx.js | 43 | 계측/카운터 (테스트·통계용) |
| `allModels` | main.js | 3 | main.js 가 노출하는 값/함수 |
| `autoSkill` | heroes/autoskill.js | 3 | ⚡ 스킬 자동 사용 켜짐 여부 (localStorage hd3d_autoSkill, 기본 false · 2026-10-24) |
| `autoSkillLast` | heroes/autoskill.js | 7 | ⚡ 마지막 자동 시전 {cls, skill, why(cluster/boss/elite/line/hp), n, x, z, t} (테스트·디버그용) |
| `autoSkillN` | heroes/autoskill.js | 6 | ⚡ 자동 시전 횟수 (계측/카운터, 테스트용) |
| `autoSkillT` | heroes/autoskill.js | 2 | ⚡ 다음 자동 판단까지 남은 시간 (게임 시간, 0.25초 주기) |
| `autoWaveAt` | ui/autowave.js | 0 | Q-13 다음 웨이브 자동 시작 시각 (G.t 기준, 0 = 꺼짐) |
| `awakeningLevel` | heroes/hero.js · ui/flow.js | 0 |  |
| `awakeningUseE` | heroes/hero.js · ui/flow.js | 0 |  |
| `barRes` | ui/flow.js | 1 | 🧱 바리케이드 보강 연구 배수 (account/steel.js barMul, 판 시작 시 · 2026-10-24) |
| `BARS` | main.js | 1 | main.js 가 노출하는 값/함수 |
| `beamAttackResearch` | ui/flow.js · ui/practice.js | 0 | PC 출정 시 고정되는 광선탑 심화 공격력 가산치 |
| `bgModels` | main.js | 0 | main.js 가 노출하는 값/함수 |
| `blessTab` | ui/flow.js | 8 |  |
| `BLK` | main.js | 1 | main.js 가 노출하는 값/함수 |
| `build` | main.js | 28 | 함수 훅 (다른 모듈·테스트가 호출) |
| `buildReason` | main.js | 16 | 함수 훅 (다른 모듈·테스트가 호출) |
| `cam` | main.js | 86 | main.js 가 노출하는 값/함수 |
| `carve` | main.js | 1 | 함수 훅 (다른 모듈·테스트가 호출) |
| `carved` | world/terrain.js | 4 |  |
| `castLegend` | main.js | 2 | 함수 훅 (다른 모듈·테스트가 호출) |
| `castSkill` | main.js | 9 | 함수 훅 (다른 모듈·테스트가 호출) |
| `choose` | main.js | 49 | main.js 가 노출하는 값/함수 |
| `chooseBranch` | main.js | 5 | 함수 훅 (다른 모듈·테스트가 호출) |
| `chooseWait` | ui/select.js | 0 | 함수 훅 (다른 모듈·테스트가 호출) |
| `CLASSES` | main.js | 0 | main.js 가 노출하는 값/함수 |
| `classic` | core/state.js | 0 | 기본 상태 (state.js 초기값) |
| `closeBlessing` | ui/flow.js | 4 | 함수 훅 (다른 모듈·테스트가 호출) |
| `closeLab` | ui/flow.js | 3 | 함수 훅 (다른 모듈·테스트가 호출) |
| `coins` | core/state.js | 0 | 기본 상태 (state.js 초기값) |
| `completedWaves` | core/waves.js · ui/flow.js | 1 |  |
| `computeDist` | main.js | 5 | main.js 가 노출하는 값/함수 |
| `CORE` | main.js | 21 | main.js 가 노출하는 값/함수 |
| `coreHb` | world/terrain.js | 0 |  |
| `coreHp` | core/state.js · monsters/enemy.js | 28 | 기본 상태 (state.js 초기값) |
| `coreMax` | core/state.js | 15 | 기본 상태 (state.js 초기값) |
| `curHero` | heroes/hero.js | 0 |  |
| `D` | core/state.js · world/pathfinding.js | 0 | 기본 상태 (state.js 초기값) |
| `damageTile` | main.js | 1 | 함수 훅 (다른 모듈·테스트가 호출) |
| `damageTower` | main.js | 4 | main.js 가 노출하는 값/함수 |
| `dg` | dungeon/run.js | 119 | 던전 상태 |
| `dgAiSkills` | dungeon/run.js | 6 | 던전 상태 |
| `dgB` | dungeon/boss.js | 20 | 던전 상태 |
| `dgBlessLog` | dungeon/run.js | 0 | 계측/카운터 (테스트·통계용) |
| `dgBossClear` | dungeon/boss.js | 0 | 던전 상태 |
| `dgBossModel` | dungeon/run.js | 2 | 던전 상태 |
| `dgDmg` | dungeon/run.js | 1 | 계측/카운터 (테스트·통계용) |
| `dgEntry` | ui/dungeon.js | 2 | 던전 상태 |
| `dgEntryMode` | dungeon/run.js | 8 | 던전 상태 |
| `dgJoint` | dungeon/run.js | 6 | 던전 상태 |
| `dgJointHits` | dungeon/run.js | 1 | 계측/카운터 (테스트·통계용) |
| `dgJointN` | dungeon/run.js | 0 | 계측/카운터 (테스트·통계용) |
| `dgLastBuy` | ui/dungeon.js | 10 | 던전 상태 |
| `dgM` | dungeon/run.js | 3 | 던전 상태 |
| `dgPick` | dungeon/run.js | 1 | 던전 상태 |
| `dgResult` | dungeon/run.js | 36 | 던전 상태 |
| `dgStartFloor` | dungeon/run.js | 1 | 던전 상태 |
| `dgTakeBless` | dungeon/run.js | 11 | 던전 상태 |
| `dirty` | core/state.js | 0 | 기본 상태 (state.js 초기값) |
| `distDirty` | core/state.js · world/pathfinding.js · world/terrain.js | 0 | 기본 상태 (state.js 초기값) |
| `distT` | core/state.js · main.js | 0 | 기본 상태 (state.js 초기값) |
| `dmOther` | heroes/hero.js | 7 |  |
| `dmTowers` | heroes/hero.js | 4 |  |
| `dropCh` | ui/flow.js | 1 |  |
| `dungeon` | dungeon/run.js | 18 |  |
| `endPractice` | ui/practice.js | 0 | 무보상 연습 종료 훅. 실전 보상 정산 대신 연습 결과만 표시 |
| `endStats` | ui/endstats.js | 6 |  |
| `endStatsShow` | ui/endstats.js | 0 |  |
| `endStatsUI` | ui/endstats.js | 3 |  |
| `enemies` | core/state.js | 197 | 기본 상태 (state.js 초기값) |
| `enterCost` | main.js | 0 | main.js 가 노출하는 값/함수 |
| `equip` | ui/flow.js | 1 |  |
| `ETYPES` | main.js | 14 | main.js 가 노출하는 값/함수 |
| `field` | main.js | 2 | main.js 가 노출하는 값/함수 |
| `fieldInfo` | main.js | 2 | main.js 가 노출하는 값/함수 |
| `focus` | dungeon/run.js · ui/flow.js | 0 |  |
| `frameN` | monsters/ai.js | 0 | 계측/카운터 (테스트·통계용) |
| `ftN` | heroes/fighter.js | 48 | 계측/카운터 (테스트·통계용) |
| `fxs` | core/state.js | 0 | 기본 상태 (state.js 초기값) |
| `gear` | ui/flow.js | 253 | 장비 UI·세이브 핸들 (E·Acc·P·openInv…). 2026-10-24 📦 창고: 새 키 `G.gear.SG` = account/storage.js 모듈 (테스트용 · 새 최상위 G 속성 없음), `openInv('stor')` 로 창고 탭 |
| `GH` | main.js | 23 | main.js 가 노출하는 값/함수 |
| `GL` | main.js | 8 | main.js 가 노출하는 값/함수 |
| `gold` | core/state.js · core/waves.js · dungeon/run.js · monsters/enemy.js · ui/flow.js · ui/input.js · world/towers.js | 66 | 기본 상태 (state.js 초기값) |
| `grow` | core/state.js · dungeon/run.js · ui/flow.js · ui/practice.js | 6 | 기본 상태 (state.js 초기값) |
| `GROW` | main.js | 3 | main.js 가 노출하는 값/함수 |
| `growthEnabled` | dungeon/run.js · ui/flow.js · ui/practice.js | 0 |  |
| `gunN` | heroes/gunner.js | 7 | 계측/카운터 (테스트·통계용) |
| `GW` | main.js | 20 | main.js 가 노출하는 값/함수 |
| `hardParty` | heroes/hard-party.js · ui/practice.js | 0 |  |
| `hardPulseHits` | monsters/hard.js | 0 | 하드 예고 공격 완료 횟수 (계측) |
| `help` | ui/help.js | 2 | Q-3 단축키 안내 { openHelp, closeHelp, helpOpen, HELP } |
| `hero` | heroes/hero.js | 589 |  |
| `heroDamage` | main.js | 18 | main.js 가 노출하는 값/함수 |
| `heroEN` | heroes/legend.js | 0 | 계측/카운터 (테스트·통계용) |
| `heroes` | heroes/hero.js | 139 |  |
| `heroGoTo` | main.js | 5 | 함수 훅 (다른 모듈·테스트가 호출) |
| `heroLevel` | ui/flow.js | 0 |  |
| `heroShot` | main.js | 0 | 함수 훅 (다른 모듈·테스트가 호출) |
| `heroShotMode` | main.js | 2 | main.js 가 노출하는 값/함수 |
| `heroStat` | heroes/hero.js | 4 |  |
| `heroTree` | ui/flow.js | 0 | 출정 시 고정한 영웅 특성 스냅샷 |
| `hoverTile` | main.js | 3 | main.js 가 노출하는 값/함수 |
| `hpMul` | core/waves.js · dungeon/run.js · ui/practice.js | 3 |  |
| `hurt` | main.js | 83 | main.js 가 노출하는 값/함수 |
| `labTab` | ui/lab.js | 2 |  |
| `legend` | ui/flow.js | 1 | 전설 스킬 상태 |
| `legendDmg` | heroes/advance-e.js · heroes/fighter.js · heroes/gunner.js · heroes/legend.js · heroes/mechanic.js | 16 | 계측/카운터 (테스트·통계용) |
| `legendDmgGun` | heroes/gunner.js | 0 | 계측/카운터 (테스트·통계용) |
| `legendN` | heroes/legend.js | 32 | 계측/카운터 (테스트·통계용) |
| `legendSeed` | heroes/legend.js | 4 | 전설 스킬 상태 |
| `lfx` | heroes/legend.js | 8 | 전설 스킬 상태 |
| `loadPlan` | main.js | 0 | 함수 훅 (다른 모듈·테스트가 호출) |
| `lowQ` | monsters/ai.js | 0 |  |
| `makeEnemyModel` | main.js | 2 | main.js 가 노출하는 값/함수 |
| `manual` | core/state.js | 76 | 기본 상태 (state.js 초기값) |
| `mechN` | heroes/mechanic.js | 18 | 계측/카운터 (테스트·통계용) |
| `mK` | combat/projectiles.js · core/state.js · dungeon/run.js · heroes/hero.js | 0 | 기본 상태 (state.js 초기값) |
| `mouseGround` | main.js | 24 | main.js 가 노출하는 값/함수 |
| `mTw` | combat/projectiles.js · world/towers.js | 0 |  |
| `mWho` | combat/projectiles.js · dungeon/run.js · world/towers.js | 3 |  |
| `navigating` | ui/flow.js | 0 | 페이지 이동 전 저장 대기: 시뮬레이션과 게임 키 입력을 멈춤 |
| `nextStep` | main.js | 1 | main.js 가 노출하는 값/함수 |
| `night` | core/state.js · main.js | 1 | 기본 상태 (state.js 초기값) |
| `nightTarget` | core/state.js · core/waves.js · dungeon/run.js · ui/flow.js | 0 | 기본 상태 (state.js 초기값) |
| `nudgeN` | monsters/ai.js | 3 | 계측/카운터 (테스트·통계용) |
| `onDungeonBossKilled` | dungeon/run.js | 0 | 함수 훅 (다른 모듈·테스트가 호출) |
| `onHeroDown` | dungeon/run.js | 0 | 함수 훅 (다른 모듈·테스트가 호출) |
| `onRunEnd` | ui/flow.js · ui/practice.js | 1 | 함수 훅 (다른 모듈·테스트가 호출) |
| `onStageClear` | ui/practice.js · ui/result.js | 2 | 함수 훅 (다른 모듈·테스트가 호출) |
| `onXPWave` | ui/flow.js · ui/practice.js | 1 | 함수 훅 (다른 모듈·테스트가 호출) |
| `openBlessing` | ui/flow.js | 6 | 함수 훅 (다른 모듈·테스트가 호출) |
| `openDungeon` | ui/dungeon.js | 21 | 함수 훅 (다른 모듈·테스트가 호출) |
| `openLab` | ui/lab.js | 4 | 함수 훅 (다른 모듈·테스트가 호출) |
| `partyAI` | dungeon/run.js · heroes/hard-party.js · heroes/practice-party.js · ui/practice.js | 6 |  |
| `pathStats` | main.js · world/pathfinding.js | 1 |  |
| `pathVer` | world/pathfinding.js | 0 |  |
| `paused` | dungeon/run.js · ui/speed.js | 19 |  |
| `pendingSpawns` | main.js | 0 | main.js 가 노출하는 값/함수 |
| `perm` | ui/flow.js | 4 |  |
| `phase` | core/waves.js · dungeon/run.js · ui/flow.js · ui/practice.js · ui/result.js · ui/select.js | 142 |  |
| `play` | main.js | 3 | main.js 가 노출하는 값/함수 |
| `practice` | ui/practice.js | 0 | 저장소 격리된 무보상 연습 페이지 여부. 전투·결과 저장 가드 |
| `practiceHard` | ui/practice.js | 0 | 샌드박스에서 활성 웨이브 정예 및 하드 전투 규칙. 정산 모드에는 영향 없음. |
| `practiceParty` | heroes/practice-party.js | 0 | 연습장 5인 편성과 조작 영웅 기본 공격 및 동료 AI 설정. |
| `practiceSandbox` | main.js · ui/practice.js | 0 | PC와 모바일 연습장의 맵·전투·건설·통계 전용 기능. |
| `practiceWavePlan` | ui/practice.js | 0 | 현재 샌드박스 웨이브의 소환 구성과 정예 제한. |
| `projs` | core/state.js | 5 | 기본 상태 (state.js 초기값) |
| `Q` | main.js | 14 | main.js 가 노출하는 값/함수 |
| `ready` | core/state.js · main.js | 133 | 기본 상태 (state.js 초기값) |
| `refreshTile` | main.js | 5 | 함수 훅 (다른 모듈·테스트가 호출) |
| `renderer` | main.js | 11 | main.js 가 노출하는 값/함수 |
| `repairAll` | main.js | 0 | main.js 가 노출하는 값/함수 |
| `repairTower` | main.js | 2 | main.js 가 노출하는 값/함수 |
| `research` | core/state.js · dungeon/run.js · ui/flow.js | 4 | 기본 상태 (state.js 초기값) |
| `ROSTER` | main.js | 0 | main.js 가 노출하는 값/함수 |
| `ROSTERS` | main.js | 3 | main.js 가 노출하는 값/함수 |
| `route` | render/route.js | 17 |  |
| `routes` | render/route.js | 10 |  |
| `routeVis` | render/route.js | 1 |  |
| `runBossKills` | dungeon/run.js · monsters/enemy.js · ui/flow.js | 1 | 계측/카운터 (테스트·통계용) |
| `runDrops` | dungeon/run.js · monsters/enemy.js · ui/flow.js | 4 |  |
| `runSaved` | ui/result.js | 0 |  |
| `runStart` | dungeon/run.js · ui/flow.js | 1 |  |
| `scene` | main.js | 34 | main.js 가 노출하는 값/함수 |
| `screen` | ui/flow.js | 188 |  |
| `screenMusic` | ui/flow.js | 0 |  |
| `seenMon` | core/waves.js | 2 |  |
| `sel` | core/state.js · ui/input.js | 0 | 기본 상태 (state.js 초기값) |
| `select` | main.js | 15 | main.js 가 노출하는 값/함수 |
| `sellTower` | main.js | 5 | main.js 가 노출하는 값/함수 |
| `setAutoSkill` | heroes/autoskill.js | 2 | ⚡ setAutoSkill(on, quiet) — 토글·저장·HUD/설정 칸 동기화 (함수 훅, 테스트도 사용) |
| `setDungeonAuto` | dungeon/run.js | 0 | 함수 훅 (다른 모듈·테스트가 호출) |
| `setPaused` | ui/speed.js | 7 | 함수 훅 (다른 모듈·테스트가 호출) |
| `setSpeed` | ui/speed.js | 6 | 함수 훅 (다른 모듈·테스트가 호출) |
| `setTool` | main.js | 5 | 함수 훅 (다른 모듈·테스트가 호출) |
| `shake` | combat/projectiles.js · core/state.js · dungeon/boss.js · dungeon/run.js · heroes/advfx.js · heroes/fighter.js · heroes/gunner.js · heroes/hero.js · heroes/legend.js · heroes/mechanic.js · main.js · monsters/abilities.js · monsters/ai.js · monsters/enemy.js · world/growth.js · world/terrain.js · world/towers.js | 1 | 기본 상태 (state.js 초기값) |
| `shop` | ui/shop.js | 77 |  |
| `sim` | main.js | 473 | main.js 가 노출하는 값/함수 |
| `slowF` | heroes/fighter.js · heroes/mechanic.js | 0 |  |
| `slowN` | heroes/mechanic.js | 0 | 계측/카운터 (테스트·통계용) |
| `slowT` | heroes/fighter.js · heroes/mechanic.js · main.js | 2 |  |
| `Snd` | main.js | 23 | main.js 가 노출하는 값/함수 |
| `SPAWN` | main.js | 4 | 계측/카운터 (테스트·통계용) |
| `spawnE` | core/waves.js · ui/practice.js | 7 |  |
| `spawnEnemy` | main.js | 31 | main.js 가 노출하는 값/함수 |
| `spawnIdx` | monsters/enemy.js | 0 |  |
| `spawnQ` | core/state.js · core/waves.js · ui/practice.js | 48 | 기본 상태 (state.js 초기값) |
| `SPAWNS` | main.js | 8 | main.js 가 노출하는 값/함수 |
| `spawnT` | core/waves.js · main.js · ui/practice.js | 0 |  |
| `spClaim` | ui/spire.js | 6 | 🗼 마지막 주간 보상 받기 결과 {ok, week, rank, souls, medals, title} (T-9, 테스트 확인용) |
| `speed` | ui/speed.js | 14 |  |
| `spEntry` | ui/spire.js | 0 | 🗼 T-8 탑 입장 화면 출발 결과 (account/spire.js spStart: ranked/practice/blocked) — 디버그·테스트용 |
| `spire` | dungeon/spire.js | 17 | 🗼 무한의 탑 판 상태 {from, week, top, practice, why, token, prevBest, pings, ft, chain} (T-7: token = 서버 도전 · pings = 체크포인트 응답 · ft = 층별 초) — 탑 판에서만 있음 (원정·일반 판 undefined) |
| `spireAtkK` | dungeon/spire.js | 3 | 🗼 T-5 몬스터 근접 공격 배수 훅 (ai.js: 😡 광폭) — 탑 판에서만 |
| `spireDmgK` | dungeon/spire.js | 0 | 🗼 T-5 영웅 피해 배수 훅 (enemy.js hurt: 🔮마법·🏹원거리 저항) — 탑 판에서만 |
| `spireE` | dungeon/spire.js | 1 | 🗼 탑 몬스터 정의 훅 (enemy.js spawnEnemy: 정예·보스 체력·가속·철갑) — 탑 판에서만 |
| `spRank` | ui/spire.js | 2 | 🗼 T-8 마지막으로 불러온 랭킹 응답 (spRank: top·me) — 디버그·테스트용 |
| `stage` | dungeon/run.js · ui/flow.js | 35 |  |
| `STAGE_CFG` | main.js | 8 | main.js 가 노출하는 값/함수 |
| `stageSel` | ui/flow.js | 31 |  |
| `startWarp` | main.js | 6 | 함수 훅 (다른 모듈·테스트가 호출) |
| `startWave` | main.js | 47 | 함수 훅 (다른 모듈·테스트가 호출) |
| `stats` | core/state.js | 51 | 기본 상태 (state.js 초기값) |
| `statsUI` | ui/stats.js | 8 |  |
| `structVer` | world/pathfinding.js | 0 |  |
| `t` | core/state.js · main.js | 20 | 기본 상태 (state.js 초기값) |
| `T` | main.js | 9 | main.js 가 노출하는 값/함수 |
| `THREE` | main.js | 15 | main.js 가 노출하는 값/함수 |
| `tileAt` | main.js | 40 | main.js 가 노출하는 값/함수 |
| `tiles` | core/state.js · world/terrain.js | 5 | 기본 상태 (state.js 초기값) |
| `tileXZ` | main.js | 37 | 함수 훅 (다른 모듈·테스트가 호출) |
| `timers` | core/state.js | 0 | 기본 상태 (state.js 초기값) |
| `tool` | core/state.js · main.js · ui/input.js · ui/mobile-controls.js | 7 | 기본 상태 (state.js 초기값) |
| `toTile` | main.js | 22 | main.js 가 노출하는 값/함수 |
| `towerRateK` | main.js | 10 | main.js 가 노출하는 값/함수 |
| `towers` | core/state.js | 83 | 기본 상태 (state.js 초기값) |
| `TOWERS` | main.js | 10 | main.js 가 노출하는 값/함수 |
| `towerXp` | main.js | 10 | Combat XP entry point |
| `townGoal` | ui/flow.js | 7 | 함수 훅 (다른 모듈·테스트가 호출) |
| `townHero` | ui/flow.js | 27 | 함수 훅 (다른 모듈·테스트가 호출) |
| `townLab` | ui/flow.js | 2 | 함수 훅 (다른 모듈·테스트가 호출) |
| `townShop` | ui/flow.js | 1 | 함수 훅 (다른 모듈·테스트가 호출) |
| `townSmith` | ui/flow.js | 1 | 함수 훅 (다른 모듈·테스트가 호출) |
| `townTeleport` | ui/flow.js | 11 | 함수 훅 (다른 모듈·테스트가 호출) |
| `townTower` | ui/flow.js | 5 | 함수 훅 (다른 모듈·테스트가 호출) |
| `trialAxis` | ui/mobile-controls.js | 0 | 모바일 이동 스틱 축 (PC에는 미설정) |
| `unjamN` | monsters/ai.js | 0 | 계측/카운터 (테스트·통계용) |
| `unstuckN` | heroes/hero.js | 0 | 계측/카운터 (테스트·통계용) |
| `upgradeTower` | main.js | 8 | main.js 가 노출하는 값/함수 |
| `ups` | core/state.js | 6 | 기본 상태 (state.js 초기값) |
| `wallsBroken` | world/terrain.js | 1 |  |
| `warpN` | heroes/hero.js | 4 | 계측/카운터 (테스트·통계용) |
| `wave` | core/state.js · core/waves.js · dungeon/run.js · ui/practice.js | 39 | 기본 상태 (state.js 초기값) |
| `waveLog` | heroes/hero.js | 5 | 계측/카운터 (테스트·통계용) |
| `wavePrev` | ui/waveprev.js | 4 |  |
| `withHero` | heroes/hero.js | 4 | 함수 훅 (다른 모듈·테스트가 호출) |
| `xpPendingWrite` | ui/flow.js · ui/result.js | 0 |  |
| `xpRun` | ui/flow.js · ui/practice.js | 0 |  |
