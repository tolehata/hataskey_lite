/* SPDX-License-Identifier: AGPL-3.0-only */
import type { HatadyActivity, HatadyMediaKind } from '@/utility/hatady-media.js';
import { inject } from 'vue';
import { url } from '@@/js/config.js';
import type { HatadySurfaceVariant } from '@/utility/hatady-record-launcher.js';
import { loadHatadyDisplay } from '@/utility/hatady-prefs.js';
import { activityData } from '@/utility/hatady-home.js';
import { confirmHatadyRecordDeletion } from '@/utility/hatady-record-delete.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { mainRouter, useRouter } from '@/router.js';
import { useHataGoesPopup, useHataGoesPopupMenu } from '@/utility/hatagoes-popup.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import { hatagoesSearchResultUrl } from '@/utility/hatagoes-search.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';

export function isOwnHatadyProfile(userId: string | null | undefined, variant: HatadySurfaceVariant): boolean {
	return variant !== 'hatady' && (!userId || userId === $i?.id);
}

export function openOwnHatadyProfileIfNeeded(userId: string | null | undefined, variant: HatadySurfaceVariant): boolean {
	if (!isOwnHatadyProfile(userId, variant)) return false;
	mainRouter.pushByPath('/hatady?tab=profile');
	return true;
}

