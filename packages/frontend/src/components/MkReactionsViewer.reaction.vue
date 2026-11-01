<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<button
	ref="buttonEl"
	v-ripple="!custom && canToggle"
	type="button"
	:class="custom ? [] : ['_button', $style.root, { [$style.reacted]: myReaction == reaction, [$style.canToggle]: (canToggle || alternative), [$style.small]: prefer.s.reactionsDisplaySize === 'small', [$style.large]: prefer.s.reactionsDisplaySize === 'large' }]"
	@click.stop="onReactionClick"
	@touchstart.stop.passive="onReactionTouchStart"
	@touchmove.passive="onReactionTouchMove"
	@touchend.stop="onReactionTouchEnd"
	@touchcancel.stop="onReactionTouchCancel"
	@contextmenu.prevent.stop="onReactionContextMenu"
	@focus="onReactionFocus"
	@blur="onReactionBlur"
>
	<slot v-if="custom"/>
	<template v-else>
		<MkReactionIcon style="pointer-events: none;" :class="prefer.s.limitWidthOfReaction ? $style.limitWidth : ''" :reaction="reaction" :emojiUrl="reactionEmojis[emojiName]"/>
		<span :class="$style.count">{{ count }}</span>
	</template>
</button>
</template>

<script lang="ts" setup>
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch } from 'vue';
import * as Misskey from 'cherrypick-js';
import { getUnicodeEmojiOrNull } from '@@/js/emojilist.js';
import { getEmojiNameFromReaction, isLocalCustomEmojiReaction } from '@@/js/emoji-name.js';
import MkCustomEmojiDetailedDialog from './MkCustomEmojiDetailedDialog.vue';
import type { MenuItem } from '@/types/menu';
import type { ComputedRef, Ref } from 'vue';
import XDetails from '@/components/MkReactionsViewer.details.vue';
import MkReactionIcon from '@/components/MkReactionIcon.vue';
import * as os from '@/os.js';
import { misskeyApi, misskeyApiGet } from '@/utility/misskey-api.js';
import { useTooltip } from '@/composables/use-tooltip.js';
import { $i } from '@/i.js';
import { fetchMutedUsers, isMutedUser } from '@/utility/muted-users.js';
import { hideMutedReactionsLocal } from '@/utility/hatasaba-device-prefs.js';
import { prefer } from '@/preferences.js';
import MkReactionEffect from '@/components/MkReactionEffect.vue';
import { i18n } from '@/i18n.js';
import * as sound from '@/utility/sound.js';
import { customEmojis, customEmojisMap } from '@/custom-emojis.js';
import { DI } from '@/di.js';
import { noteEvents } from '@/composables/use-note-capture.js';
import { mute as muteEmoji, unmute as unmuteEmoji, checkMuted as isEmojiMuted } from '@/utility/emoji-mute.js';
// 旗鯖fork: 本家 2026.6.0 から取り込み: 絵文字メニューから直接パレット追加
import { addToEmojiPalette } from '@/utility/emoji-palette.js';
import { haptic } from '@/utility/haptic.js';
import { hideReaction, unhideReaction, isReactionHidden } from '@/utility/hidden-reactions.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import { ReactionTouchGesture } from '@/utility/reaction-touch-gesture.js';

const props = withDefaults(defineProps<{
	/** Render the default slot and emit activate; reuse standard tooltips, long press and context menus. */
	custom?: boolean;
	noteId: Misskey.entities.Note['id'];
	reaction: string;
	reactionEmojis: Misskey.entities.Note['reactionEmojis'];
	myReaction: Misskey.entities.Note['myReaction'];
	count: number;
	isInitial: boolean;
	note: Misskey.entities.Note;
	/**
	 * 旗鯖fork(#31): 詳細画面の ⓘ で「ミュートしたぶんも出す」に切り替えているか。
	 * ⚠️true のときは名前の一覧からもミュートを除外しない（除外したままだと、
	 *   チップだけ戻って「誰が押したか」は結局分からず、ⓘ を押した意味が無くなる）。
	 */
	revealMuted?: boolean;
}>(), { custom: false });

