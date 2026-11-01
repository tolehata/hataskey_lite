/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type SgfNode = { properties: Record<string, string[] | undefined> };
export type SgfTree = { sequence: SgfNode[]; variations: SgfTree[] };
export type SgfLimits = { maxBytes: number; maxNodes: number; maxDepth: number };
export type SgfErrorCode = 'invalidInput' | 'invalidLimits' | 'syntax' | 'invalidProperty' | 'unsupportedEncoding' | 'unsupportedFormat' | 'unsupportedGame' | 'unsupportedSize' | 'limitExceeded';
export type SgfFailure = { ok: false; error: { code: SgfErrorCode; message: string; offset: number } };
export type SgfReadResult = { ok: true; trees: SgfTree[] } | SgfFailure;
export type SgfWriteResult = { ok: true; value: string } | SgfFailure;

/** Outer game trees count as depth 1; sequence length does not add depth.
 * Overrides may lower these hard ceilings, but cannot remove the safety bounds.
 */
export const DEFAULT_SGF_LIMITS: Readonly<SgfLimits> = Object.freeze({ maxBytes: 1024 * 1024, maxNodes: 10000, maxDepth: 128 });

class SgfParseError extends Error {
	constructor(public code: SgfErrorCode, message: string, public offset = 0) {
		super(message);
	}
}

function fail(code: SgfErrorCode, message: string, offset = 0): never {
	throw new SgfParseError(code, message, offset);
}

function failure(error: unknown): SgfFailure {
	return error instanceof SgfParseError
		? { ok: false, error: { code: error.code, message: error.message, offset: error.offset } }
		: { ok: false, error: { code: 'invalidInput', message: 'SGF input could not be read.', offset: 0 } };
}

function isRecord(input: unknown): input is Record<string, unknown> {
	return input !== null && typeof input === 'object' && !Array.isArray(input);
}

function getLimits(input: unknown): SgfLimits {
	if (input !== undefined && !isRecord(input)) fail('invalidLimits', 'Limits must be an object.');
	const limits = { ...DEFAULT_SGF_LIMITS };
	for (const key of ['maxBytes', 'maxNodes', 'maxDepth'] as const) {
		const value = input && Object.hasOwn(input, key) ? input[key] : limits[key];
		if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > DEFAULT_SGF_LIMITS[key]) fail('invalidLimits', `Invalid ${key}.`);
		limits[key] = value;
	}
	return limits;
}

const space = /[\t\n\v\f\r ]/;
const simpleText = new Set(['PB', 'PW', 'RU', 'RE', 'DT', 'CA']);
const single = new Set(['FF', 'GM', 'SZ', 'KM', 'HA', 'PB', 'PW', 'RU', 'RE', 'DT', 'CA', 'C', 'B', 'W', 'PL']);
const rootOnly = new Set(['FF', 'GM', 'SZ', 'CA']);

function validUnicode(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const unit = value.charCodeAt(i);
		if (unit >= 0xd800 && unit <= 0xdbff) {
			const next = value.charCodeAt(++i);
			if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
		} else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
	}
	return true;
}

function point(value: string, size: number): boolean {
	return /^[a-s]{2}$/.test(value) && value.charCodeAt(0) - 97 < size && value.charCodeAt(1) - 97 < size;
}

function setupPoints(values: string[], size: number): string[] {
	const points = new Set<string>();
	for (const value of values) {
		const ends = value.split(':');
		if (ends.length > 2 || !ends.every(p => point(p, size))) fail('invalidProperty', 'Invalid setup point.');
		const first = ends[0];
		const last = ends[1] ?? first;
		if (first[0] > last[0] || first[1] > last[1]) fail('invalidProperty', 'Setup rectangle must run from upper left to lower right.');
		for (let y = first.charCodeAt(1); y <= last.charCodeAt(1); y++) {
			for (let x = first.charCodeAt(0); x <= last.charCodeAt(0); x++) {
				const p = String.fromCharCode(x, y);
				if (points.has(p)) fail('invalidProperty', 'Duplicate setup point.');
				points.add(p);
			}
		}
	}
	return [...points].sort((a, b) => a.charCodeAt(1) - b.charCodeAt(1) || a.charCodeAt(0) - b.charCodeAt(0));
}

