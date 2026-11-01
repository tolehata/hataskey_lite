/* SPDX-License-Identifier: AGPL-3.0-only */
import { describe, expect, test, vi } from 'vitest';
import { QueueService } from '@/core/QueueService.js';
import { WebhookTestService } from '@/core/WebhookTestService.js';
import { UserWebhookDeliverProcessorService } from '@/queue/processors/UserWebhookDeliverProcessorService.js';
import { SystemWebhookDeliverProcessorService } from '@/queue/processors/SystemWebhookDeliverProcessorService.js';
import type { SystemWebhookDeliverJobData, UserWebhookDeliverJobData } from '@/queue/types.js';

describe.each(['user', 'system'] as const)('%s webhook delivery revocation', kind => {
	function fixture() {
		const type = kind === 'user' ? 'follow' : 'userCreated';
		const saved = { id: 'hook', userId: 'owner', active: true, isActive: true, url: 'https://old.invalid/hook', secret: 'old-secret', on: [type] };
		const state = { hook: saved as typeof saved | null };
		const repository = {
			findOneBy: vi.fn(async ({ id, userId }: { id: string; userId?: string }) => state.hook?.id === id && (userId == null || userId === state.hook.userId) ? state.hook : null),
			update: vi.fn(async () => undefined),
		};
		const send = vi.fn(async () => ({ status: 200 }));
		const config = { host: 'local.invalid', url: 'https://local.invalid' };
		const logger = { logger: { createSubLogger: () => ({ debug: vi.fn(), error: vi.fn() }) } };
		const processor = kind === 'user'
			? new UserWebhookDeliverProcessorService(config as never, repository as never, { send } as never, logger as never, { isChannelVisibleForMe: async () => true } as never)
			: new SystemWebhookDeliverProcessorService(config as never, repository as never, { send } as never, logger as never);
		const data = { webhookId: saved.id, userId: saved.userId, type, to: saved.url, secret: saved.secret, eventId: 'event', createdAt: 1, content: { user: { id: 'subject' } } };
		const process = () => processor.process({ data } as never);
		return { saved, state, repository, send, processor, data, process };
	}

	test.each(['deleted', 'disabled', 'url', 'secret', 'event'] as const)('does not send a queued event after %s changes', async change => {
		const f = fixture();
		await expect(f.process()).resolves.toBe('Success');
		f.send.mockClear();
		f.repository.update.mockClear();
		if (change === 'deleted') f.state.hook = null;
		else if (change === 'disabled') {
			f.saved.active = false;
			f.saved.isActive = false;
		} else if (change === 'url') f.saved.url = 'https://new.invalid/hook';
		else if (change === 'secret') f.saved.secret = 'new-secret';
		else f.saved.on = [];
		await expect(f.process()).resolves.toBe('Skipped: webhook is no longer authorized');
		expect(f.send).not.toHaveBeenCalled();
		expect(f.repository.update).not.toHaveBeenCalled();
	});

	test('reloads configuration after a failed attempt before retrying', async () => {
		const f = fixture();
		f.send.mockRejectedValueOnce(new Error('network unavailable'));
		await expect(f.process()).rejects.toThrow('network unavailable');
		f.saved.secret = 'rotated';
		await expect(f.process()).resolves.toBe('Skipped: webhook is no longer authorized');
		expect(f.send).toHaveBeenCalledOnce();
		expect(f.repository.findOneBy).toHaveBeenCalledTimes(2);
	});

	test('does not fall back to a captured configuration when the database fails', async () => {
		const f = fixture();
		f.repository.findOneBy.mockRejectedValueOnce(new Error('database unavailable'));
		await expect(f.process()).rejects.toThrow('database unavailable');
		expect(f.send).not.toHaveBeenCalled();
	});

	test('keeps the saved test configuration secret out of job inspection and search', async () => {
		const job = {
			id: 'job', name: 'deliver', opts: {}, timestamp: 0, stacktrace: [],
			data: { secret: 'override-secret', testConfiguration: { url: 'https://saved.invalid', secret: 'saved-secret' } },
		};
		const queue = { getJob: async () => job, getJobs: async () => [job] };
		const service = Object.create(QueueService.prototype) as QueueService;
		Object.defineProperty(service, 'getQueue', { value: () => queue, configurable: true });
		const queueType = kind === 'user' ? 'userWebhookDeliver' : 'systemWebhookDeliver';
		const inspected = await service.queueGetJob(queueType, 'job');
		expect(JSON.stringify(inspected)).not.toContain('saved-secret');
		expect(JSON.stringify(inspected)).not.toContain('override-secret');
		await expect(service.queueGetJobs(queueType, ['waiting'], 'saved-secret')).resolves.toEqual([]);
		expect(job.data.testConfiguration.secret).toBe('saved-secret');
	});

	test('retains dummy delivery to unsaved overrides for inactive, unselected events', async () => {
		const f = fixture();
		f.saved.active = false;
		f.saved.isActive = false;
		f.saved.on = [];
		const add = vi.fn(async (_name: string, data: UserWebhookDeliverJobData | SystemWebhookDeliverJobData) => ({ data }));
		const queue = Object.assign(Object.create(QueueService.prototype), { userWebhookDeliverQueue: { add }, systemWebhookDeliverQueue: { add } });
		const service = new WebhookTestService({ populateEmojis: async () => ({}) } as never,
			{ fetchWebhooks: async () => [f.saved] } as never, { fetchSystemWebhooks: async () => [f.saved] } as never, queue);
		const override = { url: 'https://unsaved.invalid/hook', secret: 'unsaved-secret' };
		if (kind === 'user') await service.testUserWebhook({ webhookId: f.saved.id, type: 'follow', override }, { id: 'owner' } as never);
		else await service.testSystemWebhook({ webhookId: f.saved.id, type: 'userCreated', override });
		expect(add).toHaveBeenCalledOnce();
		const data = add.mock.calls[0][1];
		expect(data.testConfiguration).toEqual({ url: f.saved.url, secret: f.saved.secret });
		await expect(f.processor.process({ data } as never)).resolves.toBe('Success');
		expect(f.send).toHaveBeenCalledWith(override.url, expect.objectContaining({ headers: expect.objectContaining({ 'X-Misskey-Hook-Secret': override.secret }) }));
		f.state.hook = null;
		await expect(f.processor.process({ data } as never)).resolves.toBe('Skipped: webhook is no longer authorized');
		expect(f.send).toHaveBeenCalledOnce();
	});

	if (kind === 'user') {
		test('checks the current owner before sending a queued event', async () => {
			const f = fixture();
			f.saved.userId = 'different-owner';
			await expect(f.process()).resolves.toBe('Skipped: webhook is no longer authorized');
			expect(f.send).not.toHaveBeenCalled();
		});
	}
});