const mock = inject(DI.mock, false);

const emit = defineEmits<{
	(ev: 'activate', event: MouseEvent): void;
	(ev: 'reactionToggled', emoji: string, newCount: number): void;
}>();

const buttonEl = useTemplateRef('buttonEl');

const emojiName = computed(() => getEmojiNameFromReaction(props.reaction));

const canToggle = computed(() => {
	const emoji = isLocalCustomEmoji.value ? customEmojisMap.get(emojiName.value) : getUnicodeEmojiOrNull(props.reaction);

	// TODO
	//return !props.reaction.match(/@\w/) && $i && emoji && checkReactionPermissions($i, props.note, emoji);
	return $i != null && emoji != null;
});
const isLocalCustomEmoji = computed(() => isLocalCustomEmojiReaction(props.reaction));

const reactionName = computed(() => {
	const r = props.reaction.replace(':', '');
	return r.slice(0, r.indexOf('@'));
});

const alternative: ComputedRef<string | null> = computed(() => prefer.s.reactableRemoteReactionEnabled ? (customEmojis.value.find(it => it.name === reactionName.value)?.name ?? null) : null);

const canSteal = computed(() => props.note.user.host && $i && ($i.isAdmin || $i.policies.canManageCustomEmojis));

let touchDetailsShowing: Ref<boolean> | null = null;

const reactionTouchGesture = new ReactionTouchGesture({
	showDetails: () => {
		if (mock) return;
		const showing = ref(true);
		touchDetailsShowing = showing;
		haptic();
		void showReactionDetails(showing);
	},
	hideDetails: () => {
		if (touchDetailsShowing != null) touchDetailsShowing.value = false;
		touchDetailsShowing = null;
	},
	showMenu: () => {
		if (buttonEl.value != null) stealReaction(buttonEl.value);
	},
});

function onReactionClick(ev: MouseEvent) {
	if (reactionTouchGesture.consumeSyntheticClick()) {
		ev.preventDefault();
		return;
	}
	if (props.custom) {
		emit('activate', ev);
		return;
	}
	if (canToggle.value || alternative.value) {
		void toggleReaction(ev);
	} else if (ev.currentTarget instanceof HTMLElement) {
		stealReaction(ev.currentTarget);
	}
}

function touchPoint(ev: TouchEvent) {
	const touch = ev.touches.item(0) ?? ev.changedTouches.item(0);
	return touch == null ? null : { x: touch.clientX, y: touch.clientY };
}

function onReactionTouchStart(ev: TouchEvent) {
	const point = touchPoint(ev);
	if (point == null || ev.touches.length !== 1) {
		reactionTouchGesture.cancel();
		return;
	}
	reactionTouchGesture.start(point);
}

function onReactionTouchMove(ev: TouchEvent) {
	const point = touchPoint(ev);
	if (point != null) reactionTouchGesture.move(point);
}

function onReactionTouchEnd() {
	reactionTouchGesture.end();
}

function onReactionTouchCancel() {
	reactionTouchGesture.cancel();
}

function onReactionContextMenu(ev: MouseEvent) {
	if (reactionTouchGesture.shouldBlockContextMenu()) return;
	void menu(ev);
}