/** Normalize supported property values without interpreting game legality.
 * Unknown uppercase properties are retained as opaque decoded values.
 * Missing root defaults become FF4/GM1/SZ19/UTF-8/Japanese; FF3 and tt
 * passes become FF4 and empty values. Text line endings become LF.
 */
function normalize(trees: SgfTree[]): void {
	for (const tree of trees) {
		const root = tree.sequence[0].properties;
		const format = root.FF?.[0] ?? '4';
		if (format !== '3' && format !== '4') fail('unsupportedFormat', 'Only SGF FF3 and FF4 are supported.');
		if (root.GM && root.GM[0] !== '1') fail('unsupportedGame', 'Only Go (GM[1]) is supported.');
		if (root.CA && !/^utf-?8$/i.test(root.CA[0])) fail('unsupportedEncoding', 'Only UTF-8 SGF is supported.');
		const sizeValue = root.SZ?.[0] ?? '19';
		if (!['9', '13', '19'].includes(sizeValue)) fail('unsupportedSize', 'Only 9, 13 and 19 line boards are supported.');
		const size = Number(sizeValue);
		const pending = [tree];
		while (pending.length) {
			const current = pending[pending.length - 1];
			pending.pop();
			for (const node of current.sequence) {
				const props = node.properties;
				for (const [key, values] of Object.entries(props)) {
					if (!values) fail('invalidProperty', `${key} requires values.`);
					if (single.has(key) && values.length !== 1) fail('invalidProperty', `${key} requires exactly one value.`);
					if (rootOnly.has(key) && props !== root) fail('invalidProperty', `${key} is only valid at the game root.`);
				}
				if (props.B && props.W) fail('invalidProperty', 'A node cannot contain both B and W.');
				if ((props.B || props.W) && (props.AB || props.AW || props.AE || props.PL)) fail('invalidProperty', 'Move and setup properties cannot share a node.');
				for (const key of ['B', 'W']) {
					const move = props[key]?.[0];
					if (move === undefined) continue;
					// FF4 also recognizes the historical tt pass on boards up to 19.
					if (move === 'tt') props[key] = [''];
					else if (move !== '' && !point(move, size)) fail('invalidProperty', 'Move is outside the board.');
				}
				for (const key of ['AB', 'AW', 'AE']) {
					if (props[key]) props[key] = setupPoints(props[key], size);
				}
				const occupied = new Set<string>();
				for (const key of ['AB', 'AW', 'AE']) {
					for (const p of props[key] ?? []) {
						if (occupied.has(p)) fail('invalidProperty', 'Conflicting setup points.');
						occupied.add(p);
					}
				}
				if (props.PL && !['B', 'W'].includes(props.PL[0])) fail('invalidProperty', 'Invalid player to move.');
				if (props.KM && (!/^[+-]?\d+(?:\.\d+)?$/.test(props.KM[0]) || !Number.isFinite(Number(props.KM[0])))) fail('invalidProperty', 'Invalid komi.');
				if (props.HA && (!/^\+?\d+$/.test(props.HA[0]) || !Number.isSafeInteger(Number(props.HA[0])) || Number(props.HA[0]) > size * size)) fail('invalidProperty', 'Invalid handicap.');
			}
			pending.push(...current.variations);
		}
		root.FF = ['4'];
		root.GM = ['1'];
		root.SZ = [sizeValue];
		root.CA = ['UTF-8'];
		root.RU ??= ['Japanese'];
	}
}

/** Read a UTF-8 string or UTF-8 Uint8Array. Malformed input never escapes as
 * an exception. offset is a UTF-16 character index (0 for semantic errors).
 */
