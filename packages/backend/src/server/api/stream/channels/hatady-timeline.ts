/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { HatadyLogsRepository, HatadyMediaSessionsRepository, HatadyMediaWorksRepository } from '@/models/_.js';
import type { MiHatadyLog } from '@/models/HatadyLog.js';
import type { MiHatadyMediaSession } from '@/models/HatadyMediaSession.js';
import type { HatadyActivityCandidate, HatadyActivityKind } from '@/core/HatadyActivityService.js';
import { HATADY_ACTIVITY_KINDS, HatadyActivityService } from '@/core/HatadyActivityService.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyMediaService } from '@/core/HatadyMediaService.js';
import type { GlobalEvents, HatadyTimelineSource } from '@/core/GlobalEventService.js';
import { bindThis } from '@/decorators.js';
import type { JsonObject, JsonValue } from '@/misc/json-value.js';
import Channel, { type MiChannelService } from '../channel.js';

type Scope = 'mine' | 'recent' | 'following';
type Key = `${HatadyTimelineSource}:${string}`;
const MAX_WATCHED = 500;
const COALESCE_MS = 100;
const validKey = (value: unknown): value is Key => typeof value === 'string' && /^(log|session):[a-zA-Z0-9]{1,80}$/.test(value);

export class HatadyTimelineChannel extends Channel {
	public readonly chName = 'hatadyTimeline';
	public static shouldShare = false;
	public static requireCredential = true as const;
	public static kind = 'read:account';
	private scope: Scope = 'recent';
	private kind: HatadyActivityKind | null = null;
	private watched = new Set<Key>();
	private pending = new Map<Key, number>();
	private dirty = new Set<Key>();
	private processing = new Set<Key>();
	private generations = new Map<Key, number>();
	private inflight = new Map<Key, number>();
	private generationCounter = 0;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private running = false;
	private disposed = false;
	private needsResync = false;
	private seq = 0;
	private lastRequestId = -1;
	private queuedSync: { ids: Set<Key>; requestId: number } | null = null;
	private syncWorker: Promise<void> | null = null;

	constructor(
		private activityService: HatadyActivityService,
		private hatadyService: HatadyService,
		private mediaService: HatadyMediaService,
		private logsRepository: HatadyLogsRepository,
		private sessionsRepository: HatadyMediaSessionsRepository,
		private worksRepository: HatadyMediaWorksRepository,
		id: string,
		connection: Channel['connection'],
	) { super(id, connection); }

	@bindThis
	public init(params: JsonObject): boolean {
		if (params.scope !== 'mine' && params.scope !== 'recent' && params.scope !== 'following') return false;
		if (params.kind !== undefined && (typeof params.kind !== 'string' || !HATADY_ACTIVITY_KINDS.includes(params.kind as HatadyActivityKind))) return false;
		this.scope = params.scope;
		this.kind = params.kind as HatadyActivityKind | undefined ?? null;
		this.subscriber.on('hatadyTimelineStream', this.onEvent);
		return true;
	}

	@bindThis
	private onEvent(event: GlobalEvents['hatadyTimeline']['payload']): void {
		if (this.disposed) return;
		if (event.type === 'refresh') {
			if (event.body.viewerId === this.user?.id) this.requireResync();
			return;
		}
		const key: Key = `${event.body.source}:${event.body.id}`;
		if (!validKey(key)) return;
		this.markDirty(key);
	}

	private requireResync(requestId?: number): void {
		if (this.disposed || this.needsResync) return;
		this.needsResync = true;
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = null;
		this.dirty.clear();
		for (const key of this.generations.keys()) this.cleanupGeneration(key);
		this.send('resyncRequired', { seq: ++this.seq, ...(requestId === undefined ? {} : { requestId }) });
	}

	private markDirty(key: Key): void {
		if (this.disposed || this.needsResync) return;
		const known = new Set([...this.watched, ...this.pending.keys(), ...this.dirty, ...this.processing, ...this.inflight.keys()]);
		if (!known.has(key) && known.size >= MAX_WATCHED) {
			this.requireResync();
			return;
		}
		this.generations.set(key, ++this.generationCounter);
		this.dirty.add(key);
		if (this.timer === null && !this.running) this.timer = setTimeout(this.flush, COALESCE_MS);
	}

