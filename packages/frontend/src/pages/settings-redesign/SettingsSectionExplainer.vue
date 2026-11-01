<!-- SPDX-License-Identifier: AGPL-3.0-only -->

<template>
<div ref="root" :class="$style.root" :data-settings-section-explainer="sectionId" :data-motion-enabled="motionEnabled" :data-animation-visible="animationVisible">
	<div :class="$style.content">
		<svg :class="$style.scene" viewBox="0 0 120 68" aria-hidden="true" focusable="false">
			<foreignObject width="120" height="68"><div :class="$style.canvas" :data-settings-explanation-scene="sceneId"><Scene/></div></foreignObject>
		</svg>
		<p :class="$style.caption">{{ caption }}</p>
	</div>
</div>
</template>

<script setup lang="ts">
import { computed, createVNode, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { sectionExplanationCaption, sectionExplanationScenes } from './settings-section-explanations.js';
import type { Component, VNode, VNodeChild } from 'vue';
import type { SettingsBentoSectionId } from './settings-bento-catalog.js';
import type { SettingsExplanationScene } from './settings-section-explanations.js';
import type { HataApp } from '@/utility/hata-app-brand.js';
import HataAppLogo from '@/components/HataAppLogo.vue';
import { i18n } from '@/i18n.js';

const props = defineProps<{ sectionId: SettingsBentoSectionId; motionEnabled: boolean }>();
const root = useTemplateRef<HTMLElement>('root');
const sceneId = computed(() => sectionExplanationScenes[props.sectionId]);
const caption = computed(() => sectionExplanationCaption(props.sectionId));
const intersects = ref(true);
const documentVisible = ref(true);
const animationVisible = computed(() => intersects.value && documentVisible.value);
const animationEnabled = computed(() => props.motionEnabled && animationVisible.value);
const APPS: readonly HataApp[] = ['hatagoes', 'hatask', 'hatady', 'hatafeed'];
let observer: IntersectionObserver | null = null;

function updateDocumentVisibility(): void { documentVisible.value = window.document.visibilityState !== 'hidden'; }

onMounted(() => {
	updateDocumentVisibility();
	window.document.addEventListener('visibilitychange', updateDocumentVisibility);
	if (root.value && typeof IntersectionObserver !== 'undefined') {
		observer = new IntersectionObserver(entries => { intersects.value = entries.some(entry => entry.isIntersecting); });
		observer.observe(root.value);
	}
});
onBeforeUnmount(() => {
	window.document.removeEventListener('visibilitychange', updateDocumentVisibility);
	observer?.disconnect();
});

type SceneStyle = Record<string, string | number | undefined>;
type ShapeProps = Record<string, unknown> & { style?: SceneStyle; className?: string };
const unitless = new Set(['opacity', 'flex', 'flexGrow', 'flexShrink', 'fontWeight', 'lineHeight', 'zIndex', 'order']);

/** Vue's style objects require explicit length units; the mock used numeric pixels. */
function h(tag: string | Component, shapeProps: ShapeProps, ...children: VNodeChild[]): VNode {
	const style: SceneStyle = {};
	const attributes = { ...shapeProps };
	if (shapeProps.className != null) { attributes.class = shapeProps.className; delete attributes.className; }
	for (const [key, value] of Object.entries(shapeProps.style ?? {})) {
		if (key === 'key') { attributes.key = value; continue; }
		style[key] = typeof value === 'number' && !unitless.has(key) && !key.startsWith('--') ? `${value}px` : value;
	}
	const animation = String(style.animation ?? '').split(' ')[0];
	// Reduced motion keeps a readable still image rather than the loop's hidden
	// first frame. Keyframes override these defaults while motion is enabled.
	if (animation === 'hata-section-type' && (style.width == null || style.width === '0%')) style.width = '78%';
	if (animation === 'hata-section-col' && style.width == null) style.width = '14px';
	if (animation === 'hata-section-fold' && style.height == null) style.height = '46px';
	if (animation === 'hata-section-shrink' && style.width == null) style.width = '56px';
	if (animation === 'hata-section-swbg' && style.background == null) style.background = 'var(--MI_THEME-buttonBg)';
	if (animation === 'hata-section-slide' && style.left == null) style.left = '8%';
	if (animation === 'hata-section-finger' && style.right == null) style.right = '12px';
	if (animation === 'hata-section-fadeB') style.opacity = 0;
	attributes.style = style;
	return createVNode(tag, attributes, children.length ? children.flat() : null);
}

class SectionScenes {
	kit() {
		const D = 'cubic-bezier(.22,.9,.24,1)';
		const anim = (n: string, dur = 4, delay = 0, more = '') => `${n} ${dur}s ${D} ${delay}s infinite ${more}`;
		const bar = (w: string, x: SceneStyle = {}) => h('span', { style: { display: 'block', height: 6, width: w, borderRadius: 999, background: 'color-mix(in srgb, var(--MI_THEME-fg) 18%, transparent)', ...x } });
		const dot = (s: number, x: SceneStyle = {}) => h('span', { style: { flex: 'none', width: s, height: s, borderRadius: '50%', background: 'var(--MI_THEME-buttonBg)', ...x } });
		const ic = (c: string, x: SceneStyle = {}) => h('i', { className: 'ti ' + c, style: { fontSize: 20, color: 'var(--MI_THEME-accent)', ...x } });
		const A = (a: string, kid: VNodeChild, x: SceneStyle = {}) => h('span', { style: { display: 'inline-flex', animation: a, ...x } }, kid);
		const C = (kids: VNodeChild[], x: SceneStyle = {}) => h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, ...x } }, ...kids);
		const row = (key: string, s = 1, x: { row?: SceneStyle; dot?: SceneStyle; b1?: SceneStyle } = {}) => h('div', { key, style: { display: 'flex', alignItems: 'center', gap: 6 * s, height: 30 * s, padding: `0 ${10 * s}px`, ...x.row } }, dot(16 * s, x.dot), h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3 * s } }, bar('70%', { height: 6 * s, ...x.b1 }), bar('45%', { height: 6 * s })));
		const sw = (d = 0) => h('span', { style: { position: 'relative', flex: 'none', width: 30, height: 18, borderRadius: 999, animation: anim('hata-section-swbg', 3, d, 'both') } }, h('span', { style: { position: 'absolute', top: 2, left: 2, width: 14, height: 14, borderRadius: '50%', background: 'var(--MI_THEME-fgOnAccent)', boxShadow: '0 1px 2px rgb(0 0 0 / 20%)', animation: anim('hata-section-swk', 3, d, 'both') } }));
		return { anim, bar, dot, ic, A, C, row, sw };
	}
	theme(icon: number, pad: number) {
		const { anim, bar } = this.kit();
		return h('div', { style: { position: 'absolute', inset: 0, animation: anim('hata-section-theme', 5) } },
			h('div', { style: { position: 'absolute', left: pad, top: pad, right: icon + pad * 2, display: 'flex', flexDirection: 'column', gap: pad / 2 } }, bar('90%', { background: 'var(--MI_THEME-fgMuted)' }), bar('60%', { background: 'var(--MI_THEME-fgMuted)' }), bar('75%', { background: 'var(--MI_THEME-fgMuted)' })),
			h('i', { className: 'ti ti-sun', style: { position: 'absolute', right: pad, top: `calc(50% - ${icon / 2}px)`, fontSize: icon, color: 'var(--MI_THEME-accent)', animation: anim('hata-section-fadeA', 5) } }),
			h('i', { className: 'ti ti-moon', style: { position: 'absolute', right: pad, top: `calc(50% - ${icon / 2}px)`, fontSize: icon, color: 'var(--MI_THEME-accent)', animation: anim('hata-section-fadeB', 5) } }));
	}
	compose(inset: number) {
		const { anim, bar, ic } = this.kit();
		const s = inset < 12 ? 0.75 : 1;
		return h('div', { style: { position: 'absolute', inset, borderRadius: 12 * s, background: 'var(--MI_THEME-panel)', boxShadow: '0 0 0 1px var(--MI_THEME-divider) inset', padding: 10 * s, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } },
			bar('0%', { height: 8 * s, background: 'var(--MI_THEME-fg)', opacity: 0.55, animation: anim('hata-section-type', 3.2, 0, 'both') }),
			h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 * s } }, ic('ti-mood-smile', { fontSize: 18 * s, color: 'var(--MI_THEME-fgMuted)' }), ic('ti-hash', { fontSize: 18 * s, color: 'var(--MI_THEME-fgMuted)' }),
				h('span', { style: { marginLeft: 'auto', width: 30 * s, height: 22 * s, borderRadius: 999, background: 'var(--MI_THEME-accent)', display: 'grid', placeItems: 'center', animation: anim('hata-section-send', 3.2) } }, h('i', { className: 'ti ti-send', style: { fontSize: 13 * s, color: 'var(--MI_THEME-fgOnAccent)' } }))));
	}
	muteRows(s: number) {
		const { anim, bar, dot, ic, row } = this.kit();
		return h('div', { style: { position: 'absolute', inset: `${(s < 1 ? 4 : 14)}px 0 0` } }, row('a', s),
			h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 * s, height: 30 * s, padding: `0 ${10 * s}px` } }, dot(16 * s),
				h('div', { style: { flex: 1, display: 'flex', alignItems: 'center', gap: 5 * s } }, bar('30%', { height: 6 * s }), bar('34%', { height: 6 * s, background: 'var(--MI_THEME-accent)', animation: anim('hata-section-blur') })),
				h('span', { style: { display: 'inline-flex', animation: anim('hata-section-pop') } }, ic('ti-eye-off', { fontSize: 18 * s }))),
			row('b', s));
	}
	upload(cloud: number, file: number) {
		const { anim, ic, C } = this.kit();
		const cloudIcon = ic('ti-cloud', { fontSize: cloud, color: 'var(--MI_THEME-fgMuted)' });
		const fileIcon = h('span', { style: { position: 'absolute', left: `calc(50% - ${file / 2}px)`, top: cloud + 8, animation: anim('hata-section-up', 2.6) } }, ic('ti-photo', { fontSize: file }));
		return C([cloudIcon, fileIcon], { alignItems: 'flex-start', paddingTop: cloud > 30 ? 10 : 4 });
	}
	sliders(n: number, inset: string) {
		return h('div', { style: { position: 'absolute', inset, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' } },
			...Array.from({ length: n }, (_, i) => h('div', { key: i, style: { position: 'relative', height: 14 } },
				h('span', { style: { position: 'absolute', left: 0, right: 0, top: 5, height: 4, borderRadius: 999, background: 'color-mix(in srgb, var(--MI_THEME-fg) 15%, transparent)' } }),
				h('span', { style: { position: 'absolute', top: 0, width: 14, height: 14, borderRadius: '50%', background: 'var(--MI_THEME-accent)', boxShadow: '0 1px 3px rgb(0 0 0 / 20%)', animation: `hata-section-slide 3.6s ease-in-out ${i * 0.5}s infinite` } }))));
	}
	section(key: SettingsExplanationScene): VNode {
		const { anim, bar, dot, ic, A, C, row, sw } = this.kit();
		switch (key) {
			case 'profile': {
				const avatar = h('span', { style: { position: 'relative', display: 'inline-flex' } }, dot(32, { background: 'var(--MI_THEME-accentedBg)' }), h('span', { style: { position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid var(--MI_THEME-accent)', animation: anim('hata-section-pop', 3) } }));
				const name = h('div', { style: { display: 'flex', flexDirection: 'column', gap: 5, width: 46 } }, bar('0%', { background: 'var(--MI_THEME-fg)', opacity: 0.5, animation: anim('hata-section-type', 3, 0, 'both') }), bar('70%'));
				return C([avatar, name]);
			}
			case 'lock': return C([A(anim('hata-section-pop', 3, 0.3), ic('ti-lock', { fontSize: 24 })), sw()]);
			case 'login': return C([ic('ti-key', { fontSize: 20, color: 'var(--MI_THEME-fgMuted)' }), h('span', { style: { display: 'flex', gap: 3 } }, ...[0, 1, 2, 3].map(i => A(anim('hata-section-pop', 3, i * 0.15), dot(7, { background: 'var(--MI_THEME-fg)' }), { key: i }))), A(anim('hata-section-pop', 3, 0.8), ic('ti-shield-check', { fontSize: 20 }))], { gap: 8 });
			case 'swap': return C([dot(30, { background: 'var(--MI_THEME-accent)', animation: anim('hata-section-swapA', 3.2) }), dot(30, { background: 'var(--MI_THEME-buttonBg)', animation: anim('hata-section-swapB', 3.2) })]);
			case 'theme': return this.theme(20, 10);
			case 'font': return C([h('span', { style: { display: 'inline-block', fontSize: 28, fontWeight: 800, color: 'var(--MI_THEME-fg)', animation: anim('hata-section-scale', 3) } }, 'Aa')]);
			case 'layout': return h('div', { style: { position: 'absolute', inset: 10, display: 'flex', gap: 4 } }, h('span', { style: { flex: 'none', borderRadius: 6, background: 'var(--MI_THEME-accentedBg)', animation: anim('hata-section-col', 3.6, 0, 'both') } }), h('span', { style: { flex: 1, borderRadius: 6, background: 'var(--MI_THEME-panel)', boxShadow: 'inset 0 0 0 1px var(--MI_THEME-divider)' } }));
			case 'effects': return C(['ti-sparkles', 'ti-cloud-rain', 'ti-leaf'].map((c, i) => A(anim('hata-section-pop', 3, i * 0.25), ic(c), { key: c })));
			case 'feed': return h('div', { style: { position: 'absolute', inset: '4px 0 0', '--ex-row': '-22px', animation: anim('hata-section-feed', 3) } }, row('n', 0.72, { dot: { background: 'var(--MI_THEME-accent)' }, row: { animation: anim('hata-section-newrow', 3), background: 'var(--MI_THEME-accentedBg)' } }), row('a', 0.72), row('b', 0.72));
			case 'fold': return h('div', { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' } },
				h('div', { style: { flex: 1, overflow: 'hidden', borderRadius: 8, background: 'var(--MI_THEME-panel)', boxShadow: '0 0 0 1px var(--MI_THEME-divider) inset', padding: 7, display: 'flex', flexDirection: 'column', gap: 5, animation: anim('hata-section-fold', 3.4, 0, 'both') } }, bar('80%'), bar('65%'), bar('72%'), bar('40%')),
				A(anim('hata-section-flip', 3.4), ic('ti-chevron-up', { fontSize: 16 })));
			case 'reactions': return C(['ti-heart', 'ti-star', 'ti-mood-smile'].map((c, i) => A(anim('hata-section-pop', 3, i * 0.2), h('span', { style: { display: 'flex', alignItems: 'center', gap: 2, padding: '3px 6px', borderRadius: 999, background: i ? 'var(--MI_THEME-panel)' : 'var(--MI_THEME-accentedBg)', boxShadow: '0 0 0 1px var(--MI_THEME-divider) inset', fontSize: 10, fontWeight: 800, color: 'var(--MI_THEME-fg)' } }, ic(c, { fontSize: 13 }), String(3 - i)), { key: c })), { gap: 4 });
			case 'deck': return h('div', { style: { position: 'absolute', inset: 8, display: 'flex', gap: 4 } }, ...[0, 1, 2].map(i => h('span', { key: i, style: { flex: 1, borderRadius: 6, background: i === 1 ? 'var(--MI_THEME-accentedBg)' : 'var(--MI_THEME-panel)', boxShadow: '0 0 0 1px var(--MI_THEME-divider) inset', animation: anim('hata-section-rise', 3.6, i * 0.18, 'both') } })));
			case 'compose': return this.compose(8);
			case 'emoji': return h('div', { style: { position: 'absolute', inset: 8, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 2 } }, ...['ti-mood-smile', 'ti-heart', 'ti-star', 'ti-flame', 'ti-confetti', 'ti-thumb-up', 'ti-moon', 'ti-coffee'].map((c, i) =>
				h('span', { key: c, style: { display: 'grid', placeItems: 'center', borderRadius: 6, animation: `hata-section-hl 4s linear ${i * 0.5}s infinite` } }, ic(c, { fontSize: 15, color: 'var(--MI_THEME-fg)' }))));
			case 'bell': return C([h('span', { style: { position: 'relative', display: 'inline-block', transformOrigin: '50% 10%', animation: anim('hata-section-shake', 3) } }, ic('ti-bell', { fontSize: 28 }),
				h('span', { style: { position: 'absolute', top: -2, right: -5, width: 12, height: 12, borderRadius: 999, background: 'var(--MI_THEME-fg)', animation: anim('hata-section-pop', 3) } })), ic('ti-mail', { fontSize: 20, color: 'var(--MI_THEME-fgMuted)' })]);
			case 'sound': return C([ic('ti-volume', { fontSize: 24 }), h('span', { style: { display: 'flex', alignItems: 'center', gap: 3, height: 26 } }, ...[0, 1, 2, 3].map(i => h('span', { key: i, style: { width: 4, height: 6, borderRadius: 999, background: 'var(--MI_THEME-accent)', animation: `hata-section-eq 0.9s ease-in-out ${i * 0.15}s infinite` } })))]);
			case 'mute': return this.muteRows(0.72);
			case 'block': return C([h('span', { style: { position: 'relative', display: 'inline-flex' } }, dot(32), h('span', { style: { position: 'absolute', right: -8, bottom: -6, display: 'inline-flex', animation: anim('hata-section-pop', 3) } }, h('span', { style: { width: 22, height: 22, borderRadius: 999, background: 'var(--MI_THEME-accent)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 2px var(--MI_THEME-bg)' } }, h('i', { className: 'ti ti-ban', style: { fontSize: 14, color: 'var(--MI_THEME-fgOnAccent)' } }))))]);
			case 'upload': return this.upload(28, 18);
			case 'apps': return C(APPS.map((a, i) => A(anim('hata-section-pop', 4, i * 0.2), h(HataAppLogo, { app: a, size: 22, active: animationEnabled.value }), { key: a })), { gap: 5 });
			case 'mascot': return C([A(anim('hata-section-scale', 3), ic('ti-mood-smile', { fontSize: 24 })), h('span', { style: { display: 'inline-block', transformOrigin: '50% 50%', animation: anim('hata-section-shake', 2.4) } }, ic('ti-wave-sine', { fontSize: 24, color: 'var(--MI_THEME-fg)' }))], { gap: 14 });
			case 'backup': return C([A(anim('hata-section-down', 2.4), ic('ti-arrow-down', { fontSize: 16, color: 'var(--MI_THEME-fgMuted)' })), h('span', { style: { width: 36, height: 36, borderRadius: 12, background: 'var(--MI_THEME-accentedBg)', display: 'grid', placeItems: 'center' } }, ic('ti-settings', { fontSize: 20, color: 'var(--MI_THEME-accent)' })), A(anim('hata-section-up', 2.4, 1.2), ic('ti-arrow-up', { fontSize: 16 }))]);
			case 'export': {
				const rows = h('span', { style: { display: 'flex', flexDirection: 'column', gap: 3, width: 32 } }, ...[0, 1, 2].map(i => h('span', { key: i, style: { display: 'block', animation: anim('hata-section-shrink', 3, i * 0.2, 'both') } }, bar('100%', { width: 'auto' }))));
				const arrow = ic('ti-arrow-right', { fontSize: 14, color: 'var(--MI_THEME-fgMuted)' });
				const box = h('span', { style: { width: 36, height: 36, borderRadius: 12, background: 'var(--MI_THEME-accentedBg)', display: 'grid', placeItems: 'center' } }, ic('ti-package', { fontSize: 20, color: 'var(--MI_THEME-accent)' }));
				return C([rows, arrow, box], { gap: 6 });
			}
			case 'link': return C([dot(22, { background: 'var(--MI_THEME-accent)' }), h('span', { style: { position: 'relative', width: 40, height: 8 } }, h('span', { style: { position: 'absolute', left: 0, right: 0, top: 3, height: 2, background: 'var(--MI_THEME-divider)' } }), h('span', { style: { position: 'absolute', top: 0, width: 8, height: 8, borderRadius: '50%', background: 'var(--MI_THEME-accent)', animation: 'hata-section-travel 1.6s ease-in-out infinite' } })), dot(22, { background: 'var(--MI_THEME-buttonBg)' })], { gap: 4 });
			case 'sliders': return this.sliders(2, '14px 16px');
			case 'extend': return C([A(anim('hata-section-pop', 3), ic('ti-puzzle', { fontSize: 24 })), A(anim('hata-section-pop', 3, 0.3), h('span', { style: { fontSize: 18, fontWeight: 800, color: 'var(--MI_THEME-fg)', fontFamily: 'ui-monospace, monospace' } }, '{ }'))]);
			case 'clean': return C([h('span', { style: { display: 'flex', flexDirection: 'column', gap: 3, width: 56 } }, ...[0, 1, 2].map(i => h('span', { key: i, style: { display: 'block', height: 6, borderRadius: 999, background: 'color-mix(in srgb, var(--MI_THEME-fg) 18%, transparent)', animation: anim('hata-section-shrink', 3, i * 0.15, 'both') } }))), ic('ti-trash', { fontSize: 22 })], { gap: 8 });
			case 'card': return h('div', { style: { position: 'absolute', inset: 8, display: 'flex', flexDirection: 'column', gap: 4 } }, ...[0, 1, 2].map(i => h('span', { key: i, style: { display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 6, background: 'var(--MI_THEME-panel)', boxShadow: '0 0 0 1px var(--MI_THEME-divider) inset', animation: anim('hata-section-rise', 3.6, i * 0.2, 'both') } }, bar('30%', { height: 5 }), bar('50%', { height: 5, background: 'var(--MI_THEME-accent)', opacity: 0.6 }))));
			case 'dm': return h('div', { style: { position: 'absolute', inset: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 } },
				A(anim('hata-section-pop', 3), h('span', { style: { display: 'block', width: 56, height: 16, borderRadius: '10px 10px 10px 3px', background: 'var(--MI_THEME-panel)', boxShadow: '0 0 0 1px var(--MI_THEME-divider) inset' } }), { alignSelf: 'flex-start', transformOrigin: 'left center' }),
				A(anim('hata-section-pop', 3, 0.5), h('span', { style: { display: 'block', width: 44, height: 16, borderRadius: '10px 10px 3px 10px', background: 'var(--MI_THEME-accent)' } }), { alignSelf: 'flex-end', transformOrigin: 'right center' }));
			case 'shield': return C([h('span', { style: { position: 'relative', display: 'inline-flex' } }, ic('ti-shield', { fontSize: 34, color: 'var(--MI_THEME-fgMuted)' }), h('span', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', animation: anim('hata-section-pop', 3) } }, ic('ti-check', { fontSize: 16 })))]);
			case 'autodel': return C([ic('ti-calendar-time', { fontSize: 22, color: 'var(--MI_THEME-fgMuted)' }), h('span', { style: { display: 'flex', flexDirection: 'column', gap: 3, width: 46 } }, ...[0, 1, 2].map(i => h('span', { key: i, style: { display: 'block', height: 6, borderRadius: 999, background: 'color-mix(in srgb, var(--MI_THEME-fg) 18%, transparent)', animation: anim('hata-section-shrink', 3.4, 0.6 - i * 0.2, 'both') } })))], { gap: 8 });
			case 'mail': return C([A(anim('hata-section-pop', 3), ic('ti-mail', { fontSize: 28 })), A(anim('hata-section-pop', 3, 0.4), ic('ti-circle-check', { fontSize: 18, color: 'var(--MI_THEME-fg)' }))], { gap: 6 });
			case 'history': return h('div', { style: { position: 'absolute', inset: '6px 10px', display: 'flex', flexDirection: 'column', gap: 4 } }, ...['ti-device-desktop', 'ti-device-mobile', 'ti-world'].map((c, i) => h('span', { key: c, style: { display: 'flex', alignItems: 'center', gap: 6, height: 16, animation: anim('hata-section-rise', 3.6, i * 0.2, 'both') } }, ic(c, { fontSize: 14, color: i ? 'var(--MI_THEME-fgMuted)' : 'var(--MI_THEME-accent)' }), bar(i ? '50%' : '70%', { height: 5 }))));
			case 'nav': return h('div', { style: { position: 'absolute', left: 10, right: 10, bottom: 10, height: 30, borderRadius: 999, background: 'var(--MI_THEME-panel)', boxShadow: '0 0 0 1px var(--MI_THEME-divider) inset', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 4px' } },
				...['ti-home', 'ti-bell', 'ti-search', 'ti-settings'].map((c, i) => h('span', { key: c, style: { width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center', animation: `hata-section-hl 2.8s linear ${i * 0.7}s infinite` } }, ic(c, { fontSize: 14, color: 'var(--MI_THEME-fg)' }))));
			case 'glass': return h('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(120deg, var(--MI_THEME-accent), var(--MI_THEME-error) 55%, var(--MI_THEME-link))' } },
				h('span', { style: { position: 'absolute', left: 10, top: 10, bottom: 10, width: 40, borderRadius: 8, background: 'rgb(255 255 255 / 45%)', backdropFilter: 'blur(6px)', boxShadow: '0 0 0 1px rgb(255 255 255 / 60%) inset', animation: anim('hata-section-fadeA', 4) } }),
				h('span', { style: { position: 'absolute', left: 10, top: 10, bottom: 10, width: 40, borderRadius: 8, background: 'var(--MI_THEME-panel)', animation: anim('hata-section-fadeB', 4) } }));
			case 'note': return h('div', { style: { position: 'absolute', inset: 10, borderRadius: 8, background: 'var(--MI_THEME-panel)', boxShadow: '0 0 0 1px var(--MI_THEME-divider) inset', display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' } },
				dot(18, { background: 'var(--MI_THEME-accentedBg)', animation: anim('hata-section-fadeA', 4) }), h('span', { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 } }, bar('80%', { height: 5 }), bar('50%', { height: 5 })),
				h('span', { style: { position: 'relative', width: 34, height: 12, fontSize: 9, fontWeight: 800, color: 'var(--MI_THEME-fgMuted)' } }, h('span', { style: { position: 'absolute', right: 0, animation: anim('hata-section-fadeA', 4) } }, i18n.tsx._ago.minutesAgo({ n: 3 })), h('span', { style: { position: 'absolute', right: 0, animation: anim('hata-section-fadeB', 4) } }, '12:30')));
			case 'actions': return C(['ti-arrow-back-up', 'ti-repeat', 'ti-plus', 'ti-dots'].map((c, i) => h('span', { key: c, style: { width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center', animation: `hata-section-hl 2.8s linear ${i * 0.7}s infinite` } }, ic(c, { fontSize: 15, color: 'var(--MI_THEME-fg)' }))), { gap: 4 });
			case 'visibility': return C(['ti-world', 'ti-home', 'ti-lock', 'ti-mail'].map((c, i) => h('span', { key: c, style: { width: 22, height: 22, borderRadius: 999, display: 'grid', placeItems: 'center', animation: `hata-section-hl 2.8s linear ${i * 0.7}s infinite` } }, ic(c, { fontSize: 15, color: 'var(--MI_THEME-fg)' }))), { gap: 4 });
			case 'border': return h('div', { style: { position: 'absolute', inset: 10, borderRadius: 10, background: 'var(--MI_THEME-panel)', padding: 8, display: 'flex', flexDirection: 'column', gap: 5, animation: 'hata-section-border 4s steps(1) infinite' } }, bar('70%', { height: 5 }), bar('45%', { height: 5 }));
			case 'picker': return h('div', { style: { position: 'absolute', inset: 8, borderRadius: 10, background: 'var(--MI_THEME-panel)', boxShadow: '0 0 0 1px var(--MI_THEME-divider) inset', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', alignItems: 'center', justifyItems: 'center', animation: anim('hata-section-scale', 3.4) } },
				...['ti-mood-smile', 'ti-heart', 'ti-star', 'ti-flame', 'ti-confetti', 'ti-thumb-up', 'ti-moon', 'ti-coffee', 'ti-sun', 'ti-leaf'].map(c => ic(c, { key: c, fontSize: 12, color: 'var(--MI_THEME-fg)' })));
			case 'popup': return h('div', { style: { position: 'absolute', inset: 0 } }, h('span', { style: { position: 'absolute', right: 8, bottom: 8, width: 64, height: 22, borderRadius: 8, background: 'var(--MI_THEME-panel)', boxShadow: '0 2px 6px rgb(0 0 0 / 12%), 0 0 0 1px var(--MI_THEME-divider) inset', display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px', animation: anim('hata-section-toast', 3.4, 0, 'both') } }, ic('ti-bell', { fontSize: 12 }), bar('60%', { height: 4 })));
			case 'access': return C([ic('ti-accessible', { fontSize: 28 }), sw()], { gap: 12 });
			case 'swipe': return h('div', { style: { position: 'absolute', inset: 10, overflow: 'hidden', borderRadius: 8 } }, h('div', { style: { display: 'flex', width: '200%', height: '100%', animation: anim('hata-section-swipe', 3.6) } },
				h('span', { style: { flex: 1, background: 'var(--MI_THEME-panel)', boxShadow: '0 0 0 1px var(--MI_THEME-divider) inset' } }), h('span', { style: { flex: 1, background: 'var(--MI_THEME-accentedBg)' } })), h('i', { className: 'ti ti-hand-finger', style: { position: 'absolute', bottom: 2, fontSize: 18, color: 'var(--MI_THEME-fg)', animation: anim('hata-section-finger', 3.6) } }));
			case 'speed': return C([ic('ti-gauge', { fontSize: 26 }), h('span', { style: { display: 'block', width: 46, height: 6, borderRadius: 999, background: 'var(--MI_THEME-buttonBg)', overflow: 'hidden' } }, h('span', { style: { display: 'block', height: '100%', borderRadius: 999, background: 'var(--MI_THEME-accent)', animation: anim('hata-section-type', 2.6, 0, 'both') } }))], { gap: 8 });
			case 'media': return h('div', { style: { position: 'absolute', inset: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 } }, ...[0, 1, 2, 3].map(i => h('span', { key: i, style: { borderRadius: 6, background: i === 1 ? 'var(--MI_THEME-error)' : i === 2 ? 'var(--MI_THEME-success)' : i === 3 ? 'var(--MI_THEME-link)' : 'var(--MI_THEME-warn)', animation: i === 1 ? anim('hata-section-blur', 3.4) : 'none' } })));
			case 'video': return C([h('span', { style: { width: 50, height: 34, borderRadius: 8, background: 'var(--MI_THEME-fg)', display: 'grid', placeItems: 'center', animation: anim('hata-section-scale', 3) } }, h('i', { className: 'ti ti-player-play-filled', style: { fontSize: 16, color: 'var(--MI_THEME-panel)' } }))]);
			case 'globe': return C([h('span', { style: { display: 'inline-flex', animation: 'hata-section-spin 6s linear infinite' } }, ic('ti-world', { fontSize: 28 })), h('span', { style: { position: 'relative', width: 30, height: 16, fontSize: 12, fontWeight: 800, color: 'var(--MI_THEME-fg)' } }, h('span', { style: { position: 'absolute', animation: anim('hata-section-fadeA', 4) } }, 'あ'), h('span', { style: { position: 'absolute', animation: anim('hata-section-fadeB', 4) } }, 'A'))], { gap: 8 });
			default: throw new Error(`Unknown settings scene: ${key}`);
		}
	}
}

const renderer = new SectionScenes();
const Scene = () => renderer.section(sceneId.value);
</script>

<style lang="scss" module>
.root { min-width: 0; container: settings-section-explainer / inline-size; margin: 16px 0; }
.content { display: flex; align-items: center; gap: 12px; min-width: 0; }
.scene { display: block; flex: none; width: min(120px, 38%); height: auto; aspect-ratio: 120 / 68; border-radius: 14px; overflow: hidden; background: var(--MI_THEME-bg); box-shadow: inset 0 0 0 1px var(--MI_THEME-divider); }
.canvas { position: relative; width: 120px; height: 68px; overflow: hidden; color: var(--MI_THEME-fg); }
.canvas * { box-sizing: border-box; }
.caption { min-width: 0; margin: 0; font-size: .83em; line-height: 1.5; color: var(--MI_THEME-fgMuted); text-wrap: pretty; overflow-wrap: anywhere; }
.root[data-animation-visible='false'] .canvas * { animation-play-state: paused !important; }
.root[data-motion-enabled='false'] .canvas * { animation: none !important; }
@container settings-section-explainer (max-width: 220px) {
	.content { flex-direction: column; align-items: flex-start; gap: 8px; }
	.scene { width: min(120px, 100%); }
}
@media (prefers-reduced-motion: reduce) {
	.canvas * { animation: none !important; }
}
</style>

<!-- Namespaced keyframes also animate the source-derived Vue render nodes. -->
<style lang="scss">
@keyframes hata-section-pop{0%,15%{transform:scale(0);opacity:0}25%{transform:scale(1.15);opacity:1}32%,85%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
    @keyframes hata-section-theme{0%,40%{background:var(--MI_THEME-panel)}50%,90%{background:var(--MI_THEME-fg)}100%{background:var(--MI_THEME-panel)}}
    @keyframes hata-section-fadeA{0%,40%{opacity:1}50%,90%{opacity:0}100%{opacity:1}}
    @keyframes hata-section-fadeB{0%,40%{opacity:0}50%,90%{opacity:1}100%{opacity:0}}
    @keyframes hata-section-feed{0%,20%{transform:translateY(var(--ex-row,-34px))}40%,100%{transform:translateY(0)}}
    @keyframes hata-section-newrow{0%,20%{opacity:0}40%,100%{opacity:1}}
    @keyframes hata-section-type{0%{width:0}60%,100%{width:78%}}
    @keyframes hata-section-send{0%,62%{transform:scale(1)}70%{transform:scale(1.25)}78%,100%{transform:scale(1)}}
    @keyframes hata-section-shake{0%,50%,100%{transform:rotate(0)}55%{transform:rotate(16deg)}60%{transform:rotate(-14deg)}65%{transform:rotate(10deg)}70%{transform:rotate(-6deg)}75%{transform:rotate(0)}}
    @keyframes hata-section-blur{0%,30%{filter:none;opacity:1}50%,90%{filter:blur(4px);opacity:.35}100%{filter:none;opacity:1}}
    @keyframes hata-section-up{0%{transform:translateY(34px);opacity:0}20%{opacity:1}70%{transform:translateY(-6px);opacity:1}85%,100%{transform:translateY(-14px);opacity:0}}
    @keyframes hata-section-down{0%{transform:translateY(-24px);opacity:0}20%{opacity:1}70%{transform:translateY(18px);opacity:1}85%,100%{transform:translateY(24px);opacity:0}}
    @keyframes hata-section-slide{0%,100%{left:8%}50%{left:72%}}
    @keyframes hata-section-swbg{0%,35%{background:var(--MI_THEME-buttonBg)}45%,85%{background:var(--MI_THEME-accent)}95%,100%{background:var(--MI_THEME-buttonBg)}}
    @keyframes hata-section-swk{0%,35%{transform:none}45%,85%{transform:translateX(12px)}95%,100%{transform:none}}
    @keyframes hata-section-swapA{0%,30%{transform:none}50%,80%{transform:translateX(40px)}100%{transform:none}}
    @keyframes hata-section-swapB{0%,30%{transform:none}50%,80%{transform:translateX(-40px)}100%{transform:none}}
    @keyframes hata-section-scale{0%,30%{transform:scale(.8)}50%,80%{transform:scale(1.2)}100%{transform:scale(.8)}}
    @keyframes hata-section-col{0%,30%{width:14px}50%,80%{width:44px}100%{width:14px}}
    @keyframes hata-section-fold{0%,30%{height:46px}50%,80%{height:20px}100%{height:46px}}
    @keyframes hata-section-flip{0%,30%{transform:none}50%,80%{transform:rotate(180deg)}100%{transform:none}}
    @keyframes hata-section-rise{0%,10%{transform:translateY(60px);opacity:0}30%,85%{transform:none;opacity:1}100%{transform:none;opacity:0}}
    @keyframes hata-section-hl{0%,100%{background:transparent}4%,14%{background:var(--MI_THEME-accentedBg)}}
    @keyframes hata-section-eq{0%,100%{height:6px}50%{height:24px}}
    @keyframes hata-section-travel{0%{left:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{left:calc(100% - 8px);opacity:0}}
    @keyframes hata-section-shrink{0%,20%{width:56px}70%,100%{width:0}}
    @keyframes hata-section-border{0%{box-shadow:0 0 0 2px var(--MI_THEME-accent) inset}25%{box-shadow:0 0 0 2px var(--MI_THEME-link) inset}50%{box-shadow:0 0 0 2px var(--MI_THEME-success) inset}75%{box-shadow:0 0 0 2px var(--MI_THEME-warn) inset}}
    @keyframes hata-section-toast{0%,10%{transform:translateX(90px)}25%,75%{transform:none}90%,100%{transform:translateX(90px)}}
    @keyframes hata-section-swipe{0%,30%{transform:none}50%,80%{transform:translateX(-50%)}100%{transform:none}}
    @keyframes hata-section-finger{0%,30%{right:12px}50%,80%{right:60%}100%{right:12px}}
    @keyframes hata-section-spin{to{transform:rotate(360deg)}}
</style>
