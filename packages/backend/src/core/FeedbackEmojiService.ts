/* SPDX-License-Identifier: AGPL-3.0-only */
import { Inject, Injectable } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { DriveFilesRepository, FeedbackEmojiChangeRequestsRepository, FeedbackEmojiRequestsRepository, MiUser } from '@/models/_.js';
import { MiFeedbackEmojiRequest } from '@/models/FeedbackEmojiRequest.js';
import { MiFeedbackEmojiChangeRequest } from '@/models/FeedbackEmojiChangeRequest.js';
import type { EmojiChangeKind, EmojiChangeSnapshot, EmojiChangeStatus } from '@/models/FeedbackEmojiChangeRequest.js';
import { MiEmoji } from '@/models/Emoji.js';
import { ApiError } from '@/server/api/error.js';
import { feedbackEmojiErrors as errors } from '@/misc/feedback-emoji-errors.js';
import { lockEmojiRequest } from '@/misc/emoji-request-lock.js';
import type { EmojiTransaction } from '@/misc/emoji-transaction.js';
import type Logger from '@/logger.js';
import { IdService } from './IdService.js';
import { FeedbackService } from './FeedbackService.js';
import { CustomEmojiService } from './CustomEmojiService.js';
import { LoggerService } from './LoggerService.js';

export function emojiChangeSnapshot(emoji: MiEmoji): EmojiChangeSnapshot {
	return { name: emoji.name, originalUrl: emoji.originalUrl, publicUrl: emoji.publicUrl, license: emoji.license, updatedAt: emoji.updatedAt?.toISOString() ?? null };
}

export function matchesEmojiSnapshot(emoji: MiEmoji, snapshot: EmojiChangeSnapshot): boolean {
	const current = emojiChangeSnapshot(emoji);
	return (Object.keys(current) as (keyof EmojiChangeSnapshot)[]).every(key => current[key] === snapshot[key]);
}

@Injectable()
export class FeedbackEmojiService {
	private logger: Logger;
	constructor(
		@Inject(DI.feedbackEmojiChangeRequestsRepository) private changes: FeedbackEmojiChangeRequestsRepository,
		@Inject(DI.feedbackEmojiRequestsRepository) private requests: FeedbackEmojiRequestsRepository,
		@Inject(DI.driveFilesRepository) private files: DriveFilesRepository,
		private feedback: FeedbackService,
		private customEmoji: CustomEmojiService,
		private idService: IdService,
		loggerService: LoggerService,
	) {
		this.logger = loggerService.getLogger('feedbackEmoji');
	}

	private async run<T>(action: (transaction: EmojiTransaction) => Promise<T>): Promise<T> {
		const afterCommit: EmojiTransaction['afterCommit'] = [];
		const afterRollback: EmojiTransaction['afterRollback'] = [];
		let result: T;
		try {
			result = await this.requests.manager.transaction(manager => action({ manager, afterCommit, afterRollback }));
		} catch (error) {
			for (const cleanup of afterRollback) {
				try { await cleanup(); } catch (cleanupError) { this.logger.error('Failed to clean up uncommitted emoji image', { error: String(cleanupError) }); }
			}
			throw error;
		}
		// The review and per-user HataFeed notifications are committed together.
		// A live-delivery/cache failure must not make the client repeat an applied edit.
		for (const effect of afterCommit) {
			try { await effect(); } catch (error) { this.logger.error('Emoji review committed; post-commit delivery failed', { error: String(error) }); }
		}
		return result;
	}

	private async checkAccess(user: MiUser, staff = false): Promise<void> {
		if (!await this.feedback.canAccess(user.id) || (staff && !await this.feedback.isStaff(user.id))) throw new ApiError(errors.accessDenied);
	}

	private async image(userId: string, fileId: string | null | undefined) {
		const file = fileId ? await this.files.findOneBy({ id: fileId, userId }) : null;
		if (!file || file.isLink || file.userHost != null || !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) throw new ApiError(errors.invalidImage);
		return file;
	}

	public async cancel(user: MiUser, requestId: string, reason?: string | null): Promise<void> {
		await this.checkAccess(user);
		await this.run(async transaction => {
			await lockEmojiRequest(transaction.manager, requestId);
			const repository = transaction.manager.getRepository(MiFeedbackEmojiRequest);
			const request = await repository.findOneBy({ id: requestId, requestedById: user.id });
			if (!request) throw new ApiError(errors.noSuchRequest);
			if (request.status === 'cancelled') return;
			if (!['pending', 'held'].includes(request.status)) throw new ApiError(errors.invalidState);
			// Retain the original row and createdAt: cancellation never refunds quota.
			await repository.update(request.id, { status: 'cancelled', cancelledAt: new Date(), cancellationReason: reason?.trim() || null, updatedAt: new Date() });
		});
	}

