/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { ImageProcessingService } from '@/core/ImageProcessingService.js';
import type { IImage } from '@/core/ImageProcessingService.js';
import { createTempDir } from '@/misc/create-temp.js';
import { bindThis } from '@/decorators.js';
import { appendQuery, query } from '@/misc/prelude/url.js';

const execFileAsync = promisify(execFile);

@Injectable()
export class VideoProcessingService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private imageProcessingService: ImageProcessingService,
	) {
	}

	@bindThis
	public async generateVideoThumbnail(source: string): Promise<IImage> {
		const [dir, cleanup] = await createTempDir();

		try {
			const { stdout } = await execFileAsync(process.env.FFPROBE_PATH ?? 'ffprobe', [
				'-v', 'error', '-show_entries', 'format=duration', '-of', 'json', source,
			], { timeout: 10_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 });
			const duration = Number((JSON.parse(stdout) as { format?: { duration?: string } }).format?.duration);
			const position = Number.isFinite(duration) && duration > 0 ? duration * 0.05 : 0;
			await execFileAsync(process.env.FFMPEG_PATH ?? 'ffmpeg', [
				'-nostdin', '-v', 'error', '-ss', String(position), '-i', source,
				'-frames:v', '1', '-vf', 'scale=498:422:force_original_aspect_ratio=decrease', `${dir}/out.png`,
			], { timeout: 15_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 });

			return await this.imageProcessingService.convertToWebp(`${dir}/out.png`, 498, 422);
		} finally {
			cleanup();
		}
	}

	@bindThis
	public getExternalVideoThumbnailUrl(url: string): string | null {
		if (this.config.videoThumbnailGenerator == null) return null;

		return appendQuery(
			`${this.config.videoThumbnailGenerator}/thumbnail.webp`,
			query({
				thumbnail: '1',
				url,
			}),
		);
	}
}

