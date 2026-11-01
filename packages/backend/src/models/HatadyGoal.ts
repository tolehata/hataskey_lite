/*
 * 旗鯖fork(Hatady): 学習目標。短期(short)/長期(long)の2種で、任意の期限(targetDate)と
 *   自動計測メトリクス(metricType/metricTarget)を持てる。
 *   metricType: null=手動達成(ユーザーがチェック) / 'minutes'=学習時間の合計 /
 *   'logs'=記録件数 / 'books'=読了冊数。集計期間は createdAt〜(targetDate or 現在)。
 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

@Entity('hatady_goal')
export class MiHatadyGoal {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', {
		length: 256,
		comment: 'Goal title.',
	})
	public title: string;

	@Column('varchar', {
		length: 2048,
		nullable: true,
		comment: 'Goal description / notes.',
	})
	public description: string | null;

	// short=短期目標 / long=長期目標
	@Column('varchar', {
		length: 8,
		default: 'short',
		comment: 'short / long',
	})
	public termType: string;

	// 期限(任意)。null = 期限なし。
	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'Target date (optional).',
	})
	public targetDate: Date | null;

	// 自動計測の指標。null=手動達成。'minutes' / 'logs' / 'books'
	@Column('varchar', {
		length: 16,
		nullable: true,
		comment: 'null (manual) / minutes / logs / books',
	})
	public metricType: string | null;

	// 目標値(metricType が非nullのとき)。例: minutes=600, books=3
	@Column('integer', {
		nullable: true,
		comment: 'Target value for the metric.',
	})
	public metricTarget: number | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether the goal is achieved.',
	})
	public done: boolean;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the goal was marked as done.',
	})
	public doneAt: Date | null;

	@Column('timestamp with time zone', {
		comment: 'The created date.',
	})
	public createdAt: Date;

	@Column('timestamp with time zone', {
		comment: 'The last updated date.',
	})
	public updatedAt: Date;
}
