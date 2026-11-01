/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Entity, PrimaryColumn, Column, Index, JoinColumn, ManyToOne, Check } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

export type RegistrationReviewActor = { userId: string; name: string | null; username: string | null };
export type RegistrationRejectionNotificationStatus = 'pending' | 'sending' | 'sent' | 'failed';
export type RegistrationReviewVote = RegistrationReviewActor & {
	choice: 'agree' | 'oppose';
	reason: string;
	votedAt: string;
	eligibilityKey: string;
};
export type RegistrationReviewDecision = {
	actor: RegistrationReviewActor;
	at: string;
	voterIds: string[];
	voters: Array<RegistrationReviewActor & { choice: 'agree' | 'oppose' | null; votedAt: string | null }>;
};

@Entity('registration_application')
@Check('CHK_registration_review_votes_object', 'jsonb_typeof("reviewVotes") = \'object\'')
@Check('CHK_registration_application_pending_contacts', '"status" = \'pending\' OR "additionalContacts" IS NULL')
export class MiRegistrationApplication {
	@PrimaryColumn(id())
	public id: string;

	@Column('varchar', {
		length: 1024,
	})
	public reason: string;

	/**
	 * 入力時の大文字・小文字を保持する。ID の重複は大小文字を区別せず判定する。
	 * 旗鯖fork: 申請が拒否された場合、reject 時点で null にセットされる
	 * (利用者の ID/パスワード情報を即時削除するため)
	 */
	@Index('IDX_reg_app_username_lower_pending', { synchronize: false })
	@Column('varchar', {
		length: 128,
		nullable: true,
	})
	public username: string | null;

	/**
	 * 旗鯖fork: 申請が拒否された場合、reject 時点で null にセットされる
	 * (利用者のパスワード情報を即時削除するため)
	 */
	@Column('varchar', {
		length: 256,
		nullable: true,
	})
	public hashedPassword: string | null;

	/**
	 * 旗鯖fork: 申請が拒否された場合も、同一メールアドレスからの連続申請を拒否するため
	 * 一定期間 (Clean Processor の rejected レコード保持期間 = 90日) は保持される
	 */
	@Column('varchar', {
		length: 256,
		nullable: true,
	})
	public email: string | null;

	/** Optional review-only contacts; cleared atomically when a decision is made. */
	@Column('varchar', {
		length: 1024,
		nullable: true,
		select: false,
	})
	public additionalContacts: string | null;

	@Column('jsonb', { default: {}, select: false })
	public reviewVotes: Record<string, RegistrationReviewVote>;

	@Column('integer', { default: 0 })
	public reviewVersion: number;

	@Column('jsonb', { nullable: true, select: false })
	public reviewDecision: RegistrationReviewDecision | null;

	@Index()
	@Column('varchar', {
		length: 32,
		default: 'pending',
	})
	public status: string;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public approvedAt: Date | null;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public rejectedAt: Date | null;

	/** Null marks legacy decisions that must never be automatically notified. */
	@Column('varchar', { length: 16, nullable: true })
	public rejectionNotificationStatus: RegistrationRejectionNotificationStatus | null;

	@Column('timestamp with time zone', { nullable: true })
	public rejectionNotificationAttemptedAt: Date | null;

	/**
	 * 旗鯖fork: 個人情報 (username / hashedPassword) を削除した日時
	 * - reject 時点で削除した場合は rejectedAt と同じ値
	 * - 既存データのクリーンアップ処理で削除した場合は実行日時
	 * - null の場合は「未削除 (pending または approved)」を意味する
	 */
	@Column('timestamp with time zone', {
		nullable: true,
	})
	public personalDataDeletedAt: Date | null;

	@Column({
		...id(),
		nullable: true,
	})
	public userId: MiUser['id'] | null;

	@ManyToOne(type => MiUser, {
		onDelete: 'SET NULL',
		nullable: true,
	})
	@JoinColumn()
	public user: MiUser | null;

	@Index()
	@Column('timestamp with time zone')
	public createdAt: Date;
}
