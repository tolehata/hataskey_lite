/* SPDX-License-Identifier: AGPL-3.0-only */
// The version remains aligned with package.json; boot records it only on close.
export type HataWhatsNewCard = { id: string; label: string; icon: string; title: string; preview?: 'note-actions' | 'emoji-changes'; text?: string[]; points?: string[]; link?: { label: string; url: string } };
export type HataWhatsNewGroup = { label: string; title: string; feature?: 'hatagoes' | 'hataigo' | 'ui-s' | 'ui-s-2' | 'recipes' | 'flowers'; scene?: 0 | 1 | 2 | 3; cards: HataWhatsNewCard[] };
export type HataWhatsNewStory = HataWhatsNewGroup & { id: string };
export const HATA_WHATS_NEW: { version: string; groups: HataWhatsNewGroup[] } = {
	version: '2026.10.1-hata.13.0',
	groups: [
		{
			label: 'リリースノート', title: '詳しくはリリースノートをご確認ください', cards: [
				{ id: 'release-notes', label: 'リリースノート', icon: 'ti ti-notes', title: '詳しくはリリースノートをご確認ください', link: { label: 'リリースノートを開く', url: 'https://github.com/tolehata/hataskey/blob/master/HATA-CHANGELOG.md#hata-130' } },
			],
		},
	] satisfies HataWhatsNewGroup[],
};
export function getHataWhatsNewStories(): HataWhatsNewStory[] {
	return HATA_WHATS_NEW.groups.map(group => ({ ...group, id: group.cards[0].id }));
}
export function getHataWhatsNewDisplayVersion(version: string): string {
	const match = version.match(/-hata\.(\d+(?:\.\d+)+)$/);
	return match == null ? version : `hata-${match[1]}`;
}
