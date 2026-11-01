/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as Misskey from 'cherrypick-js';
import { url } from '@@/js/config.js';
import { shouldCollapsed } from '@@/js/collapsed.js';
import { defineAsyncComponent, nextTick } from 'vue';
import { claimAchievement } from './achievements.js';
import type { Ref, ShallowRef } from 'vue';
import type { MenuItem } from '@/types/menu.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import * as os from '@/os.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import { store } from '@/store.js';
import { miLocalStorage } from '@/local-storage.js';
import { getUserMenu } from '@/utility/get-user-menu.js';
import { clipsCache, favoritedChannelsCache } from '@/cache.js';
import MkRippleEffect from '@/components/MkRippleEffect.vue';
import { isSupportShare } from '@/utility/navigator.js';
import { getAppearNote } from '@/utility/get-appear-note.js';
import { genEmbedCode } from '@/utility/get-embed-code.js';
import { prefer } from '@/preferences.js';
import { getPluginHandlers } from '@/plugin.js';
import { globalEvents } from '@/events.js';
import { addDividersBetweenMenuSections } from '@/utility/add-dividers-between-menu-sections.js';
import { popup } from '@/os.js';
import { openFavoriteFolderPicker, removeFavoriteNote } from '@/utility/favorite-folders.js';
import { requestNoteActionConfirmation } from '@/utility/note-action-confirmation.js';
import { noteCharmDisplay, setNoteCharmDisplay } from '@/utility/hatasaba-device-prefs.js';
import { isNoteCharmMobileDisplay } from '@/utility/note-charm-device.js';

export async function getNoteClipMenu(props: {
	note: Misskey.entities.Note;
	currentClip?: Misskey.entities.Clip | null;
}) {
	function getClipName(clip: Misskey.entities.Clip) {
		if ($i && clip.userId === $i.id && clip.notesCount != null) {
			return `${clip.name} (${clip.notesCount}/${$i.policies.noteEachClipsLimit})`;
		} else {
			return clip.name;
		}
	}

	const appearNote = getAppearNote(props.note) ?? props.note;

	const clips = await clipsCache.fetch();
	const menu: MenuItem[] = [...clips.map(clip => ({
		text: getClipName(clip),
		action: () => {
			os.promiseDialog(
				misskeyApi('clips/add-note', { clipId: clip.id, noteId: appearNote.id }),
				() => {
					claimAchievement('noteClipped1');
					os.toast(i18n.ts._hata._navbarNotice.clipAdded, 'clipped', false, clip.name);
					clipsCache.set(clips.map(c => c.id === clip.id ? { ...c, notesCount: (c.notesCount ?? 0) + 1 } : c));
				},
				async (err) => {
					if (err.id === '734806c4-542c-463a-9311-15c512803965') {
						const confirm = await os.confirm({
							type: 'warning',
							text: i18n.tsx.confirmToUnclipAlreadyClippedNote({ name: clip.name }),
						});
						if (!confirm.canceled) {
							os.apiWithDialog('clips/remove-note', { clipId: clip.id, noteId: appearNote.id }).then(() => {
								clipsCache.set(clips.map(c => {
									if (c.id === clip.id) {
										return {
											...c,
											notesCount: Math.max(0, ((c.notesCount ?? 0) - 1)),
										};
									} else {
										return c;
									}
								}));
							});
						}
					} else if (err.id === 'f0dba960-ff73-4615-8df4-d6ac5d9dc118') {
						os.alert({
							type: 'error',
							text: i18n.ts.clipNoteLimitExceeded,
						});
					} else {
						os.alert({
							type: 'error',
							text: err.message + '\n' + err.id,
						});
					}
				},
			).catch(() => {});
		},
	})), ...(clips.length > 0 ? [{ type: 'divider' as const }] : []), {
		icon: 'ti ti-plus',
		text: i18n.ts.createNew,
		action: async () => {
			const { canceled, result } = await os.form(i18n.ts.createNewClip, {
				name: {
					type: 'string',
					default: null as string | null,
					label: i18n.ts.name,
				},
				description: {
					type: 'string',
					required: false,
					default: null,
					multiline: true,
					label: i18n.ts.description,
				},
				isPublic: {
					type: 'boolean',
					label: i18n.ts.public,
					default: false,
				},
			});
			if (canceled) return;

			const clip = await os.apiWithDialog('clips/create', result);

			clipsCache.delete();

			await os.promiseDialog(misskeyApi('clips/add-note', { clipId: clip.id, noteId: appearNote.id }), () => {
				claimAchievement('noteClipped1');
				os.toast(i18n.ts._hata._navbarNotice.clipAdded, 'clipped', false, clip.name);
			});
		},
	}];

	return menu;
}

