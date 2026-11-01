/* SPDX-License-Identifier: AGPL-3.0-only */
import { Readable } from 'node:stream';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { DownloadService } from '@/core/DownloadService.js';

const download = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock('got', () => ({ default: download, HTTPError: class HTTPError extends Error {} }));

describe('download redirects select the destination security policy', () => {
	test('the caller byte budget stops a response without a Content-Length header', async () => {
		download.stream.mockImplementation(() => Readable.from([Buffer.from('small'), Buffer.alloc(64)]));
		const service = new DownloadService({ maxFileSize: 10000, userAgent: 'test' } as never,
			{ getAgentForHttp: () => ({}), getAgentForHttps: () => ({}) } as never,
			{ getLogger: () => ({ info: vi.fn(), warn: vi.fn(), succ: vi.fn() }) } as never);
		const directory = await mkdtemp(join(tmpdir(), 'hataskey-download-limit-'));
		try {
			const path = join(directory, 'file');
			await expect(service.downloadUrl('https://example.test/file', path, { maxBytes: 8 })).rejects.toMatchObject({ statusCode: 413 });
			expect((await readFile(path)).length).toBeLessThanOrEqual(8);
		} finally { await rm(directory, { recursive: true }); }
	});

	test('a proxy bypass origin does not lend its local-address agent to a redirected destination', async () => {
		const bypass = new URL('https://trusted.example/file');
		const ordinary = new URL('https://untrusted.example/file');
		const local = new URL('http://127.0.0.1/private');
		const agents = { bypassHttp: {}, bypassHttps: {}, checkedHttp: {}, checkedHttps: {} };
		const http = {
			getAgentForHttp: vi.fn((url: URL, allowLocal?: boolean) => {
				expect(allowLocal).not.toBe(true);
				return url.hostname === bypass.hostname ? agents.bypassHttp : agents.checkedHttp;
			}),
			getAgentForHttps: vi.fn((url: URL, allowLocal?: boolean) => {
				expect(allowLocal).not.toBe(true);
				return url.hostname === bypass.hostname ? agents.bypassHttps : agents.checkedHttps;
			}),
		};
		download.stream.mockImplementation((_url, options) => {
			expect(options.agent).toEqual({ http: agents.bypassHttp, https: agents.bypassHttps });
			for (const url of [ordinary, local, bypass]) {
				const redirected = { url, agent: options.agent };
				for (const hook of options.hooks.beforeRedirect) hook(redirected);
				expect(redirected.agent).toEqual(url === bypass
					? { http: agents.bypassHttp, https: agents.bypassHttps }
					: { http: agents.checkedHttp, https: agents.checkedHttps });
			}
			return Readable.from(['downloaded']);
		});
		const logger = { info: vi.fn(), warn: vi.fn(), succ: vi.fn() };
		const service = new DownloadService({ maxFileSize: 10000, userAgent: 'test' } as never, http as never, { getLogger: () => logger } as never);
		const directory = await mkdtemp(join(tmpdir(), 'hataskey-download-test-'));
		try {
			const path = join(directory, 'file');
			await expect(service.downloadUrl(bypass.href, path)).resolves.toEqual({ filename: 'file' });
			expect(await readFile(path, 'utf8')).toBe('downloaded');
			expect(http.getAgentForHttp.mock.calls.map(([url]) => url.hostname)).toEqual([bypass.hostname, ordinary.hostname, local.hostname, bypass.hostname]);
		} finally {
			await rm(directory, { recursive: true });
		}
	});
});
