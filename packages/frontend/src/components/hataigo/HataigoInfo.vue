<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<HyDialog ref="dialog" title="HataIgo について" centerTitle :theme="dialogTheme" @close="dialog?.close()" @closed="emit('closed')">
	<div :class="$style.root">
		<div ref="tabList" :class="$style.tabs" role="tablist" aria-label="HataIgo について">
			<span :class="$style.tabIndicator" :data-animate="tabIndicator.animate.value" :style="tabIndicator.style.value" aria-hidden="true"></span>
			<button v-for="item in sections" :key="item.id" type="button" role="tab" :aria-selected="section === item.id" :class="$style.tab" @click="section = item.id"><i :class="item.icon" aria-hidden="true"></i>{{ item.label }}</button>
		</div>

		<div :class="$style.panels">
			<section :class="$style.lesson" :data-hidden="section !== 'howto'" :inert="section !== 'howto'" role="tabpanel" aria-label="遊び方">
				<div :class="$style.lessonBoard">
					<HataigoBoard
						:position="lessonBoard"
						:theme="prefs.theme"
						:stones="prefs.stones"
						:interactive="!!lesson.tryIt && !cleared"
						:turn="lesson.tryIt ? 'black' : null"
						placement="direct"
						:hints="lesson.hints ?? []"
						:territory="lesson.territory"
						@place="tryMove"
					/>
				</div>
				<div :class="$style.lessonText">
					<p :class="$style.step">{{ index + 1 }} / {{ LESSONS.length }}</p>
					<h3>{{ lesson.title }}</h3>
					<p>{{ lesson.line }}</p>
					<p v-if="lesson.tryIt" :class="$style.tryIt" :data-done="cleared" aria-live="polite">
						<i :class="cleared ? 'ti ti-circle-check' : 'ti ti-hand-finger'" aria-hidden="true"></i>{{ feedback || (cleared ? lesson.tryIt.done : lesson.tryIt.prompt) }}
					</p>
					<div :class="$style.lessonNav">
						<button type="button" :class="$style.ghostButton" :disabled="index === 0" @click="go(index - 1)"><i class="ti ti-arrow-left" aria-hidden="true"></i>前へ</button>
						<span :class="$style.dots" aria-hidden="true"><i v-for="(_, i) in LESSONS" :key="i" :data-on="i === index"></i></span>
						<button v-if="index < LESSONS.length - 1" type="button" :class="$style.primaryButton" @click="go(index + 1)">次へ<i class="ti ti-arrow-right" aria-hidden="true"></i></button>
						<button v-else type="button" :class="$style.primaryButton" @click="dialog?.close()">打ってみる</button>
					</div>
				</div>
			</section>

			<section :class="$style.facts" :data-hidden="section !== 'privacy'" :inert="section !== 'privacy'" role="tabpanel" aria-label="公開範囲">
				<p v-for="fact in privacyFacts" :key="fact.text"><i :class="fact.icon" aria-hidden="true"></i><span>{{ fact.text }}</span></p>
			</section>

			<section :class="$style.facts" :data-hidden="section !== 'source'" :inert="section !== 'source'" role="tabpanel" aria-label="ソースコード">
				<p><i class="ti ti-brand-git" aria-hidden="true"></i><span>HataIgo は hataskey の一部として AGPL-3.0-only で公開しています。<template v-if="source"><br><a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.exact ? 'このサーバーで動いている版のソースコード' : 'このサーバーのソースコード' }}</a></template><template v-else><br>ソースの公開先はこのサーバーではまだ設定されていません。</template></span></p>
				<p><i class="ti ti-palette" aria-hidden="true"></i><span>盤・石・独自アイコン・ロゴは HataIgo のオリジナルで、既存の独自アイコンと同じ AGPL-3.0-only です。操作ボタンなどには Tabler Icons、絵文字には Twemoji または Fluent Emoji、フォントには SIL OFL のものを使っています。<br><a href="/client-assets/CREDITS.md" target="_blank" rel="noopener noreferrer">素材のクレジット</a> · <a href="/client-assets/fonts/NOTICE.md" target="_blank" rel="noopener noreferrer">フォント</a></span></p>
			</section>
		</div>
	</div>
</HyDialog>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import type { Point } from '@/utility/hataigo/rules/board.js';
import { useSlidingIndicator } from '@/utility/sliding-indicator.js';
import HyDialog from '@/components/HyDialog.vue';
import HataigoBoard from '@/components/hataigo/HataigoBoard.vue';
import { LESSONS, tryLessonMove } from '@/utility/hataigo/lessons.js';
import { useHataigoPrefs } from '@/utility/hataigo/prefs.js';
import { hataigoSourceLink } from '@/utility/hataigo/source.js';
import { instance } from '@/instance.js';
import { store } from '@/store.js';

const props = withDefaults(defineProps<{ initialSection?: 'howto' | 'privacy' | 'source' }>(), { initialSection: 'howto' });
const emit = defineEmits<{ closed: [] }>();
const dialog = useTemplateRef('dialog');
const { prefs } = useHataigoPrefs();
const dialogTheme = computed(() => store.r.darkMode.value ? 'dark' : 'light');
const source = hataigoSourceLink(import.meta.env.HATAIGO_SOURCE_URL as string | null | undefined, instance.repositoryUrl);

