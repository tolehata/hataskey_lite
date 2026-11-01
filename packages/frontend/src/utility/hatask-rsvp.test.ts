/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { describe, expect, test, vi } from 'vitest';

const parsed = parse(readFileSync(`${process.cwd()}/src/pages/hatask.vue`, 'utf8'));
if (!parsed.descriptor.scriptSetup) throw new Error('Missing Hatask setup script');
const script = ts.createSourceFile('hatask.ts', parsed.descriptor.scriptSetup.content, ts.ScriptTarget.Latest, true);
type Status = 'going' | 'maybe' | 'declined';

function fixture(initialStatus: Status | null = null) {
	const names = ['plannerEventServerId', 'sharedEventData', 'sharedRsvpResponses', 'sharedRsvpMyStatus', 'setRsvp', 'isRsvpSaving'];
	const functions = script.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? '')).map(node => node.getText(script)).join('\n');
	const code = ts.transpileModule(`${functions}\n({setRsvp})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
	const sharedEvents = { value: ['server-1', 'server-2'].map(id => ({ id, rsvp: true, rsvpClosed: false, rsvpResponses: initialStatus ? [{ userId: 'me', status: initialStatus }] : [] as { userId: string; status: Status }[] })) };
	const saving = { value: [] as string[] };
	const readOnly = { value: false };
	const api = vi.fn().mockResolvedValue({});
	const reload = vi.fn(async () => {});
	const toast = vi.fn();
	const runtime = runInNewContext(code, {
		events: { value: [{ id: 'local-1', serverEventId: 'server-1' }] }, sharedEvents,
		$i: { id: 'me' }, rsvpSavingIds: saving, plannerReadOnly: readOnly,
		misskeyApi: api, loadSharedEvents: reload, os: { toast }, copy: {}, console: { error: vi.fn() },
	}) as { setRsvp: (eventId: string, status: Status) => Promise<void> };
	return { ...runtime, api, reload, toast, saving, readOnly, sharedEvents };
}

describe('Hataskの参加回答の送信', () => {
	test.each<Status>(['going', 'maybe', 'declined'])('同じ回答 %s は再送しない', async status => {
		const f = fixture(status);
		await f.setRsvp('local-1', status);
		expect(f.api).not.toHaveBeenCalled();
		expect(f.reload).not.toHaveBeenCalled();
		expect(f.toast).not.toHaveBeenCalled();
	});

	test('連打とローカルID・サーバーIDの併用でも同じ予定への通信を重ねない', async () => {
		const f = fixture();
		let finish!: () => void;
		f.api.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
		const first = f.setRsvp('local-1', 'going');
		const second = f.setRsvp('server-1', 'maybe');
		const third = f.setRsvp('local-1', 'declined');
		expect(f.api).toHaveBeenCalledTimes(1);
		expect(f.api).toHaveBeenCalledWith('hatask/events/rsvp', { eventId: 'server-1', status: 'going' });
		finish();
		await Promise.all([first, second, third]);
		expect(f.saving.value).toEqual([]);
	});

	test('集計の再取得が終わるまで送信を止め、別の予定への回答は妨げない', async () => {
		const f = fixture();
		let finish!: () => void;
		f.reload.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
		const first = f.setRsvp('local-1', 'going');
		await Promise.resolve();
		await f.setRsvp('server-1', 'maybe');
		await f.setRsvp('server-2', 'declined');
		expect(f.api).toHaveBeenCalledTimes(2);
		finish(); await first;
		expect(f.saving.value).toEqual([]);
	});

	test('送信失敗後に再試行でき、成功後は別の回答へ変更できる', async () => {
		const f = fixture();
		f.api.mockRejectedValueOnce(new Error('offline'));
		await f.setRsvp('local-1', 'going');
		expect(f.saving.value).toEqual([]);
		await f.setRsvp('local-1', 'going');
		f.sharedEvents.value[0].rsvpResponses = [{ userId: 'me', status: 'going' }];
		await f.setRsvp('local-1', 'maybe');
		expect(f.api).toHaveBeenCalledTimes(3);
		expect(f.api.mock.calls[2][1]).toMatchObject({ status: 'maybe' });
	});

	test('読取専用・受付終了・参加確認なしでは送信しない', async () => {
		const f = fixture();
		f.readOnly.value = true;
		await f.setRsvp('local-1', 'going');
		f.readOnly.value = false;
		f.sharedEvents.value[0].rsvpClosed = true;
		await f.setRsvp('local-1', 'going');
		f.sharedEvents.value[0].rsvpClosed = false;
		f.sharedEvents.value[0].rsvp = false;
		await f.setRsvp('local-1', 'going');
		expect(f.api).not.toHaveBeenCalled();
	});
});
