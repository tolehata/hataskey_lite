/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, expectTypeOf, test, vi } from 'vitest';
import { RegistrationApplicationNotificationService } from '@/core/RegistrationApplicationNotificationService.js';
import { NotificationService } from '@/core/NotificationService.js';
import type { ReviewStaff } from '@/core/RegistrationApplicationReviewService.js';
import type { MiNotification } from '@/models/Notification.js';
import locales from '../../../../locales/index.js';

const link = '/admin/registration-applications';
const genericData = {
	appAccessTokenId: null,
	customHeader: 'A new application',
	customBody: 'Review applications in the control panel',
	customIcon: null,
	customLink: link,
};

function fixture() {
	const members = new Map<string, ReviewStaff>([
		{ userId: 'admin', username: 'admin', name: null, isRoot: false, isAdministrator: true, eligibilityKey: 'admin-role' },
		{ userId: 'moderator', username: 'moderator', name: null, isRoot: false, isAdministrator: false, eligibilityKey: 'mod-role' },
		{ userId: 'root', username: 'root', name: null, isRoot: true, isAdministrator: true, eligibilityKey: 'root' },
	].map(member => [member.userId, member]));
	// Live membership, including conditional roles and account eligibility, is owned by the shared review service.
	const review = {
		getCurrentStaff: vi.fn(async () => [...members.values()]),
		getCurrentStaffMember: vi.fn(async (id: string) => members.get(id) ?? null),
	};
	const languages = new Map<string, string | null>();
	const profiles = { findOne: vi.fn(async ({ where }: { where: { userId: string } }) => ({ lang: languages.get(where.userId) ?? null })) };
	const notification = { createNotificationAsync: vi.fn().mockResolvedValue(null) };
	const logger = { warn: vi.fn() };
	const loggerService = { getLogger: vi.fn().mockReturnValue(logger) };
	const service = new RegistrationApplicationNotificationService(profiles as never, review as never, notification as never, loggerService as never);
	return { members, review, languages, profiles, notification, logger, service };
}

