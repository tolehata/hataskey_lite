/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: 既存の rejected ステータスの申請レコードから、個人情報 (username / hashedPassword)
 * を一括削除する管理者向け API。新しい reject ロジック導入前に処理された申請には
 * これらの情報が残ってるため、運用開始時に管理者が手動でこの API を叩いて
 * 既存データのクリーンアップを行う。
 *
 * email は同一メールアドレスからの連続申請拒否のため、CleanProcessorService の
 * 既存ルール (rejected 90日) に従って削除されるので、ここでは触らない。
 */

import { IsNull, Not } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import type { MiMeta, RegistrationApplicationsRepository } from '@/models/_.js';
import { assertRegistrationApplicationsEnabled, registrationApplicationsDisabledError } from '@/core/registration-application-policy.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	requireAdmin: true,
	secure: true,
	kind: 'write:admin:cleanup-rejected-registrations',
	limit: { duration: 60 * 1000, max: 30 },
	errors: { registrationApplicationsDisabled: registrationApplicationsDisabledError },

	res: {
		type: 'object',
		properties: {
			// dry-runでは削除予定数、実行時は実際に個人情報を削除したレコード数
			cleanedCount: { type: 'integer' },
			// クリーンアップ対象だが、すでに個人情報削除済みでスキップしたレコード数
			alreadyCleanedCount: { type: 'integer' },
			// email を保持しつつ削除予定 (=これから Clean Processor が処理) のレコード数
			emailRetainedCount: { type: 'integer' },
			// クリーンアップ実行日時
			executedAt: { type: 'string' },
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		// true: 実際に削除実行、false (default): dry-run (件数のみ確認)
		execute: { type: 'boolean', default: false },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.meta)
		private serverMeta: MiMeta,

		@Inject(DI.registrationApplicationsRepository)
		private registrationApplicationsRepository: RegistrationApplicationsRepository,
	) {
		super(meta, paramDef, async (ps, me) => {
			assertRegistrationApplicationsEnabled(this.serverMeta);
			const now = new Date();

			// rejected ステータスかつ、username または hashedPassword がまだ残ってる (旧仕様で処理された) レコード
			const targets = await this.registrationApplicationsRepository.find({
				select: { id: true },
				where: [
					{ status: 'rejected', username: Not(IsNull()) },
					{ status: 'rejected', hashedPassword: Not(IsNull()) },
				],
			});

			// rejected ステータスで既に個人情報削除済みのレコード (新仕様で処理済み)
			const alreadyCleanedCount = await this.registrationApplicationsRepository.count({
				where: { status: 'rejected', personalDataDeletedAt: Not(IsNull()) },
			});

			// rejected ステータスで email がまだ残ってる (=Clean Processor の 90日経過待ち) レコード
			const emailRetainedCount = await this.registrationApplicationsRepository.count({
				where: { status: 'rejected', email: Not(IsNull()) },
			});

			assertRegistrationApplicationsEnabled(this.serverMeta);
			let cleanedCount = ps.execute ? 0 : targets.length;
			if (ps.execute && targets.length > 0) {
				// 実削除実行
				const targetIds = targets.map(t => t.id);
				const result = await this.registrationApplicationsRepository
					.createQueryBuilder()
					.update()
					.set({
						username: null,
						hashedPassword: null,
						personalDataDeletedAt: now,
					})
					.whereInIds(targetIds)
					.execute();
				cleanedCount = result.affected ?? 0;
			}

			return {
				cleanedCount,
				alreadyCleanedCount,
				emailRetainedCount,
				executedAt: now.toISOString(),
			};
		});
	}
}
