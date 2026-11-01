<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<HyDialog
	ref="dialog"
	class="tutorial"
	bare
	:title="title"
	:anchorElement="anchorElement"
	:theme="theme"
	@close="requestClose"
	@closed="emit('closed')"
>
	<div class="guide" :data-kind="kind" :data-hatagoes="goesMotion">
		<header class="head">
			<slot name="headerAction"><span></span></slot>
			<h2>{{ title }}</h2>
			<button type="button" class="hy-icon-button" :aria-label="i18n.ts.close" @click="requestClose">
				<i class="ti ti-x" aria-hidden="true"></i>
			</button>
		</header>
		<nav class="steps" :aria-label="copy.guidePages">
			<button
				v-for="(item, number) in pages"
				:key="item.id"
				type="button"
				:aria-label="`${number + 1} ${item.label}`"
				:aria-current="index === number ? 'step' : undefined"
				@click="go(number)"
			>
				{{ number + 1 }}
			</button>
		</nav>
		<div class="mobileStep" :aria-label="copy.guideProgress">
			<span><i :class="page.icon" aria-hidden="true"></i>{{ page.label }}</span><span>{{ index + 1 }} / {{ pages.length }}</span>
		</div>
		<div class="pageHost">
			<section ref="view" class="page" :aria-labelledby="pageTitleId" :data-page="page.id">
				<figure class="preview" :aria-label="page.figure" :data-caption="!!page.caption">
					<div class="previewStage" aria-hidden="true">
						<div class="previewScene"><slot name="example" :page="page"/></div>
					</div>
					<figcaption v-if="page.caption">{{ page.caption }}</figcaption>
				</figure>
				<div class="copy">
					<div class="eyebrow"><i :class="page.icon" aria-hidden="true"></i>{{ page.label }}</div>
					<h3 :id="pageTitleId" ref="heading" tabindex="-1">{{ page.title }}</h3>
					<p>
						<template v-for="(part, number) in phrases(page.description)" :key="number">
							<br v-if="number"/><span class="phrase">{{ part }}</span>
						</template>
					</p>
					<p v-if="page.note" class="note">
						<template v-for="(part, number) in phrases(page.note)" :key="number">
							<br v-if="number"/><span class="phrase">{{ part }}</span>
						</template>
					</p>
				</div>
			</section>
		</div>
		<footer class="actions">
			<button v-if="index" type="button" class="hy-secondary" @click="go(Math.max(0, (pendingIndex ?? index) - 1))">
				<i class="ti ti-arrow-left" aria-hidden="true"></i>{{ copy.back }}
			</button>
			<button v-else type="button" class="hy-secondary" @click="finish(false)">{{ copy.viewLater }}</button>
			<button type="button" class="hy-primary" @click="next">
				{{ index === pages.length - 1 ? finishLabel : copy.next
				}}<i class="ti ti-arrow-right" aria-hidden="true"></i>
			</button>
		</footer>
	</div>
</HyDialog>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onMounted, onUnmounted, ref, useId, useTemplateRef, watch } from 'vue';
import type { HyTutorialPage } from '@/utility/hy-tutorial.js';
import type { HatadyTheme } from '@/utility/hatady-prefs.js';
import { i18n } from '@/i18n.js';
import HyDialog from '@/components/HyDialog.vue';
import { prefer } from '@/preferences.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const copy = i18n.ts._hata._hatady._controls;
const goesMotion = inject(HATA_GOES_HOST, null) != null;

const props = withDefaults(defineProps<{
	kind: 'initial' | 'update';
	pages: readonly HyTutorialPage[];
	title: string;
	finishLabel: string;
	completeOnDismiss?: boolean;
	theme?: HatadyTheme;
	anchorElement?: HTMLElement | null;
	cancelSignal?: AbortSignal;
}>(), { completeOnDismiss: false, theme: undefined, anchorElement: null });
const emit = defineEmits<{ (event: 'done'): void; (event: 'closed'): void; (event: 'closing'): void }>();
const dialog = useTemplateRef('dialog');
const view = useTemplateRef('view');
const heading = useTemplateRef('heading');
const pageTitleId = useId();
const index = ref(0);
const pendingIndex = ref<number | null>(null);
const pages = computed(() => props.pages);
const page = computed(() => pages.value[index.value]);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let closing = false;
let motionVersion = 0;
let animations: Animation[] = [];
let leavingPage: HTMLElement | null = null;
let navigation: Promise<void> | null = null;
let fitFrame = 0;
let observer: ResizeObserver | undefined;

