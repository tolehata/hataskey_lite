/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { TestContext } from 'vitest';

const execFileAsync = promisify(execFile);
const backendRoot = resolve(import.meta.dirname, '../../..');
const repositoryRoot = resolve(backendRoot, '../..');
const baseConfig = 'url: https://example.test\ndb: { host: localhost, port: 5432 }\nredis: { host: localhost, port: 6379, pass: "" }\n';
let directory: string;
let backendDirectory: string;
let server: Server;
let requests: string[];

beforeEach(async () => {
	directory = await mkdtemp(join('/tmp', 'hc-'));
	backendDirectory = join(directory, 'packages/backend');
	await mkdir(join(backendDirectory, 'built'), { recursive: true });
	await mkdir(join(directory, 'built'));
	await mkdir(join(directory, '.config'));
	await writeFile(join(backendDirectory, 'package.json'), '{ "type": "module" }');
	await writeFile(join(directory, 'built/meta.json'), '{ "version": "test", "basedMisskeyVersion": "test" }');
	await symlink(join(repositoryRoot, 'node_modules'), join(directory, 'node_modules'), 'dir');
	await copyFile(join(repositoryRoot, 'healthcheck.sh'), join(directory, 'healthcheck.sh'));
	// Compile the actual config loader without importing the application or
	// depending on stale build output. All tests execute the real shell and curl.
	const source = await readFile(join(backendRoot, 'src/config.ts'), 'utf8');
	const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText;
	await writeFile(join(backendDirectory, 'built/config.js'), compiled);
	requests = [];
	server = createServer((request, response) => {
		requests.push(request.url ?? '');
		response.end();
	});
});

afterEach(async () => {
	await new Promise<void>((resolve, reject) => {
		if (!server.listening) return resolve();
		server.close(error => error ? reject(error) : resolve());
	});
	await rm(directory, { recursive: true, force: true });
});

async function listen(socket?: string, context?: TestContext): Promise<number> {
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		if (socket) server.listen(socket, resolve);
		else server.listen(0, '127.0.0.1', resolve);
	}).catch((error: NodeJS.ErrnoException) => {
		if (socket && context && (error.code === 'EPERM' || error.code === 'EACCES')) {
			context.skip('This environment does not permit Unix socket binding; argument selection is tested separately');
		}
		throw error;
	});
	return socket ? 0 : (server.address() as AddressInfo).port;
}

async function writeConfig(name: string, config: string) {
	const path = join(directory, '.config', name);
	await mkdir(resolve(path, '..'), { recursive: true });
	await writeFile(path, baseConfig + config);
	return path;
}

async function probe(env: NodeJS.ProcessEnv = {}) {
	return execFileAsync('bash', [join(directory, 'healthcheck.sh')], {
		cwd: tmpdir(),
		env: {
			...process.env,
			NODE_ENV: 'production',
			CHERRYPICK_CONFIG_YML: '',
			PORT: '',
			...env,
			PATH: `${env.PATH ?? process.env.PATH}:${dirname(process.execPath)}`,
		},
		timeout: 15_000,
	});
}

