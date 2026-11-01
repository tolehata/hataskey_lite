/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * UI切り替え時に前のUIモードの残骸をクリーンアップする。
 * Teleport to="body" やプログラマティックに追加されたDOM要素は
 * Vueコンポーネントの破棄時に自動削除されないため、
 * 新しいUIのマウント時に明示的に掃除する必要がある。
 */
export function cleanupStaleUiElements(): void {
	// Hatask mobile nav (Teleported to body)
	document.querySelectorAll<HTMLElement>('.htk-nav-mobile').forEach(el => el.remove());
	document.querySelectorAll<HTMLElement>('.htk-nav-pad').forEach(el => el.remove());

	// Hatask hidden elements restore
	document.querySelectorAll<HTMLElement>('[data-htask-hidden]').forEach(el => {
		el.style.removeProperty('display');
		delete el.dataset.htaskHidden;
	});
	delete document.body.dataset.hataskActive;

	// External TL: programmatic side menu button
	document.querySelectorAll<HTMLElement>('.ext-tl-side-menu-btn').forEach(el => el.remove());

	// External TL: hidden mobile footer restore
	document.querySelectorAll<HTMLElement>('[data-ext-tl-hidden]').forEach(el => {
		el.style.removeProperty('display');
		delete el.dataset.extTlHidden;
	});

	// External TL: data-ext-tl マーカー付き要素を一括削除（新ビルド）
	document.querySelectorAll<HTMLElement>('[data-ext-tl]').forEach(el => el.remove());

	// Reaction tooltips
	document.querySelectorAll<HTMLElement>('.ext-reaction-tip').forEach(el => el.remove());

	// ========================================================
	// 旧ビルドキャッシュ対策: body直下のVue Teleport残骸を構造で検出
	// Vueの Teleport は body 直下に要素を追加する。
	// アプリルート(#misskey_app等)以外でposition:fixedな要素は残骸の可能性が高い。
	// ========================================================
	const appRoot = document.getElementById('misskey_app') || document.getElementById('_root_');
	document.querySelectorAll<HTMLElement>('body > div, body > button, body > nav').forEach(el => {
		// アプリルート、splash、script等は除外
		if (el === appRoot) return;
		if (el.id === 'misskey_app' || el.id === '_root_' || el.id === 'splash') return;
		if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK' || el.tagName === 'NOSCRIPT') return;
		// Misskey標準のモーダル/ポップアップ系コンテナは除外
		if (el.querySelector('[data-modal-id]') || el.dataset.modalId) return;

		const cs = getComputedStyle(el);
		const zIndex = parseInt(cs.zIndex) || 0;

		// position:fixed + z-index >= 900 の小さな要素 → フローティングUI残骸
		if (cs.position === 'fixed' && zIndex >= 900) {
			const rect = el.getBoundingClientRect();
			// bell/pencil/menu アイコンを含む → 外部TLのフローティングボタン
			if (el.querySelector('.ti.ti-bell, .ti.ti-pencil, .ti.ti-menu-2')) {
				el.remove();
				return;
			}
			// 画面下部の小さいフローティング要素 → ナビバー残骸
			if (rect.width > 0 && rect.width <= 300 && rect.height <= 80 && rect.bottom > window.innerHeight - 120) {
				el.remove();
				return;
			}
		}
	});
}
