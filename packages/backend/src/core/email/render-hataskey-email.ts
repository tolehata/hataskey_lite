/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import sanitizeHtml from 'sanitize-html';

/** Shared production email document, also used for offline previews. */
export type EmailDocument = {
	subject: string;
	preheader: string;
	category: string;
	title: string;
	titleParts?: string[];
	intro: string[];
	/** Legacy HTML body from existing callers; always sanitized before rendering. */
	htmlBody?: string;
	details?: { label: string; value: string }[];
	quote?: { label: string; text: string };
	action?: { label: string; url: string };
	notice?: { title: string; text: string };
	closing?: string;
	showSettings?: boolean;
	lang?: 'ja' | 'en';
};

export type EmailBrand = { name: string; url: string; iconUrl?: string; logoUrl?: string };

type Palette = {
	background: string;
	surface: string;
	text: string;
	muted: string;
	accent: string;
	pale: string;
	border: string;
	button: string;
	buttonText: string;
};

const light: Palette = {
	background: '#eef1fc', surface: '#f6f9ff', text: '#577096',
	muted: '#49617f', accent: '#305f96', pale: '#e4effd',
	border: '#dfdfdf', button: '#305f96', buttonText: '#ffffff',
};

const dark: Palette = {
	background: '#1c1c25', surface: '#23232f', text: '#eceff4',
	muted: '#b9c6dc', accent: '#ffc5e6', pale: '#302b3c',
	border: '#3f3f50', button: '#ffc5e6', buttonText: '#23232f',
};

const htmlEntities: Record<string, string> = {
	'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => htmlEntities[char]!);

const htmlLines = (value: string): string => escapeHtml(value).replace(/\r\n?|\n/g, '<br>');

function absoluteHttpUrl(value: string, field: string): URL {
	if (/[\s\u0000-\u001f\u007f]/u.test(value) || !/^https?:\/\//i.test(value)) {
		throw new TypeError(`${field} must be an absolute HTTP(S) URL`);
	}
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		throw new TypeError(`${field} must be an absolute HTTP(S) URL`);
	}
	if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
		throw new TypeError(`${field} must be an absolute HTTP(S) URL without credentials`);
	}
	return parsed;
}

function textBlock(value: string): string {
	return value.replace(/\r\n?/g, '\n');
}

function sentenceLines(value: string): string {
	const text = textBlock(value);
	return text.replace(/。[」』）】〉》”’]*/g, (punctuation: string, offset: number) =>
		/^[^\S\n]*(?:\n|$)/u.test(text.slice(offset + punctuation.length)) ? punctuation : `${punctuation}\n`,
	);
}

