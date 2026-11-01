/* SPDX-License-Identifier: AGPL-3.0-only */

import type { InjectionKey } from 'vue';
import type { PostFormProps } from '@/types/post-form.js';

/** A shell opts its main page into new-post routing; Deck has no implicit destination. */
export const concrntPagePostContextKey: InjectionKey<() => boolean> = Symbol('concrntPagePostContext');

export function interceptConcrntPostRequest(request: PostFormProps, focusComposer: (() => void | Promise<void>) | undefined): boolean {
	// Explicit inputs belong to their original composer, including null/false/empty values.
	if (Object.keys(request).length > 0 || !focusComposer) return false;
	void focusComposer();
	return true;
}
