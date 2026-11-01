/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileStyleAsync, parse } from '@vue/compiler-sfc';
import { createApp, h, nextTick, reactive } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import HataskSupport from './HataskSupport.vue';
import type { App } from 'vue';
import type { Mock } from 'vitest';
import type { SupportSnapshot } from '@/utility/hatask-support.js';
import { SUPPORT_POLICIES } from '@/utility/hatask-support.js';

const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/i18n.js', async () => {
	const { createTestHataskI18n } = await import('@/utility/hatask-test-i18n.js');
	return { i18n: createTestHataskI18n() };
});
vi.mock('@/instance.js', async () => ({ instance: (await import('vue')).reactive({ name: '旗茶くんのサーバー' }) }));
vi.mock('@/utility/hatakyu-assets.js', () => ({ hatakyuAssetUrl: (name: string) => `/client-assets/hatakyu/${name}.png` }));
vi.mock('@/components/global/MkAvatar.vue', () => ({ default: { props: ['user'], setup: (props: { user: { id: string } }) => () => h('span', { 'data-avatar': props.user.id }) } }));
vi.mock('@/components/global/MkUserName.vue', () => ({ default: { props: ['user'], setup: (props: { user: { name: string } }) => () => h('span', { 'data-user-name': '' }, props.user.name) } }));
vi.mock('@/components/global/MkA.vue', () => ({ default: { props: ['to'], setup: (props: { to: string }, context: { slots: { default?: () => unknown } }) => () => h('a', { href: props.to }, context.slots.default?.() as never) } }));

const snapshot = (value: SupportSnapshot['value'], extra: Partial<SupportSnapshot> = {}): SupportSnapshot => ({ value, available: value === true || (typeof value === 'number' && value > 0), unlimited: false, condition: null, rateMultiplier: null, ...extra });
const user = (id: string) => ({ id, name: `実ユーザー ${id}`, username: id, host: null });

function response(isSupporter = false) {
	return {
		configured: true, isSupporter, supporterCount: 2,
		settings: { platform: '支援サイト', url: 'https://support.example.test/', manageUrl: 'https://support.example.test/manage', intro: 'サーバーの運営を、支援というかたちで応援できます。\n支援先と特典をご確認のうえ、無理のない範囲でご検討ください', bannerTitle: 'ご支援ありがとうございます！', bannerMessage: 'みなさんのご支援が、\nサーバーの運営を支えています。\nいつもこの場所を大切にしてくださり、\nありがとうございます', bannerVisible: true },
		benefits: SUPPORT_POLICIES.map(policy => {
			const parentUnavailable = ['mascotMaxExpressions', 'mascotMaxPhrases', 'mascotMaxCharacters'].includes(policy.key);
			const baseline = snapshot(policy.type === 'boolean' ? policy.key === 'canUseMascot' : policy.key === 'favoriteFolderLimit' ? 2 : 100, parentUnavailable ? { available: false, condition: 'mascotUnavailable' } : {});
			const offered = snapshot(policy.type === 'boolean' ? policy.key !== 'canUseHatadySync' : policy.key === 'driveCapacityMb' ? 5120 : policy.key === 'favoriteFolderLimit' ? 5 : 1000);
			return { key: policy.key, title: policy.name as string, description: policy.description as string, showBaseline: true, baseline: baseline as SupportSnapshot | null, offered: offered as SupportSnapshot | null, current: isSupporter ? offered : baseline, reflected: isSupporter };
		}),
	};
}

const mounted: { app: App<Element>; container: HTMLDivElement }[] = [];
let width = 1000;
let panelTop = 0;
let disconnect: ReturnType<typeof vi.fn>;
let supportScroll: Mock<HTMLElement['scrollIntoView']>;

