/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { assert, describe, test } from 'vitest';
import { createRouter, loginFallbackComponent } from './fixture.js';

describe('[NIRAX] フォールバック', () => {
	test('ページが見つからない場合はワイルドカードルートを解決する', () => {
		const router = createRouter('/');
		const resolved = router.resolve('/missing');

		assert.ok(resolved);
		assert.strictEqual(resolved.route.path, '/:(*)');
		assert.strictEqual(resolved.props.get(''), 'missing');
	});

	test('replaceの際、ページが見つからなかったらワイルドカードルートへ遷移する', () => {
		const router = createRouter('/');
		const replacements: string[] = [];

		router.addListener('replace', ctx => {
			replacements.push(ctx.fullPath);
		});

		router.init();
		router.replaceByPath('/also-missing');

		assert.deepStrictEqual(replacements, ['/', '/also-missing']);
		assert.strictEqual(router.getCurrentFullPath(), '/also-missing');
		assert.strictEqual(router.current.route.path, '/:(*)');
	});

	test('初期ページが見つからない場合はワイルドカードルートでreplaceを発火する', () => {
		const router = createRouter('/missing');
		const replacements: string[] = [];

		router.addListener('replace', ctx => {
			replacements.push(ctx.fullPath);
		});

		router.init();

		assert.deepStrictEqual(replacements, ['/missing']);
		assert.strictEqual(router.getCurrentFullPath(), '/missing');
		assert.strictEqual(router.current.route.path, '/:(*)');
	});

	test('loginRequiredなルートではコンポーネントを差し替えてshowLoginPopupを設定する', () => {
		const router = createRouter('/', false);

		router.init();

		router.pushByPath('/private');

		assert.strictEqual(router.current.route.path, '/private');
		assert.ok('component' in router.current.route);
		assert.strictEqual(router.current.route.component, loginFallbackComponent);
		assert.strictEqual(router.current.props.get('showLoginPopup'), true);
	});
});
