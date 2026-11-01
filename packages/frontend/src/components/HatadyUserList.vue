<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(1c): Hatady のフォロー中 / フォロワー一覧(モーダル)。
  各ユーザーをフォロー/解除できる(Hatady 内で完結・要件①)。
-->
<template>
<HyDialog
	ref="dialog"
	:title="activeType === 'followers' ? copy.followers : copy.followingTitle"
	@close="dialog?.close()"
	@closed="emit('closed')"
>
	<HyCapsule v-model="activeType" :options="tabs" :label="copy.connections" @update:modelValue="reload"/>
	<p v-if="error" class="hy-error" role="alert">{{ error }}</p>
	<div class="hatady-scope" :data-hatady-theme="theme" :class="$style.body">
		<div v-if="loading" :class="$style.loading">{{ copy.loading }}</div>
		<div v-else-if="items.length === 0" :class="$style.empty">{{ copy.empty }}</div>
		<div v-else :class="$style.list">
			<div v-for="it in items" :key="it.user.id" :class="$style.row">
				<button :class="$style.who" @click="openProfile(it.user.id)">
					<MkAvatar :class="$style.avatar" :user="it.user"/>
					<div :class="$style.info">
						<MkUserName :class="$style.name" :user="it.user"/>
						<div :class="$style.acct">@{{ it.user.username }}</div>
					</div>
				</button>
				<button
					v-if="!it.isMe"
					:class="[$style.followBtn, it.isFollowing && $style.followingBtn]"
					:disabled="it.busy"
					@click="toggle(it)"
				>
					<i :class="it.isFollowing ? 'ti ti-check' : 'ti ti-user-plus'"></i>
					{{ it.isFollowing ? copy.following : copy.follow }}
				</button>
				<button :class="$style.menuBtn" @click="openRowMenu(it, $event)"><i class="ti ti-dots"></i></button>
			</div>
		</div>
	</div>
</HyDialog>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import HyDialog from '@/components/HyDialog.vue';
import HyCapsule from '@/components/HyCapsule.vue';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { useHataGoesPopupMenu } from '@/utility/hatagoes-popup.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { userPage } from '@/filters/user.js';
import { $i } from '@/i.js';
import { hatadyNotify } from '@/utility/hatady-ui.js';
import { hatadyTheme } from '@/utility/hatady-prefs.js';

const dialogs = useHataGoesDialogs();
const popupMenu = useHataGoesPopupMenu();

const props = defineProps<{ userId?: string | null; type: 'following' | 'followers' }>();
const emit = defineEmits<{ (ev: 'openProfile', userId: string): void; (ev: 'changed'): void; (ev: 'closed'): void }>();
const dialog = ref<any>(null);
const theme = hatadyTheme;
const copy = i18n.ts._hata._hatady._userList;
const copyx = i18n.tsx._hata._hatady._userList;

const items = ref<any[]>([]);
const activeType = ref<string>(props.type),
	error = ref('');
const tabs = [
	{ value: 'following', label: copy.followingTitle, icon: 'ti ti-user-check' },
	{ value: 'followers', label: copy.followers, icon: 'ti ti-users' },
];
const loading = ref(true);

function openRowMenu(it: any, ev: MouseEvent) {
	const items: any[] = [
		{
			text: copy.viewServerProfile,
			icon: 'ti ti-external-link',
			action: () => os.pageWindow(userPage(it.user)),
		},
	];
	// フォロワー一覧では、相手を通知なしでフォロワーから外せる。
	if (activeType.value === 'followers' && (!props.userId || props.userId === $i?.id) && !it.isMe) {
		items.push({
			text: copy.removeFollower,
			icon: 'ti ti-user-minus',
			danger: true,
			action: async () => {
				const { canceled } = await dialogs.confirm({ type: 'warning', text: copy.removeFollowerConfirm });
				if (canceled) return;
				try {
					await misskeyApi('hata/hatady/followers/remove', { userId: it.user.id });
				} catch {
					hatadyNotify(copy.removeFollowerFailed);
					return;
				}
				items_remove(it);
				emit('changed');
			},
		});
	}
	popupMenu(items, (ev.currentTarget ?? ev.target) as HTMLElement);
}

