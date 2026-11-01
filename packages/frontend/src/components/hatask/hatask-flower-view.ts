/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'cherrypick-js';

/** Localized display data; persisted flower records remain owned by Hatask. */
export type HataskFlowerView = {
	id: string;
	emoji: string;
	name: string;
	variety?: string;
	hanakotoba?: string;
	harvestedAt: string;
	dateLabel: string;
	rare: boolean;
	isOwner: boolean;
	user?: Misskey.entities.UserLite;
};

export type HataskFlowerSelection = {
	flower: HataskFlowerView;
	anchor: HTMLElement;
	returnFocusTo: HTMLElement | null;
};
