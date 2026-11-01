/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, ref } from 'vue';
import Collection from './collection.vue';
import type { Ref } from 'vue';
import type { Theme } from '@/utility/hataigo/rewards-rules.js';
import { themeLabels } from '@/utility/hataigo/i18n.js';

const fixture = vi.hoisted(() => ({ owned: null as unknown as Ref<Theme[]>, save: vi.fn(), refresh: vi.fn() }));
vi.mock('@/utility/hataigo/rewards.js', () => ({ useHataigoRewards: () => ({ owned: fixture.owned, error: ref(null), refresh: fixture.refresh }) }));
vi.mock('@/utility/hataigo/prefs.js', () => ({ useHataigoPrefs: () => ({ prefs: { theme: 'fuji', stones: 'real', labels: true, autoplayInterval: 1000 }, loaded: ref(true), error: ref(null), save: fixture.save }) }));
vi.mock('@/i.js', () => ({ $i: { id: 'me', name: 'Me', avatarUrl: null } }));
vi.mock('@/components/hataigo/HataigoBoard.vue', () => ({ default: { render: () => null } }));
const cleanup: (() => void)[] = [];
beforeEach(() => { fixture.owned = ref<Theme[]>(['fuji', 'seiji']); fixture.save.mockReset().mockResolvedValue(true); fixture.refresh.mockReset().mockResolvedValue(true); });
afterEach(() => cleanup.splice(0).forEach(dispose => dispose()));

function mount() { const target = window.document.createElement('div'); window.document.body.append(target); const app = createApp(Collection); app.mount(target); cleanup.push(() => { app.unmount(); target.remove(); }); return target; }

function card(target: HTMLElement, label: string): HTMLElement { const found = [...target.querySelectorAll<HTMLElement>('article')].find(value => value.textContent.includes(label)); if (!found) throw new Error(`Missing ${label}`); return found; }

describe('collection uses saved ownership', () => {
	it('shows the real owned count and enables an unlocked non-default theme', async () => {
		const target = mount();
		expect(target.textContent).toContain('2 / 6');
		const theme = card(target, themeLabels.seiji.name);
		expect(theme.getAttribute('data-locked')).toBe('false');
		const button = theme.querySelector('button');
		if (!button) throw new Error('Missing unlocked theme action');
		button.click();
		await nextTick();
		expect(fixture.save).toHaveBeenCalledExactlyOnceWith({ theme: 'seiji' });
	});
	it('cannot select a locked theme and updates when a permanent reward arrives', async () => {
		const target = mount();
		expect(card(target, themeLabels.sakura.name).querySelector('button')).toBeNull();
		fixture.owned.value = [...fixture.owned.value, 'sakura'];
		await nextTick();
		expect(card(target, themeLabels.sakura.name).querySelector('button')).not.toBeNull();
	});
});
