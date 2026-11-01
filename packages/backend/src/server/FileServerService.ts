/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import rename from 'rename';
import sharp from 'sharp';
import { sharpBmp } from '@misskey-dev/sharp-read-bmp';
import probeImageSize from 'probe-image-size';
import type { Config } from '@/config.js';
import type { MiDriveFile, DriveFilesRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { createTemp } from '@/misc/create-temp.js';
import { acquireResourceLease, MEDIA_DOWNLOAD_BUDGET, MEDIA_MAX_BYTES, MEDIA_MAX_PIXELS, MEDIA_PROCESSING_BUDGET, MEDIA_TIMEOUT_SECONDS } from '@/misc/resource-budget.js';
import { validateBitmap } from '@/misc/validate-bitmap.js';
import { FILE_TYPE_BROWSERSAFE } from '@/const.js';
import { StatusError } from '@/misc/status-error.js';
import type Logger from '@/logger.js';
import { DownloadService } from '@/core/DownloadService.js';
import { IImageStreamable, ImageProcessingService, webpDefault } from '@/core/ImageProcessingService.js';
import { VideoProcessingService } from '@/core/VideoProcessingService.js';
import { InternalStorageService } from '@/core/InternalStorageService.js';
import { contentDisposition } from '@/misc/content-disposition.js';
import { FileInfoService } from '@/core/FileInfoService.js';
import { LoggerService } from '@/core/LoggerService.js';
import { bindThis } from '@/decorators.js';
import { isMimeImage } from '@/misc/is-mime-image.js';
import { correctFilename } from '@/misc/correct-filename.js';
import { handleRequestRedirectToOmitSearch } from '@/misc/fastify-hook-handlers.js';
import { handleRangeRequest } from './file/FileServerUtils.js';
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginOptions } from 'fastify';
import type * as Redis from 'ioredis';
import type { Sharp } from 'sharp';

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

const assets = `${_dirname}/../../server/file/assets/`;

