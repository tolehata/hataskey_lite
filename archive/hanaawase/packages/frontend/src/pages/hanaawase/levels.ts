/** 花常の本編36面。難易度と運の配分はここだけで調整する。 */
import type { AmbienceKind } from "./ambience.js";
import { FLOWERS } from "./engine.js";
import type { Flower } from "./engine.js";
import type { BossId } from "./bosses.js";

export type StageId = `m${number}-${1 | 2 | 3}`;
export type BoardPreset = readonly (readonly Flower[])[];
export type StageDefinition = Readonly<{
	id: StageId;
	month: number;
	monthName: string;
	flower: Flower;
	colors: readonly Flower[];
	moves: number;
	goalNeed?: number;
	starScores: readonly [number, number, number];
	boardPreset?: BoardPreset;
	outOfSeasonRate: number;
	ambience: AmbienceKind;
	boss?: BossId;
}>;

const firstStagePreset: BoardPreset = [
	["matsu", "ajisai", "ajisai", "ume", "matsu", "ume", "matsu", "ajisai"],
	["sakura", "matsu", "ume", "ume", "ajisai", "sakura", "ume", "matsu"],
	["ume", "ajisai", "matsu", "sakura", "matsu", "sakura", "ajisai", "ume"],
	["matsu", "ume", "sakura", "ajisai", "ume", "ume", "matsu", "ajisai"],
	["matsu", "ajisai", "matsu", "ajisai", "ume", "ajisai", "sakura", "ume"],
	["ume", "sakura", "ume", "sakura", "matsu", "sakura", "ume", "matsu"],
	["matsu", "sakura", "ume", "ume", "matsu", "ajisai", "ajisai", "sakura"],
	["ajisai", "matsu", "ajisai", "sakura", "sakura", "ume", "ajisai", "sakura"],
];

const plans = [
	{ month: 1, monthName: "睦月", flower: "matsu", colorCount: 4, moves: 24, goals: [16, 20, 24], outOfSeasonRate: 0, ambience: "shop" },
	{ month: 2, monthName: "如月", flower: "ume", colorCount: 4, moves: 24, goals: [18, 22, 26], outOfSeasonRate: 0, ambience: "shop" },
	{ month: 3, monthName: "弥生", flower: "sakura", colorCount: 5, moves: 26, goals: [20, 24], outOfSeasonRate: 0, ambience: "shop", boss: "haruare" },
	{ month: 4, monthName: "卯月", flower: "sakura", colorCount: 5, moves: 26, goals: [22, 26, 30], outOfSeasonRate: 0, ambience: "shop" },
	{ month: 5, monthName: "皐月", flower: "ajisai", colorCount: 5, moves: 26, goals: [24, 28, 32], outOfSeasonRate: 0, ambience: "shop" },
	{ month: 6, monthName: "水無月", flower: "ajisai", colorCount: 5, moves: 28, goals: [24, 28], outOfSeasonRate: 0, ambience: "rain", boss: "samidare" },
	{ month: 7, monthName: "文月", flower: "himawari", colorCount: 5, moves: 28, goals: [26, 30, 34], outOfSeasonRate: 0.15, ambience: "shop" },
	{ month: 8, monthName: "葉月", flower: "himawari", colorCount: 6, moves: 28, goals: [26, 30, 34], outOfSeasonRate: 0.15, ambience: "shop" },
	{ month: 9, monthName: "長月", flower: "kiku", colorCount: 6, moves: 30, goals: [28, 32], outOfSeasonRate: 0.2, ambience: "wind", boss: "nowaki" },
	{ month: 10, monthName: "神無月", flower: "kiku", colorCount: 6, moves: 30, goals: [30, 34, 38], outOfSeasonRate: 0.2, ambience: "shop" },
	{ month: 11, monthName: "霜月", flower: "ume", colorCount: 6, moves: 30, goals: [30, 34, 38], outOfSeasonRate: 0.25, ambience: "shop" },
	{ month: 12, monthName: "師走", flower: "matsu", colorCount: 6, moves: 32, goals: [32, 36], outOfSeasonRate: 0.3, ambience: "shop", boss: "ooshimo" },
] as const;

const scoreThresholds = (goalNeed: number): [number, number, number] => [
	0,
	goalNeed * 16,
	goalNeed * 27,
];

export const LEVELS: readonly StageDefinition[] = plans.flatMap((plan) =>
	[1, 2, 3].map((stageNumber) => {
		const boss = stageNumber === 3 && "boss" in plan ? plan.boss : undefined;
		const goalNeed = boss ? undefined : plan.goals[stageNumber - 1];
		return {
			id: `m${plan.month}-${stageNumber}` as StageId,
			month: plan.month,
			monthName: plan.monthName,
			flower: plan.flower,
			colors: FLOWERS.slice(0, plan.colorCount),
			moves: plan.moves,
			...(goalNeed === undefined ? {} : { goalNeed }),
			starScores: scoreThresholds(goalNeed ?? plan.goals[plan.goals.length - 1] ?? 0),
			...(plan.month === 1 && stageNumber === 1 ? { boardPreset: firstStagePreset } : {}),
			outOfSeasonRate: plan.outOfSeasonRate,
			ambience: boss === "ooshimo" ? "silent" : plan.ambience,
			...(boss ? { boss } : {}),
		};
	}),
);

export const levelById = (id: StageId) => LEVELS.find((stage) => stage.id === id);
