/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HataskCaptureFolder = { id: string; name: string };
export type HataskCapturePriority = 'low' | 'medium' | 'high';

export type HataskCaptureParseResult = {
	title: string;
	date?: string;
	time?: string;
	folderId?: string;
	priority?: HataskCapturePriority;
	recognized: string[];
};

function localDateKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftedDate(now: Date, amount: number): string {
	const date = new Date(now);
	date.setHours(12, 0, 0, 0);
	date.setDate(date.getDate() + amount);
	return localDateKey(date);
}

function parseClock(token: string): string | undefined {
	const colon = /^(午前|午後)?(\d{1,2}):(\d{2})$/.exec(token);
	const japanese = /^(午前|午後)?(\d{1,2})時(?:(\d{1,2})分?)?$/.exec(token);
	const match = colon ?? japanese;
	if (match == null) return undefined;
	let hour = Number(match[2]);
	const minute = match[3] ? Number(match[3]) : 0;
	if (match[1] === '午後' && hour < 12) hour += 12;
	if (match[1] === '午前' && hour === 12) hour = 0;
	if (hour > 23 || minute > 59) return undefined;
	return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseDateToken(token: string, now: Date): { date: string; remainder: string } | undefined {
	const relative = [
		{ prefix: '明後日', offset: 2 },
		{ prefix: '明日', offset: 1 },
		{ prefix: '今日', offset: 0 },
	].find(candidate => token.startsWith(candidate.prefix));
	if (relative != null) return { date: shiftedDate(now, relative.offset), remainder: token.slice(relative.prefix.length) };
	const iso = /^(\d{4}-\d{2}-\d{2})(.*)$/.exec(token);
	if (iso != null) return { date: iso[1], remainder: iso[2] };
	return undefined;
}

export function parseHataskCapture(
	input: string,
	options: { now?: Date; folders?: readonly HataskCaptureFolder[]; allowFolder?: boolean; allowPriority?: boolean } = {},
): HataskCaptureParseResult {
	const now = options.now ?? new Date();
	const folders = options.folders ?? [];
	const titleTokens: string[] = [];
	const recognized: string[] = [];
	let date: string | undefined;
	let time: string | undefined;
	let folderId: string | undefined;
	let priority: HataskCapturePriority | undefined;

	for (const originalToken of input.trim().split(/\s+/).filter(Boolean)) {
		let token = originalToken;
		let consumed = false;

		const dateToken = parseDateToken(token, now);
		if (dateToken != null) {
			date = dateToken.date;
			recognized.push(originalToken.slice(0, originalToken.length - dateToken.remainder.length));
			token = dateToken.remainder;
			consumed = token.length === 0;
		}

		if (token.length > 0) {
			const parsedTime = parseClock(token);
			if (parsedTime != null) {
				time = parsedTime;
				recognized.push(token);
				consumed = true;
			}
		}

		if (!consumed && options.allowFolder !== false && token.startsWith('#')) {
			const folder = folders.find(candidate => candidate.name.toLocaleLowerCase() === token.slice(1).toLocaleLowerCase());
			if (folder != null) {
				folderId = folder.id;
				recognized.push(token);
				consumed = true;
			}
		}

		if (!consumed && options.allowPriority !== false) {
			const priorityMap: Partial<Record<string, HataskCapturePriority>> = {
				'!高': 'high', '!!': 'high', '!中': 'medium', '!': 'medium', '!低': 'low',
			};
			if (priorityMap[token] != null) {
				priority = priorityMap[token];
				recognized.push(token);
				consumed = true;
			}
		}

		if (!consumed && token.length > 0) titleTokens.push(token);
	}

	return {
		title: titleTokens.join(' ').trim(),
		...(date == null ? {} : { date }),
		...(time == null ? {} : { time }),
		...(folderId == null ? {} : { folderId }),
		...(priority == null ? {} : { priority }),
		recognized,
	};
}
