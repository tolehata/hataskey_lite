/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import type { MiNote } from '@/models/Note.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import type { FindOperator } from 'typeorm';

vi.mock('@/core/RoleService.js', () => ({ RoleService: class {} }));
vi.mock('@/core/ReactionsBufferingService.js', () => ({ ReactionsBufferingService: class {} }));

type Reaction = { noteId: string; userId: string; reaction: string };
type BufferedReactions = { deltas: Record<string, number>; pairs: [string, string][] };
type ReactionQuery = { userId: string; noteId: FindOperator<string[]> };

function note(id: string, overrides: Partial<MiNote> = {}): MiNote {
	const result = {
		id, userId: 'author', user: null, userHost: null, text: 'body', cw: null,
		visibility: 'public', localOnly: false, channelId: null, channel: null,
		renoteId: null, renote: null, renoteUserId: null, replyId: null, reply: null, replyUserId: null,
		fileIds: [], emojis: [], tags: [], mentions: [], visibleUserIds: [],
		hasPoll: false, hasEvent: false, reactions: { '👍': 1 }, reactionAndUserPairCache: [],
		renoteCount: 0, repliesCount: 0, clippedCount: 0,
		...overrides,
	} as MiNote;
	if (result.reply) {
		result.replyId = result.reply.id;
		result.replyUserId = result.reply.userId;
	}
	if (result.renote) {
		result.renoteId = result.renote.id;
		result.renoteUserId = result.renote.userId;
	}
	return result;
}

function fixture(rows: Reaction[] = [], enableReactionsBuffering = false, buffered = new Map<string, BufferedReactions>()) {
	const matchingReactions = ({ userId, noteId }: ReactionQuery) => rows.filter(r => r.userId === userId && noteId.value.includes(r.noteId));
	const reactions = {
		findOneBy: vi.fn(async ({ userId, noteId }: { userId: string; noteId: string }) => rows.find(r => r.userId === userId && r.noteId === noteId) ?? null),
		findBy: vi.fn(async (query: ReactionQuery) => matchingReactions(query)),
		find: vi.fn(async ({ where }: { where: ReactionQuery; select: { noteId: boolean; reaction: boolean } }) => matchingReactions(where)),
	};
	const loadedNotes = new Map<string, MiNote>();
	const noteLoader = { load: vi.fn(async (id: string) => {
		const result = loadedNotes.get(id);
		if (!result) throw new Error(`Unexpected note load: ${id}`);
		return result;
	}) };
	const packUser = async (user: string | { id: string }) => ({ id: typeof user === 'string' ? user : user.id, host: null });
	const service = Object.assign(Object.create(NoteEntityService.prototype), {
		meta: { enableReactionsBuffering, ugcVisibilityForVisitor: 'all' },
		noteReactionsRepository: reactions,
		noteLoader,
		notesRepository: { find: async ({ where }: { where: { id: FindOperator<string[]> } }) => where.id.value.flatMap(id => loadedNotes.get(id) ?? []) },
		idService: { parse: (id: string) => ({ date: id === 'recent' ? new Date() : new Date('2020-01-01') }), gen: () => '\uffff' },
		reactionService: {
			convertLegacyReaction: (reaction: string) => reaction === 'like' ? '👍' : reaction,
			convertLegacyReactions: (value: MiNote['reactions']) => value,
			decodeReaction: () => ({ name: null, host: null }),
		},
		reactionsBufferingService: {
			get: vi.fn(async (id: string) => buffered.get(id) ?? { deltas: {}, pairs: [] }),
			getMany: vi.fn(async (ids: string[]) => new Map(ids.map(id => [id, buffered.get(id) ?? { deltas: {}, pairs: [] }]))),
			mergeReactions: (value: MiNote['reactions'], deltas: Record<string, number>) => {
				const merged = { ...value };
				for (const [reaction, delta] of Object.entries(deltas)) merged[reaction] = (merged[reaction] ?? 0) + delta;
				return merged;
			},
		},
		customEmojiService: { prefetchEmojis: vi.fn(async () => {}), populateEmojis: vi.fn(async () => ({})) },
		userEntityService: { pack: packUser, packMany: async (users: (string | { id: string })[]) => Promise.all(users.map(packUser)) },
		driveFileEntityService: { packManyByIds: async () => [], packManyByIdsMap: async () => new Map() },
		roleService: { isModerator: async () => false, isAdministrator: async () => false },
	}) as NoteEntityService;
	vi.spyOn(service, 'shouldHideNote').mockResolvedValue(false);
	return { service, reactions, loadedNotes, noteLoader };
}

