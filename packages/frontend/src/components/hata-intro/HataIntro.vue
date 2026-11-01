<!--
SPDX-FileCopyrightText: tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="hata-intro" :class="{ 'hg-host': inHataGoes }" lang="ja" data-theme="system" :style="{ colorScheme }" aria-label="HataIntro・Hataskey はじめてガイド">
	<a class="hg-skip" :href="`#${instance}-main`" @click.prevent="main?.focus()">ガイド本文へ</a>
	<main :id="`${instance}-main`" ref="main" class="hg-main" tabindex="-1">
		<div class="hg-browse-head">
			<div class="hg-browse-controls">
				<button v-if="!inHataGoes || page !== 'home'" type="button" class="hg-back-button" data-action="back" :aria-label="backLabel" :title="backLabel" @click="back"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>
				<button type="button" class="hg-back-button" data-action="home" aria-label="HataIntroのホームへ戻る" title="HataIntroのホームへ戻る" @click="home"><i class="ti ti-home" aria-hidden="true"></i></button>
			</div>
			<span v-if="page === 'walk'"><span v-html="brandName(course.label)"></span> · {{ step + 1 }} / {{ course.features.length }}</span>
			<span v-else-if="page === 'reference' && reference"><span v-html="brandName(categoryLabels[reference.course])"></span> · 機能解説</span>
		</div>
		<template v-if="page === 'home' || page === 'index'">
			<section class="hg-hero"><div><div class="hg-eyebrow"><i class="ti ti-book" aria-hidden="true"></i><span v-if="page === 'home'" class="hg-brand">HataIntro</span><span v-else>必要なときに引けるガイド</span></div><h1 data-guide-title tabindex="-1">{{ page === 'home' ? (inHataGoes ? '必要なときに引けるガイド' : '画面と操作から使い方を探す') : '検索・用語から探す' }}</h1><p class="hg-intro" v-html="prose(page === 'home' ? 'ログインしたばかりの人も、操作に迷った人も。開く場所・手順・画面の見方を、必要なところだけ読めるよ' : '操作の言葉でも、アプリの名前でも検索できるよ。知らない用語はこのページの下でも調べられる')"></p></div></section>
			<aside v-if="page === 'home' && !inHataGoes" class="hg-integration-note"><strong>はじめの操作も、使い慣れてからの疑問も</strong><p>最初は下の3つから。<br>機能の仕組みや注意点を知りたくなったら、同じページの詳しい解説へ進めるよ</p></aside>
			<section v-if="page === 'home' && inHataGoes" class="hg-host-shortcuts" aria-label="最初はここから">
				<h2>最初はここから</h2>
				<div class="hg-host-shortcut-grid">
					<button type="button" data-action="feature" data-id="timeline" @click="openFeature('timeline')"><i class="ti ti-news" aria-hidden="true"></i><span><strong>まずは、流れてくるノートを見よう</strong><small>タイムラインの見方へ</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
					<MkA to="/settings/profile"><i class="ti ti-user-edit" aria-hidden="true"></i><span><strong>呼んでほしい名前を設定する</strong><small>プロフィール設定を開く</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></MkA>
					<button type="button" data-action="feature" data-id="reaction" @click="openFeature('reaction')"><i class="ti ti-mood-smile" aria-hidden="true"></i><span><strong>絵文字で反応する</strong><small>リアクションの使い方へ</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
				</div>
			</section>
			<form class="hg-search-form" data-guide-search-form role="search" @submit.prevent="submitSearch">
				<label :for="`${instance}-search`">知りたいことから探す</label>
				<div class="hg-search-box">
					<input :id="`${instance}-search`" ref="searchInput" :value="query" type="search" placeholder="例：絵文字、公開範囲、映画 記録" :aria-describedby="`${instance}-hint`" autocomplete="off" @input="inputSearch" @compositionstart="composing = true" @compositionend="endComposition">
					<button :hidden="!query" type="button" class="hg-search-clear" data-action="clear-query" aria-label="検索語をクリア" title="検索語をクリア" @click="clearQuery"><i class="ti ti-x" aria-hidden="true"></i></button>
					<button type="submit" class="hg-search-submit" aria-label="ガイドを検索" title="ガイドを検索"><i class="ti ti-search" aria-hidden="true"></i></button>
				</div>
				<p :id="`${instance}-hint`" class="hg-search-hint">機能名が分からなくても、「取り消し」「保存」などの言葉で探せるよ</p>
			</form>
			<nav v-if="page === 'index' || (page === 'home' && inHataGoes)" class="hg-filter" aria-label="ガイドのカテゴリ">
				<template v-if="inHataGoes">
					<button type="button" data-action="filter" data-id="all" :aria-pressed="filter === 'all'" aria-label="すべて" title="すべて" @click="setFilter('all')"><i class="ti ti-apps" aria-hidden="true"></i><span v-if="filter === 'all'">すべて</span></button>
					<button v-for="c in allCourses" :key="c.id" type="button" data-action="filter" :data-id="c.id" :aria-pressed="filter === c.id" :aria-label="c.label" :title="c.label" @click="setFilter(c.id)"><i :class="iconClass(c.icon)" aria-hidden="true"></i><span v-if="filter === c.id" v-html="brandName(c.label)"></span></button>
				</template>
				<template v-else>
					<button type="button" data-action="filter" data-id="all" :aria-pressed="filter === 'all'" @click="filter = 'all'">すべて</button>
					<button v-for="c in allCourses" :key="c.id" type="button" data-action="filter" :data-id="c.id" :aria-pressed="filter === c.id" @click="filter = c.id"><span v-html="brandName(c.label)"></span></button>
				</template>
			</nav>
			<section data-guide-search-panel :hidden="!showResults">
				<template v-if="showResults">
					<div class="hg-section-head"><h2>{{ committedQuery ? `「${committedQuery}」の検索結果` : 'すべてのガイド' }}</h2><p role="status" aria-live="polite" aria-atomic="true">{{ found.length + foundReferences.length }}件 · 操作ガイド {{ found.length }} / 機能解説 {{ foundReferences.length }}</p></div>
					<div v-if="found.length || foundReferences.length" class="hg-search-results">
						<button v-for="{ id, c } in found" :key="id" type="button" class="hg-search-result" data-action="feature" :data-id="id" :data-search-result="id" @click="openFeature(id, true)"><span><span v-html="brandName(c.label)"></span> · 操作ガイド{{ read.has(id) ? ' · 読んだ' : '' }}</span><strong v-html="brandName(features[id].name)"></strong><p v-html="prose(features[id].benefit)"></p><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
						<button v-for="r in foundReferences" :key="r.id" type="button" class="hg-search-result" data-action="reference" :data-id="r.id" :data-search-result="r.id" @click="openReference(r.id)"><span><span v-html="brandName(categoryLabels[r.course])"></span> · 機能解説</span><strong v-html="brandName(r.title)"></strong><p v-html="prose(r.lead)"></p><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
					</div>
					<div v-else class="hg-no-results"><h3>見つからなかったよ</h3><p>「{{ committedQuery }}」を少し短くするか、別の言葉で探してみよう。<br>カテゴリを絞っているときは「すべて」へ戻すと見つかることもあるよ</p><button type="button" class="hg-btn" data-action="clear-search" @click="resetSearch">検索と絞り込みをリセット</button><button type="button" class="hg-link" @click="openFeature('feed')">それでも分からないとき <i class="ti ti-arrow-right" aria-hidden="true"></i></button></div>
				</template>
			</section>
			<div v-if="page === 'home'" data-guide-home-content :hidden="showResults">
				<section class="hg-start"><div><div class="hg-eyebrow">最初はここから</div><h2>まずは、流れてくるノートを見よう</h2><p>投稿を読むだけでも大丈夫。<br>気になったら絵文字で反応して、書きたくなったときに公開範囲を確かめよう</p><button type="button" class="hg-btn hg-btn-primary" data-action="feature" data-id="timeline" @click="openFeature('timeline')">タイムラインの見方へ <i class="ti ti-arrow-right" aria-hidden="true"></i></button></div><ol class="hg-start-list"><li v-for="([id, label], index) in startingPoints" :key="id"><span class="hg-number" aria-hidden="true">{{ index + 1 }}</span><button type="button" class="hg-link" @click="openFeature(id)">{{ label }} <i class="ti ti-arrow-right" aria-hidden="true"></i></button></li></ol></section>
				<section class="hg-profile-shortcut"><div><strong>呼んでほしい名前を設定する</strong><p>名前・アイコン・自己紹介は、本体のプロフィール設定で変更できるよ</p></div><MkA class="hg-link" to="/settings/profile"><i class="ti ti-user-edit" aria-hidden="true"></i> プロフィール設定を開く <i class="ti ti-arrow-up-right" aria-hidden="true"></i></MkA></section>
				<div class="hg-section-head"><h2>必要なときは、この目次から</h2><p>同じ画面の操作をまとめているよ</p></div>
				<div class="hg-courses">
					<section v-for="c in homeCourses" :key="c.id" class="hg-topic-card">
						<div class="hg-topic-head"><span class="hg-icon" :data-tone="c.tone"><i :class="iconClass(c.icon)" aria-hidden="true"></i></span><h3 v-html="brandName(c.title)"></h3></div><p v-html="prose(c.desc)"></p>
						<ul v-if="c.features.length" class="hg-topic-links"><li v-for="id in c.features" :key="id"><button type="button" data-action="feature" :data-id="id" @click="openFeature(id, true)"><span><span v-html="brandName(features[id].name)"></span>{{ read.has(id) ? ' · 読んだ' : '' }}</span><i class="ti ti-chevron-right" aria-hidden="true"></i></button></li></ul>
						<component :is="c.features.length ? 'details' : 'div'" v-if="referencesByCourse[c.id].length" :class="c.features.length ? 'hg-reference-fold' : undefined">
							<summary v-if="c.features.length">機能をもっと知る <span>{{ referencesByCourse[c.id].length }}項目</span></summary>
							<ul class="hg-topic-links hg-reference-links"><li v-for="r in referencesByCourse[c.id]" :key="r.id"><button type="button" class="hg-link" data-action="reference" :data-id="r.id" @click="openReference(r.id)"><span v-html="brandName(r.title)"></span> <i class="ti ti-arrow-right" aria-hidden="true"></i></button></li></ul>
						</component>
					</section>
				</div>
				<section class="hg-support"><h2>「できない」「見つからない」ときも</h2><p>各ガイドの「困ったとき」に、よく迷う操作をまとめているよ。<br>使うUIやサーバーの設定で、図と表示が異なる場合もある</p><div class="hg-footer-nav"><button v-for="[id, label] in supportLinks" :key="id" type="button" class="hg-link" @click="openFeature(id)">{{ label }} <i class="ti ti-arrow-right" aria-hidden="true"></i></button></div></section>
			</div>
			<template v-if="page === 'index'">
				<div class="hg-section-head"><h2 :id="`${instance}-glossary`" data-glossary-title tabindex="-1">よく出てくる言葉</h2></div>
				<dl class="hg-glossary"><template v-for="[term, desc, id] in glossary" :key="term"><dt>{{ term }}</dt><dd><span v-html="prose(desc)"></span><br><button type="button" class="hg-link" @click="openFeature(id)">使い方を見る <i class="ti ti-arrow-right" aria-hidden="true"></i></button></dd></template></dl>
			</template>
		</template>
		<template v-else-if="page === 'walk'">
			<nav class="hg-step-nav" :aria-label="`${course.label}の目次`"><button v-for="(id, index) in course.features" :key="id" type="button" class="hg-step-tab" data-action="step" :data-index="index" :aria-current="step === index ? 'page' : undefined" @click="openFeature(id)"><span v-html="brandName(features[id].name)"></span></button></nav>
			<article :key="featureId" class="hg-step-body" :data-guide-article="featureId">
				<header><div class="hg-eyebrow" v-html="brandName(feature.name)"></div><h1 data-guide-title tabindex="-1">{{ feature.title }}</h1><p class="hg-step-desc" v-html="prose(feature.benefit)"></p></header>
				<div class="hg-entry"><div><strong>本体では、ここから開く</strong><p v-html="prose(feature.where)"></p></div><MkA v-if="destination" class="hg-link" :to="destination" :aria-label="`${feature.name}を本体で開く`">本体で開く <i class="ti ti-arrow-up-right" aria-hidden="true"></i></MkA></div>
				<MkA v-if="featureId === 'card'" class="hg-link" to="/settings/profile"><i class="ti ti-user-edit" aria-hidden="true"></i> プロフィール設定を開く <i class="ti ti-arrow-up-right" aria-hidden="true"></i></MkA>
				<div class="hg-learn" :data-expanded="expanded || featureId === 'draw'">
					<section class="hg-how"><h2>使い方</h2><ol class="hg-instructions"><li v-for="instruction in feature.steps" :key="instruction" v-html="prose(instruction)"></li></ol><div class="hg-result"><strong><i class="ti ti-check" aria-hidden="true"></i> 本体での確認ポイント</strong><p v-html="prose(detail.result)"></p></div></section>
					<div v-if="featureId !== 'draw'" class="hg-example-area"><div class="hg-example-toolbar"><button type="button" class="hg-link" data-action="expand-example" :aria-pressed="expanded" @click="expanded = !expanded"><i :class="iconClass(expanded ? 'minimize' : 'maximize')" aria-hidden="true"></i> {{ expanded ? '図を元の幅に戻す' : '図をページ幅で見る' }}</button></div><p v-if="detail.practice" class="hg-practice"><i class="ti ti-help" aria-hidden="true"></i> <span v-html="prose(detail.practice)"></span></p><HataIntroScene v-if="active" :key="featureId" :featureId="featureId" @navigate="openFeature" @status="status = $event"/></div>
				</div>
				<aside class="hg-note"><strong>覚えておくと安心</strong><p v-html="prose(feature.note)"></p></aside>
				<section class="hg-help"><h2>困ったとき</h2><details v-for="[question, answer] in detail.help" :key="question" class="hg-faq"><summary>{{ question }}</summary><p v-html="prose(answer)"></p></details></section>
				<section v-if="relatedReferences.length" class="hg-reference-bridge" aria-label="この機能の詳しい解説"><div class="hg-section-head"><h2>この機能を、もう少し詳しく</h2><p>知りたい項目だけ開いてね</p></div><div class="hg-reference-grid"><button v-for="r in relatedReferences" :key="r.id" type="button" class="hg-reference-card" data-action="reference" :data-id="r.id" @click="openReference(r.id)"><i :class="r.iconClass" aria-hidden="true"></i><span><strong v-html="brandName(r.title)"></strong><small>{{ r.lead }}</small></span><i class="ti ti-chevron-right" aria-hidden="true"></i></button></div></section>
				<nav class="hg-related" aria-label="関連する使い方"><span>続けて知りたいときに</span><button v-for="id in detail.related" :key="id" type="button" class="hg-link" data-action="feature" :data-id="id" @click="openFeature(id)"><span v-html="brandName(features[id].name)"></span> <i class="ti ti-arrow-right" aria-hidden="true"></i></button></nav>
				<div class="hg-article-end"><div><button type="button" class="hg-btn" data-action="mark-read" :aria-pressed="read.has(featureId)" @click="toggleRead"><i class="ti ti-check" aria-hidden="true"></i> {{ read.has(featureId) ? 'この項目は読んだ' : 'この項目を読んだ' }}</button><p class="hg-read-count" data-read-count>{{ read.size }} / {{ featureCount }} 項目を読んだ · このガイドを開いている間だけ保持</p></div><button v-if="step < course.features.length - 1" type="button" class="hg-link" data-action="next" @click="openFeature(course.features[step + 1])">このカテゴリの次：<span v-html="brandName(features[course.features[step + 1]].name)"></span> <i class="ti ti-arrow-right" aria-hidden="true"></i></button><button v-else type="button" class="hg-link" @click="home">ほかの使い方を探す <i class="ti ti-arrow-right" aria-hidden="true"></i></button></div>
				<details class="hg-source-note"><summary>この図と説明について</summary><p>Hataskeyの実装を参照した説明用の図で、すべての画面・操作を再現したものではないよ。<br>例の人物・ノート・記録は架空で、練習用の入力は項目移動や再読み込みで戻るよ</p><p>参照：{{ feature.source.replace(/:[\d,\-]+/g, '') }}</p></details>
			</article>
		</template>
		<template v-else-if="reference">
			<HataIntroReference :key="reference.id" :reference="reference" @feature="openFeature($event, true)" @reference="openReference"/>
		</template>
		<footer class="hg-footer"><span>図・説明の改訂：{{ guideRevision }} · HataIntro</span></footer>
	</main>
	<p class="hg-sr" aria-live="polite" data-status>{{ status }}</p>
