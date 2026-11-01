/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import { Readable } from 'node:stream';
import type { FastifyReply } from 'fastify';

export function handleRangeRequest(
	reply: FastifyReply,
	rangeHeader: string | undefined,
	size: number,
	path: string,
): Readable {
	reply.header('Accept-Ranges', 'bytes');
	// This endpoint serves one byte range. Ignore malformed/unsupported units and
	// multipart requests instead of partially parsing them into invalid streams.
	const range = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
	if (size > 0 && range && (range[1] !== '' || range[2] !== '')) {
		const suffix = range[1] === '';
		const start = suffix ? Math.max(0, size - Number(range[2])) : Number(range[1]);
		const end = suffix || range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1);
		if (start >= size || start > end) {
			reply.header('Content-Range', `bytes */${size}`);
			reply.header('Content-Length', 0);
			reply.code(416);
			return Readable.from([]);
		}
		const chunksize = end - start + 1;
		reply.header('Content-Range', `bytes ${start}-${end}/${size}`);
		reply.header('Content-Length', chunksize);
		reply.code(206);
		return fs.createReadStream(path, { start, end });
	}
	reply.header('Content-Length', size);
	return fs.createReadStream(path);
}
