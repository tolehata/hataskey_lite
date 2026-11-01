// 旗鯖fork: Node.js 22+ は `--localstorage-file` 指定なしで起動すると
// globalThis.localStorage / sessionStorage を「undefined を返す実験的 getter」として定義する。
// vitest の happy-dom 環境でもこの getter が生き残る(window === globalThis のため
// window.localStorage も undefined になる)ので、モジュールトップレベルの localStorage 参照
// (例: frontend-shared/js/config.ts)が
// `Cannot read properties of undefined (reading 'getItem')` で落ちる。
// テスト用にインメモリの Storage 実装で上書きして防ぐ。
const createMemoryStorage = (): Storage => {
	const map = new Map<string, string>();
	return {
		get length() { return map.size; },
		clear: () => { map.clear(); },
		getItem: (key) => map.get(key) ?? null,
		key: (index) => [...map.keys()][index] ?? null,
		removeItem: (key) => { map.delete(key); },
		setItem: (key, value) => { map.set(key, String(value)); },
	};
};

for (const name of ['localStorage', 'sessionStorage'] as const) {
	if (globalThis[name] == null) {
		Object.defineProperty(globalThis, name, {
			value: createMemoryStorage(),
			configurable: true,
			writable: true,
		});
	}
}

// happy-dom advertises OffscreenCanvas, but its 2D context is not implemented.
// Treat it as unavailable so canvas-confetti takes its SSR-safe path.
Object.defineProperty(globalThis, 'OffscreenCanvas', {
	value: undefined,
	configurable: true,
	writable: true,
});
