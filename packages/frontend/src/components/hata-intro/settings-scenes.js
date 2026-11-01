/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Interactive teaching diagrams ported from the approved HataIntro A mock.
 * All profile, note, issue and settings data here are isolated examples.
 */
import { hataskGuideProse } from './prose.js';

export const templates = {
	'hg-layout-scene': `
  <div class="hgu-stage" data-hgu data-source="pages/settings-redesign/HatasabaUi2SettingsSurface.vue;components/HatasabaUi2SettingsBody.vue;components/HatasabaUi2ImmediateSettings.vue">
    <header class="hgu-shell-head"><div><button type="button" class="hgu-button" data-hgu-action="back" aria-label="設定一覧の例へ戻る"><i class="ti ti-chevron-left" aria-hidden="true"></i></button><strong>設定</strong><small>Hataskey UI</small></div><button type="button" class="hgu-button" data-hgu-action="preview" aria-label="プレビューを開く"><i class="ti ti-eye" aria-hidden="true"></i></button></header>
    <div class="hgu-overview" data-hgu-overview hidden><h3>設定</h3><p class="hgu-desc">設定一覧から、Hataskey UI を開く入口の抜粋です</p><button type="button" class="hgu-button" data-hgu-action="enter"><i class="ti ti-sparkles" aria-hidden="true"></i><span class="hg-brand">Hataskey UI</span></button></div>
    <div class="hgu-scroll" data-hgu-scroll>
    <section class="hgu-page" aria-label="設定に統合された Hataskey UI・PC表示の操作例" data-hgu-page>
      <header class="hgu-intro"><div><span class="hgu-recommended">推奨・使用中</span><h2>Hataskey UI</h2><p class="hgu-desc">通常表示とデッキ表示を1つで兼ねる、Hataskeyの標準UIです。<br>ここでの変更は<b>保存を押すまで反映されません</b></p></div><div class="hgu-actions"><button type="button" class="hgu-button" data-primary data-hgu-action="preview"><i class="ti ti-eye" aria-hidden="true"></i> プレビューを開く</button><button type="button" class="hgu-button" data-hgu-action="reset"><i class="ti ti-restore" aria-hidden="true"></i> 初期値に戻す</button></div></header>
      <nav class="hgu-categories" aria-label="Hataskey UI の設定カテゴリ" data-hgu-categories></nav>
      <div class="hgu-changebar" data-hgu-changebar data-dirty="false"><span data-hgu-unsaved role="status" aria-live="polite">変更はありません</span><div class="hgu-actions"><button type="button" class="hgu-button" data-hgu-action="discard" hidden>破棄</button><button type="button" class="hgu-button" data-primary data-hgu-action="save" disabled><i class="ti ti-device-floppy" aria-hidden="true"></i> 保存して再読み込み</button></div></div>
        <div class="hgu-form">
          <section class="hgu-section hgu-basic" data-hgu-section="nav" tabindex="-1"><div class="hgu-title-row"><h4>基本</h4><small>4項目</small></div>
            <label class="hgu-switch"><input type="checkbox" data-hgu-switch="trending" checked><span>トレンドタブを表示する<small>過去7日間で反応が多かった投稿を見つけるタブ</small></span></label>
            <label class="hgu-switch" data-hgu-section="deck" tabindex="-1"><input type="checkbox" data-hgu-switch="top"><span>メニューを画面上部に表示する<small>左サイドバーを上部の横並びメニューに変更<br>Hataskey UI のデッキ表示でのみ有効</small></span></label>
            <label class="hgu-switch"><input type="checkbox" data-hgu-switch="width"><span>画面幅に関係なくデッキを表示する<small>通常は幅1100px以上で有効なデッキを、狭い画面でも使用する<br>この端末だけに保存</small></span></label>
            <label class="hgu-switch"><input type="checkbox" data-hgu-switch="swipe" checked><span>左右スワイプでタブを切り替える<small>タッチやトラックパッドで、意図せず切り替わる場合はオフに<br>この端末だけに保存</small></span></label>
            <button type="button" class="hgu-button" disabled><i class="ti ti-refresh" aria-hidden="true"></i> デッキUIチュートリアルをもう一度</button>
            <p class="hgu-desc" style="margin-top:10px">Hataskey UI のデッキ表示中だけ利用できます<br>この例は通常表示から設定を開いた状態です</p>
          </section>
          <section class="hgu-section" data-hgu-section="glass" tabindex="-1"><h4>ガラス面の透過率</h4><p class="hgu-desc">ノートカード面と上部／下部ナビバーの<b>不透明度</b>を調整<br>大きいほど不透明、小さいほど透け感が強くなる</p><div class="hgu-opacity"><input type="range" min="0" max="100" step="1" value="55" aria-label="ガラス面の透過率" data-hgu-opacity><output data-hgu-value>55%</output><button type="button" class="hgu-button" data-hgu-action="opacity-reset" aria-label="透過率を55%に戻す"><i class="ti ti-restore" aria-hidden="true"></i></button></div></section>
          <section class="hgu-section"><h4>Hataskey UI 2</h4><p class="hgu-desc">Hataskey UI 2 は<b>常に有効</b><br>ノート・プロフィール・リアクション・ナビバーを、半透明とぼかしのデザインで表示</p><label class="hgu-switch"><input type="checkbox" data-hgu-switch="bubble"><span>吹き出しデザインを表示する<small>本文の枠と「＜」の口を表示<br>既定はオフで角丸カードのみ／この端末だけに保存</small></span></label></section>
          <section class="hgu-section"><h4>背景ヘッダー画像のぼかし</h4><label class="hgu-switch"><input type="checkbox" data-hgu-switch="timelineBlur"><span>通常タイムラインの背景ヘッダー画像のぼかしを使用しない<small>単色背景になり、描画負荷を軽減<br>ライブプレビューされず、保存後の再描画で反映</small></span></label><label class="hgu-switch"><input type="checkbox" data-hgu-switch="profileBlur"><span>プロフィールページのヘッダー画像のぼかしを使用しない<small>プロフィールカードの背後のぼかしをなくし、不透明パネルに変更</small></span></label></section>
          <section class="hgu-section" data-hgu-section="note" tabindex="-1"><h4>ノートの表示（デッキ）</h4><label class="hgu-switch"><input type="checkbox" data-hgu-switch="simple" checked><span>Hataskey UIデッキでノートの簡易表示を有効にする<small>オンは標準カード、オフは吹き出しデザイン<br>ライブプレビューされず、保存後の再描画で反映</small></span></label></section>
          <section class="hgu-section"><h4>上部ナビバー (タイムラインタブ)</h4><p class="hgu-desc">スイッチで表示を選び、左のつまみをドラッグして並べ替え<br>編集後、上の「保存して再読み込み」で確定</p><button type="button" class="hgu-button" data-hgu-action="nav-reset"><i class="ti ti-restore" aria-hidden="true"></i> 並び順を初期化</button><div class="hgu-reorder" data-hgu-nav></div></section>
          <section class="hgu-section"><h4>下部ナビバー (モバイル)</h4><div class="hgu-disabled"><i class="ti ti-device-desktop" aria-hidden="true"></i> この図はPCで開いた状態<br>本体では、縦型・狭い画面で開くと下部ナビバーを編集できます<br>表示項目は最大4つ</div><fieldset disabled class="hgu-bottom-disabled"><button type="button" class="hgu-button" disabled>並び順を初期化</button><div class="hgu-reorder" data-hgu-bottom></div></fieldset></section>
          <section class="hgu-section" data-hgu-section="side" tabindex="-1"><h4>サイドメニュー (サイドバー / ドロワー)</h4><p class="hgu-desc"><span class="hg-brand">HataSideStudio</span> では、拡大・縮小を別々に編集<br>ボタンの形・色・グループ・ウィジェットを調整できます</p><div class="hgu-actions"><button type="button" class="hgu-button" data-hgu-action="studio"><i class="ti ti-layout-dashboard" aria-hidden="true"></i> HataSideStudio を開く</button><button type="button" class="hgu-button" data-hgu-action="legacy"><i class="ti ti-list" aria-hidden="true"></i> 従来の並び替えを開く</button></div></section>
        </div>
        <section class="hgu-immediate" data-hgu-immediate><header class="hgu-section"><h3>すぐ反映される設定</h3><p class="hgu-desc">下の項目は上の保存バーと連動しません。<br>本体では、選ぶとすぐに保存・反映されます</p></header><section class="hgu-section" data-hgu-section="foldable" tabindex="-1"><div class="hgu-title-row"><h4>折りたたみ端末向けレイアウト</h4><span class="hgu-recommended">この端末のみ・すぐ反映</span></div><p class="hgu-desc">横開き端末の大きい画面で、スマホ表示のまま右側にウィジェットを表示<br>Hataskey UI が対象です</p><div class="hgu-radios"><label><input type="radio" data-hgu-foldable-mode value="auto" checked>自動</label><label><input type="radio" data-hgu-foldable-mode value="on">常に使う</label><label><input type="radio" data-hgu-foldable-mode value="off">使わない</label></div></section><section class="hgu-section"><div class="hgu-title-row"><h4>オリジナルアイコンブランディング</h4><span class="hgu-recommended">プロフィール同期・すぐ反映</span></div><label class="hgu-switch"><input type="checkbox" data-hgu-brand checked><span>Hataskeyオリジナルのアイコンを使う<small>管理者が指定したブランディング画像がある場合はそちらが優先</small></span></label></section></section>
    </section>
    </div>
    <dialog class="hgu-preview-dialog" data-hgu-preview aria-label="Hataskey UI プレビュー"><header class="hgu-preview-head"><strong><span class="hg-brand">Hataskey UI</span> プレビュー</strong><button type="button" class="hgu-button" data-hgu-action="preview-close" aria-label="プレビューを閉じる"><i class="ti ti-x" aria-hidden="true"></i></button></header><p class="hgu-hint"><i class="ti ti-sparkles" aria-hidden="true"></i><span>編集中の設定を表示しています。<br>ここでの操作は保存されません</span></p><div class="hgu-app-preview" data-hgu-preview-stage><div class="hgu-phone" data-hgu-phone><div class="hgu-phone-pill" data-hgu-topbar></div><div data-hgu-preview-notes></div><div class="hgu-phone-bottom"><div data-hgu-preview-bottom></div><i class="ti ti-pencil" aria-hidden="true"></i></div></div><div class="hgu-deck" data-hgu-preview-deck hidden></div></div><footer class="hgu-preview-footer"><span>設定値は保存するまで変更されません</span><button type="button" class="hgu-button" data-hgu-action="preview-close">閉じる</button></footer></dialog>
    <dialog class="hgu-confirm" data-hgu-confirm aria-label="設定変更の確認"><strong data-hgu-confirm-title></strong><p data-hgu-confirm-text></p><div class="hgu-actions"><button type="button" class="hgu-button" data-hgu-action="confirm-cancel">キャンセル</button><button type="button" class="hgu-button" data-primary data-hgu-action="confirm-apply">確認して進む</button></div></dialog>
    <p class="hgu-status" aria-live="polite" data-hgu-status>設定ページを抜粋した操作例です。<br>カテゴリ移動・編集・プレビュー・保存と破棄を試せます。<br>この図は本体や端末の設定を変更しません</p>
  </div>
`,
};