	@bindThis
	private async flush(): Promise<void> {
		this.timer = null;
		if (this.disposed || this.running) return;
		this.running = true;
		try {
			while (this.dirty.size && !this.disposed) {
				const keys = [...this.dirty];
				for (const key of keys) this.processing.add(key);
				this.dirty.clear();
				for (const key of keys) {
					try { await this.reconcile(key); } catch { this.requireResync(); }
					this.processing.delete(key);
					this.cleanupGeneration(key);
				}
			}
		} finally {
			this.running = false;
			if (this.dirty.size && !this.disposed && this.timer === null) this.timer = setTimeout(this.flush, COALESCE_MS);
		}
	}

	private sendRemoved(key: Key): void {
		if (!this.watched.delete(key)) return;
		this.pending.delete(key);
		this.send('removed', { seq: ++this.seq, key, id: key.slice(key.indexOf(':') + 1) });
	}

	private cleanupGeneration(key: Key): void {
		if (!this.watched.has(key) && !this.dirty.has(key) && !this.processing.has(key) && !this.pending.has(key) && !this.inflight.has(key)) this.generations.delete(key);
	}

	private async reconcile(key: Key, syncRequestId?: number): Promise<void> {
		if (this.disposed || this.needsResync || (syncRequestId !== undefined && syncRequestId !== this.lastRequestId)) return;
		const generation = this.generations.get(key) ?? 0;
		const wasWatched = this.watched.has(key);
		this.inflight.set(key, (this.inflight.get(key) ?? 0) + 1);
		try {
			const candidate = await this.loadCandidate(key);
			if (this.disposed || this.needsResync || generation !== (this.generations.get(key) ?? 0) || (syncRequestId !== undefined && syncRequestId !== this.lastRequestId)) return;
			if (candidate === null) {
				if (wasWatched) this.sendRemoved(key);
				return;
			}
			const [activity] = await this.activityService.packActivities([candidate], this.user!);
			if (this.disposed || this.needsResync || generation !== (this.generations.get(key) ?? 0) || (syncRequestId !== undefined && syncRequestId !== this.lastRequestId)) return;
			if (activity == null) {
				if (wasWatched) this.sendRemoved(key);
				return;
			}
			if (!this.watched.has(key) && this.watched.size >= MAX_WATCHED) {
				this.requireResync(syncRequestId);
				return;
			}
			this.watched.add(key);
			const seq = ++this.seq;
			this.pending.set(key, seq);
			this.send('activity', { seq, key, activity: activity as unknown as JsonValue });
		} finally {
			const remaining = (this.inflight.get(key) ?? 1) - 1;
			if (remaining === 0) this.inflight.delete(key);
			else this.inflight.set(key, remaining);
			this.cleanupGeneration(key);
		}
	}

	private async loadCandidate(key: Key): Promise<HatadyActivityCandidate | null> {
		const [source, id] = key.split(':') as [HatadyTimelineSource, string];
		if (source === 'log') {
			const log: MiHatadyLog | null = await this.logsRepository.findOneBy({ id });
			if (log === null || !this.allowsOwner(log.userId) || !this.allowsLog(log)) return null;
			if (this.scope === 'following' && !(await this.hatadyService.isFollowing(this.user!.id, log.userId))) return null;
			if (!(await this.hatadyService.canAppearInTimeline(log.userId, this.user!.id)) || !(await this.hatadyService.canViewLog(log, this.user!.id))) return null;
			return { source: 1, id, occurredAt: log.studiedAt, score: log.reactionsCount, log };
		}
		const session: MiHatadyMediaSession | null = await this.sessionsRepository.findOneBy({ id });
		if (session === null || !this.allowsOwner(session.userId) || !this.allowsSession(session)) return null;
		if (this.scope === 'following' && !(await this.hatadyService.isFollowing(this.user!.id, session.userId))) return null;
		if (!(await this.hatadyService.canAppearInTimeline(session.userId, this.user!.id))) return null;
		const work = session.workId ? await this.worksRepository.findOneBy({ id: session.workId }) : null;
		if (!(await this.mediaService.canViewSession(session, work, this.user!.id))) return null;
		return { source: 0, id, occurredAt: session.occurredAt, score: 0, session, work };
	}

	private allowsOwner(ownerId: string): boolean {
		if (this.scope === 'mine') return ownerId === this.user!.id;
		return true;
	}

	private allowsLog(log: MiHatadyLog): boolean {
		if (this.kind !== null && log.kind !== this.kind) return false;
		if (this.scope === 'recent') return log.visibility === 'public' && log.isPublic;
		if (this.scope === 'following') return log.visibility === 'public' || log.visibility === 'followers';
		return true;
	}

