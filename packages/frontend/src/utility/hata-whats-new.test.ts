/* SPDX-License-Identifier: AGPL-3.0-only */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { getHataWhatsNewDisplayVersion, getHataWhatsNewStories, HATA_WHATS_NEW } from './hata-whats-new.js';

const root = path.resolve(process.cwd(), '../..');
const ids = ['release-notes'];
describe('approved release stories', () => {
	test('the displayed-version gate stays aligned with the package and release metadata', () => {
		const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
		expect(HATA_WHATS_NEW.version).toBe(pkg.version);
		expect(HATA_WHATS_NEW.version).toBe('2026.10.1-hata.13.0');
		const version = getHataWhatsNewDisplayVersion(pkg.version);
		expect(version).toBe('hata-13.0');
		const changelog = fs.readFileSync(path.join(root, 'HATA-CHANGELOG.md'), 'utf8');
		expect(changelog.indexOf('## hata-13.0\n')).toBeGreaterThan(0);
		// hataskey Lite keeps one release; the history before Lite lives in the original repository.
		expect(changelog).toContain('https://github.com/tolehata/hataskey/blob/master/HATA-CHANGELOG.md');
		expect(changelog).not.toContain('（未リリース）');
		expect(/^## (hata-[\d.]+)$/mu.exec(changelog)?.[1]).toBe(version);
		expect(getHataWhatsNewDisplayVersion('development')).toBe('development');
	});
	test('the notice contains the single approved release page', () => {
		const stories = getHataWhatsNewStories();
		expect(stories).toHaveLength(1);
		expect(stories.map(story => story.id)).toEqual(ids);
		expect(stories.map(story => story.cards.length)).toEqual([1]);
		expect(stories[0].feature).toBeUndefined();
		expect(stories[0].title).toBe('詳しくはリリースノートをご確認ください');
	});

	test('the final page links to this fork’s release notes', () => {
		const cards = HATA_WHATS_NEW.groups.flatMap(group => group.cards);
		expect(cards.map(card => card.id)).toEqual(ids);
		expect(cards[0].link).toEqual({ label: 'リリースノートを開く', url: 'https://github.com/tolehata/hataskey_lite/blob/master/HATA-CHANGELOG.md#hata-130' });
	});

	test('release copy contains no implementation paths or internal storage and API terminology', () => {
		const implementationTerms = /Registry|API|localStorage|packages\/|マイグレーション|\/home\//u;
		expect(implementationTerms.test('packages/frontend/API')).toBe(true);
		expect(implementationTerms.test(JSON.stringify(HATA_WHATS_NEW.groups))).toBe(false);
	});
});
