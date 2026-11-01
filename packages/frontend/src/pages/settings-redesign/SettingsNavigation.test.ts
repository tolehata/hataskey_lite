/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { compileScript, parse } from '@vue/compiler-sfc';
import { describe, expect, test } from 'vitest';
import destinationsSource from './settings-destinations.ts?raw';
import shellSource from './index.vue?raw';

describe('settings redesign navigation contract', () => {
	test('明示した設定項目と検索結果は既存destinationへ移動する', () => {
		expect(shellSource).toContain('function openBentoDestination(id: string, event?: MouseEvent)');
		expect(shellSource).toContain('const accepted = await goToSetting(destination);');
		expect(shellSource).toContain('if (await goToSetting(target)) closeSearch({ reason: \'select\' });');
	});
	test('shell SFC parses and compiles, including each navigation section only once', () => {
		const parsed = parse(shellSource, { filename: 'settings-redesign/index.vue' });
		expect(parsed.errors).toEqual([]);
		expect(() => compileScript(parsed.descriptor, { id: 'settings-redesign-index' })).not.toThrow();
		expect(shellSource).not.toMatch(/items: \[\s*items: \[/u);
	});

	test('検索close payloadはselectだけoriginへ戻さず、Tabはorigin基準で前後へ出す', () => {
		expect(shellSource).toContain('function closeSearch(event: SettingsSearchCloseEvent)');
		expect(shellSource).toContain('if (event.reason === \'select\') return;');
		expect(shellSource).toContain('if (event.reason === \'tab\')');
		expect(shellSource).toContain('focusAdjacentTo(origin, event.direction ?? \'next\')');
		expect(shellSource).toContain('if (!focusElement(origin)) focusElement(searchAnchorEl.value);');
	});

	test('検索結果はdiscard拒否またはactivation失敗ならpanelを閉じず、承認後だけselect closeする', () => {
		expect(shellSource).toContain('@select="onSearchSelect"');
		expect(shellSource).toContain('async function goToSetting(request: SettingsSearchNavigationTargetV2): Promise<boolean>');
		expect(shellSource).toContain('if (!await requestSurfaceDiscardBeforeNavigation(target)) return false;');
		expect(shellSource).toContain('const navigated = await scheduleNavigationTargetActivation(target, revision, opener);');
		expect(shellSource).toContain('if (navigated) setNavigationNotice(target);');
		expect(shellSource).toContain('return navigated;');
		expect(shellSource).toContain('async function onSearchSelect(target: SettingsSearchNavigationTargetV2)');
		expect(shellSource).toContain('if (await goToSetting(target)) closeSearch({ reason: \'select\' });');
		expect(shellSource).toContain('async function scheduleNavigationTargetActivation(target: SettingsSearchNavigationTargetV2, revision: number, opener: HTMLElement | null): Promise<boolean>');
		expect(shellSource).toContain('if (!activated || revision !== navigationRevision) {');
		expect(shellSource).toContain('return false;');
		expect(shellSource).toContain('const focused = await focusControlAfterNavigation(focusTarget);');
		expect(shellSource).toContain('return focused;');
		expect(shellSource).toContain('const markerFocused = await focusLegacyMarkerAfterNavigation(target.anchor, revision);');
		expect(shellSource).toContain('if (!markerFocused) {');
	});

	test('条件未充足の到達後だけ通知を表示し、stableId由来の設定名とlocale文面を使う', () => {
		expect(shellSource).toContain('<Teleport to="body">');
		expect(shellSource).toContain('<Transition');
		expect(shellSource).toContain('<SettingsNavigationNotice');
		expect(shellSource).toContain('navigationNoticeEnterActive');
		expect(shellSource).toContain('navigationNoticeLeaveActive');
		expect(shellSource).toContain('navigationNoticeLeaveTo');
		expect(shellSource).toContain('@dismiss="clearNavigationNotice"');
		expect(shellSource).toContain('v-if="navigationNoticeMessage != null"');
		expect(shellSource).toContain(':dismissLabel="copy.searchPrerequisite.dismiss"');
		expect(shellSource).toContain(':motionEnabled="motionEnabled"');
		expect(shellSource).toContain('navigationNoticeZIndex');
		expect(shellSource).toContain('os.claimZIndex(\'high\')');
		expect(shellSource).toContain('pointer-events: none');
		expect(shellSource).toContain('safe-area-inset-top');
		expect(shellSource).toContain('descriptorForNavigationTarget');
		expect(shellSource).toContain('if (target.stableId != null)');
		expect(shellSource).toContain('...(descriptor?.unmet ?? [])');
		expect(shellSource).toContain('...(descriptor?.activation?.unmet ?? [])');
		expect(shellSource).toContain('if (navigated) setNavigationNotice(target);');
		expect(shellSource).toContain('navigationNoticeMessage.value = null;');
		expect(shellSource).not.toContain('prefer.commit');
	});

	test('route→typed category→popup→allow-listed reveal→control の順で同一routeにもactivationを実行する', () => {
		const route = shellSource.indexOf('pushShellRoute(path);');
		const schedule = shellSource.indexOf('function scheduleNavigationTargetActivation(target: SettingsSearchNavigationTargetV2, revision: number, opener: HTMLElement | null)');
		const scheduleCall = shellSource.indexOf('scheduleNavigationTargetActivation(target, revision, opener);', route);
		const activate = shellSource.indexOf('const activated = await activateNavigationTarget(target, revision, opener);', schedule);
		const focus = shellSource.indexOf('const focused = await focusControlAfterNavigation(focusTarget);', activate);
		expect(route).toBeGreaterThan(-1);
		expect(scheduleCall).toBeGreaterThan(route);
		expect(schedule).toBeGreaterThan(-1);
		expect(activate).toBeGreaterThan(schedule);
		expect(focus).toBeGreaterThan(activate);
		expect(shellSource).toContain('function activationSteps(activation: SettingsActivation)');
		expect(shellSource).toContain('for (const step of steps)');
		expect(shellSource).toContain('if (step.kind === \'category\')');
		expect(shellSource).toContain('if (step.kind === \'popup\')');
		expect(shellSource).toContain('if (!await activateSettingsReveal(step.id, revision)) return false;');
		expect(shellSource).toContain('if (activationHasUnmetPrerequisite) continue;');
		expect(shellSource).toContain('if (stepOrder < previousStepOrder) return false;');
		expect(shellSource).toContain('if (activeSettingsPopup != null) return activeSettingsPopup.popup === popup;');
		expect(shellSource).toContain('if (step.id === \'glassUi\' && isHatasabaUi2SurfaceActive.value)');
		expect(shellSource).toContain('waiting for the old DOM here would otherwise incur a 2500ms timeout');
	});

	test('hashなし旧hata-custom直URLは常設glassUi、既知hashは一度だけcatalog activationへ渡す', () => {
		expect(shellSource).toContain('const initiallyOpenHatasabaUi2Surface = isHataCustomPath(router.getCurrentFullPath())');
		expect(shellSource).toContain('initiallyOpenHatasabaUi2Surface ? \'glassUi\' : null');
		expect(shellSource).toContain('function syncHataCustomRoutePresentation()');
		expect(shellSource).toContain('const descriptor = catalog.value.byLegacyId.get(legacyId);');
		expect(shellSource).toContain('if (descriptor.activation == null) {');
		expect(shellSource).toContain('activeHataCustomCategory.value = null;');
		expect(shellSource).toContain('appliedHataCustomDeepLink === fullPath');
		expect(shellSource).toContain('const target: SettingsSearchNavigationTargetV2 = {');
		expect(shellSource).toContain('closeIrrelevantSettingsPopup(target);');
		expect(shellSource).toContain('scheduleNavigationTargetActivation(target, revision, null);');
		expect(shellSource).toContain('syncHataCustomRoutePresentation();');
	});

	test('常設glassUiから別カテゴリへは旧wrapperを先に再mountしてからexact category buttonを押す', () => {
		const remount = shellSource.indexOf('if (category !== \'glassUi\' && isHatasabaUi2SurfaceActive.value)');
		const setCategory = shellSource.indexOf('activeHataCustomCategory.value = category;', remount);
		const waitForButton = shellSource.indexOf('const button = await waitForExactNavigationElement', remount);
		expect(remount).toBeGreaterThan(-1);
		expect(setCategory).toBeGreaterThan(remount);
		expect(waitForButton).toBeGreaterThan(setCategory);
		expect(shellSource).toContain('await nextTick();\n		if (revision !== navigationRevision) return false;');
	});

	test('related popup navigation retains only the same bridge and closes a different one without opener focus', () => {
		expect(shellSource).toContain('function popupForNavigationTarget(target: SettingsSearchNavigationTargetV2)');
		expect(shellSource).toContain('function closeIrrelevantSettingsPopup(target: SettingsSearchNavigationTargetV2)');
		expect(shellSource).toContain('closeSettingsPopup(active, false);');
		expect(shellSource).toContain('function closeSettingsPopup(state: ActiveSettingsPopup, restoreOpener = true)');
		expect(shellSource).toContain('if (restoreOpener) restorePopupOpener(state.opener);');
		expect(shellSource).toContain('closeIrrelevantSettingsPopup(target);');
	});

	test('legacy領域のdirect launcherは新shellのcaptureで止め、bridgeへ一度だけ渡す', () => {
		expect(shellSource).toContain('@click.capture="onLegacyContentClickCapture"');
		expect(shellSource).toContain('function onLegacyContentClickCapture(event: MouseEvent)');
		expect(shellSource).toContain('[data-settings-popup-launcher]');
		expect(shellSource).toContain('event.stopPropagation();');
		expect(shellSource).toContain('void openSettingsPopup(popup, launcher);');
		expect(shellSource).toContain('restorePopupOpener(state.opener);');
	});

	test('body全体を2500msだけ監視し、disabled controlはheading/rootへ退避する', () => {
		expect(shellSource).toContain('import { waitForSettingsNavigationFocus } from \'./settings-navigation-focus.js\';');
		expect(shellSource).toContain('const waiter = waitForSettingsNavigationFocus({');
		expect(shellSource).toContain('find: () => exactNavigationElement(Array.from(window.document.querySelectorAll<HTMLElement>(`[${attribute}]`))');
		expect(shellSource).toContain('isCurrent: () => revision === controlFocusRevision && targetNavigationRevision === navigationRevision');
		expect(shellSource).toContain('getControlFallbackFocusTarget(target)');
		expect(shellSource).toContain('!element.closest(\'[data-settings-related]\')');
		expect(shellSource).toMatch(/scroll-margin-block:\s*\d+px/u);
		expect(shellSource).toContain('cancelPendingNavigation();');
		expect(shellSource).toContain('focusTarget.kind === \'group\' ? \'data-settings-search-group-id\' : \'data-settings-search-id\'');
		expect(shellSource).toContain('function exactNavigationElement(elements: HTMLElement[])');
		expect(shellSource).toContain('[data-settings-reveal-id]');
		expect(shellSource).toContain('[data-in-app-search-marker-id]');
		expect(shellSource).toContain('async function focusLegacyMarkerAfterNavigation(markerId: string, revision: number): Promise<boolean>');
	});

	test('folder disclosure targetはroute変更・focus完了・timeoutで消費して残さない', () => {
		expect(shellSource).toContain('const activeTarget = activeTargetForNavigation(target, focusTarget);');
		expect(shellSource).toContain('activeNavigationTarget.value = activeTarget;');
		expect(shellSource).toContain('if (activeTarget != null) clearActiveNavigationTarget(activeTarget);');
		expect(shellSource).toContain('window.setTimeout(() => clearActiveNavigationTarget(target), 2500)');
		expect(shellSource).toContain('function activeNavigationTargetMatchesCurrentPath()');
		expect(shellSource).toContain('if (!activeNavigationTargetMatchesCurrentPath()) activeNavigationTarget.value = null;');
		expect(shellSource).toContain('if (event.isTrusted) {\n			cancelPendingNavigation();\n			activeNavigationTarget.value = null;');
	});

	test('Hataskey category navは実在category/popupへ向ける', () => {
		for (const category of ['glassUi', 'font', 'hatask', 'hatady', 'mascot', 'earthquake', 'general']) {
			expect(destinationsSource).toContain('category: \'' + category + '\'');
		}
		// ⚠️popup を指す記述は「いまの値をすぐ変える」節にしかなく、節ごと外した。
		//   受け口そのものは残っているので、そちらを見る。
		expect(shellSource).toContain("value === 'hatasaba-ui2'");
		expect(shellSource).toContain('await initIntlString(true)');
		expect(shellSource).toContain('controlId: preferenceNavigationTargets.density');
		expect(shellSource).toContain('controlId: preferenceNavigationTargets.postForm');
		expect(shellSource).toContain('controlId: preferenceNavigationTargets.chat');
	});

	test('same-route preference shortcutはcatalog読込時にexact-one・route・設定キーをfail-fast検証する', () => {
		for (const [name, preferenceKey] of [
			['density', 'showGapBetweenNotesInTimeline'],
			['noteDisplay', 'showReplyTargetNote'],
			['postForm', 'showFixedPostForm'],
			['chat', 'chat.sendOnEnter'],
		]) {
			expect(shellSource).toContain(`${name}: generatedPreferenceSearchId('${preferenceKey}')`);
			expect(shellSource).toContain(`{ controlId: preferenceNavigationTargets.${name}, preferenceKey: '${preferenceKey}' }`);
		}
		expect(shellSource).toContain('function assertPreferenceNavigationTargets(nextCatalog: ReturnType<typeof buildSettingsCatalogV2>)');
		expect(shellSource).toContain('descriptor.source === \'control\'');
		expect(shellSource).toContain('descriptor.controlId === controlId');
		expect(shellSource).toContain('match.route !== \'/settings/preferences\'');
		expect(shellSource).toContain('!match.preferenceKeys.includes(preferenceKey)');
		const build = shellSource.indexOf('const nextCatalog = buildSettingsCatalogV2(');
		const assertion = shellSource.indexOf('assertPreferenceNavigationTargets(nextCatalog);', build);
		const assign = shellSource.indexOf('catalog.value = nextCatalog;', assertion);
		expect(build).toBeGreaterThan(-1);
		expect(assertion).toBeGreaterThan(build);
		expect(assign).toBeGreaterThan(assertion);
	});

	test('破壊的操作は一覧末尾に置き、検索では実行せず一覧へ到達する', () => {
		for (const id of ['clear-cache', 'logout', 'logout-all']) expect(shellSource).toContain(`searchId: 'settings.shell.${id}'`);
		expect(shellSource).toContain('<footer v-if="showOverview"');
		expect(shellSource).toContain('data-settings-search-destructive="true"');
		expect(shellSource).toContain('@click="runShellAction(item.id)"');
		expect(shellSource).toContain('function navigationPathForTarget(target: SettingsSearchNavigationTargetV2, focusTarget: NavigationFocusTarget | null)');
		expect(shellSource).toContain("focusTarget.id === 'settings.shell.logout'");
		expect(shellSource).toContain("if (isShellAction) return '/settings';");
	});
	test('すべての画面で既存プロファイル管理メニューと検索入口を使える', () => {
		const header = shellSource.slice(shellSource.indexOf('<header'), shellSource.indexOf('</header>'));
		expect(header).toContain('@click="openPreferencesProfileMenu"');
		expect(header).toContain('data-settings-search-group-id="settings.group.preferences-backup-suggestion"');
		expect(header).toContain('@click="openSearch"');
		const menuStart = shellSource.indexOf('async function openPreferencesProfileMenu(event: MouseEvent)');
		const anchor = shellSource.indexOf('const anchor = event.currentTarget ?? event.target;', menuStart);
		const discard = shellSource.indexOf('if (!await requestSurfaceDiscard()) return;', anchor);
		const routeCheck = shellSource.indexOf('if (!isSettingsFullPath(router.getCurrentFullPath())) return;', discard);
		const open = shellSource.indexOf('os.popupMenu(getPreferencesProfileMenu(), anchor);', routeCheck);
		expect(menuStart).toBeGreaterThan(-1);
		expect(anchor).toBeGreaterThan(menuStart);
		expect(discard).toBeGreaterThan(anchor);
		expect(routeCheck).toBeGreaterThan(discard);
		expect(open).toBeGreaterThan(routeCheck);
		expect(shellSource).toContain(':aria-label="bentoCopy.profileMenu"');
	});
	test('スマホ2bとPCタブレット3aは端末の指定で選び、小窓の幅とは分ける', () => {
		expect(shellSource).toContain("(prefer.r.overridedDeviceKind.value ?? DEFAULT_DEVICE_KIND) === 'smartphone'");
		expect(shellSource).toContain(':smartphone="smartphone"');
		expect(shellSource).toContain('<SettingsBentoNavigation');
		expect(shellSource).toContain('@container settings-shell');
		expect(shellSource).not.toContain('data-settings-nav-rail');
		expect(shellSource).not.toContain('data-settings-filter-case');
	});
	test('分類選択はdiscard承認後にURLへ保存し、一覧へ戻ると元カードへ焦点を戻す', () => {
		const start = shellSource.indexOf('async function selectBentoCategory(id: string)');
		const end = shellSource.indexOf('function openBentoDestination', start);
		const select = shellSource.slice(start, end);
		expect(start).toBeGreaterThan(-1);
		expect(select).toContain('if (category == null || !await requestSurfaceDiscard()) return;');
		expect(select).toContain('if (!isSettingsFullPath(router.getCurrentFullPath())) return;');
		expect(select).toContain('`/settings?category=${category.id}`');
		expect(select).toContain('mainEl.value?.focus({ preventScroll: true });');
		const top = shellSource.slice(shellSource.indexOf('async function goSettingsTop()'), shellSource.indexOf('function isSettingsFullPath'));
		expect(top).toContain('if (!await requestSurfaceDiscard()) return;');
		expect(top).toContain("pushShellRoute('/settings')");
		expect(top).toContain('[data-settings-category-id="${categoryId}"]');
		expect(top).toContain('focusElement(');
	});
	test('破壊的shell actionはUI2ドラフトのdiscard承認後だけ既存confirmationへ渡す', () => {
		const actionStart = shellSource.indexOf('async function runShellAction(id: string)');
		const discard = shellSource.indexOf('if (!await requestSurfaceDiscard()) return;', actionStart);
		const action = shellSource.indexOf('await settingsShellActions[id as SettingsShellActionId]();', discard);
		expect(actionStart).toBeGreaterThan(-1);
		expect(discard).toBeGreaterThan(actionStart);
		expect(action).toBeGreaterThan(discard);
	});

	test('ルートは全端末でカテゴリ一覧になり、選択URLだけ実設定面を開く', () => {
		expect(shellSource).toContain("new URLSearchParams(currentFullPath.value.split('?')[1]?.split('#')[0]).get('category')");
		expect(shellSource).toContain('settingsBentoCategories.find(category => category.id === id)?.id ?? null');
		expect(shellSource).toContain("currentPath.value === '/settings' && requestedBentoCategoryId.value == null && embeddedPopup.value == null");
		expect(shellSource).toContain('<SettingsCategorySurface');
		expect(shellSource).not.toContain('SETTINGS_DEFAULT_ROUTE');
	});
	test('PCのカテゴリと本文は独立スクロールし、スマホは一続きの本文になる', () => {
		expect(shellSource).toContain('ref="navEl"');
		expect(shellSource).toContain('ref="mainEl"');
		expect(shellSource).toContain('grid-template-rows: auto minmax(0, 1fr)');
		expect(shellSource).toContain('block-size: calc(100cqh - (var(--MI-stickyTop, 0px) + var(--MI-stickyBottom, 0px)))');
		expect(shellSource).toMatch(/\.nav, \.main \{[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;[^}]*scrollbar-width: none;/u);
		expect(shellSource).toContain('.nav::-webkit-scrollbar, .main::-webkit-scrollbar');
		const smartphone = shellSource.slice(shellSource.indexOf(".scope[data-smartphone='true'] {"));
		expect(smartphone).toMatch(/\.nav,\s*\.main\s*\{[^}]*overflow:\s*visible;/u);
		expect(shellSource).toContain(':activeCategoryId="activeBentoCategoryId"');
		expect(shellSource).toContain('bentoCategoryForDestination');
	});
	test('右ペインの中身は差し替えず、常に置いたままにする', () => {
		// 旗鯖fork: ⚠️Transition で右ペインごと差し替えないこと。
		//   ⚠️ウィンドウの最大化を切り替えると幅の判定(compact)が反転し、鍵が変わって
		//   出入りの遷移が走る。その遷移が終わらないと**右ペインが白いまま二度と
		//   描かれなくなり、左から何を選んでも白いまま**になる（実際に起きた）。
		expect(shellSource).not.toContain('settings-page-forward');
		expect(shellSource).not.toContain("compact ? currentPath : 'settings-pane'");
		// ⚠️動きは使い捨てのアニメーションで出す。途中で止まっても中身は残る。
		expect(shellSource).toContain(':data-page-enter="pageEnterDirection ?? undefined"');
		expect(shellSource).toContain("@keyframes settingsPageForward");
		expect(shellSource).toContain(".contentCard[data-page-enter='forward'] { animation: settingsPageForward 220ms");
	});

	test('幅変更では本文を再生成せず、見えるカテゴリ面と詳細面を区別する', () => {
		expect(shellSource).toContain('<main v-show="!showOverview"');
		expect(shellSource).toContain(`:data-overview="showOverview ? 'true' : 'false'"`);
		expect(shellSource).not.toContain('compact ? currentPath');
		expect(shellSource).not.toContain(':key="smartphone"');
		const categorySurface = shellSource.match(/<SettingsCategorySurface\b[^>]*>/u)?.[0];
		expect(categorySurface).toBeDefined();
		expect(categorySurface).not.toContain(':key=');
	});
	test('1つの宣言の中で同じ指定を二度書かない', () => {
		// 旗鯖fork: ⚠️1行に詰めた宣言へ後から足すと、同じ指定が二重に入りやすい。
		//   ⚠️CSSは後勝ちなので、前に書いた指定が黙って打ち消される。
		//   実際に .quickItem で `text-align: center` の後ろに `text-align: start` が
		//   残り、⚠️札の文字が中央にならなかった。
		const styleStart = shellSource.indexOf('<style lang="scss" module>');
		expect(styleStart).toBeGreaterThan(-1);
		const style = shellSource.slice(styleStart);

		// ⚠️陽性対照。検出器が実際に二重を見つけられること。
		const duplicatesIn = (declaration: string): string[] => {
			const seen = new Map<string, number>();
			for (const part of declaration.split(';')) {
				const name = part.split(':')[0]?.trim();
				// ⚠️入れ子(&:hover や > i)の中身は別の宣言なので数えない。
				if (name == null || name === '' || name.includes('{') || name.includes('}') || name.startsWith('&') || name.startsWith('>')) continue;
				seen.set(name, (seen.get(name) ?? 0) + 1);
			}
			return [...seen].filter(([, count]) => count > 1).map(([name]) => name);
		};
		expect(duplicatesIn('color: red; color: blue')).toEqual(['color']);
		expect(duplicatesIn('color: red; background: blue')).toEqual([]);

		const offenders: string[] = [];
		for (const line of style.split('\n')) {
			const open = line.indexOf('{');
			if (open < 0 || !line.trimStart().startsWith('.')) continue;
			const selector = line.slice(0, open).trim();
			// ⚠️入れ子より手前、最初の & や > が現れるまでを見る。
			const body = line.slice(open + 1).split('&')[0].split('> ')[0];
			for (const name of duplicatesIn(body)) offenders.push(`${selector}: ${name}`);
		}
		expect(offenders).toEqual([]);
	});

	test('シェルのどこでホイールを回しても、近い方のペインが動く', () => {
		// 旗鯖fork: ⚠️器が低いとき（窓を最大化から通常サイズへ戻したときなど）、
		//   ヘッダー帯にはスクロールできる祖先が1つも無く、ホイールが完全に無反応になる。
		//   ⚠️スクロールバーは動くのにホイールだけ死ぬ、という状態がこれだった
		//   （実測: 窓450px / シェル415px / ヘッダー63px の上では祖先なし）。
		expect(shellSource).toContain('@wheel="onShellWheel"');
		expect(shellSource).toContain('function onShellWheel(ev: WheelEvent) {');

		// ⚠️すでにスクロールできる場所の上では何もしないこと（二重に動いて飛ぶ）。
		const handler = shellSource.slice(shellSource.indexOf('function onShellWheel(ev: WheelEvent) {'));
		expect(handler).toContain("if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1) return;");
		// ⚠️端まで来ているときは外側へ渡す。
		expect(handler).toContain('if (next === pane.scrollTop) return;');
		// カプセルの選択保持は、ヘッダーから転送された手動スクロールでも解除する。
		expect(handler).toContain('notifyManualSectionScroll(pane);\n\tpane.scrollTop = next;');
		// ⚠️横ホイールには手を出さない。
		expect(handler).toContain('if (ev.deltaY === 0 || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;');
		// ⚠️横位置だけで選ばないこと。狭い幅では左右ペインが縦に積まれる。
		expect(handler).toContain('const dy = Math.max(box.top - ev.clientY, 0, ev.clientY - box.bottom);');
	});

	test('通常の左nav遷移だけは右pane先頭へ戻し、検索controlとanchorの中心focusを保つ', () => {
		const schedule = shellSource.indexOf('async function scheduleNavigationTargetActivation(target: SettingsSearchNavigationTargetV2, revision: number, opener: HTMLElement | null)');
		const control = shellSource.indexOf('if (focusTarget != null) {', schedule);
		const controlFocus = shellSource.indexOf('const focused = await focusControlAfterNavigation(focusTarget);', control);
		const ordinary = shellSource.indexOf('if (target.anchor == null) {', controlFocus);
		const scrollTop = shellSource.indexOf('mainEl.value?.scrollTo({ top: 0, behavior: \'auto\' });', ordinary);
		const ordinaryFocus = shellSource.indexOf('mainEl.value?.focus({ preventScroll: true });', scrollTop);
		const anchorFocus = shellSource.indexOf('const markerFocused = await focusLegacyMarkerAfterNavigation(target.anchor, revision);', ordinaryFocus);
		expect(schedule).toBeGreaterThan(-1);
		expect(control).toBeGreaterThan(schedule);
		expect(controlFocus).toBeGreaterThan(control);
		expect(ordinary).toBeGreaterThan(controlFocus);
		expect(scrollTop).toBeGreaterThan(ordinary);
		expect(ordinaryFocus).toBeGreaterThan(scrollTop);
		expect(anchorFocus).toBeGreaterThan(ordinaryFocus);
	});

	test('プロフィールはguard付きカテゴリへ、UI2プレビューは編集面から一つだけ開く', () => {
		expect(shellSource).toContain(`@click="selectBentoCategory('profile')"`);
		expect(shellSource).toMatch(/<button v-if="isHatasabaUi2SurfaceActive"[^>]*@click="openHatasabaUi2Preview"/u);
		expect(shellSource.match(/@click="openHatasabaUi2Preview"/gu)).toHaveLength(1);
		expect(shellSource).toContain('min-height: 44px;');
	});
	test('全端末の戻る操作は一覧と設定外を分け、discardと現在routeを確認する', () => {
		expect(shellSource).toContain('@click="showOverview ? goSettingsBack() : goSettingsTop()"');
		const backStart = shellSource.indexOf('async function goSettingsBack() {');
		const exitStart = shellSource.indexOf('function settingsExitRoute()', backStart);
		const back = shellSource.slice(backStart, exitStart);
		expect(backStart).toBeGreaterThan(-1);
		expect(back).toContain('if (!await requestSurfaceDiscard()) return;');
		expect(back).toContain('if (!isSettingsFullPath(router.getCurrentFullPath())) return;');
		expect(back).toContain("pushShellRoute(settingsExitRoute(), router === mainRouter ? 'forcePage' : undefined);");
	});
	test('サービス連携は専用surfaceを開き、関連導線はページ末尾だけに集約する', () => {
		expect(shellSource).toContain('import SettingsServiceConnectionSurface from \'./SettingsServiceConnectionSurface.vue\';');
		expect(shellSource).toContain('const isServiceConnectionSurfaceActive = computed(() => currentPath.value === \'/settings/connect\');');
		expect(shellSource).toContain('v-else-if="isServiceConnectionSurfaceActive"');
		expect(shellSource).toContain('<SettingsServiceConnectionSurface');
		expect(shellSource).toContain('inlineRelated: false');
		expect(shellSource).toContain('\'/settings/profile\': [\'/settings/avatar-decoration\', \'/settings/note-charm\']');
		expect(shellSource).toContain('pageOwnedRelatedRoutes[currentPath.value]?.includes(related.route) === true');
	});

	test('compact overview preview waits for the route-mounted permanent surface and never opens a second draft', () => {
		const previewStart = shellSource.indexOf('async function openHatasabaUi2Preview()');
		const navigate = shellSource.indexOf('await goToSetting(hataCustomGlassUiItem);', previewStart);
		const wait = shellSource.indexOf('const surface = await waitForHatasabaUi2Surface();', previewStart);
		const open = shellSource.indexOf('surface?.openPreview();', previewStart);
		expect(previewStart).toBeGreaterThan(-1);
		expect(navigate).toBeGreaterThan(previewStart);
		expect(wait).toBeGreaterThan(navigate);
		expect(open).toBeGreaterThan(wait);
		expect(shellSource).toContain('function waitForHatasabaUi2Surface(): Promise<HatasabaUi2SurfaceHandle | null>');
		expect(shellSource).toContain('watch(() => [isHatasabaUi2SurfaceActive.value, hatasabaSurface.value], check, { flush: \'post\' });');
		expect(shellSource).toContain('timeout = window.setTimeout(() => finish(null), 2500);');
		expect(shellSource).toContain('return isHatasabaUi2SurfaceActive.value ? hatasabaSurface.value ?? null : null;');
	});

	test('navigation item IDs are fail-fast unique and the shared profile target is not duplicated in account navigation', () => {
		expect(shellSource).toContain('import { assertUniqueNavigationIds } from \'./settings-navigation-ids.js\';');
		expect(shellSource).toContain('assertUniqueNavigationIds(navSections);');
		expect(shellSource).toContain(`@click="selectBentoCategory('profile')"`);
		expect(destinationsSource.match(/destination\('account-profile'/gu)).toHaveLength(1);
		expect(destinationsSource.match(/destination\('account-plugins'/gu)).toHaveLength(1);
	});

	test('removed preference control ids are rewritten at catalog construction and both navigation lookup entry points', () => {
		expect(shellSource).toContain('redesignedPreferenceStableIdAliases(generatedControlItems)');
		expect(shellSource).toContain('canonicalStableIdForCatalogV2(catalog.value, request.stableId)');
		expect(shellSource).toContain('canonicalStableIdForCatalogV2(catalog.value, request.controlId)');
		expect(shellSource).toContain('canonicalStableIdForCatalogV2(catalog.value, target.stableId)');
		expect(shellSource).toContain('canonicalStableIdForCatalogV2(catalog.value, target.controlId)');
		const loadStart = shellSource.indexOf('async function loadCatalog()');
		const tryStart = shellSource.indexOf('\ttry {', loadStart);
		const merge = shellSource.indexOf('const controlItems = mergeRedesignedPreferenceSearchItems(generatedControlItems);', loadStart);
		const aliases = shellSource.indexOf('const stableIdAliases = redesignedPreferenceStableIdAliases(generatedControlItems);', merge);
		const destinations = shellSource.indexOf('const destinationItems = settingsDestinationCatalogItemsV2();', aliases);
		const build = shellSource.indexOf('buildSettingsCatalogV2(legacyItems, controlItems, settingsCatalogPresentation, destinationItems, stableIdAliases)', destinations);
		const catchStart = shellSource.indexOf('} catch (error) {', build);
		const errorState = shellSource.indexOf('catalogState.value = \'error\';', catchStart);
		expect(tryStart).toBeGreaterThan(loadStart);
		expect(merge).toBeGreaterThan(tryStart);
		expect(aliases).toBeGreaterThan(merge);
		expect(destinations).toBeGreaterThan(aliases);
		expect(build).toBeGreaterThan(destinations);
		expect(catchStart).toBeGreaterThan(build);
		expect(errorState).toBeGreaterThan(catchStart);
	});

	test('設定トップは現役のBento一覧だけを表示する', () => {
		expect(shellSource).toContain('<SettingsBentoNavigation');
		expect(shellSource).not.toContain('<SettingsMobileOverview');
	});

	test('新カテゴリ選択は先頭設定のpopupを自動起動せずカテゴリURLへ移動する', () => {
		const start = shellSource.indexOf('async function selectBentoCategory(id: string)');
		const end = shellSource.indexOf('function openBentoDestination', start);
		expect(start).toBeGreaterThan(-1);
		const handler = shellSource.slice(start, end);
		expect(handler).toContain('`/settings?category=${category.id}`');
		expect(handler).not.toContain('goToSetting(');
		expect(handler).not.toContain('openSettingsPopup(');
	});

	test('全端末のrootは一覧にし、旧glassUiの直URLも維持する', () => {
		expect(shellSource).not.toContain('SETTINGS_DEFAULT_ROUTE');
		expect(shellSource).toContain("currentPath.value === '/settings' && requestedBentoCategoryId.value == null && embeddedPopup.value == null");
		expect(shellSource).toContain("if (activeNavigationTarget.value?.route !== currentPath.value) activeHataCustomCategory.value = 'glassUi';");
	});

	test('現在のカテゴリはmanifestの明示された遷移先を優先し、一意なrouteだけをfallbackにする', () => {
		expect(shellSource).toMatch(/const navSections(?:\s*:[^=]+)?\s*=\s*settingsDestinationSections\.map\(/u);
		expect(shellSource).toContain('const primaryDestinationCountByRoute = computed(() =>');
		expect(shellSource).toContain('const currentFullPath = computed(() =>');
		expect(shellSource).toContain('const currentDestinationId = computed(() =>');
		expect(shellSource).toContain('const activeNavigationItemIds = computed(() =>');
		expect(shellSource).toContain('primaryDestinationCountByRoute.value.get(item.route) === 1');
		expect(shellSource).toContain('return explicitIds.size > 0 ? explicitIds : routeOnlyIds;');
		expect(shellSource).toContain('for (const id of activeNavigationItemIds.value)');
		expect(shellSource).toContain('bentoCategoryForDestination(id)');
	});

	test('通常routeも根拠のある別route関連を末尾へ出し、旧設定導線を残す', () => {
		expect(shellSource).toContain('relatedSourcesForSettingsNavigationV2');
		expect(shellSource).toContain('related.route === currentPath.value');
		expect(shellSource).not.toContain('if (items.length === 3) return items;');
		expect(shellSource).toContain('copy.legacySettings');
		expect(shellSource).toContain('emit(\'openLegacy\')');
	});

	test('旧実装由来の項目も新カテゴリから既存destinationへ接続する', () => {
		expect(shellSource).toContain('function openBentoDestination(id: string, event?: MouseEvent)');
		expect(shellSource).toContain('const destination = destinationForId(id);');
		expect(shellSource).toContain('const accepted = await goToSetting(destination);');
	});

	test('設定シェルはアプリ設定とOS設定の両方でモーションを停止する', () => {
		expect(shellSource).toContain(':data-motion-enabled="motionEnabled ? \'true\' : \'false\'"');
		expect(shellSource).toContain('prefer.r.animation?.value !== false && !prefersReducedMotion.value');
		expect(shellSource).toContain('reducedMotionQuery.addEventListener(\'change\', syncReducedMotion)');
		expect(shellSource).toContain('reducedMotionQuery.removeEventListener(\'change\', syncReducedMotion)');
		expect(shellSource).toContain('.scope[data-motion-enabled=\'false\']');
		expect(shellSource).toContain(':deep(*)');
	});
});
