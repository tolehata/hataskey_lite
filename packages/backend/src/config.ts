/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { type FastifyServerOptions } from 'fastify';
import type * as Sentry from '@sentry/node';
import type * as SentryVue from '@sentry/vue';
import type { RedisOptions as IoRedisRedisOptions } from 'ioredis';
import type { RedisOptions as BullMqRedisOptions } from 'bullmq';
import type { AccessLogConfiguration, LogFormat, LogLevelSetting } from './logging/types.js';

type RedisOptionsRequiredFields = {
	host: string;
	port: number;
	family?: number;
	pass: string;
	db?: number;
	prefix?: string;
};
type RedisOptionsSource = Partial<IoRedisRedisOptions & BullMqRedisOptions> & RedisOptionsRequiredFields;
type RedisOptionsResolved = IoRedisRedisOptions & BullMqRedisOptions & RedisOptionsRequiredFields;

type SentryBackendConfig = {
	options: Partial<Sentry.NodeOptions>;
	enableNodeProfiling: boolean;
	disabledIntegrations?: string[];
};

/**
 * 設定ファイルの型
 */
type Source = {
	url?: string;
	port?: number;
	socket?: string;
	trustProxy?: FastifyServerOptions['trustProxy'];
	chmodSocket?: string;
	disableHsts?: boolean;
	db: {
		host: string;
		port: number;
		db?: string;
		user?: string;
		pass?: string;
		disableCache?: boolean;
		extra?: { [x: string]: string };
	};
	dbReplications?: boolean;
	dbSlaves?: {
		host: string;
		port: number;
		db: string;
		user: string;
		pass: string;
	}[];
	redis: RedisOptionsSource;
	redisForPubsub?: RedisOptionsSource;
	redisForJobQueue?: RedisOptionsSource;
	redisForTimelines?: RedisOptionsSource;
	redisForReactions?: RedisOptionsSource;
	fulltextSearch?: {
		provider?: FulltextSearchProvider;
	};
	meilisearch?: {
		host: string;
		port: string;
		apiKey: string;
		ssl?: boolean;
		index: string;
		scope?: 'local' | 'global' | string[];
	};
	sentryForBackend?: SentryBackendConfig;
	sentryForFrontend?: {
		options: Partial<SentryVue.BrowserOptions> & { dsn: string };
		vueIntegration?: SentryVue.VueIntegrationOptions | null;
		browserTracingIntegration?: Parameters<typeof SentryVue.browserTracingIntegration>[0] | null;
		replayIntegration?: Parameters<typeof SentryVue.replayIntegration>[0] | null;
	};

	publishTarballInsteadOfProvideRepositoryUrl?: boolean;

	setupPassword?: string;

	proxy?: string;
	proxySmtp?: string;
	proxyBypassHosts?: string[];

	allowedPrivateNetworks?: string[];

	maxFileSize?: number;

	clusterLimit?: number;
	threadPoolSize?: number;

	id: string;

	outgoingAddress?: string;
	outgoingAddressFamily?: 'ipv4' | 'ipv6' | 'dual';

	deliverJobConcurrency?: number;
	inboxJobConcurrency?: number;
	relationshipJobConcurrency?: number;
	deliverJobPerSec?: number;
	inboxJobPerSec?: number;
	relationshipJobPerSec?: number;
	deliverJobMaxAttempts?: number;
	inboxJobMaxAttempts?: number;

	apFileBaseUrl?: string;

	mediaProxy?: string;
	videoThumbnailGenerator?: string;

	perChannelMaxNoteCacheCount?: number;
	perUserNotificationsMaxCount?: number;
	deactivateAntennaThreshold?: number;
	pidFile: string;

	logging?: {
		format?: LogFormat;
		level?: LogLevelSetting;
		domains?: Record<string, LogLevelSetting> | null;
		access?: AccessLogConfiguration;
		sql?: {
			disableQueryTruncation?: boolean,
			enableQueryParamLogging?: boolean,
		}
	}
};

