/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { hataskEmojiSources } from './hatask-emoji.js';

function readFrontendFile(relativePath: string): string {
	return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('hataskEmojiSources', () => {
	test('native設定でもTwemojiから始め、OSネイティブ描画を返さない', () => {
		expect(hataskEmojiSources('🌱', 'native')).toEqual([
			'/twemoji/1f331.svg',
			'/fluent-emoji/1f331.png',
			'/client-assets/unknown.png',
		]);
	});

	test('Fluent設定ではFluentを優先し、Twemojiへ画像フォールバックする', () => {
		expect(hataskEmojiSources('☀️', 'fluentEmoji')).toEqual([
			'/fluent-emoji/2600.png',
			'/twemoji/2600.svg',
			'/client-assets/unknown.png',
		]);
	});

	test('Hatask本体・花の各画面・ウィジェット・サイドバーで動的絵文字を画像描画する', () => {
		const files = [
			'src/pages/hatask.vue',
			'src/widgets/WidgetHataskFlowers.vue',
			'src/components/HataSideStudioFlowers.vue',
			'src/components/hataskey3/Hk3RightPane.vue',
			'src/components/hatask/HataskFlowerCare.vue',
			'src/components/hatask/HataskFlowerZukan.vue',
			'src/components/hatask/HataskFlowerStream.vue',
			'src/components/hatask/HataskFlowerCollection.vue',
			'src/components/hatask/HataskFlowerDetail.vue',
			'src/components/hatask/HataskBloomDialog.vue',
		];

		for (const file of files) {
			const source = readFrontendFile(file);
			expect(source.includes('<HataskEmoji'), file).toBe(true);
			const directEmojiInterpolations = source.match(/\{\{[^}]*(?:emoji|Emoji)[^}]*\}\}/g) ?? [];
			expect(directEmojiInterpolations.filter(match => !match.includes('copy.emoji')), file).toEqual([]);
		}
	});

	test.each([
		'src/components/hatask/HataskAkatsukiLayout.vue',
		'src/components/hatagoes/HatagoesHome.vue',
	])('%s の花も画像で描画し、本文中の文字へ戻さない', file => {
		const source = readFrontendFile(file);
		// These shells also contain journal text; inspect the flower data only.
		const directFlowerInterpolations = source.match(/\{\{[^}]*\.flower(?:\?)?\.emoji[^}]*\}\}/g) ?? [];
		expect(directFlowerInterpolations).toEqual([]);
		expect(source.includes('<HataskEmoji')).toBe(true);
	});

	test('専用コンポーネントは画像が全滅してもOSネイティブ絵文字へ戻さない', () => {
		const component = readFrontendFile('src/components/HataskEmoji.vue');
		expect(component).toContain('v-if="!allSourcesFailed"');
		expect(component).toContain('v-else class="ti ti-icons-off"');
		expect(component).not.toContain('{{ emoji }}');
	});
});
