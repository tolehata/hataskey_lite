/* SPDX-License-Identifier: AGPL-3.0-only */
import { i18n } from '@/i18n.js';
export type HatadyFormValues = Record<string, any>;
export type HatadyFormOption = { value: string; label: string; icon?: string };
export type HatadyFormField = {
	key: string;
	label: string;
	type?: 'text' | 'number' | 'date' | 'datetime-local' | 'time' | 'url' | 'textarea' | 'select' | 'choice' | 'checkbox' | 'tags' | 'list' | 'duration' | 'visibility' | 'color' | 'weaponStats' | 'bookmarks' | 'memos' | 'images';
	required?: boolean;
	disabled?: boolean;
	min?: number;
	max?: number;
	step?: number | string;
	maxlength?: number;
	maxItems?: number;
	placeholder?: string;
	options?: HatadyFormOption[];
	presets?: number[];
	suggestions?: string[];
	ordered?: boolean;
	when?: (values: HatadyFormValues) => boolean;
	action?: { label: string; run: () => void };
};
export type HatadyFormPage = { id: string; title: string; fields: HatadyFormField[]; group?: string; icon?: string; summary?: boolean; choices?: boolean; description?: string; when?: (values: HatadyFormValues) => boolean };

/** Known local partial-save errors are safe to display; API errors use the generic fallback. */
export class HatadyFormPartialError extends Error {}

export function formField(key: string, label: string, options: Omit<HatadyFormField, 'key' | 'label'> = {}): HatadyFormField {
	return { key, label, ...options };
}

export function meaningfulField(value: unknown): boolean {
	return value != null && value !== '' && value !== false && (!Array.isArray(value) || value.length > 0);
}

/** An unrelated edit must retain even Drive IDs whose files have since been deleted. */
export function recordAttachmentPatch(files: readonly { id: string }[], source?: { files?: readonly { id: string }[] } | null): { fileIds?: string[] } {
	const fileIds = files.map(file => file.id);
	const previous = source?.files ?? [];
	if (source && previous.length === fileIds.length && previous.every((file, index) => file.id === fileIds[index])) return {};
	return { fileIds };
}

export function initialFormGroups(pages: readonly HatadyFormPage[], values: HatadyFormValues): string[] {
	return [...new Set(pages.filter(page => page.group && page.fields.some(field => meaningfulField(values[field.key]))).map(page => page.group!))];
}

export function localDateTime(value?: string | null): string {
	const date = value ? new Date(value) : new Date();
	if (!Number.isFinite(date.getTime())) return localDateTime();
	const two = (number: number) => String(number).padStart(2, '0');
	return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

/** Keep the original timestamp, including its seconds, when only other fields are edited. */
export function formTimestamp(date: string, original?: string | null): string {
	if (original && localDateTime(original).slice(0, 10) === date) return original;
	return new Date(`${date}T${original ? localDateTime(original).slice(11) : '12:00:00'}`).toISOString();
}

export function formValidation(field: HatadyFormField, values: HatadyFormValues): string | null {
	if (field.when && !field.when(values)) return null;
	const value = values[field.key];
	if (field.required && (value == null || String(value).trim() === '' || field.type === 'duration' && Number(value) <= 0)) return i18n.tsx._hata._hatady._formValidation.enterField({ field: field.label });
	if (value == null || value === '') return null;
	if (field.type === 'images') {
		if (!Array.isArray(value) || value.some(file => typeof file?.id !== 'string' || typeof file.type !== 'string' || !file.type.startsWith('image/'))) return i18n.ts._hata._hatady._formValidation.checkImages;
		if (value.length > (field.maxItems ?? 16)) return i18n.tsx._hata._hatady._formValidation.maxImages({ count: field.maxItems ?? 16 });
	}
	if (field.type === 'duration' || field.type === 'number') {
		const number = Number(value);
		if (!Number.isFinite(number) || (field.step !== 'any' && Number(field.step ?? 1) >= 1 && !Number.isInteger(number))) return i18n.tsx._hata._hatady._formValidation.invalidField({ field: field.label });
		if (field.min != null && number < field.min) return i18n.tsx._hata._hatady._formValidation.minimum({ field: field.label, count: field.min });
		if (field.max != null && number > field.max) return i18n.tsx._hata._hatady._formValidation.maximum({ field: field.label, count: field.max });
	}
	if (field.maxlength && typeof value === 'string' && value.length > field.maxlength) return i18n.tsx._hata._hatady._formValidation.maxCharacters({ field: field.label, count: field.maxlength });
	if (field.type === 'list' && Array.isArray(value)) {
		if (field.maxItems != null && value.length > field.maxItems) return i18n.tsx._hata._hatady._formValidation.maxItems({ field: field.label, count: field.maxItems });
		if (field.maxlength != null && value.some(item => String(item).length > field.maxlength!)) return i18n.tsx._hata._hatady._formValidation.maxItemCharacters({ field: field.label, count: field.maxlength });
	}
	if (field.type === 'url') {
		try { if (!['https:', 'http:'].includes(new URL(value).protocol)) return i18n.ts._hata._hatady._formValidation.urlProtocol; } catch { return i18n.ts._hata._hatady._formValidation.checkUrl; }
	}
	if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return i18n.tsx._hata._hatady._formValidation.checkField({ field: field.label });
	if (field.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.test(String(value))) return i18n.tsx._hata._hatady._formValidation.checkField({ field: field.label });
	return null;
}

// API parameters whose form field has a different key.
const SERVER_PARAM_FIELDS: Record<string, string> = { studiedAt: 'date', occurredAt: 'date', fileIds: 'files' };

/** Name the form field behind an API validation error so the user is not left with a bare save failure. */
export function formServerError(reason: unknown, pages: readonly HatadyFormPage[], values: HatadyFormValues): { page: HatadyFormPage; field: HatadyFormField; message: string } | null {
	const error = reason as { code?: string; info?: { param?: string; reason?: string } } | null;
	if (error?.code !== 'INVALID_PARAM') return null;
	const missing = /required property '([^']+)'/.exec(error.info?.reason ?? '')?.[1];
	const param = missing ?? /^#\/properties\/([^/]+)/.exec(error.info?.param ?? '')?.[1] ?? error.info?.param;
	if (!param) return null;
	const key = SERVER_PARAM_FIELDS[param] ?? param;
	for (const page of pages) {
		if (page.when && !page.when(values)) continue;
		const field = page.fields.find(item => item.key === key && (!item.when || item.when(values)));
		if (field) return { page, field, message: missing ? i18n.tsx._hata._hatady._formValidation.enterField({ field: field.label }) : formValidation(field, values) ?? i18n.tsx._hata._hatady._formValidation.checkField({ field: field.label }) };
	}
	return null;
}

