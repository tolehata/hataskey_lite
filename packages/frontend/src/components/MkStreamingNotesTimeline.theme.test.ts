/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Window } from 'happy-dom';
import { describe, expect, test } from 'vitest';
import timelineSource from './MkStreamingNotesTimeline.vue?raw';

const legacySelector = 'html:not(.hataGlassUi) :not([data-bubble="on"]) article';

function panelBackgroundSelector(source: string): string {
	const matches = [...source.matchAll(/^([^\n{}]+ article)\s*\{\s*background:\s*var\(--MI_THEME-panel\)\s*!important;/gmu)];
	expect(matches).toHaveLength(1);
	return matches[0][1].trim();
}

function matchingArticleIds(selector: string, glassUi: boolean, colorScheme: 'light' | 'dark'): string[] {
	const window = new Window();
	const { document } = window;
	document.documentElement.classList.toggle('hataGlassUi', glassUi);
	document.documentElement.dataset.colorScheme = colorScheme;
	document.body.innerHTML = `
		<section data-streaming-notes>
			<article id="timeline"></article>
		</section>
		<section data-streaming-notes data-bubble="on">
			<article id="bubble"></article>
		</section>
		<section data-hatask-apps>
			<article id="apps"></article>
		</section>
		<section data-hatady>
			<article id="hatady"></article>
		</section>
		<article id="unrelated"></article>
	`;
	const ids = [...document.querySelectorAll(selector)].map(article => article.id);
	window.close();
	return ids;
}

describe('streaming timeline panel background scope', () => {
	test('notes container exposes the CSS scope marker', () => {
		expect(timelineSource).toMatch(/<component\s+[^>]*:class="\[\$style\.notes,[^>]*\bdata-streaming-notes\b/su);
	});

	test('non-bubble timeline articles alone receive the panel background', () => {
		const selector = panelBackgroundSelector(timelineSource);
		for (const colorScheme of ['light', 'dark'] as const) {
			expect(matchingArticleIds(selector, false, colorScheme)).toEqual(['timeline']);
			expect(matchingArticleIds(selector, true, colorScheme)).toEqual([]);
		}
	});

	test('the former selector demonstrably leaks into other articles', () => {
		const matches = matchingArticleIds(legacySelector, false, 'dark');
		expect(matches).toContain('apps');
		expect(matches).toContain('hatady');
		expect(matches).toContain('unrelated');
	});
});
