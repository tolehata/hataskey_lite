/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: 絵文字申請の「保留」が壊れていないことを、実ソースを読んで確かめる。
 *
 * ⚠️このテストの主目的は「保留にした申請が二度と処理できなくなる」事故の再発防止。
 *   承認・却下・再確認のいずれかが status を pending だけで判定するように戻ると、
 *   保留中の申請が詰まって管理者が手を出せなくなる。実装当初その状態だった。
 * ⚠️保留は「入力値を保存したうえで後回しにする」機能なので、
 *   保留APIが承認APIと同じ項目を受け取っていることも検査する。
 *   片方だけ項目が増えると「承認では直せるが保留では消える」ことになる。
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

function readRepoFile(relativePath: string): string {
	// ⚠️import.meta.url は Vite にアセット参照として書き換えられるため使わない。
	//   vitest は packages/frontend で動くので、リポジトリ根はそこから2つ上。
	return fs.readFileSync(path.join(process.cwd(), '../..', relativePath), 'utf8');
}

describe('絵文字申請の保留', () => {
	const service = readRepoFile('packages/backend/src/core/FeedbackService.ts');
	const holdEndpoint = readRepoFile('packages/backend/src/server/api/endpoints/hata/feedback/emoji-requests/hold.ts');
	const approveEndpoint = readRepoFile('packages/backend/src/server/api/endpoints/hata/feedback/emoji-requests/approve.ts');
	const listEndpoint = readRepoFile('packages/backend/src/server/api/endpoints/hata/feedback/emoji-requests.ts');
	const endpointList = readRepoFile('packages/backend/src/server/api/endpoint-list.ts');
	const approveUi = readRepoFile('packages/frontend/src/components/HataFeedEmojiApprove.vue');
	const wizardUi = readRepoFile('packages/frontend/src/components/HataFeedEmojiWizard.vue');
	const feedPage = readRepoFile('packages/frontend/src/pages/hatafeed.vue');
	const feedEntity = readRepoFile('packages/backend/src/core/entities/FeedbackEntityService.ts');

	test('保留中の申請を承認・却下できる（詰まらせない）', () => {
		// ⚠️ここが pending だけに戻ると、保留した申請が二度と処理できなくなる。
		expect(service).toContain("if (req.status !== 'pending' && req.status !== 'held') return;");
		// 承認・却下の両方に入っていること（片方だけだと却下できない等の片翼落ちになる）
		const guards = service.match(/if \(req\.status !== 'pending' && req\.status !== 'held'\) return;/g) ?? [];
		expect(guards.length).toBeGreaterThanOrEqual(2);
		// 古い形の判定が残っていないこと
		expect(service).not.toContain("if (req.status !== 'pending') return;");
	});

	test('承認画面の再確認も保留中を通す', () => {
		// ⚠️ここが pending だけだと「もう処理済みです」と誤判定して操作を弾く。
		expect(approveUi).toContain("latest[0]?.status === 'pending' || latest[0]?.status === 'held'");
	});

	test('保留は入力値を保存する（承認と同じ項目を受け取る）', () => {
		for (const field of ['name', 'category', 'aliases', 'license', 'localOnly', 'isSensitive']) {
			expect(holdEndpoint).toContain(`${field}:`);
			expect(approveEndpoint).toContain(`${field}:`);
		}
		// 保留処理そのものが入力値を書き戻していること
		expect(service).toContain('public async holdEmojiRequest');
		expect(service).toContain("status: 'held',");
	});

	test('保留して次へ、が保存せず送るだけの実装に戻っていない', () => {
		// ⚠️当初は次の申請へ送るだけで何も保存していなかった。その形に戻さない。
		expect(approveUi).toContain("misskeyApi('hata/feedback/emoji-requests/hold'");
		expect(approveUi).toMatch(/async function holdAndNext\(\): Promise<void>/);
	});

	test('保留がスタッフ専用で、一覧の絞り込みと通知に載っている', () => {
		expect(holdEndpoint).toContain('requireModerator: true');
		expect(holdEndpoint).toContain('secure: true');
		expect(endpointList).toContain("'hata/feedback/emoji-requests/hold'");
		expect(listEndpoint).toContain("'held'");
		expect(service).toContain("'emojiHeld'");
	});

	test('保留中は未解決として扱う（解決済みの数え方に混ぜない）', () => {
		// 保留専用の列を増やさない代わりに resolved* を流用しているので、
		// その意図がコメントとして残っていること（読んだ人が「解決済み」と誤解しないため）。
		expect(service).toContain('status が held の間は「未解決」であり');
	});
	test('保留中がHataFeedの表示・絞り込み・色分けに揃っている', () => {
		const feed = readRepoFile('packages/frontend/src/utility/hatafeed.ts');
		const feedPage = readRepoFile('packages/frontend/src/pages/hatafeed.vue');
		// ⚠️型・ラベル・アイコン・絞り込み・色のどれかが欠けると
		//   「一覧には出るが絞り込めない」「未処理と見分けられない」になる。
		expect(feed).toContain("'pending' | 'held' | 'approved' | 'rejected'");
		expect(feed).toContain('held: copy.emojiHeld,');
		expect(feed).toContain("held: 'ti-player-pause',");
		expect(feedPage).toContain("{ value: 'held', label: emojiStatusLabel.held },");
		expect(feedPage).toContain('.hfEstIcon[data-est="held"]');
	});

	test('連続確認のキューに保留中も並ぶ', () => {
		// ⚠️ここを pending だけにすると、保留した申請が誰の目にも触れなくなる。
		expect(approveUi).toContain("item.status === 'pending' || item.status === 'held'");
	});

	test('保留も現在項目をキューから外し、同じ申請を無限巡回しない', () => {
		const holdBody = approveUi.slice(approveUi.indexOf('async function holdAndNext'), approveUi.indexOf('function showNext'));
		expect(holdBody).toContain('heldCount.value++;');
		expect(holdBody).toContain('removeCurrent();');
		expect(holdBody).not.toContain('currentIndex.value = (currentIndex.value + 1) % queue.value.length');
		expect(approveUi).toContain('held: heldCount.toString()');
		expect(approveUi).toContain('approved: approvedCount.toString()');
		expect(approveUi).toContain('rejected: rejectedCount.toString()');
	});

	test('管理一覧でリジェクト・保留理由を表示し、保留中を再確認できる', () => {
		expect(feedEntity).toContain('resolvedComment: src.resolvedComment');
		expect(feedPage).toContain('v-if="r.resolvedComment"');
		expect(feedPage).toContain("r.status === 'pending' || r.status === 'held'");
	});

	test('申請後にウィザードを閉じず次の絵文字へ進める', () => {
		expect(wizardUi).toContain('@click="submit(false)"');
		expect(wizardUi).toContain('function resetForNextRequest()');
		expect(wizardUi).toContain("misskeyApi('hata/feedback/emoji-quota'");
	});
});
