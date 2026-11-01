/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import _Ajv from 'ajv';
import { describe, expect, test, vi } from 'vitest';
import { meta as listMeta, paramDef as listParamDef } from '@/server/api/endpoints/hatask/flowers/list.js';
import SyncHataskFlowersEndpoint, { meta as syncMeta, paramDef as syncParamDef, parseHataskFlowerHarvestedAt } from '@/server/api/endpoints/hatask/flowers/sync.js';
import { meta as visibilityMeta, paramDef as visibilityParamDef } from '@/server/api/endpoints/hatask/flowers/visibility/update.js';

const Ajv = _Ajv.default;

function compile(schema: unknown) {
	const ajv = new Ajv({ useDefaults: true });
	ajv.addFormat('misskey:id', /^[a-zA-Z0-9]+$/);
	return ajv.compile(schema as never);
}

describe('Hatask flower endpoints', () => {
	test('requires credential, uses account scopes and rate limits without admin-only secure mode', () => {
		for (const meta of [syncMeta, listMeta, visibilityMeta]) {
			expect(meta.requireCredential).toBe(true);
			expect(meta.limit).toBeDefined();
			expect(meta).not.toHaveProperty('secure');
		}
		expect(syncMeta.kind).toBe('write:account');
		expect(listMeta.kind).toBe('read:account');
		expect(visibilityMeta.kind).toBe('write:account');
	});

	test('sync schema accepts an owned flower and rejects injected user IDs and unknown fields', () => {
		const validate = compile(syncParamDef);
		const flower = {
			clientFlowerId: 'flower-a', emoji: '🌼', name: '小さな花', hanakotoba: '希望',
			harvestedAt: '2026-08-29T12:00:00.000Z',
		};
		expect(validate({ flowers: [flower] }), JSON.stringify(validate.errors)).toBe(true);
		expect(validate({ flowers: [{ ...flower, userId: 'another-user' }] })).toBe(false);
		expect(validate({ flowers: [flower], unexpected: true })).toBe(false);
		expect(validate({ flowers: [{ ...flower, harvestedAt: '2026-02-30T12:00:00.000Z' }] })).toBe(true);
	});

	test('compiles in endpoint-base Ajv mode and rejects invalid harvestedAt before any database write', async () => {
		expect(() => new SyncHataskFlowersEndpoint({ createQueryBuilder: vi.fn() } as never, { gen: vi.fn() } as never)).not.toThrow();
		expect(parseHataskFlowerHarvestedAt('2026-08-29T12:00:00.000Z')).toBeInstanceOf(Date);
		expect(parseHataskFlowerHarvestedAt('2026-02-30T12:00:00.000Z')).toBeNull();
		expect(parseHataskFlowerHarvestedAt('not-a-date')).toBeNull();

		const createQueryBuilder = vi.fn();
		const endpoint = new SyncHataskFlowersEndpoint({ createQueryBuilder } as never, { gen: vi.fn() } as never);
		await expect(endpoint.exec({
			flowers: [{ clientFlowerId: 'flower-a', emoji: '🌼', name: '小さな花', harvestedAt: '2026-02-30T12:00:00.000Z' }],
		}, { id: 'user-a' } as never, null, null)).rejects.toMatchObject({ code: 'INVALID_HATASK_FLOWER_HARVESTED_AT' });
		expect(createQueryBuilder).not.toHaveBeenCalled();
	});

	test('list and visibility schemas reject invalid paging, order and visibility values', () => {
		const validateList = compile(listParamDef);
		const validateVisibility = compile(visibilityParamDef);
		expect(validateList({}), JSON.stringify(validateList.errors)).toBe(true);
		expect(validateList({ page: 0 })).toBe(false);
		expect(validateList({ page: 10001 })).toBe(false);
		expect(validateList({ order: 'random' })).toBe(false);
		expect(validateVisibility({ visibility: 'followers' }), JSON.stringify(validateVisibility.errors)).toBe(true);
		expect(validateVisibility({ visibility: 'everyone' })).toBe(false);
	});

	test('the implementation fixes write ownership and preserves community visibility filters', () => {
		const root = resolve(import.meta.dirname, '../../src/server/api/endpoints/hatask/flowers');
		const syncSource = readFileSync(resolve(root, 'sync.ts'), 'utf8');
		const listSource = readFileSync(resolve(root, 'list.ts'), 'utf8');
		const visibilitySource = readFileSync(resolve(root, 'visibility/update.ts'), 'utf8');

		expect(syncSource).toContain('userId: me.id');
		expect(syncSource).toContain(".orUpdate(['emoji', 'name', 'hanakotoba', 'harvestedAt'], ['userId', 'clientFlowerId'])");
		expect(syncSource).not.toContain(".orUpdate(['id'");
		expect(syncSource).toContain('.values(flowers.map(flower => ({');
		expect(syncSource).not.toContain('for (const flower of flowers)');
		expect(syncSource).not.toContain("harvestedAt: { type: 'string', format: 'date-time' }");
		expect(listSource).toContain("flower.userId != :viewerId");
		expect(listSource).not.toContain("flower.userId = :viewerId");
		expect(listSource).toContain("user.isSuspended = FALSE");
		expect(listSource).toContain('const page = ps.page ?? 1');
		expect(listSource).toContain('const limit = ps.limit ?? 12');
		expect(listSource).toContain("const order = ps.order ?? 'newest'");
		expect(listSource).toContain("profile.hataskFlowerVisibility = :publicVisibility");
		expect(listSource).toContain("profile.hataskFlowerVisibility = :followersVisibility");
		expect(listSource).toContain('following.followerId = :followingViewerId');
		expect(listSource).toContain('query.setParameters(followingQuery.getParameters())');
		expect(listSource).toContain('generateMutedUserQueryForUsers(query, me)');
		expect(listSource).toContain('generateBlockQueryForUsers(query, me)');
		expect(listSource).toContain(".addOrderBy('flower.id'");
		expect(listSource).toContain('new Map(flowers.map(flower => [flower.userId, flower.user]))');
		expect(visibilitySource).toContain('update({ userId: me.id }');
	});

	test('registers all flower endpoints', () => {
		const source = readFileSync(resolve(import.meta.dirname, '../../src/server/api/endpoint-list.ts'), 'utf8');
		expect(source).toContain("'hatask/flowers/sync'");
		expect(source).toContain("'hatask/flowers/list'");
		expect(source).toContain("'hatask/flowers/visibility/update'");
	});

	test('keeps the entity and migration index definitions aligned', () => {
		const entitySource = readFileSync(resolve(import.meta.dirname, '../../src/models/HataskFlower.ts'), 'utf8');
		const migrationSource = readFileSync(resolve(import.meta.dirname, '../../migration/1788400000000-add-hatask-flowers.js'), 'utf8');

		expect(entitySource).toContain("@Index('IDX_hatask_flower_user_client', ['userId', 'clientFlowerId'], { unique: true })");
		expect(entitySource).toContain("@Index('IDX_hatask_flower_harvested', ['harvestedAt', 'id'])");
		expect(entitySource).not.toMatch(/@Index\(\)\s*\n\s*@Column\([\s\S]*?public userId/);
		expect(migrationSource).toContain('CREATE UNIQUE INDEX "IDX_hatask_flower_user_client" ON "hatask_flower" ("userId", "clientFlowerId")');
		expect(migrationSource).toContain('CREATE INDEX "IDX_hatask_flower_harvested" ON "hatask_flower" ("harvestedAt", "id")');
		expect(migrationSource).not.toContain('UQ_hatask_flower_user_client');
	});
});
