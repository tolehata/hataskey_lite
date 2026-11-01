/* SPDX-License-Identifier: AGPL-3.0-only */
import * as os from '@/os.js';
import { loadHatadyDisplay } from '@/utility/hatady-prefs.js';
import { hatadyNotice } from '@/utility/hatady-ui.js';
import { pushHk3Toast } from '@/components/hataskey3/hk3-state.js';
import { i18n } from '@/i18n.js';

export type HatadySurfaceVariant = 'hatady' | 'ui' | 'uis';
export type HatadyRecordKind = 'study' | 'movie' | 'game' | 'exercise' | 'work' | 'cooking';

export async function openHatadyRecord(options: {
	kind?: HatadyRecordKind;
	variant?: HatadySurfaceVariant;
	popup?: typeof os.popup;
	onDone?: (value: unknown) => void | Promise<void>;
} = {}): Promise<void> {
	await loadHatadyDisplay();
	const variant = options.variant ?? 'hatady';
	const { dispose } = (options.popup ?? os.popup)(
		(await import('@/components/HatadyActivityRecordChooser.vue')).default,
		{ initialKind: options.kind, variant },
		{
			done: (value: unknown) => {
				if (variant !== 'hatady') {
					hatadyNotice.value = null;
					const text = i18n.ts._hata._hatady._home.recordSaved;
					if (variant === 'uis') pushHk3Toast({ icon: 'check', text });
					else os.toast(text);
				}
				void options.onDone?.(value);
			},
			closed: () => dispose(),
		},
	);
}
