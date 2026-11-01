/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { parse as parseCss } from 'postcss';
import { describe, expect, test } from 'vitest';
import { HataskeyWelcomeController } from './welcome.entrance.hataskey.js';
import type { AtRule, Document, Root, Rule } from 'postcss';

// Source contracts and real controller calculations only. Happy DOM does not
// measure rendered line boxes, mobile viewport fit, or visual animation quality.
const sourcePath = resolve(process.cwd(), 'src/pages/welcome.entrance.hataskey.vue');
const source = readFileSync(sourcePath, 'utf8');
const css = readFileSync(resolve(process.cwd(), 'src/pages/welcome.entrance.hataskey.css'), 'utf8');
const scope = '[data-hataskey-entrance]';
const mobileContainer = 'hataskey-entrance(max-width:820px)';
const shortMobileContainer = 'hataskey-entrance(max-width:820px)and(max-height:700px)';

function conditions(rule: Rule): { name: string; params: string }[] {
	const result: { name: string; params: string }[] = [];
	for (let parent: AtRule | Document | Root | Rule | undefined = rule.parent; parent; parent = parent.parent) {
		if (parent.type !== 'atrule') continue;
		const atRule = parent as AtRule;
		result.push({ name: atRule.name, params: atRule.params.replace(/\s+/g, '') });
	}
	return result;
}

function layoutRule(styles: Root, className: string, container?: string): Rule {
	const expectedConditions = container ? [{ name: 'container', params: container }] : [];
	const matches: Rule[] = [];
	styles.walkRules(rule => {
		if (!rule.selectors.includes(`${scope} .${className}`)) return;
		if (JSON.stringify(conditions(rule)) === JSON.stringify(expectedConditions)) matches.push(rule);
	});
	assert.equal(matches.length, 1, `expected one ${container ?? 'base'} rule for ${className}`);
	return matches[0];
}

function declarations(rule: Rule): Record<string, { value: string; important: boolean }> {
	const result: Record<string, { value: string; important: boolean }> = {};
	rule.walkDecls(declaration => {
		result[declaration.prop] = { value: declaration.value, important: Boolean(declaration.important) };
	});
	return result;
}

function assertMobileSpacing(stylesSource: string): void {
	const styles = parseCss(stylesSource);
	const compact = (className: string) => declarations(layoutRule(styles, className, mobileContainer));
	assert.deepEqual(compact('join-section')['padding-bottom'], { value: 'max(24px,env(safe-area-inset-bottom))', important: true });
	assert.deepEqual(compact('join-lead')['margin-top'], { value: '12px', important: true });
	assert.deepEqual(compact('join-lead')['line-height'], { value: '1.85', important: true });
	assert.deepEqual(compact('join-plane').height, { value: '56px', important: true });
	assert.deepEqual(compact('join-plane').margin, { value: '12px 0 6px', important: true });
	assert.equal(compact('join-acknowledgement')['margin-top'].value, '20px');
	assert.equal(compact('join-acknowledgement')['padding-top'].value, '16px');
	assert.equal(compact('join-ack-brand')['margin-bottom'].value, '8px');
	assert.equal(compact('join-ack-version')['margin-top'].value, '12px');
	assert.deepEqual(declarations(layoutRule(styles, 'join-plane', shortMobileContainer)).height, { value: '44px', important: true });
	// Desktop spacing remains intact; compaction is not a global redesign.
	assert.deepEqual(declarations(layoutRule(styles, 'join-section'))['padding-bottom'], { value: 'max(72px,8dvh)', important: true });
	assert.equal(declarations(layoutRule(styles, 'join-acknowledgement'))['margin-top'].value, '72px');
	assert.equal(declarations(layoutRule(styles, 'join-acknowledgement'))['padding-top'].value, '28px');
	assert.equal(declarations(layoutRule(styles, 'join-ack-brand'))['margin-bottom'].value, '12px');
	assert.equal(declarations(layoutRule(styles, 'join-ack-version'))['margin-top'].value, '24px');
}

function assertFooterWordmark(templateSource: string, stylesSource: string): void {
	const parsed = parseSfc(templateSource, { filename: sourcePath });
	assert.deepEqual(parsed.errors, []);
	assert.ok(parsed.descriptor.template);
	const template = window.document.createElement('template');
	template.innerHTML = parsed.descriptor.template.content;
	const brand = template.content.querySelector('#join .join-ack-brand');
	assert.ok(brand);
	assert.equal(brand.textContent, 'Hataskey');
	assert.equal(brand.childElementCount, 1, 'footer brand must contain only the wordmark');
	assert.equal(brand.firstElementChild?.tagName, 'SPAN');
	assert.equal(brand.firstElementChild.childElementCount, 0, 'wordmark must not contain decorative elements');
	const styles = parseCss(stylesSource);
	assert.equal(declarations(layoutRule(styles, 'join-ack-brand'))['justify-content'].value, 'center');
	assert.equal(declarations(layoutRule(styles, 'join-acknowledgement'))['text-align'].value, 'center');
}