async function toggleReaction(ev: MouseEvent) {
	haptic();

	if (!canToggle.value) {
		chooseAlternative(ev);
		return;
	}
	if ($i == null) return;

	const me = $i;

	const oldReaction = props.myReaction;
	if (oldReaction) {
		const confirm = await os.confirm({
			type: 'warning',
			text: oldReaction !== props.reaction ? i18n.ts.changeReactionConfirm : i18n.ts.cancelReactionConfirm,
		});
		if (confirm.canceled) return;

		if (oldReaction !== props.reaction) {
			sound.playMisskeySfx('reaction');
			haptic();
		}

		if (mock) {
			emit('reactionToggled', props.reaction, (props.count - 1));
			return;
		}

		misskeyApi('notes/reactions/delete', {
			noteId: props.noteId,
		}).then(() => {
			noteEvents.emit(`unreacted:${props.noteId}`, {
				userId: me.id,
				reaction: oldReaction,
			});
			if (oldReaction !== props.reaction) {
				misskeyApi('notes/reactions/create', {
					noteId: props.noteId,
					reaction: props.reaction,
				}).then(created => {
					const emoji = customEmojisMap.get(getEmojiNameFromReaction(created.reaction));
					noteEvents.emit(`reacted:${props.noteId}`, {
						userId: me.id,
						reaction: created.reaction,
						emoji: emoji,
					});
				});
			}
		});
	} else {
		if (prefer.s.confirmOnReact) {
			const confirm = await os.confirm({
				type: 'question',
				text: i18n.tsx.reactAreYouSure({ emoji: props.reaction.replace('@.', '') }),
			});

			if (confirm.canceled) return;
		}

		sound.playMisskeySfx('reaction');
		haptic();

		if (mock) {
			emit('reactionToggled', props.reaction, (props.count + 1));
			return;
		}

		misskeyApi('notes/reactions/create', {
			noteId: props.noteId,
			reaction: props.reaction,
		}).then(created => {
			const emoji = customEmojisMap.get(getEmojiNameFromReaction(created.reaction));

			noteEvents.emit(`reacted:${props.noteId}`, {
				userId: me.id,
				reaction: created.reaction,
				emoji: emoji,
			});
		});
		// TODO: 上位コンポーネントでやる
		//if (props.note.text && props.note.text.length > 100 && (Date.now() - new Date(props.note.createdAt).getTime() < 1000 * 3)) {
		//	claimAchievement('reactWithoutRead');
		//}
	}
}

function stealReaction(anchorElement: HTMLElement) {
	haptic();

	let menuItems: MenuItem[] = [];

	menuItems.push({
		type: 'label',
		text: `:${reactionName.value}:`,
	});

	// 旗鯖fork: リアクション非表示/表示。
	// 右クリック(menu関数)側にはあったが、継続長押しで開くこのメニュー
	// (stealReaction)側に入れ忘れていたため、モバイルの長押しでは
	// 「このリアクションを非表示」が出ず絵文字ミュート等しか表示されなかった。
	// 両方のメニューに同じ項目を出すよう揃える。
	{
		const hidden = isReactionHidden(props.noteId, props.reaction);
		menuItems.push({
			text: hidden ? i18n.ts._hata._reactionVisibility.showReaction : i18n.ts._hata._reactionVisibility.hideReaction,
			icon: hidden ? 'ti ti-eye' : 'ti ti-eye-off',
			action: () => {
				if (hidden) {
					unhideReaction(props.noteId, props.reaction);
				} else {
					hideReaction(props.noteId, props.reaction);
				}
			},
		});
	}

	if (isLocalCustomEmoji.value) {
		menuItems.push({
			text: i18n.ts.info,
			icon: 'ti ti-info-circle',
			action: async () => {
				const { dispose } = os.popup(MkCustomEmojiDetailedDialog, {
					emoji: await misskeyApiGet('emoji', {
						name: getEmojiNameFromReaction(props.reaction),
					}),
				}, {
					closed: () => dispose(),
				});
			},
		});
	}

	if (customEmojis.value.find(it => it.name === reactionName.value)?.name) {
		menuItems.push({
			text: i18n.ts.copy,
			icon: 'ti ti-copy',
			action: () => {
				copyToClipboard(`:${reactionName.value}:`);
			},
		});
	}

	if (canSteal.value) {
		menuItems.push({
			text: i18n.ts.import,
			icon: 'ti ti-plus',
			action: async () => {
				await os.apiWithDialog('admin/emoji/steal', {
					name: reactionName.value,
					host: props.note.user.host ?? '',
				});
			},
		}, {
			text: `${i18n.ts.doReaction} (${i18n.ts.import})`,
			icon: 'ti ti-mood-plus',
			action: async () => {
				await os.apiWithDialog('admin/emoji/steal', {
					name: reactionName.value,
					host: props.note.user.host ?? '',
				});

				await misskeyApi('notes/reactions/create', {
					noteId: props.note.id,
					reaction: `:${reactionName.value}:`,
				});
			},
		});
	}

	if (isEmojiMuted(props.reaction).value) {
		menuItems.push({
			text: i18n.ts.emojiUnmute,
			icon: 'ti ti-mood-smile',
			action: () => {
				os.confirm({
					type: 'question',
					title: i18n.tsx.unmuteX({ x: isLocalCustomEmoji.value ? `:${emojiName.value}:` : props.reaction }),
				}).then(({ canceled }) => {
					if (canceled) return;
					unmuteEmoji(props.reaction);
				});
			},
		});
	} else {
		menuItems.push({
			text: i18n.ts.emojiMute,
			icon: 'ti ti-mood-off',
			action: () => {
				os.confirm({
					type: 'question',
					title: i18n.tsx.muteX({ x: isLocalCustomEmoji.value ? `:${emojiName.value}:` : props.reaction }),
				}).then(({ canceled }) => {
					if (canceled) return;
					muteEmoji(props.reaction);
				});
			},
		});
	}

	if (canToggle.value) {
		menuItems.push({
			text: i18n.ts.addToEmojiPalette,
			icon: 'ti ti-palette',
			action: () => {
				addToEmojiPalette(isLocalCustomEmoji.value ? `:${emojiName.value}:` : props.reaction);
			},
		});
	}

	os.popupMenu(menuItems, anchorElement);
}

