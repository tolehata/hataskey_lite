/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import * as Redis from 'ioredis';
import { DI } from '@/di-symbols.js';
import type { MiUser, UserProfilesRepository } from '@/models/_.js';
import { QueryService } from '@/core/QueryService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { HATASK_RANKING_HOUR, HATASK_RANKING_METRICS, hataskRankingWindow, parseHataskRankingSnapshot, rankHataskScores } from './hatask-ranking.js';
import type { HataskRankingMetric, HataskRankingPeriod, HataskRankingSnapshot } from './hatask-ranking.js';

interface RankingParticipant {
	id: string;
	flower: boolean;
	utage: boolean;
	block: boolean;
	login: boolean;
}

@Injectable()
export class HataskRankingService {
	private pending = new Map<string, Promise<HataskRankingSnapshot>>();

	constructor(
		@Inject(DI.redis) private redisClient: Redis.Redis,
		@Inject(DI.userProfilesRepository) private profiles: UserProfilesRepository,
		private queryService: QueryService,
		private userEntityService: UserEntityService,
	) {}

	private async snapshot(key: string, period: HataskRankingPeriod, now: Date): Promise<HataskRankingSnapshot> {
		const cached = parseHataskRankingSnapshot(await this.redisClient.get(key));
		if (cached) return cached;
		const pending = this.pending.get(key);
		if (pending) return pending;
		const load = this.collectSnapshot(key, period, now);
		this.pending.set(key, load);
		try { return await load; } finally { this.pending.delete(key); }
	}

	private async collectSnapshot(key: string, period: HataskRankingPeriod, now: Date): Promise<HataskRankingSnapshot> {
		const range = hataskRankingWindow(period, now);
		// One statement gives all four metrics one database snapshot. Login dates are
		// matched to server-generated keys, without parsing untrusted date strings.
		const rows: { userId: string; metric: HataskRankingMetric; value: string }[] = await this.profiles.query(`
			WITH local_users AS (
				SELECT id FROM "user" WHERE host IS NULL AND "isSuspended" = false AND "isDeleted" = false
			), utage AS (
				SELECT session.* FROM utage_session session
				INNER JOIN note ON note.id = session."noteId"
				WHERE note.visibility = 'public' AND session."resolvedAt" >= $1 AND session."resolvedAt" <= $2
			)
			SELECT flower."userId", 'flower' AS metric, COUNT(*)::text AS value
			FROM hatask_flower flower INNER JOIN local_users ON local_users.id = flower."userId"
			WHERE flower."harvestedAt" >= $1 AND flower."harvestedAt" <= $2 GROUP BY flower."userId"
			UNION ALL
			SELECT utage."userId", 'utage', COUNT(*)::text FROM utage
			INNER JOIN local_users ON local_users.id = utage."userId"
			WHERE utage.status = 'succeeded' GROUP BY utage."userId"
			UNION ALL
			SELECT utage."interruptedByUserId", 'block', COUNT(*)::text FROM utage
			INNER JOIN local_users ON local_users.id = utage."interruptedByUserId"
			WHERE utage.status = 'failed' GROUP BY utage."interruptedByUserId"
			UNION ALL
			SELECT profile."userId", 'login', COUNT(DISTINCT dates.day)::text FROM user_profile profile
			INNER JOIN local_users ON local_users.id = profile."userId"
			CROSS JOIN LATERAL unnest(profile."loggedInDates") dates(day)
			WHERE dates.day = ANY($3::varchar[]) GROUP BY profile."userId"
		`, [range.start, now, range.loginDates]);
		const snapshot: HataskRankingSnapshot = {
			generatedAt: now.toISOString(),
			scores: rows.map(row => ({ ...row, value: Number(row.value) })),
		};
		// NX makes simultaneous workers agree on the same hourly snapshot.
		const stored = await this.redisClient.set(key, JSON.stringify(snapshot), 'EX', 3 * 60 * 60, 'NX');
		return stored ? snapshot : parseHataskRankingSnapshot(await this.redisClient.get(key)) ?? snapshot;
	}

