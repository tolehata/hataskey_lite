/* SPDX-License-Identifier: AGPL-3.0-only */
/** Geometry is shared by selection and reorder; clipped rows never receive a release. */
export function containsPoint(rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>, x: number, y: number): boolean {
	return rect.right > rect.left && rect.bottom > rect.top && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function moveMobileChoice(ids: string[], id: string, destination: number): string[] {
	const from = ids.indexOf(id);
	if (from < 0) return ids;
	const result = [...ids];
	result.splice(from, 1);
	result.splice(Math.max(0, Math.min(destination, ids.length - 1)), 0, id);
	return result;
}

export function mobileArrowOffset(key: string, columns: number): number | null {
	return ({ ArrowUp: -columns, ArrowDown: columns, ArrowLeft: -1, ArrowRight: 1 } as Record<string, number>)[key] ?? null;
}

export function mobileEdgeScroll(rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'height'>, x: number, y: number, elapsed: number): number {
	if (!containsPoint(rect, x, y)) return 0;
	const edge = Math.min(28, rect.height / 4);
	if (edge <= 0) return 0;
	const speed = y < rect.top + edge ? -(1 - (y - rect.top) / edge) : y > rect.bottom - edge ? 1 - (rect.bottom - y) / edge : 0;
	return speed * Math.min(32, elapsed) * 0.32;
}
