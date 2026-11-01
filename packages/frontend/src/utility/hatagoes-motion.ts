/* SPDX-License-Identifier: AGPL-3.0-only */

export type HatagoesModalType = 'popup' | 'dialog' | 'drawer';
export type HatagoesMotionPreset = 'postform' | 'dissolve' | 'none' | undefined;
export type HatagoesModalTransition = '' | 'send' | 'modal' | 'modal-popup' | 'modal-drawer' | 'hatagoes';

/** A deliberate `none` still closes instantly; all other HataGoes presets use the short motion. */
export function hatagoesModalTransition(options: {
	legacyAnimation: boolean;
	forceMotion: boolean;
	preset: HatagoesMotionPreset;
	type: HatagoesModalType;
	send: boolean;
}): HatagoesModalTransition {
	if (options.preset === 'none') return '';
	if (options.forceMotion) return 'hatagoes';
	if (!options.legacyAnimation) return '';
	if (options.send) return 'send';
	return options.type === 'drawer' ? 'modal-drawer' : options.type === 'popup' ? 'modal-popup' : 'modal';
}

export function hatagoesWindowMotion(legacyAnimation: boolean, forceMotion: boolean): boolean {
	return forceMotion || legacyAnimation;
}