	public async list(me: MiUser, period: HataskRankingPeriod, metric: HataskRankingMetric | undefined, page: number, limit: number) {
		const now = new Date();
		const range = hataskRankingWindow(period, now);
		const hour = Math.floor(now.getTime() / HATASK_RANKING_HOUR);
		const prefix = `hatask:ranking:v1:${period}:${range.from}:`;
		const [current, previous, mine] = await Promise.all([
			this.snapshot(`${prefix}${hour}`, period, now),
			this.redisClient.get(`${prefix}${hour - 1}`).then(parseHataskRankingSnapshot),
			this.profiles.findOneByOrFail({ userId: me.id }),
		]);
		// Eligibility is ALWAYS fresh, outside the score cache. Opt-out, profile
		// privacy, suspension, deletion, mute and block apply before counts/ranks/pages.
		const query = this.profiles.createQueryBuilder('profile')
			.innerJoin('profile.user', 'user')
			.select('user.id', 'id')
			.addSelect('profile."showHataskFlowerCount" AND profile."hataskFlowerVisibility" = \'public\'', 'flower')
			.addSelect('profile.showUtageSuccessCount', 'utage')
			.addSelect('profile.showUtageInterruptionCount', 'block')
			.addSelect('TRUE', 'login')
			.where('user.host IS NULL')
			.andWhere('user.isSuspended = FALSE')
			.andWhere('user.isDeleted = FALSE')
			.andWhere('profile.hataskRankingParticipating = TRUE');
		this.queryService.generateMutedUserQueryForUsers(query, me);
		this.queryService.generateBlockQueryForUsers(query, me);
		const participants = await query.getRawMany<RankingParticipant>();
		const boards = (metric ? [metric] : HATASK_RANKING_METRICS).map(id => {
			const eligible = new Set(participants.filter(user => user[id]).map(user => user.id));
			const allowedScores = (snapshot: HataskRankingSnapshot) => snapshot.scores.filter(score => score.metric === id && eligible.has(score.userId));
			const ranked = rankHataskScores(allowedScores(current));
			const oldRanks = new Map(previous ? rankHataskScores(allowedScores(previous)).map(row => [row.userId, row.rank]) : []);
			const delta = (row: typeof ranked[number]) => {
				const previousRank = oldRanks.get(row.userId);
				return previousRank == null ? null : previousRank - row.rank;
			};
			const ownRank = ranked.find(row => row.userId === me.id);
			const totalPages = Math.ceil(ranked.length / limit);
			const currentPage = Math.min(page, Math.max(1, totalPages));
			return {
				metric: id, total: ranked.length, totalPages, page: currentPage,
				self: {
					value: current.scores.find(row => row.metric === id && row.userId === me.id)?.value ?? 0,
					rank: ownRank?.rank ?? null, delta: ownRank ? delta(ownRank) : null,
					eligible: eligible.has(me.id),
				},
				items: ranked.slice((currentPage - 1) * limit, currentPage * limit).map(row => ({
					userId: row.userId, rank: row.rank, value: row.value, delta: delta(row),
				})),
			};
		});
		const userIds = [...new Set(boards.flatMap(board => board.items.map(row => row.userId)))];
		const packed = await this.userEntityService.packMany(userIds, me, { schema: 'UserLite' });
		const userMap = new Map(packed.map(user => [user.id, user]));
		const latestAchievement = mine.achievements.filter(achievement => /^utage(?:Success\d+|Interruption\d+|InterruptionWithin5Seconds)$/.test(achievement.name))
			.toSorted((a, b) => b.unlockedAt - a.unlockedAt)[0] ?? null;
		return {
			period, from: range.from, to: range.to,
			generatedAt: current.generatedAt,
			nextUpdateAt: new Date((hour + 1) * HATASK_RANKING_HOUR).toISOString(),
			previousGeneratedAt: previous?.generatedAt ?? null,
			participating: mine.hataskRankingParticipating,
			latestAchievement,
			boards: boards.map(board => ({ ...board, items: board.items.map(({ userId, ...row }) => {
				const user = userMap.get(userId);
				if (!user) throw new Error('Ranked user is no longer available');
				return { ...row, user };
			}) })),
		};
	}
}