async function menu(ev) {
	let menuItems: MenuItem[] = [];

	menuItems.push({
		type: 'label',
		text: `:${reactionName.value}:`,
	});

	// リアクション非表示/表示
	const hidden = isReactionHidden(props.noteId, props.reaction);
	menuItems.push({
		text: hidden ? i18n.ts._hata._reactionVisibility.showReaction : i18n.ts._hata._reactionVisibility.hideReaction,
		icon: hidden ? 'ti ti-eye' : 'ti ti-eye-off',
		action: () => {
			if (hidden) {
				unhideReaction(props.noteId, props.reaction);
			} else {
				hideReaction(props.noteId, props.reaction);
			}
		},
	});

	if (isLocalCustomEmoji.value) {
		menuItems.push({
			text: i18n.ts.info,
			icon: 'ti ti-info-circle',
			action: async () => {
				const { dispose } = os.popup(MkCustomEmojiDetailedDialog, {
					emoji: await misskeyApiGet('emoji', {
						name: getEmojiNameFromReaction(props.reaction),
					}),
				}, {
					closed: () => dispose(),
				});
			},
		});
	}

	if (customEmojis.value.find(it => it.name === reactionName.value)?.name) {
		menuItems.push({
			text: i18n.ts.copy,
			icon: 'ti ti-copy',
			action: () => {
				copyToClipboard(`:${reactionName.value}:`);
			},
		});
	}

	if (canSteal.value) {
		menuItems.push({
			text: i18n.ts.import,
			icon: 'ti ti-plus',
			action: async () => {
				await os.apiWithDialog('admin/emoji/steal', {
					name: reactionName.value,
					host: props.note.user.host ?? '',
				});
			},
		}, {
			text: `${i18n.ts.doReaction} (${i18n.ts.import})`,
			icon: 'ti ti-mood-plus',
			action: async () => {
				await os.apiWithDialog('admin/emoji/steal', {
					name: reactionName.value,
					host: props.note.user.host ?? '',
				});

				await misskeyApi('notes/reactions/create', {
					noteId: props.note.id,
					reaction: `:${reactionName.value}:`,
				});
			},
		});
	}

	if (isEmojiMuted(props.reaction).value) {
		menuItems.push({
			text: i18n.ts.emojiUnmute,
			icon: 'ti ti-mood-smile',
			action: () => {
				os.confirm({
					type: 'question',
					title: i18n.tsx.unmuteX({ x: isLocalCustomEmoji.value ? `:${emojiName.value}:` : props.reaction }),
				}).then(({ canceled }) => {
					if (canceled) return;
					unmuteEmoji(props.reaction);
				});
			},
		});
	} else {
		menuItems.push({
			text: i18n.ts.emojiMute,
			icon: 'ti ti-mood-off',
			action: () => {
				os.confirm({
					type: 'question',
					title: i18n.tsx.muteX({ x: isLocalCustomEmoji.value ? `:${emojiName.value}:` : props.reaction }),
				}).then(({ canceled }) => {
					if (canceled) return;
					muteEmoji(props.reaction);
				});
			},
		});
	}

	if (canToggle.value) {
		menuItems.push({
			text: i18n.ts.addToEmojiPalette,
			icon: 'ti ti-palette',
			action: () => {
				addToEmojiPalette(isLocalCustomEmoji.value ? `:${emojiName.value}:` : props.reaction);
			},
		});
	}

	os.popupMenu(menuItems, ev.currentTarget ?? ev.target);
}

