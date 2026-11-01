/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, ref } from 'vue';
import HataigoRewards from './HataigoRewards.vue';
import type { Ref } from 'vue';
import type { Theme } from '@/utility/hataigo/rewards-rules.js';
import { themeLabels } from '@/utility/hataigo/i18n.js';
import { rewardText } from '@/utility/hataigo/rewards-rules.js';

const fixture = vi.hoisted(() => ({ pending: null as unknown as Ref<Theme[]>, error: null as unknown as Ref<string | null>, refresh: vi.fn(), acknowledge: vi.fn(), save: vi.fn() }));
vi.mock('@/utility/hataigo/rewards.js', () => ({ useHataigoRewards: () => ({ pending: fixture.pending, error: fixture.error, loading: ref(false), refresh: fixture.refresh, acknowledge: fixture.acknowledge }) }));
vi.mock('@/utility/hataigo/prefs.js', () => ({ useHataigoPrefs: () => ({ save: fixture.save, error: ref(null) }) }));
const cleanup: (() => void)[] = [];
beforeEach(() => { fixture.pending = ref<Theme[]>(['kaya', 'seiji']); fixture.error = ref(null); fixture.refresh.mockReset().mockResolvedValue(true); fixture.save.mockReset().mockResolvedValue(true); fixture.acknowledge.mockReset().mockImplementation(async (theme: Theme) => { fixture.pending.value = fixture.pending.value.filter(id => id !== theme); return true; }); });
afterEach(() => cleanup.splice(0).forEach(dispose => dispose()));

async function flush(): Promise<void> { for (let i = 0; i < 6; i++) await Promise.resolve(); await nextTick(); }

function mount() { const target = window.document.createElement('div'); window.document.body.append(target); const app = createApp(HataigoRewards); app.mount(target); cleanup.push(() => { app.unmount(); target.remove(); }); return target; }

function button(target: HTMLElement, label: string): HTMLButtonElement { const found = [...target.querySelectorAll<HTMLButtonElement>('button')].find(value => value.textContent.includes(label)); if (!found) throw new Error(`Missing ${label}`); return found; }

describe('saved reward notification queue', () => {
	it('shows multiple awards in order and applies a theme before acknowledging it', async () => {
		const target = mount();
		expect(target.textContent).toContain(themeLabels.kaya.name);
		expect(target.textContent).not.toContain(themeLabels.seiji.name);
		button(target, rewardText.use).click();
		await flush();
		expect(fixture.save).toHaveBeenCalledExactlyOnceWith({ theme: 'kaya' });
		expect(fixture.acknowledge).toHaveBeenCalledExactlyOnceWith('kaya');
		expect(fixture.save.mock.invocationCallOrder[0]).toBeLessThan(fixture.acknowledge.mock.invocationCallOrder[0]);
		expect(target.textContent).toContain(themeLabels.seiji.name);
	});
	it('keeps the current reward visible if applying the preference fails', async () => {
		fixture.save.mockResolvedValue(false);
		const target = mount();
		button(target, rewardText.use).click();
		await flush();
		expect(fixture.acknowledge).not.toHaveBeenCalled();
		expect(target.textContent).toContain(themeLabels.kaya.name);
	});
	it('dismisses one saved notification without changing the selected theme', async () => {
		const target = mount();
		button(target, rewardText.later).click();
		await flush();
		expect(fixture.save).not.toHaveBeenCalled();
		expect(fixture.acknowledge).toHaveBeenCalledExactlyOnceWith('kaya');
		expect(target.textContent).toContain(themeLabels.seiji.name);
	});
});
