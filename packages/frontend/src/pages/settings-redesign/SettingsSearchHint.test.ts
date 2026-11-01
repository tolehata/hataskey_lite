/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { createSearchHintController } from './settings-search-hint.js';

// ⚠️process.cwd() 基準。new URL(import.meta.url) は Vite に書き換えられて
//   ファイルとして読めなくなる。
const shellSource = readFileSync(resolve(process.cwd(), 'src/pages/settings-redesign/index.vue'), 'utf8');

function makeClock() {
	let now = 0;
	let seq = 1;
	const timers = new Map<number, { at: number; fn: () => void }>();
	return {
		setTimer: (fn: () => void, ms: number) => {
			const id = seq++;
			timers.set(id, { at: now + ms, fn });
			return id;
		},
		clearTimer: (id: number) => { timers.delete(id); },
		advance: (ms: number) => {
			const target = now + ms;
			for (;;) {
				const due = [...timers.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
				if (due == null) break;
				timers.delete(due[0]);
				now = due[1].at;
				due[1].fn();
			}
			now = target;
		},
	};
}

function setup(eligible: () => boolean = () => true) {
	const clock = makeClock();
	const seen: boolean[] = [];
	const controller = createSearchHintController({
		idleMs: 15000,
		visibleMs: 8000,
		extensionMs: 20000,
		maxExtensions: 3,
		eligible,
		onChange: (v) => seen.push(v),
		setTimer: clock.setTimer,
		clearTimer: clock.clearTimer,
	});
	return { clock, seen, controller };
}

describe('設定の検索案内', () => {
	test('15秒なにも変わらなければ案内を出し、8秒で見出しへ戻す', () => {
		const { clock, controller } = setup();
		controller.restart();

		clock.advance(14999);
		expect(controller.visible()).toBe(false); // まだ出さない

		clock.advance(1);
		expect(controller.visible()).toBe(true);

		clock.advance(7999);
		expect(controller.visible()).toBe(true);

		clock.advance(1);
		expect(controller.visible()).toBe(false);
	});

	test('戻したあとは、また15秒待ってから出す（続けざまに出さない）', () => {
		const { clock, controller } = setup();
		controller.restart();
		clock.advance(23000); // 出して、戻すところまで
		expect(controller.visible()).toBe(false);

		clock.advance(14999);
		expect(controller.visible()).toBe(false);
		clock.advance(1);
		expect(controller.visible()).toBe(true);
	});

	test('数え直すと待ち時間は最初から', () => {
		const { clock, controller } = setup();
		controller.restart();
		clock.advance(14000);
		controller.restart(); // 設定をいじった
		clock.advance(14999);
		expect(controller.visible()).toBe(false);
		clock.advance(1);
		expect(controller.visible()).toBe(true);
	});

	test('出ている最中に設定をいじったら、すぐ見出しへ戻す', () => {
		const { clock, controller } = setup();
		controller.restart();
		clock.advance(15000);
		expect(controller.visible()).toBe(true);
		controller.restart();
		expect(controller.visible()).toBe(false);
	});

	test('出してよい場面でなければ、いつまで待っても出さない', () => {
		const { clock, controller } = setup(() => false);
		controller.restart();
		clock.advance(600000);
		expect(controller.visible()).toBe(false);
	});

	test('待っているあいだに画面が広くなったら出さない', () => {
		let eligible = true;
		const clock = makeClock();
		const controller = createSearchHintController({
			idleMs: 15000, visibleMs: 8000,
			eligible: () => eligible,
			onChange: () => {},
			setTimer: clock.setTimer, clearTimer: clock.clearTimer,
		});
		controller.restart();
		clock.advance(14000);
		eligible = false; // 窓を広げた
		clock.advance(2000);
		expect(controller.visible()).toBe(false);
	});

	test('片付けたら出さない。ただし数え直せばまた動く', () => {
		const { clock, controller } = setup();
		controller.restart();
		controller.stop();
		clock.advance(600000);
		expect(controller.visible()).toBe(false);

		// ⚠️永久停止にしてはいけない。keep-alive で画面へ戻ったとき、
		//   二度と案内が出なくなる。
		controller.restart();
		clock.advance(15000);
		expect(controller.visible()).toBe(true);
	});

	test('見え方が変わったときだけ知らせる', () => {
		const { clock, seen, controller } = setup();
		controller.restart();
		expect(seen).toEqual([]); // 変わっていないので黙っている
		clock.advance(15000);
		clock.advance(8000);
		expect(seen).toEqual([true, false]);
	});
});

describe('しつこくしないための決まり', () => {
	test('案内を見たあとに検索を使ったら、その滞在のあいだはもう出さない', () => {
		// ⚠️「その瞬間に出ていないこと」で見てはいけない。長く進めると
		//   出す→戻すを繰り返すので、最後の値はたまたま false になりうる。
		//   出した**回数**で見ること（この取り違えで陽性対照が素通りした）。
		const { clock, seen, controller } = setup();
		controller.restart();
		clock.advance(15000);
		expect(seen.filter(v => v).length).toBe(1);

		controller.noteSearchUsed(); // 検索ボタンへ手が伸びた
		expect(controller.visible()).toBe(false);

		// 項目へ移った／検索をやめて一覧へ戻った、どちらも滞在は続いている
		controller.restart();
		clock.advance(600000);
		expect(seen.filter(v => v).length).toBe(1); // 増えていない
	});

	test('案内を見ていない人の検索では黙らせない', () => {
		// ⚠️ここを取り違えると、案内が一度も届かない人が出る。
		const { clock, controller } = setup();
		controller.restart();
		clock.advance(5000);
		controller.noteSearchUsed(); // まだ案内は出ていない
		controller.restart();
		clock.advance(15000);
		expect(controller.visible()).toBe(true);
	});

	test('設定から出て入り直すと、20秒長く待ってから出す', () => {
		const { clock, controller } = setup();
		controller.restart();
		clock.advance(15000);
		controller.noteSearchUsed();

		controller.noteLeftSettings(); // 設定から離脱
		expect(controller.idleMs()).toBe(35000);

		controller.restart(); // 入り直して詳細画面へ
		clock.advance(34999);
		expect(controller.visible()).toBe(false);
		clock.advance(1);
		expect(controller.visible()).toBe(true);
	});

	test('検索を使っていなければ、出入りしても待ち時間は延びない', () => {
		const { controller } = setup();
		controller.restart();
		controller.noteLeftSettings();
		controller.noteLeftSettings();
		expect(controller.idleMs()).toBe(15000);
	});

	test('延ばせるのは読み込み直すまでに3回まで（15→35→55→75秒で頭打ち）', () => {
		const { clock, controller } = setup();
		const seenDelays: number[] = [controller.idleMs()];
		for (let i = 0; i < 5; i++) {
			controller.restart();
			clock.advance(controller.idleMs()); // 案内が出るまで待つ
			expect(controller.visible()).toBe(true);
			controller.noteSearchUsed();
			controller.noteLeftSettings();
			seenDelays.push(controller.idleMs());
		}
		expect(seenDelays).toEqual([15000, 35000, 55000, 75000, 75000, 75000]);
	});

	test('注文どおりの一連の流れ', () => {
		const { clock, seen, controller } = setup();

		// 設定 → 詳細 → 15秒待って案内が出る
		controller.restart();
		clock.advance(15000);
		expect(controller.visible()).toBe(true);
		expect(seen.filter(v => v).length).toBe(1);

		// 検索ボタンで検索し、項目へ移る（または中断して一覧へ戻る）
		controller.noteSearchUsed();
		controller.restart();

		// また詳細へ。ここでは出さない（出した回数が増えないことで見る）
		controller.restart();
		clock.advance(600000);
		expect(seen.filter(v => v).length).toBe(1);

		// 設定から離脱 → また設定へ → 詳細へ
		controller.noteLeftSettings();
		controller.restart();

		// 今度は20秒長く待ってから出る
		clock.advance(34999);
		expect(controller.visible()).toBe(false);
		clock.advance(1);
		expect(controller.visible()).toBe(true);
	});
});

describe('画面への繋ぎ込み', () => {
	// ⚠️時計が正しくても、画面から呼ばなければ何も起きない。
	//   実際に一度、起動時に数え始めておらず「いつまでも変わらない」状態になった。
	test('狭さと現在の画面を見て数え直す（起動直後も含む）', () => {
		expect(shellSource).toContain('watch([compact, currentFullPath], () => searchHintController.restart(), { immediate: true });');
	});

	test('設定の値そのものを見張る（refのまま JSON にしても依存は登録されない）', () => {
		expect(shellSource).toContain('Object.values(prefer.r).map(entry => entry.value)');
		expect(shellSource).not.toContain('JSON.stringify(prefer.r)');
	});

	test('検索を使ったことと、設定から出たことを controller へ伝える', () => {
		// ⚠️伝え忘れると、抑止も延長も一切効かない（時計だけ正しくても意味がない）。
		expect(shellSource).toContain('searchHintController.noteSearchUsed();');
		expect(shellSource).toContain('searchHintController.noteLeftSettings();');
		expect(shellSource).toContain('extensionMs: 20000,');
		expect(shellSource).toContain('maxExtensions: 3,');
	});

	test('画面を離れるときに片付ける', () => {
		expect(shellSource).toContain('searchHintController.stop();');
	});

	test('案内は常設の検索ボタン内に表示し、カテゴリ画面でも同じ時計を使う', () => {
		expect(shellSource).toContain('eligible: () => compact.value && !showOverview.value');
		expect(shellSource).toContain('showSearchHint ? copy.searchHint : copy.searchTrigger');
		const searchButton = shellSource.match(/<button ref="searchButtonEl"[^>]*>[\s\S]*?<\/button>/u)?.[0];
		expect(searchButton).toBeDefined();
		expect(searchButton).toContain('@click="openSearch"');
		expect(searchButton).toContain('showSearchHint');
		expect(searchButton).not.toContain('v-if=');
	});

	test('動きを減らす設定では止まる', () => {
		// ⚠️個別に書かず、この囲みが子孫の animation ごと止めている。
		//   ここを消すと設定カードなどの子孫の動きが残る。
		const scoped = shellSource.slice(shellSource.indexOf(".scope[data-motion-enabled='false'] :deep(*) {"));
		expect(scoped.slice(0, 260)).toContain('animation: none !important;');
	});
});
