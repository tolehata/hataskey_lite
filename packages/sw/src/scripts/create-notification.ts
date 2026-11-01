/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * Notification manager for SW
 */
import type { BadgeNames, PushNotificationDataMap } from '@/types.js';
import { char2fileName } from '@/scripts/twemoji-base.js';
import { cli } from '@/scripts/operations.js';
import { getAccountFromId } from '@/scripts/get-account-from-id.js';
import { hataFeedNotificationDisplayBody, privateChannelNotificationDisplayCopy } from '@/scripts/hata-custom-notification-copy.js';
import { swLang } from '@/scripts/lang.js';
import { getUserName } from '@/scripts/get-user-name.js';

const closeNotificationsByTags = async (tags: string[]): Promise<void> => {
	for (const n of (await Promise.all(tags.map(tag => globalThis.registration.getNotifications({ tag })))).flat()) {
		n.close();
	}
};

const iconUrl = (name: BadgeNames): string => `/static-assets/tabler-badges/${name}.png`;
/* How to add a new badge:
 * 1. Find the icon and download png from https://tabler-icons.io/
 * 2. vips resize ~/Downloads/icon-name.png vipswork.png 0.4; vips scRGB2BW vipswork.png ~/icon-name.png"[compression=9,strip]"; rm vipswork.png;
 * 3. mv ~/icon-name.png ~/cherrypick/packages/backend/assets/tabler-badges/
 * 4. Add 'icon-name' to BadgeNames
 * 5. Add `badge: iconUrl('icon-name'),`
 */

export async function createNotification<K extends keyof PushNotificationDataMap>(data: PushNotificationDataMap[K]): Promise<void> {
	const n = await composeNotification(data);

	if (n) {
		return globalThis.registration.showNotification(...n);
	} else {
		console.error('Could not compose notification', data);
		return createEmptyNotification();
	}
}

