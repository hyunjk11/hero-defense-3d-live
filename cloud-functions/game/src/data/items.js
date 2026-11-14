import { ABYSS_SET, CITADEL_SET } from './chapters/endgame.js';
import { MACHINE_SET } from './chapters/machine.js';
import { STORM_SET } from './chapters/storm.js';
import { DESERT_SET } from './chapters/desert.js';
import { SWAMP_SET } from './chapters/swamp.js';
import { CAMPAIGN_SETS } from './chapters/gear.js';

// 설계: /workspace/design/items_plan.md 2장·3장. 수치(MAIN/SUBV/SUBN)는 equip.js 그대로, 챕터는 이름·서브/장신구 주스탯 가중치·배지만 다름 (파워 인플레 없음)
// names[슬롯/영웅][등급 0..4] = 등급마다 이름 1개 → 도감 칸 = (챕터, 행, 등급)
export const CHSET = {
  ...CAMPAIGN_SETS,
  5: SWAMP_SET,
  6: DESERT_SET,
  7: STORM_SET,
  8: MACHINE_SET,
  9: ABYSS_SET,
  10: CITADEL_SET,
  1: { k: 'forest', n: '숲', badge: '🌿', color: '#5ac86a', subW: { spd: 3, rng: 2, crit: 2 }, accW: { spd: 3, crit: 2, skill: 1, cdr: 1 },
    names: {
      archer: ['잔가지 활', '이끼 덮인 단궁', '요정빛 장궁', '고목 정령의 활', '숲의 숨결 그린윈드'],
      mage: ['버들가지 지팡이', '이끼 수정 지팡이', '버섯 주술 지팡이', '반딧불 정령의 홀', '세계수 가지 엘더브랜치'],
      warrior: ['나무꾼의 검', '덩굴 감긴 장검', '숲지기 기사검', '고목 심장 대검', '숲의 수호검 베르단트'],
      gunner: ['도토리탄 쌍권총', '덩굴 장식 쌍권총', '가시나무 쌍권총', '장미덩굴 쌍권총', '숲의 장미 와일드로즈'],
      mechanic: ['나무 렌치 건틀릿', '이끼 드릴암', '뿌리 파일벙커', '고목 분쇄 해머암', '숲의 굴착기 루트브레이커'],
      fighter: ['풀잎 손붕대', '도토리 너클 붕대', '이끼 고양이 손붕대', '고목 호랑이 너클', '숲의 맹묘 와일드캣'],
      armor: ['풀잎 튜닉', '사냥꾼 가죽조끼', '이끼 비늘 갑옷', '고목 껍질 갑주', '세계수 잎 망토'],
      acc: ['도토리 목걸이', '클로버 부적', '반딧불 귀걸이', '요정 날개 브로치', '숲의 눈 에메랄드'] } },
  2: { k: 'snow', n: '설원', badge: '❄️', color: '#7ad0ff', subW: { cdr: 3, skill: 2, hp: 2 }, accW: { cdr: 3, skill: 2, crit: 1, spd: 1 },
    names: {
      archer: ['서리 단궁', '얼음꽃 장궁', '백야의 활', '오로라 사수의 활', '눈보라 활 블리자드'],
      mage: ['고드름 지팡이', '서리꽃 수정홀', '백은 빙결홀', '오로라 홀', '서리여왕의 홀 니브'],
      warrior: ['얼음 칼날 장검', '설원 기사검', '빙하 대검', '백야의 서약검', '서리 거인 대검 요툰'],
      gunner: ['서리탄 쌍권총', '은빛 눈꽃 쌍권총', '빙결 탄창 쌍권총', '오로라 쌍권총', '눈의 여왕 스노우퀸'],
      mechanic: ['얼음송곳 건틀릿', '제설 드릴암', '빙하 파쇄기', '서리 증기 해머', '빙산 분쇄기 아이스버그'],
      fighter: ['털실 손붕대', '서리 손붕대', '눈표범 너클 붕대', '오로라 고양이 너클', '설원의 맹묘 스노우팡'],
      armor: ['털실 망토', '순록 가죽 코트', '서리 사슬 갑옷', '빙하 판금', '설원 군주의 털망토'],
      acc: ['눈송이 핀', '서리 수정 반지', '오로라 펜던트', '빙결 심장 목걸이', '영원설 결정'] } },
  3: { k: 'volcano', n: '화산', badge: '🔥', color: '#ff7a3a', subW: { critD: 3, crit: 2, atk: 2 }, accW: { crit: 3, skill: 2, spd: 1, cdr: 1 },
    names: {
      archer: ['잿불 단궁', '화산재 장궁', '용암 심지 활', '불새 깃 활', '화산의 분노 볼케이노'],
      mage: ['숯불 지팡이', '흑요석 지팡이', '용암 수정홀', '화염 정령의 홀', '태양핵 홀 솔라코어'],
      warrior: ['그을린 장검', '흑요석 장검', '용암 단조 대검', '화염 군주의 검', '용암 거인 대검 수르트'],
      gunner: ['화약 쌍권총', '잿빛 쌍권총', '용암탄 쌍권총', '불꽃 장미 쌍권총', '화염 장미 블레이즈로즈'],
      mechanic: ['화산 렌치 건틀릿', '용암 드릴암', '흑요석 파일벙커', '마그마 해머암', '화산 굴착기 보텍스'],
      fighter: ['그을린 손붕대', '화산재 너클 붕대', '용암 고양이 손붕대', '불꽃 호랑이 너클', '화염의 맹묘 블레이즈팡'],
      armor: ['그을린 가죽옷', '화산재 사슬갑옷', '흑요석 흉갑', '용암 비늘 갑옷', '화염 군주의 판금'],
      acc: ['잿불 반지', '유황 부적', '루비 귀걸이', '용암 심장 펜던트', '불새의 눈 홍옥'] } },
  4: { k: 'ruins', n: '폐허', badge: '🏛️', color: '#c0a0ff', subW: { skill: 3, cdr: 2, rng: 2 }, accW: { skill: 3, cdr: 2, crit: 1, spd: 1 },
    names: {
      archer: ['낡은 유적 활', '룬 새긴 장궁', '망령 사냥꾼의 활', '고대 왕실 장궁', '잊혀진 별의 활 아스트랄'],
      mage: ['부서진 석장', '룬 석판 지팡이', '망령 등불 지팡이', '고대 현자의 홀', '잊혀진 지혜 아카샤'],
      warrior: ['녹슨 근위대 검', '룬 새긴 장검', '석상 기사의 대검', '고대 왕의 검', '망국의 성검 레퀴엠'],
      gunner: ['낡은 유적 쌍권총', '룬 각인 쌍권총', '망령탄 쌍권총', '고대 근위 쌍권총', '잊혀진 왕가 레갈리아'],
      mechanic: ['유적 렌치 건틀릿', '룬 드릴암', '석상 파쇄 파일벙커', '고대 골렘암', '잊혀진 기계신 데우스'],
      fighter: ['낡은 유적 손붕대', '룬 새긴 손붕대', '망령 고양이 너클', '고대 수호묘 너클', '잊혀진 묘신 바스테트'],
      armor: ['해진 순례자 로브', '근위대 사슬갑옷', '룬 각인 흉갑', '석상 기사 판금', '망국 왕실 갑주'],
      acc: ['이끼 낀 동전', '룬 조각 부적', '망령 등불 귀걸이', '고대 왕관 보석', '잊혀진 신의 눈'] } },
};
export const CH_KEYS = Object.keys(CHSET).map(Number); // Chapter IDs are multi-digit.
// 챕터 등급 하한: 3·4장은 일반 0% (재정규화는 rollGrade 가 함)
export const chOdds = (odds, ch) => (ch >= 3 ? [0, ...odds.slice(1)] : odds);
// Same chapter collection and obtainable grades; used by both hard settlement and preview.
export const hardGearOdds = ch => chOdds([2, 6, 12, 65, 15], ch);




export const CHAL_ESS = { wave: 20, chance: .15 };
export const CODEX_RW = { row: { crystal: 5 }, all: { essence: 10, souls: 500 } };
