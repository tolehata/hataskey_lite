/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test } from 'vitest';
import membersDialogSource from './MkPrivateChannelMembersDialog.vue?raw';
import notificationSource from './MkNotification.vue?raw';
import channelEditorSource from '../pages/channel-editor.vue?raw';

describe('private channel invitation UI', () => {
	test('管理画面に招待中・参加中・招待拒否を表示する', () => {
		expect(membersDialogSource).toContain('misskeyApi(\'channels/invitations\'');
		expect(membersDialogSource).toContain('参加招待を送る');
		expect(membersDialogSource).toContain('招待中');
		expect(membersDialogSource).toContain('参加中');
		expect(membersDialogSource).toContain('招待拒否');
	});

	test('通知上の承認・拒否は招待IDを本人用APIへ送る', () => {
		expect(notificationSource).toContain('notification.type === \'addedToPrivateChannel\' && notification.invitationId');
		expect(notificationSource).toContain('misskeyApi(\'channels/invitations/accept\', { invitationId })');
		expect(notificationSource).toContain('misskeyApi(\'channels/invitations/reject\', { invitationId })');
		expect(notificationSource).toContain('参加する');
		expect(notificationSource).toContain('参加しない');
	});

	test('作成権限がない場合は切替の直下で管理者の許可が必要と案内する', () => {
		expect(channelEditorSource).toContain('v-if="!canMakePrivateChannel && !wasPrivate" :class="$style.privateChannelRestriction"');
		expect(channelEditorSource).toContain('この機能はサーバー管理者によって制限されています。');
		expect(channelEditorSource).toContain('作成には管理者の許可が必要です。');
	});

	test('プライベートチャンネルの管理者を利用者向けに管理者と表示する', () => {
		expect(channelEditorSource).toContain('あなた・管理者・モデレーター');
		expect(channelEditorSource).toContain('>管理者</div>');
	});
});
