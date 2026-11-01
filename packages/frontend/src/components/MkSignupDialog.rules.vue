<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<MkRegistrationRules @done="emit('done')" @cancel="emit('cancel')" @update:agreed="emit('update:agreed', $event)"/>
</template>

<script lang="ts" setup>
import MkRegistrationRules from '@/components/MkRegistrationRules.vue';

const emit = defineEmits<{
	(ev: 'done'): void;
	(ev: 'cancel'): void;
	(ev: 'update:agreed', agreed: boolean): void;
}>();
</script>
