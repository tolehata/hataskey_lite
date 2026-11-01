/* SPDX-License-Identifier: AGPL-3.0-only */
import { computed, inject, onBeforeUnmount, onMounted, provide, reactive, watch } from 'vue';
import { url as instanceUrl } from '@@/js/config.js';
import type { InjectionKey, Ref } from 'vue';
import { instance } from '@/instance.js';
import { misskeyApi } from '@/utility/misskey-api.js';

export type WelcomePublicFile = { id: string; name: string; type: string; url: string; thumbnailUrl: string | null; isSensitive: boolean; comment: string | null };
export type WelcomePublicNote = {
	id: string; createdAt: string; text: string; cw: string | null;
	user: { id: string; name: string; username: string; avatarUrl: string | null };
	files: WelcomePublicFile[]; reactions: { name: string; count: number; image: string | null }[];
};
type FeedStatus = 'loading' | 'ready' | 'empty' | 'error' | 'disabled';
type Feed = { notes: WelcomePublicNote[]; status: FeedStatus };
export type WelcomeFeedKey = 'latest' | 'popular' | 'files' | 'greetings';
type Request = (endpoint: 'notes/local-timeline' | 'notes/featured', params: { limit: number; withRenotes?: boolean; withFiles?: boolean; untilId?: string }, signal: AbortSignal) => Promise<unknown>;
const DISPLAY_LIMIT = 12;
const PAGE_LIMIT = 100;

export function publicAssetUrl(value: unknown, base = instanceUrl): string | null {
	if (typeof value !== 'string' || !value) return null;
	try {
		const parsed = new URL(value, base);
		const local = parsed.origin === new URL(base).origin;
		return !parsed.username && !parsed.password && (parsed.protocol === 'https:' || (local && parsed.protocol === 'http:')) ? parsed.href : null;
	} catch { return null; }
}

export function isWelcomeGreeting(text: string): boolean {
	return /おはよ[うぉー〜～]?|おやすみ|(?:^|[^a-z])(?:ohayo(?:u|o)?|oayasumi|oyasumi)(?=$|[^a-z])/i.test(text.normalize('NFKC'));
}

