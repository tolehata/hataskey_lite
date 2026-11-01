/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type PageHeaderItem = {
	id?: string;
	text: string;
	icon: string;
	highlighted?: boolean;
	controls?: string;
	expanded?: boolean;
	handler: (ev: MouseEvent) => void;
};
