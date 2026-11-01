/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// 旗鯖fork: 本家 Misskey 2026.6.0 から取り込み。OAuth2 認可画面の SSR 共通データ供給。
// 旗鯖 vanilla UI は引き続き ClientServerService.ts + pug を使用するため、
// 本サービスは現時点で OAuth2ProviderService.ts からのみ利用される。

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { promises as fsp, readdirSync } from 'node:fs';
import { Injectable, Inject } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { htmlSafeJsonStringify } from '@/misc/json-stringify-html-safe.js';
import { MetaEntityService } from '@/core/entities/MetaEntityService.js';
import type { Config } from '@/config.js';
import type { MiMeta } from '@/models/Meta.js';
import { resolveAppIconUrl } from './app-icon.js';
import type { CommonData, ViteFiles } from './views/_.js';
import type { FastifyReply } from 'fastify';
import type { Manifest } from 'vite';

// 旗鯖fork: 本家は this.config.rootDir / i18n/const に依存するが、旗鯖 Config には
// rootDir が無く、locales も named export していないため、ファイル位置基準で解決する。
const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);
// packages/backend/src/server/web → packages/backend (3階層上)
const backendRoot = resolve(_dirname, '../../..');
// packages/backend → リポジトリルート (2階層上)
const repoRoot = resolve(backendRoot, '../..');

function loadLanguages(): string[] {
	try {
		return readdirSync(resolve(repoRoot, 'locales'))
			.filter((f) => f.endsWith('.yml'))
			.map((f) => f.replace(/\.yml$/, ''));
	} catch {
		return [];
	}
}

@Injectable()
export class HtmlTemplateService {
	private frontendAssetsFetched = false;
	private readonly frontendViteBuilt: string;
	private readonly frontendEmbedViteBuilt: string;
	public frontendViteFiles: ViteFiles | null = null;
	public frontendBootloaderJs: string | null = null;
	public frontendBootloaderCss: string | null = null;
	public frontendEmbedViteFiles: ViteFiles | null = null;
	public frontendEmbedBootloaderJs: string | null = null;
	public frontendEmbedBootloaderCss: string | null = null;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private meta: MiMeta,

