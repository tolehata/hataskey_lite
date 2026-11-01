<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<script lang="ts" setup>
import { markRaw, ref } from 'vue';
import MkButton from '@/components/MkButton.vue';
import MkPagination from '@/components/MkPagination.vue';
import MkTime from '@/components/global/MkTime.vue';
import FormLink from '@/components/form/link.vue';
import { i18n } from '@/i18n.js';
import * as os from '@/os.js';
import { copyToClipboard } from '@/utility/copy-to-clipboard.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { Paginator } from '@/utility/paginator.js';

const props = withDefaults(defineProps<{
	motionEnabled?: boolean;
}>(), {
	motionEnabled: true,
});

const isDesktop = ref(window.innerWidth >= 1100);
const webhooks = markRaw(new Paginator('i/webhooks/list', {
	limit: 100,
	noPaging: true,
}));

async function generateToken(): Promise<void> {
	const { dispose } = await os.popupAsyncWithDialog(
		import('@/components/MkTokenGenerateWindow.vue').then(x => x.default),
		{},
		{
			done: async (result) => {
				const { name, permissions } = result;
				const { token } = await misskeyApi('miauth/gen-token', {
					session: null,
					name,
					permission: permissions,
				});
				os.alert({
					type: 'success',
					title: i18n.ts.accessToken,
					text: token,
				}).then(() => copyToClipboard(token));
			},
			closed: () => dispose(),
		},
	);
}
</script>

<template>
<section
	:class="$style.surface"
	:data-motion-enabled="props.motionEnabled ? 'true' : 'false'"
	aria-labelledby="service-connection-title"
	data-settings-surface="service-connection"
	data-settings-search-key="account-connect"
	tabindex="-1"
>
	<header :class="$style.header">
		<h2 id="service-connection-title">{{ i18n.ts._settings.serviceConnection }}</h2>
		<p>{{ i18n.ts._settings.serviceConnectionBanner }}</p>
	</header>

	<section :class="$style.card" aria-labelledby="service-connection-api-title">
		<h3 id="service-connection-api-title"><i class="ti ti-api" aria-hidden="true"></i>{{ i18n.ts._settings.api }}</h3>
		<div :class="$style.actions">
			<MkButton primary rounded :class="$style.actionButton" @click="generateToken">
				<i class="ti ti-key" aria-hidden="true"></i>
				{{ i18n.ts.generateAccessToken }}
			</MkButton>
			<FormLink :class="$style.actionLink" to="/settings/apps">
				<template #icon><i class="ti ti-apps" aria-hidden="true"></i></template>
				{{ i18n.ts.manageAccessTokens }}
			</FormLink>
			<FormLink :class="$style.actionLink" to="/api-console" :behavior="isDesktop ? 'window' : null">
				<template #icon><i class="ti ti-terminal-2" aria-hidden="true"></i></template>
				API console
			</FormLink>
		</div>
	</section>

	<section :class="$style.card" aria-labelledby="service-connection-webhook-title">
		<h3 id="service-connection-webhook-title"><i class="ti ti-webhook" aria-hidden="true"></i>{{ i18n.ts._settings.webhook }}</h3>
		<MkPagination :paginator="webhooks">
			<template #empty>
				<div :class="$style.empty">
					<p>{{ i18n.ts.nothing }}</p>
					<MkButton link primary rounded :class="$style.actionButton" to="/settings/webhook/new">
						<i class="ti ti-plus" aria-hidden="true"></i>
						{{ i18n.ts._webhookSettings.createWebhook }}
					</MkButton>
				</div>
			</template>

			<template #default="{ items }">
				<div :class="$style.webhookList">
					<FormLink
						v-for="webhook in items"
						:key="webhook.id"
						:class="$style.webhookLink"
						:to="`/settings/webhook/edit/${webhook.id}`"
					>
						<template #icon>
							<i v-if="webhook.active === false" class="ti ti-player-pause" aria-hidden="true"></i>
							<i v-else-if="webhook.latestStatus === null" class="ti ti-circle" aria-hidden="true"></i>
							<i v-else-if="[200, 201, 204].includes(webhook.latestStatus)" class="ti ti-check" :style="{ color: 'var(--MI_THEME-success)' }" aria-hidden="true"></i>
							<i v-else class="ti ti-alert-triangle" :style="{ color: 'var(--MI_THEME-error)' }" aria-hidden="true"></i>
						</template>
						{{ webhook.name || webhook.url }}
						<template v-if="webhook.latestSentAt != null" #suffix>
							<MkTime :time="webhook.latestSentAt"/>
						</template>
					</FormLink>
					<div :class="$style.actions">
						<MkButton link primary rounded :class="$style.actionButton" to="/settings/webhook/new">
							<i class="ti ti-plus" aria-hidden="true"></i>
							{{ i18n.ts._webhookSettings.createWebhook }}
						</MkButton>
					</div>
				</div>
			</template>
		</MkPagination>
	</section>
</section>
</template>

<style lang="scss" module>
.surface {
	display: grid;
	gap: 16px;
}

.header {
	display: grid;
	gap: 8px;
	padding: 4px 4px 0;

	> h2,
	> p { margin: 0; }

	> p { color: var(--MI_THEME-fgTransparentWeak); }
}

.card {
	display: grid;
	gap: 16px;
	border: 0;
	border-radius: 18px;
	padding: 18px;
	background: color-mix(in srgb, var(--MI_THEME-panel) 88%, var(--MI_THEME-bg));
	box-shadow: 0 8px 24px color-mix(in srgb, var(--MI_THEME-fg) 6%, transparent);

	> h3 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 1em;
	}

	> h3 > i { color: var(--MI_THEME-accent); }
}

.actions,
.empty {
	display: grid;
	justify-items: center;
	gap: 10px;
}

.empty {
	padding: 12px 0 4px;
	text-align: center;

	> p {
		margin: 0;
		color: var(--MI_THEME-fgTransparentWeak);
	}
}

.actionButton,
.actionLink,
.webhookLink { min-height: 44px; }

.actionButton { min-width: min(100%, 280px); }

.actionLink,
.webhookLink { width: min(100%, 560px); }

.webhookList {
	display: grid;
	gap: 8px;
}

.surface[data-motion-enabled='true'] > * {
	/* 旗鯖fork: ⚠️同上。終状態の transform を残さない。 */
	animation: service-connection-enter 180ms ease-out backwards;
}

@keyframes service-connection-enter {
	from { opacity: 0; transform: translateY(6px); }
	to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
	.surface[data-motion-enabled='true'] > * { animation: none; }
}
</style>
