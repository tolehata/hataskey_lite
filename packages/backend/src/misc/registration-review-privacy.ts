/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

const hiddenEmail = '［メールアドレス非公開］';

function normalizeReviewText(value: string): string {
	let result = value;
	// Decode common copied mailto/URL forms before applying the same rule.
	result = result.replace(/(?:%[0-9a-f]{2})+/gi, encoded => {
		try { return decodeURIComponent(encoded); } catch { return encoded; }
	}).normalize('NFKC');
	return result.replace(/&#(?:0*64|x0*40);?|&commat;/gi, '@')
		.replace(/&#(?:0*46|x0*2e);?|&period;/gi, '.')
		.replace(/[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu, '')
		// eslint-disable-next-line no-control-regex -- Remove invisible control characters before checking private contact text.
		.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '');
}

function registeredEmailPattern(registeredEmail: string | null): RegExp | null {
	if (!registeredEmail) return null;
	const escaped = normalizeReviewText(registeredEmail).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return escaped ? new RegExp(escaped, 'giu') : null;
}

/** Hide only the applicant's registered email from staff display names.
 * Names like "name@status" are public profile text, so the generic email rule must not apply.
 */
export function redactRegisteredEmail(value: string | null, registeredEmail: string | null): string | null {
	if (value == null) return null;
	const pattern = registeredEmailPattern(registeredEmail);
	if (!pattern) return value;
	const normalized = normalizeReviewText(value);
	const result = normalized.replace(pattern, hiddenEmail);
	return result === normalized ? value : result;
}

/** Return review text, never the registered email, while preserving federated @user@host IDs.
 * This handles ordinary address/URI spellings, not arbitrary encodings or prose descriptions.
 */
export function redactRegistrationReviewText(value: string | null, registeredEmail: string | null): string | null {
	if (value == null) return null;
	let result = normalizeReviewText(value);
	const pattern = registeredEmailPattern(registeredEmail);
	if (pattern) result = result.replace(pattern, hiddenEmail);
	// A leading @ distinguishes an SNS address from a bare email. The exact
	// registered address above is always removed, even in an ambiguous SNS form.
	return result.replace(/(?<![\p{L}\p{N}_.%+@!#$&'*\/=?^`{|}~\-])(?:[\p{L}\p{N}_.%+!#$&'*=?^`{|}~\-][\p{L}\p{N}_.%+!#$&'*\/=?^`{|}~\-]*|"[^"\r\n]+")@(?:[\p{L}\p{N}](?:[\p{L}\p{N}.\-]*[\p{L}\p{N}])?|\[[^\]\r\n]+\])/gu, hiddenEmail);
}
