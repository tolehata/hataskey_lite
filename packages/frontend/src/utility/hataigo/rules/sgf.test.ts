/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_SGF_LIMITS, readSgf, writeSgf } from './sgf.js';
import type { SgfErrorCode, SgfTree } from './sgf.js';

// All positions and comments in these fixtures were authored for these tests.
function read(source: string): SgfTree[] {
	const result = readSgf(source);
	if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
	return result.trees;
}

function write(trees: SgfTree | SgfTree[], includeComments = true): string {
	const result = writeSgf(trees, { includeComments });
	if (!result.ok) throw new Error(result.error.message);
	return result.value;
}

function rejects(source: unknown, code: SgfErrorCode): void {
	const result = readSgf(source);
	expect(result.ok).toBe(false);
	if (!result.ok) expect(result.error.code).toBe(code);
}

function nested(depth: number): string {
	return '(;SZ[9]'.concat('(;W[]'.repeat(depth - 1), ')'.repeat(depth));
}

describe('HataIgo SGF reader and writer', () => {
	it('reads metadata, handicap setup, moves and two collections', () => {
		const trees = read('(;FF[4]GM[1]CA[UTF-8]SZ[13]KM[0]HA[2]AB[jd][dj]PB[黒の練習]PW[白の練習]RU[Japanese]RE[W+0.5]DT[2026-10-19];W[gg];B[])(;SZ[9];B[aa])');
		expect(trees).toHaveLength(2);
		expect(trees[0].sequence[0].properties).toMatchObject({ SZ: ['13'], KM: ['0'], HA: ['2'], AB: ['jd', 'dj'], PB: ['黒の練習'], PW: ['白の練習'], RU: ['Japanese'], RE: ['W+0.5'], DT: ['2026-10-19'] });
		expect(trees[0].sequence[1].properties.W).toEqual(['gg']);
		expect(trees[0].sequence[2].properties.B).toEqual(['']);
		expect(trees[1].sequence[1].properties.B).toEqual(['aa']);
	});

	it('normalizes omitted root defaults and allows empty nodes', () => {
		const tree = read('(;;B[aa])')[0];
		expect(tree.sequence[0].properties).toEqual({ FF: ['4'], GM: ['1'], CA: ['UTF-8'], SZ: ['19'], RU: ['Japanese'] });
	});

	it('retains every variation and round trips structurally including comments', () => {
		const trees = read('(;SZ[9]C[root];B[aa](;W[ab]C[first];B[bb](;W[])(;W[cc]))(;W[ba]C[second](;B[bc])(;B[cb])))');
		expect(trees[0].variations).toHaveLength(2);
		expect(trees[0].variations[0].variations).toHaveLength(2);
		expect(read(write(trees))).toEqual(trees);
	});

	it('round trips brackets, backslashes, Japanese, emoji and syntax in comments', () => {
		const trees = read(String.raw`(;SZ[9]C[閉じる\] と \\ と [ と (;B[aa\] 日本語🌸])`);
		expect(trees[0].sequence[0].properties.C).toEqual(['閉じる] と \\ と [ と (;B[aa] 日本語🌸']);
		expect(read(write(trees))).toEqual(trees);
	});

	it('normalizes SGF Text and SimpleText whitespace and removes soft line breaks', () => {
		const tree = read('(;SZ[9]PB[黒\r\nの\t名前]C[一\r\n二\n\r三\r四\n五\t六\\\r\n七])')[0];
		expect(tree.sequence[0].properties.PB).toEqual(['黒 の 名前']);
		expect(tree.sequence[0].properties.C).toEqual(['一\n二\n三\n四\n五 六七']);
		expect(read(write(tree))[0]).toEqual(tree);
	});

	it('strips comments from the root, sequence and nested variations by default', () => {
		const trees = read('(;SZ[9]C[private-root];B[]C[private-main](;W[]C[private-a](;B[]C[private-b]))(;W[aa]C[private-c]))');
		const original = JSON.stringify(trees);
		const result = writeSgf(trees);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).not.toContain('C[');
		expect(result.value).not.toContain('private');
		expect(JSON.stringify(trees)).toBe(original);
		expect(read(result.value)[0].variations).toHaveLength(2);
	});

	it('writes canonical FF4 UTF-8 Japanese headers and empty passes', () => {
		const trees = read('(;FF[3]SZ[19]RU[Chinese];B[tt];W[])');
		expect(trees[0].sequence[0].properties.RU).toEqual(['Chinese']);
		const output = write(trees);
		expect(output).toContain('FF[4]');
		expect(output).toContain('CA[UTF-8]');
		expect(output).toContain('RU[Japanese]');
		expect(output).toContain(';B[];W[]');
		expect(output).not.toContain('tt');
		expect(trees[0].sequence[0].properties.RU).toEqual(['Chinese']);
	});

	it.each([9, 13, 19])('reads historical tt passes for %i lines', size => {
		const trees = read(`(;FF[3]SZ[${size}];B[tt];W[tt])`);
		expect(trees[0].sequence.slice(1).map(node => node.properties)).toEqual([{ B: [''] }, { W: [''] }]);
		expect(read(write(trees))).toEqual(trees);
	});

	it('also reads the backward compatible FF4 tt pass', () => {
		expect(read('(;FF[4]SZ[9];W[tt])')[0].sequence[1].properties.W).toEqual(['']);
	});

	it('expands and sorts setup rectangles while preserving both colors and erasure', () => {
		const trees = read('(;SZ[9]AB[aa:bb][cc]AW[dd:ed];AE[aa]PL[W])');
		expect(trees[0].sequence[0].properties.AB).toEqual(['aa', 'ba', 'ab', 'bb', 'cc']);
		expect(trees[0].sequence[0].properties.AW).toEqual(['dd', 'ed']);
		expect(trees[0].sequence[1].properties).toEqual({ AE: ['aa'], PL: ['W'] });
		expect(read(write(trees))).toEqual(trees);
	});

	it('preserves unknown uppercase properties and all their values', () => {
		const trees = read('(;SZ[9]XX[first][second];B[aa]ZZ[extra])');
		expect(read(write(trees))).toEqual(trees);
	});

	it('decodes UTF-8 bytes with a BOM and accepts a string BOM', () => {
		const text = '\uFEFF(;CA[UTF-8]SZ[9]PB[日本語🌸])';
		expect(readSgf(new TextEncoder().encode(text))).toEqual(readSgf(text));
	});

	it.each(['ISO-8859-1', 'Shift_JIS', 'UTF-16'])('rejects declared %s instead of returning mojibake', encoding => {
		rejects(`(;SZ[9]CA[${encoding}]C[text])`, 'unsupportedEncoding');
	});

	it('rejects malformed UTF-8 byte sequences and unpaired Unicode surrogates', () => {
		rejects(new Uint8Array([40, 59, 67, 91, 0xc3, 0x28, 93, 41]), 'unsupportedEncoding');
		rejects('(;C[\ud800])', 'unsupportedEncoding');
	});

	it.each([null, undefined, 7, {}, [], true])('rejects runtime non-text input %s without throwing', input => {
		expect(() => readSgf(input)).not.toThrow();
		rejects(input, 'invalidInput');
	});

	it.each(['', '()', '(())', ';B[aa]', '(;B[aa]', '(;B[aa]))', '(;B[aa])junk', '(;B[aa](;W[bb]);B[cc])', '(;B)', '(;C[unterminated)', '(;C[escape\\', '(;lower[value])', '(;B[aa][bb])', '(;C[a]C[b])'])('rejects malformed SGF %s without throwing', input => {
		expect(() => readSgf(input)).not.toThrow();
		expect(readSgf(input).ok).toBe(false);
	});

	it.each(['(;GM[2])', '(;FF[2])', '(;SZ[10])', '(;SZ[9:13])', '(;SZ[0])', '(;SZ[NaN])'])('rejects unsupported game, format or size: %s', source => {
		expect(readSgf(source).ok).toBe(false);
	});

	it.each(['(;SZ[9];B[jj])', '(;SZ[19];W[zz])', '(;SZ[9];B[a])', '(;SZ[9];W[AA])', '(;SZ[9]AB[])', '(;SZ[9]AB[aa:jj])', '(;SZ[9]AB[bb:aa])', '(;SZ[9]AB[aa][aa])', '(;SZ[9]AB[aa]AW[aa])', '(;SZ[9]AB[aa:bb][bb])', '(;SZ[9];B[aa]W[bb])', '(;SZ[9];B[aa]AB[bb])', '(;SZ[9];W[aa]PL[B])', '(;SZ[9];SZ[13])', '(;SZ[9](;CA[UTF-8]))', '(;SZ[9]KM[NaN])', '(;SZ[9]HA[-1])', '(;SZ[9]HA[82])', '(;SZ[9]PL[X])'])('rejects invalid property semantics: %s', source => {
		rejects(source, 'invalidProperty');
	});

	it('enforces byte counts in UTF-8 rather than UTF-16', () => {
		const input = '(;C[🌸])';
		const bytes = new TextEncoder().encode(input).length;
		expect(readSgf(input, { maxBytes: bytes }).ok).toBe(true);
		const result = readSgf(input, { maxBytes: bytes - 1 });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('limitExceeded');
	});

	it('enforces the default 1 MiB limit for strings and bytes', () => {
		const huge = `(;C[${'x'.repeat(DEFAULT_SGF_LIMITS.maxBytes)}])`;
		rejects(huge, 'limitExceeded');
		rejects(new TextEncoder().encode(huge), 'limitExceeded');
	});

	it('accepts exactly 10,000 sequence nodes and rejects one more', () => {
		const input = `(${' ;'.repeat(DEFAULT_SGF_LIMITS.maxNodes)})`;
		const result = readSgf(input);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.trees[0].sequence).toHaveLength(10000);
		rejects(`(${' ;'.repeat(DEFAULT_SGF_LIMITS.maxNodes + 1)})`, 'limitExceeded');
	});

	it('counts nodes across collections and sibling variations', () => {
		const result = readSgf('(;SZ[9](;B[])(;B[]))(;SZ[9])', { maxNodes: 3 });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('limitExceeded');
	});

	it('accepts exactly 128 nested trees, round trips them and rejects 129', () => {
		const trees = read(nested(128));
		expect(read(write(trees))).toEqual(trees);
		rejects(nested(129), 'limitExceeded');
	});

	it('rejects very deep hostile input without overflowing the call stack', () => {
		const input = nested(20000);
		expect(() => readSgf(input)).not.toThrow();
		rejects(input, 'limitExceeded');
	});

	it.each([{ maxNodes: 0 }, { maxDepth: -1 }, { maxBytes: NaN }, { maxNodes: 1.5 }, { maxDepth: 129 }, { maxBytes: Infinity }])('rejects invalid or unbounded limits %s', limits => {
		const result = readSgf('(;)', limits);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('invalidLimits');
	});

	it('writes deterministic property order and never mutates caller-created trees', () => {
		const tree: SgfTree = { sequence: [{ properties: { SZ: ['9'], C: ['note'], AB: ['bb', 'aa'] } }], variations: [] };
		const before = JSON.stringify(tree);
		const output = write(tree);
		expect(write(read(output))).toBe(output);
		expect(JSON.stringify(tree)).toBe(before);
	});

	it('rejects cyclic or shared writer trees without recursive traversal', () => {
		const tree = read('(;SZ[9])')[0];
		tree.variations.push(tree);
		expect(() => writeSgf(tree)).not.toThrow();
		expect(writeSgf(tree).ok).toBe(false);
		const leaf = read('(;SZ[9])')[0];
		expect(writeSgf([leaf, leaf]).ok).toBe(false);
	});

	it('validates malformed writer nodes and export bounds', () => {
		for (const input of [null, [], {}, { sequence: [], variations: [] }, { sequence: [{ properties: { B: [7] } }], variations: [] }]) {
			expect(() => writeSgf(input)).not.toThrow();
			expect(writeSgf(input).ok).toBe(false);
		}
		const trees = read('(;SZ[9];B[aa])');
		expect(writeSgf(trees, { limits: { maxNodes: 1 } }).ok).toBe(false);
		expect(writeSgf(trees, { limits: { maxBytes: 20 } }).ok).toBe(false);
	});
});