function phrases(value: string): string[] {
	return value.match(/[^、。\n]+[、。]*[」』）】]*|[、。]+/gu) ?? [];
}

function fitPreview(): void {
	fitFrame = 0;
	const current = view.value;
	if (closing || !current) return;
	const scene = current.querySelector<HTMLElement>('.previewScene');
	const stage = current.querySelector<HTMLElement>('.previewStage');
	const preview = current.querySelector<HTMLElement>('.preview');
	const caption = preview?.querySelector('figcaption');
	const explanation = current.querySelector<HTMLElement>('.copy');
	if (!scene || !stage || !preview || !explanation) return;
	const style = getComputedStyle(current);
	const stacked = style.getPropertyValue('--preview-stacked').trim() === '1';
	if (!stacked) preview.style.removeProperty('--preview-height');
	// Layout dimensions stay stable under the page animation.
	const width = scene.offsetWidth,
		height = scene.offsetHeight;
	if (!width || !height || !stage.clientWidth) return;
	const captionHeight = caption ? caption.offsetHeight + (parseFloat(getComputedStyle(preview).rowGap) || 0) : 0;
	const availableHeight = stacked
		? Math.max(0, current.clientHeight - explanation.offsetHeight - (parseFloat(style.rowGap) || 0) - captionHeight)
		: stage.clientHeight;
	const value = String(Math.min(1, stage.clientWidth / width, availableHeight / height));
	if (scene.style.getPropertyValue('--preview-scale') !== value) scene.style.setProperty('--preview-scale', value);
	if (stacked) {
		const previewHeight = `${height * Number(value) + captionHeight}px`;
		if (preview.style.getPropertyValue('--preview-height') !== previewHeight) preview.style.setProperty('--preview-height', previewHeight);
	}
}

function scheduleFit(): void {
	if (closing) return;
	if (fitFrame) cancelAnimationFrame(fitFrame);
	fitFrame = requestAnimationFrame(fitPreview);
}

function clearLayers(): void {
	for (const animation of animations) animation.cancel();
	animations = [];
	leavingPage?.remove();
	leavingPage = null;
}

function cancelMotion(): void {
	motionVersion++;
	pendingIndex.value = null;
	navigation = null;
	clearLayers();
}

function settleLayout(): void {
	cancelMotion();
	scheduleFit();
}

async function navigate(version: number): Promise<void> {
	while (!closing && version === motionVersion && pendingIndex.value !== null) {
		const target = pendingIndex.value;
		pendingIndex.value = null;
		if (target === index.value) continue;
		const direction = target > index.value ? 1 : -1;
		const current = view.value;
		const animate =
			current && typeof current.animate === 'function' && (goesMotion || !reducedMotion.matches && prefer.r.animation.value);
		if (animate) {
			leavingPage = current.cloneNode(true) as HTMLElement;
			leavingPage.removeAttribute('id');
			for (const element of leavingPage.querySelectorAll('[id]')) element.removeAttribute('id');
			leavingPage.setAttribute('data-leaving', '');
			leavingPage.setAttribute('aria-hidden', 'true');
			leavingPage.setAttribute('inert', '');
			current.before(leavingPage);
		}
		index.value = target;
		await nextTick();
		if (closing || version !== motionVersion) return;
		fitPreview();
		heading.value?.focus({ preventScroll: true });
		if (!animate || !leavingPage) continue;
		const distance = goesMotion ? 4 : 12;
		const timing: KeyframeAnimationOptions = { duration: goesMotion ? 160 : 320, easing: 'cubic-bezier(.22,.7,.25,1)', fill: 'both' };
		animations = [
			leavingPage.animate(
				[
					{ opacity: 1, transform: 'translateX(0)' },
					{ opacity: goesMotion ? 0 : 1, transform: `translateX(${-direction * distance}px)` },
				],
				timing,
			),
			current.animate(
				[
					{ opacity: 0, transform: `translateX(${direction * distance}px)` },
					{ opacity: 1, transform: 'translateX(0)' },
				],
				timing,
			),
		];
		const start = animations[0].startTime;
		if (start != null) for (const animation of animations) animation.startTime = start;
		await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
		if (closing || version !== motionVersion) return;
		clearLayers();
	}
}

