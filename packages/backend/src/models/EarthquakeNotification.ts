/*
 * 旗鯖fork: 地震・津波情報のサーバープッシュ通知設定(ユーザーごと)。
 *   居住地はプライバシーに関わるため通常は端末ローカルだが、サーバープッシュ通知の判定のため、
 *   「居住地のみ」通知を選んだユーザーに限り、本人の同意の上で都道府県(pref)を保存する。
 */
import { PrimaryColumn, Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';

@Entity('earthquake_notification')
export class MiEarthquakeNotification {
	@PrimaryColumn(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether earthquake/tsunami push notifications are enabled.',
	})
	public enabled: boolean;

	// 'intensity' = 一定震度以上で通知 / 'pref' = 居住地(都道府県)に震度が出たら通知
	@Column('varchar', {
		length: 16,
		default: 'intensity',
	})
	public mode: string;

	// 通知する最小震度(P2PQuake scale: 10,20,30,40,45,50,55,60,70)
	@Column('integer', {
		default: 40,
	})
	public threshold: number;

	// 居住地モード時の都道府県(同意の上で保存)。intensityモードでは未使用。
	@Column('varchar', {
		length: 32,
		nullable: true,
	})
	public pref: string | null;
}
