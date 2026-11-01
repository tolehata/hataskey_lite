/*
 * 旗鯖fork: HataFeed(フィードバックセンター)のプロジェクト。
 * ユーザーが自分のソフトウェア/プロジェクトを登録し、その Issue を管理できるようにする。
 * インスタンス本体(このフォーク)のフィードバックは isOfficial=true の公式プロジェクトとして扱い、
 * 個々のユーザーは自分のプロジェクトを作成できる。Issue は projectId でプロジェクトに属する
 * (projectId が null の Issue は公式フィードバック扱い)。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiDriveFile } from './DriveFile.js';

@Entity('feedback_project')
export class MiFeedbackProject {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the project.',
	})
	public createdAt: Date;

	@Column('timestamp with time zone', {
		comment: 'The last updated date of the project.',
	})
	public updatedAt: Date;

	@Index()
	@Column(id())
	public ownerId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public owner: MiUser | null;

	@Column('varchar', {
		length: 128,
		comment: 'The project name.',
	})
	public name: string;

	@Column('varchar', {
		length: 4096,
		default: '',
		comment: 'The project description.',
	})
	public description: string;

	// 旗鯖fork: リポジトリURL(ソース/リポジトリへのリンク)。旧 url を流用。
	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'The repository URL.',
	})
	public url: string | null;

	// 旗鯖fork: プロジェクトのジャンル(任意)。例: SNSクライアント, ゲーム, ツール 等。
	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'The project genre (free text).',
	})
	public genre: string | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The icon (drive) file ID.',
	})
	public iconFileId: MiDriveFile['id'] | null;

	@ManyToOne(type => MiDriveFile, {
		onDelete: 'SET NULL',
	})
	@JoinColumn()
	public iconFile: MiDriveFile | null;

	// 旗鯖fork: このインスタンス本体(フォーク)の公式フィードバックプロジェクトか。
	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether this is the official (instance) feedback project.',
	})
	public isOfficial: boolean;

	// 旗鯖fork: プロジェクトのテーマカラー(任意)。一覧の見分け用。null = 既定色。
	@Column('varchar', {
		length: 16,
		nullable: true,
		comment: 'Project theme color (e.g. #3b9eff). null = default.',
	})
	public color: string | null;

	// 旗鯖fork: サスペンド(一時停止)。true の間は、作成者(owner)と鯖缶以外には
	// プロジェクトもその配下のイシューも一切表示されない。再びオフにすると復帰する。
	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether this project is suspended (hidden from everyone except owner / staff).',
	})
	public suspended: boolean;
}
