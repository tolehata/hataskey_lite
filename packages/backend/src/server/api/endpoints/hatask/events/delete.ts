import ms from 'ms';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { DI } from '@/di-symbols.js';
import { MiHataskEvent } from '@/models/HataskEvent.js';
import { ApiError } from '../../../error.js';
import { canViewHataskEvent } from './_visibility.js';
import { hashHataskEvent } from './_shared.js';
import type { DataSource } from 'typeorm';

export const meta = {
	tags: ['hatask'],
	requireCredential: true,
	kind: 'write:account',
	errors: {
		noSuchEvent: {
			message: 'No such event.',
			code: 'NO_SUCH_EVENT',
			id: 'h9c3d4e5-f6a7-b8c9-d0e1-f2a3b4c5d6e7',
		},
		notOwner: {
			message: 'You are not the owner of this event.',
			code: 'NOT_OWNER',
			id: 'ha4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
		},
		conflict: {
			message: 'The event changed on another client.',
			code: 'HATASK_EVENT_CONFLICT',
			id: '7aa11cb4-da50-43bc-8807-9148f74fd39e',
		},
	},
	// 旗鯖fork(セキュリティ): イベント削除は CASCADE で関連 RSVP も消す破壊的操作。1時間30回。
	limit: { duration: ms('1hour'), max: 30 },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		eventId: { type: 'string', minLength: 1 },
		expectedRevision: { type: 'string', minLength: 64, maxLength: 64 },
	},
	required: ['eventId', 'expectedRevision'],
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> {
	constructor(
		@Inject(DI.db) private db: DataSource,
	) {
		super(meta, paramDef, async (ps, me) => {
			await this.db.transaction(async manager => {
				const repository = manager.getRepository(MiHataskEvent);
				const event = await repository.findOne({ where: { id: ps.eventId }, lock: { mode: 'pessimistic_write' } });
				if (!event || !canViewHataskEvent(event, me.id)) throw new ApiError(meta.errors.noSuchEvent);
				if (event.userId !== me.id) throw new ApiError(meta.errors.notOwner);
				if (hashHataskEvent(event) !== ps.expectedRevision) throw new ApiError(meta.errors.conflict);
				// CASCADE で hatask_rsvp も自動削除
				await repository.delete(event.id);
			});
		});
	}
}
