/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';
import { parse as parseCss } from 'postcss';
import { afterEach, describe, expect, test } from 'vitest';

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach(fn => fn()));

async function styles(file: string, containerWidth?: number) {
	const filename = resolve(process.cwd(), file);
	const source = readFileSync(filename, 'utf8');
	const result = await compileStyleAsync({
		filename, source: file.endsWith('.vue') ? parse(source).descriptor.styles[0].content : source,
		id: 'note-charm-layout', preprocessLang: 'scss', modules: file.endsWith('.vue'),
	});
	expect(result.errors).toEqual([]);
	const sheet = window.document.createElement('style');
	const css = parseCss(result.code);
	// The inline stylesheet is already Unicode. happy-dom otherwise drops the
	// first qualified rule after Sass's @charset, including MkNote's root rule.
	css.walkAtRules('charset', rule => { rule.remove(); });
	if (containerWidth != null) {
		// Supply the column size explicitly; the DOM shim has no container layout.
		css.walkAtRules('container', rule => {
			const maximum = rule.params.match(/max-width:\s*(\d+)px/);
			if (maximum && containerWidth <= Number(maximum[1]) && rule.nodes) rule.replaceWith(...rule.nodes);
			else rule.remove();
		});
	}
	sheet.textContent = css.toString();
	window.document.head.append(sheet);
	cleanup.push(() => sheet.remove());
	return result.modules ?? {};
}

function horizontalBox(element: HTMLElement) {
	const style = window.getComputedStyle(element);
	return [style.width, style.marginLeft, style.marginRight, style.paddingLeft, style.paddingRight, style.borderLeftWidth, style.borderRightWidth];
}

