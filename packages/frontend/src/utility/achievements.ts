/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { misskeyApi } from '@/utility/misskey-api.js';
import { $i } from '@/i.js';

export const ACHIEVEMENT_TYPES = [
	'notes1',
	'notes10',
	'notes100',
	'notes500',
	'notes1000',
	'notes5000',
	'notes10000',
	'notes20000',
	'notes30000',
	'notes40000',
	'notes50000',
	'notes60000',
	'notes70000',
	'notes80000',
	'notes90000',
	'notes100000',
	'login3',
	'login7',
	'login15',
	'login30',
	'login60',
	'login100',
	'login200',
	'login300',
	'login400',
	'login500',
	'login600',
	'login700',
	'login800',
	'login900',
	'login1000',
	'passedSinceAccountCreated1',
	'passedSinceAccountCreated2',
	'passedSinceAccountCreated3',
	'loggedInOnBirthday',
	'loggedInOnNewYearsDay',
	'noteClipped1',
	'noteFavorited1',
	'myNoteFavorited1',
	'profileFilled',
	'markedAsCat',
	'following1',
	'following10',
	'following50',
	'following100',
	'following300',
	'followers1',
	'followers10',
	'followers50',
	'followers100',
	'followers300',
	'followers500',
	'followers1000',
	'collectAchievements30',
	'viewAchievements3min',
	'iLoveCherryPick',
	'foundTreasure',
	'client30min',
	'client60min',
	'noteDeletedWithin1min',
	'postedAtLateNight',
	'postedAt0min0sec',
	'selfQuote',
	'htl20npm',
	'viewInstanceChart',
	'outputHelloWorldOnScratchpad',
	'open3windows',
	'driveFolderCircularReference',
	'reactWithoutRead',
	'clickedClickHere',
	'justPlainLucky',
	'setNameToSyuilo',
	'setNameToNoriDev',
	'setNameToHatacha',
	'cookieClicked',
	'brainDiver',
	'smashTestNotificationButton',
	'tutorialCompleted',
	'bubbleGameExplodingHead',
	'bubbleGameDoubleExplodingHead',
	'hatasabaDeckTutorial',
	'welcomeToHatask',
	'welcomeToHatady',
	'hataSideStudioPioneer',
	'hatacordingUiTutorial',
	'utageSuccess10',
	'utageSuccess20',
	'utageSuccess30',
	'utageSuccess40',
	'utageSuccess50',
	'utageSuccess60',
	'utageSuccess70',
	'utageSuccess80',
	'utageSuccess90',
	'utageSuccess100',
	'utageInterruption10',
	'utageInterruption20',
	'utageInterruption30',
	'utageInterruption40',
	'utageInterruption50',
	'utageInterruption60',
	'utageInterruption70',
	'utageInterruption80',
	'utageInterruption90',
	'utageInterruption100',
	'utageInterruptionWithin5Seconds',
	'ltlPunchVictory',
	'ltlPunchDefeat',
] as const;

export type AchievementType = typeof ACHIEVEMENT_TYPES[number];
export type ServerOnlyAchievementType = Extract<AchievementType, `utage${string}` | `ltlPunch${string}`>;
export type ClientClaimableAchievementType = Exclude<AchievementType, ServerOnlyAchievementType>;

export const CLIENT_CLAIMABLE_ACHIEVEMENT_TYPES = ACHIEVEMENT_TYPES.filter(
	(type): type is ClientClaimableAchievementType => !type.startsWith('utage') && !type.startsWith('ltlPunch'),
);

