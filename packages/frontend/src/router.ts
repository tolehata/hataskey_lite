/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { inject } from 'vue';
import { page } from '@/router.definition.js';
import { $i } from '@/i.js';
import { Nirax } from '@/lib/nirax.js';
import { ROUTE_DEF } from '@/router.definition.js';
import { analytics } from '@/analytics.js';
import { DI } from '@/di.js';
import { hatagoesUrlForStandaloneHatask, isHatagoesPath, rememberHatagoesOrigin } from '@/utility/hatagoes-navigation.js';
import { hatagoesUsageScreenForPath, hatagoesUsageScreensForViewer, recordHatagoesScreenUsage } from '@/utility/hatagoes-launcher-usage.js';

export type Router = Nirax<typeof ROUTE_DEF>;

export function createRouter(fullPath: string): Router {
	const router = new Nirax(ROUTE_DEF, fullPath, !!$i, page(() => import('@/pages/not-found.vue')));
	// Browser back/forward uses replace. Returning from a linked profile must
	// retain the page where this HataGoes session originally started.
	router.addListener('push', ({ beforeFullPath, fullPath: nextPath }) => rememberHatagoesOrigin(router, beforeFullPath, nextPath));
	return router;
}

// 旗鯖fork: 単独の Hatask 画面は廃止した。メインの画面で /hatask を開いたら HataGoes の中の Hatask へ置き換える。
//   HataGoes のペインは createRouter で別のルーターを作って /hatask を描くので、ここで置き換えるのはメインのルーターだけ。
//   navHook はほかの画面が差し替えるため使わず、pushByPath / replaceByPath そのものを包む。
const withoutStandaloneHatask = (fullPath: string): string => hatagoesUrlForStandaloneHatask(fullPath) ?? fullPath;
const initialFullPath = window.location.pathname + window.location.search + window.location.hash;
export const mainRouter = createRouter(withoutStandaloneHatask(initialFullPath));
if (mainRouter.getCurrentFullPath() !== initialFullPath) window.history.replaceState({ }, '', mainRouter.getCurrentFullPath());
const pushMainByPath = mainRouter.pushByPath.bind(mainRouter);
const replaceMainByPath = mainRouter.replaceByPath.bind(mainRouter);
mainRouter.pushByPath = (fullPath, flag) => pushMainByPath(withoutStandaloneHatask(fullPath), flag);
mainRouter.replaceByPath = fullPath => replaceMainByPath(withoutStandaloneHatask(fullPath));

window.addEventListener('popstate', (event) => {
	mainRouter.replaceByPath(window.location.pathname + window.location.search + window.location.hash);
});

mainRouter.addListener('push', ctx => {
	window.history.pushState({ }, '', ctx.fullPath);
});

mainRouter.addListener('replace', ctx => {
	window.history.replaceState({ }, '', ctx.fullPath);
});

mainRouter.addListener('change', ctx => {
	if (_DEV_) console.log('mainRouter: change', ctx.fullPath);
	const routePath = ctx.fullPath.split(/[?#]/u, 1)[0];
	// These apps restore their actual internal tab after routing; their own tab
	// watchers account for it. Count only independent tool routes here.
	if ($i && !isHatagoesPath(ctx.fullPath) && !['/hatask', '/hatady', '/hatafeed', '/hatafeed/beta'].includes(routePath)) {
		const allowedScreens = hatagoesUsageScreensForViewer({ isAdmin: $i.isAdmin, isModerator: $i.isModerator, policies: $i.policies as Record<string, unknown> });
		const screen = hatagoesUsageScreenForPath(ctx.fullPath, allowedScreens);
		if (screen) recordHatagoesScreenUsage($i.id, screen.id, allowedScreens);
	}
	analytics.page({
		path: ctx.fullPath,
		title: ctx.fullPath,
	});
});

mainRouter.init();

export function useRouter(): Router {
	return inject(DI.router, null) ?? mainRouter;
}
