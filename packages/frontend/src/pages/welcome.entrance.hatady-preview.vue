<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="welcome-app-block" data-welcome-app-preview>
	<div class="welcome-app-caption">Hatady v2<span>ホームの見本</span></div><div class="welcome-app-frame welcome-hatady hatady-scope" :class="$style.root" :data-hatady-theme="hatadyTheme">
		<header :class="$style.header">
			<button :class="$style.brand" @click="signin">Hatady</button>
			<button :class="[$style.mobileExit, 'hy-icon-button']" type="button" aria-label="Hatadyを終了" title="Hatadyを終了" @click="signin">
				<i class="ti ti-logout-2" aria-hidden="true"></i>
			</button>
			<HyNav preview :class="$style.nav" :modelValue="activeTab" :options="tabs" @update:modelValue="setTab($event)"/>
			<div :class="$style.headerActions">
				<button class="hy-primary" :aria-label="copy.recordActivity" @click="signin">
					<i class="ti ti-plus" aria-hidden="true"></i>
				</button>
				<button class="hy-icon-button" :aria-label="copy.searchAll" @click="signin">
					<i class="ti ti-search" aria-hidden="true"></i>
				</button>
				<button ref="bell" class="hy-icon-button" :aria-label="copy.notifications" @click="signin">
					<i class="ti ti-bell" aria-hidden="true"></i>
					<span v-if="unread" :class="$style.badge">{{ unread > 99 ? '99+' : unread }}</span>
				</button>
				<button class="hy-icon-button" :aria-label="copy.settings" @click="signin">
					<i class="ti ti-settings" aria-hidden="true"></i>
				</button>
			</div>
			<button ref="menu" :class="[$style.mobileMenu, 'hy-secondary']" :aria-label="copy.settings" @click="signin">
				<i class="ti ti-dots" aria-hidden="true"></i>
			</button>
		</header> <main :class="$style.main" data-welcome-hatady-main>
			<HatadyHome
				v-if="activeTab === 'home'"
				:preview="examples"
				:revision="revision"
				:stats="stats"

				@ready="emit('resize')"
			>
				<template #greetingActions>
					<div :class="$style.mobileRecord" data-hatady-home-actions>
						<button class="hy-icon-button" :aria-label="copy.notifications" @click="signin">
							<i class="ti ti-bell" aria-hidden="true"></i>
							<span v-if="unread" :class="$style.badge">{{ unread > 99 ? '99+' : unread }}</span>
						</button>
						<button class="hy-primary" :aria-label="copy.recordActivity" @click="signin">
							<i class="ti ti-plus" aria-hidden="true"></i>
						</button>
					</div>
				</template>
			</HatadyHome>
		</main>
	</div>
</div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import HyNav from '@/components/HyNav.vue';
import HatadyHome from '@/components/HatadyHome.vue';
import { createWelcomeHatadyExamples } from '@/utility/welcome-app-examples.js';
import { i18n } from '@/i18n.js';
import '@/components/hatady-ui.css';
const props = defineProps<{ mode: 'light' | 'dark'; language: 'ja' | 'en' }>();
const emit = defineEmits<{ signin: []; resize: [] }>();
const hatadyTheme = computed(() => props.mode);
const copy = i18n.ts._hata._hatady._home;
const activeTab = 'home', revision = 0, unread = 2, stats = {};
const examples = createWelcomeHatadyExamples();
const tabs = [{ value: 'home', label: 'ホーム', icon: 'ti ti-home' }, { value: 'records', label: '記録', icon: 'ti ti-notebook' }, { value: 'collection', label: 'コレクション', icon: 'ti ti-books' }, { value: 'profile', label: 'プロフィール', icon: 'ti ti-user' }];

function signin() { emit('signin'); }

function setTab(tab: string) { if (tab !== 'home') signin(); }
</script>
<style lang="scss" module>

