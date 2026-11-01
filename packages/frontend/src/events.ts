/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { EventEmitter } from 'eventemitter3';
import * as Misskey from 'cherrypick-js';
import { onBeforeUnmount } from 'vue';

type Events = {
	themeChanging: () => void;
	themeChanged: () => void;
	clientNotification: (notification: Misskey.entities.Notification) => void;
	notePosted: (note: Misskey.entities.Note) => void;
	noteDeleted: (noteId: Misskey.entities.Note['id']) => void;
	// 旗鯖fork: 本家 2026.6.0 から取り込み: アンテナのタイムラインから個別のノートを削除できるように
	noteRemovedFromAntenna: (antennaId: Misskey.entities.Antenna['id'], noteId: Misskey.entities.Note['id']) => void;
	driveFileCreated: (file: Misskey.entities.DriveFile) => void;
	driveFilesUpdated: (files: Misskey.entities.DriveFile[]) => void;
	driveFilesDeleted: (files: Misskey.entities.DriveFile[]) => void;
	driveFoldersUpdated: (folders: Misskey.entities.DriveFolder[]) => void;
	driveFoldersDeleted: (folders: Misskey.entities.DriveFolder[]) => void;

	// CherryPick
	showEl: (value: boolean) => void;
	showEl2: (value: boolean) => void;
	queueUpdated: (q: number) => void;
	createChat: (ev: MouseEvent) => void;
	showNoteContent: (value: boolean) => void;
	isAtBottom: (value: boolean) => void;
	hasRequireRefresh: (value: boolean) => void;
	reloadTimeline: () => void;
	reloadNotification: () => void;
	// ブロック操作に成功したとき、読み込み済みの利用者表示を更新する。
	userBlockingChanged: (payload: { userId: string }) => void;
	// 旗鯖fork: 上部ナビバーの「デッキ設定」ボタンからデッキツールバーを開閉する
	toggleDeckToolbar: () => void;
};

export const globalEvents = new EventEmitter<Events>();

export function useGlobalEvent<T extends keyof Events>(
	event: T,
	callback: EventEmitter.EventListener<Events, T>,
): void {
	globalEvents.on(event, callback);
	onBeforeUnmount(() => {
		globalEvents.off(event, callback);
	});
}