function assertProjectDisclaimer(templateSource: string): void {
	const parsed = parseSfc(templateSource, { filename: sourcePath });
	assert.deepEqual(parsed.errors, []);
	assert.ok(parsed.descriptor.template);
	const template = window.document.createElement('template');
	template.innerHTML = parsed.descriptor.template.content;
	const rights = template.content.querySelectorAll('#join #fediverse-rights');
	assert.equal(rights.length, 1, 'footer must contain one project-rights disclosure');
	const notice = rights[0].querySelector(':scope > div > p:last-child');
	assert.ok(notice, 'project-rights disclosure copy must exist');
	assert.equal(notice.textContent, 'HataskeyはMisskey ProjectおよびCherryPick Projectの公式プロジェクトではなく、両プロジェクトとの提携・推薦を示すものではありません。');
	assert.equal(notice.getAttribute('data-en'), 'Hataskey is not an official project of Misskey Project or CherryPick Project and is not affiliated with or endorsed by either project.');
}

type Point = { x: number; y: number };

function planeFixture(initialHeight: number) {
	const root = window.document.createElement('div');
	const host = window.document.createElement('div');
	const plane = window.document.createElement('span');
	const path = window.document.createElementNS('http://www.w3.org/2000/svg', 'path');
	let height = initialHeight;
	let width = 360;
	Object.defineProperty(root, 'clientHeight', { value: 800 });
	Object.defineProperties(host, {
		clientWidth: { get: () => width },
		clientHeight: { get: () => height },
		_top: { value: 760 },
	});
	plane.setAttribute('data-plane', '');
	path.setAttribute('data-trailpath', '');
	host.append(path, plane);
	root.append(host);
	const controller = new HataskeyWelcomeController();
	controller.rootRef(root);
	// Do not mount: tickPlane has no timers or event listeners of its own.
	return {
		controller, plane, path,
		tick(progress: number) { controller.tickPlane(progress * 600); },
		resize(nextHeight: number, nextWidth = width) { height = nextHeight; width = nextWidth; },
	};
}

function planePoint(plane: HTMLElement): Point {
	const match = /^translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\) rotate\(-?[\d.]+deg\)$/.exec(plane.style.transform);
	assert.ok(match, 'tickPlane must write a translation and rotation');
	return { x: Number(match[1]), y: Number(match[2]) };
}

function trailPoints(path: SVGPathElement): Point[] {
	const data = path.getAttribute('d');
	assert.ok(data && data.startsWith('M'), 'tickPlane must build the trail path');
	const points = data.slice(1).split(' L').map(point => {
		const pair = point.split(',').map(Number);
		assert.equal(pair.length, 2, 'each trail point must have two coordinates');
		assert.ok(pair.every(Number.isFinite), 'trail coordinates must be finite');
		return { x: pair[0], y: pair[1] };
	});
	assert.equal(points.length, 41, 'the curve sampling must actually execute');
	return points;
}

function assertTrajectoryFits(points: Point[], height: number): void {
	assert.equal(points.length, 41, 'geometry assertions require a complete trajectory');
	for (const [index, point] of points.entries()) {
		assert.ok(point.y >= 20 && point.y <= height - 20, 'plane must retain vertical room for its rotated 30px icon');
		if (index === 0) continue;
		assert.ok(point.x > points[index - 1].x, 'plane must travel forward');
		assert.ok(point.y <= points[index - 1].y, 'plane height must progress monotonically');
	}
}

describe('welcome entrance JOIN mobile source contracts', () => {
	test('最下部のロゴは装飾のないHataskey文字だけを中央揃えにする', () => {
		assertFooterWordmark(source, css);
	});

	test('最下部でMisskey ProjectとCherryPick Projectの両方との非提携を明示する', () => {
		assertProjectDisclaimer(source);
	});

	test('陽性対照：CherryPick Projectの非提携表記を外すと検出する', () => {
		const mutated = source
			.replace('Misskey ProjectおよびCherryPick Project', 'Misskey Project')
			.replace('Misskey Project or CherryPick Project', 'Misskey Project');
		expect(mutated).not.toBe(source);
		expect(() => assertProjectDisclaimer(mutated)).toThrow();
	});

	test('陽性対照：最下部の図形アイコンを復活させると検出する', () => {
		const legacySource = source.replace('<div class="join-ack-brand">', '<div class="join-ack-brand"><span class="join-ack-mark"><i class="ti ti-icons" aria-hidden="true"></i></span>');
		expect(legacySource).not.toBe(source);
		expect(() => assertFooterWordmark(legacySource, css)).toThrow('footer brand must contain only the wordmark');
	});

	test('末尾を820px以下だけコンパクトにし、低いモバイルでは飛行機の余白をさらに減らす', () => {
		assertMobileSpacing(css);
	});

	test('飛行機専用の領域だけを縮め、見出し・説明・ボタン・クレジットを保持する', () => {
		const parsed = parseSfc(source, { filename: sourcePath });
		assert.deepEqual(parsed.errors, []);
		assert.ok(parsed.descriptor.template);
		const template = window.document.createElement('template');
		template.innerHTML = parsed.descriptor.template.content;
		const join = template.content.querySelector('#join');
		assert.ok(join);
		assert.equal(join.querySelector('h2')?.textContent, 'サーバーに参加してみませんか？');
		assert.equal(join.querySelectorAll('.join-lead,.join-actions,.join-acknowledgement').length, 3);
		assert.equal(join.querySelectorAll('.join-plane').length, 1);
		const planeHost = join.querySelector('.join-plane');
		assert.ok(planeHost);
		assert.equal(planeHost.querySelectorAll('[data-plane],[data-trailpath]').length, 2);
		assert.equal(planeHost.querySelectorAll('h2,p,button').length, 0, 'clipped plane host must not contain real content');
		assert.match(planeHost.getAttribute('style') ?? '', /height:150px(?:;|$)/, 'desktop plane retains its original height');
	});

	test.each([
		['飛行機の150px領域', 'join-plane', 'height', '150px'],
		['フッター直前の72px余白', 'join-acknowledgement', 'margin-top', '72px'],
	] as const)('陽性対照：旧モバイルの%sを検出する', (_name, className, property, value) => {
		const styles = parseCss(css);
		let changed = false;
		layoutRule(styles, className, mobileContainer).walkDecls(property, declaration => {
			declaration.value = value;
			changed = true;
		});
		expect(changed).toBe(true);
		expect(() => assertMobileSpacing(styles.toString())).toThrow();
	});
});

