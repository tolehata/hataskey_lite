/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HanaawaseEventRun = {
	start: string;
	end: string;
	label: string;
};

export type HanaawaseEventIndexEntry = {
	id: string;
	title: string;
	rev: number;
	runs: HanaawaseEventRun[];
	archiveFrom: string;
};

export type HanaawaseEventIndex = {
	v: 1;
	events: HanaawaseEventIndexEntry[];
};

export const DEFAULT_HANAAWASE_EVENT_INDEX: HanaawaseEventIndex = {
	v: 1,
	events: [{
		id: 'mago-no-inuma',
		title: '孫の居ぬ間になんとやら',
		rev: 1,
		runs: [{
			start: '2026-08-01T00:00+09:00',
			end: '2026-08-18T00:00+09:00',
			label: '初回',
		}],
		archiveFrom: '2026-08-18T00:00+09:00',
	}],
};

export const hanaawaseEventIndexSchema = {
	type: 'object',
	properties: {
		v: {
			type: 'integer',
			minimum: 1,
			maximum: 1,
		},
		events: {
			type: 'array',
			maxItems: 32,
			items: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						minLength: 1,
						maxLength: 64,
						pattern: '^[a-z0-9][a-z0-9-]*$',
					},
					title: {
						type: 'string',
						minLength: 1,
						maxLength: 128,
					},
					rev: {
						type: 'integer',
						minimum: 1,
						maximum: 1_000_000,
					},
					runs: {
						type: 'array',
						minItems: 1,
						maxItems: 16,
						items: {
							type: 'object',
							properties: {
								start: {
									type: 'string',
									maxLength: 40,
								},
								end: {
									type: 'string',
									maxLength: 40,
								},
								label: {
									type: 'string',
									minLength: 1,
									maxLength: 64,
								},
							},
							required: ['start', 'end', 'label'],
						},
					},
					archiveFrom: {
						type: 'string',
						maxLength: 40,
					},
				},
				required: ['id', 'title', 'rev', 'runs', 'archiveFrom'],
			},
		},
	},
	required: ['v', 'events'],
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const validDate = (value: unknown): value is string =>
	typeof value === 'string'
	&& /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
	&& Number.isFinite(Date.parse(value));

/**
 * 管理画面から受け取った開催設定を、保存前に改めて検査する。
 * JSON Schemaだけでは表現できない開始・終了の前後関係や重複もここで拒否する。
 */
export function parseHanaawaseEventIndex(input: unknown): HanaawaseEventIndex | undefined {
	if (!isRecord(input) || input.v !== 1 || !Array.isArray(input.events) || input.events.length > 32) return undefined;

	const events: HanaawaseEventIndexEntry[] = [];
	const eventIds = new Set<string>();

	for (const rawEvent of input.events) {
		if (!isRecord(rawEvent)
			|| typeof rawEvent.id !== 'string'
			|| !/^[a-z0-9][a-z0-9-]{0,63}$/.test(rawEvent.id)
			|| eventIds.has(rawEvent.id)
			|| typeof rawEvent.title !== 'string'
			|| rawEvent.title.trim().length === 0
			|| rawEvent.title.length > 128
			|| typeof rawEvent.rev !== 'number'
			|| !Number.isInteger(rawEvent.rev)
			|| rawEvent.rev < 1
			|| rawEvent.rev > 1_000_000
			|| !Array.isArray(rawEvent.runs)
			|| rawEvent.runs.length === 0
			|| rawEvent.runs.length > 16
			|| !validDate(rawEvent.archiveFrom)) {
			return undefined;
		}

		const runs: HanaawaseEventRun[] = [];
		let previousEnd = Number.NEGATIVE_INFINITY;
		for (const rawRun of rawEvent.runs) {
			if (!isRecord(rawRun)
				|| !validDate(rawRun.start)
				|| !validDate(rawRun.end)
				|| typeof rawRun.label !== 'string'
				|| rawRun.label.trim().length === 0
				|| rawRun.label.length > 64) {
				return undefined;
			}

			const start = Date.parse(rawRun.start);
			const end = Date.parse(rawRun.end);
			if (start >= end || start < previousEnd) return undefined;
			previousEnd = end;
			runs.push({
				start: rawRun.start,
				end: rawRun.end,
				label: rawRun.label,
			});
		}

		// 現行クライアントの資料室切替規則。開催終了と同時にアーカイブへ移す。
		if (rawEvent.archiveFrom !== runs[0].end) return undefined;

		eventIds.add(rawEvent.id);
		events.push({
			id: rawEvent.id,
			title: rawEvent.title,
			rev: rawEvent.rev,
			runs,
			archiveFrom: rawEvent.archiveFrom,
		});
	}

	return { v: 1, events };
}
