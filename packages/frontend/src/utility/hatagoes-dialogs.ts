/* SPDX-License-Identifier: AGPL-3.0-only */
import * as os from '@/os.js';
import { inject } from 'vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';

/** Capture the owning HataGoes pane while setup still has its injection context. */
export function useHataGoesDialogs() {
	if (!inject(HATA_GOES_HOST, null)) return os;
	const launch = useHataGoesPopup();
	const alert: typeof os.alert = props => os.alert(props, launch);
	const confirm: typeof os.confirm = props => os.confirm(props, launch);
	const actions: typeof os.actions = props => os.actions(props, launch);
	const inputText = ((props: Parameters<typeof os.inputText>[0]) => os.inputText(props, launch)) as typeof os.inputText;
	const inputNumber = ((props: Parameters<typeof os.inputNumber>[0]) => os.inputNumber(props, launch)) as typeof os.inputNumber;
	const inputDatetime: typeof os.inputDatetime = props => os.inputDatetime(props, launch);
	const select = ((props: Parameters<typeof os.select>[0]) => os.select(props, launch)) as typeof os.select;
	const form = ((title: Parameters<typeof os.form>[0], fields: Parameters<typeof os.form>[1]) => os.form(title, fields, launch)) as typeof os.form;
	return { alert, confirm, actions, inputText, inputNumber, inputDatetime, select, form };
}