</div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onActivated, onBeforeUnmount, onDeactivated, ref, useId, useTemplateRef } from 'vue';
import HataIntroScene from './HataIntroScene.vue';
import HataIntroReference from './HataIntroReference.vue';
import { features, guideDetails, courses, glossary, destinations, guideRevision } from './content.js';
import { references, referenceById, allCourses } from './reference-content.js';
import { brandName, hataskGuideProse as prose, iconClass } from './prose.js';
import { findFeatures, findReferences } from './search.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';

const props = withDefaults(defineProps<{ darkMode?: boolean; animation?: boolean; initialPage?: 'home' | 'index' }>(), { darkMode: false, animation: true, initialPage: 'home' });
const inHataGoes = inject(HATA_GOES_HOST, null) != null;
const emit = defineEmits<{ exit: [] }>();
const instance = useId();
const main = useTemplateRef<HTMLElement>('main');
const searchInput = useTemplateRef<HTMLInputElement>('searchInput');
const page = ref<'home' | 'index' | 'walk' | 'reference'>(props.initialPage);
const referenceId = ref('');
const courseId = ref('timeline');
const step = ref(0);
const query = ref('');
const committedQuery = ref('');
const filter = ref('all');
const composing = ref(false);
const expanded = ref(false);
const read = ref(new Set<string>());
const status = ref('');
const active = ref(true);
type HistoryEntry = { page: typeof page.value; referenceId: string; courseId: string; step: number; query: string; filter: string; expanded: boolean; returnId?: string };
const guideHistory = ref<HistoryEntry[]>([]);
const backLabel = computed(() => guideHistory.value.length ? '前のページへ' : page.value === 'home' ? 'HataIntroを終了' : '目次へ');
const colorScheme = computed(() => props.darkMode ? 'dark' : 'light');
const course = computed(() => courses.find(c => c.id === courseId.value) ?? courses[0]);
const featureId = computed(() => course.value.features[step.value]);
const feature = computed(() => features[featureId.value]);
const detail = computed(() => guideDetails[featureId.value]);
const destination = computed(() => destinations[featureId.value]);
const found = computed(() => findFeatures(committedQuery.value, filter.value));
const foundReferences = computed(() => findReferences(committedQuery.value, filter.value));
const reference = computed(() => referenceById[referenceId.value]);
const relatedReferences = computed(() => references.filter(r => r.related.includes(featureId.value)));
const categoryLabels = Object.fromEntries(allCourses.map(c => [c.id, c.label]));
const referencesByCourse = Object.fromEntries(allCourses.map(c => [c.id, references.filter(r => r.course === c.id)]));
const showResults = computed(() => page.value === 'index' || Boolean(committedQuery.value));
const homeCourses = computed(() => page.value === 'home' && inHataGoes && filter.value !== 'all' ? allCourses.filter(c => c.id === filter.value) : allCourses);
const featureCount = Object.keys(features).length;
const startingPoints = [['timeline', '読む場所を知る'], ['reaction', '絵文字で気持ちを伝える'], ['visibility', '投稿する前に、届く相手を確認']];
const supportLinks = [['reaction', '絵文字を変更・取り消し'], ['theme', '配色を戻したい'], ['feed', '不具合や要望を伝える']];
let navigation = 0;
let motion: Animation | undefined;
let filterMotion: Animation | undefined;

