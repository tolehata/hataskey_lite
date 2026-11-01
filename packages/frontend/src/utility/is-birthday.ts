/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type * as Misskey from 'cherrypick-js';

function isLeapYear(year: number): boolean {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function isBirthday(user: Pick<Misskey.entities.UserDetailed, 'birthday'>, currentDate = new Date()): boolean {
	if (!user.birthday) return false;
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(user.birthday);
	if (!match) return false;

	const month = Number(match[2]);
	const day = Number(match[3]);
	const currentMonth = currentDate.getMonth() + 1;
	const currentDay = currentDate.getDate();

	if (month === 2 && day === 29 && !isLeapYear(currentDate.getFullYear())) {
		return currentMonth === 3 && currentDay === 1;
	}

	return currentMonth === month && currentDay === day;
}
