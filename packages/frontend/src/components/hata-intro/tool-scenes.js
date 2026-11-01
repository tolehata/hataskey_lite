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
	'hg-card-scene': `
  <section class="hgt-tool-scene hgt-card-maker" data-hg-tool="card" aria-label="HataCardMakerの画面例">
    <div class="hg-screen hgt-c-shell">
      <header class="hgt-c-product">
        <div class="hgt-c-identity"><span class="hgt-c-mark" aria-hidden="true">H</span><strong class="hgt-c-wordmark">HataCardMaker</strong></div>
        <div class="hgt-c-meta"><i class="ti ti-shield-lock" aria-hidden="true"></i><span>プロフィール情報はこの画面だけで処理します</span></div>
      </header>
      <div class="hgt-c-workspace">
        <section class="hgt-c-editor" aria-label="カードの外観設定">
          <header><span class="hgt-c-eyebrow">DESIGN</span><h3>カードの外観設定</h3><p class="hgt-c-intro">あなたのHataskeyプロフィールをデジタル通行証カードに</p></header>
          <div class="hgt-c-setting">
            <strong class="hgt-c-label"><span class="hgt-pin">1</span>通常デザイン</strong>
            <div class="hgt-c-segment" role="group" aria-label="カードのデザイン">
              <button type="button" data-tool-action="card-style" data-style="standard" aria-pressed="true"><i class="ti ti-snowflake" aria-hidden="true"></i>通常デザイン</button>
              <button type="button" disabled aria-pressed="false"><i class="ti ti-lock" aria-hidden="true"></i>ゴールドデザイン</button>
            </div>
            <p class="hgt-c-lock"><i class="ti ti-lock" aria-hidden="true"></i><span>ゴールドデザインは利用開始から1年で解放されます</span></p>
          </div>
          <div class="hgt-c-setting"><strong class="hgt-c-label">アクセント</strong><div class="hgt-c-swatches" role="group" aria-label="アクセントの色">
            <button type="button" data-tool-action="card-accent" data-color="#4f8ff7" aria-label="青を選択" aria-pressed="true" style="--swatch:#4f8ff7"></button>
            <button type="button" data-tool-action="card-accent" data-color="#6abf8b" aria-label="緑を選択" aria-pressed="false" style="--swatch:#6abf8b"></button>
            <button type="button" data-tool-action="card-accent" data-color="#9b7bf0" aria-label="紫を選択" aria-pressed="false" style="--swatch:#9b7bf0"></button>
            <button type="button" data-tool-action="card-accent" data-color="#e76f9a" aria-label="ピンクを選択" aria-pressed="false" style="--swatch:#e76f9a"></button>
          </div></div>
          <label class="hgt-c-setting hgt-c-opacity"><span class="hgt-label-row"><strong class="hgt-c-label"><span class="hgt-pin">2</span>透明度</strong><output data-card-opacity-output>55%</output></span><input type="range" min="20" max="90" step="5" value="55" data-card-opacity aria-label="カードの透明度"></label>
          <div class="hgt-c-privacy"><i class="ti ti-shield-lock" aria-hidden="true"></i><div><strong>プロフィール情報はこの画面だけで処理します</strong><p>カード生成のための追加データをサーバーへ保存せず、画像はお使いの端末内で生成します</p></div></div>
        </section>
        <section class="hgt-c-preview" aria-label="カードのプレビュー">
          <header class="hgt-c-preview-head"><div><span class="hgt-c-eyebrow">LIVE PREVIEW</span><h3>カードのプレビュー</h3></div><p><i class="ti ti-axis-x" aria-hidden="true"></i><span>カードをドラッグ、またはスワイプで傾けられます</span></p></header>
          <div class="hgt-c-stage"><div class="hgt-c-tilt" data-card-tilt>
            <article class="hgt-c-face" data-card-face aria-label="はるの架空プロフィールカード">
              <svg class="hgt-c-banner" viewBox="0 0 560 344" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="560" height="344" fill="#b9d6df"/><circle cx="435" cy="90" r="46" fill="#f3dca8"/><path d="M0 270 145 74 340 295 480 154 560 239V344H0Z" fill="#608f8b"/><path d="m59 193 86-119 106 146-96-50Z" fill="#edf3ee"/><path d="M0 289Q183 224 370 285T560 277V344H0Z" fill="#52717f"/></svg>
              <div class="hgt-c-brushed"></div><div class="hgt-c-shine" data-card-shine></div><div class="hgt-c-pass">Hataskey 通行証</div>
              <div class="hgt-c-inner"><div class="hgt-c-avatar"><svg viewBox="0 0 100 100" role="img" aria-label="架空の風景アイコン"><rect width="100" height="100" fill="#d4e8e8"/><circle cx="70" cy="30" r="15" fill="#f3d496"/><path d="M-8 88 31 30 79 91Z" fill="#73958b"/><path d="m17 51 14-21 19 24-19-8Z" fill="#f4f4ed"/><path d="M37 100 75 49 110 92V100Z" fill="#537d76"/><path d="M0 84Q35 73 63 84T100 86V100H0Z" fill="#a5c5ce"/><path d="M22 90h20m12 5h21m-61 2h9" stroke="#e7f1eb" stroke-width="2" stroke-linecap="round"/></svg></div><div class="hgt-c-info"><strong>はる</strong><span>@haru@example.invalid</span><small>2026/08/20 登録</small><em>Hataskey Member</em></div></div>
              <div class="hgt-c-code"><svg viewBox="0 0 37 37" shape-rendering="crispEdges" role="img" aria-label="架空プロフィール example.invalid の二次元コード"><rect width="37" height="37" fill="#fff"/><path data-card-code-matrix fill="#18212b" d="M4 4h7v1h-7zM12 4h1v1h-1zM14 4h6v1h-6zM21 4h2v1h-2zM26 4h7v1h-7zM4 5h1v1h-1zM10 5h1v1h-1zM15 5h1v1h-1zM19 5h1v1h-1zM22 5h1v1h-1zM24 5h1v1h-1zM26 5h1v1h-1zM32 5h1v1h-1zM4 6h1v1h-1zM6 6h3v1h-3zM10 6h1v1h-1zM12 6h3v1h-3zM17 6h1v1h-1zM21 6h4v1h-4zM26 6h1v1h-1zM28 6h3v1h-3zM32 6h1v1h-1zM4 7h1v1h-1zM6 7h3v1h-3zM10 7h1v1h-1zM13 7h2v1h-2zM19 7h3v1h-3zM23 7h1v1h-1zM26 7h1v1h-1zM28 7h3v1h-3zM32 7h1v1h-1zM4 8h1v1h-1zM6 8h3v1h-3zM10 8h1v1h-1zM19 8h2v1h-2zM22 8h1v1h-1zM26 8h1v1h-1zM28 8h3v1h-3zM32 8h1v1h-1zM4 9h1v1h-1zM10 9h1v1h-1zM12 9h1v1h-1zM14 9h2v1h-2zM17 9h2v1h-2zM20 9h3v1h-3zM26 9h1v1h-1zM32 9h1v1h-1zM4 10h7v1h-7zM12 10h1v1h-1zM14 10h1v1h-1zM16 10h1v1h-1zM18 10h1v1h-1zM20 10h1v1h-1zM22 10h1v1h-1zM24 10h1v1h-1zM26 10h7v1h-7zM13 11h1v1h-1zM15 11h1v1h-1zM17 11h1v1h-1zM22 11h1v1h-1zM24 11h1v1h-1zM4 12h1v1h-1zM6 12h1v1h-1zM10 12h2v1h-2zM13 12h2v1h-2zM17 12h1v1h-1zM19 12h3v1h-3zM24 12h1v1h-1zM27 12h1v1h-1zM30 12h1v1h-1zM32 12h1v1h-1zM4 13h2v1h-2zM7 13h2v1h-2zM13 13h1v1h-1zM15 13h1v1h-1zM20 13h1v1h-1zM23 13h5v1h-5zM31 13h2v1h-2zM5 14h3v1h-3zM9 14h6v1h-6zM17 14h2v1h-2zM20 14h4v1h-4zM25 14h2v1h-2zM28 14h3v1h-3zM32 14h1v1h-1zM6 15h1v1h-1zM11 15h1v1h-1zM15 15h2v1h-2zM18 15h3v1h-3zM27 15h3v1h-3zM5 16h4v1h-4zM10 16h1v1h-1zM12 16h1v1h-1zM16 16h3v1h-3zM23 16h2v1h-2zM26 16h2v1h-2zM32 16h1v1h-1zM4 17h2v1h-2zM11 17h1v1h-1zM13 17h1v1h-1zM15 17h4v1h-4zM21 17h1v1h-1zM23 17h2v1h-2zM26 17h2v1h-2zM31 17h2v1h-2zM4 18h8v1h-8zM13 18h1v1h-1zM15 18h2v1h-2zM19 18h1v1h-1zM21 18h4v1h-4zM28 18h1v1h-1zM32 18h1v1h-1zM5 19h5v1h-5zM11 19h2v1h-2zM15 19h3v1h-3zM23 19h2v1h-2zM4 20h2v1h-2zM8 20h1v1h-1zM10 20h1v1h-1zM13 20h1v1h-1zM15 20h1v1h-1zM17 20h1v1h-1zM19 20h2v1h-2zM23 20h1v1h-1zM26 20h2v1h-2zM32 20h1v1h-1zM6 21h1v1h-1zM8 21h2v1h-2zM11 21h1v1h-1zM14 21h3v1h-3zM20 21h1v1h-1zM23 21h2v1h-2zM26 21h2v1h-2zM30 21h3v1h-3zM4 22h4v1h-4zM10 22h1v1h-1zM13 22h1v1h-1zM17 22h2v1h-2zM20 22h5v1h-5zM26 22h4v1h-4zM32 22h1v1h-1zM8 23h2v1h-2zM11 23h1v1h-1zM13 23h1v1h-1zM15 23h1v1h-1zM18 23h3v1h-3zM22 23h4v1h-4zM28 23h1v1h-1zM4 24h3v1h-3zM10 24h1v1h-1zM12 24h2v1h-2zM17 24h2v1h-2zM24 24h6v1h-6zM31 24h1v1h-1zM12 25h3v1h-3zM16 25h3v1h-3zM22 25h1v1h-1zM24 25h1v1h-1zM28 25h3v1h-3zM32 25h1v1h-1zM4 26h7v1h-7zM12 26h3v1h-3zM19 26h1v1h-1zM22 26h1v1h-1zM24 26h1v1h-1zM26 26h1v1h-1zM28 26h1v1h-1zM32 26h1v1h-1zM4 27h1v1h-1zM10 27h1v1h-1zM13 27h1v1h-1zM15 27h3v1h-3zM23 27h2v1h-2zM28 27h1v1h-1zM31 27h1v1h-1zM4 28h1v1h-1zM6 28h3v1h-3zM10 28h1v1h-1zM16 28h2v1h-2zM19 28h2v1h-2zM23 28h7v1h-7zM4 29h1v1h-1zM6 29h3v1h-3zM10 29h1v1h-1zM13 29h2v1h-2zM17 29h1v1h-1zM20 29h1v1h-1zM22 29h2v1h-2zM27 29h5v1h-5zM4 30h1v1h-1zM6 30h3v1h-3zM10 30h1v1h-1zM12 30h2v1h-2zM15 30h4v1h-4zM20 30h2v1h-2zM23 30h1v1h-1zM25 30h1v1h-1zM28 30h1v1h-1zM31 30h2v1h-2zM4 31h1v1h-1zM10 31h1v1h-1zM13 31h2v1h-2zM16 31h5v1h-5zM22 31h1v1h-1zM24 31h4v1h-4zM29 31h1v1h-1zM4 32h7v1h-7zM12 32h2v1h-2zM16 32h2v1h-2zM20 32h3v1h-3zM24 32h2v1h-2zM28 32h2v1h-2zM32 32h1v1h-1z"/></svg></div>
              <div class="hgt-c-dots" aria-hidden="true"><b></b><b></b><b></b></div>
            </article>
          </div></div>
          <div class="hgt-c-actions"><button type="button" data-tool-action="card-reset"><i class="ti ti-rotate-2" aria-hidden="true"></i>傾きを戻す</button><button type="button" data-tool-action="card-save"><span class="hgt-pin">3</span><i class="ti ti-download" aria-hidden="true"></i>画像を保存</button></div>
        </section>
      </div>
    </div>
    <p class="hgt-scene-note"><i class="ti ti-info-circle" aria-hidden="true"></i><span><strong>架空プロフィールで再現した画面例</strong>\u3000はる · @haru@example.invalid · 2026/08/20 登録 · Hataskey Member。<br>狭いカードでは一部を省略するため、同じ内容をここにも記載。<br>名前・アバター・登録日はプロフィールから入り、この画面に編集欄はない。<br>二次元コードは説明用の存在しないURL</span></p>
    <p class="hgt-scene-note" data-tool-feedback="card" role="status" aria-live="polite">操作の例です。<br>本体のプロフィールや設定は変更しません</p>
  </section>
`,
};