export type Config = {
	url: string;
	port: number;
	socket: string | undefined;
	trustProxy: FastifyServerOptions['trustProxy'];
	chmodSocket: string | undefined;
	disableHsts: boolean | undefined;
	db: {
		host: string;
		port: number;
		db: string;
		user: string;
		pass: string;
		disableCache?: boolean;
		extra?: { [x: string]: string };
	};
	dbReplications: boolean | undefined;
	dbSlaves: {
		host: string;
		port: number;
		db: string;
		user: string;
		pass: string;
	}[] | undefined;
	fulltextSearch?: {
		provider?: FulltextSearchProvider;
	};
	meilisearch: {
		host: string;
		port: string;
		apiKey: string;
		ssl?: boolean;
		index: string;
		scope?: 'local' | 'global' | string[];
	} | undefined;
	proxy: string | undefined;
	proxySmtp: string | undefined;
	proxyBypassHosts: string[] | undefined;
	allowedPrivateNetworks: string[] | undefined;
	maxFileSize: number;
	clusterLimit: number | undefined;
	threadPoolSize: number;
	id: string;
	outgoingAddress: string | undefined;
	outgoingAddressFamily: 'ipv4' | 'ipv6' | 'dual' | undefined;
	deliverJobConcurrency: number | undefined;
	inboxJobConcurrency: number | undefined;
	relationshipJobConcurrency: number | undefined;
	deliverJobPerSec: number | undefined;
	inboxJobPerSec: number | undefined;
	relationshipJobPerSec: number | undefined;
	deliverJobMaxAttempts: number | undefined;
	inboxJobMaxAttempts: number | undefined;
	apFileBaseUrl: string | undefined;
	logging?: {
		format?: LogFormat;
		level?: LogLevelSetting;
		domains?: Record<string, LogLevelSetting> | null;
		access?: AccessLogConfiguration;
		sql?: {
			disableQueryTruncation?: boolean,
			enableQueryParamLogging?: boolean,
		}
	}

	version: string;
	basedMisskeyVersion: string;
	publishTarballInsteadOfProvideRepositoryUrl: boolean;
	setupPassword: string | undefined;
	host: string;
	hostname: string;
	scheme: string;
	wsScheme: string;
	apiUrl: string;
	wsUrl: string;
	authUrl: string;
	driveUrl: string;
	userAgent: string;
	frontendEntry: { file: string | null };
	frontendManifestExists: boolean;
	frontendEmbedEntry: { file: string | null };
	frontendEmbedManifestExists: boolean;
	// 旗鯖fork(G13): vite 8 で CSS が分割チャンク側へ散るため、entry の静的 import 連鎖から収集した css 一覧
	frontendViteCss: string[];
	frontendEmbedViteCss: string[];
	mediaProxy: string;
	externalMediaProxyEnabled: boolean;
	videoThumbnailGenerator: string | null;
	redis: RedisOptionsResolved;
	redisForPubsub: RedisOptionsResolved;
	redisForJobQueue: RedisOptionsResolved;
	redisForTimelines: RedisOptionsResolved;
	redisForReactions: RedisOptionsResolved;
	sentryForBackend: SentryBackendConfig | undefined;
	sentryForFrontend: {
		options: Partial<SentryVue.BrowserOptions> & { dsn: string };
		vueIntegration?: SentryVue.VueIntegrationOptions | null;
		browserTracingIntegration?: Parameters<typeof SentryVue.browserTracingIntegration>[0] | null;
		replayIntegration?: Parameters<typeof SentryVue.replayIntegration>[0] | null;
	} | undefined;
	perChannelMaxNoteCacheCount: number;
	perUserNotificationsMaxCount: number;
	deactivateAntennaThreshold: number;
	pidFile: string;
};

export type FulltextSearchProvider = 'sqlLike' | 'sqlPgroonga' | 'meilisearch';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

/**
 * Path of configuration directory
 */
const dir = `${_dirname}/../../../.config`;