export function readSgf(input: unknown, options?: unknown): SgfReadResult {
	try {
		const limits = getLimits(options);
		let source: string;
		if (typeof input === 'string') source = input;
		else if (input instanceof Uint8Array) {
			if (input.byteLength > limits.maxBytes) fail('limitExceeded', 'SGF byte limit exceeded.');
			try {
				source = new TextDecoder('utf-8', { fatal: true }).decode(input);
			} catch {
				fail('unsupportedEncoding', 'Invalid UTF-8 bytes.');
			}
		} else fail('invalidInput', 'SGF input must be a string or Uint8Array.');
		if (source.length > limits.maxBytes || new TextEncoder().encode(source).length > limits.maxBytes) fail('limitExceeded', 'SGF byte limit exceeded.');
		if (!validUnicode(source)) fail('unsupportedEncoding', 'SGF contains invalid Unicode.');
		let cursor = source[0] === '\uFEFF' ? 1 : 0;
		let nodes = 0;
		const trees: SgfTree[] = [];
		const stack: SgfTree[] = [];
		const skipSpace = (): void => {
			while (cursor < source.length && space.test(source[cursor])) cursor++;
		};
		const readValue = (key: string): string => {
			cursor++;
			let result = '';
			while (cursor < source.length) {
				let char = source[cursor++];
				if (char === ']') {
					if (simpleText.has(key)) return result.replace(/\n/g, ' ');
					if (['FF', 'GM', 'SZ', 'KM', 'HA', 'AB', 'AW', 'AE', 'B', 'W', 'PL'].includes(key)) return result.replace(/[\t\n\v\f\r ]/g, '');
					return result;
				}
				let escaped = false;
				if (char === '\\') {
					if (cursor === source.length) fail('syntax', 'Unterminated escape.', cursor);
					char = source[cursor++];
					escaped = true;
				}
				if (char === '\r' || char === '\n') {
					const next = source[cursor];
					if ((char === '\r' && next === '\n') || (char === '\n' && next === '\r')) cursor++;
					if (!escaped) result += '\n';
				} else result += /[\t\v\f]/.test(char) ? ' ' : char;
			}
			return fail('syntax', 'Unterminated property value.', cursor);
		};
		while (cursor < source.length) {
			skipSpace();
			if (cursor === source.length) break;
			const char = source[cursor++];
			const current: SgfTree | undefined = stack.at(-1);
			if (char === '(') {
				if (current && current.sequence.length === 0) fail('syntax', 'A game tree needs a sequence before variations.', cursor - 1);
				if (stack.length >= limits.maxDepth) fail('limitExceeded', 'SGF variation depth limit exceeded.', cursor - 1);
				const tree: SgfTree = { sequence: [], variations: [] };
				if (current) current.variations.push(tree);
				else trees.push(tree);
				stack.push(tree);
			} else if (char === ')') {
				if (!current || current.sequence.length === 0) fail('syntax', 'Unexpected closing parenthesis.', cursor - 1);
				stack.pop();
			} else if (char === ';') {
				if (!current || current.variations.length) fail('syntax', 'Unexpected node after variations or outside a tree.', cursor - 1);
				if (++nodes > limits.maxNodes) fail('limitExceeded', 'SGF node limit exceeded.', cursor - 1);
				const properties: Record<string, string[]> = {};
				current.sequence.push({ properties });
				while (cursor < source.length) {
					skipSpace();
					const start = cursor;
					while (cursor < source.length && /[A-Z]/.test(source[cursor])) cursor++;
					if (start === cursor) break;
					const key = source.slice(start, cursor);
					if (Object.hasOwn(properties, key)) fail('invalidProperty', `Duplicate ${key} property.`, start);
					const values: string[] = [];
					skipSpace();
					while (source[cursor] === '[') {
						values.push(readValue(key));
						skipSpace();
					}
					if (!values.length) fail('syntax', 'Property requires a value.', cursor);
					properties[key] = values;
				}
			} else fail('syntax', 'Unexpected SGF character.', cursor - 1);
		}
		if (stack.length || !trees.length) fail('syntax', 'SGF collection is empty or incomplete.', cursor);
		normalize(trees);
		return { ok: true, trees };
	} catch (error) {
		return failure(error);
	}
}