	private allowsSession(session: MiHatadyMediaSession): boolean {
		const kind = session.kind === 'movie_viewing' ? 'movie' : 'game';
		if (this.kind !== null && this.kind !== kind) return false;
		if (this.scope === 'recent') return session.visibility === 'public';
		if (this.scope === 'following') return session.visibility === 'public' || session.visibility === 'followers';
		return true;
	}

	@bindThis
	public onMessage(type: string, body: JsonValue): Promise<void> | void {
		if (type !== 'sync' || this.disposed || body === null || typeof body !== 'object' || Array.isArray(body)) return;
		const input = body as JsonObject;
		if (!Array.isArray(input.ids) || input.ids.length > MAX_WATCHED || !input.ids.every(validKey)) return;
		if (!Number.isSafeInteger(input.requestId) || (input.requestId as number) <= this.lastRequestId) return;
		if (!Number.isSafeInteger(input.seenThrough) || (input.seenThrough as number) < 0 || (input.seenThrough as number) > this.seq) return;
		const ids = new Set(input.ids as Key[]);
		const requestId = input.requestId as number;
		const seenThrough = input.seenThrough as number;
		const pending = [...this.pending].filter(([, emittedSeq]) => emittedSeq > seenThrough).map(([key]) => key);
		const nextKnown = new Set([...ids, ...pending, ...this.dirty, ...this.processing, ...this.inflight.keys()]);
		if (nextKnown.size > MAX_WATCHED) { this.requireResync(requestId); return; }
		this.lastRequestId = requestId;
		for (const [key, emittedSeq] of this.pending) if (emittedSeq <= seenThrough) this.pending.delete(key);
		for (const key of this.pending.keys()) ids.add(key);
		this.needsResync = false;
		this.watched = ids;
		for (const key of this.generations.keys()) {
			if (!ids.has(key)) {
				this.generations.set(key, ++this.generationCounter);
				// A REST snapshot can predate a real change already being reconciled.
				// Retry that change after invalidating the in-flight read; dropping it
				// would leave the client unaware of the activity until its next edit.
				if (this.processing.has(key)) this.dirty.add(key);
			}
			this.cleanupGeneration(key);
		}
		for (const key of ids) {
			this.generations.set(key, ++this.generationCounter);
			this.dirty.delete(key);
		}
		this.queuedSync = { ids, requestId };
		this.syncWorker ??= Promise.resolve().then(() => this.drainSyncs());
		return this.syncWorker;
	}

	private async drainSyncs(): Promise<void> {
		try {
			while (this.queuedSync !== null && !this.disposed) {
				const { ids, requestId } = this.queuedSync;
				this.queuedSync = null;
				for (const key of ids) {
					if (this.disposed || this.needsResync || requestId !== this.lastRequestId) break;
					const generation = this.generations.get(key);
					try { await this.reconcile(key, requestId); } catch { if (requestId === this.lastRequestId) this.requireResync(requestId); break; }
					if (generation === this.generations.get(key)) this.dirty.delete(key);
					this.cleanupGeneration(key);
				}
				if (!this.disposed && !this.needsResync && requestId === this.lastRequestId) this.send('synced', { seq: ++this.seq, requestId });
			}
		} finally {
			this.syncWorker = null;
		}
	}

	@bindThis
	public dispose(): void {
		this.disposed = true;
		this.queuedSync = null;
		if (this.timer !== null) clearTimeout(this.timer);
		this.timer = null;
		this.subscriber.off('hatadyTimelineStream', this.onEvent);
		this.watched.clear();
		this.pending.clear();
		this.dirty.clear();
		this.processing.clear();
		this.generations.clear();
		this.inflight.clear();
	}
}

@Injectable()
export class HatadyTimelineChannelService implements MiChannelService<true> {
	public readonly shouldShare = HatadyTimelineChannel.shouldShare;
	public readonly requireCredential = HatadyTimelineChannel.requireCredential;
	public readonly kind = HatadyTimelineChannel.kind;

	constructor(
		private activityService: HatadyActivityService,
		private hatadyService: HatadyService,
		private mediaService: HatadyMediaService,
		@Inject(DI.hatadyLogsRepository) private logsRepository: HatadyLogsRepository,
		@Inject(DI.hatadyMediaSessionsRepository) private sessionsRepository: HatadyMediaSessionsRepository,
		@Inject(DI.hatadyMediaWorksRepository) private worksRepository: HatadyMediaWorksRepository,
	) {}

	public create(id: string, connection: Channel['connection']): HatadyTimelineChannel {
		return new HatadyTimelineChannel(this.activityService, this.hatadyService, this.mediaService, this.logsRepository, this.sessionsRepository, this.worksRepository, id, connection);
	}
}
