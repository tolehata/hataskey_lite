/*
 * 旗鯖fork: フィードバックセンターのカスタム絵文字 追加申請。
 * ユーザーが「リモート絵文字」または「自前の画像(ドライブ)」から絵文字の追加を申請できる。
 * 申請には 名前 / カテゴリ / タグ(aliases) / ライセンス を付け、管理者(または個別権限モデレーター)が
 * 承認/却下する。承認時に実際のカスタム絵文字を作成し resolvedEmojiId に記録する。
 * 未処理(pending)申請はフィードバックセンターの「未処理」タブに集約し、未読バッジで通知する。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiDriveFile } from './DriveFile.js';

@Entity('feedback_emoji_request')
export class MiFeedbackEmojiRequest {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the request.',
	})
	public createdAt: Date;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The last updated date of the request.',
	})
	public updatedAt: Date | null;

	@Index()
	@Column(id())
	public requestedById: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public requestedBy: MiUser | null;

	@Column('varchar', {
		length: 128,
		comment: 'The requested emoji name (without colons).',
	})
	public name: string;

	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'The category (existing emoji category).',
	})
	public category: string | null;

	@Column('varchar', {
		length: 128,
		array: true,
		default: '{}',
		comment: 'Tags / aliases (split by half-width space on input).',
	})
	public aliases: string[];

	@Column('varchar', {
		length: 1024,
		nullable: true,
		comment: 'The license of the emoji image.',
	})
	public license: string | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether the emoji should be local-only (not federated).',
	})
	public localOnly: boolean;

	@Column('boolean', {
		default: false,
		comment: 'Whether the emoji is sensitive.',
	})
	public isSensitive: boolean;

	// remote=リモート絵文字から / image=自前のドライブ画像から
	@Column('varchar', {
		length: 16,
		default: 'image',
		comment: 'remote / image',
	})
	public sourceType: string;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'The original image URL (remote emoji URL).',
	})
	public originalUrl: string | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'The remote host (for remote emoji source).',
	})
	public remoteHost: string | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The uploaded drive file ID (for own-image source).',
	})
	public fileId: MiDriveFile['id'] | null;

	@ManyToOne(type => MiDriveFile, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public file: MiDriveFile | null;

	// pending=未処理 / held=保留 / approved=承認 / rejected=却下 / cancelled=本人取消
	@Index()
	@Column('varchar', {
		length: 16,
		default: 'pending',
		comment: 'pending / held / approved / rejected / cancelled',
	})
	public status: string;

	@Column('varchar', {
		length: 1024,
		nullable: true,
		comment: 'The reason/comment when resolved (e.g. rejection reason).',
	})
	public resolvedComment: string | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The admin/moderator user ID who resolved the request.',
	})
	public resolvedById: MiUser['id'] | null;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the request was resolved.',
	})
	public resolvedAt: Date | null;

	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'The created emoji ID on approval.',
	})
	public resolvedEmojiId: string | null;

	@Column('timestamp with time zone', { nullable: true })
	public cancelledAt: Date | null;

	@Column('varchar', { length: 1024, nullable: true })
	public cancellationReason: string | null;
}
