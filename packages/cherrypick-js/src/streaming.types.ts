import {
	Antenna,
	ChatMessage,
	ChatMessageLite,
	DriveFile,
	DriveFolder,
	Note,
	Notification,
	Signin,
	User,
	UserGroup,
	UserDetailed,
	UserDetailedNotMe,
	UserLite,
} from './autogen/models.js';
import {
	AnnouncementCreated,
	EmojiAdded, EmojiDeleted,
	EmojiUpdated,
	PageEvent,
	QueueStats,
	QueueStatsLog,
	ServerStats,
	ServerStatsLog,
	ReversiGameDetailed,
} from './entities.js';
import type { HataHatadyActivitiesResponse } from './autogen/entities.js';
import {
	ReversiUpdateKey,
} from './consts.js';

type ReversiUpdateSettings<K extends ReversiUpdateKey> = {
	key: K;
	value: ReversiGameDetailed[K];
};

export type LtlPunchState = {
	id: string;
	revision: number;
	startedAt: number;
	fallAt: number;
	endsAt: number;
	finishedAt: number | null;
	status: 'active' | 'won' | 'escaped';
	hp: number;
	maxHp: number;
	people: number;
	serverNow: number;
};

export type Channels = {
	hatadyTimeline: {
		params: { scope: 'mine' | 'recent' | 'following'; kind?: 'study' | 'movie' | 'game' | 'exercise' | 'work' | 'cooking' };
		events: {
			activity: (payload: { seq: number; key: string; activity: HataHatadyActivitiesResponse['items'][number] }) => void;
			removed: (payload: { seq: number; key: string; id: string }) => void;
			synced: (payload: { seq: number; requestId: number }) => void;
			resyncRequired: (payload: { seq: number; requestId?: number }) => void;
		};
		receives: { sync: { ids: string[]; seenThrough: number; requestId: number } };
	};
	ltlPunch: {
		params: null;
		events: {
			state: (payload: LtlPunchState | null) => void;
		};
		receives: {
			sync: Record<string, never>;
			attack: { eventId: string; requestId: string };
		};
	};
	main: {
		params: null;
		events: {
			notification: (payload: Notification) => void;
			mention: (payload: Note) => void;
			reply: (payload: Note) => void;
			renote: (payload: Note) => void;
			follow: (payload: UserDetailedNotMe) => void; // 自分が他人をフォローしたとき
			followed: (payload: UserDetailed | UserLite) => void; // 他人が自分をフォローしたとき
			unfollow: (payload: UserDetailed) => void; // 自分が他人をフォロー解除したとき
			meUpdated: (payload: UserDetailed) => void;
			pageEvent: (payload: PageEvent) => void;
			urlUploadFinished: (payload: { marker: string; file: DriveFile; }) => void;
			readAllNotifications: (payload: { ids: string[]; unreadNotificationsCount: number; revision: string }) => void;
			readNotification: (payload: { id: string; unreadNotificationsCount: number; revision: string }) => void;
			notificationChanged: (payload: { ids: string[]; unreadNotificationsCount: number; revision: string }) => void;
			unreadNotification: (payload: Notification & { unreadNotificationsCount: number; revision: string }) => void;
			notificationFlushed: (payload: { unreadNotificationsCount: number; revision: string }) => void;
			unreadAntenna: (payload: Antenna) => void;
			newChatMessage: (payload: ChatMessage) => void;
			readAllAnnouncements: () => void;
			myTokenRegenerated: () => void;
			signin: (payload: Signin) => void;
			registryUpdated: (payload: {
				scope?: string[];
				key: string;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				value: any | null;
			}) => void;
			driveFileCreated: (payload: DriveFile) => void;
			readAntenna: (payload: Antenna) => void;
			receiveFollowRequest: (payload: User) => void;
			announcementCreated: (payload: AnnouncementCreated) => void;
			mutingImportCompleted: () => void;
		};
		receives: null;
	};
	homeTimeline: {
		params: {
			withRenotes?: boolean;
			withFiles?: boolean;
			withCats?: boolean;
		};
		events: {
			note: (payload: Note) => void;
		};
		receives: null;
	};
	localTimeline: {
		params: {
			withRenotes?: boolean;
			withReplies?: boolean;
			withFiles?: boolean;
			withCats?: boolean;
		};
		events: {
			note: (payload: Note) => void;
		};
		receives: null;
	};
	hybridTimeline: {
		params: {
			withRenotes?: boolean;
			withReplies?: boolean;
			withFiles?: boolean;
			withCats?: boolean;
		};
		events: {
			note: (payload: Note) => void;
		};
		receives: null;
	};
	globalTimeline: {
		params: {
			withRenotes?: boolean;
			withFiles?: boolean;
			withCats?: boolean;
		};
		events: {
			note: (payload: Note) => void;
		};
		receives: null;
	};
	bubbleTimeline: {
		params: {
			withRenotes?: boolean;
			withFiles?: boolean;
			withCats?: boolean;
		};
		events: {
			note: (payload: Note) => void;
		};
		receives: null;
	};
	userList: {
		params: {
			listId: string;
			withFiles?: boolean;
			withRenotes?: boolean;
			withCats?: boolean;
		};
		events: {
			note: (payload: Note) => void;
		};
		receives: null;
	};
	hashtag: {
		params: {
			q: string[][];
		};
		events: {
			note: (payload: Note) => void;
		};
		receives: null;
	};
	roleTimeline: {
		params: {
			roleId: string;
		};
		events: {
			note: (payload: Note) => void;
		};
		receives: null;
	};
	antenna: {
		params: {
			antennaId: string;
		};
		events: {
			note: (payload: Note) => void;
		};
		receives: null;
	};
	channel: {
		params: {
			channelId: string;
		};
		events: {
			note: (payload: Note) => void;
		};
		receives: null;
	};
	clip: {
		params: {
			clipId: string;
		};
		events: {
			updated: () => void;
			deleted: () => void;
		};
		receives: null;
	};
	drive: {
		params: null;
		events: {
			fileCreated: (payload: DriveFile) => void;
			fileDeleted: (payload: DriveFile['id']) => void;
			fileUpdated: (payload: DriveFile) => void;
			folderCreated: (payload: DriveFolder) => void;
			folderDeleted: (payload: DriveFolder['id']) => void;
			folderUpdated: (payload: DriveFolder) => void;
		};
		receives: null;
	};
	serverStats: {
		params: null;
		events: {
			stats: (payload: ServerStats) => void;
			statsLog: (payload: ServerStatsLog) => void;
		};
		receives: {
			requestLog: {
				id: string | number;
				length: number;
			};
		};
	};
	queueStats: {
		params: null;
		events: {
			stats: (payload: QueueStats) => void;
			statsLog: (payload: QueueStatsLog) => void;
		};
		receives: {
			requestLog: {
				id: string | number;
				length: number;
			};
		};
	};
	admin: {
		params: null;
		events: {
			newAbuseUserReport: {
				id: string;
				targetUserId: string;
				reporterId: string;
				comment: string;
			}
		};
		receives: null;
	};
	reversi: {
		params: null;
		events: {
			matched: (payload: { game: ReversiGameDetailed }) => void;
			invited: (payload: { user: User }) => void;
		};
		receives: null;
	};
	reversiGame: {
		params: {
			gameId: string;
		};
		events: {
			started: (payload: { game: ReversiGameDetailed; }) => void;
			ended: (payload: { winnerId: User['id'] | null; game: ReversiGameDetailed; }) => void;
			canceled: (payload: { userId: User['id']; }) => void;
			changeReadyStates: (payload: { user1: boolean; user2: boolean; }) => void;
			updateSettings: <K extends ReversiUpdateKey>(payload: { userId: User['id']; key: K; value: ReversiGameDetailed[K]; }) => void;
			log: (payload: Record<string, unknown>) => void;
			reacted: (payload: { userId: User['id']; reaction: string; }) => void;
		};
		receives: {
			putStone: {
				pos: number;
				id: string;
			};
			ready: boolean;
			cancel: null | Record<string, never>;
			updateSettings: ReversiUpdateSettings<ReversiUpdateKey>;
			claimTimeIsUp: null | Record<string, never>;
			reaction: string;
		}
	};
	chatUser: {
		params: {
			otherId: string;
		};
		events: {
			message: (payload: ChatMessageLite) => void;
			deleted: (payload: ChatMessageLite['id']) => void;
			react: (payload: {
				reaction: string;
				user?: UserLite;
				messageId: ChatMessageLite['id'];
			}) => void;
			unreact: (payload: {
				reaction: string;
				user?: UserLite;
				messageId: ChatMessageLite['id'];
			}) => void;
		};
		receives: {
			read: {
				id: ChatMessageLite['id'];
			};
		};
	};
	chatRoom: {
		params: {
			roomId: string;
		};
		events: {
			message: (payload: ChatMessageLite) => void;
			deleted: (payload: ChatMessageLite['id']) => void;
			react: (payload: {
				reaction: string;
				user?: UserLite;
				messageId: ChatMessageLite['id'];
			}) => void;
			unreact: (payload: {
				reaction: string;
				user?: UserLite;
				messageId: ChatMessageLite['id'];
			}) => void;
		};
		receives: {
			read: {
				id: ChatMessageLite['id'];
			};
		};
	};
};

