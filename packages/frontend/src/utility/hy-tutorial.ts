/* SPDX-License-Identifier: AGPL-3.0-only */
export type HyTutorialPage = {
	readonly id: string;
	readonly label: string;
	readonly icon: string;
	readonly title: string;
	readonly description: string;
	readonly note: string;
	readonly figure: string;
	readonly caption?: string;
};
