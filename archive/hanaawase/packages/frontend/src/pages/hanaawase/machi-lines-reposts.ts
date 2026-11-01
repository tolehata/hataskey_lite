// 花常「街の様子」投稿取消→投稿しなおし→別NPC反応、全250パターンの結線。
// ⚠️個々の文面は repost01〜05 に静的に記載してあり、組み合わせによる水増しはしない。

import { MACHI_REPOST_SCENARIOS_01 } from './machi-lines-repost01.js';
import { MACHI_REPOST_SCENARIOS_02 } from './machi-lines-repost02.js';
import { MACHI_REPOST_SCENARIOS_03 } from './machi-lines-repost03.js';
import { MACHI_REPOST_SCENARIOS_04 } from './machi-lines-repost04.js';
import { MACHI_REPOST_SCENARIOS_05 } from './machi-lines-repost05.js';

export type { MachiRepostScenario } from './machi-lines-repost01.js';

export const MACHI_REPOST_SCENARIOS = [
	...MACHI_REPOST_SCENARIOS_01,
	...MACHI_REPOST_SCENARIOS_02,
	...MACHI_REPOST_SCENARIOS_03,
	...MACHI_REPOST_SCENARIOS_04,
	...MACHI_REPOST_SCENARIOS_05,
] as const;
