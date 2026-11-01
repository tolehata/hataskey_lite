/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { InjectionKey } from 'vue';
import type * as Misskey from 'cherrypick-js';

export type Hk3PostReceipt = {
	complete: (note: Misskey.entities.Note, source: DOMRectReadOnly | null) => void;
	cancel: () => void;
};

export type Hk3PostContext = {
	begin: () => Hk3PostReceipt;
	reveal?: () => void;
};

/** Timeline が提供し、Composer が実際の新規投稿の開始・完了・取消を通知する。 */
export const hk3PostContextKey: InjectionKey<Hk3PostContext> = Symbol('hk3PostContext');
