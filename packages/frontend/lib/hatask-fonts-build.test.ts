/* SPDX-License-Identifier: AGPL-3.0-only */
// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as compiler from '@vue/compiler-sfc';
import pluginVue from '@vitejs/plugin-vue';
import * as sass from 'sass';
import { describe, expect, test } from 'vitest';

const consumers = [
	'src/pages/hatask.vue',
	'src/pages/welcome.entrance.hatask-preview.vue',
	'src/components/MkHataWhatsNew.vue',
];
const fontFile = path.resolve(process.cwd(), 'src/components/hatask/hatask-fonts.scss');
const expectedCss = sass.compile(fontFile).css;

async function transformFonts(order: string[], legacy: boolean): Promise<string[]> {
	const plugin = pluginVue({ compiler });
	if (!plugin.api) throw new Error('Vue plugin API is missing');
	plugin.api.options = { ...plugin.api.options, isProduction: true, sourceMap: false };
	const hook = plugin.transform;
	if (!hook) throw new Error('Vue transform hook is missing');
	const handler = typeof hook === 'function' ? hook : hook.handler;
	const context = {
		resolve: async (source: string, importer: string) => ({ id: path.resolve(path.dirname(importer), source) }),
		addWatchFile() {},
		error(error: unknown) { throw error; },
	};
	const requests: { id: string; css: string }[] = [];
	// Register every owner before transforming CSS, as concurrent production
	// builds can do. Keep each real font block and its original style index.
	for (const relative of order) {
		const filename = path.resolve(process.cwd(), relative);
		const source = fs.readFileSync(filename, 'utf8');
		const blocks = [...source.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gu)].map(match => match[0]);
		const index = blocks.findIndex(block => block.includes('hatask-fonts.scss'));
		expect(index).toBeGreaterThanOrEqual(0);
		const fontBlock = legacy ? `<style lang="scss" src="${fontFile}"></style>` : blocks[index];
		const fixture = '<template><div /></template>\n' + blocks.map((_, position) => position === index ? fontBlock : '<style>.fixture { color: inherit; }</style>').join('\n');
		const result = await Reflect.apply(handler, context, [fixture, filename]);
		const imports = [...result.code.matchAll(/import "([^"]+\?vue&type=style[^"]+)"/gu)].map(match => match[1]);
		const request = imports.find(id => new URLSearchParams(id.split('?')[1]).get('index') === String(index));
		expect(request).toBeDefined();
		const [file, query] = request!.split('?');
		const id = `${path.resolve(path.dirname(filename), file)}?${query}`;
		const { descriptor } = compiler.parse(fixture, { filename });
		const block = descriptor.styles[index];
		const css = block.src
			? sass.compile(path.resolve(path.dirname(filename), block.src)).css
			: sass.compileString(block.content, { url: pathToFileURL(filename) }).css;
		requests.push({ id, css });
	}
	const output: string[] = [];
	for (const request of requests) {
		const result = await Reflect.apply(handler, context, [request.css, request.id]);
		output.push(result.code);
	}
	return output;
}

describe('Hatask shared fonts in production Vue transforms', () => {
	test('positive control reproduces the shared src style-index collision', async () => {
		await expect(transformFonts(consumers, true)).rejects.toThrow(/scoped/u);
	});
	test.each([consumers, [...consumers].reverse()])('preserves every global font declaration for load order %j', async (...order) => {
		const output = await transformFonts(order, false);
		expect(output).toHaveLength(consumers.length);
		for (const css of output) expect(css.trim()).toBe(expectedCss.trim());
	});
});