/** Render email markup and text without sending; legacy HTML is sanitized using the default policy. */
export function renderHataskeyEmail(
	message: EmailDocument,
	brand: EmailBrand,
	options: { theme?: 'light' | 'dark'; images?: boolean } = {},
): { subject: string; html: string; text: string } {
	if (/[\r\n\u0000-\u001f\u007f]/u.test(message.subject)) {
		throw new TypeError('subject must be a single line without control characters');
	}
	const website = absoluteHttpUrl(brand.url, 'brand.url').href;
	const icon = absoluteHttpUrl(brand.iconUrl ?? brand.logoUrl ?? new URL('/favicon.ico', website).href, 'brand.iconUrl').href;
	const actionUrl = message.action ? absoluteHttpUrl(message.action.url, 'action.url').href : undefined;
	const settingsUrl = new URL('/settings/email', website).href;
	const p = options.theme === 'dark' ? dark : light;
	const lang = message.lang === 'en' ? 'en' : 'ja';
	const prose = sentenceLines;
	const settingsLabel = lang === 'ja' ? 'メール通知の設定' : 'Email preferences';
	const websiteLabel = lang === 'ja' ? 'サイトを見る' : 'Visit website';
	const automatedLabel = lang === 'ja' ? 'このメールは自動送信されています。' : 'This is an automated email.';
	const fallbackLabel = lang === 'ja' ? 'ボタンが開かない場合は、次のURLをご利用ください。' : 'If the button does not open, use this URL:';
	const showSettings = message.showSettings !== false;
	const brandName = escapeHtml(brand.name);
	const titleHtml = message.titleParts && message.titleParts.join('') === message.title
		? message.titleParts.map(part => `<span style="display:inline-block;max-width:100%;vertical-align:top;line-break:strict;word-break:normal;overflow-wrap:break-word;">${htmlLines(part)}</span>`).join('')
		: htmlLines(message.title);
	const anchor = (url: string, label: string, style: string, className = ''): string =>
		`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"${className ? ` class="${className}"` : ''} style="${style}">${label}</a>`;

	const introHtml = message.htmlBody !== undefined
		? `<div class="email-ink" style="margin:0 0 18px;color:${p.text};font-size:16px;line-height:1.85;line-break:strict;word-break:normal;overflow-wrap:break-word;">${sanitizeHtml(message.htmlBody, {
			textFilter: text => prose(text).replaceAll('\n', '<br>'),
		})}</div>`
		: message.intro.map(line =>
		`<p class="email-ink" style="margin:0 0 18px;color:${p.text};font-size:16px;line-height:1.85;line-break:strict;word-break:normal;overflow-wrap:break-word;">${htmlLines(prose(line))}</p>`,
	).join('');
	const detailsHtml = message.details?.length ? `
		<tr><td style="padding:8px 36px 26px;" class="mobile-pad">
			<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-surface" style="table-layout:fixed;border:1px solid ${p.border};border-radius:12px;background:${p.surface};">
				${message.details.map((item, index) => `<tr><td class="email-detail" style="padding:${index === 0 ? '20px' : '16px'} 22px 16px;${index ? `border-top:1px solid ${p.border};` : ''}">
					<div class="email-muted" style="color:${p.muted};font-size:12px;line-height:1.5;letter-spacing:.04em;line-break:strict;word-break:normal;overflow-wrap:break-word;">${htmlLines(item.label)}</div>
					<div class="email-ink" style="padding-top:5px;color:${p.text};font-size:15px;line-height:1.7;font-weight:600;overflow-wrap:anywhere;word-break:break-all;">${htmlLines(item.value)}</div>
				</td></tr>`).join('')}
			</table>
		</td></tr>` : '';
	const quoteHtml = message.quote ? `
		<tr><td style="padding:0 36px 26px;" class="mobile-pad">
			<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
				<td class="email-quote" style="border-left:3px solid ${p.accent};padding:7px 0 7px 20px;">
					<div class="email-muted" style="color:${p.muted};font-size:12px;line-height:1.5;letter-spacing:.04em;line-break:strict;word-break:normal;overflow-wrap:break-word;">${htmlLines(message.quote.label)}</div>
					<div class="email-ink" style="padding-top:8px;color:${p.text};font-size:15px;line-height:1.8;line-break:strict;word-break:normal;overflow-wrap:break-word;">${htmlLines(prose(message.quote.text))}</div>
				</td>
			</tr></table>
		</td></tr>` : '';
	const noticeHtml = message.notice ? `
		<tr><td style="padding:0 36px 26px;" class="mobile-pad">
			<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-pale" style="background:${p.pale};border-radius:12px;"><tr><td style="padding:20px 22px;">
				<div class="email-accent" style="color:${p.accent};font-size:13px;line-height:1.5;font-weight:700;line-break:strict;word-break:normal;overflow-wrap:break-word;">${htmlLines(message.notice.title)}</div>
				<div class="email-ink" style="padding-top:6px;color:${options.theme === 'dark' ? p.text : p.muted};font-size:14px;line-height:1.75;line-break:strict;word-break:normal;overflow-wrap:break-word;">${htmlLines(prose(message.notice.text))}</div>
			</td></tr></table>
		</td></tr>` : '';
	const actionHtml = message.action && actionUrl ? `
		<tr><td style="padding:4px 36px 28px;" class="mobile-pad">
			<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;max-width:340px;table-layout:fixed;"><tr><td bgcolor="${p.button}" style="border-radius:999px;background:${p.button};">
				${anchor(actionUrl, escapeHtml(message.action.label), `display:block;padding:14px 26px;border-radius:999px;background:${p.button};color:${p.buttonText};font-size:15px;font-weight:700;line-height:1.4;text-align:center;text-decoration:none;line-break:strict;word-break:normal;overflow-wrap:break-word;`, 'email-button')}
			</td></tr></table>
			<p class="email-muted" style="margin:18px 0 5px;color:${p.muted};font-size:12px;line-height:1.7;">${fallbackLabel}</p>
			<p class="email-muted" style="margin:0;color:${p.muted};font-size:12px;line-height:1.7;overflow-wrap:anywhere;word-break:break-all;">${anchor(actionUrl, escapeHtml(actionUrl), `color:${p.accent};text-decoration:underline;`, 'email-accent')}</p>
		</td></tr>` : '';
	const closingHtml = message.closing ? `<tr><td style="padding:0 36px 34px;color:${p.text};font-size:15px;line-height:1.8;line-break:strict;word-break:normal;overflow-wrap:break-word;" class="mobile-pad email-ink">${htmlLines(prose(message.closing))}</td></tr>` : '';
	const iconCells = options.images === false ? '' : `<td class="email-brand-icon" width="32" style="width:32px;padding-right:12px;vertical-align:middle;"><img src="${escapeHtml(icon)}" alt="" width="32" height="32" style="display:block;width:32px;height:32px;border:0;border-radius:8px;object-fit:cover;"></td>`;
	const footerLinks = [anchor(website, websiteLabel, `color:${p.muted};text-decoration:underline;`, 'email-muted'),
		...(showSettings ? [anchor(settingsUrl, settingsLabel, `color:${p.muted};text-decoration:underline;`, 'email-muted')] : [])].join(`<span style="color:${p.border};padding:0 10px;">·</span>`);
	const autoDarkCss = options.theme == null ? `
@media (prefers-color-scheme:dark){.email-canvas{background-color:#1c1c25!important}.email-card,.email-surface{background-color:#23232f!important;border-color:#3f3f50!important}.email-pale{background-color:#302b3c!important}.email-ink{color:#eceff4!important}.email-muted{color:#b9c6dc!important}.email-accent{color:#ffc5e6!important}.email-button{background-color:#ffc5e6!important;color:#23232f!important}.email-header{border-top-color:#ffc5e6!important;border-bottom-color:#3f3f50!important}.email-footer,.email-detail{border-top-color:#3f3f50!important}.email-quote{border-left-color:#ffc5e6!important}}` : '';
	const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="${options.theme ?? 'light dark'}"><meta name="supported-color-schemes" content="${options.theme ?? 'light dark'}">
<title>${escapeHtml(message.subject)}</title>
<style>@media screen and (max-width:640px){.email-shell{width:100%!important}.mobile-pad{padding-left:24px!important;padding-right:24px!important}.mobile-title{font-size:24px!important}}
${autoDarkCss}</style></head>
<body style="margin:0;padding:0;background:${p.background};font-family:'LINE Seed JP','Pretendard JP','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,Arial,sans-serif;color:${p.text};">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">${escapeHtml(message.preheader)}</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-canvas" style="background:${p.background};"><tr><td align="center" style="padding:36px 12px 44px;">
<!--[if mso]><table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-shell email-card" style="width:100%;max-width:600px;table-layout:fixed;background:${p.surface};border:1px solid ${p.border};border-radius:16px;">
<tr><td style="padding:28px 36px 27px;border-top:4px solid ${options.theme === 'dark' ? '#ffc5e6' : '#6ba5e3'};border-bottom:1px solid ${p.border};" class="mobile-pad email-header"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="width:100%;table-layout:fixed;"><tr>${iconCells}<td style="vertical-align:middle;line-break:strict;word-break:normal;overflow-wrap:break-word;">${anchor(website, `<span class="email-ink" style="color:${p.text};font-family:Righteous,'LINE Seed JP','Pretendard JP',Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:-.03em;line-height:1.35;line-break:strict;word-break:normal;overflow-wrap:break-word;">${brandName}</span>`, 'display:block;text-decoration:none;line-break:strict;word-break:normal;overflow-wrap:break-word;')}</td></tr></table></td></tr>
<tr><td style="padding:36px 36px 10px;" class="mobile-pad"><span class="email-pale email-accent" style="display:inline-block;padding:7px 11px;border-radius:999px;background:${p.pale};color:${p.accent};font-size:11px;font-weight:700;letter-spacing:.08em;line-height:1.4;line-break:strict;word-break:normal;overflow-wrap:break-word;">${htmlLines(message.category)}</span></td></tr>
<tr><td style="padding:5px 36px 17px;" class="mobile-pad"><h1 class="mobile-title email-ink" style="margin:0;color:${p.text};font-size:30px;font-weight:800;letter-spacing:-.035em;line-height:1.4;line-break:strict;word-break:normal;overflow-wrap:break-word;text-wrap:pretty;">${titleHtml}</h1></td></tr>
<tr><td style="padding:0 36px 10px;" class="mobile-pad">${introHtml}</td></tr>
${detailsHtml}${quoteHtml}${actionHtml}${noticeHtml}${closingHtml}
<tr><td style="padding:24px 36px 28px;border-top:1px solid ${p.border};color:${p.muted};font-size:12px;line-height:1.8;" class="mobile-pad email-muted email-footer">
<div style="margin-bottom:9px;">${footerLinks}</div><div>${automatedLabel}</div>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;

	const textParts = [
		...(message.preheader ? [message.preheader] : []),
		message.category,
		message.title,
		...message.intro.map(prose),
		...(message.details?.map(item => `${textBlock(item.label)}: ${textBlock(item.value)}`) ?? []),
		...(message.quote ? [`${textBlock(message.quote.label)}\n${prose(message.quote.text)}`] : []),
		...(message.action && actionUrl ? [`${textBlock(message.action.label)}\n${actionUrl}`] : []),
		...(message.notice ? [`${textBlock(message.notice.title)}\n${prose(message.notice.text)}`] : []),
		...(message.closing ? [prose(message.closing)] : []),
		`${brand.name}\n${website}`,
		...(showSettings ? [`${settingsLabel}: ${settingsUrl}`] : []),
		automatedLabel,
	];
	return { subject: message.subject, html, text: textParts.map(textBlock).join('\n\n') };
}