export function getAbuseNoteMenu(note: Misskey.entities.Note, text: string): MenuItem {
	return {
		icon: 'ti ti-exclamation-circle',
		text,
		action: async (): Promise<void> => {
			const localUrl = `${url}/notes/${note.id}`;
			const username = '@' + note.user.username;
			const host = note.user.host ? '@' + note.user.host : '';
			let noteInfo = '';
			if (note.url ?? note.uri != null) noteInfo = `Note: ${note.url ?? note.uri}\n`;
			noteInfo += `Local Note: ${localUrl}\n`;
			const { dispose } = await os.popupAsyncWithDialog(import('@/components/MkAbuseReportWindow.vue').then(x => x.default), {
				user: note.user,
				initialComment: `${noteInfo}User: ${username + host}\n-----\n`,
			}, {
				closed: () => dispose(),
			});
		},
	};
}

export function getCopyNoteLinkMenu(note: Misskey.entities.Note, text: string): MenuItem {
	return {
		icon: 'ti ti-link',
		text,
		action: (): void => {
			copyToClipboard(`${url}/notes/${note.id}`, 'link');
		},
	};
}

function getNoteEmbedCodeMenu(note: Misskey.entities.Note, text: string): MenuItem | undefined {
	if (note.url != null || note.uri != null) return undefined;
	if (['specified', 'followers'].includes(note.visibility)) return undefined;

	return {
		icon: 'ti ti-code',
		text,
		action: (): void => {
			genEmbedCode('notes', note.id);
		},
	};
}

