/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export interface MenuChildPositionInput {
	root: { left: number; right: number };
	anchor: { top: number };
	menu: { width: number; height: number };
	viewport: { left: number; top: number; width: number; height: number };
}

export interface MenuChildPosition {
	left: number;
	top: number;
	maxWidth: number;
	maxHeight: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(Math.max(value, minimum), maximum);
}

/** Viewport coordinates only; callers convert them to their CSS positioning origin. */
export function getMenuChildPosition({ root, anchor, menu, viewport }: MenuChildPositionInput): MenuChildPosition {
	const viewportWidth = Math.max(0, viewport.width);
	const viewportHeight = Math.max(0, viewport.height);
	const horizontalMargin = Math.min(16, viewportWidth / 2);
	const verticalMargin = Math.min(16, viewportHeight / 2);
	const maxWidth = viewportWidth - horizontalMargin * 2;
	const maxHeight = viewportHeight - verticalMargin * 2;
	const width = clamp(menu.width, 0, maxWidth);
	const height = clamp(menu.height, 0, maxHeight);
	const minimumLeft = viewport.left + horizontalMargin;
	const maximumLeft = viewport.left + viewportWidth - horizontalMargin - width;
	const leftCandidate = root.left - width;
	let left: number;
	if (root.right >= minimumLeft && root.right <= maximumLeft) {
		left = root.right;
	} else if (leftCandidate >= minimumLeft && leftCandidate <= maximumLeft) {
		left = leftCandidate;
	} else {
		// On a narrow screen neither adjacent side fits. Overlay the parent
		// instead of flipping the child off the opposite edge of the viewport.
		left = clamp(root.left, minimumLeft, maximumLeft);
	}
	const top = clamp(anchor.top - 8, viewport.top + verticalMargin, viewport.top + viewportHeight - verticalMargin - height);
	return { left, top, maxWidth, maxHeight };
}
