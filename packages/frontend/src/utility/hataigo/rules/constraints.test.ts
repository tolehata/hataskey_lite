// SPDX-FileCopyrightText: Tolehata and hatasaba-project
// SPDX-License-Identifier: AGPL-3.0-only
import { access, readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const hataigoDirectory = resolve(process.cwd(), 'src/utility/hataigo');
const rulesDirectory = join(hataigoDirectory, 'rules');
const assetsDirectory = resolve(process.cwd(), 'assets/hataigo');
const requiredRuntimeFiles = ['board.ts', 'handicap.ts', 'game.ts', 'score.ts', 'sgf.ts'];
const forbiddenPlatformReference = /\b(?:window|document|Vue|misskeyApi)\b|(?:from\s*|import\s*\(|require\s*\()\s*['"](?:node:|node_modules\/)/i;
const platformReferenceControls = [
	'window',
	'document',
	'Vue',
	'misskeyApi',
	'import value from "node:fs"',
	'import("node:path")',
	'require("node:fs")',
];

const forbiddenTokens = [
	'onnx',
	'tensorflow',
	'tfjs',
	'ort',
	'tsumegoFrame',
	'lifeAndDeath',
	'solveLifeDeath',
	'targetStones',
	'progressiveWidening',
	'policyPrior',
	'dynamicsModel',
	'hiddenState',
	'valueNetwork',
];

// Use the very same matcher for the per-token positive controls and the real scan.
const hasForbiddenToken = (source: string, token: string): boolean => {
	const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = token === 'ort' ? `\\b${escapedToken}\\b` : escapedToken;
	return new RegExp(pattern, 'i').test(source);
};

async function collectRuntimeFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...await collectRuntimeFiles(entryPath));
		} else if (entry.isFile() && !entry.name.endsWith('.test.ts')) {
			files.push(entryPath);
		}
	}

	return files;
}

describe('HataIgo runtime constraints', () => {
	it('has every Phase 1 runtime module before scanning', async () => {
		const names = await readdir(rulesDirectory);
		for (const file of requiredRuntimeFiles) {
			expect(names, `missing required runtime module ${file}`).toContain(file);
		}
	});

	it('detects every prohibited token with an individual positive control', () => {
		for (const token of forbiddenTokens) {
			const controlText = `separate positive control containing ${token.toUpperCase()} marker`;
			expect(hasForbiddenToken(controlText, token), `detector missed positive control for ${token}`).toBe(true);
		}
	});

	it('detects browser, Vue, API, and Node references with positive controls', () => {
		for (const control of platformReferenceControls) {
			expect(forbiddenPlatformReference.test(control), `platform detector missed positive control: ${control}`).toBe(true);
		}
	});

	it('finds no prohibited tokens in recursively scanned runtime files', async () => {
		const files = await collectRuntimeFiles(hataigoDirectory);
		expect(files.length, 'runtime scan must not be empty').toBeGreaterThan(0);

		for (const file of files) {
			const source = await readFile(file, 'utf8');
			for (const token of forbiddenTokens) {
				expect(hasForbiddenToken(source, token), `${relative(hataigoDirectory, file)} contains prohibited token ${token}`).toBe(false);
			}
		}
	});

	it('carries the required SPDX header throughout utility runtime files', async () => {
		const files = await collectRuntimeFiles(hataigoDirectory);
		for (const file of files) {
			const source = await readFile(file, 'utf8');
			const label = relative(hataigoDirectory, file);
			expect(source, `${label} is missing copyright SPDX header`).toContain('SPDX-FileCopyrightText: Tolehata and hatasaba-project');
			expect(source, `${label} is missing license SPDX header`).toContain('SPDX-License-Identifier: AGPL-3.0-only');
		}
	});

	it('keeps rules runtime modules platform independent', async () => {
		const files = await collectRuntimeFiles(rulesDirectory);
		expect(files.length, 'rules scan must not be empty').toBeGreaterThan(0);
		for (const file of files) {
			const source = await readFile(file, 'utf8');
			const label = relative(rulesDirectory, file);
			expect(source, `${label} references browser, Vue, API, or Node runtime globals/modules`).not.toMatch(forbiddenPlatformReference);
		}
	});
	it('detects prohibited dependencies and model assets before inspecting actual files', async () => {
		const forbiddenDependency = /^(?:onnxruntime(?:-|$)|@tensorflow\/|tfjs)/i;
		const forbiddenAsset = /(?:\.onnx|\.bin(?:\.gz)?|\.weights(?:\.gz)?|network[^/]*\.gz)$/i;
		for (const name of ['onnxruntime-web', '@tensorflow/tfjs', 'tfjs-node']) expect(forbiddenDependency.test(name)).toBe(true);
		for (const name of ['model.onnx', 'net.bin.gz', 'model.weights', 'network-1.gz']) expect(forbiddenAsset.test(name)).toBe(true);
		for (const path of [resolve(process.cwd(), 'package.json'), resolve(process.cwd(), '../../package.json')]) {
			const manifest = JSON.parse(await readFile(path, 'utf8')) as { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown>; optionalDependencies?: Record<string, unknown> };
			for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies })) expect(forbiddenDependency.test(name), name).toBe(false);
		}
		let assetsExist = true;
		try { await access(assetsDirectory); } catch { assetsExist = false; }
		if (assetsExist) {
			for (const file of await collectRuntimeFiles(assetsDirectory)) expect(forbiddenAsset.test(file), file).toBe(false);
		}
	});
});
