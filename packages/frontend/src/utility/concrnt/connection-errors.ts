/* SPDX-License-Identifier: AGPL-3.0-only */

export type ConcrntConnectionPhase = 'server' | 'identity' | 'subkey' | 'registration' | 'profiles' | 'storage';
export type ConcrntInputIssue = 'export-format' | 'owner-id' | 'private-key' | 'domain' | 'domain-mismatch' | 'master-key' | 'key-derivation';

const inputMessages: Record<ConcrntInputIssue, string> = {
	'export-format': 'サブキーを読み取れませんでした。「サブキーのコピー」で得た文字列全体を貼り付けてください。',
	'owner-id': 'コピーした文字列内のアカウントIDを確認できませんでした。公式クライアントの「サブキーのコピー」でコピーし直してください。',
	'private-key': 'コピーした文字列内のサブキーが有効な形式ではありません。公式クライアントの「サブキーのコピー」でコピーし直してください。',
	domain: '接続先ドメインの形式を確認できませんでした。パスやポートを含まない、Concrnt v2のサーバードメインを指定してください。',
	'domain-mismatch': '入力した接続先と、コピーした文字列に含まれるドメインが一致しません。サブキーを発行したアカウントの接続先を確認してください。',
	'master-key': '主鍵は連携に使用できません。公式クライアントで、この連携専用のサブキーを作成し、「サブキーのコピー」でコピーしてください。',
	'key-derivation': 'このブラウザでサブキーの識別情報を計算できませんでした。画面を再読み込みして、もう一度試してください。',
};

const labels: Record<ConcrntConnectionPhase, string> = {
	server: '公開サーバー情報', identity: 'アカウント情報', subkey: 'サブキーの登録情報', registration: '利用登録', profiles: 'プロフィール', storage: '端末の保存情報',
};

function diagnostic(error: unknown) {
	const detail = error !== null && typeof error === 'object' ? error as { code?: unknown; status?: unknown; phase?: unknown; inputIssue?: unknown } : {};
	return {
		code: typeof detail.code === 'string' && ['auth', 'network', 'capability', 'invalid-input', 'aborted'].includes(detail.code) ? detail.code : undefined,
		status: typeof detail.status === 'number' && Number.isInteger(detail.status) && detail.status >= 400 && detail.status <= 599 ? detail.status : undefined,
		phase: typeof detail.phase === 'string' && Object.hasOwn(labels, detail.phase) ? detail.phase as ConcrntConnectionPhase : undefined,
		inputIssue: typeof detail.inputIssue === 'string' && Object.hasOwn(inputMessages, detail.inputIssue) ? detail.inputIssue as ConcrntInputIssue : undefined,
	};
}

export async function inConcrntConnectionPhase<T>(phase: ConcrntConnectionPhase, action: () => Promise<T>): Promise<T> {
	try {
		return await action();
	} catch (error) {
		const detail = diagnostic(error);
		throw Object.assign(new Error(formatConcrntConnectionError(error, phase)), { ...detail, phase: detail.phase ?? phase });
	}
}

/** Only fixed labels and an HTTP status are displayed; never expose a response body or credential. */
export function formatConcrntConnectionError(error: unknown, fallbackPhase?: ConcrntConnectionPhase): string {
	const detail = diagnostic(error);
	const phase = detail.phase ?? fallbackPhase;
	const status = detail.status;
	if (detail.code === 'aborted') return '接続の確認を中止しました。もう一度操作してください。';
	if (phase === 'storage') return 'このブラウザの保存領域を利用できませんでした。保存領域の設定と空き容量を確認してください。';
	if (detail.code === 'invalid-input') return detail.inputIssue ? inputMessages[detail.inputIssue] : '接続先ドメインと、コピーしたサブキーの文字列全体が入力されているか確認してください。';
	if (phase === 'server') {
		if (status === 401 || status === 403) return `接続先の公開サーバー情報へのアクセスが拒否されました（HTTP ${status}）。サーバー側のアクセス制限を確認してください。この段階ではサブキーを送信していません。`;
		if (detail.code === 'capability') return '接続先のConcrnt v2対応と必要な機能を確認できませんでした。Concrnt v2のサーバードメインを指定してください。';
		if (status) return `接続先の公開サーバー情報を取得できませんでした（HTTP ${status}）。接続先サーバーの状態を確認してください。`;
		return '接続先の公開サーバー情報を取得できませんでした。通信環境に加え、接続先のアクセス制限やブラウザからの通信許可（CORS）を確認してください。この段階ではサブキーを送信していません。';
	}
	const label = phase ? labels[phase] : '接続';
	if (status === 401 || status === 403) return `${label}の確認が許可されませんでした（HTTP ${status}）。鍵の失効とは限らないため、接続情報は保持しています。`;
	if (detail.code === 'auth') return `${label}を確認できません。コンカレント側でサブキーを確認して、再連携してください。`;
	if (detail.code === 'capability') return `${label}の応答が対応するConcrnt v2の形式と一致しませんでした。接続先サーバーの対応状況を確認してください。`;
	return `${label}を確認できませんでした${status ? `（HTTP ${status}）` : ''}。通信環境と接続先を確認して、もう一度試してください。`;
}
