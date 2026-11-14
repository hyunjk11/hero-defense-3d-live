// The server stamps the reward version at departure; old runs keep their contract.
export const HARD_REWARD_VERSION = 2;
export const COLLECTION_ODDS = Object.freeze([50, 35, 15, 0, 0]);
export const collectionChapter = ch => Number.isInteger(ch) && ch >= 1 && ch <= 5;
export const collectionCount = (stage, completed, win, first, version) =>
  version === HARD_REWARD_VERSION && stage?.hard && collectionChapter(stage.ch) &&
  win && !first && completed === stage.waves ? 2 : 0;
// Separate display-only collection from the existing completion/reward mask.
export const optionalCollectionGrade = (ch, grade) => collectionChapter(ch) && ch >= 3 && grade === 0;
