/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { groupedNotificationTypes, userExportableEntities } from '@/types.js';

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
