/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { UrlPreviewService } from '@/server/web/UrlPreviewService.js';

const services: UrlPreviewService[] = [];
afterEach(() => { for (const service of services.splice(0)) service.dispose(); });

function setup(admit = 1) {
	const service = new UrlPreviewService(
		{ url: 'https://local.test', mediaProxy: 'https://local.test/proxy' } as never,
		{ urlPreviewEnabled: true, urlPreviewTimeout: 999999, urlPreviewMaximumContentLength: 999999999 } as never,
		{} as never, { isKeyWordIncluded: () => false } as never,
		{ getLogger: () => ({ info: vi.fn(), succ: vi.fn(), warn: vi.fn() }) } as never,
		{ eval: vi.fn().mockResolvedValue(admit) } as never,
	);
	services.push(service);
	return service;
}

function reply() { return { code: vi.fn(), header: vi.fn() }; }

function request(url = 'https://example.test/page') { return { query: { url }, ip: '203.0.113.1' }; }

const summary = { url: 'https://example.test/page', title: 'Preview', player: { url: null }, icon: null, thumbnail: null };

describe('public preview budgets', () => {
	test('capacity rejection does not fetch or receive the one-day failure cache header', async () => {
		const service = setup(0);
		const fetch = vi.spyOn(service as any, 'fetchSummary').mockResolvedValue(summary);
		const response = reply();
		await service.handle(request() as never, response as never);
		expect(fetch).not.toHaveBeenCalled();
		expect(response.code).toHaveBeenCalledWith(429);
		expect(response.header).toHaveBeenCalledWith('Cache-Control', 'no-store');
	});

	test('concurrent identical URLs share work and an ordinary anonymous preview succeeds', async () => {
		const service = setup();
		let finish!: (value: unknown) => void;
		const fetch = vi.spyOn(service as any, 'fetchSummary').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
		const first = service.handle(request() as never, reply() as never);
		const second = service.handle(request() as never, reply() as never);
		await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
		finish(summary);
		await expect(first).resolves.toMatchObject({ title: 'Preview' });
		await expect(second).resolves.toMatchObject({ title: 'Preview' });
		expect((service as any).previewTimeout).toBe(10_000);
		expect((service as any).previewMaxBytes).toBe(10 * 1024 * 1024);
	});

	test('failed URLs are negatively cached without disabling other URLs', async () => {
		const service = setup();
		const fetch = vi.spyOn(service as any, 'fetchSummary').mockRejectedValueOnce(new Error('invalid page')).mockResolvedValue(summary);
		await service.handle(request() as never, reply() as never);
		await service.handle(request() as never, reply() as never);
		expect(fetch).toHaveBeenCalledOnce();
		await expect(service.handle(request('https://example.test/other') as never, reply() as never)).resolves.toMatchObject({ title: 'Preview' });
		expect(fetch).toHaveBeenCalledTimes(2);
	});
});
