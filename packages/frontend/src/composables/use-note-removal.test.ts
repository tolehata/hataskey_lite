/* SPDX-License-Identifier: AGPL-3.0-only */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { useNoteRemoval } from './use-note-removal.js';

const settings = vi.hoisted(() => ({ animation: true }));
vi.mock('@/preferences.js', () => ({ prefer: { s: settings } }));

const cleanups: (() => void)[] = [];

function deferred() {
	let resolve!: () => void;
	let reject!: (reason: Error) => void;
	const finished = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
	return { finished, resolve, reject };
}

function mountRemoval() {
	const list = window.document.createElement('div');
	const row = window.document.createElement('article');
	const sibling = window.document.createElement('article');
	row.dataset.noteRemovalId = 'wrapper';
	sibling.dataset.noteRemovalId = 'other';
	row.style.overflow = 'visible';
	row.style.minHeight = '20px';
	row.style.boxSizing = 'content-box';
	row.style.marginBottom = '8px';
	row.inert = false;
	list.style.rowGap = '12px';
	list.append(row, sibling);
	window.document.body.append(list);
	Object.defineProperty(row, 'offsetHeight', { configurable: true, value: 80 });
	const host = window.document.createElement('div');
	window.document.body.append(host);
	let removal!: ReturnType<typeof useNoteRemoval>;
	const app = createApp({ setup() {
		removal = useNoteRemoval(() => list);
		return () => h('span');
	} });
	app.mount(host);
	let mounted = true;
	const unmount = () => {
		if (!mounted) return;
		app.unmount();
		host.remove();
		list.remove();
		mounted = false;
	};
	cleanups.push(unmount);
	return { list, row, sibling, removal, unmount };
}

function animateRow(row: HTMLElement) {
	const completion = deferred();
	const cancel = vi.fn();
	const animate = vi.fn(() => ({ finished: completion.finished, cancel }) as unknown as Animation);
	Object.defineProperty(row, 'animate', { configurable: true, value: animate });
	return { ...completion, animate, cancel };
}

async function settle() {
	await Promise.resolve();
	await nextTick();
	await Promise.resolve();
}

beforeEach(() => {
	settings.animation = true;
	vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
});

afterEach(() => {
	cleanups.splice(0).reverse().forEach(cleanup => cleanup());
	vi.unstubAllGlobals();
});