async function setFilter(id: string) {
	if (filter.value === id) return;
	filter.value = id;
	await nextTick();
	if (!active.value) return;
	filterMotion?.cancel();
	const target = main.value?.querySelector<HTMLElement>(showResults.value ? '[data-guide-search-panel]' : '.hg-courses');
	filterMotion = target?.animate?.([{ opacity: .55 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
	void filterMotion?.finished.catch(() => {});
}

function snapshot(returnId?: string) {
	guideHistory.value.push({ page: page.value, referenceId: referenceId.value, courseId: courseId.value, step: step.value, query: query.value, filter: filter.value, expanded: expanded.value, returnId });
}

async function afterNavigate(selector = '[data-guide-title]') {
	const revision = ++navigation;
	await nextTick();
	if (revision !== navigation || !active.value || !main.value) return;
	motion?.cancel();
	if (inHataGoes || (props.animation && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
		motion = main.value.animate?.([{ opacity: .4, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)' });
		void motion?.finished.catch(() => {});
	}
	const target = main.value.querySelector<HTMLElement>(selector);
	// A return link may be inside a category that collapsed when its page remounted.
	for (let ancestor = target?.parentElement; ancestor && ancestor !== main.value; ancestor = ancestor.parentElement) {
		if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
	}
	target?.focus({ preventScroll: true });
	target?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
}

function openReference(id: string) {
	if (!referenceById[id] || (page.value === 'reference' && referenceId.value === id)) return;
	snapshot(id);
	referenceId.value = id;
	page.value = 'reference';
	composing.value = false;
	void afterNavigate();
}

function openFeature(id: string, returnToFeature = false) {
	const c = courses.find(item => item.features.includes(id));
	if (!c || (page.value === 'walk' && featureId.value === id)) return;
	snapshot(returnToFeature ? id : undefined);
	courseId.value = c.id;
	step.value = c.features.indexOf(id);
	page.value = 'walk';
	expanded.value = false;
	composing.value = false;
	void afterNavigate();
}

function home() {
	guideHistory.value = [];
	page.value = 'home';
	query.value = committedQuery.value = '';
	filter.value = 'all';
	expanded.value = false;
	composing.value = false;
	void afterNavigate();
}

function back() {
	const previous = guideHistory.value.pop();
	if (!previous) {
		if (page.value === 'home') emit('exit'); else home();
		return;
	}
	page.value = previous.page;
	referenceId.value = previous.referenceId;
	courseId.value = previous.courseId;
	step.value = previous.step;
	query.value = previous.query;
	committedQuery.value = previous.query.trim();
	filter.value = previous.filter;
	expanded.value = previous.expanded;
	composing.value = false;
	void afterNavigate(previous.returnId ? `[data-search-result="${previous.returnId}"], :is(.hg-topic-links, .hg-reference-bridge, .hg-reference-practice) :is([data-action="feature"], [data-action="reference"])[data-id="${previous.returnId}"]` : '[data-guide-title]');
}

function inputSearch(event: Event) {
	query.value = (event.target as HTMLInputElement).value;
	if (composing.value || (event as InputEvent).isComposing) return;
	committedQuery.value = query.value.trim();
}

function endComposition(event: CompositionEvent) {
	composing.value = false;
	query.value = (event.target as HTMLInputElement).value;
	committedQuery.value = query.value.trim();
}

function submitSearch() {
	if (!composing.value) committedQuery.value = query.value.trim();
}

function clearQuery() {
	query.value = committedQuery.value = '';
	composing.value = false;
	searchInput.value?.focus();
}

function resetSearch() {
	filter.value = 'all';
	clearQuery();
}

function toggleRead() {
	const id = featureId.value;
	if (read.value.has(id)) read.value.delete(id); else read.value.add(id);
	status.value = `${feature.value.name}${read.value.has(id) ? 'を読んだ項目にしたよ' : 'の読んだ印を外したよ'}`;
}

function suspend() { active.value = false; navigation++; motion?.cancel(); filterMotion?.cancel(); }

onActivated(() => { active.value = true; });
onDeactivated(suspend);
onBeforeUnmount(suspend);
</script>

<style src="./hata-intro.css"></style>
<style src="./ui-s-scenes.css"></style>
<style src="./hatagoes-scenes.css"></style>
<style src="./reference.css"></style>
<style scoped>
.hg-browse-controls { display: flex; align-items: center; gap: 8px; }
.hg-host .hg-host-shortcuts { margin: 0 0 22px; }
.hg-host .hg-host-shortcuts h2 { margin-bottom: 12px; }
.hg-host .hg-host-shortcut-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.hg-host .hg-host-shortcut-grid > :is(button, a) {
	display: flex; align-items: center; gap: 10px; min-width: 0; min-height: 72px;
	padding: 12px; border: 1px solid var(--hg-line); border-radius: 14px;
	background: var(--hg-panel); color: var(--hg-fg); text-align: left; text-decoration: none;
	transition: border-color .16s, transform .16s;
}
.hg-host .hg-host-shortcut-grid > :is(button, a):hover { border-color: var(--hg-accent); transform: translateY(-2px); }
.hg-host .hg-host-shortcut-grid > :is(button, a) > i:first-child { color: var(--hg-accent); font-size: 19px; }
.hg-host .hg-host-shortcut-grid > :is(button, a) > i:last-child { margin-left: auto; color: var(--hg-muted); }
.hg-host .hg-host-shortcut-grid span { display: grid; min-width: 0; gap: 3px; }
.hg-host .hg-host-shortcut-grid strong { font-size: 13px; line-height: 1.4; }
.hg-host .hg-host-shortcut-grid small { color: var(--hg-muted); font-size: 11px; }
.hg-host .hg-filter button { justify-content: center; min-width: 44px; }
.hg-host .hg-filter button i { font-size: 16px; }
@container (max-width: 650px) {
	.hg-host .hg-host-shortcut-grid { grid-template-columns: 1fr; }
	.hg-host .hg-host-shortcut-grid > :is(button, a) { min-height: 56px; }
}
</style>