/**
 * Path of configuration file
 */
export const path = process.env.CHERRYPICK_CONFIG_YML
	? resolve(dir, process.env.CHERRYPICK_CONFIG_YML)
	: process.env.NODE_ENV === 'test'
		? resolve(dir, 'test.yml')
		: resolve(dir, 'default.yml');

export function loadConfig(): Config {
	const meta = JSON.parse(fs.readFileSync(`${_dirname}/../../../built/meta.json`, 'utf-8'));

	const frontendManifestExists = fs.existsSync(_dirname + '/../../../built/_frontend_vite_/manifest.json');
	const frontendEmbedManifestExists = fs.existsSync(_dirname + '/../../../built/_frontend_embed_vite_/manifest.json');
	const frontendManifest = frontendManifestExists ?
		JSON.parse(fs.readFileSync(`${_dirname}/../../../built/_frontend_vite_/manifest.json`, 'utf-8'))
		: { 'src/_boot_.ts': { file: null } };
	const frontendEmbedManifest = frontendEmbedManifestExists ?
		JSON.parse(fs.readFileSync(`${_dirname}/../../../built/_frontend_embed_vite_/manifest.json`, 'utf-8'))
		: { 'src/boot.ts': { file: null } };

	const config = yaml.load(fs.readFileSync(path, 'utf-8')) as Source;

	const url = tryCreateUrl(config.url ?? process.env.CHERRYPICK_URL ?? '');
	const version = meta.version;
	const basedMisskeyVersion = meta.basedMisskeyVersion;
	const host = url.host;
	const hostname = url.hostname;
	const scheme = url.protocol.replace(/:$/, '');
	const wsScheme = scheme.replace('http', 'ws');

	const dbDb = config.db.db ?? process.env.DATABASE_DB ?? '';
	const dbUser = config.db.user ?? process.env.DATABASE_USER ?? '';
	const dbPass = config.db.pass ?? process.env.DATABASE_PASSWORD ?? '';

	const externalMediaProxy = config.mediaProxy ?
		config.mediaProxy.endsWith('/') ? config.mediaProxy.substring(0, config.mediaProxy.length - 1) : config.mediaProxy
		: null;
	const internalMediaProxy = `${scheme}://${host}/proxy`;
	const redis = convertRedisOptions(config.redis, host);

	return {
		version,
		basedMisskeyVersion,
		publishTarballInsteadOfProvideRepositoryUrl: !!config.publishTarballInsteadOfProvideRepositoryUrl,
		setupPassword: config.setupPassword,
		url: url.origin,
		port: config.port ?? parseInt(process.env.PORT ?? '', 10),
		socket: config.socket,
		trustProxy: config.trustProxy,
		chmodSocket: config.chmodSocket,
		disableHsts: config.disableHsts,
		host,
		hostname,
		scheme,
		wsScheme,
		wsUrl: `${wsScheme}://${host}`,
		apiUrl: `${scheme}://${host}/api`,
		authUrl: `${scheme}://${host}/auth`,
		driveUrl: `${scheme}://${host}/files`,
		db: { ...config.db, db: dbDb, user: dbUser, pass: dbPass },
		dbReplications: config.dbReplications,
		dbSlaves: config.dbSlaves,
		fulltextSearch: config.fulltextSearch,
		meilisearch: config.meilisearch,
		redis,
		redisForPubsub: config.redisForPubsub ? convertRedisOptions(config.redisForPubsub, host) : redis,
		redisForJobQueue: config.redisForJobQueue ? convertRedisOptions(config.redisForJobQueue, host) : redis,
		redisForTimelines: config.redisForTimelines ? convertRedisOptions(config.redisForTimelines, host) : redis,
		redisForReactions: config.redisForReactions ? convertRedisOptions(config.redisForReactions, host) : redis,
		sentryForBackend: config.sentryForBackend,
		sentryForFrontend: config.sentryForFrontend,
		id: config.id,
		proxy: config.proxy,
		proxySmtp: config.proxySmtp,
		proxyBypassHosts: config.proxyBypassHosts,
		allowedPrivateNetworks: config.allowedPrivateNetworks,
		maxFileSize: config.maxFileSize ?? 262144000,
		clusterLimit: config.clusterLimit,
		threadPoolSize: config.threadPoolSize ?? 1,
		outgoingAddress: config.outgoingAddress,
		outgoingAddressFamily: config.outgoingAddressFamily,
		deliverJobConcurrency: config.deliverJobConcurrency,
		inboxJobConcurrency: config.inboxJobConcurrency,
		relationshipJobConcurrency: config.relationshipJobConcurrency,
		deliverJobPerSec: config.deliverJobPerSec,
		inboxJobPerSec: config.inboxJobPerSec,
		relationshipJobPerSec: config.relationshipJobPerSec,
		deliverJobMaxAttempts: config.deliverJobMaxAttempts,
		inboxJobMaxAttempts: config.inboxJobMaxAttempts,
		apFileBaseUrl: config.apFileBaseUrl,
		mediaProxy: externalMediaProxy ?? internalMediaProxy,
		externalMediaProxyEnabled: externalMediaProxy !== null && externalMediaProxy !== internalMediaProxy,
		videoThumbnailGenerator: config.videoThumbnailGenerator ?
			config.videoThumbnailGenerator.endsWith('/') ? config.videoThumbnailGenerator.substring(0, config.videoThumbnailGenerator.length - 1) : config.videoThumbnailGenerator
			: null,
		userAgent: `CherryPick/${version} (${config.url})`,
		frontendEntry: frontendManifest['src/_boot_.ts'],
		frontendManifestExists: frontendManifestExists,
		frontendEmbedEntry: frontendEmbedManifest['src/boot.ts'],
		frontendEmbedManifestExists: frontendEmbedManifestExists,
		frontendViteCss: collectViteCss(frontendManifest, 'src/_boot_.ts'),
		frontendEmbedViteCss: collectViteCss(frontendEmbedManifest, 'src/boot.ts'),
		perChannelMaxNoteCacheCount: config.perChannelMaxNoteCacheCount ?? 1000,
		perUserNotificationsMaxCount: config.perUserNotificationsMaxCount ?? 500,
		deactivateAntennaThreshold: config.deactivateAntennaThreshold ?? (1000 * 60 * 60 * 24 * 7),
		pidFile: config.pidFile,
		logging: config.logging,
	};
}

