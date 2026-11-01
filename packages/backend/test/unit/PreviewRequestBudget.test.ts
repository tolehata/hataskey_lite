/* SPDX-License-Identifier: AGPL-3.0-only */

import { Agent } from 'node:http';
import { Duplex } from 'node:stream';
import { summaly } from '@misskey-dev/summaly';
import got from 'got';
import { describe, expect, test, vi } from 'vitest';
import { previewRequestAgent, withPreviewRequestBudget } from '@/misc/preview-request-budget.js';
import { UrlPreviewService } from '@/server/web/UrlPreviewService.js';

// Exercise real HTTP parsing, Got and Summaly without a listener or network.
class MemorySocket extends Duplex {
	connecting = false;
	private request = '';
	constructor(private respond: (request: string, socket: MemorySocket) => void) { super(); }
	_read() { /* response bytes are pushed by the fixture */ }
	_write(chunk: Buffer, _encoding: string, callback: () => void) {
		this.request += chunk.toString();
		if (this.request.includes('\r\n\r\n')) this.respond(this.request, this);
		callback();
	}
	setTimeout() { return this; }
	setNoDelay() { return this; }
	setKeepAlive() { return this; }
	ref() { return this; }
	unref() { return this; }
}

function transport(respond: (path: string, socket: MemorySocket) => void) {
	const sockets: MemorySocket[] = [];
	const requested: string[] = [];
	const agent = new Agent({ keepAlive: false });
	agent.createConnection = () => {
		const socket = new MemorySocket((request, stream) => {
			const path = request.split(' ')[1];
			requested.push(path);
			respond(path, stream);
		});
		sockets.push(socket);
		return socket as never;
	};
	return { agent, sockets, requested };
}