function go(target: number): void {
	if (closing || target < 0 || target >= pages.value.length || target === (pendingIndex.value ?? index.value)) return;
	pendingIndex.value = target;
	if (navigation) return;
	const task = navigate(++motionVersion);
	navigation = task;
	void task.finally(() => {
		if (navigation === task) navigation = null;
	});
}

function next(): void {
	if (!navigation && index.value === pages.value.length - 1) finish(true);
	else go(Math.min(pages.value.length - 1, (pendingIndex.value ?? index.value) + 1));
}

function requestClose(): void {
	finish(false);
}

function cancelFromOwner(): void {
	if (closing) return;
	closing = true;
	emit('closing');
	cancelMotion();
	// Let MkModal restore focus and release its trap before closed disposes it.
	dialog.value?.close();
}

function finish(completed: boolean): void {
	if (closing) return;
	closing = true;
	emit('closing');
	cancelMotion();
	// Each caller retains its completion contract. Cancellation by the owner never completes a guide.
	if (props.completeOnDismiss || completed) emit('done');
	dialog.value?.close();
}

onMounted(() => {
	props.cancelSignal?.addEventListener('abort', cancelFromOwner);
	if (props.cancelSignal?.aborted) { cancelFromOwner(); return; }
	fitPreview();
	observer = new ResizeObserver(scheduleFit);
	for (const element of [view.value, view.value?.querySelector('.previewScene'), view.value?.querySelector('.copy')]) {
		if (element) observer.observe(element);
	}
	window.addEventListener('resize', settleLayout);
	window.addEventListener('orientationchange', settleLayout);
	window.visualViewport?.addEventListener('resize', settleLayout);
	if (!goesMotion) reducedMotion.addEventListener('change', settleLayout);
	void window.document.fonts?.ready.then(scheduleFit);
	window.document.fonts?.addEventListener('loadingdone', scheduleFit);
});
watch(prefer.r.animation, () => { if (!goesMotion) settleLayout(); });
onUnmounted(() => {
	props.cancelSignal?.removeEventListener('abort', cancelFromOwner);
	closing = true;
	cancelMotion();
	if (fitFrame) cancelAnimationFrame(fitFrame);
	observer?.disconnect();
	window.removeEventListener('resize', settleLayout);
	window.removeEventListener('orientationchange', settleLayout);
	window.visualViewport?.removeEventListener('resize', settleLayout);
	reducedMotion.removeEventListener('change', settleLayout);
	window.document.fonts?.removeEventListener('loadingdone', scheduleFit);
});
</script>

