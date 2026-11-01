/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test, vi } from 'vitest';
import { createBoard } from '../rules/board.js';
import type { SearchHooks, SearchResult } from './mcts.js';

const fixture = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('./mcts.js', () => ({ searchPosition: fixture.search }));

test('worker cancellation updates a running search flag and suppresses its late result', async () => {
	let hooks: SearchHooks | undefined;
	let complete: ((result: SearchResult) => void) | undefined;
	fixture.search.mockImplementation((_input: unknown, supplied: SearchHooks) => {
		hooks = supplied;
		return new Promise<SearchResult>(resolve => { complete = resolve; });
	});
	const send = vi.spyOn(self, 'postMessage').mockImplementation(() => {});
	await import('./worker.js');
	self.dispatchEvent(new MessageEvent('message', { data: { type: 'search', requestId: 81, input: { board: createBoard(9), toPlay: 'black', komi: 0, budget: { maxPlayouts: 2, maxMs: 100 } } } }));
	expect(hooks?.shouldStop?.()).toBe(false);
	self.dispatchEvent(new MessageEvent('message', { data: { type: 'cancel', requestId: 81 } }));
	expect(hooks?.shouldStop?.()).toBe(true);
	complete?.({ move: null, candidates: [], attempts: 0, playouts: 0, elapsedMs: 1, ownership: { black: [], white: [], neutral: [], samples: 0 }, estimatedMargin: null, stopped: 'cancelled' });
	await Promise.resolve();
	await Promise.resolve();
	expect(send).not.toHaveBeenCalled();
	send.mockRestore();
});
