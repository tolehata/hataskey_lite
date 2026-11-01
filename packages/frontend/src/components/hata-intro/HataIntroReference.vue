<!--
SPDX-FileCopyrightText: tolehata
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<article class="hg-step-body hg-reference-article" :data-reference-article="reference.id">
	<header><div class="hg-eyebrow"><i class="ti ti-book" aria-hidden="true"></i> 必要なときに読む機能解説</div><h1 data-guide-title tabindex="-1" v-html="brandName(reference.title)"></h1><p class="hg-step-desc" v-html="prose(reference.lead)"></p></header>
	<div class="hg-entry"><div><strong>使う場所</strong><p v-html="prose(reference.where)"></p></div><MkA v-if="reference.link" class="hg-link" :to="reference.link">{{ reference.linkLabel || '本体で開く' }} <i class="ti ti-arrow-up-right" aria-hidden="true"></i></MkA></div>
	<div class="hg-reference-reading">
		<p v-for="(paragraph, index) in paragraphs" :key="index" v-html="prose(paragraph)"></p>
		<figure v-if="reference.diagram" class="hg-reference-diagram">
			<figcaption><strong>{{ reference.diagram.title }}</strong><span>仕組みを表す図 · 実際の操作画面ではありません</span></figcaption>
			<ol><li v-for="([label, description], index) in reference.diagram.nodes" :key="index"><span class="hg-number" aria-hidden="true">{{ index + 1 }}</span><div><strong>{{ label }}</strong><p v-html="prose(description)"></p></div></li></ol>
			<p v-if="reference.diagram.note" class="hg-reference-diagram-note" v-html="prose(reference.diagram.note)"></p>
		</figure>
		<section v-if="reference.steps?.length" class="hg-how"><h2>{{ reference.stepsTitle || 'やってみるときは' }}</h2><ol class="hg-instructions"><li v-for="(instruction, index) in reference.steps" :key="index" v-html="prose(instruction)"></li></ol></section>
		<aside v-if="reference.tips.length" class="hg-note"><h2>覚えておくと安心</h2><p v-for="(tip, index) in reference.tips" :key="index" v-html="prose(tip)"></p></aside>
		<section v-if="reference.help?.length" class="hg-help"><h2>困ったとき</h2><details v-for="[question, answer] in reference.help" :key="question" class="hg-faq"><summary>{{ question }}</summary><p v-html="prose(answer)"></p></details></section>
	</div>
	<section v-if="reference.related.length" class="hg-reference-practice">
		<h2>図と手順も確かめたいとき</h2><p>操作ガイドへ移って、画面の見方を確認できるよ。<br>「前のページへ」でこの解説に戻れる</p>
		<nav class="hg-related" aria-label="関連する操作ガイド"><button v-for="id in reference.related" :key="id" type="button" class="hg-link" data-action="feature" :data-id="id" @click="emit('feature', id)"><span v-html="brandName(features[id].name)"></span> <i class="ti ti-arrow-right" aria-hidden="true"></i></button></nav>
	</section>
	<details v-if="adjacent.length" class="hg-reference-fold"><summary>{{ category.label }}のほかの解説</summary><ul class="hg-topic-links"><li v-for="item in adjacent" :key="item.id"><button type="button" class="hg-link" data-action="reference" :data-id="item.id" @click="emit('reference', item.id)"><span v-html="brandName(item.title)"></span> <i class="ti ti-arrow-right" aria-hidden="true"></i></button></li></ul></details>
	<details class="hg-source-note"><summary>この解説について</summary><p>Hataskeyの実装を参照した機能解説だよ。<br>仕組みの図は説明用で、実際の操作画面とは異なるよ</p><p>参照：{{ reference.source }}</p></details>
</article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { features } from './content.js';
import { references, allCourses } from './reference-content.js';
import { brandName, hataskGuideProse as prose } from './prose.js';
import type { IntroReference } from './reference-content.js';

const props = defineProps<{ reference: IntroReference }>();
const emit = defineEmits<{ feature: [id: string]; reference: [id: string] }>();
const paragraphs = computed(() => props.reference.body.split(/(?:<br\s*\/?>\s*){2,}|\n\n/).filter(Boolean).map(p => p.replace(/<br\s*\/?>/g, '\n')));
const category = computed(() => allCourses.find(c => c.id === props.reference.course)!);
const adjacent = computed(() => references.filter(r => r.course === props.reference.course && r.id !== props.reference.id));
</script>