export function getNoteMenu(props: {
	note: Misskey.entities.Note;
	collapsed?: Ref<boolean>;
	viewTextSource: Ref<boolean>;
	noNyaize: Ref<boolean>;
	currentClip?: Misskey.entities.Clip | null;
	// 旗鯖fork: 本家 2026.6.0 から取り込み: アンテナのタイムラインから個別のノートを削除できるように
	currentAntenna?: Misskey.entities.Antenna | null;
}) {
	const appearNote = getAppearNote(props.note) ?? props.note;
	const link = appearNote.url ?? appearNote.uri;
	const accountId = $i?.id;
	let deleteInFlight: Promise<void> | undefined;
	let deleteCompleted = false;
	let confirmationPending = false;

	const cleanups = [] as (() => void)[];

	function runDelete(editAfterDelete: boolean): Promise<void> {
		if (deleteInFlight) return deleteInFlight;
		if (deleteCompleted) return Promise.resolve();
		const currentAccount = $i;
		if (!accountId || !currentAccount || currentAccount.id !== accountId || (appearNote.userId !== accountId && !currentAccount.isAdmin && !currentAccount.isModerator)) {
			return Promise.reject(new Error(i18n.ts.error));
		}
		deleteInFlight = (async () => {
			await misskeyApi('notes/delete', { noteId: appearNote.id });
			deleteCompleted = true;
			globalEvents.emit('noteDeleted', appearNote.id);
			if ($i?.id !== accountId) return;
			if (editAfterDelete) {
				void os.post({ initialNote: appearNote, renote: appearNote.renote, reply: appearNote.reply, channel: appearNote.channel });
				// UI3 がホームの投稿欄へ移動する場合も、移動先の通知領域で成功を表示する。
				await nextTick();
				if ($i?.id !== accountId) return;
			}
			os.toast(i18n.ts._hata._navbarNotice.noteDeleted, 'deleted');
			if (Date.now() - new Date(appearNote.createdAt).getTime() < 1000 * 60 && appearNote.userId === accountId) {
				claimAchievement('noteDeletedWithin1min');
			}
		})().finally(() => { deleteInFlight = undefined; });
		return deleteInFlight;
	}

	async function confirmDelete(kind: 'delete' | 'deleteAndEdit', run: () => Promise<void>): Promise<void> {
		if (deleteInFlight || deleteCompleted || confirmationPending || !accountId || $i?.id !== accountId) return;
		if (requestNoteActionConfirmation({ kind, note: appearNote, run })) return;
		confirmationPending = true;
		try {
			const { canceled } = await os.confirm({
				type: 'warning',
				text: kind === 'delete' ? i18n.ts.noteDeleteConfirm : i18n.ts.deleteAndEditConfirm,
			});
			if (canceled) return;
			await run();
		} catch (error) {
			await os.alert({ type: 'error', text: error instanceof Error ? error.message : i18n.ts.error });
		} finally {
			confirmationPending = false;
		}
	}

	function del(): Promise<void> {
		return confirmDelete('delete', () => runDelete(false));
	}

	function delEdit(): Promise<void> {
		return confirmDelete('deleteAndEdit', () => runDelete(true));
	}

	async function edit(): Promise<void> {
		const neverShowInfo = miLocalStorage.getItem('neverShowNoteEditInfo');

		if (neverShowInfo !== 'true') {
			const confirm = await os.actions({
				type: 'warning',
				title: i18n.ts.disableNoteEditConfirm,
				text: i18n.ts.disableNoteEditConfirmWarn,
				actions: [
					{
						value: 'ok' as const,
						text: i18n.ts.disableNoteEditOk,
					},
					{
						value: 'neverShow' as const,
						text: `${i18n.ts.disableNoteEditOk} (${i18n.ts.neverShow})`,
						danger: true,
					},
					{
						value: 'cancel' as const,
						text: i18n.ts.cancel,
						primary: true,
					},
				],
			});

			if (confirm.canceled) return;
			if (confirm.result === 'cancel') return;

			if (confirm.result === 'neverShow') {
				miLocalStorage.setItem('neverShowNoteEditInfo', 'true');
			}
		}

		await os.post({ initialNote: appearNote, renote: appearNote.renote, reply: appearNote.reply, channel: appearNote.channel, updateMode: true });
	}

	function copyEdit(): void {
		os.confirm({
			type: 'info',
			text: i18n.ts.copyAndEditConfirm,
		}).then(({ canceled }) => {
			if (canceled) return;

			os.post({ initialNote: appearNote, renote: appearNote.renote, reply: appearNote.reply, channel: appearNote.channel });
		});
	}

	function toggleFavorite(favorite: boolean): void {
		if (favorite) void openFavoriteFolderPicker(appearNote.id, { mode: 'create' });
		else void removeFavoriteNote(appearNote.id);
	}

	function toggleThreadMute(mute: boolean): void {
		os.apiWithDialog(mute ? 'notes/thread-muting/create' : 'notes/thread-muting/delete', {
			noteId: appearNote.id,
		});
	}

	function copyContent(): void {
		copyToClipboard(appearNote.text, 'content');
	}

	function openInNewTab(): void {
		window.open(`${url}/notes/${appearNote.id}`, '_blank', 'noopener');
	}

	function togglePin(pin: boolean): void {
		os.apiWithDialog(pin ? 'i/pin' : 'i/unpin', {
			noteId: appearNote.id,
		}, undefined, {
			'72dab508-c64d-498f-8740-a8eec1ba385a': {
				text: i18n.ts.pinLimitExceeded,
			},
		});
	}

	async function unclip(): Promise<void> {
		if (!props.currentClip) return;
		os.apiWithDialog('clips/remove-note', { clipId: props.currentClip.id, noteId: appearNote.id });
	}

	// 旗鯖fork: 本家 2026.6.0 から取り込み: アンテナのタイムラインから個別のノートを削除できるように
	async function removeFromAntenna(): Promise<void> {
		if (!props.currentAntenna) return;

		const { canceled } = await os.confirm({
			type: 'warning',
			text: i18n.tsx.removeNoteFromAntennaConfirm({ name: props.currentAntenna.name }),
		});
		if (canceled) return;

		await os.apiWithDialog('antennas/remove-note', { antennaId: props.currentAntenna.id, noteId: appearNote.id });
		globalEvents.emit('noteRemovedFromAntenna', props.currentAntenna.id, appearNote.id);
	}

	async function promote(): Promise<void> {
		const { canceled, result: days } = await os.inputNumber({
			title: i18n.ts.numberOfDays,
		});

		if (canceled || days == null) return;

		os.apiWithDialog('admin/promo/create', {
			noteId: appearNote.id,
			expiresAt: Date.now() + (86400000 * days),
		});
	}

	function share(): void {
		navigator.share({
			title: i18n.tsx.noteOf({ user: appearNote.user.name ?? appearNote.user.username }),
			text: appearNote.text ?? '',
			url: `${url}/notes/${appearNote.id}`,
		});
	}

	function openDetail(): void {
		os.pageWindow(`/notes/${appearNote.id}`);
	}

	function showReactions(): void {
		const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkReactedUsersDialog.vue')), {
			noteId: appearNote.id,
		}, {
			closed: () => dispose(),
		});
	}

	function showRenotes(): void {
		const { dispose } = os.popup(defineAsyncComponent(() => import('@/components/MkRenotedUsersDialog.vue')), {
			noteId: appearNote.id,
		}, {
			closed: () => dispose(),
		});
	}

	function showViewTextSource(): void {
		props.viewTextSource.value = true;
	}

	function noNyaizeText(): void {
		props.noNyaize.value = true;
	}

	function revertNoNyaizeText(): void {
		props.noNyaize.value = false;
	}

	async function unRenoteAll(): Promise<void> {
		const { canceled } = await os.confirm({
			type: 'warning',
			title: i18n.ts.unRenoteAllConfirm,
			text: i18n.ts.unRenoteAllConfirmDescription,
		});
		if (canceled) return;

		await os.apiWithDialog('notes/unrenote', {
			noteId: appearNote.id,
		});
	}

	const menuItems: MenuItem[] = [];

	if ($i) {
		const statePromise = misskeyApi('notes/state', {
			noteId: appearNote.id,
		});

		if (props.currentClip?.userId === $i.id) {
			menuItems.push({
				icon: 'ti ti-backspace',
				text: i18n.ts.unclip,
				danger: true,
				action: unclip,
			}, { type: 'divider' });
		}

		if (isSupportShare()) {
			menuItems.push({
				icon: 'ti ti-share',
				text: i18n.ts.share,
				action: share,
			});
		}

		menuItems.push(getCopyNoteLinkMenu(appearNote, i18n.ts.copyLink), {
			icon: 'ti ti-copy',
			text: i18n.ts.copyContent,
			action: copyContent,
		}, {
			icon: 'ti ti-qrcode',
			text: i18n.ts.getQRCode,
			action: () => {
				const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkQRCode.vue')), {
					qrCode: `${url}/notes/${appearNote.id}`,
				}, {
					closed: () => dispose(),
				});
			},
		}, {
			icon: 'ti ti-external-link',
			text: i18n.ts.openInNewTab,
			action: openInNewTab,
		});

		menuItems.push({ type: 'divider' });

		menuItems.push(statePromise.then(state => state.isFavorited ? {
			type: 'parent' as const,
			icon: 'ti ti-star',
			text: i18n.ts.favorite,
			children: [{
				icon: 'ti ti-folder',
				text: i18n.ts._hata._favoriteFolders.moveNote,
				action: () => { void openFavoriteFolderPicker(appearNote.id, { mode: 'move', folderId: state.favoriteFolderId ?? null }); },
			}, {
				icon: 'ti ti-star-off',
				text: i18n.ts.unfavorite,
				danger: true,
				action: () => toggleFavorite(false),
			}],
		} : {
			icon: 'ti ti-star',
			text: i18n.ts.favorite,
			action: () => toggleFavorite(true),
		}));

		menuItems.push({
			type: 'parent',
			icon: 'ti ti-paperclip',
			text: i18n.ts.clip,
			children: () => getNoteClipMenu(props),
		});

		menuItems.push(statePromise.then(state => state.isMutedThread ? {
			icon: 'ti ti-message-off',
			text: i18n.ts.unmuteThread,
			action: () => toggleThreadMute(false),
		} : {
			icon: 'ti ti-message-off',
			text: i18n.ts.muteThread,
			action: () => toggleThreadMute(true),
		}));

		if (appearNote.userId === $i.id) {
			if (($i.pinnedNoteIds ?? []).includes(appearNote.id)) {
				menuItems.push({
					icon: 'ti ti-pinned-off',
					text: i18n.ts.unpin,
					action: () => togglePin(false),
				});
			} else {
				menuItems.push({
					icon: 'ti ti-pin',
					text: i18n.ts.pin,
					action: () => togglePin(true),
				});
			}
		}

		menuItems.push({
			type: 'parent',
			icon: 'ti ti-note',
			text: i18n.ts.note,
			children: async () => {
				const noteChildMenu = [] as MenuItem[];

				noteChildMenu.push({
					icon: 'ti ti-info-circle',
					text: i18n.ts.details,
					action: openDetail,
				}, {
					icon: 'ti ti-repeat',
					text: i18n.ts.renotesList,
					action: showRenotes,
				}, {
					icon: 'ti ti-icons',
					text: i18n.ts.reactionsList,
					action: showReactions,
				});

				if (link) {
					menuItems.push({
						icon: 'ti ti-link',
						text: i18n.ts.copyRemoteLink,
						action: () => {
							copyToClipboard(link, 'link');
						},
					}, {
						icon: 'ti ti-external-link',
						text: i18n.ts.showOnRemote,
						action: () => {
							window.open(link, '_blank', 'noopener');
						},
					});
				} else {
					const embedMenu = getNoteEmbedCodeMenu(appearNote, i18n.ts.embed);
					if (embedMenu != null) {
						menuItems.push(embedMenu);
					}
				}

				noteChildMenu.push({ type: 'divider' });

				noteChildMenu.push({
					icon: 'ti ti-source-code',
					text: i18n.ts.viewTextSource,
					action: showViewTextSource,
				});

				if (!prefer.s.disableNyaize) {
					if (props.noNyaize.value) {
						noteChildMenu.push({
							icon: 'ti ti-paw-filled',
							text: i18n.ts.revertNoNyaization,
							action: revertNoNyaizeText,
						});
					} else {
						noteChildMenu.push({
							icon: 'ti ti-paw-off',
							text: i18n.ts.noNyaization,
							action: noNyaizeText,
						});
					}
				}

				noteChildMenu.push({ type: 'divider' });

				noteChildMenu.push({
					icon: 'ti ti-repeat-off',
					text: i18n.ts.unRenoteAll,
					action: unRenoteAll,
				});

				if ($i && appearNote.userId === $i.id) {
					noteChildMenu.push({ type: 'divider' });
					noteChildMenu.push({
						icon: 'ti ti-edit-circle',
						text: i18n.ts.copyAndEdit,
						action: copyEdit,
					});
				}

				return noteChildMenu;
			},
		});

		menuItems.push({
			type: 'parent',
			icon: 'ti ti-user',
			text: i18n.ts.user,
			children: async () => {
				const user = appearNote.userId === $i?.id ? $i : await misskeyApi('users/show', { userId: appearNote.userId });
				const { menu, cleanup } = getUserMenu(user);
				cleanups.push(cleanup);
				return menu;
			},
		});

		if (appearNote.userId !== $i.id || props.note.userId !== $i.id) {
			menuItems.push({ type: 'divider' });
			if (appearNote.userId !== $i.id) menuItems.push(getAbuseNoteMenu(appearNote, i18n.ts.reportAbuse));
			if (props.note.userId !== $i.id) menuItems.push(getAbuseNoteMenu(props.note, i18n.ts.reportAbuseRenote));
		}

		if (appearNote.channel && (appearNote.channel.userId === $i.id || $i.isModerator || $i.isAdmin)) {
			menuItems.push({ type: 'divider' });
			menuItems.push({
				type: 'parent',
				icon: 'ti ti-device-tv',
				text: i18n.ts.channel,
				children: async () => {
					const channelChildMenu = [] as MenuItem[];

					const channel = await misskeyApi('channels/show', { channelId: appearNote.channel!.id });

					if (channel.pinnedNoteIds.includes(appearNote.id)) {
						channelChildMenu.push({
							icon: 'ti ti-pinned-off',
							text: i18n.ts.unpin,
							action: () => os.apiWithDialog('channels/update', {
								channelId: appearNote.channel!.id,
								pinnedNoteIds: channel.pinnedNoteIds.filter(id => id !== appearNote.id),
							}),
						});
					} else {
						channelChildMenu.push({
							icon: 'ti ti-pin',
							text: i18n.ts.pin,
							action: () => os.apiWithDialog('channels/update', {
								channelId: appearNote.channel!.id,
								pinnedNoteIds: [...channel.pinnedNoteIds, appearNote.id],
							}),
						});
					}
					return channelChildMenu;
				},
			});
		}

		if (appearNote.userId === $i.id || $i.isModerator || $i.isAdmin) {
			menuItems.push({ type: 'divider' });
			if (appearNote.userId === $i.id) {
				if ($i.policies.canEditNote) {
					menuItems.push({
						icon: 'ti ti-edit',
						text: i18n.ts.edit,
						action: edit,
					});
				}

				menuItems.push({
					icon: 'ti ti-eraser',
					text: i18n.ts.deleteAndEdit,
					action: delEdit,
				});
			}
			// 旗鯖fork: 本家 2026.6.0 から取り込み: アンテナのタイムラインから個別のノートを削除できるように
			if (props.currentAntenna != null) {
				menuItems.push({
					icon: 'ti ti-trash',
					text: i18n.ts.removeFromAntenna,
					danger: true,
					action: removeFromAntenna,
				});
			}
			menuItems.push({
				icon: 'ti ti-trash',
				text: i18n.ts.delete,
				danger: true,
				action: del,
			});
		} else if (props.currentAntenna != null) {
			// 旗鯖fork: 本家 2026.6.0 から取り込み: アンテナのタイムラインから個別のノートを削除できるように
			menuItems.push({ type: 'divider' });
			menuItems.push({
				icon: 'ti ti-trash',
				text: i18n.ts.removeFromAntenna,
				danger: true,
				action: removeFromAntenna,
			});
		}
	} else {
		menuItems.push(getCopyNoteLinkMenu(appearNote, i18n.ts.copyLink), {
			icon: 'ti ti-copy',
			text: i18n.ts.copyContent,
			action: copyContent,
		}, {
			icon: 'ti ti-qrcode',
			text: i18n.ts.getQRCode,
			action: () => {
				const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkQRCode.vue')), {
					qrCode: `${url}/notes/${appearNote.id}`,
				}, {
					closed: () => dispose(),
				});
			},
		}, {
			icon: 'ti ti-external-link',
			text: i18n.ts.openInNewTab,
			action: openInNewTab,
		});

		menuItems.push({
			type: 'parent',
			icon: 'ti ti-note',
			text: i18n.ts.note,
			children: async () => {
				const noteChildMenu = [] as MenuItem[];

				noteChildMenu.push({
					icon: 'ti ti-info-circle',
					text: i18n.ts.details,
					action: openDetail,
				}, {
					icon: 'ti ti-repeat',
					text: i18n.ts.renotesList,
					action: showRenotes,
				}, {
					icon: 'ti ti-icons',
					text: i18n.ts.reactionsList,
					action: showReactions,
				});

				if (link != null) {
					noteChildMenu.push({
						icon: 'ti ti-link',
						text: i18n.ts.copyRemoteLink,
						action: () => {
							copyToClipboard(link, 'link');
						},
					}, {
						icon: 'ti ti-external-link',
						text: i18n.ts.showOnRemote,
						action: () => {
							window.open(link, '_blank', 'noopener');
						},
					});
				} else {
					const embedMenu = getNoteEmbedCodeMenu(appearNote, i18n.ts.embed);
					if (embedMenu != null) {
						noteChildMenu.push(embedMenu);
					}
				}

				noteChildMenu.push({ type: 'divider' });

				noteChildMenu.push({
					icon: 'ti ti-source-code',
					text: i18n.ts.viewTextSource,
					action: showViewTextSource,
				});

				if (props.noNyaize.value) {
					noteChildMenu.push({
						icon: 'ti ti-paw-filled',
						text: i18n.ts.revertNoNyaization,
						action: revertNoNyaizeText,
					});
				} else {
					noteChildMenu.push({
						icon: 'ti ti-paw-off',
						text: i18n.ts.noNyaization,
						action: noNyaizeText,
					});
				}

				return noteChildMenu;
			},
		});
	}

	if (!isNoteCharmMobileDisplay() && noteCharmDisplay.value.show && appearNote.userId !== $i?.id && appearNote.user.noteCharm) {
		const showOthers = !noteCharmDisplay.value.showOthers;
		menuItems.push({ type: 'divider' }, {
			icon: showOthers ? 'ti ti-eye' : 'ti ti-eye-off',
			text: showOthers ? i18n.ts._noteCharm.showOthers : i18n.ts._noteCharm.hideOthers,
			action: () => setNoteCharmDisplay({ showOthers }),
		});
	}

	const noteActions = getPluginHandlers('note_action');
	if (noteActions.length > 0) {
		menuItems.push({ type: 'divider' });

		menuItems.push(...noteActions.map(action => ({
			icon: 'ti ti-plug',
			text: action.title,
			action: () => {
				action.handler(appearNote);
			},
		})));
	}

	if (prefer.s.devMode) {
		menuItems.push({ type: 'divider' }, {
			icon: 'ti ti-hash',
			text: i18n.ts.copyNoteId,
			action: () => {
				copyToClipboard(appearNote.id);
			},
		});
	}

	const cleanup = () => {
		if (_DEV_) console.log('note menu cleanup', cleanups);
		for (const cl of cleanups) {
			cl();
		}
	};

	return {
		menu: menuItems,
		cleanup,
	};
}