export const ACHIEVEMENT_BADGES = {
	'notes1': {
		img: '/fluent-emoji/1f4dd.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'bronze',
	},
	'notes10': {
		img: '/fluent-emoji/1f4d1.png',
		bg: null,
		frame: 'bronze',
	},
	'notes100': {
		img: '/fluent-emoji/1f4d2.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'bronze',
	},
	'notes500': {
		img: '/fluent-emoji/1f4da.png',
		bg: null,
		frame: 'bronze',
	},
	'notes1000': {
		img: '/fluent-emoji/1f5c3.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'bronze',
	},
	'notes5000': {
		img: '/fluent-emoji/1f304.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'bronze',
	},
	'notes10000': {
		img: '/fluent-emoji/1f3d9.png',
		bg: 'linear-gradient(0deg, rgb(220 223 225), rgb(172 192 207))',
		frame: 'silver',
	},
	'notes20000': {
		img: '/fluent-emoji/1f307.png',
		bg: 'linear-gradient(0deg, rgb(220 223 225), rgb(172 192 207))',
		frame: 'silver',
	},
	'notes30000': {
		img: '/fluent-emoji/1f306.png',
		bg: 'linear-gradient(0deg, rgb(144 224 255), rgb(255 168 252))',
		frame: 'silver',
	},
	'notes40000': {
		img: '/fluent-emoji/1f303.png',
		bg: 'linear-gradient(0deg, rgb(197 69 192), rgb(2 112 155))',
		frame: 'silver',
	},
	'notes50000': {
		img: '/fluent-emoji/1fa90.png',
		bg: 'linear-gradient(0deg, rgb(144 224 255), rgb(255 168 252))',
		frame: 'gold',
	},
	'notes60000': {
		img: '/fluent-emoji/2604.png',
		bg: 'linear-gradient(0deg, rgb(197 69 192), rgb(2 112 155))',
		frame: 'gold',
	},
	'notes70000': {
		img: '/fluent-emoji/1f30c.png',
		bg: 'linear-gradient(0deg, rgb(144 224 255), rgb(255 168 252))',
		frame: 'gold',
	},
	'notes80000': {
		img: '/fluent-emoji/1f30c.png',
		bg: 'linear-gradient(0deg, rgb(197 69 192), rgb(2 112 155))',
		frame: 'gold',
	},
	'notes90000': {
		img: '/fluent-emoji/1f30c.png',
		bg: 'linear-gradient(0deg, rgb(255 232 119), rgb(255 140 41))',
		frame: 'gold',
	},
	'notes100000': {
		img: '/fluent-emoji/267e.png',
		bg: 'linear-gradient(0deg, rgb(255 232 119), rgb(255 140 41))',
		frame: 'platinum',
	},
	'login3': {
		img: '/fluent-emoji/1f331.png',
		bg: null,
		frame: 'bronze',
	},
	'login7': {
		img: '/fluent-emoji/1f331.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'bronze',
	},
	'login15': {
		img: '/fluent-emoji/1f331.png',
		bg: 'linear-gradient(0deg, rgb(144, 224, 255), rgb(255, 168, 252))',
		frame: 'bronze',
	},
	'login30': {
		img: '/fluent-emoji/1fab4.png',
		bg: null,
		frame: 'bronze',
	},
	'login60': {
		img: '/fluent-emoji/1fab4.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'bronze',
	},
	'login100': {
		img: '/fluent-emoji/1fab4.png',
		bg: 'linear-gradient(0deg, rgb(144, 224, 255), rgb(255, 168, 252))',
		frame: 'silver',
	},
	'login200': {
		img: '/fluent-emoji/1f333.png',
		bg: null,
		frame: 'silver',
	},
	'login300': {
		img: '/fluent-emoji/1f333.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'silver',
	},
	'login400': {
		img: '/fluent-emoji/1f333.png',
		bg: 'linear-gradient(0deg, rgb(144, 224, 255), rgb(255, 168, 252))',
		frame: 'silver',
	},
	'login500': {
		img: '/fluent-emoji/1f304.png',
		bg: null,
		frame: 'silver',
	},
	'login600': {
		img: '/fluent-emoji/1f304.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'gold',
	},
	'login700': {
		img: '/fluent-emoji/1f304.png',
		bg: 'linear-gradient(0deg, rgb(144, 224, 255), rgb(255, 168, 252))',
		frame: 'gold',
	},
	'login800': {
		img: '/fluent-emoji/1f307.png',
		bg: null,
		frame: 'gold',
	},
	'login900': {
		img: '/fluent-emoji/1f307.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'gold',
	},
	'login1000': {
		img: '/fluent-emoji/1f307.png',
		bg: 'linear-gradient(0deg, rgb(144, 224, 255), rgb(255, 168, 252))',
		frame: 'platinum',
	},
	'noteClipped1': {
		img: '/fluent-emoji/1f587.png',
		bg: null,
		frame: 'bronze',
	},
	'noteFavorited1': {
		img: '/fluent-emoji/1f31f.png',
		bg: null,
		frame: 'bronze',
	},
	'myNoteFavorited1': {
		img: '/fluent-emoji/1f320.png',
		bg: null,
		frame: 'silver',
	},
	'profileFilled': {
		img: '/fluent-emoji/1f44c.png',
		bg: 'linear-gradient(0deg, rgb(187 183 59), rgb(255 143 77))',
		frame: 'bronze',
	},
	'markedAsCat': {
		img: '/fluent-emoji/1f408.png',
		bg: 'linear-gradient(0deg, rgb(187 183 59), rgb(255 143 77))',
		frame: 'bronze',
	},
	'following1': {
		img: '/fluent-emoji/2618.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'bronze',
	},
	'following10': {
		img: '/fluent-emoji/1f6b8.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'bronze',
	},
	'following50': {
		img: '/fluent-emoji/1f91d.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'bronze',
	},
	'following100': {
		img: '/fluent-emoji/1f4af.png',
		bg: 'linear-gradient(0deg, rgb(255 53 184), rgb(255 206 69))',
		frame: 'silver',
	},
	'following300': {
		img: '/fluent-emoji/1f970.png',
		bg: 'linear-gradient(0deg, rgb(144 224 255), rgb(255 168 252))',
		frame: 'silver',
	},
	'followers1': {
		img: '/fluent-emoji/2618.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'bronze',
	},
	'followers10': {
		img: '/fluent-emoji/1f44b.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(199 211 102))',
		frame: 'bronze',
	},
	'followers50': {
		img: '/fluent-emoji/1f411.png',
		bg: 'linear-gradient(0deg, rgb(220 223 225), rgb(172 192 207))',
		frame: 'bronze',
	},
	'followers100': {
		img: '/fluent-emoji/1f60e.png',
		bg: 'linear-gradient(0deg, rgb(144 224 255), rgb(255 168 252))',
		frame: 'silver',
	},
	'followers300': {
		img: '/fluent-emoji/1f3c6.png',
		bg: 'linear-gradient(0deg, rgb(144 224 255), rgb(255 168 252))',
		frame: 'silver',
	},
	'followers500': {
		img: '/fluent-emoji/1f4e1.png',
		bg: 'linear-gradient(0deg, rgb(220 223 225), rgb(172 192 207))',
		frame: 'gold',
	},
	'followers1000': {
		img: '/fluent-emoji/1f451.png',
		bg: 'linear-gradient(0deg, rgb(255 232 119), rgb(255 140 41))',
		frame: 'platinum',
	},
	'collectAchievements30': {
		img: '/fluent-emoji/1f3c5.png',
		bg: 'linear-gradient(0deg, rgb(255 77 77), rgb(247 155 214))',
		frame: 'silver',
	},
	'viewAchievements3min': {
		img: '/fluent-emoji/1f3c5.png',
		bg: 'linear-gradient(0deg, rgb(144 224 255), rgb(255 168 252))',
		frame: 'bronze',
	},
	'iLoveCherryPick': {
		img: '/fluent-emoji/2764.png',
		bg: 'linear-gradient(0deg, rgb(255 77 77), rgb(247 155 214))',
		frame: 'silver',
	},
	'foundTreasure': {
		img: '/fluent-emoji/1f3c6.png',
		bg: 'linear-gradient(0deg, rgb(197 69 192), rgb(2 112 155))',
		frame: 'gold',
	},
	'client30min': {
		img: '/fluent-emoji/1f552.png',
		bg: 'linear-gradient(0deg, rgb(220 223 225), rgb(172 192 207))',
		frame: 'bronze',
	},
	'client60min': {
		img: '/fluent-emoji/1f552.png',
		bg: 'linear-gradient(0deg, rgb(220 223 225), rgb(172 192 207))',
		frame: 'silver',
	},
	'noteDeletedWithin1min': {
		img: '/fluent-emoji/1f5d1.png',
		bg: 'linear-gradient(0deg, rgb(220 223 225), rgb(172 192 207))',
		frame: 'bronze',
	},
	'postedAtLateNight': {
		img: '/fluent-emoji/1f319.png',
		bg: 'linear-gradient(0deg, rgb(197 69 192), rgb(2 112 155))',
		frame: 'bronze',
	},
	'postedAt0min0sec': {
		img: '/fluent-emoji/1f55b.png',
		bg: 'linear-gradient(0deg, rgb(58 231 198), rgb(37 194 255))',
		frame: 'bronze',
	},
	'selfQuote': {
		img: '/fluent-emoji/1f4dd.png',
		bg: null,
		frame: 'bronze',
	},
	'htl20npm': {
		img: '/fluent-emoji/1f30a.png',
		bg: 'linear-gradient(0deg, rgb(220 223 225), rgb(172 192 207))',
		frame: 'bronze',
	},
	'viewInstanceChart': {
		img: '/fluent-emoji/1f4ca.png',
		bg: 'linear-gradient(0deg, rgb(58 231 198), rgb(37 194 255))',
		frame: 'bronze',
	},
	'outputHelloWorldOnScratchpad': {
		img: '/fluent-emoji/1f530.png',
		bg: 'linear-gradient(0deg, rgb(58 231 198), rgb(37 194 255))',
		frame: 'bronze',
	},
	'open3windows': {
		img: '/fluent-emoji/1f5a5.png',
		bg: 'linear-gradient(0deg, rgb(144 224 255), rgb(255 168 252))',
		frame: 'bronze',
	},
	'driveFolderCircularReference': {
		img: '/fluent-emoji/1f4c2.png',
		bg: 'linear-gradient(0deg, rgb(144 224 255), rgb(255 168 252))',
		frame: 'bronze',
	},
	'reactWithoutRead': {
		img: '/fluent-emoji/2753.png',
		bg: 'linear-gradient(0deg, rgb(144 224 255), rgb(255 168 252))',
		frame: 'bronze',
	},
	'clickedClickHere': {
		img: '/fluent-emoji/2757.png',
		bg: 'linear-gradient(0deg, rgb(144 224 255), rgb(255 168 252))',
		frame: 'bronze',
	},
	'justPlainLucky': {
		img: '/fluent-emoji/1f340.png',
		bg: 'linear-gradient(0deg, rgb(187 183 59), rgb(255 143 77))',
		frame: 'silver',
	},
	'setNameToSyuilo': {
		img: '/fluent-emoji/1f36e.png',
		bg: 'linear-gradient(0deg, rgb(187 183 59), rgb(255 143 77))',
		frame: 'bronze',
	},
	'setNameToNoriDev': {
		img: '/fluent-emoji/1f36e.png',
		bg: 'linear-gradient(0deg, rgb(187 183 59), rgb(255 143 77))',
		frame: 'bronze',
	},
	'setNameToHatacha': {
		img: '/fluent-emoji/1f36e.png',
		bg: 'linear-gradient(0deg, rgb(187 183 59), rgb(255 143 77))',
		frame: 'bronze',
	},
	// 旗鯖fork: 本家 2026.6.0 から取り込み: passedSinceAccountCreated1-3 のアイコンパスを 31/32/33-20e3.png に修正 (#17482)
	'passedSinceAccountCreated1': {
		img: '/fluent-emoji/31-20e3.png',
		bg: null,
		frame: 'bronze',
	},
	'passedSinceAccountCreated2': {
		img: '/fluent-emoji/32-20e3.png',
		bg: null,
		frame: 'silver',
	},
	'passedSinceAccountCreated3': {
		img: '/fluent-emoji/33-20e3.png',
		bg: null,
		frame: 'gold',
	},
	'loggedInOnBirthday': {
		img: '/fluent-emoji/1f382.png',
		bg: 'linear-gradient(0deg, rgb(255 77 77), rgb(247 155 214))',
		frame: 'silver',
	},
	'loggedInOnNewYearsDay': {
		img: '/fluent-emoji/1f38d.png',
		bg: 'linear-gradient(0deg, rgb(255 144 144), rgb(255 232 168))',
		frame: 'silver',
	},
	'cookieClicked': {
		img: '/fluent-emoji/1f36a.png',
		bg: 'linear-gradient(0deg, rgb(187 183 59), rgb(255 143 77))',
		frame: 'bronze',
	},
	'brainDiver': {
		img: '/fluent-emoji/1f9e0.png',
		bg: 'linear-gradient(0deg, rgb(144, 224, 255), rgb(255, 168, 252))',
		frame: 'bronze',
	},
	'smashTestNotificationButton': {
		img: '/fluent-emoji/1f514.png',
		bg: 'linear-gradient(0deg, rgb(187 183 59), rgb(255 143 77))',
		frame: 'bronze',
	},
	'tutorialCompleted': {
		img: '/fluent-emoji/1f393.png',
		bg: 'linear-gradient(0deg, rgb(220 223 225), rgb(172 192 207))',
		frame: 'bronze',
	},
	'bubbleGameExplodingHead': {
		img: '/fluent-emoji/1f92f.png',
		bg: 'linear-gradient(0deg, rgb(255 77 77), rgb(247 155 214))',
		frame: 'bronze',
	},
	'bubbleGameDoubleExplodingHead': {
		img: '/fluent-emoji/1f92f.png',
		bg: 'linear-gradient(0deg, rgb(255 77 77), rgb(247 155 214))',
		frame: 'silver',
	},
	// 旗鯖fork: HatasabaデッキUIのチュートリアルを完了した
	'hatasabaDeckTutorial': {
		img: '/fluent-emoji/1f5c2.png',
		bg: 'linear-gradient(0deg, rgb(118 110 255), rgb(0 212 255))',
		frame: 'silver',
	},
	// 旗鯖fork: Hataskを初めて開いた
	'welcomeToHatask': {
		img: '/fluent-emoji/1f44b.png',
		bg: 'linear-gradient(0deg, rgb(59 187 116), rgb(0 212 255))',
		frame: 'bronze',
	},
	// 旗鯖fork: Hatady(学習・読書記録)を初めて開いた
	'welcomeToHatady': {
		img: '/fluent-emoji/1f4d6.png',
		bg: 'linear-gradient(0deg, rgb(217 130 74), rgb(240 169 78))',
		frame: 'bronze',
	},
	// 旗鯖fork: HataSideStudioのチュートリアルを完了またはスキップした
	'hataSideStudioPioneer': {
		img: '/fluent-emoji/1f6e0.png',
		bg: 'linear-gradient(0deg, rgb(118 110 255), rgb(92 180 147))',
		frame: 'silver',
	},
	// 旗鯖fork: HataSNSCordUIの初回チュートリアルを最後まで完了した
	'hatacordingUiTutorial': {
		img: '/fluent-emoji/1f4bb.png',
		bg: 'linear-gradient(0deg, rgb(72 103 191), rgb(111 198 179))',
		frame: 'silver',
	},
	'utageSuccess10': {
		img: '/fluent-emoji/1f389.png',
		bg: 'linear-gradient(0deg, rgb(187 126 59), rgb(255 190 112))',
		frame: 'bronze',
	},
	'utageSuccess20': {
		img: '/fluent-emoji/1f389.png',
		bg: 'linear-gradient(0deg, rgb(187 126 59), rgb(255 190 112))',
		frame: 'bronze',
	},
	'utageSuccess30': {
		img: '/fluent-emoji/1f389.png',
		bg: 'linear-gradient(0deg, rgb(187 126 59), rgb(255 190 112))',
		frame: 'bronze',
	},
	'utageSuccess40': {
		img: '/fluent-emoji/1f389.png',
		bg: 'linear-gradient(0deg, rgb(220 223 225), rgb(172 192 207))',
		frame: 'silver',
	},
	'utageSuccess50': {
		img: '/fluent-emoji/1f389.png',
		bg: 'linear-gradient(0deg, rgb(255 183 77), rgb(255 232 168))',
		frame: 'gold',
	},
	'utageSuccess60': {
		img: '/fluent-emoji/1f389.png',
		bg: 'linear-gradient(0deg, rgb(118 110 255), rgb(0 212 255))',
		frame: 'platinum',
	},
	'utageSuccess70': {
		img: '/fluent-emoji/1f389.png',
		bg: 'linear-gradient(0deg, rgb(118 110 255), rgb(0 212 255))',
		frame: 'platinum',
	},
	'utageSuccess80': {
		img: '/fluent-emoji/1f389.png',
		bg: 'linear-gradient(0deg, rgb(118 110 255), rgb(0 212 255))',
		frame: 'platinum',
	},
	'utageSuccess90': {
		img: '/fluent-emoji/1f389.png',
		bg: 'linear-gradient(0deg, rgb(255 183 77), rgb(255 232 168))',
		frame: 'gold',
	},
	'utageSuccess100': {
		img: '/fluent-emoji/1f389.png',
		bg: 'linear-gradient(0deg, rgb(118 110 255), rgb(0 212 255))',
		frame: 'platinum',
	},
	'utageInterruption10': {
		img: '/fluent-emoji/1f6e1.png',
		bg: 'linear-gradient(0deg, rgb(187 126 59), rgb(255 190 112))',
		frame: 'bronze',
	},
	'utageInterruption20': {
		img: '/fluent-emoji/1f6e1.png',
		bg: 'linear-gradient(0deg, rgb(187 126 59), rgb(255 190 112))',
		frame: 'bronze',
	},
	'utageInterruption30': {
		img: '/fluent-emoji/1f6e1.png',
		bg: 'linear-gradient(0deg, rgb(187 126 59), rgb(255 190 112))',
		frame: 'bronze',
	},
	'utageInterruption40': {
		img: '/fluent-emoji/1f6e1.png',
		bg: 'linear-gradient(0deg, rgb(220 223 225), rgb(172 192 207))',
		frame: 'silver',
	},
	'utageInterruption50': {
		img: '/fluent-emoji/1f6e1.png',
		bg: 'linear-gradient(0deg, rgb(255 183 77), rgb(255 232 168))',
		frame: 'gold',
	},
	'utageInterruption60': {
		img: '/fluent-emoji/1f6e1.png',
		bg: 'linear-gradient(0deg, rgb(118 110 255), rgb(0 212 255))',
		frame: 'platinum',
	},
	'utageInterruption70': {
		img: '/fluent-emoji/1f6e1.png',
		bg: 'linear-gradient(0deg, rgb(118 110 255), rgb(0 212 255))',
		frame: 'platinum',
	},
	'utageInterruption80': {
		img: '/fluent-emoji/1f6e1.png',
		bg: 'linear-gradient(0deg, rgb(118 110 255), rgb(0 212 255))',
		frame: 'platinum',
	},
	'utageInterruption90': {
		img: '/fluent-emoji/1f6e1.png',
		bg: 'linear-gradient(0deg, rgb(255 183 77), rgb(255 232 168))',
		frame: 'gold',
	},
	'utageInterruption100': {
		img: '/fluent-emoji/1f6e1.png',
		bg: 'linear-gradient(0deg, rgb(118 110 255), rgb(0 212 255))',
		frame: 'platinum',
	},
	'utageInterruptionWithin5Seconds': {
		img: '/fluent-emoji/1f6d1.png',
		bg: 'linear-gradient(0deg, rgb(255 77 77), rgb(255 183 77))',
		frame: 'gold',
	},
	'ltlPunchVictory': {
		img: '/twemoji/1f91c.svg',
		bg: 'linear-gradient(0deg, rgb(118 110 255), rgb(0 212 255))',
		frame: 'gold',
	},
	'ltlPunchDefeat': {
		img: '/twemoji/1f44a.svg',
		bg: null,
		frame: 'bronze',
	},
/* @see <https://github.com/misskey-dev/misskey/pull/10365#discussion_r1155511107>
} as const satisfies Record<typeof ACHIEVEMENT_TYPES[number], {
	img: string;
	bg: string | null;
	frame: 'bronze' | 'silver' | 'gold' | 'platinum';
}>;
 */
} as const;

export const claimedAchievements: typeof ACHIEVEMENT_TYPES[number][] = ($i && $i.achievements) ? $i.achievements.map(x => x.name) : [];

const claimingQueue = new Set<string>();

export async function claimAchievement(type: ClientClaimableAchievementType) {
	if (!CLIENT_CLAIMABLE_ACHIEVEMENT_TYPES.includes(type)) return;
	if ($i == null) return;
	if ($i.movedTo) return;
	if (claimedAchievements.includes(type)) return;
	claimingQueue.add(type);
	claimedAchievements.push(type);
	await new Promise(resolve => window.setTimeout(resolve, (claimingQueue.size - 1) * 500));
	window.setTimeout(() => {
		claimingQueue.delete(type);
	}, 500);
	misskeyApi('i/claim-achievement', { name: type });
}

if (_DEV_) {
	(window as any).unlockAllAchievements = () => {
		for (const t of CLIENT_CLAIMABLE_ACHIEVEMENT_TYPES) {
			claimAchievement(t);
		}
	};
}
