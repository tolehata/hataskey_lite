/*
 * SPDX-FileCopyrightText: Tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { load } from 'js-yaml';
import { I18n } from '@@/js/i18n.js';
import type { Locale } from '../../../../locales/index.js';

/** Test helper: exercise formatters against the checked-in catalogs. */
export function createTestHataskI18n(language = 'ja-JP'): I18n<Locale> {
	// Vite externalizes node: imports in browser-mode tests. Node 26 exposes the
	// same built-ins without a static import, so this helper also works there.
	const readFileSync = process.getBuiltinModule('fs')!.readFileSync;
	const resolve = process.getBuiltinModule('path')!.resolve;
	const path = resolve(process.cwd(), '../../locales', `${language}.yml`);
	return new I18n(load(readFileSync(path, 'utf8')) as Locale);
}