function anime() {
	if (props.custom || window.document.hidden || !prefer.s.animation || buttonEl.value == null) return;

	const rect = buttonEl.value.getBoundingClientRect();
	const x = rect.left + 16;
	const y = rect.top + (buttonEl.value.offsetHeight / 2);
	const { dispose } = os.popup(MkReactionEffect, { reaction: props.reaction, x, y }, {
		end: () => dispose(),
	});
}

function chooseAlternative(ev) {
	// メニュー表示にして、モデレーター以上の場合は登録もできるように
	if (!alternative.value) return;
	console.log(alternative.value);
	misskeyApi('notes/reactions/create', {
		noteId: props.noteId,
		reaction: `:${alternative.value}:`,
	});
}

watch(() => props.count, (newCount, oldCount) => {
	if (oldCount < newCount) anime();
});

onMounted(() => {
	if (!props.isInitial) anime();
});

async function loadReactionUsers(count: number, isCurrent: () => boolean): Promise<Misskey.entities.UserLite[] | null> {
	if (!isCurrent()) return null;
	const hideMuted = hideMutedReactionsLocal.value && !props.revealMuted;
	if (hideMuted) {
		await fetchMutedUsers();
		if (!isCurrent()) return null;
	}

	const users: Misskey.entities.UserLite[] = [];
	const seenUsers = new Set<string>();
	const seenCursors = new Set<string>();
	let untilId: string | undefined;
	while (isCurrent() && users.length < Math.min(10, count)) {
		const reactions = await misskeyApi('notes/reactions', {
			noteId: props.noteId,
			type: props.reaction,
			limit: 10,
			...(untilId == null ? {} : { untilId }),
		});
		if (!isCurrent()) return null;
		for (const { user } of reactions) {
			if (seenUsers.has(user.id)) continue;
			seenUsers.add(user.id);
			if (!hideMuted || !isMutedUser(user.id)) users.push(user);
			if (users.length >= 10) break;
		}
		const nextCursor = reactions.at(-1)?.id;
		if (reactions.length < 10 || nextCursor == null || seenCursors.has(nextCursor)) break;
		seenCursors.add(nextCursor);
		untilId = nextCursor;
	}
	return isCurrent() ? users : null;
}

const activeDetailsShowings = new Set<Ref<boolean>>();

async function showReactionDetails(showing: Ref<boolean>) {
	if (!showing.value || buttonEl.value == null) return;
	activeDetailsShowings.add(showing);
	const users = reactive<Misskey.entities.UserLite[]>([]);
	let generation = 0;
	let opened = false;
	const isCurrent = (request: number) => showing.value && buttonEl.value != null && generation === request;

	async function reload() {
		const request = ++generation;
		users.splice(0);
		const count = props.count;
		if (count <= 0) return;
		try {
			const currentUsers = await loadReactionUsers(count, () => isCurrent(request));
			if (currentUsers == null || !isCurrent(request)) return;
			const anchorElement = buttonEl.value;
			if (anchorElement == null) return;
			users.push(...currentUsers);
			if (opened) return;
			const { dispose } = os.popup(XDetails, {
				showing,
				reaction: props.reaction,
				users,
				count: computed(() => props.count),
				anchorElement,
			}, {
				closed: () => dispose(),
			});
			opened = true;
		} catch {
			// Details are optional; a failed request must not reject a tooltip or touch callback.
		}
	}

	const stopCount = watch(() => props.count, () => { void reload(); }, { flush: 'sync' });
	const stopShowing = watch(showing, (value) => {
		if (value) return;
		generation++;
		stopCount();
		stopShowing();
		activeDetailsShowings.delete(showing);
	}, { flush: 'sync' });
	await reload();
}

