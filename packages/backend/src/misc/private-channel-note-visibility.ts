/* SPDX-License-Identifier: AGPL-3.0-only */
import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * Exclude the whole note when any attached reply/renote belongs to a channel in `deniedChannelIds`.
 * The caller resolves which private channels the viewer cannot read (one query per request), so
 * each candidate row only walks its own reply/renote graph and compares channel IDs.
 * An author always keeps their own notes, including after leaving the channel.
 */
export function applyPrivateChannelNoteVisibility<T extends ObjectLiteral>(
	query: SelectQueryBuilder<T>,
	meId: string | null,
	deniedChannelIds: readonly string[],
	noteAlias = 'note',
): void {
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(noteAlias)) throw new Error('Invalid note query alias');
	// Nothing the viewer could see is hidden: skip the graph walk entirely.
	if (deniedChannelIds.length === 0) return;
	const root = `"${noteAlias}"`;
	const ownNote = meId == null ? '' : `
				AND channel_note."userId" IS DISTINCT FROM :privateChannelViewerId`;
	query.andWhere(`(
		(${root}."channelId" IS NULL AND ${root}."replyId" IS NULL AND ${root}."renoteId" IS NULL)
		OR NOT EXISTS (
			WITH RECURSIVE channel_note_tree AS (
				SELECT ${root}."id", ${root}."userId", ${root}."channelId", ${root}."replyId", ${root}."renoteId"
				UNION
				SELECT child."id", child."userId", child."channelId", child."replyId", child."renoteId"
				FROM "note" child
				INNER JOIN channel_note_tree ancestor ON child."id" IN (ancestor."replyId", ancestor."renoteId")
			)
			SELECT 1 FROM channel_note_tree channel_note
			WHERE channel_note."channelId" = ANY(CAST(:privateChannelDeniedIds AS varchar[]))${ownNote}
		)
	)`, { privateChannelDeniedIds: [...deniedChannelIds], ...(meId == null ? {} : { privateChannelViewerId: meId }) });
}
