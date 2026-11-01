/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Existing operations expose only IDs and explicitly enumerated choices.
// Record moderation has a separate bounded allowlist for mandatory audit fields.
// Never include arbitrary snapshots, notes, contacts or invitation codes.
// New/unknown operations deliberately expose no payload until reviewed here.
const moderatorLogInfoFields: Readonly<Record<string, readonly string[]>> = {
	suspend: ['userId'],
	unsuspend: ['userId'],
	updateUserNote: ['userId'],
	addCustomEmoji: ['emojiId'],
	updateCustomEmoji: ['emojiId'],
	deleteCustomEmoji: ['emojiId'],
	assignRole: ['userId', 'roleId'],
	unassignRole: ['userId', 'roleId'],
	createRole: ['roleId'],
	updateRole: ['roleId'],
	deleteRole: ['roleId'],
	deleteDriveFile: ['fileId', 'fileUserId'],
	deleteNote: ['noteId', 'noteUserId'],
	createGlobalAnnouncement: ['announcementId'],
	createUserAnnouncement: ['announcementId', 'userId'],
	updateGlobalAnnouncement: ['announcementId'],
	updateUserAnnouncement: ['announcementId', 'userId'],
	deleteGlobalAnnouncement: ['announcementId'],
	deleteUserAnnouncement: ['announcementId', 'userId'],
	resetPassword: ['userId'],
	suspendRemoteInstance: ['id'],
	unsuspendRemoteInstance: ['id'],
	updateRemoteInstanceNote: ['id'],
	markSensitiveDriveFile: ['fileId', 'fileUserId'],
	unmarkSensitiveDriveFile: ['fileId', 'fileUserId'],
	resolveAbuseReport: ['reportId'],
	forwardAbuseReport: ['reportId'],
	updateAbuseReportNote: ['reportId'],
	createAd: ['adId'],
	updateAd: ['adId'],
	deleteAd: ['adId'],
	createAvatarDecoration: ['avatarDecorationId'],
	updateAvatarDecoration: ['avatarDecorationId'],
	deleteAvatarDecoration: ['avatarDecorationId'],
	unsetMfa: ['userId'],
	unsetUserAvatar: ['userId', 'fileId'],
	unsetUserBanner: ['userId', 'fileId'],
	createSystemWebhook: ['systemWebhookId'],
	updateSystemWebhook: ['systemWebhookId'],
	deleteSystemWebhook: ['systemWebhookId'],
	createAbuseReportNotificationRecipient: ['recipientId'],
	updateAbuseReportNotificationRecipient: ['recipientId'],
	deleteAbuseReportNotificationRecipient: ['recipientId'],
	deleteAccount: ['userId'],
	deletePage: ['pageId', 'pageUserId'],
	deleteFlash: ['flashId', 'flashUserId'],
	deleteGalleryPost: ['postId', 'postUserId'],
	deleteChatRoom: ['roomId'],
	voteRegistrationApplication: ['applicationId'],
	approveRegistrationApplication: ['applicationId'],
	rejectRegistrationApplication: ['applicationId'],
};

const moderatorLogInfoEnums: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
	voteRegistrationApplication: { choice: ['agree', 'oppose'] },
};

// Only these four new operations expose the required moderation audit text.
// Other operations retain the existing ID-only policy, including their search.
const recordLogTypes = ['deleteHatadyRecord', 'deleteHataskRecord', 'warnHatadyUser', 'warnHataskUser'];
const recordLogFields: Readonly<Record<string, number>> = {
	operationId: 32, product: 16, targetType: 32, targetId: 64, title: 300,
	targetUserId: 32, targetUsername: 128, targetName: 300,
	moderatorId: 32, moderatorUsername: 128, moderatorName: 300,
	performedAt: 24, reason: 1000, warningId: 32,
};

export function projectModeratorLogInfo(type: string, info: unknown): Record<string, string> {
	const projected: Record<string, string> = {};
	if (recordLogTypes.includes(type)) {
		if (info == null || typeof info !== 'object' || Array.isArray(info)) return projected;
		for (const [field, max] of Object.entries(recordLogFields)) {
			const value = Object.hasOwn(info, field) ? (info as Record<string, unknown>)[field] : null;
			if (typeof value === 'string' && Array.from(value).length >= 1 && Array.from(value).length <= max) projected[field] = value;
		}
		return projected;
	}
	if (info == null || typeof info !== 'object' || Array.isArray(info) || !Object.hasOwn(moderatorLogInfoFields, type)) return projected;
	for (const field of moderatorLogInfoFields[type]) {
		if (!Object.hasOwn(info, field)) continue;
		const value: unknown = (info as Record<string, unknown>)[field];
		// Matches the ID column's 32-character limit. Reject unexpected types,
		// whitespace and punctuation rather than stringify arbitrary old payloads.
		if (typeof value === 'string' && value.length > 0 && value.length <= 32 && !/[^a-zA-Z0-9]/.test(value)) {
			projected[field] = value;
		}
	}
	for (const [field, allowed] of Object.entries(Object.hasOwn(moderatorLogInfoEnums, type) ? moderatorLogInfoEnums[type] : {})) {
		if (!Object.hasOwn(info, field)) continue;
		const value: unknown = (info as Record<string, unknown>)[field];
		if (typeof value === 'string' && allowed.includes(value)) projected[field] = value;
	}
	return projected;
}

// The same allowlist governs both SELECT and WHERE, before LIMIT/pagination.
// SQL identifiers/fields come only from the static table above, never a request.
// Do not replace the search expression with raw log.info: that leaks redacted
// values through matches and page boundaries even when the response is redacted.
export const moderatorLogInfoSql = `(CASE "log"."type" ${recordLogTypes.map(type => `WHEN '${type}' THEN jsonb_strip_nulls(jsonb_build_object(${Object.entries(recordLogFields).map(([field, max]) => `'${field}', CASE WHEN jsonb_typeof("log"."info"->'${field}')='string' AND char_length("log"."info"->>'${field}') BETWEEN 1 AND ${max} THEN "log"."info"->'${field}' ELSE NULL END`).join(', ')}))`).join(' ')} ${Object.entries(moderatorLogInfoFields).map(([type, fields]) => {
	const values = fields.map(field => {
		const value = `"log"."info"->>'${field}'`;
		return `'${field}', CASE WHEN jsonb_typeof("log"."info"->'${field}') = 'string' AND char_length(${value}) BETWEEN 1 AND 32 AND ${value} !~ '[^a-zA-Z0-9]' THEN "log"."info"->'${field}' ELSE NULL END`;
	});
	for (const [field, allowed] of Object.entries(Object.hasOwn(moderatorLogInfoEnums, type) ? moderatorLogInfoEnums[type] : {})) {
		values.push(`'${field}', CASE WHEN jsonb_typeof("log"."info"->'${field}') = 'string' AND "log"."info"->>'${field}' IN (${allowed.map(value => `'${value}'`).join(', ')}) THEN "log"."info"->'${field}' ELSE NULL END`);
	}
	return `WHEN '${type}' THEN jsonb_strip_nulls(jsonb_build_object(${values.join(', ')}))`;
}).join(' ')} ELSE '{}'::jsonb END)`;
