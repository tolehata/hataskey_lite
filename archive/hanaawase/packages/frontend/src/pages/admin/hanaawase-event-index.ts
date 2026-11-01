/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HanaawaseEventRun = {
	start: string;
	end: string;
	label: string;
};

export type HanaawaseEventEntry = {
	id: string;
	title: string;
	rev: number;
	runs: HanaawaseEventRun[];
	archiveFrom: string;
};

export type HanaawaseEventIndex = {
	v: 1;
	events: HanaawaseEventEntry[];
};

/**
 * 管理APIへ送るため、Vueのreactive ProxyからJSON互換の素のオブジェクトを作る。
 * `structuredClone()` はProxyを複製できず、ブラウザでDataCloneErrorになるため使わない。
 */
export function copyHanaawaseEventIndex(source: HanaawaseEventIndex): HanaawaseEventIndex {
	return {
		v: source.v,
		events: source.events.map(event => ({
			id: event.id,
			title: event.title,
			rev: event.rev,
			runs: event.runs.map(run => ({
				start: run.start,
				end: run.end,
				label: run.label,
			})),
			archiveFrom: event.archiveFrom,
		})),
	};
}
