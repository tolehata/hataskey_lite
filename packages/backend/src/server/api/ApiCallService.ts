/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { randomUUID } from 'node:crypto';
import * as dns from 'node:dns';
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { getIpHash } from '@/misc/get-ip-hash.js';
import type { MiLocalUser, MiUser } from '@/models/User.js';
import type { MiAccessToken } from '@/models/AccessToken.js';
import type Logger from '@/logger.js';
import type { MiMeta, UserIpsRepository } from '@/models/_.js';
import { createTemp } from '@/misc/create-temp.js';
import { acquireResourceLease, LOCAL_DRIVE_UPLOAD_BUDGET, type ResourceLease } from '@/misc/resource-budget.js';
import { StatusError } from '@/misc/status-error.js';
import { writeMultipartFileToTemp } from '@/misc/write-multipart-file-to-temp.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { TelemetryService } from '@/core/telemetry/TelemetryService.js';
import { isLtlEmojiVoteApiPath } from '@/core/ltl-emoji-vote.js';
import type { Config } from '@/config.js';
import type { FlashToken } from '@/misc/flash-token.js';
import { ApiError } from './error.js';
import { RateLimiterService } from './RateLimiterService.js';
import { ApiLoggerService } from './ApiLoggerService.js';
import { AuthenticateService, AuthenticationError } from './AuthenticateService.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { IEndpointMeta, IEndpoint } from './endpoints.js';
import type * as Redis from 'ioredis';

const accessDenied = {
	message: 'Access denied.',
	code: 'ACCESS_DENIED',
	id: '56f35758-7dd5-468b-8439-5d6fb8ec9b8e',
};

const registrationApplicationApiPaths = new Set([
	'registration/apply',
	'admin/registration-applications',
	'admin/vote-registration',
	'admin/approve-registration',
	'admin/reject-registration',
	'admin/cleanup-legacy-rejected-registrations',
]);

@Injectable()
export class ApiCallService implements OnApplicationShutdown {
	private logger: Logger;
	private userIpHistories: Map<MiUser['id'], Set<string>>;
	private userIpHistoriesClearIntervalId: NodeJS.Timeout;

	constructor(
		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.config)
		private config: Config,

		@Inject(DI.userIpsRepository)
		private userIpsRepository: UserIpsRepository,

