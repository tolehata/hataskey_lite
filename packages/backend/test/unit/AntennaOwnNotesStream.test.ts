/* SPDX-License-Identifier: AGPL-3.0-only */
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AntennaChannelService } from '@/server/api/stream/channels/antenna.js';
import Connection from '@/server/api/stream/Connection.js';
import { NoteStreamingHidingService } from '@/server/api/stream/NoteStreamingHidingService.js';
import type { Packed } from '@/misc/json-schema.js';
import type { NoteEntityService } from '@/core/entities/NoteEntityService.js';

vi.mock('@/core/entities/NoteEntityService.js', () => ({ NoteEntityService: class {} }));
const connections: Connection[] = [];
afterEach(() => { for (const connection of connections.splice(0)) connection.dispose(); });

function post(userId: string, extra: Partial<Packed<'Note'>> = {}): Packed<'Note'> {
	return {
		id: 'note1', createdAt: '2026-10-26T00:00:00Z', userId, user: { id: userId, username: userId, host: null },
		visibility: 'public', text: 'keyword', cw: null, files: [], fileIds: [], reactions: {},
		reactionEmojis: {}, renoteId: null, replyId: null, ...extra,
	} as Packed<'Note'>;
}

async function setup(enabled = false, viewer = 'owner1') {
	const antenna = { id: 'antenna1', userId: 'owner1', excludeOwnNotes: enabled };
	const lookup = async ({ id, userId }: { id: string; userId: string }) => antenna.id === id && antenna.userId === userId ? { ...antenna } : null;
	let packed = post('owner1');
	let beforePack: (() => Promise<void>) | undefined;
	let beforeFilter: ((note: Packed<'Note'>) => Promise<void>) | undefined;
	const entity = {
		pack: async () => { await beforePack?.(); return packed; },
		shouldHideNote: async () => false,
		isChannelVisibleForMe: async (note: Packed<'Note'>) => { await beforeFilter?.(note); return true; },
	} as unknown as NoteEntityService;
	const service = new AntennaChannelService({ exists: async ({ where }: { where: { id: string; userId: string } }) => !!await lookup(where), findOneBy: lookup } as never, entity);
	const hiding = new NoteStreamingHidingService({ ugcVisibilityForVisitor: 'all' } as never, entity);
	const connection = new Connection({ getChannelService: () => service } as never, {} as never, {} as never, {} as never, { id: viewer } as never, null, hiding);
	connections.push(connection);
	const subscriber = new EventEmitter();
	const messages: { type: string; body: Packed<'Note'> }[] = [];
	const socket = Object.assign(new EventEmitter(), { readyState: 1, send: (data: string) => { messages.push(JSON.parse(data).body); } });
	await connection.listen(subscriber, socket as never);
	await connection.connectChannel('column1', { antennaId: 'antenna1' }, 'antenna');
	return {
		antenna, messages, subscriber,
		set beforePack(value: (() => Promise<void>) | undefined) { beforePack = value; },
		set beforeFilter(value: ((note: Packed<'Note'>) => Promise<void>) | undefined) { beforeFilter = value; },
		async deliver(note: Packed<'Note'>) {
			packed = note;
			await Promise.all(subscriber.listeners('antennaStream:antenna1').map(listener => listener({ type: 'note', body: note })));
		},
	};
}

describe('antenna own-note streaming', () => {
	test('uses changed settings on an already connected stream', async () => {
		const f = await setup();
		await f.deliver(post('owner1'));
		expect(f.messages.map(message => message.body.userId)).toEqual(['owner1']);
		f.antenna.excludeOwnNotes = true;
		await f.deliver(post('owner1'));
		expect(f.messages.map(message => message.body.userId)).toEqual(['owner1']);
		f.antenna.excludeOwnNotes = false;
		await f.deliver(post('owner1'));
		expect(f.messages.map(message => message.body.userId)).toEqual(['owner1', 'owner1']);
	});

	test('rechecks the setting after a delayed pack completes', async () => {
		const f = await setup();
		let release: (() => void) | undefined;
		f.beforePack = () => new Promise<void>(resolve => { release = resolve; });
		const delivery = f.deliver(post('owner1'));
		f.antenna.excludeOwnNotes = true;
		release?.();
		await delivery;
		expect(f.messages).toEqual([]);
	});

	test.each(['queued', 'filtering'] as const)('rechecks the setting while an own note is %s', async stage => {
		const f = await setup();
		let release!: () => void;
		let entered!: () => void;
		const blocked = new Promise<void>(resolve => { release = resolve; });
		const started = new Promise<void>(resolve => { entered = resolve; });
		const blockedId = stage === 'queued' ? 'earlierNote' : 'note1';
		f.beforeFilter = async note => {
			if (note.id === blockedId) {
				entered();
				await blocked;
			}
		};
		const earlier = stage === 'queued' ? f.deliver(post('other1', { id: blockedId })) : Promise.resolve();
		if (stage === 'queued') await started;
		const delivery = f.deliver(post('owner1'));
		if (stage === 'filtering') await started;
		// Drain the packing microtasks so the second event has reached the queue.
		await new Promise<void>(resolve => { setImmediate(resolve); });
		f.antenna.excludeOwnNotes = true;
		release();
		await Promise.all([earlier, delivery]);
		expect(f.messages.map(message => message.body.userId)).toEqual(stage === 'queued' ? ['other1'] : []);
	});

	test.each(['reply', 'quote', 'renote'] as const)('keeps another user’s %s of the owner’s note', async kind => {
		const f = await setup(true);
		const original = post('owner1');
		const other = post('other1', kind === 'reply' ? { replyId: original.id, reply: original } : { renoteId: original.id, renote: original, text: kind === 'quote' ? 'keyword quote' : null });
		await f.deliver(other);
		expect(f.messages.map(message => message.body.userId)).toEqual(['other1']);
	});

	test('does not connect another account to this antenna', async () => {
		const f = await setup(true, 'other1');
		expect(f.subscriber.listenerCount('antennaStream:antenna1')).toBe(0);
		await f.deliver(post('owner1'));
		expect(f.messages).toEqual([]);
	});
});
