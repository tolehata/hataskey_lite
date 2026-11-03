<!--
SPDX-FileCopyrightText: syuilo and misskey-project / hatacha
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div :ref="controller.rootRef" data-color-mode="system" data-hero-passed="false" style="background:var(--bg);color:var(--fg);font-family:'Zen Kaku Gothic New','Hiragino Kaku Gothic ProN',Meiryo,system-ui,sans-serif;overflow-x:clip;position:relative" data-hataskey-entrance="" :lang="language" :style="{ '--welcome-server-background': serverBackground }">
	<header class="site-header">
		<a class="site-brand" data-header-identity="" href="#top" :aria-label="language === 'ja' ? serverName + ' トップへ' : 'Back to ' + serverName + ' top'" aria-hidden="true" tabindex="-1">
			<span class="header-identity-face header-identity-server" aria-hidden="true"><img class="header-server-icon" alt="" :src="serverIcon"><span class="header-identity-word" data-server="">{{ serverName }}</span></span>
		</a>
		<div class="visitor-actions">
			<a class="visitor-trigger github-link" target="_blank" rel="noopener noreferrer" aria-label="GitHubでHataskey Liteを見る" data-aria-en="View Hataskey Lite on GitHub" :href="safeWebUrl(instance.repositoryUrl) || 'https://github.com/tolehata/hataskey_lite'"><i class="ti ti-brand-github" aria-hidden="true"></i></a>
			<button class="visitor-trigger theme-toggle" type="button" aria-label="ダークモードに切り替える" title="ダークモードに切り替える" @click="toggleTheme"><i class="ti ti-moon" data-theme-icon="" aria-hidden="true"></i></button>
			<details class="visitor-menu" data-header-menu="">
				<summary class="visitor-trigger" aria-label="言語を選択" data-aria-en="Choose a language"><i class="ti ti-world" aria-hidden="true"></i></summary>
				<div class="visitor-popover language-popover" aria-label="言語">
					<div class="visitor-menu-label" data-en="Language">言語</div>
					<button class="visitor-menu-item" type="button" data-lang-choice="ja" data-lang="ja" aria-pressed="true" @click="selectLanguage"><span class="visitor-menu-icon-space language-symbol" aria-hidden="true">あ</span><span>日本語</span><i class="ti ti-check language-check" data-language-check="" aria-hidden="true"></i></button>
					<button class="visitor-menu-item" type="button" data-lang-choice="en" data-lang="en" aria-pressed="false" @click="selectLanguage"><i class="ti ti-letter-e" aria-hidden="true"></i><span>English</span><i class="ti ti-check language-check" data-language-check="" aria-hidden="true" hidden=""></i></button>
				</div>
			</details>
			<details class="visitor-menu" data-header-menu="">
				<summary class="visitor-trigger" aria-label="サーバーメニュー" data-aria-en="Server menu"><i class="ti ti-dots" aria-hidden="true"></i></summary>
				<div class="visitor-popover" aria-label="サーバーメニュー">
					<div class="visitor-menu-label"><span data-server="">{{ serverName }}</span></div>
					<button class="visitor-menu-item" type="button" @click="openPage('/about', $event)"><i class="ti ti-info-circle" aria-hidden="true"></i><span data-en="Server information">サーバー情報</span></button>
					<button class="visitor-menu-item" type="button" @click="openPage('/about#emojis', $event)"><i class="ti ti-icons" aria-hidden="true"></i><span data-en="Custom emoji">カスタム絵文字</span></button>
					<button class="visitor-menu-item" type="button" @click="openPage('/about#charts', $event)"><i class="ti ti-chart-line" aria-hidden="true"></i><span data-en="Charts">チャート</span></button>
					<div class="visitor-menu-divider"></div>
					<button class="visitor-menu-item" type="button" @click="openPage('/ads', $event)"><i class="ti ti-ad" aria-hidden="true"></i><span data-en="Ads">広告</span></button>
					<details class="visitor-submenu">
						<summary><i class="ti ti-tool" aria-hidden="true"></i><span data-en="Tools">ツール</span><i class="ti ti-chevron-right" aria-hidden="true"></i></summary>
						<div class="visitor-submenu-panel">
							<button class="visitor-menu-item" type="button" @click="openPage('/scratchpad', $event)"><i class="ti ti-terminal-2" aria-hidden="true"></i><span data-en="Scratchpad">スクラッチパッド</span></button>
							<button class="visitor-menu-item" type="button" @click="openPage('/api-console', $event)"><i class="ti ti-terminal-2" aria-hidden="true"></i><span>API Console</span></button>
							<button class="visitor-menu-item" type="button" @click="openPage('/clicker', $event)"><i class="ti ti-cookie" aria-hidden="true"></i><span>🍪👈</span></button>
						</div>
					</details>
					<div class="visitor-menu-divider"></div>
					<button class="visitor-menu-item" type="button" @click="openPage('/contact', $event)"><i class="ti ti-help-circle" aria-hidden="true"></i><span data-en="Contact">お問い合わせ</span></button>
					<div class="visitor-menu-divider"></div>
					<details class="visitor-submenu">
						<summary><i class="ti ti-bulb" aria-hidden="true"></i><span data-en="Documents">ドキュメント</span><i class="ti ti-chevron-right" aria-hidden="true"></i></summary>
						<div class="visitor-submenu-panel">
							<button class="visitor-menu-item" type="button" @click="openPage('/mfc-cheat-sheet', $event)"><i class="ti ti-help-circle" aria-hidden="true"></i><span data-en="MFC cheat sheet">MFCチートシート</span></button>
							<button class="visitor-menu-item" type="button" @click="openPage('/keyboard-shortcuts', $event)"><i class="ti ti-keyboard" aria-hidden="true"></i><span data-en="Keyboard shortcuts">ショートカット一覧</span></button>
						</div>
					</details>
					<button class="visitor-menu-item" type="button" @click="openPage('/about-misskey', $event)"><span class="visitor-menu-icon-space" aria-hidden="true"></span><span data-en="About Hataskey Lite">Hataskey Liteについて</span></button>
					<a v-for="link in legalLinks" :key="link.href" class="visitor-menu-item" :href="link.href" target="_blank" rel="noopener noreferrer"><i :class="link.icon" aria-hidden="true"></i><span>{{ link.label }}</span></a>
				</div>
			</details>
		</div>
	</header>

	<!-- Added for the login mock: two quiet, counter-moving federation rows. -->
	<WelcomeFederation @resize="controller.requestMeasure()"></WelcomeFederation>

	<aside class="federation-status-notice" hidden="" aria-live="polite" aria-atomic="true">
		<i class="ti ti-world" aria-hidden="true"></i>
		<p data-federation-status-copy=""><span data-federation-status-copy-wide=""></span><span data-federation-status-copy-compact=""></span></p>
	</aside>

	<!-- ══ HERO ══ -->
	<section id="top" style="position:relative;min-height:100dvh;display:flex;flex-direction:column;justify-content:center;padding:104px 24px 0;overflow:clip">
		<div class="hero-server-backdrop" aria-hidden="true"></div>
		<div class="hero-primary" style="width:min(1240px,100%);margin:0 auto">
			<h1 class="hero-identity" data-no-split="" :aria-label="serverName + ' — Based on Hataskey Lite'">
				<span class="identity-face identity-face-server" aria-hidden="true">
					<img class="server-icon-large" alt="" :src="serverIcon">
					<span class="server-brand">
						<span class="server-name" data-server="">{{ serverName }}</span>
						<span class="based-on"><span class="based-on-kicker">Based on</span><strong>Hataskey Lite</strong></span>
					</span>
				</span>
			</h1>
			<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:26px;margin-top:22px">
				<!-- The server description is admin HTML: render only the allowlisted output of sanitizeServerDescription. -->
				<div class="hero-copy"><div v-if="serverDescriptionHtml" class="hero-copy-description" data-server-description="" v-html="serverDescriptionHtml"></div><span v-else class="hero-copy-lead" data-en="Capsule tabs, a browser-style deck, and original tools you can use alongside your timeline.">カプセル型のタブ、ブラウザ型のデッキ、タイムラインと並べて使える独自機能。</span></div>
				<div class="hero-actions">
					<div class="hero-cta-group">
						<span class="hero-cta-item"><button class="login-cta hWelcome-state-1" type="button" style="border:0;display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 22px;border-radius:999px;background:transparent;border:1px solid var(--dividerStrong);color:var(--fg);font-weight:700;font-size:14px;cursor:pointer;transition:all .2s" @click="signin"><i class="ti ti-login-2" aria-hidden="true"></i><span data-server-login="">{{ serverLoginLabel }}</span></button></span>
						<span class="hero-cta-item"><button class="signup-cta signup-cta-top hWelcome-state-2" type="button" style="border:0;display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 22px;border-radius:999px;background:var(--accent);color:var(--onAccent);font-weight:700;font-size:14px;cursor:pointer;transition:transform .2s,box-shadow .2s" :disabled="instance.registrationClosed" @click="signup"><i class="ti ti-user-plus" aria-hidden="true"></i><span>{{ serverSignupLabel }}</span></button></span>
					</div>
					<WelcomeServerActivity :language="language" @resize="controller.requestMeasure()"></WelcomeServerActivity>
					<div class="scroll-invitation"><span data-en="Try scrolling down">下へスクロールしてみる</span><span class="scroll-invitation-arrow" aria-hidden="true"><i class="ti ti-arrow-down"></i></span></div>
				</div>
			</div>
		</div>
		<WelcomePostColumns :language="language"/>
	</section>

	<!-- ══ HATASKEY LITE ══ -->
	<section id="lite" class="lite-intro" aria-labelledby="lite-heading">
		<div class="lite-intro-inner">
			<div class="lite-intro-kicker"><span aria-hidden="true"></span>HATASKEY LITE</div>
			<h2 id="lite-heading" class="lite-intro-heading" data-symbol-heading="" data-no-split="" aria-label="Hataskeyらしさは、そのままに。" data-aria-en="Still Hataskey, just lighter."><span class="symbol-copy" data-symbol-lang="ja" aria-hidden="true"><span class="lite-intro-brand">Hataskey</span>らしさは、<span class="symbol-pointer"><span class="symbol-pointer-mark" data-symbol-last=""></span><span class="symbol-pointer-copy">そのまま</span><span class="symbol-pointer-track"><i class="symbol-pointer-cursor ti ti-pointer-filled"></i></span></span>に。</span><span class="symbol-copy" data-symbol-lang="en" aria-hidden="true"><span class="symbol-pointer"><span class="symbol-pointer-mark" data-symbol-last=""></span><span class="symbol-pointer-copy">Still</span><span class="symbol-pointer-track"><i class="symbol-pointer-cursor ti ti-pointer-filled"></i></span></span> <span class="lite-intro-brand">Hataskey</span>, just lighter.</span></h2>
			<p class="lite-intro-lead" data-en="Hataskey Lite keeps only what you use every day as a social network. The familiar screens and playful touches stay; the extras are gone, so you can focus on posts and the people behind them.">Hataskey Liteは、HataskeyからSNSとして毎日使うものだけを残した軽量版です。見慣れた画面と遊び心はそのままに、機能を絞って、投稿と人とのつながりにまっすぐ向き合えるようにしました。</p>
			<ul class="lite-intro-points">
				<li class="lite-intro-point">
					<i class="ti ti-layout-dashboard" aria-hidden="true"></i>
					<h3 data-no-split="" data-en="The Hataskey UI you know">いつものHataskey UI</h3>
					<p data-en="Capsule tabs, the deck and HataSideStudio work just as they do on Hataskey.">カプセルタブやデッキ、HataSideStudioなど、Hataskeyの画面づくりはそのまま使えます。</p>
				</li>
				<li class="lite-intro-point">
					<i class="ti ti-sparkles" aria-hidden="true"></i>
					<h3 data-no-split="" data-en="The Hataskey look">Hataskeyらしい見た目</h3>
					<p data-en="Hatakyu illustrations and Hataskey UI touches such as speech bubbles and glass stay as they are.">ハタキュのイラストや、Hataskey UIの吹き出し・ガラス表示など、Hataskeyらしい見た目はそのままです。</p>
				</li>
				<li class="lite-intro-point">
					<i class="ti ti-message-circle" aria-hidden="true"></i>
					<h3 data-no-split="" data-en="Light enough to focus">SNSに集中できる軽さ</h3>
					<p data-en="Built light, around what timelines and conversations need.">タイムラインと会話に必要なものに絞った、軽い作りです。</p>
				</li>
			</ul>
		</div>
	</section>

	<!-- ══ FEDIVERSE ══ -->
	<section id="fediverse" class="fediverse-intro" data-fediverse-stage="complete" data-fediverse-moving="false" data-federation-mode="all" aria-labelledby="fediverse-heading">
		<div class="fediverse-inner">
			<header class="fediverse-heading-row">
				<div>
					<div class="fediverse-kicker"><span aria-hidden="true"></span>HELLO, FEDIVERSE</div>
					<h2 id="fediverse-heading" class="fediverse-heading" data-symbol-heading="" data-no-split="" aria-label="Hataskey Liteから、サーバーの向こうへ。" data-aria-en="Hataskey Lite brings other servers closer."><span class="symbol-copy" data-symbol-lang="ja" aria-hidden="true"><span class="symbol-swap symbol-fediverse" style="--symbol-delay:.12s"><span class="symbol-icon" aria-hidden="true"><i class="ti ti-world" aria-hidden="true"></i></span><span class="symbol-text" data-symbol-last="">Hataskey Lite</span></span>から、<br>サーバーの向こうへ。</span><span class="symbol-copy" data-symbol-lang="en" aria-hidden="true"><span class="symbol-swap symbol-fediverse" style="--symbol-delay:.12s"><span class="symbol-icon" aria-hidden="true"><i class="ti ti-world" aria-hidden="true"></i></span><span class="symbol-text" data-symbol-last="">Hataskey Lite</span></span> brings<br>other servers closer.</span></h2>
				</div>
				<div class="fediverse-intro-copy">
					<p><span data-en="Hataskey Lite is a lighter edition of Hataskey, which builds on CherryPick, a fork of Misskey, with its own thoughtful touches.">Hataskey Liteは、Misskeyから生まれたCherryPickに使いやすさを重ねたHataskeyの、軽量版のSNSソフトウェアです。</span><a class="fediverse-footnote-ref" href="#fediverse-rights" role="doc-noteref" aria-label="注釈：ロゴ・名称について" data-aria-en="Note: about logos and names">※</a><span data-en=" It supports ActivityPub, a shared way for social servers to communicate.">サーバー同士でやり取りする共通の仕組み「ActivityPub」に対応しています。</span></p>
				</div>
			</header>

			<figure class="fediverse-map" aria-label="連合のしくみ" data-aria-en="How federation connects servers">
				<div class="fediverse-map-plane">
					<div class="fediverse-server fediverse-origin">
						<div class="fediverse-brand-mark"><img class="fediverse-misskey-logo" src="/client-assets/hataskey/welcome/misskey.svg" alt="Misskey" width="515" height="136" loading="lazy" decoding="async"></div>
						<span data-en="Another server">別のサーバー</span>
					</div>
					<div class="fediverse-transfer" aria-hidden="true"><i class="ti ti-arrows-left-right"></i></div>
					<div class="fediverse-server fediverse-home">
						<div class="fediverse-brand-mark"><strong class="fediverse-wordmark">Hataskey Lite</strong></div>
						<span data-en="Your server">あなたのサーバー</span>
					</div>
				</div>
				<p class="fediverse-compatible" data-en="Of course, servers that support ActivityPub can connect with one another.">もちろん、ActivityPubに対応したサーバーであれば相互につながりあえます。</p>
			</figure>

			<div class="fediverse-primer-disclosure" data-fediverse-primer-state="closed">
				<button id="fediverse-primer-toggle" class="fediverse-primer-toggle" type="button" data-fediverse-primer-toggle="" aria-expanded="false" aria-controls="fediverse-primer-panel"><span data-en="What is federation?">連合って？</span><i class="ti ti-chevron-down" aria-hidden="true"></i></button>
				<div id="fediverse-primer-panel" class="fediverse-primer-collapse" data-fediverse-primer-panel="" role="region" aria-labelledby="fediverse-primer-toggle" aria-hidden="true">
					<div class="fediverse-primer-collapse-inner">
						<div class="fediverse-primer">
							<div class="fediverse-primer-lead"><h3 data-no-split="" data-symbol-heading="" aria-label="例えると、連合はメールに似ています。" data-aria-en="Think of federation like email."><span class="symbol-copy" data-symbol-lang="ja" aria-hidden="true">例えると、連合は<br><span class="symbol-swap symbol-mail" style="--symbol-delay:0s"><span class="symbol-icon" aria-hidden="true"><i class="ti ti-mail fediverse-mail-envelope" aria-hidden="true"></i></span><span class="symbol-text" data-symbol-last="">メール</span></span>に似ています。</span><span class="symbol-copy" data-symbol-lang="en" aria-hidden="true">Think of federation<br>like <span class="symbol-swap symbol-mail" style="--symbol-delay:0s"><span class="symbol-icon" aria-hidden="true"><i class="ti ti-mail fediverse-mail-envelope" aria-hidden="true"></i></span><span class="symbol-text" data-symbol-last="">email</span></span>.</span></h3></div>
							<p class="fediverse-primer-copy"><span data-en="People can exchange email even when they use different services.">メールは、使うサービスが違っても送り合えますよね。</span><br><span data-en="On social networks too, we can talk without everyone joining the same server.">SNSでも、みんなが同じサーバーに集まらなくても会話できる。</span><br><span data-en="That way of connecting is called federation.">そんなつながり方が「連合」です。</span></p>
							<p class="fediverse-primer-detail"><span data-en="Each server is a community with its own people and rules. ActivityPub is the shared way these communities deliver posts and replies.">サーバーは、集まる人やルールがそれぞれ違う居場所。ActivityPubは、その間で投稿や返信を届け合うための共通の仕組みです。</span><br><span data-en="Together, these connected communities">こうしてつながる世界全体を</span><br><span data-en="are called the Fediverse.">「Fediverse（フェディバース）」と呼びます。</span></p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ══ JOIN ══ -->
	<section id="join" class="join-section" style="padding:96px 24px;color:var(--joinFg)">
		<div style="max-width:1240px;margin:0 auto">
			<div style="display:flex;align-items:center;gap:10px;font-size:11.5px;font-weight:700;letter-spacing:.14em;color:#8fd0e4;animation:hWelcome-fadeUp linear both;animation-timeline:view();animation-range:entry 3% cover 22%"><span style="width:26px;height:2px;background:#8fd0e4"></span>08&nbsp;&nbsp;JOIN</div>
			<h2 style="font-size:clamp(30px,5vw,64px);line-height:1.12;margin:16px 0 0;animation:hWelcome-fromLeft .9s cubic-bezier(.2,.8,.2,1) both;animation-timeline:view();animation-range:entry 2% cover 22%" data-en="Fancy joining the server?">サーバーに参加してみませんか？</h2>
			<p class="join-lead" style="max-width:600px;margin:20px 0 0;font-size:15px;line-height:2;color:rgba(234,243,244,.78);text-wrap:pretty;animation:hWelcome-fadeUp .9s cubic-bezier(.2,.8,.2,1) both;animation-timeline:view();animation-range:entry 3% cover 24%"><span data-en="That is the whole tour.">ここまでで、ひととおりの旅はおしまいです。</span><br><span data-en="Did any of it catch your eye?">気になるところ、ありましたか？</span><br class="mobile-copy-break"><span class="join-lead-tail" data-en="If so — the door is right here.">あったなら、入口はこの先です。</span></p>
			<div class="join-plane" style="position:relative;height:150px;margin:26px 0 6px;overflow:hidden">
				<svg data-planetrail="" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">
					<path data-trailpath="" d="" fill="none" stroke="rgba(143,208,228,.4)" stroke-width="2" stroke-dasharray="7 10"></path>
				</svg>
				<span data-plane="" style="position:absolute;left:0;top:0;margin:-15px 0 0 -15px;font-size:30px;color:#8fd0e4;transform:translate(-40px,124px) rotate(0deg);will-change:transform"><i class="ti ti-plane" style="display:block"></i></span>
			</div>
			<div class="join-actions" style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;width:100%;margin-top:10px;animation:hWelcome-fadeUp .9s cubic-bezier(.2,.8,.2,1) both;animation-timeline:view();animation-range:entry 0% entry 45%">
				<button class="signup-cta hWelcome-state-74" type="button" style="border:1px solid rgba(234,243,244,.36);display:inline-flex;align-items:center;gap:10px;height:56px;padding:0 28px;border-radius:999px;background:transparent;color:#eaf3f4;font-weight:700;font-size:16px;cursor:pointer;transition:transform .22s,background .22s,border-color .22s" :disabled="instance.registrationClosed" @click="signup"><i class="ti ti-user-plus" style="font-size:20px"></i><span>{{ serverSignupLabel }}</span></button>
				<button class="login-cta hWelcome-state-75" type="button" style="border:0;display:inline-flex;align-items:center;gap:10px;height:56px;padding:0 30px;border-radius:999px;background:#8fd0e4;color:#173035;font-weight:700;font-size:16px;cursor:pointer;transition:transform .22s,box-shadow .22s" @click="signin"><i class="ti ti-login-2" style="font-size:20px"></i><span data-server-login="">{{ serverLoginLabel }}</span></button>
			</div>
			<div class="join-acknowledgement">
				<div class="join-ack-brand"><span style="font-family:Righteous,cursive;font-size:19px">Hataskey Lite</span></div>
				<p class="join-ack-copy"><span data-en="Hataskey Lite is a lighter edition of Hataskey, a CherryPick fork, which is itself a Misskey fork.">Hataskey LiteはHataskeyの軽量版です。HataskeyはCherryPickのフォークで、CherryPickはMisskeyのフォークです。</span><br class="mobile-copy-break"><span data-en=" Thank you to both projects.">両プロジェクトへ深く感謝します。</span><br><span data-en="This implementation stands on their work.">この実装はそのうえに立っています。</span></p>
				<div class="join-ack-version">Hataskey Lite {{ version }} / based on Misskey {{ basedMisskeyVersion }}</div>
				<!-- FEDIVERSE RIGHTS START -->
				<details id="fediverse-rights" class="fediverse-rights">
					<summary><span data-en="※ About logos and names">※ ロゴ・名称について</span><i class="ti ti-chevron-down" aria-hidden="true"></i></summary>
					<div>
						<p><span data-en="Misskey logo: © syuilo and Misskey Project · ">Misskeyロゴ: © syuilo and Misskey Project · </span><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> · <a href="https://misskey-hub.net/ja/brand-assets/" target="_blank" rel="noopener noreferrer" data-en="Source">出典</a><br><span data-en="The original SVG is unchanged; its display color follows the theme.">SVG原本は変更せず、表示色だけテーマに合わせています。</span></p>
						<p data-en="Hataskey Lite is not an official project of Misskey Project or CherryPick Project and is not affiliated with or endorsed by either project.">Hataskey LiteはMisskey ProjectおよびCherryPick Projectの公式プロジェクトではなく、両プロジェクトとの提携・推薦を示すものではありません。</p>
					</div>
				</details>
				<!-- FEDIVERSE RIGHTS END -->
			</div>
		</div>
	</section>

	<button class="back-to-top" type="button" aria-label="トップへ戻る" data-aria-en="Back to top" aria-hidden="true" tabindex="-1" data-visible="false" @click="controller.scrollToTop"><i class="ti ti-arrow-up" aria-hidden="true"></i></button>
