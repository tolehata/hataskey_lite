/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, it } from 'vitest';
import { concrntBodyLayout, concrntContentParts, concrntDisplayName, concrntQuoteOf, concrntShortcode, safeConcrntMediaUrl } from './content.js';

describe('Concrnt timeline presentation helpers', () => {
	it('never falls back to an identifier for a missing name', () => {
		expect(concrntDisplayName('')).toBe('名前未設定のユーザー');
		expect(concrntDisplayName('  ')).toBe('名前未設定のユーザー');
		expect(concrntDisplayName('旗茶')).toBe('旗茶');
	});
	it('splits the trailing quote link written by publish()', () => {
		const uri = 'cckv://con1other/concrnt.world/profiles/work/posts/original';
		expect(concrntQuoteOf(`引用コメント\n\nhttps://concrnt.world/post/${encodeURIComponent(uri)}`)).toEqual({ body: '引用コメント', uri });
		expect(concrntQuoteOf('https://concrnt.world/post/%E0%A4%A')).toEqual({ body: 'https://concrnt.world/post/%E0%A4%A' });
		expect(concrntQuoteOf(`https://concrnt.world/post/${encodeURIComponent('javascript:alert(1)')}`).uri).toBeUndefined();
	});
	it('moves CFM images out of the text flow for the media viewer', () => {
		expect(concrntBodyLayout('本文\n\n![説明](https://cdn.example/a.png)')).toEqual({ parts: [{ type: 'text', text: '本文' }], images: [{ url: 'https://cdn.example/a.png', alt: '説明' }] });
	});
	it('keeps inserted shortcodes inside the CFM emoji grammar', () => {
		expect(concrntShortcode(':blob-cat:')).toBe('blob_cat');
		expect(concrntShortcode('ねこ')).toBe('__');
		expect(concrntShortcode('')).toBe('emoji');
	});
});

describe('Concrnt content rendering boundary', () => {
	it('recognizes HTTPS links and CFM images without converting surrounding text', () => {
		expect(concrntContentParts('前 [リンク](https://social.example/post)\n![説明](https://cdn.example/image.png) 後')).toEqual([
			{ type: 'text', text: '前 ' }, { type: 'link', text: 'リンク', url: 'https://social.example/post' },
			{ type: 'text', text: '\n' }, { type: 'image', text: '説明', url: 'https://cdn.example/image.png' }, { type: 'text', text: ' 後' },
		]);
	});
	it('leaves HTML and executable URL syntax as text', () => {
		const body = '<img src=x onerror=alert(1)> [危険](javascript:alert(1)) ![SVG](data:image/svg+xml,x)';
		expect(concrntContentParts(body)).toEqual([{ type: 'text', text: body }]);
	});
	it.each(['http://cdn.example/a', 'https://user:password@cdn.example/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://files.internal/a', 'https://localhost/a'])('rejects unsafe media URL %s', url => {
		expect(safeConcrntMediaUrl(url)).toBeNull();
	});
	it('does not silently drop unsupported syntax', () => {
		const body = '**本文**\n```html\n<script>alert(1)</script>\n```';
		expect(concrntContentParts(body)).toEqual([{ type: 'text', text: body }]);
	});
	it('renders only explicitly supplied, safe custom emoji images', () => {
		expect(concrntContentParts(':hello: :missing: :bad:', { hello: { imageURL: 'https://cdn.example/hello.png' }, bad: { imageURL: 'javascript:alert(1)' } })).toEqual([
			{ type: 'emoji', text: ':hello:', url: 'https://cdn.example/hello.png' }, { type: 'text', text: ' :missing: :bad:' },
		]);
	});
});
