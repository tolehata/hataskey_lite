<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<span v-if="badgeRoles.length > 0" :class="$style.badgeRoles">
	<img v-for="(role, i) in badgeRoles" :key="i" v-tooltip="role.name" :class="$style.badgeRole" :src="role.iconUrl!" :alt="role.name"/>
</span>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type * as Misskey from 'cherrypick-js';

const props = defineProps<{
	user: Pick<Misskey.entities.Note['user'], 'badgeRoles'>;
}>();

const badgeRoles = computed(() => props.user.badgeRoles?.filter(role => role.iconUrl) ?? []);
</script>

<style lang="scss" module>
.badgeRoles {
	margin: 0 .5em 0 0;
}

.badgeRole {
	height: 1.3em;
	vertical-align: -20%;
	border-radius: 0.4em;

	& + .badgeRole {
		margin-left: 0.2em;
	}
}
</style>
