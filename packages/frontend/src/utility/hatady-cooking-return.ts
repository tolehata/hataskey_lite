/* SPDX-License-Identifier: AGPL-3.0-only */

/** A completed cooking record can offer one return prompt at a time. */
export function createHatadyCookingReturnPrompt(
	confirm: (options: { type: 'question'; text: string; okText: string; cancelText: string }) => Promise<{ canceled: boolean }>,
	navigate: () => void,
): () => Promise<void> {
	let pending = false;
	return async () => {
		if (pending) return;
		pending = true;
		try {
			const { canceled } = await confirm({ type: 'question', text: 'Hatadyへ戻りますか', okText: 'Hatadyへ戻る', cancelText: 'Hataskに残る' });
			if (!canceled) navigate();
		} finally {
			pending = false;
		}
	};
}
