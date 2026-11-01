/* SPDX-License-Identifier: AGPL-3.0-only */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Agent, ClientRequest, IncomingMessage } from 'node:http';

type Budget = {
	controller: AbortController;
	remaining: number;
	requests: Map<ClientRequest, Promise<void>>;
};

const context = new AsyncLocalStorage<Budget>();
const agents = new WeakMap<Agent, Agent>();

// Summaly shares its agents globally and does not forward options to oEmbed or
// favicon requests. Resolve the budget from the async operation, not the agent,
// so concurrent previews and every redirect/child request keep their own limit.
export function previewRequestAgent<T extends Agent>(agent: T): T {
	const cached = agents.get(agent);
	if (cached) return cached as T;
	const guarded = new Proxy(agent, {
		get(target, property) {
			if (property !== 'addRequest') return Reflect.get(target, property, target);
			return (request: ClientRequest, ...args: unknown[]) => {
				const budget = context.getStore();
				if (!budget) throw new Error('Preview request has no resource budget');
				budget.controller.signal.throwIfAborted();
				// Count decoded bytes without letting a compressed response inflate
				// inside a library whose subsidiary request limits cannot be set.
				request.setHeader('accept-encoding', 'identity');
				budget.requests.set(request, new Promise<void>(resolve => {
					request.once('close', () => { budget.requests.delete(request); resolve(); });
				}));
				request.prependOnceListener('response', (response: IncomingMessage) => {
					if (request.method === 'HEAD') return;
					const encoding = response.headers['content-encoding'];
					const length = Number(response.headers['content-length']);
					if ((encoding && encoding.toLowerCase() !== 'identity') || length > budget.remaining) {
						budget.controller.abort(new Error('Preview response exceeds its resource budget'));
						return;
					}
					response.on('data', (chunk: Buffer) => {
						budget.remaining -= chunk.length;
						if (budget.remaining < 0) budget.controller.abort(new Error('Preview response exceeds its resource budget'));
					});
				});
				const addRequest = Reflect.get(target, 'addRequest', target) as (request: ClientRequest, ...args: unknown[]) => void;
				return Reflect.apply(addRequest, target, [request, ...args]);
			};
		},
	});
	agents.set(agent, guarded);
	return guarded;
}

export async function withPreviewRequestBudget<T>(options: {
	maxBytes: number;
	timeout: number;
	signal: AbortSignal;
}, work: () => Promise<T>): Promise<T> {
	const controller = new AbortController();
	const budget: Budget = { controller, remaining: options.maxBytes, requests: new Map() };
	const cancel = () => controller.abort(options.signal.reason);
	const destroy = () => {
		for (const request of budget.requests.keys()) request.destroy(controller.signal.reason);
	};
	controller.signal.addEventListener('abort', destroy, { once: true });
	options.signal.addEventListener('abort', cancel, { once: true });
	const timer = setTimeout(() => controller.abort(new Error('Preview deadline exceeded')), options.timeout);
	timer.unref();
	try {
		if (options.signal.aborted) cancel();
		controller.signal.throwIfAborted();
		const result = await context.run(budget, work);
		controller.signal.throwIfAborted();
		return result;
	} finally {
		clearTimeout(timer);
		options.signal.removeEventListener('abort', cancel);
		controller.abort(new Error('Preview completed'));
		// Keep the shared admission lease until the actual requests are closed.
		await Promise.all(budget.requests.values());
	}
}