describe('本人のリアクションの正本', () => {
	test('キャッシュに残った削除済みリアクションを返さない', async () => {
		const f = fixture([{ noteId: 'target', userId: 'other', reaction: '👍' }]);
		const target = note('target', { reactionAndUserPairCache: ['viewer/👍'] });
		expect(await f.service.populateMyReaction(target, 'viewer')).toBeUndefined();
		expect(f.reactions.findOneBy).toHaveBeenCalledWith({ noteId: 'target', userId: 'viewer' });
	});

	test('件数が足りて見えるキャッシュに本人がいなくてもDBを参照する', async () => {
		const f = fixture([{ noteId: 'target', userId: 'viewer', reaction: 'like' }]);
		const target = note('target', { reactionAndUserPairCache: ['other/👍'] });
		expect(await f.service.populateMyReaction(target, 'viewer')).toBe('👍');
	});

	test('古い集計が空でも本人のリアクションをpackする', async () => {
		const f = fixture([{ noteId: 'target', userId: 'viewer', reaction: '👍' }]);
		expect((await f.service.pack(note('target', { reactions: {} }), { id: 'viewer' })).myReaction).toBe('👍');
	});

	test('作成直後のノートでも本人のリアクションを取得する', async () => {
		const f = fixture([{ noteId: 'recent', userId: 'viewer', reaction: '👍' }]);
		expect(await f.service.populateMyReaction(note('recent'), 'viewer')).toBe('👍');
	});

	test('未取得のhintはDBへフォールバックする', async () => {
		const f = fixture([{ noteId: 'target', userId: 'viewer', reaction: '👍' }]);
		expect(await f.service.populateMyReaction(note('target'), 'viewer', { myReactions: new Map([['another', null]]) })).toBe('👍');
		expect(f.reactions.findOneBy).toHaveBeenCalledOnce();
	});

	test.each([['like', '👍'], [null, undefined]] as const)('取得済みhint %sを再照会せず返す', async (reaction, expected) => {
		const f = fixture();
		expect(await f.service.populateMyReaction(note('target'), 'viewer', { myReactions: new Map([['target', reaction]]) })).toBe(expected);
		expect(f.reactions.findOneBy).not.toHaveBeenCalled();
	});

	test('本人IDを完全一致で照会し、他人のリアクションを返さない', async () => {
		const f = fixture([{ noteId: 'target', userId: 'viewer-longer', reaction: '👍' }]);
		expect(await f.service.populateMyReaction(note('target', { reactionAndUserPairCache: ['viewer-longer/👍'] }), 'viewer')).toBeUndefined();
		expect(await f.service.populateMyReaction(note('target'), 'viewer-longer')).toBe('👍');
	});
});