beforeEach(() => {
	width = 1000;
	panelTop = 0;
	disconnect = vi.fn();
	supportScroll = vi.fn<HTMLElement['scrollIntoView']>();
	vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = disconnect; });
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
		if (this.hasAttribute('data-hatask-support')) return new DOMRect(0, 0, width, 4000);
		if (this.id.startsWith('hatask-support-benefits-')) return new DOMRect(0, 100, width - 80, 4000);
		if (this.hasAttribute('data-benefit-card')) { const index = [...this.parentElement!.children].indexOf(this); return new DOMRect(0, 100 + index * 260, width - 80, 248); }
		if (this.hasAttribute('data-disclosure')) return new DOMRect(0, panelTop, width, 4000);
		return new DOMRect(0, 0, 0, 0);
	});
	vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(supportScroll);
	mocks.api.mockReset();
	mocks.api.mockImplementation(async endpoint => endpoint === 'hatask/support/show' ? response() : { users: [user('one'), user('two')], total: 2, hasMore: false });
});
afterEach(() => {
	for (const item of mounted.splice(0)) { item.app.unmount(); item.container.remove(); }
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

async function flush(): Promise<void> { for (let index = 0; index < 12; index++) await nextTick(); }

function mount(options: { theme?: string; mode?: 'light' | 'dark'; animations?: boolean } = {}) {
	const props = reactive({ theme: 'akatsuki', mode: 'light' as 'light' | 'dark', animations: true, ...options });
	const app = createApp({ setup: () => () => h(HataskSupport, props) });
	const container = window.document.createElement('div');
	window.document.body.append(container);
	app.mount(container);
	mounted.push({ app, container });
	return { app, container, props };
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
	const found = [...container.querySelectorAll('button')].find(item => item.textContent.trim() === label);
	if (!found) throw new Error(`Missing button ${label}`);
	return found;
}

function card(container: HTMLElement, key: string): HTMLElement {
	const found = container.querySelector<HTMLElement>(`[data-policy-key='${key}']`);
	if (!found) throw new Error(`Missing card ${key}`);
	return found;
}

function expectSingleAvailability(element: HTMLElement): void {
	expect(element.querySelectorAll('[data-baseline-value]')).toHaveLength(1);
	expect(element.querySelector('[data-baseline-value]')?.textContent).toBe('利用できます');
	expect(element.querySelector('[data-offered-value]')).toBeNull();
	expect(element.querySelector('dl')).toBeNull();
	expect([...element.children].filter(child => child.textContent.trim() === '支援なし')).toHaveLength(1);
}

describe('Hatask support view', () => {
	test.each(['akatsuki', 'koke', 'kisetsu', 'kashin', 'suri', 'hatakyu'].flatMap(theme => ['light', 'dark'].map(mode => ({ theme, mode: mode as 'light' | 'dark' }))))('$theme/$mode keeps the approved sections and actual user components', async props => {
		const { container } = mount(props);
		await flush();
		expect(container.querySelector('[data-hatask-support]')?.getAttribute('data-theme')).toBe(props.theme);
		expect(container.querySelector('[data-hatask-support]')?.getAttribute('data-mode')).toBe(props.mode);
		expect(container.querySelectorAll('[data-benefit-card]')).toHaveLength(SUPPORT_POLICIES.length);
		expect(container.querySelectorAll('[data-avatar]')).toHaveLength(2);
		expect(container.querySelector('[data-user-name]')?.textContent).toBe('実ユーザー one');
		expect(container.querySelector('[data-section="supporters"] a')?.getAttribute('href')).toBe('/@one');
		expect(container.textContent).toContain('旗茶くんのサーバー');
		expect(container.textContent).not.toContain('サーバーの運営を支える');
		expect(container.querySelector('[data-benefit-toggle]')).toBeNull();
		expect(container.querySelector('[data-section="thanks-banner"] img') != null).toBe(props.theme === 'hatakyu');
		expect(container.querySelector('[data-section="support-destination"]')).not.toBeNull();
		expect(container.querySelector('[data-section="active-benefits"]')).toBeNull();
		expectSingleAvailability(card(container, 'canUseMascot'));
	});
	test('default heading breaks and requested paragraph newlines survive the port', async () => {
		const { container } = mount();
		await flush();
		for (const [key, parts] of [
			['canMakePrivateChannel', ['プライベート', 'チャンネル']], ['avatarDecorationLimit', ['アバター', 'デコレーション']],
			['favoriteFolderLimit', ['お気に入り', 'フォルダ']], ['canCreateFavoriteSubfolders', ['お気に入りの', '子フォルダ']],
			['mascotMaxPhrases', ['マスコットの', '最大文言数']], ['mascotMaxCharacters', ['マスコットの', '最大キャラクター数']],
		] as const) expect([...card(container, key).querySelectorAll('h4 > span > span')].map(item => item.textContent)).toEqual(parts);
		expect(container.querySelector('[data-section="thanks-banner"] p')?.textContent).toBe(response().settings.bannerMessage);
		expect(container.querySelector('[data-section="available-benefits"] > p')?.textContent).toBe('管理者が案内している特典です。\n利用条件や反映の時期は、支援先の案内をご確認ください');
	});
	test('regular visitors see usable base values first, never gated mascot counts or a false exemption', async () => {
		const { container } = mount();
		await flush();
		const drive = card(container, 'driveCapacityMb');
		expect(drive.getAttribute('data-value-source')).toBe('baseline');
		expect(drive.querySelector('[data-baseline-value]')?.textContent).toBe('100 MB');
		expect(drive.querySelector('[data-offered-value]')?.textContent).toBe('5 GB');
		expect(drive.textContent).toContain('支援なしでも利用できます');
		const favoriteFolders = card(container, 'favoriteFolderLimit');
		expect(favoriteFolders.getAttribute('data-value-source')).toBe('baseline');
		expect(favoriteFolders.querySelector('[data-baseline-value]')?.textContent).toBe('2 個');
		expect(favoriteFolders.querySelector('[data-offered-value]')?.textContent).toBe('5 個');
		const favoriteSubfolders = card(container, 'canCreateFavoriteSubfolders');
		expect(favoriteSubfolders.getAttribute('data-value-source')).toBe('offered');
		expect(favoriteSubfolders.querySelector('[data-baseline-value]')?.textContent).toBe('作成できません');
		expect(favoriteSubfolders.querySelector('[style*="--value-em"]')?.textContent).toBe('作成できます');
		for (const key of ['mascotMaxExpressions', 'mascotMaxPhrases', 'mascotMaxCharacters', 'canUseHatadySync']) expect(card(container, key).getAttribute('data-value-source')).toBe('offered');
		expect(card(container, 'mascotMaxPhrases').textContent).toContain('マスコット機能は利用できません');
	});
	test.each([360, 495, 1000])('identical availability appears once at container width %i', async containerWidth => {
		width = containerWidth;
		const { container } = mount();
		await flush();
		if (containerWidth < 600) {
			button(container, '支援特典をもっとみる').click();
			await flush();
		}
		const mascot = card(container, 'canUseMascot');
		expect(mascot.hasAttribute('inert')).toBe(false);
		expectSingleAvailability(mascot);
		// Positive control: the old duplicate comparison must fail this same assertion.
		const duplicate = mascot.cloneNode(true) as HTMLElement;
		const comparison = window.document.createElement('dl');
		comparison.innerHTML = '<dt>支援特典</dt><dd data-offered-value="canUseMascot">利用できます</dd>';
		duplicate.append(comparison);
		expect(() => expectSingleAvailability(duplicate)).toThrow();
	});
	test('equal numeric benefits keep the usable baseline and omit the redundant comparison', async () => {
		const value = response();
		value.benefits[0].offered = snapshot(100);
		mocks.api.mockResolvedValueOnce(value);
		const { container } = mount();
		await flush();
		const drive = card(container, 'driveCapacityMb');
		expect(drive.querySelector('[data-baseline-value]')?.textContent).toBe('100 MB');
		expect(drive.querySelector('dl')).toBeNull();
		expect(drive.textContent).toContain('支援なしでも利用できます');
	});
	test.each([
		{ name: 'missing offer', offered: null },
		{ name: 'different raw limit with the same rounded text', offered: snapshot(100.001) },
		{ name: 'different availability', offered: snapshot(100, { available: false }) },
		{ name: 'different condition', offered: snapshot(100, { condition: 'mascotUnavailable' }) },
		{ name: 'different exemption', offered: snapshot(100, { unlimited: true }) },
		{ name: 'different rate multiplier', offered: snapshot(100, { rateMultiplier: 2 }) },
	])('$name is not mistaken for an identical comparison', async ({ offered }) => {
		const value = response();
		value.benefits[0].offered = offered;
		mocks.api.mockResolvedValueOnce(value);
		const { container } = mount();
		await flush();
		expect(card(container, 'driveCapacityMb').querySelector('[data-offered-value]')).not.toBeNull();
	});
	test('hidden base values are never reconstructed from sample data', async () => {
		const value = response();
		value.benefits[0].showBaseline = false;
		value.benefits[0].baseline = null;
		mocks.api.mockResolvedValueOnce(value);
		const { container } = mount();
		await flush();
		const drive = card(container, 'driveCapacityMb');
		expect(drive.getAttribute('data-value-source')).toBe('offered');
		expect(drive.querySelector('[data-baseline-value]')).toBeNull();
		expect(drive.textContent).toContain('5 GB');
		expect(drive.textContent).not.toContain('100 MB');
	});
	test('registered supporters see current settings and cancellation instead of an offered-features section', async () => {
		mocks.api.mockResolvedValueOnce(response(true));
		const { container } = mount();
		await flush();
		expect(container.querySelector('[data-section="available-benefits"]')).toBeNull();
		expect(container.querySelector('[data-section="active-benefits"]')).not.toBeNull();
		expect(container.querySelector('[data-section="support-destination"]')).toBeNull();
		expect(container.querySelector('[data-section="cancel-guidance"]')?.textContent).toContain('Hatask内では停止手続きはできません');
		expect(container.querySelector('[data-section="support-status"] p')?.textContent).toBe('サーバー管理者が、\nあなたからの支援を確認しました。\n現在ご利用いただける支援特典を、\n下にまとめています');
		expect(card(container, 'driveCapacityMb').getAttribute('data-value-source')).toBe('current');
		expect(card(container, 'canUseMascot').querySelector('[data-offered-value]')?.textContent).toBe('利用できます');
		expect(card(container, 'canUseHatadySync').textContent).toContain('設定が反映されています');
		expect(card(container, 'canUseHatadySync').textContent).not.toContain('同期できます');
	});
	test('independent registration does not claim unreflected effective policies are active', async () => {
		const value = response();
		value.isSupporter = true;
		mocks.api.mockResolvedValueOnce(value);
		const { container } = mount();
		await flush();
		expect(container.querySelector('[data-section="support-status"]')?.getAttribute('data-pending')).toBe('true');
		expect(container.querySelector('[data-section="support-status"] p')?.textContent).toBe('サーバー管理者が、\nあなたからの支援を確認しています。\n一部の特典は設定がまだ反映されていません。\n現在利用できる内容を下でご確認ください');
		expect(card(container, 'driveCapacityMb').textContent).toContain('100 MB');
		expect(card(container, 'driveCapacityMb').textContent).toContain('特典の設定が未反映です');
		expect(mocks.api.mock.calls.every(([endpoint]) => endpoint === 'hatask/support/show' || endpoint === 'hatask/support/supporters')).toBe(true);
	});
	test('a reflected zero limit never becomes an available feature claim', async () => {
		const value = response(true);
		const characters = value.benefits.find(benefit => benefit.key === 'mascotMaxCharacters')!;
		characters.current = snapshot(0, { available: false });
		characters.offered = snapshot(0, { available: false });
		characters.showBaseline = false;
		characters.baseline = null;
		mocks.api.mockResolvedValueOnce(value);
		const { container } = mount();
		await flush();
		expect(card(container, 'mascotMaxCharacters').textContent).toContain('0 体');
		expect(card(container, 'mascotMaxCharacters').textContent).toContain('設定が反映されています');
		expect(card(container, 'mascotMaxCharacters').textContent).not.toContain('利用できます');
	});
	test('unconfigured and disabled views display only the two-line message, without fetching a roster', async () => {
		mocks.api.mockResolvedValueOnce({ configured: false, settings: null, isSupporter: false, supporterCount: 0, benefits: [] });
		const { container } = mount();
		await flush();
		expect(container.querySelector('[data-section="unconfigured-support"]')?.textContent).toBe('このサーバーでは支援情報がありません。また、後ほどご確認ください');
		expect(container.querySelector('[data-section="unconfigured-support"] br')).not.toBeNull();
		expect(container.querySelectorAll('[data-section]')).toHaveLength(1);
		expect(mocks.api).toHaveBeenCalledTimes(1);
	});
	test('mobile uses three complete cards, fading preview, accessible open/close and actual container width', async () => {
		width = 500;
		const { container } = mount();
		await flush();
		const panel = container.querySelector('[data-disclosure]')!;
		const cards = [...container.querySelectorAll('[data-benefit-card]')];
		expect(panel.getAttribute('data-compact')).toBe('true');
		expect(panel.getAttribute('data-expanded')).toBe('false');
		expect(cards.slice(0, 3).every(item => !item.hasAttribute('inert'))).toBe(true);
		expect(cards.slice(3).every(item => item.hasAttribute('inert') && item.getAttribute('aria-hidden') === 'true')).toBe(true);
		const control = button(container, '支援特典をもっとみる');
		expect(control.getAttribute('aria-expanded')).toBe('false');
		expect(container.querySelector(`[id='${control.getAttribute('aria-controls')}']`)).not.toBeNull();
		control.click();
		await flush();
		expect(button(container, '閉じる').getAttribute('aria-expanded')).toBe('true');
		expect(cards.every(item => !item.hasAttribute('inert') && !item.hasAttribute('aria-hidden'))).toBe(true);
		expect(container.querySelector('[style*="--benefit-height"]')?.getAttribute('style')).toContain('4032px');
		button(container, '閉じる').click();
		await flush();
		expect(control.getAttribute('aria-expanded')).toBe('false');
		expect(container.querySelector('[style*="--benefit-height"]')?.getAttribute('style')).toContain('876px');
		expect(supportScroll).not.toHaveBeenCalled();
		width = 1000;
		window.dispatchEvent(new Event('resize'));
		await flush();
		expect(container.querySelector('[data-benefit-toggle]')).toBeNull();
		expect(cards.every(item => !item.hasAttribute('inert'))).toBe(true);
	});
	test('no folding button is added for three or fewer configured benefits', async () => {
		width = 500;
		const value = response();
		value.benefits = value.benefits.slice(0, 3);
		mocks.api.mockResolvedValueOnce(value);
		const { container } = mount();
		await flush();
		expect(container.querySelectorAll('[data-benefit-card]')).toHaveLength(3);
		expect(container.querySelector('[data-benefit-toggle]')).toBeNull();
		expect(container.querySelector('[inert]')).toBeNull();
	});
	test.each([{ animations: false, reduced: false }, { animations: true, reduced: true }])('closing honors animation/reduced motion preferences: %s', async ({ animations, reduced }) => {
		width = 500;
		panelTop = -100;
		vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: reduced } as MediaQueryList);
		const { container } = mount({ animations });
		await flush();
		button(container, '支援特典をもっとみる').click();
		await flush();
		button(container, '閉じる').click();
		await flush();
		expect(supportScroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
		expect(container.querySelector('[data-hatask-support]')?.getAttribute('data-motion')).toBe(animations ? 'on' : 'off');
	});
	test('server text is escaped and unsafe destinations are not links', async () => {
		const value = response();
		value.settings.bannerTitle = '<img src=x onerror=alert(1)>';
		value.settings.url = 'javascript:alert(1)';
		value.benefits[1].title = '<svg onload=alert(1)>';
		mocks.api.mockResolvedValueOnce(value);
		const { container } = mount();
		await flush();
		expect(container.querySelector('[data-section="thanks-banner"] h3')?.textContent).toBe(value.settings.bannerTitle);
		expect(container.querySelector('[onerror], [onload], svg')).toBeNull();
		expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
		expect(card(container, 'canMakePrivateChannel').querySelector('h4')?.textContent).toBe(value.benefits[1].title);
	});
	test('valid external links use configured destinations and isolation attributes', async () => {
		const { container } = mount();
		await flush();
		const link = container.querySelector('[data-section="support-destination"] a')!;
		expect(link.getAttribute('href')).toBe('https://support.example.test/');
		expect(link.getAttribute('target')).toBe('_blank');
		expect(link.getAttribute('rel')).toBe('noopener noreferrer');
	});
	test('supporter pagination preserves existing entries, retries errors and filters remote users', async () => {
		mocks.api.mockImplementation(async (endpoint, params) => {
			if (endpoint === 'hatask/support/show') return response();
			return params.offset === 0 ? { users: [user('one')], total: 3, hasMore: true } : { users: [user('two'), { ...user('remote'), host: 'remote.test' }], total: 3, hasMore: false };
		});
		const { container } = mount();
		await flush();
		mocks.api.mockRejectedValueOnce(new Error('offline'));
		button(container, '支援者をもっとみる').click();
		await flush();
		expect(container.querySelectorAll('[data-avatar]')).toHaveLength(1);
		button(container, '再試行').click();
		await flush();
		expect(mocks.api).toHaveBeenLastCalledWith('hatask/support/supporters', { offset: 1, limit: 30 });
		expect(container.querySelectorAll('[data-avatar]')).toHaveLength(2);
		expect(container.querySelector('[data-avatar="remote"]')).toBeNull();
	});
	test('a failed initial request has a working retry without claiming unconfigured', async () => {
		mocks.api.mockRejectedValueOnce(new Error('offline'));
		const { container } = mount();
		await flush();
		expect(container.querySelector('[role="alert"]')?.textContent).toContain('支援情報を読み込めませんでした');
		expect(container.querySelector('[data-section="unconfigured-support"]')).toBeNull();
		button(container, '再試行').click();
		await flush();
		expect(container.querySelectorAll('[data-benefit-card]')).toHaveLength(SUPPORT_POLICIES.length);
	});
	test('unmount cancels stale data adoption and disconnects layout observation', async () => {
		let resolveRequest!: (value: ReturnType<typeof response>) => void;
		mocks.api.mockReturnValueOnce(new Promise(complete => { resolveRequest = complete; }));
		const { app, container } = mount();
		await flush();
		app.unmount();
		mounted.splice(0);
		resolveRequest(response());
		await flush();
		expect(mocks.api).toHaveBeenCalledTimes(1);
		expect(disconnect).toHaveBeenCalled();
		expect(container.childElementCount).toBe(0);
		container.remove();
	});
	test('all three empty-state icons stay centered with the real global fixed-width icon rule', async () => {
		const value = response();
		value.benefits = [];
		value.supporterCount = 0;
		value.settings.url = '';
		mocks.api.mockImplementation(async endpoint => endpoint === 'hatask/support/show' ? value : { users: [], total: 0, hasMore: false });
		const { container } = mount();
		container.classList.add('htk-akatsuki-layout');
		await flush();
		const icons = [...container.querySelectorAll<HTMLElement>('i.ti')].filter(icon => icon.nextElementSibling?.tagName === 'H4');
		expect(icons).toHaveLength(3);
		expect(icons.map(icon => icon.nextElementSibling?.textContent)).toEqual(['特典の案内は準備中です', '支援者の掲載はまだありません', '支援先はまだ設定されていません']);

		const filename = resolve(process.cwd(), 'src/components/hatask/HataskSupport.vue');
		const descriptor = parse(readFileSync(filename, 'utf8'), { filename }).descriptor;
		const componentStyle = await compileStyleAsync({ source: descriptor.styles[0].content, filename, id: 'data-v-hatask-support-empty', modules: true, preprocessLang: 'scss' });
		expect(componentStyle.errors).toEqual([]);
		const emptyClass = componentStyle.modules?.empty;
		expect(emptyClass).toBeTruthy();
		const declaration = componentStyle.code.match(new RegExp(`\\.${emptyClass} > \\.ti\\s*\\{([^}]+)\\}`))?.[1];
		if (!declaration) throw new Error('Compiled empty-state icon rule was not found');

		const globalSource = readFileSync(resolve(process.cwd(), 'src/style.scss'), 'utf8');
		const globalIconSource = globalSource.slice(globalSource.indexOf('\n.ti {'), globalSource.indexOf('\n.ti-fw {'));
		const globalStyle = await compileStyleAsync({ source: globalIconSource, filename: 'style.scss', id: 'support-global-icon', preprocessLang: 'scss' });
		expect(globalStyle.errors).toEqual([]);
		expect(globalStyle.code).toMatch(/width:\s*1\.28em/);
		const layoutSource = readFileSync(resolve(process.cwd(), 'src/components/hatask/HataskAkatsukiLayout.vue'), 'utf8');
		const layoutIconRule = layoutSource.match(/\.htk-akatsuki-layout \.ti\s*\{[^}]+\}/)?.[0];
		if (!layoutIconRule) throw new Error('Akatsuki icon rule was not found');

		// Use the mounted Vite module class with the independently compiled rule.
		// This checks CSS declarations and cascade, not browser geometry.
		const mountedClasses = [...new Set(icons.map(icon => icon.parentElement?.classList[0]))];
		if (mountedClasses.some(name => !name)) throw new Error('Mounted empty-state class was not found');
		const sheet = window.document.createElement('style');
		const setRule = (body: string) => { sheet.textContent = `${globalStyle.code}\n${layoutIconRule}\n${mountedClasses.map(name => `.${name} > .ti { ${body} }`).join('\n')}`; };
		const assertCentered = (icon: HTMLElement) => {
			const style = window.getComputedStyle(icon);
			expect(style.display).toBe('block');
			expect(style.marginLeft).toBe('auto');
			expect(style.marginRight).toBe('auto');
			expect(style.marginBottom).toBe('12px');
		};
		window.document.head.append(sheet);
		try {
			const oldDeclaration = declaration.replace(/margin:\s*0 auto 12px\s*;/, 'margin-bottom: 12px;');
			expect(oldDeclaration).not.toBe(declaration);
			setRule(oldDeclaration);
			// Positive control: the former left-aligned block must be detected.
			for (const icon of icons) expect(() => assertCentered(icon)).toThrow();
			setRule(declaration);
			for (const icon of icons) assertCentered(icon);
		} finally {
			sheet.remove();
		}
	});
	test('CSS modules compile all five theme variants and preserve constrained disclosure styles', async () => {
		const filename = resolve(process.cwd(), 'src/components/hatask/HataskSupport.vue');
		const descriptor = parse(readFileSync(filename, 'utf8'), { filename }).descriptor;
		const result = await compileStyleAsync({ source: descriptor.styles[0].content, filename, id: 'data-v-hatask-support', modules: true, preprocessLang: 'scss' });
		expect(result.errors).toEqual([]);
		for (const key of ['page', 'hero', 'panel', 'benefitViewport', 'benefitGrid', 'value', 'benefitNameLine', 'primaryButton', 'secondaryButton']) expect(result.modules?.[key]).toBeTruthy();
		const skins = readFileSync(resolve(process.cwd(), 'src/components/hatask/hatask-themes.scss'), 'utf8');
		for (const theme of ['koke', 'kisetsu', 'kashin', 'suri', 'hatakyu']) expect(skins).toContain(`[data-hatask-support][data-theme='${theme}']`);
		expect(result.code).toContain('@container hatask-support');
		expect(result.code).toContain('@container support-benefits');
		expect(result.code).toContain('white-space: nowrap');
		expect(result.code).toContain('height: var(--benefit-height)');
		expect(result.code).toMatch(/\[data-expanded=["']?false["']?\]/);
		expect(result.code).toMatch(/\[data-motion=["']?off["']?\]/);
		expect(result.code).toContain('prefers-reduced-motion: reduce');
		expect(result.code).toContain('--support-panel: var(--paper, var(--surface))');
		expect(result.code).toContain('--support-accent: var(--accent-ink, var(--accent))');
	});
});