function items_remove(it: any) {
	const idx = items.value.indexOf(it);
	if (idx >= 0) items.value.splice(idx, 1);
}

async function reload() {
	loading.value = true;
	error.value = '';
	try {
		const payload: Record<string, unknown> = { type: activeType.value };
		if (props.userId) payload.userId = props.userId;
		const res = (await misskeyApi('hata/hatady/following/list', payload)) as any[];
		items.value = res.map((r) => ({ ...r, busy: false }));
	} catch {
		error.value = copy.loadFailed;
	} finally {
		loading.value = false;
	}
}

async function toggle(it: any) {
	const uname = it.user.name || it.user.username;
	const { canceled } = await dialogs.confirm({
		type: it.isFollowing ? 'warning' : 'question',
		text: it.isFollowing ? copyx.unfollowConfirm({ name: uname }) : copyx.followConfirm({ name: uname }),
	});
	if (canceled) return;
	it.busy = true;
	try {
		const next = !it.isFollowing;
		await misskeyApi(next ? 'hata/hatady/following/create' : 'hata/hatady/following/delete', { userId: it.user.id });
		it.isFollowing = next;
		emit('changed');
	} catch {
		hatadyNotify(copy.followChangeFailed);
	} finally {
		it.busy = false;
	}
}

function openProfile(userId: string) {
	emit('openProfile', userId);
}

onMounted(reload);
</script>

<style lang="scss" module>
.body {
	background: var(--hy-bg);
	color: var(--hy-body);
	font-family: 'Noto Sans JP', 'Hiragino Sans', system-ui, sans-serif;
	min-height: 100%;
	box-sizing: border-box;
	padding: 10px 12px;
}
.loading,
.empty {
	opacity: 0.7;
	padding: 30px 0;
	text-align: center;
	font-size: 13px;
}
.list {
	display: flex;
	flex-direction: column;
}
.row {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 9px 6px;
	border-bottom: 1px solid var(--hy-border);
}
.row:last-child {
	border-bottom: none;
}
.who {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 10px;
	background: none;
	border: none;
	padding: 0;
	cursor: pointer;
	text-align: left;
}
.avatar {
	width: 40px;
	height: 40px;
	flex-shrink: 0;
}
.info {
	min-width: 0;
}
.name {
	font-family: var(--hy-heading);
	font-weight: 700;
	font-size: 14px;
	color: var(--hy-ink);
}
.acct {
	font-size: 11.5px;
	color: var(--hy-muted);
}
.followBtn {
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
	gap: 4px;
	border-radius: 999px;
	padding: 6px 14px;
	font-size: 12px;
	font-weight: 700;
	font-family: var(--hy-heading);
	cursor: pointer;
	border: 1.5px solid var(--hy-accent);
	background: var(--hy-accent);
	color: #fff;
}
.followingBtn {
	background: transparent;
	color: var(--hy-accent-ink);
}
.followBtn:disabled {
	opacity: 0.6;
}
.menuBtn {
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 30px;
	height: 30px;
	border-radius: 999px;
	background: none;
	border: none;
	color: var(--hy-muted);
	cursor: pointer;
	font-size: 17px;
}
.menuBtn:hover {
	background: var(--hy-chip-bg);
	color: var(--hy-ink);
}

.body {
	padding: 0;
	background: var(--hy-surface);
	min-height: 0;
}
.row {
	padding: 12px 0;
}
.followBtn {
	min-height: 44px;
	border-radius: 999px;
}
.menuBtn {
	min-width: 44px;
	min-height: 44px;
}
.avatar {
	width: 40px;
	height: 40px;
}
</style>
