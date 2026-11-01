/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import Fastify from 'fastify';
import pug from 'pug';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { legacyAppIconRoutes, resolveAppIconUrl } from '@/server/web/app-icon.js';
import { Layout } from '@/server/web/views/base.js';
import type { FastifyInstance } from 'fastify';

type ManifestIcon = { src: string; sizes: string; purpose: string; type?: string };
type Manifest = { icons: ManifestIcon[]; name: string; short_name: string; start_url: string; display: string };
type ManifestMeta = {
	name: string | null;
	shortName: string | null;
	themeColor: string | null;
	app192IconUrl: string | null;
	app512IconUrl: string | null;
	iconUrl: string | null;
	manifestJsonOverride: string;
	customSplashText: string[];
};
type ReplyStub = { header: ReturnType<typeof vi.fn>; type: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn>; redirect: ReturnType<typeof vi.fn> };
type IconCommonData = { icon: string | null; appleTouchIcon: string | null } & Record<string, unknown>;
type ManifestHarness = {
	meta: ManifestMeta;
	config: { url: string; host: string };
	metaEntityService: { packDetailed: ReturnType<typeof vi.fn> };
	prepareFrontendAssets: ReturnType<typeof vi.fn>;
	manifestHandler(reply: { header: ReturnType<typeof vi.fn> }): Promise<Manifest>;
	appIconHandler(size: 192 | 512, reply: ReplyStub, legacy?: boolean): Promise<unknown>;
	generateCommonPugData(meta: ManifestMeta): Promise<IconCommonData>;
	getCommonData(): Promise<IconCommonData>;
};

const serviceSource = readFileSync(resolve(process.cwd(), 'src/server/web/ClientServerService.ts'), 'utf8');

// Execute the real manifest methods without constructing the HTTP server or its
// DB/queue dependencies. The AST keeps method bodies intact; only decorators and
// unrelated members are removed. This does not simulate browser icon selection.
function loadHarness(source: string, className = 'ClientServerService', names = ['generatePlainIconSvg', 'generatePlainIconDataUri', 'manifestHandler', 'appIconHandler', 'generateCommonPugData']): new () => ManifestHarness {
	const file = ts.createSourceFile('ClientServerService.ts', source, ts.ScriptTarget.Latest, true);
	const service = file.statements.find((statement): statement is ts.ClassDeclaration => ts.isClassDeclaration(statement) && statement.name?.text === className);
	if (!service) throw new Error(`${className} class not found`);
	const members = names.map(name => {
		const method = service.members.find((member): member is ts.MethodDeclaration => ts.isMethodDeclaration(member) && member.name.getText(file) === name);
		if (!method) throw new Error(`Real method not found: ${name}`);
		const modifiers = method.modifiers?.filter(modifier => !ts.isDecorator(modifier) && modifier.kind !== ts.SyntaxKind.PrivateKeyword);
		return ts.factory.updateMethodDeclaration(method, modifiers, method.asteriskToken, method.name, method.questionToken, method.typeParameters, method.parameters, method.type, method.body);
	});
	const harness = ts.factory.createClassDeclaration(undefined, 'ManifestHarness', undefined, undefined, members);
	const code = ts.createPrinter().printNode(ts.EmitHint.Unspecified, harness, file);
	const output = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } });
	return runInNewContext(`${output.outputText}\nManifestHarness`, {
		resolveAppIconUrl, resolve,
		// Only non-icon dependencies are stubbed; no DB, boot assets, or server is started.
		_dirname: resolve(process.cwd(), 'src/server/web'),
		readdirSync: () => [],
		loadLanguages: () => [],
		htmlSafeJsonStringify: JSON.stringify,
	}) as new () => ManifestHarness;
}

const Harness = loadHarness(serviceSource);

function createService(meta: Partial<ManifestMeta> = {}, Constructor = Harness, url = 'https://example.test') {
	const service = new Constructor();
	service.config = { url, host: new URL(url).host };
	service.meta = { name: 'Test server', shortName: null, themeColor: null, app192IconUrl: null, app512IconUrl: null, iconUrl: null, manifestJsonOverride: '', customSplashText: [], ...meta };
	service.metaEntityService = { packDetailed: vi.fn().mockResolvedValue({}) };
	service.prepareFrontendAssets = vi.fn().mockResolvedValue(undefined);
	return service;
}

async function manifest(meta: Partial<ManifestMeta> = {}, Constructor = Harness, url = 'https://example.test') {
	const service = createService(meta, Constructor, url);
	const reply = { header: vi.fn() };
	const result = await service.manifestHandler(reply);
	// Check the JSON actually delivered, including omission of undefined MIME hints.
	return { value: JSON.parse(JSON.stringify(result)) as Manifest, reply };
}

