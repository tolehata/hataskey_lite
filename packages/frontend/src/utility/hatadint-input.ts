/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type HsvColor = { h: number; s: number; v: number };
export type CanvasView = {
	clipped: boolean;
	miniHeight: number;
	/** Visible canvas intersection in miniature pixels, excluding the case padding. */
	rect: { left: number; top: number; width: number; height: number } | null;
};

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/** Zero is valid pen pressure. The brush applies its own minimum visible width. */
export function penPressure(event: Pick<PointerEvent, 'pointerType' | 'pressure'>, enabled = true): number {
	return enabled && event.pointerType === 'pen' && Number.isFinite(event.pressure) && event.pressure >= 0 && event.pressure <= 1 ? event.pressure : 1;
}

/** Keep sample order and avoid drawing the parent event a second time. */
export function pointerSamples(event: PointerEvent): PointerEvent[] {
	try {
		const samples = event.getCoalescedEvents?.().filter(sample => sample.pointerId === event.pointerId && Number.isFinite(sample.clientX) && Number.isFinite(sample.clientY));
		if (samples?.length) return samples;
	} catch {
		// Some browser/device combinations expose only the parent pointer event.
	}
	return [event];
}

/** Canvas center is viewport center + pan; zoom is the absolute displayed scale. */
export function getCanvasView(width: number, height: number, zoom: number, panX: number, panY: number, viewportWidth: number, viewportHeight: number, miniWidth = 160): CanvasView {
	if (![width, height, zoom, panX, panY, viewportWidth, viewportHeight, miniWidth].every(Number.isFinite) || [width, height, zoom, viewportWidth, viewportHeight, miniWidth].some(value => value <= 0)) {
		return { clipped: false, miniHeight: 0, rect: null };
	}
	const displayWidth = width * zoom;
	const displayHeight = height * zoom;
	const miniHeight = miniWidth * height / width;
	const left = (viewportWidth - displayWidth) / 2 + panX;
	const top = (viewportHeight - displayHeight) / 2 + panY;
	const epsilon = 1e-7;
	const clipped = left < -epsilon || top < -epsilon || left + displayWidth > viewportWidth + epsilon || top + displayHeight > viewportHeight + epsilon;
	const x1 = clamp(-left / zoom, 0, width);
	const y1 = clamp(-top / zoom, 0, height);
	const x2 = clamp((viewportWidth - left) / zoom, 0, width);
	const y2 = clamp((viewportHeight - top) / zoom, 0, height);
	const rect = x2 <= x1 || y2 <= y1 ? null : {
		left: x1 / width * miniWidth,
		top: y1 / height * miniHeight,
		width: (x2 - x1) / width * miniWidth,
		height: (y2 - y1) / height * miniHeight,
	};
	return { clipped, miniHeight, rect };
}

/** Dragging the miniature viewport right pans the artwork left, with no initial jump. */
export function minimapPanFromDrag(startPanX: number, startPanY: number, deltaX: number, deltaY: number, width: number, height: number, zoom: number, miniWidth: number): { x: number; y: number } {
	if (![startPanX, startPanY, deltaX, deltaY, width, height, zoom, miniWidth].every(Number.isFinite) || [width, height, zoom, miniWidth].some(value => value <= 0)) {
		return { x: startPanX, y: startPanY };
	}
	const miniHeight = miniWidth * height / width;
	return {
		x: startPanX - deltaX * width / miniWidth * zoom,
		y: startPanY - deltaY * height / miniHeight * zoom,
	};
}

/** Hue is in degrees; saturation and value are percentages. */
export function hexToHsv(hex: string, previous?: Pick<HsvColor, 'h' | 's'>): HsvColor | null {
	if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b), difference = max - min;
	let h = previous && Number.isFinite(previous.h) ? clamp(previous.h, 0, 360) : 0;
	if (difference > 0) {
		h = ((max === r ? (g - b) / difference : max === g ? (b - r) / difference + 2 : (r - g) / difference + 4) * 60 + 360) % 360;
	}
	// Gray has no hue. Black also has no saturation; retain these controls so
	// raising brightness can restore the color selected before reaching black.
	const s = max > 0 ? difference / max * 100 : previous && Number.isFinite(previous.s) ? clamp(previous.s, 0, 100) : 0;
	return { h, s, v: max * 100 };
}

export function hsvToHex(h: number, s: number, v: number): string {
	const hue = Number.isFinite(h) ? clamp(h, 0, 360) : 0;
	const saturation = Number.isFinite(s) ? clamp(s, 0, 100) / 100 : 0;
	const value = Number.isFinite(v) ? clamp(v, 0, 100) / 100 : 0;
	const chroma = value * saturation, sector = (hue % 360) / 60, x = chroma * (1 - Math.abs(sector % 2 - 1));
	const rgb = sector < 1 ? [chroma, x, 0] : sector < 2 ? [x, chroma, 0] : sector < 3 ? [0, chroma, x] : sector < 4 ? [0, x, chroma] : sector < 5 ? [x, 0, chroma] : [chroma, 0, x];
	// Stabilize half-step rounding against floating point cancellation.
	return `#${rgb.map(channel => Math.round((channel + value - chroma) * 255 + 1e-10).toString(16).padStart(2, '0')).join('')}`;
}
