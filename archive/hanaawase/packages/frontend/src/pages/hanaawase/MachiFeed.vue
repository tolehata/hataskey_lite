<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<!--
花常「街の様子」＝入舟町のSNS。
⚠️HataskeyのTL意匠は「模倣」であって流用ではない。本体のコンポーネント(MkNote等)を import しない
   ＝この1ファイルとCSSスコープで自己完結させる（CONSTRAINTS: パージ容易性）。
⚠️ロジックは machi.ts（純TS・テスト済み）、文面は machi-lines.ts。ここは表示と時間の管理だけ。
⚠️Math.random は使わない。乱数は seed 付き rng。
-->
<template>
<div
	class="machi"
	:data-reduced="reduced ? 'on' : null"
	:data-idle="idle ? 'on' : null"
	:style="{
		'--m-note-bg': MACHI_NOTE_COLORS.background,
		'--m-note-ink': MACHI_NOTE_COLORS.ink,
		'--m-note-sub': MACHI_NOTE_COLORS.supporting,
	}"
>
	<!--
	時刻でTLの背景が変わる。⚠️切替はフェード（2枚重ねて data-on を入れ替えるだけ）。
	⚠️どちらも「地の色に薄くのせる層」なので、すれ違う途中でも地の色まで抜けない
	   （中間で濃さが1割ほど薄まるだけ。ぱっと切り替わったようには見えない）。
	⚠️空は clock（20秒間隔・既存）から computed で導く。専用のタイマーは足していない。
	-->
	<div class="m-sky" aria-hidden="true" :style="{ '--m-season': seasonSpec.tint }">
		<span class="m-skylayer" :data-on="skyTop === 'a' ? 'on' : null" :style="skyStyle(skyA)"></span>
		<span class="m-skylayer" :data-on="skyTop === 'b' ? 'on' : null" :style="skyStyle(skyB)"></span>
		<!-- たのみごとが流れてきたときのひと呼吸。⚠️:key の付け替えで再生する＝後始末のタイマーが要らない -->
		<span v-if="bloomKey > 0" :key="bloomKey" class="m-bloom"></span>
	</div>

	<header class="m-head">
		<!-- 表題のまわりを季節の花びらが舞う。⚠️ヘッダ自体には overflow を掛けない（!のバッジが欠ける） -->
		<span class="m-headpetals" aria-hidden="true">
			<span
				v-for="(petal, i) in headPetals"
				:key="i"
				class="m-hpetal"
				:data-shape="seasonSpec.shape"
				:style="headPetalStyle(petal)"
			><i></i></span>
		</span>
		<span class="m-title">街の様子<small>入舟町・{{ skyLabel }}</small></span>
		<span class="m-sp"></span>
		<!-- ⚠️投稿数は出さない。生きている感じだけ伝える -->
		<span class="m-live" aria-label="更新中"><i aria-hidden="true"></i>LIVE</span>
		<button
			class="m-hbtn"
			type="button"
			aria-label="このタイムラインについて"
			:aria-expanded="infoOpen"
			@click.stop="infoOpen = !infoOpen"
		>i</button>
		<button class="m-hbtn m-qbtn" type="button" aria-label="たのみごと" @click="openModal('active')">
			!<span v-if="badge > 0" class="m-badge">{{ badge }}</span>
		</button>
	</header>

	<!-- ⚠️フィクション注記。中央揃え＋keep-allで語尾を孤立させない -->
	<div v-if="infoOpen" class="m-infopop" role="note" @click.stop>
		<b>このタイムラインについて</b>
		<p v-for="line in MACHI_INFO_NOTE" :key="line">{{ line }}</p>
	</div>

	<!-- ⚠️遡って読んでいる間は勝手に上へ飛ばさない。ここに留まれる -->
	<button v-if="pending.length > 0" class="m-newbanner" type="button" @click="flush">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
		{{ pending.length }}件の新着
	</button>

	<div ref="feedEl" class="m-feed" @scroll="onScroll">
		<template v-for="item in rendered" :key="item.id">
			<div v-if="item.kind === 'notes'" class="m-group">
				<article
					v-for="note in item.notes"
					:key="note.id"
					class="m-note"
					:data-note="note.id"
					:data-reply="note.reply ? 'on' : null"
					:data-cont="note.cont ? 'on' : null"
					:data-parent="note.hasReplies ? 'on' : null"
					:data-warm="note.warm ? 'on' : null"
					:data-withdrawn="note.withdrawn ? 'on' : null"
					:data-reposted="note.reposted ? 'on' : null"
				>
					<!--
					アイコンは立ち絵の表情差分。⚠️枚数の範囲外は machi.ts が null を返すので組み立てられない。
					⚠️それでも読めなかったときは @error で静かに落として頭文字に戻す（再試行しない）。
					-->
					<div
						class="m-av"
						:data-tachie="personaOf(note.personaId).tachie ? 'on' : null"
						:data-flip="flipId === note.personaId ? 'on' : null"
						:style="{ background: personaOf(note.personaId).color }"
						aria-hidden="true"
					>
						<img
							v-if="avatars[note.personaId]"
							class="m-avimg"
							:src="avatars[note.personaId]"
							alt=""
							loading="lazy"
							decoding="async"
							@error="onFaceError(note.personaId)"
						>
						<template v-else>{{ personaOf(note.personaId).name.slice(0, 1) }}</template>
					</div>
					<div class="m-body">
						<div class="m-nline">
							<span class="m-name">{{ personaOf(note.personaId).name }}</span>
							<span class="m-handle">@{{ personaOf(note.personaId).handle }}</span>
							<span v-if="note.reposted" class="m-repostmark">投稿しなおし</span>
							<time class="m-time">{{ relativeTime(clock - note.bornAt) }}</time>
						</div>
						<!-- ⚠️投稿本文は中央揃えにしない（人間味を残す側） -->
						<p v-if="note.withdrawn" class="m-withdrawn"><span aria-hidden="true">×</span>この投稿は取り消されました</p>
						<p v-else class="m-text">{{ note.text }}</p>
						<div v-if="!note.withdrawn && note.reactions.length > 0" class="m-reacts">
							<span
								v-for="r in note.reactions"
								:key="r.emoji"
								class="m-chip"
								:data-mine="r.mine ? 'on' : null"
								:data-pop="popKey === `${note.id}|${r.emoji}` ? 'on' : null"
							>{{ r.emoji }} <span class="m-n">{{ r.count }}</span></span>
						</div>
						<div v-if="!note.withdrawn && !note.reply" class="m-acts">
							<span class="m-act"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H3l2.5-2.5A8 8 0 1 1 21 12Z" /></svg>返信</span>
							<span class="m-act"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M17 2l4 4-4 4M3 12V9a3 3 0 0 1 3-3h15" /></svg></span>
							<button
								class="m-heart"
								type="button"
								:data-on="note.hearted ? 'on' : null"
								:aria-pressed="note.hearted"
								:aria-label="note.hearted ? 'いいねを取り消す' : 'いいね'"
								@click="onHeart(note)"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 21c-5-3-8-6-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5-3 8-8 11Z" /></svg>
								<!--
								押した手応え。⚠️:key の付け替えだけで再生し、fill-mode:forwards で 0 に着地する
								＝後始末のタイマーも、増え続ける DOM も無い（同時に存在するのは常に1組）。
								-->
								<span v-if="burst && burst.noteId === note.id" :key="burst.key" class="m-sparks" aria-hidden="true">
									<i v-for="(spark, i) in burst.sparks" :key="i" class="m-spark" :data-tone="spark.tone" :style="sparkStyle(spark)"></i>
								</span>
							</button>
						</div>
					</div>
				</article>
			</div>

			<!-- たのみごと。横foil＋その依頼の花に合わせた花びらが5枚だけ舞う -->
			<div
				v-else
				class="m-quest"
				role="button"
				tabindex="0"
				@click="openModal(tabForEntry(item.entry))"
				@keydown.enter="openModal(tabForEntry(item.entry))"
				@keydown.space.prevent="openModal(tabForEntry(item.entry))"
			>
				<div class="m-petals" aria-hidden="true">
					<span v-for="(petal, i) in item.entry.petals" :key="i" class="m-petal" :style="petalStyle(item.entry, petal)"><i></i></span>
				</div>
				<div class="m-qhead">
					<span class="m-qtag">たのみごと</span>
					<span class="m-qby">@{{ personaOf(item.entry.quest.by).handle }}（{{ personaOf(item.entry.quest.by).name }}）</span>
					<span class="m-sp"></span>
					<span class="m-qopen">タップで詳細 ›</span>
				</div>
				<div class="m-qtitle">{{ item.entry.quest.title }}</div>
				<p class="m-qask">{{ item.entry.quest.ask }}</p>
				<div class="m-qfoot">
					<span class="m-qlimit">期限 あと{{ item.entry.limitDays }}日</span>
					<span class="m-sp"></span>
					<button
						v-if="item.entry.state === 'open' || item.entry.state === 'miss'"
						class="m-qtake"
						type="button"
						@click.stop="onAccept(item.entry.qi)"
					>受ける</button>
					<span v-else class="m-qstate">{{ QUEST_STATE_LABEL[item.entry.state] }}</span>
				</div>
			</div>
		</template>
	</div>

	<!--
	頼みごとへ移る前のひと呼吸。
	⚠️進みは width ではなく transform:scaleX で動かす（width のアニメは毎フレーム再レイアウトが走って滑らかにならない）。
	⚠️尺は GO_DELAY_MS と CSS の m-gofill の両方に書かれている。片方だけ変えないこと。
	-->
	<div v-if="going" class="m-goback" role="status" aria-live="polite">
		<div class="m-gocard">
			<p class="m-gotext">まもなく頼みごとに移動します</p>
			<p class="m-gosub">{{ going.quest.title }}</p>
			<div class="m-gobar" aria-hidden="true"><i :key="going.key"></i></div>
		</div>
	</div>

	<!-- 見逃し救済 -->
	<div v-if="toast" class="m-toast" role="status">
		<span class="m-tdot" aria-hidden="true"></span>
		<span>{{ toast.text }}</span>
		<button v-if="toast.withGo" class="m-tgo" type="button" @click="openModal('active')">一覧を見る →</button>
	</div>

	<!-- たのみごと管理モーダル -->
	<div v-if="modalOpen" class="m-modalback" @click.self="modalOpen = false">
		<div class="m-modal" role="dialog" aria-modal="true" aria-label="たのみごと">
			<div class="m-mhead">
				<span class="m-mttl">たのみごと<small>入舟町の頼まれごと</small></span>
				<button class="m-mclose" type="button" aria-label="閉じる" @click="modalOpen = false">×</button>
			</div>
			<div class="m-mtabs">
				<button
					v-for="t in tabs"
					:key="t.key"
					type="button"
					:aria-selected="tab === t.key"
					@click="tab = t.key"
				>{{ t.label }}<span v-if="tabCount(questLog, t.key) > 0" class="m-tabbadge">{{ tabCount(questLog, t.key) }}</span></button>
			</div>
			<div class="m-mlist">
				<p class="m-mcap">引受中 <b>{{ wip }}</b> ／ {{ MAX_WIP }}</p>
				<p v-if="listed.length === 0" class="m-mempty">ここに表示するたのみごとはまだありません。</p>
				<!-- ⚠️成否はシステム判定。手動の完了/失敗ボタンは置かない -->
				<article v-for="entry in listed" :key="entry.qi" class="m-qcard">
					<div class="m-qctop">
						<span class="m-qctitle">{{ entry.quest.title }}</span>
						<span class="m-qcstate" :data-state="entry.state">{{ QUEST_STATE_LABEL[entry.state] }}</span>
					</div>
					<div class="m-qcby">@{{ personaOf(entry.quest.by).handle }}（{{ personaOf(entry.quest.by).name }}）</div>
					<p class="m-qcask">{{ entry.quest.ask }}</p>
					<div class="m-qcmeta">
						<span>期限 あと{{ entry.limitDays }}日</span>
						<span v-if="entry.state === 'open' || entry.state === 'miss'">受けると盤面に挑戦できます</span>
						<span v-else-if="entry.state === 'wip'">{{ entry.quest.goal }}</span>
					</div>
					<div class="m-qcfoot">
						<template v-if="entry.state === 'open' || entry.state === 'miss'">
							<button v-if="wip >= MAX_WIP" class="m-mbtn" type="button" disabled>いっぱいです</button>
							<button v-else class="m-mbtn m-take" type="button" @click="onAccept(entry.qi)">受ける</button>
						</template>
						<button v-else-if="entry.state === 'wip'" class="m-mbtn m-go" type="button" @click="onGo(entry.qi)">たのみごとへ向かう →</button>
						<span v-else class="m-qcby">この依頼は終了しました（{{ entry.state === 'done' ? '達成' : '未達' }}）</span>
					</div>
				</article>
			</div>
		</div>
	</div>
