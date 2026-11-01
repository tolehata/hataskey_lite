/* SPDX-License-Identifier: AGPL-3.0-only */
import { h } from 'vue';
import { splitNotificationText } from '@/utility/notification-text.js';

export function notificationTextChildren(text: string) {
	return splitNotificationText(text).flatMap((part, index) => index ? [h('wbr'), part] : [part]);
}

// eslint-disable-next-line import/no-default-export
export default function MkNotificationText(props: { text: string; wrap?: boolean }) {
	return props.wrap ? notificationTextChildren(props.text) : props.text;
}
