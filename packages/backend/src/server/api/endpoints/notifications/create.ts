/*
 * SPDX-FileCopyrightText: syuilo and misskey-project / hatacha
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NotificationService } from '@/core/NotificationService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['notifications'],

	requireCredential: true,

	kind: 'write:notifications',

	limit: {
		duration: 1000 * 60,
		max: 10,
	},

	errors: {
		invalidLink: {
			message: 'link must be a relative path starting with "/". Absolute URLs and javascript: schemes are not allowed.',
			code: 'INVALID_LINK',
			id: 'a8c8d7e0-1234-4abc-9def-0123456789ab',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		body: { type: 'string' },
		header: { type: 'string', nullable: true },
		icon: { type: 'string', nullable: true },
		// 旗鯖fork: クリック時の遷移先パス (相対パスのみ、'/' 始まり必須)
		link: { type: 'string', nullable: true },
	},
	required: ['body'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private notificationService: NotificationService,
	) {
		super(meta, paramDef, async (ps, user, token) => {
			// 旗鯖fork: link の validation
			// '/' で始まる相対パスのみ許可。絶対URL (http/https) や javascript: スキーマは拒否。
			// 外部アプリが悪意あるリンク (フィッシング先) を通知に仕込むのを防ぐため。
			let validLink: string | null = null;
			if (ps.link != null && ps.link !== '') {
				if (!ps.link.startsWith('/')) {
					throw new ApiError(meta.errors.invalidLink);
				}
				// 念のため protocol-relative URL (//evil.com/...) も拒否
				if (ps.link.startsWith('//')) {
					throw new ApiError(meta.errors.invalidLink);
				}
				validLink = ps.link;
			}

			this.notificationService.createNotification(user.id, 'app', {
				appAccessTokenId: token ? token.id : null,
				customBody: ps.body,
				customHeader: ps.header ?? token?.name ?? null,
				customIcon: ps.icon ?? token?.iconUrl ?? null,
				customLink: validLink,
			});
		});
	}
}
