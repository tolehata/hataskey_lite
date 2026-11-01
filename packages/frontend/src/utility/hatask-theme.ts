/* SPDX-License-Identifier: AGPL-3.0-only */
import type { CSSProperties } from 'vue';
import type { HatakyuAssetKey } from '@/utility/hatakyu-assets.js';
import { hatakyuAssetUrl } from '@/utility/hatakyu-assets.js';

/** Shared theme illustrations use the existing asset registry. */
const stickers = {
	welcome: 'waving',
	calendar: 'checkingTime',
	todo: 'reviewingDocuments',
	mood: 'heartHug',
	meal: 'chefCooking',
	garden: 'wateringFlower',
	support: 'heartHands',
	ranking: 'rankingView',
	hataskapps: 'treasureFound',
	apps: 'computerChat',
	favorites: 'stargazing',
	recommended: 'dogPawUp',
	feedback: 'chatting',
} as const satisfies Record<string, HatakyuAssetKey>;

export function getHataskHatakyuStyle(): CSSProperties {
	return Object.fromEntries(Object.entries(stickers).map(([name, key]) => [`--hatakyu-${name}`, `url("${hatakyuAssetUrl(key)}")`]));
}
