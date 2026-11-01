/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { stat } from 'node:fs/promises';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import * as Redis from 'ioredis';
import { In, IsNull, Not } from 'typeorm';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { IdService } from '@/core/IdService.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { MemoryKVCache, RedisSingleCache } from '@/misc/cache.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import type { DriveFilesRepository, EmojisRepository, MiMeta, MiRole, MiUser, NotesRepository, UsersRepository } from '@/models/_.js';
import type { MiDriveFile } from '@/models/DriveFile.js';
import { MiEmoji } from '@/models/Emoji.js';
import type { EmojiTransaction } from '@/misc/emoji-transaction.js';
import type { Serialized } from '@/types.js';
import { DriveService } from '@/core/DriveService.js';
import { InternalStorageService } from '@/core/InternalStorageService.js';
import Logger from '@/logger.js';
import { LoggerService } from './LoggerService.js';

const parseEmojiStrRegexp = /^([-\w]+)(?:@([\w.-]+))?$/;

export const fetchEmojisHostTypes = [
	'local',
	'remote',
	'all',
] as const;
export type FetchEmojisHostTypes = typeof fetchEmojisHostTypes[number];
export const fetchEmojisSortKeys = [
	'+id',
	'-id',
	'+updatedAt',
	'-updatedAt',
	'+name',
	'-name',
	'+host',
	'-host',
	'+uri',
	'-uri',
	'+publicUrl',
	'-publicUrl',
	'+type',
	'-type',
	'+aliases',
	'-aliases',
	'+category',
	'-category',
	'+license',
	'-license',
	'+isSensitive',
	'-isSensitive',
	'+localOnly',
	'-localOnly',
	'+roleIdsThatCanBeUsedThisEmojiAsReaction',
	'-roleIdsThatCanBeUsedThisEmojiAsReaction',
] as const;
export type FetchEmojisSortKeys = typeof fetchEmojisSortKeys[number];

@Injectable()
export class CustomEmojiService implements OnApplicationShutdown {
	private emojisCache: MemoryKVCache<MiEmoji | null>;
	public localEmojisCache: RedisSingleCache<Map<string, MiEmoji>>;
	private readonly logger: Logger;