export function useHatadyActivityActions(options: {
	variant?: HatadySurfaceVariant;
	onChanged?: () => void | Promise<void>;
	onDeleted?: (activity: HatadyActivity) => void;
	onOwnProfile?: () => void;
	onBookDeleted?: (id: string) => void;
	onMediaDeleted?: (id: string) => void;
}) {
	const popup = useHataGoesPopup();
	const popupMenu = useHataGoesPopupMenu();
	const inHataGoes = inject(HATA_GOES_HOST, null) != null;
	const variant = options.variant ?? 'hatady';
	const router = useRouter();
	const deleting = new Set<string>();
	const changed = () => { void options.onChanged?.(); };
	const deleted = (activity: HatadyActivity) => { options.onDeleted?.(activity); changed(); };

	async function openConversation(logId: string, onClosed?: () => void): Promise<void> {
		await loadHatadyDisplay();
		const { dispose } = popup((await import('@/components/HatadyConversation.vue')).default,
			{ logId, variant }, { deleted, changed, closed: () => { dispose(); onClosed?.(); } });
	}

	async function openSession(sessionId: string, workId?: string, onClosed?: () => void): Promise<void> {
		await loadHatadyDisplay();
		const { dispose } = popup((await import('@/components/HatadyConversation.vue')).default,
			{ sessionId, workId, variant }, { deleted, changed, closed: () => { dispose(); onClosed?.(); } });
	}

	function openActivity(activity: HatadyActivity): void {
		if (activity.study) void openConversation(activity.study.id);
		else if (activity.media) void openSession(activity.media.session.id, activity.media.session.workId || undefined);
	}

	async function openBookDetail(bookId: string, onClosed?: () => void): Promise<void> {
		await loadHatadyDisplay();
		const { dispose } = popup((await import('@/components/HatadyBookDetail.vue')).default,
			{ bookId, variant }, { deleted: () => options.onBookDeleted?.(bookId), changed, openLog: openConversation, closed: () => { dispose(); onClosed?.(); } });
	}

	async function openMediaDetailById(workId: string, kind?: HatadyMediaKind, onClosed?: () => void): Promise<void> {
		await loadHatadyDisplay();
		const { dispose } = popup((await import('@/components/HatadyMediaWorkDetail.vue')).default,
			{ workId, kind, variant }, { deleted: () => options.onMediaDeleted?.(workId), changed, closed: () => { dispose(); onClosed?.(); } });
	}

	async function openProfile(userId?: string | null, onClosed?: () => void): Promise<void> {
		if (!userId || userId === $i?.id) {
			if (options.onOwnProfile) options.onOwnProfile();
			else router.pushByPath('/hatady?tab=profile');
			onClosed?.();
			return;
		}
		await loadHatadyDisplay();
		const { dispose } = popup((await import('@/components/HatadyProfile.vue')).default,
			{ userId, variant }, { changed, openLog: openConversation, openProfile, openBook: openBookDetail, openMedia: openMediaDetailById, closed: () => { dispose(); onClosed?.(); } });
	}

	async function editActivity(activity: HatadyActivity): Promise<void> {
		if (!activity.isMine) return;
		await loadHatadyDisplay();
		if (activity.study) {
			const { dispose } = popup((await import('@/components/HatadyComposer.vue')).default,
				{ editLog: activity.study, variant }, { done: changed, closed: () => dispose() });
		} else if (activity.media) {
			const { dispose } = popup((await import('@/components/HatadyMediaSessionForm.vue')).default,
				{ work: activity.media.work, editSession: activity.media.session, variant }, { done: changed, closed: () => dispose() });
		}
	}

	async function deleteActivity(activity: HatadyActivity): Promise<void> {
		if (!activity.isMine || deleting.has(activity.id)) return;
		deleting.add(activity.id);
		try { if (await confirmHatadyRecordDeletion(activity, variant, popup)) deleted(activity); } finally { deleting.delete(activity.id); }
	}

	async function reportActivity(activity: HatadyActivity): Promise<void> {
		if (!activity.user) return;
		const data = activityData(activity);
		const reference = activity.study ? `hatady:log:${activity.study.id}` : activity.media ? `hatady:media:session:${activity.media.session.id}` : null;
		if (!reference) return;
		await loadHatadyDisplay();
		const { dispose } = popup((await import('@/components/HatadyReport.vue')).default,
			{ user: activity.user, initialComment: `${reference}\n${data.title}\n${data.body}`, variant }, { closed: () => dispose() });
	}

	function reactionCounts(activity: HatadyActivity): Record<string, number> {
		const source = activity.study?.reactions ?? activity.media?.session.reactions;
		if (Array.isArray(source)) return Object.fromEntries(source.map(({ reaction, count }) => [reaction, count]));
		return source && typeof source === 'object' ? { ...source } : {};
	}

	async function openReactionSheet(activity: HatadyActivity): Promise<void> {
		const target = activity.study ? { logId: activity.study.id } : activity.media ? { sessionId: activity.media.session.id } : null;
		if (!target) return;
		const { dispose } = popup((await import('@/components/HatadyReactionSheet.vue')).default,
			{ target, reactions: reactionCounts(activity), variant }, { closed: () => dispose() });
	}

	function copyActivityLink(activity: HatadyActivity): void {
		const targetId = activity.study?.id ?? activity.media?.session.id;
		if (!targetId) return;
		const kind = activity.study ? 'log' : 'mediaSession';
		copyToClipboard(`${url}${hatagoesSearchResultUrl({ url: '/hatady?tab=records', kind, targetId })}`, 'link');
	}

	function openActivityMenu(activity: HatadyActivity, event: MouseEvent): void {
		const copy = i18n.ts._hata._hatady._home;
		const items: any[] = [{ text: copy.openInHatady, icon: 'ti ti-external-link', action: () => router.pushByPath('/hatady?tab=records') }];
		if (inHataGoes && activity.isMine) items.push({ text: copy.edit, icon: 'ti ti-pencil', action: () => editActivity(activity) });
		if (inHataGoes) items.push(
			{ text: i18n.ts.copyLink, icon: 'ti ti-link', action: () => copyActivityLink(activity) },
			{ text: i18n.ts.reactionsList, icon: 'ti ti-mood-plus', action: () => openReactionSheet(activity) },
		);
		if (activity.isMine) {
			if (!inHataGoes) items.push({ text: copy.edit, icon: 'ti ti-pencil', action: () => editActivity(activity) });
			items.push({ text: copy.delete, icon: 'ti ti-trash', danger: true, action: () => deleteActivity(activity) });
		} else if (activity.user) items.push(
			{ text: copy.hatadyProfile, icon: 'ti ti-user', action: () => openProfile(activity.user?.id) },
			{ text: copy.report, icon: 'ti ti-flag', action: () => reportActivity(activity) },
		);
		if (variant === 'hatady') items.shift();
		void popupMenu(items, (event.currentTarget || event.target) as HTMLElement,
			variant === 'uis' ? { appearance: 'uiS-composer' } : undefined);
	}

	return { openActivity, openConversation, openSession, openBookDetail, openMediaDetailById, openProfile, editActivity, deleteActivity, reportActivity, openActivityMenu };
}