const defaults = { trending: true, top: false, width: false, swipe: true, bubble: false, timelineBlur: false, profileBlur: false, simple: true };
const initialNav = () => [{ id: 'following', icon: 'home', label: 'ホーム', visible: true }, { id: 'local', icon: 'planet', label: 'ローカル', visible: true }, { id: 'social', icon: 'users', label: 'ソーシャル', visible: false }, { id: 'mixed', icon: 'universe', label: 'グローバル', visible: true }];
const categories = [['nav', 'layout-navbar', 'ナビ'], ['glass', 'blur', 'ガラスとぼかし'], ['note', 'note', 'ノート'], ['deck', 'columns', 'デッキ'], ['side', 'menu-2', 'サイドメニュー'], ['foldable', 'devices', '折りたたみ端末']];
const mounts = new WeakMap();
let sequence = 0;

function initOne(tool, instance) {
	const existing = mounts.get(tool);
	if (existing) return existing;
	let disposed = false;
	const listeners = [];
	const on = (target, type, handler) => {
		target.addEventListener(type, handler);
		listeners.push(() => target.removeEventListener(type, handler));
	};
	const uid = 'hata-intro-settings-' + instance.replace(/[^a-zA-Z0-9_-]/g, '-') + '-' + (++sequence);
	tool.dataset.ready = 'true';
	let state = { ...defaults }, nav = initialNav(), opacity = 55, drag = null, pending = null, confirmTrigger = null, previewTrigger = null;
	let saved = JSON.stringify({ state, nav, opacity });
	const q = s => tool.querySelector(s), icon = n => '<i class="ti ti-' + n + '" aria-hidden="true"></i>';
	tool.querySelectorAll('[data-hgu-section]').forEach(section => { section.id = uid + '-' + section.dataset.hguSection; });
	tool.querySelectorAll('[data-hgu-foldable-mode]').forEach(input => { input.name = uid + '-foldable-mode'; });
	const status = t => {q('[data-hgu-status]').innerHTML = hataskGuideProse(t);};
	const changes = () => {const old = JSON.parse(saved); return Object.keys(state).filter(key => state[key] !== old.state[key]).length + Number(opacity !== old.opacity) + Number(JSON.stringify(nav) !== JSON.stringify(old.nav));};
	const update = () => {
		q('[data-hgu-opacity]').value = String(opacity); q('[data-hgu-value]').textContent = opacity + '%';
		q('[data-hgu-action="opacity-reset"]').disabled = opacity === 55;
		const count = changes(); q('[data-hgu-changebar]').dataset.dirty = String(count > 0);
		q('[data-hgu-unsaved]').innerHTML = icon(count ? 'alert-circle' : 'check') + (count ? '未保存の変更が' + count + '件あります' : '変更はありません');
		q('[data-hgu-action="save"]').disabled = !count; q('[data-hgu-action="discard"]').hidden = !count;
		const stage = q('[data-hgu-preview-stage]'); stage.style.setProperty('--hgu-preview-opacity', (opacity * .0085).toString()); stage.dataset.bubble = String(state.bubble && !(state.width && state.simple));
		q('[data-hgu-phone]').hidden = state.width; q('[data-hgu-preview-deck]').hidden = !state.width;
		const visible = nav.filter(item => item.visible); const previewNav = visible.length ? visible : initialNav().slice(0, 2);
		q('[data-hgu-topbar]').innerHTML = previewNav.map((item, index) => '<span' + (index === 0 ? ' data-active' : '') + ' aria-label="' + item.label + '">' + icon(item.icon) + '</span>').join('') + (state.trending ? '<span aria-label="トレンド">' + icon('flame') + '</span>' : '');
	};
	const renderNav = () => {q('[data-hgu-nav]').innerHTML = nav.map(item => '<div class="hgu-nav-item" data-nav-id="' + item.id + '"><button type="button" class="hgu-grip" aria-keyshortcuts="ArrowUp ArrowDown" aria-label="' + item.label + 'を上または下へ移動" data-hgu-grip="' + item.id + '">' + icon('grip-vertical') + '</button><label class="hgu-switch"><input type="checkbox" data-hgu-visible="' + item.id + '" aria-label="' + item.label + 'を表示"' + (item.visible ? ' checked' : '') + '></label>' + icon(item.icon) + '<span>' + item.label + '</span></div>').join('');};
	const restore = () => {const old = JSON.parse(saved); state = old.state; nav = old.nav; opacity = old.opacity; tool.querySelectorAll('[data-hgu-switch]').forEach(input => {input.checked = state[input.dataset.hguSwitch];}); renderNav(); update();};
	const overview = () => {restore(); q('[data-hgu-scroll]').hidden = true; q('[data-hgu-overview]').hidden = false; tool.querySelectorAll('[data-hgu-action="preview"]').forEach(button => {button.disabled = true;}); q('[data-hgu-action="enter"]').focus(); status('設定一覧へ戻った例です。未保存の編集だけを破棄しました。下の即時設定は戻しません。本体の設定は変えていません');};
	const confirm = (action, title, message, trigger) => {pending = action; confirmTrigger = trigger; q('[data-hgu-confirm-title]').textContent = title; q('[data-hgu-confirm-text]').innerHTML = hataskGuideProse(message); q('[data-hgu-confirm]').showModal();};
	let suppressSpyUntil = 0;
	const selectCategory = (id, move = true) => {
		tool.querySelectorAll('[data-hgu-category]').forEach(button => button.setAttribute('aria-current', String(button.dataset.hguCategory === id)));
		if (move) {const reduced = tool.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches; suppressSpyUntil = Date.now() + (reduced ? 0 : 800); const target = q('[data-hgu-section="' + id + '"]'); target.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' }); target.focus({ preventScroll: true });}
	};
	q('[data-hgu-categories]').innerHTML = categories.map(([id, mark, label]) => '<button type="button" data-hgu-category="' + id + '" aria-controls="' + uid + '-' + id + '" aria-label="' + label + '" title="' + label + '" aria-current="' + (id === 'nav') + '">' + icon(mark) + '<span>' + label + '</span></button>').join('');
	const visibleHeights = new Map();
	const Observer = tool.ownerDocument.defaultView.IntersectionObserver;
	const sectionObserver = typeof Observer === 'function' ? new Observer(entries => {
		if (disposed) return;
		for (const entry of entries)visibleHeights.set(entry.target.dataset.hguSection, entry.isIntersecting ? entry.intersectionRect.height : 0);
		if (!tool.isConnected || q('[data-hgu-scroll]').hidden || Date.now() < suppressSpyUntil) return;
		let active = null, height = 0; for (const [id, visible] of visibleHeights) if (visible > height) {active = id; height = visible;}
		if (active)selectCategory(active, false);
	}, { root: q('[data-hgu-scroll]'), rootMargin: '-160px 0px 0px', threshold: [0, .05, .1, .25, .5, .75, 1] }) : null;
	for (const [id] of categories)sectionObserver?.observe(q('[data-hgu-section="' + id + '"]'));
	on(tool, 'change', event => {
		const key = event.target.dataset.hguSwitch;
		if (key && Object.hasOwn(state, key)) {state[key] = event.target.checked; update(); status(['top', 'swipe', 'timelineBlur', 'profileBlur', 'simple'].includes(key) ? '編集した値は保存待ちです。この項目の実際の画面や操作は、図のプレビューでは再現していません' : '編集中の値に変わりました。「プレビューを開く」で表示例を確認できます。本体への保存は行いません');}
		const item = nav.find(item => item.id === event.target.dataset.hguVisible); if (item) {item.visible = event.target.checked; update(); status(item.label + 'の表示を編集しました。プレビューには保存前の並びを表示します。本体は「保存して再読み込み」で確定します');}
		if (event.target.matches('[data-hgu-foldable-mode],[data-hgu-brand]'))status('この項目は本体ではすぐ保存され、上の保存・破棄とは連動しません。この図では選択状態だけを変え、本体や端末には保存していません');
	});
	on(tool, 'input', event => {if (!event.target.matches('[data-hgu-opacity]')) return; opacity = Math.max(0, Math.min(100, Math.round(Number(event.target.value) || 0))); update();});
	on(tool, 'click', event => {
		const category = event.target.closest('[data-hgu-category]'); if (category) {selectCategory(category.dataset.hguCategory); return;}
		const button = event.target.closest('[data-hgu-action]'); if (!button || button.disabled) return; const action = button.dataset.hguAction;
		if (action === 'preview') {previewTrigger = button; update(); q('[data-hgu-preview]').showModal();}
		if (action === 'preview-close')q('[data-hgu-preview]').close();
		if (action === 'opacity-reset') {opacity = 55; update(); status('透過率を既定の55%に戻しました。保存するまで確定しません');}
		if (action === 'nav-reset')confirm('nav-reset', '並び順を初期化', 'この例の上部タブの並びと表示状態を初期化しますか', button);
		if (action === 'reset')confirm('reset', '初期値に戻す', '保存が必要な見え方の設定を初期値に戻します。ナビの並びと「すぐ反映される設定」は変更しません', button);
		if (action === 'save') {saved = JSON.stringify({ state, nav, opacity }); update(); status('保存と再読み込みの流れを確認しました。本体では再読み込みされますが、この図はページを読み込み直さず、本体や端末にも保存しません');}
		if (action === 'discard' || action === 'back') {if (changes())confirm('discard', '変更を破棄しますか？', '未保存の変更を破棄して、設定一覧へ戻ります。「すぐ反映される設定」は戻りません', button); else overview();}
		if (action === 'confirm-cancel') {pending = null; q('[data-hgu-confirm]').close();}
		if (action === 'confirm-apply') {
			const next = pending; pending = null; q('[data-hgu-confirm]').close();
			if (next === 'discard') {confirmTrigger = null; overview();}
			if (next === 'nav-reset') {nav = initialNav(); renderNav(); update(); status('上部ナビを初期化した例です。保存するまで確定しません');}
			if (next === 'reset') {state = { ...defaults }; opacity = 55; tool.querySelectorAll('[data-hgu-switch]').forEach(input => {input.checked = state[input.dataset.hguSwitch];}); update(); status('見え方を初期値に戻しました。ナビの並びと即時設定は維持しています');}
		}
		if (action === 'enter') {q('[data-hgu-overview]').hidden = true; q('[data-hgu-scroll]').hidden = false; tool.querySelectorAll('[data-hgu-action="preview"]').forEach(item => {item.disabled = false;}); q('[data-hgu-scroll]').scrollTop = 0; selectCategory('nav', false); q('[data-hgu-category="nav"]').focus({ preventScroll: true }); status('設定内の Hataskey UI を開いた例です。編集画面自体は別ウィンドウではありません');}
		if (action === 'studio')status('本体では未保存の編集を確認してから HataSideStudio へ移動します。この図は移動せず、ガイドの「HataSideStudio」で操作を確認できます');
		if (action === 'legacy')status('本体では従来のサイドメニュー並び替えを開きます。この図では省略しています');
	});
	on(q('[data-hgu-preview]'), 'close', () => {if (previewTrigger?.isConnected)previewTrigger.focus({ preventScroll: true }); status('プレビューだけを閉じました。設定ページの編集中の値は残っています');});
	on(q('[data-hgu-confirm]'), 'cancel', () => {pending = null;});
	on(q('[data-hgu-confirm]'), 'close', () => {if (confirmTrigger?.isConnected)confirmTrigger.focus({ preventScroll: true });});
	on(tool, 'keydown', event => {
		const grip = event.target.closest('[data-hgu-grip]'); if (!grip || !['ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault();
		const from = nav.findIndex(item => item.id === grip.dataset.hguGrip), to = from + (event.key === 'ArrowUp' ? -1 : 1); if (to < 0 || to >= nav.length) return;
		const [item] = nav.splice(from, 1); nav.splice(to, 0, item); renderNav(); update(); q('[data-hgu-grip="' + item.id + '"]').focus({ preventScroll: true }); status(item.label + 'の順番を変更しました。保存するまで確定しません');
	});
	on(tool, 'pointerdown', event => {const grip = event.target.closest('[data-hgu-grip]'); if (!grip || event.button !== 0) return; drag = { id: grip.dataset.hguGrip, pointer: event.pointerId, grip, order: nav.map(item => item.id) }; grip.setPointerCapture?.(event.pointerId); grip.closest('[data-nav-id]').dataset.dragging = 'true';});
	on(tool, 'pointermove', event => {if (!drag || drag.pointer !== event.pointerId) return; if (event.buttons === 0) {finish(event); return;} const hit = tool.ownerDocument.elementFromPoint(event.clientX, event.clientY)?.closest('[data-nav-id]'); if (!hit || !tool.contains(hit) || hit.dataset.navId === drag.id) return; const parent = hit.parentElement, moving = parent.querySelector('[data-nav-id="' + drag.id + '"]'); const bounds = hit.getBoundingClientRect(); parent.insertBefore(moving, event.clientY > bounds.top + bounds.height / 2 ? hit.nextSibling : hit); drag.grip.setPointerCapture?.(event.pointerId); nav = Array.from(parent.children, element => nav.find(item => item.id === element.dataset.navId)); update();});
	const finish = event => {if (!drag || drag.pointer !== event.pointerId) return; const current = drag; drag = null; if (event.type !== 'pointerup') {nav = current.order.map(id => nav.find(item => item.id === id)); renderNav(); update(); status('並べ替えを中止して、ドラッグ前の順番に戻しました');} else {current.grip.closest('[data-nav-id]')?.removeAttribute('data-dragging'); status('上部タブの順番を変更しました。保存するまで確定しません');} if (current.grip.hasPointerCapture?.(event.pointerId))current.grip.releasePointerCapture(event.pointerId);};
	on(tool, 'pointerup', finish); on(tool, 'pointercancel', finish); on(tool, 'lostpointercapture', event => {if (drag && !drag.grip.hasPointerCapture?.(event.pointerId))finish(event);});
	q('[data-hgu-bottom]').innerHTML = [['search', '検索', true], ['home', 'ホーム', true], ['bell', '通知', true], ['eye', '独自機能', true], ['book-2', 'Hatady', false], ['message-report', 'HataFeed', false], ['apps', 'ウィジェット', false]].map(([mark, label, visible]) => '<div class="hgu-nav-item"><span aria-hidden="true">' + icon('grip-vertical') + '</span><label class="hgu-switch"><input type="checkbox" disabled aria-label="' + label + 'を表示"' + (visible ? ' checked' : '') + '></label>' + icon(mark) + '<span>' + label + '</span></div>').join('');
	const bar = (width, opacity = .2) => '<span class="hgu-bar" style="width:' + width + ';opacity:' + opacity + '"></span>';
	q('[data-hgu-preview-notes]').innerHTML = [['100%', '64%'], ['90%']].map((lines, index) => '<div class="hgu-phone-note" aria-label="ノート表示の見本 ' + (index + 1) + '"><div class="hgu-phone-avatar"></div><div class="hgu-phone-body"><div class="hgu-note-head">' + bar('32px', .5) + bar('20px', .22) + bar('15px', .15) + '</div><div class="hgu-note-lines">' + lines.map((width, line) => bar(width, .2 - line * .04)).join('') + '</div><div class="hgu-note-actions">' + ['arrow-back-up', 'repeat', 'mood-smile', 'quote', 'dots'].map(icon).join('') + '</div></div></div>').join('');
	q('[data-hgu-preview-bottom]').innerHTML = ['search', 'home', 'bell', 'eye'].map((mark, index) => index === 2 ? '<span data-active>' + icon(mark) + '</span>' : icon(mark)).join('');
	q('[data-hgu-preview-deck]').innerHTML = [['home', 'ホーム', ['100%', '70%', '90%', '55%']], ['world', 'ローカル', ['80%', '100%', '60%', '85%']], ['bell', '通知', ['70%', '90%', '50%']]].map(([mark, label, bars]) => '<div class="hgu-deck-col" aria-label="' + label + 'の列"><header>' + icon(mark) + bar('26px', .28) + '</header>' + bars.map((width, index) => bar(width, .16 - index * .015)).join('') + '</div>').join('');
	renderNav(); update();
	const cleanup = () => {
		if (disposed) return;
		disposed = true;
		for (const remove of listeners.splice(0)) remove();
		sectionObserver?.disconnect();
		visibleHeights.clear();
		if (drag) {
			const current = drag;
			drag = null;
			if (current.grip.hasPointerCapture?.(current.pointer)) current.grip.releasePointerCapture(current.pointer);
		}
		tool.querySelectorAll('[data-dragging]').forEach(node => node.removeAttribute('data-dragging'));
		tool.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
		tool.querySelectorAll('[data-hgu-section]').forEach(section => section.removeAttribute('id'));
		tool.querySelectorAll('[data-hgu-foldable-mode]').forEach(input => input.removeAttribute('name'));
		confirmTrigger = null;
		previewTrigger = null;
		pending = null;
		delete tool.dataset.ready;
		tool.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel());
		mounts.delete(tool);
	};
	mounts.set(tool, cleanup);
	return cleanup;
}

/** Mount only this diagram and release all scene-owned work on disposal. */
export function init(scene) {
	if (!scene) return () => {};
	const roots = scene.matches('[data-hgu]') ? [scene] : [...scene.querySelectorAll('[data-hgu]')];
	const cleanups = roots.map(root => initOne(root, scene.dataset.hataIntroInstance || 'guide'));
	return () => { for (const cleanup of cleanups) cleanup(); };
}