</div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
	MACHI_INFO_NOTE,
	personaOf,
} from './machi-lines.js';
import type { MachiPersonaId, Tanomigoto } from './machi-lines.js';
import {
	FEED_LIMIT,
	ICON_FLIP_MS,
	MACHI_NOTE_COLORS,
	MACHI_SEASON,
	MACHI_SKY,
	MAX_WIP,
	QUEST_STATE_LABEL,
	REPOST_PAUSE_MS,
	REPOST_VISIBLE_MS,
	acceptQuest,
	badgeCount,
	buildOrder,
	buildRepostOrder,
	canGrowReaction,
	createMachiRng,
	facePathOf,
	filterTab,
	growReaction,
	heartReplyDelay,
	initialFaces,
	machiSeason,
	machiSky,
	makeHeadPetals,
	makeHeartSparks,
	makeItem,
	makeNote,
	makeQuestEntry,
	makeRepostSequence,
	markMissed,
	nextIconChangeDelay,
	nextPostDelay,
	nextQuestDelay,
	nextReactionDelay,
	nextRepostDelay,
	pickHeartReply,
	pickIconChange,
	relativeTime,
	resolveQuest,
	showDoneTab,
	tabCount,
	tabForEntry,
	toggleHeart,
	withdrawNote,
	wipCount,
} from './machi.js';
import type {
	FeedSource,
	HeartSpark,
	MachiHeadPetal,
	MachiItem,
	MachiNote,
	MachiSky,
	NoteOptions,
	QuestEntry,
	QuestTab,
	ReactionTarget,
} from './machi.js';

const props = withDefaults(defineProps<{
	/** 画面から外れているときは false にして止める。 */
	active?: boolean;
	/** 乱数の種。省略すると時刻。同じ種なら同じ流れになる。 */
	seed?: number;
	/** ゲーム設定の「アニメーション: 控えめ」を渡す。 */
	reducedMotion?: boolean;
}>(), {
	active: true,
	seed: undefined,
	reducedMotion: false,
});

const emit = defineEmits<{
	(ev: 'accept', payload: { qi: number; quest: Tanomigoto }): void;
	(ev: 'go', payload: { qi: number; quest: Tanomigoto }): void;
}>();

const rng = createMachiRng(props.seed);
const order: FeedSource[] = buildOrder(createMachiRng((props.seed ?? Date.now()) + 1));
const repostOrder = buildRepostOrder(createMachiRng((props.seed ?? Date.now()) + 3));

const items = ref<MachiItem[]>([]);
const pending = ref<MachiItem[]>([]);
const questLog = ref<QuestEntry[]>([]);
const feedEl = ref<HTMLElement>();
const infoOpen = ref(false);
const modalOpen = ref(false);
const tab = ref<QuestTab>('active');
const toast = ref<{ text: string; withGo: boolean }>();
const popKey = ref('');
const clock = ref(Date.now());
/** タイマーが止まっている（＝裏に回っている）間。無限アニメーションを一時停止する印。 */
const idle = ref(true);

const reduced = computed(() => props.reducedMotion);

// --- 季節の花びらと、時刻で変わる空 --------------------------------------
// ⚠️どちらも既存の clock（20秒間隔）から computed で導く。専用のタイマーは1本も足していない。

/** ⚠️7枚を1度だけ組み立てて使い回す（reactive にしない＝毎tickで作り直さない）。 */
const headPetals: MachiHeadPetal[] = makeHeadPetals(createMachiRng((props.seed ?? Date.now()) + 2));
const seasonSpec = computed(() => MACHI_SEASON[machiSeason(new Date(clock.value))]);

