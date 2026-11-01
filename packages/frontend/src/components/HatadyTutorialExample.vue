<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<template>
<div class="example" :data-kind="kind" :data-page="page" aria-hidden="true">
	<template v-if="kind === 'initial'">
		<div v-if="page === 'about'" class="screen">
			<div class="screen-head">
				<strong>
					<span class="brand"><HataAppLogo app="hatady" :size="20" :monochrome="darkTheme"/><HataAppWordmark app="hatady" inheritColor/></span>
				</strong>
				<div class="screen-nav">
					<span class="active">
						<i class="ti ti-home"></i>
					</span>
					<span>
						<i class="ti ti-notebook"></i>
					</span>
					<span>
						<i class="ti ti-books"></i>
					</span>
					<span>
						<i class="ti ti-user"></i>
					</span>
				</div>
			</div>
			<div class="about-kinds">
				<span>
					<i class="ti ti-book"></i>
					{{ exampleCopy.study }}
				</span>
				<span>
					<i class="ti ti-movie"></i>
					{{ exampleCopy.movie }}
				</span>
				<span>
					<i class="ti ti-device-gamepad-2"></i>
					{{ exampleCopy.game }}
				</span>
				<span>
					<i class="ti ti-run"></i>
					{{ exampleCopy.exercise }}
				</span>
				<span>
					<i class="ti ti-briefcase"></i>
					{{ exampleCopy.work }}
				</span>
			</div>
			<div class="demo-card">
				<h4>{{ exampleCopy.dailyProgress }}</h4>
				<div class="week-top">
					<span>{{ exampleCopy.thisWeek }}</span>
					<strong>
						13
						<small>{{ exampleCopy.records }}</small>
					</strong>
				</div>
				<div class="week-strip">
					<span>
						{{ exampleCopy.friday }}
						<strong>4</strong>
						<small>{{ exampleCopy.oneItem }}</small>
					</span>
					<span>
						{{ exampleCopy.saturday }}
						<strong>5</strong>
						<small>{{ exampleCopy.zeroItems }}</small>
					</span>
					<span>
						{{ exampleCopy.sunday }}
						<strong>6</strong>
						<small>{{ exampleCopy.oneItem }}</small>
					</span>
					<span>
						{{ exampleCopy.monday }}
						<strong>7</strong>
						<small>{{ exampleCopy.threeItems }}</small>
					</span>
					<span>
						{{ exampleCopy.tuesday }}
						<strong>8</strong>
						<small>{{ exampleCopy.threeItems }}</small>
					</span>
					<span>
						{{ exampleCopy.wednesday }}
						<strong>9</strong>
						<small>{{ exampleCopy.threeItems }}</small>
					</span>
					<span>
						{{ exampleCopy.thursday }}
						<strong>10</strong>
						<small>{{ exampleCopy.twoItems }}</small>
					</span>
				</div>
			</div>
		</div>
		<div v-else-if="page === 'record'" class="screen">
			<div class="screen-head">
				<strong>
					<span class="brand"><HataAppLogo app="hatady" :size="20" :monochrome="darkTheme"/><HataAppWordmark app="hatady" inheritColor/></span>
				</strong>
				<div class="screen-nav">
					<span class="active">
						<i class="ti ti-home"></i>
					</span>
					<span>
						<i class="ti ti-notebook"></i>
					</span>
					<span>
						<i class="ti ti-books"></i>
					</span>
					<span>
						<i class="ti ti-user"></i>
					</span>
				</div>
			</div>
			<div class="demo-card">
				<div class="screen-head">
					<strong>{{ exampleCopy.whatToday }}</strong>
					<span class="callout">
						<i class="ti ti-plus"></i>
						{{ exampleCopy.recordAction }}
					</span>
				</div>
				<div class="kind-list">
					<div class="kind-choice">
						<span>
							<i class="ti ti-book"></i>
						</span>
						{{ exampleCopy.study }}
					</div>
					<div class="kind-choice">
						<span>
							<i class="ti ti-movie"></i>
						</span>
						{{ exampleCopy.movie }}
					</div>
					<div class="kind-choice">
						<span>
							<i class="ti ti-device-gamepad-2"></i>
						</span>
						{{ exampleCopy.game }}
					</div>
					<div class="kind-choice">
						<span>
							<i class="ti ti-run"></i>
						</span>
						{{ exampleCopy.exercise }}
					</div>
					<div class="kind-choice">
						<span>
							<i class="ti ti-briefcase"></i>
						</span>
						{{ exampleCopy.work }}
					</div>
				</div>
			</div>
		</div>
		<div v-else-if="page === 'draft'" class="screen">
			<div class="screen-head">
				<strong>{{ exampleCopy.todaysRecords }}</strong>
				<div class="screen-nav">
					<span>
						<i class="ti ti-home"></i>
					</span>
					<span class="active">
						<i class="ti ti-notebook"></i>
					</span>
					<span>
						<i class="ti ti-books"></i>
					</span>
					<span>
						<i class="ti ti-user"></i>
					</span>
				</div>
			</div>
			<div class="demo-card">
				<div class="flow-line">
					<span>{{ exampleCopy.type }}</span>
					<i></i>
					<span class="active">{{ exampleCopy.content }}</span>
					<i></i>
					<span>{{ exampleCopy.review }}</span>
				</div>
				<span class="demo-label">
					{{ exampleCopy.thoughts }}
					<small>{{ exampleCopy.optional }}</small>
				</span>
				<div class="demo-field">
					{{ exampleCopy.sampleNoteOne }}
					<br/>
					{{ exampleCopy.sampleNoteTwo }}
				</div>
				<div class="demo-actions">
					<span class="callout">
						{{ exampleCopy.next }}
						<i class="ti ti-arrow-right"></i>
					</span>
				</div>
			</div>
			<div class="draft-note">
				<i class="ti ti-bookmark"></i>
				<span>
					<strong>{{ exampleCopy.pauseTitle }}</strong>
					{{ exampleCopy.pauseHint }}
				</span>
			</div>
		</div>
		<div v-else-if="page === 'visibility'" class="screen">
			<div class="screen-head">
				<strong>{{ exampleCopy.visibilityTitle }}</strong>
				<div class="screen-nav">
					<span>
						<i class="ti ti-home"></i>
					</span>
					<span class="active">
						<i class="ti ti-notebook"></i>
					</span>
					<span>
						<i class="ti ti-books"></i>
					</span>
					<span>
						<i class="ti ti-user"></i>
					</span>
				</div>
			</div>
			<div class="privacy-case">
				<span>
					<i class="ti ti-world"></i>
				</span>
				<span>
					<i class="ti ti-users"></i>
				</span>
				<span class="active">
					<i class="ti ti-lock"></i>
					{{ exampleCopy.private }}
				</span>
			</div>
			<div class="demo-card demo-entry">
				<div class="demo-person">
					<span class="avatar">{{ exampleCopy.avatarH }}</span>
					<span>{{ exampleCopy.haru }}</span>
					<small>{{ exampleCopy.sep10 }}</small>
					<i class="ti ti-lock"></i>
				</div>
				<div class="entry-context">
					<span>{{ exampleCopy.study }}</span>
					<div class="tag-row">
						<span>
							<i class="ti ti-sparkles"></i>
							{{ exampleCopy.interest }}
						</span>
						<span>
							<i class="ti ti-thumb-up"></i>
							{{ exampleCopy.recommended }}
						</span>
					</div>
				</div>
				<h4>
					<i class="ti ti-book"></i>
					{{ exampleCopy.gardenBook }}
				</h4>
				<p>
					{{ exampleCopy.sampleNoteOne }}
					<br/>
					{{ exampleCopy.sampleNoteTwo }}
				</p>
				<div class="record-meta">
					{{ exampleCopy.fantasy }}
					<i class="ti ti-clock"></i>
					{{ exampleCopy.thirtyMinutes }}
				</div>
			</div>
			<div class="share-caption">
				<i class="ti ti-lock"></i>
				{{ exampleCopy.visibilityHint }}
			</div>
		</div>
		<div v-else-if="page === 'collection'" class="screen">
			<div class="screen-head">
				<strong>{{ exampleCopy.collection }}</strong>
				<div class="screen-nav">
					<span>
						<i class="ti ti-home"></i>
					</span>
					<span>
						<i class="ti ti-notebook"></i>
					</span>
					<span class="active">
						<i class="ti ti-books"></i>
					</span>
					<span>
						<i class="ti ti-user"></i>
					</span>
				</div>
			</div>
			<div class="shelf-tabs">
				<span class="active">
					<i class="ti ti-books"></i>
					{{ exampleCopy.bookshelf }}
				</span>
				<span>
					<i class="ti ti-movie"></i>
				</span>
				<span>
					<i class="ti ti-device-gamepad-2"></i>
				</span>
				<span>
					<i class="ti ti-briefcase"></i>
				</span>
			</div>
			<div class="mini-search">
				<i class="ti ti-search"></i>
				{{ exampleCopy.searchTitleGenre }}
			</div>
			<div class="shelf">
				<div class="shelf-item">
					<div class="cover" data-art="0">
						<small>
							HATADY
							<br/>
							BOOKS
						</small>
						<strong>{{ exampleCopy.gardenBook }}</strong>
					</div>
					<strong>{{ exampleCopy.gardenBook }}</strong>
					<small>{{ exampleCopy.reading }}</small>
				</div>
				<div class="shelf-item">
					<div class="cover" data-art="1">
						<small>
							HATADY
							<br/>
							BOOKS
						</small>
						<strong>{{ exampleCopy.moonBook }}</strong>
					</div>
					<strong>{{ exampleCopy.moonBook }}</strong>
					<small>{{ exampleCopy.wantToRead }}</small>
				</div>
				<div class="shelf-item">
					<div class="cover" data-art="2">
						<small>
							HATADY
							<br/>
							BOOKS
						</small>
						<strong>{{ exampleCopy.spacesBook }}</strong>
					</div>
					<strong>{{ exampleCopy.spacesBook }}</strong>
					<small>{{ exampleCopy.wantToRead }}</small>
				</div>
			</div>
			<div class="collection-note">
				<span>
					<i class="ti ti-notebook"></i>
					{{ exampleCopy.gardenRecords }}
				</span>
				<strong>
					{{ exampleCopy.threeItems }}
					<i class="ti ti-chevron-right"></i>
				</strong>
			</div>
		</div>
		<div v-else-if="page === 'following'" class="screen">
			<div class="screen-head">
				<strong>{{ exampleCopy.dailyRecords }}</strong>
				<div class="screen-nav">
					<span>
						<i class="ti ti-home"></i>
					</span>
					<span class="active">
						<i class="ti ti-notebook"></i>
					</span>
					<span>
						<i class="ti ti-books"></i>
					</span>
					<span>
						<i class="ti ti-user"></i>
					</span>
				</div>
			</div>
			<div class="scope-tabs">
				<span>
					<i class="ti ti-user"></i>
				</span>
				<span>
					<i class="ti ti-users"></i>
				</span>
				<span class="active">
					<i class="ti ti-user-check"></i>
					{{ exampleCopy.following }}
				</span>
			</div>
			<div class="demo-card demo-entry">
				<div class="demo-person">
					<span class="avatar">{{ exampleCopy.avatarS }}</span>
					<span>{{ exampleCopy.sora }}</span>
					<small>{{ exampleCopy.sep10 }}</small>
					<i class="ti ti-world"></i>
				</div>
				<div class="entry-context">
					<span>{{ exampleCopy.study }}</span>
				</div>
				<h4>
					<i class="ti ti-book"></i>
					{{ exampleCopy.moonBook }}
				</h4>
				<p>
					{{ exampleCopy.sampleReplyOne }}
					<br/>
					{{ exampleCopy.sampleReplyTwo }}
				</p>
				<div class="entry-bottom">
					<span class="reaction">
						<i class="ti ti-thumb-up"></i>
						2
					</span>
					<i class="ti ti-message-circle"></i>
					<span>1</span>
				</div>
			</div>
		</div>
		<div v-else-if="page === 'reflection'" class="screen">
			<div class="screen-head">
				<strong>{{ exampleCopy.profile }}</strong>
				<div class="screen-nav">
					<span>
						<i class="ti ti-home"></i>
					</span>
					<span>
						<i class="ti ti-notebook"></i>
					</span>
					<span>
						<i class="ti ti-books"></i>
					</span>
					<span class="active">
						<i class="ti ti-user"></i>
					</span>
				</div>
			</div>
			<div class="profile-top">
				<span class="avatar">{{ exampleCopy.avatarH }}</span>
				<span>
					<strong>{{ exampleCopy.haru }}</strong>
					<small>{{ exampleCopy.profileBioLong }}</small>
				</span>
				<i class="ti ti-palette"></i>
			</div>
			<div class="demo-card">
				<div class="week-top">
					<span>{{ exampleCopy.thisWeek }}</span>
					<strong>
						13
						<small>{{ exampleCopy.records }}</small>
					</strong>
				</div>
				<div class="week-strip">
					<span>
						{{ exampleCopy.friday }}
						<strong>4</strong>
						<small>{{ exampleCopy.oneItem }}</small>
					</span>
					<span>
						{{ exampleCopy.saturday }}
						<strong>5</strong>
						<small>{{ exampleCopy.zeroItems }}</small>
					</span>
					<span>
						{{ exampleCopy.sunday }}
						<strong>6</strong>
						<small>{{ exampleCopy.oneItem }}</small>
					</span>
					<span>
						{{ exampleCopy.monday }}
						<strong>7</strong>
						<small>{{ exampleCopy.threeItems }}</small>
					</span>
					<span>
						{{ exampleCopy.tuesday }}
						<strong>8</strong>
						<small>{{ exampleCopy.threeItems }}</small>
					</span>
					<span>
						{{ exampleCopy.wednesday }}
						<strong>9</strong>
						<small>{{ exampleCopy.threeItems }}</small>
					</span>
					<span>
						{{ exampleCopy.thursday }}
						<strong>10</strong>
						<small>{{ exampleCopy.twoItems }}</small>
					</span>
				</div>
				<div class="progress-summary">
					<span>
						<strong>25</strong>
						<small>{{ exampleCopy.allRecords }}</small>
					</span>
					<span>
						<strong>{{ exampleCopy.fifteenHours }}</strong>
						<small>{{ exampleCopy.timeSpent }}</small>
					</span>
				</div>
			</div>
			<div class="stat-links">
				<span>
					<i class="ti ti-chart-bar"></i>
					{{ exampleCopy.stats }}
				</span>
				<span>
					<i class="ti ti-calendar"></i>
					{{ exampleCopy.calendar }}
				</span>
				<span>
					<i class="ti ti-target"></i>
					{{ exampleCopy.goals }}
				</span>
			</div>
		</div>
	</template>
	<template v-else>
		<div v-if="page === 'home'" class="screen">
			<div class="update-heading">
				<strong>
					<span class="brand"><HataAppLogo app="hatady" :size="20" :monochrome="darkTheme"/><HataAppWordmark app="hatady" inheritColor/></span>
				</strong>
				<span class="update-create">
					<i class="ti ti-plus"></i>
				</span>
			</div>
			<div class="screen-nav update-nav">
				<span class="active">
					<i class="ti ti-home"></i>
					{{ exampleCopy.home }}
				</span>
				<span>
					<i class="ti ti-notebook"></i>
				</span>
				<span>
					<i class="ti ti-books"></i>
				</span>
				<span>
					<i class="ti ti-user"></i>
				</span>
			</div>
			<div class="update-bento">
				<section class="update-tile update-feature">
					<div>
						<small>{{ exampleCopy.wantNext }}</small>
						<h4>{{ exampleCopy.moonBook }}</h4>
						<small>{{ exampleCopy.fromFantasyInterest }}</small>
					</div>
					<div class="cover" data-art="1">
						<small>
							HATADY
							<br/>
							BOOKS
						</small>
						<strong>{{ exampleCopy.moonBook }}</strong>
					</div>
				</section>
				<section class="update-tile">
					<strong>
						<i class="ti ti-notebook"></i>
						{{ exampleCopy.last30Days }}
					</strong>
					<span class="update-value">
						14
						<small>{{ exampleCopy.records }}</small>
					</span>
					<small>{{ exampleCopy.eightHours }}</small>
				</section>
				<section class="update-tile">
					<strong>
						<i class="ti ti-books"></i>
						{{ exampleCopy.collection }}
					</strong>
					<span class="update-value">
						4
						<small>{{ exampleCopy.works }}</small>
					</span>
					<small>{{ exampleCopy.toMyCollection }}</small>
				</section>
			</div>
		</div>
		<div v-else-if="page === 'record'" class="screen">
			<div class="update-heading">
				<strong>{{ exampleCopy.todaysRecords }}</strong>
				<i class="ti ti-x"></i>
			</div>
			<div class="update-wizard-progress">
				<span>
					<i class="ti ti-book"></i>
					{{ exampleCopy.study }}
				</span>
				<small>3 / 8</small>
			</div>
			<div class="update-progress-track">
				<i></i>
			</div>
			<div class="demo-card">
				<h4 class="update-form-title">{{ exampleCopy.leaveThought }}</h4>
				<span class="demo-label">
					{{ exampleCopy.thoughts }}
					<small>{{ exampleCopy.optional }}</small>
				</span>
				<div class="demo-field">
					{{ exampleCopy.sampleNoteOne }}
					<br/>
					{{ exampleCopy.sampleNoteTwo }}
				</div>
				<div class="update-spoiler">
					<i></i>
					{{ exampleCopy.containsSpoiler }}
				</div>
				<div class="update-form-actions">
					<span>
						<i class="ti ti-arrow-left"></i>
						{{ exampleCopy.back }}
					</span>
					<span class="callout">
						{{ exampleCopy.next }}
						<i class="ti ti-arrow-right"></i>
					</span>
				</div>
			</div>
			<div class="draft-note">
				<i class="ti ti-bookmark"></i>
				<span>
					{{ exampleCopy.whenClosing }}
					<br/>
					{{ exampleCopy.saveDraftHint }}
				</span>
			</div>
		</div>
		<div v-else-if="page === 'records'" class="screen">
			<div class="update-heading">
				<strong>{{ exampleCopy.dailyRecords }}</strong>
				<span class="update-create">
					<i class="ti ti-plus"></i>
				</span>
			</div>
			<div class="screen-nav update-nav">
				<span>
					<i class="ti ti-home"></i>
				</span>
				<span class="active">
					<i class="ti ti-notebook"></i>
					{{ exampleCopy.records }}
				</span>
				<span>
					<i class="ti ti-books"></i>
				</span>
				<span>
					<i class="ti ti-user"></i>
				</span>
			</div>
			<div class="scope-tabs">
				<span class="active">
					<i class="ti ti-user"></i>
					{{ exampleCopy.myRecords }}
				</span>
				<span>
					<i class="ti ti-users"></i>
				</span>
				<span>
					<i class="ti ti-user-check"></i>
				</span>
			</div>
			<div class="update-filter-row">
				<div class="update-kinds">
					<span>
						<i class="ti ti-notebook"></i>
					</span>
					<span class="active">
						<i class="ti ti-book"></i>
						{{ exampleCopy.study }}
					</span>
					<span>
						<i class="ti ti-movie"></i>
					</span>
					<span>
						<i class="ti ti-device-gamepad-2"></i>
					</span>
					<span>
						<i class="ti ti-run"></i>
					</span>
					<span>
						<i class="ti ti-briefcase"></i>
					</span>
				</div>
				<span class="update-calendar">
					<i class="ti ti-calendar"></i>
				</span>
			</div>
			<div class="update-date">
				<span>{{ exampleCopy.sepRange }}</span>
				<i class="ti ti-x"></i>
			</div>
			<div class="demo-card demo-entry">
				<div class="demo-person">
					<span class="avatar">{{ exampleCopy.avatarH }}</span>
					<span>{{ exampleCopy.haru }}</span>
					<small>{{ exampleCopy.sep10 }}</small>
					<i class="ti ti-world"></i>
				</div>
				<div class="entry-context">
					<span>{{ exampleCopy.study }}</span>
					<div class="tag-row">
						<span>
							<i class="ti ti-sparkles"></i>
							{{ exampleCopy.interest }}
						</span>
						<span>
							<i class="ti ti-thumb-up"></i>
							{{ exampleCopy.recommended }}
						</span>
					</div>
				</div>
				<h4>
					<i class="ti ti-book"></i>
					{{ exampleCopy.gardenBook }}
				</h4>
				<p>
					{{ exampleCopy.sampleNoteOne }}
					<br/>
					{{ exampleCopy.sampleNoteTwo }}
				</p>
				<div class="record-meta">
					{{ exampleCopy.fantasy }}
					<i class="ti ti-clock"></i>
					{{ exampleCopy.thirtyMinutes }}
				</div>
			</div>
		</div>
		<div v-else-if="page === 'collection'" class="screen">
			<div class="update-heading">
				<strong>{{ exampleCopy.collection }}</strong>
				<span class="update-create">
					<i class="ti ti-plus"></i>
				</span>
			</div>
			<div class="screen-nav update-nav">
				<span>
					<i class="ti ti-home"></i>
				</span>
				<span>
					<i class="ti ti-notebook"></i>
				</span>
				<span class="active">
					<i class="ti ti-books"></i>
					{{ exampleCopy.collection }}
				</span>
				<span>
					<i class="ti ti-user"></i>
				</span>
			</div>
			<div class="shelf-tabs">
				<span class="active">
					<i class="ti ti-books"></i>
					{{ exampleCopy.bookshelf }}
				</span>
				<span>
					<i class="ti ti-movie"></i>
				</span>
				<span>
					<i class="ti ti-device-gamepad-2"></i>
				</span>
				<span>
					<i class="ti ti-briefcase"></i>
				</span>
			</div>
			<div class="update-work">
				<div class="cover" data-art="0">
					<small>
						HATADY
						<br/>
						BOOKS
					</small>
					<strong>{{ exampleCopy.gardenBook }}</strong>
				</div>
				<div>
					<small>{{ exampleCopy.fantasy }}</small>
					<h4 class="update-work-title">
						{{ exampleCopy.gardenBook }}
						<i class="ti ti-pencil"></i>
					</h4>
					<small>{{ exampleCopy.nagi }}</small>
					<br/>
					<span class="update-status">{{ exampleCopy.readingStatus }}</span>
				</div>
			</div>
			<div class="demo-card">
				<span class="demo-label">
					{{ exampleCopy.workRecords }}
					<small>{{ exampleCopy.threeItems }}</small>
				</span>
				<div class="update-record-row">
					<span>{{ exampleCopy.sep10 }}</span>
					<p>{{ exampleCopy.sampleNoteOne }}</p>
					<i class="ti ti-chevron-right"></i>
				</div>
				<div class="update-record-row">
					<span>{{ exampleCopy.sep8 }}</span>
					<p>{{ exampleCopy.sampleEarlierNote }}</p>
					<i class="ti ti-chevron-right"></i>
				</div>
			</div>
		</div>
		<div v-else-if="page === 'profile'" class="screen">
			<div class="update-heading">
				<strong>{{ exampleCopy.profile }}</strong>
				<span class="update-create">
					<i class="ti ti-plus"></i>
				</span>
			</div>
			<div class="screen-nav update-nav">
				<span>
					<i class="ti ti-home"></i>
				</span>
				<span>
					<i class="ti ti-notebook"></i>
				</span>
				<span>
					<i class="ti ti-books"></i>
				</span>
				<span class="active">
					<i class="ti ti-user"></i>
					{{ exampleCopy.profile }}
				</span>
			</div>
			<div class="update-profile-edit">
				<i class="ti ti-palette"></i>
				{{ exampleCopy.editDesign }}
			</div>
			<div class="update-profile">
				<section class="update-tile update-identity">
					<div class="update-profile-cover">
					</div>
					<span class="avatar">{{ exampleCopy.avatarH }}</span>
					<strong>{{ exampleCopy.haru }}</strong>
					<p>
						{{ exampleCopy.profileBioPart1 }}
						<br/>
						{{ exampleCopy.profileBioPart2 }}
					</p>
				</section>
				<section class="update-tile">
					<strong>
						<i class="ti ti-sparkles"></i>
						{{ exampleCopy.genresTags }}
					</strong>
					<small>{{ exampleCopy.study }}</small>
					<p>{{ exampleCopy.fantasy }}</p>
					<span class="update-status">{{ exampleCopy.interest }}</span>
				</section>
				<section class="update-tile update-stats">
					<div class="week-top">
						<span>{{ exampleCopy.thisWeek }}</span>
						<strong>
							13
							<small>{{ exampleCopy.records }}</small>
						</strong>
					</div>
					<div class="week-strip">
						<span>
							{{ exampleCopy.friday }}
							<strong>4</strong>
							<small>{{ exampleCopy.oneItem }}</small>
						</span>
						<span>
							{{ exampleCopy.saturday }}
							<strong>5</strong>
							<small>{{ exampleCopy.zeroItems }}</small>
						</span>
						<span>
							{{ exampleCopy.sunday }}
							<strong>6</strong>
							<small>{{ exampleCopy.oneItem }}</small>
						</span>
						<span>
							{{ exampleCopy.monday }}
							<strong>7</strong>
							<small>{{ exampleCopy.threeItems }}</small>
						</span>
						<span>
							{{ exampleCopy.tuesday }}
							<strong>8</strong>
							<small>{{ exampleCopy.threeItems }}</small>
						</span>
						<span>
							{{ exampleCopy.wednesday }}
							<strong>9</strong>
							<small>{{ exampleCopy.threeItems }}</small>
						</span>
						<span>
							{{ exampleCopy.thursday }}
							<strong>10</strong>
							<small>{{ exampleCopy.twoItems }}</small>
						</span>
					</div>
					<div class="progress-summary">
						<span>
							<strong>25</strong>
							<small>{{ exampleCopy.allRecords }}</small>
						</span>
						<span>
							<strong>{{ exampleCopy.fifteenHours }}</strong>
							<small>{{ exampleCopy.timeSpent }}</small>
						</span>
					</div>
				</section>
			</div>
		</div>
	</template>
