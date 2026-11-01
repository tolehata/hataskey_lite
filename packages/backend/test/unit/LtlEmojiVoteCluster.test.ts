/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { fork } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { describe, expect, test } from 'vitest';

// 本番3モジュールの型だけを除き、独立したNode clusterへ読み込む。DB/Redis/HTTP/ポートは使用しない。
const runner = `
import cluster from 'node:cluster';
import { ltlEmojiVoteStore, startLtlEmojiVoteCoordinator, stopLtlEmojiVoteCoordinator } from './ltl-emoji-vote-ipc.mjs';
const mode = process.env.LTL_EMOJI_VOTE_TEST_MODE;
process.on('SIGTERM', () => {
 for (const worker of Object.values(cluster.workers ?? {})) worker?.kill();
 process.exit(1);
});
if (cluster.isPrimary) {
 if (mode !== 'unavailable') startLtlEmojiVoteCoordinator();
 const now = Date.now();
 await ltlEmojiVoteStore.start({noteId:'round1',createdAt:now,requestedAt:now,candidates:[{id:'e0',name:'emoji0',url:'https://media.example/e0.webp',isSensitive:false}]});
 const jobs = Array.from({length:2}, () => new Promise((resolve,reject) => {
  const worker=cluster.fork();
  let finished=false;
  worker.on('message', message => {
   if (message?.type === 'ltl-test-result') {finished=true;resolve(message);}
  });
  worker.on('error', reject);
  worker.on('exit', () => {if(!finished)reject(new Error('Worker exited before its result'));});
 }));
 try {
  const workers=await Promise.all(jobs);
  const beforeClear=await ltlEmojiVoteStore.read('voter');
  stopLtlEmojiVoteCoordinator();
  const afterClear=await ltlEmojiVoteStore.read('voter');
  process.send({workers,beforeClear,afterClear});
  cluster.disconnect(() => process.exit(0));
 } catch {
  for(const worker of Object.values(cluster.workers ?? {}))worker?.kill();
  process.exit(1);
 }
} else {
 const result={type:'ltl-test-result'};
 try {result.vote=await ltlEmojiVoteStore.vote('round1','voter','e0');} catch(error) {result.voteError=error.message;}
 try {result.read=await ltlEmojiVoteStore.read('voter');} catch(error) {result.readError=error.message;}
 process.send(result, () => process.exit(0));
}
`;

async function runCluster(mode: 'shared' | 'unavailable'): Promise<{
	workers: { vote?: string; voteError?: string; read?: { choice: unknown }; readError?: string }[];
	beforeClear: { counts: number[]; choice: unknown };
	afterClear: { metadata: unknown; counts: number[]; choice: unknown };
}> {
	const directory = await mkdtemp(join(tmpdir(), 'ltl-emoji-vote-ipc-test-'));
	try {
		for (const name of ['ltl-emoji-vote', 'ltl-emoji-vote-state', 'ltl-emoji-vote-ipc']) {
			const source = await readFile(join(process.cwd(), 'src/core', `${name}.ts`), 'utf8');
			const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 } }).outputText;
			await writeFile(join(directory, `${name}.mjs`), compiled.replace(/@\/core\/(ltl-emoji-vote(?:-state|-ipc)?)\.js/g, './$1.mjs'));
		}
		const entry = join(directory, 'runner.mjs');
		await writeFile(entry, runner);
		return await new Promise((resolve, reject) => {
			const child = fork(entry, [], { silent: true, env: { ...process.env, LTL_EMOJI_VOTE_TEST_MODE: mode }, execArgv: [] });
			let result: Parameters<typeof resolve>[0] | undefined;
			const timeout = setTimeout(() => { child.kill(); reject(new Error('Cluster fixture timed out')); }, 5000);
			child.on('message', message => { result = message as Parameters<typeof resolve>[0]; });
			child.on('error', error => { clearTimeout(timeout); reject(error); });
			child.on('exit', code => {
				clearTimeout(timeout);
				if (code === 0 && result) resolve(result);
				else reject(new Error(`Cluster fixture exited ${code}`));
			});
		});
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

describe('LTL emoji vote real Node cluster', () => {
	test('serializes the same voter from two real HTTP-like workers into one primary memory state', async () => {
		const result = await runCluster('shared');
		expect(result.workers.map(worker => worker.vote).sort()).toEqual(['ALREADY_VOTED', 'OK']);
		expect(result.workers.every(worker => worker.read?.choice != null)).toBe(true);
		expect(result.beforeClear.counts).toEqual([1]);
		expect(result.afterClear).toMatchObject({ metadata: null, counts: [], choice: null });
	}, 10_000);

	test('reports unavailable coordination as errors, preserving the difference from an empty round', async () => {
		const result = await runCluster('unavailable');
		for (const worker of result.workers) {
			expect(worker).toMatchObject({ voteError: 'Emoji vote coordinator unavailable', readError: 'Emoji vote coordinator unavailable' });
			expect(worker).not.toHaveProperty('read');
			expect(worker).not.toHaveProperty('vote');
		}
		expect(result.beforeClear).toMatchObject({ counts: [0], choice: null });
	}, 10_000);
});
