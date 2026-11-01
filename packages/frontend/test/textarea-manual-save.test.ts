/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, assert, describe, test } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
import './init';
import MkTextarea from '@/components/MkTextarea.vue';
import { directives } from '@/directives/index.js';

describe('MkTextarea manual save', () => {
	afterEach(cleanup);

	test('reports editing complete when the saved value matches the original', async () => {
		const savingStates: boolean[] = [];
		const component = render(MkTextarea, {
			props: {
				modelValue: 'original',
				manualSave: true,
				onSavingStateChange: (changed: boolean) => savingStates.push(changed),
			},
			global: { directives },
		});
		const textarea = component.container.querySelector('textarea');
		assert.exists(textarea);
		await fireEvent.update(textarea, 'draft');
		await fireEvent.update(textarea, 'original');
		await fireEvent.click(component.getByText('Save'));
		assert.deepStrictEqual(savingStates, [true, true, false]);
	});
});