</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HatadyTutorialKind } from '@/utility/hatady-tutorial-content.js';
import { i18n } from '@/i18n.js';
import { hatadyTheme } from '@/utility/hatady-prefs.js';
import { store } from '@/store.js';
import HataAppLogo from '@/components/HataAppLogo.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';

defineProps<{
	kind: HatadyTutorialKind;
	page: string;
}>();
const exampleCopy = i18n.ts._hata._hatady._tutorialExample;
const darkTheme = computed(() => hatadyTheme.value === 'dark' || hatadyTheme.value === 'espresso' || (hatadyTheme.value === 'hataskey' && store.r.darkMode.value));
</script>

<style lang="scss" scoped>
.example {
	width: 100%;
	min-width: 0;
	color: var(--hy-ink);
	font-family: 'Hatady Body','Hiragino Sans',system-ui,sans-serif;
	font-size: 14px;
	line-height: 1.6;
}
.example *,.example *::before,.example *::after {
	box-sizing: border-box;
}
.example h4,.example p {
	margin: 0;
}
.example strong,.example h4 {
	font-family: var(--hy-heading);
	font-weight: 700;
}
.example p {
	line-height: 1.8;
}
.example small {
	font-size: 12px;
	color: var(--hy-muted);
}
.brand {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	font-size: 30px;
}
.ti {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 21px;
	height: 21px;
	font-size: 21px;
	line-height: 1;
	vertical-align: middle;
	flex: none;
}
.screen {
	min-width: 0;
	position: relative;
	background: var(--hy-bg);
	border: 1px solid var(--hy-border);
	border-radius: 24px;
	padding: 16px;
	box-shadow: var(--hy-shadow);
	overflow: hidden;
}
.screen-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 16px;
}
.screen-head strong {
	font-size: 15px;
	white-space: nowrap;
}
.demo-card .screen-head {
	flex-wrap: wrap;
	gap: 8px;
}
.screen-head .brand {
	font-size: 19px;
}
.screen-nav {
	display: flex;
	align-items: center;
	gap: 6px;
	border: 1px solid var(--hy-border);
	background: var(--hy-surface);
	padding: 4px;
	border-radius: 999px;
}
.screen-nav > span {
	display: grid;
	place-items: center;
	width: 29px;
	height: 29px;
	border-radius: 50%;
}
.screen-nav .ti {
	width: 16px;
	height: 16px;
	font-size: 16px;
}
.screen-nav > span.active {
	background: var(--hy-soft);
	color: var(--hy-accent);
}
.callout {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	min-height: 36px;
	padding: 7px 12px;
	border-radius: 999px;
	background: var(--hy-accent);
	color: var(--hy-on-accent);
	font-size: 12px;
	font-family: var(--hy-heading);
}
.callout .ti {
	width: 17px;
	height: 17px;
	font-size: 17px;
}
.demo-card {
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 18px;
	padding: 17px;
	min-width: 0;
}
.demo-card h4 {
	margin: 0;
	font-family: var(--hy-heading);
	font-size: 15px;
}
.about-kinds {
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
	gap: 10px 14px;
	margin: 18px 0;
}
.about-kinds > span {
	display: grid;
	justify-items: center;
	gap: 7px;
	font-size: 11px;
	color: var(--hy-muted);
}
.about-kinds .ti {
	box-sizing: content-box;
	width: 20px;
	height: 20px;
	padding: 10px;
	border-radius: 14px;
	background: var(--hy-soft);
	color: var(--hy-accent);
	font-size: 20px;
}
.about-kinds + .demo-card h4 {
	margin-bottom: 12px;
}
.kind-list {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 9px;
	margin-top: 16px;
}
.kind-choice {
	display: flex;
	align-items: center;
	gap: 9px;
	padding: 13px 10px;
	border: 1px solid var(--hy-border);
	border-radius: 15px;
	background: var(--hy-surface);
	font-size: 12px;
	font-family: var(--hy-heading);
}
.kind-choice > span {
	display: grid;
	place-items: center;
	width: 32px;
	height: 32px;
	border-radius: 12px;
	background: var(--hy-soft);
	color: var(--hy-accent);
}
.kind-choice:nth-child(2) > span {
	background: var(--hy-warm);
}
.kind-choice:nth-child(3) > span {
	background: var(--hy-lilac);
}
.kind-choice:nth-child(4) > span {
	background: var(--hy-cool);
}
.kind-choice:last-child {
	grid-column: 1/-1;
}
.flow-line {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 11px;
	color: var(--hy-muted);
	margin-bottom: 18px;
}
.flow-line .active {
	color: var(--hy-accent);
	font-family: var(--hy-heading);
}
.flow-line i {
	flex: 1;
	height: 1px;
	background: var(--hy-border);
}
.demo-label {
	display: block;
	font-family: var(--hy-heading);
	font-size: 12px;
	margin-bottom: 8px;
}
.demo-field {
	border: 1px solid var(--hy-border);
	background: var(--hy-bg);
	border-radius: 13px;
	padding: 13px;
	min-height: 91px;
	font-size: 13px;
	line-height: 1.9;
}
.demo-actions {
	display: flex;
	justify-content: flex-end;
	margin-top: 14px;
}
.draft-note {
	margin: 14px 8px 0;
	display: flex;
	align-items: flex-start;
	gap: 10px;
	color: var(--hy-accent);
	font-size: 12px;
	line-height: 1.65;
}
.draft-note .ti {
	width: 18px;
	height: 18px;
	margin-top: 2px;
	font-size: 18px;
}
.draft-note strong {
	display: block;
	font-size: 13px;
}
.privacy-case,.shelf-tabs,.scope-tabs {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 5px;
	padding: 5px;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	margin-bottom: 16px;
}
.privacy-case > span,.shelf-tabs > span,.scope-tabs > span {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	min-height: 36px;
	flex: 1;
	border-radius: 999px;
	font-size: 11px;
	white-space: nowrap;
}
.privacy-case .ti {
	width: 16px;
	height: 16px;
	font-size: 16px;
}
.privacy-case > .active,.shelf-tabs > .active,.scope-tabs > .active {
	background: var(--hy-soft);
	color: var(--hy-accent);
	font-family: var(--hy-heading);
}
.privacy-case > .active {
	outline: 1px solid var(--hy-accent);
	outline-offset: -1px;
}
.demo-person {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 15px;
	font-size: 12px;
}
.avatar {
	display: grid;
	place-items: center;
	width: 29px;
	height: 29px;
	flex: none;
	border-radius: 50%;
	background: var(--hy-soft);
	font-size: 12px;
}
.demo-person > small {
	margin-left: auto;
}
.demo-person > .ti {
	color: var(--hy-muted);
	width: 18px;
	height: 18px;
	font-size: 18px;
}
.demo-entry h4 {
	display: flex;
	align-items: center;
	gap: 7px;
	font-size: 16px;
	margin-bottom: 12px;
}
.demo-entry h4 .ti {
	width: 18px;
	height: 18px;
	font-size: 18px;
}
.demo-entry p {
	font-size: 13px;
	line-height: 1.85;
}
.entry-context {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 7px;
	margin: 0 0 13px 37px;
	font-size: 10px;
	color: var(--hy-muted);
}
.tag-row {
	display: flex;
	align-items: center;
	gap: 5px;
}
.tag-row > span {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 4px 8px;
	font-size: 10px;
	border-radius: 999px;
	background: var(--hy-soft);
}
.tag-row .ti {
	width: 13px;
	height: 13px;
	font-size: 13px;
}
.record-meta {
	display: flex;
	gap: 7px;
	align-items: center;
	font-size: 10px;
	color: var(--hy-muted);
	margin-top: 14px;
}
.record-meta .ti {
	width: 14px;
	height: 14px;
	font-size: 14px;
}
.share-caption {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-top: 13px;
	font-size: 11px;
	color: var(--hy-muted);
}
.share-caption .ti {
	width: 16px;
	height: 16px;
	font-size: 16px;
}
.mini-search {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 10px 12px;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 999px;
	font-size: 11px;
	color: var(--hy-muted);
	margin-bottom: 14px;
}
.mini-search .ti {
	width: 16px;
	height: 16px;
	font-size: 16px;
}
.shelf {
	display: grid;
	grid-template-columns: repeat(3,minmax(0,1fr));
	gap: 10px;
}
.shelf-item {
	min-width: 0;
	text-align: center;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 16px;
	padding: 12px 6px;
}
.cover {
	position: relative;
	isolation: isolate;
	width: 62px;
	max-width: 100%;
	aspect-ratio: 3/4;
	margin: auto auto 9px;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	text-align: left;
	padding: 8px;
	background: #405c63;
	color: #fff8e8;
	border-radius: 5px 10px 10px 5px;
	box-shadow: 3px 6px 12px -8px #182b38;
}
.cover::before {
	content: '';
	z-index: -1;
	position: absolute;
	right: -35%;
	top: 18%;
	width: 94%;
	aspect-ratio: 1;
	border-radius: 50%;
	background: #eddbbd;
}
.cover::after {
	content: '';
	z-index: -1;
	position: absolute;
	bottom: -30%;
	left: 6%;
	width: 180%;
	height: 75%;
	border-radius: 50%;
	background: #162e3d88;
	transform: rotate(-24deg);
}
.cover[data-art='1'] {
	background: #a7614a;
}
.cover[data-art='2'] {
	background: #7b7453;
}
.cover strong {
	font-size: 11px;
	line-height: 1.5;
}
.cover small {
	font-size: 6px;
	color: inherit;
}
.shelf-item > strong {
	font-size: 10px;
	display: block;
	line-height: 1.6;
}
.shelf-item > small {
	font-size: 9px;
}
.collection-note {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	border-radius: 13px;
	padding: 12px;
	margin-top: 13px;
	font-size: 11px;
}
.entry-bottom {
	display: flex;
	align-items: center;
	gap: 7px;
	margin-top: 16px;
	font-size: 11px;
	color: var(--hy-muted);
}
.reaction {
	display: flex;
	align-items: center;
	gap: 5px;
	border-radius: 999px;
	background: var(--hy-soft);
	padding: 7px 9px;
	color: var(--hy-accent);
}
.entry-bottom > .ti {
	margin-left: auto;
	width: 18px;
	height: 18px;
	font-size: 18px;
}
.profile-top {
	display: flex;
	align-items: center;
	gap: 10px;
	border-radius: 17px;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
	padding: 14px;
	margin-bottom: 11px;
}
.profile-top > .avatar {
	width: 40px;
	height: 40px;
	background: var(--hy-lilac);
}
.profile-top strong {
	font-size: 14px;
	display: block;
}
.profile-top small {
	font-size: 10px;
}
.profile-top > .ti {
	margin-left: auto;
	color: var(--hy-accent);
}
.week-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 12px;
	margin-bottom: 12px;
}
.week-top > strong {
	font-size: 21px;
	color: var(--hy-accent);
}
.week-top small {
	font-size: 10px;
}
.week-strip {
	display: grid;
	grid-template-columns: repeat(7,1fr);
	gap: 5px;
}
.week-strip > span {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 6px;
	background: var(--hy-soft);
	border-radius: 10px;
	padding: 9px 1px;
	font-size: 10px;
}
.week-strip > span:last-child {
	outline: 1px solid var(--hy-accent);
	outline-offset: -1px;
}
.week-strip strong {
	font-size: 14px;
}
.week-strip small {
	font-size: 8px;
}
.stat-links {
	display: flex;
	justify-content: center;
	gap: 8px;
	margin-top: 12px;
}
.stat-links > span {
	display: flex;
	align-items: center;
	gap: 5px;
	border-radius: 999px;
	padding: 7px 8px;
	background: var(--hy-surface);
	font-size: 10px;
}
.stat-links .ti {
	width: 15px;
	height: 15px;
	font-size: 15px;
}
.progress-summary {
	display: grid;
	grid-template-columns: repeat(2,1fr);
	text-align: center;
	gap: 8px;
	margin-top: 14px;
	padding-top: 12px;
	border-top: 1px solid var(--hy-border);
}
.progress-summary strong {
	font-size: 20px;
	display: block;
	color: var(--hy-accent);
}
.progress-summary small {
	font-size: 9px;
}
@mixin compact-example {
	.screen {
		padding: 10px;
		border-radius: 18px;
	}
	.screen-head {
		gap: 8px;
		margin-bottom: 8px;
	}
	.screen-head strong {
		font-size: 12px;
	}
	.screen-head .brand {
		font-size: 17px;
	}
	.screen-nav {
		gap: 3px;
		padding: 3px;
	}
	.screen-nav > span {
		width: 22px;
		height: 22px;
	}
	.screen-nav .ti {
		width: 14px;
		height: 14px;
		font-size: 14px;
	}
	.demo-card {
		padding: 10px;
		border-radius: 14px;
	}
	.demo-card h4 {
		font-size: 13px;
	}
	.callout {
		min-height: 28px;
		padding: 5px 8px;
		font-size: 11px;
		gap: 4px;
	}
	.callout .ti {
		width: 15px;
		height: 15px;
		font-size: 15px;
	}
	.about-kinds {
		gap: 8px;
		margin: 10px 0;
	}
	.about-kinds > span {
		gap: 5px;
		font-size: 10px;
	}
	.about-kinds .ti {
		width: 18px;
		height: 18px;
		padding: 6px;
		border-radius: 10px;
		font-size: 18px;
	}
	.about-kinds + .demo-card h4 {
		margin-bottom: 6px;
	}
	.kind-list {
		gap: 6px;
		margin-top: 8px;
	}
	.kind-choice {
		gap: 6px;
		padding: 6px 8px;
		font-size: 11px;
		border-radius: 11px;
	}
	.kind-choice > span {
		width: 22px;
		height: 22px;
		border-radius: 8px;
	}
	.kind-choice .ti {
		width: 16px;
		height: 16px;
		font-size: 16px;
	}
	.flow-line {
		margin-bottom: 8px;
	}
	.demo-label {
		font-size: 11px;
		margin-bottom: 5px;
	}
	.demo-field {
		min-height: 0;
		padding: 8px;
		font-size: 12px;
		line-height: 1.6;
	}
	.demo-actions {
		margin-top: 8px;
	}
	.draft-note {
		margin: 8px 0 0;
		gap: 6px;
		font-size: 11px;
		line-height: 1.5;
	}
	.draft-note strong {
		font-size: 11px;
	}
	.privacy-case,.shelf-tabs,.scope-tabs {
		gap: 3px;
		padding: 3px;
		margin-bottom: 8px;
	}
	.privacy-case > span,.shelf-tabs > span,.scope-tabs > span {
		min-height: 28px;
		font-size: 10px;
	}
	.demo-person {
		gap: 6px;
		margin-bottom: 8px;
		font-size: 11px;
	}
	.avatar {
		width: 24px;
		height: 24px;
		font-size: 11px;
	}
	.demo-person > small {
		font-size: 10px;
	}
	.demo-person > .ti {
		width: 16px;
		height: 16px;
		font-size: 16px;
	}
	.entry-context {
		gap: 5px;
		margin: 0 0 8px 30px;
	}
	.tag-row {
		gap: 4px;
	}
	.tag-row > span {
		padding: 3px 5px;
		gap: 3px;
		font-size: 9px;
	}
	.tag-row .ti {
		width: 11px;
		height: 11px;
		font-size: 11px;
	}
	.demo-entry h4 {
		font-size: 14px;
		margin-bottom: 6px;
	}
	.demo-entry p {
		font-size: 12px;
		line-height: 1.6;
	}
	.record-meta {
		margin-top: 8px;
	}
	.share-caption {
		margin-top: 8px;
		gap: 5px;
		font-size: 10px;
		line-height: 1.5;
	}
	.mini-search {
		padding: 7px 9px;
		margin-bottom: 8px;
		font-size: 10px;
	}
	.shelf {
		gap: 6px;
	}
	.shelf-item {
		padding: 8px 4px;
		border-radius: 12px;
	}
	.cover {
		width: 52px;
		margin-bottom: 6px;
		padding: 6px;
	}
	.cover strong {
		font-size: 10px;
	}
	.collection-note {
		padding: 8px;
		margin-top: 8px;
		font-size: 10px;
	}
	.collection-note .ti {
		width: 16px;
		height: 16px;
		font-size: 16px;
	}
	.entry-bottom {
		margin-top: 8px;
	}
	.reaction {
		padding: 5px 7px;
	}
	.profile-top {
		padding: 8px;
		margin-bottom: 8px;
		gap: 8px;
	}
	.profile-top > .avatar {
		width: 30px;
		height: 30px;
	}
	.profile-top strong {
		font-size: 12px;
	}
	.week-top {
		font-size: 11px;
		margin-bottom: 6px;
	}
	.week-top > strong {
		font-size: 18px;
	}
	.week-strip {
		gap: 4px;
	}
	.week-strip > span {
		gap: 3px;
		padding: 6px 1px;
		border-radius: 8px;
	}
	.week-strip strong {
		font-size: 12px;
	}
	.progress-summary {
		gap: 6px;
		margin-top: 8px;
		padding-top: 8px;
	}
	.progress-summary strong {
		font-size: 17px;
	}
	.stat-links {
		gap: 5px;
		margin-top: 8px;
	}
	.stat-links > span {
		gap: 4px;
		padding: 5px 7px;
	}
}
@container hy-dialog (max-width:600px) {
	@include compact-example;
}
@media (max-height:600px) {
	@include compact-example;
}
.update-heading {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin-bottom: 10px;
}
.update-heading > strong {
	font-size: 15px;
}
.update-heading .brand {
	font-size: 20px;
}
.update-create {
	display: grid;
	place-items: center;
	width: 31px;
	height: 31px;
	border-radius: 50%;
	background: var(--hy-accent);
	color: var(--hy-on-accent);
}
.update-nav {
	width: max-content;
	max-width: 100%;
	margin: 0 auto 14px;
	overflow: clip;
	gap: 4px;
}
.update-nav > span {
	border-radius: 999px;
	flex: none;
}
.update-nav > .active {
	display: flex;
	width: auto;
	gap: 6px;
	padding: 0 10px;
	font-size: 11px;
}
.update-nav .ti {
	width: 16px;
	height: 16px;
	font-size: 16px;
}
.update-bento {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 9px;
}
.update-tile {
	min-width: 0;
	border-radius: 17px;
	border: 1px solid var(--hy-border);
	background: var(--hy-surface);
	padding: 13px;
	font-size: 11px;
}
.update-tile > strong {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 11px;
	margin-bottom: 10px;
}
.update-tile .ti {
	width: 16px;
	height: 16px;
	font-size: 16px;
}
.update-feature {
	grid-column: 1/-1;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	background: var(--hy-soft);
}
.update-feature h4 {
	margin: 8px 0;
	font-size: 18px;
}
.update-feature .cover {
	margin: 0;
	width: 57px;
	flex: none;
}
.update-value {
	display: block;
	color: var(--hy-accent);
	font-size: 23px;
	font-family: var(--hy-heading);
}
.update-value small {
	font: 10px 'Hatady Body',sans-serif;
	color: var(--hy-muted);
	margin-left: 5px;
}
.update-kinds {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 5px;
	padding: 7px 10px;
	margin-bottom: 10px;
	border-radius: 999px;
	border: 1px solid var(--hy-border);
	background: var(--hy-surface);
}
.update-kinds > span {
	display: flex;
	align-items: center;
	gap: 5px;
	padding: 5px;
	border-radius: 999px;
	font-size: 10px;
}
.update-kinds > .active {
	padding-inline: 9px;
	background: var(--hy-soft);
	color: var(--hy-accent);
}
.update-kinds .ti {
	width: 16px;
	height: 16px;
	font-size: 16px;
}
.update-date {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	font-size: 10px;
	color: var(--hy-muted);
	margin: 0 0 10px;
}
.update-date > span {
	display: flex;
	align-items: center;
	gap: 5px;
}
.update-date .ti {
	width: 14px;
	height: 14px;
	font-size: 14px;
}
.update-work-title {
	display: flex;
	align-items: center;
	gap: 9px;
	margin: 4px 0 10px;
	font-size: 17px;
}
.update-work-title .ti {
	width: 15px;
	height: 15px;
	margin-left: auto;
	font-size: 15px;
}
.update-work {
	display: flex;
	gap: 15px;
	align-items: center;
	padding: 13px;
	margin-bottom: 10px;
	border-radius: 17px;
	background: var(--hy-surface);
	border: 1px solid var(--hy-border);
}
.update-work .cover {
	width: 63px;
	margin: 0;
	flex: none;
}
.update-work > div:last-child {
	flex: 1;
	min-width: 0;
	font-size: 11px;
}
.update-work small {
	font-size: 10px;
}
.update-status {
	display: inline-block;
	border-radius: 999px;
	padding: 5px 9px;
	background: var(--hy-soft);
	color: var(--hy-accent);
	font-size: 10px;
	margin-top: 6px;
}
.update-record-row {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 0;
	border-top: 1px solid var(--hy-border);
	font-size: 11px;
}
.update-record-row > span:first-child {
	color: var(--hy-muted);
	font-size: 10px;
	flex: none;
}
.update-record-row p {
	font-size: 11px;
}
.update-record-row > .ti {
	margin-left: auto;
	width: 15px;
	height: 15px;
	font-size: 15px;
}
.update-profile {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}
.update-profile > section {
	flex: 1 1 calc((100% - 8px)/2);
}
.update-profile .update-stats {
	flex-basis: 100%;
}
.update-identity {
	position: relative;
	overflow: hidden;
	padding-top: 0;
}
.update-profile-cover {
	height: 32px;
	background: var(--hy-lilac);
	margin: 0 -13px 0;
}
.update-identity .avatar {
	margin-top: -13px;
	width: 32px;
	height: 32px;
	background: var(--hy-lilac);
	border: 3px solid var(--hy-surface);
	position: relative;
}
.update-identity > strong {
	margin: 5px 0;
}
.update-identity > p {
	font-size: 10px;
	line-height: 1.6;
}
.update-profile-edit {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 6px;
	font-size: 11px;
	color: var(--hy-accent);
	margin-bottom: 10px;
}
.update-profile-edit .ti {
	width: 16px;
	height: 16px;
	font-size: 16px;
}
.update-stats .week-strip > span {
	padding: 6px 1px;
	font-size: 9px;
	gap: 3px;
}
.update-stats .week-strip strong {
	font-size: 12px;
}
.update-stats .week-top {
	margin-bottom: 9px;
}
.update-stats .week-top > strong {
	font-size: 20px;
}
.update-stats .progress-summary {
	margin-top: 10px;
	padding-top: 8px;
}
.update-stats .progress-summary strong {
	font-size: 18px;
}
@mixin compact-update {
	.update-nav {
		margin-bottom: 10px;
	}
	.update-bento {
		gap: 7px;
	}
	.update-tile {
		padding: 10px;
		border-radius: 13px;
	}
	.update-tile > strong {
		margin-bottom: 6px;
	}
	.update-feature h4 {
		font-size: 16px;
		margin: 5px 0;
	}
	.update-feature .cover {
		width: 48px;
	}
	.update-kinds {
		padding: 4px 7px;
		margin-bottom: 8px;
		gap: 2px;
	}
	.update-kinds > span {
		padding: 4px;
	}
	.update-work {
		padding: 10px;
		gap: 12px;
		margin-bottom: 8px;
	}
	.update-work-title {
		font-size: 16px;
	}
	.update-record-row {
		padding: 8px 0;
	}
	.update-identity {
		padding-top: 0;
	}
	.update-profile-cover {
		margin-inline: -10px;
		height: 28px;
	}
}
.update-wizard-progress {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 11px;
	margin: 13px 0 10px;
}
.update-wizard-progress > span {
	display: flex;
	align-items: center;
	gap: 6px;
}
.update-wizard-progress .ti {
	width: 25px;
	height: 25px;
	padding: 5px;
	box-sizing: content-box;
	background: var(--hy-soft);
	border-radius: 12px;
	font-size: 25px;
}
.update-progress-track {
	height: 4px;
	border-radius: 999px;
	background: var(--hy-soft);
	margin-bottom: 14px;
	overflow: hidden;
}
.update-progress-track i {
	display: block;
	height: 100%;
	width: 37.5%;
	background: var(--hy-accent);
	border-radius: inherit;
}
.update-form-title {
	font-size: 16px;
	margin: 0 0 13px;
}
.update-spoiler {
	display: flex;
	align-items: center;
	gap: 6px;
	font-size: 10px;
	margin-top: 10px;
}
.update-spoiler i {
	width: 12px;
	height: 12px;
	border: 1px solid var(--hy-muted);
	border-radius: 3px;
}
.update-form-actions {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 11px;
	margin-top: 14px;
}
.update-form-actions > span {
	display: flex;
	align-items: center;
	gap: 6px;
}
.update-form-actions .ti {
	width: 15px;
	height: 15px;
	font-size: 15px;
}
.update-filter-row {
	display: flex;
	align-items: center;
	gap: 7px;
	margin-bottom: 10px;
}
.update-filter-row .update-kinds {
	flex: 1;
	min-width: 0;
	margin: 0;
}
.update-calendar {
	display: grid;
	place-items: center;
	flex: none;
	width: 28px;
	height: 28px;
	background: var(--hy-soft);
	color: var(--hy-accent);
	border-radius: 50%;
}
.update-calendar .ti {
	width: 16px;
	height: 16px;
	font-size: 16px;
}
@container hy-dialog (max-width:600px) {
	@include compact-update;
}
@media (max-height:600px) {
	@include compact-update;
}
</style>