<style scoped lang="scss">
// Keep this guide inside the visible viewport, including mobile safe areas.
// MkModal normally scrolls its content; this caller fits the preview instead.
.tutorial {
	--tutorial-inset: 16px;
}
.tutorial :deep(._modalBg + div) {
	box-sizing: border-box;
	height: var(--MI-viewport-height, 100dvh);
	padding:
		max(var(--tutorial-inset), env(safe-area-inset-top, 0px))
		max(var(--tutorial-inset), env(safe-area-inset-right, 0px))
		max(var(--tutorial-inset), env(safe-area-inset-bottom, 0px))
		max(var(--tutorial-inset), env(safe-area-inset-left, 0px));
	overflow: clip;
	overscroll-behavior: none;
}
.tutorial :deep([role='dialog']) {
	width: min(960px, 100%);
	height: min(700px, 100%);
	max-width: 100%;
	max-height: 100%;
	margin: auto;
	box-sizing: border-box;
}
.guide {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
}
.guide,
.guide * {
	box-sizing: border-box;
}
.head {
	display: grid;
	grid-template-columns: 44px minmax(0, 1fr) 44px;
	align-items: center;
	gap: 8px;
	padding: 14px 20px;
	border-bottom: 1px solid var(--hy-border);
	flex: none;
}
.head h2 {
	margin: 0;
	font-size: 18px;
	text-align: center;
}
.guide[data-kind='update'] .head h2 {
	font-family: 'Hatady Brand', sans-serif;
	font-weight: 400;
	text-wrap: balance;
}
.steps {
	display: flex;
	flex: none;
	justify-content: center;
	width: 100%;
	max-width: 340px;
	margin: 12px auto 0;
}
.steps button {
	display: grid;
	place-items: center;
	position: relative;
	flex: 1;
	min-width: 44px;
	height: 44px;
	padding: 0;
	border: 0;
	border-radius: 999px;
	background: none;
	color: var(--hy-muted);
	font-size: 12px;
	cursor: pointer;
}
.steps button::after {
	content: '';
	position: absolute;
	bottom: 2px;
	width: 5px;
	height: 5px;
	border-radius: 99px;
	background: var(--hy-border);
	transition:
		width 0.2s,
		background 0.2s;
}
.steps button[aria-current='step'] {
	color: var(--hy-accent);
	font-weight: 700;
}
.steps button[aria-current='step']::after {
	width: 24px;
	background: var(--hy-accent);
}
.steps button:focus-visible {
	outline-offset: -3px;
}
.mobileStep {
	display: none;
}
.pageHost {
	flex: 1;
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	grid-template-rows: minmax(0, 1fr);
	overflow: clip;
	padding: 16px 28px 30px;
}
.page {
	--preview-stacked: 0;
	grid-area: 1 / 1;
	position: relative;
	z-index: 1;
	display: grid;
	grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
	grid-template-rows: minmax(0, 1fr);
	align-items: center;
	gap: 34px;
	min-width: 0;
	min-height: 0;
	height: 100%;
	background: var(--hy-surface);
}
.page[data-leaving] {
	z-index: 0;
	pointer-events: none;
	user-select: none;
}
.copy {
	text-align: center;
	min-width: 0;
}
.eyebrow {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	font-size: 12px;
	color: var(--hy-accent);
	margin-bottom: 12px;
}
.eyebrow .ti {
	font-size: 17px;
}
.copy h3 {
	font-size: 25px;
	line-height: 1.55;
	margin: 0 0 18px;
	text-wrap: balance;
	white-space: pre-line;
	outline: none;
}
.copy p {
	margin: 0;
	font-size: 14px;
	line-height: 1.9;
	line-break: strict;
	word-break: normal;
	overflow-wrap: anywhere;
}
.phrase {
	display: inline-block;
	max-width: 100%;
	vertical-align: top;
	text-wrap: pretty;
}
.copy .note {
	margin-top: 18px;
	font-size: 12px;
	color: var(--hy-muted);
}
.preview {
	display: grid;
	grid-template-rows: minmax(0, 1fr) auto;
	gap: 8px;
	align-self: stretch;
	min-height: 0;
	min-width: 0;
	width: 100%;
	max-width: 430px;
	height: 100%;
	margin: 0 auto;
}
.preview[data-caption='false'] {
	grid-template-rows: minmax(0, 1fr);
	gap: 0;
}
.previewStage {
	position: relative;
	min-width: 0;
	min-height: 0;
}
.previewScene {
	position: absolute;
	top: 50%;
	left: 50%;
	width: max(100%, 260px);
	transform: translate(-50%, -50%) scale(var(--preview-scale, 1));
	transform-origin: center;
}
.preview figcaption {
	text-align: center;
	font-size: 11px;
	color: var(--hy-muted);
	margin: 0;
	line-height: 1.4;
}
.actions {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12px;
	flex: none;
	border-top: 1px solid var(--hy-border);
	padding: 16px 20px;
}
.actions button {
	min-width: 126px;
}
@container hy-dialog (max-width: 700px) {
	.pageHost {
		padding: 14px 20px 24px;
	}
	.page {
		--preview-stacked: 1;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto auto;
		align-content: center;
		gap: 12px;
	}
	.preview {
		height: var(--preview-height, auto);
	}
	.copy {
		width: 100%;
		max-width: 500px;
		margin: 0 auto;
	}
	.copy h3 {
		font-size: 23px;
		margin-bottom: 12px;
	}
	.eyebrow {
		margin-bottom: 6px;
	}
	.copy .note {
		margin-top: 12px;
	}
}
@container hy-dialog (max-width: 600px) {
	.head {
		height: 52px;
		padding: 3px 10px;
		gap: 6px;
	}
	.head h2 {
		font-size: 17px;
	}
	.steps {
		display: none;
	}
	.mobileStep {
		height: 28px;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 0 16px;
		font-size: 12px;
		color: var(--hy-muted);
	}
	.mobileStep > span:first-child {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--hy-accent);
	}
	.mobileStep .ti {
		font-size: 15px;
	}
	.pageHost {
		padding: 6px 12px 12px;
	}
	.copy .eyebrow {
		display: none;
	}
	.copy h3 {
		font-size: 18px;
		line-height: 1.4;
		margin-bottom: 8px;
	}
	.copy p {
		font-size: 13px;
		line-height: 1.55;
	}
	.copy .note {
		margin-top: 8px;
		font-size: 12px;
		line-height: 1.5;
	}
	.actions {
		height: 60px;
		padding: 7px 10px;
		gap: 8px;
	}
	.actions button {
		height: 44px;
		min-height: 44px;
		min-width: 88px;
		padding: 8px 12px;
		font-size: 14px;
		gap: 8px;
	}
}
@media (max-width: 600px), (max-height: 600px) {
	.tutorial {
		--tutorial-inset: 8px;
	}
	.tutorial :deep([role='dialog']) {
		height: 100%;
	}
}
@media (max-height: 600px) {
	.head {
		height: 52px;
		padding: 3px 10px;
	}
	.steps {
		display: none;
	}
	.mobileStep {
		height: 28px;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		font-size: 12px;
		color: var(--hy-muted);
	}
	.mobileStep > span:first-child {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--hy-accent);
	}
	.pageHost {
		padding: 6px 12px 12px;
	}
	.copy .eyebrow {
		display: none;
	}
	.copy h3 {
		font-size: 18px;
		line-height: 1.4;
		margin-bottom: 8px;
	}
	.copy p {
		font-size: 13px;
		line-height: 1.55;
	}
	.copy .note {
		margin-top: 8px;
		font-size: 12px;
		line-height: 1.5;
	}
	.actions {
		height: 60px;
		padding: 7px 10px;
		gap: 8px;
	}
	.actions button {
		height: 44px;
		min-height: 44px;
		min-width: 88px;
		padding: 8px 12px;
		font-size: 14px;
	}
}
@media (max-height: 600px) and (min-width: 601px) {
	.page {
		--preview-stacked: 0;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
		gap: 20px;
	}
	.preview {
		height: 100%;
	}
}
@media (max-height: 450px) and (min-width: 480px) {
	.head {
		height: 46px;
		padding: 0 10px;
	}
	.mobileStep {
		height: 24px;
	}
	.actions {
		height: 54px;
		padding: 4px 10px;
	}
	.pageHost {
		padding: 4px 12px 8px;
	}
	.page {
		--preview-stacked: 0;
		grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
		grid-template-rows: minmax(0, 1fr);
		gap: 16px;
	}
	.preview {
		height: 100%;
	}
	.copy h3 {
		font-size: 17px;
		line-height: 1.3;
		margin-bottom: 4px;
	}
	.copy p {
		line-height: 1.4;
	}
	.copy .note {
		margin-top: 4px;
		line-height: 1.35;
	}
	.preview figcaption {
		font-size: 10px;
	}
}
@media (prefers-reduced-motion: reduce) {
	.guide:not([data-hatagoes='true']) .steps button::after {
		transition: none;
	}
}
</style>
