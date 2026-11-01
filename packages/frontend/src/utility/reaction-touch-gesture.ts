/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const REACTION_DETAILS_HOLD_MS = 450;
export const REACTION_MENU_HOLD_MS = 3000;
const REACTION_TOUCH_MOVE_TOLERANCE_PX = 12;
const SYNTHETIC_CONTEXT_MENU_GUARD_MS = 800;

export type ReactionTouchPoint = {
	x: number;
	y: number;
};

type ReactionTouchGestureCallbacks = {
	showDetails: () => void;
	hideDetails: () => void;
	showMenu: () => void;
};

/**
 * リアクションチップのタッチ操作を、通常タップ・長押しの詳細・継続長押しの
 * 操作メニューへ分離する。iOSが合成するclick/contextmenuも同じジェスチャーで
 * 二重実行しないよう、このクラスだけでタイマーと抑止状態を管理する。
 */
export class ReactionTouchGesture {
	private active = false;
	private startPoint: ReactionTouchPoint | null = null;
	private detailsTimer: number | undefined;
	private menuTimer: number | undefined;
	private suppressClickTimer: number | undefined;
	private suppressNextClick = false;
	private contextMenuGuardUntil = 0;
	private detailsVisible = false;

	constructor(private readonly callbacks: ReactionTouchGestureCallbacks) {}

	public start(point: ReactionTouchPoint): void {
		this.clearHoldTimers();
		window.clearTimeout(this.suppressClickTimer);
		this.hideDetails();
		this.active = true;
		this.startPoint = point;
		this.suppressNextClick = false;
		this.contextMenuGuardUntil = Number.POSITIVE_INFINITY;

		this.detailsTimer = window.setTimeout(() => {
			if (!this.active) return;
			this.suppressNextClick = true;
			this.detailsVisible = true;
			this.callbacks.showDetails();
		}, REACTION_DETAILS_HOLD_MS);

		this.menuTimer = window.setTimeout(() => {
			if (!this.active) return;
			this.suppressNextClick = true;
			this.callbacks.showMenu();
		}, REACTION_MENU_HOLD_MS);
	}

	public move(point: ReactionTouchPoint): void {
		if (!this.active || this.startPoint == null) return;
		const distance = Math.hypot(point.x - this.startPoint.x, point.y - this.startPoint.y);
		if (distance > REACTION_TOUCH_MOVE_TOLERANCE_PX) this.finish();
	}

	public end(): void {
		this.finish();
	}

	public cancel(): void {
		this.finish();
	}

	public consumeSyntheticClick(): boolean {
		if (!this.suppressNextClick) return false;
		this.suppressNextClick = false;
		window.clearTimeout(this.suppressClickTimer);
		return true;
	}

	public shouldBlockContextMenu(): boolean {
		return this.active || Date.now() < this.contextMenuGuardUntil;
	}

	public dispose(): void {
		this.active = false;
		this.startPoint = null;
		this.clearHoldTimers();
		window.clearTimeout(this.suppressClickTimer);
		this.hideDetails();
	}

	private finish(): void {
		if (!this.active) return;
		this.active = false;
		this.startPoint = null;
		this.contextMenuGuardUntil = Date.now() + SYNTHETIC_CONTEXT_MENU_GUARD_MS;
		this.clearHoldTimers();
		this.hideDetails();
		if (this.suppressNextClick) {
			window.clearTimeout(this.suppressClickTimer);
			this.suppressClickTimer = window.setTimeout(() => {
				this.suppressNextClick = false;
			}, SYNTHETIC_CONTEXT_MENU_GUARD_MS);
		}
	}

	private clearHoldTimers(): void {
		window.clearTimeout(this.detailsTimer);
		window.clearTimeout(this.menuTimer);
	}

	private hideDetails(): void {
		if (!this.detailsVisible) return;
		this.detailsVisible = false;
		this.callbacks.hideDetails();
	}
}
