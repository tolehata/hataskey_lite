/*
 * 旗鯖fork(1c/1m): Hatady の本の詳細を取得する(本 + 紐づく学習ログ)。
 */
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { HATADY_RATE_LIMITS } from '@/misc/hatady-rate-limit.js';
import { ApiError } from '@/server/api/error.js';
import { HatadyService } from '@/core/HatadyService.js';
import { HatadyEntityService } from '@/core/entities/HatadyEntityService.js';

export const meta = {
	tags: ['hata'],
	requireCredential: true,
	kind: 'read:account',
	limit: HATADY_RATE_LIMITS.heavyRead,
	res: { type: 'object', optional: false, nullable: false },
	errors: {
		noSuchBook: {
			message: 'No such book.',
			code: 'NO_SUCH_BOOK',
			id: 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		bookId: { type: 'string', format: 'misskey:id' },
	},
	required: ['bookId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private hatadyService: HatadyService,
		private hatadyEntityService: HatadyEntityService,
	) {
		super(meta, paramDef, async (ps, me, token) => {
			const book = await this.hatadyService.getBook(ps.bookId);
			if (book == null || !(await this.hatadyService.canViewBook(book, me.id, token == null))) throw new ApiError(meta.errors.noSuchBook);
			// 旗鯖fork(セキュリティ): しおり(自由記述メモ付き)と内容メモは本の所有者だけのもの。
			//   HatadyService の書き込み側(createMemo / createBookmark 等)は所有者チェック済みだが、
			//   読み出しは bookId だけで引いていたため他人の本の私的メモが見えていた。
			//   所有者以外へは空配列を返す(フロントは既に「しおりはありません」表示に対応済み)。
			const isMine = book.userId === me.id;
			const privateAccess = isMine || (token == null && await this.hatadyService.canModerate(me.id));
			const [logs, bookmarks, memos] = await Promise.all([
				this.hatadyService.getBookLogs(book.id, me.id, book.userId, 50, privateAccess),
				privateAccess ? this.hatadyService.getBookmarks(book.id) : Promise.resolve([]),
				privateAccess ? this.hatadyService.getMemos(book.id) : Promise.resolve([]),
			]);
			return {
				book: await this.hatadyEntityService.packBookWithUser(book, me.id, privateAccess),
				isMine,
				logs: await this.hatadyEntityService.packLogs(logs, me, privateAccess),
				bookmarks: bookmarks.map(bm => this.hatadyEntityService.packBookmark(bm)),
				memos: memos.map(m => this.hatadyEntityService.packMemo(m)),
			};
		});
	}
}