const sky = computed<MachiSky>(() => machiSky(new Date(clock.value)));
const skyLabel = computed(() => MACHI_SKY[sky.value].label);
const skyA = ref<MachiSky>(sky.value);
const skyB = ref<MachiSky>(sky.value);
/** いま前面に出ている層。⚠️裏の層に次の空を書いてから入れ替える＝ぱっと変わらずフェードする。 */
const skyTop = ref<'a' | 'b'>('a');
/** たのみごと到着のひと呼吸。⚠️数を増やすだけで再生する（:key の付け替え）。後始末のタイマーは無い。 */
const bloomKey = ref(0);

watch(sky, (next) => {
	if (skyTop.value === 'a') {
		skyB.value = next;
		skyTop.value = 'b';
	} else {
		skyA.value = next;
		skyTop.value = 'a';
	}
});

function skyStyle(id: MachiSky) {
	const spec = MACHI_SKY[id];
	return {
		'--m-sky-top': spec.top,
		'--m-sky-bottom': spec.bottom,
		'--m-sky-glow': spec.glow,
		'--m-sky-glow-y': spec.glowY,
	};
}

function headPetalStyle(petal: MachiHeadPetal) {
	const spec = seasonSpec.value;
	return {
		'--m-hp-color': spec.colors[petal.tone % spec.colors.length],
		'--m-hp-peak': String(spec.peak),
		'--m-hp-size': `${petal.size}px`,
		'--m-hp-dur': `${petal.dur}s`,
		'--m-hp-delay': `${petal.delay}s`,
		'--m-hp-drift': `${petal.drift}px`,
		'--m-hp-spin': `${petal.spin}deg`,
		left: `${petal.left}%`,
	};
}

// --- 住民のアイコン ------------------------------------------------------

const faceNo = ref<Map<MachiPersonaId, number>>(initialFaces());
/** ⚠️読めなかったパスは覚えておいて二度と出さない（404を繰り返さない）。 */
const brokenFaces = ref(new Set<string>());
const flipId = ref<MachiPersonaId | ''>('');

const avatars = computed<Partial<Record<MachiPersonaId, string>>>(() => {
	const out: Partial<Record<MachiPersonaId, string>> = {};
	for (const [id, n] of faceNo.value) {
		const path = facePathOf(id, n);
		if (path !== null && !brokenFaces.value.has(path)) out[id] = path;
	}
	return out;
});

/** ⚠️静かに握りつぶす作法。頭文字のアイコンに戻すだけで、警告も再試行もしない。 */
function onFaceError(personaId: MachiPersonaId) {
	const n = faceNo.value.get(personaId);
	const path = n === undefined ? null : facePathOf(personaId, n);
	if (path !== null) brokenFaces.value.add(path);
}

// --- ♡の手応え ----------------------------------------------------------

const burst = ref<{ key: number; noteId: number; sparks: HeartSpark[] }>();
let burstKey = 0;

function sparkStyle(spark: HeartSpark) {
	return {
		'--s-dx': `${spark.dx}px`,
		'--s-dy': `${spark.dy}px`,
		'--s-size': `${spark.size}px`,
		'--s-dur': `${spark.dur}ms`,
		'--s-delay': `${spark.delay}ms`,
		'--s-spin': `${spark.spin}deg`,
	};
}

const badge = computed(() => badgeCount(questLog.value));
const wip = computed(() => wipCount(questLog.value));
const listed = computed(() => filterTab(questLog.value, tab.value).slice().reverse());
const tabs = computed(() => {
	const list: { key: QuestTab; label: string }[] = [
		{ key: 'active', label: '進行中' },
		{ key: 'open', label: '未受注' },
	];
	// ⚠️「完了・失敗」タブは該当が出てから表示する
	if (showDoneTab(questLog.value)) list.push({ key: 'done', label: '完了・失敗' });
	return list;
});

const entryOf = (qi: number): QuestEntry | undefined => questLog.value.find((e) => e.qi === qi);

/** たのみごとは台帳の実体に解決してから描く（テンプレートに `!` を持ち込まない）。 */
type RenderedItem =
	| { kind: 'notes'; id: number; notes: MachiNote[] }
	| { kind: 'quest'; id: number; entry: QuestEntry };

const rendered = computed<RenderedItem[]>(() => items.value.flatMap((item): RenderedItem[] => {
	if (item.kind === 'notes') return [item];
	const entry = entryOf(item.qi);
	return entry ? [{ kind: 'quest', id: item.id, entry }] : [];
}));

// 旗鯖fork: 花びらは「軌道(.m-petal＝カード高さいっぱい)」と「絵(> i)」の二層。
// ⚠️transform の % は親ではなく自分自身の寸法に対して効くので、
// 絵(10px前後)に translateY(120%) をかけても 12px しか落ちず枠の上端から出られない。
// 軌道側を height:100% にして % を「カードの高さ」に一致させている。
// ⚠️回転は絵の側に分ける。軌道(縦長)を回すと支点が遠く、花びらが弧を描いて飛んでいく。
function petalStyle(entry: QuestEntry, petal: QuestEntry['petals'][number]) {
	return {
		'--m-petal': entry.quest.petal,
		'--m-sway': `${petal.sway}px`,
		'--m-size': `${petal.size}px`,
		'--m-dur': `${petal.dur}s`,
		'--m-delay': `${petal.delay}s`,
		left: `${petal.left}%`,
	};
}

// --- フィードへの差し込み ------------------------------------------------

let nextIdValue = 1;
const nextId = () => nextIdValue++;
let orderIndex = 0;
let questIndex = 0;
let repostIndex = 0;

const atTop = () => (feedEl.value?.scrollTop ?? 0) < 40;

/** 上限を超えた末尾を捨てる。未受注のまま流れ去った依頼は「見逃し」に。 */
function trim() {
	while (items.value.length > FEED_LIMIT) {
		const dropped = items.value.pop();
		if (dropped?.kind === 'quest' && markMissed(questLog.value, dropped.qi)) {
			showToast('見逃したたのみごとがあるかも。', true);
		}
	}
}

/** ⚠️遡って読んでいるときは上に差し込まず、バナーで知らせて留まれるようにする。 */
function emitItem(item: MachiItem) {
	if (atTop()) {
		items.value.unshift(item);
		trim();
	} else {
		pending.value.push(item);
	}
}

function flush() {
	for (const item of pending.value) items.value.unshift(item);
	pending.value = [];
	trim();
	feedEl.value?.scrollTo({ top: 0, behavior: reduced.value ? 'auto' : 'smooth' });
}

function onScroll() {
	if (atTop() && pending.value.length > 0) flush();
}

function nextPost() {
	const source = order[orderIndex % order.length]!;
	orderIndex++;
	emitItem(makeItem(source, Date.now(), nextId));
}

/** items / pending のどちらにいても、取消対象をreactiveな実体として探す。 */
function findNote(noteId: number): MachiNote | undefined {
	for (const collection of [items.value, pending.value]) {
		for (const item of collection) {
			if (item.kind !== 'notes') continue;
			const note = item.notes.find((candidate) => candidate.id === noteId);
			if (note) return note;
		}
	}
	return undefined;
}

function removeFeedItem(itemId: number) {
	items.value = items.value.filter((item) => item.id !== itemId);
	pending.value = pending.value.filter((item) => item.id !== itemId);
}

function emitLine(personaId: MachiNote['personaId'], text: string, options: NoteOptions = {}) {
	const note = makeNote(nextId(), personaId, text, Date.now(), options);
	emitItem({ kind: 'notes', id: note.id, notes: [note] });
}

function spawnQuest() {
	const entry = makeQuestEntry(nextId(), questIndex, rng);
	questIndex++;
	questLog.value.push(entry);
	emitItem({ kind: 'quest', id: nextId(), qi: entry.qi });
	// たのみごとが来た合図に空がひと呼吸だけ暖まる（⚠️控えめ設定のときは出さない）
	if (!reduced.value) bloomKey.value++;
}

/** ⚠️アイコン変更は「変える人」「変えた後の番号」ともに machi.ts が範囲内を保証する。 */
function changeIcon() {
	const change = pickIconChange(faceNo.value, rng);
	if (!change) return;
	faceNo.value.set(change.personaId, change.face);
	flipId.value = change.personaId;
	window.clearTimeout(flipTimer);
	flipTimer = window.setTimeout(() => { flipId.value = ''; }, ICON_FLIP_MS);
	// 「アイコン変えました」という趣旨の投稿が流れる
	emitLine(change.personaId, change.text);
}