const sections = [
	{ id: 'howto', label: '遊び方', icon: 'ti ti-school' },
	{ id: 'privacy', label: '公開範囲', icon: 'ti ti-eye' },
	{ id: 'source', label: 'ソースコード', icon: 'ti ti-code' },
] as const;
// 開いたときの初期タブだけを受け取る（開いたあとは利用者のタブ選択に従う）
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const section = ref<(typeof sections)[number]['id']>(props.initialSection);
const tabList = useTemplateRef('tabList');
const tabIndicator = useSlidingIndicator(tabList, '[aria-selected="true"]', () => section.value);

const privacyFacts = [
	{ icon: 'ti ti-lock', text: '対局ははじめは非公開です。観戦も、終わったあとの棋譜も、二人とも許可したときだけ公開されます。' },
	{ icon: 'ti ti-users', text: '観戦している人は、人数だけが表示されます。' },
	{ icon: 'ti ti-message-circle', text: '観戦チャットは、その対局を見ている人みんなが読めます。30日たつと消えます。発言ごとに通報できます。' },
	{ icon: 'ti ti-chart-bar', text: '勝ち負けの記録は、あなたにしか見えません。' },
	{ icon: 'ti ti-file-export', text: '対局の履歴から SGF を保存するときは、対局者の名前とコメントを入れません。' },
	{ icon: 'ti ti-user-x', text: '退会すると、その人が関わった対局は公開をやめ、名前も表示しません。' },
];

const index = ref(0);
const lesson = computed(() => LESSONS[index.value]);
const lessonBoard = ref(LESSONS[0].board);
const cleared = ref(false);
const feedback = ref('');

function go(next: number): void {
	index.value = Math.max(0, Math.min(LESSONS.length - 1, next));
}

watch(index, () => {
	lessonBoard.value = lesson.value.board;
	cleared.value = false;
	feedback.value = '';
});

function tryMove(x: number, y: number): void {
	const step = lesson.value;
	if (!step.tryIt || cleared.value) return;
	const point: Point = { x, y };
	const result = tryLessonMove(lessonBoard.value, point);
	if (!result.ok) { feedback.value = result.message; return; }
	const before = lessonBoard.value;
	lessonBoard.value = result.board;
	feedback.value = '';
	if (step.tryIt.cleared(before, result.board, point)) cleared.value = true;
	else { feedback.value = 'もう少し。白のとなりで、まだ空いている所はどこかな'; lessonBoard.value = before; }
}
</script>

<style module>
.root { display: grid; gap: 16px; }
.tabs { position: relative; display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: var(--hy-soft, rgba(0, 0, 0, .05)); }
/* 選んだタブの下地。タブを替えると滑って移る */
.tabIndicator { position: absolute; top: 0; left: 0; z-index: 0; border-radius: 999px; background: var(--hy-surface, #fff); box-shadow: 0 1px 3px rgba(0, 0, 0, .14); pointer-events: none; }
.tabIndicator[data-animate="true"] { transition: transform .32s cubic-bezier(.22, 1, .36, 1), width .32s cubic-bezier(.22, 1, .36, 1), opacity .15s ease; }
@media (prefers-reduced-motion: reduce) { .tabIndicator[data-animate="true"] { transition: none; } }
.root .tab { all: unset; position: relative; z-index: 1; box-sizing: border-box; flex: 1; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer; color: inherit; transition: color .2s ease; }
.root .tab[aria-selected="true"] { color: var(--hy-accent, #6b4fb8); }
.root .tab:focus-visible { outline: 3px solid var(--hy-accent, #6b4fb8); outline-offset: 2px; }
.lesson { display: grid; grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: 20px; align-items: center; }
.lessonBoard { border-radius: 14px; overflow: hidden; }
.lessonText { display: grid; gap: 8px; align-content: center; }
.lessonText h3 { margin: 0; font-size: 18px; line-height: 1.4; }
.lessonText p { margin: 0; line-height: 1.7; }
.step { font-size: 12px; font-weight: 700; color: var(--hy-accent, #6b4fb8); font-variant-numeric: tabular-nums; }
.tryIt { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 12px; background: var(--hy-soft, rgba(0, 0, 0, .05)); font-size: 13px; font-weight: 700; }
.tryIt[data-done="true"] { color: var(--hy-accent, #6b4fb8); }
.lessonNav { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.dots { flex: 1; display: flex; justify-content: center; gap: 6px; }
.dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--hy-border, #ddd); }
.dots i[data-on="true"] { background: var(--hy-accent, #6b4fb8); }
.root .ghostButton, .root .primaryButton { all: unset; box-sizing: border-box; min-height: 44px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; }
.root .primaryButton { background: var(--hy-accent, #6b4fb8); color: var(--hy-on-accent, #fff); }
.root .ghostButton:disabled { opacity: .35; cursor: default; }
.root .ghostButton:focus-visible, .root .primaryButton:focus-visible { outline: 3px solid var(--hy-accent, #6b4fb8); outline-offset: 2px; }
.panels { display: grid; }
.panels > section { grid-area: 1 / 1; }
.panels > section[data-hidden="true"] { visibility: hidden; }
.facts { display: grid; gap: 4px; align-content: start; }
.facts p { margin: 0; display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--hy-border, rgba(0, 0, 0, .1)); line-height: 1.7; }
.facts p:last-child { border-bottom: 0; }
.facts i { font-size: 20px; color: var(--hy-accent, #6b4fb8); padding-top: 2px; }
.facts a { color: var(--hy-accent, #6b4fb8); text-decoration: underline; }
@media (max-width: 560px) { .lesson { grid-template-columns: minmax(0, 1fr); } .lessonBoard { max-width: 300px; justify-self: center; width: 100%; } }
</style>