export type NoteUpdatedEvent = { id: Note['id'] } & ({
	type: 'utageStatusUpdated';
	body: Required<Pick<Note, 'utageStatus' | 'utageRevision' | 'utageExpiresAt' | 'utageServerNow' | 'utageRevival' | 'utageSuccessMethod'>> & {
		status: NonNullable<Note['utageStatus']>;
	};
} | {
	type: 'reacted';
	body: {
		reaction: string;
		emoji: string | null;
		userId: User['id'];
	};
} | {
	type: 'unreacted';
	body: {
		reaction: string;
		userId: User['id'];
	};
} | {
	type: 'deleted';
	body: {
		deletedAt: string;
	};
} | {
	type: 'updated';
	body: {
		cw: string | null;
		text: string;
	};
} | {
	type: 'pollVoted';
	body: {
		choice: number;
		userId: User['id'];
	};
});

export type BroadcastEvents = {
	noteUpdated: (payload: NoteUpdatedEvent) => void;
	emojiAdded: (payload: EmojiAdded) => void;
	emojiUpdated: (payload: EmojiUpdated) => void;
	emojiDeleted: (payload: EmojiDeleted) => void;
	announcementCreated: (payload: AnnouncementCreated) => void;
	// 旗鯖fork: 地震・津波情報のリアルタイム配信。
	earthquakeEvent: (payload: { code: number; item: Record<string, any> }) => void;
	// 旗鯖fork: Hataskey UIの隠しタイムライン崩壊演出。
	hataTimelineCollapse: (payload: Record<string, never>) => void;
};
