/* SPDX-License-Identifier: AGPL-3.0-only */
import { ref, shallowRef } from 'vue';
import * as os from '@/os.js';

export type HataFeedTab = 'home' | 'issues' | 'roadmap' | 'emoji' | 'beta';
// Keep the selected project when following a detail or beta URL in this session.
export const hataFeedProjectId = ref<string | null>(null);
export const hataFeedTab = ref<HataFeedTab>('home');
export const hataFeedDraftPromptOpen = ref(false);
type NoticeHost = { active: () => boolean; notify: (message: string) => void };
const noticeHosts = shallowRef<NoticeHost[]>([]);
export function registerHataFeedNoticeHost(host: NoticeHost): () => void {
	noticeHosts.value = [...noticeHosts.value, host];
	return () => { noticeHosts.value = noticeHosts.value.filter(item => item !== host); };
}
export function hataFeedNotify(message: string): void {
	const text = message.replace(/[。\s]+$/u, '');
	const host = noticeHosts.value.findLast(item => item.active());
	if (host) host.notify(text);
	else os.toast(text);
}
