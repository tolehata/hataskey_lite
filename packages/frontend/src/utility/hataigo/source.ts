/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * 遊び方の「ソースコード」に出すリンクを決める。
 * 1. ビルドの版を指す URL（未コミットの変更が無いビルド、または HATAIGO_SOURCE_URL）
 * 2. 管理画面の「リポジトリURL」（本体の「このサーバーについて」と同じ設定）
 * どちらも無いときだけ null（未設定の文を出す）。
 */
export function hataigoSourceLink(buildUrl: string | null | undefined, repositoryUrl: string | null | undefined): { url: string; exact: boolean } | null {
	if (buildUrl) return { url: buildUrl, exact: true };
	if (!repositoryUrl) return null;
	try {
		const url = new URL(repositoryUrl);
		if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) return { url: url.href, exact: false };
	} catch { /* 不正な URL は出さない */ }
	return null;
}

/** A supplied URL must identify the complete source for this particular build.
 * Dirty or unidentified checkouts must not advertise HEAD as their exact source.
 */
export function hataigoSourceUrl(archiveUrl: string | undefined, remote: string, commit: string, clean: boolean): string | null {
	if (archiveUrl) {
		try {
			const url = new URL(archiveUrl);
			if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
		} catch { /* Unavailable until a valid source archive is configured. */ }
		return null;
	}
	if (!clean || !/^[a-f0-9]{40}$/.test(commit)) return null;
	const normalized = remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');
	if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(normalized)) return null;
	return `${normalized}/tree/${commit}`;
}
