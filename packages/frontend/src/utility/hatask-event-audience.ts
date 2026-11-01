/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */
export function isSharedHataskEvent(event: { visibility?: string }): boolean {
	return event.visibility === 'public' || event.visibility === 'specified';
}

export function hataskEventVisibilityLabel(visibility: string, copy: { public: string; private: string }, specified: string): string {
	return visibility === 'specified' ? specified : visibility === 'public' ? copy.public : copy.private;
}

export function hataskEventVisibilityIcon(visibility: string): string {
	return visibility === 'specified' ? 'ti ti-users' : visibility === 'public' ? 'ti ti-world' : 'ti ti-lock';
}