// --- リアクションが時間で育つ -------------------------------------------

/** 1つ増やせたら true。増やせなければ false（呼び出し側は待ち時間を伸ばす）。 */
function reactionTick(): boolean {
	const feed = feedEl.value;
	if (!feed) return false;
	const now = Date.now();
	// ⚠️まず「まだ育つ投稿があるか」を DOM を触らずに判定する。
	// ここで抜けないと、放置中も全投稿ぶんの getBoundingClientRect が回り続けて強制レイアウトになる。
	const growable: MachiNote[] = [];
	for (const item of items.value) {
		if (item.kind !== 'notes') continue;
		for (const note of item.notes) if (canGrowReaction(note, now)) growable.push(note);
	}
	if (growable.length === 0) return false;

	const bounds = feed.getBoundingClientRect();
	const seen = new Map<string, boolean>();
	for (const el of Array.from(feed.querySelectorAll<HTMLElement>('[data-note]'))) {
		const rect = el.getBoundingClientRect();
		seen.set(el.dataset.note ?? '', rect.bottom > bounds.top + 8 && rect.top < bounds.bottom - 8);
	}
	const targets: ReactionTarget[] = growable.map((note) => ({
		note,
		visible: seen.get(String(note.id)) === true,
	}));
	const hit = growReaction(targets, now, rng);
	if (!hit) return false;
	popKey.value = `${hit.note.id}|${hit.emoji}`;
	window.setTimeout(() => { popKey.value = ''; }, 360);
	return true;
}

// --- 操作 ---------------------------------------------------------------

const heartTimers = new Set<number>();

function onHeart(note: MachiNote) {
	if (!toggleHeart(note)) {
		burst.value = undefined; // 取り消しのときは散らさない
		return;
	}
	// 押した手応え。⚠️粒は fill-mode:forwards で消え切るので、消すためのタイマーは要らない
	if (!reduced.value) {
		burstKey++;
		burst.value = { key: burstKey, noteId: note.id, sparks: makeHeartSparks(rng) };
	}
	// ⚠️返信ではなく、宛先を書かない独立した投稿（空リプ）で少し経ってから反応が返る
	const timer = window.setTimeout(() => {
		heartTimers.delete(timer);
		// warm ＝ 表示側が一度だけ淡く光らせるための印。文面も宛先も空リプのまま変えない
		emitLine(note.personaId, pickHeartReply(rng), { warm: true });
	}, heartReplyDelay(rng));
	heartTimers.add(timer);
}

function onAccept(qi: number) {
	const result = acceptQuest(questLog.value, qi);
	if (result === 'full') {
		showToast(`いま引き受けられるのは${MAX_WIP}つまで。`, false);
		return;
	}
	if (result !== 'accepted') return;
	const entry = entryOf(qi);
	if (!entry) return;
	emitLine(entry.quest.by, entry.quest.wip);
	emit('accept', { qi, quest: entry.quest });
}

/** 頼みごとへ移るまでの溜め ms。⚠️進みの帯のアニメ尺と必ず揃える（CSS の m-gofill）。 */
const GO_DELAY_MS = 1500;
const going = ref<{ qi: number; quest: Tanomigoto; key: number }>();
let goTimer = 0;
let goKey = 0;

function onGo(qi: number) {
	const entry = entryOf(qi);
	if (!entry) return;
	// ⚠️二重押しで二重に飛ばさない（カウント中は受け付けない）
	if (going.value) return;
	modalOpen.value = false;
	// ⚠️動きを控える設定のときは溜めを作らず即座に移る（待たせるだけになるため）
	if (reduced.value) {
		emit('go', { qi, quest: entry.quest });
		return;
	}
	going.value = { qi, quest: entry.quest, key: ++goKey };
	goTimer = window.setTimeout(() => {
		const g = going.value;
		going.value = undefined;
		if (g) emit('go', { qi: g.qi, quest: g.quest });
	}, GO_DELAY_MS);
}

/** ⚠️カウント中に画面を離れたら、移動そのものを取り消す（戻ってきて突然飛ばされないように）。 */
function cancelGo() {
	window.clearTimeout(goTimer);
	goTimer = 0;
	going.value = undefined;
}

function openModal(next: QuestTab) {
	tab.value = showDoneTab(questLog.value) || next !== 'done' ? next : 'active';
	modalOpen.value = true;
	infoOpen.value = false;
}

let toastTimer = 0;

function showToast(text: string, withGo: boolean) {
	toast.value = { text, withGo };
	window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => { toast.value = undefined; }, 5200);
}

/** 盤面の結果を台帳に反映する。⚠️成否はシステム判定なので index.vue 側から呼ぶ。 */
function reportResult(qi: number, result: 'done' | 'fail') {
	if (!resolveQuest(questLog.value, qi, result)) return;
	const entry = entryOf(qi);
	if (entry) emitLine(entry.quest.by, result === 'done' ? entry.quest.done : entry.quest.fail);
}

defineExpose({ reportResult, openQuests: () => openModal('active') });

// --- タイマー -----------------------------------------------------------

let postTimer = 0;
let reactTimer = 0;
let questTimer = 0;
let repostTimer = 0;
let repostStepTimer = 0;
let clockTimer = 0;
/** アイコン変更。⚠️90〜210秒に1回・DOMを測らない・投稿1本だけ（放置しても負荷は増えない）。 */
let iconTimer = 0;
/** 変わったアイコンを光らせる後始末。⚠️一過性。stop/unmount で必ず落とす。 */
let flipTimer = 0;
let running = false;
let activeRepost: { itemId: number; noteId: number } | undefined;

function schedulePost() {
	postTimer = window.setTimeout(() => { nextPost(); schedulePost(); }, nextPostDelay(rng));
}

/** 育つ投稿が無いあいだの待ち時間 ms。⚠️新しい投稿が流れれば次のtickで再開する。 */
const REACTION_IDLE_MS = 6000;

function scheduleReaction(delay = nextReactionDelay(rng)) {
	reactTimer = window.setTimeout(() => {
		// ⚠️増やせなかったときは間隔を空ける（放置しても回り続けないように）
		const grew = reactionTick();
		scheduleReaction(grew ? undefined : REACTION_IDLE_MS);
	}, delay);
}

function scheduleQuest() {
	questTimer = window.setTimeout(() => { spawnQuest(); scheduleQuest(); }, nextQuestDelay(rng));
}

/**
 * 取消前の投稿を流す → 取消表示へ切り替える → 同じ人物の書きなおしと別NPCの反応を流す。
 * ⚠️サーバー通信・保存は行わず、既存フィードへローカルな MachiItem を差し込むだけ。
 */
function beginRepost() {
	if (!running) return;
	const sceneIndex = repostOrder[repostIndex % repostOrder.length]!;
	repostIndex++;
	const sequence = makeRepostSequence(sceneIndex, Date.now(), nextId);
	emitItem(sequence.original);
	activeRepost = { itemId: sequence.original.id, noteId: sequence.originalNoteId };
	repostStepTimer = window.setTimeout(() => {
		if (!running) return;
		const original = findNote(sequence.originalNoteId);
		if (!original) {
			activeRepost = undefined;
			scheduleRepost();
			return;
		}
		withdrawNote(original);
		repostStepTimer = window.setTimeout(() => {
			if (!running) return;
			emitItem(sequence.followup);
			activeRepost = undefined;
			scheduleRepost();
		}, REPOST_PAUSE_MS);
	}, REPOST_VISIBLE_MS);
}

function scheduleRepost() {
	if (!running) return;
	repostTimer = window.setTimeout(beginRepost, nextRepostDelay(rng));
}

/** 非表示になった途中の取消劇は取り除き、再開後に中途半端な状態を残さない。 */
function cancelActiveRepost() {
	window.clearTimeout(repostStepTimer);
	if (activeRepost) removeFeedItem(activeRepost.itemId);
	activeRepost = undefined;
}

function scheduleIcon() {
	iconTimer = window.setTimeout(() => { changeIcon(); scheduleIcon(); }, nextIconChangeDelay(rng));
}

function start() {
	if (running) return;
	running = true;
	idle.value = false;
	// ⚠️止まっている間に進んだぶんを取り戻す（時刻表示と空を、再開の瞬間に合わせ直す）
	clock.value = Date.now();
	schedulePost();
	scheduleReaction();
	scheduleQuest();
	scheduleRepost();
	scheduleIcon();
	clockTimer = window.setInterval(() => { clock.value = Date.now(); }, 20000);
}