function registerRealIconRoutes(service: ManifestHarness, fastify: FastifyInstance) {
	const file = ts.createSourceFile('ClientServerService.ts', serviceSource, ts.ScriptTarget.Latest, true);
	const declaration = file.statements.find((statement): statement is ts.ClassDeclaration => ts.isClassDeclaration(statement) && statement.name?.text === 'ClientServerService');
	const createServer = declaration?.members.find((member): member is ts.MethodDeclaration => ts.isMethodDeclaration(member) && member.name.getText(file) === 'createServer');
	const statements = createServer?.body?.statements.filter(statement => statement.getText(file).includes('this.appIconHandler('));
	if (statements?.length !== 3) throw new Error('Expected two standard routes and one legacy allowlist registration');
	const body = statements.map(statement => ts.createPrinter().printNode(ts.EmitHint.Unspecified, statement, file)).join('\n');
	const output = ts.transpileModule(`function register(fastify) { ${body} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
	const register = runInNewContext(`${output.outputText}\nregister`, { legacyAppIconRoutes }) as (this: ManifestHarness, server: FastifyInstance) => void;
	register.call(service, fastify);
}

function checkDefaultIcons(icons: ManifestIcon[]) {
	expect(icons).toHaveLength(2);
	expect(icons.map(icon => icon.sizes)).toEqual(['192x192', '512x512']);
	for (const icon of icons) {
		expect(icon.purpose.split(' ')).toContain('any');
		expect(icon.purpose.split(' ')).toContain('maskable');
		expect(icon.src).not.toBe('/static-assets/splash.png');
	}
}

describe('ClientServerService PWA manifest icons', () => {
	it('offers configured app icons for both normal desktop and maskable mobile uses', async () => {
		const { value } = await manifest({ app192IconUrl: '/app192.png', app512IconUrl: '/app512.png', iconUrl: '/server.png' });
		checkDefaultIcons(value.icons);
		expect(value.icons.map(icon => icon.src)).toEqual(['/app192.png', '/app512.png']);
	});

	it.each([
		{ app192IconUrl: '/app192.png', expected: ['/app192.png', '/app192.png'] },
		{ app512IconUrl: '/app512.png', expected: ['/app512.png', '/app512.png'] },
	])('uses the other configured PWA size before the server icon: $expected', async ({ expected, ...settings }) => {
		const { value } = await manifest({ ...settings, iconUrl: '/server.webp' });
		checkDefaultIcons(value.icons);
		expect(value.icons.map(icon => icon.src)).toEqual(expected);
	});

	it('uses the configured server icon when both app fields are blank', async () => {
		const { value } = await manifest({ app192IconUrl: '', app512IconUrl: '', iconUrl: '/server.svg' });
		checkDefaultIcons(value.icons);
		expect(value.icons.map(icon => icon.src)).toEqual(['/server.svg', '/server.svg']);
	});

	it.each([null, ''])('labels generated fallback SVGs correctly for unset value %s', async unset => {
		const { value } = await manifest({ app192IconUrl: unset, app512IconUrl: unset, iconUrl: unset });
		checkDefaultIcons(value.icons);
		value.icons.forEach((icon, index) => {
			expect(icon.type).toBe('image/svg+xml');
			expect(icon.src).toMatch(/^data:image\/svg\+xml;utf8,/);
			const svg = decodeURIComponent(icon.src.split(',')[1]);
			const size = index === 0 ? 192 : 512;
			expect(svg).toContain(`width="${size}" height="${size}"`);
			expect(svg).toContain('<rect');
		});
	});

	it('keeps generated icons deterministic and specific to the server', async () => {
		const a = (await manifest()).value.icons;
		expect((await manifest()).value.icons).toEqual(a);
		expect((await manifest({}, Harness, 'https://another.test')).value.icons).not.toEqual(a);
	});

	it('does not mislabel configured SVG, WebP, or extensionless URLs as PNG', async () => {
		for (const url of ['/icon.svg', '/icon.webp', '/files/icon?id=1']) {
			const { value } = await manifest({ iconUrl: url });
			for (const icon of value.icons) expect(icon).not.toHaveProperty('type');
		}
	});

	it('retains an explicit administrator manifest override', async () => {
		const icons = [{ src: '/custom.png', sizes: '512x512', purpose: 'any' }];
		const { value } = await manifest({ manifestJsonOverride: JSON.stringify({ icons, name: 'Override' }) });
		expect(value.icons).toEqual(icons);
		expect(value.name).toBe('Override');
	});

	it('does not change app identity, install target, or cache policy', async () => {
		const { value, reply } = await manifest({ shortName: 'Short' });
		expect(value.name).toBe('Test server');
		expect(value.short_name).toBe('Short');
		expect(value.start_url).toBe('/');
		expect(value.display).toBe('standalone');
		expect(reply.header).toHaveBeenCalledWith('Cache-Control', 'max-age=300');
	});

	it('ignores whitespace and local generated-icon self references without losing other settings', async () => {
		const { value } = await manifest({ app192IconUrl: ' ', app512IconUrl: 'https://example.test/static-assets/splash.png?old=1', iconUrl: '/server.png' });
		expect(value.icons.map(icon => icon.src)).toEqual(['/server.png', '/server.png']);
		const { value: selfReference } = await manifest({ app192IconUrl: '/favicon.ico', app512IconUrl: '/apple-touch-icon.png' });
		expect(selfReference.icons.every(icon => icon.type === 'image/svg+xml')).toBe(true);
		const { value: otherServer } = await manifest({ app512IconUrl: 'https://another.test/static-assets/splash.png' });
		expect(otherServer.icons.map(icon => icon.src)).toEqual(['https://another.test/static-assets/splash.png', 'https://another.test/static-assets/splash.png']);
	});

	it.each([
		'/%66avicon.ico?old=1',
		'https://example.test/%61pple-touch-icon.png?old=1',
		'/static-assets/%73plash.png?old=1',
		'/static-assets/%61pple-touch-icon.png?old=1',
		'/static-assets/%66avicon.ico?old=1',
		'/static-assets/%66avicon.png?old=1',
		'/static-assets/icons/%31%39%32.png?old=1',
		'https://example.test/static-assets/icons/%35%31%32.png?old=1',
	])('rejects encoded local self references before manifest selection and redirect: %s', async url => {
		const settings = { app192IconUrl: url, app512IconUrl: url, iconUrl: '/server.png' };
		const { value } = await manifest(settings);
		expect(value.icons.map(icon => icon.src)).toEqual(['/server.png', '/server.png']);
		const { value: withoutFallback } = await manifest({ ...settings, iconUrl: null });
		expect(withoutFallback.icons.every(icon => icon.type === 'image/svg+xml')).toBe(true);

		// The real router decodes this request into a standard/legacy icon route;
		// it must redirect to the configured fallback rather than back to itself.
		const fastify = Fastify();
		registerRealIconRoutes(createService(settings), fastify);
		try {
			const requestUrl = new URL(url, 'https://example.test');
			const response = await fastify.inject(`${requestUrl.pathname}${requestUrl.search}`);
			expect(response.statusCode).toBe(302);
			expect(response.headers.location).toBe('/server.png');
		} finally {
			await fastify.close();
		}
	});

	it.each([
		'/files/my%20icon.png?v=1',
		'/custom/%66avicon.ico',
		'/static-assets%2Fsplash.png',
		'https://another.test/static-assets/%73plash.png?old=1',
	])('preserves custom encoded paths, reserved separators, and other origins: %s', async url => {
		const { value } = await manifest({ app512IconUrl: url, iconUrl: '/server.png' });
		expect(value.icons.map(icon => icon.src)).toEqual([url, url]);
	});

	it.each([
		{ configured: '?v=1', expected: '/?v=1' },
		{ configured: '#x', expected: '/#x' },
		{ configured: 'icons/custom.png', expected: '/icons/custom.png' },
	])('normalizes request-relative icon URL $configured to $expected', async ({ configured, expected }) => {
		const settings = { app192IconUrl: configured };
		const { value } = await manifest(settings);
		expect(value.icons.map(icon => icon.src)).toEqual([expected, expected]);

		const fastify = Fastify();
		registerRealIconRoutes(createService(settings), fastify);
		try {
			for (const requestPath of ['/favicon.ico', '/static-assets/icons/192.png']) {
				const response = await fastify.inject({ method: 'GET', url: requestPath });
				expect(response.statusCode).toBe(302);
				const location = response.headers.location;
				expect(location).toBe(expected);
				if (typeof location !== 'string') throw new Error('Icon redirect location was not a string');
				const redirectUrl = new URL(location, `https://example.test${requestPath}`);
				expect(redirectUrl.pathname).not.toBe(requestPath);
				const followed = await fastify.inject({ method: 'GET', url: `${redirectUrl.pathname}${redirectUrl.search}` });
				expect(followed.statusCode).not.toBe(302);
			}
		} finally {
			await fastify.close();
		}
	});

	it('registers only the six known legacy files and lets them override the static wildcard', async () => {
		expect(legacyAppIconRoutes).toEqual([
			['/static-assets/splash.png', 512],
			['/static-assets/apple-touch-icon.png', 512],
			['/static-assets/favicon.ico', 192],
			['/static-assets/favicon.png', 192],
			['/static-assets/icons/192.png', 192],
			['/static-assets/icons/512.png', 512],
		]);
		// Fastify injection exercises routing and headers without opening a port.
		const fastify = Fastify();
		fastify.get('/static-assets/*', async (_request, reply) => reply.code(404).send());
		registerRealIconRoutes(createService({ app192IconUrl: '/configured.png' }), fastify);
		try {
			for (const [url] of legacyAppIconRoutes) {
				const response = await fastify.inject({ method: 'GET', url });
				expect(response.statusCode).toBe(302);
				expect(response.headers.location).toBe('/configured.png');
				expect(response.headers['cache-control']).toBe('no-cache');
			}
			expect((await fastify.inject('/static-assets/other.png')).statusCode).toBe(404);
		} finally {
			await fastify.close();
		}
	});

	it('serves deterministic SVG with the correct MIME at standard and legacy icon routes', async () => {
		const fastify = Fastify();
		registerRealIconRoutes(createService(), fastify);
		try {
			for (const [url, size] of [['/favicon.ico', 192], ['/apple-touch-icon.png', 512], ...legacyAppIconRoutes] as const) {
				const response = await fastify.inject({ method: 'GET', url });
				expect(response.statusCode).toBe(200);
				expect(response.headers['content-type']).toContain('image/svg+xml');
				expect(response.body).toContain(`width="${size}" height="${size}"`);
				expect(response.body).toContain('<rect');
			}
		} finally {
			await fastify.close();
		}
	});

	it.each([
		{ meta: { app192IconUrl: '/small.png', app512IconUrl: '/large.png', iconUrl: '/server.png' }, expected: '/large.png' },
		{ meta: { app192IconUrl: '/small.png', iconUrl: '/server.png' }, expected: '/small.png' },
		{ meta: { iconUrl: '/server.png' }, expected: '/server.png' },
		{ meta: {}, expected: '/apple-touch-icon.png' },
	])('uses the same PWA priority in normal, embedded, and OAuth splash HTML: $expected', async ({ meta, expected }) => {
		const service = createService(meta);
		const pugData = await service.generateCommonPugData(service.meta);
		const templateSource = readFileSync(resolve(process.cwd(), 'src/server/web/HtmlTemplateService.ts'), 'utf8');
		const template = createService(meta, loadHarness(templateSource, 'HtmlTemplateService', ['getCommonData']));
		const jsxData = await template.getCommonData();
		expect(jsxData.appleTouchIcon).toBe(pugData.appleTouchIcon);
		expect(jsxData.icon).toBe(pugData.icon);
		const config = {
			...service.config, frontendEntry: { file: 'entry.js', css: [] }, frontendEmbedEntry: { file: 'embed.js', css: [] },
			frontendManifestExists: true, frontendEmbedManifestExists: true,
		};
		const pugHtml = ['base.pug', 'base-embed.pug'].map(filename => pug.renderFile(resolve(process.cwd(), 'src/server/web/views', filename), {
			...pugData, config, version: 'test', basedMisskeyVersion: 'test', clientCtx: '{}', embedCtx: '{}',
		}));
		const jsxHtml = String(await Layout({ ...jsxData, config } as Parameters<typeof Layout>[0]));
		for (const html of [...pugHtml, jsxHtml]) {
			expect(html).toMatch(new RegExp(`id="splashIcon"[^>]*src="${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
			expect(html).not.toContain('/static-assets/splash.png');
		}
	});

	it('keeps the unused manifest template on current dynamic routes rather than bundled illustrations', () => {
		const template = JSON.parse(readFileSync(resolve(process.cwd(), 'src/server/web/manifest.json'), 'utf8')) as Manifest;
		checkDefaultIcons(template.icons);
		expect(template.icons.map(icon => icon.src)).toEqual(['/favicon.ico', '/apple-touch-icon.png']);
	});

	it('positive control: detects regression to maskable-only configured icons', async () => {
		const broken = loadHarness(serviceSource.replaceAll('\'purpose\': \'any maskable\'', '\'purpose\': \'maskable\''));
		const { value } = await manifest({ iconUrl: '/server.png' }, broken);
		expect(() => checkDefaultIcons(value.icons)).toThrow();
	});

	it('positive control: detects the old illustration as a normal icon candidate', async () => {
		const { value } = await manifest({ iconUrl: '/server.png' });
		value.icons[0].src = '/static-assets/splash.png';
		expect(() => checkDefaultIcons(value.icons)).toThrow();
	});
});