		private authenticateService: AuthenticateService,
		private rateLimiterService: RateLimiterService,
		private roleService: RoleService,
		private apiLoggerService: ApiLoggerService,
		private telemetryService: TelemetryService,
		@Inject(DI.redis) private redisClient?: Redis.Redis,
	) {
		this.logger = this.apiLoggerService.logger;
		this.userIpHistories = new Map<MiUser['id'], Set<string>>();

		this.userIpHistoriesClearIntervalId = setInterval(() => {
			this.userIpHistories.clear();
		}, 1000 * 60 * 60);
	}

	#sendApiError(reply: FastifyReply, err: ApiError): void {
		let statusCode = err.httpStatusCode;
		if (err.httpStatusCode === 401) {
			reply.header('WWW-Authenticate', 'Bearer realm="CherryPick"');
		} else if (err.code === 'RATE_LIMIT_EXCEEDED') {
			const info: unknown = err.info;
			const unixEpochInSeconds = Date.now();
			if (typeof(info) === 'object' && info && 'resetMs' in info && typeof(info.resetMs) === 'number') {
				const cooldownInSeconds = Math.ceil((info.resetMs - unixEpochInSeconds) / 1000);
				// もしかするとマイナスになる可能性がなくはないのでマイナスだったら0にしておく
				reply.header('Retry-After', Math.max(cooldownInSeconds, 0).toString(10));
			} else {
				this.logger.warn(`rate limit information has unexpected type ${typeof(err.info?.reset)}`);
			}
		} else if (err.kind === 'client') {
			reply.header('WWW-Authenticate', `Bearer realm="CherryPick", error="invalid_request", error_description="${err.message}"`);
			statusCode = statusCode ?? 400;
		} else if (err.kind === 'permission') {
			// (ROLE_PERMISSION_DENIEDは関係ない)
			if (err.code === 'PERMISSION_DENIED') {
				reply.header('WWW-Authenticate', `Bearer realm="CherryPick", error="insufficient_scope", error_description="${err.message}"`);
			}
			statusCode = statusCode ?? 403;
		} else if (!statusCode) {
			statusCode = 500;
		}
		this.send(reply, statusCode, err);
	}

	#sendAuthenticationError(reply: FastifyReply, err: unknown): void {
		if (err instanceof AuthenticationError) {
			const message = 'Authentication failed. Please ensure your token is correct.';
			reply.header('WWW-Authenticate', `Bearer realm="CherryPick", error="invalid_token", error_description="${message}"`);
			this.send(reply, 401, new ApiError({
				message: 'Authentication failed. Please ensure your token is correct.',
				code: 'AUTHENTICATION_FAILED',
				id: 'b0a7f5f8-dc2f-4171-b91f-de88ad238e14',
			}));
		} else {
			this.send(reply, 500, new ApiError());
		}
	}

	#onExecError(ep: IEndpoint, data: any, err: Error, userId?: MiUser['id']): void {
		if (err instanceof ApiError || err instanceof AuthenticationError) {
			throw err;
		} else {
			const errId = randomUUID();
			const ephemeral = isLtlEmojiVoteApiPath(ep.name);
			const registration = registrationApplicationApiPaths.has(ep.name);
			const privateOperation = ephemeral || registration;
			const diagnostic = registration ? new Error('Registration application operation failed')
				: ephemeral ? new Error('Ephemeral emoji vote operation failed') : err;
			if (privateOperation) {
				// SQL引数・申請情報・投票理由をログ、telemetry、API応答へ持ち込まない。
				diagnostic.name = ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'QueryFailedError'].includes(err.name) ? err.name : 'Error';
				// DB例外のstackにも申請データが混ざり得るため、申請では元のstackも渡さない。
				diagnostic.stack = registration ? `${diagnostic.name}: ${diagnostic.message}`
					: `${diagnostic.name}: ${diagnostic.message}\n${err.stack?.split('\n').filter(line => /^\s+at /.test(line)).join('\n') ?? ''}`;
			}
			this.logger.write({
				level: 'error',
				eventName: 'api.endpoint.failed',
				message: `Internal error occurred in ${ep.name}: ${diagnostic.message}`,
				attributes: {
					'api.endpoint': ep.name,
					'error.id': errId,
					...(!privateOperation ? { 'api.params': data } : {}),
				},
				error: diagnostic,
			});

			// extraにps(生のAPIパラメータ)を含めない。logger.write()側はLogNormalizerのredactorで
			// 秘匿化されるが、telemetryService経由(Sentry等)はredactorを経由しないため、
			// 未加工の認証情報が外部送信されてしまう(上流2026.7.0で無くなった要素)。
			this.telemetryService.captureMessage(`Internal error occurred in ${ep.name}: ${diagnostic.message}`, {
				level: 'error',
				...(!privateOperation ? { userId } : {}),
				extra: {
					ep: ep.name,
					e: {
						message: diagnostic.message,
						code: diagnostic.name,
						stack: diagnostic.stack,
						id: errId,
					},
				},
			});

			throw new ApiError(null, {
				e: {
					message: diagnostic.message,
					code: diagnostic.name,
					id: errId,
				},
			});
		}
	}

	@bindThis
	public handleRequest(
		endpoint: IEndpoint & { exec: any },
		request: FastifyRequest<{ Body: Record<string, unknown> | undefined, Querystring: Record<string, unknown> }>,
		reply: FastifyReply,
	): Promise<void> {
		const body = request.method === 'GET'
			? request.query
			: request.body;

		// https://datatracker.ietf.org/doc/html/rfc6750.html#section-2.1 (case sensitive)
		const token = request.headers.authorization?.startsWith('Bearer ')
			? request.headers.authorization.slice(7)
			: body?.['i'];
		if (token != null && typeof token !== 'string') {
			reply.code(400);
			return Promise.resolve();
		}
		// `i` は認証専用であり、エンドポイントの業務パラメータではない。
		// 認証後も本文に残すと additionalProperties: false のエンドポイントが
		// 正しいリクエストを INVALID_PARAM にし、失敗ログにも秘密値を持ち回る。
		// request.body/query そのものは変更せず、実行用の複製からだけ分離する。
		const params = body == null ? body : { ...body };
		if (params != null) delete params['i'];

		// spanをhandleRequest側で開始し、認証・レート制限・パラメータ検証・#onExecErrorの構造化ログまでを
		// カバーする(上流2026.7.0の変更)。また内側のPromiseチェーンを`return call;`で必ず外側へつなぎ、
		// handleRequestの戻り値を待てば#onExecErrorのlogger.write()まで完了していることを保証する
		// (以前はcall().then().catch()の結果を捨てており、呼び出し側からは完了を待てなかった)。
		return this.telemetryService.startSpan('API: ' + endpoint.name, () => this.authenticateService.authenticate(token).then(([user, app, flashToken]) => {
			const call = this.call(endpoint, user, app, flashToken, params, null, request, reply).then((res) => {
				if (request.method === 'GET' && endpoint.meta.cacheSec && !token && !user) {
					reply.header('Cache-Control', `public, max-age=${endpoint.meta.cacheSec}`);
				}
				this.send(reply, res);
			}).catch((err: ApiError) => {
				this.#sendApiError(reply, err);
			});

			if (user) {
				this.logIp(request, user);
			}

			return call;
		}).catch(err => {
			this.#sendAuthenticationError(reply, err);
		}));
	}

	@bindThis
	public async handleMultipartRequest(
		endpoint: IEndpoint & { exec: any },
		request: FastifyRequest<{ Body: Record<string, unknown>, Querystring: Record<string, unknown> }>,
		reply: FastifyReply,
	): Promise<void> {
		let ingress: ResourceLease | undefined;
		let upload: ResourceLease | undefined;
		let cleanup: (() => void) | undefined;
		let part: Awaited<ReturnType<typeof request.file>> | undefined;
		let timer: NodeJS.Timeout | undefined;
		let abort: (() => void) | undefined;
		try {
			ingress = await acquireResourceLease(this.redisClient, {
				name: 'multipart-ingress', actor: request.ip, concurrency: 16, actorConcurrency: 4,
				bytes: 0, maxBytes: 0, requestsPerMinute: 60,
			});
			// A bearer credential can be rejected before the multipart parser consumes anything.
			const bearer = request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : undefined;
			let authentication = bearer !== undefined ? await this.authenticateService.authenticate(bearer) : undefined;
			if (authentication) await this.checkAccess(endpoint, ...authentication, request);
			timer = setTimeout(() => request.raw?.destroy(new Error('Upload deadline exceeded')), 120_000);
			timer.unref();
			part = await request.file({ limits: { files: 1, fields: 32, parts: 33, fieldSize: 16 * 1024, fileSize: this.config.maxFileSize } }).catch(() => undefined);
			if (part == null) { reply.code(400).send(); return; }
			part.file.on('error', () => {});
			if (!authentication) {
				// Legacy body authentication is supported when i precedes the file. Never spool
				// an anonymous file just to discover a credential appearing after its bytes.
				const field = part.fields['i'];
				const token = field != null && !Array.isArray(field) && 'value' in field ? field.value : undefined;
				if (token != null && typeof token !== 'string') { reply.code(400).send(); return; }
				authentication = await this.authenticateService.authenticate(token);
				await this.checkAccess(endpoint, ...authentication, request);
			}
			const [user, app, flashToken] = authentication;
			let maxBytes = this.config.maxFileSize;
			if (user && !(await this.roleService.isModerator(user))) {
				maxBytes = Math.min(maxBytes, (await this.roleService.getUserPolicies(user.id)).maxFileSizeMb * 1024 * 1024);
			}
			if (!(maxBytes > 0)) throw new StatusError('File size limit exceeded', 413);
			upload = await acquireResourceLease(this.redisClient, {
				...LOCAL_DRIVE_UPLOAD_BUDGET, actor: user?.id ?? request.ip,
				bytes: maxBytes, maxBytes: LOCAL_DRIVE_UPLOAD_BUDGET.concurrency * this.config.maxFileSize,
			});
			const file = part.file;
			abort = () => file.destroy(new Error('Upload admission lost'));
			ingress.signal.addEventListener('abort', abort, { once: true });
			upload.signal.addEventListener('abort', abort, { once: true });
			if (ingress.signal.aborted || upload.signal.aborted) throw new StatusError('Upload admission lost', 503);
			const temporary = await createTemp();
			const path = temporary[0];
			cleanup = temporary[1];
			const multipartError = await writeMultipartFileToTemp(file, path, maxBytes);
			if ((multipartError instanceof StatusError && multipartError.statusCode === 413) || file.truncated) { reply.code(413).send(); return; }
			if (multipartError != null) { reply.code(400).send(); return; }
			const fields: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(part.fields)) {
				if (key !== 'i') fields[key] = value != null && !Array.isArray(value) && 'value' in value ? value.value : undefined;
			}
			await this.telemetryService.startSpan('API: ' + endpoint.name, async () => {
				const result = await this.call(endpoint, user, app, flashToken, fields, { name: part!.filename, path }, request, reply, true);
				this.send(reply, result);
			});
			if (user) void this.logIp(request, user);
		} catch (err) {
			if (err instanceof ApiError) this.#sendApiError(reply, err);
			else if (err instanceof AuthenticationError) this.#sendAuthenticationError(reply, err);
			else if (err instanceof StatusError) {
				reply.header('Retry-After', '5');
				reply.code(err.statusCode).send();
			} else throw err;
		} finally {
			if (timer) clearTimeout(timer);
			if (abort) {
				ingress?.signal.removeEventListener('abort', abort);
				upload?.signal.removeEventListener('abort', abort);
			}
			// Do not drain an unauthenticated file after rejecting it.
			part?.file.destroy();
			try { cleanup?.(); } finally {
				await upload?.release();
				await ingress?.release();
			}
		}
	}

	@bindThis
	private send(reply: FastifyReply, x?: any, y?: ApiError) {
		if (x == null) {
			reply.code(204);
			reply.send();
		} else if (typeof x === 'number' && y) {
			reply.code(x);
			reply.send({
				error: {
					message: y!.message,
					code: y!.code,
					id: y!.id,
					kind: y!.kind,
					...(y!.info ? { info: y!.info } : {}),
				},
			});
		} else {
			// 文字列を返す場合は、JSON.stringify通さないとJSONと認識されない
			reply.send(typeof x === 'string' ? JSON.stringify(x) : x);
		}
	}

	@bindThis
	private async logIp(request: FastifyRequest, user: MiLocalUser) {
		if (!this.meta.enableIpLogging) return;
		const ip = request.ip;
		const ips = this.userIpHistories.get(user.id);
		if (ips == null || !ips.has(ip)) {
			if (ips == null) {
				this.userIpHistories.set(user.id, new Set([ip]));
			} else {
				ips.add(ip);
			}

			let hostNames: string[] | undefined = undefined;

			try {
				const names = await dns.promises.reverse(ip);
				hostNames = names.map(x =>
					x.length < 512 ? x : x.substring(0, 512));
			} catch (e) {
				console.log(e);
			}

			try {
				await this.userIpsRepository.createQueryBuilder().insert().values({
					createdAt: new Date(),
					userId: user.id,
					ip: ip,
					dnsNames: hostNames,
				}).orIgnore(true).execute();
			} catch {
			}
		}
	}

	private async checkAccess(
		ep: IEndpoint,
		user: MiLocalUser | null | undefined,
		token: MiAccessToken | null | undefined,
		flashToken: FlashToken | null | undefined,
		request: FastifyRequest,
	) {
		const isSecure = user != null && token == null && flashToken == null;

		if (ep.meta.secure && !isSecure) {
			throw new ApiError(accessDenied);
		}

		if (ep.meta.limit) {
			// koa will automatically load the `X-Forwarded-For` header if `proxy: true` is configured in the app.
			let limitActor: string;
			if (user) {
				limitActor = user.id;
			} else {
				limitActor = getIpHash(request.ip);
			}

			const limit = Object.assign({}, ep.meta.limit);

			if (limit.key == null) {
				(limit as any).key = ep.name;
			}

			// TODO: 毎リクエスト計算するのもあれだしキャッシュしたい
			const factor = user ? (await this.roleService.getUserPolicies(user.id)).rateLimitFactor : 1;

			if (factor > 0) {
				// Rate limit
				const rateLimit = await this.rateLimiterService.limit(limit as IEndpointMeta['limit'] & { key: NonNullable<string> }, limitActor, factor);
				if (rateLimit != null) {
					throw new ApiError({
						message: 'Rate limit exceeded. Please try again later.',
						code: 'RATE_LIMIT_EXCEEDED',
						id: 'd5826d14-3982-4d2e-8011-b9e9f02499ef',
						httpStatusCode: 429,
					}, rateLimit.info);
				}
			}
		}

		if (ep.meta.requireCredential || ep.meta.requireModerator || ep.meta.requireAdmin) {
			if (user == null) {
				throw new ApiError({
					message: 'Credential required.',
					code: 'CREDENTIAL_REQUIRED',
					id: '1384574d-a912-4b81-8601-c7b1c4085df1',
					httpStatusCode: 401,
				});
			} else if (user!.isSuspended) {
				throw new ApiError({
					message: 'Your account has been suspended.',
					code: 'YOUR_ACCOUNT_SUSPENDED',
					kind: 'permission',
					id: 'a8c724b3-6e9c-4b46-b1a8-bc3ed6258370',
				});
			}
		}

		if (ep.meta.prohibitMoved) {
			if (user?.movedToUri) {
				throw new ApiError({
					message: 'You have moved your account.',
					code: 'YOUR_ACCOUNT_MOVED',
					kind: 'permission',
					id: '56f20ec9-fd06-4fa5-841b-edd6d7d4fa31',
				});
			}
		}

		if ((ep.meta.requireModerator || ep.meta.requireAdmin) && (this.meta.rootUserId !== user!.id)) {
			const myRoles = await this.roleService.getUserRoles(user!.id);
			if (ep.meta.requireModerator && !myRoles.some(r => r.isModerator || r.isAdministrator)) {
				throw new ApiError({
					message: 'You are not assigned to a moderator role.',
					code: 'ROLE_PERMISSION_DENIED',
					kind: 'permission',
					id: 'd33d5333-db36-423d-a8f9-1a2b9549da41',
				});
			}
			if (ep.meta.requireAdmin && !myRoles.some(r => r.isAdministrator)) {
				throw new ApiError({
					message: 'You are not assigned to an administrator role.',
					code: 'ROLE_PERMISSION_DENIED',
					kind: 'permission',
					id: 'c3d38592-54c0-429d-be96-5636b0431a61',
				});
			}
		}

		// 未ログイン時は既定ポリシーで判定
		if (ep.meta.requiredRolePolicy != null && (user == null || this.meta.rootUserId !== user.id)) {
			const myRoles = user != null ? await this.roleService.getUserRoles(user.id) : [];
			const policies = await this.roleService.getUserPolicies(user?.id ?? null);
			if (!policies[ep.meta.requiredRolePolicy] && !myRoles.some(r => r.isAdministrator)) {
				throw new ApiError({
					message: 'You are not assigned to a required role.',
					code: 'ROLE_PERMISSION_DENIED',
					kind: 'permission',
					id: '7f86f06f-7e15-4057-8561-f4b6d4ac755a',
				});
			}
		}

		if (token && ((ep.meta.kind && !token.permission.some(p => p === ep.meta.kind))
			|| (!ep.meta.kind && (ep.meta.requireCredential || ep.meta.requireModerator || ep.meta.requireAdmin)))) {
			throw new ApiError({
				message: 'Your app does not have the necessary permissions to use this endpoint.',
				code: 'PERMISSION_DENIED',
				kind: 'permission',
				id: '1370e5b7-d4eb-4566-bb1d-7748ee6a1838',
			});
		}

		if (flashToken && ep.meta.kind && !flashToken.permissions.some(p => p === ep.meta.kind)) {
			throw new ApiError({
				message: 'Your flash does not have the necessary permissions to use this endpoint.',
				code: 'PERMISSION_DENIED',
				id: '11924d17-113a-4ab0-954a-c567ee8a6ce5',
			});
		}
	}

	@bindThis
	private async call(
		ep: IEndpoint & { exec: any },
		user: MiLocalUser | null | undefined,
		token: MiAccessToken | null | undefined,
		flashToken: FlashToken | null | undefined,
		data: any,
		file: {
			name: string;
			path: string;
		} | null,
		request: FastifyRequest<{ Body: Record<string, unknown> | undefined, Querystring: Record<string, unknown> }>,
		reply: FastifyReply,
		preauthorized = false,
	) {
		if (!preauthorized) await this.checkAccess(ep, user, token, flashToken, request);

		// Cast non JSON input
		if ((ep.meta.requireFile || request.method === 'GET') && ep.params.properties) {
			for (const k of Object.keys(ep.params.properties)) {
				const param = ep.params.properties![k];
				if (['boolean', 'number', 'integer'].includes(param.type ?? '') && typeof data[k] === 'string') {
					try {
						data[k] = JSON.parse(data[k]);
					} catch (e) {
						throw new ApiError({
							message: 'Invalid param.',
							code: 'INVALID_PARAM',
							id: '0b5f1631-7c1a-41a6-b399-cce335f34d85',
						}, {
							param: k,
							reason: `cannot cast to ${param.type}`,
						});
					}
				}
			}
		}

		// API span はhandleRequest/handleMultipartRequestで開始するため、認証・レート制限・パラメータ検証もカバーする。
		return await ep.exec(data, user, token, flashToken, file, request.ip, request.headers)
			.catch((err: Error) => this.#onExecError(ep, data, err, user?.id));
	}

	@bindThis
	public dispose(): void {
		clearInterval(this.userIpHistoriesClearIntervalId);
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
