/* SPDX-License-Identifier: AGPL-3.0-only */
import { misskeyApi } from '@/utility/misskey-api.js';
import type * as Misskey from 'cherrypick-js';

export const HATASK_RECORD_MAX_BYTES = 8 * 1024 * 1024;
export type HataskRecordsFile = Misskey.Endpoints['hatask/records/export']['res'];
export type HataskRecordsImportResult = Misskey.Endpoints['hatask/records/import']['res'];
type Sync = { beforeImport: () => Promise<void>; markUnsafe: () => void; afterImport: () => Promise<void>; finish: () => void };
const listeners = new Set<Sync>();
let activeToken: symbol | null = null;
export function acquireHataskRecordOperation(): symbol | null {
	if (activeToken != null) return null;
	activeToken = Symbol('hatask-record-operation');
	return activeToken;
}

function assertOwner(token: symbol): void { if (activeToken !== token) throw new Error('Another record operation is active'); }

export function registerHataskRecordSync(value: Sync): () => void { listeners.add(value); return () => { listeners.delete(value); }; }
export async function waitForHataskRecordWrites(token: symbol): Promise<void> {
	assertOwner(token);
	const results = await Promise.allSettled([...listeners].map(listener => listener.beforeImport()));
	const failure = results.find(result => result.status === 'rejected');
	if (failure?.status === 'rejected') throw failure.reason;
}
export function markHataskRecordViewsUnsafe(token: symbol): void { assertOwner(token); for (const listener of listeners) listener.markUnsafe(); }
export async function refreshHataskRecordViews(token: symbol): Promise<void> {
	assertOwner(token);
	const results = await Promise.allSettled([...listeners].map(listener => listener.afterImport()));
	const failure = results.find(result => result.status === 'rejected');
	if (failure?.status === 'rejected') throw failure.reason;
}
export function finishHataskRecordImport(token: symbol): void {
	assertOwner(token);
	activeToken = null;
	for (const listener of listeners) listener.finish();
}

export async function exportHataskRecords(): Promise<HataskRecordsFile> { return await misskeyApi('hatask/records/export', {}); }
export async function importHataskRecords(file: HataskRecordsFile): Promise<HataskRecordsImportResult> {
	const controller = new AbortController();
	const timeout = window.setTimeout(() => controller.abort(), 90000);
	try { return await misskeyApi('hatask/records/import', file, undefined, controller.signal); } finally { window.clearTimeout(timeout); }
}

export function parseHataskRecordsFile(text: string): HataskRecordsFile {
	if (new TextEncoder().encode(text).byteLength > HATASK_RECORD_MAX_BYTES) throw new TypeError('File too large');
	const value: unknown = JSON.parse(text);
	if (value == null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid record export');
	const file = value as Partial<HataskRecordsFile>;
	if (file.format !== 'hatask-records-export' || file.version !== 1 || typeof file.exportedAt !== 'string' ||
		file.data == null || !Array.isArray(file.data.moods) || !Array.isArray(file.data.meals) || !Array.isArray(file.data.flowers)) throw new TypeError('Invalid record export');
	return file as HataskRecordsFile;
}

export function downloadHataskRecords(file: HataskRecordsFile): void {
	const blob = new Blob([JSON.stringify(file)], { type: 'application/json;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = window.document.createElement('a');
	link.href = url;
	link.download = `hatask-records-${file.exportedAt.slice(0, 10)}.json`;
	window.document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
