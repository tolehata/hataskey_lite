/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export interface HataskEventDetailsPositionInput {
	anchor: { left: number; right: number; top: number; bottom: number };
	viewport: { left: number; top: number; width: number; height: number };
	width: number;
	height: number;
	minHeight?: number;
}

export interface HataskEventDetailsPosition {
	left: number;
	top: number;
	width: number;
	maxHeight: number;
	placement: 'above' | 'below' | 'center';
	/** Arrow center relative to the card's left edge; null for an unanchored card. */
	arrowLeft: number | null;
}

const GUTTER = 12;
const ANCHOR_GAP = 12;
const ARROW_INSET = 24;

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(Math.max(value, minimum), maximum);
}

function coordinate(value: number): number {
	return Number.isFinite(value) ? clamp(value, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) : 0;
}

function dimension(value: number, fallback = 0): number {
	return Number.isFinite(value) && value >= 0 ? Math.min(value, Number.MAX_SAFE_INTEGER) : fallback;
}

/** Pure viewport coordinates. The caller handles CSS origins and scrolls the constrained body. */
export function getHataskEventDetailsPosition({ anchor, viewport, width, height, minHeight = 180 }: HataskEventDetailsPositionInput): HataskEventDetailsPosition {
	const viewportLeft = coordinate(viewport.left);
	const viewportTop = coordinate(viewport.top);
	const viewportWidth = dimension(viewport.width);
	const viewportHeight = dimension(viewport.height);
	const horizontalGutter = Math.min(GUTTER, viewportWidth / 2);
	const verticalGutter = Math.min(GUTTER, viewportHeight / 2);
	const availableWidth = viewportWidth - horizontalGutter * 2;
	const availableHeight = viewportHeight - verticalGutter * 2;
	const minimumLeft = viewportLeft + horizontalGutter;
	const minimumTop = viewportTop + verticalGutter;
	const maximumRight = minimumLeft + availableWidth;
	const maximumBottom = minimumTop + availableHeight;
	const cardWidth = Math.min(dimension(width, 460), availableWidth);
	const minimumHeight = dimension(minHeight, 180);
	const naturalHeight = dimension(height, minimumHeight);
	const centered: HataskEventDetailsPosition = {
		left: minimumLeft + (availableWidth - cardWidth) / 2,
		top: minimumTop + (availableHeight - Math.min(naturalHeight, availableHeight)) / 2,
		width: cardWidth,
		maxHeight: availableHeight,
		placement: 'center',
		arrowLeft: null,
	};
	const anchorVisible = [anchor.left, anchor.right, anchor.top, anchor.bottom].every(Number.isFinite) &&
		anchor.left < anchor.right && anchor.top < anchor.bottom &&
		anchor.right > viewportLeft && anchor.left < viewportLeft + viewportWidth &&
		anchor.bottom > viewportTop && anchor.top < viewportTop + viewportHeight;
	if (!anchorVisible || availableWidth === 0 || availableHeight === 0) return centered;
	const above = clamp(anchor.top - ANCHOR_GAP - minimumTop, 0, availableHeight);
	const below = clamp(maximumBottom - anchor.bottom - ANCHOR_GAP, 0, availableHeight);
	if (above < minimumHeight && below < minimumHeight) return centered;
	let placement: 'above' | 'below';
	if (naturalHeight <= below) placement = 'below';
	else if (naturalHeight <= above) placement = 'above';
	else placement = below >= above ? 'below' : 'above';
	const maxHeight = placement === 'below' ? below : above;
	const cardHeight = Math.min(naturalHeight, maxHeight);
	// Use the visible portion of a partially clipped date, not an offscreen midpoint.
	const anchorCenter = Math.max(anchor.left, viewportLeft) / 2 + Math.min(anchor.right, viewportLeft + viewportWidth) / 2;
	const left = clamp(anchorCenter - cardWidth / 2, minimumLeft, maximumRight - cardWidth);
	const arrowInset = Math.min(ARROW_INSET, cardWidth / 2);
	const top = placement === 'below' ? anchor.bottom + ANCHOR_GAP : anchor.top - ANCHOR_GAP - cardHeight;
	return {
		left,
		top: clamp(top, minimumTop, maximumBottom - cardHeight),
		width: cardWidth,
		maxHeight,
		placement,
		arrowLeft: clamp(anchorCenter - left, arrowInset, cardWidth - arrowInset),
	};
}
