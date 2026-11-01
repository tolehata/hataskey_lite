/**
 * 花常のプロシージャル効果音。環境音は ambience.ts に分離する。
 *
 * ⚠️2026-07-27 全面的に作り直した。利用者から「非常に不快」と報告があり、原因は音色ではなく**作り方**だった：
 *   ①立ち上がりの傾斜が無く `setValueAtTime` で即最大 → **鳴るたびにプツッと鳴る**（クリックノイズ）
 *   ②連鎖で音程が青天井（`880 × 1.122^n` からさらに1.5倍へスイープ）→ **金切り声になる**
 *   ③フィルタ無しの純音・矩形波 → **耳に刺さる**
 *   ④クリア音が 1046Hz まで上がる5音アルペジオ → **痛い**
 *   ⑤直接 destination へ繋いでいたので、大きな連鎖で**同時発音が素で足し算される**
 * ⚠️直したのは次の5点。**元に戻さないこと**：
 *   ⓐ全ての音に **6ms の立ち上がり**と指数の減衰を付けた（クリックが消える）
 *   ⓑ**共通の master gain と lowpass** を通す（同時発音の頭打ちと、高域の角を落とす）
 *   ⓒ**音域を1オクターブ下げた**（最高音は 620Hz。以前は 1568Hz まで出ていた）
 *   ⓓ**連鎖の上がり幅に上限**を付けた（5段で頭打ち）
 *   ⓔ音量を全体に下げた
 * ⚠️音を足すときも必ず `voice()` を通すこと（直接 oscillator を destination へ繋がない）。
 */
import { prefer } from "@/preferences.js";

let context: AudioContext | undefined;
let master: GainNode | undefined;
let hanaawaseSoundEnabled = true;

const masterVolume = () => prefer.s["sound.masterVolume"];
const muted = () =>
	!hanaawaseSoundEnabled ||
	prefer.s["sound.notUseSound"] ||
	masterVolume() === 0 ||
	(prefer.s["sound.useSoundOnlyWhenActive"] && window.document.hidden);

const getContext = () => {
	if (typeof window === "undefined" || muted()) return undefined;
	context ??= new AudioContext();
	return context;
};

/**
 * 共通の出口。⚠️ここに lowpass を1つ置いて、全部の音の高域の角を落とす。
 * ⚠️同時発音が増えても素の足し算にならないよう、master の利得は控えめに固定する。
 */
const getMaster = (ctx: AudioContext) => {
	if (master && master.context === ctx) return master;
	const gain = ctx.createGain();
	gain.gain.value = 0.9;
	const lowpass = ctx.createBiquadFilter();
	lowpass.type = "lowpass";
	lowpass.frequency.value = 2200;
	lowpass.Q.value = 0.6;
	gain.connect(lowpass).connect(ctx.destination);
	master = gain;
	return gain;
};

export function unlockSound() {
	const ctx = getContext();
	if (ctx?.state === "suspended") void ctx.resume();
}

/** 花常内の設定。既存の全体音量・ミュート設定も引き続き尊重する。 */
export function setHanaawaseSoundEnabled(enabled: boolean) {
	hanaawaseSoundEnabled = enabled;
}

/**
 * 1音。⚠️`attack` を必ず取ること（0にするとクリックノイズが戻る）。
 * @param frequency 基音。⚠️620Hz を超えないこと（刺さる）
 * @param duration 全長（秒）
 * @param volume 0〜1。⚠️0.06 を超えないこと
 * @param type 波形。⚠️`square` は使わない（倍音が硬い）
 * @param endFrequency 終端の周波数。⚠️**上げない**（上げると悲鳴に聞こえる）
 */
const voice = (
	frequency: number,
	duration: number,
	volume: number,
	type: OscillatorType = "sine",
	endFrequency = frequency,
) => {
	const ctx = getContext();
	if (!ctx) return;
	const now = ctx.currentTime;
	const attack = 0.006;
	const oscillator = ctx.createOscillator();
	const gain = ctx.createGain();
	oscillator.type = type;
	oscillator.frequency.setValueAtTime(frequency, now);
	if (endFrequency !== frequency) {
		oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
	}
	const level = Math.max(0.0001, volume * masterVolume());
	// ⚠️0 から始めて 6ms で持ち上げる。ここを setValueAtTime に戻すとクリックが復活する。
	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(level, now + attack);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
	oscillator.connect(gain).connect(getMaster(ctx));
	oscillator.start(now);
	oscillator.stop(now + duration + 0.02);
};

/** 札を入れ替えた音。⚠️短く低く、気配だけ。 */
export const playSwap = () => voice(300, 0.06, 0.035, "triangle", 268);

/**
 * 札が消えた音。⚠️連鎖で少しずつ上がるが、**5段で頭打ち**にする。
 * ⚠️以前は上限が無く、長い連鎖で 1400Hz を超えて金切り声になっていた。
 */
export const playPop = (cascade = 1) => {
	const step = Math.min(4, Math.max(0, cascade - 1));
	const pitch = 392 * 1.122 ** step; // 392Hz(G4) から、最高 620Hz
	voice(pitch, 0.17, 0.055, "sine", pitch * 0.94);
};

/** 札が落ちて着いた音。⚠️低く短く。 */
export const playLand = () => voice(120, 0.07, 0.03, "sine", 96);

/** 特別な札。⚠️`square` を使わない（硬い）。月だけ少し長く残す。 */
export const playSpecial = (kind: "tanzaku" | "mari" | "tsuki") => {
	if (kind === "tanzaku") voice(494, 0.12, 0.05, "triangle", 415);
	else if (kind === "mari") voice(196, 0.18, 0.055, "sine", 165);
	else voice(587, 0.5, 0.05, "sine", 494);
};

/**
 * 面をクリアした音。⚠️3音だけ・1オクターブ下げ・上へ跳ねさせない。
 * ⚠️以前は 523→1046Hz の5音で、最後がいちばん高く鳴って痛かった。
 */
export const playClear = () => {
	for (const [index, pitch] of [392, 494, 587].entries()) {
		window.setTimeout(() => voice(pitch, 0.34, 0.05, "sine", pitch * 0.97), index * 130);
	}
};