function stop() {
	running = false;
	// ⚠️裏に回っている間は無限アニメーションも止める（花びら・foil・LIVEの点滅）
	idle.value = true;
	window.clearTimeout(postTimer);
	window.clearTimeout(reactTimer);
	window.clearTimeout(questTimer);
	window.clearTimeout(repostTimer);
	window.clearTimeout(iconTimer);
	window.clearTimeout(flipTimer);
	window.clearInterval(clockTimer);
	cancelActiveRepost();
	// ⚠️印を残したままだと、あとから流れてきた同じ住民の投稿で光り直してしまう
	flipId.value = '';
	// ⚠️移動のカウントも畳む。残すと、裏に回っている間に飛ばされる
	cancelGo();
}

function onVisibility() {
	if (window.document.hidden) stop();
	else if (props.active) start();
}

function onDocumentClick() {
	infoOpen.value = false;
}

onMounted(() => {
	const now = Date.now();
	// 開いた瞬間から町が動いているように、少しだけ積んでおく
	for (let i = 0; i < 7; i++) {
		const source = order[orderIndex % order.length]!;
		orderIndex++;
		items.value.unshift(makeItem(source, now - (7 - i) * 9000, nextId));
	}
	spawnQuest();
	window.document.addEventListener('click', onDocumentClick);
	window.document.addEventListener('visibilitychange', onVisibility);
	if (props.active) start();
});

onUnmounted(() => {
	stop();
	for (const timer of heartTimers) window.clearTimeout(timer);
	heartTimers.clear();
	window.clearTimeout(toastTimer);
	window.document.removeEventListener('click', onDocumentClick);
	window.document.removeEventListener('visibilitychange', onVisibility);
});

watch(() => props.active, (value) => {
	if (value && !window.document.hidden) start();
	else stop();
});
</script>

<style lang="scss" scoped>
/* ⚠️本体のCSS変数には寄りかからず、.hanaawase-scope の値をフォールバック付きで借りる。
   単体で置いても壊れない＝丸ごと消せる（パージ容易性）。 */
