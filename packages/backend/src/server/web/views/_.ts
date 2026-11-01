/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// 旗鯖fork: 本家 Misskey 2026.6.0 から取り込み (OAuth2 認可画面用)。
// 旗鯖は pug ベース UI を維持しつつ、OAuth2 認可画面のみ本家の React/JSX 実装を流用する。

import type { Config } from '@/config.js';

export const comment = `<!--
  _____ _         _
 |     |_|___ ___| |_ ___ _ _
 | | | | |_ -|_ -| '_| -_| | |
 |_|_|_|_|___|___|_,_|___|_  |
                         |___|
 Thank you for using Misskey!
 If you are reading this message... how about joining the development?
 https://github.com/misskey-dev/misskey

-->`;

export const defaultDescription = '✨🌎✨ A interplanetary communication platform ✨🚀✨';

export type MinimumCommonData = {
	version: string;
	config: Config;
};

export type ViteFiles = {
	entryJs: string | null;
	css: string[];
	modulePreloads: string[];
};

export type CommonData = MinimumCommonData & {
	langs: string[];
	instanceName: string;
	icon: string | null;
	appleTouchIcon: string | null;
	themeColor: string | null;
	serverErrorImageUrl: string;
	infoImageUrl: string;
	notFoundImageUrl: string;
	instanceUrl: string;
	now: number;
	federationEnabled: boolean;
	frontendViteFiles: ViteFiles | null;
	frontendBootloaderJs: string | null;
	frontendBootloaderCss: string | null;
	frontendEmbedViteFiles: ViteFiles | null;
	frontendEmbedBootloaderJs: string | null;
	frontendEmbedBootloaderCss: string | null;
	metaJson?: string;
	clientCtxJson?: string;
};

export type CommonPropsMinimum<T = Record<string, any>> = MinimumCommonData & T;

export type CommonProps<T = Record<string, any>> = CommonData & T;
