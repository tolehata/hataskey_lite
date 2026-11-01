/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { get } from 'idb-keyval';
import * as Misskey from 'cherrypick-js';
import type { PushNotificationDataMap } from '@/types.js';
import type { I18n } from '@@/js/i18n.js';
import type { Locale } from '../../../locales/index.js';
import { createEmptyNotification, createNotification } from '@/scripts/create-notification.js';
import { swLang } from '@/scripts/lang.js';
import * as swos from '@/scripts/operations.js';

async function closeReadNotifications(userId: string, ids: readonly string[]): Promise<void> {
	if (ids.length === 0) return;
	const readIds = new Set(ids);
	for (const notification of await globalThis.registration.getNotifications()) {
		const data = notification.data as PushNotificationDataMap[keyof PushNotificationDataMap] | undefined;
		if (data?.type === 'notification' && data.userId === userId && readIds.has(data.body.id)) notification.close();
	}
}

async function markNotificationRead(userId: string, id: string): Promise<void> {
	await swos.api('notifications/mark-as-read', userId, { notificationIds: [id] });
}

globalThis.addEventListener('install', (ev) => {
	// 旗鯖fork: 新しいSWを即座に有効化する(待機フェーズをスキップ)。
	//   これにより、オフライン画面など SW 由来の変更を既存ユーザーにも強制的に反映する。
	//   activate 側の clients.claim() と合わせて、次回読み込み時に新SWが全クライアントを掌握する。
	ev.waitUntil(globalThis.skipWaiting());
});

globalThis.addEventListener('activate', ev => {
	ev.waitUntil(
		caches.keys()
			.then(cacheNames => Promise.all(
				cacheNames
					.filter((v) => v !== swLang.cacheName)
					.map(name => caches.delete(name)),
			))
			.then(() => globalThis.clients.claim()),
	);
});

async function offlineContentHTML() {
	const i18n = await (swLang.i18n ?? swLang.fetchLocale()) as Partial<I18n<Locale>>;
	const messages = {
		title: i18n.ts?._offlineScreen.title ?? 'Offline - Could not connect to server',
		header: i18n.ts?._offlineScreen.header ?? 'Could not connect to server',
		reload: i18n.ts?.reload ?? 'Reload',
	};

	return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta content="width=device-width,initial-scale=1" name="viewport"><title>${messages.title}</title><style>body{background-color:rgb(238, 241, 252);color:rgb(87, 112, 150);font-family:Hiragino Maru Gothic Pro,BIZ UDGothic,Roboto,HelveticaNeue,Arial,sans-serif;line-height:1.35;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box}.icon{max-width:120px;width:100%;height:auto;margin-bottom:20px;}.message{text-align:center;font-size:20px;font-weight:700;margin-bottom:20px}.version{text-align:center;font-size:90%;margin-bottom:20px}button{padding:7px 14px;min-width:100px;font-weight:700;font-family:Hiragino Maru Gothic Pro,BIZ UDGothic,Roboto,HelveticaNeue,Arial,sans-serif;line-height:1.35;border-radius:99rem;background-color:rgb(107, 165, 227);color:rgb(255, 255, 255);border:none;cursor:pointer;-webkit-tap-highlight-color:transparent}button:hover{background-color:rgb(150, 191, 235)}</style></head><body><img class="icon" src="/client-assets/hatakyu/overwhelmed.png" alt="" onerror="this.style.display='none';document.getElementById('hatakyuFallback').style.display='block'"><svg id="hatakyuFallback" class="icon" style="display:none"fill="none"height="24"stroke="currentColor"stroke-linecap="round"stroke-linejoin="round"stroke-width="2"viewBox="0 0 24 24"width="24"xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z"fill="none"stroke="none"/><path d="M11 5h2"/><path d="M19 12c-.667 5.333 -2.333 8 -5 8h-4c-2.667 0 -4.333 -2.667 -5 -8"/><path d="M11 16c0 .667 .333 1 1 1s1 -.333 1 -1h-2"/><path d="M12 18v2"/><path d="M10 11v.01"/><path d="M14 11v.01"/><path d="M5 4l6 .97l-6.238 6.688a1.021 1.021 0 0 1 -1.41 .111a.953 .953 0 0 1 -.327 -.954l1.975 -6.815"/><path d="M19 4l-6 .97l6.238 6.688c.358 .408 .989 .458 1.41 .111a.953 .953 0 0 0 .327 -.954l-1.975 -6.815"/></svg><div class="message">${messages.header}</div><div class="version">v${_VERSION_}<br><span style="font-size: 80%;">${_BASEDMISSKEYVERSION_}</span></div><button onclick="reloadPage()">${messages.reload}</button><script>function reloadPage(){location.reload(!0)}</script></body></html>`;
}

