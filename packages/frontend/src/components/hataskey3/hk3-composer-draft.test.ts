/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, it } from 'vitest';
import { isMeaningfulHk3ComposerDraft, parseHk3ComposerDraft } from './hk3-composer-draft.js';

function snapshot() {
	return {
		schemaVersion: 1, draftText: 'draft', draftFiles: [{ id: 'file', name: 'file.png', type: 'image/png', url: 'https://example.com/file.png', thumbnailUrl: null, isSensitive: false }],
		cwEnabled: true, cwText: 'warning', pollEnabled: true, pollChoices: ['a', 'b'],
		pollMultiple: true, pollExpiresAt: 123456, pollExpiredAfterUnit: 'original',
		event: { title: 'event', start: 123456 }, reactionAcceptance: 'likeOnly',
		visibility: 'specified', localOnly: true, visibleUsers: [{ id: 'viewer', username: 'viewer' }],
		context: { kind: 'reply', note: { id: 'reply', user: { id: 'author', username: 'author' } }, channel: null },
		editingNote: { id: 'edit', user: { id: 'author', username: 'author' } },
	};
}

describe('UI S composer draft snapshots', () => {
	it('retains every field and targets without sharing the saved objects', () => {
		const saved = snapshot();
		const restored = parseHk3ComposerDraft(saved);
		expect(restored).toEqual(saved);
		expect(restored.context).not.toBe(saved.context);
		expect(isMeaningfulHk3ComposerDraft(restored)).toBe(true);
	});
	it.each(['draftFiles', 'pollChoices', 'visibility', 'context', 'editingNote'])('rejects malformed %s before applying a snapshot', field => {
		expect(() => parseHk3ComposerDraft({ ...snapshot(), [field]: 'broken' })).toThrow();
	});
	it('rejects missing attachment type and user names', () => {
		const missingType = snapshot();
		expect(() => parseHk3ComposerDraft({ ...missingType, draftFiles: [{ id: 'file', name: 'file.png', url: 'https://example.com/file.png', thumbnailUrl: null, isSensitive: false }] })).toThrow();
		expect(() => parseHk3ComposerDraft({ ...snapshot(), visibleUsers: [{ id: 'viewer' }] })).toThrow();
		expect(() => parseHk3ComposerDraft({ ...snapshot(), editingNote: { id: 'edit', user: { id: 'author' } } })).toThrow();
		expect(() => parseHk3ComposerDraft({ ...snapshot(), context: { kind: 'reply', note: { id: 'reply', user: { id: 'author' } }, channel: null } })).toThrow();
	});
	it('keeps a channel target without a network lookup', () => {
		const saved = { ...snapshot(), context: { kind: 'channel', channel: { id: 'channel', name: 'Private', isPrivate: true } } };
		expect(parseHk3ComposerDraft(saved).context).toEqual(saved.context);
	});
});
