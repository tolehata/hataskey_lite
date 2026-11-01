/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import ms from 'ms';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { DriveService } from '@/core/DriveService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { StatusError } from '@/misc/status-error.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { ApiError } from '@/server/api/error.js';

export const meta = {
	tags: ['drive'],

	limit: {
		duration: ms('1hour'),
		max: 60,
	},

	description: 'Request the server to download a new drive file from the specified URL.',

	requireCredential: true,

	prohibitMoved: true,

	kind: 'write:drive',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		url: { type: 'string' },
		folderId: { type: 'string', format: 'misskey:id', nullable: true, default: null },
		isSensitive: { type: 'boolean', default: false },
		comment: { type: 'string', nullable: true, maxLength: 512, default: null },
		marker: { type: 'string', nullable: true, default: null },
		force: { type: 'boolean', default: false },
	},
	required: ['url'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		private driveFileEntityService: DriveFileEntityService,
		private driveService: DriveService,
		private globalEventService: GlobalEventService,
		private loggerService: LoggerService,
	) {
		super(meta, paramDef, async (ps, user, _1, _2, _3, _4, ip, headers) => {
			try {
				const { completion } = await this.driveService.startUploadFromUrl({ url: ps.url, user, folderId: ps.folderId, sensitive: ps.isSensitive, force: ps.force, comment: ps.comment, requestIp: ip, requestHeaders: headers });
				void completion.then(async file => {
					const packedFile = await this.driveFileEntityService.pack(file, { self: true });
					this.globalEventService.publishMainStream(user.id, 'urlUploadFinished', { marker: ps.marker, file: packedFile });
				}).catch(() => {
					// Include neither the supplied URL nor request headers in background errors.
					this.loggerService.getLogger('drive').warn('An accepted URL upload failed');
				});
			} catch (error) {
				if (error instanceof StatusError || error instanceof IdentifiableError) {
					throw new ApiError({ message: 'URL upload could not be accepted. Check available drive space or retry later.', code: 'URL_UPLOAD_REJECTED', id: '54921fea-875f-4ae4-b2bc-a50ea7540858', httpStatusCode: error instanceof StatusError ? error.statusCode : 400 });
				}
				throw error;
			}
		});
	}
}