type Visibility = (typeof Misskey.noteVisibilities)[number];

function smallerVisibility(a: Visibility, b: Visibility): Visibility {
	if (a === 'specified' || b === 'specified') return 'specified';
	if (a === 'followers' || b === 'followers') return 'followers';
	if (a === 'home' || b === 'home') return 'home';
	// if (a === 'public' || b === 'public')
	return 'public';
}

export function getQuoteMenu(props: {
	note: Misskey.entities.Note,
	mock?: boolean;
}) {
	const menu: MenuItem[] = [];
	const appearNote = getAppearNote(props.note);

	// 旗鯖fork: プライベートチャンネルのノートはチャンネル外へ引用させない
	if (appearNote && (!appearNote.channel || (appearNote.channel.allowRenoteToExternal && !appearNote.channel.isPrivate))) {
		menu.push({
			text: i18n.ts.quote,
			icon: 'ti ti-quote',
			action: () => {
				os.post({
					renote: appearNote,
				});
			},
		});
	}

	if (appearNote && appearNote.channel) {
		menu.push({
			text: i18n.ts.inChannelQuote,
			icon: 'ti ti-device-tv',
			action: () => {
				if (!props.mock) {
					os.post({
						renote: appearNote,
						channel: appearNote.channel,
					});
				}
			},
		});
	}

	return { menu };
}

