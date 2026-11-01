/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { IdService } from '@/core/IdService.js';
import type { RegistryItemsRepository } from '@/models/_.js';
import { MiRegistryItem } from '@/models/RegistryItem.js';
import { Endpoint } from '@/server/api/endpoint-base.js';

const SCOPE = ['client', 'uiAnnouncements'];
const KEY = 'hataskeyUiSRelease';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	secure: true,
	kind: 'write:account',
	res: {
		type: 'object',
		properties: { claimed: { type: 'boolean' } },
		required: ['claimed'],
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	additionalProperties: false,
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.registryItemsRepository)
		private registryItemsRepository: RegistryItemsRepository,
		private idService: IdService,
	) {
		super(meta, paramDef, async (_ps, me) => {
			return await this.registryItemsRepository.manager.transaction(async manager => {
				// Serialize claims for this user even when the marker row does not exist yet.
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hata-ui-s-announcement:${me.id}`]);
				const repository = manager.getRepository(MiRegistryItem);
				const existing = await repository.createQueryBuilder('item')
					.where('item.userId = :userId', { userId: me.id })
					.andWhere('item.domain IS NULL')
					.andWhere('item.scope = :scope', { scope: SCOPE })
					.andWhere('item.key = :key', { key: KEY })
					.getOne();
				if (existing != null) return { claimed: false };

				const now = new Date();
				await repository.insert({
					id: this.idService.gen(now.getTime()),
					updatedAt: now,
					userId: me.id,
					domain: null,
					scope: SCOPE,
					key: KEY,
					value: true as MiRegistryItem['value'],
				});
				return { claimed: true };
			});
		});
	}
}
