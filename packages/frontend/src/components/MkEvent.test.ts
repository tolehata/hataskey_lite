/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import type * as Misskey from 'cherrypick-js';
import MkEvent from './MkEvent.vue';

vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	_event: {
		startDateTime: 'Start', endDateTime: 'End', doorTime: 'Doors', location: 'Location',
		organizer: 'Organizer', audience: 'Audience', language: 'Language', ageRange: 'Age',
		performers: 'Performers', ticketsUrl: 'Tickets', isFree: 'Free', price: 'Price',
		availability: 'Availability', from: 'From', until: 'Until', keywords: 'Keywords',
	},
	yes: 'Yes',
} } }));

function eventNote(metadata: Record<string, unknown>): Misskey.entities.Note {
	return {
		id: 'event-note',
		event: { title: 'Concert', start: '2026-10-03T09:00:00.000Z', end: null, metadata },
	} as unknown as Misskey.entities.Note;
}

const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });

async function mount(initial: Misskey.entities.Note | null) {
	const note = ref(initial);
	const host = window.document.createElement('div');
	window.document.body.append(host);
	const app = createApp({ render: () => h(MkEvent, { note: note.value }) });
	app.component('MkTime', { template: '<time />' });
	app.mount(host);
	cleanups.push(() => { app.unmount(); host.remove(); });
	await nextTick();
	return { host, note };
}

function valueFor(host: HTMLElement, label: string): HTMLElement | null {
	const key = [...host.querySelectorAll('dt')].find(element => element.textContent === label);
	return key?.nextElementSibling as HTMLElement | null ?? null;
}

describe('MkEvent URL rendering', () => {
	for (const field of ['url', 'offers.url'] as const) {
		const label = field === 'url' ? 'URL' : 'Tickets';
		const metadataWith = (value: unknown): Record<string, unknown> => field === 'url' ? { url: value } : { offers: { url: value } };

		test(`${field} links ordinary absolute web URLs and keeps the original label`, async () => {
			const { host, note } = await mount(eventNote(metadataWith('https://example.org/tickets?q=1#seats')));
			let row = valueFor(host, label)!;
			expect(row.querySelector('a')?.getAttribute('href')).toBe('https://example.org/tickets?q=1#seats');
			expect(row.querySelector('a')?.textContent).toBe('https://example.org/tickets?q=1#seats');
			expect(row.querySelector('a')?.hasAttribute('target')).toBe(false);
			note.value = eventNote(metadataWith('HTTP://example.org'));
			await nextTick();
			row = valueFor(host, label)!;
			expect(row.querySelector('a')?.getAttribute('href')).toBe('http://example.org/');
			expect(row.querySelector('a')?.textContent).toBe('HTTP://example.org');
		});

		test(`${field} displays dangerous or nonabsolute URLs without a link`, async () => {
			const { host, note } = await mount(eventNote(metadataWith('javascript:<img src=x>')));
			const unsafe = [
				'javascript:<img src=x>', 'JaVaScRiPt:alert(1)', ' \u0000\tjavascript:alert(1)',
				'java\tscript:alert(1)', 'java\nscript:alert(1)', 'java\rscript:alert(1)',
				'data:text/html,<script>alert(1)</script>', 'file:///tmp/event', 'vbscript:msgbox(1)',
				'//example.org/tickets', '/tickets', 'example.org/tickets', 'https://[invalid',
			];
			for (const url of unsafe) {
				note.value = eventNote(metadataWith(url));
				await nextTick();
				const row = valueFor(host, label)!;
				expect(row.querySelector('a'), url).toBeNull();
				expect(row.textContent, url).toBe(url);
				expect(row.querySelector('img, script'), url).toBeNull();
			}
		});

		test(`${field} does not coerce nonstrings into links`, async () => {
			const { host, note } = await mount(eventNote(metadataWith(42)));
			for (const value of [42, true, ['https://example.org'], { href: 'https://example.org' }, null]) {
				note.value = eventNote(metadataWith(value));
				await nextTick();
				expect(host.querySelector('a'), String(value)).toBeNull();
			}
		});
	}

	test('URL fields are independent and react to metadata and note changes', async () => {
		const { host, note } = await mount(eventNote({ url: 'https://example.org/event', offers: { url: 'javascript:alert(1)' } }));
		expect(valueFor(host, 'URL')?.querySelector('a')?.getAttribute('href')).toBe('https://example.org/event');
		expect(valueFor(host, 'Tickets')?.querySelector('a')).toBeNull();

		const metadata = note.value!.event!.metadata;
		metadata.url = 'javascript:alert(1)';
		metadata.offers = { url: 'https://example.org/tickets' };
		await nextTick();
		expect(valueFor(host, 'URL')?.querySelector('a')).toBeNull();
		expect(valueFor(host, 'Tickets')?.querySelector('a')?.getAttribute('href')).toBe('https://example.org/tickets');

		note.value = eventNote({ url: 'https://example.org/new', offers: { url: 'data:text/html,x' } });
		await nextTick();
		expect(valueFor(host, 'URL')?.querySelector('a')?.getAttribute('href')).toBe('https://example.org/new');
		expect(valueFor(host, 'Tickets')?.querySelector('a')).toBeNull();
	});

	test('missing fields, malformed offers containers, and a null note render safely', async () => {
		const { host, note } = await mount(eventNote({}));
		expect(valueFor(host, 'URL')).toBeNull();
		expect(valueFor(host, 'Tickets')).toBeNull();
		for (const offers of [null, 'tickets', 42, []]) {
			note.value = eventNote({ offers });
			await nextTick();
			expect(valueFor(host, 'Tickets')).toBeNull();
		}
		note.value = null;
		await nextTick();
		expect(host.textContent).toBe('');
	});
});
