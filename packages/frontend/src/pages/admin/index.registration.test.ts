/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { effectScope, reactive, ref, watch } from 'vue';
import type { EffectScope, Ref } from 'vue';
import { afterEach, describe, expect, test, vi } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/pages/admin/index.vue'), 'utf8');
const indicatorSource = source.match(/const thereIsPendingRegistration = ref\(false\);[\s\S]*?(?=const NARROW_THRESHOLD)/)?.[0];
if (!indicatorSource) throw new Error('申請インジケーターの実装が見つかりません');
const scopes: EffectScope[] = [];

function deferred() {
	let resolveRequest: (apps: { id: string }[]) => void = () => {};
	let rejectRequest: (reason: Error) => void = () => {};
	const promise = new Promise<{ id: string }[]>((resolvePromise, rejectPromise) => {
		resolveRequest = resolvePromise;
		rejectRequest = rejectPromise;
	});
	return { promise, resolve: resolveRequest, reject: rejectRequest };
}

function mountIndicator(disableRegistration?: boolean) {
	const instance = reactive({ disableRegistration, registrationClosed: false });
	const requests: ReturnType<typeof deferred>[] = [];
	const misskeyApi = vi.fn(() => {
		const request = deferred();
		requests.push(request);
		return request.promise;
	});
	const scope = effectScope();
	scopes.push(scope);
	const indicator = scope.run(() => runInNewContext(`${indicatorSource}\nthereIsPendingRegistration;`, {
		instance, ref, watch, misskeyApi,
	})) as Ref<boolean>;
	return { instance, indicator, misskeyApi, requests, scope };
}

afterEach(() => {
	for (const scope of scopes.splice(0)) scope.stop();
});

describe('管理トップの登録申請インジケーター', () => {
	test('モデレーターには投票依頼、管理者には既存の申請案内を表示する', () => {
		const expression = source.match(/<MkInfo v-if="!instance.registrationClosed[^>]*>\{\{ ([^}]+) \}\}/)?.[1];
		if (!expression) throw new Error('申請通知の案内文が見つかりません');
		const i18n = { ts: { _hata: { _adminCommon: { pendingRegistration: '未処理の参加申請があります' }, _registrationApplications: { notificationVoteBody: '参加申請に賛成するかどうか、投票をお願いします。' } } } };
		expect(runInNewContext(expression, { i18n, iAmAdmin: false })).toBe('参加申請に賛成するかどうか、投票をお願いします。');
		expect(runInNewContext(expression, { i18n, iAmAdmin: true })).toBe('未処理の参加申請があります');
	});

	test('完全停止後に届いた旧申請結果を表示せず、再開時は取得し直す', async () => {
		const { instance, indicator, requests, misskeyApi } = mountIndicator(true);
		instance.registrationClosed = true;
		requests[0].resolve([{ id: 'pending' }]);
		await Promise.resolve();
		expect(indicator.value).toBe(false);
		instance.registrationClosed = false;
		expect(misskeyApi).toHaveBeenCalledTimes(2);
	});

	test.each([false, undefined])('一般開放または状態未取得(%s)では申請一覧を取得しない', initial => {
		const { indicator, misskeyApi } = mountIndicator(initial);
		expect(indicator.value).toBe(false);
		expect(misskeyApi).not.toHaveBeenCalled();
	});

	test('一般開放を停止している時だけ未処理の存在を取得して表示する', async () => {
		const { indicator, misskeyApi, requests } = mountIndicator(true);
		expect(misskeyApi).toHaveBeenCalledTimes(1);
		expect(misskeyApi).toHaveBeenCalledWith('admin/registration-applications', { status: 'pending', limit: 1, needsReview: true });
		requests[0].resolve([{ id: 'pending-1' }]);
		await Promise.resolve();
		expect(indicator.value).toBe(true);
	});

	test('一般開放へ変わった時点でバッジを消し、追加取得しない', async () => {
		const { instance, indicator, misskeyApi, requests } = mountIndicator(true);
		requests[0].resolve([{ id: 'pending-1' }]);
		await Promise.resolve();
		expect(indicator.value).toBe(true);
		instance.disableRegistration = false;
		expect(indicator.value).toBe(false);
		expect(misskeyApi).toHaveBeenCalledTimes(1);
	});

	test('一般開放後に届いた旧リクエストの応答を捨てる', async () => {
		const { instance, indicator, requests } = mountIndicator(true);
		instance.disableRegistration = false;
		requests[0].resolve([{ id: 'old-pending' }]);
		await Promise.resolve();
		expect(indicator.value).toBe(false);
	});

	test('再び一般開放を停止した時は再取得し、前の世代の応答を混ぜない', async () => {
		const { instance, indicator, misskeyApi, requests } = mountIndicator(true);
		instance.disableRegistration = false;
		instance.disableRegistration = true;
		expect(misskeyApi).toHaveBeenCalledTimes(2);
		requests[1].resolve([]);
		await Promise.resolve();
		requests[0].resolve([{ id: 'old-pending' }]);
		await Promise.resolve();
		expect(indicator.value).toBe(false);
	});

	test('管理トップを閉じた後の応答で状態を更新しない', async () => {
		const { scope, indicator, requests } = mountIndicator(true);
		scope.stop();
		requests[0].resolve([{ id: 'pending-after-close' }]);
		await Promise.resolve();
		expect(indicator.value).toBe(false);
	});

	test('取得が拒否された時は未処理バッジを表示しない', async () => {
		const { indicator, requests } = mountIndicator(true);
		requests[0].reject(new Error('REGISTRATION_APPLICATIONS_DISABLED'));
		await Promise.resolve();
		await Promise.resolve();
		expect(indicator.value).toBe(false);
	});

	test('一般開放中も管理画面への入口は残し、告知とバッジだけを制御する', () => {
		expect(source).toContain('v-if="!instance.registrationClosed && instance.disableRegistration === true && thereIsPendingRegistration"');
		expect(source).toContain('indicated: !instance.registrationClosed && instance.disableRegistration === true && thereIsPendingRegistration.value');
		expect(source).toMatch(/\}, \{\s*icon: 'ti ti-user-check',\s*text: i18n\.ts\._hata\._adminCommon\.registrationManagement,\s*to: '\/admin\/registration-applications'/);
	});
});
