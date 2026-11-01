/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { groupedNotificationTypes, hatadyNotificationSubtypes, userExportableEntities } from '@/types.js';

const baseSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
		},
		notificationIds: {
			type: 'array', optional: true, nullable: false,
			items: { type: 'string', format: 'id', optional: false, nullable: false },
		},
		createdAt: {
			type: 'string',
			optional: false, nullable: false,
			format: 'date-time',
		},
		type: {
			type: 'string',
			optional: false, nullable: false,
			enum: groupedNotificationTypes,
		},
	},
} as const;

export const packedNotificationSchema = {
	type: 'object',
	oneOf: [{
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['note'],
			},
			user: {
				type: 'object',
				ref: 'UserLite',
				optional: false, nullable: false,
			},
			userId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
			note: {
				type: 'object',
				ref: 'Note',
				optional: false, nullable: false,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['mention'],
			},
			user: {
				type: 'object',
				ref: 'UserLite',
				optional: false, nullable: false,
			},
			userId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
			note: {
				type: 'object',
				ref: 'Note',
				optional: false, nullable: false,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['reply'],
			},
			user: {
				type: 'object',
				ref: 'UserLite',
				optional: false, nullable: false,
			},
			userId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
			note: {
				type: 'object',
				ref: 'Note',
				optional: false, nullable: false,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['renote'],
			},
			user: {
				type: 'object',
				ref: 'UserLite',
				optional: false, nullable: false,
			},
			userId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
			note: {
				type: 'object',
				ref: 'Note',
				optional: false, nullable: false,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['quote'],
			},
			user: {
				type: 'object',
				ref: 'UserLite',
				optional: false, nullable: false,
			},
			userId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
			note: {
				type: 'object',
				ref: 'Note',
				optional: false, nullable: false,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['reaction'],
			},
			user: {
				type: 'object',
				ref: 'UserLite',
				optional: false, nullable: false,
			},
			userId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
			note: {
				type: 'object',
				ref: 'Note',
				optional: false, nullable: false,
			},
			reaction: {
				type: 'string',
				optional: false, nullable: false,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['pollEnded'],
			},
			user: {
				type: 'object',
				ref: 'UserLite',
				optional: false, nullable: false,
			},
			userId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
			note: {
				type: 'object',
				ref: 'Note',
				optional: false, nullable: false,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['scheduledNotePosted'],
			},
			note: {
				type: 'object',
				ref: 'Note',
				optional: false, nullable: false,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['scheduledNotePostFailed'],
			},
			noteDraft: {
				type: 'object',
				ref: 'NoteDraft',
				optional: false, nullable: false,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['follow'],
			},
			user: {
				type: 'object',
				ref: 'UserLite',
				optional: false, nullable: false,
			},
			userId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['receiveFollowRequest'],
			},
			user: {
				type: 'object',
				ref: 'UserLite',
				optional: false, nullable: false,
			},
			userId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['followRequestAccepted'],
			},
			user: {
				type: 'object',
				ref: 'UserLite',
				optional: false, nullable: false,
			},
			userId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
			message: {
				type: 'string',
				optional: false, nullable: true,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['roleAssigned'],
			},
			role: {
				type: 'object',
				ref: 'Role',
				optional: false, nullable: false,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['chatRoomInvitationReceived'],
			},
			invitation: {
				type: 'object',
				ref: 'ChatRoomInvitation',
				optional: false, nullable: false,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['achievementEarned'],
			},
			achievement: {
				ref: 'AchievementName',
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['exportCompleted'],
			},
			exportedEntity: {
				type: 'string',
				optional: false, nullable: false,
				enum: userExportableEntities,
			},
			fileId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['login'],
			},
			ip: {
				type: 'string',
				optional: false, nullable: false,
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['createToken'],
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['app'],
			},
			body: {
				type: 'string',
				optional: false, nullable: false,
			},
			header: {
				type: 'string',
				optional: false, nullable: true,
			},
			icon: {
				type: 'string',
				optional: false, nullable: true,
			},
			// 旗鯖fork: クリック時の遷移先パス (相対パスのみ、'/' 始まり必須、null 許容)
			link: {
				type: 'string',
				optional: false, nullable: true,
			},
		},
	}, {
		// 旗鯖fork: HataFeed 通知(app通知と同形。通知フィルタで個別にON/OFFできるよう専用タイプ)
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['hataFeed'],
			},
			body: {
				type: 'string',
				optional: false, nullable: false,
			},
			header: {
				type: 'string',
				optional: false, nullable: true,
			},
			icon: {
				type: 'string',
				optional: false, nullable: true,
			},
			link: {
				type: 'string',
				optional: false, nullable: true,
			},
			sourceNotificationId: { type: 'string', optional: true, nullable: false },
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: { type: 'string', optional: false, nullable: false, enum: ['hatady'] },
			sourceNotificationId: { type: 'string', optional: false, nullable: false },
			subtype: { type: 'string', optional: false, nullable: false, enum: hatadyNotificationSubtypes },
			targetType: { type: 'string', optional: false, nullable: false, enum: ['none', 'log', 'comment', 'work', 'session', 'mediaComment'] },
			targetId: { type: 'string', optional: false, nullable: true, format: 'id' },
			user: { type: 'object', ref: 'UserLite', optional: true, nullable: false },
			userId: { type: 'string', optional: true, nullable: false, format: 'id' },
			title: { type: 'string', optional: true, nullable: false },
			logId: { type: 'string', optional: true, nullable: false, format: 'id' },
			mediaWorkId: { type: 'string', optional: true, nullable: false, format: 'id' },
			mediaSessionId: { type: 'string', optional: true, nullable: false, format: 'id' },
			mediaCommentId: { type: 'string', optional: true, nullable: false, format: 'id' },
			commentId: { type: 'string', optional: true, nullable: false, format: 'id' },
			reaction: { type: 'string', optional: true, nullable: false },
			value: { type: 'number', optional: true, nullable: false },
			isRead: { type: 'boolean', optional: false, nullable: false },
		},
	}, {
		// 旗鯖fork: Hataskのお花・アイコンデコ獲得通知(app通知と同形)。
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['hataskFlowerReady', 'hataskFlowerBloomed', 'hataskZukanUpdated', 'hataskFestivalBloomed', 'hataskDecorationUnlocked'],
			},
			body: {
				type: 'string',
				optional: false, nullable: false,
			},
			header: {
				type: 'string',
				optional: false, nullable: true,
			},
			icon: {
				type: 'string',
				optional: false, nullable: true,
			},
			link: {
				type: 'string',
				optional: false, nullable: true,
			},
		},
	}, {
		// 旗鯖fork: 地震・津波情報の通知(app通知と同形。通知フィルタで個別ON/OFF可)
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['earthquake'],
			},
			body: {
				type: 'string',
				optional: false, nullable: false,
			},
			header: {
				type: 'string',
				optional: false, nullable: true,
			},
			icon: {
				type: 'string',
				optional: false, nullable: true,
			},
			link: {
				type: 'string',
				optional: false, nullable: true,
			},
		},
	}, {
		// 旗鯖fork: プライベートチャンネルのメンバー構成変更通知 (追加 / 除外)
		// app通知と同形だが、通知フィルタで個別ON/OFFできるよう専用タイプにしている。
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['addedToPrivateChannel', 'removedFromPrivateChannel'],
			},
			body: { type: 'string', optional: false, nullable: false },
			header: { type: 'string', optional: false, nullable: true },
			icon: { type: 'string', optional: false, nullable: true },
			link: { type: 'string', optional: false, nullable: true },
			invitationId: { type: 'string', format: 'misskey:id', optional: true, nullable: false },
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['reaction:grouped'],
			},
			note: {
				type: 'object',
				ref: 'Note',
				optional: false, nullable: false,
			},
			reactions: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'object',
					properties: {
						user: {
							type: 'object',
							ref: 'UserLite',
							optional: false, nullable: false,
						},
						reaction: {
							type: 'string',
							optional: false, nullable: false,
						},
					},
					required: ['user', 'reaction'],
				},
			},
		},
	}, {
		// 旗鯖fork: 同じユーザーから複数ノートへのリアクションをまとめる新規グループタイプ
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['reaction:groupedByUser'],
			},
			user: {
				type: 'object',
				ref: 'UserLite',
				optional: false, nullable: false,
			},
			userId: {
				type: 'string',
				optional: false, nullable: false,
				format: 'id',
			},
			reactions: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'object',
					properties: {
						note: {
							type: 'object',
							ref: 'Note',
							optional: false, nullable: false,
						},
						reaction: {
							type: 'string',
							optional: false, nullable: false,
						},
						createdAt: {
							type: 'string',
							optional: false, nullable: false,
							format: 'date-time',
						},
					},
					required: ['note', 'reaction', 'createdAt'],
				},
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['renote:grouped'],
			},
			note: {
				type: 'object',
				ref: 'Note',
				optional: false, nullable: false,
			},
			users: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'object',
					ref: 'UserLite',
					optional: false, nullable: false,
				},
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['note:grouped'],
			},
			noteIds: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'string',
					format: 'id',
					optional: false, nullable: false,
				},
			},
			users: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'object',
					ref: 'UserLite',
					optional: false, nullable: false,
				},
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['test'],
			},
		},
	}, {
		type: 'object',
		properties: {
			...baseSchema.properties,
			type: {
				type: 'string',
				optional: false, nullable: false,
				enum: ['groupInvited'],
			},
			user: {
				type: 'object',
				ref: 'UserLite',
				optional: false, nullable: false,
			},
			invitation: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						optional: false, nullable: false,
						format: 'id',
					},
					group: {
						type: 'object',
						properties: {
							name: {
								type: 'string',
								optional: false, nullable: false,
							},
						},
						optional: false, nullable: false,
					},
				},
				optional: false, nullable: false,
			},
		},
	}],
} as const;