</div>
</template>

<script lang="ts" setup>
import { computed, markRaw, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { basedMisskeyVersion, instanceName, lang as clientLang, version } from '@@/js/config.js';
import WelcomeFederation from './welcome.entrance.federation.vue';
import WelcomeServerActivity from './welcome.entrance.activity.vue';
import { HataskeyWelcomeController } from './welcome.entrance.hataskey.js';
import WelcomePostColumns from './welcome.entrance.post-columns.vue';
import './welcome.entrance.hataskey.css';
import './welcome.entrance.previews.css';
import XSigninDialog from '@/components/MkSigninDialog.vue';
import XSignupBranchDialog from '@/components/MkSignupBranchDialog.vue';
import { instance } from '@/instance.js';
import { i18n } from '@/i18n.js';
import { globalEvents } from '@/events.js';
import { miLocalStorage } from '@/local-storage.js';
import { prefer } from '@/preferences.js';
import { mainRouter } from '@/router.js';
import { store } from '@/store.js';
import * as os from '@/os.js';
import { useWelcomePublicNotes } from '@/utility/welcome-public-notes.js';
import { sanitizeServerDescription } from '@/utility/sanitize-server-description.js';

const language = ref<'ja' | 'en'>(clientLang.startsWith('ja') ? 'ja' : 'en');

function safeWebUrl(value: string | null | undefined) {
	if (!value) return undefined;
	try { const url = new URL(value, window.location.origin); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}

const serverName = computed(() => instance.name || instanceName);
const serverIcon = computed(() => safeWebUrl(instance.iconUrl) || '/favicon.ico');
const serverDescriptionHtml = computed(() => sanitizeServerDescription(instance.description));
const serverSignupLabel = computed(() => instance.registrationClosed
	? (language.value === 'ja' ? 'このサーバーは現在未開放です' : 'This server is currently closed to registration')
	: (language.value === 'ja' ? 'サーバーに登録する' : 'Register on this server'));
const serverLoginLabel = computed(() => language.value === 'ja' ? serverName.value + 'にログイン' : 'Log in to ' + serverName.value);
const serverBackground = computed(() => { const url = safeWebUrl(instance.backgroundImageUrl); return url ? 'url(' + JSON.stringify(url) + ')' : 'none'; });
const legalLinks = computed(() => [
	{ href: instance.impressumUrl, label: i18n.ts.impressum, icon: 'ti ti-file-invoice' },
	{ href: instance.tosUrl, label: i18n.ts.termsOfService, icon: 'ti ti-notebook' },
	{ href: instance.privacyPolicyUrl, label: i18n.ts.privacyPolicy, icon: 'ti ti-shield-lock' },
].map(link => ({ ...link, href: safeWebUrl(link.href) })).filter((link): link is { href: string; label: string; icon: string } => Boolean(link.href)));
useWelcomePublicNotes();
const colorMode = computed(() => store.r.darkMode.value ? 'dark' : 'light');
const controller = markRaw(new HataskeyWelcomeController({
	colorMode: store.r.darkMode.value ? 'dark' : 'light',
	federationMode: instance.federation,
}));
let dialogOpen = false;

function signin() {
	if (dialogOpen) return;
	dialogOpen = true;
	controller.root?.setAttribute('data-auth-dialog-open', 'true');
	const { dispose } = os.popup(XSigninDialog, { autoSet: true }, { closed: () => { dialogOpen = false; controller.root?.removeAttribute('data-auth-dialog-open'); dispose(); } });
}

function signup() {
	if (instance.registrationClosed || dialogOpen) return;
	dialogOpen = true;
	controller.root?.setAttribute('data-auth-dialog-open', 'true');
	const { dispose } = os.popup(XSignupBranchDialog, { autoSet: true }, { closed: () => { dialogOpen = false; controller.root?.removeAttribute('data-auth-dialog-open'); dispose(); } });
}

function openPage(path: string, event: MouseEvent) { controller.closeVisitorMenu(event); mainRouter.pushByPath(path); }

async function toggleTheme() {
	if (prefer.r.syncDeviceDarkMode.value) {
		const { canceled } = await os.confirm({ type: 'question', text: i18n.tsx.switchDarkModeManuallyWhenSyncEnabledConfirm({ x: i18n.ts.syncDeviceDarkMode }) });
		if (canceled) return;
		prefer.commit('syncDeviceDarkMode', false);
	}
	store.set('darkMode', !store.r.darkMode.value);
}

function selectLanguage(event: MouseEvent) {
	const selected = (event.currentTarget as HTMLElement).dataset.lang;
	if (selected !== 'ja' && selected !== 'en') return;
	controller.selectLang(event);
	language.value = selected;
	const locale = selected === 'ja' ? 'ja-JP' : 'en-US';
	miLocalStorage.setItem('lang', locale);
	if (clientLang !== locale) window.location.reload();
}

function syncTheme() { controller.applyColorMode(store.r.darkMode.value ? 'dark' : 'light'); }

watch(serverName, () => controller.requestMeasure());
watch(() => instance.federation, mode => controller.setFederationMode(mode));
onMounted(() => { controller.mount(); controller.setLanguage(language.value); globalEvents.on('themeChanging', syncTheme); });
onBeforeUnmount(() => { globalEvents.off('themeChanging', syncTheme); controller.destroy(); });
</script>