// 旗鯖fork(G13): entry の静的 import 連鎖を辿って各チャンクの css を集める。
// vite 8 (rolldown) では MkAvatar 等のグローバルコンポーネントの CSS が entry.css に載らず
// 分割チャンク側に付くため、entry.css だけを <link> すると素の見た目に退行する。
function collectViteCss(manifest: Record<string, { file?: string | null; css?: string[]; imports?: string[] }>, entryKey: string): string[] {
	const entry = manifest[entryKey];
	if (entry == null || entry.file == null) return [];
	const seen = new Set<string>();
	const css = new Set<string>(entry.css ?? []);
	const walk = (imports?: string[]) => {
		if (!Array.isArray(imports)) return;
		for (const id of imports) {
			if (seen.has(id)) continue;
			seen.add(id);
			const chunk = manifest[id];
			if (chunk == null) continue;
			for (const c of chunk.css ?? []) css.add(c);
			walk(chunk.imports);
		}
	};
	walk(entry.imports);
	return Array.from(css);
}

function tryCreateUrl(url: string) {
	try {
		return new URL(url);
	} catch (e) {
		throw new Error(`url="${url}" is not a valid URL.`);
	}
}

function convertRedisOptions(options: RedisOptionsSource, host: string): RedisOptionsResolved {
	return {
		...options,
		password: options.pass,
		prefix: options.prefix ?? host,
		family: options.family ?? 0,
		keyPrefix: `${options.prefix ?? host}:`,
		db: options.db ?? 0,
	};
}
