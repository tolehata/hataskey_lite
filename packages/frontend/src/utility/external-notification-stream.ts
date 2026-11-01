/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 旗鯖fork: 外部アカウント (`external.token` / `external.host`) に対する
 * 永続的な WebSocket 接続管理。
 *
 * Misskey の main channel を subscribe し、通知 (notification) イベントを受信する。
 * visibilityState が 'hidden' になったら切断、'visible' に戻ったら再接続する仕組み
 * (Misskey のメインストリームと同じアイドル管理)。
 *
 * 通知受信時は `external-notification` CustomEvent を window に dispatch。
 * フロント各所 (トースト表示、バッジ更新、通知ページ等) はこのイベントを listen する。
 *
 * 通知の重複防止のため、受信済み通知ID集合をメモリ保持。
 * ページ再表示時に history fetch しても、同じ通知が二度トーストされないよう排除。
 */

import { prefer } from '@/preferences.js';
import { isAllowedExternalHost } from '@/utility/external-api.js';

let connection: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isStarted = false;
const seenNotificationIds = new Set<string>();
const SEEN_IDS_MAX = 500; // メモリ膨張防止: 古いIDから捨てる
const RECONNECT_DELAY_MS = 5000;

function isExternalConnected(): boolean {
	const token = prefer.s['external.token'];
	const host = prefer.s['external.host'];
	// 旗鯖fork: トースト通知無効化トグルがONならWS接続を行わない
	// (トーストもバッジ更新も全部止まる、ユーザー意思の尊重)
	if (prefer.s['external.disableNotificationToast'] === true) return false;
	return token != null && isAllowedExternalHost(host);
}

function recordSeen(id: string) {
	seenNotificationIds.add(id);
	if (seenNotificationIds.size > SEEN_IDS_MAX) {
		// 一番古いものから削除 (Set の挿入順を利用)
		const first = seenNotificationIds.values().next().value;
		if (first) seenNotificationIds.delete(first);
	}
}

function handleMessage(ev: MessageEvent) {
	try {
		const data = JSON.parse(ev.data);
		if (data.type !== 'channel') return;
		if (data.body?.type !== 'notification') return;

		const notification = data.body.body;
		if (!notification?.id) return;

		// 重複排除
		if (seenNotificationIds.has(notification.id)) return;
		recordSeen(notification.id);

		// 通知受信を全フロントに通知
		window.dispatchEvent(new CustomEvent('external-notification', {
			detail: notification,
		}));
	} catch (err) {
		// パースエラー等は無視
	}
}

function connect() {
	if (!isExternalConnected()) return;
	if (connection && connection.readyState === WebSocket.OPEN) return;
	if (connection && connection.readyState === WebSocket.CONNECTING) return;

	const token = prefer.s['external.token'];
	const host = prefer.s['external.host'];
	if (!token || !host) return;

	try {
		connection = new WebSocket(`wss://${host}/streaming?i=${encodeURIComponent(token)}`);
	} catch (err) {
		scheduleReconnect();
		return;
	}

	connection.addEventListener('open', () => {
		// main channel を subscribe
		try {
			connection?.send(JSON.stringify({
				type: 'connect',
				body: {
					channel: 'main',
					id: 'external-notification-main',
				},
			}));
		} catch {}
	});

	connection.addEventListener('message', handleMessage);

	connection.addEventListener('close', () => {
		connection = null;
		// visible 状態かつ連携中なら再接続を試みる
		if (document.visibilityState === 'visible' && isExternalConnected() && isStarted) {
			scheduleReconnect();
		}
	});

	connection.addEventListener('error', () => {
		try { connection?.close(); } catch {}
	});
}

function disconnect() {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (connection) {
		try {
			// main channel を unsubscribe
			if (connection.readyState === WebSocket.OPEN) {
				connection.send(JSON.stringify({
					type: 'disconnect',
					body: { id: 'external-notification-main' },
				}));
			}
			connection.close();
		} catch {}
		connection = null;
	}
}

function scheduleReconnect() {
	if (reconnectTimer) return;
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		if (isStarted && document.visibilityState === 'visible' && isExternalConnected()) {
			connect();
		}
	}, RECONNECT_DELAY_MS);
}

function onVisibilityChange() {
	if (!isStarted) return;
	if (document.visibilityState === 'visible') {
		if (isExternalConnected()) connect();
	} else {
		// アイドル時は切断 (Misskey 標準のメインストリームと同じ挙動)
		disconnect();
	}
}

/**
 * 外部通知ストリームを開始する。
 * 通常は main-boot.ts の起動時に1回だけ呼ぶ。
 * 外部アカウント未連携時は何もしない。
 */
export function startExternalNotificationStream() {
	if (isStarted) return;
	isStarted = true;
	document.addEventListener('visibilitychange', onVisibilityChange);
	// 初回接続
	if (document.visibilityState === 'visible' && isExternalConnected()) {
		connect();
	}
}

/**
 * 外部通知ストリームを停止する (ログアウト時等)。
 */
export function stopExternalNotificationStream() {
	if (!isStarted) return;
	isStarted = false;
	document.removeEventListener('visibilitychange', onVisibilityChange);
	disconnect();
}

/**
 * 外部アカウント設定が変わった時に呼ぶ。
 * トークン/ホストが変わったら再接続する。
 */
export function restartExternalNotificationStream() {
	if (!isStarted) return;
	disconnect();
	if (document.visibilityState === 'visible' && isExternalConnected()) {
		connect();
	}
}