	public async create(user: MiUser, params: { originalRequestId: string; kind: EmojiChangeKind; reason: string; fileId?: string | null; license?: string | null }): Promise<string> {
		await this.checkAccess(user);
		if (!params.reason.trim() || (params.kind === 'updateImage' && !params.license?.trim())) throw new ApiError(errors.reasonRequired);
		try {
			return await this.run(async transaction => {
				const { manager } = transaction;
				await lockEmojiRequest(manager, params.originalRequestId);
				const original = await manager.getRepository(MiFeedbackEmojiRequest).findOneBy({ id: params.originalRequestId, requestedById: user.id });
				if (!original) throw new ApiError(errors.noSuchRequest);
				if (original.status !== 'approved' || !original.resolvedEmojiId) throw new ApiError(errors.invalidState);
				const emoji = await manager.getRepository(MiEmoji).findOne({ where: { id: original.resolvedEmojiId, host: IsNull() }, lock: { mode: 'pessimistic_write' } });
				if (!emoji) throw new ApiError(errors.targetChanged);
				const repository = manager.getRepository(MiFeedbackEmojiChangeRequest);
				if (await repository.existsBy({ targetEmojiId: emoji.id, status: In(['pending', 'held']) })) throw new ApiError(errors.activeRequest);
				const file = params.kind === 'updateImage' ? await this.image(user.id, params.fileId) : null;
				const id = this.idService.gen();
				const now = new Date();
				await repository.insert({ id, createdAt: now, updatedAt: now, requestedById: user.id, originalRequestId: original.id, targetEmojiId: emoji.id, kind: params.kind, status: 'pending', reason: params.reason.trim(), fileId: file?.id ?? null, license: file ? params.license!.trim() : null, targetSnapshot: emojiChangeSnapshot(emoji), replacementImageUrl: file?.webpublicUrl ?? file?.url ?? null, events: [{ status: 'pending', at: now.toISOString(), actorId: user.id, comment: null }] });
				await this.feedback.notifyStaff(user.id, 'newEmojiRequest', { emojiRequestId: original.id, emojiChangeRequestId: id }, `絵文字「:${emoji.name}:」の${params.kind === 'updateImage' ? '画像更新' : '取り下げ'}申請が届きました。`, [], transaction);
				return id;
			});
		} catch (error) {
			if ((error as { driverError?: { constraint?: string } }).driverError?.constraint === 'IDX_feedback_emoji_change_active') throw new ApiError(errors.activeRequest);
			throw error;
		}
	}

	public async resolve(actor: MiUser, requestId: string, status: Exclude<EmojiChangeStatus, 'pending'>, expectedUpdatedAt: string, comment?: string | null): Promise<void> {
		await this.checkAccess(actor, true);
		if (status !== 'approved' && !comment?.trim()) throw new ApiError(errors.reasonRequired);
		await this.run(async transaction => {
			const { manager } = transaction;
			const repository = manager.getRepository(MiFeedbackEmojiChangeRequest);
			const request = await repository.findOne({ where: { id: requestId }, lock: { mode: 'pessimistic_write' } });
			if (!request) throw new ApiError(errors.noSuchRequest);
			if (request.status === status && status !== 'held') return; // Safe retry, no duplicate mutation or notification.
			if (!['pending', 'held'].includes(request.status) || request.updatedAt.toISOString() !== expectedUpdatedAt) throw new ApiError(errors.invalidState);
			if (status === 'approved') {
				const original = await manager.getRepository(MiFeedbackEmojiRequest).findOneBy({ id: request.originalRequestId, requestedById: request.requestedById });
				if (!original || original.status !== 'approved' || original.resolvedEmojiId !== request.targetEmojiId) throw new ApiError(errors.targetChanged);
				const emoji = await manager.getRepository(MiEmoji).findOne({ where: { id: request.targetEmojiId, host: IsNull() }, lock: { mode: 'pessimistic_write' } });
				if (!emoji || !matchesEmojiSnapshot(emoji, request.targetSnapshot)) throw new ApiError(errors.targetChanged);
				if (request.kind === 'updateImage') {
					const file = await this.image(request.requestedById, request.fileId);
					const error = await this.customEmoji.update({ id: emoji.id, originalUrl: file.url, publicUrl: file.webpublicUrl ?? file.url, fileType: file.webpublicType ?? file.type, license: request.license }, actor, transaction);
					if (error) throw new ApiError(errors.targetChanged);
					request.replacementImageUrl = (await manager.getRepository(MiEmoji).findOneByOrFail({ id: emoji.id })).publicUrl;
				} else {
					await this.customEmoji.delete(emoji.id, actor, transaction);
				}
			}
			const now = new Date(Math.max(Date.now(), request.updatedAt.getTime() + 1));
			await repository.update(request.id, { status, updatedAt: now, resolvedAt: now, resolvedById: actor.id, resolvedComment: comment?.trim() || null, replacementImageUrl: request.replacementImageUrl, events: [...request.events, { status, at: now.toISOString(), actorId: actor.id, comment: comment?.trim() || null }] });
			const kind = request.kind === 'updateImage' ? '画像更新' : '取り下げ';
			const result = status === 'approved' ? '承認' : status === 'held' ? '保留' : '却下';
			const type = status === 'approved' ? 'emojiApproved' : status === 'held' ? 'emojiHeld' : 'emojiRejected';
			const refs = { actorId: actor.id, emojiRequestId: request.originalRequestId, emojiChangeRequestId: request.id };
			await this.feedback.notify(request.requestedById, type, refs, `絵文字「:${request.targetSnapshot.name}:」の${kind}申請が${result}されました。${comment?.trim() ? `（理由: ${comment.trim()}）` : ''}`, transaction);
			await this.feedback.notifyStaff(actor.id, type, refs, `絵文字「:${request.targetSnapshot.name}:」の${kind}申請を${result}しました。`, [request.requestedById], transaction);
		});
	}
}
