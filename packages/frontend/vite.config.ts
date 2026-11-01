import path from 'path';
import pluginReplace from '@rollup/plugin-replace';
import pluginVue from '@vitejs/plugin-vue';
import pluginGlsl from 'vite-plugin-glsl';
import { defineConfig } from 'vite';
import type { UserConfig } from 'vite';
import * as yaml from 'js-yaml';
import { promises as fsp } from 'fs';
import { execaSync } from 'execa';

import locales from '../../locales/index.js';
import meta from '../../package.json';
import packageInfo from './package.json' with { type: 'json' };
import pluginUnwindCssModuleClassName from './lib/rollup-plugin-unwind-css-module-class-name.js';
import pluginJson5 from './vite.json5.js';
import pluginCreateSearchIndex from './lib/vite-plugin-create-search-index.js';
import type { Options as SearchIndexOptions } from './lib/vite-plugin-create-search-index.js';
import pluginCreateSettingsSearchIndexV2, { type SettingsSearchIndexV2Options } from './lib/vite-plugin-create-settings-search-index-v2.js';
import pluginWatchLocales from './lib/vite-plugin-watch-locales.js';
import { pluginRemoveUnrefI18n } from '../frontend-builder/rollup-plugin-remove-unref-i18n.js';
import { Features } from 'lightningcss';
import { hataigoSourceUrl } from './src/utility/hataigo/source.js';

const url = process.env.NODE_ENV === 'development' ? yaml.load(await fsp.readFile('../../.config/default.yml', 'utf-8')).url : null;
const host = url ? (new URL(url)).hostname : undefined;

// Get local git commit hash
function getGitHash(): string {
	try {
		const result = execaSync('git', ['rev-parse', 'HEAD'], { cwd: path.resolve(__dirname, '../..') });
		return result.stdout.trim();
	} catch (error) {
		console.warn('Failed to get git hash:', error);
		return 'unknown';
	}
}

const gitHash = getGitHash();
const hataigoSource = (() => {
	try {
		const cwd = path.resolve(__dirname, '../..');
		const remote = execaSync('git', ['remote', 'get-url', 'origin'], { cwd }).stdout.trim();
		const clean = execaSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd }).stdout.trim() === '';
		return hataigoSourceUrl(process.env.HATAIGO_SOURCE_URL, remote, gitHash, clean);
	} catch {
		return hataigoSourceUrl(process.env.HATAIGO_SOURCE_URL, '', gitHash, false);
	}
})();

const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.json5', '.svg', '.sass', '.scss', '.css', '.vue'];

/**
 * 検索インデックスの生成設定
 */
export const searchIndexes = [{
	targetFilePaths: ['src/pages/settings/*.vue'],
	mainVirtualModule: 'search-index:settings',
	modulesToHmrOnUpdate: ['src/pages/settings/index.vue'],
	verbose: process.env.FRONTEND_SEARCH_INDEX_VERBOSE === 'true',
}, {
	targetFilePaths: ['src/pages/admin/*.vue'],
	mainVirtualModule: 'search-index:admin',
	modulesToHmrOnUpdate: ['src/pages/admin/index.vue'],
	verbose: process.env.FRONTEND_SEARCH_INDEX_VERBOSE === 'true',
}] satisfies SearchIndexOptions[];