function respond(socket: MemorySocket, body: string, headers = 'Content-Type: text/html\r\n') {
	socket.push(`HTTP/1.1 200 OK\r\nConnection: close\r\n${headers}Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
	socket.push(null);
}

const html = '<title>Ordinary preview</title><link rel="icon" href="/icon"><link type="application/json+oembed" href="/embed">';
const oembed = JSON.stringify({ version: '1.0', type: 'video', html: '<iframe src="https://video.example/embed/1" width="640" height="360"></iframe>' });

function preview(agent: Agent, maxBytes = 4096, timeout = 500, signal = new AbortController().signal) {
	return withPreviewRequestBudget({ maxBytes, timeout, signal }, () => summaly('http://example.test/page', {
		agent: { http: previewRequestAgent(agent) }, followRedirects: false, operationTimeout: timeout,
	}));
}

describe('preview child HTTP requests share the operation budget', () => {
	test('real Summaly preserves ordinary HTML, oEmbed and favicon retrieval', async () => {
		const wire = transport((path, socket) => respond(socket, path === '/page' ? html : path === '/embed' ? oembed : ''));
		await expect(preview(wire.agent)).resolves.toMatchObject({ title: 'Ordinary preview', player: { url: 'https://video.example/embed/1' } });
		expect(wire.requested).toContain('/embed');
		expect(wire.requested).toContain('/icon');
		expect(wire.sockets.every(socket => socket.destroyed)).toBe(true);
	});

	test('a stalled oEmbed request is aborted by the whole-preview deadline', async () => {
		const wire = transport((path, socket) => { if (path !== '/embed') respond(socket, path === '/page' ? html : ''); });
		await expect(preview(wire.agent, 4096, 80)).rejects.toThrow('Preview deadline exceeded');
		expect(wire.requested).toContain('/embed');
		expect(wire.sockets.every(socket => socket.destroyed)).toBe(true);
	});

	test('HTML and oEmbed share the site byte allowance even if Summaly catches the child failure', async () => {
		const wire = transport((path, socket) => respond(socket, path === '/page' ? html : oembed));
		await expect(preview(wire.agent, Buffer.byteLength(html) + 10)).rejects.toThrow('resource budget');
		expect(wire.requested).toContain('/embed');
	});

	test('counts chunked response bytes without trusting content-length', async () => {
		const wire = transport((_path, socket) => {
			socket.push('HTTP/1.1 200 OK\r\nConnection: close\r\nTransfer-Encoding: chunked\r\n\r\n20\r\n' + 'x'.repeat(32) + '\r\n0\r\n\r\n');
			socket.push(null);
		});
		await expect(withPreviewRequestBudget({ maxBytes: 16, timeout: 500, signal: new AbortController().signal }, () =>
			got('http://example.test/chunked', { agent: { http: previewRequestAgent(wire.agent) }, retry: { limit: 0 } }),
		)).rejects.toThrow('resource budget');
	});

	test('refuses unexpected compressed bodies before decompression', async () => {
		const wire = transport((_path, socket) => respond(socket, 'body', 'Content-Encoding: gzip\r\n'));
		await expect(preview(wire.agent)).rejects.toThrow('resource budget');
	});

	test('lease cancellation closes a child request before the operation returns', async () => {
		const controller = new AbortController();
		const wire = transport((path, socket) => {
			if (path === '/page') respond(socket, html);
			else controller.abort(new Error('lease expired'));
		});
		await expect(preview(wire.agent, 4096, 500, controller.signal)).rejects.toThrow('lease expired');
		expect(wire.sockets.every(socket => socket.destroyed)).toBe(true);
	});

	test('concurrent operations using the same agent retain independent allowances', async () => {
		const wire = transport((_path, socket) => respond(socket, 'x'.repeat(100)));
		const run = (maxBytes: number) => withPreviewRequestBudget({ maxBytes, timeout: 500, signal: new AbortController().signal }, () =>
			got('http://example.test/body', { agent: { http: previewRequestAgent(wire.agent) }, retry: { limit: 0 } }).text(),
		);
		const results = await Promise.allSettled([run(50), run(200)]);
		expect(results[0].status).toBe('rejected');
		expect(results[1]).toEqual({ status: 'fulfilled', value: 'x'.repeat(100) });
	});

	test.each([false, true])('production preview entrypoint preserves normal retrieval (summary proxy: %s)', async (proxy) => {
		const summary = { url: 'http://example.test/page', title: 'Ordinary preview', player: { url: null }, icon: null, thumbnail: null };
		const wire = transport((path, socket) => {
			if (path.startsWith('/summary?')) {
				socket.push('HTTP/1.1 302 Found\r\nLocation: http://127.0.0.2/final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
				socket.push(null);
			} else respond(socket, path === '/final' ? JSON.stringify(summary) : path === '/page' ? html : path === '/embed' ? oembed : '');
		});
		const getAgentByUrl = vi.fn((_target: URL, _bypass: boolean, _allowPrivate: boolean) => wire.agent);
		const service = new UrlPreviewService(
			{ url: 'https://local.test', mediaProxy: 'https://local.test/proxy', userAgent: 'Preview test' } as never,
			{ urlPreviewEnabled: true, urlPreviewTimeout: 500, urlPreviewMaximumContentLength: 4096, urlPreviewSummaryProxyUrl: proxy ? 'http://127.0.0.1/summary' : null } as never,
			{ httpAgent: wire.agent, httpsAgent: wire.agent, getAgentByUrl } as never,
			{ isKeyWordIncluded: () => false } as never,
			{ getLogger: () => ({ info: vi.fn(), succ: vi.fn(), warn: vi.fn() }) } as never,
			{ eval: vi.fn().mockResolvedValue(1) } as never,
		);
		try {
			await expect(service.handle({ query: { url: 'http://example.test/page' }, ip: '203.0.113.1' } as never, { header: vi.fn(), code: vi.fn() } as never)).resolves.toMatchObject({ title: 'Ordinary preview' });
			if (proxy) {
				expect(getAgentByUrl.mock.calls.map(call => [call[0].hostname, call[2]])).toEqual([['127.0.0.1', true], ['127.0.0.2', true]]);
			}
		} finally { service.dispose(); }
	});
});