	constructor(
		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.redis)
		private redisClient: Redis.Redis,

		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		// 旗鯖fork: 絵文字登録時の原本ドライブファイル自動削除(reuploadFileAndCleanup)が、
		// ノート添付・アバター・バナーとして使われているかを見ずに削除してしまう問題への対策で追加。
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private utilityService: UtilityService,
		private idService: IdService,
		private emojiEntityService: EmojiEntityService,
		private moderationLogService: ModerationLogService,
		private globalEventService: GlobalEventService,
		private driveService: DriveService,
		private loggerService: LoggerService,
		private internalStorageService: InternalStorageService,
		@Inject(DI.config)
		private config: Config,
	) {
		this.emojisCache = new MemoryKVCache<MiEmoji | null>(1000 * 60 * 60 * 12); // 12h

		this.localEmojisCache = new RedisSingleCache<Map<string, MiEmoji>>(this.redisClient, 'localEmojis', {
			lifetime: 1000 * 60 * 30, // 30m
			memoryCacheLifetime: 1000 * 60 * 3, // 3m
			fetcher: () => this.emojisRepository.find({ where: { host: IsNull() } }).then(emojis => new Map(emojis.map(emoji => [emoji.name, emoji]))),
			toRedisConverter: (value) => JSON.stringify(Array.from(value.values())),
			fromRedisConverter: (value) => {
				return new Map(JSON.parse(value).map((x: Serialized<MiEmoji>) => [x.name, {
					...x,
					updatedAt: x.updatedAt ? new Date(x.updatedAt) : null,
				}]));
			},
		});

		this.logger = loggerService.getLogger('customEmojiService');
	}

	@bindThis
	public async add(data: {
		originalUrl: string;
		publicUrl: string;
		fileType: string;
		name: string;
		category: string | null;
		aliases: string[];
		host: string | null;
		license: string | null;
		isSensitive: boolean;
		localOnly: boolean;
		roleIdsThatCanBeUsedThisEmojiAsReaction: MiRole['id'][];
	}, moderator?: MiUser): Promise<MiEmoji> {
		// システムユーザーとして再アップロード
		const result = await this.reuploadFileAndCleanup({ originalUrl: data.originalUrl, name: data.name }, { name: data.name });
		data.originalUrl = result.url;
		data.publicUrl = result.webpublicUrl ?? result.url;
		data.fileType = result.webpublicType ?? result.type;

		const emoji = await this.emojisRepository.insertOne({
			id: this.idService.gen(),
			updatedAt: new Date(),
			name: data.name,
			category: data.category,
			host: data.host,
			aliases: data.aliases,
			originalUrl: data.originalUrl,
			publicUrl: data.publicUrl,
			type: data.fileType,
			license: data.license,
			isSensitive: data.isSensitive,
			localOnly: data.localOnly,
			roleIdsThatCanBeUsedThisEmojiAsReaction: data.roleIdsThatCanBeUsedThisEmojiAsReaction,
		});

		if (data.host == null) {
			this.localEmojisCache.refresh();

			//this.prefetchEmojis([{name: data.name, host: null}]);
			this.emojisCache.set(`${data.name} ${data.host}`, emoji);

			this.globalEventService.publishBroadcastStream('emojiAdded', {
				emoji: await this.emojiEntityService.packDetailed(emoji.id),
			});

			if (moderator) {
				this.moderationLogService.log(moderator, 'addCustomEmoji', {
					emojiId: emoji.id,
					emoji: emoji,
				});
			}
		}

		return emoji;
	}

	/**
	 * 旗鯖fork: 再アップロードを行わず、渡された URL を直接参照してカスタム絵文字を登録する。
	 * 通常は add() (システムユーザーへ再アップロード) を使うが、ローカル開発環境などで
	 * バックエンドが自分のドライブURLを取得できず再アップロードに失敗する場合のフォールバック。
	 * (既存のドライブファイルを直接参照するため、そのファイルが削除されると絵文字も壊れる点に注意)
	 */
	@bindThis
	public async addDirect(data: {
		originalUrl: string;
		publicUrl: string;
		fileType: string;
		name: string;
		category: string | null;
		aliases: string[];
		host: string | null;
		license: string | null;
		isSensitive: boolean;
		localOnly: boolean;
		roleIdsThatCanBeUsedThisEmojiAsReaction: MiRole['id'][];
	}, moderator?: MiUser): Promise<MiEmoji> {
		const emoji = await this.emojisRepository.insertOne({
			id: this.idService.gen(),
			updatedAt: new Date(),
			name: data.name,
			category: data.category,
			host: data.host,
			aliases: data.aliases,
			originalUrl: data.originalUrl,
			publicUrl: data.publicUrl,
			type: data.fileType,
			license: data.license,
			isSensitive: data.isSensitive,
			localOnly: data.localOnly,
			roleIdsThatCanBeUsedThisEmojiAsReaction: data.roleIdsThatCanBeUsedThisEmojiAsReaction,
		});

		if (data.host == null) {
			this.localEmojisCache.refresh();
			this.emojisCache.set(`${data.name} ${data.host}`, emoji);
			this.globalEventService.publishBroadcastStream('emojiAdded', {
				emoji: await this.emojiEntityService.packDetailed(emoji.id),
			});
			if (moderator) {
				this.moderationLogService.log(moderator, 'addCustomEmoji', {
					emojiId: emoji.id,
					emoji: emoji,
				});
			}
		}

		return emoji;
	}

	@bindThis
	public async update(data: (
		{ id: MiEmoji['id'], name?: string; } | { name: string; id?: MiEmoji['id'], }
		) & {
			originalUrl?: string;
			publicUrl?: string;
			fileType?: string;
			category?: string | null;
			aliases?: string[];
			license?: string | null;
			isSensitive?: boolean;
			localOnly?: boolean;
			roleIdsThatCanBeUsedThisEmojiAsReaction?: MiRole['id'][];
		}, moderator?: MiUser, transaction?: EmojiTransaction): Promise<
		null
		| 'NO_SUCH_EMOJI'
		| 'SAME_NAME_EMOJI_EXISTS'
		> {
		const repository = transaction?.manager.getRepository(MiEmoji) ?? this.emojisRepository;
		const emoji = transaction && data.id ? await repository.findOneBy({ id: data.id }) : data.id
			? await this.getEmojiById(data.id)
			: await this.getEmojiByName(data.name!);
		if (emoji === null) return 'NO_SUCH_EMOJI';
		const id = emoji.id;

		// IDと絵文字名が両方指定されている場合は絵文字名の変更を行うため重複チェックが必要
		const doNameUpdate = data.id && data.name && (data.name !== emoji.name);
		if (doNameUpdate) {
			const isDuplicate = await this.checkDuplicate(data.name!);
			if (isDuplicate) return 'SAME_NAME_EMOJI_EXISTS';
		}

		// ファイルの更新がある場合
		if (( data.originalUrl || data.publicUrl || data.fileType ) && emoji.originalUrl !== data.originalUrl) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const result = await this.reuploadFileAndCleanup({ originalUrl: data.originalUrl!, name: data.name }, { name: data.name }, transaction);
			data.originalUrl = result.url;
			data.publicUrl = result.webpublicUrl ?? result.url;
			data.fileType = result.webpublicType ?? result.type;
		}

		await repository.update(emoji.id, {
			updatedAt: new Date(),
			name: data.name,
			category: data.category,
			aliases: data.aliases,
			license: data.license,
			isSensitive: data.isSensitive,
			localOnly: data.localOnly,
			originalUrl: data.originalUrl,
			publicUrl: data.publicUrl,
			type: data.fileType,
			roleIdsThatCanBeUsedThisEmojiAsReaction: data.roleIdsThatCanBeUsedThisEmojiAsReaction ?? undefined,
		});

		const publish = async () => {
			this.emojisCache.delete(`${emoji.name} ${emoji.host}`);
			await this.localEmojisCache.refresh();

			const packed = await this.emojiEntityService.packDetailed(emoji.id);

			if (!doNameUpdate) {
				this.globalEventService.publishBroadcastStream('emojiUpdated', {
					emojis: [packed],
				});
			} else {
				this.globalEventService.publishBroadcastStream('emojiDeleted', {
					emojis: [await this.emojiEntityService.packDetailed(emoji)],
				});

				this.globalEventService.publishBroadcastStream('emojiAdded', {
					emoji: packed,
				});
			}

			if (moderator) {
				const updated = await this.emojisRepository.findOneByOrFail({ id: id });
				await this.moderationLogService.log(moderator, 'updateCustomEmoji', {
					emojiId: emoji.id,
					before: emoji,
					after: updated,
				});
			}
		};
		if (transaction) transaction.afterCommit.push(publish);
		else await publish();
		return null;
	}

	@bindThis
	public async addAliasesBulk(ids: MiEmoji['id'][], aliases: string[]) {
		const emojis = await this.emojisRepository.findBy({
			id: In(ids),
		});

		// 旗鯖fork(perf): 直列 await だと N 件で N 回 RTT を待つ。DB プール枯渇を避けるため
		//   10 件ずつのチャンクで並列実行する(完全な Promise.all だと N=数百で接続が詰まる)。
		const CHUNK = 10;
		const now = new Date();
		for (let i = 0; i < emojis.length; i += CHUNK) {
			const chunk = emojis.slice(i, i + CHUNK);
			await Promise.all(chunk.map(emoji => this.emojisRepository.update(emoji.id, {
				updatedAt: now,
				aliases: [...new Set(emoji.aliases.concat(aliases))],
			})));
		}

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: await this.emojiEntityService.packDetailedMany(ids),
		});
	}

	@bindThis
	public async setAliasesBulk(ids: MiEmoji['id'][], aliases: string[]) {
		await this.emojisRepository.update({
			id: In(ids),
		}, {
			updatedAt: new Date(),
			aliases: aliases,
		});

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: await this.emojiEntityService.packDetailedMany(ids),
		});
	}

	@bindThis
	public async removeAliasesBulk(ids: MiEmoji['id'][], aliases: string[]) {
		const emojis = await this.emojisRepository.findBy({
			id: In(ids),
		});

		// 旗鯖fork(perf): addAliasesBulk と同じく 10 件ずつのチャンクで並列化。
		const CHUNK = 10;
		const now = new Date();
		for (let i = 0; i < emojis.length; i += CHUNK) {
			const chunk = emojis.slice(i, i + CHUNK);
			await Promise.all(chunk.map(emoji => this.emojisRepository.update(emoji.id, {
				updatedAt: now,
				aliases: emoji.aliases.filter(x => !aliases.includes(x)),
			})));
		}

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: await this.emojiEntityService.packDetailedMany(ids),
		});
	}

	@bindThis
	public async setCategoryBulk(ids: MiEmoji['id'][], category: string | null) {
		await this.emojisRepository.update({
			id: In(ids),
		}, {
			updatedAt: new Date(),
			category: category,
		});

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: await this.emojiEntityService.packDetailedMany(ids),
		});
	}

	@bindThis
	public async setLicenseBulk(ids: MiEmoji['id'][], license: string | null) {
		await this.emojisRepository.update({
			id: In(ids),
		}, {
			updatedAt: new Date(),
			license: license,
		});

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiUpdated', {
			emojis: await this.emojiEntityService.packDetailedMany(ids),
		});
	}

	@bindThis
	public async delete(id: MiEmoji['id'], moderator?: MiUser, transaction?: EmojiTransaction) {
		const repository = transaction?.manager.getRepository(MiEmoji) ?? this.emojisRepository;
		const emoji = await repository.findOneByOrFail({ id: id });

		await repository.delete(emoji.id);

		const publish = async () => {
			this.emojisCache.delete(`${emoji.name} ${emoji.host}`);
			await this.localEmojisCache.refresh();

			this.globalEventService.publishBroadcastStream('emojiDeleted', {
				emojis: [await this.emojiEntityService.packDetailed(emoji)],
			});

			if (moderator) {
				await this.moderationLogService.log(moderator, 'deleteCustomEmoji', {
					emojiId: emoji.id,
					emoji: emoji,
				});
			}
		};
		if (transaction) transaction.afterCommit.push(publish);
		else await publish();
	}

	@bindThis
	public async deleteBulk(ids: MiEmoji['id'][], moderator?: MiUser) {
		const emojis = await this.emojisRepository.findBy({
			id: In(ids),
		});

		for (const emoji of emojis) {
			await this.emojisRepository.delete(emoji.id);

			if (moderator) {
				this.moderationLogService.log(moderator, 'deleteCustomEmoji', {
					emojiId: emoji.id,
					emoji: emoji,
				});
			}
		}

		this.localEmojisCache.refresh();

		this.globalEventService.publishBroadcastStream('emojiDeleted', {
			emojis: await this.emojiEntityService.packDetailedMany(emojis),
		});
	}

	@bindThis
	private normalizeHost(src: string | undefined, noteUserHost: string | null): string | null {
		// クエリに使うホスト
		let host = src === '.' ? null	// .はローカルホスト (ここがマッチするのはリアクションのみ)
			: src === undefined ? noteUserHost	// ノートなどでホスト省略表記の場合はローカルホスト (ここがリアクションにマッチすることはない)
			: this.utilityService.isSelfHost(src) ? null	// 自ホスト指定
			: (src || noteUserHost);	// 指定されたホスト || ノートなどの所有者のホスト (こっちがリアクションにマッチすることはない)

		host = this.utilityService.toPunyNullable(host);

		return host;
	}

	@bindThis
	public parseEmojiStr(emojiName: string, noteUserHost: string | null) {
		const match = emojiName.match(parseEmojiStrRegexp);
		if (!match) return { name: null, host: null };

		const name = match[1];

		// ホスト正規化
		const host = this.utilityService.toPunyNullable(this.normalizeHost(match[2], noteUserHost));

		return { name, host };
	}

	/**
	 * 添付用(リモート)カスタム絵文字URLを解決する
	 * @param emojiName ノートやユーザープロフィールに添付された、またはリアクションのカスタム絵文字名 (:は含めない, リアクションでローカルホストの場合は@.を付ける (これはdecodeReactionで可能))
	 * @param noteUserHost ノートやユーザープロフィールの所有者のホスト
	 * @returns URL, nullは未マッチを意味する
	 */
	@bindThis
	public async populateEmoji(emojiName: string, noteUserHost: string | null): Promise<string | null> {
		const { name, host } = this.parseEmojiStr(emojiName, noteUserHost);
		if (name == null) return null;
		if (host == null) return null;

		const queryOrNull = async () => (await this.emojisRepository.findOneBy({
			name,
			host,
		})) ?? null;

		const emoji = await this.emojisCache.fetch(`${name} ${host}`, queryOrNull);

		if (emoji == null) return null;
		return emoji.publicUrl || emoji.originalUrl; // || emoji.originalUrl してるのは後方互換性のため（publicUrlはstringなので??はだめ）
	}

	/**
	 * 複数の添付用(リモート)カスタム絵文字URLを解決する (キャシュ付き, 存在しないものは結果から除外される)
	 */
	@bindThis
	public async populateEmojis(emojiNames: string[], noteUserHost: string | null): Promise<Record<string, string>> {
		const emojis = await Promise.all(emojiNames.map(x => this.populateEmoji(x, noteUserHost)));
		const res = {} as Record<string, string>;
		for (let i = 0; i < emojiNames.length; i++) {
			const resolvedEmoji = emojis[i];
			if (resolvedEmoji != null) {
				res[emojiNames[i]] = resolvedEmoji;
			}
		}
		return res;
	}

	/**
	 * 与えられた絵文字のリストをデータベースから取得し、キャッシュに追加します
	 */
	@bindThis
	public async prefetchEmojis(emojis: { name: string; host: string | null; }[]): Promise<void> {
		const notCachedEmojis = emojis.filter(emoji => this.emojisCache.get(`${emoji.name} ${emoji.host}`) == null);
		const emojisQuery: any[] = [];
		const hosts = new Set(notCachedEmojis.map(e => e.host));
		for (const host of hosts) {
			if (host == null) continue;
			emojisQuery.push({
				name: In(notCachedEmojis.filter(e => e.host === host).map(e => e.name)),
				host: host,
			});
		}
		const _emojis = emojisQuery.length > 0 ? await this.emojisRepository.find({
			where: emojisQuery,
			select: { name: true, host: true, originalUrl: true, publicUrl: true },
		}) : [];
		for (const emoji of _emojis) {
			this.emojisCache.set(`${emoji.name} ${emoji.host}`, emoji);
		}
	}

	/**
	 * ローカル内の絵文字に重複がないかチェックします
	 * @param name 絵文字名
	 */
	@bindThis
	public checkDuplicate(name: string): Promise<boolean> {
		return this.emojisRepository.exists({ where: { name, host: IsNull() } });
	}

	@bindThis
	public getEmojiById(id: string): Promise<MiEmoji | null> {
		return this.emojisRepository.findOneBy({ id });
	}

	@bindThis
	public getEmojiByName(name: string): Promise<MiEmoji | null> {
		return this.emojisRepository.findOneBy({ name, host: IsNull() });
	}

	@bindThis
	public async fetchEmojis(
		params?: {
			query?: {
				updatedAtFrom?: string;
				updatedAtTo?: string;
				name?: string;
				host?: string;
				uri?: string;
				publicUrl?: string;
				type?: string;
				aliases?: string;
				category?: string;
				license?: string;
				isSensitive?: boolean;
				localOnly?: boolean;
				hostType?: FetchEmojisHostTypes;
				roleIds?: string[];
			},
			sinceId?: string;
			untilId?: string;
		},
		opts?: {
			limit?: number;
			page?: number;
			sortKeys?: FetchEmojisSortKeys[]
		},
	) {
		function multipleWordsToQuery(words: string) {
			return words.split(/\s/).filter(x => x.length > 0).map(x => `%${sqlLikeEscape(x)}%`);
		}

		const builder = this.emojisRepository.createQueryBuilder('emoji');
		if (params?.query) {
			const q = params.query;
			if (q.updatedAtFrom) {
				// noIndexScan
				builder.andWhere('CAST(emoji.updatedAt AS DATE) >= :updateAtFrom', { updateAtFrom: q.updatedAtFrom });
			}
			if (q.updatedAtTo) {
				// noIndexScan
				builder.andWhere('CAST(emoji.updatedAt AS DATE) <= :updateAtTo', { updateAtTo: q.updatedAtTo });
			}
			if (q.name) {
				builder.andWhere('emoji.name ~~ ANY(ARRAY[:...name])', { name: multipleWordsToQuery(q.name) });
			}

			switch (true) {
				case q.hostType === 'local': {
					builder.andWhere('emoji.host IS NULL');
					break;
				}
				case q.hostType === 'remote': {
					if (q.host) {
						// noIndexScan
						builder.andWhere('emoji.host ~~ ANY(ARRAY[:...host])', { host: multipleWordsToQuery(q.host) });
					} else {
						builder.andWhere('emoji.host IS NOT NULL');
					}
					break;
				}
			}

			if (q.uri) {
				// noIndexScan
				builder.andWhere('emoji.uri ~~ ANY(ARRAY[:...uri])', { uri: multipleWordsToQuery(q.uri) });
			}
			if (q.publicUrl) {
				// noIndexScan
				builder.andWhere('emoji.publicUrl ~~ ANY(ARRAY[:...publicUrl])', { publicUrl: multipleWordsToQuery(q.publicUrl) });
			}
			if (q.type) {
				// noIndexScan
				builder.andWhere('emoji.type ~~ ANY(ARRAY[:...type])', { type: multipleWordsToQuery(q.type) });
			}
			if (q.aliases) {
				// noIndexScan
				const subQueryBuilder = builder.subQuery()
					.select('COUNT(0)', 'count')
					.from(
						sq2 => sq2
							.select('unnest(subEmoji.aliases)', 'alias')
							.addSelect('subEmoji.id', 'id')
							.from('emoji', 'subEmoji'),
						'aliasTable',
					)
					.where('"emoji"."id" = "aliasTable"."id"')
					.andWhere('"aliasTable"."alias" ~~ ANY(ARRAY[:...aliases])', { aliases: multipleWordsToQuery(q.aliases) });

				builder.andWhere(`(${subQueryBuilder.getQuery()}) > 0`);
			}
			if (q.category) {
				builder.andWhere('emoji.category ~~ ANY(ARRAY[:...category])', { category: multipleWordsToQuery(q.category) });
			}
			if (q.license) {
				// noIndexScan
				builder.andWhere('emoji.license ~~ ANY(ARRAY[:...license])', { license: multipleWordsToQuery(q.license) });
			}
			if (q.isSensitive != null) {
				// noIndexScan
				builder.andWhere('emoji.isSensitive = :isSensitive', { isSensitive: q.isSensitive });
			}
			if (q.localOnly != null) {
				// noIndexScan
				builder.andWhere('emoji.localOnly = :localOnly', { localOnly: q.localOnly });
			}
			if (q.roleIds && q.roleIds.length > 0) {
				builder.andWhere('emoji.roleIdsThatCanBeUsedThisEmojiAsReaction && ARRAY[:...roleIds]::VARCHAR[]', { roleIds: q.roleIds });
			}
		}

		if (params?.sinceId) {
			builder.andWhere('emoji.id > :sinceId', { sinceId: params.sinceId });
		}
		if (params?.untilId) {
			builder.andWhere('emoji.id < :untilId', { untilId: params.untilId });
		}

		if (opts?.sortKeys && opts.sortKeys.length > 0) {
			for (const sortKey of opts.sortKeys) {
				const direction = sortKey.startsWith('-') ? 'DESC' : 'ASC';
				const key = sortKey.replace(/^[+-]/, '');
				builder.addOrderBy(`emoji.${key}`, direction);
			}
		} else {
			builder.addOrderBy('emoji.id', 'DESC');
		}

		const limit = opts?.limit ?? 10;
		if (opts?.page) {
			builder.skip((opts.page - 1) * limit);
		}

		builder.take(limit);

		const [emojis, count] = await builder.getManyAndCount();

		return {
			emojis,
			count: (count > limit ? emojis.length : count),
			allCount: count,
			allPages: Math.ceil(count / limit),
		};
	}

	@bindThis
	public dispose(): void {
		this.emojisCache.dispose();
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}

	/**
	 * 旗鯖fork: ドライブファイルがノート添付・アバター・バナー・絵文字として使われているかを判定する。
	 * reuploadFileAndCleanup が原本ファイルを自動削除する前の安全確認に使う
	 * (絵文字申請ウィザードは既存のドライブファイルを選べるため、ノート添付中やアバター使用中の
	 * 画像を絵文字申請に使われた場合に誤って削除してしまうのを防ぐ)。
	 */
	@bindThis
	private async isDriveFileInUse(file: MiDriveFile): Promise<boolean> {
		const usedInNote = await this.notesRepository.createQueryBuilder('note')
			.select('note.id')
			.andWhere(':file <@ note.fileIds', { file: [file.id] })
			.getExists();
		if (usedInNote) return true;

		const usedInProfile = await this.usersRepository.exists({
			where: [
				{ avatarId: file.id },
				{ bannerId: file.id },
			],
		});
		if (usedInProfile) return true;

		// addDirectで登録済みの絵文字はDrive原本を直接参照している。
		const sourceUrls = file.webpublicUrl ? [file.url, file.webpublicUrl] : [file.url];
		return await this.emojisRepository.exists({
			where: [
				{ originalUrl: In(sourceUrls) },
				{ publicUrl: In(sourceUrls) },
			],
		});
	}

	@bindThis
	private async reuploadFileAndCleanup(data: {
		originalUrl: string;
		name?: string;
	}, loggerContext: { name?: string }, transaction?: EmojiTransaction) {
		let retryCount = 0;
		let copyDriveFile;
		const MAX_RETRY_COUNT = 3;
		const errors: string[] = [];
		const originalSourceUrl = data.originalUrl;
		const storedSource = await this.driveFilesRepository.findOneBy({ url: originalSourceUrl });

		while (retryCount < MAX_RETRY_COUNT) {
			try {
				if (storedSource?.storedInternal && !storedSource.isLink) {
					// DBで確認できた内部保存の原本だけを読む。自サーバーの公開URLを
					// HTTPで取り直さず、元ファイルとは独立した絵文字用コピーを作る。
					const key = storedSource.accessKey;
					if (!key || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(key)) {
						throw new Error('Invalid internal drive file key');
					}
					const sourcePath = this.internalStorageService.resolvePath(key);
					// URL取得時と同じ上限を実ファイルで確認する。DBのsizeは信用しない。
					if ((await stat(sourcePath)).size > this.config.maxFileSize) {
						throw new Error('Max file size exceeded.');
					}
					copyDriveFile = await this.driveService.addFile({
						user: null,
						path: sourcePath,
						name: storedSource.name,
						force: true,
						url: originalSourceUrl,
					});
				} else {
					copyDriveFile = await this.driveService.uploadFromUrl({
						url: originalSourceUrl,
						user: null,
						force: true,
					});
				}
				break;
			} catch (e) {
				retryCount++;
				this.logger.warn(`Failed to upload custom emoji (attempt ${retryCount}/${MAX_RETRY_COUNT})`, {
					error: e instanceof Error ? e.message : String(e),
					stack: e instanceof Error ? e.stack : undefined,
					originalUrl: originalSourceUrl,
					...loggerContext,
				});
				errors.push(e instanceof Error ? e.message : String(e));
				if (retryCount >= MAX_RETRY_COUNT) {
					this.logger.error('Maximum retry count reached for custom emoji upload', {
						error: e instanceof Error ? e.message : String(e),
						originalUrl: originalSourceUrl,
						...loggerContext,
					});
					throw new Error(`Failed to process custom emoji upload after ${MAX_RETRY_COUNT} attempts: ${errors.join('; ')}`);
				}
				await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
			}
		}

		if (!copyDriveFile) {
			throw new Error('Emoji upload succeeded but drive file is undefined. This should never happen.');
		}
		if (transaction) {
			// force:true creates an independent server-owned file. Keep the applicant's
			// source; remove only this new copy if the review transaction rolls back.
			const copy = copyDriveFile;
			transaction.afterRollback.push(async () => {
				// A lost connection can make COMMIT's result uncertain. Never delete a
				// copy that is already referenced by a successfully committed emoji.
				if (!await this.isDriveFileInUse(copy)) await this.driveService.deleteFile(copy);
			});
		}
		if (transaction && (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(copyDriveFile.type) || copyDriveFile.size <= 0 || copyDriveFile.size > 5 * 1024 * 1024)) {
			throw new Error('Unsupported replacement emoji image');
		}

		const newUrl = copyDriveFile.url;
		if (!transaction && originalSourceUrl !== newUrl) {
			try {
				const originalDriveFile = await this.driveFilesRepository.findOneBy({ url: originalSourceUrl });
				if (originalDriveFile && originalDriveFile.id !== copyDriveFile.id) {
					const referenceCount = await this.driveFilesRepository.count({
						where: { url: originalSourceUrl, id: Not(originalDriveFile.id) },
					});
					// 旗鯖fork: 他のドライブファイル行から参照されていなくても、ノート添付・アバター・バナー・絵文字として
					// 使われている場合は削除しない(絵文字申請ウィザードは既存ファイルの選択を許容しているため)。
					const inUse = referenceCount === 0 ? await this.isDriveFileInUse(originalDriveFile) : false;
					if (referenceCount === 0 && !inUse) {
						await this.driveService.deleteFile(originalDriveFile);
						this.logger.info('Deleted original emoji file as it\'s no longer referenced', {
							fileId: originalDriveFile.id,
							url: originalSourceUrl,
						});
					} else {
						this.logger.info(`Skipped deleting original emoji file (references: ${referenceCount}, inUse: ${inUse})`, {
							fileId: originalDriveFile.id,
							url: originalSourceUrl,
						});
					}
				}
			} catch (e) {
				this.logger.warn('Failed to delete original emoji file', {
					error: e instanceof Error ? e.message : String(e),
					originalUrl: originalSourceUrl,
				});
			}
		}

		return {
			url: copyDriveFile.url,
			type: copyDriveFile.type,
			webpublicUrl: copyDriveFile.webpublicUrl,
			webpublicType: copyDriveFile.webpublicType,
		};
	}
}
