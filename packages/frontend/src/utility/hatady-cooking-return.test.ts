/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { createHatadyCookingReturnPrompt } from './hatady-cooking-return.js';

describe('Hatady cooking return prompt', () => {
	test('accepting after a successful record navigates to Hatady once', async () => {
		let resolve!: (value: { canceled: boolean }) => void;
		const confirm = vi.fn(() => new Promise<{ canceled: boolean }>(done => { resolve = done; }));
		const navigate = vi.fn();
		const offer = createHatadyCookingReturnPrompt(confirm, navigate);
		const pending = offer();
		await offer();
		expect(confirm).toHaveBeenCalledExactlyOnceWith({ type: 'question', text: 'Hatadyへ戻りますか', okText: 'Hatadyへ戻る', cancelText: 'Hataskに残る' });
		resolve({ canceled: false });
		await pending;
		expect(navigate).toHaveBeenCalledOnce();
	});

	test('declining leaves the user in Hatask', async () => {
		const confirm = vi.fn().mockResolvedValue({ canceled: true });
		const navigate = vi.fn();
		await createHatadyCookingReturnPrompt(confirm, navigate)();
		expect(confirm).toHaveBeenCalledWith({ type: 'question', text: 'Hatadyへ戻りますか', okText: 'Hatadyへ戻る', cancelText: 'Hataskに残る' });
		expect(navigate).not.toHaveBeenCalled();
	});
});
