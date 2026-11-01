/* SPDX-License-Identifier: AGPL-3.0-only */

// EntityNotFoundError を継承しない。子だけを null にして親を公開する経路を避ける。
export class PrivateChannelNoteVisibilityError extends Error {
	constructor() {
		super('The note is not available to this viewer.');
		this.name = 'PrivateChannelNoteVisibilityError';
	}
}
