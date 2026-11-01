/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { i18n } from '@/i18n.js';

export interface HataFeedExportRange {
	numberFrom: number | null;
	numberTo: number | null;
	createdFrom: string;
	createdTo: string;
}

export function validateHataFeedExportRange(range: HataFeedExportRange): string | null {
	if ((range.numberFrom != null && range.numberFrom < 1) || (range.numberTo != null && range.numberTo < 1)) {
		return i18n.ts._hata._hatafeed._exportRange.numberAtLeastOne;
	}
	if (range.numberFrom != null && range.numberTo != null && range.numberFrom > range.numberTo) {
		return i18n.ts._hata._hatafeed._exportRange.numberOrder;
	}
	if (range.createdFrom && range.createdTo && range.createdFrom > range.createdTo) {
		return i18n.ts._hata._hatafeed._exportRange.dateOrder;
	}
	return null;
}

export function localDayStartIso(value: string): string | undefined {
	if (!value) return undefined;
	return new Date(`${value}T00:00:00.000`).toISOString();
}

export function localDayEndIso(value: string): string | undefined {
	if (!value) return undefined;
	return new Date(`${value}T23:59:59.999`).toISOString();
}

/**
 * JSON をブラウザへ安全に渡す。
 * ダウンロード開始直後の revoke はブラウザによって保存処理と競合するため、
 * Object URL は十分な猶予を置いて破棄する。
 */
export function downloadHataFeedJson(data: unknown, filename: string): void {
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const anchor = window.document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.style.display = 'none';
	window.document.body.appendChild(anchor);
	try {
		anchor.click();
	} finally {
		anchor.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
	}
}