describe('useNoteRemoval', () => {
	it('shrinks only the matching direct row, then commits once and restores its interaction state', async () => {
		const view = mountRemoval();
		const animation = animateRow(view.row);
		const commit = vi.fn(() => view.row.remove());
		view.removal.remove('wrapper', commit);
		view.removal.removeElement('wrapper', view.row, commit);
		expect(animation.animate).toHaveBeenCalledTimes(1);
		expect(animation.animate).toHaveBeenCalledWith(
		[expect.objectContaining({ height: '80px', marginBottom: '8px' }), expect.objectContaining({ height: '0px', marginBottom: '-12px', opacity: '0' })],
		expect.objectContaining({ duration: 260, fill: 'forwards' }),
		);
		expect(commit).not.toHaveBeenCalled();
		expect(view.row.isConnected).toBe(true);
		expect(view.sibling.isConnected).toBe(true);
		expect(view.row.inert).toBe(true);
		expect(view.row.hasAttribute('data-note-removal-pending')).toBe(true);
		expect(view.row.style.overflow).toBe('hidden');
		animation.resolve();
		await settle();
		expect(commit).toHaveBeenCalledTimes(1);
		expect(view.sibling.isConnected).toBe(true);
		expect(animation.cancel).toHaveBeenCalledTimes(1);
		expect(view.row.inert).toBe(false);
		expect(view.row.hasAttribute('data-note-removal-pending')).toBe(false);
		expect(view.row.style.overflow).toBe('visible');
		expect(view.row.style.minHeight).toBe('20px');
		expect(view.row.style.boxSizing).toBe('content-box');
	});

	it.each(['disabled', 'reduced motion', 'missing row', 'zero height', 'no animation API'] as const)(
		'commits immediately for %s', reason => {
			const view = mountRemoval();
			const animation = animateRow(view.row);
			if (reason === 'disabled') settings.animation = false;
			if (reason === 'reduced motion') vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
			if (reason === 'zero height') Object.defineProperty(view.row, 'offsetHeight', { configurable: true, value: 0 });
			if (reason === 'no animation API') Object.defineProperty(view.row, 'animate', { configurable: true, value: undefined });
			const commit = vi.fn();
			view.removal.remove(reason === 'missing row' ? 'absent' : 'wrapper', commit);
			expect(commit).toHaveBeenCalledTimes(1);
			expect(animation.animate).not.toHaveBeenCalled();
		});

	it('commits and restores the row if the animation rejects', async () => {
		const view = mountRemoval();
		const animation = animateRow(view.row);
		const commit = vi.fn();
		view.removal.remove('wrapper', commit);
		animation.reject(new Error('animation failed'));
		await settle();
		expect(commit).toHaveBeenCalledTimes(1);
		expect(animation.cancel).toHaveBeenCalledTimes(1);
		expect(view.row.inert).toBe(false);
		expect(view.row.hasAttribute('data-note-removal-pending')).toBe(false);
		expect(view.row.style.overflow).toBe('visible');
	});

	it.each(['cancelAll', 'unmount'] as const)('%s cancels an in-flight removal without committing', async action => {
		const view = mountRemoval();
		const animation = animateRow(view.row);
		const commit = vi.fn();
		view.removal.remove('wrapper', commit);
		if (action === 'cancelAll') view.removal.cancelAll();
		else view.unmount();
		expect(animation.cancel).toHaveBeenCalledTimes(1);
		expect(view.row.inert).toBe(false);
		expect(view.row.style.overflow).toBe('visible');
		animation.resolve();
		await settle();
		expect(commit).not.toHaveBeenCalled();
	});

	it('deleting both rows collapses the single gap only once', async () => {
		const view = mountRemoval();
		Object.defineProperty(view.sibling, 'offsetHeight', { configurable: true, value: 60 });
		const first = animateRow(view.row);
		const second = animateRow(view.sibling);
		const commitFirst = vi.fn(() => view.row.remove());
		const commitSecond = vi.fn(() => view.sibling.remove());
		view.removal.remove('wrapper', commitFirst);
		view.removal.remove('other', commitSecond);
		expect(first.animate).toHaveBeenCalledTimes(1);
		expect(second.animate).toHaveBeenCalledTimes(1);
		expect(first.animate).toHaveBeenCalledWith(
			[expect.anything(), expect.objectContaining({ height: '0px', marginBottom: '-12px' })], expect.anything(),
		);
		expect(second.animate).toHaveBeenCalledWith(
			[expect.anything(), expect.objectContaining({ height: '0px', marginBottom: '0px' })], expect.anything(),
		);
		expect(commitFirst).not.toHaveBeenCalled();
		expect(commitSecond).not.toHaveBeenCalled();
		first.resolve();
		second.resolve();
		await settle();
		expect(commitFirst).toHaveBeenCalledTimes(1);
		expect(commitSecond).toHaveBeenCalledTimes(1);
	});

	it('ignores an old completion after cancellation and restart with the same ID', async () => {
		const view = mountRemoval();
		const first = animateRow(view.row);
		const firstCommit = vi.fn();
		view.removal.remove('wrapper', firstCommit);
		view.removal.cancelAll();
		expect(first.cancel).toHaveBeenCalledTimes(1);
		const second = animateRow(view.row);
		const secondCommit = vi.fn(() => view.row.remove());
		view.removal.remove('wrapper', secondCommit);
		expect(second.animate).toHaveBeenCalledTimes(1);
		first.resolve();
		await settle();
		expect(firstCommit).not.toHaveBeenCalled();
		expect(secondCommit).not.toHaveBeenCalled();
		expect(second.cancel).not.toHaveBeenCalled();
		expect(view.row.hasAttribute('data-note-removal-pending')).toBe(true);
		second.resolve();
		await settle();
		expect(secondCommit).toHaveBeenCalledTimes(1);
		expect(second.cancel).toHaveBeenCalledTimes(1);
	});
});
