/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { EmailBrand, EmailDocument } from './render-hataskey-email.js';

/** Structured content only: no sender, tokens, eligibility checks, or side effects. */
export type HataskeyEmailInput =
	| { kind: 'signup' | 'verify-email' | 'reset-password'; url: string }
	| { kind: 'registration-approved'; username: string }
	| { kind: 'registration-rejected' }
	| { kind: 'login' | 'account-truncated' | 'account-deleted' }
	| { kind: 'abuse-report' | 'abuse-report-forwarded'; comment: string }
	| { kind: 'moderator-inactive'; remaining: number; unit: 'days' | 'hours' }
	| { kind: 'invitation-only' | 'public-note-disabled'; inactiveDays: number }
	| { kind: 'admin-message'; subject: string; text: string }
	| { kind: 'follow' | 'follow-request'; displayName: string; account: string; profileUrl: string };

export type HataskeyEmailKind = HataskeyEmailInput['kind'];

/** Caller chooses locale explicitly; Japanese is the preview default, English is the fallback. */
export function createHataskeyEmail(input: HataskeyEmailInput, brand: EmailBrand, lang: 'ja' | 'en' = 'ja'): EmailDocument {
	const t = (ja: string, en: string) => lang === 'ja' ? ja : en;
	const japaneseTitleParts = (parts: string[]) => lang === 'ja' ? parts : undefined;
	const url = (path: string) => `${brand.url.replace(/\/$/, '')}${path}`;
	const base = { lang, showSettings: true };
	const security = t('アカウントの安全', 'ACCOUNT SECURITY');
	const moderation = t('サーバーの運営', 'SERVER ADMINISTRATION');
	const unrequested = {
		title: t('心当たりがない場合', 'If you did not request this'),
		text: t('この操作を行っていない場合は、リンクを開かずにこのメールを破棄してください。', 'If you did not request this, you can discard this email without opening the link.'),
	};
	const document = (value: Omit<EmailDocument, 'lang'>): EmailDocument => ({ ...base, ...value });

	switch (input.kind) {
		case 'registration-rejected':
			return document({
				subject: t(`【${brand.name}】アカウント登録申請の審査結果`, `[${brand.name}] Your registration review result`),
				category: t('登録のお知らせ', 'REGISTRATION'),
				title: t('登録申請を承認できませんでした。', 'Your registration was not approved.'),
				preheader: t('登録申請の審査結果をお知らせします。', 'The review of your registration is complete.'),
				intro: [t(`${brand.name}への登録申請、ありがとうございました。審査の結果、今回は登録申請を承認できませんでした。`, `Thank you for applying to ${brand.name}. After review, we were unable to approve your registration on this occasion.`)],
				showSettings: false,
			});
		case 'signup':
			return document({
				subject: 'Signup', category: t('はじめまして', 'WELCOME'),
				preheader: t('あとひとつのステップで、登録が完了します。', 'One more step to complete your signup.'),
				title: t(`${brand.name}へ、ようこそ。`, `Welcome to ${brand.name}.`), titleParts: japaneseTitleParts([`${brand.name}へ、`, 'ようこそ。']),
				intro: [t('登録のお申し込み、ありがとうございます。', 'Thank you for signing up.'), t('下のボタンからメールアドレスを確認して、登録を完了してください。', 'Confirm your email address below to complete your signup.')],
				action: { label: t('登録を完了する', 'Complete signup'), url: input.url }, notice: unrequested, showSettings: false,
			});
		case 'registration-approved':
			return document({
				subject: t(`【${brand.name}】アカウント登録申請が承認されました`, `[${brand.name}] Your registration has been approved`),
				category: t('登録のお知らせ', 'REGISTRATION'), title: t('登録申請が承認されました。', 'Your registration has been approved.'), titleParts: japaneseTitleParts(['登録申請が', '承認されました。']),
				preheader: t('ログインして、ご利用をはじめられます。', 'You can now sign in and get started.'),
				intro: [t(`${brand.name}への登録申請が承認されました。ログインして、ご利用をはじめてください。`, `Your registration for ${brand.name} has been approved. Sign in to get started.`)],
				details: [{ label: t('ユーザーID', 'Username'), value: `@${input.username}` }],
				action: { label: t('ログインする', 'Sign in'), url: brand.url },
				notice: { title: t('このメールアドレスについて', 'About this email address'), text: t('今後、ログインやセキュリティに関連する操作の通知を、このメールアドレスにお届けします。', 'Login and account security notifications will be sent to this email address.') },
			});
		case 'verify-email':
			return document({
				subject: 'Email verification', category: security, title: t('メールアドレスを確認してください。', 'Confirm your email address.'), titleParts: japaneseTitleParts(['メールアドレスを', '確認してください。']),
				preheader: t('通知を受け取るメールアドレスの確認をお願いします。', 'Please confirm the email address for your account.'),
				intro: [t('メールアドレスの登録・変更を受け付けました。下のボタンから、このアドレスを確認してください。', 'We received your email address update. Confirm this address using the button below.')],
				action: { label: t('メールアドレスを確認', 'Confirm email address'), url: input.url }, notice: unrequested,
			});
		case 'reset-password':
			return document({
				subject: 'Password reset requested', category: security, title: t('パスワードを再設定しましょう。', 'Reset your password.'), titleParts: japaneseTitleParts(['パスワードを', '再設定しましょう。']),
				preheader: t('パスワードを再設定するためのリンクをお届けします。', 'Here is your password reset link.'),
				intro: [t('パスワードの再設定を受け付けました。下のボタンから、新しいパスワードを設定してください。', 'We received your password reset request. Choose a new password using the button below.')],
				details: [{ label: t('リンクの有効期間', 'Link validity'), value: t('発行から30分', '30 minutes after issue') }],
				action: { label: t('パスワードを再設定', 'Reset password'), url: input.url }, notice: unrequested, showSettings: false,
			});
		case 'login':
			return document({
				subject: 'New login / ログインがありました', category: security, title: t('新しいログインがありました。', 'A new login to your account.'), titleParts: japaneseTitleParts(['新しいログインが', 'ありました。']),
				preheader: t('ご自身のログインかどうか、ご確認ください。', 'Please check that this login was yours.'),
				intro: [t('あなたのアカウントへの新しいログインがありました。ご自身の操作であれば、対応は不要です。', 'There was a new login to your account. If this was you, no action is needed.')],
				action: { label: t('セキュリティ設定を確認', 'Review security settings'), url: url('/settings/security') },
				notice: { title: t('心当たりがない場合', 'Do not recognize this login?'), text: t('パスワードを変更するなど、アカウントのセキュリティ状態を確認・更新してください。', 'Review and update your account security, including changing your password.') },
			});
		case 'account-truncated':
			return document({
				subject: 'Account truncated', category: t('アカウントのお知らせ', 'ACCOUNT UPDATE'), title: t('投稿とドライブの削除が完了しました。', 'Your posts and drive files have been deleted.'), titleParts: japaneseTitleParts(['投稿とドライブの', '削除が完了しました。']),
				preheader: t('アカウントの投稿・ドライブの削除処理が完了しました。', 'The deletion of your posts and drive files is complete.'),
				intro: [t('あなたのアカウントの投稿とドライブ内のファイルを削除しました。', 'Your account’s posts and drive files have been deleted.')],
				details: [{ label: t('処理の状態', 'Status'), value: t('完了', 'Complete') }],
			});
		case 'account-deleted':
			return document({
				subject: 'Account deleted', category: t('アカウントのお知らせ', 'ACCOUNT UPDATE'), title: t('アカウントの削除が完了しました。', 'Your account has been deleted.'), titleParts: japaneseTitleParts(['アカウントの削除が', '完了しました。']),
				preheader: t('アカウントの削除処理が完了しました。', 'Your account deletion is complete.'),
				intro: [t('あなたのアカウントの削除処理が完了しました。', 'Your account has been deleted.')],
				closing: t('これまでご利用いただき、ありがとうございました。', 'Thank you for being part of our community.'), showSettings: false,
			});
		case 'abuse-report':
		case 'abuse-report-forwarded':
			return document({
				subject: input.kind === 'abuse-report' ? 'New Abuse Report' : 'New abuse report', category: moderation,
				title: t('新しい通報が届いています。', 'A new report is ready to review.'), titleParts: japaneseTitleParts(['新しい通報が', '届いています。']),
				preheader: t('通報内容を確認し、必要な対応をお願いします。', 'Review the report and take any necessary action.'),
				intro: [t('通報を受け付けました。内容と関連する情報を確認して、対応をご検討ください。', 'A report has been received. Review its content and context before deciding on a response.')],
				quote: { label: t('通報内容', 'Report content'), text: input.comment },
				action: { label: t('通報を確認する', 'Review reports'), url: url('/admin/abuses') }, showSettings: false,
			});
		case 'moderator-inactive': {
			if (!Number.isFinite(input.remaining) || input.remaining < 0) throw new Error('remaining must be non-negative');
			const remaining = `${input.remaining}${t(input.unit === 'days' ? '日' : '時間', input.unit === 'days' ? ' days' : ' hours')}`;
			return document({
				subject: 'Moderator Inactivity Warning / モデレーター不在の通知', category: moderation,
				title: t('モデレーターの活動を確認してください。', 'Please check moderator activity.'), titleParts: japaneseTitleParts(['モデレーターの', '活動を', '確認してください。']),
				preheader: t(`あと${remaining}、活動が確認できないと招待制に切り替わります。`, `Registration will become invitation-only after ${remaining} without activity.`),
				intro: [t('モデレーターの活動が一定期間確認できていません。この状態が続くと、サーバーは招待制に切り替わります。', 'No moderator activity has been detected for a period of time. Continued inactivity will switch the server to invitation-only registration.')],
				details: [{ label: t('招待制への切り替えまで', 'Time until invitation-only'), value: t(`あと${remaining}`, remaining) }],
				action: { label: t('ログインして活動を更新', 'Sign in to update activity'), url: brand.url },
				notice: { title: t('切り替えを避けるには', 'To prevent the change'), text: t(`${brand.name}にログインし、最終アクティブ日時を更新してください。`, `Sign in to ${brand.name} to update your last active time.`) }, showSettings: false,
			});
		}
		case 'invitation-only':
		case 'public-note-disabled': {
			if (!Number.isFinite(input.inactiveDays) || input.inactiveDays < 0) throw new Error('inactiveDays must be non-negative');
			const invitation = input.kind === 'invitation-only';
			return document({
				subject: invitation ? 'Change to Invitation-Only / 招待制に変更されました' : 'Change to Public Note Disabled / パブリック投稿が無効になりました',
				category: moderation,
				title: invitation ? t('サーバーが招待制に切り替わりました。', 'Registration is now invitation-only.') : t('パブリック投稿が無効になりました。', 'Public posting has been disabled.'),
				titleParts: japaneseTitleParts(invitation ? ['サーバーが招待制に', '切り替わりました。'] : ['パブリック投稿が', '無効になりました。']),
				preheader: t('コントロールパネルから、現在の設定を確認してください。', 'Review the current settings in the control panel.'),
				intro: [t(`モデレーターの活動が${input.inactiveDays}日間確認できなかったため、${invitation ? 'サーバーを招待制に変更しました。' : 'パブリック投稿を無効にしました。'}`, `No moderator activity was detected for ${input.inactiveDays} days, so ${invitation ? 'registration was changed to invitation-only.' : 'public posting was disabled.'}`)],
				action: { label: t('コントロールパネルを開く', 'Open control panel'), url: url('/admin') },
				notice: { title: t('設定を戻すには', 'To restore the setting'), text: t('コントロールパネルから設定を変更する必要があります。', 'You need to change the setting in the control panel.') }, showSettings: false,
			});
		}
		case 'admin-message':
			return document({
				subject: input.subject, category: t('サーバーからのお便り', 'FROM YOUR SERVER'), title: input.subject,
				preheader: t(`${brand.name}からのメッセージです。`, `A message from ${brand.name}.`), intro: [input.text], showSettings: false,
			});
		// Reference only: current NotificationService deliberately does not send these.
		case 'follow':
		case 'follow-request': {
			const request = input.kind === 'follow-request';
			const title = request ? t('フォローリクエストが届いています。', 'You have a new follow request.') : t('新しいつながりが生まれました。', 'You have a new follower.');
			return document({
				subject: request ? t('フォローリクエストを受け取りました', 'You received a follow request') : t('フォローされました', 'You have a new follower'),
				category: t('つながりのお知らせ', 'CONNECTIONS'), title,
				titleParts: japaneseTitleParts(request ? ['フォローリクエストが', '届いています。'] : ['新しいつながりが', '生まれました。']), preheader: title,
				intro: [request ? t('新しいフォローリクエストを受け取りました。', 'You received a new follow request.') : t('あなたをフォローしたユーザーを紹介します。', 'Meet your new follower.')],
				details: [{ label: t('表示名', 'Display name'), value: input.displayName }, { label: t('アカウント', 'Account'), value: input.account }],
				action: { label: request ? t('リクエストを確認', 'Review request') : t('プロフィールを見る', 'View profile'), url: request ? url('/my/follow-requests') : input.profileUrl },
			});
		}
	}
}
