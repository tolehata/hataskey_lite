/* SPDX-License-Identifier: AGPL-3.0-only */
import type { EntityManager } from 'typeorm';

export type EmojiTransaction = {
	manager: EntityManager;
	afterCommit: Array<() => Promise<void>>;
	afterRollback: Array<() => Promise<void>>;
};
