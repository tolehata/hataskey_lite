/* SPDX-License-Identifier: AGPL-3.0-only */
import { beforeEach, expect, test, vi } from 'vitest';

const api = vi.hoisted(() => vi.fn());
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: api }));
import { listHatadyReactionPage } from './hatady-reaction-details.js';

beforeEach(() => api.mockReset().mockResolvedValue([]));

test('pages study-log reactions through the authorized read endpoint', async () => {
	await listHatadyReactionPage({ logId: 'log-1' }, '👍', 'cursor-1');
	expect(api).toHaveBeenCalledExactlyOnceWith('hata/hatady/reactions/list', {
		logId: 'log-1', reaction: '👍', untilId: 'cursor-1', limit: 100,
	});
});

test('pages media-session reactions without a mutation endpoint', async () => {
	await listHatadyReactionPage({ sessionId: 'session-1' });
	expect(api).toHaveBeenCalledExactlyOnceWith('hata/hatady/media/reactions/list', {
		targetType: 'session', targetId: 'session-1', limit: 100,
	});
});
