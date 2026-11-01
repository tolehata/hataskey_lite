/* SPDX-License-Identifier: AGPL-3.0-only */
import type * as Misskey from 'cherrypick-js';
import type { HatadyActivity } from '@/utility/hatady-media.js';
import type { HatadyHomePreview } from '@/utility/hatady-home.js';
import { homeWork } from '@/utility/hatady-home.js';
// Fictional app examples only. Public server posts and statistics use real APIs.
export const sampleUsers: Misskey.entities.UserLite[] = [
	{ id: 'sample-me', name: 'みなと', username: 'minato', host: null, avatarUrl: '', avatarBlurhash: null, avatarDecorations: [], emojis: {}, isLocked: false, isBot: false, isCat: false, onlineStatus: 'unknown' },
	{ id: 'sample-2', name: 'こはる', username: 'koharu', host: null, avatarUrl: '', avatarBlurhash: null, avatarDecorations: [], emojis: {}, isLocked: false, isBot: false, isCat: false, onlineStatus: 'unknown' },
	{ id: 'sample-3', name: 'なぎ', username: 'nagi', host: null, avatarUrl: '', avatarBlurhash: null, avatarDecorations: [], emojis: {}, isLocked: false, isBot: false, isCat: false, onlineStatus: 'unknown' },
	{ id: 'sample-4', name: 'あお', username: 'ao', host: null, avatarUrl: '', avatarBlurhash: null, avatarDecorations: [], emojis: {}, isLocked: false, isBot: false, isCat: false, onlineStatus: 'unknown' },
];

export function createWelcomeHatadyExamples(now = new Date()): HatadyHomePreview {
	const day = (offset: number) => { const date = new Date(now); date.setDate(date.getDate() - offset); date.setHours(10, 30, 0, 0); return date.toISOString(); };
	const sampleRows = [
		['study', '朝の読書', '気になっていた章を少しだけ。余白にメモを残した。', 1800, 0],
		['work', '日々のスケッチ', '色の組み合わせを試した。続きはまた明日。', 2400, 1],
		['exercise', '川沿いを散歩', 'ゆっくり歩いて、気分転換。', 1500, 2],
		['study', 'ことばのノート', '新しい表現を三つ覚えた。', 1200, 3],
		['work', '写真の整理', 'お気に入りを一冊にまとめている。', 2700, 4],
		['study', '朝の読書', '短い章をひとつ読み終えた。', 1800, 5],
		['exercise', 'ストレッチ', '肩が軽くなった。', 600, 6],
	].map(([kind, title, body, durationSeconds, offset], i) => ({ id: `activity-${i}`, type: kind as HatadyActivity['type'], occurredAt: day(Number(offset)), visibility: 'private' as const, isMine: true, user: sampleUsers[0], study: { id: `log-${i}`, kind, title, body, subject: '', tags: ['doneDay'], durationSeconds, bookId: kind === 'study' ? 'book-1' : null, details: {}, visibility: 'private' } }));
	sampleRows.push(...sampleUsers.slice(1).map((user, i) => ({ id: `public-${i}`, type: 'study' as HatadyActivity['type'], occurredAt: day(0), visibility: 'private' as const, isMine: false, user, study: { id: `public-log-${i}`, kind: 'study', title: '今日の読書', body: '少しずつ、自分のペースで。', subject: '', tags: ['interest'], durationSeconds: 1200, bookId: null, details: {}, visibility: 'public' } })));
	const books = [
		{ id: 'book-1', userId: 'sample-me', title: '日々を編む', author: '見本の著者', status: 'reading', coverColorIndex: null, isRecommended: false, details: { description: 'いつもの景色を、少し違う角度から。' } },
		{ id: 'book-2', userId: 'sample-2', title: '風の便り', author: '見本の著者', status: 'completed', coverColorIndex: null, isRecommended: true, details: { description: '遠くの暮らしをめぐる、短い物語。' } },
		{ id: 'book-3', userId: 'sample-me', title: '余白のつくり方', author: '見本の著者', status: 'reading', coverColorIndex: null, details: { description: '急がない毎日の、小さな工夫。' } },
	];
	const mediaWorks = [
		{ id: 'movie-1', userId: 'sample-me', kind: 'movie', title: '雨あがりの街', creator: '見本の監督', status: 'completed', synopsis: 'いつもの帰り道から始まる物語。', isRecommended: true },
		{ id: 'game-1', userId: 'sample-me', kind: 'game', title: '小さな旅の手帖', creator: '見本の作品', status: 'in_progress', synopsis: '気ままに巡って、思い出を集める。' },
	];

	return {
		now, viewerId: sampleUsers[0].id,
		rows: sampleRows.filter(row => row.isMine),
		communityRows: sampleRows.filter(row => !row.isMine).map(row => ({ ...row, visibility: 'public' })),
		works: [...books.map(book => homeWork(book, book.userId === sampleUsers[0].id, 'book')), ...mediaWorks.map(work => homeWork(work, true, work.kind as 'movie' | 'game'))],
	};
}
