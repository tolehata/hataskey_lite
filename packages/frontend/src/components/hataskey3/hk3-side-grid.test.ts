/* SPDX-License-Identifier: AGPL-3.0-only */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';
import { Window } from 'happy-dom';
import { beforeAll, describe, expect, test } from 'vitest';

async function componentStyle(path: string) {
	const filename = resolve(process.cwd(), 'src', path);
	const style = parse(readFileSync(filename, 'utf8')).descriptor.styles.find(block => block.module);
	if (!style) throw new Error(`Missing module style: ${path}`);
	const result = await compileStyleAsync({ filename, source: style.content, id: path, preprocessLang: 'scss', modules: true });
	if (result.errors.length || !result.modules) throw new Error(result.errors.join('\n'));
	return { css: result.code, classes: result.modules };
}

let live: Awaited<ReturnType<typeof componentStyle>>;
let preview: Awaited<ReturnType<typeof componentStyle>>;
beforeAll(async () => {
	[live, preview] = await Promise.all([
		componentStyle('components/hataskey3/Hk3SideNav.vue'),
		componentStyle('pages/hata-side-studio.vue'),
	]);
});

describe('UI S live and Studio grid appearance', () => {
	test.each([390, 1280])('item layout matches at viewport width %i', async width => {
		const window = new Window({ width, height: 900 });
		try {
			const style = window.document.createElement('style');
			style.textContent = `${live.css}\n${preview.css}`;
			window.document.head.append(style);
			for (const size of ['small', 'normal', 'large']) {
				window.document.body.innerHTML = `<nav class="${live.classes.root}"><div class="${live.classes.grid}"><button id="live" class="${live.classes.item}" data-size="${size}" data-menu-id="earthquake"><i class="${live.classes.itemIcon}"></i><span class="${live.classes.itemLabel}">地震・津波情報</span></button></div></nav><div class="${preview.classes.root}" data-ui-s="true"><div class="${preview.classes.previewButton}" id="preview" data-size="${size}" data-menu-id="earthquake"><div class="${size === 'large' ? preview.classes.largeButtonPreview : preview.classes.buttonPreviewBody}"><i></i><span><b>地震・津波情報</b></span></div></div></div>`;
				const actual = window.getComputedStyle(window.document.querySelector('#live')!);
				const expected = window.getComputedStyle(window.document.querySelector('#preview')!);
				for (const property of ['height', 'box-sizing', 'padding-left', 'padding-right', 'flex-direction', 'align-items', 'justify-content']) {
					expect(actual.getPropertyValue(property), `${size}: ${property}`).toBe(expected.getPropertyValue(property));
				}
				expect(actual.flexDirection).toBe('column');
				const actualIcon = window.getComputedStyle(window.document.querySelector('#live i')!);
				const previewIcon = window.getComputedStyle(window.document.querySelector('#preview i')!);
				expect(actualIcon.fontSize).toBe(previewIcon.fontSize);
				expect(actualIcon.lineHeight).toBe(previewIcon.lineHeight);
				for (const selector of ['#live span', '#preview b']) {
					const label = window.getComputedStyle(window.document.querySelector(selector)!);
					expect(label.textOverflow).not.toBe('ellipsis');
					expect(label.whiteSpace).toBe('normal');
				}
			}
			// The former desktop-only override must be detectable by this CSS check.
			const oldRule = window.document.createElement('style');
			oldRule.textContent = `@media (min-width:701px) { .${live.classes.item} { flex-direction:row; } }`;
			window.document.head.append(oldRule);
			expect(window.getComputedStyle(window.document.querySelector('#live')!).flexDirection).toBe(width >= 701 ? 'row' : 'column');
		} finally {
			await window.happyDOM.close();
		}
	});
});