function serialize(trees: readonly unknown[], limits: SgfLimits, includeComments: boolean, canonical: boolean): string {
	const chunks: string[] = [];
	let bytes = 0;
	let nodes = 0;
	const seen = new Set<object>();
	const append = (value: string): void => {
		if (value.length > limits.maxBytes) fail('limitExceeded', 'SGF byte limit exceeded.');
		bytes += new TextEncoder().encode(value).length;
		if (bytes > limits.maxBytes) fail('limitExceeded', 'SGF byte limit exceeded.');
		chunks.push(value);
	};
	type Frame = { tree: unknown; depth: number; child: number };
	const pending: Frame[] = [];
	let nextRoot = 0;
	while (nextRoot < trees.length || pending.length) {
		if (!pending.length) pending.push({ tree: trees[nextRoot++], depth: 1, child: -1 });
		const frame = pending[pending.length - 1];
		const tree = frame.tree;
		if (!isRecord(tree) || !Array.isArray(tree.sequence) || !Array.isArray(tree.variations) || !tree.sequence.length) fail('invalidInput', 'Invalid SGF tree.');
		if (frame.child === -1) {
			if (seen.has(tree)) fail('invalidInput', 'SGF must be a tree without cycles or shared subtrees.');
			seen.add(tree);
			if (frame.depth > limits.maxDepth) fail('limitExceeded', 'SGF variation depth limit exceeded.');
			append('(');
			for (let i = 0; i < tree.sequence.length; i++) {
				if (++nodes > limits.maxNodes) fail('limitExceeded', 'SGF node limit exceeded.');
				const node: unknown = tree.sequence[i];
				if (!isRecord(node) || !isRecord(node.properties)) fail('invalidInput', 'Invalid SGF node.');
				const original = node.properties;
				const props: Record<string, unknown> = canonical && frame.depth === 1 && i === 0 ? { ...original, FF: ['4'], GM: ['1'], CA: ['UTF-8'], RU: ['Japanese'] } : original;
				append(';');
				for (const key of Object.keys(props).sort()) {
					const values = props[key];
					if (!/^[A-Z]+$/.test(key) || !Array.isArray(values) || !values.length) fail('invalidProperty', 'Invalid SGF property.');
					if (key !== 'C' || includeComments) append(key);
					for (const rawValue of values) {
						const value: unknown = rawValue;
						if (typeof value !== 'string' || !validUnicode(value)) fail('invalidProperty', 'SGF property values must be Unicode strings.');
						if (value.length > limits.maxBytes) fail('limitExceeded', 'SGF property byte limit exceeded.');
						if (key !== 'C' || includeComments) append(`[${value.replace(/\\/g, '\\\\').replace(/\]/g, '\\]')}]`);
					}
				}
			}
			frame.child = 0;
		} else if (frame.child < tree.variations.length) {
			pending.push({ tree: tree.variations[frame.child++], depth: frame.depth + 1, child: -1 });
		} else {
			append(')');
			pending.pop();
		}
	}
	if (!trees.length) fail('invalidInput', 'An SGF collection needs at least one tree.');
	return chunks.join('');
}

/** Export FF4/UTF-8/Japanese. Imported RU is intentionally converted to
 * Japanese on export. Include comments explicitly for structural round trips;
 * the privacy default removes C from every node, including all variations.
 * Reading/writing never mutates the supplied tree.
 */
export function writeSgf(input: unknown, options: unknown = {}): SgfWriteResult {
	try {
		if (!isRecord(options) || (options.includeComments !== undefined && typeof options.includeComments !== 'boolean')) fail('invalidInput', 'Invalid SGF export options.');
		const limits = getLimits(options.limits);
		const trees: readonly unknown[] = Array.isArray(input) ? input : [input];
		// Validate caller-created trees through the same grammar and semantics.
		const raw = serialize(trees, limits, true, false);
		const checked = readSgf(raw, limits);
		if (!checked.ok) return checked;
		return { ok: true, value: serialize(checked.trees, limits, options.includeComments === true, true) };
	} catch (error) {
		return failure(error);
	}
}