async function checkRenoted(props: {
	note: Misskey.entities.Note;
	mock?: boolean;
}): Promise<boolean> {
	const appearNote = getAppearNote(props.note) ?? props.note;

	if (!props.mock && $i) {
		const state = await misskeyApi('notes/state', {
			noteId: appearNote.id,
		}) as { isFavorited: boolean; isMutedThread: boolean; isRenoted: boolean };

		if (state.isRenoted) {
			const { canceled } = await os.confirm({
				type: 'warning',
				title: i18n.ts.alreadyRenotedConfirm,
				text: i18n.ts.alreadyRenotedConfirmDescription,
				caption: i18n.ts.alreadyRenotedConfirmCaption,
			});
			if (canceled) return true;
		}
	}
	return false;
}

export async function getRenoteMenu(props: {
	note: Misskey.entities.Note;
	renoteButton: ShallowRef<HTMLElement | null | undefined>;
	mock?: boolean;
}) {
	const appearNote = getAppearNote(props.note) ?? props.note;

	const channelRenoteItems: MenuItem[] = [];
	const normalRenoteItems: MenuItem[] = [];
	const normalExternalChannelRenoteItems: MenuItem[] = [];
	const visibilityRenoteItems: MenuItem[] = [];

	// Add channel renote/quote buttons
	if (appearNote.channel) {
		const channelRenoteButton = {
			text: i18n.ts.inChannelRenote,
			icon: 'ti ti-repeat',
			action: async () => {
				const el = props.renoteButton.value;
				if (el && prefer.s.animation) {
					const rect = el.getBoundingClientRect();
					const x = rect.left + (el.offsetWidth / 2);
					const y = rect.top + (el.offsetHeight / 2);
					const { dispose } = os.popup(MkRippleEffect, { x, y }, {
						end: () => dispose(),
					});
				}

				if (!props.mock) {
					const canceled = await checkRenoted(props);
					if (canceled) return;

					misskeyApi('notes/create', {
						renoteId: appearNote.id,
						channelId: appearNote.channelId,
					}).then((res) => {
						os.toast(i18n.ts.renoted, 'renote');
						globalEvents.emit('notePosted', res.createdNote);
					});
				}
			},
		};
		if (prefer.s.renoteQuoteButtonSeparation) {
			normalRenoteItems.unshift(channelRenoteButton);
		} else {
			channelRenoteItems.push(channelRenoteButton);
		}

		// Add quote button if quote button is not separated
		if (!prefer.s.renoteQuoteButtonSeparation) {
			channelRenoteItems.push({
				text: i18n.ts.inChannelQuote,
				icon: 'ti ti-quote',
				action: async () => {
					if (!props.mock) {
						const canceled = await checkRenoted(props);
						if (canceled) return;

						os.post({
							renote: appearNote,
							channel: appearNote.channel,
						});
					}
				},
			});
		}
	}

	// 旗鯖fork: プライベートチャンネルのノートはチャンネル外へリノートさせない
	if (!appearNote.channel || (appearNote.channel.allowRenoteToExternal && !appearNote.channel.isPrivate)) {
		normalRenoteItems.push({
			text: i18n.ts.renote,
			icon: 'ti ti-repeat',
			action: async () => {
				const el = props.renoteButton.value;
				if (el && prefer.s.animation) {
					const rect = el.getBoundingClientRect();
					const x = rect.left + (el.offsetWidth / 2);
					const y = rect.top + (el.offsetHeight / 2);
					const { dispose } = os.popup(MkRippleEffect, { x, y }, {
						end: () => dispose(),
					});
				}

				const configuredVisibility = prefer.s.rememberNoteVisibility ? store.s.visibility : prefer.s.defaultNoteVisibility;
				const localOnly = prefer.s.rememberNoteVisibility ? store.s.localOnly : prefer.s.defaultNoteLocalOnly;

				let visibility = appearNote.visibility;
				visibility = smallerVisibility(visibility, configuredVisibility);
				if (appearNote.channel?.isSensitive) {
					visibility = smallerVisibility(visibility, 'home');
				}

				if (!props.mock) {
					const canceled = await checkRenoted(props);
					if (canceled) return;

					misskeyApi('notes/create', {
						localOnly,
						visibility,
						renoteId: appearNote.id,
					}).then((res) => {
						os.toast(i18n.ts.renoted, 'renote');
						globalEvents.emit('notePosted', res.createdNote);
					});
				}
			},
		});

		// Add quote button if quote button is not separated
		if (!props.mock && !prefer.s.renoteQuoteButtonSeparation) {
			normalRenoteItems.push({
				text: i18n.ts.quote,
				icon: 'ti ti-quote',
				action: async () => {
					const canceled = await checkRenoted(props);
					if (canceled) return;

					os.post({
						renote: appearNote,
					});
				},
			});
		}

		normalExternalChannelRenoteItems.push({
			type: 'parent',
			icon: 'ti ti-repeat',
			text: appearNote.channel ? i18n.ts.renoteToOtherChannel : i18n.ts.renoteToChannel,
			children: async () => {
				const channels = await favoritedChannelsCache.fetch();
				return channels.filter((channel) => {
					if (!appearNote.channelId) return true;
					return channel.id !== appearNote.channelId;
				}).map((channel) => ({
					text: channel.name,
					action: async () => {
						const el = props.renoteButton.value;
						if (el && prefer.s.animation) {
							const rect = el.getBoundingClientRect();
							const x = rect.left + (el.offsetWidth / 2);
							const y = rect.top + (el.offsetHeight / 2);
							const { dispose } = os.popup(MkRippleEffect, { x, y }, {
								end: () => dispose(),
							});
						}

						if (!props.mock) {
							const canceled = await checkRenoted(props);
							if (canceled) return;

							misskeyApi('notes/create', {
								renoteId: appearNote.id,
								channelId: channel.id,
							}).then((res) => {
								os.toast(i18n.tsx.renotedToX({ name: channel.name }));
								globalEvents.emit('notePosted', res.createdNote);
							});
						}
					},
				}));
			},
		});

		// Add visibility section
		if (prefer.s.renoteVisibilitySelection && !['followers', 'specified'].includes(appearNote.visibility)) {
			const localOnly = prefer.s.rememberNoteVisibility ? (store.s.localOnly ?? false) : prefer.s.defaultNoteLocalOnly;

			// renote to public
			if (appearNote.visibility === 'public') {
				visibilityRenoteItems.push({
					text: `${i18n.ts.renote} (${i18n.ts._visibility.public})`,
					icon: 'ti ti-world',
					action: async () => {
						const canceled = await checkRenoted(props);
						if (canceled) return;

						misskeyApi('notes/create', {
							localOnly,
							visibility: 'public',
							renoteId: appearNote.id,
						}).then(() => {
							os.toast(i18n.ts.renoted, 'renote');
						});
					},
				});
			}

			// renote to home
			if (['home', 'public'].includes(appearNote.visibility)) {
				visibilityRenoteItems.push({
					text: `${i18n.ts.renote} (${i18n.ts._visibility.home})`,
					icon: 'ti ti-home',
					action: async () => {
						const canceled = await checkRenoted(props);
						if (canceled) return;

						misskeyApi('notes/create', {
							localOnly,
							visibility: 'home',
							renoteId: appearNote.id,
						}).then(() => {
							os.toast(i18n.ts.renoted, 'renote');
						});
					},
				});
			}

			// renote to followers
			visibilityRenoteItems.push({
				text: `${i18n.ts.renote} (${i18n.ts._visibility.followers})`,
				icon: 'ti ti-lock',
				action: async () => {
					const canceled = await checkRenoted(props);
					if (canceled) return;

					misskeyApi('notes/create', {
						localOnly,
						visibility: 'followers',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				},
			});
		}
	}

	const renoteItems = addDividersBetweenMenuSections(
		normalRenoteItems,
		channelRenoteItems,
		visibilityRenoteItems,
		normalExternalChannelRenoteItems,
	);

	return {
		menu: renoteItems,
	};
}

export async function getRenoteOnly(props: {
	note: Misskey.entities.Note;
	renoteButton: ShallowRef<HTMLElement | null | undefined>;
	mock?: boolean;
}) {
	const appearNote = getAppearNote(props.note) ?? props.note;

	if (prefer.s.showRenoteConfirmPopup) {
		const { canceled } = await os.confirm({
			type: 'info',
			text: i18n.ts.renoteConfirm,
			caption: i18n.ts.renoteConfirmDescription,
		});
		if (canceled) return;
	}

	const canceled = await checkRenoted(props);
	if (canceled) return;

	if (appearNote.channel) {
		const el = props.renoteButton.value as HTMLElement | null | undefined;
		if (el && prefer.s.animation) {
			const rect = el.getBoundingClientRect();
			const x = rect.left + (el.offsetWidth / 2);
			const y = rect.top + (el.offsetHeight / 2);
			const { dispose } = os.popup(MkRippleEffect, { x, y }, {
				end: () => dispose(),
			});
		}

		if (!props.mock) {
			misskeyApi('notes/create', {
				renoteId: appearNote.id,
				channelId: appearNote.channelId,
			}).then(() => {
				os.toast(i18n.ts.renoted, 'renote');
			});
		}
	}

	// 旗鯖fork: プライベートチャンネルのノートはチャンネル外へリノートさせない
	if (!appearNote.channel || (appearNote.channel.allowRenoteToExternal && !appearNote.channel.isPrivate)) {
		const el = props.renoteButton.value as HTMLElement | null | undefined;
		if (el && prefer.s.animation) {
			const rect = el.getBoundingClientRect();
			const x = rect.left + (el.offsetWidth / 2);
			const y = rect.top + (el.offsetHeight / 2);
			const { dispose } = os.popup(MkRippleEffect, { x, y }, {
				end: () => dispose(),
			});
		}

		const configuredVisibility = prefer.s.rememberNoteVisibility ? store.s.visibility : prefer.s.defaultNoteVisibility;
		const localOnly = prefer.s.rememberNoteVisibility ? (store.s.localOnly ?? false) : prefer.s.defaultNoteLocalOnly;

		let visibility = appearNote.visibility;
		visibility = smallerVisibility(visibility, configuredVisibility);
		if (appearNote.channel?.isSensitive) {
			visibility = smallerVisibility(visibility, 'home');
		}

		if (!props.mock && prefer.s.renoteVisibilitySelection) {
			misskeyApi('notes/create', {
				localOnly,
				visibility,
				renoteId: appearNote.id,
			}).then(() => {
				os.toast(i18n.ts.renoted, 'renote');
			});
		}

		// Add visibility section
		if (
			!prefer.s.renoteVisibilitySelection &&
			appearNote.visibility !== 'specified'
		) {
			if (prefer.s.forceRenoteVisibilitySelection !== 'none') {
				if (appearNote.visibility === 'public' && prefer.s.forceRenoteVisibilitySelection === 'public') { // renote to public
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'public',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				} else if (['home', 'public'].includes(appearNote.visibility) && prefer.s.forceRenoteVisibilitySelection === 'home') { // renote to home
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'home',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				} else if (appearNote.visibility === 'followers' && prefer.s.forceRenoteVisibilitySelection === 'followers') { // renote to followers
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'followers',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				}
			} else {
				if (appearNote.visibility === 'public') { // renote to public
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'public',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				} else if (['home', 'public'].includes(appearNote.visibility)) { // renote to home
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'home',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				} else if (appearNote.visibility === 'followers') { // renote to followers
					misskeyApi('notes/create', {
						localOnly,
						visibility: 'followers',
						renoteId: appearNote.id,
					}).then(() => {
						os.toast(i18n.ts.renoted, 'renote');
					});
				}
			}
		}
	}
}
