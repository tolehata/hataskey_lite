/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { bindThis } from '@/decorators.js';
import { DI } from '@/di-symbols.js';
import { readyRef } from '@/boot/ready.js';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import type { Meilisearch } from 'meilisearch';

@Injectable()
export class HealthServerService {
	private pendingDependencyCheck: Promise<unknown> | undefined;

	constructor(
		@Inject(DI.redis)
		private redis: Redis.Redis,

		@Inject(DI.redisForPub)
		private redisForPub: Redis.Redis,

		@Inject(DI.redisForSub)
		private redisForSub: Redis.Redis,

		@Inject(DI.redisForTimelines)
		private redisForTimelines: Redis.Redis,

		@Inject(DI.redisForReactions)
		private redisForReactions: Redis.Redis,

		@Inject(DI.redisForJobQueue)
		private redisForJobQueue: Redis.Redis,

		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.meilisearch)
		private meilisearch: Meilisearch | null,
	) {}

	@bindThis
	public createServer(fastify: FastifyInstance, options: FastifyPluginOptions, done: (err?: Error) => void) {
		fastify.get('/', async (request, reply) => {
			reply.header('Cache-Control', 'no-store');
			const redisClients = [this.redis, this.redisForPub, this.redisForSub, this.redisForTimelines, this.redisForReactions, this.redisForJobQueue];
			// Do not add probes to the offline queue, especially the job queue
			// connection whose maxRetriesPerRequest is deliberately unlimited.
			if (!readyRef.value || redisClients.some(redis => redis.status !== 'ready')) {
				reply.code(503);
				return;
			}

			let timeout: ReturnType<typeof setTimeout> | undefined;
			try {
				if (!this.pendingDependencyCheck) {
					const check = Promise.allSettled([
						...redisClients.map(redis => redis.ping()),
						this.db.query('SELECT 1'),
						...(this.meilisearch ? [this.meilisearch.health()] : []),
					]).then(results => {
						if (results.some(result => result.status === 'rejected')) throw new Error('Dependency health check failed');
					});
					this.pendingDependencyCheck = check;
					// Keep a timed-out check shared until its underlying work settles.
					void check.finally(() => {
						if (this.pendingDependencyCheck === check) this.pendingDependencyCheck = undefined;
					}).catch(() => {});
				}
				await Promise.race([
					this.pendingDependencyCheck,
					new Promise<never>((resolve, reject) => {
						timeout = setTimeout(() => reject(new Error('Health check timed out')), 5000);
					}),
				]);
				reply.code(readyRef.value && redisClients.every(redis => redis.status === 'ready') ? 200 : 503);
			} catch {
				reply.code(503);
			} finally {
				clearTimeout(timeout);
			}
		});

		done();
	}
}