.machi {
	--m-bg: var(--bg, #2b2620);
	--m-panel: var(--panel, #3a332b);
	--m-ink: var(--ink, #f4efe3);
	--m-sub: var(--sub, #b0a692);
	--m-line: var(--line, #4a4238);
	--m-line-2: color-mix(in srgb, var(--m-line) 55%, transparent);
	--m-accent: #6fae7f;
	--m-seal: #d24b44;
	--m-gold: #c9a04e;
	--m-chip: rgb(255 255 255 / 6%);
	--m-chip-on: rgb(111 174 127 / 18%);
	--m-mincho: "Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif JP", serif;

	position: relative;
	display: flex;
	overflow: hidden;
	height: var(--m-height, 560px);
	flex-direction: column;
	border: 1px solid var(--m-line);
	border-radius: 14px;
	background: var(--m-bg);
	color: var(--m-ink);
	isolation: isolate;
}

/* --- 時刻で変わる空（TLの背景） ---
   ⚠️切替はフェード。2枚を重ね、裏に次の空を書いてから data-on を入れ替える。
   ⚠️2枚とも「地の色に薄くのせる層」なので、すれ違う途中でも地の色まで抜けない。
   ⚠️不透明度は machi.ts の MACHI_SKY 側で 30% 以下に縛ってある（本文が読めなくなるのが害）。 */
.m-sky { position: absolute; z-index: 0; overflow: hidden; inset: 0; border-radius: inherit; pointer-events: none; }
.m-skylayer {
	position: absolute; inset: 0; opacity: 0;
	background-image:
		radial-gradient(130% 62% at 50% var(--m-sky-glow-y, 50%), var(--m-sky-glow, transparent), transparent 64%),
		linear-gradient(180deg, var(--m-sky-top, transparent), var(--m-sky-bottom, transparent)),
		linear-gradient(146deg, var(--m-season, transparent), transparent 58%);
	transition: opacity 2600ms ease; /* = SKY_FADE_MS */
}
.m-skylayer[data-on] { opacity: 1; }
/* たのみごとが来たときのひと呼吸。⚠️:key の付け替えで再生し、forwards で 0 に着地する＝後始末が要らない */
.m-bloom {
	position: absolute; inset: 0; opacity: 0;
	background-image: radial-gradient(84% 48% at 50% 0%, color-mix(in srgb, var(--m-seal) 26%, transparent), transparent 70%);
	animation: m-bloom 3.4s ease-out forwards; /* = QUEST_BLOOM_MS */
}

/* --- ヘッダ --- */
.m-head {
	position: relative;
	z-index: 6;
	display: flex;
	flex: none;
	align-items: center;
	gap: 8px;
	padding: 12px 14px;
	border-bottom: 1px solid var(--m-line);
	background: var(--m-panel);
}
/* --- 表題まわりの季節の花びら ---
   ⚠️overflow はこの層にだけ掛ける。.m-head に掛けると ! のバッジ（top:-3px）が欠ける。 */
.m-headpetals { position: absolute; z-index: 0; overflow: hidden; inset: 0; pointer-events: none; }
.m-head > .m-title, .m-head > .m-live, .m-head > .m-hbtn, .m-head > .m-sp { position: relative; z-index: 1; }
/* 軌道。⚠️height:100% でないと translateY の % が花びらの数px基準になり、ヘッダの上端から降りてこない */
.m-hpetal {
	position: absolute; top: 0; width: var(--m-hp-size, 7px); height: 100%; opacity: 0;
	animation: m-headfall var(--m-hp-dur, 12s) linear var(--m-hp-delay, 0s) infinite;
}
/* 絵。⚠️回転はこちら側に分ける（縦長の軌道を回すと支点が遠く、弧を描いて飛んでいく） */
.m-hpetal > i {
	position: absolute; bottom: 0; left: 0; display: block;
	width: var(--m-hp-size, 7px); height: var(--m-hp-size, 7px);
	background: var(--m-hp-color, #f2a7b8);
	animation: m-headspin var(--m-hp-dur, 12s) linear var(--m-hp-delay, 0s) infinite;
}
.m-hpetal[data-shape="sakura"] > i { border-radius: 62% 0 62% 0; }
.m-hpetal[data-shape="leaf"] > i { height: calc(var(--m-hp-size, 7px) * 1.35); border-radius: 0 72% 0 72%; }
.m-hpetal[data-shape="ginkgo"] > i { height: calc(var(--m-hp-size, 7px) * .78); border-radius: 0 0 92% 92%; }
.m-hpetal[data-shape="snow"] > i { border-radius: 50%; }

.m-title { font-family: var(--m-mincho); font-size: 16px; font-weight: 600; letter-spacing: .1em; }
.m-title small { margin-left: 6px; color: var(--m-sub); font-size: 11px; letter-spacing: .04em; }
.m-sp { flex: 1; }
.m-live {
	display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px;
	border: 1px solid color-mix(in srgb, var(--m-seal) 34%, transparent); border-radius: 999px;
	color: var(--m-seal); font-size: 11px; font-weight: 700; letter-spacing: .12em;
}
.m-live i { width: 7px; height: 7px; border-radius: 50%; background: var(--m-seal); animation: m-blink 1.5s ease-in-out infinite; }
.m-hbtn {
	display: grid; width: 30px; height: 30px; flex: none; place-items: center;
	border: 1px solid var(--m-line); border-radius: 50%; background: transparent;
	color: var(--m-sub); font-family: var(--m-mincho); font-size: 15px; font-weight: 700; line-height: 1; cursor: pointer;
}
.m-hbtn:hover, .m-hbtn:focus-visible { border-color: var(--m-sub); color: var(--m-ink); }
.m-qbtn { position: relative; overflow: visible; border-color: color-mix(in srgb, var(--m-seal) 34%, transparent); color: var(--m-seal); }
.m-badge {
	position: absolute; top: -3px; right: -2px; display: grid; min-width: 16px; height: 16px; place-items: center;
	padding: 0 3px; border-radius: 9px; background: var(--m-seal); box-shadow: 0 0 0 2px var(--m-panel);
	color: #fff; font-size: 11px;
}

/* --- ⓘ ポップ（⚠️中央揃え・語尾を孤立させない） --- */
.m-infopop {
	position: absolute; z-index: 9; top: 52px; right: 12px; width: max-content; max-width: calc(100% - 24px);
	padding: 13px 16px; border: 1px solid var(--m-line); border-radius: 12px; background: var(--m-panel);
	box-shadow: 0 12px 30px -12px rgb(0 0 0 / 50%);
	color: var(--m-ink); font-size: 12px; line-height: 1.85; text-align: center;
	word-break: keep-all; overflow-wrap: break-word; line-break: strict;
}
.m-infopop b { display: block; margin-bottom: 6px; color: var(--m-sub); font-size: 11px; letter-spacing: .1em; }
.m-infopop p { margin: 0 0 5px; }
.m-infopop p:last-child { margin-bottom: 0; }

/* --- 新着バナー --- */
.m-newbanner {
	position: absolute; z-index: 7; top: 56px; left: 50%; display: inline-flex; align-items: center; gap: 6px;
	padding: 7px 16px; border: 0; border-radius: 999px; background: var(--m-accent);
	box-shadow: 0 8px 22px -8px rgb(0 0 0 / 50%); color: #17231a; font: inherit; font-size: 12.5px; font-weight: 700;
	transform: translateX(-50%); cursor: pointer; animation: m-drop .25s ease;
}
.m-newbanner svg { width: 14px; height: 14px; }

/* --- フィード --- */
/* ⚠️空(.m-sky)は z-index:0 で敷いてあるので、フィードは1段上に置く */
.m-feed { position: relative; z-index: 1; flex: 1; padding: 6px 0 20px; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; }
.m-feed::-webkit-scrollbar { width: 7px; }
.m-feed::-webkit-scrollbar-thumb { border-radius: 4px; background: var(--m-line); }

.m-note {
	position: relative; display: flex; gap: 11px; padding: 12px 15px;
	border-bottom: 1px solid var(--m-line-2); background: var(--m-note-bg); color: var(--m-note-ink);
	animation: m-slidein .5s cubic-bezier(.22, 1, .36, 1);
}
/* ⚠️会話の途中に境界線を引かない。まとまりの最後にだけ1本引く */
.m-note[data-parent], .m-note[data-reply][data-cont] { padding-bottom: 6px; border-bottom: 0; }
.m-note[data-reply] { padding-top: 10px; padding-left: 44px; }
.m-note[data-reply] .m-av { width: 30px; height: 30px; font-size: 13px; }
/* 親のアバター下から伸びる縦線 */
.m-note[data-parent]::after {
	position: absolute; top: 56px; bottom: 0; left: 35px; width: 2px; border-radius: 2px;
	background: var(--m-line); content: "";
}
/* 返信へ差し込むエルボー */
.m-note[data-reply]::before {
	position: absolute; top: 0; left: 35px; width: 10px; height: 23px;
	border-bottom: 2px solid var(--m-line); border-bottom-left-radius: 10px; border-left: 2px solid var(--m-line); content: "";
}
/* 次の返信へ線を継続 */
.m-note[data-reply][data-cont]::after {
	position: absolute; top: 21px; bottom: 0; left: 35px; width: 2px; border-radius: 2px;
	background: var(--m-line); content: "";
}
.m-note[data-withdrawn] { background: color-mix(in srgb, var(--m-note-bg) 90%, var(--m-panel)); }
.m-note[data-withdrawn] .m-av { filter: grayscale(.55); opacity: .72; }
.m-note[data-withdrawn] .m-name, .m-note[data-withdrawn] .m-handle, .m-note[data-withdrawn] .m-time { opacity: .72; }

.m-av {
	position: relative; display: grid; width: 42px; height: 42px; flex: none; place-items: center;
	border-radius: 12px; color: #fff; font-family: var(--m-mincho); font-size: 18px; font-weight: 600;
}
.m-av[data-tachie]::after {
	position: absolute; inset: -2px; border: 1.5px solid var(--m-accent); border-radius: 13px; opacity: .55; content: "";
}
/* アイコン＝立ち絵の表情差分。⚠️読めなければ @error で消えて頭文字に戻る（この img ごと出なくなる） */
.m-avimg { display: block; width: 100%; height: 100%; border-radius: inherit; object-fit: cover; }
/* アイコンを変えた住民。⚠️金の輪が一度だけ広がって消える（forwards で opacity 0 に着地） */
.m-av[data-flip] { animation: m-avpop .8s cubic-bezier(.34, 1.56, .64, 1); }
.m-av[data-flip]::before {
	position: absolute; z-index: 1; inset: -2px; border: 1.5px solid var(--m-gold); border-radius: 13px;
	opacity: 0; content: ""; animation: m-avring 1.1s ease-out forwards;
}
.m-body { min-width: 0; flex: 1; }
.m-nline { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.m-name { font-size: 13.5px; font-weight: 700; }
.m-handle { color: var(--m-note-sub); font-size: 12px; }
.m-time { margin-left: auto; color: var(--m-note-sub); font-size: 11.5px; }
.m-repostmark {
	display: inline-flex; align-items: center; min-height: 18px; padding: 0 7px;
	border: 1px solid color-mix(in srgb, var(--m-accent) 44%, transparent); border-radius: 999px;
	background: color-mix(in srgb, var(--m-accent) 12%, transparent); color: var(--m-note-sub);
	font-size: 10.5px; line-height: 1;
}
.m-text { margin: 3px 0 0; font-size: 14px; line-height: 1.62; word-break: break-word; }
.m-withdrawn {
	display: flex; align-items: center; gap: 7px; margin: 5px 0 0; color: var(--m-note-sub);
	font-size: 13px; font-style: italic; line-height: 1.55;
}
.m-withdrawn span {
	display: inline-grid; width: 17px; height: 17px; flex: none; place-items: center;
	border: 1px solid color-mix(in srgb, var(--m-note-sub) 48%, transparent); border-radius: 50%;
	font-size: 12px; font-style: normal; line-height: 1;
}

.m-reacts { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.m-chip {
	display: inline-flex; align-items: center; gap: 5px; padding: 2px 9px;
	border: 1px solid var(--m-line); border-radius: 999px; background: var(--m-chip);
	color: var(--m-ink); font-size: 12.5px;
}
.m-chip[data-mine] { border-color: var(--m-seal); background: color-mix(in srgb, var(--m-seal) 16%, transparent); }
.m-chip[data-mine] .m-n { color: var(--m-seal); }
.m-chip[data-pop] { animation: m-pop .34s ease; }
.m-n { color: var(--m-note-sub); font-size: 13px; letter-spacing: .02em; }

.m-acts { display: flex; gap: 20px; margin-top: 9px; color: var(--m-note-sub); }
.m-act, .m-heart { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; }
.m-act svg, .m-heart svg { width: 14px; height: 14px; }
.m-heart { position: relative; padding: 2px; border: 0; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; transition: color .18s; }
.m-heart:hover, .m-heart:focus-visible { color: var(--m-seal); }
.m-heart[data-on] { color: var(--m-seal); animation: m-beat .42s cubic-bezier(.34, 1.56, .64, 1); }
.m-heart[data-on] svg { fill: var(--m-seal); }

/* --- ♡の手応え（押した瞬間だけ花びらが散る） ---
   ⚠️どの粒も fill-mode:forwards で opacity 0 に着地する＝消すためのタイマーを持たない。
   ⚠️同時に存在するのは常に1組（7枚）だけ。連打しても :key の付け替えで作り直されるだけ。 */
.m-sparks { position: absolute; inset: 0; pointer-events: none; }
.m-sparks::before {
	position: absolute; inset: -7px; border: 1.5px solid var(--m-seal); border-radius: 50%;
	opacity: 0; content: ""; animation: m-heartring .62s ease-out forwards;
}
.m-spark {
	position: absolute; top: 50%; left: 50%; display: block;
	width: var(--s-size, 6px); height: var(--s-size, 6px); margin: calc(var(--s-size, 6px) / -2);
	border-radius: 62% 0 62% 0; background: var(--m-seal); opacity: 0;
	animation: m-spark var(--s-dur, 800ms) cubic-bezier(.16, .8, .34, 1) var(--s-delay, 0ms) forwards;
}
.m-spark[data-tone="1"] { background: var(--m-gold); }
.m-spark[data-tone="2"] { background: #f2a7b8; }

/* ♡への空リプが着いたときの、一度きりの淡い光。
   ⚠️宛先を書かない独立した投稿という仕様はそのまま。見た目で「届いた」ことだけ足す。
   ⚠️screen 合成なので本文を暗くしない（読めなくならない）。
   ⚠️縦線に使う ::after と衝突しないよう、親でも返信でもない投稿だけに掛ける。 */
.m-note[data-warm]:not([data-parent]):not([data-reply])::after {
	position: absolute; z-index: 0; inset: 0; pointer-events: none; content: "";
	background: linear-gradient(90deg, color-mix(in srgb, var(--m-seal) 30%, transparent), transparent 58%);
	mix-blend-mode: screen; opacity: 0; animation: m-warmfade 2.8s ease-out .12s forwards;
}

/* --- たのみごと（TLに流れるカード） --- */
.m-quest {
	position: relative; overflow: hidden; margin: 10px 12px; isolation: isolate;
	border: 1px solid color-mix(in srgb, var(--m-seal) 32%, transparent); border-radius: 12px;
	background: color-mix(in srgb, var(--m-seal) 9%, var(--m-panel));
	animation: m-slidein .5s cubic-bezier(.22, 1, .36, 1); cursor: pointer;
}
.m-quest:hover, .m-quest:focus-visible { border-color: color-mix(in srgb, var(--m-seal) 50%, transparent); }
/* 横foil：休む → ゆっくり流れる → また休む。淡く、艶に見せる */
.m-quest::after {
	position: absolute; z-index: 1; inset: 0; border-radius: inherit; pointer-events: none; content: "";
	background: linear-gradient(102deg, transparent 30%,
		color-mix(in srgb, var(--m-seal) 9%, transparent) 42%,
		rgb(255 255 255 / 22%) 50%,
		color-mix(in srgb, var(--m-gold) 12%, transparent) 58%,
		transparent 70%);
	background-position: 170% 0; background-size: 300% 100%;
	mix-blend-mode: screen; opacity: .4; animation: m-foil 16s ease-in-out infinite;
}
.m-quest > * { position: relative; z-index: 2; }
.m-petals { position: absolute; z-index: 1; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none; }
/* ⚠️おしとやかに。5枚だけ、ゆっくり、薄く */
/* 軌道。⚠️height:100% でないと translateY の % が花びらの10pxを基準にしてしまい枠の上端から落ちない */
.m-petal {
	position: absolute; top: 0; height: 100%; width: var(--m-size, 10px); opacity: 0;
	animation: m-petalfall var(--m-dur, 10s) linear var(--m-delay, 0s) infinite;
}
/* 絵。⚠️回転はこちらに分ける（軌道を回すと支点が遠すぎて弧を描いて飛ぶ） */
.m-petal > i {
	position: absolute; bottom: 0; left: 0; display: block;
	width: var(--m-size, 10px); height: var(--m-size, 10px);
	border-radius: 50% 0 50% 0; background: var(--m-petal, #f2a7b8);
	animation: m-petalspin var(--m-dur, 10s) linear var(--m-delay, 0s) infinite;
}
.m-qhead { display: flex; align-items: center; gap: 9px; padding: 11px 14px 6px; }
.m-qtag {
	padding: 1px 7px; border: 1px solid color-mix(in srgb, var(--m-seal) 40%, transparent); border-radius: 5px;
	color: var(--m-seal); font-family: var(--m-mincho); font-size: 11px; letter-spacing: .14em;
}
.m-qby { color: var(--m-sub); font-size: 12px; }
.m-qopen { color: var(--m-seal); font-size: 11px; white-space: nowrap; opacity: .85; }
.m-qtitle { padding: 0 14px; font-family: var(--m-mincho); font-size: 15px; font-weight: 600; }
.m-qask { margin: 0; padding: 5px 14px 0; font-size: 13.5px; line-height: 1.6; }
.m-qfoot { display: flex; align-items: center; gap: 8px; padding: 11px 14px 13px; }
.m-qlimit, .m-qstate { color: var(--m-sub); font-size: 11px; }
.m-qstate { color: var(--m-accent); }
.m-qtake {
	padding: 8px 16px; border: 0; border-radius: 8px; background: var(--m-seal);
	color: #fff; font: inherit; font-family: var(--m-mincho); font-size: 13px; cursor: pointer;
}
.m-qtake:hover { filter: brightness(1.06); }

/* --- 見逃しトースト（⚠️中央揃え・keep-all） --- */
/* 頼みごとへ移る前のひと呼吸。⚠️モーダル(z-index:20)より手前に出す */
.m-goback {
	position: absolute; z-index: 24; inset: 0; display: grid; place-items: center;
	background: rgb(18 15 12 / 62%); animation: m-goveil .2s ease;
}
.m-gocard {
	width: min(300px, 82%); padding: 20px 22px; border: 1px solid var(--m-line); border-radius: 14px;
	background: var(--m-panel); box-shadow: 0 18px 44px -14px rgb(0 0 0 / 70%); text-align: center;
	animation: m-gocard .28s cubic-bezier(.22, 1, .36, 1);
}
/* ⚠️中央揃え＋keep-all（利用者の方針。語尾を孤立させない） */
.m-gotext {
	margin: 0; color: var(--m-ink); font-family: var(--m-mincho); font-size: 15px; letter-spacing: .04em;
	word-break: keep-all; overflow-wrap: anywhere;
}
.m-gosub {
	margin: 7px 0 0; color: var(--m-sub); font-size: 12px;
	word-break: keep-all; overflow-wrap: anywhere;
}
.m-gobar {
	overflow: hidden; height: 4px; margin-top: 15px; border-radius: 2px;
	background: color-mix(in srgb, var(--m-seal) 20%, transparent);
}
/* ⚠️width ではなく scaleX。width を animate すると毎フレーム再レイアウトが走って滑らかにならない */
.m-gobar > i {
	display: block; height: 100%; border-radius: inherit; background: var(--m-seal);
	transform: scaleX(0); transform-origin: left center;
	animation: m-gofill 1500ms linear forwards;
}
@keyframes m-goveil { from { opacity: 0; } to { opacity: 1; } }
@keyframes m-gocard { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes m-gofill { from { transform: scaleX(0); } to { transform: scaleX(1); } }

.m-toast {
	position: absolute; z-index: 8; bottom: 16px; left: 50%; display: inline-flex; align-items: center; gap: 9px;
	width: max-content; max-width: calc(100% - 28px); padding: 10px 16px; border-radius: 12px;
	background: var(--m-ink); box-shadow: 0 12px 30px -10px rgb(0 0 0 / 60%);
	color: var(--m-bg); font-size: 12.5px; text-align: center; transform: translateX(-50%);
	word-break: keep-all; overflow-wrap: break-word; line-break: strict; animation: m-rise .35s ease;
}
.m-tdot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--m-seal); animation: m-blink 1.6s infinite; }
.m-tgo { border: 0; background: transparent; color: var(--m-seal); font: inherit; font-family: var(--m-mincho); font-weight: 600; white-space: nowrap; cursor: pointer; }

/* --- たのみごと管理モーダル --- */
.m-modalback { position: absolute; z-index: 20; display: flex; align-items: flex-end; justify-content: center; inset: 0; background: rgb(0 0 0 / 45%); }
.m-modal {
	display: flex; width: 100%; max-height: 86%; flex-direction: column;
	border: 1px solid var(--m-line); border-top-left-radius: 16px; border-top-right-radius: 16px;
	background: var(--m-bg); animation: m-sheetup .34s cubic-bezier(.22, 1, .36, 1);
}
.m-mhead { position: relative; display: flex; align-items: center; justify-content: center; padding: 14px 44px 10px; border-bottom: 1px solid var(--m-line); }
.m-mttl { font-family: var(--m-mincho); font-size: 16px; font-weight: 600; letter-spacing: .1em; text-align: center; }
.m-mttl small { margin-left: 6px; color: var(--m-sub); font-size: 11px; }
.m-mclose { position: absolute; top: 11px; right: 14px; width: 30px; height: 30px; border: 1px solid var(--m-line); border-radius: 50%; background: transparent; color: var(--m-sub); font-size: 16px; cursor: pointer; }
.m-mtabs { display: flex; justify-content: center; gap: 6px; padding: 10px 14px 2px; }
.m-mtabs button {
	display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px;
	border: 1px solid var(--m-line); border-radius: 999px; background: transparent;
	color: var(--m-sub); font: inherit; font-size: 12px; cursor: pointer;
}
.m-mtabs button[aria-selected="true"] { border-color: var(--m-accent); background: var(--m-chip-on); color: var(--m-accent); }
.m-tabbadge { min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; background: var(--m-seal); color: #fff; font-size: 11.5px; line-height: 17px; text-align: center; }
.m-mlist { padding: 8px 14px 18px; overflow-y: auto; }
.m-mcap { margin: 0; padding: 2px 0 10px; color: var(--m-sub); font-family: var(--m-mincho); font-size: 11.5px; letter-spacing: .08em; text-align: center; }
.m-mcap b { color: var(--m-accent); font-size: 14px; }
.m-mempty { padding: 30px 0; color: var(--m-sub); font-family: var(--m-mincho); font-size: 13px; text-align: center; word-break: keep-all; }
/* ⚠️モーダルのUIテキストは中央揃え＋keep-all */
.m-qcard {
	margin-bottom: 10px; padding: 12px 13px; border: 1px solid var(--m-line); border-radius: 12px;
	background: var(--m-panel); text-align: center; word-break: keep-all; overflow-wrap: break-word; line-break: strict;
}
.m-qctop { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px; }
.m-qctitle { font-family: var(--m-mincho); font-size: 14.5px; font-weight: 600; }
.m-qcby { color: var(--m-sub); font-size: 11.5px; }
.m-qcask { margin: 4px 0 9px; font-size: 13px; line-height: 1.6; }
.m-qcmeta { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; margin-bottom: 9px; color: var(--m-sub); font-size: 11.5px; }
.m-qcfoot { display: flex; align-items: center; justify-content: center; gap: 8px; }
.m-qcstate { padding: 1px 8px; border: 1px solid var(--m-line); border-radius: 5px; font-family: var(--m-mincho); font-size: 11px; letter-spacing: .08em; }
.m-qcstate[data-state="open"] { border-color: color-mix(in srgb, var(--m-seal) 40%, transparent); color: var(--m-seal); }
.m-qcstate[data-state="wip"] { border-color: color-mix(in srgb, var(--m-accent) 45%, transparent); color: var(--m-accent); }
.m-qcstate[data-state="done"] { border-color: transparent; background: var(--m-chip-on); color: var(--m-accent); }
.m-qcstate[data-state="fail"] { color: var(--m-sub); }
.m-qcstate[data-state="miss"] { border-color: transparent; background: color-mix(in srgb, var(--m-seal) 14%, transparent); color: var(--m-seal); }
.m-mbtn { padding: 7px 13px; border: 1px solid var(--m-line); border-radius: 8px; background: transparent; color: var(--m-ink); font: inherit; font-family: var(--m-mincho); font-size: 12.5px; cursor: pointer; }
.m-mbtn:disabled { cursor: not-allowed; opacity: .45; }
.m-take { border-color: var(--m-seal); background: var(--m-seal); color: #fff; }
.m-go { padding: 8px 18px; border-color: var(--m-accent); background: var(--m-accent); color: #17231a; }
.m-go:hover { filter: brightness(1.06); }

/* --- アニメーション（⚠️transform と opacity だけ） --- */
@keyframes m-blink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
@keyframes m-slidein { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
@keyframes m-drop { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%); } }
@keyframes m-rise { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%); } }
@keyframes m-sheetup { from { opacity: .6; transform: translateY(30px); } to { opacity: 1; transform: none; } }
@keyframes m-pop { 0% { transform: scale(1); } 45% { transform: scale(1.28); } 100% { transform: scale(1); } }
@keyframes m-beat { 0% { transform: scale(1); } 35% { transform: scale(1.45); } 60% { transform: scale(.92); } 100% { transform: scale(1); } }
@keyframes m-foil {
	0%, 28% { background-position: 170% 0; }
	72%, 100% { background-position: -70% 0; }
}
/* ⚠️% はカードの高さ基準（.m-petal が height:100%）。-105%＝上端の少し上、8%＝下端の少し下 */
@keyframes m-petalfall {
	0% { opacity: 0; transform: translate3d(0, -105%, 0); }
	12% { opacity: .5; }
	50% { transform: translate3d(var(--m-sway, 14px), -50%, 0); }
	88% { opacity: .35; }
	100% { opacity: 0; transform: translate3d(0, 8%, 0); }
}
@keyframes m-petalspin {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(300deg); }
}
/* ⚠️% はヘッダの高さ基準（.m-hpetal が height:100%）。-125%＝上端の外、24%＝下端の少し下 */
@keyframes m-headfall {
	0% { opacity: 0; transform: translate3d(0, -125%, 0); }
	16% { opacity: var(--m-hp-peak, .45); }
	50% { transform: translate3d(var(--m-hp-drift, 20px), -46%, 0); }
	84% { opacity: calc(var(--m-hp-peak, .45) * .6); }
	100% { opacity: 0; transform: translate3d(0, 24%, 0); }
}
@keyframes m-headspin {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(var(--m-hp-spin, 260deg)); }
}
@keyframes m-bloom { 0% { opacity: 0; } 14% { opacity: .85; } 100% { opacity: 0; } }
@keyframes m-avpop { 0% { transform: scale(1); } 30% { transform: scale(.86); } 62% { transform: scale(1.12); } 100% { transform: scale(1); } }
@keyframes m-avring { 0% { opacity: .95; transform: scale(1); } 100% { opacity: 0; transform: scale(1.75); } }
@keyframes m-heartring { 0% { opacity: .8; transform: scale(.55); } 100% { opacity: 0; transform: scale(1.55); } }
@keyframes m-spark {
	0% { opacity: 0; transform: translate3d(0, 0, 0) scale(.35) rotate(0deg); }
	18% { opacity: .95; }
	100% { opacity: 0; transform: translate3d(var(--s-dx, 0), var(--s-dy, -26px), 0) scale(1) rotate(var(--s-spin, 90deg)); }
}
@keyframes m-warmfade { 0% { opacity: 0; } 14% { opacity: 1; } 100% { opacity: 0; } }

/* ⚠️控えめ設定・OS設定のどちらでも動きを止める */
.machi[data-reduced] .m-petal,
.machi[data-reduced] .m-quest::after,
.machi[data-reduced] .m-live i,
.machi[data-reduced] .m-tdot { animation: none; }
.machi[data-reduced] .m-petal { display: none; }
.machi[data-reduced] .m-note,
.machi[data-reduced] .m-quest,
.machi[data-reduced] .m-chip,
.machi[data-reduced] .m-heart,
.machi[data-reduced] .m-toast,
.machi[data-reduced] .m-modal,
.machi[data-reduced] .m-newbanner { animation: none; }
/* ⚠️空の色そのものは残す（時刻が伝わる情報なので消さない）。消すのは切替の動きだけ */
.machi[data-reduced] .m-skylayer { transition: none; }
.machi[data-reduced] .m-hpetal { display: none; }
.machi[data-reduced] .m-bloom,
.machi[data-reduced] .m-sparks { display: none; }
.machi[data-reduced] .m-av[data-flip] { animation: none; }
.machi[data-reduced] .m-av[data-flip]::before { display: none; }
.machi[data-reduced] .m-note[data-warm]:not([data-parent]):not([data-reply])::after { display: none; }

/* ⚠️裏に回っている間は無限アニメーションも止める（放置しても負荷が上がらないことの担保） */
.machi[data-idle] .m-hpetal,
.machi[data-idle] .m-hpetal > i,
.machi[data-idle] .m-petal,
.machi[data-idle] .m-petal > i,
.machi[data-idle] .m-quest::after,
.machi[data-idle] .m-live i { animation-play-state: paused; }

@media (prefers-reduced-motion: reduce) {
	.m-petal, .m-hpetal { display: none; }
	.m-bloom, .m-sparks, .m-av[data-flip]::before { display: none; }
	.m-note[data-warm]:not([data-parent]):not([data-reply])::after { display: none; }
	.m-skylayer { transition: none; }
	.m-note, .m-quest, .m-quest::after, .m-chip, .m-heart, .m-toast, .m-modal, .m-newbanner, .m-live i, .m-tdot, .m-av[data-flip] { animation: none; }
}
</style>
