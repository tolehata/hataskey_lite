<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
旗鯖fork(#34): 地震・津波情報の設定ダイアログ。
  - お住いの都道府県(端末ローカルのみ・サーバー非送信。ただし「居住地のみ通知」を選ぶと通知判定用にサーバー保存)
  - 通知(サーバープッシュ): 一定震度以上 / 居住地のみ を選択
  - 取得間隔 / 出典の明記
-->
<template>
<!-- 旗鯖fork: 設定画面の右ペインへ埋め込むときは、窓そのものを枠なしへ差し替える。
     ⚠️窓は position: fixed の重ね表示なので、CSSでペインの中へは収められない。
     ⚠️受け口(#header / 本体 / close())は同じ形なので、中身には手を触れない。 -->
<component :is="embedded ? SettingsEmbeddedWindow : MkModalWindow"
	ref="windowEl"
	:width="440"
	:height="560"
	:withOkButton="false"
	:withCloseButton="true"
	@close="windowEl?.close()"
	@closed="emit('closed')"
>
	<template #header><i class="ti ti-settings"></i> 地震・津波情報の設定</template>
	<div class="_spacer" style="--MI_SPACER-min: 20px; --MI_SPACER-max: 28px;">
		<div class="_gaps">
			<MkSelect v-model="prefModel" :items="prefItems">
				<template #label>お住いの都道府県</template>
				<template #caption>通常は<b>この端末にのみ保存</b>され、サーバーには送られません。下の「お住いの都道府県で揺れたら通知」を有効にしたときだけ、通知のためサーバーに送られます（詳細は下の注意書き）。</template>
			</MkSelect>

			<!-- 通知設定(サーバープッシュ) -->
			<div :class="$style.section">
				<div :class="$style.sectionHead"><i class="ti ti-bell"></i> 通知</div>
				<MkSwitch v-model="notifEnabled" :disabled="!loaded">
					<template #label>地震・津波の通知を受け取る</template>
					<template #caption>{{ loaded ? 'アプリを閉じていてもプッシュ通知が届きます。' : '読み込み中…' }}</template>
				</MkSwitch>

				<template v-if="notifEnabled">
					<div :class="$style.modeList">
						<button :class="[$style.modeOpt, { [$style.modeOptOn]: notifMode === 'intensity' }]" @click="notifMode = 'intensity'">
							<i :class="notifMode === 'intensity' ? 'ti ti-circle-check-filled' : 'ti ti-circle'"></i>
							<span>一定の震度以上で通知</span>
						</button>
						<button
							:class="[$style.modeOpt, { [$style.modeOptOn]: notifMode === 'pref', [$style.modeOptDisabled]: !prefSet }]"
							:disabled="!prefSet"
							@click="prefSet && (notifMode = 'pref')"
						>
							<i :class="notifMode === 'pref' ? 'ti ti-circle-check-filled' : 'ti ti-circle'"></i>
							<span>お住いの都道府県で揺れたら通知<small v-if="!prefSet">（先に都道府県を設定）</small></span>
						</button>
					</div>

					<MkSelect v-if="notifMode === 'intensity'" v-model="notifThreshold" :items="thresholdItems">
						<template #label>通知する最小の震度</template>
					</MkSelect>

					<MkInfo v-if="notifMode === 'pref'" warn>
						<div :class="$style.privacy">
							<div :class="$style.privacyTitle"><i class="ti ti-shield-lock"></i> お住いの都道府県の取り扱い</div>
							<ul>
								<li><b>送信先</b>：あなたが利用している<b>このサーバー（旗鯖インスタンス）だけ</b>。P2PQuakeなどの外部サービスには送られません。</li>
								<li><b>送る内容</b>：<b>都道府県名（例：東京都）のみ</b>。市区町村・住所・GPS等の位置情報は一切送りません。</li>
								<li><b>用途</b>：地震発生時に「あなたの都道府県で震度が観測されたか」を<b>サーバー側で判定して通知を送るため</b>だけに使います。</li>
								<li><b>保存と削除</b>：このモードが有効な間だけ保存されます。別モードへ変更／通知をOFF／「居住地のみ」を解除すると、サーバーから都道府県は<b>削除</b>されます。</li>
							</ul>
							通常（付近の地震表示・震度しきい値での通知）では、都道府県はこの端末にのみ保存され、サーバーには送られません。
						</div>
					</MkInfo>
				</template>
			</div>

			<MkSelect v-model="pollModel" :items="pollItems">
				<template #label>取得間隔（ページ表示）</template>
				<template #caption>地震情報ページの自動更新間隔です。</template>
			</MkSelect>

			<div :class="$style.source">
				<div :class="$style.sourceTitle">出典</div>
				<ul>
					<li>地震・津波データ: <b>気象庁</b> / <b>P2P地震情報（P2PQuake）</b></li>
					<li>地図データ: <b>Natural Earth</b>（PD）／<b>国土数値情報（国土交通省）</b>（CC BY 4.0・市区町村界）</li>
				</ul>
				<div :class="$style.note">※ 緊急地震速報(EEW)は扱わず、発表済みの地震・津波情報のみを扱います。</div>
				<div :class="$style.note">※ インターネット経由のため、情報の到達遅延や欠落が起こり得ます。リアルタイム性・到達は保証されません。</div>
			</div>
		</div>
	</div>
</component>
</template>

<script lang="ts" setup>
import { computed, ref, useTemplateRef, watch, onMounted } from 'vue';
import SettingsEmbeddedWindow from '@/components/SettingsEmbeddedWindow.vue';
import MkModalWindow from '@/components/MkModalWindow.vue';
import MkSelect from '@/components/MkSelect.vue';
import MkSwitch from '@/components/MkSwitch.vue';
import MkInfo from '@/components/MkInfo.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { PREFECTURES } from '@/utility/earthquake.js';
import { earthquakePref, setEarthquakePref, earthquakePollSec, setEarthquakePollSec } from '@/utility/hatasaba-device-prefs.js';

const emit = defineEmits<{ (ev: 'closed'): void }>();
const windowEl = useTemplateRef('windowEl');

const prefItems = [
	{ value: '', label: '（未設定）' },
	...PREFECTURES.map(p => ({ value: p, label: p })),
];
const prefModel = computed({
	get: () => earthquakePref.value,
	set: (v: string) => setEarthquakePref(v),
});
const prefSet = computed(() => !!earthquakePref.value);

const pollItems = [
	{ value: 10, label: 'リアルタイム（最短）' },
	{ value: 30, label: '30秒ごと' },
	{ value: 60, label: '1分ごと' },
	{ value: 300, label: '5分ごと' },
	{ value: 600, label: '10分ごと' },
];
const pollModel = computed({
	get: () => earthquakePollSec.value,
	set: (v: number) => setEarthquakePollSec(v),
});

// ===== 通知設定(サーバー保存) =====
const notifEnabled = ref(false);
const notifMode = ref<'intensity' | 'pref'>('intensity');
const notifThreshold = ref(40);
const thresholdItems = [
	{ value: 30, label: '震度3以上' },
	{ value: 40, label: '震度4以上' },
	{ value: 45, label: '震度5弱以上' },
	{ value: 50, label: '震度5強以上' },
	{ value: 55, label: '震度6弱以上' },
	{ value: 60, label: '震度6強以上' },
	{ value: 70, label: '震度7' },
];

// 読み込み完了フラグ(reactive)。完了までトグル操作を無効化し、
//   「読み込み前にトグル→後から届いた読込結果で上書きされてOFFに戻る」競合を防ぐ。
const loaded = ref(false);
onMounted(async () => {
	try {
		const s = await misskeyApi('hata/earthquake/notification-settings', {}) as any;
		notifEnabled.value = !!s.enabled;
		notifMode.value = (s.mode === 'pref') ? 'pref' : 'intensity';
		notifThreshold.value = s.threshold ?? 40;
	} catch { /* 取得失敗時は既定値 */ } finally {
		loaded.value = true;
	}
});

// 都道府県が未設定なら居住地モードは選べない → intensityへ戻す。
watch(prefSet, (v) => { if (!v && notifMode.value === 'pref') notifMode.value = 'intensity'; });

async function saveNotif() {
	if (!loaded.value) return;
	try {
		await misskeyApi('hata/earthquake/notification-settings-update', {
			enabled: notifEnabled.value,
			mode: notifMode.value,
			threshold: notifThreshold.value,
			pref: (notifEnabled.value && notifMode.value === 'pref') ? (earthquakePref.value || null) : null,
		});
	} catch { /* 保存失敗は致命的でない */ }
}
watch([notifEnabled, notifMode, notifThreshold, earthquakePref], saveNotif);

/** 旗鯖fork: true なら窓の枠を持たず、設定画面の右ペインの中身として描く。 */
defineProps<{ embedded?: boolean }>();
</script>

<style lang="scss" module>
.section { background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 12px; }
.sectionHead { font-weight: 800; font-size: .92em; display: flex; align-items: center; gap: 6px; }
.modeList { display: flex; flex-direction: column; gap: 8px; }
.modeOpt { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; color: inherit; cursor: pointer; background: var(--MI_THEME-panel); border: 1px solid var(--MI_THEME-divider); border-radius: 9px; padding: 9px 12px; font-size: .9em; }
.modeOpt:hover:not(:disabled) { border-color: var(--MI_THEME-accent); }
.modeOptOn { border-color: var(--MI_THEME-accent); color: var(--MI_THEME-accent); font-weight: 700; }
.modeOptDisabled { opacity: .45; cursor: not-allowed; }
.modeOpt small { opacity: .7; margin-left: 4px; font-weight: 400; }
.privacy { font-size: .85em; line-height: 1.6; }
.privacyTitle { font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 5px; }
.privacy ul { margin: 4px 0 6px; padding-left: 1.2em; display: flex; flex-direction: column; gap: 4px; }
.source { font-size: .84em; background: var(--MI_THEME-bg); border: 1px solid var(--MI_THEME-divider); border-radius: 10px; padding: 10px 14px; }
.sourceTitle { font-weight: 800; margin-bottom: 4px; }
.source ul { margin: 0; padding-left: 1.2em; line-height: 1.7; }
.note { opacity: .7; margin-top: 6px; font-size: .92em; }
</style>
