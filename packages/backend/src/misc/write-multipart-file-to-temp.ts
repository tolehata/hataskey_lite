/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import * as stream from 'node:stream/promises';
import { StatusError } from '@/misc/status-error.js';
import type { Readable } from 'node:stream';

/**
 * multipart の読み込み失敗は返し、保存先の失敗は投げる。
 * EOF の後、end イベントより前に破棄された part でも完了できるよう、pipeline は使わない。
 */
export async function writeMultipartFileToTemp(file: Readable, path: string, maxBytes = Infinity): Promise<Error | null> {
	const dest = fs.createWriteStream(path);
	let failed = false;
	const reading = stream.finished(file, { writable: false }).then(() => null, (err: Error) => {
		if (failed) return null;
		failed = true;
		return err;
	});
	const writing = stream.finished(dest, { readable: false }).then(() => null, (err: Error) => {
		if (failed) return null;
		failed = true;
		file.destroy();
		return err;
	});

	// part が end を発火せず破棄されても、保存先を確実に終了させる。
	let received = 0;
	const onData = (chunk: Buffer) => {
		received += chunk.length;
		if (received > maxBytes) {
			file.destroy(new StatusError('File size limit exceeded', 413));
			return;
		}
		if (!dest.write(chunk)) file.pause();
	};
	const onDrain = () => file.resume();
	file.on('data', onData);
	dest.on('drain', onDrain);
	file.resume();
	const readError = await reading;
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Stream completion callbacks update this flag while awaiting.
	if (failed) {
		file.destroy();
		dest.destroy();
	} else {
		dest.end();
	}
	const writeError = await writing;
	file.removeListener('data', onData);
	dest.removeListener('drain', onDrain);
	if (readError != null) return readError;
	if (writeError != null) throw writeError;
	return null;
}