/** Source-level settings-control inventory for the redesigned settings search. */
export const settingsControlSearchIndexV2 = {
	targetFilePaths: [
		{
			filePath: 'src/components/MkNoteCharmSettings.vue',
			routeOverride: '/settings/note-charm',
			owner: 'hatasaba',
			applicableUi: 'all',
		},
		'src/pages/settings/*.vue',
		{
			filePath: 'src/components/concrnt/ConcrntSettings.vue',
			routeOverride: '/settings/concrnt',
			persistence: 'device',
			saveMode: 'immediate',
			availability: 'all',
			owner: 'hatasaba',
			applicableUi: 'all',
		},
		{
			// The root settings notice owns the existing auto-backup enable action.
			// Its exact target overrides the page glob so the descriptor can retain
			// the device Pizzax evidence without inventing a child route.
			filePath: 'src/pages/settings/index.vue',
			routeOverride: '/settings',
			persistence: 'device',
			saveMode: 'immediate',
			owner: 'core',
			applicableUi: 'all',
		},
		{
			// The window is only a launcher; all searchable settings live in the
			// shared body used by both the popup and the permanent settings surface.
			filePath: 'src/components/HatasabaUi2SettingsBody.vue',
			routeOverride: '/settings/hata-custom',
			activation: { kind: 'popup', category: 'glassUi', popup: 'hatasaba-ui2' },
			owner: 'hatasaba',
			applicableUi: 'simple',
		},
		{
			// Permanent glassUi surface. Persistence is intentionally derived per
			// control because this source mixes device-local foldable layout and a
			// profile-synchronised branding choice.
			filePath: 'src/components/HatasabaUi2ImmediateSettings.vue',
			routeOverride: '/settings/hata-custom',
			activation: { kind: 'hata-custom-category', category: 'glassUi' },
			saveMode: 'immediate',
			owner: 'hatasaba',
			applicableUi: 'simple',
		},
		{
			filePath: 'src/components/MkEarthquakeSettings.vue',
			routeOverride: '/settings/hata-custom',
			activation: { kind: 'popup', category: 'earthquake', popup: 'earthquake' },
			persistence: 'device',
			owner: 'hatasaba',
			applicableUi: 'all',
		},
		{
			// Imported by notifications.vue. Search only focuses this existing
			// control; it must never invoke the browser permission or subscription
			// handler while navigating to the result.
			filePath: 'src/components/MkPushNotificationAllowButton.vue',
			routeOverride: '/settings/notifications',
			persistence: 'account',
			saveMode: 'immediate',
			availability: 'all',
			owner: 'core',
			applicableUi: 'all',
		},
		{
			filePath: 'src/components/MkUISetup.vue',
			routeOverride: '/settings/hata-custom',
			activation: { kind: 'popup', category: 'general', popup: 'ui-setup' },
			persistence: 'device',
			saveMode: 'reload',
			owner: 'hatasaba',
			applicableUi: 'all',
		},
		{
			filePath: 'src/components/MkHataSettingsTransfer.vue',
			routeOverride: '/settings/hata-custom',
			activation: { kind: 'popup', category: 'general', popup: 'settings-transfer' },
			persistence: 'account',
			saveMode: 'buffered',
			owner: 'hatasaba',
			applicableUi: 'all',
		},
		{
			filePath: 'src/pages/HataskSettings.vue',
			routeOverride: '/settings/hata-custom',
			activation: { kind: 'popup', category: 'hatask', popup: 'hatask' },
			persistence: 'account',
			owner: 'hatasaba',
			applicableUi: 'all',
		},
		{
			filePath: 'src/components/HataFeedDisplaySettings.vue',
			routeOverride: '/settings/hatafeed',
			saveMode: 'immediate',
			owner: 'hatasaba',
			applicableUi: 'all',
		},
		{
			filePath: 'src/components/HatadyDisplaySettings.vue',
			routeOverride: '/settings/hata-custom',
			activation: { kind: 'popup', category: 'hatady', popup: 'hatady' },
			persistence: 'device',
			owner: 'hatasaba',
			applicableUi: 'all',
		},
		{
			filePath: 'src/pages/MkMascotSettings.vue',
			routeOverride: '/settings/hata-custom',
			activation: { kind: 'popup', category: 'mascot', popup: 'mascot' },
			persistence: 'device',
			owner: 'hatasaba',
			applicableUi: 'all',
		},
	],
	mainVirtualModule: 'search-index-v2:settings',
	routerDefinitionPath: 'src/router.definition.ts',
	// The shared UI2 body and immediate companion are independently inventoried:
	// 547 source descriptors plus three explicit shell actions. Concrnt keeps
	// its device settings independent from the external-account preferences.
	// HataFeed now
	// owns its theme and existing leaves setting. The permanent
	// UI2 root is a real focusable group for the former broad "UI" tab aliases;
	// eight static popup controls resolve through the audited `editor.copy`
	// proxy, while dynamic values/runtime collections use semantic groups.
	expectedControlCount: 550,
	manualDescriptors: [
		{ stableId: 'settings.shell.clear-cache', route: '/settings', sourceFile: 'settings-shell', sourceLine: 0, component: 'SettingsShellAction', label: '', labelExpression: '${i18n.ts.clearCache}', labelI18nKeys: ['i18n.ts.clearCache'], preferenceKeys: [], legacyMarkerAncestorIds: [], conditions: [], searchable: true, destructive: true, persistence: 'device', saveMode: 'immediate', availability: 'all', owner: 'hatasaba', applicableUi: 'all', metadataEvidence: { persistence: '端末キャッシュを消去する既存shell操作', saveMode: '既存確認後に即時実行', availability: 'shell操作は端末幅を問わない', owner: 'settings shell', applicableUi: '全UIで表示するshell操作' }, relatedHostId: 'settings.shell.clear-cache' },
		{ stableId: 'settings.shell.logout', route: '/settings', sourceFile: 'settings-shell', sourceLine: 0, component: 'SettingsShellAction', label: '', labelExpression: '${i18n.ts.logout}', labelI18nKeys: ['i18n.ts.logout'], preferenceKeys: [], legacyMarkerAncestorIds: [], conditions: [], searchable: true, destructive: true, persistence: 'account', saveMode: 'immediate', availability: 'all', owner: 'hatasaba', applicableUi: 'all', metadataEvidence: { persistence: '現在のアカウントsessionを終了する既存shell操作', saveMode: '既存確認後に即時実行', availability: 'shell操作は端末幅を問わない', owner: 'settings shell', applicableUi: '全UIで表示するshell操作' }, relatedHostId: 'settings.shell.logout' },
		{ stableId: 'settings.shell.logout-all', route: '/settings', sourceFile: 'settings-shell', sourceLine: 0, component: 'SettingsShellAction', label: '', labelExpression: '${i18n.ts._hata._settingsRedesign.actions.logoutAll}', labelI18nKeys: ['i18n.ts._hata._settingsRedesign.actions.logoutAll'], preferenceKeys: [], legacyMarkerAncestorIds: [], conditions: [], searchable: true, destructive: true, persistence: 'account', saveMode: 'immediate', availability: 'all', owner: 'hatasaba', applicableUi: 'all', metadataEvidence: { persistence: '全端末sessionを終了する既存shell操作', saveMode: '既存確認後に即時実行', availability: 'shell操作は端末幅を問わない', owner: 'settings shell', applicableUi: '全UIで表示するshell操作' }, relatedHostId: 'settings.shell.logout-all' },
	],
	modulesToHmrOnUpdate: ['src/pages/settings-redesign/index.vue'],
} satisfies SettingsSearchIndexV2Options;

