/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import got from 'got';
import { DI } from '@/di-symbols.js';
import { acquireResourceLease } from '@/misc/resource-budget.js';
import { previewRequestAgent, withPreviewRequestBudget } from '@/misc/preview-request-budget.js';
import { StatusError } from '@/misc/status-error.js';
import type { Config } from '@/config.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import type Logger from '@/logger.js';
import { deepClone } from '@/misc/clone.js';
import { query } from '@/misc/prelude/url.js';
import { MemoryKVCache } from '@/misc/cache.js';
import { LoggerService } from '@/core/LoggerService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { ApiError } from '@/server/api/error.js';
import { MiMeta } from '@/models/Meta.js';
import type { SummalyResult } from '@misskey-dev/summaly';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type * as Redis from 'ioredis';

@Injectable()
export class UrlPreviewService implements OnApplicationShutdown {
	private logger: Logger;
	private summaryCache: MemoryKVCache<SummalyResult>;
	private failedCache = new MemoryKVCache<boolean>(30_000, 100);
	private pending = new Map<string, Promise<SummalyResult | undefined>>();
	// 旗鯖fork: 本家 2026.6.0 から取り込み: URLプレビューのデフォルトUAにサーバーURLを含める
	private readonly summalyDefaultUserAgent: string;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private meta: MiMeta,

