/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { FlashToken } from '@/misc/flash-token.js';
import { ApiError } from '../../../error.js';

const HATASK_NATIVE_SCOPE = 'client/hatask';

const nativeOnlyError = {
	message: 'Hatask native registry data is only available to the signed-in client.',
	code: 'HATASK_REGISTRY_NATIVE_ONLY',
	id: '1a052037-ff14-4e45-b59d-0f76da0fd766',
} as const;

/**
 * Flash tokens have no AccessToken row, so the generic registry endpoints would
 * otherwise resolve their domain to null and inherit the first-party client data.
 */
export function assertHataskNativeRegistryAccess(scope: string[], flashToken: FlashToken | null): void {
	if (flashToken != null && scope.join('/') === HATASK_NATIVE_SCOPE) {
		throw new ApiError(nativeOnlyError);
	}
}