describe('container healthcheck configuration', () => {
	test('parses quoted YAML ports and works outside the repository directory', async () => {
		const port = await listen();
		await writeConfig('default.yml', `port: '${port}' # a valid YAML scalar\n`);
		await expect(probe()).resolves.toMatchObject({ stdout: '', stderr: '' });
		expect(requests).toEqual(['/healthz']);
	});

	test.each([false, true])('honors CHERRYPICK_CONFIG_YML (absolute: %s)', async absolute => {
		const port = await listen();
		await writeConfig('default.yml', 'port: 1\n');
		const path = await writeConfig('custom config/server.yml', `port: ${port}\n`);
		await expect(probe({ CHERRYPICK_CONFIG_YML: absolute ? path : 'custom config/server.yml' })).resolves.toMatchObject({ stdout: '' });
		expect(requests).toEqual(['/healthz']);
	});

	test('uses test.yml in the test environment', async () => {
		const port = await listen();
		await writeConfig('default.yml', 'port: 1\n');
		await writeConfig('test.yml', `port: ${port}\n`);
		await expect(probe({ NODE_ENV: 'test' })).resolves.toMatchObject({ stdout: '' });
		expect(requests).toEqual(['/healthz']);
	});

	test('uses PORT when YAML omits the port', async () => {
		const port = await listen();
		await writeConfig('default.yml', '');
		await expect(probe({ PORT: String(port) })).resolves.toMatchObject({ stdout: '' });
		expect(requests).toEqual(['/healthz']);
	});

	test('prefers the YAML port over PORT and bypasses HTTP proxy settings', async () => {
		const port = await listen();
		await writeConfig('default.yml', `port: ${port}\n`);
		await expect(probe({ PORT: '1', http_proxy: 'http://127.0.0.1:1', ALL_PROXY: 'http://127.0.0.1:1', NO_PROXY: '', no_proxy: '' })).resolves.toMatchObject({ stdout: '' });
		expect(requests).toEqual(['/healthz']);
	});

	test.for([false, true])('probes a socket-only backend (relative: %s)', async (relative, context) => {
		const socket = join(backendDirectory, 'health check.sock');
		await listen(socket, context);
		await writeConfig('default.yml', `socket: '${relative ? 'health check.sock' : socket}'\n`);
		await expect(probe()).resolves.toMatchObject({ stdout: '' });
		expect(requests).toEqual(['/healthz']);
	});

	test('prefers the Unix socket when both socket and port are configured', async context => {
		const socket = join(backendDirectory, 'health.sock');
		await listen(socket, context);
		await writeConfig('default.yml', `socket: '${socket}'\nport: 1\n`);
		await expect(probe()).resolves.toMatchObject({ stdout: '' });
		expect(requests).toEqual(['/healthz']);
	});

	test.each([
		{ relative: false, withPort: false },
		{ relative: true, withPort: false },
		{ relative: false, withPort: true },
	])('passes the configured socket and backend working directory to curl (%j)', async ({ relative, withPort }) => {
		const socket = relative ? 'health check.sock' : join(backendDirectory, 'health check.sock');
		await writeConfig('default.yml', `socket: '${socket}'\n${withPort ? 'port: 1\n' : ''}`);
		const bin = join(directory, 'bin');
		const capture = join(directory, 'curl-arguments.json');
		await mkdir(bin);
		await writeFile(join(bin, 'curl'), `#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.HEALTHCHECK_CAPTURE, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));\n`, { mode: 0o755 });
		await expect(probe({ PATH: `${bin}:${process.env.PATH}`, HEALTHCHECK_CAPTURE: capture })).resolves.toMatchObject({ stdout: '' });
		const invocation = JSON.parse(await readFile(capture, 'utf8'));
		expect(invocation.cwd).toBe(await realpath(backendDirectory));
		expect(invocation.args).toEqual([
			'--fail', '--silent', '--show-error', '--output', '/dev/null', '--noproxy', '*', '--connect-timeout', '5', '--max-time', '10',
			'--unix-socket', socket, 'http://localhost/healthz',
		]);
	});

	test('propagates an unhealthy HTTP status as a failed probe', async () => {
		server.removeAllListeners('request');
		server.on('request', (_, response) => { response.writeHead(503).end(); });
		const port = await listen();
		await writeConfig('default.yml', `port: ${port}\n`);
		await expect(probe()).rejects.toMatchObject({ code: 22 });
	});

	test('does not fall back to default.yml when the selected file is missing', async () => {
		await writeConfig('default.yml', 'port: 1\n');
		await expect(probe({ CHERRYPICK_CONFIG_YML: 'missing.yml' })).rejects.toMatchObject({ code: 1 });
		expect(requests).toEqual([]);
	});
});