@Injectable()
export class FileServerService {
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		private fileInfoService: FileInfoService,
		private downloadService: DownloadService,
		private imageProcessingService: ImageProcessingService,
		private videoProcessingService: VideoProcessingService,
		private internalStorageService: InternalStorageService,
		private loggerService: LoggerService,
		@Inject(DI.redis) private redisClient?: Redis.Redis,
	) {
		this.logger = this.loggerService.getLogger('server', 'gray');

		//this.createServer = this.createServer.bind(this);
	}

	@bindThis
	public createServer(fastify: FastifyInstance, options: FastifyPluginOptions, done: (err?: Error) => void) {
		fastify.addHook('onRequest', (request, reply, done) => {
			reply.header('Content-Security-Policy', 'default-src \'none\'; img-src \'self\'; media-src \'self\'; style-src \'unsafe-inline\'');
			if (process.env.NODE_ENV === 'development') {
				reply.header('Access-Control-Allow-Origin', '*');
			}
			done();
		});

		fastify.register((fastify, options, done) => {
			fastify.addHook('onRequest', handleRequestRedirectToOmitSearch);
			fastify.get('/files/app-default.jpg', (request, reply) => {
				const file = fs.createReadStream(`${_dirname}/assets/dummy.png`);
				reply.header('Content-Type', 'image/jpeg');
				reply.header('Cache-Control', 'max-age=31536000, immutable');
				return reply.send(file);
			});

			fastify.get<{ Params: { key: string; } }>('/files/:key', async (request, reply) => {
				return await this.withMediaBudget(request, reply, signal => this.sendDriveFile(request, reply, signal), false)
					.catch(err => this.errorHandler(request, reply, err));
			});
			fastify.get<{ Params: { key: string; } }>('/files/:key/*', async (request, reply) => {
				return await reply.redirect(`${this.config.url}/files/${request.params.key}`, 301);
			});
			done();
		});

		fastify.get<{
			Params: { url: string; };
			Querystring: { url?: string; };
		}>('/proxy/:url*', async (request, reply) => {
			return await this.withMediaBudget(request, reply, signal => this.proxyHandler(request, reply, signal))
				.catch(err => this.errorHandler(request, reply, err));
		});

		done();
	}

	private async withMediaBudget<T>(request: FastifyRequest, reply: FastifyReply, work: (signal: AbortSignal) => Promise<T>, admission = true): Promise<T> {
		const lease = admission ? await acquireResourceLease(this.redisClient, {
			...MEDIA_PROCESSING_BUDGET, actor: request.ip, bytes: 0, maxBytes: 0,
		}) : undefined;
		const controller = new AbortController();
		const signal = lease ? AbortSignal.any([controller.signal, lease.signal]) : controller.signal;
		let output: Readable | undefined;
		let released = false;
		const disconnect = () => {
			controller.abort();
			output?.destroy();
		};
		const timer = setTimeout(disconnect, 120_000);
		timer.unref();
		request.raw?.once('aborted', disconnect);
		reply.raw?.once('close', disconnect);
		const release = () => {
			if (released) return;
			released = true;
			clearTimeout(timer);
			request.raw?.removeListener('aborted', disconnect);
			reply.raw?.removeListener('close', disconnect);
			signal.removeEventListener('abort', disconnect);
			void lease?.release();
		};
		try {
			const result = await work(signal);
			if (result instanceof Readable) {
				output = result;
				output.once('end', release).once('close', release).once('error', release);
				signal.addEventListener('abort', disconnect, { once: true });
				if (signal.aborted || output.destroyed) { output.destroy(); release(); }
			} else release();
			return result;
		} catch (error) {
			release();
			throw error;
		}
	}

	private async openProxyImage(path: string, mime: string, animated = false): Promise<Sharp> {
		// BMP/ICO are decoded in JavaScript before sharpBmp constructs Sharp.
		// Inspect each embedded bitmap before decode-ico eagerly decodes every entry.
		let source: string | Buffer = path;
		if (['image/x-icon', 'image/vnd.microsoft.icon', 'image/x-bmp', 'image/bmp', 'image/x-ms-bmp'].includes(mime)) {
			if ((await fs.promises.stat(path)).size > MEDIA_MAX_BYTES) throw new StatusError('Bitmap exceeds the proxy limit', 413);
			source = await fs.promises.readFile(path);
			validateBitmap(source, mime === 'image/x-icon' || mime === 'image/vnd.microsoft.icon', MEDIA_MAX_PIXELS);
		}
		const input = fs.createReadStream(path);
		try {
			const dimensions = await probeImageSize(input);
			if (!(dimensions.width > 0 && dimensions.height > 0) || dimensions.width * dimensions.height > MEDIA_MAX_PIXELS) {
				throw new StatusError('Image dimensions exceed the proxy limit', 413);
			}
		} finally { input.destroy(); }
		const image = (await sharpBmp(source, mime, { animated, limitInputPixels: MEDIA_MAX_PIXELS }))
			.timeout({ seconds: MEDIA_TIMEOUT_SECONDS });
		const metadata = await image.metadata();
		if (animated && ((metadata.pages ?? 1) > 200 || (metadata.width ?? 0) * (metadata.pageHeight ?? metadata.height ?? 0) * (metadata.pages ?? 1) > MEDIA_MAX_PIXELS)) {
			image.destroy();
			throw new StatusError('Animated image exceeds the proxy limit', 413);
		}
		return image;
	}

	@bindThis
	private async errorHandler(request: FastifyRequest<{ Params?: { [x: string]: any }; Querystring?: { [x: string]: any }; }>, reply: FastifyReply, err?: any) {
		if (err instanceof StatusError && (err.statusCode === 429 || err.statusCode === 503)) {
			reply.header('Cache-Control', 'no-store');
			reply.header('Retry-After', '5');
			return reply.code(err.statusCode).send();
		}
		this.logger.error(`${err}`);

		reply.header('Cache-Control', 'max-age=300');

		if (request.query && 'fallback' in request.query) {
			return reply.sendFile('/dummy.png', assets);
		}

		if (err instanceof StatusError && (err.statusCode === 302 || err.isClientError)) {
			reply.code(err.statusCode);
			return;
		}

		reply.code(500);
		return;
	}

	@bindThis
	private async sendDriveFile(request: FastifyRequest<{ Params: { key: string; } }>, reply: FastifyReply, signal: AbortSignal) {
		const key = request.params.key;
		const file = await this.getFileFromKey(key, request.ip, signal);

		if (file === '404') {
			reply.code(404);
			reply.header('Cache-Control', 'max-age=86400');
			return reply.sendFile('/dummy.png', assets);
		}

		if (file === '204') {
			reply.code(204);
			reply.header('Cache-Control', 'max-age=86400');
			return;
		}

		try {
			signal.throwIfAborted();
			if (file.state === 'remote') {
				let image: IImageStreamable | null = null;

				if (file.fileRole === 'thumbnail') {
					if (isMimeImage(file.mime, 'sharp-convertible-image-with-bmp')) {
						reply.header('Cache-Control', 'max-age=31536000, immutable');

						const url = new URL(`${this.config.mediaProxy}/static.webp`);
						url.searchParams.set('url', file.url);
						url.searchParams.set('static', '1');

						file.cleanup();
						return await reply.redirect(url.toString(), 301);
					} else if (file.mime.startsWith('video/')) {
						const externalThumbnail = this.videoProcessingService.getExternalVideoThumbnailUrl(file.url);
						if (externalThumbnail) {
							file.cleanup();
							return await reply.redirect(externalThumbnail, 301);
						}

						image = await this.videoProcessingService.generateVideoThumbnail(file.path);
					}
				}

				if (file.fileRole === 'webpublic') {
					if (['image/svg+xml'].includes(file.mime)) {
						reply.header('Cache-Control', 'max-age=31536000, immutable');

						const url = new URL(`${this.config.mediaProxy}/svg.webp`);
						url.searchParams.set('url', file.url);

						file.cleanup();
						return await reply.redirect(url.toString(), 301);
					}
				}

				if (!image) {
					image = {
						data: handleRangeRequest(reply, request.headers.range, file.file.size, file.path),
						ext: file.ext,
						type: file.mime,
					};
				}

				if ('pipe' in image.data && typeof image.data.pipe === 'function') {
					// image.dataがstreamなら、stream終了後にcleanup
					image.data.on('end', file.cleanup);
					image.data.on('close', file.cleanup);
				} else {
					// image.dataがstreamでないなら直ちにcleanup
					file.cleanup();
				}

				reply.header('Content-Type', FILE_TYPE_BROWSERSAFE.includes(image.type) ? image.type : 'application/octet-stream');
				reply.header('Cache-Control', 'max-age=31536000, immutable');
				reply.header('Content-Disposition',
					contentDisposition(
						'inline',
						correctFilename(file.filename, image.ext),
					),
				);
				return image.data;
			}

			if (file.fileRole !== 'original') {
				const filename = rename(file.filename, {
					suffix: file.fileRole === 'thumbnail' ? '-thumb' : '-web',
					extname: file.ext ? `.${file.ext}` : '.unknown',
				}).toString();

				reply.header('Content-Type', FILE_TYPE_BROWSERSAFE.includes(file.mime) ? file.mime : 'application/octet-stream');
				reply.header('Cache-Control', 'max-age=31536000, immutable');
				reply.header('Content-Disposition', contentDisposition('inline', filename));

				const size = (await fs.promises.stat(file.path)).size;
				return handleRangeRequest(reply, request.headers.range, size, file.path);
			} else {
				reply.header('Content-Type', FILE_TYPE_BROWSERSAFE.includes(file.file.type) ? file.file.type : 'application/octet-stream');
				reply.header('Cache-Control', 'max-age=31536000, immutable');
				reply.header('Content-Disposition', contentDisposition('inline', file.filename));

				return handleRangeRequest(reply, request.headers.range, file.file.size, file.path);
			}
		} catch (e) {
			if ('cleanup' in file) file.cleanup();
			throw e;
		}
	}

	@bindThis
	private async proxyHandler(request: FastifyRequest<{ Params: { url: string; }; Querystring: { url?: string; }; }>, reply: FastifyReply, signal: AbortSignal) {
		const url = 'url' in request.query ? request.query.url : 'https://' + request.params.url;

		if (typeof url !== 'string') {
			reply.code(400);
			return;
		}

		// アバタークロップなど、どうしてもオリジンである必要がある場合
		const mustOrigin = 'origin' in request.query;

		if (this.config.externalMediaProxyEnabled && !mustOrigin) {
			// 外部のメディアプロキシが有効なら、そちらにリダイレクト

			reply.header('Cache-Control', 'public, max-age=259200'); // 3 days

			const url = new URL(`${this.config.mediaProxy}/${request.params.url || ''}`);

			for (const [key, value] of Object.entries(request.query)) {
				url.searchParams.append(key, value);
			}

			return await reply.redirect(
				url.toString(),
				301,
			);
		}

		if (!request.headers['user-agent']) {
			throw new StatusError('User-Agent is required', 400, 'User-Agent is required');
		} else if (request.headers['user-agent'].toLowerCase().indexOf('cherrypick/') !== -1) {
			throw new StatusError('Refusing to proxy a request from another proxy', 403, 'Proxy is recursive');
		}

		// Create temp file
		const file = await this.getStreamAndTypeFromUrl(url, request.ip, signal);
		if (file === '404') {
			reply.code(404);
			reply.header('Cache-Control', 'max-age=86400');
			return reply.sendFile('/dummy.png', assets);
		}

		if (file === '204') {
			reply.code(204);
			reply.header('Cache-Control', 'max-age=86400');
			return;
		}

		try {
			signal.throwIfAborted();
			const isConvertibleImage = isMimeImage(file.mime, 'sharp-convertible-image-with-bmp');
			const isAnimationConvertibleImage = isMimeImage(file.mime, 'sharp-animation-convertible-image-with-bmp');

			if (
				'emoji' in request.query ||
				'avatar' in request.query ||
				'static' in request.query ||
				'preview' in request.query ||
				'badge' in request.query
			) {
				if (!isConvertibleImage) {
					// 画像でないなら404でお茶を濁す
					throw new StatusError('Unexpected mime', 404);
				}
			}

			let image: IImageStreamable | null = null;
			if ('emoji' in request.query || 'avatar' in request.query) {
				if (!isAnimationConvertibleImage && !('static' in request.query)) {
					image = {
						data: fs.createReadStream(file.path),
						ext: file.ext,
						type: file.mime,
					};
				} else {
					const data = (await this.openProxyImage(file.path, file.mime, !('static' in request.query)))
						.resize({
							height: 'emoji' in request.query ? 128 : 320,
							withoutEnlargement: true,
						})
						.webp(webpDefault);

					image = {
						data,
						ext: 'webp',
						type: 'image/webp',
					};
				}
			} else if ('static' in request.query) {
				image = this.imageProcessingService.convertSharpToWebpStream(await this.openProxyImage(file.path, file.mime), 498, 422);
			} else if ('preview' in request.query) {
				image = this.imageProcessingService.convertSharpToWebpStream(await this.openProxyImage(file.path, file.mime), 200, 200);
			} else if ('badge' in request.query) {
				const mask = (await this.openProxyImage(file.path, file.mime))
					.resize(96, 96, {
						fit: 'contain',
						position: 'centre',
						withoutEnlargement: false,
					})
					.greyscale()
					.normalise()
					.linear(1.75, -(128 * 1.75) + 128) // 1.75x contrast
					.flatten({ background: '#000' })
					.toColorspace('b-w');

				const stats = await mask.clone().stats();

				if (stats.entropy < 0.1) {
					// エントロピーがあまりない場合は404にする
					throw new StatusError('Skip to provide badge', 404);
				}

				const data = sharp({
					create: { width: 96, height: 96, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
				})
					.timeout({ seconds: MEDIA_TIMEOUT_SECONDS })
					.pipelineColorspace('b-w')
					.boolean(await mask.png().toBuffer(), 'eor');

				image = {
					data: await data.png().toBuffer(),
					ext: 'png',
					type: 'image/png',
				};
			} else if (file.mime === 'image/svg+xml') {
				image = this.imageProcessingService.convertSharpToWebpStream(await this.openProxyImage(file.path, file.mime), 2048, 2048);
			} else if (!file.mime.startsWith('image/') || !FILE_TYPE_BROWSERSAFE.includes(file.mime)) {
				throw new StatusError('Rejected type', 403, 'Rejected type');
			}

			if (!image) {
				if (request.headers.range && file.file && file.file.size > 0) {
					const range = request.headers.range as string;
					const parts = range.replace(/bytes=/, '').split('-');
					const start = parseInt(parts[0], 10);
					let end = parts[1] ? parseInt(parts[1], 10) : file.file.size - 1;
					if (end > file.file.size) {
						end = file.file.size - 1;
					}
					const chunksize = end - start + 1;

					image = {
						data: fs.createReadStream(file.path, {
							start,
							end,
						}),
						ext: file.ext,
						type: file.mime,
					};

					reply.header('Content-Range', `bytes ${start}-${end}/${file.file.size}`);
					reply.header('Accept-Ranges', 'bytes');
					reply.header('Content-Length', chunksize);
					reply.code(206);
				} else {
					image = {
						data: fs.createReadStream(file.path),
						ext: file.ext,
						type: file.mime,
					};
				}
			}

			if ('cleanup' in file) {
				if ('pipe' in image.data && typeof image.data.pipe === 'function') {
					// image.dataがstreamなら、stream終了後にcleanup
					image.data.on('end', file.cleanup);
					image.data.on('close', file.cleanup);
				} else {
					// image.dataがstreamでないなら直ちにcleanup
					file.cleanup();
				}
			}

			reply.header('Content-Type', image.type);
			reply.header('Cache-Control', 'max-age=31536000, immutable');
			reply.header('Content-Disposition',
				contentDisposition(
					'inline',
					correctFilename(file.filename, image.ext),
				),
			);
			return image.data;
		} catch (e) {
			if ('cleanup' in file) file.cleanup();
			throw e;
		}
	}

	@bindThis
	private async getStreamAndTypeFromUrl(url: string, actor: string, signal: AbortSignal): Promise<
		{ state: 'remote'; fileRole?: 'thumbnail' | 'webpublic' | 'original'; file?: MiDriveFile; mime: string; ext: string | null; path: string; cleanup: () => void; filename: string; }
		| { state: 'stored_internal'; fileRole: 'thumbnail' | 'webpublic' | 'original'; file: MiDriveFile; filename: string; mime: string; ext: string | null; path: string; }
		| '404'
		| '204'
	> {
		if (url.startsWith(`${this.config.url}/files/`)) {
			const key = url.replace(`${this.config.url}/files/`, '').split('/').shift();
			if (!key) throw new StatusError('Invalid File Key', 400, 'Invalid File Key');

			return await this.getFileFromKey(key, actor, signal, Math.min(MEDIA_MAX_BYTES, this.config.maxFileSize));
		}

		return await this.downloadAndDetectTypeFromUrl(url, actor, signal);
	}

	@bindThis
	private async downloadAndDetectTypeFromUrl(url: string, actor: string, signal: AbortSignal, byteLimit = MEDIA_MAX_BYTES): Promise<
		{ state: 'remote'; mime: string; ext: string | null; path: string; cleanup: () => void; filename: string; }
	> {
		const maxBytes = Math.min(byteLimit, this.config.maxFileSize);
		const lease = await acquireResourceLease(this.redisClient, {
			...MEDIA_DOWNLOAD_BUDGET, actor, bytes: maxBytes, maxBytes: MEDIA_DOWNLOAD_BUDGET.concurrency * this.config.maxFileSize,
		});
		let remove: (() => void) | undefined;
		let removed = false;
		const cleanup = () => {
			if (removed) return;
			removed = true;
			try { remove?.(); } finally { void lease.release(); }
		};
		try {
			const temporary = await createTemp();
			const path = temporary[0];
			remove = temporary[1];
			const { filename } = await this.downloadService.downloadUrl(url, path, { maxBytes, signal: AbortSignal.any([signal, lease.signal]) });

			const { mime, ext } = await this.fileInfoService.detectType(path);

			return {
				state: 'remote',
				mime, ext,
				path, cleanup,
				filename,
			};
		} catch (e) {
			cleanup();
			throw e;
		}
	}

	@bindThis
	private async getFileFromKey(key: string, actor: string, signal: AbortSignal, maxBytes?: number): Promise<
		{ state: 'remote'; fileRole: 'thumbnail' | 'webpublic' | 'original'; file: MiDriveFile; filename: string; url: string; mime: string; ext: string | null; path: string; cleanup: () => void; }
		| { state: 'stored_internal'; fileRole: 'thumbnail' | 'webpublic' | 'original'; file: MiDriveFile; filename: string; mime: string; ext: string | null; path: string; }
		| '404'
		| '204'
	> {
		// Fetch drive file
		const file = await this.driveFilesRepository.createQueryBuilder('file')
			.where('file.accessKey = :accessKey', { accessKey: key })
			.orWhere('file.thumbnailAccessKey = :thumbnailAccessKey', { thumbnailAccessKey: key })
			.orWhere('file.webpublicAccessKey = :webpublicAccessKey', { webpublicAccessKey: key })
			.getOne();

		if (file == null) return '404';

		const isThumbnail = file.thumbnailAccessKey === key;
		const isWebpublic = file.webpublicAccessKey === key;

		if (!file.storedInternal) {
			if (!(file.isLink && file.uri)) return '204';
			const result = await this.downloadAndDetectTypeFromUrl(file.uri, actor, signal, maxBytes ?? this.config.maxFileSize);
			file.size = (await fs.promises.stat(result.path)).size;	// DB file.sizeは正確とは限らないので
			return {
				...result,
				url: file.uri,
				fileRole: isThumbnail ? 'thumbnail' : isWebpublic ? 'webpublic' : 'original',
				file,
				filename: file.name,
			};
		}

		if (!/^[a-zA-Z0-9._-]+$/.test(key) || key === '.' || key === '..') return '404';

		const path = this.internalStorageService.resolvePath(key);
		if (maxBytes != null && (await fs.promises.stat(path)).size > maxBytes) throw new StatusError('File exceeds the proxy limit', 413);

		if (isThumbnail || isWebpublic) {
			const { mime, ext } = await this.fileInfoService.detectType(path);
			return {
				state: 'stored_internal',
				fileRole: isThumbnail ? 'thumbnail' : 'webpublic',
				file,
				filename: file.name,
				mime, ext,
				path,
			};
		}

		return {
			state: 'stored_internal',
			fileRole: 'original',
			file,
			filename: file.name,
			// 古いファイルは修正前のmimeを持っているのでできるだけ修正してあげる
			mime: this.fileInfoService.fixMime(file.type),
			ext: null,
			path,
		};
	}
}
