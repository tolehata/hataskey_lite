/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type SeasonalTreeSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type SeasonalTreeTimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export interface SeasonalTreeClock {
	season: SeasonalTreeSeason;
	timeOfDay: SeasonalTreeTimeOfDay;
	minuteOfDay: number;
}

export interface SeasonalTreePalette {
	skyTop: string;
	skyBottom: string;
	hillFar: string;
	hillNear: string;
	groundTop: string;
	groundBottom: string;
	groundLight: string;
	trunk: string;
	trunkLight: string;
	canopyDark: string;
	canopyMid: string;
	canopyLight: string;
	accent: string;
	shadow: string;
	celestial: string;
	starOpacity: number;
	celestialOpacity: number;
	celestialY: number;
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const FALLBACK_INSTANT = new Date('2024-06-01T03:00:00.000Z');

// A fixed instant keeps malformed dates deterministic and avoids accidental local-time fallback.
export function getSeasonalTreeClock(date: Date): SeasonalTreeClock {
	const valid = Number.isFinite(date.getTime()) ? date : FALLBACK_INSTANT;
	const jst = new Date(valid.getTime() + JST_OFFSET_MS);
	const month = jst.getUTCMonth() + 1;
	const minuteOfDay = jst.getUTCHours() * 60 + jst.getUTCMinutes();
	const season: SeasonalTreeSeason = month >= 3 && month <= 5 ? 'spring'
		: month >= 6 && month <= 8 ? 'summer'
		: month >= 9 && month <= 11 ? 'autumn' : 'winter';
	const timeOfDay: SeasonalTreeTimeOfDay = minuteOfDay >= 5 * 60 && minuteOfDay < 8 * 60 ? 'dawn'
		: minuteOfDay >= 8 * 60 && minuteOfDay < 17 * 60 ? 'day'
		: minuteOfDay >= 17 * 60 && minuteOfDay < 19 * 60 ? 'dusk' : 'night';
	return { season, timeOfDay, minuteOfDay };
}

const SEASON = {
	spring: { skyTop: '#a5a7cf', skyBottom: '#f8d5d4', hillFar: '#9baeb5', hillNear: '#667e79', groundTop: '#829870', groundBottom: '#506c54', groundLight: '#b4a98a', trunk: '#56443f', trunkLight: '#896c5b', canopyDark: '#b2798e', canopyMid: '#e9afbd', canopyLight: '#ffe0dc', accent: '#fff1df' },
	summer: { skyTop: '#56afd0', skyBottom: '#d9efdb', hillFar: '#829c9b', hillNear: '#4b746c', groundTop: '#669466', groundBottom: '#315b46', groundLight: '#a1b77c', trunk: '#473d36', trunkLight: '#79644e', canopyDark: '#275f45', canopyMid: '#4e9660', canopyLight: '#9ac77d', accent: '#d9dfa1' },
	autumn: { skyTop: '#a998bd', skyBottom: '#f6c5a3', hillFar: '#a59b99', hillNear: '#746c69', groundTop: '#9a8760', groundBottom: '#66523e', groundLight: '#cba36b', trunk: '#4f3a33', trunkLight: '#82604b', canopyDark: '#8c433b', canopyMid: '#d58243', canopyLight: '#efbd67', accent: '#f9d894' },
	winter: { skyTop: '#8baac6', skyBottom: '#e1e9ec', hillFar: '#a6b5c3', hillNear: '#758899', groundTop: '#bbc6ca', groundBottom: '#879aa1', groundLight: '#edf2ed', trunk: '#41464c', trunkLight: '#72777c', canopyDark: '#9baeb6', canopyMid: '#c5d2d4', canopyLight: '#f1f4ee', accent: '#fff9eb' },
} as const;

type Light = { at: number; skyTop: string; skyBottom: string; darkness: number; warmth: number; starOpacity: number; celestialOpacity: number; celestialY: number };
const LIGHT: readonly Light[] = [
	{ at: 0, skyTop: '#101a34', skyBottom: '#283449', darkness: .82, warmth: 0, starOpacity: .85, celestialOpacity: .9, celestialY: 91 },
	{ at: 240, skyTop: '#121d38', skyBottom: '#34405a', darkness: .78, warmth: 0, starOpacity: .72, celestialOpacity: .78, celestialY: 123 },
	{ at: 360, skyTop: '#735e88', skyBottom: '#edaa92', darkness: .33, warmth: .4, starOpacity: .1, celestialOpacity: .55, celestialY: 178 },
	{ at: 540, skyTop: '#74b7d3', skyBottom: '#e3e9dc', darkness: 0, warmth: .05, starOpacity: 0, celestialOpacity: .88, celestialY: 142 },
	{ at: 780, skyTop: '#5ea5c9', skyBottom: '#dfebdf', darkness: 0, warmth: 0, starOpacity: 0, celestialOpacity: 1, celestialY: 80 },
	{ at: 990, skyTop: '#77a9be', skyBottom: '#f0ddc5', darkness: .06, warmth: .12, starOpacity: 0, celestialOpacity: .9, celestialY: 130 },
	{ at: 1080, skyTop: '#7b6891', skyBottom: '#f2ac85', darkness: .32, warmth: .55, starOpacity: .12, celestialOpacity: .72, celestialY: 174 },
	{ at: 1200, skyTop: '#263151', skyBottom: '#68586b', darkness: .7, warmth: .12, starOpacity: .6, celestialOpacity: .8, celestialY: 133 },
	{ at: 1320, skyTop: '#101a34', skyBottom: '#283449', darkness: .82, warmth: 0, starOpacity: .85, celestialOpacity: .9, celestialY: 91 },
	{ at: 1440, skyTop: '#101a34', skyBottom: '#283449', darkness: .82, warmth: 0, starOpacity: .85, celestialOpacity: .9, celestialY: 91 },
];

function mixNumber(a: number, b: number, t: number): number { return a + (b - a) * t; }

function mixColor(a: string, b: string, t: number): string {
	const channel = (offset: number) => Math.round(mixNumber(parseInt(a.slice(offset, offset + 2), 16), parseInt(b.slice(offset, offset + 2), 16), t)).toString(16).padStart(2, '0');
	return `#${channel(1)}${channel(3)}${channel(5)}`;
}

const PREVIEW_MINUTE: Record<SeasonalTreeTimeOfDay, number> = { dawn: 360, day: 780, dusk: 1080, night: 0 };
const SUNSET_CROWN = {
	spring: { canopyMid: '#dca4ae', canopyLight: '#f7cbd0', accent: '#ffe9db' },
	autumn: { canopyLight: '#edba72', accent: '#f9d795' },
} as const;

export function getSeasonalTreePalette(season: SeasonalTreeSeason, timeOfDay: SeasonalTreeTimeOfDay, minuteOfDay = PREVIEW_MINUTE[timeOfDay]): SeasonalTreePalette {
	const minute = Number.isFinite(minuteOfDay) ? Math.max(0, Math.min(1439, minuteOfDay)) : PREVIEW_MINUTE[timeOfDay];
	const right = LIGHT.findIndex(light => light.at > minute);
	const first = LIGHT[Math.max(0, right - 1)];
	const second = LIGHT[right < 0 ? LIGHT.length - 1 : right];
	const t = Math.max(0, Math.min(1, (minute - first.at) / (second.at - first.at)));
	const darkness = mixNumber(first.darkness, second.darkness, t);
	const warmth = mixNumber(first.warmth, second.warmth, t);
	const groundNight = season === 'winter' ? '#354656' : '#253e45';
	const foliageNight = season === 'winter' ? '#677482' : '#263f45';
	const base = SEASON[season];
	const dim = (color: string, nightColor: string) => mixColor(color, nightColor, darkness);
	const skyTint = .31 * (1 - darkness) + .055;
	const palette: SeasonalTreePalette = {
		skyTop: mixColor(mixColor(first.skyTop, second.skyTop, t), base.skyTop, skyTint),
		skyBottom: mixColor(mixColor(first.skyBottom, second.skyBottom, t), base.skyBottom, skyTint),
		hillFar: dim(base.hillFar, '#3b4a62'), hillNear: dim(base.hillNear, '#26374b'),
		groundTop: dim(base.groundTop, groundNight), groundBottom: dim(base.groundBottom, '#172e3c'), groundLight: dim(base.groundLight, '#37515a'),
		trunk: dim(base.trunk, '#252b35'), trunkLight: dim(base.trunkLight, '#4b505a'),
		canopyDark: dim(base.canopyDark, foliageNight), canopyMid: dim(mixColor(base.canopyMid, '#ffc277', warmth * .16), foliageNight),
		canopyLight: dim(mixColor(base.canopyLight, '#ffe1a1', warmth * .2), '#63757c'), accent: dim(base.accent, '#96a0a0'),
		shadow: mixColor('#344449', '#081525', darkness), celestial: darkness > .55 ? '#f0e8d3' : '#fff0c3',
		starOpacity: mixNumber(first.starOpacity, second.starOpacity, t), celestialOpacity: mixNumber(first.celestialOpacity, second.celestialOpacity, t),
		celestialY: mixNumber(first.celestialY, second.celestialY, t),
	};
	// Keep the approved sunset crown at 18:00 while blending in and out continuously.
	const sunsetTint = Math.max(0, Math.min(1, minute <= 1080 ? (minute - 990) / 90 : (1200 - minute) / 120));
	if (season === 'spring') {
		palette.canopyMid = mixColor(palette.canopyMid, SUNSET_CROWN.spring.canopyMid, sunsetTint);
		palette.canopyLight = mixColor(palette.canopyLight, SUNSET_CROWN.spring.canopyLight, sunsetTint);
		palette.accent = mixColor(palette.accent, SUNSET_CROWN.spring.accent, sunsetTint);
	} else if (season === 'autumn') {
		palette.canopyLight = mixColor(palette.canopyLight, SUNSET_CROWN.autumn.canopyLight, sunsetTint);
		palette.accent = mixColor(palette.accent, SUNSET_CROWN.autumn.accent, sunsetTint);
	}
	return palette;
}
