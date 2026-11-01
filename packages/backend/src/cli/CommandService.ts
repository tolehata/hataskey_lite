/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { Config } from '@/config.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { MetaService } from '@/core/MetaService.js';
import { TrendingService } from '@/core/TrendingService.js';

@Injectable()
export class CommandService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private metaService: MetaService,

		private trendingService: TrendingService,
	) {
	}

	@bindThis
	public async ping() {
		console.log('pong');
	}

	@bindThis
	public async resetCaptcha() {
		await this.metaService.update({
			enableHcaptcha: false,
			hcaptchaSiteKey: null,
			hcaptchaSecretKey: null,
			enableMcaptcha: false,
			mcaptchaSitekey: null,
			mcaptchaSecretKey: null,
			mcaptchaInstanceUrl: null,
			enableRecaptcha: false,
			recaptchaSiteKey: null,
			recaptchaSecretKey: null,
			enableTurnstile: false,
			turnstileSiteKey: null,
			turnstileSecretKey: null,
			enableTestcaptcha: false,
		});
	}

	@bindThis
	public async rebuildTrending() {
		// 旗鯖fork: トレンドタイムライン(TTL)のRedisスコアキャッシュを過去7日間のDBから再構築する。
		// 機能リリース直後やRedis消失時の初期化用。以降はリアクション/リノートでリアルタイムに加算される。
		await this.trendingService.rebuildFromHistory({
			info: (msg: string) => console.log(`[rebuild-trending] ${msg}`),
		});
	}
}
