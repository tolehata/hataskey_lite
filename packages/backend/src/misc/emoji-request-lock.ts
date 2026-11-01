/* SPDX-License-Identifier: AGPL-3.0-only */
import type { EntityManager } from 'typeorm';

/** Shared by review and applicant cancellation, including across server processes. */
export async function lockEmojiRequest(manager: EntityManager, requestId: string): Promise<void> {
	await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', ['hatafeed-emoji-request', requestId]);
}