const mounts = new WeakMap();
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const validColor = value => /^#[0-9a-f]{6}$/i.test(value);
const status = (tool, message) => {
	const output = tool.querySelector('[data-tool-feedback]');
	if (output) output.innerHTML = hataskGuideProse(message);
};

function initCard(tool) {
	const existing = mounts.get(tool);
	if (existing) return existing;
	const listeners = [];
	const on = (target, type, handler) => {
		target.addEventListener(type, handler);
		listeners.push(() => target.removeEventListener(type, handler));
	};
	tool.dataset.toolReady = 'true';
	const face = tool.querySelector('[data-card-face]');
	const tilt = tool.querySelector('[data-card-tilt]');
	const shine = tool.querySelector('[data-card-shine]');
	let color = '#4f8ff7';
	let drag = null;
	let angles = { x: -5, y: -8 };
	tilt.setAttribute('data-tool-ready', 'true');

	function setAngles(x, y) {
		angles = { x: clamp(x, -22, 22), y: clamp(y, -24, 24) };
		face.style.transform = `perspective(1400px) rotateX(${angles.x}deg) rotateY(${angles.y}deg) translateZ(0)`;
		shine.style.background = `radial-gradient(circle at ${50 + angles.y * 1.6}% ${50 - angles.x * 1.6}%,rgba(255,255,255,.58),transparent 55%)`;
	}

	on(tool, 'click', event => {
		const button = event.target.closest('button[data-tool-action]');
		if (!button || !tool.contains(button)) return;
		const action = button.dataset.toolAction;
		if (action === 'card-accent' && validColor(button.dataset.color || '')) {
			color = button.dataset.color;
			tool.style.setProperty('--maker-accent', color);
			tool.querySelectorAll('[data-tool-action="card-accent"]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
			status(tool, 'この例のカードのアクセントを変更したよ。本体の設定は変わりません');
		} else if (action === 'card-reset') {
			setAngles(0, 0);
			status(tool, 'この例のカードの傾きを戻したよ');
		} else if (action === 'card-save') {
			status(tool, 'ここでは画像を保存・ダウンロードしません。本体のHataCardMakerで「画像を保存」を押すとPNGを保存できます');
		} else if (action === 'card-style') {
			status(tool, '通常デザインの例です。ゴールドデザインは本体で利用開始から1年後に選べます');
		}
	});
	on(tool, 'input', event => {
		if (!event.target.matches('[data-card-opacity]')) return;
		const parsed = Number(event.target.value);
		const value = Math.round(clamp(Number.isFinite(parsed) ? parsed : 55, 20, 90) / 5) * 5;
		event.target.value = String(value);
		tool.style.setProperty('--maker-opacity', String(value / 100));
		tool.style.setProperty('--maker-tint-a', `${value * .32}%`);
		tool.style.setProperty('--maker-tint-b', `${value * .18}%`);
		tool.querySelector('[data-card-opacity-output]').textContent = `${value}%`;
		status(tool, `この例の透明度は ${value}% 。本体と同じく、値が大きいほどカード面が不透明になります`);
	});
	on(tilt, 'pointerdown', event => {
		if (event.button !== 0) return;
		drag = { x: event.clientX, y: event.clientY, baseX: angles.x, baseY: angles.y, pointerId: event.pointerId };
		tilt.setAttribute('data-dragging', 'true');
		face.style.transition = 'none';
		tilt.setPointerCapture?.(event.pointerId);
	});
	on(tilt, 'pointermove', event => {
		if (!drag || drag.pointerId !== event.pointerId) return;
		setAngles(drag.baseX - (event.clientY - drag.y) * .12, drag.baseY + (event.clientX - drag.x) * .12);
	});
	const stop = event => {
		if (!drag || drag.pointerId !== event.pointerId) return;
		drag = null;
		tilt.removeAttribute('data-dragging');
		face.style.removeProperty('transition');
		if (tilt.hasPointerCapture?.(event.pointerId)) tilt.releasePointerCapture(event.pointerId);
	};
	on(tilt, 'pointerup', stop);
	on(tilt, 'pointercancel', stop);
	on(tilt, 'lostpointercapture', stop);
	let disposed = false;
	const cleanup = () => {
		if (disposed) return;
		disposed = true;
		for (const remove of listeners.splice(0)) remove();
		if (drag) stop({ pointerId: drag.pointerId });
		delete tool.dataset.toolReady;
		tilt.removeAttribute('data-tool-ready');
		tool.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel());
		mounts.delete(tool);
	};
	mounts.set(tool, cleanup);
	return cleanup;
}

/** Mount only this diagram and release all scene-owned work on disposal. */
export function init(scene) {
	if (!scene) return () => {};
	const roots = scene.matches('[data-hg-tool="card"]') ? [scene] : [...scene.querySelectorAll('[data-hg-tool="card"]')];
	const cleanups = roots.map(root => initCard(root));
	return () => { for (const cleanup of cleanups) cleanup(); };
}
