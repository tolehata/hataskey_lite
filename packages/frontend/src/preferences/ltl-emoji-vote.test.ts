/* SPDX-License-Identifier: AGPL-3.0-only */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileTemplate } from '@vue/compiler-sfc';
import { load as loadYaml } from 'js-yaml';
import * as Vue from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferencesManager } from './manager.js';
import type { PreferencesProfile, StorageProvider } from './manager.js';
import type { App } from 'vue';
import MkSwitch from '@/components/MkSwitch.vue';

vi.mock('@@/js/config.js', () => ({ host: 'example.test', version: 'test', prefersReducedMotion: false }));
vi.mock('@@/js/intl-const.js', () => ({ hemisphere: 'N' }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: { itsOn: 'オン', itsOff: 'オフ', switch: '切り替え' } } }));
vi.mock('@/os.js', () => ({ waiting: () => () => {}, alert: vi.fn() }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));
vi.mock('@/utility/haptic.js', () => ({ haptic: vi.fn() }));
vi.mock('@/components/settings-redesign/SettingsControlRelated.vue', () => ({ default: { render: () => null } }));

const sourceFile = 'src/pages/settings/preferences.vue';
const source = readFileSync(resolve(process.cwd(), sourceFile), 'utf8');
const locale = loadYaml(readFileSync(resolve(process.cwd(), '../../locales/ja-JP.yml'), 'utf8')) as Record<string, unknown>;
const switchTemplate = source.match(/<MkSwitch\b[^>]*v-model="ltlEmojiVoteEnabled"[\s\S]*?<\/MkSwitch>/)?.[0];
if (!switchTemplate) throw new Error('Missing production LTL emoji vote switch');
const compiled = compileTemplate({ source: switchTemplate, filename: 'ltl-emoji-vote-setting.vue', id: 'ltl-emoji-vote-setting', compilerOptions: { mode: 'function', prefixIdentifiers: true, cacheHandlers: false } });
if (compiled.errors.length) throw compiled.errors[0];
const render = new Function('Vue', compiled.code)(Vue);
const apps = new Set<App>();

afterEach(() => {
	for (const app of apps) app.unmount();
	apps.clear();
	window.document.body.replaceChildren();
	vi.restoreAllMocks();
});

function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function storage() {
	let saved: PreferencesProfile | null = null;
	const io: StorageProvider = {
		load: () => saved && copy(saved),
		save: ({ profile }) => { saved = copy(profile); },
		cloudGetBulk: async () => ({}),
		cloudGet: async () => null,
		cloudSet: async () => undefined,
	};
	return () => new PreferencesManager(io, { id: 'account' });
}

function mountSwitch(prefer: PreferencesManager) {
	const text = Vue.defineComponent({ setup: (_props, { slots }) => () => slots.default?.() });
	const root = Vue.defineComponent({
		components: { MkSwitch, SearchLabel: text, SearchText: text },
		setup: () => ({ prefer, ltlEmojiVoteEnabled: prefer.model('ltlEmojiVoteEnabled'), i18n: { ts: locale } }),
		render,
	});
	const element = window.document.createElement('div');
	window.document.body.append(element);
	const app = Vue.createApp(root);
	app.directive('tooltip', {});
	apps.add(app);
	app.mount(element);
	const checkbox = element.querySelector<HTMLInputElement>('input[type="checkbox"]');
	if (!checkbox) throw new Error('Expected the real MkSwitch checkbox');
	return {
		element,
		checkbox,
		unmount: () => { app.unmount(); apps.delete(app); element.remove(); },
	};
}

describe('LTL emoji vote profile setting', () => {
	it('commits the real setting switch and retains its choice across remounts and another tab saving', async () => {
		const boot = storage();
		const prefer = boot();
		await prefer.cloudReady;
		prefer.commit('timelineAnimationDirection', 'right');
		const otherTab = boot();
		await otherTab.cloudReady;
		const commit = vi.spyOn(prefer, 'commit');
		const view = mountSwitch(prefer);
		expect(view.checkbox.checked).toBe(true);
		expect(view.element.textContent).toContain('LTLの絵文字投票を表示');
		view.checkbox.click();
		await Vue.nextTick();
		expect(commit).toHaveBeenCalledExactlyOnceWith('ltlEmojiVoteEnabled', false);
		expect(prefer.r.ltlEmojiVoteEnabled.value).toBe(false);
		otherTab.commit('animation', !otherTab.s.animation);
		view.unmount();

		const reloaded = boot();
		await reloaded.cloudReady;
		const reopened = mountSwitch(reloaded);
		expect(reopened.checkbox.checked).toBe(false);
		expect(reloaded.s.timelineAnimationDirection).toBe('right');
		reopened.checkbox.click();
		await Vue.nextTick();
		const enabledAgain = boot();
		await enabledAgain.cloudReady;
		expect(enabledAgain.r.ltlEmojiVoteEnabled.value).toBe(true);
		expect(enabledAgain.s.timelineAnimationDirection).toBe('right');
	});
});
