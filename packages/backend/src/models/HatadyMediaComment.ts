/* 旗鯖fork: Hatady の映画・ゲーム作品へのコメントと返信。 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiHatadyMediaWork } from './HatadyMediaWork.js';
import { MiHatadyMediaSession } from './HatadyMediaSession.js';

@Entity('hatady_media_comment')
@Index(['workId', 'id'])
export class MiHatadyMediaComment {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone')
	public createdAt: Date;

	@Column('timestamp with time zone')
	public updatedAt: Date;

	@Index()
	@Column({ ...id(), nullable: true })
	public workId: MiHatadyMediaWork['id'] | null;

	@ManyToOne(type => MiHatadyMediaWork, { onDelete: 'CASCADE' })
	@JoinColumn()
	public work: MiHatadyMediaWork | null;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn()
	public user: MiUser | null;

	@Index()
	@Column({ ...id(), nullable: true })
	public replyId: MiHatadyMediaComment['id'] | null;

	@ManyToOne(type => MiHatadyMediaComment, { onDelete: 'SET NULL' })
	@JoinColumn({ name: 'replyId' })
	public reply: MiHatadyMediaComment | null;

	@Column('varchar', { length: 2048 })
	public text: string;

	@Column('boolean', { default: false })
	public spoiler: boolean;

	@Column('integer', { default: 0 })
	public reactionsCount: number;
	@Index()
	@Column({ ...id(), nullable: true })
	public sessionId: MiHatadyMediaSession['id'] | null;

	@ManyToOne(type => MiHatadyMediaSession, { onDelete: 'CASCADE' })
	@JoinColumn()
	public session: MiHatadyMediaSession | null;
}