function object(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function normalizeWelcomeNotes(values: unknown, base = instanceUrl): WelcomePublicNote[] {
	if (!Array.isArray(values)) throw new Error('Invalid public timeline');
	const seen = new Set<string>();
	return values.flatMap(value => {
		const note = object(value), user = object(note?.user);
		// The preview is always anonymous, including when opened by a signed-in
		// visitor. No channel, targeted, hidden or remote note enters these feeds.
		if (!note || !user || note.visibility !== 'public' || note.isHidden || user.host !== null || note.channelId != null || note.channel != null || note.hasDeliveryTargets || (Array.isArray(note.visibleUserIds) && note.visibleUserIds.length) || typeof note.id !== 'string' || !/^[a-zA-Z0-9]+$/.test(note.id) || seen.has(note.id) || typeof user.username !== 'string') return [];
		const rawFiles = Array.isArray(note.files) ? note.files : [];
		if (!note.text && !rawFiles.length && note.renoteId) return [];
		seen.add(note.id);
		const files = rawFiles.flatMap(value => {
			const file = object(value), url = publicAssetUrl(file?.url, base);
			return file && url && typeof file.id === 'string' ? [{ id: file.id, name: String(file.name ?? 'ファイル'), type: String(file.type ?? ''), url, thumbnailUrl: publicAssetUrl(file.thumbnailUrl, base), isSensitive: file.isSensitive === true, comment: typeof file.comment === 'string' ? file.comment : null }] : [];
		});
		const emojis = object(note.reactionEmojis) ?? {};
		const reactions = Object.entries(object(note.reactions) ?? {}).flatMap(([name, count]) => {
			if (typeof count !== 'number' || !Number.isSafeInteger(count) || count <= 0) return [];
			const custom = /^:([a-zA-Z0-9_+-]+)(?:@([^:]+))?:$/.exec(name);
			const image = custom ? (!custom[2] || custom[2] === '.' ? new URL(`/emoji/${encodeURIComponent(custom[1])}.webp`, base).href : publicAssetUrl(emojis[`${custom[1]}@${custom[2]}`], base)) : null;
			return [{ name, count, image }];
		}).sort((a, b) => b.count - a.count);
		return [{ id: note.id, createdAt: typeof note.createdAt === 'string' ? note.createdAt : '', text: typeof note.text === 'string' ? note.text : '', cw: typeof note.cw === 'string' ? note.cw : null, user: { id: String(user.id ?? ''), name: String(user.name || user.username), username: user.username, avatarUrl: publicAssetUrl(user.avatarUrl, base) }, files, reactions }];
	});
}

export function createWelcomePublicNotes(enabled: Readonly<Ref<boolean>>, request: Request) {
	const empty = (): Feed => ({ notes: [], status: 'loading' });
	const feeds = reactive<Record<WelcomeFeedKey, Feed>>({ latest: empty(), popular: empty(), files: empty(), greetings: empty() });
	let revision = 0, running = false;
	let pending: Promise<void> | null = null, active: AbortController | null = null;
	let interval: number | undefined;
	let unwatch: (() => void) | undefined;

	function clear(status: FeedStatus) {
		for (const feed of Object.values(feeds)) { feed.notes = []; feed.status = status; }
	}

	async function load() {
		const current = ++revision;
		const controller = new AbortController();
		active = controller;
		const timeout = window.setTimeout(() => controller.abort(), 20_000);
		const available = () => running && enabled.value && current === revision;

		function publish(key: WelcomeFeedKey, notes: WelcomePublicNote[]) {
			if (!available() || controller.signal.aborted) return;
			feeds[key].notes = notes.slice(0, DISPLAY_LIMIT);
			feeds[key].status = notes.length ? 'ready' : 'empty';
		}

		function failed(...keys: WelcomeFeedKey[]) { if (available()) for (const key of keys) feeds[key].status = 'error'; }

		try {
			await Promise.all([
				(async () => {
					let rows: unknown;
					try {
						rows = await request('notes/local-timeline', { limit: PAGE_LIMIT, withRenotes: false }, controller.signal);
						publish('latest', normalizeWelcomeNotes(rows));
					} catch { failed('latest', 'greetings'); return; }
					let candidates = normalizeWelcomeNotes(rows).filter(note => isWelcomeGreeting(note.text));
					try {
						// Anonymous search can be disabled. Use at most three public
						// timeline pages, without changing permissions or credentials.
						for (let page = 1; available() && !controller.signal.aborted && candidates.length < DISPLAY_LIMIT && page < 3 && Array.isArray(rows) && rows.length === PAGE_LIMIT; page++) {
							const untilId = object(rows.at(-1))?.id;
							if (typeof untilId !== 'string' || !/^[a-zA-Z0-9]+$/.test(untilId)) break;
							rows = await request('notes/local-timeline', { limit: PAGE_LIMIT, withRenotes: false, untilId }, controller.signal);
							candidates = [...new Map([...candidates, ...normalizeWelcomeNotes(rows).filter(note => isWelcomeGreeting(note.text))].map(note => [note.id, note])).values()];
						}
						publish('greetings', candidates);
					} catch { if (candidates.length) publish('greetings', candidates); failed('greetings'); }
				})(),
				(async () => { try { publish('popular', normalizeWelcomeNotes(await request('notes/featured', { limit: 40 }, controller.signal))); } catch { failed('popular'); } })(),
				(async () => { try { publish('files', normalizeWelcomeNotes(await request('notes/local-timeline', { limit: 40, withFiles: true, withRenotes: false }, controller.signal)).filter(note => note.files.length)); } catch { failed('files'); } })(),
			]);
		} finally { window.clearTimeout(timeout); if (active === controller) active = null; }
	}

	function refresh(): Promise<void> {
		if (!running || !enabled.value) return Promise.resolve();
		if (pending) return pending;
		const task = load().finally(() => { if (pending === task) pending = null; });
		pending = task;
		return task;
	}

	function cancel() { revision++; active?.abort(); active = null; pending = null; }

	function start() {
		if (running) return;
		running = true;
		unwatch = watch(enabled, allowed => {
			cancel(); clear(allowed ? 'loading' : 'disabled');
			if (allowed) void refresh();
		}, { immediate: true, flush: 'sync' });
		interval = window.setInterval(() => { if (!window.document.hidden) void refresh(); }, 120_000);
	}

	function stop() { running = false; unwatch?.(); unwatch = undefined; window.clearInterval(interval); interval = undefined; cancel(); clear('disabled'); }

	return { feeds, enabled, refresh, start, stop };
}

type WelcomePublicNotes = ReturnType<typeof createWelcomePublicNotes>;
const publicNotesKey: InjectionKey<WelcomePublicNotes> = Symbol('welcome-public-notes');
export function useWelcomePublicNotes(): WelcomePublicNotes {
	const existing = inject(publicNotesKey, null);
	if (existing) return existing;
	const enabled = computed(() => instance.policies?.ltlAvailable === true && instance.clientOptions?.showTimelineForVisitor !== false);
	const notes = createWelcomePublicNotes(enabled, (endpoint, params, signal) => misskeyApi(endpoint, params, null, signal));
	provide(publicNotesKey, notes);
	onMounted(notes.start);
	onBeforeUnmount(notes.stop);
	return notes;
}