async function composeNotification(data: PushNotificationDataMap[keyof PushNotificationDataMap]): Promise<[string, NotificationOptions] | null> {
	const i18n = await (swLang.i18n ?? swLang.fetchLocale());
	switch (data.type) {
		/*
		case 'driveFileCreated': // TODO (Server Side)
			return [i18n.ts._notification.fileUploaded, {
				body: body.name,
				icon: body.url,
				data
			}];
		*/
		case 'notification':
			switch (data.body.type) {
				case 'hatady': {
					const copy = i18n.ts._hata._hatady._push;
					const subtype = data.body.subtype;
					const body = subtype === 'follow' ? copy.follow
						: subtype === 'comment' || subtype === 'mediaComment' || subtype === 'mediaReply' ? copy.comment
						: subtype === 'reaction' || subtype === 'mediaReaction' ? copy.reaction : copy.update;
					return [copy.title, {
						body,
						badge: iconUrl('bell'),
						tag: `hatady:${data.body.id}`,
						data,
					}];
				}
				case 'follow': {
					// users/showの型定義をswos.apiへ当てはめるのが困難なのでapiFetch.requestを直接使用
					const account = await getAccountFromId(data.userId);

					let actions = [
						{
							action: 'follow',
							title: i18n.ts._notification._actions.followBack,
						},
					];

					if (account) {
						try {
							const userDetail = await cli.request('users/show', { userId: data.body.userId }, account.token);
							if (userDetail.isFollowing) {
								actions = [];
							}
						} catch { }
					}

					return [i18n.ts._notification.youWereFollowed, {
						body: `${getUserName(data.body.user)} (@${data.body.user.username}${data.body.user.host != null ? '@' + data.body.user.host : ''})`,
						icon: data.body.user.avatarUrl ?? undefined,
						badge: iconUrl('user-plus'),
						data,
						actions,
					}];
				}

				case 'mention':
					return [i18n.tsx._notification.youGotMention({ name: getUserName(data.body.user) }), {
						body: data.body.note.text ?? '',
						icon: data.body.user.avatarUrl ?? undefined,
						badge: iconUrl('at'),
						data,
						actions: [
							{
								action: 'reply',
								title: i18n.ts._notification._actions.reply,
							},
						],
					}];

				case 'reply':
					return [i18n.tsx._notification.youGotReply({ name: getUserName(data.body.user) }), {
						body: data.body.note.text ?? '',
						icon: data.body.user.avatarUrl ?? undefined,
						badge: iconUrl('arrow-back-up'),
						data,
						actions: [
							{
								action: 'reply',
								title: i18n.ts._notification._actions.reply,
							},
						],
					}];

				case 'renote':
					return [i18n.tsx._notification.youRenoted({ name: getUserName(data.body.user) }), {
						body: data.body.note.text ?? '',
						icon: data.body.user.avatarUrl ?? undefined,
						badge: iconUrl('repeat'),
						data,
						actions: [
							{
								action: 'showUser',
								title: getUserName(data.body.user),
							},
						],
					}];

				case 'quote':
					return [i18n.tsx._notification.youGotQuote({ name: getUserName(data.body.user) }), {
						body: data.body.note.text ?? '',
						icon: data.body.user.avatarUrl ?? undefined,
						badge: iconUrl('quote'),
						data,
						actions: [
							{
								action: 'reply',
								title: i18n.ts._notification._actions.reply,
							},
							...((data.body.note.visibility === 'public' || data.body.note.visibility === 'home') ? [
								{
									action: 'renote',
									title: i18n.ts._notification._actions.renote,
								},
							] : []),
						],
					}];

				case 'note':
					return [i18n.ts._notification.newNote + ': ' + getUserName(data.body.user), {
						body: data.body.note.text ?? '',
						icon: data.body.user.avatarUrl ?? undefined,
						data,
					}];

				case 'reaction': {
					let reaction = data.body.reaction;
					let badge: string | undefined;
					const reaction1 = data.body.reaction;

					if (reaction.startsWith(':')) {
						// カスタム絵文字の場合
						const name = reaction.substring(1, reaction.length - 1);
						const badgeUrl = new URL(`/emoji/${name}.webp`, origin);
						badgeUrl.searchParams.set('badge', '1');
						badge = badgeUrl.href;
						reaction = name.split('@')[0];
					} else {
						// Unicode絵文字の場合
						badge = `/twemoji-badge/${char2fileName(reaction)}.png`;
					}

					if (await fetch(badge).then(res => res.status !== 200).catch(() => true)) {
						badge = iconUrl('plus');
					}

					const tag = `reaction:${data.body.note.id}`;
					return [i18n.tsx._notification.youGotReact({ name: getUserName(data.body.user) }), {
						body: (reaction1.startsWith(':') ? `:${ reaction }:` : `${ reaction }` + '\n' + data.body.note.text),
						icon: data.body.user.avatarUrl ?? undefined,
						tag,
						badge,
						data,
						actions: [
							{
								action: 'showUser',
								title: getUserName(data.body.user),
							},
						],
					}];
				}

				case 'receiveFollowRequest':
					return [i18n.ts._notification.youReceivedFollowRequest, {
						body: `${getUserName(data.body.user)} (@${data.body.user.username}${data.body.user.host != null ? '@' + data.body.user.host : ''})`,
						icon: data.body.user.avatarUrl ?? undefined,
						badge: iconUrl('user-plus'),
						data,
						actions: [
							{
								action: 'accept',
								title: i18n.ts.accept,
							},
							{
								action: 'reject',
								title: i18n.ts.reject,
							},
						],
					}];

				case 'followRequestAccepted':
					return [i18n.ts._notification.yourFollowRequestAccepted, {
						body: `${getUserName(data.body.user)} (@${data.body.user.username}${data.body.user.host != null ? '@' + data.body.user.host : ''})`,
						icon: data.body.user.avatarUrl ?? undefined,
						badge: iconUrl('circle-check'),
						data,
					}];

				case 'groupInvited':
					return [i18n.tsx._notification.youWereInvitedToGroup({ userName: getUserName(data.body.user) }), {
						body: data.body.invitation.group.name,
						badge: iconUrl('users'),
						data,
						actions: [
							{
								action: 'accept',
								title: i18n.ts.accept,
							},
							{
								action: 'reject',
								title: i18n.ts.reject,
							},
						],
					}];

				case 'chatRoomInvitationReceived':
					return [i18n.ts._notification.chatRoomInvitationReceived, {
						body: `${data.body.invitation.room.name}\n${getUserName(data.body.invitation.user)} (@${data.body.invitation.user.username}${data.body.invitation.user.host != null ? '@' + data.body.invitation.user.host : ''})`,
						icon: data.body.invitation.user.avatarUrl ?? undefined,
						badge: iconUrl('messages'),
						data,
						actions: [
							{
								action: 'accept',
								title: i18n.ts.accept,
							},
							{
								action: 'reject',
								title: i18n.ts.reject,
							},
							{
								action: 'ignore',
								title: i18n.ts._chat.ignore,
							},
						],
					}];

				case 'achievementEarned':
					return [i18n.ts._notification.achievementEarned, {
						body: i18n.ts._achievements._types[`_${data.body.achievement}`].title,
						badge: iconUrl('medal'),
						data,
						tag: `achievement:${data.body.achievement}`,
					}];

				case 'login':
					return [i18n.ts._notification.login, {
						body: i18n.tsx._notification.loginDescription({ ip: data.body.ip, text: i18n.ts.regenerateLoginToken }),
						badge: iconUrl('login-2'),
						data,
					}];

				case 'exportCompleted': {
					const entityName = {
						antenna: i18n.ts.antennas,
						blocking: i18n.ts.blockedUsers,
						clip: i18n.ts.clips,
						customEmoji: i18n.ts.customEmojis,
						favorite: i18n.ts.favorites,
						following: i18n.ts.following,
						muting: i18n.ts.mutedUsers,
						note: i18n.ts.notes,
						userList: i18n.ts.lists,
					} as const satisfies Record<typeof data.body.exportedEntity, string>;

					return [i18n.tsx._notification.exportOfXCompleted({ x: entityName[data.body.exportedEntity] }), {
						badge: iconUrl('circle-check'),
						data,
					}];
				}

				case 'pollEnded':
					return [i18n.ts._notification.pollEnded, {
						body: data.body.note.text ?? '',
						badge: iconUrl('chart-arrows'),
						data,
					}];

				case 'app':
				case 'hataFeed':
				case 'hataskFlowerReady':
				case 'hataskFlowerBloomed':
				case 'hataskZukanUpdated':
				case 'hataskFestivalBloomed':
				case 'hataskDecorationUnlocked':
				case 'earthquake':
				case 'addedToPrivateChannel':
				case 'removedFromPrivateChannel': {
					// 旗鯖fork: 独自通知はすべて app 通知と同じ header/body/icon/link 形状。
					// 専用 type を追加した際にここへ結線し忘れると composeNotification が null となり、
					// OSには「Hataskey v...」だけの空通知が出るため、同じ分岐でまとめて扱う。
					const rawBody = data.body.body?.trim() ?? '';
					const rawHeader = data.body.header?.trim() ?? '';
					let body = rawBody;
					let header = rawHeader;
					if (data.body.type === 'hataskFlowerReady' || data.body.type === 'hataskFlowerBloomed' || data.body.type === 'hataskZukanUpdated' || data.body.type === 'hataskFestivalBloomed') {
						header = i18n.ts._notification._types[data.body.type];
						body = {
							hataskFlowerReady: i18n.ts._hata._customNotifications.flowerReady,
							hataskFlowerBloomed: i18n.ts._hata._customNotifications.flowerBloomed,
							hataskZukanUpdated: i18n.ts._hata._customNotifications.zukanUpdated,
							hataskFestivalBloomed: i18n.ts._hata._customNotifications.festivalBloomed,
						}[data.body.type];
					} else if (data.body.type === 'hataFeed') {
						body = hataFeedNotificationDisplayBody(rawBody, i18n);
					} else if (data.body.type === 'addedToPrivateChannel' || data.body.type === 'removedFromPrivateChannel') {
						({ body, header } = privateChannelNotificationDisplayCopy(data.body.type, rawHeader, rawBody, i18n));
					}
					const newNotice = i18n.ts._hata._customNotifications.newNotice;
					const title = header || body || newNotice;
					// 旗鯖fork: HataFeed は同じ案件の OS 通知を1つにまとめる。
					// link が無い通知も HataFeed 全体でまとめ、他の独自通知には影響させない。
					const tag = data.body.type === 'hataFeed' ? `hatafeed:${data.body.link ?? 'general'}` : undefined;
					return [title, {
						body: header ? body : '',
						icon: data.body.icon ?? undefined,
						badge: iconUrl('bell'),
						...(tag ? { tag, renotify: true } : {}),
						data,
					}];
				}

				case 'test':
					return [i18n.ts._notification.testNotification, {
						body: i18n.ts._notification.notificationWillBeDisplayedLikeThis,
						badge: iconUrl('bell'),
						data,
					}];

				default:
					return null;
			}
		case 'unreadAntennaNote':
			return [i18n.tsx._notification.unreadAntennaNote({ name: data.body.antenna.name }), {
				body: `${getUserName(data.body.note.user)}: ${data.body.note.text ?? ''}`,
				icon: data.body.note.user.avatarUrl ?? undefined,
				badge: iconUrl('antenna'),
				tag: `antenna:${data.body.antenna.id}`,
				data,
				renotify: true,
			}];
		case 'newChatMessage':
			if (data.body.toRoom != null) {
				return [`${data.body.toRoom.name}`, {
					body: `${getUserName(data.body.fromUser)}: ${data.body.text}`,
					icon: data.body.fromUser.avatarUrl ?? undefined,
					badge: iconUrl('messages'),
					tag: `chat:room:${data.body.toRoomId}`,
					data,
					renotify: true,
				}];
			} else {
				return [`${getUserName(data.body.fromUser)}`, {
					body: `${data.body.text}`,
					icon: data.body.fromUser.avatarUrl ?? undefined,
					badge: iconUrl('messages'),
					tag: `chat:user:${data.body.fromUserId}`,
					data,
					renotify: true,
				}];
			}
		case 'hatadyNotification': {
			const copy = i18n.ts._hata._hatady._push;
			const body = data.body.notificationType === 'follow'
				? copy.follow
				: data.body.notificationType === 'comment' || data.body.notificationType === 'mediaComment' || data.body.notificationType === 'mediaReply'
					? copy.comment
					: data.body.notificationType === 'reaction' || data.body.notificationType === 'mediaReaction'
						? (data.body.reaction ? i18n.tsx._hata._hatady._push.reactionWithEmoji({ reaction: data.body.reaction }) : copy.reaction)
						: data.body.notificationType === 'milestone'
							? i18n.tsx._hata._hatady._push.milestone({ count: String(data.body.value ?? 0) })
							: copy.update;
			return [copy.title, {
				body,
				badge: iconUrl('bell'),
				tag: `hatady:${data.body.id}`,
				data,
			}];
		}
		default:
			return null;
	}
}

export async function createEmptyNotification(): Promise<void> {
	return new Promise<void>(async res => {
		const i18n = await (swLang.i18n ?? swLang.fetchLocale());

		await globalThis.registration.showNotification(
			(new URL(origin)).host,
			{
				body: `Hataskey v${_VERSION_}`,
				silent: true,
				badge: iconUrl('null'),
				tag: 'read_notification',
				actions: [
					{
						action: 'markAllAsRead',
						title: i18n.ts.markAllAsRead,
					},
					{
						action: 'settings',
						title: i18n.ts.notificationSettings,
					},
				],
				data: {},
			},
		);

		setTimeout(async () => {
			try {
				await closeNotificationsByTags(['user_visible_auto_notification']);
			} finally {
				res();
			}
		}, 1000);
	});
}