globalThis.addEventListener('fetch', ev => {
	let isHTMLRequest = false;
	if (ev.request.headers.get('sec-fetch-dest') === 'document') {
		isHTMLRequest = true;
	} else if (ev.request.headers.get('accept')?.includes('/html')) {
		isHTMLRequest = true;
	} else if (ev.request.url.endsWith('/')) {
		isHTMLRequest = true;
	}

	if (!isHTMLRequest) return;
	ev.respondWith(
		fetch(ev.request)
			.catch(async () => {
				const html = await offlineContentHTML();
				return new Response(html, {
					status: 200,
					headers: {
						'content-type': 'text/html',
					},
				});
			}),
	);
});

globalThis.addEventListener('push', ev => {
	// クライアント取得
	ev.waitUntil(globalThis.clients.matchAll({
		includeUncontrolled: true,
		type: 'window',
	}).then(async () => {
		const data: PushNotificationDataMap[keyof PushNotificationDataMap] = ev.data?.json();

		switch (data.type) {
			// case 'driveFileCreated':
			case 'notification':
			case 'unreadAntennaNote':
			case 'newChatMessage':
			case 'hatadyNotification':
				// 1日以上経過している場合は無視
				if (Date.now() - data.dateTime > 1000 * 60 * 60 * 24) break;

				return createNotification(data);
			case 'readAllNotifications':
			case 'notificationChanged':
				await closeReadNotifications(data.userId, data.body?.ids ?? []);
				return;
			case 'readNotification':
				await closeReadNotifications(data.userId, [data.body.id]);
				return;
		}

		await createEmptyNotification();
		return;
	}));
});