/**
 * Misskeyのフロントエンドにバンドルせず、CDNなどから別途読み込むリソースを記述する。
 * CDNを使わずにバンドルしたい場合、以下の配列から該当要素を削除orコメントアウトすればOK
 */
const externalPackages = [
	// shiki（コードブロックのシンタックスハイライトで使用中）はテーマ・言語の定義の容量が大きいため、それらはCDNから読み込む
	{
		name: 'shiki',
		match: /^shiki\/(?<subPkg>(langs|themes))$/,
		path(id: string, pattern: RegExp): string {
			const match = pattern.exec(id)?.groups;
			return match
				? `https://esm.sh/shiki@${packageInfo.dependencies.shiki}/${match['subPkg']}`
				: id;
		},
	},
	// tinyld가 특수 UTF-8 문자를 사용하므로 Vite 빌드 과정에서 제외하고 CDN을 통해 로드함.
	// https://github.com/komodojp/tinyld/issues/29#issuecomment-2165835459
	{
		name: 'tinyld',
		match: /^tinyld$/,
		path(): string {
			return `https://cdn.jsdelivr.net/npm/tinyld@${packageInfo.dependencies.tinyld}/dist/tinyld.normal.node.mjs`;
		},
	},
];

export const hash = (str: string, seed = 0): number => {
	let h1 = 0xdeadbeef ^ seed,
		h2 = 0x41c6ce57 ^ seed;
	for (let i = 0, ch; i < str.length; i++) {
		ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}

	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

	return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

export const BASE62_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function toBase62(n: number): string {
	if (n === 0) {
		return '0';
	}
	let result = '';
	while (n > 0) {
		result = BASE62_DIGITS[n % BASE62_DIGITS.length] + result;
		n = Math.floor(n / BASE62_DIGITS.length);
	}

	return result;
}

export function getConfig(): UserConfig {
	const localesHash = toBase62(hash(JSON.stringify(locales)));

	return {
		base: '/vite/',

		// The console is shared with backend, so clearing the console will also clear the backend log.
		clearScreen: false,

		server: {
			// The backend allows access from any addresses, so vite also allows access from any addresses.
			host: '0.0.0.0',
			allowedHosts: host ? [host] : undefined,
			port: 5173,
			strictPort: true,
			hmr: {
				// バックエンド経由での起動時、Viteは5173経由でアセットを参照していると思い込んでいるが実際は3000から配信される
				// そのため、バックエンドのWSサーバーにHMRのWSリクエストが吸収されてしまい、正しくHMRが機能しない
				// クライアント側のWSポートをViteサーバーのポートに強制させることで、正しくHMRが機能するようになる
				clientPort: 5173,
			},
			headers: { // なんか効かない
				'X-Frame-Options': 'DENY',
			},
		},

		plugins: [
			pluginWatchLocales(),
			...searchIndexes.map(options => pluginCreateSearchIndex(options)),
			pluginCreateSettingsSearchIndexV2(settingsControlSearchIndexV2),
			pluginVue(),
			pluginRemoveUnrefI18n(),
			pluginUnwindCssModuleClassName(),
			pluginJson5(),
			pluginGlsl({ minify: true }),
			...process.env.NODE_ENV === 'production'
				? [
					pluginReplace({
						preventAssignment: true,
						values: {
							'isChromatic()': JSON.stringify(false),
						},
					}),
				]
				: [],
		],

		resolve: {
			extensions,
			alias: {
				'@/': __dirname + '/src/',
				'@@/': __dirname + '/../frontend-shared/',
				'/client-assets/': __dirname + '/assets/',
				'/static-assets/': __dirname + '/../backend/assets/',
				'/fluent-emojis/': __dirname + '/../../fluent-emojis/dist/',
				'/fluent-emoji/': __dirname + '/../../fluent-emojis/dist/',
			},
		},

		css: {
			lightningcss: {
				exclude: Features.LightDark,
			},
			modules: {
				generateScopedName(name, filename, _css): string {
					const id = (path.relative(__dirname, filename.split('?')[0]) + '-' + name).replace(/[\\\/\.\?&=]/g, '-').replace(/(src-|vue-)/g, '');
					if (process.env.NODE_ENV === 'production') {
						return 'x' + toBase62(hash(id));
					} else {
						return id;
					}
				},
			},
			preprocessorOptions: {
				scss: {
					api: 'modern-compiler',
				},
			},
		},

		define: {
			_VERSION_: JSON.stringify(meta.version),
			_BASEDMISSKEYVERSION_: JSON.stringify(meta.basedMisskeyVersion),
			_GIT_HASH_: JSON.stringify(gitHash),
			'import.meta.env.HATAIGO_SOURCE_URL': JSON.stringify(hataigoSource),
			_LANGS_: JSON.stringify(Object.entries(locales).map(([k, v]) => [k, v._lang_])),
			_ENV_: JSON.stringify(process.env.NODE_ENV),
			_DEV_: process.env.NODE_ENV !== 'production',
			_PERF_PREFIX_: JSON.stringify('CherryPick:'),
			__VUE_OPTIONS_API__: true,
			__VUE_PROD_DEVTOOLS__: false,
		},

		build: {
			target: [
				'chrome130',
				'firefox132',
				'safari18.2',
			],
			manifest: 'manifest.json',
			rollupOptions: {
				input: {
					i18n: './src/i18n.ts',
					entry: './src/_boot_.ts',
				},
				external: externalPackages.map(p => p.match),
				preserveEntrySignatures: 'allow-extension',
				output: {
					/*
					旗鯖fork(G9): vite 8(rolldown) で manualChunks が廃止され codeSplitting.groups へ。
					⚠️G10でMkLightbox系(新ビューワー)へ移行しphotoswipeへの参照がsrc配下から0件になったため、
					photoswipe専用グループは削除して上流2026.7.0の形へ揃えた。
					*/
					codeSplitting: {
						groups: [{
							name: 'vue',
							test: /node_modules[\\/]vue/,
						}, {
							// split i18n related module to distinct module
							name: 'i18n',
							includeDependenciesRecursively: false,
							test: /i18n\.ts|locale\.ts/,
						}],
					},
					entryFileNames: `scripts/${localesHash}-[hash:8].js`,
					chunkFileNames: `scripts/${localesHash}-[hash:8].js`,
					assetFileNames: `assets/${localesHash}-[hash:8][extname]`,
					paths(id) {
						for (const p of externalPackages) {
							if (p.match.test(id)) {
								return p.path(id, p.match);
							}
						}

						return id;
					},
				},
			},
			cssCodeSplit: true,
			outDir: __dirname + '/../../built/_frontend_vite_',
			assetsDir: '.',
			emptyOutDir: false,
			sourcemap: process.env.NODE_ENV === 'development',
			reportCompressedSize: false,

			// https://vitejs.dev/guide/dep-pre-bundling.html#monorepos-and-linked-dependencies
			commonjsOptions: {
				include: [/cherrypick-js/, /misskey-reversi/, /misskey-bubble-game/, /node_modules/],
			},
		},

		worker: {
			format: 'es',
		},

		test: {
			environment: 'happy-dom',
			// 旗鯖fork: Node 22+ の実験的 webstorage getter が happy-dom の localStorage を
			// 覆い隠して読込時エラーになるのを防ぐ(詳細は test/vitest-setup.ts)。
			setupFiles: ['./test/vitest-setup.ts'],
			deps: {
				optimizer: {
					web: {
						include: [
							// XXX: misskey-dev/browser-image-resizer has no "type": "module"
							'browser-image-resizer',
						],
					},
				},
			},
			includeSource: ['src/**/*.ts'],
			// 旗鯖fork: test/e2e/*.spec.ts は Playwright 専用(`@playwright/test`前提)。
			// vitestのデフォルトincludeは*.spec.tsも拾ってしまうため明示的に除外する。
			exclude: ['**/node_modules/**', '**/dist/**', 'test/e2e/**'],
		},
	};
}

const config = defineConfig(({ command, mode }) => getConfig());

export default config;