describe.each([false, true])('packManyの本人リアクション（buffering=%s）', (buffering) => {
	test('純リノート・引用・返信・深い引用を1回の本人照会でpackする', async () => {
		const original = note('original', { reactionAndUserPairCache: ['other/👍'] });
		const quoted = note('quoted', { renote: original });
		const renotedQuote = note('renoted-quote', { text: null, renote: quoted, reactions: {} });
		const reply = note('reply', { reply: original });
		const renote = note('renote', { text: null, renote: original, reactions: {} });
		const rows = ['original', 'quoted', 'reply'].map(noteId => ({ noteId, userId: 'viewer', reaction: '👍' }));
		const f = fixture(rows, buffering);
		const packed = await f.service.packMany([renotedQuote, reply, renote], { id: 'viewer' });
		expect(packed[0].renote?.myReaction).toBe('👍');
		expect(packed[0].renote?.renote?.myReaction).toBe('👍');
		expect(packed[1].myReaction).toBe('👍');
		expect(packed[1].reply?.myReaction).toBe('👍');
		expect(packed[2].renote?.myReaction).toBe('👍');
		expect(packed[0].myReaction).toBeUndefined();
		expect(f.reactions.find).toHaveBeenCalledOnce();
		expect(f.reactions.findOneBy).not.toHaveBeenCalled();
		const query = f.reactions.find.mock.calls[0][0].where;
		expect(query.userId).toBe('viewer');
		expect(new Set(query.noteId.value)).toEqual(new Set(['renoted-quote', 'quoted', 'original', 'reply', 'renote']));
		expect(query.noteId.value).toHaveLength(5);
		expect(f.reactions.find.mock.calls[0][0].select).toEqual({ noteId: true, reaction: true });
	});

	test('古いDBキャッシュとRedisの本人ペアを無視し、本人レコードを優先する', async () => {
		const f = fixture([{ noteId: 'reacted', userId: 'viewer', reaction: '👍' }], buffering, new Map([
			['unreacted', { deltas: {}, pairs: [['viewer', '👍']] }],
			['reacted', { deltas: {}, pairs: [['other', '👍']] }],
		]));
		const packed = await f.service.packMany([
			note('unreacted', { reactionAndUserPairCache: ['viewer/👍'] }),
			note('reacted', { reactionAndUserPairCache: ['other/👍'] }),
		], { id: 'viewer' });
		expect(packed.map(n => n.myReaction)).toEqual([undefined, '👍']);
		expect(f.reactions.find).toHaveBeenCalledOnce();
	});

	test('空の集計や作成直後でも本人レコードを反映する', async () => {
		const f = fixture(['empty', '\uffff-recent'].map(noteId => ({ noteId, userId: 'viewer', reaction: '👍' })), buffering);
		const packed = await f.service.packMany([note('empty', { reactions: {} }), note('\uffff-recent')], { id: 'viewer' });
		expect(packed.map(n => n.myReaction)).toEqual(['👍', '👍']);
	});

	test('未JOINの子を一括取得し、遅延読込で判明した孫はDBへフォールバックする', async () => {
		const f = fixture(['child', 'grandchild'].map(noteId => ({ noteId, userId: 'viewer', reaction: '👍' })), buffering);
		f.loadedNotes.set('child', note('child', { renote: note('grandchild') }));
		const parent = note('parent', { renoteId: 'child', renoteUserId: 'author' });
		Object.assign(parent, { renote: undefined });
		const [packed] = await f.service.packMany([parent], { id: 'viewer' });
		expect(packed.renote?.myReaction).toBe('👍');
		expect(packed.renote?.renote?.myReaction).toBe('👍');
		expect(f.noteLoader.load).toHaveBeenCalledWith('child');
		expect(f.reactions.find).toHaveBeenCalledOnce();
		expect(f.reactions.findOneBy).toHaveBeenCalledExactlyOnceWith({ noteId: 'grandchild', userId: 'viewer' });
	});

	test('同じノートでも閲覧者ごとに本人分を照会する', async () => {
		const f = fixture([{ noteId: 'target', userId: 'viewer', reaction: '👍' }], buffering);
		const target = note('target');
		expect((await f.service.packMany([target], { id: 'viewer' }))[0].myReaction).toBe('👍');
		expect((await f.service.packMany([target], { id: 'other' }))[0].myReaction).toBeUndefined();
		expect(f.reactions.find.mock.calls.map(([query]) => query.where.userId)).toEqual(['viewer', 'other']);
	});

	test('匿名・detailなし・空一覧では本人の照会を行わない', async () => {
		const f = fixture([{ noteId: 'target', userId: 'viewer', reaction: '👍' }], buffering);
		expect((await f.service.packMany([note('target')], null))[0].myReaction).toBeUndefined();
		expect((await f.service.packMany([note('target')], { id: 'viewer' }, { detail: false }))[0].myReaction).toBeUndefined();
		expect(await f.service.packMany([], { id: 'viewer' })).toEqual([]);
		expect(f.reactions.find).not.toHaveBeenCalled();
		expect(f.reactions.findBy).not.toHaveBeenCalled();
		expect(f.reactions.findOneBy).not.toHaveBeenCalled();
	});
});
