/*
 * SPDX-FileCopyrightText: tolehata
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export function escapeHtml(value: unknown): string {
	const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };
	return String(value ?? '').replace(/[&<>"']/g, c => entities[c]);
}

export function hataskGuideProse(value: unknown): string {
	return String(value ?? '')
		.replace(/。([」』）】]*)[ \t]*(?=[^\s」』）】])/gu, '。$1\n')
		.split(/\r\n|\r|\n/)
		.map(escapeHtml)
		.join('<br>');
}

export function brandName(name: string): string {
	return /^(Hata|HATA|ToDo)/.test(name) ? `<span class="hg-brand">${escapeHtml(name)}</span>` : escapeHtml(name);
}

const icons: Record<string, string> = {
	'book-open': 'book', newspaper: 'news', 'square-pen': 'pencil', smile: 'mood-smile', shapes: 'apps',
	'notebook-pen': 'notebook', 'sliders-horizontal': 'adjustments-horizontal', 'user-round-pen': 'user-edit',
	'help-circle': 'help', 'mouse-pointer-2': 'pointer', 'messages-square': 'messages',
	'message-square-text': 'message', 'pencil-line': 'pencil', 'contact-round': 'id',
	'square-check-big': 'checkbox', 'calendar-days': 'calendar', 'chart-no-axes-combined': 'chart-bar',
	'columns-3': 'layout-columns', 'panel-left': 'layout-sidebar',
	image: 'photo', 'panels-top-left': 'layout-dashboard',
};

export function iconClass(name: string): string {
	return `ti ti-${icons[name] ?? name}`;
}

export function icon(name: string): string {
	return `<i class="${escapeHtml(iconClass(name))}" aria-hidden="true"></i>`;
}