let focusDetailsShowing: Ref<boolean> | null = null;

function onReactionFocus() {
	if (mock || !buttonEl.value?.matches(':focus-visible')) return;
	onReactionBlur();
	focusDetailsShowing = ref(true);
	void showReactionDetails(focusDetailsShowing);
}

function onReactionBlur() {
	if (focusDetailsShowing != null) focusDetailsShowing.value = false;
	focusDetailsShowing = null;
}

if (!mock) {
	useTooltip(buttonEl, async (showing) => {
		await showReactionDetails(showing);
	}, 100);
}

onBeforeUnmount(() => {
	onReactionBlur();
	if (touchDetailsShowing != null) touchDetailsShowing.value = false;
	for (const showing of activeDetailsShowings) showing.value = false;
	reactionTouchGesture.dispose();
});
</script>

<style lang="scss" module>
.root {
	display: inline-flex;
	height: 38px;
	padding: 0 12px;
	font-size: 1.35em;
	border-radius: 999px;
	align-items: center;
	justify-content: center;

	&.canToggle {
		background: var(--MI_THEME-buttonBg);

		&:hover {
			background: var(--MI_THEME-buttonHoverBg, rgba(0, 0, 0, 0.1));
		}
	}

	&:not(.canToggle) {
		cursor: default;
	}

	&.small {
		height: 30px;
		font-size: 1em;

		> .count {
			font-size: 0.9em;
			line-height: 22px;
		}
	}

	&.large {
		height: 46px;
		font-size: 1.8em;
		padding: 4px 16px;

		> .count {
			font-size: 0.6em;
			line-height: 50px;
			margin: 0 0 0 8px;
		}
	}

	&.reacted, &.reacted:hover {
		background: var(--MI_THEME-accentedBg);
		color: var(--MI_THEME-accent);
		box-shadow: 0 0 0 1px var(--MI_THEME-accent) inset;

		> .count {
			color: var(--MI_THEME-accent);
		}

		> .icon {
			filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
		}
	}
}

.limitWidth {
	max-width: 70px;
	object-fit: contain;
}

.count {
	font-size: 0.9em;
	line-height: 32px;
	margin: 0 0 0 5px;
}

/* 旗鯖fork(ベータ): グラスUI。html.hataGlassUi の時だけ、チップをガラスに溶かし
   myReaction を「枠」でなく「アクセントのグロー」で示す(2a ソフト・グラス)。
   :global() はフラット形式で書く(html.hataGlassUi のみグローバル、.root 等はスコープ維持)。 */
:global(html.hataGlassUi) .root {
	border-radius: 12px;
	transition: background .15s, box-shadow .15s, transform .1s;

	&.canToggle {
		background: color-mix(in srgb, var(--MI_THEME-panel) 55%, transparent);
		box-shadow: 0 1px 2px color-mix(in srgb, var(--MI_THEME-fg) 8%, transparent);

		&:hover {
			background: color-mix(in srgb, var(--MI_THEME-panel) 78%, transparent);
		}
	}

	&.reacted, &.reacted:hover {
		background: color-mix(in srgb, var(--MI_THEME-accent) 14%, transparent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--MI_THEME-accent) 12%, transparent);
		color: var(--MI_THEME-accent);

		> .count { color: var(--MI_THEME-accent); font-weight: 700; }
		> .icon { filter: drop-shadow(0 0 2px color-mix(in srgb, var(--MI_THEME-accent) 40%, transparent)); }
	}
}
</style>