globalThis.addEventListener('notificationclick', (ev: ServiceWorkerGlobalScopeEventMap['notificationclick']) => {
	ev.waitUntil((async (): Promise<void> => {
		if (_DEV_) {
			console.log('notificationclick', ev.action, ev.notification.data);
		}

		const { action, notification } = ev;
		const data: PushNotificationDataMap[keyof PushNotificationDataMap] = notification.data ?? {};
		const { userId: loginId } = data;
		let client: WindowClient | null = null;

		switch (data.type) {
			case 'notification':
				switch (action) {
					case 'follow':
						if ('userId' in data.body && data.body.userId != null) await swos.api('following/create', loginId, { userId: data.body.userId });
						break;
					case 'showUser':
						if ('user' in data.body && data.body.user != null) client = await swos.openUser(Misskey.acct.toString(data.body.user), loginId);
						break;
					case 'reply':
						if ('note' in data.body) client = await swos.openPost({ reply: data.body.note }, loginId);
						break;
					case 'renote':
						if ('note' in data.body) await swos.api('notes/create', loginId, { renoteId: data.body.note.id });
						break;
					case 'accept':
						switch (data.body.type) {
							case 'receiveFollowRequest':
								await swos.api('following/requests/accept', loginId, { userId: data.body.userId });
								break;
							case 'groupInvited':
								await swos.api('users/groups/invitations/accept', loginId, { invitationId: data.body.invitation.id });
								break;
							case 'chatRoomInvitationReceived':
								await swos.api('chat/rooms/join', loginId, { roomId: data.body.invitation.roomId });
								break;
						}
						break;
					case 'reject':
						switch (data.body.type) {
							case 'receiveFollowRequest':
								await swos.api('following/requests/reject', loginId, { userId: data.body.userId });
								break;
							case 'groupInvited':
								await swos.api('users/groups/invitations/reject', loginId, { invitationId: data.body.invitation.id });
								break;
							case 'chatRoomInvitationReceived':
								await swos.api('chat/rooms/invitations/reject', loginId, { roomId: data.body.invitation.roomId });
								break;
						}
						break;
					case 'ignore':
						switch (data.body.type) {
							case 'chatRoomInvitationReceived':
								await swos.api('chat/rooms/invitations/ignore', loginId, { roomId: data.body.invitation.roomId });
								break;
						}
						break;
					case 'showFollowRequests':
						client = await swos.openClient('push', '/my/follow-requests', loginId);
						break;
					default:
						switch (data.body.type) {
							case 'receiveFollowRequest':
								client = await swos.openClient('push', '/my/follow-requests', loginId);
								break;
							case 'groupInvited':
								client = await swos.openClient('push', '/my/groups', loginId);
								break;
							case 'reaction':
								client = await swos.openNote(data.body.note.id, loginId);
								break;
							case 'hatady':
								client = await swos.openClient('push', `/hatady?notificationId=${encodeURIComponent(data.body.id)}`, loginId);
								break;
							case 'chatRoomInvitationReceived':
								client = await swos.openClient('push', '/chat', loginId);
								break;
							case 'app':
							case 'hataFeed':
							case 'hataskFlowerReady':
							case 'hataskFlowerBloomed':
							case 'hataskZukanUpdated':
							case 'hataskFestivalBloomed':
							case 'hataskDecorationUnlocked':
							case 'earthquake':
							case 'addedToPrivateChannel':
							case 'removedFromPrivateChannel':
								// customLink は backend で「/」始まりの相対パスだけに検証済み。
								if (data.body.link) client = await swos.openClient('push', data.body.link, loginId);
								break;
							default:
								if ('note' in data.body) {
									client = await swos.openNote(data.body.note.id, loginId);
								} else if ('user' in data.body) {
									client = await swos.openUser(Misskey.acct.toString(data.body.user), loginId);
								}
								break;
						}
				}
				break;
			case 'unreadAntennaNote':
				client = await swos.openAntenna(data.body.antenna.id, loginId);
				break;
			case 'newChatMessage':
				client = await swos.openChat(data.body, loginId);
				break;
			case 'hatadyNotification':
				client = await swos.openClient('push', '/hatady', loginId);
				break;
			default:
				switch (action) {
					case 'markAllAsRead':
						await globalThis.registration.getNotifications()
							.then(notifications => notifications.forEach(n => n.tag !== 'read_notification' && n.close()));
						await get<Pick<Misskey.entities.SignupResponse, 'id' | 'token'>[]>('accounts').then(accounts => {
							return Promise.all((accounts ?? []).map(async account => {
								await swos.sendMarkAllAsRead(account.id);
							}));
						});
						break;
					case 'settings':
						client = await swos.openClient('push', '/settings/notifications', loginId);
						break;
				}
		}

		if (client) {
			client.focus();
		}
		if (data.type === 'notification') {
			await markNotificationRead(loginId, data.body.id);
		}

		notification.close();
	})());
});

globalThis.addEventListener('notificationclose', (ev: ServiceWorkerGlobalScopeEventMap['notificationclose']) => {
	const data: PushNotificationDataMap[keyof PushNotificationDataMap] = ev.notification.data;

	ev.waitUntil((async (): Promise<void> => {
		if (data.type === 'notification') {
			await markNotificationRead(data.userId, data.body.id);
		}
		return;
	})());
});

globalThis.addEventListener('message', (ev: ServiceWorkerGlobalScopeEventMap['message']) => {
	ev.waitUntil((async (): Promise<void> => {
		switch (ev.data) {
			case 'clear':
				// Cache Storage全削除
				await caches.keys()
					.then(cacheNames => Promise.all(
						cacheNames.map(name => caches.delete(name)),
					));
				return; // TODO
		}

		if (typeof ev.data === 'object') {
			// E.g. '[object Array]' → 'array'
			const otype = Object.prototype.toString.call(ev.data).slice(8, -1).toLowerCase();

			if (otype === 'object') {
				if (ev.data.msg === 'initialize') {
					swLang.setLang(ev.data.lang);
				}
			}
		}
	})());
});
