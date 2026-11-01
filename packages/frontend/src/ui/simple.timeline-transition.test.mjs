/* SPDX-License-Identifier: AGPL-3.0-only */
import { setTimeout, clearTimeout } from 'node:timers';
import { test } from 'vitest';
import * as Vue from 'vue';
import { parse, compileTemplate } from '@vue/compiler-sfc';
import simpleSource from './simple.vue?raw';

const assert = process.getBuiltinModule('assert/strict');

test.each([
	{ animation: true, reducedMotion: false },
	{ animation: false, reducedMotion: false },
	{ animation: true, reducedMotion: true },
])('normal UI preserves its timeline and draft with animation=$animation and reducedMotion=$reducedMotion', async ({ animation, reducedMotion }) => {
	const descriptor = parse(simpleSource).descriptor;
	let transition;
	let wrapper;
	function visit(node, parent) {
		if (node.type === 1 && node.tag === 'Transition' && node.loc.source.includes('@beforeLeave="prepareTimelineLeave"')) {
			transition = node;
			wrapper = parent;
		}
		for (const child of node.children ?? []) visit(child, node);
	}
	visit(descriptor.template.ast, null);
	assert.ok(transition, 'find the actual timeline transition');
	assert.equal(wrapper?.tag, 'div', 'a stable wrapper controls page/deck visibility');
	assert.match(wrapper.loc.source, /^<div v-show="!isPageView && !deckActive"/);
	assert.doesNotMatch(transition.loc.source.split('\n')[1], /v-show=/, 'the keyed transition child is not persisted');
	const compiled = compileTemplate({
		source: wrapper.loc.source,
		filename: 'simple.vue',
		id: 'timeline-transition',
		compilerOptions: { mode: 'function', prefixIdentifiers: true },
	});
	assert.deepEqual(compiled.errors, []);
	assert.doesNotMatch(compiled.code, /persisted:/);
	const motionSource = descriptor.scriptSetup.content.match(/const newNotesMotionEnabled = (computed\([^\n]+\));/);
	assert.ok(motionSource, 'use the production app / OS motion preference expression');
	const animationPreference = Vue.ref(animation);
	const reducedMotionPreference = Vue.ref(reducedMotion);
	const motionEnabled = new Function('computed', 'prefer', 'newNotesReducedMotion', `return ${motionSource[1]}`)(
		Vue.computed, { r: { animation: animationPreference } }, reducedMotionPreference,
	);

	let mounted = 0;
	const errors = [];
	const timers = [];
	const Timeline = {
		props: ['src'],
		setup(props) {
			const loaded = Vue.ref(false);
			mounted++;
			Vue.onMounted(() => timers.push(setTimeout(() => { loaded.value = true; }, 12)));
			return () => Vue.h('div', { 'data-mounted-timeline': '', 'data-src': props.src }, loaded.value ? 'notes' : 'loading');
		},
	};
	const state = Vue.reactive({
		tab: 'local', withRenotes: true, withSensitive: true, onlyFiles: false,
		newNotesMotionEnabled: motionEnabled, isPageView: false, deckActive: false,
		showFixedPostForm: true, isExternalTab: false, isHatadyTab: false, timelineSlideDirection: 1,
		timelineGlassBg: false, punchBusy: false, normalLtlVoteActive: false,
		nativeNavbarVisible: false, ltlEmojiVoteEffects: null, ltlEmojiVoteNavbarTarget: null,
		externalHost: null, externalToken: null, isConcrntTab: false, concrntMounted: false,
		$style: {
			timelineEnterActive: 'enter', timelineLeaveActive: 'leave', timelineEnterFrom: 'from',
			timelineEnterTo: 'to', timelineLeaveFrom: 'to', timelineLeaveTo: 'from', timelineContainer: 'tl', timelineContainerConcrntHidden: 'ctl-hidden',
		},
		prepareTimelineLeave: () => {}, onTouchStart: () => {}, onTouchMove: () => {},
		onTouchEnd: () => {}, onTouchCancel: () => {},
	});
	const app = Vue.createApp({ setup: () => state, render: new Function('Vue', compiled.code)(Vue) });
	app.config.globalProperties.$style = state.$style;
	app.config.warnHandler = () => {};
	app.config.errorHandler = error => errors.push(String(error));
	app.component('MkPostForm', { render: () => Vue.h('textarea') });
	for (const name of ['MkStreamingNotesTimeline', 'MkExternalTimeline', 'MkTrendingTimeline', 'MkHatadyTimeline']) app.component(name, Timeline);
	const host = document.createElement('div');
	document.body.append(host);
	app.mount(host);
	try {
		// Check each ordinary switch as well as a burst; a missing timeline must not
		// be masked by a later switch repairing the DOM.
		for (const [tab, src] of [['following', 'home'], ['social', 'social'], ['local', 'local']]) {
			state.tab = tab;
			await Vue.nextTick();
			await new Promise(resolve => setTimeout(resolve, 100));
			assert.deepEqual(errors, []);
			assert.equal(host.querySelector('[data-mounted-timeline]')?.getAttribute('data-src'), src);
		}
		for (let i = 0; i < 12; i++) {
			state.tab = ['local', 'following', 'social', 'mixed'][i % 4];
			await Vue.nextTick();
			await new Promise(resolve => setTimeout(resolve, 2));
		}
		state.tab = 'local';
		await new Promise(resolve => setTimeout(resolve, 1000));
		await Vue.nextTick();
		assert.deepEqual(errors, []);
		assert.ok(mounted > 1, 'keyed transitions finish');
		const wrapperEl = host.firstElementChild;
		const textarea = host.querySelector('textarea');
		assert.ok(textarea, 'the fixed composer is visible after repeated switches');
		assert.equal(host.querySelector('[data-mounted-timeline]')?.textContent, 'notes');
		assert.equal(host.querySelector('[data-mounted-timeline]')?.getAttribute('data-src'), 'local');
		textarea.value = 'unfinished draft';
		state.tab = 'hatady'; state.isHatadyTab = true;
		await new Promise(resolve => setTimeout(resolve, 500));
		await Vue.nextTick();
		assert.equal(host.querySelector('textarea'), textarea, 'Hatady keeps the fixed composer mounted');
		assert.equal(textarea.value, 'unfinished draft');
		assert.equal(textarea.closest('[inert]') != null, true, 'Hatady cannot focus the hidden note composer');
		state.tab = 'local'; state.isHatadyTab = false;
		await new Promise(resolve => setTimeout(resolve, 500));
		await Vue.nextTick();
		const mountedBeforeHide = mounted;
		for (const key of ['isPageView', 'deckActive']) {
			state[key] = true;
			await Vue.nextTick();
			assert.equal(wrapperEl.style.display, 'none', `${key} hides the timeline`);
			assert.equal(host.querySelector('textarea'), textarea);
			state[key] = false;
			await Vue.nextTick();
			assert.notEqual(wrapperEl.style.display, 'none', `${key} restores the timeline`);
			assert.equal(host.querySelector('textarea'), textarea);
			assert.equal(textarea.value, 'unfinished draft');
			assert.equal(mounted, mountedBeforeHide, `${key} does not remount the timeline`);
		}
		// The CTL tab hides the normal timeline by class (never v-show on the keyed child) and keeps it mounted.
		state.isConcrntTab = true;
		await Vue.nextTick();
		const container = host.querySelector('[data-hata-collapse-items]');
		assert.ok(container?.classList.contains('ctl-hidden'), 'CTL hides the normal timeline');
		state.isConcrntTab = false;
		await Vue.nextTick();
		assert.ok(!host.querySelector('[data-hata-collapse-items]')?.classList.contains('ctl-hidden'), 'leaving CTL shows it again');
		assert.equal(host.querySelector('textarea'), textarea);
		assert.equal(mounted, mountedBeforeHide, 'switching to and from CTL does not remount the timeline');
		// Motion preferences can change while the UI is mounted (OS setting or
		// another tab syncing preferences). Filters replace the same keyed root.
		for (const enabled of [true, false, true, false]) {
			animationPreference.value = enabled;
			reducedMotionPreference.value = false;
			state.tab = enabled ? 'following' : 'social';
			state.onlyFiles = !state.onlyFiles;
			await Vue.nextTick();
			await new Promise(resolve => setTimeout(resolve, 100));
			assert.deepEqual(errors, []);
			assert.equal(host.querySelector('[data-mounted-timeline]')?.getAttribute('data-src'), enabled ? 'home' : 'social');
			assert.equal(host.querySelector('textarea'), textarea);
			assert.equal(textarea.value, 'unfinished draft');
		}
	} finally {
		try {
			app.unmount();
		} catch (error) {
			// A broken transition can also break teardown; retain the original
			// rendering assertion instead of masking it with that second error.
			assert.ok(errors.length > 0, `unexpected teardown error: ${error}`);
		} finally {
			for (const timer of timers) clearTimeout(timer);
			host.remove();
		}
	}
});