function standardNotificationFixture() {
	const profile = { notificationRecieveConfig: {} as Record<string, { type: string }> };
	const cache = { userProfileCache: { fetch: vi.fn().mockResolvedValue(profile) } };
	const redis = { xadd: vi.fn().mockResolvedValue('1000-0'), get: vi.fn().mockResolvedValue(null), incr: vi.fn().mockResolvedValue(1) };
	const packed = { id: 'notice', type: 'app', header: genericData.customHeader, body: genericData.customBody, link };
	const entity = { pack: vi.fn().mockResolvedValue(packed) };
	const id = { gen: vi.fn().mockReturnValue('notice'), parseFull: vi.fn().mockReturnValue({ date: 1000, additional: 0n }) };
	const stream = { publishMainStream: vi.fn() };
	const push = { pushNotification: vi.fn() };
	const service = new NotificationService({ perUserNotificationsMaxCount: 50 } as never, redis as never, {} as never, {} as never, {} as never, entity as never, id as never, stream as never, push as never, cache as never, {} as never);
	return { service, profile, cache, redis, entity, stream, push };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('registration application staff notifications', () => {
	test('root・管理者・モデレーターを共通の現任者一覧から取得し、候補が重複しても一度だけ送る', async () => {
		const f = fixture();
		f.review.getCurrentStaff.mockResolvedValue([...f.members.values(), f.members.get('root')!, f.members.get('moderator')!]);
		await f.service.notifyNewApplication();
		expect(f.review.getCurrentStaff).toHaveBeenCalledOnce();
		expect(f.notification.createNotificationAsync.mock.calls.map(([id]) => id)).toEqual(['admin', 'moderator', 'root']);
		expect(f.profiles.findOne.mock.calls.map(([query]) => query.where.userId)).toEqual(['admin', 'moderator', 'root']);
	});

	test('共通審査サービスが解決した条件付きモデレーターも投票依頼の対象に含む', async () => {
		const f = fixture();
		f.members.set('conditional-mod', { ...f.members.get('moderator')!, userId: 'conditional-mod', eligibilityKey: 'condition' });
		await f.service.notifyNewApplication();
		expect(f.notification.createNotificationAsync.mock.calls.map(([id]) => id)).toEqual(['admin', 'moderator', 'root', 'conditional-mod']);
	});

	test.each(['moderator', 'root', 'admin'])('%sが候補取得後に資格を失った場合はプロフィールも取得しない', async id => {
		const f = fixture();
		const candidates = [...f.members.values()];
		f.review.getCurrentStaff.mockImplementation(async () => {
			f.members.delete(id);
			return candidates;
		});
		await f.service.notifyNewApplication();
		expect(f.notification.createNotificationAsync.mock.calls.map(([recipient]) => recipient)).not.toContain(id);
		expect(f.profiles.findOne.mock.calls.map(([query]) => query.where.userId)).not.toContain(id);
	});

	test('言語取得中の資格喪失を共通の現任者判定で送信直前に再確認する', async () => {
		const f = fixture();
		f.profiles.findOne.mockImplementation(async ({ where }) => {
			f.members.delete(where.userId);
			return { lang: null };
		});
		await f.service.notifyNewApplication();
		expect(f.profiles.findOne).toHaveBeenCalledTimes(3);
		expect(f.review.getCurrentStaffMember.mock.calls.map(([id]) => id)).toEqual(['admin', 'admin', 'moderator', 'moderator', 'root', 'root']);
		expect(f.notification.createNotificationAsync).not.toHaveBeenCalled();
	});

	test('言語取得中に鯖缶からモデレーターへ変わった時は送信時点の投票案内を使う', async () => {
		const f = fixture();
		f.profiles.findOne.mockImplementation(async () => {
			f.members.get('root')!.isRoot = false;
			f.members.get('root')!.isAdministrator = false;
			return { lang: null };
		});
		await f.service.notifyNewApplication();
		expect(f.notification.createNotificationAsync).toHaveBeenCalledWith('root', 'app', expect.objectContaining({
			customBody: locales['ja-JP']._hata._registrationApplications.notificationVoteBody,
		}));
	});

	test.each(['ja-JP', 'en-US', 'zh-CN', 'fr-FR', 'unknown-language', 'constructor', null])('利用者の言語 %s と既存fallback辞書で権限別の本文を使う', async lang => {
		const f = fixture();
		for (const id of f.members.keys()) f.languages.set(id, lang);
		await f.service.notifyNewApplication();
		const copy = (lang != null && Object.hasOwn(locales, lang) ? locales[lang] : locales['ja-JP'])._hata._registrationApplications;
		for (const member of f.members.values()) {
			const body = member.isRoot ? copy.notificationBody : copy.notificationVoteBody;
			expect(typeof copy.notificationTitle).toBe('string');
			expect(copy.notificationTitle.length).toBeGreaterThan(0);
			expect(typeof body).toBe('string');
			expect(body.length).toBeGreaterThan(0);
			expect(f.notification.createNotificationAsync).toHaveBeenCalledWith(member.userId, 'app', {
				appAccessTokenId: null, customIcon: null, customLink: link,
				customHeader: copy.notificationTitle, customBody: body,
			});
			expect(f.profiles.findOne).toHaveBeenCalledWith({ where: { userId: member.userId }, select: { lang: true } });
		}
		expect(f.notification.createNotificationAsync).toHaveBeenCalledTimes(3);
	});

	test('引数なしの固定payload以外を許さず、PII混入を陽性対照で検出する', async () => {
		const f = fixture();
		await f.service.notifyNewApplication();
		const payloads = f.notification.createNotificationAsync.mock.calls.map(([, , data]) => data);
		const pii = ['applicant-id', 'applicant@example.test', 'PRIVATE_REASON', 'PRIVATE_CONTACT'];
		const containsPii = (value: unknown) => pii.some(sentinel => JSON.stringify(value).includes(sentinel));
		for (const sentinel of pii) expect(containsPii([{ ...payloads[0], customBody: sentinel }])).toBe(true);
		expect(containsPii(payloads)).toBe(false);
		for (const data of payloads) expect(Object.keys(data).sort()).toEqual(['appAccessTokenId', 'customBody', 'customHeader', 'customIcon', 'customLink']);
		const source = readFileSync(resolve(process.cwd(), 'src/core/RegistrationApplicationNotificationService.ts'), 'utf8');
		expect(source).toContain('public async notifyNewApplication(): Promise<void>');
	});

	test('通知の非同期失敗は固定ログだけにし、ほかの現任者への通知を続ける', async () => {
		const f = fixture();
		f.notification.createNotificationAsync.mockRejectedValueOnce(new Error('PRIVATE_CONTACT applicant@example.test'));
		await expect(f.service.notifyNewApplication()).resolves.toBeUndefined();
		expect(f.notification.createNotificationAsync.mock.calls.map(([id]) => id)).toEqual(['admin', 'moderator', 'root']);
		expect(f.logger.warn).toHaveBeenCalledExactlyOnceWith('Failed to deliver a registration application notification.');
	});

	test.each(['profiles', 'membership'] as const)('%sの取得失敗は申請へ伝播せず、取得失敗した相手には送らない', async target => {
		const f = fixture();
		const error = new Error('PRIVATE_REASON applicant@example.test');
		if (target === 'profiles') f.profiles.findOne.mockRejectedValue(error);
		else f.review.getCurrentStaffMember.mockRejectedValue(error);
		await expect(f.service.notifyNewApplication()).resolves.toBeUndefined();
		expect(f.notification.createNotificationAsync).not.toHaveBeenCalled();
		expect(f.logger.warn).toHaveBeenCalledTimes(3);
		for (const args of f.logger.warn.mock.calls) expect(args).toEqual(['Failed to deliver a registration application notification.']);
	});

	test('現任者の一覧取得の失敗も固定ログだけで終了する', async () => {
		const f = fixture();
		f.review.getCurrentStaff.mockRejectedValue(new Error('private database detail'));
		await expect(f.service.notifyNewApplication()).resolves.toBeUndefined();
		expect(f.notification.createNotificationAsync).not.toHaveBeenCalled();
		expect(f.logger.warn).toHaveBeenCalledExactlyOnceWith('Failed to resolve registration application notification recipients.');
	});
});

describe('awaitable standard app notifications', () => {
	test('引数なしの新着案内とawait可能な標準通知の型契約を保つ', () => {
		expectTypeOf<RegistrationApplicationNotificationService['notifyNewApplication']>().parameters.toEqualTypeOf<[]>();
		expectTypeOf<ReturnType<RegistrationApplicationNotificationService['notifyNewApplication']>>().toEqualTypeOf<Promise<void>>();
		expectTypeOf<ReturnType<NotificationService['createNotificationAsync']>>().toEqualTypeOf<Promise<MiNotification | null>>();
		expectTypeOf<ReturnType<NotificationService['createNotification']>>().toEqualTypeOf<void>();
	});

	test('標準app通知の受信しない設定を尊重して保存・配信をしない', async () => {
		const f = standardNotificationFixture();
		f.profile.notificationRecieveConfig.app = { type: 'never' };
		try {
			await expect(f.service.createNotificationAsync('admin', 'app', genericData)).resolves.toBeNull();
			expect(f.cache.userProfileCache.fetch).toHaveBeenCalledWith('admin');
			expect(f.redis.xadd).not.toHaveBeenCalled();
			expect(f.stream.publishMainStream).not.toHaveBeenCalled();
		} finally { f.service.onApplicationShutdown(); }
	});

	test('受信する陽性対照は既存Redis保存と標準stream配信を通る', async () => {
		const f = standardNotificationFixture();
		try {
			await expect(f.service.createNotificationAsync('admin', 'app', genericData)).resolves.toMatchObject({ type: 'app', ...genericData });
			expect(f.redis.xadd).toHaveBeenCalledOnce();
			expect(f.redis.xadd.mock.calls[0][0]).toBe('notificationTimeline:admin');
			expect(f.stream.publishMainStream).toHaveBeenCalledWith('admin', 'notification', expect.objectContaining({ link }));
		} finally { f.service.onApplicationShutdown(); }
	});

	test('Redisの非同期失敗をawait元が捕捉できる', async () => {
		const f = standardNotificationFixture();
		const error = new Error('private redis failure');
		f.redis.xadd.mockRejectedValue(error);
		try {
			await expect(f.service.createNotificationAsync('admin', 'app', genericData)).rejects.toBe(error);
			expect(f.stream.publishMainStream).not.toHaveBeenCalled();
		} finally { f.service.onApplicationShutdown(); }
	});
});
