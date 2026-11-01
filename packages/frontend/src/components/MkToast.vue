<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="!integrated">
	<Transition
		:enterActiveClass="prefer.s.animation ? $style.transition_toast_enterActive : ''"
		:leaveActiveClass="prefer.s.animation ? $style.transition_toast_leaveActive : ''"
		:enterFromClass="prefer.s.animation ? $style.transition_toast_enterFrom : ''"
		:leaveToClass="prefer.s.animation ? $style.transition_toast_leaveTo : ''"
		appear @afterLeave="emit('closed')"
	>
		<div v-if="showing" class="_acrylic" :class="[$style.root, { [$style.reduceBlurEffect]: !prefer.s.useBlurEffect }]" :style="{ zIndex }">
			<div v-if="welcome && $i">
				<MkAvatar :class="$style.avatar" :user="$i" forceOpacity isToastAvatar/>
				<Mfm style="display: inherit; margin: 10px;" :text="message" :plain="true"></Mfm>
			</div>
			<div v-else style="padding: 16px 24px;">
				<i
					v-if="icon"
					:class="
						icon === 'posted' ? 'ti-check' :
						icon === 'reply' ? 'ti-arrow-back-up' :
						icon === 'renote' ? 'ti-repeat' :
						icon === 'quote' ? 'ti-quote' :
						icon === 'edited' ? 'ti ti-pencil' :
						icon === 'clipped' ? 'ti ti-paperclip' :
						icon === 'deleted' ? 'ti ti-trash' :
						icon === 'drafted' ? 'ti ti-pencil-minus' :
						icon === 'scheduled' ? 'ti ti-calendar-time' :
						icon === 'copied' ? 'ti-copy' :
						'ti-check'"
					class="ti"
				></i>
				{{ message }}
			</div>
		</div>
	</Transition>
</div>
</template>

<script lang="ts" setup>
import { inject, onMounted, ref } from 'vue';
import * as os from '@/os.js';
import { prefer } from '@/preferences.js';
import { $i } from '@/i.js';
import { getNotificationPageContext, hataskeyNotificationToastsKey } from '@/utility/hataskey-notification-toast.js';

const props = defineProps<{
	message: string;
	icon?: string;
	welcome?: boolean;
	target?: string;
}>();

const emit = defineEmits<{
	(ev: 'closed'): void;
}>();

const zIndex = os.claimZIndex('high');
const hataskeyToasts = inject(hataskeyNotificationToastsKey, null);
const context = getNotificationPageContext() ?? hataskeyToasts;
const target = context?.surface.value?.target.value ?? context?.target.value;
const integratedWelcome = props.welcome && $i != null && context != null;
const integrated = integratedWelcome || (!props.welcome && context != null && target != null && context.canIntegrateStatus.value);
const showing = ref(true);

onMounted(() => {
	if (integrated && context) {
		if (integratedWelcome && $i) context.enqueueStatus(props.message, performance.now(), $i);
		else if (props.icon === 'edited' || props.icon === 'clipped' || props.icon === 'deleted') context.enqueueNavbarNotice({ kind: 'noteAction', action: props.icon === 'edited' ? 'edit' : props.icon === 'clipped' ? 'clip' : 'delete', message: props.message, target: props.target });
		else context.enqueueNavbarNotice({ kind: 'status', message: props.message, icon: props.icon });
		emit('closed');
		return;
	}
	window.setTimeout(() => {
		showing.value = false;
	}, 4000);
});
</script>

<style lang="scss" module>
.transition_toast_enterActive,
.transition_toast_leaveActive {
	transition: opacity 0.3s, transform 0.3s !important;
}
.transition_toast_enterFrom,
.transition_toast_leaveTo {
	opacity: 0;
	transform: translateY(-100%);
}

.root {
	position: fixed;
	left: 0;
	right: 0;
	top: 50px;
	margin: 16px auto 0;
	min-width: 300px;
	max-width: calc(100% - 32px);
	width: min-content;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
	border-radius: 8px;
	overflow: clip;
	text-align: center;
	pointer-events: none;

	&.reduceBlurEffect {
		background: var(--MI_THEME-panel);
	}

	@media (max-width: 500px) {
		width: 100%;
		top: 0;
	}
}

.avatar {
	position: relative;
	vertical-align: bottom;
	border-radius: 100%;
	width: 48px;
	height: 48px;
	margin-top: 16px;
}
</style>
