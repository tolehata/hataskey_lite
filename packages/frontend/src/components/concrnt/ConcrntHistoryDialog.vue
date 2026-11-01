<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<!--
旗鯖fork: CTL の送信履歴。途中で通信が切れた処理の結果確認と、未送信の段階だけの続行を行う。
同じ内容を自動で再送しない（送信済みかもしれない段階は「結果を確認」でしか解消しない）。
-->

<template>
<MkModal ref="modal" :preferType="'dialog'" @click="close()" @closed="emit('closed')" @esc="close()">
	<div :class="['_popup', $style.root]" role="dialog" aria-label="送信履歴" @click.stop>
		<header :class="$style.header">
			<i class="ti ti-history" aria-hidden="true"></i><span>送信履歴</span>
			<button class="_button" :class="$style.close" aria-label="閉じる" @click="close()"><i class="ti ti-x"></i></button>
		</header>
		<div :class="$style.body">
			<p :class="$style.description">途中で通信が切れた処理は結果を確認してください。「未送信の処理を続ける」は、送信していない段階だけを進めます。</p>
			<MkInfo v-if="error" warn role="alert">{{ error }}</MkInfo>
			<p v-if="notice" :class="$style.notice" role="status">{{ notice }}</p>
			<div v-for="operation in concrntState.operations" :key="operation.id" :class="$style.operation" :data-status="operation.status">
				<div :class="$style.operationHead">
					<strong>{{ operationLabels[operation.type] }}</strong>
					<span :class="$style.status">{{ statusLabels[operation.status] }}</span>
					<MkTime :class="$style.time" :time="operation.createdAt"/>
				</div>
				<p v-if="operation.error" :class="$style.operationError">{{ operation.error }}</p>
				<div v-if="operation.status !== 'complete'" :class="$style.actions">
					<MkButton small :disabled="busy" @click="resolve(operation, false)">結果を確認</MkButton>
					<MkButton v-if="retryable(operation)" small primary :disabled="busy" @click="resolve(operation, true)">未送信の処理を続ける</MkButton>
				</div>
			</div>
			<p v-if="!concrntState.operations.length" :class="$style.empty">送信履歴はありません。</p>
		</div>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import { ref, useTemplateRef } from 'vue';
import type { ConcrntOperation } from '@/utility/concrnt/types.js';
import MkModal from '@/components/MkModal.vue';
import MkButton from '@/components/MkButton.vue';
import MkInfo from '@/components/MkInfo.vue';
import { concrntState, runConcrntAction } from '@/utility/concrnt/runtime.js';

const emit = defineEmits<{ closed: [] }>();
const modal = useTemplateRef('modal');
const busy = ref(false);
const error = ref('');
const notice = ref('');
const operationLabels = { post: '投稿', reply: '返信', quote: '引用', reaction: 'リアクション', 'delete-reaction': 'リアクション解除' };
const statusLabels = { prepared: '送信準備済み', complete: '完了', partial: '一部完了', unknown: '結果不明', cancelled: '中断', failed: '送信前に停止' };

function close(): void { modal.value?.close(); }

function retryable(operation: ConcrntOperation): boolean {
	return operation.steps.some(step => step.state === 'prepared') && operation.steps.every(step => step.state === 'prepared' || step.state === 'confirmed');
}

async function resolve(operation: ConcrntOperation, retry: boolean): Promise<void> {
	if (busy.value) return;
	busy.value = true;
	error.value = '';
	notice.value = '';
	try {
		const copy = JSON.parse(JSON.stringify(operation)) as ConcrntOperation;
		const result = await runConcrntAction(client => retry ? client.retryOperation(copy) : client.resolveOperation(copy));
		notice.value = `${operationLabels[operation.type]}：${statusLabels[result.status]}`;
	} catch (failure) {
		error.value = failure instanceof Error ? failure.message : '処理を完了できませんでした。';
	} finally {
		busy.value = false;
	}
}
</script>

<style lang="scss" module>
.root {
	display: flex;
	flex-direction: column;
	width: min(560px, calc(100vw - 24px));
	max-height: calc(100dvh - 48px);
	margin: auto;
	overflow: hidden;
	border-radius: 16px;
}

.header {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 10px 10px 18px;
	border-bottom: 1px solid var(--MI_THEME-divider);
	font-weight: bold;
}

.close {
	width: 40px;
	height: 40px;
	margin-left: auto;
	border-radius: 50%;

	&:hover { background: var(--MI_THEME-buttonHoverBg); }
}

.body {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 14px 18px 18px;
	overflow-y: auto;
	overscroll-behavior: contain;
}

.description,
.notice,
.empty {
	margin: 0;
	font-size: .85em;
	opacity: .75;
}

.empty {
	padding: 20px 0;
	text-align: center;
}

.operation {
	padding: 12px 0;
	border-top: 1px solid var(--MI_THEME-divider);
}

.operationHead {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 4px 10px;
}

.status {
	padding: 1px 8px;
	border-radius: 999px;
	background: var(--MI_THEME-buttonBg);
	font-size: .8em;
}

.operation[data-status='unknown'] .status,
.operation[data-status='partial'] .status {
	background: color-mix(in srgb, var(--MI_THEME-warn) 20%, transparent);
	color: var(--MI_THEME-warn);
}

.time {
	margin-left: auto;
	font-size: .8em;
	opacity: .7;
}

.operationError {
	margin: 6px 0 0;
	font-size: .85em;
}

.actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-top: 8px;
}
</style>
