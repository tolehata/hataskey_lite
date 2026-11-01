/* 旗鯖fork: Hatady の映画・ゲーム作品またはコメントへのリアクション。 */

import { PrimaryColumn, Entity, Index, Column, ManyToOne, JoinColumn } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiHatadyMediaWork } from './HatadyMediaWork.js';
import { MiHatadyMediaSession } from './HatadyMediaSession.js';
import { MiHatadyMediaComment } from './HatadyMediaComment.js';

@Entity('hatady_media_reaction')
@Index(['userId', 'sessionId'], { unique: true, where: '"sessionId" IS NOT NULL' })
@Index(['userId', 'workId'], { unique: true, where: '"workId" IS NOT NULL' })
@Index(['userId', 'commentId'], { unique: true, where: '"commentId" IS NOT NULL' })
export class MiHatadyMediaReaction {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone')
	public createdAt: Date;

	@Index()
	@Column(id())
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, { onDelete: 'CASCADE' })
	@JoinColumn()
	public user: MiUser | null;

	@Index()
	@Column({ ...id(), nullable: true })
	public workId: MiHatadyMediaWork['id'] | null;

	@ManyToOne(type => MiHatadyMediaWork, { onDelete: 'CASCADE' })
	@JoinColumn()
	public work: MiHatadyMediaWork | null;

	@Index()
	@Column({ ...id(), nullable: true })
	public commentId: MiHatadyMediaComment['id'] | null;

	@ManyToOne(type => MiHatadyMediaComment, { onDelete: 'CASCADE' })
	@JoinColumn()
	public comment: MiHatadyMediaComment | null;

	@Column('varchar', { length: 260 })
	public reaction: string;
	@Index()
	@Column({ ...id(), nullable: true })
	public sessionId: MiHatadyMediaSession['id'] | null;

	@ManyToOne(type => MiHatadyMediaSession, { onDelete: 'CASCADE' })
	@JoinColumn()
	public session: MiHatadyMediaSession | null;
}
