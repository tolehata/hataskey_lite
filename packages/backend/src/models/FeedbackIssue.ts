/*
 * 旗鯖fork: フィードバックセンター。現在生じている不具合・改善予定・未解決問題などを集約し、
 * GitHub Issue に近い形でユーザーに公開する。管理者/モデレーターが Issue を作成・更新し、
 * ユーザーは閲覧と「賛同(これ困ってる)」リアクションができる。賛同は FeedbackAgree で管理し、
 * 件数を agreementsCount に非正規化して保持する(一覧取得を高速にするため)。
 */

import { PrimaryColumn, Entity, Index, Column, Generated, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

@Entity('feedback_issue')
export class MiFeedbackIssue {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the FeedbackIssue.',
	})
	public createdAt: Date;

	@Column('timestamp with time zone', {
		comment: 'The last updated date of the FeedbackIssue.',
	})
	public updatedAt: Date;

	// 旗鯖fork: イシュー番号(連番)。会話内で「#番号」として参照・リンクできる。
	@Index('IDX_feedback_issue_number_unique', { unique: true })
	@Column('integer', {
		comment: 'Sequential issue number for #-reference.',
	})
	@Generated('increment')
	public number: number;

	@Column('varchar', {
		length: 256,
		comment: 'The title of the issue.',
	})
	public title: string;

	@Column('varchar', {
		length: 8192,
		default: '',
		comment: 'The description (body) of the issue.',
	})
	public description: string;

	// bug=不具合 / improvement=改善予定 / unresolved=未解決 / featureRequest=機能要望 /
	// adoptionRequest=取入要望 / security=セキュリティ対応 / other=その他
	@Index()
	@Column('varchar', {
		length: 32,
		default: 'bug',
		comment: 'bug / improvement / unresolved / featureRequest / adoptionRequest / security / other',
	})
	public category: string;

	// open=未対応 / planned=対応予定 / nextFixConfirmed=次回修正確定 / nextFixPlanned=次回修正予定 /
	// inProgress=対応中 / monitoring=修正監視中 / resolved=解決済み / wontfix=対応しない / unknown=用途不明
	@Index()
	@Column('varchar', {
		length: 32,
		default: 'open',
		comment: 'open / planned / nextFixConfirmed / nextFixPlanned / inProgress / monitoring / resolved / wontfix / unknown',
	})
	public status: string;

	// 旗鯖fork: クローズ状態。解決後に管理者(または個別に権限付与されたモデレーター)がクローズできる。
	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether this issue is closed.',
	})
	public closed: boolean;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the issue was closed.',
	})
	public closedAt: Date | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The user ID who closed the issue.',
	})
	public closedById: MiUser['id'] | null;

	// low / normal / high
	@Column('varchar', {
		length: 16,
		default: 'normal',
		comment: 'low / normal / high',
	})
	public priority: string;

	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether this issue is pinned (featured) at the top.',
	})
	public pinned: boolean;

	@Column('integer', {
		default: 0,
		comment: 'The denormalized count of agreements(賛同).',
	})
	public agreementsCount: number;

	// 旗鯖fork: 添付画像(スクショ等)。ドライブファイルIDの配列。
	@Column('varchar', {
		length: 32,
		array: true,
		default: '{}',
		comment: 'Attached image (drive) file IDs.',
	})
	public fileIds: string[];

	@Column('integer', {
		default: 0,
		comment: 'The denormalized count of comments.',
	})
	public commentsCount: number;

	@Index()
	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the last comment was posted (for activity sorting).',
	})
	public lastCommentedAt: Date | null;

	@Column('varchar', {
		length: 4096,
		nullable: true,
		comment: 'How the issue was resolved (note / changelog link).',
	})
	public resolutionNote: string | null;

	// 旗鯖fork: イシューに添付されたコード(任意提出)。再現コード・パッチ案など。
	@Column('varchar', {
		length: 16384,
		nullable: true,
		comment: 'Optional submitted code snippet attached to the issue.',
	})
	public code: string | null;

	// 旗鯖fork: 所属プロジェクト。null なら公式(インスタンス本体)フィードバック。
	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The project this issue belongs to. null = official (instance) feedback.',
	})
	public projectId: string | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The author user ID.',
	})
	public createdById: MiUser['id'] | null;

	@ManyToOne(type => MiUser, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public createdBy: MiUser | null;
}
