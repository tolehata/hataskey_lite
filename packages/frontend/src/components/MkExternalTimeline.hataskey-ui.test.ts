/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { resolve } from 'node:path';
import { compileScript, compileStyleAsync, compileTemplate, parse } from '@vue/compiler-sfc';
import { describe, expect, test } from 'vitest';
import hataskeyDeckSource from '../ui/_common_/hatasaba-deck.vue?raw';
import simpleUiSource from '../ui/simple.vue?raw';
import noteSource from './MkExternalNote.vue?raw';
import pickerSource from './MkExternalReactionPicker.vue?raw';
import reactionIconSource from './MkReactionIcon.vue?raw';
import timelineSource from './MkExternalTimeline.vue?raw';
import postFormSource from './MkPostForm.vue?raw';

describe('external timeline Hataskey UI contract', () => {
	test('検出器が対象の外部TLコンポーネントを実際に読めている', () => {
		expect(timelineSource.length).toBeGreaterThan(20_000);
		expect(noteSource.length).toBeGreaterThan(20_000);
		expect(pickerSource.length).toBeGreaterThan(10_000);
		expect(reactionIconSource.length).toBeGreaterThan(500);
		expect(postFormSource.length).toBeGreaterThan(50_000);
		expect(timelineSource).toContain('<MkLoading v-if="fetching"/>');
		expect(timelineSource).toContain('<MkError v-else-if="error" @retry="init()"/>');
		expect(timelineSource).toContain('<MkResult type="empty" :text="i18n.ts.noNotes"/>');
	});

	test('hataskeyUi だけを通常・デッキ・ガラス・間隔の静的data属性へ結線する', () => {
		expect(timelineSource).toContain('hataskeyUi?: boolean;');
		expect(timelineSource).toContain('glassBg?: boolean;');
		expect(timelineSource).toMatch(/simpleUi:\s*false,\s*\n\s*hataskeyUi:\s*false,\s*\n\s*glassBg:\s*false,/u);
		expect(timelineSource).toContain("if (!props.hataskeyUi) return 'legacy';");
		expect(timelineSource).toContain("? 'hataskey-deck' : 'hataskey-normal'");
		expect(timelineSource).toContain("visualMode.value === 'hataskey-normal' && spacing === 'compact' ? 'moderate' : spacing");
		for (const attribute of [
			'data-external-timeline-ui',
			'data-external-timeline-mode',
			'data-external-timeline-glass',
			'data-external-timeline-spacing',
		]) {
			expect(timelineSource).toContain(`:${attribute}=`);
			expect(timelineSource).toMatch(new RegExp(`:${attribute}="props\\.hataskeyUi`, 'u'));
		}
		expect(timelineSource).not.toMatch(/:data-(?:bubble|glass-bg|spacing)=/u);
	});

	test('Hataskey UIの呼び出し元だけが表示契約を有効にする', () => {
		for (const src of ['ohtl', 'oltl']) {
			const externalTimeline = simpleUiSource.match(new RegExp(`<MkExternalTimeline[^>]+src="${src}"[^>]+/>`, 'u'))?.[0] ?? '';
			expect(externalTimeline).not.toBe('');
			expect(externalTimeline).toContain(':hataskeyUi="true"');
			expect(externalTimeline).toContain(':glassBg="timelineGlassBg"');
		}
		expect(hataskeyDeckSource).toMatch(/tab\.type === 'ohtl' \|\| tab\.type === 'oltl'[^\n]+hataskeyUi:\s*true/u);
	});

	test('外部ノートへvisual modeを渡し、純リノート連鎖だけを展開して引用を残す', () => {
		expect(timelineSource).toContain(':visualMode="visualMode"');
		expect(timelineSource).toContain(':glassBg="props.hataskeyUi && props.glassBg"');
		expect(noteSource).toContain("type ExternalTimelineVisualMode = 'legacy' | 'hataskey-normal' | 'hataskey-deck';");
		expect(noteSource).toMatch(/visualMode:\s*'legacy',\s*\n\s*glassBg:\s*false,\s*\n\s*embedded:\s*false,/u);
		expect(noteSource).toContain(':data-external-note-ui="visualMode !== \'legacy\' ? \'hataskey\' : undefined"');
		expect(noteSource).toContain("const notePresentation = computed(() => props.visualMode === 'legacy'");
		expect(noteSource).toContain(': resolveExternalNotePresentation(props.note));');
		expect(noteSource).toContain('const appearNote = computed<any>(() => notePresentation.value.appearNote);');
		expect(noteSource).toContain('const quotedNote = computed<any | null>(() => notePresentation.value.quotedNote);');
		expect(noteSource).toContain("const canInteract = computed(() => notePresentation.value.resolution === 'resolved');");
		expect(noteSource).toContain('v-if="isPureRenote" :class="$style.renoteAttribution"');
		expect(noteSource).toMatch(/<div :class="\$style\.bubbleBody">\s*<button v-if="appearNote\.user"[\s\S]*?<div :class="\$style\.main">/u);
		expect(noteSource).toContain('v-if="quotedNote && (visualMode === \'legacy\' || !embedded)" :class="$style.renote"');
		expect(noteSource).toContain('<MkExternalNote :note="quotedNote" :host="host" :token="token" :visualMode="visualMode" :glassBg="glassBg" :embedded="visualMode !== \'legacy\'"');
		expect(noteSource).not.toContain('<MkExternalNote :note="appearNote.renote"');
		expect(noteSource).not.toContain('<MkExternalNote :note="appearNote.reply"');
		expect(noteSource).toContain('v-if="!embedded && canInteract && reactionsEntries.length > 0"');
		expect(noteSource).toContain('v-if="!embedded && canInteract" :class="$style.footer"');
		expect(timelineSource).toContain('const presentation = resolveExternalNotePresentation(note);');
		expect(timelineSource).toContain('return presentation.isPureRenote ? presentation.path : [note];');
		expect(timelineSource).toContain('return note.renote && !note.text ? [note, note.renote] : [note];');
		expect(timelineSource).not.toContain('flattenExternalPureRenoteChain');
		expect(noteSource).toContain(".root[data-external-note-mode='hataskey-normal'] .bubbleBody {");
		expect(noteSource).not.toContain(".root[data-external-note-mode='hataskey-normal'] .main {");
	});

	test('外部返信先は投稿フォーム内で二重カードにせず、アバターと本文を一体表示する', () => {
		expect(postFormSource).toMatch(/v-else-if="externalReplyTarget" :class="\[\$style\.targetNote, \$style\.externalReplyTarget\]"[\s\S]*?externalTargetAvatar[\s\S]*?externalTargetBody/u);
		expect(postFormSource).toContain('v-if="externalReplyTarget.user.avatarUrl"');
		expect(postFormSource).toContain('$style.externalTargetAvatarFallback');
		const styleStart = postFormSource.indexOf('.externalReplyTarget {');
		const styleEnd = postFormSource.indexOf('\n.externalTargetText {', styleStart);
		const styles = postFormSource.slice(styleStart, styleEnd);
		expect(styleStart).toBeGreaterThan(0);
		expect(styleEnd).toBeGreaterThan(styleStart);
		expect(styles).toContain('display: flex;');
		expect(styles).toContain('.externalTargetAvatar {');
		expect(styles).not.toContain('background: var(--MI_THEME-panel);');
		expect(styles).not.toContain('border-radius: 8px;');
	});

	test('選択した外部絵文字URLを即時表示し、URL後着時には画像を再マウントする', () => {
		expect(pickerSource).toContain("(ev: 'done', reaction: string, emojiUrl?: string): void;");
		expect(pickerSource).toContain("emit('done', reaction, getCustomEmojiUrl(reaction) || undefined);");
		expect(noteSource).toContain('done: async (reaction: string, emojiUrl?: string) => {');
		expect(noteSource).toContain('await applyReaction(reaction, emojiUrl);');
		expect(noteSource).toContain('if (emojiUrl) reactionEmojiUrls[reaction] = emojiUrl;');
		expect(noteSource).toContain(':key="`${reaction}:${getEmojiUrl(reaction) ?? \'\'}`"');
		expect(noteSource).toContain('const immediate = reactionEmojiUrls[reaction]');
		expect(noteSource).toContain('lookupExternalEmojiUrl(targetHost, pureName)');
	});

	test('外部サーバー自身を示す@.を実ホストへ正規化し、未解決絵文字をカラーバーにしない', () => {
		expect(noteSource).toContain("host == null || host === '.' ? safeHost.value : host");
		expect(noteSource).toContain('const targetHost = normalizeExternalEmojiHost(explicitHost);');
		expect(noteSource).toContain(':fallbackToImage="false"');
		expect(noteSource).toContain('reactionTipEmojiUrl && !reactionTipEmojiErrored');
		expect(noteSource).not.toContain('https://${explicitHost ?? props.host}');
		expect(pickerSource).toContain("return host === '.' ? currentHost : (host ?? null);");
		expect(pickerSource).toContain('normalizeExternalEmojiHost(explicitHost ?? favEntry?.host ?? recEntry?.host, currentHost)');
		expect(reactionIconSource).toContain('fallbackToImage?: boolean;');
		expect(reactionIconSource).toMatch(/fallbackToImage:\s*true,/u);
		expect(reactionIconSource).toContain(':fallbackToImage="fallbackToImage"');
	});

	test('外部チャンネルノートをアイコンと可視名で示し、純リノートの外側も区別する', () => {
		expect(noteSource).toContain('if (!target?.channel && !target?.channelId) return null;');
		expect(noteSource).toContain('const channelInfo = computed(() => getExternalChannelInfo(appearNote.value));');
		expect(noteSource).toContain('const renoteChannelInfo = computed(() => isPureRenote.value ? getExternalChannelInfo(props.note) : null);');
		expect(noteSource).toMatch(/v-if="channelInfo"[^>]+title="channelInfo\.name"[\s\S]*?ti ti-device-tv[\s\S]*?channelInfo\.name/u);
		expect(noteSource).toMatch(/v-if="renoteChannelInfo"[^>]+title="renoteChannelInfo\.name"[\s\S]*?ti ti-device-tv[\s\S]*?renoteChannelInfo\.name/u);
		expect(noteSource).not.toContain("callExternalApi('channels/show'");
	});

	test('リアクションツールチップのアカウント名を所属先と絵文字URL付きMFMで描画する', () => {
		expect(noteSource).not.toContain('{{ u.name || u.username }}');
		expect(noteSource).toContain('<Mfm :text="u.name || u.username" :plain="true" :nowrap="true" :nyaize="false" :emojiUrls="u.emojis" :author="u"/>');
		expect(noteSource).toContain('host: user.host ?? props.host,');
		expect(noteSource).toContain('emojis: user.emojis ?? {},');
	});

	test('外部ノートのリアクションを親データへ残し、本人ストリームのURL後着も再描画する', () => {
		const changedStart = timelineSource.indexOf('function onNoteReactionChanged(');
		const changedEnd = timelineSource.indexOf('\nfunction onNoteDeleted', changedStart);
		const changed = timelineSource.slice(changedStart, changedEnd);
		expect(changedStart).toBeGreaterThan(0);
		expect(changedEnd).toBeGreaterThan(changedStart);
		expect(changed).toContain('const found = findExternalTimelineNote(noteId);');
		expect(changed).toContain('target.myReaction = reaction;');
		expect(changed).toContain('target.reactionCount = Object.values(target.reactions');
		expect(changed).toContain('refreshExternalTimelineNote(found);');
		expect(timelineSource).toContain('if (outer.id === noteId) return { outer, target: outer, path: [outer] };');
		expect(timelineSource).toContain('if (target !== outer && target.id === noteId) return { outer, target, path };');
		expect(timelineSource).toContain('return rebuildExternalNotePath(found.path, refreshed);');
		const ownStreamStart = timelineSource.indexOf('if (isPending || isMyReaction) {');
		const ownStreamEnd = timelineSource.indexOf('\n\t\t\t// 他人のリアクション', ownStreamStart);
		const ownStream = timelineSource.slice(ownStreamStart, ownStreamEnd);
		expect(ownStreamStart).toBeGreaterThan(0);
		expect(ownStreamEnd).toBeGreaterThan(ownStreamStart);
		expect(ownStream).toContain('found.target.reactionEmojis');
		expect(ownStream).toContain('refreshExternalTimelineNote(found);');
	});

	test('既存テーマトークンとコンテナ幅で、狭幅でも横スクロールを作らない', () => {
		const contractStart = noteSource.indexOf('/* hataskeyUi prop');
		const contractEnd = noteSource.indexOf('\n.avatar {', contractStart);
		const contract = noteSource.slice(contractStart, contractEnd);
		expect(contractStart).toBeGreaterThan(0);
		expect(contractEnd).toBeGreaterThan(contractStart);
		expect(contract).toContain('min-width: 0;');
		expect(contract).toContain('max-width: 100%;');
		expect(contract).toContain(".root[data-external-note-ui='hataskey'][data-external-note-mode]");
		expect(contract).toContain(":global(html.hataGlassUi) .root[data-external-note-ui='hataskey']");
		expect(contract).toContain('backdrop-filter: none;');
		expect(contract).toContain(":not([data-external-note-embedded='on'])");
		expect(contract).toContain('container-type: inline-size;');
		expect(contract).toContain('var(--MI_THEME-panel)');
		expect(contract).toContain('var(--MI_THEME-divider)');
		expect(contract).toContain('var(--MI_THEME-accent)');
		expect(contract).toContain('var(--htk-glass-card-opacity, 55%)');
		expect(contract).toContain(':global(html.hataGlassUi)');
		expect(contract).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/iu);
		for (const width of [580, 450, 400, 300]) {
			expect(noteSource).toContain(`@container (max-width: ${width}px)`);
		}
		expect(noteSource).toContain('flex-wrap: wrap;');
		expect(noteSource).toContain('flex: 1 1 40px;');
	});

	test('変更したVueテンプレートとCSS Modulesがコンパイルできる', async () => {
		for (const [name, source] of [['MkExternalTimeline', timelineSource], ['MkExternalNote', noteSource], ['MkExternalReactionPicker', pickerSource], ['MkPostForm', postFormSource]] as const) {
			const filename = resolve(process.cwd(), `src/components/${name}.vue`);
			const parsed = parse(source, { filename });
			expect(parsed.errors).toEqual([]);
			if (name === 'MkPostForm') {
				const template = compileTemplate({
					source: parsed.descriptor.template!.content,
					filename,
					id: `external-hataskey-${name}`,
				});
				expect(template.errors).toEqual([]);
			} else {
				expect(() => compileScript(parsed.descriptor, { id: `external-hataskey-${name}`, inlineTemplate: true })).not.toThrow();
			}
			const moduleStyle = parsed.descriptor.styles.find((style) => style.module);
			expect(moduleStyle).toBeDefined();
			const style = await compileStyleAsync({
				source: moduleStyle!.content,
				filename,
				id: `external-hataskey-${name}`,
				preprocessLang: 'scss',
				modules: true,
			});
			expect(style.errors).toEqual([]);
		}

		const reactionIconFilename = resolve(process.cwd(), 'src/components/MkReactionIcon.vue');
		const reactionIconParsed = parse(reactionIconSource, { filename: reactionIconFilename });
		expect(reactionIconParsed.errors).toEqual([]);
		expect(() => compileScript(reactionIconParsed.descriptor, { id: 'external-hataskey-MkReactionIcon', inlineTemplate: true })).not.toThrow();
	});
});
