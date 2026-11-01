/* SPDX-License-Identifier: AGPL-3.0-only */
import type * as Misskey from 'cherrypick-js';
import { defineAsyncComponent } from 'vue';
import * as os from '@/os.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';

/** Capture the source shell in setup before a picker is opened asynchronously. */
export function useHataGoesPickers() {
	const popup = useHataGoesPopup();

	function selectUser(options: { includeSelf?: boolean; localOnly?: boolean; botOnly?: boolean } = {}): Promise<Misskey.entities.UserDetailed | undefined> {
		if (popup === os.popup) return os.selectUser(options);
		return new Promise(resolve => {
			const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkUserSelectDialog.vue')), options, {
				ok: user => resolve(user),
				closed: () => { resolve(undefined); dispose(); },
			});
		});
	}

	async function selectDriveFiles(options: { multiple?: boolean } = {}): Promise<Misskey.entities.DriveFile[]> {
		if (popup === os.popup) return (await import('@/utility/drive.js')).chooseDriveFile(options);
		const { default: component } = await import('@/components/MkDriveFileSelectDialog.vue');
		return new Promise(resolve => {
			const { dispose } = popup(component, { multiple: options.multiple ?? false }, {
				done: files => { if (files) resolve(files); },
				closed: () => { resolve([]); dispose(); },
			});
		});
	}

	return { selectUser, selectDriveFiles };
}