		private metaEntityService: MetaEntityService,
	) {
		// 旗鯖fork: config.rootDir が無いため、本家相当の built/ 位置をファイル基準で解決
		this.frontendViteBuilt = resolve(backendRoot, 'built/_frontend_vite_');
		this.frontendEmbedViteBuilt = resolve(backendRoot, 'built/_frontend_embed_vite_');
	}

	// 初期ロードで読み込むべきファイルのパスを収集する。
	// See https://ja.vite.dev/guide/backend-integration
	@bindThis
	private collectViteAssetFiles(manifest: Manifest): ViteFiles {
		const entryFile = Object.values(manifest).find((chunk) => chunk.isEntry);
		if (!entryFile) return {
			entryJs: null,
			css: [],
			modulePreloads: [],
		};

		const seenChunkIds = new Set<string>();
		const cssFiles = new Set<string>();
		const modulePreloads = new Set<string>();

		if (entryFile.css) {
			entryFile.css.forEach((css) => cssFiles.add(css));
		}

		if (entryFile.imports != null && Array.isArray(entryFile.imports)) {
			function collectImports(imports: string[], recursive = false) {
				for (const importId of imports) {
					if (seenChunkIds.has(importId)) continue;
					seenChunkIds.add(importId);

					const importedChunk = manifest[importId];
					if (!importedChunk) return;

					if (importedChunk.css) {
						importedChunk.css.forEach((css) => cssFiles.add(css));
					}

					if (importedChunk.imports != null && Array.isArray(importedChunk.imports)) {
						collectImports(importedChunk.imports, true);
					}

					if (!recursive) {
						modulePreloads.add(importedChunk.file);
					}
				}
			}

			collectImports(entryFile.imports);
		}

		return {
			entryJs: entryFile.file,
			css: Array.from(cssFiles),
			modulePreloads: Array.from(modulePreloads),
		};
	}

	@bindThis
	private async prepareFrontendAssets() {
		if (this.frontendAssetsFetched) return;
		this.frontendAssetsFetched = true;

		const [
			bootJs,
			bootCss,
			embedBootJs,
			embedBootCss,
		] = await Promise.all([
			fsp.readFile(resolve(this.frontendViteBuilt, 'loader/boot.js'), 'utf-8').catch(() => null),
			fsp.readFile(resolve(this.frontendViteBuilt, 'loader/style.css'), 'utf-8').catch(() => null),
			fsp.readFile(resolve(this.frontendEmbedViteBuilt, 'loader/boot.js'), 'utf-8').catch(() => null),
			fsp.readFile(resolve(this.frontendEmbedViteBuilt, 'loader/style.css'), 'utf-8').catch(() => null),
		]);

		let feViteManifest: Manifest | null = null;
		let embedFeViteManifest: Manifest | null = null;

		if (this.config.frontendManifestExists) {
			const manifestContent = await fsp.readFile(resolve(this.frontendViteBuilt, 'manifest.json'), 'utf-8').catch(() => null);
			feViteManifest = manifestContent ? JSON.parse(manifestContent) : null;
		}

		if (this.config.frontendEmbedManifestExists) {
			const manifestContent = await fsp.readFile(resolve(this.frontendEmbedViteBuilt, 'manifest.json'), 'utf-8').catch(() => null);
			embedFeViteManifest = manifestContent ? JSON.parse(manifestContent) : null;
		}

		if (feViteManifest != null) {
			this.frontendViteFiles = this.collectViteAssetFiles(feViteManifest);
		}

		if (bootJs != null) {
			this.frontendBootloaderJs = bootJs;
		}

		if (bootCss != null) {
			this.frontendBootloaderCss = bootCss;
		}

		if (embedFeViteManifest != null) {
			this.frontendEmbedViteFiles = this.collectViteAssetFiles(embedFeViteManifest);
		}

		if (embedBootJs != null) {
			this.frontendEmbedBootloaderJs = embedBootJs;
		}

		if (embedBootCss != null) {
			this.frontendEmbedBootloaderCss = embedBootCss;
		}
	}

	@bindThis
	public async getCommonData(): Promise<CommonData> {
		await this.prepareFrontendAssets();

		return {
			version: this.config.version,
			config: this.config,
			langs: loadLanguages(),
			instanceName: this.meta.name ?? 'Misskey',
			icon: resolveAppIconUrl(this.meta, 192, this.config.url),
			appleTouchIcon: resolveAppIconUrl(this.meta, 512, this.config.url),
			themeColor: this.meta.themeColor,
			serverErrorImageUrl: this.meta.serverErrorImageUrl ?? 'https://xn--931a.moe/assets/error.jpg',
			infoImageUrl: this.meta.infoImageUrl ?? 'https://xn--931a.moe/assets/info.jpg',
			notFoundImageUrl: this.meta.notFoundImageUrl ?? 'https://xn--931a.moe/assets/not-found.jpg',
			instanceUrl: this.config.url,
			metaJson: htmlSafeJsonStringify(await this.metaEntityService.packDetailed(this.meta)),
			now: Date.now(),
			federationEnabled: this.meta.federation !== 'none',
			frontendViteFiles: this.frontendViteFiles,
			frontendBootloaderJs: this.frontendBootloaderJs,
			frontendBootloaderCss: this.frontendBootloaderCss,
			frontendEmbedViteFiles: this.frontendEmbedViteFiles,
			frontendEmbedBootloaderJs: this.frontendEmbedBootloaderJs,
			frontendEmbedBootloaderCss: this.frontendEmbedBootloaderCss,
		};
	}

	public static async replyHtml(reply: FastifyReply, html: string | Promise<string>) {
		reply.header('Content-Type', 'text/html; charset=utf-8');
		const _html = await html;
		return reply.send(_html);
	}
}