		private httpRequestService: HttpRequestService,
		private utilityService: UtilityService,
		private loggerService: LoggerService,
		@Inject(DI.redis) private redisClient?: Redis.Redis,
	) {
		this.logger = this.loggerService.getLogger('url-preview');
		this.summaryCache = new MemoryKVCache<SummalyResult>(1000 * 60 * 60, 100); // 1h, 100件
		// 旗鯖fork: 本家 2026.6.0 から取り込み: URLプレビューのデフォルトUAにサーバーURLを含める
		this.summalyDefaultUserAgent = `SummalyBot (${this.config.url}; +https://github.com/misskey-dev/summaly/blob/master/README.md)`;
	}

	@bindThis
	private wrap(url?: string | null): string | null {
		return url != null
			? `${this.config.mediaProxy}/preview.webp?${query({
				url,
				preview: '1',
			})}`
			: null;
	}

	@bindThis
	public async handle(
		request: FastifyRequest<{ Querystring: { url: string; lang?: string; } }>,
		reply: FastifyReply,
	): Promise<object | undefined> {
		const url = request.query.url;
		if (typeof url !== 'string' || url.length > 8192) {
			reply.code(400);
			return;
		}

		const lang = request.query.lang;
		if (lang != null && (typeof lang !== 'string' || lang.length > 128)) {
			reply.code(400);
			return;
		}

		if (!this.meta.urlPreviewEnabled) {
			reply.code(403);
			return {
				error: new ApiError({
					message: 'URL preview is disabled',
					code: 'URL_PREVIEW_DISABLED',
					id: '58b36e13-d2f5-0323-b0c6-76aa9dabefb8',
				}),
			};
		}

		this.logger.info(this.meta.urlPreviewSummaryProxyUrl
			? `(Proxy) Getting preview of ${url}@${lang} ...`
			: `Getting preview of ${url}@${lang} ...`);

		try {
			const fetcher = async () => {
				const result = await (
					this.meta.urlPreviewSummaryProxyUrl
						? this.fetchSummaryFromProxy(url, lang)
						: this.fetchSummary(url, lang)
				);

				if (!result.url.startsWith('http://') && !result.url.startsWith('https://')) {
					return undefined;
				}

				if (result.player.url && !result.player.url.startsWith('http://') && !result.player.url.startsWith('https://')) {
					return undefined;
				}

				return result;
			};

			const summary = deepClone(await this.fetchBounded(`${url}@${lang ?? '_DEFAULT_'}`, request.ip, fetcher));

			if (summary == null) {
				throw new Error('Invalid summary');
			}

			this.logger.succ(`Got preview of ${url}: ${summary.title}`);

			summary.icon = this.wrap(summary.icon);
			summary.thumbnail = this.wrap(summary.thumbnail);

			if (summary.sensitive !== true) {
				summary.sensitive = this.utilityService.isKeyWordIncluded(summary.url, this.meta.urlPreviewSensitiveList);
			}

			// Cache 1day
			reply.header('Cache-Control', 'max-age=86400, immutable');

			return summary;
		} catch (err) {
			if (err instanceof StatusError && (err.statusCode === 429 || err.statusCode === 503)) {
				reply.code(err.statusCode);
				reply.header('Cache-Control', 'no-store');
				reply.header('Retry-After', '5');
				return { error: 'Preview capacity exceeded. Please retry later.' };
			}
			this.logger.warn(`Failed to get preview of ${url}: ${err}`);

			reply.code(422);
			reply.header('Cache-Control', 'max-age=86400, immutable');
			return {
				error: new ApiError({
					message: 'Failed to get preview',
					code: 'URL_PREVIEW_FAILED',
					id: '09d01cb5-53b9-4856-82e5-38a50c290a3b',
				}),
			};
		}
	}

	private get previewTimeout(): number {
		const value = Number(this.meta.urlPreviewTimeout);
		return Number.isFinite(value) && value > 0 ? Math.min(value, 10_000) : 10_000;
	}

	private get previewMaxBytes(): number {
		const value = Number(this.meta.urlPreviewMaximumContentLength);
		return Number.isFinite(value) && value > 0 ? Math.min(value, 10 * 1024 * 1024) : 10 * 1024 * 1024;
	}

	private async fetchBounded(key: string, actor: string, fetcher: () => Promise<SummalyResult | undefined>): Promise<SummalyResult | undefined> {
		const cached = this.summaryCache.get(key);
		if (cached) return cached;
		if (this.failedCache.get(key)) throw new Error('Preview recently failed');
		const pending = this.pending.get(key);
		if (pending) return pending;
		// Bound requests waiting for the Redis admission response in this worker too.
		if (this.pending.size >= 16) throw new StatusError('Preview capacity exceeded', 429);
		const operation = (async () => {
			const lease = await acquireResourceLease(this.redisClient, {
				name: 'url-preview', actor, concurrency: 8, actorConcurrency: 2,
				bytes: this.previewMaxBytes, maxBytes: 80 * 1024 * 1024, requestsPerMinute: 60,
			});
			try {
				if (lease.signal.aborted) throw new StatusError('Preview admission lost', 503);
				const summary = await withPreviewRequestBudget({
					maxBytes: this.previewMaxBytes, timeout: this.previewTimeout, signal: lease.signal,
				}, fetcher);
				if (summary == null) throw new Error('Invalid summary');
				this.summaryCache.set(key, summary);
				return summary;
			} catch (error) {
				this.failedCache.set(key, true);
				throw error;
			} finally { await lease.release(); }
		})();
		this.pending.set(key, operation);
		try { return await operation; } finally { this.pending.delete(key); }
	}

	// 旗鯖fork: 本家1eac4ccf(SSRF対策)を取り込み — agent を proxy 設定有無に関わらず常に適用。
	//   HttpRequestService 側でプライベートIP遮断を行うため、agent を渡さないと素のNode HTTPに落ちてしまう。
	@bindThis
	private async fetchSummary(url: string, lang?: string): Promise<SummalyResult> {
		const { summaly } = await import('@misskey-dev/summaly');

		return summaly(url, {
			followRedirects: this.meta.urlPreviewAllowRedirect,
			lang: lang ?? 'ja-JP',
			agent: {
				http: previewRequestAgent(this.httpRequestService.httpAgent),
				https: previewRequestAgent(this.httpRequestService.httpsAgent),
			},
			// 旗鯖fork: 本家 2026.6.0 から取り込み: URLプレビューのデフォルトUAにサーバーURLを含める
			userAgent: this.meta.urlPreviewUserAgent ?? this.summalyDefaultUserAgent,
			operationTimeout: this.previewTimeout,
			contentLengthLimit: this.previewMaxBytes,
			contentLengthRequired: this.meta.urlPreviewRequireContentLength,
		});
	}

	@bindThis
	private fetchSummaryFromProxy(url: string, lang?: string): Promise<SummalyResult> {
		const proxy = this.meta.urlPreviewSummaryProxyUrl!;
		// The administrator-selected summary service may be on a private network,
		// matching getJson(..., true); preserve selection on every redirect too.
		const proxyAgent = (target: URL) => ({
			[target.protocol === 'https:' ? 'https' : 'http']: previewRequestAgent(this.httpRequestService.getAgentByUrl(target, false, true)),
		});
		const queryStr = query({
			url: url,
			lang: lang ?? 'ja-JP',
			followRedirects: this.meta.urlPreviewAllowRedirect,
			// 旗鯖fork: 本家 2026.6.0 から取り込み: URLプレビューのデフォルトUAにサーバーURLを含める
			userAgent: this.meta.urlPreviewUserAgent ?? this.summalyDefaultUserAgent,
			operationTimeout: this.previewTimeout,
			contentLengthLimit: this.previewMaxBytes,
			contentLengthRequired: this.meta.urlPreviewRequireContentLength,
		});

		return got(`${proxy}?${queryStr}`, {
			headers: { 'user-agent': this.config.userAgent, accept: 'application/json, */*' },
			agent: proxyAgent(new URL(proxy)),
			hooks: { beforeRedirect: [options => { if (options.url) options.agent = proxyAgent(options.url); }] },
			http2: false,
			retry: { limit: 0 },
			timeout: { request: this.previewTimeout },
		}).json<SummalyResult>();
	}

	@bindThis
	public dispose(): void {
		this.summaryCache.dispose();
		this.failedCache.dispose();
	}

	@bindThis
	public onApplicationShutdown(): void {
		this.dispose();
	}
}
