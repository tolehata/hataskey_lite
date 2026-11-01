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
			<a class="visitor-trigger github-link" target="_blank" rel="noopener noreferrer" aria-label="GitHubでHataskeyを見る" data-aria-en="View Hataskey on GitHub" :href="safeWebUrl(instance.repositoryUrl) || 'https://github.com/tolehata/hataskey'"><i class="ti ti-brand-github" aria-hidden="true"></i></a>
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
							<button class="visitor-menu-item" type="button" @click="openPage('/hata-docs', $event)"><i class="ti ti-bulb" aria-hidden="true"></i><span data-en="Documentation">ドキュメント</span></button>
							<button class="visitor-menu-item" type="button" @click="openPage('/mfc-cheat-sheet', $event)"><i class="ti ti-help-circle" aria-hidden="true"></i><span data-en="MFC cheat sheet">MFCチートシート</span></button>
							<button class="visitor-menu-item" type="button" @click="openPage('/keyboard-shortcuts', $event)"><i class="ti ti-keyboard" aria-hidden="true"></i><span data-en="Keyboard shortcuts">ショートカット一覧</span></button>
						</div>
					</details>
					<button class="visitor-menu-item" type="button" @click="openPage('/about-misskey', $event)"><span class="visitor-menu-icon-space" aria-hidden="true"></span><span data-en="About Hataskey">Hataskeyについて</span></button>
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
			<h1 class="hero-identity" data-no-split="" :aria-label="serverName + ' — Based on Hataskey'">
				<span class="identity-face identity-face-server" aria-hidden="true">
					<img class="server-icon-large" alt="" :src="serverIcon">
					<span class="server-brand">
						<span class="server-name" data-server="">{{ serverName }}</span>
						<span class="based-on"><span class="based-on-kicker">Based on</span><strong>Hataskey</strong></span>
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

	<div class="chapter-marquee">
		<div style="display:flex;align-items:center;gap:40px;padding:13px 0;white-space:nowrap;width:max-content;animation:hWelcome-marquee 38s linear infinite;font-family:Righteous,cursive;font-size:13px;letter-spacing:.06em;color:var(--fgMuted)">
			<span>HATASKEY UI</span><span style="color:var(--accent)">◆</span><span>HATASK</span><span style="color:var(--accent)">◆</span><span>HATADY</span><span style="color:var(--accent)">◆</span><span>HATAFEED</span><span style="color:var(--accent)">◆</span><span>HATASIDESTUDIO</span><span style="color:var(--accent)">◆</span><span>Hataskey UI S</span><span style="color:var(--accent)">◆</span>
			<span>HATASKEY UI</span><span style="color:var(--accent)">◆</span><span>HATASK</span><span style="color:var(--accent)">◆</span><span>HATADY</span><span style="color:var(--accent)">◆</span><span>HATAFEED</span><span style="color:var(--accent)">◆</span><span>HATASIDESTUDIO</span><span style="color:var(--accent)">◆</span><span>Hataskey UI S</span><span style="color:var(--accent)">◆</span>
		</div>
	</div>

	<!-- ══ FEDIVERSE ══ -->
	<section id="fediverse" class="fediverse-intro" data-fediverse-stage="complete" data-fediverse-moving="false" data-federation-mode="all" aria-labelledby="fediverse-heading">
		<div class="fediverse-inner">
			<header class="fediverse-heading-row">
				<div>
					<div class="fediverse-kicker"><span aria-hidden="true"></span>HELLO, FEDIVERSE</div>
					<h2 id="fediverse-heading" class="fediverse-heading" data-symbol-heading="" data-no-split="" aria-label="Hataskeyから、サーバーの向こうへ。" data-aria-en="Hataskey brings other servers closer."><span class="symbol-copy" data-symbol-lang="ja" aria-hidden="true"><span class="symbol-swap symbol-fediverse" style="--symbol-delay:.12s"><span class="symbol-icon" aria-hidden="true"><i class="ti ti-world" aria-hidden="true"></i></span><span class="symbol-text" data-symbol-last="">Hataskey</span></span>から、<br>サーバーの向こうへ。</span><span class="symbol-copy" data-symbol-lang="en" aria-hidden="true"><span class="symbol-swap symbol-fediverse" style="--symbol-delay:.12s"><span class="symbol-icon" aria-hidden="true"><i class="ti ti-world" aria-hidden="true"></i></span><span class="symbol-text" data-symbol-last="">Hataskey</span></span> brings<br>other servers closer.</span></h2>
				</div>
				<div class="fediverse-intro-copy">
					<p><span data-en="Hataskey builds on CherryPick, a fork of Misskey, with its own thoughtful touches.">Hataskeyは、Misskeyから生まれたCherryPickをベースに、使いやすさを重ねたSNSソフトウェアです。</span><a class="fediverse-footnote-ref" href="#fediverse-rights" role="doc-noteref" aria-label="注釈：ロゴ・名称について" data-aria-en="Note: about logos and names">※</a><span data-en=" It supports ActivityPub, a shared way for social servers to communicate.">サーバー同士でやり取りする共通の仕組み「ActivityPub」に対応しています。</span></p>
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
						<div class="fediverse-brand-mark"><strong class="fediverse-wordmark">Hataskey</strong></div>
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

	<!-- ══ 01 UI ══ -->
	<section id="ui" data-ui-section="" data-device="pc" style="padding:96px 24px 0">
		<div style="max-width:1240px;margin:0 auto">
			<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:24px;animation:hWelcome-fadeUp linear both;animation-timeline:view();animation-range:entry 3% cover 22%">
				<div style="flex:1 1 460px">
					<div style="display:flex;align-items:center;gap:10px;font-size:11.5px;font-weight:700;letter-spacing:.14em;color:var(--accentText)"><span style="width:26px;height:2px;background:var(--accent)"></span>01&nbsp;&nbsp;HATASKEY UI</div>
					<h2 data-no-split="" data-symbol-heading="" aria-label="カプセル型UI。名乗るのは、選ばれたタブだけ。" data-aria-en="A capsule of tabs. Only the chosen one says its name." style="font-size:clamp(28px,4.2vw,50px);line-height:1.18;margin:14px 0 0;letter-spacing:-.01em"><span class="symbol-copy" data-symbol-lang="ja" aria-hidden="true"><span class="symbol-capsule-swap"><span class="symbol-capsule-form" aria-hidden="true"></span><span class="symbol-capsule-copy" data-symbol-last="">カプセル型</span></span>UI。<br>名乗るのは、選ばれたタブだけ。</span><span class="symbol-copy" data-symbol-lang="en" aria-hidden="true">A <span class="symbol-capsule-swap"><span class="symbol-capsule-form" aria-hidden="true"></span><span class="symbol-capsule-copy" data-symbol-last="">capsule</span></span> of tabs.<br>Only the chosen one says its name.</span></h2>
				</div>
				<p style="flex:1 1 320px;max-width:460px;margin:0;font-size:14.5px;line-height:1.9;color:var(--fgSoft);text-wrap:pretty" data-en="Sidebar on desktop; the capsule nav sits at the bottom on mobile only. Flip the switch — the layout swaps exactly as the client does.">PCはサイドメニュー、下部のカプセル型ナビはモバイル表示だけ。スイッチを押すと、クライアントと同じ出し分けで切り替わります。</p>
			</div>

			<div class="device-mode-controls">
				<div class="device-mode-switch" role="group" aria-label="プレビュー端末" data-aria-en="Preview device">
					<button data-dev="pc" type="button" aria-pressed="true" style="display:flex;align-items:center;gap:7px;height:34px;padding:0 16px;border:0;border-radius:999px;background:var(--deviceActiveBg);color:var(--deviceActiveFg);font-size:12.5px;font-weight:700;cursor:pointer;transition:all .22s" @click="controller.onDevice"><i class="ti ti-device-desktop" aria-hidden="true"></i>PC</button>
					<button data-dev="mobile" type="button" aria-pressed="false" style="display:flex;align-items:center;gap:7px;height:34px;padding:0 16px;border:0;border-radius:999px;background:transparent;color:var(--fgMuted);font-size:12.5px;font-weight:700;cursor:pointer;transition:all .22s" @click="controller.onDevice"><i class="ti ti-device-mobile" aria-hidden="true"></i><span data-en="Mobile">モバイル</span></button>
				</div>
			</div>

			<div :ref="controller.shellRef" style="margin:18px auto 0;max-width:100%;transition:max-width .55s cubic-bezier(.2,.8,.2,1),border-radius .45s;border-radius:20px;overflow:hidden;border:1px solid var(--dividerStrong);box-shadow:0 30px 70px rgba(34,66,69,.14);background:var(--bg);animation:hWelcome-fromBelow 1s cubic-bezier(.2,.8,.2,1) both;animation-timeline:view();animation-range:entry 0% cover 18%">
				<div :ref="controller.chromeRef" style="display:flex;align-items:center;gap:7px;padding:9px 14px;background:var(--panel);border-bottom:.5px solid var(--divider)">
					<span style="width:10px;height:10px;border-radius:50%;background:#ec6a5e"></span><span style="width:10px;height:10px;border-radius:50%;background:#f4bf4f"></span><span style="width:10px;height:10px;border-radius:50%;background:#61c554"></span>
					<span style="margin-left:12px;font-size:11px;color:var(--fgMuted)">demo.hataskey.example</span>
				</div>
				<div style="display:flex;height:min(80dvh,720px);min-height:580px">
					<nav :ref="controller.sideRef" style="width:220px;flex-shrink:0;background:var(--panel);border-right:.5px solid var(--divider);display:flex;flex-direction:column;padding:16px 12px;overflow:hidden">
						<div style="display:flex;align-items:center;gap:6px;margin-bottom:20px">
							<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;flex:1;min-width:0;cursor:pointer;transition:background .2s" class="hWelcome-state-3">
								<span style="width:28px;height:28px;border-radius:8px;background:var(--accent);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px"><i class="ti ti-icons"></i></span>
								<span style="display:flex;flex-direction:column;min-width:0"><span style="font-size:9.5px;opacity:.5;line-height:1;margin-bottom:1px" data-en="you are at">ここは</span><span style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Hataskey Demo</span></span>
							</div>
							<button style="width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:var(--fg);opacity:.5;cursor:pointer;font-size:17px;transition:all .2s" class="hWelcome-state-4"><i class="ti ti-adjustments"></i></button>
						</div>
						<div :ref="controller.sideScrollRef" style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;display:flex;flex-direction:column;gap:2px;mask-image:linear-gradient(to bottom,transparent 0,#000 10px,#000 calc(100% - 12px),transparent 100%);-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 10px,#000 calc(100% - 12px),transparent 100%)">
							<button data-sb="timeline" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:none;background:var(--accentedBg);color:var(--accent);font-weight:600;cursor:pointer;font-size:14.4px;text-align:left;transition:all .2s" @click="controller.onSidebar"><i class="ti ti-home" style="font-size:18.4px;width:22px;text-align:center;flex-shrink:0"></i><span data-en="Timeline">タイムライン</span></button>
							<button data-sb="search" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:none;background:transparent;color:var(--fg);opacity:.7;cursor:pointer;font-size:14.4px;text-align:left;transition:all .2s" class="hWelcome-state-5" @click="controller.onSidebar"><i class="ti ti-search" style="font-size:18.4px;width:22px;text-align:center;flex-shrink:0"></i><span data-en="Search">検索</span></button>
							<button data-sb="notifications" style="position:relative;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:none;background:transparent;color:var(--fg);opacity:.7;cursor:pointer;font-size:14.4px;text-align:left;transition:all .2s" class="hWelcome-state-6" @click="controller.onSidebar"><i class="ti ti-bell" style="font-size:18.4px;width:22px;text-align:center;flex-shrink:0"></i><span data-en="Notifications">通知</span><span data-notifbadge="" style="position:absolute;top:6px;right:10px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#f44;color:#fff;font-size:10px;font-weight:700;line-height:18px;text-align:center">3</span></button>
							<button data-sb="chat" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:none;background:transparent;color:var(--fg);opacity:.7;cursor:pointer;font-size:14.4px;text-align:left;transition:all .2s" class="hWelcome-state-7" @click="controller.onSidebar"><i class="ti ti-messages" style="font-size:18.4px;width:22px;text-align:center;flex-shrink:0"></i><span data-en="Messages">メッセージ</span></button>
							<button data-sb="announcements" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:none;background:transparent;color:var(--fg);opacity:.7;cursor:pointer;font-size:14.4px;text-align:left;transition:all .2s" class="hWelcome-state-8" @click="controller.onSidebar"><i class="ti ti-speakerphone" style="font-size:18.4px;width:22px;text-align:center;flex-shrink:0"></i><span data-en="Announcements">お知らせ</span></button>
							<button data-sb="drive" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:none;background:transparent;color:var(--fg);opacity:.7;cursor:pointer;font-size:14.4px;text-align:left;transition:all .2s" class="hWelcome-state-9" @click="controller.onSidebar"><i class="ti ti-cloud" style="font-size:18.4px;width:22px;text-align:center;flex-shrink:0"></i><span data-en="Drive">ドライブ</span></button>
							<div style="height:1px;background:var(--divider);margin:8px 4px"></div>
							<a href="#hatask" style="border:0;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;color:var(--fg);opacity:.7;font-size:14.4px;transition:all .2s" class="hWelcome-state-10"><i class="ti ti-eye" style="font-size:18.4px;width:22px;text-align:center;flex-shrink:0"></i><span style="font-family:Righteous,cursive">Hatask</span></a>
							<a href="#hatafeed" style="border:0;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;color:var(--fg);opacity:.7;font-size:14.4px;transition:all .2s" class="hWelcome-state-11"><i class="ti ti-message-report" style="font-size:18.4px;width:22px;text-align:center;flex-shrink:0"></i><span style="font-family:Righteous,cursive">HataFeed</span></a>
							<a href="#hatady" style="border:0;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;color:var(--fg);opacity:.7;font-size:14.4px;transition:all .2s" class="hWelcome-state-12"><i class="ti ti-book-2" style="font-size:18.4px;width:22px;text-align:center;flex-shrink:0"></i><span style="font-family:Righteous,cursive">Hatady</span></a>
							<div style="height:1px;background:var(--divider);margin:8px 4px"></div>
							<button data-sb="more" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:none;background:transparent;color:var(--fg);opacity:.7;cursor:pointer;font-size:14.4px;text-align:left;transition:all .2s" class="hWelcome-state-13" @click="controller.onSidebar"><i class="ti ti-dots" style="font-size:18.4px;width:22px;text-align:center;flex-shrink:0"></i><span data-en="More!">もっと！</span></button>
							<button :ref="controller.rtRef" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:none;background:var(--accentedBg);color:var(--accent);font-weight:600;cursor:pointer;font-size:14.4px;text-align:left;transition:all .2s" @click="controller.onRealtime"><i class="ti ti-bolt" style="font-size:18.4px;width:22px;text-align:center;flex-shrink:0" data-rticon=""></i><span data-en="Realtime">リアルタイム</span><span data-rtstate="" style="margin-left:auto;font-size:10px;font-weight:700;letter-spacing:.05em">ON</span></button>
						</div>
						<div style="padding-top:12px;border-top:1px solid var(--divider);margin-top:8px;flex-shrink:0;display:flex;flex-direction:column;gap:8px">
							<button style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 0;border:none;border-radius:999px;background:linear-gradient(135deg,var(--accent),#5bb9d8);color:#fff;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s" class="hWelcome-state-14 hWelcome-state-15" @click="controller.focusComposer"><i class="ti ti-pencil"></i><span data-en="Note">ノート</span></button>
							<div style="display:flex;gap:2px;padding:3px;border-radius:999px;background:rgba(52,161,201,.08)">
								<button style="flex:1;height:26px;border:0;border-radius:999px;background:var(--accent);color:#fff;cursor:pointer;font-size:13px"><i class="ti ti-device-mobile"></i></button>
								<a href="#deck" style="flex:1;height:26px;border:0;border-radius:999px;background:transparent;color:var(--fgMuted);font-size:13px;display:flex;align-items:center;justify-content:center" class="hWelcome-state-16"><i class="ti ti-layout-columns"></i></a>
							</div>
							<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-radius:10px;cursor:pointer" class="hWelcome-state-17"><img class="hatakyu-user-avatar hatakyu-user-avatar-account" src="/client-assets/hatakyu/waving.png" width="26" height="26" alt="" aria-hidden="true" draggable="false" decoding="async"><span style="font-size:12.5px;color:var(--fgSoft)">@you</span></div>
						</div>
					</nav>

					<div style="flex:1;min-width:0;position:relative;display:flex;flex-direction:column;background:var(--bg)">
						<div style="position:absolute;top:0;left:0;right:0;z-index:20;display:flex;justify-content:center;align-items:flex-start;gap:6px;padding:10px 16px 8px;pointer-events:none">
							<button :ref="controller.drawerBtnRef" class="capsule-drawer-button" style="display:none;width:36px;height:36px;border-radius:9999px;border:none;cursor:pointer;align-items:center;justify-content:center;pointer-events:auto;margin-top:2px;background:rgba(245,245,245,.78);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);box-shadow:0 4px 24px rgba(0,0,0,.06),0 0 0 .5px rgba(0,0,0,.06) inset;color:rgba(0,0,0,.45);font-size:15px"><i class="ti ti-menu-2"></i></button>
							<div :ref="controller.pillRef" class="capsule-topbar" style="display:flex;align-items:center;gap:2px;padding:4px 6px;border-radius:9999px;width:max-content;max-width:100%;pointer-events:auto;background:rgba(245,245,245,.78);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);box-shadow:0 4px 24px rgba(0,0,0,.06),0 0 0 .5px rgba(0,0,0,.06) inset;overflow-x:auto;scrollbar-width:none">
								<button data-tab="following" aria-selected="true" style="min-width:40px;height:40px;border-radius:9999px;background:rgba(0,0,0,.06);border:none;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;color:var(--accent);transition:all .25s ease;flex-shrink:0" @click="controller.onTab"><i class="ti ti-home"></i><span style="font-size:12.2px;font-weight:600;line-height:1;white-space:nowrap" data-en="Home">ホーム</span></button>
								<button data-tab="local" aria-selected="false" style="min-width:40px;height:40px;border-radius:9999px;background:transparent;border:none;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;color:rgba(0,0,0,.38);transition:all .25s ease;flex-shrink:0" @click="controller.onTab"><i class="ti ti-planet"></i></button>
								<button data-tab="mixed" aria-selected="false" style="min-width:40px;height:40px;border-radius:9999px;background:transparent;border:none;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;color:rgba(0,0,0,.38);transition:all .25s ease;flex-shrink:0" @click="controller.onTab"><i class="ti ti-universe"></i></button>
								<span style="width:1px;height:20px;flex-shrink:0;margin:0 4px;background:rgba(0,0,0,.1)"></span>
								<button data-tab="list" aria-selected="false" style="min-width:40px;height:40px;border-radius:9999px;background:transparent;border:none;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;color:rgba(0,0,0,.38);transition:all .25s ease;flex-shrink:0" @click="controller.onTab"><i class="ti ti-list"></i></button>
								<button data-tab="channel" aria-selected="false" style="min-width:40px;height:40px;border-radius:9999px;background:transparent;border:none;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;color:rgba(0,0,0,.38);transition:all .25s ease;flex-shrink:0" @click="controller.onTab"><i class="ti ti-device-tv"></i></button>
								<button data-tab="antenna" aria-selected="false" style="min-width:40px;height:40px;border-radius:9999px;background:transparent;border:none;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;color:rgba(0,0,0,.38);transition:all .25s ease;flex-shrink:0" @click="controller.onTab"><i class="ti ti-antenna"></i></button>
							</div>
						</div>

						<div :ref="controller.tlRef" style="flex:1;overflow-y:auto;padding:64px 0 20px;scrollbar-width:thin">
							<div style="max-width:660px;margin:0 auto;padding:0 14px">
								<!-- MkPostForm -->
								<div :ref="controller.formRef" style="position:relative;background:var(--panel);border:1px solid var(--divider);border-radius:14px;overflow:hidden;margin-bottom:10px;transition:box-shadow .25s">
									<header style="min-height:50px;display:flex;flex-wrap:nowrap;gap:4px;padding:8px 12px">
										<div style="display:flex;flex:1;align-items:center;gap:6px;padding-left:12px"><img class="hatakyu-user-avatar hatakyu-user-avatar-composer" src="/client-assets/hatakyu/waving.png" width="28" height="28" alt="" aria-hidden="true" draggable="false" decoding="async"></div>
										<div style="display:flex;min-height:48px;font-size:12.6px;flex-wrap:nowrap;align-items:center;margin-left:auto;gap:4px;padding-left:4px">
											<button :ref="controller.visRef" style="margin:0;padding:8px;border:0;border-radius:6px;background:transparent;color:var(--fg);cursor:pointer;display:flex;align-items:center;max-width:210px;transition:background .15s" class="hWelcome-state-18" @click="controller.cycleVis"><span data-visicon=""><i class="ti ti-world"></i></span><span data-vislabel="" style="padding-left:6px;opacity:.8">公開</span></button>
											<button :ref="controller.loRef" style="margin:0;padding:8px;border:0;border-radius:6px;background:transparent;color:var(--fg);cursor:pointer;transition:background .15s" class="hWelcome-state-19" @click="controller.toggleLocalOnly"><i class="ti ti-rocket"></i></button>
											<button style="margin:0;padding:8px;border:0;border-radius:6px;background:transparent;color:var(--fg);cursor:pointer;transition:background .15s" class="hWelcome-state-20"><i class="ti ti-dots"></i></button>
											<div style="display:flex;margin:12px 12px 12px 6px">
												<button :ref="controller.postBtnRef" style="border:0;background:none;padding:0;cursor:pointer" @click="controller.onPost"><span :ref="controller.submitInnerRef" style="display:flex;height:34px;width:90px;min-width:90px;align-items:center;justify-content:center;gap:6px;padding:0 8px;line-height:1;font-weight:bold;font-size:13px;border-radius:6px 0 0 6px;color:#fff;background:var(--accent);transition:background .15s"><span data-postlabel="" data-en="Note">ノート</span><i class="ti ti-send" data-posticon=""></i></span></button>
												<button style="border:0;background:none;padding:0;margin-left:2px;cursor:pointer"><span style="display:flex;height:34px;align-items:center;justify-content:center;padding:0 5px;border-radius:0 6px 6px 0;color:#fff;background:var(--accent)"><i class="ti ti-caret-down-filled"></i></span></button>
											</div>
										</div>
									</header>
									<div style="width:100%;position:relative"><textarea :ref="controller.inputRef" placeholder="これはデモです。試しに何か書いてみましょう。" data-placeholder-en="This is a demo. Try writing something." aria-label="ノート本文" data-aria-en="Note text" style="display:block;box-sizing:border-box;padding:0 30px;margin:0;width:100%;min-height:70px;resize:none;font-size:15.4px;line-height:1.75;border:none;background:transparent;color:var(--fg);outline:none"></textarea></div>
									<footer style="display:flex;padding:0 16px 16px 16px">
										<div style="flex:1;display:grid;grid-auto-flow:column;grid-template-columns:repeat(auto-fill,minmax(42px,1fr));grid-auto-rows:40px;overflow-x:auto;max-width:85%;scrollbar-width:none">
											<button style="border:0;background:transparent;color:var(--fg);border-radius:6px;cursor:pointer;font-size:16px;transition:background .15s" class="hWelcome-state-21"><i class="ti ti-photo-plus"></i></button>
											<button style="border:0;background:transparent;color:var(--fg);border-radius:6px;cursor:pointer;font-size:16px;transition:background .15s" class="hWelcome-state-22"><i class="ti ti-cloud-download"></i></button>
											<button style="border:0;background:transparent;color:var(--fg);border-radius:6px;cursor:pointer;font-size:16px;transition:background .15s" class="hWelcome-state-23"><i class="ti ti-chart-arrows"></i></button>
											<button style="border:0;background:transparent;color:var(--fg);border-radius:6px;cursor:pointer;font-size:16px;transition:background .15s" class="hWelcome-state-24"><i class="ti ti-eye-off"></i></button>
											<button style="border:0;background:transparent;color:var(--fg);border-radius:6px;cursor:pointer;font-size:16px;transition:background .15s" class="hWelcome-state-25"><i class="ti ti-hash"></i></button>
											<button style="border:0;background:transparent;color:var(--fg);border-radius:6px;cursor:pointer;font-size:16px;transition:background .15s" class="hWelcome-state-26"><i class="ti ti-at"></i></button>
											<button style="border:0;background:transparent;color:var(--fg);border-radius:6px;cursor:pointer;font-size:16px;transition:background .15s" class="hWelcome-state-27"><i class="ti ti-calendar"></i></button>
											<button style="border:0;background:transparent;color:var(--fg);border-radius:6px;cursor:pointer;font-size:16px;transition:background .15s" class="hWelcome-state-28"><i class="ti ti-palette"></i></button>
											<button style="border:0;background:transparent;color:var(--fg);border-radius:6px;cursor:pointer;font-size:16px;transition:background .15s" class="hWelcome-state-29" @click="controller.insertUtage"><i class="ti ti-mood-happy"></i></button>
										</div>
									</footer>
									<div :ref="controller.delayRef" style="display:none;position:absolute;left:50%;bottom:10px;z-index:1100;align-items:center;gap:8px;width:min(330px,calc(100% - 20px));padding:7px 8px 7px 12px;border:1px solid color-mix(in srgb,var(--accent) 45%,var(--divider));border-radius:999px;background:color-mix(in srgb,var(--panel) 94%,transparent);box-shadow:0 6px 24px rgba(34,66,69,.32);overflow:hidden;white-space:nowrap;backdrop-filter:blur(10px);transform:translateX(-50%)">
										<span :ref="controller.ringRef" style="width:22px;height:22px;border-radius:50%;flex-shrink:0;background:conic-gradient(var(--accent) 0turn,rgba(64,89,91,.15) 0turn)"></span>
										<span style="font-size:12.5px;font-weight:700;flex:1"><span data-delaytext="">3秒後に投稿します</span></span>
										<button style="padding:5px 9px;border:0;border-radius:999px;font-size:11.5px;font-weight:700;cursor:pointer;color:var(--fg);background:rgba(64,89,91,.08)" data-en="Cancel" @click="controller.cancelDelay">取り消し</button>
										<button style="padding:5px 9px;border:0;border-radius:999px;font-size:11.5px;font-weight:700;cursor:pointer;color:#fff;background:var(--accent)" data-en="Send now" @click="controller.sendNow">今すぐ</button>
									</div>
								</div>

								<div :ref="controller.feedRef"></div>

								<!-- ノート1: 宴 -->
								<div :ref="controller.utageRef" data-utage-note="" data-utage-state="pending" style="position:relative;font-size:16.8px;background:var(--panel);border:1px solid var(--divider);border-radius:14px;margin-bottom:8px;overflow:visible">
									<article style="position:relative;padding:10px 10px 6px">
										<div style="position:relative">
											<div :ref="controller.utageBadgeRef" data-utage-badge="" aria-live="polite">判定待ち</div>
											<div style="display:flex;padding-bottom:10px">
												<img class="hatakyu-user-avatar hatakyu-user-avatar-note" src="/client-assets/hatakyu/checking-time.png" width="58" height="58" alt="" aria-hidden="true" draggable="false" decoding="async">
												<div style="flex:1;min-width:0">
													<header style="display:flex">
														<div style="align-items:flex-start;white-space:nowrap;flex-direction:column;overflow:hidden"><div style="display:flex;white-space:nowrap;align-items:baseline"><span style="margin:0 .5em 0 0;font-size:1em;font-weight:bold;overflow:hidden;text-overflow:ellipsis">みなも</span><span style="margin:0 .5em 0 0;font-size:.95em;opacity:.7;overflow:hidden;text-overflow:ellipsis">@minamo</span></div></div>
														<div style="display:flex;flex-direction:row;align-items:center;margin-left:auto;padding-left:10px;gap:.5em;font-size:.9em;opacity:.7"><i class="ti ti-rocket-off"></i><span>2分前</span></div>
													</header>
													<div style="margin-top:4px"><div style="overflow-wrap:break-word;font-size:1em;line-height:1.75">今夜は<b>宴</b>だ！ 集まれ〜</div></div>
													<footer style="margin:4px 0 -8px;display:flex">
														<button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-30"><i class="ti ti-arrow-back-up"></i></button>
														<button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-31"><i class="ti ti-repeat"></i><span style="display:inline;margin:0 0 0 8px;font-size:.8em">2</span></button>
														<button data-utage-react="" style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-32" @click="controller.onReact"><i class="ti ti-plus"></i></button>
														<button style="margin:0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-33"><i class="ti ti-dots"></i></button>
													</footer>
												</div>
											</div>
										</div>
									</article>
								</div>

								<!-- ノート2: リアクション付き -->
								<div style="position:relative;font-size:16.8px;background:var(--panel);border:1px solid var(--divider);border-radius:14px;margin-bottom:8px">
									<article style="position:relative;padding:10px 10px 6px">
										<div style="display:flex;padding-bottom:10px">
											<img class="hatakyu-user-avatar hatakyu-user-avatar-note" src="/client-assets/hatakyu/watering-flower.png" width="58" height="58" alt="" aria-hidden="true" draggable="false" decoding="async">
											<div style="flex:1;min-width:0">
												<header style="display:flex">
													<div style="align-items:flex-start;white-space:nowrap;flex-direction:column;overflow:hidden"><div style="display:flex;white-space:nowrap;align-items:baseline"><span style="margin:0 .5em 0 0;font-size:1em;font-weight:bold">こまち</span><span style="margin:0 .5em 0 0;font-size:.95em;opacity:.7">@komachi</span></div></div>
													<div style="display:flex;align-items:center;margin-left:auto;padding-left:10px;gap:.5em;font-size:.9em;opacity:.7"><span>17分前</span></div>
												</header>
												<div style="margin-top:4px"><div style="overflow-wrap:break-word;font-size:1em;line-height:1.75">設定画面、左に大分類・右にタブの2枚組みになってた。別窓だった独自設定もそのまま右側に出るの助かる</div></div>
												<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
													<button data-rx="" style="display:inline-flex;height:30px;padding:0 12px;font-size:1em;border-radius:999px;align-items:center;border:0;cursor:pointer;background:var(--btnBg);color:inherit;transition:background .15s" class="hWelcome-state-34" @click="controller.onReact">🎉<span style="font-size:.9em;line-height:22px;margin:0 0 0 5px" data-c="">12</span></button>
													<button data-rx="" style="display:inline-flex;height:30px;padding:0 12px;font-size:1em;border-radius:999px;align-items:center;border:0;cursor:pointer;background:var(--btnBg);color:inherit;transition:background .15s" class="hWelcome-state-35" @click="controller.onReact">👀<span style="font-size:.9em;line-height:22px;margin:0 0 0 5px" data-c="">4</span></button>
													<button data-rx="" style="display:inline-flex;height:30px;padding:0 12px;font-size:1em;border-radius:999px;align-items:center;border:0;cursor:pointer;background:var(--btnBg);color:inherit;transition:background .15s" class="hWelcome-state-36" @click="controller.onReact">🐾<span style="font-size:.9em;line-height:22px;margin:0 0 0 5px" data-c="">8</span></button>
												</div>
												<footer style="margin:4px 0 -8px;display:flex">
													<button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-37"><i class="ti ti-arrow-back-up"></i><span style="display:inline;margin:0 0 0 8px;font-size:.8em">3</span></button>
													<button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-38"><i class="ti ti-repeat"></i></button>
													<button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-39" @click="controller.onReact"><i class="ti ti-plus"></i></button>
													<button style="margin:0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-40"><i class="ti ti-dots"></i></button>
												</footer>
											</div>
										</div>
									</article>
								</div>

								<!-- ノート3: チャンネル投稿（colorBar） -->
								<div style="position:relative;font-size:16.8px;background:var(--panel);border:1px solid var(--divider);border-radius:14px;margin-bottom:8px">
									<article style="position:relative;padding:10px 10px 6px">
										<div style="position:relative">
											<span style="position:absolute;top:0;left:0;width:100%;height:100%;border-left:5px solid #e8a87c;border-radius:14px;pointer-events:none;box-sizing:border-box"></span>
											<div style="display:flex;padding-left:7px;padding-bottom:10px">
												<img class="hatakyu-user-avatar hatakyu-user-avatar-note" src="/client-assets/hatakyu/reading-book.png" width="58" height="58" alt="" aria-hidden="true" draggable="false" decoding="async">
												<div style="flex:1;min-width:0">
													<header style="display:flex">
														<div style="align-items:flex-start;white-space:nowrap;flex-direction:column;overflow:hidden"><div style="display:flex;white-space:nowrap;align-items:baseline"><span style="margin:0 .5em 0 0;font-size:1em;font-weight:bold">ゆの</span><span style="margin:0 .5em 0 0;font-size:.95em;opacity:.7">@yuno</span></div></div>
														<div style="display:flex;align-items:center;margin-left:auto;padding-left:10px;gap:.5em;font-size:.9em;opacity:.7"><i class="ti ti-device-tv"></i><span>34分前</span></div>
													</header>
													<div style="opacity:.7;font-size:80%;margin-top:2px"><i class="ti ti-device-tv" style="margin-right:4px"></i>つくったもの置き場</div>
													<div style="margin-top:4px"><div style="overflow-wrap:break-word;font-size:1em;line-height:1.75">サイドメニューをHataSideStudioで組み直した。丸ボタン3列＋お花ウィジェットで、だいぶ自分の机になってきた</div></div>
													<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
														<button data-rx="" style="display:inline-flex;height:30px;padding:0 12px;font-size:1em;border-radius:999px;align-items:center;border:0;cursor:pointer;background:var(--accentedBg);color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset" @click="controller.onReact">💪<span style="font-size:.9em;line-height:22px;margin:0 0 0 5px" data-c="">6</span></button>
														<button data-rx="" style="display:inline-flex;height:30px;padding:0 12px;font-size:1em;border-radius:999px;align-items:center;border:0;cursor:pointer;background:var(--btnBg);color:inherit;transition:background .15s" class="hWelcome-state-41" @click="controller.onReact">🛠️<span style="font-size:.9em;line-height:22px;margin:0 0 0 5px" data-c="">3</span></button>
													</div>
													<footer style="margin:4px 0 -8px;display:flex">
														<button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-42"><i class="ti ti-arrow-back-up"></i></button>
														<button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-43"><i class="ti ti-repeat"></i><span style="display:inline;margin:0 0 0 8px;font-size:.8em">1</span></button>
														<button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-44" @click="controller.onReact"><i class="ti ti-plus"></i></button>
														<button style="margin:0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-45"><i class="ti ti-dots"></i></button>
													</footer>
												</div>
											</div>
										</div>
									</article>
								</div>

								<!-- ノート4 -->
								<div style="position:relative;font-size:16.8px;background:var(--panel);border:1px solid var(--divider);border-radius:14px;margin-bottom:8px">
									<article style="position:relative;padding:10px 10px 6px">
										<div style="display:flex;padding-bottom:10px">
											<img class="hatakyu-user-avatar hatakyu-user-avatar-note" src="/client-assets/hatakyu/questioning.png" width="58" height="58" alt="" aria-hidden="true" draggable="false" decoding="async">
											<div style="flex:1;min-width:0">
												<header style="display:flex">
													<div style="align-items:flex-start;white-space:nowrap;flex-direction:column;overflow:hidden"><div style="display:flex;white-space:nowrap;align-items:baseline"><span style="margin:0 .5em 0 0;font-size:1em;font-weight:bold">くるみ</span><span style="margin:0 .5em 0 0;font-size:.95em;opacity:.7">@kurumi</span></div></div>
													<div style="display:flex;align-items:center;margin-left:auto;padding-left:10px;gap:.5em;font-size:.9em;opacity:.7"><i class="ti ti-home"></i><span>41分前</span></div>
												</header>
												<div style="margin-top:4px"><div style="overflow-wrap:break-word;font-size:1em;line-height:1.75">Hataskのお花、閉じてる間も育つようになってた。帰ってきたら咲いてるのうれしい 🌼</div></div>
												<footer style="margin:4px 0 -8px;display:flex">
													<button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-46"><i class="ti ti-arrow-back-up"></i></button>
													<button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-47"><i class="ti ti-repeat"></i></button>
													<button style="margin:0 10px 0 0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-48" @click="controller.onReact"><i class="ti ti-plus"></i></button>
													<button style="margin:0;padding:8px;border:0;background:none;cursor:pointer;font-size:1em;color:color-mix(in srgb,var(--panel),var(--fg) 70%)" class="hWelcome-state-49"><i class="ti ti-dots"></i></button>
												</footer>
											</div>
										</div>
									</article>
								</div>
							</div>
						</div>

						<!-- 下部ナビ（モバイルのみ） -->
						<div :ref="controller.bottomRef" class="capsule-bottom-nav" style="display:none;position:absolute;bottom:0;left:0;right:0;z-index:20;justify-content:center;align-items:center;gap:8px;padding:0 16px 12px;pointer-events:none">
							<button class="capsule-round-button hWelcome-state-50" style="width:48px;height:48px;border-radius:9999px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;pointer-events:auto;background:var(--capsuleSurface);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);box-shadow:0 5px 26px rgba(0,0,0,.1),0 0 0 1px rgba(64,89,91,.09) inset;color:color-mix(in srgb,var(--fg) 76%,transparent);transition:transform .15s"><i class="ti ti-menu-2"></i></button>
							<div class="capsule-bottom-pill" style="display:flex;align-items:center;gap:4px;padding:6px 8px;border-radius:9999px;pointer-events:auto;background:var(--capsuleSurface);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);box-shadow:0 5px 26px rgba(0,0,0,.1),0 0 0 1px rgba(64,89,91,.09) inset">
								<button class="capsule-nav-button" style="width:44px;height:44px;border-radius:50%;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:17px;color:var(--capsuleIcon);transition:all .2s"><i class="ti ti-search"></i></button>
								<button class="capsule-nav-button is-active" style="width:44px;height:44px;border-radius:50%;background:var(--btnBg);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:17px;color:var(--accent)"><i class="ti ti-home"></i></button>
								<button class="capsule-nav-button" style="position:relative;width:44px;height:44px;border-radius:50%;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:17px;color:var(--capsuleIcon);transition:all .2s"><i class="ti ti-bell"></i><span style="position:absolute;top:9px;right:10px;width:7px;height:7px;border-radius:50%;background:#f44;animation:hWelcome-pulseDot 1.8s ease-in-out infinite"></span></button>
								<button class="capsule-nav-button" style="width:44px;height:44px;border-radius:50%;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:17px;color:var(--capsuleIcon);transition:all .2s"><i class="ti ti-eye"></i></button>
							</div>
							<button class="capsule-round-button hWelcome-state-51" style="width:48px;height:48px;border-radius:9999px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;pointer-events:auto;background:var(--capsuleSurface);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);box-shadow:0 5px 26px rgba(0,0,0,.1),0 0 0 1px rgba(64,89,91,.09) inset;color:color-mix(in srgb,var(--fg) 76%,transparent);transition:transform .15s" @click="controller.focusComposer"><i class="ti ti-pencil"></i></button>
						</div>
					</div>
				</div>
			</div>
			<p class="demo-notice"><i class="ti ti-info-circle" aria-hidden="true"></i><span data-en="Posts, names and numbers in this preview are fictional examples.">プレビュー内の投稿・ユーザー名・数値は、説明用の架空のものです。</span></p>

			<div class="ui-feature-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px;margin-top:24px">
				<div style="padding:16px 0;border-top:2px solid var(--fg);animation:hWelcome-fadeUp linear both;animation-timeline:view();animation-range:entry 6% cover 26%"><div style="font-size:13px;font-weight:700;margin-bottom:6px" data-en="Countdown before posting">投稿前カウントダウン</div><p style="margin:0;font-size:12.5px;line-height:1.8;color:var(--fgSoft)" data-en="3, 5 or 10 seconds of grace — cancel, or send right now.">3秒・5秒・10秒の猶予。取り消しも、今すぐ送るもできます。</p></div>
				<div style="padding:16px 0;border-top:2px solid var(--fg);animation:hWelcome-fadeUp linear both;animation-timeline:view();animation-range:entry 6% cover 26%"><div style="font-size:13px;font-weight:700;margin-bottom:6px" data-en="Realtime arrivals">リアルタイム更新</div><p style="margin:0;font-size:12.5px;line-height:1.8;color:var(--fgSoft)" data-en="New notes slide in from the top; reactions and edits update in place.">新着は上から滑り込み。リアクションも編集もその場で更新。</p></div>
				<div style="padding:16px 0;border-top:2px solid var(--fg);animation:hWelcome-fadeUp linear both;animation-timeline:view();animation-range:entry 6% cover 26%"><div style="font-size:13px;font-weight:700;margin-bottom:6px" data-en="Utage">宴（うたげ）</div><p style="margin:0;font-size:12.5px;line-height:1.8;color:var(--fgSoft)" data-en="Notes containing 宴 pulse while pending. Any reaction makes them fail.">「宴」を含むノートは判定待ちの間、枠が脈打ちます。リアクションがつくと失敗になります。</p></div>
				<div style="padding:16px 0;border-top:2px solid var(--fg);animation:hWelcome-fadeUp linear both;animation-timeline:view();animation-range:entry 6% cover 26%"><div style="font-size:13px;font-weight:700;margin-bottom:6px" data-en="Channel colour bar">チャンネルの色帯</div><p style="margin:0;font-size:12.5px;line-height:1.8;color:var(--fgSoft)" data-en="Channel posts carry a 5px colour bar down the left edge of the note.">チャンネル投稿はノート左辺に5pxの色帯が付きます。</p></div>
			</div>
		</div>
	</section>

	<!-- ══ 02 DECK ══ -->
	<section id="deck" style="padding:96px 24px;margin-top:20px">
		<div style="max-width:1240px;margin:0 auto">
			<div data-deckstory="">
				<div class="deck-story-stage" data-deckstage="">
					<div data-deckintro="" style="animation:hWelcome-fadeUp linear both;animation-timeline:view();animation-range:entry 3% cover 22%">
						<div style="display:flex;align-items:center;gap:10px;font-size:11.5px;font-weight:700;letter-spacing:.14em;color:var(--accentText)"><span style="width:26px;height:2px;background:var(--accent)"></span>02&nbsp;&nbsp;DECK</div>
						<h2 data-no-split="" data-symbol-heading="" aria-label="箱にタブを差す、ブラウザ型のデッキ。" data-aria-en="A frame that takes tabs, shaped like a browser." style="font-size:clamp(28px,4.2vw,50px);line-height:1.18;margin:14px 0 0"><span class="symbol-copy" data-symbol-lang="ja" aria-hidden="true">箱にタブを<span class="symbol-drop"><span class="symbol-drop-slot" aria-hidden="true"></span><span class="symbol-drop-char" style="--insert-delay:0.00s">差</span><span class="symbol-drop-char" style="--insert-delay:0.09s" data-symbol-last="">す</span><i class="ti ti-color-picker symbol-dropper" aria-hidden="true"></i><span class="symbol-drop-bead" aria-hidden="true"></span></span>、<br>ブラウザ型のデッキ。</span><span class="symbol-copy" data-symbol-lang="en" aria-hidden="true">A frame that <span class="symbol-drop"><span class="symbol-drop-slot" aria-hidden="true"></span><span class="symbol-drop-char" style="--insert-delay:0.00s">t</span><span class="symbol-drop-char" style="--insert-delay:0.09s">a</span><span class="symbol-drop-char" style="--insert-delay:0.18s">k</span><span class="symbol-drop-char" style="--insert-delay:0.27s">e</span><span class="symbol-drop-char" style="--insert-delay:0.36s">s</span><span class="symbol-drop-char" style="--insert-delay:0.45s">&nbsp;</span><span class="symbol-drop-char" style="--insert-delay:0.54s">t</span><span class="symbol-drop-char" style="--insert-delay:0.63s">a</span><span class="symbol-drop-char" style="--insert-delay:0.72s">b</span><span class="symbol-drop-char" style="--insert-delay:0.81s" data-symbol-last="">s</span><i class="ti ti-color-picker symbol-dropper" aria-hidden="true"></i><span class="symbol-drop-bead" aria-hidden="true"></span></span>,<br>shaped like a browser.</span></h2>
						<p style="max-width:540px;margin:14px 0 0;font-size:14.5px;line-height:1.9;color:var(--fgSoft)"><span data-en="One frame holds any number of tabs.">1つの箱に何枚でもタブを差せます。</span><br><span data-en="Reorder them, reload a single column, stack frames vertically. Click a tab.">並べ替えも、カラム単体のリロードも。タブを押してみてください。</span></p>
						<p class="demo-notice is-start"><i class="ti ti-info-circle" aria-hidden="true"></i><span data-en="Posts, names and numbers in these decks are fictional examples.">デッキ内の投稿・ユーザー名・数値は、説明用の架空のものです。</span></p>
					</div>
					<div class="deck-scroll-guide"><i class="ti ti-arrow-down" aria-hidden="true"></i><span data-en="Scroll vertically to move through all three decks">縦にスクロールすると、3つのデッキが切り替わります</span></div>
					<div data-focus="" data-deckgrid="" style="position:relative;margin-top:36px;display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px">
						<div data-deckframe="" style="display:flex;flex-direction:column;height:440px;background:var(--bg);border:2px solid rgba(52,161,201,.5);border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.06);overflow:hidden;animation:hWelcome-fromLeft .9s cubic-bezier(.2,.8,.2,1) both;animation-timeline:view();animation-range:entry 2% cover 20%">
							<div style="flex-shrink:0;display:flex;align-items:center;gap:4px;padding:4px 8px;background:color-mix(in srgb,var(--accent) 8%,var(--bg));border-bottom:1px solid rgba(52,161,201,.5)">
								<span style="width:16px;text-align:center;opacity:.5;font-size:13px;cursor:grab"><i class="ti ti-grip-vertical"></i></span>
								<button data-dtab="f1-0" style="display:flex;align-items:center;gap:6px;min-height:32px;padding:7px 12px;border:1px solid rgba(52,161,201,.5);border-bottom:none;border-radius:10px 10px 0 0;background:var(--bg);color:var(--fg);opacity:1;font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s" @click="controller.onDeckTab"><i class="ti ti-home" style="color:var(--accent);font-size:14px"></i><span data-en="Home">ホーム</span></button>
								<button data-dtab="f1-1" style="display:flex;align-items:center;gap:6px;min-height:32px;padding:7px 12px;border:1px solid transparent;border-bottom:none;border-radius:10px 10px 0 0;background:transparent;color:var(--fg);opacity:.6;font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s" class="hWelcome-state-52" @click="controller.onDeckTab"><i class="ti ti-star" style="color:var(--accent);font-size:14px"></i><span data-en="Favourites">お気に入り</span></button>
								<button style="margin-left:auto;width:28px;height:28px;border:0;border-radius:999px;background:transparent;color:var(--fg);opacity:.7;cursor:pointer;font-size:14px" class="hWelcome-state-53"><i class="ti ti-refresh"></i></button>
							</div>
							<div style="flex:1;min-height:0;position:relative">
								<div data-dpane="f1-0" style="position:absolute;inset:0;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;animation:hWelcome-deckPaneIn .3s cubic-bezier(.2,.8,.2,1) both">
									<div style="font-size:14px;background:var(--panel);border:1px solid var(--divider);border-radius:12px;padding:8px"><div style="display:flex"><span style="flex-shrink:0;width:38px;height:38px;border-radius:999px;background:linear-gradient(140deg,#a5d8b5,#57a97a);margin:6px 10px 0 0"></span><div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline"><span style="font-weight:bold;margin-right:.5em">みなも</span><span style="opacity:.7;font-size:.9em">@minamo</span><span style="margin-left:auto;opacity:.7;font-size:.85em">2分</span></div><div style="margin-top:3px;line-height:1.7">カラム個別リロード、地味にいちばん効く</div><div style="display:flex;gap:2px;margin-top:2px;color:color-mix(in srgb,var(--panel),var(--fg) 70%)"><button style="padding:6px;border:0;background:none;cursor:pointer;color:inherit" class="hWelcome-state-54"><i class="ti ti-arrow-back-up"></i></button><button style="padding:6px;border:0;background:none;cursor:pointer;color:inherit" class="hWelcome-state-55"><i class="ti ti-repeat"></i></button><button style="padding:6px;border:0;background:none;cursor:pointer;color:inherit" class="hWelcome-state-56" @click="controller.onReact"><i class="ti ti-plus"></i></button></div></div></div></div>
									<div style="font-size:14px;background:var(--panel);border:1px solid var(--divider);border-radius:12px;padding:8px"><div style="display:flex"><span style="flex-shrink:0;width:38px;height:38px;border-radius:999px;background:linear-gradient(140deg,#f0c98f,#e0a44f);margin:6px 10px 0 0"></span><div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline"><span style="font-weight:bold;margin-right:.5em">こまち</span><span style="opacity:.7;font-size:.9em">@komachi</span><span style="margin-left:auto;opacity:.7;font-size:.85em">12分</span></div><div style="margin-top:3px;line-height:1.7">縦積みのフレーム、間をドラッグで高さ変えられるの気づいてなかった</div><div style="display:flex;gap:6px;margin-top:6px"><button data-rx="" style="display:inline-flex;height:30px;padding:0 12px;border-radius:999px;align-items:center;border:0;cursor:pointer;background:var(--btnBg);color:inherit;font-size:14px" @click="controller.onReact">👀<span style="font-size:.9em;margin-left:5px" data-c="">5</span></button></div></div></div></div>
									<div style="font-size:14px;background:var(--panel);border:1px solid var(--divider);border-radius:12px;padding:8px"><div style="display:flex"><span style="flex-shrink:0;width:38px;height:38px;border-radius:999px;background:linear-gradient(140deg,#d3bdf0,#9a76d8);margin:6px 10px 0 0"></span><div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline"><span style="font-weight:bold;margin-right:.5em">くるみ</span><span style="opacity:.7;font-size:.9em">@kurumi</span><span style="margin-left:auto;opacity:.7;font-size:.85em">30分</span></div><div style="margin-top:3px;line-height:1.7">デッキとサイドメニュー両方は欲張りすぎ？</div></div></div></div>
								</div>
								<div data-dpane="f1-1" style="position:absolute;inset:0;overflow-y:auto;padding:12px;display:none;flex-direction:column;gap:10px">
									<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:var(--accentedBg);font-size:13px"><i class="ti ti-star" style="color:var(--accent)"></i>あとで読みたいノート 42件</div>
									<div style="font-size:12.5px;color:var(--fgMuted);line-height:1.8" data-en="Revisit favorited notes and notes grouped by topic, all from here.">お気に入りに入れたノートも、テーマごとにまとめたノートも、ここからすぐ見返せます。</div>
								</div>
							</div>
						</div>

						<div data-deckframe="" style="display:flex;flex-direction:column;height:440px;background:var(--bg);border:1px solid var(--divider);border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.06);overflow:hidden;animation:hWelcome-fadeUp .9s cubic-bezier(.2,.8,.2,1) both;animation-timeline:view();animation-range:entry 2% cover 20%">
							<div style="flex-shrink:0;display:flex;align-items:center;gap:4px;padding:4px 8px;background:color-mix(in srgb,var(--accent) 8%,var(--bg));border-bottom:1px solid var(--divider)">
								<span style="width:16px;text-align:center;opacity:.5;font-size:13px;cursor:grab"><i class="ti ti-grip-vertical"></i></span>
								<button data-dtab="f2-0" style="display:flex;align-items:center;gap:6px;min-height:32px;padding:7px 12px;border:1px solid var(--divider);border-bottom:none;border-radius:10px 10px 0 0;background:var(--bg);color:var(--fg);font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s" @click="controller.onDeckTab"><i class="ti ti-bell" style="color:var(--accent);font-size:14px"></i><span data-en="Notifications">通知</span></button>
								<button data-dtab="f2-1" style="display:flex;align-items:center;gap:6px;min-height:32px;padding:7px 12px;border:1px solid transparent;border-bottom:none;border-radius:10px 10px 0 0;background:transparent;color:var(--fg);opacity:.6;font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s" class="hWelcome-state-57" @click="controller.onDeckTab"><i class="ti ti-antenna" style="color:var(--accent);font-size:14px"></i><span data-en="Antenna">アンテナ</span></button>
							</div>
							<div style="flex:1;min-height:0;position:relative">
								<div data-dpane="f2-0" style="position:absolute;inset:0;overflow-y:auto;animation:hWelcome-deckPaneIn .3s cubic-bezier(.2,.8,.2,1) both">
									<div style="position:relative;box-sizing:border-box;padding:16px 18px;font-size:14.4px;display:flex;border-bottom:1px solid var(--divider)"><div style="position:relative;flex-shrink:0;width:42px;height:42px;margin-right:8px"><span style="display:block;width:100%;height:100%;border-radius:999px;background:linear-gradient(140deg,#f0c98f,#e0a44f)"></span><span style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;line-height:20px;border-radius:100%;background:#e99a0b;box-shadow:0 0 0 3px var(--bg);font-size:11px;text-align:center;color:#fff">🎉</span></div><div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline;white-space:nowrap"><span style="overflow:hidden;text-overflow:ellipsis;font-weight:700">こまち</span><span style="margin-left:auto;opacity:.7;font-size:.9em">2分前</span></div><div style="opacity:.7;font-size:.95em;margin-top:2px">🎉 がつきました</div><div style="margin-top:4px;opacity:.6;font-size:.9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">設定画面、左に大分類・右にタブの2枚組みに…</div></div></div>
									<div style="position:relative;box-sizing:border-box;padding:16px 18px;font-size:14.4px;display:flex;border-bottom:1px solid var(--divider)"><div style="position:relative;flex-shrink:0;width:42px;height:42px;margin-right:8px"><span style="display:block;width:100%;height:100%;border-radius:999px;background:linear-gradient(140deg,#a5d8b5,#57a97a)"></span><span style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;line-height:20px;border-radius:100%;background:#36d298;box-shadow:0 0 0 3px var(--bg);font-size:11px;text-align:center;color:#fff"><i class="ti ti-repeat"></i></span></div><div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline;white-space:nowrap"><span style="font-weight:700">みなも</span><span style="margin-left:auto;opacity:.7;font-size:.9em">14分前</span></div><div style="opacity:.7;font-size:.95em;margin-top:2px">リノートしました</div></div></div>
									<div style="position:relative;box-sizing:border-box;padding:16px 18px;font-size:14.4px;display:flex;border-bottom:1px solid var(--divider)"><div style="position:relative;flex-shrink:0;width:42px;height:42px;margin-right:8px"><span style="display:block;width:100%;height:100%;border-radius:999px;background:linear-gradient(140deg,#d3bdf0,#9a76d8)"></span><span style="position:absolute;bottom:-2px;right:-2px;width:20px;height:20px;line-height:20px;border-radius:100%;background:#36aed2;box-shadow:0 0 0 3px var(--bg);font-size:11px;text-align:center;color:#fff"><i class="ti ti-plus"></i></span></div><div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline;white-space:nowrap"><span style="font-weight:700">くるみ</span><span style="margin-left:auto;opacity:.7;font-size:.9em">1時間前</span></div><div style="opacity:.7;font-size:.95em;margin-top:2px">フォローされました</div></div></div>
									<div style="position:relative;box-sizing:border-box;padding:16px 18px;font-size:14.4px;display:flex"><div style="position:relative;flex-shrink:0;width:42px;height:42px;margin-right:8px;display:grid;place-items:center"><span style="display:grid;place-items:center;width:80%;height:80%;font-size:15px;border-radius:100%;color:#fff;background:#34d399"><i class="ti ti-message-report"></i></span></div><div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline;white-space:nowrap"><span style="font-weight:700">HataFeed</span><span style="margin-left:auto;opacity:.7;font-size:.9em">3時間前</span></div><div style="opacity:.7;font-size:.95em;margin-top:2px">#128 が「解決済み」になりました</div></div></div>
								</div>
								<div data-dpane="f2-1" style="position:absolute;inset:0;overflow-y:auto;padding:12px;display:none;flex-direction:column;gap:8px">
									<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--fgMuted)"><i class="ti ti-antenna"></i>キーワード: お花 / 育成</div>
									<div style="font-size:14px;background:var(--panel);border:1px solid var(--divider);border-radius:12px;padding:8px"><div style="display:flex"><span style="flex-shrink:0;width:38px;height:38px;border-radius:999px;background:linear-gradient(140deg,#d3bdf0,#9a76d8);margin:6px 10px 0 0"></span><div style="flex:1"><div style="display:flex;align-items:baseline"><span style="font-weight:bold;margin-right:.5em">くるみ</span><span style="margin-left:auto;opacity:.7;font-size:.85em">41分</span></div><div style="margin-top:3px;line-height:1.7">Hataskのお花、帰ってきたら咲いてた 🌼</div></div></div></div>
								</div>
							</div>
						</div>

						<div data-deckframe="" style="display:flex;flex-direction:column;height:440px;background:var(--bg);border:1px solid var(--divider);border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,.06);overflow:hidden;position:relative;animation:hWelcome-fromRight .9s cubic-bezier(.2,.8,.2,1) both;animation-timeline:view();animation-range:entry 2% cover 20%">
							<div style="flex-shrink:0;display:flex;align-items:center;gap:4px;padding:4px 8px;background:color-mix(in srgb,var(--accent) 8%,var(--bg));border-bottom:1px solid var(--divider)">
								<span style="width:16px;text-align:center;opacity:.5;font-size:13px;cursor:grab"><i class="ti ti-grip-vertical"></i></span>
								<button data-dtab="f3-0" style="display:flex;align-items:center;gap:6px;min-height:32px;padding:7px 12px;border:1px solid var(--divider);border-bottom:none;border-radius:10px 10px 0 0;background:var(--bg);color:var(--fg);font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s" @click="controller.onDeckTab"><i class="ti ti-device-tv" style="color:var(--accent);font-size:14px"></i><span data-en="Channel">チャンネル</span></button>
								<button data-dtab="f3-1" style="display:flex;align-items:center;gap:6px;min-height:32px;padding:7px 12px;border:1px solid transparent;border-bottom:none;border-radius:10px 10px 0 0;background:transparent;color:var(--fg);opacity:.6;font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s" class="hWelcome-state-58" @click="controller.onDeckTab"><i class="ti ti-flower" style="color:var(--accent);font-size:14px"></i><span data-en="Flowers">お花</span></button>
							</div>
							<div style="flex:1;min-height:0;position:relative">
								<div data-dpane="f3-0" style="position:absolute;inset:0;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;animation:hWelcome-deckPaneIn .3s cubic-bezier(.2,.8,.2,1) both">
									<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;background:color-mix(in srgb,#e8a87c 14%,transparent);font-size:12.5px;font-weight:700"><span style="width:5px;height:18px;border-radius:999px;background:#e8a87c"></span>つくったもの置き場</div>
									<div style="font-size:14px;background:var(--panel);border:1px solid var(--divider);border-radius:12px;padding:8px;position:relative"><span style="position:absolute;top:0;left:0;width:100%;height:100%;border-left:5px solid #e8a87c;border-radius:12px;pointer-events:none;box-sizing:border-box"></span><div style="display:flex;padding-left:7px"><span style="flex-shrink:0;width:38px;height:38px;border-radius:999px;background:linear-gradient(140deg,#f4d7bb,#d99a63);margin:6px 10px 0 0"></span><div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline"><span style="font-weight:bold;margin-right:.5em">ゆの</span><span style="margin-left:auto;opacity:.7;font-size:.85em">34分</span></div><div style="margin-top:3px;line-height:1.7">サイドメニューを組み直した。丸ボタン3列＋お花</div><div style="display:flex;gap:6px;margin-top:6px"><button data-rx="" style="display:inline-flex;height:30px;padding:0 12px;border-radius:999px;align-items:center;border:0;cursor:pointer;background:var(--btnBg);color:inherit;font-size:14px" @click="controller.onReact">💪<span style="font-size:.9em;margin-left:5px" data-c="">6</span></button></div></div></div></div>
									<div style="font-size:14px;background:var(--panel);border:1px solid var(--divider);border-radius:12px;padding:8px;position:relative"><span style="position:absolute;top:0;left:0;width:100%;height:100%;border-left:5px solid #e8a87c;border-radius:12px;pointer-events:none;box-sizing:border-box"></span><div style="display:flex;padding-left:7px"><span style="flex-shrink:0;width:38px;height:38px;border-radius:999px;background:linear-gradient(140deg,#cfe6ef,#7fbcd6);margin:6px 10px 0 0"></span><div style="flex:1;min-width:0"><div style="display:flex;align-items:baseline"><span style="font-weight:bold;margin-right:.5em">そら</span><span style="margin-left:auto;opacity:.7;font-size:.85em">1時間</span></div><div style="margin-top:3px;line-height:1.7">カードメーカーでゴールド作った。傾けると光る</div></div></div></div>
								</div>
								<div data-dpane="f3-1" style="position:absolute;inset:0;overflow-y:auto;padding:16px;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px">
									<span style="position:relative;width:120px;height:120px;border-radius:50%;background:conic-gradient(var(--accent) 0 .68turn,rgba(64,89,91,.09) .68turn 1turn);display:flex;align-items:center;justify-content:center"><span style="width:92px;height:92px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:34px">🌼</span></span>
									<div style="text-align:center"><div style="font-size:13px;font-weight:700">育成中：ヒナギク</div><div style="font-size:11.5px;color:var(--fgMuted);margin-top:3px" data-en="24 bloomed so far">これまでに咲いた花 24</div></div>
								</div>
							</div>
							<button style="position:absolute;right:14px;bottom:14px;width:46px;height:46px;border-radius:999px;border:0;background:var(--accent);color:#fff;font-size:18px;cursor:pointer;box-shadow:0 8px 20px rgba(52,161,201,.4);transition:transform .2s" class="hWelcome-state-59 hWelcome-state-60"><i class="ti ti-pencil-plus"></i></button>
						</div>
					</div>
					<div class="deck-desktop-controls" role="group" aria-label="デッキを切り替える" data-aria-en="Switch deck preview">
						<button class="deck-desktop-control" type="button" aria-label="前のデッキ" data-aria-en="Previous deck" @click="controller.onDeckPrev"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
						<div class="deck-desktop-dots" aria-hidden="true">
							<button class="deck-desktop-dot" type="button" data-deck-go="0" aria-current="true" tabindex="-1" @click="controller.onDeckGo"></button>
							<button class="deck-desktop-dot" type="button" data-deck-go="1" aria-current="false" tabindex="-1" @click="controller.onDeckGo"></button>
							<button class="deck-desktop-dot" type="button" data-deck-go="2" aria-current="false" tabindex="-1" @click="controller.onDeckGo"></button>
						</div>
						<button class="deck-desktop-control" type="button" aria-label="次のデッキ" data-aria-en="Next deck" @click="controller.onDeckNext"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ══ 03 HATASK ══ -->
	<section id="hatask" style="padding:96px 24px">
		<div style="max-width:1240px;margin:0 auto">
			<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:24px;animation:hWelcome-fadeUp linear both;animation-timeline:view();animation-range:entry 3% cover 22%">
				<div style="flex:1 1 440px">
					<div style="display:flex;align-items:center;gap:10px;font-size:11.5px;font-weight:700;letter-spacing:.14em;color:var(--accentText)"><span style="width:26px;height:2px;background:var(--accent)"></span>03&nbsp;&nbsp;<span style="font-family:Righteous,cursive;font-size:13px;letter-spacing:.04em">Hatask</span><span class="welcome-version">v3.1</span></div>
					<WelcomeHataskHeading/>
				</div>
				<p class="welcome-section-copy" data-en="Plans, to-dos, moods, meals and flowers. Shape your day with a familiar layout and your favorite theme.">予定・ToDo・きもち・ごはん・おはな。いつもの配置のまま、好きなテーマで一日を整えます。</p>
			</div>

			<WelcomeHataskPreview :mode="colorMode" :language="language" :now="serverNow" @signin="signin"/>
		</div>
	</section>

	<!-- ══ 04 HATADY ══ -->
	<section id="hatady" class="hatady-section" style="padding:96px 24px">
		<div style="max-width:1240px;margin:0 auto">
			<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:24px;animation:hWelcome-fadeUp linear both;animation-timeline:view();animation-range:entry 3% cover 22%">
				<div style="flex:1 1 440px">
					<div style="display:flex;align-items:center;gap:10px;font-size:11.5px;font-weight:700;letter-spacing:.14em;color:var(--hyAccent)"><span style="width:26px;height:2px;background:var(--hyAccent)"></span>04&nbsp;&nbsp;<span style="font-family:Righteous,cursive;font-size:13px;letter-spacing:.04em">Hatady</span><span class="welcome-version">v2</span></div>
					<WelcomeHatadyHeading/>
				</div>
				<p class="welcome-section-copy" data-en="Study, reading, films, games, exercise and work. Revisit your records and collections from the new home.">勉強・読書、映画、ゲーム、運動、作業。新しいホームから、記録やコレクションを振り返れます。</p>
			</div>

			<WelcomeHatadyPreview :mode="colorMode" :language="language" @signin="signin" @resize="controller.requestMeasure()"/>
		</div>
	</section>

	<!-- ══ 05 HATAFEED ══ -->
	<section id="hatafeed" style="padding:96px 24px">
		<div style="max-width:1240px;margin:0 auto">
			<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:24px;animation:hWelcome-fadeUp linear both;animation-timeline:view();animation-range:entry 3% cover 22%">
				<div style="flex:1 1 440px">
					<div style="display:flex;align-items:center;gap:10px;font-size:11.5px;font-weight:700;letter-spacing:.14em;color:var(--accentText)"><span style="width:26px;height:2px;background:var(--accent)"></span>05&nbsp;&nbsp;<span style="font-family:Righteous,cursive;font-size:13px;letter-spacing:.04em">HataFeed</span><span class="welcome-version">v3</span></div>
					<h2 data-no-split="" data-symbol-heading="" aria-label="言ったことが、直っていくのが見える。" data-aria-en="Say it here, and watch it get fixed." style="font-size:clamp(28px,4.2vw,50px);line-height:1.18;margin:14px 0 0"><span class="symbol-copy" data-symbol-lang="ja" aria-hidden="true">言ったことが、<br><span class="symbol-effect symbol-repair"><span class="symbol-effect-char" style="--fly-x:-0.24em;--fly-y:-0.38em;--fly-r:-15deg;--symbol-delay:0.260s">直</span><span class="symbol-effect-char" style="--fly-x:0.18em;--fly-y:0.3em;--fly-r:13deg;--symbol-delay:0.365s">っ</span><span class="symbol-effect-char" style="--fly-x:-0.2em;--fly-y:-0.26em;--fly-r:-11deg;--symbol-delay:0.470s">て</span><span class="symbol-effect-char" style="--fly-x:0.26em;--fly-y:0.34em;--fly-r:16deg;--symbol-delay:0.575s">い</span><span class="symbol-effect-char" style="--fly-x:-0.14em;--fly-y:-0.32em;--fly-r:-13deg;--symbol-delay:0.680s">く</span><i class="ti ti-scissors repair-pliers" data-symbol-last="" aria-hidden="true"></i></span>のが見える。</span><span class="symbol-copy" data-symbol-lang="en" aria-hidden="true">Say it here,<br>and watch it get <span class="symbol-effect symbol-repair"><span class="symbol-effect-char" style="--fly-x:-0.24em;--fly-y:-0.38em;--fly-r:-15deg;--symbol-delay:0.260s">f</span><span class="symbol-effect-char" style="--fly-x:0.18em;--fly-y:0.3em;--fly-r:13deg;--symbol-delay:0.365s">i</span><span class="symbol-effect-char" style="--fly-x:-0.2em;--fly-y:-0.26em;--fly-r:-11deg;--symbol-delay:0.470s">x</span><span class="symbol-effect-char" style="--fly-x:0.26em;--fly-y:0.34em;--fly-r:16deg;--symbol-delay:0.575s">e</span><span class="symbol-effect-char" style="--fly-x:-0.14em;--fly-y:-0.32em;--fly-r:-13deg;--symbol-delay:0.680s">d</span><i class="ti ti-scissors repair-pliers" data-symbol-last="" aria-hidden="true"></i></span>.</span></h2>
				</div>
				<p class="welcome-section-copy" data-en="Bugs, requests and emoji submissions. Find upcoming improvements, submission results and issue conversations in the new home.">不具合も要望も絵文字申請も。改善予定、申請の結果、イシューの会話を、新しいホームで確認できます。</p>
			</div>
			<WelcomeHataFeedPreview :mode="colorMode" :language="language" @signin="signin"/>
		</div>
	</section>

	<!-- ══ 06 HATASIDESTUDIO ══ -->
	<section id="studio" style="padding:96px 24px">
		<div style="max-width:1240px;margin:0 auto">
			<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:24px;animation:hWelcome-fadeUp linear both;animation-timeline:view();animation-range:entry 3% cover 22%">
				<div class="studio-heading-block">
					<div style="display:flex;align-items:center;gap:10px;font-size:11.5px;font-weight:700;letter-spacing:.14em;color:var(--accentText)"><span style="width:26px;height:2px;background:var(--accent)"></span>06&nbsp;&nbsp;<span style="font-family:Righteous,cursive;font-size:13px;letter-spacing:.04em">HataSideStudio</span></div>
					<h2 class="studio-symbol-heading" data-no-split="" data-symbol-heading="" aria-label="本物を見ながら、サイドメニューを組みなおす。" data-aria-en="Rebuild the side menu while looking at the real one." style="font-size:clamp(14px,3.7vw,46px);line-height:1.18;margin:14px 0 0"><span class="symbol-copy" data-symbol-lang="ja" aria-hidden="true">本物を見ながら、<br class="mobile-copy-break"><span class="symbol-effect symbol-assemble"><span class="symbol-effect-char" style="--fly-x:-1.68em;--fly-y:-1.18em;--fly-r:-22deg;--symbol-delay:0.160s">サ</span><span class="symbol-effect-char" style="--fly-x:1.34em;--fly-y:-1.46em;--fly-r:17deg;--symbol-delay:0.245s">イ</span><span class="symbol-effect-char" style="--fly-x:-1.52em;--fly-y:1.08em;--fly-r:-15deg;--symbol-delay:0.330s">ド</span><span class="symbol-effect-char" style="--fly-x:1.72em;--fly-y:0.94em;--fly-r:21deg;--symbol-delay:0.415s">メ</span><span class="symbol-effect-char" style="--fly-x:-0.88em;--fly-y:-1.62em;--fly-r:13deg;--symbol-delay:0.500s">ニ</span><span class="symbol-effect-char" style="--fly-x:0.96em;--fly-y:1.58em;--fly-r:-19deg;--symbol-delay:0.585s">ュ</span><span class="symbol-effect-char" style="--fly-x:-1.76em;--fly-y:0.28em;--fly-r:16deg;--symbol-delay:0.670s">ー</span><span class="symbol-effect-char" style="--fly-x:1.74em;--fly-y:-0.34em;--fly-r:-13deg;--symbol-delay:0.755s">を</span><span class="symbol-effect-char" style="--fly-x:-1.68em;--fly-y:-1.18em;--fly-r:-22deg;--symbol-delay:0.840s">組</span><span class="symbol-effect-char" style="--fly-x:1.34em;--fly-y:-1.46em;--fly-r:17deg;--symbol-delay:0.925s">み</span><span class="symbol-effect-char" style="--fly-x:-1.52em;--fly-y:1.08em;--fly-r:-15deg;--symbol-delay:1.010s">な</span><span class="symbol-effect-char" style="--fly-x:1.72em;--fly-y:0.94em;--fly-r:21deg;--symbol-delay:1.095s">お</span><span class="symbol-effect-char" style="--fly-x:-0.88em;--fly-y:-1.62em;--fly-r:13deg;--symbol-delay:1.180s" data-symbol-last="">す</span></span>。</span><span class="symbol-copy" data-symbol-lang="en" aria-hidden="true"><span class="symbol-effect symbol-assemble"><span class="symbol-effect-word"><span class="symbol-effect-char" style="--fly-x:-1.68em;--fly-y:-1.18em;--fly-r:-22deg;--symbol-delay:0.160s">R</span><span class="symbol-effect-char" style="--fly-x:1.34em;--fly-y:-1.46em;--fly-r:17deg;--symbol-delay:0.245s">e</span><span class="symbol-effect-char" style="--fly-x:-1.52em;--fly-y:1.08em;--fly-r:-15deg;--symbol-delay:0.330s">b</span><span class="symbol-effect-char" style="--fly-x:1.72em;--fly-y:0.94em;--fly-r:21deg;--symbol-delay:0.415s">u</span><span class="symbol-effect-char" style="--fly-x:-0.88em;--fly-y:-1.62em;--fly-r:13deg;--symbol-delay:0.500s">i</span><span class="symbol-effect-char" style="--fly-x:0.96em;--fly-y:1.58em;--fly-r:-19deg;--symbol-delay:0.585s">l</span><span class="symbol-effect-char" style="--fly-x:-1.76em;--fly-y:0.28em;--fly-r:16deg;--symbol-delay:0.670s">d</span></span> <span class="symbol-effect-word"><span class="symbol-effect-char" style="--fly-x:1.74em;--fly-y:-0.34em;--fly-r:-13deg;--symbol-delay:0.755s">t</span><span class="symbol-effect-char" style="--fly-x:-1.68em;--fly-y:-1.18em;--fly-r:-22deg;--symbol-delay:0.840s">h</span><span class="symbol-effect-char" style="--fly-x:1.34em;--fly-y:-1.46em;--fly-r:17deg;--symbol-delay:0.925s">e</span></span> <span class="symbol-effect-word"><span class="symbol-effect-char" style="--fly-x:-1.52em;--fly-y:1.08em;--fly-r:-15deg;--symbol-delay:1.010s">s</span><span class="symbol-effect-char" style="--fly-x:1.72em;--fly-y:0.94em;--fly-r:21deg;--symbol-delay:1.095s">i</span><span class="symbol-effect-char" style="--fly-x:-0.88em;--fly-y:-1.62em;--fly-r:13deg;--symbol-delay:1.180s">d</span><span class="symbol-effect-char" style="--fly-x:0.96em;--fly-y:1.58em;--fly-r:-19deg;--symbol-delay:1.265s">e</span></span> <span class="symbol-effect-word"><span class="symbol-effect-char" style="--fly-x:-1.76em;--fly-y:0.28em;--fly-r:16deg;--symbol-delay:1.350s">m</span><span class="symbol-effect-char" style="--fly-x:1.74em;--fly-y:-0.34em;--fly-r:-13deg;--symbol-delay:1.435s">e</span><span class="symbol-effect-char" style="--fly-x:-1.68em;--fly-y:-1.18em;--fly-r:-22deg;--symbol-delay:1.520s">n</span><span class="symbol-effect-char" style="--fly-x:1.34em;--fly-y:-1.46em;--fly-r:17deg;--symbol-delay:1.605s" data-symbol-last="">u</span></span></span><br>while looking at the real one.</span></h2>
				</div>
				<p style="flex:1 1 540px;max-width:700px;margin:0;font-size:14.5px;line-height:1.9;color:var(--fgSoft)"><span class="copy-line" data-en="Set the shape, colour, size and column count of buttons, groups and widgets per device.">ボタンもグループもウィジェットも、形・配色・大きさ・列数を端末ごとに。</span><br><span data-en="Try the shape switch below.">下の形スイッチを押してみてください。</span></p>
			</div>
			<div style="margin-top:30px;display:grid;grid-template-columns:minmax(0,240px) minmax(0,1fr);gap:16px;align-items:start;animation:hWelcome-fromBelow .95s cubic-bezier(.2,.8,.2,1) both;animation-timeline:view();animation-range:entry 0% cover 20%">
				<div :ref="controller.studioPreviewRef" style="background:var(--bg);border:1px solid var(--dividerStrong);border-radius:16px;padding:14px 12px;min-height:420px;display:flex;flex-direction:column;gap:10px;box-shadow:0 16px 36px rgba(34,66,69,.1)">
					<div style="display:flex;align-items:center;gap:9px;padding:6px 8px"><span style="width:26px;height:26px;border-radius:8px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px"><i class="ti ti-icons"></i></span><span style="font-size:13px;font-weight:700">Hataskey Demo</span></div>
					<div style="padding:1px 5px 7px;font-size:10.5px;font-weight:700;letter-spacing:.06em;opacity:.6" data-en="BASIC">きほん</div>
					<div :ref="controller.studioGridRef" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 4px;padding:8px;border-radius:12px;background:var(--accentedBg)"></div>
					<div style="padding:1px 5px 7px;font-size:10.5px;font-weight:700;letter-spacing:.06em;opacity:.6" data-en="WIDGET">ウィジェット</div>
					<div style="padding:12px;border-radius:12px;background:var(--panel);border:1px solid var(--divider);display:flex;align-items:center;gap:12px"><span style="width:52px;height:52px;border-radius:50%;background:conic-gradient(var(--accent) 0 .68turn,rgba(64,89,91,.1) .68turn 1turn);display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="width:38px;height:38px;border-radius:50%;background:var(--panel);display:flex;align-items:center;justify-content:center;font-size:17px">🌼</span></span><span style="font-size:11.5px;line-height:1.6"><b style="display:block;font-size:12.5px">ヒナギク</b>あと 8時間で咲きます</span></div>
					<button style="margin-top:auto;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 0;border:none;border-radius:999px;background:linear-gradient(135deg,var(--accent),#5bb9d8);color:#fff;font-size:14px;font-weight:700;cursor:pointer"><i class="ti ti-paw" data-studiopaw=""></i><span data-en="Note">ノート</span></button>
				</div>
				<div style="display:flex;flex-direction:column;gap:14px">
					<div style="background:var(--bg);border:1px solid var(--divider);border-radius:14px;padding:16px">
						<div style="font-size:12.5px;font-weight:700;margin-bottom:12px" data-en="Button shape">ボタンの形</div>
						<div style="display:flex;gap:8px;flex-wrap:wrap">
							<button data-shape="rounded" style="display:flex;align-items:center;gap:7px;height:36px;padding:0 16px;border:1px solid var(--accent);border-radius:10px;background:var(--accentedBg);color:var(--accent);font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s" data-en="Rounded" @click="controller.onShape">角丸</button>
							<button data-shape="pill" style="display:flex;align-items:center;gap:7px;height:36px;padding:0 16px;border:1px solid var(--divider);border-radius:999px;background:var(--panel);color:var(--fgSoft);font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s" data-en="Pill" @click="controller.onShape">カプセル</button>
							<button data-shape="circle" style="display:flex;align-items:center;gap:7px;height:36px;padding:0 16px;border:1px solid var(--divider);border-radius:999px;background:var(--panel);color:var(--fgSoft);font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s" data-en="Circle" @click="controller.onShape">丸</button>
						</div>
						<div style="font-size:12.5px;font-weight:700;margin:18px 0 12px" data-en="Columns">列数</div>
						<div style="display:flex;gap:8px">
							<button data-col="1" style="width:44px;height:36px;border:1px solid var(--divider);border-radius:8px;background:var(--panel);color:var(--fgSoft);font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s" @click="controller.onCols">1</button>
							<button data-col="2" style="width:44px;height:36px;border:1px solid var(--divider);border-radius:8px;background:var(--panel);color:var(--fgSoft);font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s" @click="controller.onCols">2</button>
							<button data-col="3" style="width:44px;height:36px;border:1px solid var(--accent);border-radius:8px;background:var(--accentedBg);color:var(--accent);font-size:12.5px;font-weight:700;cursor:pointer;transition:all .2s" @click="controller.onCols">3</button>
						</div>
						<div style="font-size:12.5px;font-weight:700;margin:18px 0 12px" data-en="Note button icon">ノートボタンのアイコン</div>
						<div style="display:flex;gap:8px">
							<button data-paw="pencil" style="width:44px;height:36px;border:1px solid var(--divider);border-radius:8px;background:var(--panel);color:var(--fgSoft);font-size:15px;cursor:pointer;transition:all .2s" @click="controller.onPaw"><i class="ti ti-pencil"></i></button>
							<button data-paw="paw" style="width:44px;height:36px;border:1px solid var(--accent);border-radius:8px;background:var(--accentedBg);color:var(--accent);font-size:15px;cursor:pointer;transition:all .2s" @click="controller.onPaw"><i class="ti ti-paw"></i></button>
						</div>
					</div>
					<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px">
						<div style="padding:14px 16px;border:1px solid var(--divider);border-radius:12px;background:var(--bg)"><div style="font-size:12.5px;font-weight:700;margin-bottom:5px" data-en="Per-device">端末ごとに保存</div><p style="margin:0;font-size:11.5px;line-height:1.75;color:var(--fgSoft)" data-en="Expanded and collapsed layouts are kept separately, and never synced across devices.">拡大時と縮小時で別構成。ほかの端末へは同期しません。</p></div>
						<div style="padding:14px 16px;border:1px solid var(--divider);border-radius:12px;background:var(--bg)"><div style="font-size:12.5px;font-weight:700;margin-bottom:5px" data-en="Undo / redo">元に戻す・やり直し</div><p style="margin:0;font-size:11.5px;line-height:1.75;color:var(--fgSoft)" data-en="Drag freely — every step is reversible, and profiles can be exported.">思いきり動かして大丈夫。書き出し・読み込みもできます。</p></div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- ══ MORE HATASKEY ══ -->
	<section id="more" class="more-features" aria-labelledby="more-features-title" data-feature-phase="waiting" data-feature-visible="false">
		<div class="more-features-head">
			<div class="more-features-kicker">MORE HATASKEY</div>
			<h2 id="more-features-title" data-en="And there is plenty more.">このほかにも、<br class="mobile-copy-break">機能はたくさん…</h2>
		</div>
		<div class="feature-window" tabindex="0" aria-label="Hataskeyのその他の機能。フォーカス中は流れを停止します" data-aria-en="More Hataskey features. The moving rows pause while focused.">
			<div class="feature-track"><div class="feature-group"><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-brush" aria-hidden="true"></i></span><span><strong class="feature-wordmark" data-en="Hatadint">Hatadint</strong><span data-en="Draw, then attach it straight to a note">描いた絵を、そのまま投稿へ添付</span></span></article><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-cards" aria-hidden="true"></i></span><span><strong class="feature-wordmark" data-en="HataCardMaker">HataCardMaker</strong><span data-en="Turn your profile into a card of your own">プロフィールから自分だけのカードを作成</span></span></article><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-mood-search" aria-hidden="true"></i></span><span><strong class="feature-wordmark" data-en="HATAlyze">HATAlyze</strong><span data-en="Look back at patterns in your own notes">自分の投稿から、言葉や利用傾向を振り返る</span></span></article><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-layout-sidebar-right" aria-hidden="true"></i></span><span><strong class="feature-wordmark" data-en="Hataskey UI S">Hataskey UI S</strong><span data-en="Beauty and ease of use, for an S (Special) experience">美しさと利便性を追求、S(Special)な体験を</span></span></article></div><div class="feature-group" aria-hidden="true"><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-brush" aria-hidden="true"></i></span><span><strong class="feature-wordmark" data-en="Hatadint">Hatadint</strong><span data-en="Draw, then attach it straight to a note">描いた絵を、そのまま投稿へ添付</span></span></article><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-cards" aria-hidden="true"></i></span><span><strong class="feature-wordmark" data-en="HataCardMaker">HataCardMaker</strong><span data-en="Turn your profile into a card of your own">プロフィールから自分だけのカードを作成</span></span></article><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-mood-search" aria-hidden="true"></i></span><span><strong class="feature-wordmark" data-en="HATAlyze">HATAlyze</strong><span data-en="Look back at patterns in your own notes">自分の投稿から、言葉や利用傾向を振り返る</span></span></article><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-layout-sidebar-right" aria-hidden="true"></i></span><span><strong class="feature-wordmark" data-en="Hataskey UI S">Hataskey UI S</strong><span data-en="Beauty and ease of use, for an S (Special) experience">美しさと利便性を追求、S(Special)な体験を</span></span></article></div></div>
			<div class="feature-track is-reverse"><div class="feature-group" aria-hidden="true"><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-cloud-rain" aria-hidden="true"></i></span><span><strong data-en="Weather backgrounds">天気の背景演出</strong><span data-en="Subtle backgrounds follow the weather in notes">投稿の言葉に合わせて背景がそっと変化</span></span></article><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-eye-off" aria-hidden="true"></i></span><span><strong data-en="Hide reaction emoji">リアクション絵文字の非表示</strong><span data-en="Hide emoji you would rather not see">見たくない絵文字を自分の画面から隠す</span></span></article><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-robot" aria-hidden="true"></i></span><span><strong data-en="Hide bot notes">Bot投稿の非表示</strong><span data-en="Keep bot notes and renotes out of the way">Botの投稿やリノートをタイムラインから整理</span></span></article><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-arrows-exchange" aria-hidden="true"></i></span><span><strong data-en="Import and export Hataskey settings">Hataskey独自設定の入出力</strong><span data-en="Save and restore selected Hataskey settings">独自設定を選んで保存・復元</span></span></article></div><div class="feature-group"><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-cloud-rain" aria-hidden="true"></i></span><span><strong data-en="Weather backgrounds">天気の背景演出</strong><span data-en="Subtle backgrounds follow the weather in notes">投稿の言葉に合わせて背景がそっと変化</span></span></article><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-eye-off" aria-hidden="true"></i></span><span><strong data-en="Hide reaction emoji">リアクション絵文字の非表示</strong><span data-en="Hide emoji you would rather not see">見たくない絵文字を自分の画面から隠す</span></span></article><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-robot" aria-hidden="true"></i></span><span><strong data-en="Hide bot notes">Bot投稿の非表示</strong><span data-en="Keep bot notes and renotes out of the way">Botの投稿やリノートをタイムラインから整理</span></span></article><article class="feature-item"><span class="feature-item-icon"><i class="ti ti-arrows-exchange" aria-hidden="true"></i></span><span><strong data-en="Import and export Hataskey settings">Hataskey独自設定の入出力</strong><span data-en="Save and restore selected Hataskey settings">独自設定を選んで保存・復元</span></span></article></div></div>
		</div>
	</section>

	<!-- ══ 07 HATAKYU ══ -->
	<section id="hatakyu" style="padding:96px 24px;overflow:clip">
		<div style="max-width:1240px;margin:0 auto">
			<div class="hatakyu-intro" style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:24px;animation:hWelcome-fadeUp linear both;animation-timeline:view();animation-range:entry 3% cover 22%">
				<div style="flex:1 1 440px">
					<div class="hatakyu-intro-label" style="display:flex;align-items:center;gap:10px;font-size:11.5px;font-weight:700;letter-spacing:.14em"><span style="width:26px;height:2px;background:var(--accent)"></span>07&nbsp;&nbsp;HATAKYU</div>
					<h2 data-no-split="" data-symbol-heading="" aria-label="なにもない画面にも、誰かが立っている。" data-aria-en="Every empty state has someone standing in it." style="font-size:clamp(28px,4.2vw,50px);line-height:1.18;margin:14px 0 0"><span class="symbol-copy" data-symbol-lang="ja" aria-hidden="true">なにもない画面にも、<br><span class="symbol-swap symbol-hatakyu" style="--symbol-delay:.14s"><span class="symbol-icon" aria-hidden="true"><img class="symbol-hatakyu-image" src="/client-assets/hatakyu/waving.png" alt="" width="500" height="500"></span><span class="symbol-text" data-symbol-last="">誰か</span></span>が立っている。</span><span class="symbol-copy" data-symbol-lang="en" aria-hidden="true">Every empty state has<br><span class="symbol-swap symbol-hatakyu" style="--symbol-delay:.14s"><span class="symbol-icon" aria-hidden="true"><img class="symbol-hatakyu-image" src="/client-assets/hatakyu/waving.png" alt="" width="500" height="500"></span><span class="symbol-text" data-symbol-last="">someone</span></span> standing in it.</span></h2>
				</div>
				<p class="hatakyu-intro-copy" style="flex:1 1 320px;max-width:460px;margin:0;font-size:14.5px;line-height:1.9" data-en="Settings banners, dialogs, error screens, the sign-up flow — 41 drawings, all switchable back to the originals whenever you like.">設定のバナー、ダイアログ、エラー画面、登録の流れ。全41点。いつでも従来のアイコンへ戻せます。</p>
			</div>
		</div>
		<div style="margin-top:34px;overflow:hidden;mask-image:linear-gradient(to right,transparent,#000 6%,#000 94%,transparent);-webkit-mask-image:linear-gradient(to right,transparent,#000 6%,#000 94%,transparent)">
			<div style="display:flex;gap:22px;width:max-content;animation:hWelcome-marquee 46s linear infinite;align-items:flex-end">
				<img src="/client-assets/hatakyu/waving.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/checking-time.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/reading-book.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/watering-flower.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/treasure-found.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/computer-chat.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/showing-key.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/reviewing-documents.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/searching.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/stargazing.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/heart-hands.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/wrench.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/showing-id.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/loading-wait.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/waving.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/checking-time.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/reading-book.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/watering-flower.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/treasure-found.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/computer-chat.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/showing-key.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/reviewing-documents.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/searching.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/stargazing.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/heart-hands.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/wrench.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/showing-id.png" alt="" style="width:132px">
				<img src="/client-assets/hatakyu/loading-wait.png" alt="" style="width:132px">
			</div>
		</div>
	</section>

	<!-- ══ 08 JOIN ══ -->
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
				<div class="join-ack-brand"><span style="font-family:Righteous,cursive;font-size:19px">Hataskey</span></div>
				<p class="join-ack-copy"><span data-en="Hataskey is a CherryPick fork, which is itself a Misskey fork.">HataskeyはCherryPickのフォークで、CherryPickはMisskeyのフォークです。</span><br class="mobile-copy-break"><span data-en=" Thank you to both projects.">両プロジェクトへ深く感謝します。</span><br><span data-en="This implementation stands on their work.">この実装はそのうえに立っています。</span></p>
				<div class="join-ack-version">Hataskey {{ version }} / based on Misskey {{ basedMisskeyVersion }}</div>
				<!-- FEDIVERSE RIGHTS START -->
				<details id="fediverse-rights" class="fediverse-rights">
					<summary><span data-en="※ About logos and names">※ ロゴ・名称について</span><i class="ti ti-chevron-down" aria-hidden="true"></i></summary>
					<div>
						<p><span data-en="Misskey logo: © syuilo and Misskey Project · ">Misskeyロゴ: © syuilo and Misskey Project · </span><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> · <a href="https://misskey-hub.net/ja/brand-assets/" target="_blank" rel="noopener noreferrer" data-en="Source">出典</a><br><span data-en="The original SVG is unchanged; its display color follows the theme.">SVG原本は変更せず、表示色だけテーマに合わせています。</span></p>
						<p data-en="Hataskey is not an official project of Misskey Project or CherryPick Project and is not affiliated with or endorsed by either project.">HataskeyはMisskey ProjectおよびCherryPick Projectの公式プロジェクトではなく、両プロジェクトとの提携・推薦を示すものではありません。</p>
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
import WelcomeHataskPreview from './welcome.entrance.hatask-preview.vue';
import WelcomeHatadyPreview from './welcome.entrance.hatady-preview.vue';
import WelcomeHataFeedPreview from './welcome.entrance.hatafeed-preview.vue';
import WelcomeHataskHeading from './welcome.entrance.hatask-heading.vue';
import WelcomeHatadyHeading from './welcome.entrance.hatady-heading.vue';
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
import { misskeyApi } from '@/utility/misskey-api.js';
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
const serverNow = ref(new Date());
let serverClockTimer: number | undefined;
let serverClockOffsetMs = 0;

function updateServerNow() { serverNow.value = new Date(Date.now() + serverClockOffsetMs); }

const serverClockAbortController = new AbortController();
const controller = markRaw(new HataskeyWelcomeController({
	colorMode: store.r.darkMode.value ? 'dark' : 'light',
	federationMode: instance.federation,
	now: () => new Date(Date.now() + serverClockOffsetMs),
}));
let dialogOpen = false;

async function syncServerClock() {
	const startedAt = Date.now();
	try {
		const response = await misskeyApi('ping', {}, null, serverClockAbortController.signal);
		const receivedAt = Date.now();
		if (!Number.isFinite(response.pong) || controller.destroyed) return;
		serverClockOffsetMs = response.pong - ((startedAt + receivedAt) / 2);
		updateServerNow();
		controller.updateHataskClock();
	} catch {
		// Keep the device clock as the offline/error fallback.
	}
}

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
onMounted(() => { serverClockTimer = window.setInterval(updateServerNow, 60_000); controller.mount(); controller.setLanguage(language.value); globalEvents.on('themeChanging', syncTheme); void syncServerClock(); });
onBeforeUnmount(() => { window.clearInterval(serverClockTimer); serverClockAbortController.abort(); globalEvents.off('themeChanging', syncTheme); controller.destroy(); });
</script>
