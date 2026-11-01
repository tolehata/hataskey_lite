/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const sameBytes = (first: Buffer, second: Buffer) => first.equals(second);

test('rule parity detector rejects a modified copy before checking all five canonical files', async () => {
	const positive = Buffer.from('canonical source\n');
	expect(sameBytes(positive, Buffer.from('canonical source\nchanged\n'))).toBe(false);
	for (const filename of ['board.ts', 'handicap.ts', 'game.ts', 'score.ts', 'sgf.ts']) {
		const frontend = await readFile(resolve(process.cwd(), '../frontend/src/utility/hataigo/rules', filename));
		const backend = await readFile(resolve(process.cwd(), 'src/misc/hataigo/rules', filename));
		expect(sameBytes(frontend, backend), `${filename} must be an exact canonical byte copy`).toBe(true);
	}
});