export function restoreLegacyTime(draft: HatadyFormValues): HatadyFormValues {
	const restored = { ...draft };
	if (!Object.hasOwn(restored, 'durationSeconds') && typeof restored.durationMinutes === 'number') restored.durationSeconds = restored.durationMinutes * 60;
	const oldDate = restored.studiedAtLocal ?? restored.occurredAtLocal;
	if (typeof oldDate === 'string') {
		restored.date ??= oldDate.slice(0, 10);
		restored.startedAt ??= oldDate.slice(11);
	}
	if (!Array.isArray(restored.tags)) restored.tags = restored.tag ? [restored.tag] : [];
	return restored;
}

export function optionalPages(group: string, title: string, fields: HatadyFormField[], icon = 'ti ti-notes'): HatadyFormPage[] {
	const count = Math.ceil(fields.length / 3);
	return Array.from({ length: count }, (_, index) => ({ id: `${group}-${index}`, group, title: count > 1 ? `${title}（${index + 1}/${count}）` : title, icon, fields: fields.slice(index * 3, index * 3 + 3) }));
}

/** Commit pending chip text before validation even if its page is currently hidden. */
export function commitFormLists(pages: readonly HatadyFormPage[], values: HatadyFormValues): void {
	for (const field of pages.flatMap(page => page.fields)) {
		if (field.type !== 'list') continue;
		const pending = String(values.__listDrafts?.[field.key] ?? '').trim();
		if (!pending) continue;
		if (!Array.isArray(values[field.key])) values[field.key] = [];
		if (!values[field.key].includes(pending)) values[field.key].push(pending);
		values.__listDrafts[field.key] = '';
	}
}

/** Successful independent rows are acknowledged immediately, so a retry cannot duplicate them. */
export async function saveBookNotes(values: HatadyFormValues, bookId: string, api: (endpoint: string, payload: Record<string, unknown>) => Promise<any>): Promise<void> {
	for (const key of ['bookmarks', 'memos'] as const) {
		const baseline: HatadyFormValues[] = values[`_${key}Baseline`] ??= [];
		const rows: HatadyFormValues[] = values[key] ?? [];
		for (const old of [...baseline]) {
			if (!old.id || rows.some(row => row.id === old.id)) continue;
			await api(`hata/hatady/${key}/delete`, { [key === 'bookmarks' ? 'bookmarkId' : 'memoId']: old.id });
			baseline.splice(baseline.findIndex(row => row.id === old.id), 1);
		}
		for (const row of rows) {
			const old = baseline.find(item => item.id === row.id);
			const payload: Record<string, any> = key === 'bookmarks' ? { page: Number(row.page) || 0, name: String(row.name ?? '').trim() || null, color: row.color || null, memo: String(row.memo ?? '').trim() || null } : { page: row.page === '' || row.page == null ? null : Number(row.page), text: String(row.text ?? '').trim() };
			if (old && Object.entries(payload).every(([field, value]) => (old[field] ?? null) === value)) continue;
			if (key === 'memos' && !payload.text) throw new HatadyFormPartialError(i18n.ts._hata._hatady._formValidation.emptyMemo);
			if (row.id) {
				const saved = await api(`hata/hatady/${key}/update`, { [key === 'bookmarks' ? 'bookmarkId' : 'memoId']: row.id, ...payload });
				Object.assign(row, saved);
			} else {
				const saved = await api(`hata/hatady/${key}/create`, { bookId, ...payload });
				Object.assign(row, saved);
				baseline.push({ ...saved });
			}
			const index = baseline.findIndex(item => item.id === row.id);
			if (index >= 0) baseline[index] = { ...row }; else baseline.push({ ...row });
		}
	}
}