describe('welcome entrance JOIN plane controller geometry', () => {
	test.each([150, 56, 44])('%ipx高で飛行機と軌道が同じ曲線を進み、上下に切れない余裕を持つ', height => {
		const fixture = planeFixture(height);
		fixture.tick(0);
		const points = trailPoints(fixture.path);
		assertTrajectoryFits(points, height);
		for (let index = 0; index <= 40; index++) {
			fixture.tick(index / 40);
			expect(planePoint(fixture.plane)).toEqual(points[index]);
		}
	});

	test('150pxのPC軌道は元の曲線を保つ', () => {
		const fixture = planeFixture(150);
		fixture.tick(0);
		for (const [index, point] of trailPoints(fixture.path).entries()) {
			expect(point.y).toBe(Number((124 - 104 * Math.pow(index / 40, 1.6)).toFixed(1)));
		}
	});

	test('幅が変わらない高さ変更でも軌道キャッシュを作り直す', () => {
		const fixture = planeFixture(150);
		fixture.tick(0.5);
		let previous = fixture.path.getAttribute('d');
		for (const height of [64, 44, 56, 150]) {
			fixture.resize(height);
			fixture.tick(0.5);
			expect(fixture.path.getAttribute('d')).not.toBe(previous);
			expect(fixture.path.dataset.w).toBe('360');
			expect(fixture.path.dataset.h).toBe(String(height));
			const points = trailPoints(fixture.path);
			assertTrajectoryFits(points, height);
			expect(planePoint(fixture.plane)).toEqual(points[20]);
			previous = fixture.path.getAttribute('d');
		}
	});

	test('幅だけの変更でも軌道を更新し、高さと飛行機の位置は一致する', () => {
		const fixture = planeFixture(56);
		fixture.tick(0.5);
		const previous = fixture.path.getAttribute('d');
		fixture.resize(56, 420);
		fixture.tick(0.5);
		expect(fixture.path.getAttribute('d')).not.toBe(previous);
		expect(fixture.path.dataset.w).toBe('420');
		expect(planePoint(fixture.plane)).toEqual(trailPoints(fixture.path)[20]);
	});

	test('未計測の高さは150pxへフォールバックする', () => {
		const fixture = planeFixture(0);
		fixture.tick(0.5);
		const points = trailPoints(fixture.path);
		assertTrajectoryFits(points, 150);
		expect(points[0].y).toBe(124);
		expect(points[40].y).toBe(20);
		expect(planePoint(fixture.plane)).toEqual(points[20]);
	});

	test('動きを減らす設定では飛行機と軌道を更新しない', () => {
		const fixture = planeFixture(44);
		fixture.plane.style.transform = 'none';
		fixture.path.setAttribute('d', 'M0,22 L360,22');
		Object.defineProperty(fixture.controller, 'deckMotionQuery', { value: { matches: true } });
		fixture.tick(0.5);
		expect(fixture.plane.style.transform).toBe('none');
		expect(fixture.path.getAttribute('d')).toBe('M0,22 L360,22');
		expect(fixture.path.dataset.w).toBeUndefined();
	});

	test('陽性対照：旧固定高の軌道を短いモバイルへ流用すると検出する', () => {
		const legacyPoints = Array.from({ length: 41 }, (_, index) => ({
			x: -40 + 440 * index / 40,
			y: Number((124 - 104 * Math.pow(index / 40, 1.6)).toFixed(1)),
		}));
		assertTrajectoryFits(legacyPoints, 150);
		expect(() => assertTrajectoryFits(legacyPoints, 56)).toThrow('plane must retain vertical room');
	});
});
