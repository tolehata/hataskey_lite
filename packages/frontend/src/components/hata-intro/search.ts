/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { courses, features, glossary, guideDetails } from './content.js';
import { references } from './reference-content.js';

export function normalizeQuery(value: string): string {
	return value.normalize('NFKC').toLocaleLowerCase('ja').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).trim();
}

export function findReferences(query: string, filter = 'all') {
	const tokens = normalizeQuery(query).split(/\s+/).filter(Boolean);
	return references.filter(r => {
		if (filter !== 'all' && filter !== r.course) return false;
		const text = normalizeQuery([r.title, r.body, r.where, ...r.tips, ...(r.steps ?? []), ...(r.keywords ?? [])].join(' '));
		return tokens.every(token => text.includes(token));
	});
}

export function findFeatures(query: string, filter = 'all') {
	const tokens = normalizeQuery(query).split(/\s+/).filter(Boolean);
	return courses.flatMap(c => c.features.map(id => ({ id, c })))
		.filter(({ id, c }) => {
			if (filter !== 'all' && filter !== c.id) return false;
			const f = features[id], d = guideDetails[id];
			const text = normalizeQuery([f.name, f.title, f.benefit, f.where, ...f.steps, f.note, d.aliases, d.result, ...d.help.flat(), ...glossary.filter(x => x[2] === id).flat()].join(' '));
			return tokens.every(t => text.includes(t));
		}).sort((a, b) => {
			const score = (id: string) => tokens.reduce((n, t) => n + (normalizeQuery(features[id].name).includes(t) ? 4 : 0) + (normalizeQuery(guideDetails[id].aliases).includes(t) ? 2 : 0), 0);
			return score(b.id) - score(a.id);
		});
}