describe('note charm layout contracts', () => {
	test.each([240, 262, 328, 406, 640])('a %dpx settings preview contains the outside rail without adding blank height inside the note', async width => {
		const classes = await styles('src/components/MkNoteCharmPreview.vue');
		const root = window.document.createElement('div');
		root.className = classes.root;
		root.style.width = `${width}px`;
		const stage = window.document.createElement('div');
		stage.className = classes.stage;
		stage.style.setProperty('--note-charm-preview-gutter', '118px');
		stage.style.setProperty('--note-charm-preview-min-height', '250px');
		const note = window.document.createElement('article');
		note.className = classes.note;
		root.append(stage);
		stage.append(note);
		window.document.body.append(root);
		cleanup.push(() => root.remove());
		const style = window.getComputedStyle(stage);
		expect(style.boxSizing).toBe('border-box');
		const right = Number.parseFloat(style.paddingRight);
		const left = Number.parseFloat(style.paddingLeft) || 0;
		const noteRight = width - right;
		expect(noteRight - left).toBeGreaterThan(100);
		expect(noteRight + 110 + 8).toBeLessThanOrEqual(width);
		const bottom = Number.parseFloat(style.paddingTop) + 10 + 32 + 186;
		expect(bottom + 8).toBeLessThanOrEqual(Number.parseFloat(style.minHeight));
		expect(window.getComputedStyle(root).containerType).toBe('inline-size');
		expect(window.getComputedStyle(note).minHeight).not.toBe('250px');
		expect(style.height).not.toBe('250px');
		expect(style.overflow).not.toBe('hidden');
	});

	test.each([
		[640, false, 64], [640, true, 56],
		[560, false, 56], [560, true, 56],
		[400, false, 52], [400, true, 52],
		[320, false, 52], [320, true, 52],
		[280, false, 48], [280, true, 48],
	] as const)('column %d compact=%s bounds the charm size', async (width, compact, expected) => {
		await styles('src/note-charm.scss', width);
		const host = window.document.createElement('div');
		host.dataset.noteCharmLayout = 'on';
		host.dataset.noteCharmCompact = String(compact);
		window.document.body.append(host);
		cleanup.push(() => host.remove());
		expect(window.getComputedStyle(host).getPropertyValue('--note-charm-slot-size')).toBe(`${expected}px`);
	});

	test.each(['MkNote.vue', 'MkNoteDetailed.vue'])('%s renders its charm beside the entire card', component => {
		const source = readFileSync(resolve(process.cwd(), `src/components/${component}`), 'utf8');
		const template = parse(source).descriptor.template!;
		if (!template.ast) throw new Error('note template missing');
		const root = template.ast.children.find(node => node.type === 1)!;
		if (root.type !== 1) throw new Error('note root missing');
		const layout = root.props.find(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.type === 4 && prop.arg.content === 'data-note-charm-layout');
		expect(layout?.type === 7 && layout.exp?.type === 4 && layout.exp.content).toBe("charmLayout ? 'on' : null");
		expect(root.children.some(node => node.type === 1 && node.tag === 'MkNoteCharm')).toBe(true);
	});

	test('the outside charm layer remains in a body teleport', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/components/MkNoteCharm.vue'), 'utf8');
		const template = parse(source).descriptor.template!;
		if (!template.ast) throw new Error('charm template missing');
		const portal = template.ast.children.find(node => node.type === 1 && node.tag === 'Teleport');
		if (portal?.type !== 1) throw new Error('charm teleport missing');
		const target = portal.props.find(prop => prop.type === 6 && prop.name === 'to');
		expect(target?.type === 6 && target.value?.content).toBe('body');
		expect(portal.children.some(node => node.type === 1 && node.props.some(prop => prop.type === 6 && prop.name === 'data-note-charm-layer'))).toBe(true);
	});

	test.each(['MkNote.vue', 'MkNoteDetailed.vue'])('%s keeps its clipping and containment when a charm is equipped', async component => {
		await styles('src/note-charm.scss');
		const classes = await styles(`src/components/${component}`);
		const host = window.document.createElement('div');
		host.className = classes.root;
		window.document.body.append(host);
		cleanup.push(() => host.remove());
		const containmentBefore = window.getComputedStyle(host).contain;
		expect(window.getComputedStyle(host).overflow).toBe('clip');
		if (component === 'MkNoteDetailed.vue') expect(containmentBefore).toBe('content');
		host.dataset.noteCharmLayout = 'on';
		host.dataset.noteCharmHost = 'on';
		expect(window.getComputedStyle(host).overflow).toBe('clip');
		expect(window.getComputedStyle(host).contain).toBe(containmentBefore);
	});

	test('the utage animation can still overflow an equipped note', async () => {
		await styles('src/note-charm.scss');
		const classes = await styles('src/components/MkNote.vue');
		const host = window.document.createElement('div');
		host.className = `${classes.root} ${classes.utageActive}`;
		host.dataset.noteCharmLayout = 'on';
		host.dataset.noteCharmHost = 'on';
		window.document.body.append(host);
		cleanup.push(() => host.remove());
		expect(window.getComputedStyle(host).overflow).toBe('visible');
	});

	test('shared frame rules do not reserve horizontal space or change the box border', async () => {
		const filename = resolve(process.cwd(), 'src/note-charm.scss');
		const result = await compileStyleAsync({ filename, source: readFileSync(filename, 'utf8'), id: 'note-charm-layout', preprocessLang: 'scss' });
		expect(result.errors).toEqual([]);
		const horizontalChanges: string[] = [];
		parseCss(result.code).walkRules(rule => {
			if (!rule.selector.includes('data-note-charm-frame')) return;
			rule.walkDecls(declaration => {
				if (/^(?:(?:min-|max-)?(?:width|inline-size)|(?:margin|padding)(?:-(?:left|right|inline(?:-start|-end)?))?|border(?:-(?:width|left|right|inline(?:-start|-end)?))?)$/.test(declaration.prop)) horizontalChanges.push(declaration.prop);
			});
		});
		expect(horizontalChanges).toEqual([]);
	});

	test.each(['MkNote.vue', 'MkNoteDetailed.vue'])('%s preserves original note width and content height when a charm is equipped', async component => {
		await styles('src/note-charm.scss');
		const classes = await styles(`src/components/${component}`);
		const host = window.document.createElement('div');
		host.className = classes.root;
		host.style.width = '480px';
		const frame = window.document.createElement('div');
		frame.className = component === 'MkNote.vue' ? classes.bubbleBody : classes.note;
		host.append(frame);
		window.document.body.append(host);
		cleanup.push(() => host.remove());
		const before = horizontalBox(frame);
		const heightBefore = window.getComputedStyle(frame).minHeight;
		const rootBefore = horizontalBox(host);
		host.dataset.noteCharmLayout = 'on';
		expect(horizontalBox(host), 'charm support without an equipped image').toEqual(rootBefore);
		host.dataset.noteCharmHost = 'on';
		frame.dataset.noteCharmFrame = 'on';
		for (const width of [48, 76, 96]) {
			host.style.setProperty('--note-charm-size', `${width}px`);
			expect(horizontalBox(frame), `charm width ${width}`).toEqual(before);
			expect(window.getComputedStyle(frame).minHeight, `no blank height for charm width ${width}`).toBe(heightBefore);
			expect(horizontalBox(host), `outer card width ${width}`).toEqual(rootBefore);
		}
	});

	test('the outer charm layer cannot enlarge the page scroll area', async () => {
		const classes = await styles('src/components/MkNoteCharm.vue');
		const layer = window.document.createElement('div');
		layer.className = classes.layer;
		const rail = window.document.createElement('div');
		rail.className = classes.rail;
		rail.style.setProperty('--note-charm-left', '480px');
		rail.style.setProperty('--note-charm-top', '32px');
		rail.style.setProperty('--note-charm-anchor-x', '4px');
		const anchor = window.document.createElement('span');
		anchor.className = classes.anchor;
		rail.append(anchor);
		layer.append(rail);
		window.document.body.append(layer);
		cleanup.push(() => layer.remove());
		const layerStyle = window.getComputedStyle(layer);
		expect(layerStyle.position).toBe('fixed');
		expect(layerStyle.overflow).toBe('hidden');
		expect(layerStyle.pointerEvents).toBe('none');
		const style = window.getComputedStyle(rail);
		expect(style.position).toBe('absolute');
		expect(style.left).toBe('480px');
		expect(style.right).not.toBe('0px');
		expect(window.getComputedStyle(anchor).right).not.toBe('-6px');
	});
});