.root {
	--hy-header-height: 72px;
	display: flex;
	position: relative;
	flex-direction: column;
	height: calc(var(--MI-viewport-height, 100dvh) - var(--MI-stickyTop, 0px));
	min-height: 0;
	background: var(--hy-bg);
	overflow: hidden;
	container: hatady / inline-size;
}
.header {
	display: grid;
	grid-template-columns: minmax(90px, 1fr) auto minmax(180px, 1fr);
	align-items: start;
	position: relative;
	flex: none;
	gap: 16px;
	padding: 10px 24px 8px;
	z-index: 5;
}
.brand {
	justify-self: start;
	margin-top: 5px;
	min-height: 44px;
	padding: 0;
	border: 0;
	background: transparent;
	color: var(--hy-ink);
	font-family: 'Hatady Brand', sans-serif !important;
	font-size: 29px !important;
	cursor: pointer;
}
.nav {
	grid-column: 2;
}
.headerActions {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	gap: 6px;
	padding-top: 6px;
}
.headerActions > button {
	position: relative;
}
.headerActions > :first-child {
	padding: 0;
	width: 44px;
	margin-right: 4px;
	font-size: 23px;
}
.badge {
	position: absolute;
	right: 0;
	top: -3px;
	min-width: 18px;
	border-radius: 999px;
	padding: 0 4px;
	font-size: 11px;
	background: var(--hy-accent);
	color: var(--hy-on-accent);
}
.root .mobileMenu,
.mobileRecord,
.root .mobileExit {
	display: none;
}
.main {
	position: relative;
	flex: 1;
	min-height: 0;
	overflow: auto;
	padding: 0 24px 24px;
	scrollbar-width: none;
	overscroll-behavior: contain;
	scroll-padding-top: 12px;
}
.main::-webkit-scrollbar {
	display: none;
}
.main > :not([data-hy-page-leaf]) {
	max-width: 1280px;
	margin-inline: auto;
}
@container hatady (max-width: 800px) {
	.header {
		grid-template-columns: minmax(0, 1fr) 44px auto minmax(44px, 1fr);
		gap: 10px;
		padding: 6px 14px 8px;
	}
	.headerActions {
		display: none;
	}
	.brand {
		grid-column: 1;
		grid-row: 1;
		font-size: 23px !important;
	}
	.nav {
		grid-column: 3;
		grid-row: 1;
	}
	.root .mobileMenu {
		grid-column: 4;
		grid-row: 1;
		display: grid;
		position: relative;
		place-items: center;
		justify-self: end;
		width: 44px;
		padding: 0;
		margin-top: 6px;
		background: var(--hy-surface);
		border: 1px solid var(--hy-border);
	}
	.root .mobileExit {
		display: inline-grid;
		grid-column: 2;
		grid-row: 1;
		width: 44px;
		padding: 0;
		margin-top: 6px;
		background: var(--hy-surface);
		border: 1px solid var(--hy-border);
	}
	.main {
		padding: 0 14px 20px;
	}
	.mobileRecord {
		display: flex;
		gap: 6px;
	}
	.mobileRecord > button {
		position: relative;
		width: 44px;
		padding: 0;
		background: var(--hy-surface);
		border: 1px solid var(--hy-border);
	}
	.mobileRecord > button:last-child {
		background: var(--hy-accent);
		color: var(--hy-on-accent);
		font-size: 23px;
	}
}
@container hatady (max-width: 600px) {
	.header {
		grid-template-columns: 44px minmax(0, 1fr) 44px;
		gap: 4px 8px;
	}
	.brand {
		grid-column: 1 / -2;
		grid-row: 1;
		margin-top: 0;
	}
	.root .mobileMenu {
		grid-column: 3;
		grid-row: 1;
		margin-top: 0;
	}
	.nav {
		grid-column: 2 / -1;
		grid-row: 2;
		width: 100%;
		min-width: 0;
	}
	.root .mobileExit {
		grid-column: 1;
		grid-row: 2;
		margin-top: 5px;
	}
}
@container hatady (max-width: 380px) {
	.header {
		padding-inline: 10px;
		column-gap: 6px;
	}
}
</style>
