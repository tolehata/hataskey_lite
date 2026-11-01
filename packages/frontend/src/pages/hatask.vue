<template>
<component :is="embedded ? 'div' : PageWithHeader" :hideHeader="true" :class="embedded ? 'htk-embedded-page' : undefined">
<svg width="0" height="0" style="position:absolute"><defs><filter id="htk-gfx" x="0%" y="0%" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.025 0.025" numOctaves="2" seed="92" result="n"/><feGaussianBlur in="n" stdDeviation="2" result="bl"/><feDisplacementMap in="SourceGraphic" in2="bl" scale="65" xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg>

	<div ref="rootEl" class="htk-root" :data-embedded="embedded" :data-mode="themeMode" :data-theme="plannerTheme" :data-window="inPageWindow?'true':'false'" :data-anim="embedded || settings.animations !== false ? 'on' : 'off'" :style="hatakyuThemeStyle">
		<Teleport to="body">
			<div v-if="embedded" v-show="captureKind !== null && !externalCaptureTarget" class="htk-goes-capture-overlay" @keydown.esc.stop="closeGoesCapture" @keydown.tab="trapGoesCaptureFocus">
				<section class="htk-root htk-goes-capture" role="dialog" aria-modal="true" aria-label="Hatask の記録" data-embedded="true" :data-theme="plannerTheme" :data-mode="themeMode" :style="hatakyuThemeStyle">
					<header class="htk-goes-capture-heading"><span>Hatask の記録 · 入力中の内容を引き継ぎます</span><button ref="captureCloseButton" type="button" class="htk-btn" @click="closeGoesCapture">閉じる</button></header>
					<div ref="captureTarget" class="htk-goes-capture-body"></div>
				</section>
			</div>
		</Teleport>

<!-- 旗鯖fork(v2 §16①): 共通の起動表示 -->
<div v-if="showBoot && !embedded" :key="bootKey" class="htk-boot" :style="isAkatsuki ? getHataskDaylightStyle(akatsukiNow, themeMode) : undefined" aria-hidden="true"><div class="htk-boot-inner"><div class="htk-boot-logo"><HataAppLogo app="hatask" :size="64" :monochrome="themeMode === 'dark'"/><HataAppWordmark app="hatask" :onDark="themeMode === 'dark'"/></div></div></div>

<div class="htk-app">
<!-- 全テーマ共通の暁レイアウト -->
<div class="htk-shell">
<HataskAkatsukiLayout
  v-model:searchQuery="searchQuery"
  :enabled="true"
					:embedded="embedded"
					:bootVisible="showBoot"
  :activeTab="activeTab as HataskAkatsukiTab"
  :mode="themeMode"
  :animations="embedded || (settings.animations!==false && prefer.r.animation.value)"
  :model="akatsukiModel"
  :now="akatsukiNow"
  :searchOpen="showSearch"
					:favoritesReady="dataLoaded && loadedKeys.has('settings')"
					:favoritesSaving="akatsukiFavoritesSaving"
					:favoritesError="akatsukiFavoritesError"
  @navigate="navigateAkatsuki"
  @settings="openHataskSettings"
  @search="searchAkatsuki"
  @closeSearch="showSearch=false"
  @action="handleAkatsukiAction"
					@saveFavorites="saveAkatsukiFavorites"
>
<template #search-results>
  <HataskSearchResults :groups="hataskSearchGroups" :emptyLabel="copy.notFound" @select="selectHataskSearchResult"/>
  <div class="htk-sch-note">{{copy.searchScopeNote}}</div>
</template>
<template #home-feedback>
	<p v-if="hfState==='loading'" role="status">{{ copy.notificationLoading }}</p>
	<p v-else-if="hfState==='error'" role="status">{{ copy.notificationFailed }}</p>
	<p v-else-if="!hfNotifs.length">{{copy.noNotifications}}</p>
	<button v-for="n in akatsukiFeedbackNotifications" :key="n.id" type="button" class="htk-akatsuki-notification" :data-unread="!n.isRead" @click="openAkatsukiFeedbackNotification(n)">
	  <i :class="['ti',hfIcon(n.type)]" aria-hidden="true"></i><HataFeedNotificationBody :text="notificationDisplayMessage(n)"/>
	</button>
</template>
<template v-if="showGoesLauncher" #home-launcher>
	<section class="htk-goes-launcher" aria-label="よく使う App">
		<div class="htk-goes-launcher-row">
			<h2><i class="ti ti-apps" aria-hidden="true"></i>よく使う App</h2>
			<div class="htk-goes-launcher-grid"><button v-for="app in goesHataskLauncherApps" :key="app.id" type="button" :title="app.label" @click="hataGoesHost?.openLauncherScreen?.(app.id)"><span><HataFeatureIcon v-if="hataFeatureForScreen(app.id)" :feature="hataFeatureForScreen(app.id)!" :size="40" :mode="themeMode === 'dark' ? 'mono-dark' : 'color'"/><i v-else :class="app.icon" aria-hidden="true"></i></span><small>{{ app.label }}</small></button></div>
			<button type="button" class="htk-goes-launcher-all" @click="hataGoesHost?.openAllApps?.()"><i class="ti ti-layout-grid" aria-hidden="true"></i>すべての App</button>
		</div>
	</section>
</template>
<template #home-extra>
  <div class="htk-akatsuki-extras">
    <div v-if="completedUndoItems.length" class="htk-planner-undo htk-complete-undo" role="status">
      <i class="ti ti-circle-check-filled" aria-hidden="true"></i><span>{{plannerCopyx.completedCount({count:completedUndoItems.length.toString()})}}</span>
      <button type="button" class="htk-btn htk-xs" :disabled="plannerReadOnly" @click="undoCompletedTodos">{{plannerCopy.restore}}</button>
    </div>
    <section v-if="pendingRsvps.length" class="htk-akatsuki-extra">
      <h3>{{copy.rsvp}}</h3>
      <div v-for="r in pendingRsvps" :key="r.eventId" class="htk-akatsuki-rsvp">
        <strong>{{r.title}}</strong><span>{{r.dateLabel}}</span>
        <div><button class="htk-btn htk-sm" :aria-pressed="r.myStatus==='going'" :disabled="plannerReadOnly || isRsvpSaving(r.eventId)" @click="setRsvp(r.eventId,'going')">{{copy.rsvpGoing}}</button><button class="htk-btn htk-sm" :aria-pressed="r.myStatus==='maybe'" :disabled="plannerReadOnly || isRsvpSaving(r.eventId)" @click="setRsvp(r.eventId,'maybe')">{{copy.rsvpMaybeShort}}</button><button class="htk-btn htk-sm" :aria-pressed="r.myStatus==='declined'" :disabled="plannerReadOnly || isRsvpSaving(r.eventId)" @click="setRsvp(r.eventId,'declined')">{{copy.rsvpDeclined}}</button></div>
      </div>
    </section>
    <section v-if="settings.showEarthquake!==false && rawQuakes.length" class="htk-akatsuki-extra">
      <h3>{{copy.earthquakeAndTsunami}}</h3>
      <MkEarthquakeTicker :quakes="rawQuakes" :tsunami="tsunami" mode="compact" :showEmpty="false" @click="openEarthquake"/>
      <small>{{copy.jmaSourceNote}}</small>
    </section>
  </div>
</template>
<HataskAkatsukiApps
  v-if="activeTab==='hataskapps' || activeTab==='apps'"
  :kind="activeTab==='hataskapps'?'hatask':'tools'"
  :embedded="embedded"
  :animations="settings.animations!==false"
  :monochrome="themeMode === 'dark'"
  :counts="akatsukiAppCounts"
  :canAccessHataFeed="canAccessHataFeed"
  :canUseMascot="canUseMascot"
  :countsKnown="dataLoaded && plannerMigrationReady && loadedKeys.has('events') && loadedKeys.has('todos') && journalValidKeys.includes('meals')"
  @open="openAkatsukiApp"
/>
<HataskRecordReview v-if="activeTab === 'review' && canReviewRecords" ref="recordReview" :theme="plannerTheme" :mode="themeMode"/>
<HataskSupport v-if="activeTab === 'support'" :theme="plannerTheme" :mode="themeMode" :animations="settings.animations !== false"/>
					<Teleport :to="captureDestination" :disabled="captureKind !== 'recipe'">
						<HataskRecipe v-if="recipeMounted" v-show="activeTab === 'recipe' || captureKind === 'recipe'" ref="recipeView" :theme="plannerTheme" :mode="themeMode" :consented="settings.recipeConsentShown === true" :settingsReady="dataLoaded && loadedKeys.has('settings')" @consent="ackRecipeConsent" @close="captureKind === 'recipe' ? closeGoesCapture() : closeRecipe()" @hatadyCookingSaved="onGoesCookingSaved"/>
					</Teleport>
<HataskRanking v-if="activeTab === 'ranking'" :theme="plannerTheme" :mode="themeMode" :showAchievementNotice="dataLoaded && loadedKeys.has('settings') && settings.showRankingAchievementNotice !== false"/>

<!-- ========== CALENDAR ========== -->
					<Teleport :to="captureDestination" :disabled="captureKind !== 'cal'">
						<div v-if="activeTab==='cal' || captureKind === 'cal'" class="htk-tabpage htk-calendar-page htk-panels">
  <div class="htk-planner-shell htk-anim">
    <div v-if="plannerStorageState==='loading'||plannerStorageState==='saving'||plannerStorageState==='blocked'||plannerStorageState==='conflict'" class="htk-planner-status" :data-state="plannerStorageState" role="status" aria-live="polite">
      <i :class="plannerStorageState==='loading'||plannerStorageState==='saving'?'ti ti-loader-2':'ti ti-shield-exclamation'" aria-hidden="true"></i>
      <span>{{plannerStorageState==='loading'?plannerCopy.loading:plannerStorageState==='saving'?plannerCopy.saving:plannerStorageDetail||plannerCopy.readOnly}}</span>
      <button v-if="plannerReadOnly" type="button" class="htk-btn htk-xs" @click="retryPlannerStorage">{{plannerCopy.retry}}</button>
    </div>
    <Teleport :to="calendarInlineCaptureTarget ?? 'body'" :disabled="!embedded || captureKind !== null || !calendarInlineCaptureTarget">
    <HataskQuickCapture
    :theme="plannerTheme"
      ref="eventCaptureRef"
      mode="event"
      :modelValue="newEvent.title"
      :label="editingEvent?copy.editEvent:copy.newEvent"
      :placeholder="editingEvent?copy.editEvent:copy.eventTitlePlaceholder"
      :submitLabel="editingEvent?copy.update:copy.add"
      :chips="eventCaptureChips"
      :tools="eventCaptureTools"
      :templateLabel="plannerCopy.templateLibrary"
      :templateDisabled="!plannerTemplatesLoaded"
      :detailOpen="showEventDetails||showEventTemplates||eventCaptureEditor!=null"
      :disabled="plannerReadOnly"
	      :state="eventCaptureState"
	      :chipLabel="plannerCopy.captureChips"
	      :toolLabel="plannerCopy.captureTools"
	      :removeChipLabel="label=>plannerCopyx.removeCaptureChip({label})"
	      :hint="embedded ? undefined : plannerCopy.eventCaptureHint"
      @update:modelValue="updateEventCapture"
      @submit="submitEventCapture"
      @tool="handleEventCaptureTool"
      @template="openPlannerCaptureTemplates('event', $event)"
	      @chip="handleEventCaptureChip"
      @remove-chip="removeEventCaptureChip"
	      @collapse="showEventDetails=false;showEventTemplates=false;eventCaptureEditor=null"
    />
							<HataskEventMembers v-if="newEvent.visibility==='specified' && !showEventDetails" v-model="newEvent.visibleUserIds" :disabled="plannerReadOnly" :templatesReady="plannerTemplatesLoaded" :templates="plannerTemplates" :save="saveEventMemberTemplate" :remove="removeEventMemberTemplate"/>
	    <Transition name="htk-capture-detail">
	      <fieldset v-if="eventCaptureEditor==='date'" class="htk-capture-detail htk-pill-editor" :disabled="plannerReadOnly">
	        <legend class="htk-sr-only">{{copy.dateAndTime}}</legend>
	        <header class="htk-pill-editor-head"><strong><i class="ti ti-calendar-event" aria-hidden="true"></i>{{copy.dateAndTime}}</strong><button type="button" class="htk-icon-btn" :aria-label="copy.cancel" @click="eventCaptureEditor=null"><i class="ti ti-x" aria-hidden="true"></i></button></header>
	        <div class="htk-capture-grid">
	          <label><span>{{plannerCopy.eventStartDate}}</span><input :value="newEvent.date" class="htk-inp" type="date" @change="setEventStartDate(($event.target as HTMLInputElement).value)"></label>
	          <label><span>{{plannerCopy.eventEndDate}}</span><input :value="newEvent.dateEnd" :min="newEvent.date" class="htk-inp" type="date" @change="setEventEndDate(($event.target as HTMLInputElement).value)"></label>
	        </div>
	      </fieldset>
	      <fieldset v-else-if="eventCaptureEditor==='time'" class="htk-capture-detail htk-pill-editor" :disabled="plannerReadOnly">
	        <legend class="htk-sr-only">{{copy.time}}</legend>
	        <header class="htk-pill-editor-head"><strong><i class="ti ti-clock" aria-hidden="true"></i>{{copy.time}}</strong><button type="button" class="htk-icon-btn" :aria-label="copy.cancel" @click="eventCaptureEditor=null"><i class="ti ti-x" aria-hidden="true"></i></button></header>
	        <div class="htk-tg-row"><span id="hatask-capture-all-day-label" class="htk-tg-lab">{{copy.allDayFull}}</span><button type="button" :class="['htk-tg-sw',newEvent.allDay&&'on']" role="switch" aria-labelledby="hatask-capture-all-day-label" :aria-checked="newEvent.allDay" @click="newEvent.allDay=!newEvent.allDay"></button></div>
	        <div v-if="!newEvent.allDay" class="htk-capture-grid htk-pill-time-grid">
	          <label><span>{{plannerCopy.eventStartTime}}</span><input :value="newEvent.timeStart" class="htk-inp" type="time" @change="setEventStartTime(($event.target as HTMLInputElement).value)"></label>
	          <label><span>{{plannerCopy.eventEndTime}}</span><input :value="newEvent.timeEnd" class="htk-inp" type="time" @change="setEventEndTime(($event.target as HTMLInputElement).value)"></label>
	        </div>
	      </fieldset>
	    </Transition>
    <Transition name="htk-capture-detail">
      <div v-if="showEventTemplates" class="htk-capture-detail">
        <HataskTemplateLibrary
    :theme="plannerTheme"
										:templates="plannerTemplates.filter(template => template.kind !== 'members')"
          kind="event"
          :showKindFilter="false"
          :labels="plannerTemplateLabels"
          :readOnly="plannerReadOnly"
          @use="usePlannerTemplate"
          @duplicate="duplicatePlannerTemplate"
          @archive="archivePlannerTemplate"
          @move="movePlannerTemplate"
        />
      </div>
    </Transition>
    </Teleport>
    <HataskCalendarPlanner
      :embedded="embedded"
      :colorMode="themeMode"
      :theme="plannerTheme"
      :view="plannerCalendarView"
      :title="plannerCalendarTitle"
      :weekdays="plannerWeekdays"
      :days="plannerCalendarDays"
      :filters="plannerCalendarFilters"
      :labels="plannerCalendarLabels"
      :loading="plannerStorageState==='loading'"
      :readOnly="plannerReadOnly"
      @update:view="plannerCalendarView=$event"
      @navigate="navigatePlannerCalendar"
      @select-date="selectPlannerDate"
      @toggle-filter="togglePlannerCalendarFilter"
      @activate-event="activatePlannerEvent"
      @activateBlank="openBlankCalendarActions"
      @edit-event="editPlannerEvent"
      @move-request="handleCalendarMoveRequest"
      @show-more="showPlannerDay"
      @drop-event="handleCalendarEventDrop"
      @trash-event="handleCalendarEventTrash"
      @captureTarget="calendarInlineCaptureTarget=$event"
    />
    <HataskEventMoveDialog
      :colorMode="themeMode"
      :isOpen="pendingCalendarAction!=null"
	  :theme="plannerTheme"
      :mode="pendingCalendarAction?.mode||'reschedule'"
      :eventTitle="pendingCalendarAction?.event.title||''"
      :sourceLabel="pendingCalendarActionSourceLabel"
      :targetLabel="pendingCalendarActionTargetLabel"
      :labels="calendarMoveDialogLabels"
      @choose="resolveCalendarAction"
    />
  </div>

					<Teleport to="body">
						<div
							v-if="showEventDetails && (!embedded || paneActive || captureKind !== null)"
							class="htk-modal-ov"
								:style="{ zIndex: eventDetailsZIndex }"
							:data-theme="plannerTheme"
							:data-mode="themeMode"
							@click.self="closeEventDetailsModal"
							@keydown.esc.stop.prevent="closeEventDetailsModal"
						>
							<div
								class="htk-lg htk-modal-c htk-event-editor htk-event-editor-modal"
								role="dialog"
								aria-modal="true"
								aria-labelledby="hatask-event-details-title"
							>
								<div class="htk-gc">
									<header class="htk-event-editor-head">
										<h3 id="hatask-event-details-title" class="htk-sec-title">{{ plannerCopy.moreDetails }}</h3>
										<button ref="eventDetailsCloseRef" type="button" class="htk-icon-btn" :aria-label="copy.close" :title="copy.close" @click="closeEventDetailsModal"><i class="ti ti-x" aria-hidden="true"></i></button>
									</header>
	    <fieldset :disabled="plannerReadOnly" class="htk-editor-fieldset">
											<div class="htk-fg">
												<label class="htk-fl" for="hatask-event-title-input">{{ i18n.ts.title }}</label>
												<input id="hatask-event-title-input" ref="eventDetailsTitleRef" v-model="newEvent.title" class="htk-inp" type="text" :placeholder="copy.eventTitlePlaceholder" :disabled="eventCaptureState === 'saving'">
											</div>
	    <div class="htk-fg"><span id="hatask-event-emoji-label" class="htk-fl">{{copy.emoji}}</span><div class="htk-emp-row" role="group" aria-labelledby="hatask-event-emoji-label"><button v-for="e in eventEmojis" :key="e" type="button" :class="['htk-emp-i',newEvent.emoji===e&&'on']" :aria-label="`${plannerCopy.chooseEmoji}: ${e}`" :aria-pressed="newEvent.emoji===e" @click="newEvent.emoji=e"><HataskEmoji :emoji="e"/></button></div></div>
	    <div class="htk-fg"><span class="htk-fl">{{copy.dateAndTime}}</span>
	      <div class="htk-tg-row" style="margin-bottom:8px"><span id="hatask-event-all-day-label" class="htk-tg-lab">{{copy.allDayFull}}</span><button type="button" :class="['htk-tg-sw',newEvent.allDay&&'on']" role="switch" aria-labelledby="hatask-event-all-day-label" :aria-checked="newEvent.allDay" @click="newEvent.allDay=!newEvent.allDay"></button></div>
	      <div class="htk-fr htk-date-time-row"><span class="htk-field-sub-label">{{plannerCopy.eventStart}}</span><label class="htk-sr-only" for="hatask-event-start-date">{{plannerCopy.eventStartDate}}</label><input id="hatask-event-start-date" v-model="newEvent.date" class="htk-inp" type="date"><label v-if="!newEvent.allDay" class="htk-sr-only" for="hatask-event-start-time">{{plannerCopy.eventStartTime}}</label><input v-if="!newEvent.allDay" id="hatask-event-start-time" v-model="newEvent.timeStart" class="htk-inp" type="time"></div>
	      <div class="htk-fr htk-date-time-row" style="margin-top:5px"><span class="htk-field-sub-label">{{plannerCopy.eventEnd}}</span><label class="htk-sr-only" for="hatask-event-end-date">{{plannerCopy.eventEndDate}}</label><input id="hatask-event-end-date" v-model="newEvent.dateEnd" class="htk-inp" type="date"><label v-if="!newEvent.allDay" class="htk-sr-only" for="hatask-event-end-time">{{plannerCopy.eventEndTime}}</label><input v-if="!newEvent.allDay" id="hatask-event-end-time" v-model="newEvent.timeEnd" class="htk-inp" type="time"></div>
	    </div>
	    <div class="htk-fg"><span id="hatask-event-color-label" class="htk-fl">{{copy.color}}</span><div class="htk-clr-row" role="group" aria-labelledby="hatask-event-color-label"><button v-for="c in eventColors" :key="c" type="button" :class="['htk-clr-o',newEvent.color===c&&'on']" :style="{background:c}" :aria-label="`${plannerCopy.chooseColor}: ${c}`" :aria-pressed="newEvent.color===c" @click="newEvent.color=c"></button></div></div>
											<div class="htk-fg">
												<span class="htk-fl">{{ copy.visibility }}</span><div class="htk-vis-row" role="group" :aria-label="copy.visibility">
													<button type="button" :class="['htk-vis-o',newEvent.visibility==='public'&&'on']" :aria-pressed="newEvent.visibility==='public'" @click="setEventVisibility('public')"><span class="htk-vi"><i class="ti ti-world"></i></span>{{ copy.public }}</button>
													<button type="button" :class="['htk-vis-o',newEvent.visibility==='private'&&'on']" :aria-pressed="newEvent.visibility==='private'" @click="setEventVisibility('private')"><span class="htk-vi"><i class="ti ti-lock"></i></span>{{ copy.private }}</button>
													<button type="button" :class="['htk-vis-o',newEvent.visibility==='specified'&&'on']" :aria-pressed="newEvent.visibility==='specified'" @click="setEventVisibility('specified')"><span class="htk-vi"><i class="ti ti-users"></i></span>{{ plannerCopy.memberVisibility }}</button>
												</div>
											</div>
											<HataskEventMembers v-if="newEvent.visibility==='specified'" v-model="newEvent.visibleUserIds" :disabled="plannerReadOnly" :templatesReady="plannerTemplatesLoaded" :templates="plannerTemplates" :save="saveEventMemberTemplate" :remove="removeEventMemberTemplate"/>
											<div class="htk-fg"><label class="htk-fl" for="hatask-event-recurrence">{{ plannerCopy.recurrence }}</label><select id="hatask-event-recurrence" v-model="newEvent.recurrence.frequency" class="htk-inp" :disabled="newEvent.visibility!=='private'"><option value="none">{{ plannerCopy.recurrenceNone }}</option><option value="daily">{{ plannerCopy.recurrenceDaily }}</option><option value="weekly">{{ plannerCopy.recurrenceWeekly }}</option><option value="monthly">{{ plannerCopy.recurrenceMonthly }}</option><option value="yearly">{{ plannerCopy.recurrenceYearly }}</option></select></div>
	    <div class="htk-fg"><span class="htk-fl">{{copy.options}}</span><div class="htk-tg-row"><span id="hatask-event-rsvp-label" class="htk-tg-lab">{{copy.rsvp}}</span><button type="button" :class="['htk-tg-sw',newEvent.rsvp&&'on']" role="switch" aria-labelledby="hatask-event-rsvp-label" :aria-checked="newEvent.rsvp" :disabled="newEvent.visibility==='private'" :style="newEvent.visibility==='private'?'opacity:.35;cursor:not-allowed':''" @click="newEvent.visibility!=='private'&&(newEvent.rsvp=!newEvent.rsvp)"></button><span v-if="newEvent.visibility==='private'" style="font-size:.7rem;color:var(--text-3);margin-left:6px">{{copy.rsvpUnavailablePrivate}}</span></div>
    <div v-if="editingEvent && editingEvent.rsvp" class="htk-rsvp-summary">
      <div class="htk-rsvp-sum-header"><span class="htk-rsvp-sum-title">{{copy.rsvpDashboard}}</span></div>
      <div v-if="sharedEventData(editingEvent.id)?.rsvpClosed" class="htk-rsvp-closed-badge"><i class="ti ti-check"></i> {{copy.closed}}</div>
      <div v-else class="htk-rsvp-open-badge"><i class="ti ti-circle-filled" style="color:#5a9a5a;font-size:.7em;vertical-align:middle;margin-right:3px"></i>{{copy.accepting}}</div>
      <!-- Stats cards -->
      <div class="htk-rsvp-stats">
        <div class="htk-rsvp-stat-card going"><div class="htk-rsvp-stat-n">{{sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='going').length}}</div><div class="htk-rsvp-stat-l">{{copy.rsvpParticipation}}</div></div>
        <div class="htk-rsvp-stat-card maybe"><div class="htk-rsvp-stat-n">{{sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='maybe').length}}</div><div class="htk-rsvp-stat-l">{{copy.rsvpMaybe}}</div></div>
        <div class="htk-rsvp-stat-card declined"><div class="htk-rsvp-stat-n">{{sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='declined').length}}</div><div class="htk-rsvp-stat-l">{{copy.rsvpDeclined}}</div></div>
        <div class="htk-rsvp-stat-card total"><div class="htk-rsvp-stat-n">{{sharedRsvpResponses(editingEvent.id).length}}</div><div class="htk-rsvp-stat-l">{{copy.total}}</div></div>
      </div>
      <!-- Progress bar -->
      <div v-if="sharedRsvpResponses(editingEvent.id).length" class="htk-rsvp-bar-wrap">
        <div class="htk-rsvp-bar">
          <div class="htk-rsvp-bar-seg going" :style="{width:(sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='going').length/sharedRsvpResponses(editingEvent.id).length*100)+'%'}"></div>
          <div class="htk-rsvp-bar-seg maybe" :style="{width:(sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='maybe').length/sharedRsvpResponses(editingEvent.id).length*100)+'%'}"></div>
          <div class="htk-rsvp-bar-seg declined" :style="{width:(sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='declined').length/sharedRsvpResponses(editingEvent.id).length*100)+'%'}"></div>
        </div>
      </div>
      <!-- Respondent names by status -->
      <template v-if="sharedRsvpResponses(editingEvent.id).length">
        <div v-if="sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='going').length" class="htk-rsvp-grp">
          <div class="htk-rsvp-grp-h"><span class="htk-rsvp-grp-dot going"></span>{{copy.rsvpParticipation}} ({{sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='going').length}})</div>
          <div class="htk-rsvp-grp-names"><span v-for="r in sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='going')" :key="r.userId" class="htk-rsvp-name">@{{r.username}}</span></div>
        </div>
        <div v-if="sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='maybe').length" class="htk-rsvp-grp">
          <div class="htk-rsvp-grp-h"><span class="htk-rsvp-grp-dot maybe"></span>{{copy.rsvpMaybe}} ({{sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='maybe').length}})</div>
          <div class="htk-rsvp-grp-names"><span v-for="r in sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='maybe')" :key="r.userId" class="htk-rsvp-name">@{{r.username}}</span></div>
        </div>
        <div v-if="sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='declined').length" class="htk-rsvp-grp">
          <div class="htk-rsvp-grp-h"><span class="htk-rsvp-grp-dot declined"></span>{{copy.rsvpDeclined}} ({{sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='declined').length}})</div>
          <div class="htk-rsvp-grp-names"><span v-for="r in sharedRsvpResponses(editingEvent.id).filter(r=>r.status==='declined')" :key="r.userId" class="htk-rsvp-name">@{{r.username}}</span></div>
        </div>
      </template>
      <div v-else class="htk-rsvp-sum-empty">{{copy.noResponses}}</div>
      <button v-if="!sharedEventData(editingEvent.id)?.rsvpClosed" class="htk-btn htk-sm htk-danger" style="margin-top:12px;width:100%" @click="closeRsvp(editingEvent.id)">{{copy.closeRsvp}}</button>
	    </div><div class="htk-tg-row"><span id="hatask-event-notify-label" class="htk-tg-lab">{{copy.notifications}}</span><button type="button" :class="['htk-tg-sw',newEvent.notify&&'on']" role="switch" aria-labelledby="hatask-event-notify-label" :aria-checked="newEvent.notify" @click="newEvent.notify=!newEvent.notify"></button></div></div>
	    <div v-if="newEvent.notify" class="htk-fg"><span id="hatask-event-notify-timing-label" class="htk-fl">{{copy.notificationTiming}}</span><div class="htk-nt-chips" role="group" aria-labelledby="hatask-event-notify-timing-label"><button v-for="nt in notifyTimings" :key="nt" type="button" :class="['htk-nt-chip',newEvent.notifyTimings.includes(nt)&&'on']" :aria-label="plannerCopyx.notificationTimingLabel({timing:notifyTimingLabel(nt)})" :aria-pressed="newEvent.notifyTimings.includes(nt)" @click="toggleNotifyTiming(nt)">{{notifyTimingLabel(nt)}}</button></div></div>
	    </fieldset>
									<div class="htk-editor-icon-actions"><button type="button" class="htk-icon-submit" :disabled="plannerReadOnly||!newEvent.title.trim()" :aria-label="editingEvent?copy.update:copy.save" :title="editingEvent?copy.update:copy.save" @click="submitEventCapture"><i :class="editingEvent?'ti ti-check':'ti ti-plus'" aria-hidden="true"></i></button><button v-if="editingEvent" type="button" class="htk-icon-btn" :aria-label="copy.cancel" :title="copy.cancel" @click="resetEventEditor"><i class="ti ti-x" aria-hidden="true"></i></button><button v-if="editingEvent" type="button" class="htk-icon-btn htk-danger" :disabled="plannerReadOnly" :aria-label="copy.delete" :title="copy.delete" @click="deleteEventById(editingEvent.id)"><i class="ti ti-trash" aria-hidden="true"></i></button></div>
								</div>
							</div>
						</div>
					</Teleport>
</div>

					</Teleport>
<!-- ========== TODO ========== -->
					<Teleport :to="captureDestination" :disabled="captureKind !== 'todo'">
						<div v-if="activeTab==='todo' || captureKind === 'todo'" class="htk-tabpage htk-todo-page" :class="tabDir==='fwd'?'htk-tab-fwd':'htk-tab-back'">
	<div class="htk-planner-shell htk-anim">
	  <div v-if="plannerStorageState==='loading'||plannerStorageState==='saving'||plannerStorageState==='blocked'||plannerStorageState==='conflict'" class="htk-planner-status" :data-state="plannerStorageState" role="status" aria-live="polite"><i :class="plannerStorageState==='loading'||plannerStorageState==='saving'?'ti ti-loader-2':'ti ti-shield-exclamation'" aria-hidden="true"></i><span>{{plannerStorageState==='loading'?plannerCopy.loading:plannerStorageState==='saving'?plannerCopy.saving:plannerStorageDetail||plannerCopy.readOnly}}</span><button v-if="plannerReadOnly" type="button" class="htk-btn htk-xs" @click="retryPlannerStorage">{{plannerCopy.retry}}</button></div>
						<Teleport :to="todoInlineCaptureTarget ?? 'body'" :disabled="!embedded || captureKind !== null || !todoInlineCaptureTarget">
						<div class="htk-todo-capture-row">
							<HataskQuickCapture
    :theme="plannerTheme"
								ref="todoCaptureRef"
								mode="todo"
								:modelValue="newTodo"
								:label="editingTodoId?copy.editTask:copy.newTaskPlaceholder"
								:placeholder="editingTodoId?copy.editTaskPlaceholder:copy.newTaskPlaceholder"
								:submitLabel="editingTodoId?copy.update:copy.add"
								:chips="todoCaptureChips"
								:tools="todoCaptureTools"
								:templateLabel="plannerCopy.templateLibrary"
								:templateDisabled="!plannerTemplatesLoaded"
								:detailOpen="showTodoExtra||todoCaptureEditor!=null"
								:disabled="plannerReadOnly"
								:state="todoCaptureState"
								:chipLabel="plannerCopy.captureChips"
								:toolLabel="plannerCopy.captureTools"
								:removeChipLabel="label=>plannerCopyx.removeCaptureChip({label})"
								:hint="embedded ? undefined : plannerCopy.todoCaptureHint"
								@update:modelValue="updateTodoCapture"
								@submit="submitTodoCapture"
								@tool="handleTodoCaptureTool"
								@template="openPlannerCaptureTemplates('todo', $event)"
								@chip="handleTodoCaptureChip"
								@remove-chip="removeTodoCaptureChip"
								@collapse="showTodoExtra=false;todoCaptureEditor=null"
							/>
						</div>
	  <Transition name="htk-capture-detail">
	    <fieldset v-if="todoCaptureEditor==='schedule'" class="htk-capture-detail htk-pill-editor" :disabled="plannerReadOnly">
	      <legend class="htk-sr-only">{{copy.dateAndTime}}</legend>
	      <header class="htk-pill-editor-head"><strong><i class="ti ti-calendar-time" aria-hidden="true"></i>{{copy.dateAndTime}}</strong><button type="button" class="htk-icon-btn" :aria-label="copy.cancel" @click="todoCaptureEditor=null"><i class="ti ti-x" aria-hidden="true"></i></button></header>
	      <div class="htk-capture-grid">
	        <label><span>{{copy.dueDate}}</span><input v-model="newTodoDue" class="htk-inp" type="date"></label>
	        <label><span>{{copy.time}}</span><input v-model="newTodoTime" class="htk-inp" type="time"></label>
	      </div>
	      <button v-if="newTodoDue||newTodoTime" type="button" class="htk-pill-clear" @click="newTodoDue='';newTodoTime=''">{{copy.none}}</button>
	    </fieldset>
	  </Transition>
	  <Transition name="htk-capture-detail">
	    <fieldset v-if="showTodoExtra" id="hatask-todo-details" :disabled="plannerReadOnly" class="htk-capture-detail">
	      <div class="htk-capture-grid">
	        <label><span>{{copy.dueDate}}</span><input v-model="newTodoDue" class="htk-inp" type="date"></label>
	        <label><span>{{copy.time}}</span><input v-model="newTodoTime" class="htk-inp" type="time"></label>
	        <label><span>{{copy.folder}}</span><select v-model="newTodoFolder" class="htk-inp"><option value="">{{copy.noFolder}}</option><option v-for="fo in activeFolders" :key="fo.id" :value="fo.id">{{fo.name}}</option></select></label>
	        <label><span>{{plannerCopy.priority}}</span><select v-model="newTodoPriority" class="htk-inp"><option value="none">{{plannerCopy.priorityNone}}</option><option value="low">{{plannerCopy.priorityLow}}</option><option value="medium">{{plannerCopy.priorityMedium}}</option><option value="high">{{plannerCopy.priorityHigh}}</option></select></label>
	        <label><span>{{plannerCopy.recurrence}}</span><select v-model="newTodoRecurrence" class="htk-inp"><option value="none">{{plannerCopy.recurrenceNone}}</option><option value="daily">{{plannerCopy.recurrenceDaily}}</option><option value="weekly">{{plannerCopy.recurrenceWeekly}}</option><option value="monthly">{{plannerCopy.recurrenceMonthly}}</option><option value="yearly">{{plannerCopy.recurrenceYearly}}</option></select></label>
	        <label class="htk-capture-wide"><span>{{copy.comment}}</span><input v-model="newTodoComment" class="htk-inp" :placeholder="copy.memoPlaceholder"></label>
	      </div>
	      <div class="htk-todo-subtask-editor htk-capture-wide"><label>{{plannerCopy.subtasks}}</label><div v-for="subtask in newTodoSubtasks" :key="subtask.id" class="htk-todo-subtask-row"><input v-model="subtask.done" type="checkbox" :aria-label="plannerCopyx.subtaskLabel({title:subtask.text||plannerCopy.subtasks})"><input v-model="subtask.text" class="htk-inp"><button type="button" class="htk-btn htk-xs" :aria-label="plannerCopyx.deleteSubtaskLabel({title:subtask.text||plannerCopy.subtasks})" @click="removeTodoSubtask(subtask.id)"><i class="ti ti-x" aria-hidden="true"></i></button></div><div class="htk-todo-subtask-row"><input v-model="newSubtaskText" class="htk-inp" :placeholder="plannerCopy.subtasks" @keypress.enter.prevent="addTodoSubtask"><button type="button" class="htk-btn htk-xs" @click="addTodoSubtask"><i class="ti ti-plus" aria-hidden="true"></i></button></div></div>
	      <button v-if="editingTodoId" type="button" class="htk-btn htk-sm" @click="cancelEditTodo">{{copy.cancelEdit}}</button>
	    </fieldset>
	  </Transition>
	  <Transition name="htk-capture-detail">
	    <section v-if="showFolderMgr" class="htk-capture-detail htk-folder-manager" :aria-label="copy.manageFolders">
	      <header class="htk-folder-manager-head">
	        <div><strong>{{copy.manageFolders}}</strong></div>
	        <div class="htk-folder-manager-head-actions">
	          <button type="button" class="htk-icon-btn" :aria-label="plannerCopy.addFolder" :aria-expanded="showFolderCreate" @click="showFolderCreate=!showFolderCreate"><i :class="showFolderCreate?'ti ti-minus':'ti ti-plus'" aria-hidden="true"></i></button>
	          <button type="button" class="htk-icon-btn" :aria-label="copy.cancel" @click="closeFolderManager"><i class="ti ti-x" aria-hidden="true"></i></button>
	        </div>
	      </header>
	      <div class="htk-folder-manager-list">
	        <article v-for="(fo,i) in activeFolders" :key="fo.id" class="htk-fm-row" :style="{'--folder-color':fo.color||'var(--accent)'}">
	          <span class="htk-folder-colored-icon" aria-hidden="true"><i class="ti ti-folder-filled"></i></span>
	          <div class="htk-fm-copy"><strong>{{fo.name}}</strong><span>{{folderCount(fo.id)}}</span></div>
	          <button type="button" class="htk-folder-row-more" :aria-label="plannerCopyx.manageFolderLabel({name:fo.name})" @click="openFolderActions(fo.id,i)"><i class="ti ti-dots" aria-hidden="true"></i></button>
	        </article>
	        <div v-if="activeFolders.length===0" class="htk-folder-manager-empty"><i class="ti ti-folder-off" aria-hidden="true"></i><span>{{plannerCopy.noFolders}}</span></div>
	      </div>
	      <Transition name="htk-folder-create">
	        <div v-if="showFolderCreate" class="htk-folder-create-panel">
	          <label><span>{{copy.folder}}</span><input v-model="newFolderName" class="htk-inp" :placeholder="copy.folderNamePlaceholder" @keypress.enter.prevent="addFolder"></label>
	          <div class="htk-folder-clr-row" role="group" :aria-label="copy.color"><button v-for="c in folderColors" :key="c.value" type="button" :class="['htk-folder-clr-o',newFolderColor===c.value&&'on']" :style="{background:c.value}" :aria-label="c.label" :aria-pressed="newFolderColor===c.value" @click="newFolderColor=c.value"></button></div>
	          <button type="button" class="htk-icon-submit htk-folder-create-submit" :disabled="plannerReadOnly||!newFolderName.trim()" :aria-label="plannerCopy.addFolder" @click="addFolder"><i class="ti ti-plus" aria-hidden="true"></i></button>
	        </div>
	      </Transition>
	    </section>
	  </Transition>
	  <div v-if="completedUndoItems.length" class="htk-planner-undo htk-complete-undo" role="status"><i class="ti ti-circle-check-filled" aria-hidden="true"></i><span>{{plannerCopyx.completedCount({count:completedUndoItems.length.toString()})}}</span><button type="button" class="htk-btn htk-xs" :disabled="plannerReadOnly" @click="undoCompletedTodos">{{plannerCopy.restore}}</button></div>
		  <div v-if="lastArchivedTodoId" class="htk-planner-undo" role="status"><span>{{plannerCopy.archivedNotice}}</span><button type="button" class="htk-btn htk-xs" :disabled="plannerReadOnly" @click="restoreTodo(lastArchivedTodoId)">{{plannerCopy.restore}}</button></div>
	  </Teleport>
	  <HataskTodoPlanner
	    :embedded="embedded"
	    :colorMode="themeMode"
	    :theme="plannerTheme"
	    :view="plannerTodoView"
	    :items="plannerTodoItems"
	    :labels="plannerTodoLabels"
	    :filters="plannerTodoFilters"
	    :searchQuery="plannerTodoSearch"
	    :viewCounts="plannerTodoViewCounts"
	    :mobileTabOrder="plannerTodoMobileTabOrder"
	    :sort="currentTodoSort"
	    :completionIds="todoCompletionIds"
	    :loading="plannerStorageState==='loading'"
	    :readOnly="plannerReadOnly"
	    @update:view="plannerTodoView=$event"
	    @update:searchQuery="plannerTodoSearch=$event"
	    @update:sort="setPlannerTodoSort"
	    @update:mobileTabOrder="setPlannerTodoMobileTabOrder"
	    @toggle-filter="togglePlannerTodoFilter"
	    @complete="completePlannerTodo"
	    @move-up="movePlannerTodo($event,-1)"
	    @move-down="movePlannerTodo($event,1)"
	    @edit="editPlannerTodo"
	    @archive="archivePlannerTodo"
	    @restore="restorePlannerTodo"
	    @delete="deletePlannerTodo"
	    @add-folder="openFolderManager"
	    @manage-folder="managePlannerFolder"
	    @drop-target="handleTodoDropTarget"
	    @bulk-action="handleTodoBulkAction"
	    @captureTarget="todoInlineCaptureTarget=$event"
	  >
	    <template #templates>
	      <HataskTemplateLibrary
    :theme="plannerTheme"
										:templates="plannerTemplates.filter(template => template.kind !== 'members')"
	        :kind="templateKindFilter"
	        :labels="plannerTemplateLabels"
	        :readOnly="plannerReadOnly"
	        @update:kind="templateKindFilter=$event"
	        @use="usePlannerTemplate"
	        @duplicate="duplicatePlannerTemplate"
	        @archive="archivePlannerTemplate"
	        @move="movePlannerTemplate"
	      />
	    </template>
	  </HataskTodoPlanner>
	</div>
</div>

					</Teleport>
<!-- ========== NOTIFICATIONS ========== -->

<!-- ========== MOOD / MEAL: 切替でも入力中の記録を保持する ========== -->
					<Teleport :to="captureDestination" :disabled="captureKind !== 'mood'">
						<div v-show="activeTab==='mood' || captureKind === 'mood'" class="htk-tabpage htk-journal-page" :class="tabDir==='fwd'?'htk-tab-fwd':'htk-tab-back'">
  <HataskJournal
    ref="akatsukiMoodJournal"
    :theme="plannerTheme"
    kind="mood"
    :entries="moodJournalRows"
    :writable="journalWritable('moods')"
    :loading="!dataLoaded"
								:active="captureKind === 'mood' || (activeTab==='mood' && paneActive)"
    :motion="embedded || (settings.animations!==false && prefer.r.animation.value)"
    :captureOnly="captureKind === 'mood'"
    :showCaptureHint="!embedded"
    :save="saveMoodEntry"
    :remove="deleteMoodEntry"
    @info="showMoodDisclaimer=true"
    @reminders="openHataskSettings('moodReminder')"
  />
</div>

					</Teleport>
					<Teleport :to="captureDestination" :disabled="captureKind !== 'meal'">
						<div v-show="activeTab==='meal' || captureKind === 'meal'" class="htk-tabpage htk-journal-page" :class="tabDir==='fwd'?'htk-tab-fwd':'htk-tab-back'">
  <HataskJournal
    ref="akatsukiMealJournal"
    kind="meal"
    :theme="plannerTheme"
    :entries="mealJournalRows"
    :writable="journalWritable('meals')"
    :loading="!dataLoaded"
								:active="captureKind === 'meal' || (activeTab==='meal' && paneActive)"
    :motion="embedded || (settings.animations!==false && prefer.r.animation.value)"
    :captureOnly="captureKind === 'meal'"
    :showCaptureHint="!embedded"
    :templates="mealTemplates"
    :templatesWritable="journalWritable(HATASK_MEAL_TEMPLATE_KEY)"
    :summary="mealSummaryMessage"
    :showSummary="settings.showMealSummary!==false"
    :save="saveMealEntry"
    :remove="deleteMealEntry"
    :storeTemplate="saveMealTemplate"
    :removeTemplate="deleteMealTemplate"
    @info="showMealDisclaimer=true"
  />
</div>

<!-- ========== GARDEN ========== -->
					</Teleport>
					<Teleport :to="captureDestination" :disabled="captureKind !== 'garden'">
						<div v-if="activeTab==='garden' || captureKind === 'garden'" class="htk-tabpage htk-garden-page htk-panels" data-garden-layout="streams">
  <HataskFlowerCare :todos="todos" :folders="folders" :animations="flowerAnimations" :theme="plannerTheme" :mode="themeMode" :readOnly="plannerReadOnly" :completeTodo="completeGardenTodo" @state="applyFlowerState" @harvested="onFlowerHarvested" @hatady="routeRouter.push('/hatady')"/>
  <section class="htk-lg htk-anim htk-seasonal-tree-panel" data-garden-group="seasonal-tree"><div class="htk-gc">
    <header class="htk-flower-heading"><div><h3 class="htk-sec-title">{{seasonalTreeCopy.title}}</h3><p class="htk-flower-summary">{{seasonalTreeCopy.description}}</p></div></header>
    <div class="htk-seasonal-tree-scene"><SeasonalTreeScene :animated="flowerAnimations" :windStrength="60" :showCaption="true"/></div>
  </div></section>
  <div class="htk-garden-collections">
    <section v-if="flowerState?.zukan.archivedEntries?.length" class="htk-lg htk-anim" data-garden-group="imported-flowers"><div class="htk-gc">
      <header class="htk-flower-heading"><div><h3 class="htk-sec-title">{{ i18n.ts._hata._hatask._records.archiveTitle }}</h3><p class="htk-flower-summary">{{ i18n.ts._hata._hatask._records.archiveDescription }}</p></div></header>
      <ul class="htk-record-archive-list">
        <li v-for="entry in flowerState.zukan.archivedEntries.slice(0, archiveVisibleCount)" :key="entry.id">
          <details><summary><HataskEmoji :emoji="entry.emoji"/> {{ entry.nickname || entry.name }} <time :datetime="entry.harvestedAt">{{ entry.harvestedAt.slice(0, 10) }}</time></summary>
            <dl><div><dt>{{ i18n.ts._hata._hatask._records.archiveName }}</dt><dd>{{ entry.name }}</dd></div>
            <div><dt>{{ i18n.ts._hata._hatask._records.archiveMeaning }}</dt><dd>{{ entry.hanakotoba }}</dd></div>
            <div><dt>{{ i18n.ts._hata._hatask._records.archiveMemory }}</dt><dd>{{ entry.memory?.join('、') || '—' }}</dd></div></dl>
          </details>
        </li>
      </ul>
      <button v-if="flowerState.zukan.archivedEntries.length > archiveVisibleCount" type="button" class="htk-btn htk-xs" @click="archiveVisibleCount += 100">{{ i18n.ts._hata._hatask._records.archiveMore }}</button>
    </div></section>
    <section class="htk-lg htk-anim" data-garden-group="community"><div class="htk-gc">
      <header class="htk-flower-heading"><div><h3 class="htk-sec-title">{{copy.communityFlowerGallery}}</h3><p class="htk-flower-summary">{{copyx.flowerCount({count:communityFlowerTotal.toString()})}} · {{seasonFlowerLabel}}</p></div><button type="button" class="htk-flower-icon-button" data-flower-collection-button="community" :aria-label="flowerCollectionLabel('community')" :title="flowerCollectionLabel('community')" aria-haspopup="dialog" :aria-expanded="flowerCollectionKind==='community'" @click="openFlowerCollection('community', $event)"><i class="ti ti-layout-grid" aria-hidden="true"></i></button><button type="button" class="htk-flower-icon-button" :aria-label="flowerPauseLabel('community')" :title="flowerPauseLabel('community')" :aria-pressed="flowerStreamPaused.community" :disabled="!flowerAnimations" @click="toggleFlowerStream('community')"><i :class="flowerStreamPaused.community?'ti ti-player-play':'ti ti-player-pause'" aria-hidden="true"></i></button></header>
      <div v-if="communityFlowersLoading" class="htk-gal-state" role="status"><i class="ti ti-loader-2" aria-hidden="true"></i>{{copy.flowerGalleryLoading}}</div>
      <div v-else-if="communityFlowersError" class="htk-gal-state htk-gal-error" role="alert">{{copy.flowerGalleryLoadFailed}}<button type="button" class="htk-btn htk-xs" @click="loadCommunityFlowers">{{copy.retry}}</button></div>
      <HataskFlowerStream v-else-if="communityFlowerViews.length" ref="communityFlowerStream" :items="communityFlowerViews" :label="copy.communityFlowerGallery" :rareLabel="copy.rareFlower" :harvestedLabel="copy.flowerHarvestedAt" :animations="flowerAnimations" :paused="flowerStreamPaused.community || flowerDialogOpen || flowerCollectionOpen" @select="selection=>openFlowerDetail('community',selection)"/>
      <div v-else class="htk-gal-state">{{copy.flowerGalleryEmpty}}</div>
    </div></section>
    <section class="htk-lg htk-anim" data-garden-group="personal"><div class="htk-gc">
      <header class="htk-flower-heading"><div><h3 class="htk-sec-title">{{copy.flowerGallery}}</h3><p class="htk-flower-summary">{{copyx.flowerCount({count:gallery.length.toString()})}} · {{flowerVisibilityLabel}}</p></div><button type="button" class="htk-flower-icon-button" data-flower-collection-button="personal" :aria-label="flowerCollectionLabel('personal')" :title="flowerCollectionLabel('personal')" aria-haspopup="dialog" :aria-expanded="flowerCollectionKind==='personal'" @click="openFlowerCollection('personal', $event)"><i class="ti ti-layout-grid" aria-hidden="true"></i></button><button type="button" class="htk-flower-icon-button" :aria-label="flowerPauseLabel('personal')" :title="flowerPauseLabel('personal')" :aria-pressed="flowerStreamPaused.personal" :disabled="!flowerAnimations" @click="toggleFlowerStream('personal')"><i :class="flowerStreamPaused.personal?'ti ti-player-play':'ti ti-player-pause'" aria-hidden="true"></i></button><details class="htk-flower-visibility"><summary :aria-label="copy.flowerGalleryVisibility" :title="copy.flowerGalleryVisibility"><i class="ti ti-eye" aria-hidden="true"></i></summary><div class="htk-flower-visibility-panel"><label><span>{{copy.flowerGalleryVisibility}}</span><select :value="flowerVisibility" :disabled="flowerVisibilitySaving || !dataLoaded" @change="changeFlowerVisibility"><option v-for="option in flowerVisibilityOptions" :key="option.value" :value="option.value">{{option.label}}</option></select></label><p>{{copy.flowerGalleryDescription}}</p><p>{{copy.flowerGalleryVisibilityHelp}}</p></div></details></header>
      <HataskFlowerStream v-if="personalFlowerViews.length" ref="personalFlowerStream" :items="personalFlowerViews" :showOwnerName="false" :label="copy.flowerGallery" :rareLabel="copy.rareFlower" :harvestedLabel="copy.flowerHarvestedAt" :animations="flowerAnimations" :paused="flowerStreamPaused.personal || flowerDialogOpen || flowerCollectionOpen" @select="selection=>openFlowerDetail('personal',selection)"/>
      <div v-else class="htk-gal-state">{{copy.noFlowersYet}}</div>
    </div></section>
  </div>
  <section class="htk-lg htk-anim htk-community-garden" data-garden-group="bed"><div class="htk-gc">
    <header class="htk-flower-heading"><div><h3 class="htk-sec-title">{{copy.communityGarden}}</h3><p class="htk-flower-summary">{{copy.communityFlowerActivity}} · {{copyx.flowerCount({count:communityFlowerViews.length.toString()})}}</p></div><button type="button" class="htk-flower-icon-button" :aria-label="flowerPauseLabel('activity')" :title="flowerPauseLabel('activity')" :aria-pressed="flowerStreamPaused.activity" :disabled="!flowerAnimations" @click="toggleFlowerStream('activity')"><i :class="flowerStreamPaused.activity?'ti ti-player-play':'ti ti-player-pause'" aria-hidden="true"></i></button></header>
    <div v-if="communityFlowersLoading" class="htk-gal-state" role="status">{{copy.flowerGalleryLoading}}</div>
    <div v-else-if="communityFlowersError" class="htk-gal-state htk-gal-error" role="alert">{{copy.flowerGalleryLoadFailed}}<button type="button" class="htk-btn htk-xs" @click="loadCommunityFlowers">{{copy.retry}}</button></div>
    <HataskFlowerFestival v-if="flowerState" :festival="flowerState.festival" :animations="flowerAnimations"/>
    <HataskCommunityGarden v-if="!communityFlowersLoading && !communityFlowersError" :season="flowerState?.festival.season" :animations="flowerAnimations" :flowers="communityFlowerViews" :selectedId="selectedCommunityFlowerId" :label="copy.communityGarden" :theme="plannerTheme" :mode="themeMode">
      <HataskFlowerStream v-if="communityFlowerViews.length" ref="activityFlowerStream" :items="communityFlowerViews" activity :label="copy.communityFlowerActivity" :rareLabel="copy.rareFlower" :harvestedLabel="copy.flowerHarvestedAt" :animations="flowerAnimations" :paused="flowerStreamPaused.activity || flowerDialogOpen || flowerCollectionOpen" @select="selection=>openFlowerDetail('activity',selection)"/>
      <p v-else class="htk-gal-state">{{copy.flowerGalleryEmpty}}</p>
    </HataskCommunityGarden>
  </div></section>
</div>

<!-- ========== END TAB PAGES ========== -->
					</Teleport>
</HataskAkatsukiLayout>
</div><!-- /htk-shell -->
</div><!-- /htk-app -->

<!-- 旗鯖fork(#37): 設定モーダルは HataskSettings.vue に統合(openHataskSettings()でpopup) -->

<!-- MOOD DISCLAIMER MODAL -->
<Teleport to="body"><div v-if="showMoodDisclaimer && (!embedded || paneActive || captureKind !== null)" class="htk-modal-ov" :data-theme="plannerTheme" :data-mode="themeMode" @click.self="showMoodDisclaimer=false"><div class="htk-lg htk-modal-c"><div class="htk-gc" style="padding:28px"><div style="text-align:center;font-size:2rem;margin-bottom:8px;text-shadow:none">ⓘ</div><div style="text-align:center;font-size:.92rem;font-weight:700;margin-bottom:10px">{{copy.aboutMoodRecords}}</div><div class="htk-popup-b">{{copy.moodDisclaimerIntro}}<br><br>{{copy.moodDisclaimerMedicalPrefix}}<strong>{{copy.moodDisclaimerMedicalStrong}}</strong><br><br>{{copy.moodDisclaimerConsult}}</div><div style="text-align:center;margin-top:14px"><button class="htk-btn htk-primary" @click="showMoodDisclaimer=false">{{copy.accept}}</button></div></div></div></div></Teleport>
<Teleport to="body"><div v-if="showMealDisclaimer && (!embedded || paneActive || captureKind !== null)" class="htk-modal-ov" :data-theme="plannerTheme" :data-mode="themeMode" @click.self="ackMealDisclaimer"><div class="htk-lg htk-modal-c"><div class="htk-gc" style="padding:28px"><div style="text-align:center;font-size:2rem;margin-bottom:8px;text-shadow:none">ⓘ</div><div style="text-align:center;font-size:.92rem;font-weight:700;margin-bottom:10px">{{copy.aboutMealRecords}}</div><div class="htk-popup-b">{{mealDisclaimerText}}</div><div style="text-align:center;margin-top:14px"><button class="htk-btn htk-primary" @click="ackMealDisclaimer">{{copy.accept}}</button></div></div></div></div></Teleport>

<!-- FLOWER INFO MODAL -->
<Teleport to="body"><div v-if="showFlowerInfo && (!embedded || paneActive || captureKind !== null)" class="htk-modal-ov" :data-theme="plannerTheme" :data-mode="themeMode" @click.self="showFlowerInfo=false"><div class="htk-lg htk-modal-c htk-flower-info"><div class="htk-gc" style="padding:28px"><div style="text-align:center;font-size:2rem;margin-bottom:8px;text-shadow:none;color:var(--accent)"><i class="ti ti-plant-2"></i></div><div style="text-align:center;font-size:.92rem;font-weight:700;margin-bottom:10px">{{copy.howToGrowFlowers}}</div><div class="htk-popup-b">{{copy.flowerInfoGrowth}}<br><br>{{copy.flowerInfoTime}}<br><br>{{copy.flowerInfoNaming}}<br><br>{{copy.flowerInfoVariety}}</div><div style="text-align:center;margin-top:14px"><button class="htk-btn htk-primary" @click="showFlowerInfo=false">{{copy.understoodExcited}}</button></div></div></div></div></Teleport>

<!-- 旗鯖fork(v2 §14): テーマ選択(設計 .tpickwrap を忠実移植)。picker自身の light/dark トグルを持つ。 -->
<Teleport to="body"><div v-if="showTutTheme && (!embedded || paneActive || captureKind !== null)" class="htk-tut-ov htk-tpick-ov">
  <div class="tpickwrap" :data-mode="themeMode">
    <div class="tpick-cap">{{copy.welcomeTo}}</div>
    <div class="tpick-logo"><HataAppLogo app="hatask" :size="36" :monochrome="themeMode === 'dark'"/><HataAppWordmark app="hatask" :onDark="themeMode === 'dark'"/></div>
    <div class="tpick-sub">{{copy.chooseAppearance}}<br><span class="tpick-sub2">{{copy.changeAppearanceLater}}</span></div>
    <div class="tpick-seg">
      <button :class="[themeMode!=='dark'&&'on']" @click="setTutMode(false)"><i class="ti ti-sun"></i>{{copy.light}}</button>
      <button :class="[themeMode==='dark'&&'on']" @click="setTutMode(true)"><i class="ti ti-moon"></i>{{copy.dark}}</button>
    </div>
    <div class="tpick-grid">
      <button v-for="t in tutThemes" :key="t.id" :class="['tp-card',(settings.theme||'akatsuki')===t.id&&'sel']" @click="pickTutTheme(t.id)">
        <HataskThemePreview :theme="t.id" :mode="themeMode"/>
        <div class="tp-name">{{t.jp}}<i class="tp-check ti ti-check"></i></div>
        <div class="tp-desc">{{t.desc}}</div>
      </button>
    </div>
    <button class="tpick-go htk-theme-action" :data-theme="plannerTheme" :data-mode="themeMode" @click="startTutFromTheme"><i class="ti ti-arrow-right"></i> {{copy.startWithTheme}}</button>
    <div class="tpick-note">{{copy.tutorialUsesTheme}}</div>
  </div>
</div></Teleport>

<!-- TUTORIAL OVERLAY -->
<Teleport to="body"><div v-if="showTutorial && (!embedded || paneActive || captureKind !== null)" class="htk-tut-ov" :data-theme="plannerTheme" :data-mode="themeMode">
  <!-- Step 0: Welcome (full-screen) -->
  <div v-if="tutStep===0" class="htk-tut-center" @click.self="skipTutorial">
    <div class="htk-tut-welcome">
      <div class="htk-tut-particles"><span v-for="i in 12" :key="i" :style="{animationDelay:i*0.3+'s',left:Math.random()*100+'%',top:Math.random()*100+'%'}"></span></div>
      <div class="htk-tut-hero-emoji"><i class="ti ti-sparkles"></i></div>
      <div class="htk-tut-catch">{{copy.tutorialCatch}}</div>
      <div class="htk-tut-appname">Hatask</div>
      <div class="htk-tut-sub">{{copy.tutorialIntro}}<br><span style="font-size:.72rem;opacity:.6">{{copy.tutorialStepByStep}}</span></div>
      <div class="htk-tut-btns"><button class="htk-tut-btn htk-tut-btn-p" @click="startSpotlightTutorial">{{copy.start}} <i class="ti ti-rocket"></i></button><button class="htk-tut-btn htk-tut-btn-s" @click="skipTutorial">{{copy.skip}}</button></div>
      <div class="htk-tut-dots"><span v-for="i in tutTotalSteps" :key="i" :class="['htk-tut-dot',tutStep===i-1&&'on']"></span></div>
    </div>
  </div>

  <!-- Step 1+: Spotlight mode -->
  <template v-if="tutStep>0">
    <!-- 4-panel dark overlay (top, bottom, left, right around spotlight hole) -->
    <div class="htk-spot-top" :style="{height:spotRect.y+'px'}" @click="nextSpotlightStep"></div>
    <div class="htk-spot-bottom" :style="{top:(spotRect.y+spotRect.h)+'px'}" @click="nextSpotlightStep"></div>
    <div class="htk-spot-left" :style="{top:spotRect.y+'px',height:spotRect.h+'px',width:spotRect.x+'px'}" @click="nextSpotlightStep"></div>
    <div class="htk-spot-right" :style="{top:spotRect.y+'px',height:spotRect.h+'px',left:(spotRect.x+spotRect.w)+'px'}" @click="nextSpotlightStep"></div>
    <!-- Highlight ring -->
    <div class="htk-spot-ring" :style="{left:(spotRect.x-4)+'px',top:(spotRect.y-4)+'px',width:(spotRect.w+8)+'px',height:(spotRect.h+8)+'px'}"></div>
    <!-- Tooltip card (always visible, positioned relative to spotlight) -->
    <div class="htk-spot-tip" :key="'tip'+tutStep" :style="tipPosition" :class="['htk-spot-tip-'+tipSide]">
      <div class="htk-spot-tip-arrow"></div>
      <div class="htk-spot-tip-header">
        <span class="htk-spot-tip-emoji"><i :class="tutSteps[tutStep]?.emoji"></i></span>
        <span class="htk-spot-tip-title">{{tutSteps[tutStep]?.title}}</span>
        <span class="htk-spot-tip-badge">{{tutStep}}/{{tutTotalSteps-1}}</span>
      </div>
      <div class="htk-spot-tip-body">{{tutSteps[tutStep]?.body}}</div>
      <div v-if="tutSteps[tutStep]?.tips" class="htk-spot-tip-extra">
        <div v-for="(tip,ti) in tutSteps[tutStep].tips" :key="ti" class="htk-spot-tip-row">
          <span class="htk-spot-tip-bullet"><i :class="tip.icon"></i></span>
          <span>{{tip.text}}</span>
        </div>
      </div>
      <div class="htk-spot-tip-nav">
        <button v-if="tutStep>1" class="htk-tut-btn htk-tut-btn-s htk-tut-btn-xs" @click="prevSpotlightStep">← {{copy.back}}</button>
        <div class="htk-spot-tip-progress"><div class="htk-spot-tip-bar" :style="{width:(tutStep/(tutTotalSteps-1))*100+'%'}"></div></div>
        <button v-if="tutStep<tutTotalSteps-1" class="htk-tut-btn htk-tut-btn-p htk-tut-btn-xs" @click="nextSpotlightStep">{{copy.next}} →</button>
        <button v-else class="htk-tut-btn htk-tut-btn-finish htk-tut-btn-xs" @click="finishTutorial">{{copy.complete}} <i class="ti ti-confetti"></i></button>
      </div>
      <button class="htk-tut-skip" @click="skipTutorial">{{copy.skip}}</button>
    </div>
  </template>
</div></Teleport>

</div>
</component>
<Teleport to="body">
	<HataskEventDetailsDialog
		class="htk-event-details-theme"
		:data-theme="plannerTheme"
		:data-mode="themeMode"
		:isOpen="viewingEvent !== null"
		:active="!embedded || paneActive"
		:event="viewingEventDetails"
		:labels="eventViewLabels"
		:readOnly="plannerReadOnly"
		:busy="eventViewBusy || (viewingEventDetails !== null && isRsvpSaving(viewingEventDetails.id))"
		:returnFocusTo="eventViewReturnFocus"
		:getAnchor="getEventDetailAnchor"
		:animations="settings.animations !== false"
		@close="closeEventDetail"
		@edit="editViewedEvent"
		@delete="deleteViewedEvent"
		@rsvp="respondToViewedEvent"
		@closeRsvp="closeViewedEventRsvp"
		@focusFallback="focusEventCalendar"
	/>
	<HataskCalendarBlankDialog
		class="htk-event-details-theme"
		:data-theme="plannerTheme"
		:data-mode="themeMode"
		:isOpen="blankCalendarTarget !== null"
		:active="!embedded || paneActive"
		:targetLabel="blankCalendarTargetLabel"
		:events="blankCalendarEvents"
		:labels="blankCalendarLabels"
		:detailLabels="eventViewLabels"
		:readOnly="plannerReadOnly"
		:busy="blankCalendarBusy"
		:error="blankCalendarError"
		:returnFocusTo="blankCalendarReturnFocus"
		:getAnchor="getBlankCalendarAnchor"
		:getAnchorRect="getBlankCalendarAnchorRect"
		:animations="settings.animations !== false"
		@create="createBlankCalendarEvent"
		@confirm="confirmBlankCalendarReschedule"
		@close="closeBlankCalendarActions"
		@focusFallback="focusEventCalendar"
	/>
</Teleport>
</template>

<script lang="ts" setup>
import { ref, shallowRef, computed, inject, onMounted, onUnmounted, onBeforeUnmount, onActivated, onDeactivated, nextTick, watch, defineAsyncComponent } from 'vue';
import { registerHataskRecordSync } from '@/utility/hatask-record-transfer.js';
import PageWithHeader from '@/components/global/PageWithHeader.vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import { useHataMascotSuppression } from '@/utility/hata-mascot-suppression.js';
import type * as Misskey from 'cherrypick-js';
import type { HataskGrowingFlower } from '@/utility/hatask-flower-growth.js';
import type { HataskEventDetails, HataskEventDetailsLabels } from '@/components/hatask/hatask-event-details-types.js';
import type { HataskCalendarBlankEvent, HataskCalendarBlankLabels } from '@/components/hatask/HataskCalendarBlankDialog.vue';
import type { HataskSearchGroup } from '@/components/hatask/HataskSearchResults.vue';
import { definePage } from '@/page.js';
import * as os from '@/os.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { useHataGoesPopup, useHataGoesPopupMenu } from '@/utility/hatagoes-popup.js';
import { claimAchievement } from '@/utility/achievements.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { createHatadyCookingReturnPrompt } from '@/utility/hatady-cooking-return.js';
import { $i } from '@/i.js';
import { useRouter } from '@/router.js';
import { DI } from '@/di.js';
import { useStream } from '@/stream.js';
import { useGlobalEvent } from '@/events.js';
import { mutedUsersRevision } from '@/utility/muted-users.js';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { store } from '@/store.js';
import { versatileLang } from '@/utility/intl-const.js';
import MkEarthquakeTicker from '@/components/MkEarthquakeTicker.vue';
import HataFeedNotificationBody from '@/components/HataFeedNotificationBody.vue';
import HataskEmoji from '@/components/HataskEmoji.vue';
import HataskFlowerStream from '@/components/hatask/HataskFlowerStream.vue';
import HataskFlowerCare from '@/components/hatask/HataskFlowerCare.vue';
import HataskFlowerFestival from '@/components/hatask/HataskFlowerFestival.vue';
import { HATASK_FLOWER_STATE_EVENT, getHataskFlowerState, refreshHataskFlowerStateAfterUpdate, renameHataskFlower, hataskDropRewardMessage, pourHataskFlower } from '@/utility/hatask-flower-v2.js';
import { enqueuePageStatusToast } from '@/utility/hataskey-notification-toast.js';
import type { HataskFlowerState } from '@/utility/hatask-flower-v2.js';
import HataskCommunityGarden from '@/components/hatask/HataskCommunityGarden.vue';
import HataskFlowerDetail from '@/components/hatask/HataskFlowerDetail.vue';
import HataskFlowerCollection from '@/components/hatask/HataskFlowerCollection.vue';
import HataskRanking from '@/components/hatask/HataskRanking.vue';
import HataskSupport from '@/components/hatask/HataskSupport.vue';
import HataskRecipe from '@/components/hatask/HataskRecipe.vue';
import HataskRecordReview from '@/components/hatask/HataskRecordReview.vue';
import type { HataskFlowerView, HataskFlowerSelection } from '@/components/hatask/hatask-flower-view.js';
import HataskCalendarPlanner from '@/components/hatask/HataskCalendarPlanner.vue';
import { normalizeHataskTodoMobileTabs } from '@/utility/hatask-todo-tabs.js';
import HataskEventMoveDialog from '@/components/hatask/HataskEventMoveDialog.vue';
import HataskEventDetailsDialog from '@/components/hatask/HataskEventDetailsDialog.vue';
import HataskCalendarBlankDialog from '@/components/hatask/HataskCalendarBlankDialog.vue';
import { getHataskDaylightStyle } from '@/utility/hatask-daylight.js';
import type { HataskEventMoveDialogLabels } from '@/components/hatask/HataskEventMoveDialog.vue';
import HataskTodoPlanner from '@/components/hatask/HataskTodoPlanner.vue';
import HataskThemePreview from '@/components/hatask/HataskThemePreview.vue';
import HataskAkatsukiLayout from '@/components/hatask/HataskAkatsukiLayout.vue';
import HataAppLogo from '@/components/HataAppLogo.vue';
import HataFeatureIcon from '@/components/HataFeatureIcon.vue';
import { hataFeatureForScreen } from '@/utility/hata-feature-icon.js';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
import HataskAkatsukiApps from '@/components/hatask/HataskAkatsukiApps.vue';
import type { HataskAkatsukiAction, HataskAkatsukiFavoriteId, HataskAkatsukiTab } from '@/components/hatask/hatask-akatsuki-types.js';
import { buildHataskAkatsukiModel } from '@/utility/hatask-akatsuki.js';
import { normalizeHataskAkatsukiFavorites } from '@/utility/hatask-akatsuki-favorites.js';
import { readAkatsukiUsage, recordAkatsukiUsage } from '@/utility/hatask-akatsuki-usage.js';
import HataskQuickCapture from '@/components/hatask/HataskQuickCapture.vue';
import HataskJournal from '@/components/hatask/HataskJournal.vue';
import { HATASK_MEAL_TEMPLATE_KEY, isJournalEntry, journalLocalDateTime, persistJournalChange } from '@/utility/hatask-journal.js';
import type { HataskJournalChange, HataskJournalEntry, HataskMealTemplate } from '@/utility/hatask-journal.js';
import type { HataskCaptureChip, HataskCaptureTool } from '@/components/hatask/HataskQuickCapture.vue';
import HataskTemplateLibrary from '@/components/hatask/HataskTemplateLibrary.vue';
import HataskSearchResults from '@/components/hatask/HataskSearchResults.vue';
import HataskEventMembers from '@/components/hatask/HataskEventMembers.vue';
import { isSharedHataskEvent, hataskEventVisibilityLabel, hataskEventVisibilityIcon } from '@/utility/hatask-event-audience.js';
import type { HataskTemplateKindFilter, HataskTemplateLabels } from '@/components/hatask/HataskTemplateLibrary.vue';
import type { HataskCalendarBlankTarget, HataskCalendarDay, HataskCalendarEvent, HataskCalendarLabels, HataskCalendarView, HataskCalendarWeekday, HataskPlannerFilter, HataskPlannerTheme, HataskTodoItem, HataskTodoLabels, HataskTodoMobileTab, HataskTodoSort, HataskTodoView } from '@/components/hatask/hatask-planner-types.js';
import { getHataskHatakyuStyle } from '@/utility/hatask-theme.js';
import { getDefaultPhrase, getPhrase } from '@/utility/hatask-phrases.js';
import { findHataskFlora, getHataskFlowerSeason, isRareHataskFlower, pickRandomFlora, generateFlowerName, localizeFloraName, localizeHanakotoba } from '@/utility/hatask-flora.js';
import { HATASK_FLOWER_GROWTH_EVENT, createHataskGrowingFlower, normalizeHataskGrowingFlower, seedHataskFlowerGrowth } from '@/utility/hatask-flower-growth.js';
import { notificationDisplayMessage, type HataFeedNotif } from '@/utility/hatafeed.js';
import { createHataskPlannerApiStoragePort } from '@/utility/hatask-planner-api.js';
import { HATASK_PLANNER_COLLECTION_KEYS, HATASK_PLANNER_SCOPE, migrateHataskPlannerStorage } from '@/utility/hatask-planner-storage.js';
import type { HataskPlannerCollectionKey, HataskPlannerEvent, HataskPlannerFolder, HataskPlannerRevision, HataskPlannerTemplate, HataskPlannerTodo, HataskRecurrenceFrequency } from '@/utility/hatask-planner-storage.js';
import { normalizeHataskPlannerTemplates } from '@/utility/hatask-planner-templates.js';
import { parseHataskCapture } from '@/utility/hatask-capture-parser.js';
import { expandHataskEventOccurrences } from '@/utility/hatask-planner-recurrence.js';
import { completeHataskTodos } from '@/utility/hatask-todo-completion.js';
import { hatakMascotActive } from '@/utility/mascot-store.js';

const popup = useHataGoesPopup();
const dialogs = useHataGoesDialogs();
const popupMenu = useHataGoesPopupMenu();
const copy = i18n.ts._hata._hatask._main;
const SeasonalTreeScene = defineAsyncComponent(() => import('@/components/MkSeasonalTree.vue'));
const seasonalTreeCopy = i18n.ts._hata._seasonalTree;
const copyx = i18n.tsx._hata._hatask._main;
const plannerCopy = i18n.ts._hata._hatask._planner;
const plannerCopyx = i18n.tsx._hata._hatask._planner;
const props = withDefaults(defineProps<{ embedded?: boolean; requestedTab?: string; paneActive?: boolean }>(), { embedded: false, requestedTab: undefined, paneActive: true });
const emit = defineEmits<{ exit: []; tabChange: [tab: string]; appearanceChange: [appearance: { theme: string; cssVars?: Record<string, string> }] }>();
const hataGoesHost = inject(HATA_GOES_HOST, null);
useHataMascotSuppression(computed(() => !props.embedded || props.paneActive));
const showGoesLauncher = computed(() => props.embedded && !!hataGoesHost);
const goesHataskLauncherApps = computed(() => hataGoesHost?.launcherApps?.value.filter(app => app.app === 'hatask').slice(0, 12) ?? []);
const captureKind = ref<'cal' | 'todo' | 'mood' | 'meal' | 'recipe' | 'garden' | null>(null);
const captureTarget = ref<HTMLElement | null>(null);
const calendarInlineCaptureTarget = shallowRef<HTMLElement>();
const todoInlineCaptureTarget = shallowRef<HTMLElement>();
const externalCaptureTarget = shallowRef<HTMLElement>();
const captureDestination = computed(() => externalCaptureTarget.value ?? captureTarget.value ?? 'body');
const captureCloseButton = ref<HTMLButtonElement | null>(null);
let captureReturnFocus: HTMLElement | null = null;
let captureOriginTab = 'home';
const inPageWindow = inject<boolean>('inWindow', false);
const closePageWindow = inject(DI.pageWindowClose, null);
const emotionCopy = (i18n.ts._hata as unknown as { _emotionAnalysis: { title: string } })._emotionAnalysis;
const _getPhrase = (ctx?: any): string => { try { return getPhrase(ctx); } catch { return getDefaultPhrase(); } };
definePage(()=>({title:'Hatask',icon:'ti ti-checklist',hataApp:'hatask'}));
const SCOPE=['client','hatask'];
const canReviewRecords = computed(() => !!$i && ($i.isAdmin || $i.isModerator));
const recordReview = ref<InstanceType<typeof HataskRecordReview>>();
const recipeView = ref<InstanceType<typeof HataskRecipe>>();
// 調理中のタイマーや入力途中の記録を保つため、一度開いたレシピ画面はタブを離れても破棄しない。
const recipeMounted = ref(false);
const tabs=computed(() => [{id:'home',icon:'ti ti-home',label:copy.tabHome},{id:'cal',icon:'ti ti-calendar',label:copy.tabCalendar},{id:'todo',icon:'ti ti-checkbox',label:'ToDo'},{id:'mood',icon:'ti ti-mood-smile',label:copy.tabMood},{id:'meal',icon:'ti ti-bowl',label:copy.tabMeal},{ id: 'recipe', icon: 'ti ti-chef-hat', label: i18n.ts._hata._hatask._akatsuki.recipeTab },{id:'garden',icon:'ti ti-flower',label:copy.tabGarden}, { id: 'support', icon: 'ti ti-heart-handshake', label: i18n.ts._hata._hatask._akatsuki.supportTab }, { id: 'ranking', icon: 'ti ti-trophy', label: i18n.ts._hata._hatask._ranking.title }, ...(canReviewRecords.value ? [{ id: 'review', icon: 'ti ti-shield-search', label: i18n.ts._hata._hatask._akatsuki.reviewTab }] : [])]);
// 旗鯖fork(v2 §16②): タブ切替の方向(配列上の左右関係に追従)。※watchはactiveTab宣言後に登録(下記)。
const tabDir=ref<'fwd'|'back'>('fwd');
const showMobileNav=ref(true);
// 旗鯖fork(v2): きもち5段階は Tabler アイコンに統一(§05)。
const moodIcons:Record<number,string>={1:'ti ti-mood-cry',2:'ti ti-mood-sad',3:'ti ti-mood-neutral',4:'ti ti-mood-smile',5:'ti ti-mood-heart'};
// ===== 食事記録(meal) 定数。医療目的ではない自己記録メモ。数値評価・カロリー計算はしない =====
const mealDisclaimerText=computed(() => copy.mealDisclaimerFull);
const eventColors=['#e27d60','#85cdca','#e8a87c','#c38d9e','#7bc67e','#f0c75e','#6cb4ee'];
const eventEmojis=['⭐','💼','🎮','🔧','📚','🎂','✈️','🎨','🏃','🎤'];
const notifyTimings=['15分前','30分前','1時間前','1日前'];
// Flora data now in hatask-flora.ts

const notifyTimingLabels: Record<string, () => string> = {
	'15分前': () => copy.notify15MinutesBefore,
	'30分前': () => copy.notify30MinutesBefore,
	'1時間前': () => copy.notify1HourBefore,
	'1日前': () => copy.notify1DayBefore,
};

function notifyTimingLabel(value: string): string { return notifyTimingLabels[value]?.() ?? value; }

function moodNoteLabel(value: string): string { return value === '（ひとことなし）' ? copy.noMoodNote : value; }

function parseIsoDate(value: string): Date {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
}

function localDateKey(date = new Date()): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const yearMonthFormatter = new Intl.DateTimeFormat(versatileLang, { year: 'numeric', month: 'long' });
const longDateFormatter = new Intl.DateTimeFormat(versatileLang, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
const monthDayFormatter = new Intl.DateTimeFormat(versatileLang, { month: 'short', day: 'numeric' });
const weekdayLongFormatter = new Intl.DateTimeFormat(versatileLang, { weekday: 'long' });
const weekdayShortFormatter = new Intl.DateTimeFormat(versatileLang, { weekday: 'short' });

const dataLoaded = ref(false);
const loadedKeys = new Set<string>();
const plannerRevisions: Record<HataskPlannerCollectionKey, HataskPlannerRevision> = { todos: null, folders: null, events: null };
const plannerStoragePort = createHataskPlannerApiStoragePort((endpoint, params) => misskeyApi(endpoint as never, params as never), rewards => {
	for (const reward of Object.values(rewards)) enqueuePageStatusToast(copyx.todoCompletedRewardToast({ reward: hataskDropRewardMessage(reward, flowerState.value?.rules) }), reward.granted ? 'ti ti-droplet-filled' : 'ti ti-droplet-off');
	void refreshHataskFlowerStateAfterUpdate().catch(() => {});
});
const plannerTemplates = ref<HataskPlannerTemplate[]>([]);
const plannerTemplateRevision = ref<HataskPlannerRevision>(null);
const templateKindFilter = ref<HataskTemplateKindFilter>('all');
const plannerTemplatesLoaded = ref(false);
const plannerStorageState = ref<'loading'|'ready'|'saving'|'saved'|'blocked'|'conflict'>('loading');
const plannerStorageDetail = ref('');
let plannerMigrationReady = false;

function isPlannerCollectionKey(key: string): key is HataskPlannerCollectionKey {
	return (HATASK_PLANNER_COLLECTION_KEYS as readonly string[]).includes(key);
}

function storePlannerRecoveryCopy(key: HataskPlannerCollectionKey, value: unknown): void {
	try {
		window.localStorage.setItem('hatask_planner_unsaved_v1', JSON.stringify({ version: 1, savedAt: new Date().toISOString(), key, value }));
	} catch {
		// The server and Registry shadow backups remain the primary recovery path.
	}
}

async function registryGet<T>(key:string,fb:T):Promise<T>{
	try {
		if (isPlannerCollectionKey(key)) {
			const result = await plannerStoragePort.read({ key, scope: HATASK_PLANNER_SCOPE });
			plannerRevisions[key] = result.revision ?? null;
			loadedKeys.add(key);
			return (result.value != null ? result.value : fb) as T;
		}
		const v=await misskeyApi('i/registry/get',{key,scope:SCOPE});
		loadedKeys.add(key);
		// Keep a malformed settings value visible to its read guard; only NO_SUCH_KEY
		// may supply defaults that the introduction is allowed to save later.
		if (key === 'settings') return v as T;
		return(v!=null?v:fb)as T;
	} catch (error) {
		// A missing key is a valid empty state. Network/auth/server failures are not:
		// keep the key locked so a later interaction cannot overwrite unseen data.
		if ((error as { code?: string } | null)?.code === 'NO_SUCH_KEY') loadedKeys.add(key);
		return fb;
	}
}
async function registrySet(key:string,value:unknown):Promise<void>{
	if(!loadedKeys.has(key))throw new Error(`Hatask registry write blocked before a successful read: ${key}`);
	if (isPlannerCollectionKey(key)) {
		if (!plannerMigrationReady) throw new Error(`Hatask planner write blocked until migration verification succeeds: ${key}`);
		plannerStorageState.value = 'saving';
		try {
			const result = await plannerStoragePort.write({
				key,
				scope: HATASK_PLANNER_SCOPE,
				value,
				expectedRevision: plannerRevisions[key],
			});
			plannerRevisions[key] = result?.revision ?? plannerRevisions[key];
			plannerStorageState.value = 'saved';
			plannerStorageDetail.value = '';
			if (props.embedded && dataLoaded.value) queueMicrotask(() => hataGoesHost?.changed());
			return;
		} catch (error) {
			storePlannerRecoveryCopy(key, value);
			if ((error as { code?: string } | null)?.code === 'HATASK_RECORD_MODERATED') {
				plannerStorageState.value = 'blocked';
				plannerStorageDetail.value = '運営により削除された記録が含まれています。再読み込みして最新の記録を取得してください。';
			} else if ((error as { code?: string } | null)?.code === 'HATASK_PLANNER_CONFLICT') {
				plannerStorageState.value = 'conflict';
				plannerStorageDetail.value = plannerCopy.conflict;
			} else {
				plannerStorageState.value = 'blocked';
				plannerStorageDetail.value = plannerCopy.readFailure;
			}
			throw error;
		}
	}
	try {
		await misskeyApi('i/registry/set',{key,value,scope:SCOPE});
		if (props.embedded && dataLoaded.value) queueMicrotask(() => hataGoesHost?.changed());
	} catch (error) {
		if ((error as { code?: string } | null)?.code === 'HATASK_RECORD_MODERATED') {
			plannerStorageState.value = 'blocked';
			plannerStorageDetail.value = '運営により削除された記録が含まれています。再読み込みして最新の記録を取得してください。';
		}
		throw error;
	}
}

async function loadPlannerTemplates(): Promise<void> {
	const snapshot = await plannerStoragePort.readTemplates();
	const normalized = normalizeHataskPlannerTemplates(snapshot.value);
	if (normalized.invalidCount > 0) {
		plannerTemplatesLoaded.value = false;
		plannerStorageState.value = 'blocked';
		plannerStorageDetail.value = plannerCopy.templateReadFailure;
		throw new Error(plannerStorageDetail.value);
	}
	plannerTemplates.value = normalized.templates;
	plannerTemplateRevision.value = snapshot.revision;
	plannerTemplatesLoaded.value = true;
}

async function savePlannerTemplates(next: HataskPlannerTemplate[]): Promise<void> {
	if (!plannerMigrationReady || !plannerTemplatesLoaded.value) throw new Error('Hatask template write blocked before verified read');
	plannerStorageState.value = 'saving';
	try {
		const result = await plannerStoragePort.writeTemplates(next, plannerTemplateRevision.value);
		plannerTemplateRevision.value = result.revision;
		plannerTemplates.value = next;
		plannerStorageState.value = 'saved';
		plannerStorageDetail.value = '';
	} catch (error) {
		try { window.localStorage.setItem('hatask_planner_unsaved_templates_v1', JSON.stringify({ version: 1, savedAt: new Date().toISOString(), value: next })); } catch {}
		if ((error as { code?: string } | null)?.code === 'HATASK_PLANNER_CONFLICT') {
			plannerStorageState.value = 'conflict';
			plannerStorageDetail.value = plannerCopy.conflict;
		} else {
			plannerStorageState.value = 'blocked';
			plannerStorageDetail.value = plannerCopy.readFailure;
		}
		throw error;
	}
}

async function preparePlannerStorage(): Promise<boolean> {
	plannerStorageState.value = 'loading';
	plannerStorageDetail.value = '';
	// 競合後の再試行では、前回キャッシュではなくサーバーの最新revisionを基準にする。
	await plannerStoragePort.refresh();
	const result = await migrateHataskPlannerStorage(plannerStoragePort);
	if (result.status === 'noop' || result.status === 'migrated') {
		plannerMigrationReady = true;
		plannerStorageState.value = 'ready';
		return true;
	}
	plannerMigrationReady = false;
	plannerStorageState.value = 'blocked';
	plannerStorageDetail.value = result.issues[0]?.detail ?? plannerCopy.readFailure;
	return false;
}

async function retryPlannerStorage(): Promise<void> {
	try {
		if (!await preparePlannerStorage()) return;
		const [nextTodos, nextFolders, nextEvents] = await Promise.all([
			registryGet<HataskPlannerTodo[]>('todos', []),
			registryGet<HataskPlannerFolder[]>('folders', []),
			registryGet<HataskPlannerEvent[]>('events', []),
		]);
		await loadPlannerTemplates();
		todos.value = nextTodos;
		folders.value = nextFolders;
		events.value = nextEvents;
		scheduleEventNotifications();
		await loadSharedEvents();
	} catch (error) {
		plannerMigrationReady = false;
		plannerStorageState.value = 'blocked';
		plannerStorageDetail.value = (error as Error)?.message || plannerCopy.readFailure;
	}
}

// 旗鯖fork: プロフィールに出すのは花の内容ではなく件数だけ。
// レジストリの実数と異なるときだけ更新し、i/update のレート制限を消費しない。
async function syncHataskFlowerCount(): Promise<void> {
	if (!$i || $i.host != null) return;
	const count = Math.min(1000000, gallery.value.filter(item => item != null && typeof item === 'object').length);
	if ($i.hataskFlowerCount === count) return;
	try {
		const updated = await misskeyApi('i/update', { hataskFlowerCount: count });
		$i.hataskFlowerCount = updated.hataskFlowerCount;
	} catch (err) {
		console.warn('Failed to sync Hatask flower count:', err);
	}
}

const activeTab=ref('home');const showSearch=ref(false);
watch(canReviewRecords, allowed => { if (!allowed && activeTab.value === 'review') activeTab.value = 'home'; });
const routeRouter = useRouter();
// 旗鯖fork(v2 §16②): タブ切替方向を判定(activeTab宣言後に登録してTDZを回避)。
watch(activeTab, (nv, ov) => {
  const oi=tabs.value.findIndex(t=>t.id===ov); const ni=tabs.value.findIndex(t=>t.id===nv);
  tabDir.value = (ni>=oi) ? 'fwd' : 'back';
});
// タブ切り替え時にスクロール状態をリセット
watch(activeTab, () => {
  nextTick(() => {
		if (props.embedded) return;
    const root = rootEl.value;
    if (root) {
      root.style.removeProperty('overflow');
      root.style.removeProperty('height');
    }
    document.body.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overflow');
    window.scrollTo({ top: window.scrollY }); // force scroll recalc
  });
});
watch(activeTab, t => { if (t === 'recipe') recipeMounted.value = true; }, { immediate: true });
// meal タブを初めて開いたとき、免責ダイアログを必ず表示する(既読フラグは registry settings に同期)
watch(activeTab, (t) => {
  if (t === 'meal' && dataLoaded.value && !settings.value.mealDisclaimerShown) {
    showMealDisclaimer.value = true;
  }
});
const showMoodDisclaimer = ref(false);
const showFlowerInfo = ref(false);
const rootEl = ref<HTMLElement | null>(null);
// 旗鯖fork(v2 §16①): 起動ブートスプラッシュ。アニメON かつ reduced-motion でないときのみ、
//   hatask がアクティブになるたび約1.2s表示してフェードアウト。
// bootKey で毎回ブート要素を作り直す(前のブートと重なって「混ざる」のを防ぐ)。
// showBoot を一旦falseにしてから nextTick で立てることで、現在の data-theme が確実に反映された
//   新しい要素としてアニメを最初から再生する。
const showBoot=ref(false);const bootKey=ref(0);let bootTimer:ReturnType<typeof setTimeout>|null=null;let bootUsedActivated=false;
function playBoot(){
  if(bootTimer){clearTimeout(bootTimer);bootTimer=null;}
  if(props.embedded){showBoot.value=false;return;}
  const animOff = settings.value.animations===false;
  const reduce = typeof window!=='undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(animOff||reduce){showBoot.value=false;return;}
  showBoot.value=false;
  bootKey.value++;
  nextTick(()=>{
    showBoot.value=true;
    bootTimer=setTimeout(()=>{showBoot.value=false;bootTimer=null;},1300);
  });
}
const isHatakyu = computed(() => settings.value.theme === 'hatakyu');
const isAkatsuki = computed(() => (settings.value.theme || 'akatsuki') === 'akatsuki');
const hatakyuThemeStyle = computed(() => isHatakyu.value ? getHataskHatakyuStyle() : undefined);

let hataskPageActive = !props.embedded || props.paneActive;
let hataskIntroductionReady = false;

function acceptLoadedHataskSettings(value: unknown): boolean {
	if (!loadedKeys.has('settings')) return false;
	if (value == null || typeof value !== 'object' || Array.isArray(value)) {
		loadedKeys.delete('settings');
		return false;
	}
	settings.value = value;
	return true;
}

function showHataskIntroduction(): void {
	if (!hataskPageActive || !hataskIntroductionReady || !loadedKeys.has('settings')) return;
	if (showTutorial.value || showTutTheme.value) return;
	if (!settings.value.tutorialDone) {
		showTutTheme.value = true;
	}
}

const showTutorial=ref(false);const tutStep=ref(0);const tutTotalSteps=10;
// ===== Spotlight tutorial system =====
const PAD=14;
const spotRect=ref({x:0,y:0,w:0,h:0});
const tipSide=ref<'bottom'|'top'>('bottom');
const tipPosition=ref<Record<string,string>>({});
const tutSteps=computed(()=>[
  {emoji:'ti ti-sparkles',title:copy.welcome,body:'',tab:'home',selector:'',tips:[]},
  { emoji: 'ti ti-layout-navbar', title: copy.tutorialNavigationTitle, body: 'PCでは左のメニュー、スマホでは下のタブから移動できます', tab: 'home', selector: '.hak-rail,.hak-bottom', tips: [
    { icon: 'ti ti-device-mobile', text: 'Hatask Appに、カレンダー・ToDo・きもち・ごはんなどをまとめています' },
  ]},
  { emoji: 'ti ti-search', title: copy.tutorialHeaderTitle, body: copy.tutorialHeaderBody, tab: 'home', selector: '.hak-desktop-top,.hak-mobile-head', tips: [
    { icon: 'ti ti-search', text: '検索欄に入力すると、ToDo・きもち・予定をまとめて検索できます' },
    {icon:'ti ti-settings',text:copy.tutorialHeaderSettings},
  ]},
  { emoji: 'ti ti-clock', title: copy.tutorialHomeTitle, body: 'つぎの予定と今日の時間帯、ToDoや記録の状況を見渡せます', tab: 'home', selector: '.hak-home', tips: [
    { icon: 'ti ti-clock', text: '「つぎの一件」から予定を開いて、内容を確認できます' },
    {icon:'ti ti-flower',text:copy.tutorialHomeFlower},
    {icon:'ti ti-calendar-event',text:copy.tutorialHomeCards},
  ]},
  { emoji: 'ti ti-calendar-event', title: copy.tabCalendar, body: copy.tutorialCalendarBody, tab: 'cal', selector: '[data-hatask-component="calendar"]', tips: [
    {icon:'ti ti-palette',text:copy.tutorialCalendarOptions},
    {icon:'ti ti-users',text:copy.tutorialCalendarPublic},
    {icon:'ti ti-clipboard-check',text:copy.tutorialCalendarRsvp},
  ]},
  { emoji: 'ti ti-checkbox', title: copy.tutorialTodoTitle, body: copy.tutorialTodoBody, tab: 'todo', selector: '[data-mode="todo"][data-hatask-theme]', tips: [
    {icon:'ti ti-folder',text:copy.tutorialTodoFolders},
    {icon:'ti ti-note',text:copy.tutorialTodoDetails},
    {icon:'ti ti-check',text:copy.tutorialTodoComplete},
  ]},
  { emoji: 'ti ti-mood-smile', title: copy.tutorialMoodTitle, body: copy.tutorialMoodBody, tab: 'mood', selector: '[data-kind="mood"] [data-journal-capture]', tips: [
    {icon:'ti ti-chart-bar',text:copy.tutorialMoodAnalysis},
    {icon:'ti ti-bell',text:copy.tutorialMoodReminder},
    {icon:'ti ti-info-circle',text:copy.tutorialMoodDisclaimer},
  ]},
  {emoji:'ti ti-flower',title:copy.tabGarden,body:copy.tutorialGardenBody,tab:'garden',selector:'.htk-fl-ring',tips:[
    {icon:'ti ti-alarm',text:copy.tutorialGardenBloom},
    {icon:'ti ti-pencil',text:copy.tutorialGardenHarvest},
    {icon:'ti ti-target',text:copy.tutorialGardenCollection},
  ]},
  {emoji:'ti ti-confetti',title:copy.tutorialCompleteTitle,body:copy.tutorialCompleteBody,tab:'home',selector:'',tips:[
    {icon:'ti ti-settings',text:copy.tutorialCompleteSettings},
    {icon:'ti ti-message-circle',text:copy.tutorialCompleteHelp},
    {icon:'ti ti-plant-2',text:copy.tutorialCompleteWish},
  ]},
]);
function measureTarget(){
  const step=tutSteps.value[tutStep.value];if(!step?.selector)return;
  const el = Array.from(rootEl.value?.querySelectorAll<HTMLElement>(step.selector) ?? []).find(target => target.getClientRects().length > 0) ?? null;
  if(!el||(el.offsetParent===null&&getComputedStyle(el).position!=='fixed')){spotRect.value={x:40,y:window.innerHeight/3,w:window.innerWidth-80,h:200};calcTip();return}
  // 旗鯖fork: smoothスクロールは非同期で、直後に getBoundingClientRect すると「スクロール前」の座標を
  //   測ってしまい、その後スクロールが動く分ハイライトがずれる。instant(auto)で同期スクロールし、
  //   レイアウト確定後(rAF×2)に測定する。fixed要素(モバイルナビ等)はスクロール不要。
  if(getComputedStyle(el).position!=='fixed') el.scrollIntoView({behavior:'auto',block:'center'});
  const doMeasure=()=>{
    const r=el.getBoundingClientRect();
    spotRect.value={x:Math.max(0,r.left-PAD),y:Math.max(0,r.top-PAD),w:r.width+PAD*2,h:r.height+PAD*2};
    calcTip();
  };
  requestAnimationFrame(()=>requestAnimationFrame(doMeasure));
}
function calcTip(){
  const sr=spotRect.value;const vw=window.innerWidth;const vh=window.innerHeight;
  const tipW=Math.min(340,vw-24);const tipH=260;const gap=16;
  let top=sr.y+sr.h+gap;let side:'bottom'|'top'='bottom';
  if(top+tipH>vh){top=Math.max(8,sr.y-tipH-gap);side='top'}
  if(top<8)top=8;
  let left=Math.round((vw-tipW)/2);
  if(left<12)left=12;
  if(left+tipW>vw-12)left=vw-tipW-12;
  tipSide.value=side;
  tipPosition.value={position:'fixed',left:left+'px',top:top+'px',width:tipW+'px',zIndex:'3300000'};
}
function goToStep(n:number){
  tutStep.value=n;
  const step=tutSteps.value[n];
  if(step?.tab&&step.tab!==activeTab.value)activeTab.value=step.tab as any;
  nextTick(()=>setTimeout(measureTarget,350));
}
function startSpotlightTutorial(){goToStep(1)}
function nextSpotlightStep(){if(tutStep.value<tutTotalSteps-1)goToStep(tutStep.value+1)}
function prevSpotlightStep(){if(tutStep.value>1)goToStep(tutStep.value-1)}
function skipTutorial(){showTutorial.value=false;settings.value.tutorialDone=true;saveSettings()}
function finishTutorial(){showTutorial.value=false;settings.value.tutorialDone=true;saveSettings();activeTab.value='home';os.toast(copy.welcomeToHatask)}
// 旗鯖fork: 設定からの再表示はテーマ選択から始める。
function reopenTutorial(){showTutTheme.value=true}
// 旗鯖fork(v2 §14): チュートリアル冒頭のテーマ選択ステップ。テーマと明暗を即時プレビューで確定してから本編へ。
const showTutTheme=ref(false);
const tutThemes=computed(() => [
  { id: 'akatsuki', jp: i18n.ts._hata._hatask._settings.themeAkatsuki, desc: i18n.ts._hata._hatask._settings.themeAkatsukiDescription },
  { id: 'koke', jp: i18n.ts._hata._hatask._settings.themeKoke, desc: i18n.ts._hata._hatask._settings.themeKokeDescription },
  {id:'kisetsu',jp:copy.themeKisetsu,desc:copy.themeKisetsuDescription},
  {id:'kashin',jp:copy.themeKashin,desc:copy.themeKashinDescription},
  {id:'suri',jp:copy.themeSuri,desc:copy.themeSuriDescription},
  // 旗鯖fork(ハタキュ): コルク板の地色と、紙に載る青。
  {id:'hatakyu',jp:copy.themeHatakyu,desc:copy.themeHatakyuDescription},
  { id: 'halloween', jp: 'ハロウィン', desc: new Date().getMonth() === 9 ? '10月のおすすめ · 月明かりと秋の夜' : '月明かりと、おばけたちの秋の夜' },
] satisfies { id: HataskPlannerTheme; jp: string; desc: string }[]);
function pickTutTheme(id:string){settings.value.theme=id;saveSettings()}
function setTutMode(dark:boolean){settings.value.darkMode=dark;settings.value.autoTheme=false;saveSettings()}
function startTutFromTheme(){
  showTutTheme.value=false;
  tutStep.value=0;showTutorial.value=true;
}

function openDrawingTool(){
  showMobileNav.value=false;
	  popup(defineAsyncComponent(()=>import('@/components/MkDrawingTool.vue')),{},{closed:()=>{showMobileNav.value=true}});
}

function openHataCard() {
	cleanupHataskState();
	routeRouter.push('/hatask/card-maker');
}
// ===== Hatask page swipe navigation =====

function cleanupHataskState(preserveInput = props.embedded) {
	hataskPageActive = false;
	if (!preserveInput) {
  closeFlowerDetail();
  closeFlowerCollection();
  closeEventDetail();
  closeBlankCalendarActions();
	}
  // 旗鯖fork(タスク8): Hataskを離れたらフローティング連動フラグを下げる(フローティング復活)
	if (!props.embedded) hatakMascotActive.value = false;
	// 旗鯖fork(#36): 通知・地震ポーリング/購読を停止
  if(hfTimer){clearInterval(hfTimer);hfTimer=null}
  if(eqPollTimer){clearInterval(eqPollTimer);eqPollTimer=null}
  if(eqStream){try{eqStream.off('earthquakeEvent',onEqEvent);eqStream.off('_connected_',onEqStreamConn);eqStream.off('_disconnected_',onEqStreamDisc);}catch{}eqStream=null}
  showMobileNav.value=false;
  if(navProtectionObserver){navProtectionObserver.disconnect();navProtectionObserver=null}
  if(navVisibilityTimer){clearInterval(navVisibilityTimer);navVisibilityTimer=null}
	if (!props.embedded) {
		try {
			delete window.document.body.dataset.hataskActive;
			window.document.querySelectorAll<HTMLElement>('[data-htask-hidden]').forEach(el => { el.style.removeProperty('display'); delete el.dataset.htaskHidden; });
		} catch { /* Cleanup is best effort. */ }
		nextTick(() => { window.document.querySelectorAll('.htk-nav-mobile').forEach(el => el.remove()); window.document.querySelectorAll('.htk-nav-pad').forEach(el => el.remove()); });
	}
}
function openHataSettings(){cleanupHataskState();routeRouter.push('/settings/hata-custom')}

function openHataIntro() {
	cleanupHataskState();
	routeRouter.push('/hatask/intro');
}

function openHataSideStudio(){cleanupHataskState();routeRouter.push('/hata-side-studio')}
function openHataWhatsNew(){
  const {dispose}=popup(defineAsyncComponent(()=>import('@/components/MkHataWhatsNew.vue')),{}, {closed:()=>dispose()});
}
function openHatalyze(){cleanupHataskState();routeRouter.push('/hatask/emotion-analysis')}
// 旗鯖fork: HataFeed / 地震・津波情報ビューアを旗鯖独自アプリから開く
	const canAccessHataFeed=computed(()=>($i?.policies as Record<string, unknown> | undefined)?.canAccessHataFeed===true||$i?.isModerator===true||$i?.isAdmin===true);
// 旗鯖fork(v2): ホームのアプリ一覧(3テーマ共通データ)。short=短縮ラベル。color=季/花信のアイコン地色。
const homeApps=computed(()=>{
  const a=[
    { id: 'drawing', label: copy.appDrawing, short: copy.appDrawingShort, icon: 'ti ti-brush', color: '#7eb5b2', fn: openDrawingTool },
		{ id: 'card', label: copy.appCardMaker, short: copy.appCardMakerShort, icon: 'ti ti-cards', color: '#e8a87c', fn: openHataCard },
	{ id: 'studio', label: 'HataSideStudio', short: 'SideStudio', icon: 'ti ti-layout-sidebar-left-expand', color: '#8b7cf6', fn: openHataSideStudio },
	{ id: 'whatsnew', label: copy.appWhatsNew, short: copy.appWhatsNewShort, icon: 'ti ti-news', color: '#5b8fd6', fn: openHataWhatsNew },
    { id: 'hatasettings', label: copy.appHataSettings, short: copy.appHataSettingsShort, icon: 'ti ti-flag', color: '#f472b6', fn: openHataSettings },
    { id: 'intro', label: 'HataIntro', short: 'HataIntro', icon: 'ti ti-book', color: '#60a5fa', fn: openHataIntro },
    { id: 'analyze', label: emotionCopy.title, short: emotionCopy.title, icon: 'ti ti-mood-search', color: '#f59e0b', fn: openHatalyze },
  ];
  if (canAccessHataFeed.value)a.push({ id: 'feed', label: 'HataFeed', short: 'HataFeed', icon: 'ti ti-message-report', color: '#34d399', fn: openHataFeed });
  a.push({ id: 'hatady', label: 'Hatady', short: 'Hatady', icon: 'ti ti-book-2', color: '#e79b5e', fn: openHatady });
  a.push({ id: 'earthquake', label: '地震・津波情報', short: '地震', icon: 'ti ti-activity', color: '#f87171', fn: openEarthquake });
  return a;
});
// 旗鯖fork(v2): ホームの予定日付も Hataskey 共通言語の Intl 表示にする。

function eventTimeLabel(ev:any):string {return ev.allDay?copy.allDay:((ev.timeStart||'')+(ev.timeEnd?' - ' + ev.timeEnd : ''));}

function eventDateTimeLabel(ev:any):string {return `${longDateFormatter.format(parseIsoDate(ev.date))} ${eventTimeLabel(ev)}`.trim();}

function eventDateRangeLabel(ev:any):string {
	const start = longDateFormatter.format(parseIsoDate(ev.date));
	const end = ev.dateEnd && ev.dateEnd !== ev.date ? longDateFormatter.format(parseIsoDate(ev.dateEnd)) : '';
	return end ? copyx.dateRange({ start, end }) : start;
}
// 旗鯖fork(v2): 季ホーム末尾に並べる旗鯖独自セクション。
// 旗鯖fork(#37): 設定UIは HataskSettings.vue に一本化(旗鯖独自設定と同じpopup)
//   reopenTutorial イベントを受けて Hatask本体側のチュートリアル再表示を実行する
function openHataskSettings(focus?: 'moodReminder', initialSection?: string){
  // focus: きもち画面のリマインドボタンなど、開いた直後に見せたい設定項目。
  // イベントハンドラとして直接渡される箇所があるため、引数は既知の値だけ通す。
  const { dispose } = popup(defineAsyncComponent(()=>import('@/pages/HataskSettings.vue')), { focus: focus === 'moodReminder' ? focus : undefined, initialSection }, {
    closed: () => dispose(),
    reopenTutorial: () => { setTimeout(reopenTutorial, 250); },
    // 旗鯖fork(v2): 設定変更を即時反映(theme/darkMode/animations 等 → data-theme/data-anim/themeMode が反応)。
    changed: (s:any) => { if (s && typeof s === 'object') { settings.value = { ...settings.value, ...s }; } },
	  });
}
function openHataFeed(){cleanupHataskState();routeRouter.push('/hatafeed')}
// 旗鯖fork: Hatady(学習・読書記録)を旗鯖独自アプリから開く
function openHatady(){cleanupHataskState();routeRouter.push('/hatady')}
function openEarthquake(){cleanupHataskState();routeRouter.push('/earthquake')}

// 旗鯖fork(#36): HataFeed通知タイル
const hfNotifs=ref<HataFeedNotif[]>([]);
const hfUnread=ref(0);
const hfState = ref<'loading' | 'ready' | 'error'>('loading');
const hfReadingNotificationIds = new Set<string>();
let hfTimer: number | null = null;
async function loadHfNotifs(){
  if(!canAccessHataFeed.value)return;
  try{
    const res:any=await misskeyApi('hata/feedback/notifications',{limit:5});
    hfNotifs.value=res.notifications||[];
    hfUnread.value=res.unreadCount||0;
    hfState.value = 'ready';
  } catch {if (hfState.value !== 'ready')hfState.value = 'error';}
}
function hfIcon(type:string):string{
  // hatafeedのnotifIcon相当の最低限版
  if(type==='newIssue')return 'ti-pencil-plus';
  if(type==='issueAgreed')return 'ti-thumb-up';
  if(type==='issueStatusChanged')return 'ti-progress';
  if(type==='issueResolved')return 'ti-check';
  if(type==='issueClosed')return 'ti-lock';
  if(type==='newComment'||type==='commentReaction'||type==='commentReply')return 'ti-message';
  if(type==='emojiApproved')return 'ti-mood-smile';
  if(type==='emojiRejected')return 'ti-mood-sad';
  return 'ti-bell';
}

async function onHfNotifClick(n: HataFeedNotif) {
	if (!n.isRead && !hfReadingNotificationIds.has(n.id)) {
		hfReadingNotificationIds.add(n.id);
		try {
			await misskeyApi('hata/feedback/notifications/read', { notificationId: n.id });
			hfNotifs.value = hfNotifs.value.map(item => item.id === n.id ? { ...item, isRead: true } : item);
			hfUnread.value = Math.max(0, hfUnread.value - 1);
		} catch {
			// 既読更新に失敗しても、通知先を読む動線は妨げない。
		} finally {
			hfReadingNotificationIds.delete(n.id);
		}
	}
	cleanupHataskState();
	if (n.feedbackId) routeRouter.pushByPath('/hatafeed/' + n.feedbackId);
	else routeRouter.push('/hatafeed');
}

// 旗鯖fork(#36): 地震・津波タイル(WS購読＋ポーリング)
const rawQuakes=ref<any[]>([]);
const tsunami=ref<any[]>([]);
const streamConnected=ref(false);
const eqLastReceived=ref('');
let eqStream:any=null;let eqPollTimer:ReturnType<typeof setInterval>|null=null;
async function loadEq(){
  try{
    const [eq,ts]=await Promise.all([
      misskeyApi('hata/earthquake/history',{limit:30}),
      misskeyApi('hata/earthquake/tsunami',{limit:10}),
    ]);
    const {pruneOld}=await import('@/utility/earthquake.js');
    rawQuakes.value=pruneOld((eq as any[])??[]);
    tsunami.value=pruneOld((ts as any[])??[]);
    eqLastReceived.value=new Date().toLocaleTimeString('ja-JP');
  }catch{}
}
async function onEqEvent(ev:{code:number;item:any}){
  const {pruneOld}=await import('@/utility/earthquake.js');
  if(ev.code===551)rawQuakes.value=pruneOld([ev.item,...rawQuakes.value]).slice(0,60);
  else if(ev.code===552)tsunami.value=pruneOld([ev.item,...tsunami.value]).slice(0,20);
  eqLastReceived.value=new Date().toLocaleTimeString('ja-JP');
}
// 旗鯖fork(perf): WS接続中はポーリングを止め、切断時のみフォールバックとして動かす。
//   WSが活きていれば earthquakeEvent がリアルタイムで届くため、60秒ポーリングは重複。
function startEqPoll(){if(!eqPollTimer)eqPollTimer=setInterval(loadEq,60000)}
function stopEqPoll(){if(eqPollTimer){clearInterval(eqPollTimer);eqPollTimer=null}}
function onEqStreamConn(){streamConnected.value=true;stopEqPoll()}
function onEqStreamDisc(){streamConnected.value=false;startEqPoll()}

function exitHatask(): void {
	if (props.embedded) { emit('exit'); return; }
	if (closePageWindow) {
		closePageWindow();
		return;
	}
	handleBack();
}

function handleBack(){
if(activeTab.value!=='home'){activeTab.value='home';return}
goBackToTimeline();
}
function goBackToTimeline(){
cleanupHataskState();
routeRouter.push('/');
}

// ========== NOTIFICATION SYSTEM (Misskey API) ==========
// 予定通知は従来のタイマーを維持する。気持ちリマインダーはサーバーが毎日送信する。
const eventTimerIds:number[]=[];
// 旗鯖fork: 第4引数 link でクリック先パスを指定可能(デフォルト '/hatask' = 全hatask通知をhataskページに飛ばす)。
// 呼び出し側で別のパスに飛ばしたい場合のみ link を明示すればよい。
async function sendNotification(header:string,body:string,icon?:string,link:string='/hatask'){
try{await misskeyApi('notifications/create',{body,header:header||null,icon:icon||null,link:link||null});return true}catch(e){console.warn('Hatask notification error:',e);return false}
}

function scheduleEventNotifications(){
	// ブラウザの setTimeout 上限より手前までを張り、12時間ごとに次の窓を補充する。
	// 旧実装の24時間制限では、Hataskを毎日開かない利用者の通知が欠落していた。
	eventTimerIds.forEach(id=>window.clearTimeout(id));eventTimerIds.length=0;
	const now=Date.now();
	const timerWindowMs=21*24*60*60*1000;
	const rangeEnd=new Date(now+timerWindowMs+2*24*60*60*1000);
	const occurrences=expandHataskEventOccurrences(events.value,localDateKey(),localDateKey(rangeEnd),2000);
	for(const ev of occurrences){
		if(!ev.notify||!ev.notifyTimings?.length)continue;
		const eventTime=new Date(`${ev.date}T${ev.allDay?'09:00':ev.timeStart||'09:00'}`).getTime();
		if(!Number.isFinite(eventTime)||eventTime<now)continue;
		for(const timing of ev.notifyTimings){
			let msAhead=0;
			if(timing==='15分前')msAhead=15*60*1000;
			else if(timing==='30分前')msAhead=30*60*1000;
			else if(timing==='1時間前')msAhead=60*60*1000;
			else if(timing==='1日前')msAhead=24*60*60*1000;
			const delay=eventTime-msAhead-now;
			if(delay<=0||delay>timerWindowMs)continue;
			const tid=window.setTimeout(()=>{
				sendNotification(ev.title,copyx.eventReminderBody({ timing: notifyTimingLabel(timing), start: ev.timeStart||copy.allDay, end: ev.timeEnd||copy.allDay }),undefined,'/hatask?notice=calendar');
			},delay);
			eventTimerIds.push(tid);
		}
	}
	const refreshTimer=window.setTimeout(scheduleEventNotifications,12*60*60*1000);
	eventTimerIds.push(refreshTimer);
}
const currentTime=ref('');const currentDate=ref('');const eyePhrase=ref(getDefaultPhrase());const editingEvent=ref<any>(null);let eyeTimer:ReturnType<typeof setInterval>|null=null;
// 旗鯖fork(v2): テーマ別の時計まわり日付パーツ(季=1月9日/金曜日, 刷=2026.01.09/FRIDAY)。
const clockMD=ref('');const clockDow=ref('');const clockDot=ref('');const clockEn=ref('');
// 旗鯖fork: マスコット機能の利用可否(ロールポリシー)。App一覧のアクセス制御に使う。
	const canUseMascot=computed(() => ($i?.policies as Record<string, unknown> | undefined)?.canUseMascot === true);
// マスコット専用設定(論点③)。/mascot は表示ページなので、設定は hata-custom と同じく
// MkMascotSettings をポップアップで開く(Haskを離れないのでcleanup不要)。
	function goToMascotSettings(){popup(defineAsyncComponent(()=>import('@/pages/MkMascotSettings.vue')),{},{});}
const closedRsvpNotifs=ref<{eventId:string,emoji:string,title:string,goCount:number}[]>([]);
const dismissedRsvpNotifs=ref<string[]>([]);
const sharedEvents=ref<any[]>([]);
let sharedEventRequest = 0;

async function loadSharedEvents(){
	const request = ++sharedEventRequest;
	try {
		const loadOwned=async():Promise<any[]>=>{
			const owned:any[]=[];
			let untilId:string|undefined;
			for(let page=0;page<100;page++){
				const batch=await misskeyApi('hatask/events/owned',{limit:100,...(untilId?{untilId}:{})}) as any[];
				owned.push(...batch);
				if(batch.length<100)break;
				untilId=batch[batch.length-1]?.id;
				if(!untilId)break;
			}
			return owned;
		};
		const [publicEvents,owned]=await Promise.all([
			// 通常表示では未来分を日付順に取得する。includeExpired=true は全履歴の
			// 最古50件を返し、現在の共有予定を隠してしまうため使わない。
			misskeyApi('hatask/events/list',{limit:50,includeExpired:false}) as Promise<any[]>,
			loadOwned(),
		]);
		if (request !== sharedEventRequest) return;
		const merged=new Map<string,any>();
		for(const event of [...publicEvents,...owned])merged.set(event.id,event);
		sharedEvents.value=[...merged.values()];
		checkClosedRsvps();
		if (viewingEvent.value && !allCalendarEvents.value.some(event => event.id === viewingEvent.value.id))closeEventDetail();
		await reconcileOwnedEventIds();
		await processPublicEventOutbox();
	} catch(e) {
		console.warn('Failed to load shared events:',e);
		if (request !== sharedEventRequest) return;
		// A previous audience grant must not survive a failed authorization refresh.
		sharedEvents.value = sharedEvents.value.filter(event => event.userId === $i?.id);
		checkClosedRsvps();
		if (viewingEvent.value?.userId !== $i?.id)closeEventDetail();
	}
}
let sharedEventTimer: number | undefined;

function refreshSharedEventAccess(): void {
	if (hataskPageActive && dataLoaded.value && window.document.visibilityState === 'visible') void loadSharedEvents();
}

onMounted(() => {
	sharedEventTimer = window.setInterval(refreshSharedEventAccess, 60_000);
	window.addEventListener('focus', refreshSharedEventAccess);
	window.document.addEventListener('visibilitychange', refreshSharedEventAccess);
});
onUnmounted(() => {
	++sharedEventRequest;
	window.clearInterval(sharedEventTimer);
	window.removeEventListener('focus', refreshSharedEventAccess);
	window.document.removeEventListener('visibilitychange', refreshSharedEventAccess);
});

function plannerEventServerId(eventId:string):string{
	const local=events.value.find(event=>event.id===eventId||event.serverEventId===eventId);
	return local?.serverEventId||eventId;
}
function sharedEventData(eventId:string){const serverId=plannerEventServerId(eventId);return sharedEvents.value.find(e=>e.id===serverId)||null}
function sharedRsvpResponses(eventId:string){return sharedEventData(eventId)?.rsvpResponses||[]}
function sharedRsvpMyStatus(eventId:string){const r=sharedRsvpResponses(eventId).find((r:any)=>r.userId===$i?.id);return r?.status||null}

function publicEventSignature(event:any):string{
	return JSON.stringify([
		String(event.title??'').trim(),String(event.emoji??'📅'),String(event.date??''),String(event.dateEnd??''),
		event.allDay?'':String(event.timeStart??''),event.allDay?'':String(event.timeEnd??''),
		Boolean(event.allDay),String(event.color??'#e27d60').toLowerCase(),Boolean(event.rsvp),
		event.visibility === 'specified' ? 'specified' : 'public', event.visibility === 'specified' ? [...(event.visibleUserIds ?? [])].sort() : [],
	]);
}

function findUniqueOwnedServerId(event:any,claimed=new Set<string>()):string|null{
	const matches=sharedEvents.value.filter(candidate=>candidate.userId===$i?.id&&!claimed.has(candidate.id)&&publicEventSignature(candidate)===publicEventSignature(event));
	return matches.length===1?matches[0].id:null;
}

/**
 * 旧クライアントは公開予定のサーバーIDを保存していなかった。
 * 全項目が一致する自分の予定が一意な場合だけ対応づけ、曖昧なら絶対に推測しない。
 */
async function reconcileOwnedEventIds():Promise<void>{
	if(!plannerMigrationReady||!loadedKeys.has('events')||events.value.length===0)return;
	const claimed=new Set(events.value.flatMap(event=>event.serverEventId?[event.serverEventId]:[]));
	let changed=false;
	const next:HataskPlannerEvent[]=events.value.map((event):HataskPlannerEvent=>{
		if (!isSharedHataskEvent(event)) return event;
		if(event.serverEventId){
			const server=sharedEvents.value.find(candidate=>candidate.id===event.serverEventId&&candidate.userId===$i?.id);
			if(!server||server.revision===event.serverEventRevision)return event;
			if(publicEventSignature(server)===publicEventSignature(event)){
				changed=true;
				return{...event,serverEventRevision:server.revision};
			}
			if(!event.publicSyncState){changed=true;return{...event,publicSyncState:'conflict' as const}}
			return event;
		}
		const serverEventId=findUniqueOwnedServerId(event,claimed);
		if(serverEventId){
			claimed.add(serverEventId);
			changed=true;
			const serverEvent=sharedEvents.value.find(candidate=>candidate.id===serverEventId);
			const matched:HataskPlannerEvent={...event,clientEventId:event.clientEventId||event.id,serverEventId,serverEventRevision:serverEvent?.revision};
			delete matched.publicSyncState;
			return matched;
		}
		if(['pending','creating','updating','deleting','deleting-local','unlinked'].includes(String(event.publicSyncState||'')))return event;
		changed=true;
		return{...event,publicSyncState:'unlinked' as const};
	});
	if(!changed)return;
	try{
		await registrySet('events',next);
		events.value=next;
	}catch(error){
		console.warn('Hatask public event ID reconciliation was not saved:',error);
	}
}

let publicOutboxProcessing=false;
async function persistPlannerEvent(eventId:string,replacement:HataskPlannerEvent|null):Promise<void>{
	const next=[...events.value];
	const index=next.findIndex(event=>event.id===eventId);
	if(index>=0){if(replacement)next.splice(index,1,replacement);else next.splice(index,1)}
	else if(replacement)next.unshift(replacement);
	await registrySet('events',next);
	events.value=next;
}

/** サーバー操作の前にRegistryへ残したintentを冪等に再開する。 */
async function processPublicEventOutbox():Promise<void>{
	if(publicOutboxProcessing||plannerReadOnly.value)return;
	publicOutboxProcessing=true;
	try{
		for(const queued of [...events.value]){
			const current=events.value.find(event=>event.id===queued.id);
			if(!current)continue;
			const state=String(current.publicSyncState||'');
			if(!['creating','pending','updating','deleting','deleting-local'].includes(state))continue;
			try{
				if(state==='creating'||state==='pending'){
					const matchedId=findUniqueOwnedServerId(current);
					const matched=matchedId?sharedEvents.value.find(event=>event.id===matchedId):null;
					const created=matched??await misskeyApi('hatask/events/create',eventApiPayload(current)) as any;
					const saved={...current,serverEventId:created.id,serverEventRevision:created.revision,publicSyncState:undefined};
					delete saved.publicSyncState;
					await persistPlannerEvent(current.id,saved);
					continue;
				}
				if(state==='updating'){
					const server=sharedEventData(current.id);
					const serverEventId=current.serverEventId||server?.id;
					if(server&&publicEventSignature(server)===publicEventSignature(current)){
						const saved={...current,serverEventId:server.id,serverEventRevision:server.revision,publicSyncState:undefined};
						delete saved.publicSyncState;
						await persistPlannerEvent(current.id,saved);
						continue;
					}
					if(server?.revision&&current.serverEventRevision&&server.revision!==current.serverEventRevision){
						await persistPlannerEvent(current.id,{...current,publicSyncState:'conflict'});
						continue;
					}
					const expectedRevision=current.serverEventRevision||server?.revision;
					if(!serverEventId||!expectedRevision){
						await persistPlannerEvent(current.id,{...current,publicSyncState:'unlinked'});
						continue;
					}
					const updated=await misskeyApi('hatask/events/update',{eventId:serverEventId,expectedRevision,...eventApiPayload(current)}) as any;
					const saved={...current,serverEventId,serverEventRevision:updated.revision,publicSyncState:undefined};
					delete saved.publicSyncState;
					await persistPlannerEvent(current.id,saved);
					continue;
				}

				const server=sharedEventData(current.id);
				const serverEventId=current.serverEventId||server?.id;
				const expectedRevision=current.serverEventRevision||server?.revision;
				if(serverEventId){
					if(!expectedRevision)throw new Error('Missing public event revision');
					try{await misskeyApi('hatask/events/delete',{eventId:serverEventId,expectedRevision})}catch(error){if((error as {code?:string}|null)?.code!=='NO_SUCH_EVENT')throw error}
				}
				if(state==='deleting-local'){
					await persistPlannerEvent(current.id,null);
				}else{
					const saved={...current,visibility:'private' as const,rsvp:false,serverEventId:undefined,serverEventRevision:undefined,publicSyncState:undefined,pendingVisibility:undefined};
					delete saved.serverEventId;delete saved.serverEventRevision;delete saved.publicSyncState;delete saved.pendingVisibility;
					await persistPlannerEvent(current.id,saved);
				}
				}catch(error){
					const code=(error as {code?:string}|null)?.code;
					try{
						if(code==='HATASK_EVENT_CONFLICT')await persistPlannerEvent(current.id,{...current,publicSyncState:'conflict'});
						else if(code==='NOT_OWNER'||code==='NO_SUCH_EVENT')await persistPlannerEvent(current.id,{...current,publicSyncState:'unlinked'});
						else if((state==='creating'||state==='pending'||state==='updating')&&(code==='INVALID_HATASK_EVENT_SCHEDULE'||code==='INVALID_PARAM'))await persistPlannerEvent(current.id,{...current,publicSyncState:'sync-error'});
					}catch{}
					console.warn(`Hatask public event outbox remains pending (${state}):`,error);
			}
		}
	}finally{publicOutboxProcessing=false}
}
const viewingEvent = ref<any>(null);
const eventViewReturnFocus = ref<HTMLElement | null>(null);
const eventViewBusy = ref(false);

function openEventDetail(event: any, trigger: HTMLElement | null = null): void {
	eventViewReturnFocus.value = trigger ?? (window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null);
	viewingEvent.value = event;
}

function closeEventDetail(): void {
	viewingEvent.value = null;
}

function getEventDetailAnchor(): HTMLElement | null {
	const calendar = rootEl.value?.querySelector<HTMLElement>('[data-hatask-component="calendar"]');
	if (!calendar?.isConnected || activeTab.value !== 'cal' || !viewingEvent.value) return null;
	const viewport = window.visualViewport;
	const viewportLeft = viewport?.offsetLeft ?? 0;
	const viewportTop = viewport?.offsetTop ?? 0;
	const viewportRight = viewportLeft + (viewport?.width ?? (window.document.documentElement.clientWidth || window.innerWidth));
	const viewportBottom = viewportTop + (viewport?.height ?? (window.document.documentElement.clientHeight || window.innerHeight));
	const visible = (element: HTMLElement | null): element is HTMLElement => {
		if (!element?.isConnected || !calendar.contains(element) || !element.getClientRects().length) return false;
		const rect = element.getBoundingClientRect();
		let left = Math.max(rect.left, viewportLeft);
		let top = Math.max(rect.top, viewportTop);
		let right = Math.min(rect.right, viewportRight);
		let bottom = Math.min(rect.bottom, viewportBottom);
		// The dialog deliberately makes the calendar inert; geometry still anchors to it.
		for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
			const style = window.getComputedStyle(ancestor);
			if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
			if (ancestor === element) continue;
			const clipsX = /^(auto|scroll|hidden|clip|overlay)$/.test(style.overflowX || style.overflow);
			const clipsY = /^(auto|scroll|hidden|clip|overlay)$/.test(style.overflowY || style.overflow);
			if (!clipsX && !clipsY) continue;
			const clip = ancestor.getBoundingClientRect();
			if (clipsX) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
			if (clipsY) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
		}
		return right > left && bottom > top;
	};
	const date = selectedDateStr.value;
	const heading = (day: HTMLElement | null): HTMLElement | null => day?.querySelector<HTMLElement>(':scope > [data-calendar-day-button]')
		?? day?.querySelector<HTMLElement>(':scope > header > button')
		?? day?.querySelector<HTMLElement>(':scope > header') ?? null;
	const original = eventViewReturnFocus.value;
	const trigger = original && calendar.contains(original) ? original : null;
	const triggerDay = trigger?.closest<HTMLElement>('[data-date]') ?? null;
	const clickedDay = triggerDay?.dataset.date === date ? triggerDay : null;
	const clickedHeading = heading(clickedDay);
	if (visible(clickedHeading)) return clickedHeading;
	if (clickedDay && visible(trigger)) return trigger;
	const days = [...calendar.querySelectorAll<HTMLElement>('[data-date]')].filter(day => day.dataset.date === date);
	for (const day of days) {
		for (const row of day.querySelectorAll<HTMLElement>('[data-calendar-event]')) {
			if (row.dataset.calendarEvent !== viewingEvent.value.id) continue;
			const target = row instanceof HTMLButtonElement ? row : row.querySelector<HTMLElement>(':scope > button');
			if (visible(target)) return target;
		}
	}
	for (const day of days) {
		const target = heading(day);
		if (visible(target)) return target;
	}
	return null;
}

function focusEventCalendar(): void {
	const calendar = rootEl.value?.querySelector<HTMLElement>('[data-hatask-component="calendar"]');
	if (!calendar?.isConnected || activeTab.value !== 'cal') return;
	const target = calendar.querySelector<HTMLButtonElement>('[data-calendar-day-button][tabindex="0"]')
		?? calendar.querySelector<HTMLButtonElement>('button:not(:disabled)');
	target?.focus({ preventScroll: true });
}

async function editViewedEvent(): Promise<void> {
	const event = viewingEvent.value;
	if (!event || !viewingEventDetails.value?.canEdit || plannerReadOnly.value || eventViewBusy.value) return;
	closeEventDetail();
	// Release the detail dialog's focus trap before opening the existing editor.
	await nextTick();
	startEditEvent(event);
}

async function deleteViewedEvent(): Promise<void> {
	const event = viewingEvent.value;
	if (!event || !viewingEventDetails.value?.canEdit || plannerReadOnly.value || eventViewBusy.value) return;
	// The existing confirmation remains responsible for cancellation and deletion.
	closeEventDetail();
	await nextTick();
	await deleteEventById(event.id);
}

async function respondToViewedEvent(status: 'going' | 'maybe' | 'declined'): Promise<void> {
	const detail = viewingEventDetails.value;
	if (!detail?.rsvp || detail.isOwner || detail.rsvp.closed || plannerReadOnly.value || eventViewBusy.value) return;
	eventViewBusy.value = true;
	try { await setRsvp(detail.id, status); } finally { eventViewBusy.value = false; }
}

async function closeViewedEventRsvp(): Promise<void> {
	const detail = viewingEventDetails.value;
	if (!detail?.rsvp || !detail.isOwner || detail.rsvp.closed || plannerReadOnly.value || eventViewBusy.value) return;
	eventViewBusy.value = true;
	try { await closeRsvp(detail.id); } finally { eventViewBusy.value = false; }
}

let clockInterval:ReturnType<typeof setInterval>|null=null;

// ========== LOGIN DAYS ==========
const loginDays=computed(()=>$i?.loggedInDays??0);
const loginRanking=ref(0);const loginTotal=ref(0);
async function fetchLoginRanking(){try{const res=await misskeyApi('hata/login-ranking',{});if(res&&typeof res.rank==='number'){loginRanking.value=res.rank;loginTotal.value=res.totalUsers??0}}catch(e){console.warn('Login ranking unavailable:',e)}}
const settings=ref<any>({darkMode:false,autoTheme:true,weekStart:'mon',showClock:true,showEvents:true,showFlower:true,showMoodSummary:true,showFeedbackNotif:true,showEarthquake:true,moodRemind:false,moodRemindTimes:['昼 12:00','寝る前 23:00'],theme:'akatsuki',animations:true,todoSortModes:{},todoMobileTabOrder:['today','upcoming','all','completed','more']});
const hatadyCookingRoute = computed(() => routeRouter.currentRef.value.props.get('tab') === 'recipe'
	&& routeRouter.currentRef.value.props.get('from') === 'hatady'
	&& routeRouter.currentRef.value.props.get('action') === 'cooking');
let hatadyCookingOpened = false;
watch(hatadyCookingRoute, () => { hatadyCookingOpened = false; });
watch([hatadyCookingRoute, activeTab, dataLoaded, () => settings.value.recipeConsentShown, recipeView], async () => {
	if (!hatadyCookingRoute.value || hatadyCookingOpened || activeTab.value !== 'recipe'
		|| !dataLoaded.value || !loadedKeys.has('settings') || settings.value.recipeConsentShown !== true || !recipeView.value) return;
	hatadyCookingOpened = true;
	await nextTick();
	if (hatadyCookingRoute.value && activeTab.value === 'recipe') recipeView.value?.openRecordFromHatady();
}, { immediate: true });

function closeRecipe(): void {
	hatadyCookingOpened = true;
	activeTab.value = 'hataskapps';
}

const offerHatadyReturn = createHatadyCookingReturnPrompt(
	options => dialogs.confirm(options),
	() => { if (hataskPageActive) { cleanupHataskState(); routeRouter.push('/hatady'); } },
);
// 旗鯖fork: HataSideStudio・Hatask通知・HataIntroから、許可したタブへ直接移動する。
// 明示的な tab を優先し、保存済み通知の notice は対応するタブへ読み替える。
// すべてのテーマで共通のタブへ戻る。
watch([
	() => routeRouter.currentRef.value.props.get('tab'),
	() => routeRouter.currentRef.value.props.get('notice'),
], ([explicitTab, notice]) => {
	if (props.embedded) return;
	const requestedTab = explicitTab ?? (notice === 'mood' ? 'mood' : notice === 'calendar' ? 'cal' : undefined);
	activeTab.value = typeof requestedTab === 'string' && (tabs.value.some(tab => tab.id === requestedTab)
		|| requestedTab === 'hataskapps') ? requestedTab : 'home';
}, { immediate: true });
// 旗鯖fork(v2 §16①): ブート表示中にテーマが確定/変更されたら要素を作り直し、現テーマで最初から再生
//   (設定の非同期ロードや切替でブートが2テーマ混ざるのを防ぐ)。
//   watch は登録時に監視元を評価するため、settings の宣言後に置く。
watch(() => settings.value.theme, () => {
  if(showBoot.value) bootKey.value++;
});
const prefersDark=ref(window.matchMedia('(prefers-color-scheme:dark)').matches);
let mediaQuery:MediaQueryList|null=null;
function detectMisskeyTheme():'dark'|'light'{
  const cs=window.getComputedStyle(document.documentElement);
  const bg=cs.getPropertyValue('--MI_THEME-bg').trim()||cs.getPropertyValue('--MI_THEME-panel').trim()||'';
  if(bg){const m=bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);if(m){return(parseInt(m[1])*299+parseInt(m[2])*587+parseInt(m[3])*114)/1000<128?'dark':'light'}}
  return prefersDark.value?'dark':'light';
}
const misskeyTheme=ref(detectMisskeyTheme());
const themeMode = computed(() => {
	// 暁・苔・ハロウィンの自動配色は、設定プレビューと同じ本体テーマに追従する。
	if (settings.value.autoTheme) {
		if (isAkatsuki.value || settings.value.theme === 'koke' || settings.value.theme === 'halloween') return store.r.darkMode.value ? 'dark' : 'light';
		return (prefersDark.value || misskeyTheme.value === 'dark') ? 'dark' : 'light';
	}
	return settings.value.darkMode ? 'dark' : 'light';
});
function onMediaChange(e:MediaQueryListEvent){prefersDark.value=e.matches;misskeyTheme.value=detectMisskeyTheme()}
let htk_themeObserver:MutationObserver|null=null;
function startHtkThemeWatch(){
  misskeyTheme.value=detectMisskeyTheme();
  htk_themeObserver=new MutationObserver(()=>{misskeyTheme.value=detectMisskeyTheme()});
  htk_themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-color-mode','class','style']});
}
function stopHtkThemeWatch(){htk_themeObserver?.disconnect();htk_themeObserver=null}
async function saveSettings(){await registrySet('settings',settings.value)}
function toggleNotifyTiming(t:string){const i=newEvent.value.notifyTimings.indexOf(t);if(i>=0)newEvent.value.notifyTimings.splice(i,1);else newEvent.value.notifyTimings.push(t)}

// Calendar
const calYear=ref(new Date().getFullYear());const calMonth=ref(new Date().getMonth());const selectedDay=ref<number|null>(new Date().getDate());
const calendarTitle = computed(() => yearMonthFormatter.format(new Date(calYear.value, calMonth.value, 1)));
function chMo(d:number){calMonth.value+=d;if(calMonth.value>11){calMonth.value=0;calYear.value++}if(calMonth.value<0){calMonth.value=11;calYear.value--}selectedDay.value=null;viewingEvent.value=null}
function goToday(){const n=new Date();calYear.value=n.getFullYear();calMonth.value=n.getMonth();selectedDay.value=n.getDate()}
const selectedDateStr=computed(()=>{if(!selectedDay.value)return'';return`${calYear.value}-${String(calMonth.value+1).padStart(2,'0')}-${String(selectedDay.value).padStart(2,'0')}`});
// ローカル + 共有予定を serverEventId で照合し、繰り返し予定を表示期間へ展開する。
const allCalendarEvents=computed(()=>{
	const now=new Date();
	const anchor=new Date(calYear.value,calMonth.value,selectedDay.value??1,12);
	const oneTimeEvents=events.value.filter(event=>event.archivedAt==null&&(event.recurrence?.frequency??'none')==='none').map(event=>({...event,sourceEventId:event.id,occurrenceDate:event.date,isRecurrenceOccurrence:false}));
	const recurringEvents=events.value.filter(event=>(event.recurrence?.frequency??'none')!=='none');
	const expanded=new Map<string,any>();
	for(const event of expandHataskEventOccurrences(recurringEvents,localDateKey(new Date(now.getFullYear()-1,0,1)),localDateKey(new Date(now.getFullYear()+4,11,31)),5000))expanded.set(event.id,event);
	for(const event of expandHataskEventOccurrences(recurringEvents,localDateKey(new Date(anchor.getFullYear()-1,0,1)),localDateKey(new Date(anchor.getFullYear()+1,11,31)),3000))expanded.set(event.id,event);
	const localOccurrences=[...oneTimeEvents,...expanded.values()].map(event=>({
		...event,
		userId:$i?.id,
		isShared: isSharedHataskEvent(event),
	}));
	const localServerIds=new Set(events.value.flatMap(event=>event.serverEventId?[event.serverEventId]:[]));
	const shared=sharedEvents.value.filter(event=>!localServerIds.has(event.id)).map(event=>({
		...event,
		isShared:true,
		visibility: event.visibility === 'specified' ? 'specified' : 'public',
		readOnly:event.userId!==$i?.id,
		sourceEventId:event.id,
		occurrenceDate:event.date,
		isRecurrenceOccurrence:false,
	}));
	return[...localOccurrences,...shared];
});
const showDeclinedInvitations = ref(false);

function isDeclinedCalendarInvitation(event: { userId?: string; rsvp?: boolean; rsvpResponses?: { userId: string; status: string }[] }): boolean {
	const myId = $i?.id;
	return Boolean(myId && event.userId !== myId && event.rsvp
		&& event.rsvpResponses?.some(response => response.userId === myId && response.status === 'declined'));
}
// 辞退は表示だけ除外し、詳細から回答を変更できるよう元の予定一覧を保持する。
const visibleCalendarEvents = computed(() => allCalendarEvents.value.filter(event => showDeclinedInvitations.value || !isDeclinedCalendarInvitation(event)));

function startEditEvent(ev:any){
	const sourceId=ev.sourceEventId||ev.id;
	const localSource=events.value.find(event=>event.id===sourceId||event.serverEventId===sourceId);
	if(!localSource&&ev.userId!==$i?.id){os.toast(copy.cannotDeleteOthersEvent);return}
	// owner API からだけ見つかった旧予定は、参加者やプロフィールをRegistryへ複製せず
	// plannerの必要フィールドだけを保存候補へ取り込む。
	const importedId=generateId();
	const source:HataskPlannerEvent=localSource?{...localSource,clientEventId:localSource.clientEventId||localSource.id}:{
		id:importedId,clientEventId:importedId,serverEventId:ev.id,serverEventRevision:ev.revision,
		title:ev.title,emoji:ev.emoji||'⭐',date:ev.date,dateEnd:ev.dateEnd||ev.date,
		timeStart:ev.timeStart||'',timeEnd:ev.timeEnd||'',allDay:Boolean(ev.allDay),color:ev.color||'#e27d60',
		visibility: ev.visibility === 'specified' ? 'specified' : 'public', visibleUserIds: [...(ev.visibleUserIds ?? [])], rsvp: Boolean(ev.rsvp), notify: false, notifyTimings: [], recurrence: { frequency: 'none', interval: 1 }, archivedAt: null,
	};
	editingEvent.value=source;
	newEvent.value = { title: source.title, emoji: source.emoji || '⭐', date: source.date, timeStart: source.timeStart || '14:00', dateEnd: source.dateEnd || source.date, timeEnd: source.timeEnd || '15:00', color: source.color || '#e27d60', visibility: source.visibility || 'private', visibleUserIds: [...(source.visibleUserIds ?? [])], rsvp: source.rsvp || false, notify: source.notify || false, notifyTimings: source.notifyTimings ? [...source.notifyTimings] : ['15分前'], allDay: source.allDay || false, recurrence: { ...(source.recurrence || { frequency: 'none', interval: 1 }) } };
	openEventDetailsModal();
}
async function deleteEventById(id:string,options:{skipConfirm?:boolean}={}){
	if(plannerReadOnly.value)return;
	const occurrence=allCalendarEvents.value.find(event=>event.id===id);
	const sourceId=occurrence?.sourceEventId||id;
	const local=events.value.find(event=>event.id===sourceId||event.serverEventId===sourceId);
	const shared=sharedEventData(local?.id||sourceId);
	if(shared&&shared.userId!==$i?.id){os.toast(copy.cannotDeleteOthersEvent);return}
	if(!options.skipConfirm){const {canceled}=await dialogs.confirm({type:'warning',text:plannerCopy.confirmDeleteEvent});if(canceled)return}

	let serverEventId=local?.serverEventId||(!local&&shared?.userId===$i?.id?shared.id:null);
	let serverEventRevision=String(local?.serverEventRevision||shared?.revision||'')||undefined;
	if (local && isSharedHataskEvent(local) && !serverEventId) {
		serverEventId=findUniqueOwnedServerId(local);
		const matched=serverEventId?sharedEvents.value.find(event=>event.id===serverEventId):null;
		serverEventRevision=matched?.revision;
		if(!serverEventId||!serverEventRevision){os.toast(plannerCopy.publicSyncUnlinked);return}
	}
	try{
		if (local && isSharedHataskEvent(local)) {
			// 削除intentを先に保存し、API成功後のCAS失敗でも次回確実に再開する。
			await persistPlannerEvent(local.id,{...local,serverEventId,serverEventRevision,publicSyncState:'deleting-local'});
			await processPublicEventOutbox();
		}else if(local){
			const next=events.value.filter(event=>event.id!==local.id);
			await registrySet('events',next);
			events.value=next;
		}else if(serverEventId&&serverEventRevision){
			await misskeyApi('hatask/events/delete',{eventId:serverEventId,expectedRevision:serverEventRevision});
		}
		if(editingEvent.value?.id===local?.id)editingEvent.value=null;
		viewingEvent.value=null;
		await loadSharedEvents();
		scheduleEventNotifications();
			const remainingState=local?String(events.value.find(event=>event.id===local.id)?.publicSyncState||''):'';
			os.toast(remainingState==='conflict'?plannerCopy.publicSyncConflict:remainingState==='unlinked'?plannerCopy.publicSyncUnlinked:remainingState?plannerCopy.publicSyncPending:copy.eventDeleted);
	}catch(error){
		console.error('Hatask event delete failed:',error);
		os.toast(plannerCopy.publicSyncFailed);
	}
}

// Events
const events=ref<HataskPlannerEvent[]>([]);
const td=()=>localDateKey();
const newEvent = ref({ title: '', emoji: '⭐', date: td(), timeStart: '14:00', dateEnd: td(), timeEnd: '15:00', color: '#e27d60', visibility: 'private', visibleUserIds: [] as string[], rsvp: false, notify: true, notifyTimings: ['15分前', '30分前'], allDay: false, recurrence: { frequency: 'none' as HataskRecurrenceFrequency, interval: 1 } });
const eventCaptureRef=ref<{focus:()=>void}|null>(null);
const eventCaptureState=ref<'idle'|'saving'|'success'|'error'>('idle');
const showEventDetails=ref(false);
const showEventTemplates=ref(false);
const eventCaptureEditor=ref<'date'|'time'|null>(null);
const eventDetailsCloseRef = ref<HTMLButtonElement | null>(null);
const eventDetailsTitleRef = ref<HTMLInputElement | null>(null);
const eventDetailsZIndex = ref<number>();
let eventDetailsReturnFocus: HTMLElement | null = null;

function openEventDetailsModal(focusTitle = false): void {
	eventDetailsReturnFocus = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
	// Share the modal stack so member pickers and template dialogs can open above this editor.
	eventDetailsZIndex.value = os.claimZIndex('low');
	showEventDetails.value = true;
	showEventTemplates.value = false;
	eventCaptureEditor.value = null;
	nextTick(() => (focusTitle ? eventDetailsTitleRef.value : eventDetailsCloseRef.value)?.focus());
}

function closeEventDetailsModal(): void {
	showEventDetails.value = false;
	const returnFocus = eventDetailsReturnFocus;
	eventDetailsReturnFocus = null;
	nextTick(() => {
		if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
		else eventCaptureRef.value?.focus();
	});
}

function clockPlusMinutes(value:string,minutes:number):string{const match=/^(\d{2}):(\d{2})$/.exec(value);if(!match)return'15:00';const total=(Number(match[1])*60+Number(match[2])+minutes+1440)%1440;return`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function applyEventCaptureSyntax(value:string,force=false):void{
	newEvent.value.title=value;if(!force&&!/\s$/.test(value))return;
	const parsed=parseHataskCapture(value,{allowFolder:false,allowPriority:false});if(parsed.recognized.length===0)return;
	newEvent.value.title=parsed.title;
	if(parsed.date){newEvent.value.date=parsed.date;newEvent.value.dateEnd=parsed.date}
	if(parsed.time){newEvent.value.allDay=false;newEvent.value.timeStart=parsed.time;newEvent.value.timeEnd=clockPlusMinutes(parsed.time,60)}
}
function updateEventCapture(value:string):void{applyEventCaptureSyntax(value)}
const eventCaptureChips=computed<HataskCaptureChip[]>(()=>{
	const dateLabel=eventDateRangeLabel(newEvent.value);
	const timeLabel=newEvent.value.allDay?copy.allDay:`${newEvent.value.timeStart}–${newEvent.value.timeEnd}`;
	const visibilityLabel = hataskEventVisibilityLabel(newEvent.value.visibility, copy, plannerCopy.memberVisibility);
	const chips:HataskCaptureChip[]=[{id:'date',label:dateLabel,icon:'ti ti-calendar-event',actionLabel:`${copy.dateAndTime}: ${dateLabel}`,actionIcon:'ti ti-pencil'}];
	chips.push({id:newEvent.value.allDay?'allDay':'time',label:timeLabel,icon:newEvent.value.allDay?'ti ti-sun':'ti ti-clock',actionLabel:`${copy.time}: ${timeLabel}`,actionIcon:'ti ti-pencil'});
	chips.push({ id: 'visibility', label: visibilityLabel, icon: hataskEventVisibilityIcon(newEvent.value.visibility), actionLabel: `${copy.visibility}: ${visibilityLabel}`, actionIcon: 'ti ti-arrows-exchange' });
	if(newEvent.value.recurrence.frequency!=='none'){const label=recurrenceLabel(newEvent.value.recurrence.frequency);chips.push({id:'recurrence',label,icon:'ti ti-repeat',actionLabel:`${plannerCopy.recurrence}: ${label}`,actionIcon:'ti ti-arrows-exchange'})}
	return chips;
});
const eventCaptureTools=computed<HataskCaptureTool[]>(()=>[
	{id:'date',label:copy.dateAndTime,icon:'ti ti-calendar-event'},
	{id:'all-day',label:copy.allDayFull,icon:'ti ti-sun',active:newEvent.value.allDay},
	{ id: 'visibility', label: copy.visibility, icon: hataskEventVisibilityIcon(newEvent.value.visibility), active: newEvent.value.visibility !== 'private' },
	{ id: 'repeat', label: plannerCopy.recurrence, icon: 'ti ti-repeat', active: newEvent.value.recurrence.frequency !== 'none', disabled: newEvent.value.visibility !== 'private' },
	{id:'details',label:plannerCopy.moreDetails,icon:'ti ti-adjustments-horizontal',active:showEventDetails.value},
]);
function removeEventCaptureChip(id:string):void{
	if(id==='date'){newEvent.value.date=selectedDateStr.value||localDateKey();newEvent.value.dateEnd=newEvent.value.date}
	else if(id==='time'||id==='allDay')newEvent.value.allDay=!newEvent.value.allDay;
	else if(id==='visibility'){newEvent.value.visibility='private';newEvent.value.rsvp=false}
	else if(id==='recurrence')newEvent.value.recurrence.frequency='none';
}
function eventDurationDays():number{
	const start=parseIsoDate(newEvent.value.date);const end=parseIsoDate(newEvent.value.dateEnd||newEvent.value.date);
	return Math.max(0,Math.round((end.getTime()-start.getTime())/86400000));
}
function setEventStartDate(value:string):void{
	if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
	const duration=eventDurationDays();newEvent.value.date=value;newEvent.value.dateEnd=localDateKey(addCalendarDays(parseIsoDate(value),duration));
}
function setEventEndDate(value:string):void{
	if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;newEvent.value.dateEnd=value<newEvent.value.date?newEvent.value.date:value;
}
function setEventStartTime(value:string):void{
	if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return;newEvent.value.allDay=false;newEvent.value.timeStart=value;
	if(newEvent.value.date===newEvent.value.dateEnd&&newEvent.value.timeEnd<=value){const next=clockPlusMinutes(value,60);newEvent.value.timeEnd=next;if(next<=value)newEvent.value.dateEnd=localDateKey(addCalendarDays(parseIsoDate(newEvent.value.date),1))}
}
function setEventEndTime(value:string):void{
	if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return;newEvent.value.allDay=false;newEvent.value.timeEnd=value;
	if(newEvent.value.date===newEvent.value.dateEnd&&value<newEvent.value.timeStart)newEvent.value.dateEnd=localDateKey(addCalendarDays(parseIsoDate(newEvent.value.date),1));
}
function setEventVisibility(visibility:'private' | 'public' | 'specified'):void {
	newEvent.value.visibility = visibility;
	if (visibility === 'private')newEvent.value.rsvp = false; else newEvent.value.recurrence.frequency = 'none';
}

function toggleEventCaptureVisibility(anchor?:HTMLElement):void{
	void popupMenu([
		{ text: copy.private, icon: 'ti ti-lock', action: () => setEventVisibility('private') },
		{ text: copy.public, icon: 'ti ti-world', action: () => setEventVisibility('public') },
		{ text: plannerCopy.memberVisibility, icon: 'ti ti-users', action: () => setEventVisibility('specified') },
	], anchor);
}

async function saveEventMemberTemplate(name:string, ids:string[]):Promise<void> {
	if (!ids.length || ids.length > 100) throw new Error('Invalid member selection');
	const template:HataskPlannerTemplate = { id: generateId(), kind: 'members', name, position: plannerTemplatePosition(), archivedAt: null, createdAt: new Date().toISOString(), payload: { visibleUserIds: [...ids] } };
	await savePlannerTemplates([...plannerTemplates.value, template]);
}

async function removeEventMemberTemplate(id:string):Promise<void> {
	await savePlannerTemplates(plannerTemplates.value.map(template => template.id === id && template.kind === 'members' ? { ...template, archivedAt: new Date().toISOString() } : template));
}
async function handleEventCaptureChip(id:string, anchor?:HTMLElement):Promise<void>{
	if(id==='date'){eventCaptureEditor.value=eventCaptureEditor.value==='date'?null:'date';showEventDetails.value=false;showEventTemplates.value=false;return}
	if(id==='time'||id==='allDay'){eventCaptureEditor.value=eventCaptureEditor.value==='time'?null:'time';showEventDetails.value=false;showEventTemplates.value=false;return}
	if(id==='visibility'){toggleEventCaptureVisibility(anchor);return}
	if(id==='recurrence')await handleEventCaptureTool('repeat');
}
async function handleEventCaptureTool(id:string, anchor?:HTMLElement):Promise<void>{
	if (id === 'details') {
		if (showEventDetails.value) closeEventDetailsModal();
		else openEventDetailsModal();
		return;
	}
	if(id==='date'){eventCaptureEditor.value=eventCaptureEditor.value==='date'?null:'date';showEventDetails.value=false;showEventTemplates.value=false;return}
	if(id==='all-day'){eventCaptureEditor.value=eventCaptureEditor.value==='time'?null:'time';showEventDetails.value=false;showEventTemplates.value=false;return}
	if(id==='visibility'){toggleEventCaptureVisibility(anchor);return}
	if(id==='repeat'&&newEvent.value.visibility==='private'){const frequencies:HataskRecurrenceFrequency[]=['none','daily','weekly','monthly','yearly'];newEvent.value.recurrence.frequency=frequencies[(frequencies.indexOf(newEvent.value.recurrence.frequency)+1)%frequencies.length]}
}
async function saveEventCaptureAsTemplate():Promise<void>{
	applyEventCaptureSyntax(newEvent.value.title,true);const title=newEvent.value.title.trim();if(!title){eventCaptureRef.value?.focus();return}
	const {canceled,result}=await dialogs.inputText({title:plannerCopy.saveTemplate,text:plannerCopy.templateNamePrompt,default:title,minLength:1,maxLength:80});const name=typeof result==='string'?result.trim():'';if(canceled||!name)return;
	const start=parseIsoDate(newEvent.value.date);const end=parseIsoDate(newEvent.value.dateEnd||newEvent.value.date);const durationDays=Math.max(0,Math.round((end.getTime()-start.getTime())/86400000));
	const template:HataskPlannerTemplate = { id: generateId(), kind: 'event', name, position: plannerTemplatePosition(), archivedAt: null, createdAt: new Date().toISOString(), payload: { title, visibility: newEvent.value.visibility === 'specified' ? 'specified' : 'private', visibleUserIds: newEvent.value.visibility === 'specified' ? [...newEvent.value.visibleUserIds] : [], rsvp: newEvent.value.visibility === 'specified' && newEvent.value.rsvp, emoji: newEvent.value.emoji, timeStart: newEvent.value.timeStart, timeEnd: newEvent.value.timeEnd, durationDays, allDay: newEvent.value.allDay, color: newEvent.value.color, notify: newEvent.value.notify, notifyTimings: [...newEvent.value.notifyTimings], recurrence: { ...newEvent.value.recurrence } } };
	await savePlannerTemplates([...plannerTemplates.value,template]);os.toast(plannerCopy.templateSaved);
}
async function submitEventCapture():Promise<void>{
	applyEventCaptureSyntax(newEvent.value.title,true);if(!newEvent.value.title.trim()){eventCaptureRef.value?.focus();return}
	eventCaptureState.value='saving';const saved=await addEvent();eventCaptureState.value=saved?'success':'error';if(saved)window.setTimeout(()=>{if(eventCaptureState.value==='success')eventCaptureState.value='idle'},900);
}
function eDateTimeKey(event:{date:string;timeStart?:string;allDay?:boolean}):string{return`${event.date}T${event.allDay?'00:00':event.timeStart||'23:59'}`}
const upcomingEvents=computed(()=>visibleCalendarEvents.value.filter(e=>e.date>=td()).sort((a,b)=>eDateTimeKey(a).localeCompare(eDateTimeKey(b))));
function goToEvent(event: any, openDetails = true): void {
	activeTab.value = 'cal';
	const date = parseIsoDate(event.date);
	calYear.value = date.getFullYear();
	calMonth.value = date.getMonth();
	selectedDay.value = date.getDate();
	if (openDetails) openEventDetail(event);
	else closeEventDetail();
}
function eventApiPayload(event:any){
	return { title: event.title, emoji: event.emoji || '📅', date: event.date, dateEnd: event.dateEnd || '', timeStart: event.allDay ? '' : event.timeStart || '', timeEnd: event.allDay ? '' : event.timeEnd || '', allDay: Boolean(event.allDay), color: event.color || '#e27d60', rsvp: Boolean(event.rsvp), visibility: event.visibility === 'specified' ? 'specified' as const : 'public' as const, visibleUserIds: event.visibility === 'specified' ? [...(event.visibleUserIds ?? [])] : [] };
}
function isValidPlannerEventInput(event:any):boolean{
	const datePattern=/^\d{4}-\d{2}-\d{2}$/;
	if(!datePattern.test(event.date)||!datePattern.test(event.dateEnd||event.date))return false;
	const start=parseIsoDate(event.date);const end=parseIsoDate(event.dateEnd||event.date);
	if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||event.dateEnd<event.date)return false;
	if(!event.allDay&&(!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.timeStart)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(event.timeEnd)))return false;
	if(!event.allDay&&event.date===event.dateEnd&&event.timeEnd<event.timeStart)return false;
	return true;
}
function resetEventEditor():void{
	editingEvent.value=null;
	newEvent.value = { title: '', emoji: '⭐', date: selectedDateStr.value || td(), timeStart: '14:00', dateEnd: selectedDateStr.value || td(), timeEnd: '15:00', color: '#e27d60', visibility: 'private', visibleUserIds: [] as string[], rsvp: false, notify: true, notifyTimings: ['15分前', '30分前'], allDay: false, recurrence: { frequency: 'none', interval: 1 } };
	showEventDetails.value=false;showEventTemplates.value=false;eventCaptureEditor.value=null;
}
async function addEvent():Promise<boolean>{
	if(plannerReadOnly.value||!newEvent.value.title.trim())return false;
	const isEditing=editingEvent.value!=null;
	const previous=editingEvent.value as HataskPlannerEvent|null;
	const now=new Date().toISOString();
	const visibility = newEvent.value.visibility === 'specified' ? 'specified' : newEvent.value.visibility === 'public' ? 'public' : 'private';
	if (visibility === 'specified' && !newEvent.value.visibleUserIds.length) {os.toast(plannerCopy.eventMembersRequired); return false;}
	const recurrence = visibility !== 'private' ? { frequency: 'none' as const, interval: 1 } : { ...newEvent.value.recurrence };
	let nextEvent:HataskPlannerEvent={
		...(previous??{}),
		id:previous?.id||generateId(),
		clientEventId:previous?.clientEventId||previous?.id,
		title:newEvent.value.title.trim(),emoji:newEvent.value.emoji,date:newEvent.value.date,dateEnd:newEvent.value.dateEnd,
		color: newEvent.value.color, visibility, visibleUserIds: visibility === 'specified' ? [...newEvent.value.visibleUserIds] : [], rsvp: visibility !== 'private' && newEvent.value.rsvp, notify: newEvent.value.notify,
		notifyTimings:[...newEvent.value.notifyTimings],allDay:newEvent.value.allDay,recurrence,
		archivedAt:previous?.archivedAt??null,createdAt:previous?.createdAt??now,updatedAt:now,
	};
	nextEvent.clientEventId=nextEvent.clientEventId||nextEvent.id;
	if(nextEvent.allDay){
		nextEvent.timeStart='';nextEvent.timeEnd='';
		nextEvent.timeLabel=nextEvent.date+(nextEvent.dateEnd!==nextEvent.date?` ~ ${nextEvent.dateEnd}`:'')+` ${copy.allDay}`;
	}else{
		nextEvent.timeStart=newEvent.value.timeStart;nextEvent.timeEnd=newEvent.value.timeEnd;
		nextEvent.timeLabel=`${nextEvent.date} ${nextEvent.timeStart} - ${nextEvent.timeEnd}`;
	}
	if(!isValidPlannerEventInput(nextEvent)){os.toast(plannerCopy.invalidEventSchedule);return false}

	const wasPublic = previous != null && isSharedHataskEvent(previous);
	let serverEventId=previous?.serverEventId;
	let serverEventRevision=String(previous?.serverEventRevision||'')||undefined;
	if(wasPublic&&!serverEventId){
		serverEventId=findUniqueOwnedServerId(previous)??undefined;
		const server=serverEventId?sharedEvents.value.find(event=>event.id===serverEventId):null;
		serverEventRevision=server?.revision;
	}
	try{
		if(wasPublic&&visibility==='private'){
		if(!serverEventId){os.toast(plannerCopy.publicSyncUnlinked);return false}
			nextEvent = { ...nextEvent, visibility: previous.visibility, serverEventId, serverEventRevision, publicSyncState: 'deleting', pendingVisibility: 'private' };
		} else if (wasPublic && visibility !== 'private') {
			if(!serverEventId||!serverEventRevision){os.toast(plannerCopy.publicSyncUnlinked);return false}
			nextEvent={...nextEvent,serverEventId,serverEventRevision,publicSyncState:'updating'};
		} else if (!wasPublic && visibility !== 'private') {
			nextEvent={...nextEvent,publicSyncState:'creating'};
		}

		const existingIndex=events.value.findIndex(event=>event.id===nextEvent.id);
		const nextEvents=[...events.value];
		if(existingIndex>=0)nextEvents.splice(existingIndex,1,nextEvent);else nextEvents.unshift(nextEvent);
		// 必ず先にintentを永続化する。外部API成功後のローカルCAS失敗でも次回再開できる。
		await registrySet('events',nextEvents);
		events.value=nextEvents;
		resetEventEditor();
		scheduleEventNotifications();
		await processPublicEventOutbox();
		const saved=events.value.find(event=>event.id===nextEvent.id);
		const publicSyncState=String(saved?.publicSyncState||'');
		const publicSyncPending=Boolean(publicSyncState);
		await loadSharedEvents();
		os.toast(publicSyncState==='conflict'?plannerCopy.publicSyncConflict:publicSyncState==='unlinked'?plannerCopy.publicSyncUnlinked:publicSyncState==='sync-error'?plannerCopy.publicSyncFailed:publicSyncPending?plannerCopy.publicSyncPending:isEditing?copy.eventUpdated:copy.eventSaved);

		if(!isEditing&&visibility==='public'&&nextEvent.rsvp&&!publicSyncPending){
			const timeInfo=nextEvent.allDay?`${nextEvent.date} ${copy.allDay}`:`${nextEvent.date} ${nextEvent.timeStart}〜${nextEvent.timeEnd}`;
			try{await misskeyApi('notes/create',{text:copyx.rsvpAnnouncement({emoji:nextEvent.emoji||'📅',title:nextEvent.title,time:timeInfo}),visibility:'home'})}catch(error){console.warn('RSVP announcement note failed:',error)}
		}
		return true;
	}catch(error){
		console.error('Hatask event save failed:',error);
		os.toast(plannerCopy.publicSyncFailed);
		return false;
	}
}

// Todo
const newTodo=ref('');const newTodoDue=ref('');const newTodoTime=ref('');const newTodoFolder=ref('');const newTodoComment=ref('');
const newTodoPriority=ref<'none'|'low'|'medium'|'high'>('none');
const newTodoRecurrence=ref<HataskRecurrenceFrequency>('none');
const newTodoSubtasks=ref<Array<{id:string;text:string;done:boolean}>>([]);
const newSubtaskText=ref('');
const todoCaptureRef=ref<{focus:()=>void}|null>(null);
const todoCaptureState=ref<'idle'|'saving'|'success'|'error'>('idle');
const todoCaptureEditor=ref<'schedule'|null>(null);
const showTodoExtra=ref(false);const activeFolder=ref('all');const showFolderMgr=ref(false);const showFolderCreate=ref(false);
const newFolderName=ref('');const newFolderEmoji=ref('📁');const newFolderColor=ref('');
const folderColors=computed(() => [{value:'#e57373',label:copy.colorRed},{value:'#ffb74d',label:copy.colorOrange},{value:'#fff176',label:copy.colorYellow},{value:'#81c784',label:copy.colorGreen},{value:'#64b5f6',label:copy.colorBlue},{value:'#ba68c8',label:copy.colorPurple}]);
const todos=ref<HataskPlannerTodo[]>([]);const folders=ref<HataskPlannerFolder[]>([]);
const activeFolders=computed(()=>folders.value.filter(folder=>folder.archivedAt==null).sort((a,b)=>(a.position??0)-(b.position??0)));
function folderCount(fid:string){return todos.value.filter(t=>!t.done&&t.archivedAt==null&&t.folder===fid).length}
function getFolder(fid:string){return folders.value.find(f=>f.id===fid)}

function applyTodoCaptureSyntax(value:string,force=false):void{
	newTodo.value=value;
	if(!force&&!/\s$/.test(value))return;
	const parsed=parseHataskCapture(value,{folders:activeFolders.value,allowFolder:true,allowPriority:true});
	if(parsed.recognized.length===0)return;
	newTodo.value=parsed.title;
	if(parsed.date)newTodoDue.value=parsed.date;
	if(parsed.time)newTodoTime.value=parsed.time;
	if(parsed.folderId)newTodoFolder.value=parsed.folderId;
	if(parsed.priority)newTodoPriority.value=parsed.priority;
}
function updateTodoCapture(value:string):void{applyTodoCaptureSyntax(value)}
const todoCaptureChips=computed<HataskCaptureChip[]>(()=>{
	const chips:HataskCaptureChip[]=[];
	if(newTodoDue.value){const label=formatDue(newTodoDue.value);chips.push({id:'date',label,icon:'ti ti-calendar-event',actionLabel:`${copy.dueDate}: ${label}`,actionIcon:'ti ti-pencil'})}
	if(newTodoTime.value)chips.push({id:'time',label:newTodoTime.value,icon:'ti ti-clock',actionLabel:`${copy.time}: ${newTodoTime.value}`,actionIcon:'ti ti-pencil'});
	const folder=getFolder(newTodoFolder.value);if(folder)chips.push({id:'folder',label:folder.name,icon:'ti ti-folder-filled',color:folder.color,actionLabel:`${copy.folder}: ${folder.name}`,actionIcon:'ti ti-chevron-down'});
	if(newTodoPriority.value!=='none'){const label=plannerTodoPriorityLabel(newTodoPriority.value);chips.push({id:'priority',label,icon:'ti ti-flag-filled',actionLabel:`${plannerCopy.priority}: ${label}`,actionIcon:'ti ti-chevron-down'})}
	if(newTodoRecurrence.value!=='none'){const label=recurrenceLabel(newTodoRecurrence.value);chips.push({id:'recurrence',label,icon:'ti ti-repeat',actionLabel:`${plannerCopy.recurrence}: ${label}`,actionIcon:'ti ti-chevron-down'})}
	return chips;
});
const todoCaptureTools=computed<HataskCaptureTool[]>(()=>[
	{id:'date',label:copy.dueDate,icon:'ti ti-calendar-event',active:Boolean(newTodoDue.value)},
	{id:'folder',label:copy.folder,icon:'ti ti-folder',active:Boolean(newTodoFolder.value)},
	{id:'priority',label:plannerCopy.priority,icon:'ti ti-flag',active:newTodoPriority.value!=='none'},
	{id:'repeat',label:plannerCopy.recurrence,icon:'ti ti-repeat',active:newTodoRecurrence.value!=='none'},
	{id:'details',label:plannerCopy.moreDetails,icon:'ti ti-adjustments-horizontal',active:showTodoExtra.value},
]);
function plannerTodoPriorityLabel(priority:'none'|'low'|'medium'|'high'):string{return priority==='high'?plannerCopy.priorityHigh:priority==='medium'?plannerCopy.priorityMedium:priority==='low'?plannerCopy.priorityLow:plannerCopy.priorityNone}
function removeTodoCaptureChip(id:string):void{
	if(id==='date')newTodoDue.value='';
	else if(id==='time')newTodoTime.value='';
	else if(id==='folder')newTodoFolder.value='';
	else if(id==='priority')newTodoPriority.value='none';
	else if(id==='recurrence')newTodoRecurrence.value='none';
}
async function chooseTodoFolder():Promise<void>{
	const {canceled,result}=await dialogs.actions({type:'question',title:copy.folder,actions:[{value:'',text:copy.noFolder},...activeFolders.value.map(folder=>({value:folder.id,text:`${folder.emoji||'📁'} ${folder.name}`}))]});
	if(!canceled&&typeof result==='string')newTodoFolder.value=result;
}
async function chooseTodoPriority():Promise<void>{
	const priorities=['none','low','medium','high'] as const;
	const {canceled,result}=await dialogs.actions({type:'question',title:plannerCopy.priority,actions:priorities.map(value=>({value,text:plannerTodoPriorityLabel(value)}))});
	if(!canceled&&priorities.includes(result as typeof priorities[number]))newTodoPriority.value=result as typeof priorities[number];
}
async function chooseTodoRecurrence():Promise<void>{
	const frequencies:HataskRecurrenceFrequency[]=['none','daily','weekly','monthly','yearly'];
	const {canceled,result}=await dialogs.actions({type:'question',title:plannerCopy.recurrence,actions:frequencies.map(value=>({value,text:recurrenceLabel(value)}))});
	if(!canceled&&frequencies.includes(result as HataskRecurrenceFrequency))newTodoRecurrence.value=result as HataskRecurrenceFrequency;
}
async function handleTodoCaptureChip(id:string):Promise<void>{
	if(id==='date'||id==='time'){todoCaptureEditor.value=todoCaptureEditor.value==='schedule'?null:'schedule';showTodoExtra.value=false;return}
	if(id==='folder'){await chooseTodoFolder();return}
	if(id==='priority'){await chooseTodoPriority();return}
	if(id==='recurrence')await chooseTodoRecurrence();
}
async function handleTodoCaptureTool(id:string):Promise<void>{
	if(id==='details'){showTodoExtra.value=!showTodoExtra.value;if(showTodoExtra.value)todoCaptureEditor.value=null;return}
	if(id==='date'){if(!newTodoDue.value)newTodoDue.value=localDateKey();todoCaptureEditor.value=todoCaptureEditor.value==='schedule'?null:'schedule';showTodoExtra.value=false;return}
	if(id==='folder'){await chooseTodoFolder();return}
	if(id==='priority'){await chooseTodoPriority();return}
	if(id==='repeat'){await chooseTodoRecurrence();return}
}

function openPlannerCaptureTemplates(kind: 'todo' | 'event', event: MouseEvent): void {
	if (plannerReadOnly.value || !plannerTemplatesLoaded.value) return;
	popupMenu([
		{ text: plannerCopy.useTemplates, icon: 'ti ti-template', action: () => {
			if (kind === 'todo') {
				templateKindFilter.value = 'todo';
				plannerTodoView.value = 'templates';
				showTodoExtra.value = false;
				todoCaptureEditor.value = null;
			} else {
				showEventTemplates.value = true;
				showEventDetails.value = false;
				eventCaptureEditor.value = null;
			}
		} },
		{ text: plannerCopy.saveTemplate, icon: 'ti ti-bookmark-plus', disabled: !(kind === 'todo' ? newTodo.value : newEvent.value.title).trim(), action: () => kind === 'todo' ? saveTodoCaptureAsTemplate() : saveEventCaptureAsTemplate() },
	], event.currentTarget as HTMLElement, { motionPreset: 'postform' });
}

const plannerTemplateLabels=computed<HataskTemplateLabels>(()=>({
	library:plannerCopy.templateLibrary,reusable:plannerCopy.reusableTemplates,filter:plannerCopy.filter,all:copy.all,todo:plannerCopy.todo,event:plannerCopy.calendar,
	empty:plannerCopy.noTemplates,emptyHint:plannerCopy.templateEmptyHint,useAction:plannerCopy.useTemplateAction,
	use:name=>plannerCopyx.useTemplateLabel({name}),duplicate:name=>plannerCopyx.duplicateTemplateLabel({name}),archive:name=>plannerCopyx.archiveTemplateLabel({name}),
	moveUp:name=>plannerCopyx.moveTemplateUpLabel({name}),moveDown:name=>plannerCopyx.moveTemplateDownLabel({name}),
}));
function plannerTemplatePosition():number{return plannerTemplates.value.reduce((maximum,template)=>Math.max(maximum,template.position??-1),-1)+1}
function todoTemplateDuePreset(date:string):'none'|'today'|'tomorrow'|'absolute'{
	if(!date)return'none';if(date===localDateKey())return'today';if(date===localDateKey(addCalendarDays(new Date(),1)))return'tomorrow';return'absolute';
}
function resolvedTodoTemplateDue(payload:Record<string,unknown>):string{
	if(payload.duePreset==='today')return localDateKey();
	if(payload.duePreset==='tomorrow')return localDateKey(addCalendarDays(new Date(),1));
	return payload.duePreset==='absolute'&&typeof payload.due==='string'?payload.due:'';
}
async function saveTodoCaptureAsTemplate():Promise<void>{
	applyTodoCaptureSyntax(newTodo.value,true);
	const text=newTodo.value.trim();if(!text){todoCaptureRef.value?.focus();return}
	const {canceled,result}=await dialogs.inputText({title:plannerCopy.saveTemplate,text:plannerCopy.templateNamePrompt,default:text,minLength:1,maxLength:80});
	const name=typeof result==='string'?result.trim():'';if(canceled||!name)return;
	const duePreset=todoTemplateDuePreset(newTodoDue.value);
	const template:HataskPlannerTemplate={
		id:generateId(),kind:'todo',name,position:plannerTemplatePosition(),archivedAt:null,createdAt:new Date().toISOString(),
		payload:{text,duePreset,due:newTodoDue.value,dueLabel:newTodoDue.value?formatDue(newTodoDue.value):'',time:newTodoTime.value,folder:newTodoFolder.value,comment:newTodoComment.value,priority:newTodoPriority.value,subtasks:newTodoSubtasks.value.map(subtask=>({...subtask,id:generateId(),done:false})),recurrence:{frequency:newTodoRecurrence.value,interval:1}},
	};
	await savePlannerTemplates([...plannerTemplates.value,template]);os.toast(plannerCopy.templateSaved);
}
function loadTodoTemplate(template:HataskPlannerTemplate):void{
	const payload=template.payload;
	resetTodoEditor();
	newTodo.value=typeof payload.text==='string'?payload.text:template.name;
	newTodoDue.value=resolvedTodoTemplateDue(payload);
	newTodoTime.value=typeof payload.time==='string'?payload.time:'';
	newTodoFolder.value=typeof payload.folder==='string'&&activeFolders.value.some(folder=>folder.id===payload.folder)?payload.folder:'';
	newTodoComment.value=typeof payload.comment==='string'?payload.comment:'';
	newTodoPriority.value=payload.priority==='low'||payload.priority==='medium'||payload.priority==='high'?payload.priority:'none';
	const recurrence=payload.recurrence as {frequency?:unknown}|undefined;
	newTodoRecurrence.value=recurrence?.frequency==='daily'||recurrence?.frequency==='weekly'||recurrence?.frequency==='monthly'||recurrence?.frequency==='yearly'?recurrence.frequency:'none';
	newTodoSubtasks.value=Array.isArray(payload.subtasks)?payload.subtasks.flatMap(raw=>raw!=null&&typeof raw==='object'&&typeof (raw as {text?:unknown}).text==='string'?[{id:generateId(),text:(raw as {text:string}).text,done:false}]:[]):[];
	showTodoExtra.value=Boolean(newTodoDue.value||newTodoTime.value||newTodoFolder.value||newTodoComment.value||newTodoPriority.value!=='none'||newTodoRecurrence.value!=='none'||newTodoSubtasks.value.length);
	nextTick(()=>todoCaptureRef.value?.focus());
}
function loadEventTemplate(template:HataskPlannerTemplate):void{
	const payload=template.payload;activeTab.value='cal';resetEventEditor();
	const anchor=selectedDateStr.value||localDateKey();const durationDays=typeof payload.durationDays==='number'&&Number.isFinite(payload.durationDays)?Math.max(0,Math.floor(payload.durationDays)):0;
	const recurrence=payload.recurrence as {frequency?:unknown;interval?:unknown}|undefined;
	const frequency:HataskRecurrenceFrequency=recurrence?.frequency==='daily'||recurrence?.frequency==='weekly'||recurrence?.frequency==='monthly'||recurrence?.frequency==='yearly'?recurrence.frequency:'none';
	newEvent.value={
		...newEvent.value,title:typeof payload.title==='string'?payload.title:template.name,emoji:typeof payload.emoji==='string'?payload.emoji:'⭐',
		date:anchor,dateEnd:localDateKey(addCalendarDays(parseIsoDate(anchor),durationDays)),timeStart:typeof payload.timeStart==='string'?payload.timeStart:'14:00',timeEnd:typeof payload.timeEnd==='string'?payload.timeEnd:'15:00',
		color: typeof payload.color === 'string' ? payload.color : '#e27d60', visibility: payload.visibility === 'specified' ? 'specified' : 'private', visibleUserIds: Array.isArray(payload.visibleUserIds) ? payload.visibleUserIds.filter((id):id is string => typeof id === 'string') : [], rsvp: payload.visibility === 'specified' && payload.rsvp === true, notify: payload.notify !== false, notifyTimings: Array.isArray(payload.notifyTimings) ? payload.notifyTimings.filter((item):item is string => typeof item === 'string') : ['15分前'], allDay: payload.allDay === true,
		recurrence: { frequency: payload.visibility === 'specified' ? 'none' : frequency, interval: typeof recurrence?.interval === 'number' && recurrence.interval > 0 ? Math.floor(recurrence.interval) : 1 },
	};
	showEventTemplates.value=false;
	nextTick(()=>eventCaptureRef.value?.focus());
}
function usePlannerTemplate(template:HataskPlannerTemplate):void {if (template.kind === 'todo')loadTodoTemplate(template); else if (template.kind === 'event')loadEventTemplate(template);}

async function duplicatePlannerTemplate(template:HataskPlannerTemplate):Promise<void>{
	const duplicate:HataskPlannerTemplate={...template,id:generateId(),name:plannerCopyx.templateCopyName({name:template.name}),position:plannerTemplatePosition(),createdAt:new Date().toISOString(),updatedAt:undefined,archivedAt:null,payload:{...template.payload}};
	await savePlannerTemplates([...plannerTemplates.value,duplicate]);
}
async function archivePlannerTemplate(template:HataskPlannerTemplate):Promise<void>{
	const {canceled}=await dialogs.confirm({type:'warning',text:plannerCopyx.confirmArchiveTemplate({name:template.name})});if(canceled)return;
	const next=plannerTemplates.value.map(item=>item.id===template.id?{...item,archivedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}:item);await savePlannerTemplates(next);
}
async function movePlannerTemplate(template:HataskPlannerTemplate,direction:-1|1):Promise<void>{
	const visible=plannerTemplates.value.filter(item=>item.archivedAt==null&&(templateKindFilter.value==='all'||item.kind===templateKindFilter.value)).sort((a,b)=>a.position-b.position);
	const index=visible.findIndex(item=>item.id===template.id);const other=visible[index+direction];if(!other)return;
	const next=plannerTemplates.value.map(item=>item.id===template.id?{...item,position:other.position}:item.id===other.id?{...item,position:template.position}:item);await savePlannerTemplates(next);
}

// ===== Calendar / Todo redesign controlled models =====
const plannerTheme=computed<HataskPlannerTheme>(()=>{
	const theme = settings.value.theme || 'akatsuki';
	return theme === 'akatsuki' || theme === 'koke' ? theme : theme === 'kashin' || theme === 'suri' || theme === 'hatakyu' || theme === 'halloween' ? theme : 'kisetsu';
});
const plannerReadOnly=computed(()=>plannerStorageState.value!=='ready'&&plannerStorageState.value!=='saved');
const plannerCalendarView=ref<HataskCalendarView>('month');
const plannerCalendarFilterIds=ref<Array<'private'|'public'|'shared'>>(['private','public','shared']);

function addCalendarDays(date:Date,amount:number):Date{const next=new Date(date);next.setDate(next.getDate()+amount);return next}
function plannerAnchorDate():Date{return new Date(calYear.value,calMonth.value,selectedDay.value??1,12)}
function setPlannerAnchor(date:Date):void{calYear.value=date.getFullYear();calMonth.value=date.getMonth();selectedDay.value=date.getDate();viewingEvent.value=null}
function startOfPlannerWeek(date:Date):Date{
	const start=settings.value.weekStart==='sun'?0:1;
	return addCalendarDays(date,-((date.getDay()-start+7)%7));
}
const plannerWeekdays=computed<HataskCalendarWeekday[]>(()=>{
	const start=settings.value.weekStart==='sun'?new Date(2024,0,7):new Date(2024,0,1);
	return Array.from({length:7},(_,index)=>{const date=addCalendarDays(start,index);return{id:String(date.getDay()),label:weekdayShortFormatter.format(date),isWeekend:date.getDay()===0||date.getDay()===6}});
});
const plannerCalendarDates=computed<Date[]>(()=>{
	const anchor=plannerAnchorDate();
	if(plannerCalendarView.value==='month'){
		const first=new Date(calYear.value,calMonth.value,1,12);
		const start=startOfPlannerWeek(first);
		return Array.from({length:42},(_,index)=>addCalendarDays(start,index));
	}
	if(plannerCalendarView.value==='week'){
		const start=startOfPlannerWeek(anchor);
		return Array.from({length:7},(_,index)=>addCalendarDays(start,index));
	}
	if(plannerCalendarView.value==='day')return[anchor];
	return Array.from({length:30},(_,index)=>addCalendarDays(anchor,index));
});
function plannerEventSource(event:any):'private'|'public'|'shared'{
	const sourceId=event.sourceEventId||event.id;
	const local=events.value.find(item=>item.id===sourceId);
	return local ? (isSharedHataskEvent(local) ? 'public' : 'private') : 'shared';
}
function plannerEventForDate(date:string):any[]{
	return visibleCalendarEvents.value.filter(event=>{
		if(!plannerCalendarFilterIds.value.includes(plannerEventSource(event)))return false;
		return event.date===date||(event.dateEnd&&event.date<=date&&event.dateEnd>=date);
	}).sort((a,b)=>Number(b.allDay)-Number(a.allDay)||eDateTimeKey(a).localeCompare(eDateTimeKey(b)));
}
function plannerCalendarEvent(event:any):HataskCalendarEvent{
	const syncState=String(event.publicSyncState||'');
	const syncStatus=syncState==='conflict'?plannerCopy.conflict:syncState==='sync-error'?plannerCopy.syncFailed:syncState==='unlinked'?plannerCopy.syncUnlinked:['pending','creating','updating','deleting','deleting-local'].includes(syncState)?plannerCopy.syncPending:undefined;
	const sourceId=event.sourceEventId||event.id;
	const hasLocalSource=events.value.some(item=>item.id===sourceId||item.serverEventId===sourceId);
	return{
		id:event.id,
		title:event.title,
		emoji:event.emoji,
		color:event.color,
		timeLabel:eventTimeLabel(event),
		metaLabel:eventDateRangeLabel(event),
		ownerLabel:event.username?`@${event.username}`:undefined,
		statusLabel:syncStatus||(event.rsvpClosed?copy.closed:undefined),
		isAllDay:event.allDay,
		isShared:plannerEventSource(event)!=='private',
		readOnly:event.readOnly===true,
		draggable:hasLocalSource&&event.isRecurrenceOccurrence!==true,
		date:event.date,
		dateEnd:event.dateEnd||event.date,
		timeStart:event.timeStart||'',
		timeEnd:event.timeEnd||'',
	};
}
const eventViewLabels: HataskEventDetailsLabels = {
	details: i18n.ts.details, 'close': copy.close, dateAndTime: copy.dateAndTime,
	visibility: copy.visibility, organizer: copy.organizer, recurrence: plannerCopy.recurrence,
	notificationTiming: copy.notificationTiming, readOnly: plannerCopy.readOnly,
	rsvpDashboard: copy.rsvpDashboard, rsvp: copy.rsvp, closed: copy.closed,
	accepting: copy.accepting, rsvpParticipation: copy.rsvpParticipation, rsvpGoing: copy.rsvpGoing,
	rsvpMaybe: copy.rsvpMaybe, rsvpDeclined: copy.rsvpDeclined, total: copy.total,
	noResponses: copy.noResponses, closeRsvp: copy.closeRsvp,
	publicEventWithoutRsvp: copy.publicEventWithoutRsvp, edit: copy.edit, delete: copy.delete,
};

function eventViewRecurrenceLabel(recurrence: HataskPlannerEvent['recurrence'] | undefined): string | undefined {
	if (!recurrence || recurrence.frequency === 'none') return undefined;
	const interval = Math.max(1, recurrence.interval || 1).toString();
	const label = interval === '1' ? recurrenceLabel(recurrence.frequency)
		: recurrence.frequency === 'daily' ? plannerCopyx.recurrenceDailyInterval({ interval })
		: recurrence.frequency === 'weekly' ? plannerCopyx.recurrenceWeeklyInterval({ interval })
		: recurrence.frequency === 'monthly' ? plannerCopyx.recurrenceMonthlyInterval({ interval })
		: plannerCopyx.recurrenceYearlyInterval({ interval });
	const parts = [label];
	if (recurrence.frequency === 'weekly' && recurrence.weekdays?.length) {
		parts.push([...new Set(recurrence.weekdays)].sort((a, b) => a - b).map(day => weekdayShortFormatter.format(new Date(2024, 0, 7 + day))).join(' / '));
	}
	if (recurrence.until) parts.push(plannerCopyx.recurrenceUntil({ date: longDateFormatter.format(parseIsoDate(recurrence.until.slice(0, 10))) }));
	if (recurrence.count) parts.push(plannerCopyx.recurrenceCount({ count: recurrence.count.toString() }));
	return parts.join(' · ');
}

const viewingEventDetails = computed<HataskEventDetails | null>(() => {
	const selected = viewingEvent.value;
	if (!selected) return null;
	// Keep the clicked occurrence date; resolve ownership and RSVP against their sources.
	const event = allCalendarEvents.value.find(item => item.id === selected.id) ?? selected;
	const sourceId = event.sourceEventId || event.id;
	const local = events.value.find(item => item.id === sourceId || item.serverEventId === sourceId);
	const shared = sharedEventData(sourceId);
	const isOwner = Boolean($i && (shared?.userId ?? event.userId ?? (local ? $i.id : null)) === $i.id);
	const canEdit = Boolean((local || isOwner) && event.readOnly !== true && (!shared || shared.userId === $i?.id));
	const responses: NonNullable<HataskEventDetails['rsvp']>['responses'] = shared?.rsvpResponses ?? [];
	const recurrence = local?.recurrence ?? event.recurrence;
	const username = shared?.username || event.username || (isOwner ? $i?.username : undefined);
	return {
		id: event.id, title: event.title, emoji: event.emoji, color: event.color,
		dateLabel: eventDateRangeLabel(event), timeLabel: eventTimeLabel(event),
		visibilityLabel: hataskEventVisibilityLabel(event.visibility, copy, plannerCopy.memberVisibility),
		isPublic: isSharedHataskEvent(event) || Boolean(event.isShared),
		ownerLabel: username ? `@${username}` : undefined,
		recurrenceLabel: eventViewRecurrenceLabel(recurrence),
		recurrenceHint: recurrence && recurrence.frequency !== 'none' ? plannerCopy.recurrenceActionsHint : undefined,
		notificationLabel: local ? local.notify ? local.notifyTimings.map(notifyTimingLabel).join(' / ') || i18n.ts.enabled : i18n.ts.disabled : undefined,
		syncLabel: event.publicSyncState ? plannerCalendarEvent(event).statusLabel : undefined,
		canEdit, isOwner,
		rsvp: shared?.rsvp ? {
			closed: Boolean(shared.rsvpClosed),
			myStatus: responses.find(response => response.userId === $i?.id)?.status ?? null,
			responses: responses.map(response => ({ userId: response.userId, username: response.username, status: response.status })),
		} : null,
	};
});

const plannerCalendarDays=computed<HataskCalendarDay[]>(()=>plannerCalendarDates.value.map(date=>{
	const key=localDateKey(date);
	const eventList=plannerEventForDate(key);
	return{
		key,
		date:key,
		label:longDateFormatter.format(date),
		dayNumber:date.getDate(),
		weekdayLabel:weekdayShortFormatter.format(date),
		isOutsideRange:plannerCalendarView.value==='month'&&date.getMonth()!==calMonth.value,
		isToday:key===localDateKey(),
		isSelected:key===selectedDateStr.value,
		events:eventList.map(plannerCalendarEvent),
		hiddenEventCount:Math.max(0,eventList.length-3),
	};
}));
const plannerCalendarTitle=computed(()=>{
	const dates=plannerCalendarDates.value;
	if(plannerCalendarView.value==='month')return calendarTitle.value;
	if(plannerCalendarView.value==='day')return dates[0]?longDateFormatter.format(dates[0]):calendarTitle.value;
	if(!dates.length)return calendarTitle.value;
	return`${monthDayFormatter.format(dates[0])} – ${monthDayFormatter.format(dates[dates.length-1])}`;
});
const plannerCalendarFilters=computed<HataskPlannerFilter[]>(()=>[
	{ id: 'private', icon: 'ti ti-lock', label: copy.private, active: plannerCalendarFilterIds.value.includes('private'), count: visibleCalendarEvents.value.filter(event => plannerEventSource(event) === 'private').length },
	{ id: 'public', icon: 'ti ti-world', label: copy.public, active: plannerCalendarFilterIds.value.includes('public'), count: visibleCalendarEvents.value.filter(event => plannerEventSource(event) === 'public').length },
	{ id: 'shared', icon: 'ti ti-users', label: copy.organizer, active: plannerCalendarFilterIds.value.includes('shared'), count: visibleCalendarEvents.value.filter(event => plannerEventSource(event) === 'shared').length },
	{ id: 'declined', icon: 'ti ti-calendar-x', label: plannerCopy.showDeclinedInvitations, active: showDeclinedInvitations.value, count: allCalendarEvents.value.filter(isDeclinedCalendarInvitation).length },
]);
const plannerCalendarLabels=computed<HataskCalendarLabels>(()=>({
	calendar:plannerCopy.calendar,
	viewSelector:plannerCopy.calendar,
	views:{month:plannerCopy.month,week:plannerCopy.week,day:plannerCopy.day,agenda:plannerCopy.agenda},
	previousPeriod:plannerCopy.previous,
	nextPeriod:plannerCopy.next,
	today:plannerCopy.today,
	filters:plannerCopy.filters,
	allDay:copy.allDay,
	loading:plannerCopy.loading,
	empty:plannerCopy.empty,
	readOnly:plannerStorageDetail.value||plannerCopy.readOnly,
	selectedDay:plannerCopy.selectedDay,
	dragHint:plannerCopy.dragHint,
	trashHint:plannerCopy.trashHint,
		selectDate:dateLabel=>plannerCopyx.selectDateLabel({date:dateLabel}),
	openDayActions: dateLabel => plannerCopyx.openDayActionsLabel({ date: dateLabel }),
		openEvent:eventTitle=>plannerCopyx.openEventLabel({title:eventTitle}),
		editEvent:eventTitle=>plannerCopyx.editEventLabel({title:eventTitle}),
	moveEvent:eventTitle=>plannerCopyx.moveEventLabel({title:eventTitle}),
	showMore:count=>plannerCopyx.showMore({count:count.toString()}),
}));
function navigatePlannerCalendar(direction:'previous'|'next'|'today'):void{
	if(direction==='today'){goToday();return}
	const amount=direction==='previous'?-1:1;
	if(plannerCalendarView.value==='month'){chMo(amount);selectedDay.value=1;return}
	const days=plannerCalendarView.value==='week'?7:plannerCalendarView.value==='agenda'?30:1;
	setPlannerAnchor(addCalendarDays(plannerAnchorDate(),amount*days));
}
function selectPlannerDate(day:HataskCalendarDay):void{const date=parseIsoDate(day.date);setPlannerAnchor(date);newEvent.value.date=day.date;newEvent.value.dateEnd=day.date}
function showPlannerDay(day:HataskCalendarDay):void{selectPlannerDate(day);plannerCalendarView.value='day'}
function findPlannerCalendarSource(event:HataskCalendarEvent):any{return allCalendarEvents.value.find(item=>item.id===event.id)}
function activatePlannerEvent(event: HataskCalendarEvent, day: HataskCalendarDay, trigger: HTMLElement | null = null): void {
	// Viewing another event must not overwrite an unsaved event's dates.
	setPlannerAnchor(parseIsoDate(day.date));
	const source = findPlannerCalendarSource(event);
	if (source) openEventDetail(source, trigger);
}
	function plannerScrollBehavior():ScrollBehavior{return props.embedded ? 'smooth' : settings.value.animations===false||!prefer.r.animation.value||window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}

function editPlannerEvent(event: HataskCalendarEvent, day: HataskCalendarDay): void {
	if (plannerReadOnly.value) return;
	selectPlannerDate(day);
	const source = findPlannerCalendarSource(event);
	if (source) startEditEvent(source);
}

function togglePlannerCalendarFilter(filterId: string): void {
	if (filterId === 'declined') {
		showDeclinedInvitations.value = !showDeclinedInvitations.value;
		return;
	}
	if (filterId !== 'private' && filterId !== 'public' && filterId !== 'shared') return;
	const index = plannerCalendarFilterIds.value.indexOf(filterId);
	if (index >= 0) {
		if (plannerCalendarFilterIds.value.length > 1) plannerCalendarFilterIds.value.splice(index, 1);
	} else {
		plannerCalendarFilterIds.value.push(filterId);
	}
}

type PendingCalendarAction={mode:'reschedule'|'trash';event:HataskCalendarEvent;targetDate?:string;targetTime?:string};
const pendingCalendarAction=ref<PendingCalendarAction|null>(null);
const calendarMoveDialogLabels=computed<HataskEventMoveDialogLabels>(()=>({
	moveEyebrow:plannerCopy.reschedule,moveTitle:plannerCopy.moveOrCopy,moveDescription:plannerCopy.moveOrCopyDescription,move:plannerCopy.moveEvent,moveHint:plannerCopy.moveEventHint,copy:plannerCopy.copyEvent,copyHint:plannerCopy.copyEventHint,
	trashEyebrow:plannerCopy.trash,trashTitle:plannerCopy.trashEventTitle,trashDescription:plannerCopy.trashEventDescription,trash:plannerCopy.trash,cancel:copy.cancel,
}));
function calendarActionLabel(date:string|undefined,time:string|undefined):string{return date?`${formatSearchDate(date)}${time?` ${time}`:''}`:''}
const pendingCalendarActionSourceLabel=computed(()=>calendarActionLabel(pendingCalendarAction.value?.event.date,pendingCalendarAction.value?.event.isAllDay?undefined:pendingCalendarAction.value?.event.timeStart));
const pendingCalendarActionTargetLabel=computed(()=>calendarActionLabel(pendingCalendarAction.value?.targetDate,pendingCalendarAction.value?.event.isAllDay?undefined:pendingCalendarAction.value?.targetTime||pendingCalendarAction.value?.event.timeStart));
function handleCalendarEventDrop(event:HataskCalendarEvent,day:HataskCalendarDay,time?:string):void{
	if(plannerReadOnly.value||event.draggable===false)return;
	const targetTime=event.isAllDay?undefined:time;
	if(event.date===day.date&&(targetTime==null||targetTime===event.timeStart))return;
	pendingCalendarAction.value={mode:'reschedule',event,targetDate:day.date,...(targetTime?{targetTime}:{})};
}
async function handleCalendarMoveRequest(event:HataskCalendarEvent):Promise<void>{
	if(plannerReadOnly.value||event.draggable===false)return;
	const {canceled,result}=await dialogs.inputText({title:plannerCopy.reschedule,text:plannerCopy.dateInputHint,default:event.date||localDateKey(),maxLength:10});
	const date=typeof result==='string'?result.trim():'';if(canceled)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){os.toast(plannerCopy.invalidDate);return}
	let targetTime:string|undefined;
	if(!event.isAllDay){const timeResult=await dialogs.inputText({title:copy.time,text:plannerCopy.timeInputHint,default:event.timeStart||'09:00',maxLength:5});if(timeResult.canceled)return;const value=typeof timeResult.result==='string'?timeResult.result.trim():'';if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)){os.toast(plannerCopy.invalidTime);return}targetTime=value}
	pendingCalendarAction.value={mode:'reschedule',event,targetDate:date,...(targetTime?{targetTime}:{})};
}
function handleCalendarEventTrash(event:HataskCalendarEvent):void{if(!plannerReadOnly.value&&event.draggable!==false)pendingCalendarAction.value={mode:'trash',event}}
function calendarLocalSource(event:HataskCalendarEvent):HataskPlannerEvent|undefined{
	const occurrence=findPlannerCalendarSource(event);const sourceId=occurrence?.sourceEventId||event.id;
	return events.value.find(item=>item.id===sourceId||item.serverEventId===sourceId);
}
function calendarDayDistance(from:string,to:string):number{return Math.round((parseIsoDate(to).getTime()-parseIsoDate(from).getTime())/86400000)}
function eventScheduleAt(source:HataskPlannerEvent,targetDate:string,targetTime?:string):Pick<HataskPlannerEvent,'date'|'dateEnd'|'timeStart'|'timeEnd'>{
	const endDate=source.dateEnd||source.date;const daySpan=Math.max(0,calendarDayDistance(source.date,endDate));
	if(source.allDay)return{date:targetDate,dateEnd:localDateKey(addCalendarDays(parseIsoDate(targetDate),daySpan)),timeStart:'',timeEnd:''};
	const startMinutes=Number(source.timeStart?.slice(0,2)||9)*60+Number(source.timeStart?.slice(3,5)||0);
	const endMinutes=Number(source.timeEnd?.slice(0,2)||10)*60+Number(source.timeEnd?.slice(3,5)||0);
	const duration=Math.max(15,daySpan*1440+endMinutes-startMinutes);
	const nextStart=targetTime&&/^\d{2}:\d{2}$/.test(targetTime)?Number(targetTime.slice(0,2))*60+Number(targetTime.slice(3,5)):startMinutes;
	const totalEnd=nextStart+duration;const endOffset=Math.floor(totalEnd/1440);const nextEnd=totalEnd%1440;
	return{date:targetDate,dateEnd:localDateKey(addCalendarDays(parseIsoDate(targetDate),endOffset)),timeStart:`${String(Math.floor(nextStart/60)).padStart(2,'0')}:${String(nextStart%60).padStart(2,'0')}`,timeEnd:`${String(Math.floor(nextEnd/60)).padStart(2,'0')}:${String(nextEnd%60).padStart(2,'0')}`};
}

const blankCalendarTarget = ref<HataskCalendarBlankTarget | null>(null);
const blankCalendarReturnFocus = ref<HTMLElement | null>(null);
const blankCalendarBusy = ref(false);
const blankCalendarError = ref('');
let blankCalendarGeneration = 0;
watch(activeTab, tab => { if (tab !== 'cal') closeBlankCalendarActions(); });
const blankCalendarLabels: HataskCalendarBlankLabels = {
	...plannerCopy._blankCalendar, cancel: copy.cancel, back: copy.back,
};
const blankCalendarTargetLabel = computed(() => {
	const target = blankCalendarTarget.value;
	return target ? `${target.day.label}${target.time ? ` ${target.time}` : ''}` : '';
});

function openBlankCalendarActions(target: HataskCalendarBlankTarget): void {
	if (plannerReadOnly.value || blankCalendarBusy.value || target.day.isDisabled || activeTab.value !== 'cal') return;
	const calendar = rootEl.value?.querySelector('[data-hatask-component="calendar"]');
	if (!target.anchor.isConnected || !calendar?.contains(target.anchor)) return;
	closeEventDetail();
	blankCalendarGeneration++;
	blankCalendarError.value = '';
	blankCalendarTarget.value = target;
	const day = target.anchor.closest('[data-date]');
	blankCalendarReturnFocus.value = target.anchor instanceof HTMLButtonElement ? target.anchor
		: day?.querySelector<HTMLButtonElement>('[data-calendar-day-button], :scope > header > button, button:not(:disabled)') ?? null;
}

function closeBlankCalendarActions(): void {
	blankCalendarGeneration++;
	blankCalendarTarget.value = null;
}

function getBlankCalendarAnchor(): HTMLElement | null {
	const anchor = blankCalendarTarget.value?.anchor;
	return activeTab.value === 'cal' && anchor?.isConnected && rootEl.value?.contains(anchor) ? anchor : null;
}

function getBlankCalendarAnchorRect(anchor: HTMLElement): { left: number; right: number; top: number; bottom: number } {
	const rect = anchor.getBoundingClientRect();
	const point = blankCalendarTarget.value?.point;
	if (!point) return rect;
	const x = rect.left + point.x * rect.width;
	const y = rect.top + point.y * rect.height;
	return { left: x - 1, right: x + 1, top: y - 1, bottom: y + 1 };
}

function blankCalendarScheduleLabel(event: Pick<HataskPlannerEvent, 'date' | 'dateEnd' | 'timeStart' | 'timeEnd' | 'allDay'>): string {
	return `${eventDateRangeLabel(event)} · ${eventTimeLabel(event)}`;
}

function blankCalendarSource(id: string): HataskPlannerEvent | undefined {
	// Match the existing drag rules: only this account's local, non-recurring events.
	return events.value.find(event => event.id === id && event.archivedAt == null && event.recurrence.frequency === 'none');
}

const blankCalendarEvents = computed<HataskCalendarBlankEvent[]>(() => {
	const target = blankCalendarTarget.value;
	if (!target) return [];
	return events.value.filter(event => event.archivedAt == null && event.recurrence.frequency === 'none').map(event => {
		const schedule = eventScheduleAt(event, target.day.date, target.time);
		return {
			id: event.id, title: event.title, emoji: event.emoji,
			dateLabel: blankCalendarScheduleLabel(event),
			targetLabel: blankCalendarScheduleLabel({ ...event, ...schedule }),
			canCopy: true,
			canMove: !event.publicSyncState && (event.date !== schedule.date || event.timeStart !== schedule.timeStart),
		};
	});
});

function hasBlankCalendarDraft(): boolean {
	const draft = newEvent.value;
	return Boolean(editingEvent.value || draft.title.trim() || draft.emoji !== '⭐' || draft.color !== '#e27d60'
		|| draft.date !== selectedDateStr.value || draft.dateEnd !== draft.date || draft.timeStart !== '14:00' || draft.timeEnd !== '15:00'
		|| draft.visibility !== 'private' || draft.rsvp || !draft.notify || draft.allDay
		|| draft.recurrence.frequency !== 'none' || draft.notifyTimings.join(',') !== '15分前,30分前');
}

async function createBlankCalendarEvent(): Promise<void> {
	const target = blankCalendarTarget.value;
	if (!target || plannerReadOnly.value || blankCalendarBusy.value) return;
	const discardDraft = hasBlankCalendarDraft();
	closeBlankCalendarActions();
	const generation = blankCalendarGeneration;
	blankCalendarBusy.value = true;
	try {
		// Unmount the chooser/focus trap before opening another dialog.
		await nextTick();
		if (discardDraft) {
			const { canceled } = await dialogs.confirm({ type: 'warning', text: plannerCopy._blankCalendar.replaceDraft });
			if (canceled) return;
		}
		if (generation !== blankCalendarGeneration || plannerReadOnly.value || activeTab.value !== 'cal') return;
		setPlannerAnchor(parseIsoDate(target.day.date));
		resetEventEditor();
		if (target.time) {
			newEvent.value.timeStart = target.time;
			newEvent.value.timeEnd = clockPlusMinutes(target.time, 60);
			if (newEvent.value.timeEnd <= target.time) newEvent.value.dateEnd = localDateKey(addCalendarDays(parseIsoDate(target.day.date), 1));
		}
		openEventDetailsModal(true);
	} finally {
		blankCalendarBusy.value = false;
	}
}

async function confirmBlankCalendarReschedule(id: string, mode: 'copy' | 'move'): Promise<void> {
	const target = blankCalendarTarget.value;
	if (!target || plannerReadOnly.value || blankCalendarBusy.value) return;
	if (activeTab.value !== 'cal') return;
	const source = blankCalendarSource(id);
	const candidate = blankCalendarEvents.value.find(event => event.id === id);
	if (!source || !candidate || !(mode === 'copy' ? candidate.canCopy : candidate.canMove)) {
		blankCalendarError.value = plannerCopy._blankCalendar.unavailable;
		return;
	}
	const generation = blankCalendarGeneration;
	blankCalendarBusy.value = true;
	blankCalendarError.value = '';
	try {
		const saved = await applyCalendarReschedule({ mode: 'reschedule', event: plannerCalendarEvent(source), targetDate: target.day.date, targetTime: target.time }, mode);
		if (generation !== blankCalendarGeneration) return;
		if (saved) closeBlankCalendarActions();
		else blankCalendarError.value = plannerCopy.publicSyncUnlinked;
	} catch (error) {
		console.error('Hatask calendar reschedule failed:', error);
		if (generation === blankCalendarGeneration) blankCalendarError.value = plannerCopy.publicSyncFailed;
	} finally {
		blankCalendarBusy.value = false;
	}
}

async function applyCalendarReschedule(action:PendingCalendarAction,choice:'move'|'copy'):Promise<boolean>{
	const source=calendarLocalSource(action.event);if(!source||!action.targetDate){os.toast(plannerCopy.publicSyncUnlinked);return false}
	const schedule=eventScheduleAt(source,action.targetDate,action.targetTime);const now=new Date().toISOString();
	if(choice==='copy'){
		const duplicate:HataskPlannerEvent = { ...source, ...schedule, id: generateId(), clientEventId: undefined, serverEventId: undefined, serverEventRevision: undefined, publicSyncState: undefined, pendingVisibility: undefined, visibility: 'private', visibleUserIds: [], rsvp: false, recurrence: { frequency: 'none', interval: 1 }, createdAt: now, updatedAt: now, archivedAt: null };
		duplicate.clientEventId=duplicate.id;
		const next=[duplicate,...events.value];await registrySet('events',next);events.value=next;scheduleEventNotifications();setPlannerAnchor(parseIsoDate(action.targetDate));os.toast(plannerCopy.eventCopied);return true;
	}
	let moved:HataskPlannerEvent={...source,...schedule,updatedAt:now};
	if (isSharedHataskEvent(source)) {
		let serverEventId=source.serverEventId;let serverEventRevision=source.serverEventRevision;
		if(!serverEventId){serverEventId=findUniqueOwnedServerId(source)??undefined;const server=serverEventId?sharedEvents.value.find(event=>event.id===serverEventId):null;serverEventRevision=server?.revision}
		if(!serverEventId||!serverEventRevision){os.toast(plannerCopy.publicSyncUnlinked);return false}
		moved={...moved,serverEventId,serverEventRevision,publicSyncState:'updating'};
	}
	const next=events.value.map(event=>event.id===source.id?moved:event);await registrySet('events',next);events.value=next;scheduleEventNotifications();setPlannerAnchor(parseIsoDate(action.targetDate));
	if (isSharedHataskEvent(source)) {
		await processPublicEventOutbox();await loadSharedEvents();
		const syncState=events.value.find(event=>event.id===source.id)?.publicSyncState;
		os.toast(syncState==='conflict'?plannerCopy.publicSyncConflict:syncState==='unlinked'?plannerCopy.publicSyncUnlinked:syncState==='sync-error'?plannerCopy.publicSyncFailed:syncState?plannerCopy.publicSyncPending:plannerCopy.eventMoved);
		return true;
	}
	os.toast(plannerCopy.eventMoved);
	return true;
}
async function resolveCalendarAction(choice:'move'|'copy'|'trash'|'cancel'):Promise<void>{
	const action=pendingCalendarAction.value;pendingCalendarAction.value=null;if(!action||choice==='cancel')return;
	if(choice==='trash'){await deleteEventById(action.event.id,{skipConfirm:true});return}
	if(action.mode==='reschedule')await applyCalendarReschedule(action,choice);
}

// 期限なしを含む既存Todoは「すべて」で必ず辿れる。スマートビューは表示だけを切り替え、
// 配列そのものや手動順を並べ替えて保存しない。
const plannerTodoView=ref<HataskTodoView>('all');
const plannerTodoSearch=ref('');

const plannerTodoMobileTabOrder = computed(() => normalizeHataskTodoMobileTabs(settings.value.todoMobileTabOrder));

async function setPlannerTodoMobileTabOrder(next: HataskTodoMobileTab[]): Promise<void> {
	if (!loadedKeys.has('settings')) return;
	settings.value.todoMobileTabOrder = normalizeHataskTodoMobileTabs(next);
	await saveSettings();
}

const lastArchivedTodoId=ref<string|null>(null);
let archiveUndoTimer:number|null=null;
function isTodoArchived(todo:HataskPlannerTodo):boolean{return todo.archivedAt!=null}
function todoMatchesView(todo:HataskPlannerTodo,view:HataskTodoView):boolean{
	const today=localDateKey();
	if(view==='templates')return false;
	if(view==='completed')return todo.done||isTodoArchived(todo);
	if(isTodoArchived(todo)||todo.done)return false;
	if(view==='today')return todo.due===today;
	if(view==='upcoming')return Boolean(todo.due&&todo.due>today);
	if(view==='overdue')return Boolean(todo.due&&todo.due<today);
	if(view==='priority')return todo.priority!=='none';
	return true;
}
const plannerTodoViewCounts=computed<Record<HataskTodoView,number>>(()=>({
	today:todos.value.filter(todo=>todoMatchesView(todo,'today')).length,
	upcoming:todos.value.filter(todo=>todoMatchesView(todo,'upcoming')).length,
	overdue:todos.value.filter(todo=>todoMatchesView(todo,'overdue')).length,
	priority:todos.value.filter(todo=>todoMatchesView(todo,'priority')).length,
	all:todos.value.filter(todo=>todoMatchesView(todo,'all')).length,
	completed:todos.value.filter(todo=>todoMatchesView(todo,'completed')).length,
	templates:plannerTemplates.value.filter(template=>template.kind==='todo'&&template.archivedAt==null).length,
}));
const plannerTodoSortContext=computed(()=>`${plannerTodoView.value}:${activeFolder.value}`);
const currentTodoSort=computed<HataskTodoSort>(()=>{
	const candidate=settings.value.todoSortModes?.[plannerTodoSortContext.value];
	return candidate==='dueAsc'||candidate==='priority'||candidate==='createdDesc'?candidate:'manual';
});
function todoTimestamp(value:unknown):number{
	if(typeof value==='number'&&Number.isFinite(value))return value;
	if(typeof value==='string'){const parsed=Date.parse(value);return Number.isFinite(parsed)?parsed:0}
	return 0;
}
function comparePlannerTodos(a:HataskPlannerTodo,b:HataskPlannerTodo):number{
	if(currentTodoSort.value==='dueAsc')return String(a.due||'9999-99-99').localeCompare(String(b.due||'9999-99-99'))||String(a.time||'99:99').localeCompare(String(b.time||'99:99'))||(a.position??0)-(b.position??0);
	if(currentTodoSort.value==='priority'){
		const rank={high:0,medium:1,low:2,none:3} as const;
		return rank[a.priority]-rank[b.priority]||String(a.due||'9999-99-99').localeCompare(String(b.due||'9999-99-99'))||(a.position??0)-(b.position??0);
	}
	if(currentTodoSort.value==='createdDesc')return todoTimestamp(b.createdAt)-todoTimestamp(a.createdAt)||(a.position??0)-(b.position??0);
	return(a.position??0)-(b.position??0)||String(a.due||'9999-99-99').localeCompare(String(b.due||'9999-99-99'));
}
async function setPlannerTodoSort(next:HataskTodoSort):Promise<void>{
	settings.value.todoSortModes={...(settings.value.todoSortModes||{}),[plannerTodoSortContext.value]:next};
	await saveSettings();
}
const plannerFilteredTodos=computed(()=>{
	const query=plannerTodoSearch.value.trim().toLocaleLowerCase(versatileLang);
	return todos.value.filter(todo=>{
		if(!todoMatchesView(todo,plannerTodoView.value))return false;
		if(activeFolder.value!=='all'&&todo.folder!==activeFolder.value)return false;
		return!query||`${todo.text}\n${todo.comment||''}`.toLocaleLowerCase(versatileLang).includes(query);
	}).sort(comparePlannerTodos);
});
const plannerTodoItems=computed<HataskTodoItem[]>(()=>plannerFilteredTodos.value.map((todo,index)=>{
	const folder=getFolder(todo.folder||'');
	return{
		id:todo.id,text:todo.text,done:todo.done,due:todo.due,time:todo.time,dueLabel:todo.due?formatDue(todo.due,todo.time):undefined,
		folder:todo.folder,folderLabel:folder?.name,folderEmoji:folder?.emoji,comment:todo.comment,commentPreview:todo.comment?.split('\n')[0],
		priority:todo.priority||'none',recurrenceLabel:recurrenceLabel(todo.recurrence?.frequency||'none'),subtasks:todo.subtasks||[],archivedAt:todo.archivedAt,
		archivedLabel:todo.archivedAt?formatSearchDate(localDateKey(new Date(todo.archivedAt))):undefined,canMoveUp:index>0,canMoveDown:index<plannerFilteredTodos.value.length-1,
	};
}));
const plannerTodoFilters=computed<HataskPlannerFilter[]>(()=>[
	...activeFolders.value.map(folder=>({id:`folder:${folder.id}`,kind:'folder' as const,label:folder.name,emoji:folder.emoji,active:activeFolder.value===folder.id,color:folder.color,count:folderCount(folder.id)})),
]);
const plannerTodoLabels=computed<HataskTodoLabels>(()=>({
		todo:plannerCopy.todo,viewSelector:plannerCopy.organizeTodo,views:{today:plannerCopy.todoToday,upcoming:plannerCopy.todoUpcoming,overdue:plannerCopy.todoOverdue,priority:plannerCopy.todoPriority,all:plannerCopy.todoAll,completed:plannerCopy.todoCompleted,templates:plannerCopy.todoTemplates},
	search:plannerCopy.search,searchPlaceholder:copy.newTaskPlaceholder,addTask:plannerCopy.add,filters:plannerCopy.filter,loading:plannerCopy.loading,empty:copy.noTasks,readOnly:plannerStorageDetail.value||plannerCopy.readOnly,
	priorities:{none:plannerCopy.priorityNone,low:plannerCopy.priorityLow,medium:plannerCopy.priorityMedium,high:plannerCopy.priorityHigh},
		completeTask:title=>plannerCopyx.completeTaskLabel({title}),reopenTask:title=>plannerCopyx.reopenTaskLabel({title}),editTask:title=>plannerCopyx.editTaskLabel({title}),
		archiveTask:title=>plannerCopyx.archiveTaskLabel({title}),restoreTask:title=>plannerCopyx.restoreTaskLabel({title}),deleteTask:title=>plannerCopyx.deleteTaskLabel({title}),
		moveUp:title=>plannerCopyx.moveTaskUpLabel({title}),moveDown:title=>plannerCopyx.moveTaskDownLabel({title}),
	subtaskProgress:(completed,total)=>plannerCopyx.subtaskProgress({completed:completed.toString(),total:total.toString()}),
	sort:plannerCopy.sort,sortOptions:{manual:plannerCopy.sortManual,dueAsc:plannerCopy.sortDueAsc,priority:plannerCopy.sortPriority,createdDesc:plannerCopy.sortCreatedDesc},folders:plannerCopy.folders,
		selectedCount:count=>plannerCopyx.selectedCount({count:count.toString()}),bulkComplete:plannerCopy.bulkComplete,bulkMove:plannerCopy.bulkMove,bulkDue:plannerCopy.bulkDue,bulkPriority:plannerCopy.bulkPriority,bulkArchive:plannerCopy.bulkArchive,clearSelection:plannerCopy.clearSelection,
			addFolder:plannerCopy.addFolder,manageFolder:name=>plannerCopyx.manageFolderLabel({name}),moreActions:title=>plannerCopyx.moreTaskActionsLabel({title}),moreViews:plannerCopy.todoMore,reorderViews:plannerCopy.reorderTodoTabs,reorderView:viewName=>plannerCopyx.reorderTodoTabLabel({name:viewName}),
	customizeViews: plannerCopy.customizeTodoTabs,
	customizeViewsHint: plannerCopy.customizeTodoTabsHint,
	showView: name => plannerCopyx.showTodoTabLabel({ name }),
	hideView: name => plannerCopyx.hideTodoTabLabel({ name }),
	}));
function recurrenceLabel(frequency:HataskRecurrenceFrequency):string{return frequency==='daily'?plannerCopy.recurrenceDaily:frequency==='weekly'?plannerCopy.recurrenceWeekly:frequency==='monthly'?plannerCopy.recurrenceMonthly:frequency==='yearly'?plannerCopy.recurrenceYearly:plannerCopy.recurrenceNone}
function focusTodoEditor():void{if(plannerReadOnly.value)return;todoCaptureRef.value?.focus()}
function togglePlannerTodoFilter(filterId:string):void{
	if(filterId.startsWith('folder:')){const folderId=filterId.slice(7);activeFolder.value=activeFolder.value===folderId?'all':folderId;return}
}

// Mood
const moodJournalRows = ref<unknown[]>([]);
const moods = computed<any[]>(() => moodJournalRows.value.filter(row => isJournalEntry(row, 'mood')));

// Meal(食事記録) - mood と並列。医療目的ではない自己記録メモ。集計の数値化・スコア化はしない
const mealJournalRows = ref<unknown[]>([]);
const meals = computed<any[]>(() => mealJournalRows.value.filter(row => isJournalEntry(row, 'meal')));
const mealTemplates = ref<unknown[]>([]);
const journalValidKeys = ref<string[]>([]);
const showMealDisclaimer=ref(false);
// サマリーは数値評価を出さない。記録した行為そのものを中立に肯定する労いのみ
const mealTodayCount=computed(()=>{const today=localDateKey();return meals.value.filter(m=>m.date===today).length});
const mealSummaryMessage=computed(()=>{const c=mealTodayCount.value;if(c===0)return copy.mealSummaryNone;if(c===1)return copy.mealSummaryOne;return copy.mealSummaryMany});


// Garden
type FlowerVisibility = 'public' | 'followers' | 'private';
type CommunityFlower = { id: string; clientFlowerId?: string; emoji: string; name: string; hanakotoba?: string; harvestedAt: string; isOwner?: boolean; user?: Misskey.entities.UserLite };
const flower = ref<HataskGrowingFlower>(createHataskGrowingFlower({ emoji: '🌱', name: 'わかば' }));
const gallery=ref<any[]>([]);
const flowerState = ref<HataskFlowerState | null>(null);
const archiveVisibleCount = ref(100);
const flowerVisibility = ref<FlowerVisibility>('public');
const flowerVisibilityOptions = computed(() => [
	{ value: 'public' as const, icon: 'ti-world', label: copy.flowerVisibilityPublic },
	{ value: 'followers' as const, icon: 'ti-users', label: copy.flowerVisibilityFollowers },
	{ value: 'private' as const, icon: 'ti-lock', label: copy.flowerVisibilityPrivate },
]);
const galleryPage = ref(1);
const galleryOrder = ref<'newest' | 'oldest'>('newest');
const GALLERY_PAGE_SIZE = 12;
const galleryTotalPages = computed(() => Math.max(1, Math.ceil(gallery.value.length / GALLERY_PAGE_SIZE)));
const sortedGallery = computed(() => [...gallery.value].sort((a, b) => {
	const aTime = Date.parse(stableHarvestedAt(a));
	const bTime = Date.parse(stableHarvestedAt(b));
	return galleryOrder.value === 'newest' ? bTime - aTime : aTime - bTime;
}));
const pagedGallery = computed(() => sortedGallery.value.slice((galleryPage.value - 1) * GALLERY_PAGE_SIZE, galleryPage.value * GALLERY_PAGE_SIZE));
const communityFlowers = ref<CommunityFlower[]>([]);
const communityFlowerPage = ref(1);
const communityFlowerOrder = ref<'newest' | 'oldest'>('newest');
const communityFlowerTotalPages = ref(1);
const communityFlowerTotal = ref(0);
const communityFlowersLoading = ref(false);
const communityFlowersError = ref(false);
const flowerVisibilitySaving = ref(false);
const flowerAnimations = computed(() => (props.embedded || (settings.value.animations !== false && prefer.r.animation.value)) && !showFlowerInfo.value);
const flowerDataWritable = computed(() => dataLoaded.value && loadedKeys.has('flower') && loadedKeys.has('gallery'));
const flowerVisibilityLabel = computed(() => flowerVisibilityOptions.value.find(option => option.value === flowerVisibility.value)?.label ?? '');
const seasonFlowerLabel = computed(() => ({ spring: copy.flowerSeasonSpring, summer: copy.flowerSeasonSummer, autumn: copy.flowerSeasonAutumn, winter: copy.flowerSeasonWinter })[getHataskFlowerSeason(akatsukiNow.value)]);
type FlowerStreamKind = 'personal' | 'community' | 'activity';
const flowerStreamPaused = ref<Record<FlowerStreamKind, boolean>>({ personal: false, community: false, activity: false });
const personalFlowerStream = ref<InstanceType<typeof HataskFlowerStream> | null>(null);
const communityFlowerStream = ref<InstanceType<typeof HataskFlowerStream> | null>(null);
const activityFlowerStream = ref<InstanceType<typeof HataskFlowerStream> | null>(null);
const flowerDialogOpen = ref(false);
const flowerCollectionKind = ref<'personal' | 'community' | null>(null);
const flowerCollectionOpen = computed(() => flowerCollectionKind.value !== null);
let activeFlowerCollection: { showing: ReturnType<typeof ref<boolean>>; kind: 'personal' | 'community'; closed: Promise<void> } | null = null;
const selectedCommunityFlowerId = ref<string | null>(null);
let activeFlowerPopup: { showing: ReturnType<typeof ref<boolean>>; kind: FlowerStreamKind; id: string } | null = null;

function flowerView(item: { id: string; emoji: string; name: string; hanakotoba?: string; speciesId?: string; harvestedAt?: string; date?: string }, isOwner: boolean, user?: Misskey.entities.UserLite): HataskFlowerView {
	const species = findHataskFlora(item);
	return {
		id: item.id, emoji: item.emoji, name: localizeFloraName(item.name),
		variety: species ? localizeFloraName(species.name) : undefined,
		hanakotoba: item.hanakotoba ? localizeHanakotoba(item.hanakotoba) : undefined,
		harvestedAt: stableHarvestedAt(item), dateLabel: formatFlowerDate(item),
		rare: isRareHataskFlower(item), isOwner, user,
	};
}

const personalFlowerViews = computed(() => pagedGallery.value.map(item => flowerView(item, true, $i ?? undefined)));
const communityFlowerViews = computed(() => communityFlowers.value.map(item => flowerView(item, false, item.user)));

function flowerPauseLabel(kind: FlowerStreamKind): string {
	const title = kind === 'personal' ? copy.flowerGallery : kind === 'community' ? copy.communityFlowerGallery : copy.communityFlowerActivity;
	return `${title} · ${flowerStreamPaused.value[kind] ? copy.resumeFlowerScroll : copy.pauseFlowerScroll}`;
}

function toggleFlowerStream(kind: FlowerStreamKind): void {
	flowerStreamPaused.value[kind] = !flowerStreamPaused.value[kind];
}

function flowerCollectionLabel(kind: 'personal' | 'community'): string {
	return `${kind === 'personal' ? copy.flowerGallery : copy.communityFlowerGallery} · ${copy.list}`;
}

function closeFlowerCollection(): Promise<void> {
	if (!activeFlowerCollection) return Promise.resolve();
	activeFlowerCollection.showing.value = false;
	return activeFlowerCollection.closed;
}

function openFlowerCollection(kind: 'personal' | 'community', event: MouseEvent): void {
	const source = event.currentTarget;
	if (flowerDialogOpen.value || flowerCollectionOpen.value || !(source instanceof HTMLElement) || !source.isConnected) return;
	const personal = kind === 'personal';
	let finishClosing: () => void = () => {};
	const closed = new Promise<void>(resolve => { finishClosing = resolve; });
	const owner = { showing: ref(true), kind, closed };
	activeFlowerCollection = owner;
	flowerCollectionKind.value = kind;
	const { dispose } = popup(HataskFlowerCollection, {
		items: personal ? personalFlowerViews : communityFlowerViews,
		title: personal ? copy.flowerGallery : copy.communityFlowerGallery,
		summary: computed(() => copyx.flowerCount({ count: (personal ? gallery.value.length : communityFlowerTotal.value).toString() })),
		page: personal ? galleryPage : communityFlowerPage,
		totalPages: personal ? galleryTotalPages : communityFlowerTotalPages,
		order: personal ? galleryOrder : communityFlowerOrder,
		loading: personal ? false : communityFlowersLoading,
		error: personal ? false : communityFlowersError,
		personal, source, theme: plannerTheme.value, mode: themeMode.value,
		animations: flowerAnimations, isOpen: owner.showing,
		labels: {
			close: i18n.ts.close, sort: copy.sort, newest: copy.newestFirst, oldest: copy.oldestFirst,
			previous: copy.previousPage, next: copy.nextPage, loading: copy.flowerGalleryLoading,
			error: copy.flowerGalleryLoadFailed, retry: copy.retry, empty: personal ? copy.noFlowersYet : copy.flowerGalleryEmpty,
			rare: copy.rareFlower, harvested: copy.flowerHarvestedAt,
		},
	}, {
		closed: () => {
			dispose();
			if (activeFlowerCollection === owner) { activeFlowerCollection = null; flowerCollectionKind.value = null; }
			finishClosing();
		},
		select: selection => {
			if (activeFlowerCollection === owner && owner.showing.value) openFlowerDetail(kind, selection);
		},
		page: page => {
			if (activeFlowerCollection !== owner || !owner.showing.value) return;
			const pages = personal ? galleryTotalPages.value : communityFlowerTotalPages.value;
			if (!Number.isInteger(page) || page < 1 || page > pages || (!personal && communityFlowersLoading.value)) return;
			if (personal) galleryPage.value = page;
			else communityFlowerPage.value = page;
		},
		order: order => {
			if (activeFlowerCollection !== owner || !owner.showing.value || (!personal && communityFlowersLoading.value)) return;
			if (personal) setGalleryOrder(order);
			else setCommunityFlowerOrder(order);
		},
		retry: () => { if (!personal && activeFlowerCollection === owner && owner.showing.value) void loadCommunityFlowers(); },
	});
}

function closeFlowerDetail(): void {
	if (activeFlowerPopup) activeFlowerPopup.showing.value = false;
	selectedCommunityFlowerId.value = null;
}

function openFlowerDetail(kind: FlowerStreamKind, selection: HataskFlowerSelection, onClosed?: () => void): void {
	if (flowerDialogOpen.value || !selection.anchor.isConnected) { onClosed?.(); return; }
	const view = (kind === 'personal' ? personalFlowerViews.value : communityFlowerViews.value).find(item => item.id === selection.flower.id);
	if (!view || (kind !== 'personal' && (communityFlowersLoading.value || communityFlowersError.value))) { onClosed?.(); return; }
	const owner = { showing: ref(true), kind, id: view.id };
	activeFlowerPopup = owner;
	flowerDialogOpen.value = true;
	selectedCommunityFlowerId.value = kind === 'personal' ? null : view.id;
	const { dispose } = popup(HataskFlowerDetail, {
		flower: view, source: selection.anchor, returnFocusTo: selection.returnFocusTo,
		theme: plannerTheme.value, mode: themeMode.value, animations: flowerAnimations.value,
		isOpen: owner.showing,
		labels: { close: i18n.ts.close, meaning: copy.flowerMeaning, harvested: copy.flowerHarvestedAt, rename: copy.renameFlowerTitle, report: copy.reportFlowerName, rare: copy.rareFlower, owner: copy.flowerOwner },
	}, {
		closed: () => {
			dispose();
			if (activeFlowerPopup === owner) { activeFlowerPopup = null; flowerDialogOpen.value = false; selectedCommunityFlowerId.value = null; }
			onClosed?.();
		},
		action: async () => {
			if (!hataskPageActive || activeTab.value !== 'garden') return;
			flowerDialogOpen.value = true;
			try {
				if (kind === 'personal') {
					const original = gallery.value.find(item => item.id === view.id);
					if (original && flowerDataWritable.value) await renameFlower(original);
				} else {
					// Report windows use the normal window layer, so release the collection first.
					await closeFlowerCollection();
					const original = communityFlowers.value.find(item => item.id === view.id);
					if (original && !communityFlowersLoading.value && !communityFlowersError.value) await reportCommunityFlower(original);
				}
			} catch (error) {
				console.warn('Failed to update Hatask flower:', error);
				os.toast(i18n.ts.somethingHappened);
			} finally {
				flowerDialogOpen.value = false;
				await nextTick();
				if (hataskPageActive && activeTab.value === 'garden') {
					const stream = kind === 'personal' ? personalFlowerStream.value : kind === 'community' ? communityFlowerStream.value : activityFlowerStream.value;
					const returnTarget = selection.returnFocusTo?.isConnected ? selection.returnFocusTo : stream?.getAnchor(view.id);
					returnTarget?.focus({ preventScroll: true });
				}
			}
		},
	});
}

function changeFlowerVisibility(event: Event): void {
	const select = event.target as HTMLSelectElement;
	const value = select.value;
	select.value = flowerVisibility.value;
	if (value === 'public' || value === 'followers' || value === 'private') void updateFlowerVisibility(value);
}

watch([activeTab, galleryPage, galleryOrder, communityFlowerPage, communityFlowerOrder, themeMode, () => settings.value.theme], closeFlowerDetail);
watch([activeTab, themeMode, () => settings.value.theme], closeFlowerCollection);
watch(communityFlowers, () => { if (activeFlowerPopup?.kind !== 'personal') closeFlowerDetail(); });

watch([activeTab, communityFlowerPage, communityFlowerOrder], ([tab]) => {
	if (tab === 'garden' && dataLoaded.value && hataskPageActive && !window.document.hidden) {
		if (skipNextCommunityFlowerWatch) {
			skipNextCommunityFlowerWatch = false;
			return;
		}
		void loadCommunityFlowers();
	}
});

function normalizeFlowerDate(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	if (!text) return null;
	if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
		const date = new Date(text);
		return Number.isFinite(date.getTime()) ? date.toISOString() : null;
	}
	const match = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/.exec(text);
	if (!match) return null;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const timestamp = Date.UTC(year, month - 1, day);
	const date = new Date(timestamp);
	if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
	return date.toISOString();
}
function stableHarvestedAt(item: { harvestedAt?: unknown; date?: unknown }): string {
	const harvestedAt = normalizeFlowerDate(item.harvestedAt);
	if (harvestedAt) return harvestedAt;
	const legacyDate = normalizeFlowerDate(item.date);
	if (legacyDate) return legacyDate;
	return new Date().toISOString();
}
function normalizeLocalFlowerGallery(value: unknown): { items: any[]; changed: boolean } {
	if (!Array.isArray(value)) return { items: [], changed: value != null };
	let changed = false;
	const items = value.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object').map((item, index) => {
		const harvestedAt = stableHarvestedAt(item);
		if (item.harvestedAt !== harvestedAt) changed = true;
		return { ...item, id: typeof item.id === 'string' && item.id ? item.id : `flower-${index}`, harvestedAt, date: typeof item.date === 'string' ? item.date : harvestedAt };
	});
	return { items, changed: changed || items.length !== value.length };
}

function applyFlowerState(next: HataskFlowerState): void {
	flowerState.value = next;
	flower.value = next.flower;
	const entries = next.zukan.entries.map(entry => ({ ...entry, name: entry.nickname || entry.name, clientFlowerId: entry.id, v2: true }));
	gallery.value = [...entries, ...gallery.value.filter(item => !item.v2 && !entries.some(entry => entry.id === item.id))];
}
function onFlowerState(event: Event): void { applyFlowerState((event as CustomEvent<HataskFlowerState>).detail); }
function onFlowerHarvested(next: HataskFlowerState): void { applyFlowerState(next); invalidateCommunityFlowers(); void syncHataskFlowerCount(); }
async function completeGardenTodo(id: string, done: boolean): Promise<void> { registerCompletedUndo(await toggleTodo(id, done)); }

function onHataskFlowerGrowth(event: Event): void {
	const next = (event as CustomEvent<HataskGrowingFlower>).detail;
	const normalized = normalizeHataskGrowingFlower(next);
	if (normalized) flower.value = normalized;
}
const currentFlowerDisplayName=computed(() => localizeFloraName(flower.value.name));
const estimateRemaining=computed(()=>{const rem=Math.max(0,flower.value.targetMinutes-flower.value.totalMinutes);const h=Math.floor(rem/60);return h>0?copyx.hours({ hours: h.toString() }):copy.soon});
function formatFlowerDate(item: { harvestedAt?: string; date?: string }): string {
	const value = item.harvestedAt ?? item.date;
	const normalized = normalizeFlowerDate(value);
	if (!normalized) return copy.unknownDate;
	return longDateFormatter.format(new Date(normalized));
}

// Search
const searchQuery=ref('');
const searchResults = computed(() => {
	const q = searchQuery.value.toLowerCase();
	return {
		todos: todos.value.filter(t => t.text.toLowerCase().includes(q) || (t.comment && t.comment.toLowerCase().includes(q))).slice(0, 5),
		moods: moods.value.filter(m => (m.note ?? '').toLowerCase().includes(q)).slice(0, 5),
		events: events.value.filter(event => event.title.toLowerCase().includes(q)).slice(0, 5),
	};
});
const recentMoodsForSearch=computed(()=>moods.value.slice(0,3));
const hataskSearchGroups = computed<HataskSearchGroup[]>(() => {
	const hasQuery = !!searchQuery.value;
	const foundEvents = hasQuery ? searchResults.value.events : upcomingEvents.value.slice(0, 3);
	const foundMoods = hasQuery ? searchResults.value.moods : recentMoodsForSearch.value;
	const foundTodos = hasQuery ? searchResults.value.todos : todos.value.filter(todo => !todo.done).slice(0, 3);
	return [
		{ id: 'events', label: hasQuery ? copy.schedule : copy.upcomingEvents, items: foundEvents.map(event => ({ id: event.id, title: event.title, description: `${formatSearchDate(event.date)} ${event.timeStart ?? ''}`, color: event.color, selectable: true })) },
		{ id: 'moods', label: hasQuery ? copy.tabMood : copy.recentMoods, items: foundMoods.map(mood => ({ id: mood.id, title: moodNoteLabel(mood.note), description: `${formatSearchDate(mood.date)} ${mood.time ?? ''}`, icon: moodIcons[mood.level], selectable: !hasQuery })) },
		{ id: 'todos', label: hasQuery ? 'ToDo' : copy.recentTodos, items: foundTodos.map(todo => ({ id: todo.id, title: todo.text, description: todo.due ? copyx.dueDateLabel({ date: formatSearchDate(todo.due) }) : copy.noDueDate, color: 'var(--primary)', selectable: !hasQuery })) },
	];
});

function selectHataskSearchResult(kind: HataskSearchGroup['id'], id: string): void {
	const item = hataskSearchGroups.value.find(group => group.id === kind)?.items.find(result => result.id === id);
	if (!item?.selectable) return;
	showSearch.value = false;
	if (kind === 'events') {
		const event = [...upcomingEvents.value, ...searchResults.value.events].find(candidate => candidate.id === id);
		if (event) goToEvent(event);
	} else activeTab.value = kind === 'moods' ? 'mood' : 'todo';
}

function formatSearchDate(d:string):string{const dd=parseIsoDate(d);const now=new Date();now.setHours(0,0,0,0);const day=new Date(dd); day.setHours(0, 0, 0, 0); const diff=Math.floor((now.getTime()-day.getTime())/(86400000));if(diff===0)return copy.today;if(diff===1)return copy.yesterday;return monthDayFormatter.format(dd)}
watch(activeTab, () => { showSearch.value = false; });

// Helpers
function generateId():string{return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function formatDue(d:string,t?:string):string{const todayDate=new Date();todayDate.setHours(0,0,0,0);const x=parseIsoDate(d);x.setHours(0,0,0,0);let l='';if(x.getTime()===todayDate.getTime())l=copy.today;else{const tomorrow=new Date(todayDate);tomorrow.setDate(tomorrow.getDate()+1);if(x.getTime()===tomorrow.getTime())l=copy.tomorrow;else l=monthDayFormatter.format(x)}if(t)l+=' '+t;return l}

// ========== GREETING SYSTEM (500+ variations) ==========

// Hatask Eye phrase system
function updateEyePhrase(){
try {
const pc=todos.value.filter(t=>!t.done).length;
const todayStr=localDateKey();
const todayEvents=events.value.filter(e=>e.date===todayStr);
const recent=moods.value.slice(0,7);
const avg=recent.length>0?recent.reduce((s,m)=>s+m.level,0)/recent.length:0;
const phrase=_getPhrase({pendingTaskCount:pc,totalTaskCount:todos.value.length,todayEventCount:todayEvents.length,todayEventTitle:todayEvents[0]?.title,recentMoodAvg:avg});
if(phrase)eyePhrase.value=phrase;
} catch(e) { /* fallback: keep current phrase */ }
}
function updateClock(){const now=new Date();akatsukiNow.value=now;currentTime.value=new Intl.DateTimeFormat(versatileLang,{ hour: '2-digit',minute: '2-digit',hour12: false }).format(now);currentDate.value=longDateFormatter.format(now);clockMD.value=monthDayFormatter.format(now);clockDow.value=weekdayLongFormatter.format(now);const M=now.getMonth()+1,D=now.getDate();clockDot.value=`${now.getFullYear()}.${String(M).padStart(2,'0')}.${String(D).padStart(2,'0')}`;clockEn.value=weekdayLongFormatter.format(now).toLocaleUpperCase(versatileLang)}

// RSVP logic - uses shared API events (rsvp有効なもののみ)
const pendingRsvps=computed(()=>{
const myId=$i?.id;
return sharedEvents.value.filter(event => event.rsvp && !event.rsvpClosed && (event.userId === myId || !event.rsvpResponses?.some((response: { userId: string }) => response.userId === myId))).map(e=>{
const myResp=e.rsvpResponses?.find((r:any)=>r.userId===myId);
return{eventId:e.id,emoji:e.emoji||'📅',title:e.title,dateLabel:eventDateTimeLabel(e),myStatus:myResp?.status||null,creatorUsername:e.username};
});
});
const rsvpSavingIds = ref<string[]>([]);

function isRsvpSaving(eventId: string): boolean {
	return rsvpSavingIds.value.includes(plannerEventServerId(eventId));
}

async function setRsvp(eventId: string, status: 'going' | 'maybe' | 'declined'): Promise<void> {
	if (!$i || plannerReadOnly.value || isRsvpSaving(eventId)) return;
	const event = sharedEventData(eventId);
	if (!event?.rsvp || event.rsvpClosed || sharedRsvpMyStatus(eventId) === status) return;
	const serverId = plannerEventServerId(eventId);
	rsvpSavingIds.value.push(serverId);
	try {
		await misskeyApi('hatask/events/rsvp', { eventId: serverId, status });
		await loadSharedEvents();
		os.toast(status === 'going' ? copy.rsvpGoingSaved : status === 'maybe' ? copy.rsvpMaybeSaved : copy.rsvpDeclinedSaved);
	} catch (error) {
		console.error('RSVP failed:', error);
		os.toast(copy.rsvpSendFailed);
	} finally {
		rsvpSavingIds.value = rsvpSavingIds.value.filter(id => id !== serverId);
	}
}
async function closeRsvp(eventId:string){
try{const server=sharedEventData(eventId);if(!server?.revision)throw new Error('Missing public event revision');await misskeyApi('hatask/events/close',{eventId:plannerEventServerId(eventId),expectedRevision:server.revision,closed:true});await loadSharedEvents();os.toast(copy.rsvpClosed)}catch(e){console.error('Close RSVP failed:',e);os.toast(copy.rsvpCloseFailed)}
}

// CRUD
function checkClosedRsvps(){
const myId=$i?.id;if(!myId)return;
// API共有イベントから締切済みのものを検出
closedRsvpNotifs.value=sharedEvents.value.filter(e=>e.rsvpClosed&&e.rsvpResponses&&e.rsvpResponses.some((r:any)=>r.userId===myId)&&!dismissedRsvpNotifs.value.includes(e.id)).map(e=>({eventId:e.id,emoji:e.emoji||'📅',title:e.title,goCount:e.rsvpResponses.filter((r:any)=>r.status==='going').length}));
}
const editingTodoId=ref<string|null>(null);
type CompletedTodoUndoItem={before:HataskPlannerTodo;after:HataskPlannerTodo;generated?:HataskPlannerTodo};
const todoCompletionIds=ref<string[]>([]);
const completedUndoItems=ref<CompletedTodoUndoItem[]>([]);
let completedUndoTimer:number|null=null;
function clonePlannerTodo(todo:HataskPlannerTodo):HataskPlannerTodo{return{...todo,subtasks:(todo.subtasks||[]).map(subtask=>({...subtask})),recurrence:{...(todo.recurrence||{frequency:'none',interval:1})}}}
function resetTodoEditor():void{editingTodoId.value=null;newTodo.value='';newTodoDue.value='';newTodoTime.value='';newTodoFolder.value='';newTodoComment.value='';newTodoPriority.value='none';newTodoRecurrence.value='none';newTodoSubtasks.value=[];newSubtaskText.value='';showTodoExtra.value=false;todoCaptureEditor.value=null}
function addTodoSubtask():void{const text=newSubtaskText.value.trim();if(!text)return;newTodoSubtasks.value.push({id:generateId(),text,done:false});newSubtaskText.value=''}
function removeTodoSubtask(id:string):void{newTodoSubtasks.value=newTodoSubtasks.value.filter(subtask=>subtask.id!==id)}
async function submitTodoCapture():Promise<void>{
	applyTodoCaptureSyntax(newTodo.value,true);
	if(!newTodo.value.trim()&&!editingTodoId.value){todoCaptureRef.value?.focus();return}
	todoCaptureState.value='saving';
	try{await addTodo();todoCaptureState.value='success';window.setTimeout(()=>{if(todoCaptureState.value==='success')todoCaptureState.value='idle'},900)}
	catch(error){console.error('Hatask todo save failed:',error);todoCaptureState.value='error'}
}
async function addTodo(){
	if(plannerReadOnly.value||(!newTodo.value.trim()&&!editingTodoId.value))return;
	if(editingTodoId.value){
		const index=todos.value.findIndex(todo=>todo.id===editingTodoId.value);
		if(index>=0){
			const current=todos.value[index];
			const next=[...todos.value];
			next.splice(index,1,{...current,text:newTodo.value.trim()||current.text,due:newTodoDue.value,time:newTodoTime.value,folder:newTodoFolder.value,comment:newTodoComment.value,priority:newTodoPriority.value,subtasks:newTodoSubtasks.value.map(subtask=>({...subtask})),recurrence:{...(current.recurrence||{}),frequency:newTodoRecurrence.value,interval:current.recurrence?.interval||1,...(newTodoDue.value?{anchorDate:newTodoDue.value}:{})}});
			await registrySet('todos',next);
			todos.value=next;
		}
		resetTodoEditor();
		os.toast(copy.todoUpdated);
		return;
	}
	const minPosition=todos.value.reduce((minimum,todo)=>Math.min(minimum,todo.position??0),0);
	const next=[{id:generateId(),text:newTodo.value.trim(),done:false,due:newTodoDue.value,time:newTodoTime.value,folder:newTodoFolder.value||(activeFolder.value!=='all'?activeFolder.value:''),comment:newTodoComment.value,createdAt:Date.now(),priority:newTodoPriority.value,subtasks:newTodoSubtasks.value.map(subtask=>({...subtask})),recurrence:{frequency:newTodoRecurrence.value,interval:1,...(newTodoDue.value?{anchorDate:newTodoDue.value}:{})},position:minPosition-1,archivedAt:null},...todos.value] satisfies HataskPlannerTodo[];
	await registrySet('todos',next);
	todos.value=next;
	resetTodoEditor();
}
// 完了処理は Hataskey UI 3 の右ペインと共有する(繰り返しToDoの次回分作成を含む)。
function completeTodoDrafts(source:HataskPlannerTodo[],ids:readonly string[]):{next:HataskPlannerTodo[];undo:CompletedTodoUndoItem[]}{
	return completeHataskTodos(source,ids,{generateId});
}
function registerCompletedUndo(entries:CompletedTodoUndoItem[]):void{
	if(entries.length===0)return;completedUndoItems.value=[...completedUndoItems.value,...entries];
	if(completedUndoTimer)window.clearTimeout(completedUndoTimer);completedUndoTimer=window.setTimeout(()=>{completedUndoItems.value=[];completedUndoTimer=null},8000);
}
async function toggleTodo(id:string,done?:boolean):Promise<CompletedTodoUndoItem[]>{
	if(plannerReadOnly.value)return[];
	const index=todos.value.findIndex(item=>item.id===id);if(index<0)return[];
	const todo=clonePlannerTodo(todos.value[index]);
	const nextDone=done??!todo.done;todo.done=nextDone;
	if(nextDone&&!todos.value[index].done){const completed=completeTodoDrafts(todos.value,[id]);await registrySet('todos',completed.next);todos.value=completed.next;return completed.undo}
	const nextTodos=[...todos.value];
	if(nextDone)todo.doneAt=new Date().toISOString();else delete todo.doneAt;
	const completedIndex=nextTodos.findIndex(item=>item.id===id);
	if(completedIndex>=0)nextTodos.splice(completedIndex,1,todo);
	await registrySet('todos',nextTodos);
	todos.value=nextTodos;
	return[];
}
async function deleteTodo(id:string){if(plannerReadOnly.value)return;const{canceled}=await dialogs.confirm({type:'warning',text:copy.confirmDeleteTodo});if(canceled)return;const next=todos.value.filter(t=>t.id!==id);await registrySet('todos',next);todos.value=next}
async function editTodo(id:string){const t=todos.value.find(t=>t.id===id);if(!t)return;editingTodoId.value=id;newTodo.value=t.text;newTodoDue.value=t.due||'';newTodoTime.value=t.time||'';newTodoFolder.value=t.folder||'';newTodoComment.value=t.comment||'';newTodoPriority.value=t.priority||'none';newTodoRecurrence.value=t.recurrence?.frequency||'none';newTodoSubtasks.value=(t.subtasks||[]).map(subtask=>({...subtask}));showTodoExtra.value=true;focusTodoEditor()}
function cancelEditTodo(){resetTodoEditor()}
async function archiveTodo(id:string):Promise<void>{if(plannerReadOnly.value)return;const index=todos.value.findIndex(item=>item.id===id);if(index<0)return;const next=[...todos.value];next.splice(index,1,{...todos.value[index],archivedAt:new Date().toISOString()});await registrySet('todos',next);todos.value=next;lastArchivedTodoId.value=id;if(archiveUndoTimer)window.clearTimeout(archiveUndoTimer);archiveUndoTimer=window.setTimeout(()=>{lastArchivedTodoId.value=null;archiveUndoTimer=null},8000)}
async function restoreTodo(id:string):Promise<void>{if(plannerReadOnly.value)return;const index=todos.value.findIndex(item=>item.id===id);if(index<0)return;const next=[...todos.value];next.splice(index,1,{...todos.value[index],archivedAt:null});await registrySet('todos',next);todos.value=next;lastArchivedTodoId.value=null}
async function movePlannerTodo(item:HataskTodoItem,direction:-1|1):Promise<void>{if(plannerReadOnly.value)return;const list=plannerFilteredTodos.value;const index=list.findIndex(todo=>todo.id===item.id);const other=list[index+direction];const current=list[index];if(!current||!other)return;const next=todos.value.map(todo=>todo.id===current.id?{...todo,position:other.position}:todo.id===other.id?{...todo,position:current.position}:todo);await registrySet('todos',next);todos.value=next}
async function completePlannerTodo(item:HataskTodoItem,done:boolean):Promise<void>{
	if(done)todoCompletionIds.value=[...new Set([...todoCompletionIds.value,item.id])];
	try{const entries=await toggleTodo(item.id,done);if(done&&entries)registerCompletedUndo(entries)}
	finally{window.setTimeout(()=>{todoCompletionIds.value=todoCompletionIds.value.filter(id=>id!==item.id)},520)}
}
async function undoCompletedTodos():Promise<void>{
	if(plannerReadOnly.value||completedUndoItems.value.length===0)return;
	let next=todos.value.map(clonePlannerTodo);let restored=0;
	for(const entry of [...completedUndoItems.value].reverse()){
		const currentIndex=next.findIndex(item=>item.id===entry.after.id);
		if(currentIndex>=0&&JSON.stringify(next[currentIndex])===JSON.stringify(entry.after)){next.splice(currentIndex,1,clonePlannerTodo(entry.before));restored++}
		if(entry.generated){const generatedIndex=next.findIndex(item=>item.id===entry.generated?.id);if(generatedIndex>=0&&JSON.stringify(next[generatedIndex])===JSON.stringify(entry.generated))next.splice(generatedIndex,1)}
	}
	if(restored>0){await registrySet('todos',next);todos.value=next}
	completedUndoItems.value=[];if(completedUndoTimer)window.clearTimeout(completedUndoTimer);completedUndoTimer=null;
}
function editPlannerTodo(item:HataskTodoItem):void{void editTodo(item.id)}
async function archivePlannerTodo(item:HataskTodoItem):Promise<void>{await archiveTodo(item.id)}
async function restorePlannerTodo(item:HataskTodoItem):Promise<void>{await restoreTodo(item.id)}
async function deletePlannerTodo(item:HataskTodoItem):Promise<void>{await deleteTodo(item.id)}
function openFolderManager(startCreate=true):void{showFolderMgr.value=true;showFolderCreate.value=startCreate;nextTick(()=>window.document.querySelector('.htk-folder-manager')?.scrollIntoView({behavior:plannerScrollBehavior(),block:'nearest'}))}
function closeFolderManager():void{showFolderMgr.value=false;showFolderCreate.value=false}
function managePlannerFolder(filterId:string):void{if(filterId.startsWith('folder:'))activeFolder.value=filterId.slice(7);openFolderManager(false)}
async function openFolderActions(folderId:string,index:number):Promise<void>{
	if(plannerReadOnly.value)return;const folder=activeFolders.value.find(item=>item.id===folderId);if(!folder)return;
	const actions:Array<{value:'rename'|'color'|'up'|'down'|'archive';text:string}>=[{value:'rename',text:copy.renameFolderTitle},{value:'color',text:copy.changeColor}];
	if(index>0)actions.push({value:'up',text:plannerCopy.moveUp});if(index<activeFolders.value.length-1)actions.push({value:'down',text:plannerCopy.moveDown});actions.push({value:'archive',text:plannerCopy.archive});
	const{canceled,result}=await dialogs.actions({type:'question',title:folder.name,actions});if(canceled)return;
	if(result==='rename')await renameFolder(folder.id);else if(result==='color')await changeFolderColor(folder.id);else if(result==='up')await moveFolder(folder.id,-1);else if(result==='down')await moveFolder(folder.id,1);else if(result==='archive')await deleteFolder(folder.id);
}
async function saveTodosAsTemplates(ids:readonly string[]):Promise<void>{
	const selected=todos.value.filter(todo=>ids.includes(todo.id));if(selected.length===0)return;
	const start=plannerTemplatePosition();
	const additions=selected.map((todo,index):HataskPlannerTemplate=>({
		id:generateId(),kind:'todo',name:todo.text,position:start+index,archivedAt:null,createdAt:new Date().toISOString(),
		payload:{text:todo.text,duePreset:todoTemplateDuePreset(todo.due||''),due:todo.due||'',dueLabel:todo.due?formatDue(todo.due):'',time:todo.time||'',folder:todo.folder||'',comment:todo.comment||'',priority:todo.priority,subtasks:(todo.subtasks||[]).map(subtask=>({id:generateId(),text:subtask.text,done:false})),recurrence:{...(todo.recurrence||{frequency:'none',interval:1})}},
	}));
	await savePlannerTemplates([...plannerTemplates.value,...additions]);os.toast(plannerCopyx.templatesSaved({count:additions.length.toString()}));
}
async function completePlannerTodos(ids:readonly string[]):Promise<void>{
	const completed=completeTodoDrafts(todos.value,ids);if(completed.undo.length===0)return;
	todoCompletionIds.value=[...new Set([...todoCompletionIds.value,...completed.undo.map(entry=>entry.before.id)])];
	try{await registrySet('todos',completed.next);todos.value=completed.next;registerCompletedUndo(completed.undo)}
	finally{window.setTimeout(()=>{const completedIds=new Set(completed.undo.map(entry=>entry.before.id));todoCompletionIds.value=todoCompletionIds.value.filter(id=>!completedIds.has(id))},520)}
}
async function promptPlannerDue(defaultValue:string):Promise<string|null>{
	const {canceled,result}=await dialogs.inputText({title:copy.dueDate,text:plannerCopy.dateInputHint,default:defaultValue,maxLength:10});if(canceled)return null;
	const value=typeof result==='string'?result.trim():'';if(value&&!/^\d{4}-\d{2}-\d{2}$/.test(value)){os.toast(plannerCopy.invalidDate);return null}return value;
}
async function updatePlannerTodos(ids:readonly string[],update:(todo:HataskPlannerTodo)=>HataskPlannerTodo):Promise<void>{
	const idSet=new Set(ids);const next=todos.value.map(todo=>idSet.has(todo.id)?update(clonePlannerTodo(todo)):todo);await registrySet('todos',next);todos.value=next;
}
async function handleTodoDropTarget(ids:string[],targetId:string):Promise<void>{
	if(plannerReadOnly.value||ids.length===0)return;
	if(targetId.startsWith('folder:')){const folderId=targetId.slice(7);if(!activeFolders.value.some(folder=>folder.id===folderId))return;await updatePlannerTodos(ids,todo=>({...todo,folder:folderId}));return}
	if(targetId==='today'){await updatePlannerTodos(ids,todo=>({...todo,done:false,doneAt:undefined,due:localDateKey(),archivedAt:null}));return}
	if(targetId==='upcoming'){
		const due=await promptPlannerDue(localDateKey(addCalendarDays(new Date(),1)));if(due==null)return;
		await updatePlannerTodos(ids,todo=>({...todo,done:false,doneAt:undefined,due,archivedAt:null}));return;
	}
	if(targetId==='priority'){await updatePlannerTodos(ids,todo=>({...todo,priority:'high'}));return}
	if(targetId==='completed'){await completePlannerTodos(ids);return}
	if(targetId==='templates'){await saveTodosAsTemplates(ids)}
}
async function handleTodoBulkAction(action:'complete'|'move'|'due'|'priority'|'archive',ids:string[]):Promise<void>{
	if(plannerReadOnly.value||ids.length===0)return;
	if(action==='complete'){await completePlannerTodos(ids);return}
	if(action==='move'){
		const {canceled,result}=await dialogs.actions({type:'question',title:plannerCopy.bulkMove,actions:[{value:'',text:copy.noFolder},...activeFolders.value.map(folder=>({value:folder.id,text:`${folder.emoji||'📁'} ${folder.name}`}))]});
		if(!canceled&&typeof result==='string')await updatePlannerTodos(ids,todo=>({...todo,folder:result}));return;
	}
	if(action==='due'){
		const due=await promptPlannerDue(localDateKey());if(due!=null)await updatePlannerTodos(ids,todo=>({...todo,due}));return;
	}
	if(action==='priority'){
		const {canceled,result}=await dialogs.actions({type:'question',title:plannerCopy.priority,actions:[{value:'none',text:plannerCopy.priorityNone},{value:'low',text:plannerCopy.priorityLow},{value:'medium',text:plannerCopy.priorityMedium},{value:'high',text:plannerCopy.priorityHigh}]});
		if(!canceled&&(result==='none'||result==='low'||result==='medium'||result==='high'))await updatePlannerTodos(ids,todo=>({...todo,priority:result}));return;
	}
	const {canceled}=await dialogs.confirm({type:'warning',text:plannerCopyx.confirmBulkArchive({count:ids.length.toString()})});if(canceled)return;
	await updatePlannerTodos(ids,todo=>({...todo,archivedAt:new Date().toISOString()}));
}
async function addFolder(){if(plannerReadOnly.value||!newFolderName.value.trim())return;const maxPosition=folders.value.reduce((maximum,folder)=>Math.max(maximum,folder.position??-1),-1);const next=[...folders.value,{id:generateId(),name:newFolderName.value.trim(),emoji:newFolderEmoji.value||'📁',color:newFolderColor.value||'',position:maxPosition+1,archivedAt:null}];await registrySet('folders',next);folders.value=next;newFolderName.value='';newFolderEmoji.value='📁';newFolderColor.value='';showFolderCreate.value=false}
async function deleteFolder(folderId:string){if(plannerReadOnly.value)return;const folder=folders.value.find(item=>item.id===folderId&&item.archivedAt==null);if(!folder)return;const{canceled}=await dialogs.confirm({type:'warning',text:copyx.confirmDeleteFolder({name:folder.name})});if(canceled)return;const next=folders.value.map(item=>item.id===folder.id?{...item,archivedAt:new Date().toISOString()}:item);await registrySet('folders',next);folders.value=next;if(activeFolder.value===folder.id)activeFolder.value='all'}
async function renameFolder(folderId:string){if(plannerReadOnly.value)return;const folder=folders.value.find(item=>item.id===folderId&&item.archivedAt==null);if(!folder)return;const{canceled,result}=await dialogs.inputText({title:copy.renameFolderTitle,text:copy.newNamePrompt,default:folder.name});if(!canceled&&result){const next=folders.value.map(item=>item.id===folder.id?{...item,name:result}:item);await registrySet('folders',next);folders.value=next}}
async function moveFolder(folderId:string,direction:number){if(plannerReadOnly.value)return;const ordered=activeFolders.value;const index=ordered.findIndex(folder=>folder.id===folderId);const other=ordered[index+direction];const current=ordered[index];if(!current||!other)return;const next=folders.value.map(folder=>folder.id===current.id?{...folder,position:other.position}:folder.id===other.id?{...folder,position:current.position}:folder);await registrySet('folders',next);folders.value=next}
async function changeFolderColor(folderId:string){if(plannerReadOnly.value)return;const folder=folders.value.find(item=>item.id===folderId&&item.archivedAt==null);if(!folder)return;const{canceled,result}=await dialogs.actions({type:'question',title:copy.folderColorTitle,actions:[...folderColors.value.map(c=>({value:c.value,text:c.label})),{value:'',text:copy.none}]});if(canceled)return;const next=folders.value.map(item=>item.id===folder.id?{...item,color:result}:item);await registrySet('folders',next);folders.value=next}

type HataskJournalKey = 'moods' | 'meals' | typeof HATASK_MEAL_TEMPLATE_KEY;
const journalWrites = new Set<HataskJournalKey>();
const pendingJournalSaves = new Set<Promise<void>>();
const recordImportPending = ref(false);

async function readJournalForImport(key: 'moods' | 'meals'): Promise<unknown[]> {
	try {
		const rows: unknown = await misskeyApi('i/registry/get', { scope: SCOPE, key });
		if (!Array.isArray(rows)) throw new TypeError('Invalid Hatask journal collection');
		return rows;
	} catch (error) {
		if ((error as { code?: string } | null)?.code === 'NO_SUCH_KEY') return [];
		throw error;
	}
}

const unregisterHataskRecordSync = registerHataskRecordSync({
	beforeImport: async () => {
		if (!dataLoaded.value) throw new Error('Hatask journals are still loading');
		recordImportPending.value = true;
		await Promise.all([...pendingJournalSaves]);
	},
	markUnsafe: () => { journalValidKeys.value = journalValidKeys.value.filter(key => key !== 'moods' && key !== 'meals'); },
	afterImport: async () => {
		const [nextMoods, nextMeals] = await Promise.all([readJournalForImport('moods'), readJournalForImport('meals')]);
		moodJournalRows.value = nextMoods;
		mealJournalRows.value = nextMeals;
		loadedKeys.add('moods'); loadedKeys.add('meals');
		journalValidKeys.value.push('moods', 'meals');
		await refreshHataskFlowerStateAfterUpdate();
	},
	finish: () => { recordImportPending.value = false; },
});
onUnmounted(unregisterHataskRecordSync);

function journalWritable(key: string): boolean {
	return !recordImportPending.value && dataLoaded.value && loadedKeys.has(key) && journalValidKeys.value.includes(key);
}

async function commitJournalChange(key: HataskJournalKey, change: HataskJournalChange): Promise<void> {
	if (!journalWritable(key) || journalWrites.has(key)) throw new Error('Hatask journal write is not ready');
	const target = key === 'moods' ? moodJournalRows : key === 'meals' ? mealJournalRows : mealTemplates;
	journalWrites.add(key);
	const save = (async () => {
		try {
			// Keep the original arrays and drafts until the server acknowledges the write.
			target.value = await persistJournalChange(target.value, change, next => registrySet(key, next));
			if (props.embedded) hataGoesHost?.changed();
		} finally {
			journalWrites.delete(key);
		}
	})();
	pendingJournalSaves.add(save);
	try { await save; } finally { pendingJournalSaves.delete(save); }
}

async function saveMoodEntry(entry: HataskJournalEntry, existingId?: string): Promise<void> {
	await commitJournalChange('moods', { type: 'save', value: entry, existingId });
}

async function deleteMoodEntry(id: string): Promise<void> { await commitJournalChange('moods', { type: 'delete', id }); }

async function saveMealEntry(entry: HataskJournalEntry, existingId?: string): Promise<void> {
	await commitJournalChange('meals', { type: 'save', value: entry, existingId });
}

async function deleteMealEntry(id: string): Promise<void> { await commitJournalChange('meals', { type: 'delete', id }); }

async function saveMealTemplate(template: HataskMealTemplate, existingId?: string): Promise<void> {
	await commitJournalChange(HATASK_MEAL_TEMPLATE_KEY, { type: 'save', value: template, existingId });
}

async function deleteMealTemplate(id: string): Promise<void> { await commitJournalChange(HATASK_MEAL_TEMPLATE_KEY, { type: 'delete', id }); }


// レシピの初回同意。同意しないまま閉じたら Hatask App 一覧へ戻る(同意フラグは registry settings に同期)。
async function ackRecipeConsent(): Promise<void> {
  if (settings.value.recipeConsentShown === true) return;
  settings.value.recipeConsentShown = true;
  await registrySet('settings', settings.value);
}

// 免責ダイアログ: 初回必ず表示、以降は!マークから手動表示
async function ackMealDisclaimer(){showMealDisclaimer.value=false;if(!settings.value.mealDisclaimerShown){settings.value.mealDisclaimerShown=true;await registrySet('settings',settings.value)}}

// 名前の入力が閉じ終わってから、呼び出し元のレールを再開する。
async function inputFlowerName(props: { title: string; text: string; default: string; minLength: number; maxLength: number }): Promise<{ canceled: boolean; result?: string | null }> {
	const sourceTab = activeTab.value;
	const isSourceTabActive = () => hataskPageActive && activeTab.value === sourceTab;
	if (!isSourceTabActive() || sourceTab !== 'garden') return { canceled: true };
	const component = await import('@/components/MkDialog.vue').then(module => module.default);
	if (!isSourceTabActive()) return { canceled: true };
	return new Promise(resolve => {
		let outcome: { canceled: boolean; result?: string | null } = { canceled: true };
		const { dispose } = popup(component, {
			title: props.title, text: props.text,
			input: { type: 'text', default: props.default, minLength: props.minLength, maxLength: props.maxLength },
		}, {
			done: result => { outcome = result.canceled ? { canceled: true } : { canceled: false, result: typeof result.result === 'string' ? result.result : null }; },
			closed: () => { dispose(); resolve(isSourceTabActive() ? outcome : { canceled: true }); },
		});
	});
}

async function renameFlower(fl: any) {
	const sourceName = fl.name;
	const localizedName = localizeFloraName(sourceName);
	const { canceled, result } = await inputFlowerName({
		title: copy.renameFlowerTitle,
		text: copy.newNamePrompt,
		default: localizedName,
		minLength: 1,
		maxLength: 80,
	});
	const trimmedResult = typeof result === 'string' ? result.trim() : '';
	if (canceled || !trimmedResult) return;
	const renamed = { ...fl, name: trimmedResult === localizedName ? sourceName : trimmedResult };
	if (fl.v2) {
		applyFlowerState(await renameHataskFlower(fl.id, renamed.name));
		invalidateCommunityFlowers();
		return;
	}
	await registrySet('gallery', gallery.value.map(item => item.id === fl.id ? renamed : item));
	fl.name = renamed.name;
	await syncFlowerGallery([fl]);
}

const FLOWER_SYNC_BATCH_SIZE = 100;

function flowerSyncString(value: unknown, maxLength: number, fallback: string): string {
	const text = typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
	return text || fallback;
}

async function syncFlowerGallery(items: unknown[] = gallery.value): Promise<void> {
	const flowers = items
		.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
		.map((item, index) => ({
			clientFlowerId: flowerSyncString(item.clientFlowerId ?? item.id, 64, `flower-${index}`),
			emoji: flowerSyncString(item.emoji, 32, '🌼'),
			name: flowerSyncString(item.name, 80, copy.noFlowersYet),
			hanakotoba: flowerSyncString(item.hanakotoba, 256, ''),
			harvestedAt: stableHarvestedAt(item),
		}));
	for (let index = 0; index < flowers.length; index += FLOWER_SYNC_BATCH_SIZE) {
		try {
			await misskeyApi('hatask/flowers/sync', { flowers: flowers.slice(index, index + FLOWER_SYNC_BATCH_SIZE) });
		} catch (error) {
			console.warn('Failed to sync Hatask flower gallery:', error);
			return;
		}
	}
}

let communityFlowerRequestSequence = 0;
let skipNextCommunityFlowerWatch = false;

// 関係の変更後は古い応答や開いた詳細も破棄し、認可済みのページを取り直す。
function invalidateCommunityFlowers(): void {
	++communityFlowerRequestSequence;
	if (activeFlowerCollection?.kind === 'community') closeFlowerCollection();
	if (activeFlowerPopup?.kind !== 'personal') closeFlowerDetail();
	communityFlowers.value = [];
	communityFlowerTotal.value = 0;
	communityFlowerTotalPages.value = 1;
	communityFlowersLoading.value = false;
	communityFlowersError.value = false;
	const shouldLoad = dataLoaded.value && hataskPageActive && activeTab.value === 'garden' && !window.document.hidden;
	skipNextCommunityFlowerWatch = shouldLoad && communityFlowerPage.value !== 1;
	communityFlowerPage.value = 1;
	if (shouldLoad) void loadCommunityFlowers();
}

watch(mutedUsersRevision, invalidateCommunityFlowers);
useGlobalEvent('userBlockingChanged', invalidateCommunityFlowers);
const flowerMainConnection = useStream().useChannel('main');
flowerMainConnection.on('follow', invalidateCommunityFlowers);
flowerMainConnection.on('unfollow', invalidateCommunityFlowers);
useStream().on('_connected_', invalidateCommunityFlowers);

async function loadCommunityFlowers(): Promise<void> {
	const requestSequence = ++communityFlowerRequestSequence;
	if (activeFlowerPopup?.kind !== 'personal') closeFlowerDetail();
	communityFlowersLoading.value = true;
	communityFlowersError.value = false;
	try {
		const response = await misskeyApi('hatask/flowers/list', { page: communityFlowerPage.value, limit: 12, order: communityFlowerOrder.value });
		if (requestSequence !== communityFlowerRequestSequence) return;
		const totalPages = Math.max(1, response.totalPages || Math.ceil(response.total / 12));
		if (communityFlowerPage.value > totalPages) {
			communityFlowerTotalPages.value = totalPages;
			skipNextCommunityFlowerWatch = true;
			communityFlowerPage.value = totalPages;
			await loadCommunityFlowers();
			return;
		}
		communityFlowers.value = response.items.map(item => ({ ...item, harvestedAt: stableHarvestedAt(item) }));
		communityFlowerTotal.value = response.total;
		communityFlowerTotalPages.value = totalPages;
		if (response.myVisibility === 'public' || response.myVisibility === 'followers' || response.myVisibility === 'private') flowerVisibility.value = response.myVisibility;
	} catch (error) {
		if (requestSequence !== communityFlowerRequestSequence) return;
		communityFlowersError.value = true;
		console.warn('Failed to load Hatask flower gallery:', error);
	} finally {
		if (requestSequence === communityFlowerRequestSequence) communityFlowersLoading.value = false;
	}
}

async function updateFlowerVisibility(next: FlowerVisibility): Promise<void> {
	if (flowerVisibility.value === next || flowerVisibilitySaving.value) return;
	flowerVisibilitySaving.value = true;
	try {
		const response = await misskeyApi('hatask/flowers/visibility/update', { visibility: next });
		flowerVisibility.value = response.visibility;
		communityFlowerPage.value = 1;
		await loadCommunityFlowers();
	} catch (error) {
		console.warn('Failed to update Hatask flower visibility:', error);
		os.toast(copy.flowerVisibilityUpdateFailed);
	} finally {
		flowerVisibilitySaving.value = false;
	}
}

function setCommunityFlowerOrder(order: 'newest' | 'oldest'): void {
	if (communityFlowerOrder.value === order) return;
	communityFlowerOrder.value = order;
	communityFlowerPage.value = 1;
}

function setGalleryOrder(order: 'newest' | 'oldest'): void {
	if (galleryOrder.value !== order) {
		galleryOrder.value = order;
		galleryPage.value = 1;
	}
}

async function reportCommunityFlower(item: CommunityFlower): Promise<void> {
	if (!item.user) return;
	const component = await import('@/components/MkAbuseReportWindow.vue').then(module => module.default);
	if (!hataskPageActive || activeTab.value !== 'garden' || !communityFlowers.value.some(flower => flower.id === item.id)) return;
	await new Promise<void>(resolve => {
		const { dispose } = popup(component, {
			user: item.user!,
			initialComment: copyx.flowerReportComment({ name: localizeFloraName(item.name), date: formatFlowerDate(item) }),
		}, { closed: () => { dispose(); resolve(); } });
	});
}

let navProtectionObserver:MutationObserver|null=null;
let navVisibilityTimer:ReturnType<typeof setInterval>|null=null;
const akatsukiNow = ref(new Date());
const akatsukiMoodJournal = ref<InstanceType<typeof HataskJournal> | null>(null);
const akatsukiMealJournal = ref<InstanceType<typeof HataskJournal> | null>(null);
// Hataskey UI 3 の右ペインで選んだ気分(?tab=mood&mood=1〜5)を、記録欄で選択済みにして開く。
// 同じURLで何度も上書きしないよう、適用した組み合わせを覚えておく。
let appliedMoodRequest = '';
watch([
	() => routeRouter.currentRef.value.props.get('mood'),
	activeTab,
	dataLoaded,
	akatsukiMoodJournal,
], async ([mood, tab, loaded, journal]) => {
	const level = Number(mood);
	const request = `${routeRouter.currentRef.value.props.get('tab') ?? ''}:${mood ?? ''}`;
	if (!mood) { appliedMoodRequest = ''; return; }
	if (tab !== 'mood' || !loaded || journal == null || request === appliedMoodRequest) return;
	appliedMoodRequest = request;
	await nextTick();
	journal.focusFromHome(undefined, level);
}, { immediate: true });
// 同じく ?tab=meal&meal=breakfast|lunch|dinner で、押した食事の枠を選択済みにして開く。
let appliedMealRequest = '';
watch([
	() => routeRouter.currentRef.value.props.get('meal'),
	activeTab,
	dataLoaded,
	akatsukiMealJournal,
], async ([meal, tab, loaded, journal]) => {
	const request = `${routeRouter.currentRef.value.props.get('tab') ?? ''}:${meal ?? ''}`;
	if (!meal) { appliedMealRequest = ''; return; }
	if (tab !== 'meal' || !loaded || journal == null || request === appliedMealRequest) return;
	appliedMealRequest = request;
	await nextTick();
	journal.focusFromHome(String(meal));
}, { immediate: true });
const akatsukiUsageOwner = $i?.id;
const akatsukiUsage = ref(readAkatsukiUsage(akatsukiUsageOwner));
const akatsukiTools = computed(() => [
	...tabs.value.filter(tab => tab.id !== 'home').map(tab => ({ id: tab.id, label: tab.label, icon: tab.icon })),
	...homeApps.value.filter(app => !props.embedded || app.id !== 'hatasettings').map(app => ({ id: app.id, label: app.label, icon: app.icon })),
	{ id: 'settings', label: copy.hataskSettings, icon: 'ti ti-palette' },
	...(canUseMascot.value ? [{ id: 'mascot', label: 'マスコット', icon: 'ti ti-mood-smile' }] : []),
	...(!props.embedded ? [{ id: 'games', label: 'ゲーム', icon: 'ti ti-device-gamepad-2' }] : []),
]);
const akatsukiFeedbackNotifications = computed(() => canAccessHataFeed.value && settings.value.showFeedbackNotif !== false
	? [...hfNotifs.value].sort((a, b) => Number(a.isRead) - Number(b.isRead)).slice(0, 3) : []);

function trackAkatsukiTool(id: string): void {
	if (!akatsukiUsageOwner || $i?.id !== akatsukiUsageOwner) return;
	akatsukiUsage.value = recordAkatsukiUsage(akatsukiUsageOwner, id, akatsukiTools.value.map(tool => tool.id));
}

watch(activeTab, tab => { if (dataLoaded.value) trackAkatsukiTool(tab); });

function openAkatsukiFeedbackNotification(notification: HataFeedNotif): void {
	if (!canAccessHataFeed.value) return;
	trackAkatsukiTool('feed');
	void onHfNotifClick(notification);
}

const akatsukiSnapshot = computed(() => buildHataskAkatsukiModel({
  now: akatsukiNow.value,
  locale: versatileLang,
  loading: !dataLoaded.value,
  known: {
    planner: dataLoaded.value && plannerMigrationReady && loadedKeys.has('todos') && loadedKeys.has('events'),
    moods: dataLoaded.value && journalValidKeys.value.includes('moods'),
    meals: dataLoaded.value && journalValidKeys.value.includes('meals'),
    flower: dataLoaded.value && loadedKeys.has('flower'),
  },
  readOnly: plannerReadOnly.value,
  events: visibleCalendarEvents.value,
  todos: todos.value,
  moods: moods.value,
  meals: meals.value,
  flower: { name: currentFlowerDisplayName.value, emoji: flower.value.emoji, progress: flower.value.progress, remaining: estimateRemaining.value },
  accountCreatedAt: $i?.createdAt,
  loginDays: loginDays.value,
  loginRanking: loginRanking.value,
  eyePhrase: eyePhrase.value,
  feedbackUnread: hfUnread.value,
  feedback: { allowed: canAccessHataFeed.value, known: hfState.value === 'ready' },
  apps: akatsukiTools.value,
  usage: akatsukiUsage.value,
  settings: settings.value,
}));
const akatsukiModel = computed(() => ({ ...akatsukiSnapshot.value.model, canModerate: canReviewRecords.value }));
const akatsukiAppCounts = computed(() => akatsukiSnapshot.value.counts);
const akatsukiFavoritesSaving = ref(false);
const akatsukiFavoritesError = ref('');

async function saveAkatsukiFavorites(favorites: HataskAkatsukiFavoriteId[]): Promise<void> {
	if (!dataLoaded.value || !loadedKeys.has('settings') || akatsukiFavoritesSaving.value) return;
	const patch = { akatsukiHomeFavorites: normalizeHataskAkatsukiFavorites(favorites) };
	akatsukiFavoritesSaving.value = true;
	akatsukiFavoritesError.value = '';
	try {
		await registrySet('settings', { ...settings.value, ...patch });
		settings.value = { ...settings.value, ...patch };
	} catch {
		akatsukiFavoritesError.value = 'お気に入りを保存できませんでした。もう一度お試しください。';
	} finally {
		akatsukiFavoritesSaving.value = false;
	}
}

function navigateAkatsuki(tab: HataskAkatsukiTab): void {
  if (tab === 'review' && !canReviewRecords.value) return;
  activeTab.value = tab;
}

function searchAkatsuki(query = ''): void {
  if (activeTab.value === 'review' && canReviewRecords.value) { recordReview.value?.search(query); return; }
  searchQuery.value = query;
  showSearch.value = true;
}

function openAkatsukiApp(id: string): void {
  if (tabs.value.some(tab => tab.id === id)) { activeTab.value = id; return; }
  const actions: Record<string, () => void> = {
    settings: openHataskSettings,
    drawing: openDrawingTool,
    card: openHataCard,
    studio: openHataSideStudio,
    whatsnew: openHataWhatsNew,
    hatasettings: openHataSettings,
    intro: openHataIntro,
    analyze: openHatalyze,
    feed: () => { if (canAccessHataFeed.value) openHataFeed(); },
    hatady: openHatady,
    earthquake: openEarthquake,
    mascot: () => { if (canUseMascot.value) goToMascotSettings(); },
    games: () => { cleanupHataskState(); routeRouter.push('/games'); },
  };
  if (actions[id]) {
    if ((id === 'feed' && !canAccessHataFeed.value) || (id === 'mascot' && !canUseMascot.value)) return;
    trackAkatsukiTool(id);
    actions[id]();
  }
}

async function handleAkatsukiAction(action: HataskAkatsukiAction): Promise<void> {
  switch (action.type) {
    case 'exit': exitHatask(); break;
    case 'open-event': {
      const event = allCalendarEvents.value.find(item => item.id === action.id);
      if (event) goToEvent(event);
      break;
    }
    case 'create-event':
      activeTab.value = 'cal';
      await nextTick();
      if (!plannerReadOnly.value) eventCaptureRef.value?.focus();
      break;
    case 'create-todo':
      activeTab.value = 'todo';
      await nextTick();
      focusTodoEditor();
      break;
    case 'record-mood':
      activeTab.value = 'mood';
      await nextTick();
      akatsukiMoodJournal.value?.focusFromHome();
      break;
    case 'record-meal':
      activeTab.value = 'meal';
      await nextTick();
      akatsukiMealJournal.value?.focusFromHome(action.id);
      break;
    case 'record-cooking':
      activeTab.value = 'recipe';
      await nextTick();
      recipeView.value?.openRecord();
      break;
    case 'water-flower': activeTab.value = 'garden'; break;
    case 'open-app': if (action.id) openAkatsukiApp(action.id); break;
    case 'toggle-todo':
      if (!action.id || plannerReadOnly.value) break;
      try { registerCompletedUndo(await toggleTodo(action.id, true)); } catch { dialogs.alert({ type: 'error', text: i18n.ts._hata._hatask._journal.saveFailure }); }
      break;
    case 'snooze-event': {
      const event = allCalendarEvents.value.find(item => item.id === action.id);
      if (event) { goToEvent(event, false); await handleCalendarMoveRequest(plannerCalendarEvent(event)); }
      break;
    }
  }
}

onMounted(async () => {
	window.document.addEventListener('visibilitychange', invalidateCommunityFlowers);
	window.addEventListener('focus', invalidateCommunityFlowers);
	window.addEventListener(HATASK_FLOWER_GROWTH_EVENT, onHataskFlowerGrowth);
	window.addEventListener(HATASK_FLOWER_STATE_EVENT, onFlowerState);
// 旗鯖fork(v2 §16①): ブートは onActivated(表示されるたび)で再生する。
//   hatask は keep-alive のため遷移復帰では onMounted が走らず、以前は初回リロード時しか出なかった。
//   keep-alive なら onActivated が初回mount含め必ず走るので、そちらに一本化。
//   keep-alive でない環境向けの保険として、onActivated が走らなければ onMounted 側で再生する。
if (!props.embedded) nextTick(()=>{ if(!bootUsedActivated) playBoot(); });
	if (!props.embedded) hatakMascotActive.value = true;
// 旗鯖fork(#36): HataFeed通知タイル＋地震・津波タイルの起動
if (canAccessHataFeed.value) { void loadHfNotifs(); hfTimer = window.setInterval(loadHfNotifs, 30_000); }
loadEq();eqStream=useStream();eqStream.on('earthquakeEvent',onEqEvent);eqStream.on('_connected_',onEqStreamConn);eqStream.on('_disconnected_',onEqStreamDisc);streamConnected.value=eqStream.state==='connected';
// 旗鯖fork(perf): WS未接続のときだけ60sポーリング。接続成功で stopEqPoll、切断で startEqPoll が走る。
if(!streamConnected.value)startEqPoll();
// 旗鯖fork: Hataskを開いたら実績「Hataskへようこそ」を解除(冪等。既に解除済みなら何もしない)
claimAchievement('welcomeToHatask');
window.localStorage.setItem('hatask_initialized', '1');
updateClock();
clockInterval = setInterval(updateClock, 30000);
mediaQuery = window.matchMedia('(prefers-color-scheme:dark)');
mediaQuery.addEventListener('change', onMediaChange);
startHtkThemeWatch();
// Delayed re-detect for late CSS loading (fixes initial black text on all backgrounds)
setTimeout(()=>{misskeyTheme.value=detectMisskeyTheme()},500);
// Watch for Misskey theme changes via MutationObserver
const themeObs=new MutationObserver(()=>{misskeyTheme.value=detectMisskeyTheme()});
themeObs.observe(document.documentElement,{attributes:true,attributeFilter:['data-color-mode','class','style']});
// Protect mobile nav from Misskey's modal system (inert, pointer-events, etc.)
nextTick(() => {
		if (props.embedded) return;
  try {
    const navEl = document.querySelector('.htk-nav-mobile') as HTMLElement|null;
    if (navEl) {
      // MutationObserver: body に inert 属性が付いたらナビから除去
      navProtectionObserver = new MutationObserver(() => {
        if (navEl.closest('[inert]') || navEl.hasAttribute('inert')) {
          navEl.removeAttribute('inert');
          navEl.style.pointerEvents = 'auto';
        }
      });
      navProtectionObserver.observe(document.body, { attributes: true, attributeFilter: ['inert'] });
      // 定期チェック: ナビが非表示/非操作可能になっていたら強制復帰（500msごと）
      navVisibilityTimer = setInterval(() => {
        const nav = document.querySelector('.htk-nav-mobile') as HTMLElement|null;
        if (nav && showMobileNav.value) {
          if (nav.hasAttribute('inert')) nav.removeAttribute('inert');
          nav.style.pointerEvents = 'auto';
          nav.style.visibility = 'visible';
          nav.style.opacity = '1';
          nav.style.display = 'flex';
        }
        // Misskey標準フッターが再表示されていたら再非表示（リサイズ/UI変更対策）
        if (document.body.dataset.hataskActive === '1') {
          const candidates = document.querySelectorAll<HTMLElement>('div > div > div');
          for (const el of candidates) {
            if (el.closest('.htk-root') || el.closest('.htk-nav-mobile') || el.dataset.htaskHidden) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'grid' && cs.gridTemplateColumns.split(' ').length === 5 && cs.borderTopStyle !== 'none' && cs.position === 'relative') {
              el.dataset.htaskHidden = '1';
              el.style.setProperty('display', 'none', 'important');
              break;
            }
          }
        }
      }, 500);
    }
  } catch {}
});
// Hide Misskey page header
nextTick(() => {
		if (props.embedded) return;
  try {
    const el = rootEl.value;
    if (el) {
      const p = el.closest('[class*="body"]');
      if (p && p.previousElementSibling) {
        const prev = p.previousElementSibling;
        if ('style' in prev) (prev as any).style.display = 'none';
      }
    }
  } catch {}
});
// Hide Misskey standard mobile navbar (bottom bar)
nextTick(() => {
		if (props.embedded) return;
  try {
    // まず外部TLの残骸をクリーンアップ（外部TL→Hatask遷移対策）
    document.querySelectorAll<HTMLElement>('.ext-tl-side-menu-btn').forEach(el => el.remove());
    document.querySelectorAll<HTMLElement>('[data-ext-tl-hidden]').forEach(el => {
      el.style.removeProperty('display');
      delete el.dataset.extTlHidden;
    });

    document.body.dataset.hataskActive = '1';
    // 方法1: Misskey の mobile-footer-menu を直接探す
    // 特徴: grid 5列, position:relative, z-index:1, border-top あり, body直下のUI内
    const hideFooter = () => {
      const candidates = document.querySelectorAll<HTMLElement>('div > div > div');
      for (const el of candidates) {
        if (el.closest('.htk-root') || el.closest('.htk-nav-mobile')) continue;
        const cs = getComputedStyle(el);
        const cols = cs.gridTemplateColumns.split(' ').length;
        if (cs.display === 'grid' && cols === 5 && cs.borderTopStyle !== 'none' && cs.position === 'relative') {
          el.dataset.htaskHidden = '1';
          el.style.setProperty('display', 'none', 'important');
          return true;
        }
      }
      // 方法2: フォールバック - 1fr 5列を持つ要素
      const allEls = document.querySelectorAll<HTMLElement>('body > div *');
      for (const el of allEls) {
        if (el.closest('.htk-root') || el.closest('.htk-nav-mobile')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'grid' && cs.gridTemplateColumns.includes('1fr 1fr 1fr 1fr 1fr')) {
          el.dataset.htaskHidden = '1';
          el.style.setProperty('display', 'none', 'important');
          return true;
        }
      }
      return false;
    };
    if (!hideFooter()) {
      // リトライ: 遷移アニメーション完了後に再試行
      setTimeout(() => { hideFooter(); }, 300);
      setTimeout(() => { hideFooter(); }, 600);
    }
  } catch {}
});
try {
	await preparePlannerStorage();
} catch (error) {
	plannerMigrationReady = false;
	plannerStorageState.value = 'blocked';
	plannerStorageDetail.value = (error as Error)?.message || plannerCopy.readFailure;
}

const initFlower = pickRandomFlora();
	const defaultFlower = createHataskGrowingFlower({ emoji: initFlower.emoji, name: generateFlowerName(initFlower), speciesId: initFlower.speciesId, rare: initFlower.rare });
const defaultSettings = { darkMode: false, autoTheme: true, weekStart: 'mon', showClock: true, showEvents: true, showFlower: true, showMoodSummary: true, showMealSection: true, showFeedbackNotif: true, showEarthquake: true, moodRemind: false, moodRemindTimes: ['昼 12:00', '寝る前 23:00'], showMealSummary: true, mealDisclaimerShown: false, eyeDisclaimerShown: false, recipeConsentShown: false, theme: 'akatsuki', animations: true, todoSortModes: {}, todoMobileTabOrder: ['today', 'upcoming', 'all', 'completed', 'more'] };

// 各データを個別に取得（1つの失敗が他に影響しないようにする）
const loadResults = await Promise.allSettled([
  registryGet('todos', []),
  registryGet('folders', []),
  registryGet('moods', []),
  registryGet('flower', defaultFlower),
  registryGet('gallery', []),
  registryGet('settings', defaultSettings),
  registryGet('events', []),
  registryGet('meals', []),
  registryGet(HATASK_MEAL_TEMPLATE_KEY, []),
]);
// 取得成功したデータのみ代入（失敗したキーは初期値のまま → registrySetガードで保護）
// 移行検証に失敗した配列はサーバー上へそのまま保全し、型の崩れた値を
// UIへ流して二次障害を起こさない。再試行に成功するまで空の読取専用表示にする。
if (plannerMigrationReady && loadResults[0].status === 'fulfilled' && loadedKeys.has('todos')) todos.value = loadResults[0].value as HataskPlannerTodo[];
if (plannerMigrationReady && loadResults[1].status === 'fulfilled' && loadedKeys.has('folders')) folders.value = loadResults[1].value as HataskPlannerFolder[];
if (loadResults[2].status === 'fulfilled' && loadedKeys.has('moods') && Array.isArray(loadResults[2].value)) {
	moodJournalRows.value = loadResults[2].value;
	journalValidKeys.value.push('moods');
}
	// 花が未作成でもregistryGetが返した既定値は画面へ反映する。
	// 永続化は成長トラッカーがNO_SUCH_KEYを再確認してから行うため、通信失敗時に既存値を上書きしない。
	if (loadResults[3].status === 'fulfilled') {
		const normalizedFlower = normalizeHataskGrowingFlower(loadResults[3].value);
		if (normalizedFlower) flower.value = normalizedFlower;
	}
if (loadResults[4].status === 'fulfilled' && loadedKeys.has('gallery')) {
	const normalizedGallery = normalizeLocalFlowerGallery(loadResults[4].value);
	gallery.value = normalizedGallery.items;
	if (normalizedGallery.changed) await registrySet('gallery', gallery.value);
}
if (loadResults[5].status === 'fulfilled') acceptLoadedHataskSettings(loadResults[5].value);
if (plannerMigrationReady && loadResults[6].status === 'fulfilled' && loadedKeys.has('events')) events.value = loadResults[6].value as HataskPlannerEvent[];
if (loadResults[7].status === 'fulfilled' && loadedKeys.has('meals') && Array.isArray(loadResults[7].value)) {
	mealJournalRows.value = loadResults[7].value;
	journalValidKeys.value.push('meals');
}
if (loadResults[8].status === 'fulfilled' && loadedKeys.has(HATASK_MEAL_TEMPLATE_KEY) && Array.isArray(loadResults[8].value)) {
	mealTemplates.value = loadResults[8].value;
	journalValidKeys.value.push(HATASK_MEAL_TEMPLATE_KEY);
}
if (plannerMigrationReady) {
	try { await loadPlannerTemplates(); } catch (error) { console.warn('Hatask templates remain read-only:', error); }
}
dataLoaded.value = true;
	seedHataskFlowerGrowth(flower.value);
	try {
		applyFlowerState(await getHataskFlowerState());
		await syncHataskFlowerCount();
	} catch { /* Keep the saved count when the authoritative gallery is unavailable. */ }
await syncFlowerGallery(gallery.value);
if (activeTab.value === 'garden') await loadCommunityFlowers();
// 旗鯖fork(v2): 未設定キーを既定で補完(後方互換)。theme/animations 未設定の既存ユーザーには
//   既定テーマ(暁 akatsuki)・アニメON を割り当てる。保存済みの旧4テーマも保持する。
settings.value = { ...defaultSettings, ...settings.value };
// Check for closed RSVP notifications
await loadSharedEvents();
checkClosedRsvps();
// Show only one introduction, after a successful settings read and while still in Hatask.
hataskIntroductionReady = true;
showHataskIntroduction();
// 旗鯖fork(ハタキュ): 設定を読み終えた時点でテーマが確定するので、ここから風を回し始める。
// Schedule notifications
scheduleEventNotifications();
// Fetch login ranking
fetchLoginRanking();
// Eye phrase
updateEyePhrase();
eyeTimer = setInterval(updateEyePhrase, 10000);
	if (props.embedded && !props.paneActive) cleanupHataskState(true);
});

// KeepAlive対応: ページ離脱時にナビバーを非表示にする
onDeactivated(() => {
	if (props.embedded) closeGoesCapture();
	++sharedEventRequest;
	sharedEvents.value = sharedEvents.value.filter(event => event.userId === $i?.id);
	checkClosedRsvps();
	cleanupHataskState();
invalidateCommunityFlowers();
});
onActivated(() => {
	hataskPageActive = !props.embedded || props.paneActive;
	refreshSharedEventAccess();
	invalidateCommunityFlowers();
// HataFeedから戻ったときも未読とおすすめ表示を更新する。初回のタイマーとは重複させない。
if (!hfTimer && canAccessHataFeed.value) {
	void loadHfNotifs();
	hfTimer = window.setInterval(loadHfNotifs, 30_000);
}
showHataskIntroduction();
// 旗鯖fork(v2 §16①): hatask が表示されるたび(初回mount含む)ブートを再生。遷移復帰でも出るように。
bootUsedActivated = true;
if (!props.embedded) playBoot();
// 旗鯖fork(タスク8): keep-alive復帰時もフローティング連動フラグを立て直す
	if (!props.embedded) hatakMascotActive.value = true;
// 旗鯖fork: keep-alive復帰やウィンドウ遷移で onMounted が走らない場合に備え、
// onActivated でも実績を解除する(claimAchievementは冪等)。
claimAchievement('welcomeToHatask');
scheduleEventNotifications();
	showMobileNav.value = !props.embedded;
	if (props.embedded) return;
document.body.dataset.hataskActive = '1';
// KeepAlive復帰時にMisskeyフッターを再非表示
nextTick(() => {
  const hideMkFooter = () => {
    const candidates = document.querySelectorAll<HTMLElement>('div > div > div');
    for (const el of candidates) {
      if (el.closest('.htk-root') || el.closest('.htk-nav-mobile')) continue;
      const cs = getComputedStyle(el);
      const cols = cs.gridTemplateColumns.split(' ').length;
      if (cs.display === 'grid' && cols === 5 && cs.borderTopStyle !== 'none' && cs.position === 'relative') {
        el.dataset.htaskHidden = '1';
        el.style.setProperty('display', 'none', 'important');
        return true;
      }
    }
    const allEls = document.querySelectorAll<HTMLElement>('body > div *');
    for (const el of allEls) {
      if (el.closest('.htk-root') || el.closest('.htk-nav-mobile')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'grid' && cs.gridTemplateColumns.includes('1fr 1fr 1fr 1fr 1fr')) {
        el.dataset.htaskHidden = '1';
        el.style.setProperty('display', 'none', 'important');
        return true;
      }
    }
    return false;
  };
  if (!hideMkFooter()) {
    setTimeout(() => { hideMkFooter(); }, 300);
  }
});
});

onBeforeUnmount(() => {
cleanupHataskState();
invalidateCommunityFlowers();
});
onUnmounted(() => {
cleanupHataskState();
if (bootTimer) { clearTimeout(bootTimer); bootTimer=null; }
if (clockInterval) clearInterval(clockInterval);
if (eyeTimer) clearInterval(eyeTimer);
	if (archiveUndoTimer) window.clearTimeout(archiveUndoTimer);
	if (completedUndoTimer) window.clearTimeout(completedUndoTimer);
	flowerMainConnection.dispose();
	useStream().off('_connected_', invalidateCommunityFlowers);
	window.document.removeEventListener('visibilitychange', invalidateCommunityFlowers);
	window.removeEventListener('focus', invalidateCommunityFlowers);
	window.removeEventListener(HATASK_FLOWER_GROWTH_EVENT, onHataskFlowerGrowth);
	window.removeEventListener(HATASK_FLOWER_STATE_EVENT, onFlowerState);
if (mediaQuery) mediaQuery.removeEventListener('change', onMediaChange);
stopHtkThemeWatch();
eventTimerIds.forEach(id => clearTimeout(id));
});

let clearGoesCaptureAbort: (() => void) | undefined;

function closeGoesCapture(): void {
	clearGoesCaptureAbort?.();
	clearGoesCaptureAbort = undefined;
	captureKind.value = null;
	externalCaptureTarget.value = undefined;
	nextTick(() => { if (captureReturnFocus?.isConnected) captureReturnFocus.focus(); });
}

function trapGoesCaptureFocus(event: KeyboardEvent): void {
	const dialog = captureTarget.value?.closest('[role="dialog"]');
	if (!dialog) return;
	const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length > 0);
	const first = controls[0], last = controls[controls.length - 1];
	if (event.shiftKey && window.document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && window.document.activeElement === last) { event.preventDefault(); first.focus(); }
}

async function openGoesCapture(kind: string, signal?: AbortSignal, surface?: HTMLElement): Promise<void> {
	if (signal?.aborted) return;
	const target = kind === 'event' ? 'cal' : kind === 'cooking' ? 'recipe' : kind;
	if (target !== 'cal' && target !== 'todo' && target !== 'mood' && target !== 'meal' && target !== 'recipe' && target !== 'garden') return;
	if (!await waitForGoesOwner() || signal?.aborted) return;
	if (captureKind.value === null) {
		captureOriginTab = activeTab.value;
		captureReturnFocus = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
	}
	if (target === 'recipe') recipeMounted.value = true;
	clearGoesCaptureAbort?.();
	signal?.addEventListener('abort', closeGoesCapture, { once: true });
	clearGoesCaptureAbort = () => signal?.removeEventListener('abort', closeGoesCapture);
	externalCaptureTarget.value = surface;
	captureKind.value = target;
	await nextTick();
	if (signal?.aborted) return;
	if (kind === 'cooking') recipeView.value?.openRecord();
	else if (kind === 'recipe') recipeView.value?.openCreate();
	if (surface) surface.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), button:not(:disabled)')?.focus({ preventScroll: true });
	else captureCloseButton.value?.focus();
}

function onGoesCookingSaved(): void {
	if (props.embedded && captureKind.value !== null) hataGoesHost?.changed();
	else void offerHatadyReturn();
}

watch(() => props.requestedTab, tab => {
	if (!props.embedded || captureKind.value !== null) return;
	const requested = tab ?? 'home';
	if (tabs.value.some(item => item.id === requested) || requested === 'hataskapps') navigateAkatsuki(requested as HataskAkatsukiTab);
}, { immediate: true });
watch(activeTab, tab => {
	if (!props.embedded) return;
	if (captureKind.value !== null) {
		if (tab !== captureOriginTab) activeTab.value = captureOriginTab;
		return;
	}
	if (props.paneActive && tab !== (props.requestedTab ?? 'home')) emit('tabChange', tab);
}, { flush: 'sync' });
watch([plannerTheme, themeMode, dataLoaded], async () => {
	if (!props.embedded) return;
	await nextTick();
	const themeSurface = rootEl.value?.querySelector<HTMLElement>('.htk-akatsuki-layout') ?? rootEl.value;
	const style = themeSurface ? getComputedStyle(themeSurface) : null;
	const cssVars: Record<string, string> = {};
	for (const key of ['--bg', '--surface', '--fg', '--fg-2', '--fg2', '--accent', '--accent-ink', '--rule', '--card-radius', '--case-radius', '--control-radius', '--shadow', '--bg-image', '--htk-font-head', '--on-accent']) {
		const value = style?.getPropertyValue(key).trim();
		if (value) cssVars[key] = value;
	}
	emit('appearanceChange', { theme: plannerTheme.value, cssVars });
}, { immediate: true });
watch(() => props.paneActive, active => {
	if (!props.embedded) return;
	hataskPageActive = active;
	if (!active) cleanupHataskState(true);
	else {
		showHataskIntroduction();
		refreshSharedEventAccess(); invalidateCommunityFlowers();
		if (!hfTimer && canAccessHataFeed.value) { void loadHfNotifs(); hfTimer = window.setInterval(loadHfNotifs, 30_000); }
		if (!eqStream) {
			eqStream = useStream();
			eqStream.on('earthquakeEvent', onEqEvent);
			eqStream.on('_connected_', onEqStreamConn);
			eqStream.on('_disconnected_', onEqStreamDisc);
			streamConnected.value = eqStream.state === 'connected';
			if (!streamConnected.value) startEqPoll();
		}
	}
});
let goesOwnerDisposed = false;
const goesReadyWaiters = new Set<() => void>();

watch(dataLoaded, ready => {
	if (ready) { for (const resolve of goesReadyWaiters) resolve(); goesReadyWaiters.clear(); }
});

async function waitForGoesOwner(): Promise<boolean> {
	if (!dataLoaded.value && !goesOwnerDisposed) await new Promise<void>(resolve => goesReadyWaiters.add(resolve));
	return !goesOwnerDisposed && dataLoaded.value;
}

onUnmounted(() => {
	goesOwnerDisposed = true;
	for (const resolve of goesReadyWaiters) resolve();
	goesReadyWaiters.clear();
});

const goesResultWatchers = new Set<() => void>();
onUnmounted(() => { for (const stop of goesResultWatchers) stop(); });

async function openGoesServerRecord(kind: 'event' | 'flower' | 'cookingRecord', id: string, onClosed?: () => void): Promise<void> {
	const result = await misskeyApi<{ kind: string; item: Record<string, unknown> }>('hata/hatagoes/show', { kind, id });
	if (!props.paneActive) return;
	const component = (await import('@/components/hatagoes/HatagoesRecordDetail.vue')).default;
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- The active pane can change while import awaits.
	if (!props.paneActive) return;
	const { dispose } = popup(component, { kind, item: result.item }, {
		closed: () => { dispose(); onClosed?.(); },
		related: async (relatedKind, relatedId) => {
			if (!props.paneActive) return;
			if (relatedKind === 'recipe') {
				navigateAkatsuki('recipe');
				await nextTick();
				await recipeView.value?.openById(relatedId);
			} else {
				const { dispose: disposeLog } = popup((await import('@/components/HatadyConversation.vue')).default,
					{ logId: relatedId, variant: 'hatady' }, { closed: () => disposeLog(), changed: () => hataGoesHost?.changed() });
			}
		},
	});
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss -- The owner registration is fixed for this mounted pane.
const unregisterHataGoes = props.embedded ? hataGoesHost?.register('hatask', {
	openSettings: section => openHataskSettings(undefined, section),
	async recordMood(level) {
		if (!await waitForGoesOwner() || !journalWritable('moods')) throw new Error('Hatask mood journal unavailable');
		const { date, time } = journalLocalDateTime();
		await saveMoodEntry({ id: generateId(), date, time, level, emoji: '', note: '（ひとことなし）' });
	},
	async water(day) {
		if (!await waitForGoesOwner()) throw new Error('Hatask owner unavailable');
		await pourHataskFlower('self', day ? `hatagoes-home-water:${day}` : undefined);
	},
	async recordMeal(slot, signal, surface) {
		if (!await waitForGoesOwner() || !journalWritable('meals')) throw new Error('Hatask meal journal unavailable');
		await openGoesCapture('meal', signal, surface);
		if (signal?.aborted || captureKind.value !== 'meal') return;
		await nextTick();
		if (!akatsukiMealJournal.value) throw new Error('Hatask meal capture unavailable');
		akatsukiMealJournal.value.focusFromHome(slot);
	},
	async toggleTodo(id) {
		if (!await waitForGoesOwner()) throw new Error('Hatask owner unavailable');
		if (!plannerMigrationReady || !loadedKeys.has('todos') || !loadedKeys.has('events')) throw new Error('Hatask planner is not ready');
		if (!todos.value.some(todo => todo.id === id)) throw new Error('ToDo unavailable');
		registerCompletedUndo(await toggleTodo(id));
	},
	openTool: tool => { if (tool === 'drawing-tool') openDrawingTool(); else openHataWhatsNew(); },
	create: openGoesCapture,
	// This owner already applies its own writes; do not rehydrate mutable arrays
	// from a second load while an editor or storage transaction is in progress.
	refresh: () => { refreshSharedEventAccess(); invalidateCommunityFlowers(); },
	async openResult(kind, id, onClosed) {
		if (!await waitForGoesOwner() || !props.paneActive) return;
		for (const stop of goesResultWatchers) stop();
		goesResultWatchers.clear();
		try {
			if (kind === 'event' || kind === 'events') {
				const local = events.value.find(item => item.id === id || item.serverEventId === id);
				if (local) {
					goToEvent(allCalendarEvents.value.find(item => item.id === id || item.sourceEventId === local.id) ?? local);
					const current = viewingEvent.value;
					const stop = watch(viewingEvent, value => {
						if (value === current) return;
						stop(); goesResultWatchers.delete(stop); onClosed?.();
					});
					goesResultWatchers.add(stop);
				} else await openGoesServerRecord('event', id, onClosed);
			} else if (kind === 'todo' || kind === 'todos') {
				const todo = todos.value.find(item => item.id === id);
				if (!todo) throw new Error('unavailable');
				navigateAkatsuki('todo');
				plannerTodoView.value = todo.done || isTodoArchived(todo) ? 'completed' : 'all';
				activeFolder.value = 'all';
				plannerTodoSearch.value = '';
				await nextTick();
				const row = [...(rootEl.value?.querySelectorAll<HTMLElement>('[data-todo-id]') ?? [])].find(item => item.dataset.todoId === id);
				row?.scrollIntoView({ block: 'center' });
				row?.setAttribute('tabindex', '-1');
				row?.focus({ preventScroll: true });
				if (!row) throw new Error('unavailable');
				onClosed?.(); // An inline row selection has no detail popup to close.
			} else if (kind === 'mood' || kind === 'meal') {
				navigateAkatsuki(kind);
				await nextTick();
				if (!await (kind === 'mood' ? akatsukiMoodJournal.value : akatsukiMealJournal.value)?.openById(id)) throw new Error('unavailable');
				onClosed?.();
			} else if (kind === 'recipe') {
				navigateAkatsuki('recipe');
				await nextTick();
				if (!recipeView.value) throw new Error('unavailable');
				await recipeView.value.openById(id);
				onClosed?.(); // The recipe screen owns its own inline back navigation.
			} else if (kind === 'flower') {
				navigateAkatsuki('garden');
				await nextTick();
				const matchingFlower = personalFlowerViews.value.find(item => item.id === id);
				const anchor = rootEl.value;
				if (matchingFlower && anchor) openFlowerDetail('personal', { flower: matchingFlower, anchor, returnFocusTo: anchor }, onClosed);
				else await openGoesServerRecord('flower', id, onClosed);
			} else if (kind === 'cookingRecord') {
				await openGoesServerRecord('cookingRecord', id, onClosed);
			} else throw new Error('unavailable');
		} catch {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- The active pane can change across the awaited record lookup.
			if (props.paneActive) await dialogs.alert({ type: 'error', text: 'この記録は見つからないか、表示できません。' });
			onClosed?.();
		}
	},
}) : undefined;
onUnmounted(() => unregisterHataGoes?.());
</script>

<style lang="scss" src="../components/hatask/hatask-themes.scss"></style>
<style>
.htk-goes-capture-overlay { position: fixed; inset: 0; z-index: 2000000; background: #0008; display: grid; place-items: center; padding: 16px; }
.htk-root.htk-goes-capture { position: relative; inset: auto; width: min(980px, 100%); height: auto; min-height: 0; max-height: 90dvh; overflow: auto; background: var(--bg, var(--MI_THEME-panel)); border-radius: 16px; padding: 16px; }
.htk-goes-capture-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.htk-root[data-embedded='true'] { position: relative; inset: auto; min-height: 0; height: 100%; }
.htk-embedded-page { width: 100%; height: 100%; min-height: 0; overflow: hidden; }
.htk-root[data-embedded='true']:not(.htk-goes-capture) > .htk-app,
.htk-root[data-embedded='true']:not(.htk-goes-capture) > .htk-app > .htk-shell { height: 100%; min-height: 0; }
.htk-root.htk-goes-inline { position: relative; inset: auto; width: 100%; min-height: 0; height: auto; padding: 0; background: transparent; }
.htk-goes-inline [data-hatask-component='calendar'], .htk-goes-inline [data-hatask-component='todo'] { display: none; }
.htk-goes-inline .htk-tabpage { margin: 0; padding: 0; }
</style>
<style lang="scss" src="../components/hatask/hatask-hatakyu.scss"></style>

<style lang="scss" scoped>

/* 旗鯖fork(v2 §06): トークン/再マップは root と Teleport モーダル(.htk-modal-ov)の両方へ。
   背景色(--bg)は root のみ(モーダルのスクリム背景を壊さないため下で別途)。scoped のため当コンポーネント限定。 */
.htk-root[data-theme]{ background-color: var(--bg); }
.htk-root[data-theme], .htk-modal-ov[data-theme], .htk-event-details-theme[data-theme]{
  --success:#6ec072;
  --ease-spring:cubic-bezier(0.34,1.56,0.64,1);
  --htk-fallback: system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;

  color: var(--fg);
  font-family: var(--htk-font-body);
  --radius-lg: var(--card-radius);
  --text-1: var(--fg);
  --text-2: var(--fg-2);
  --text-3: var(--fg-3);
  --divider: var(--rule);
  --card-bg: var(--surface);
  --tint-bg: var(--surface);
  --primary: var(--accent);
  --secondary: var(--accent);
  --hover-bg: color-mix(in srgb, var(--fg) 6%, transparent);
  --active-bg: color-mix(in srgb, var(--fg) 10%, transparent);
  /* 旗鯖fork(v2): テーマ非依存の微小フィル/罫。--fg が明暗で反転するため light/dark 両対応。 */





  --btn-border: var(--rule);


  --input-border: var(--rule);
  --input-focus: color-mix(in srgb, var(--accent) 45%, transparent);
  --outer-glow: var(--card-shadow);
  --inner-glow: none;
  --text-shadow: none;
  --blur-amount: 0px;
  text-shadow: none;
}
/* --- 季 Kisetsu (light) --- */
/* 暁: 原本と同じ色を使い、旧タブとbodyへTeleportした編集画面にも渡す。 */
.htk-root[data-theme="akatsuki"], .htk-modal-ov[data-theme="akatsuki"], .htk-event-details-theme[data-theme="akatsuki"]{
  --on-accent:#fff; --on-coral:#fff; --on-grape:#fff; --on-blue:#fff; --on-pink:#fff; --fill: color-mix(in srgb, var(--fg) 5%, transparent); --fill-2: color-mix(in srgb, var(--fg) 8%, transparent); --fill-3: color-mix(in srgb, var(--fg) 13%, transparent); --hair: color-mix(in srgb, var(--fg) 10%, transparent); --btn-bg: color-mix(in srgb, var(--fg) 5%, transparent); --btn-hover: color-mix(in srgb, var(--fg) 10%, transparent); --input-bg: var(--surface);
  --bg:#fff3ec; --surface:rgba(255,255,255,.82); --fg:#2b1f2c; --fg-2:#6a5566; --fg-3:#6a5566;
  --rule:rgba(80,50,70,.18); --accent:#e0567a; --accent-ink:#b02e56; --accent2:#f2a04b;
  --on-accent:#fff; --on-sun:#3a1e05; --on-teal:#2b1f2c;
  --card:var(--surface); --card-border:1px solid rgba(255,255,255,.7); --card-radius:24px;
  --card-shadow:0 20px 40px -28px rgba(90,50,70,.55);
  --htk-font-body:"Zen Kaku Gothic New",var(--htk-fallback);
  --htk-font-head:"Zen Maru Gothic",var(--htk-fallback);
  color-scheme:light;
}
.htk-root[data-theme="akatsuki"][data-mode="dark"], .htk-modal-ov[data-theme="akatsuki"][data-mode="dark"], .htk-event-details-theme[data-theme="akatsuki"][data-mode="dark"]{
  --bg:#150f1b; --surface:#302539; --fg:#f6ecf3; --fg-2:#c8b5c6; --fg-3:#c8b5c6;
  --rule:rgba(255,255,255,.18); --accent:#ff7fa3; --accent-ink:#ff7fa3; --accent2:#ffb36b;
  --on-accent:#26101c; --on-sun:#33200a; --on-teal:#f6ecf3;
  --card-border:1px solid rgba(255,255,255,.16); --card-shadow:0 20px 40px -28px rgba(0,0,0,.8);
  color-scheme:dark;
}
/* --- 刷 Suri (light) --- */
@keyframes htkBootFade{0%, 72%{opacity:1}100%{opacity:0}}

/* アニメーションOFF(設定 animations=false) と reduced-motion では一切のアニメ/トランジションを無効化 */
.htk-root[data-anim="off"] *:not([data-hata-app-logo], [data-hata-app-logo] *){animation:none !important;transition:none !important}
@media (prefers-reduced-motion: reduce){
  .htk-root[data-theme]:not([data-embedded="true"]) *:not([data-hata-app-logo], [data-hata-app-logo] *){animation:none !important}
}
.htk-boot{position:fixed;inset:0;z-index:90000;background:var(--bg);display:flex;align-items:center;justify-content:center}
.htk-boot-inner{text-align:center;position:relative}
.htk-boot-logo{display:flex;flex-direction:column;align-items:center;gap:16px;font-family:'Righteous',system-ui,sans-serif;font-size:2.7rem;color:var(--fg);line-height:1}
.htk-root[data-anim="on"] .htk-boot{animation:htkBootFade 1.2s ease both}

/* 旗鯖fork(v2): 構造トークンのみ。色/背景は .htk-root[data-theme] (v2) が供給する。 */
.htk-root{--radius-lg:28px;--radius-sm:14px;--radius-xs:10px;--ease-smooth:cubic-bezier(0.4,0,0.2,1);position:relative;min-height:100dvh;overflow-x:hidden;overflow-y:visible;container-type:inline-size;container-name:hatask-root}
.htk-root[data-window="true"]{min-height:100%}
.htk-root[data-theme]{
  --hatask-akatsuki-height:calc(100cqh - var(--MI-stickyTop,0px) - var(--MI-stickyBottom,0px));
  min-height:0;
  overflow:hidden;
}
.htk-root[data-theme] .htk-app{max-width:none;padding:0;margin:0;overflow:visible}
.htk-root[data-theme] .htk-shell{display:block}
.htk-root[data-theme="akatsuki"] .htk-boot{background:linear-gradient(168deg,var(--hak-daylight-start) 0%,var(--hak-daylight-middle) 46%,var(--hak-daylight-end) 100%),var(--hak-daylight-bg)}
.htk-root[data-theme="akatsuki"][data-mode="dark"] .htk-boot{background:linear-gradient(168deg,var(--hak-daylight-start) 0%,var(--hak-daylight-middle) 52%,var(--hak-daylight-end) 100%),var(--hak-daylight-bg)}
.htk-root[data-theme] .htk-calendar-page{grid-template-columns:minmax(0,1fr)}
.htk-root[data-theme] .htk-primary, .htk-modal-ov[data-theme] .htk-primary{background:var(--accent-ink);color:var(--on-accent)}
.htk-root[data-theme] .htk-journal-page{min-width:0}
.htk-akatsuki-extras{display:grid;gap:20px;margin-top:28px}
.htk-goes-launcher{container:htk-goes-launcher / inline-size;min-width:0;margin:0 0 18px;border:var(--card-border);border-radius:var(--card-radius,20px);background:var(--surface);box-shadow:var(--card-shadow)}
.htk-goes-launcher-row{display:flex;align-items:center;gap:18px;padding:14px 18px 14px 22px}
.htk-goes-launcher h2{display:flex;flex:0 0 118px;align-items:center;gap:7px;margin:0;font:400 15px/1.2 Righteous,var(--htk-font-head,sans-serif)}
.htk-goes-launcher h2 i{font-size:18px}
.htk-goes-launcher-grid{display:grid;flex:1;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;min-width:0}
.htk-goes-launcher-grid button{display:flex;min-width:0;flex-direction:column;align-items:center;gap:5px;padding:6px 0;border:0;border-radius:16px;background:transparent;color:var(--fg);text-align:center;cursor:pointer}
.htk-goes-launcher-grid button:hover{background:var(--fill)}
.htk-goes-launcher-grid button>span{display:grid;place-items:center;width:48px;height:48px;border-radius:16px;background:var(--fill);color:var(--accent-ink)}
.htk-goes-launcher-grid button>span i{font-size:23px}
.htk-goes-launcher-grid small{max-width:100%;overflow:hidden;font-size:11px;font-weight:800;text-overflow:ellipsis;white-space:nowrap}
.htk-goes-launcher-all{display:inline-flex;flex:none;align-items:center;gap:6px;min-height:44px;padding:0 16px;border:1.5px solid var(--rule);border-radius:var(--control-radius,999px);background:transparent;color:var(--fg);font-size:13px;font-weight:800;cursor:pointer}
.htk-goes-launcher-all i{font-size:17px}
.htk-goes-launcher button:focus-visible{outline:2px solid var(--accent-ink);outline-offset:2px}
@container htk-goes-launcher (max-width:1100px){.htk-goes-launcher-row{display:grid;grid-template-columns:minmax(0,1fr) auto}.htk-goes-launcher h2{grid-column:1;grid-row:1}.htk-goes-launcher-all{grid-column:2;grid-row:1}.htk-goes-launcher-grid{grid-column:1/-1;grid-row:2;width:100%}}
@container htk-goes-launcher (max-width:660px){.htk-goes-launcher-row{gap:12px;padding:14px 12px}.htk-goes-launcher-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 4px}.htk-goes-launcher-grid button>span{width:44px;height:44px}.htk-goes-launcher-all{padding:0 10px;font-size:11px}}
.htk-akatsuki-extra{min-width:0;padding:20px;border:var(--card-border);border-radius:24px;background:var(--surface)}
.htk-akatsuki-extra h3{margin:0 0 14px;font:700 17px/1.5 var(--htk-font-head);color:var(--fg)}
.htk-akatsuki-rsvp{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 0}
.htk-akatsuki-rsvp>div{display:flex;flex-wrap:wrap;gap:8px;width:100%}
.htk-akatsuki-rsvp button[aria-pressed=true]{background:var(--accent-ink);color:var(--on-accent)}
.htk-akatsuki-notification{display:flex;align-items:center;gap:12px;width:100%;padding:12px 0;color:var(--fg-2);font:inherit;text-align:left;border:0;background:none;cursor:pointer}
.htk-akatsuki-notification[data-unread=true]{color:var(--fg);font-weight:700}
.htk-akatsuki-notification .ti{color:var(--accent-ink)}
.htk-akatsuki-extra small{color:var(--fg-2)}
.htk-akatsuki-mascot{display:flex;align-items:center;gap:16px;width:100%;border:0;background:none;color:var(--fg);text-align:left;font:inherit;cursor:pointer}
.htk-akatsuki-mascot img{object-fit:contain;flex:none}
.htk-akatsuki-mascot>span{display:grid;gap:6px;min-width:0;overflow-wrap:anywhere}
.htk-app{max-width:1280px;margin:0 auto;padding:20px;position:relative;z-index:1;overflow-x:clip}
.htk-tabpage{container-type:inline-size}
.htk-root[data-theme] .htk-lg { border: var(--card-border); }
/* 見出し・時計・大数字は見出しフォント。 */
.htk-root[data-theme] .htk-sec-title { font-family: var(--htk-font-head); color: var(--fg); }
/* アプリアイコン名・見出し脇のキッカー等は fg 系で可読性確保(remap 済) */
.htk-lg{position:relative;border-radius:var(--radius-lg);isolation:isolate;box-shadow:var(--outer-glow);transition:box-shadow .3s,transform .3s var(--ease-spring);margin-bottom:16px}
.htk-lg::before{content:'';position:absolute;inset:0;z-index:0;border-radius:inherit;box-shadow:var(--inner-glow);background:var(--tint-bg);pointer-events:none}
.htk-lg::after{content:'';position:absolute;inset:0;z-index:-1;border-radius:inherit;backdrop-filter:blur(var(--blur-amount));-webkit-backdrop-filter:blur(var(--blur-amount));isolation:isolate;pointer-events:none}
.htk-lg:hover{box-shadow:var(--outer-glow),0 8px 32px -4px rgba(0,0,0,.08);transform:translateY(-1px)}
.htk-gc{position:relative;z-index:10;padding:22px}
/* 旗鯖fork(v2): 上部ナビ一本化。フラット・テーマ配色・横溢れ時は横スクロール(§11)。 */
.htk-nav{display:flex;gap:4px;padding:5px;position:relative;z-index:10;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none;scroll-snap-type:x proximity}
.htk-nav::-webkit-scrollbar{display:none}
.htk-ico{display:block;font-size:1.15rem;margin-bottom:2px;text-shadow:none}
/* ヘッダーはカード面をやめてフラットに(設計の mast は面なし) */

/* ---- ナビ共通: 面バーをやめてフラット・折り返し ---- */
/* 季: 明朝テキストタブ＋アクセント下線(面なし・罫線区切り) */
/* 刷: 太罫の上下線に挟まれた極太ゴシックタブ(選択=青ベタ反転) */
.htk-sec-title{font-size:.92rem;font-weight:700;margin-bottom:12px}
.htk-empty{text-align:center;color:var(--text-3);padding:24px 16px;font-size:.85rem}
.htk-pager{display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 0;font-size:.82rem;color:var(--text-2)}
.htk-pager-t{min-width:60px;text-align:center;font-weight:600}
.htk-empI{font-size:1.6rem;margin-bottom:4px;text-shadow:none;opacity:.6}
/* 旗鯖fork(タスク2): マスコットカード(ミニ版)。
   フローティング(MkMascotFloating)の .stage / .img / .bubble と同じ比率・座標系にして bubbleX/Y を一致させる。
   枠は4:3、画像は max-width:55% で中央配置。motionクラス(htkFloatMotion*)はグローバル定義済みのものを流用する。 */
.htk-btn{background:var(--btn-bg);border:1px solid var(--btn-border);color:var(--text-1,rgba(255,255,255,.95));text-shadow:var(--text-shadow,none);padding:10px 20px;border-radius:14px;font-family:inherit;font-size:.86rem;font-weight:700;cursor:pointer;backdrop-filter:blur(var(--blur-amount));transition:all .2s}
.htk-btn:hover{background:var(--btn-hover)}.htk-btn:active{transform:scale(.97)}.htk-btn:disabled{opacity:.4;cursor:not-allowed}
.htk-primary{background:rgba(232,168,124,.2);border-color:rgba(232,168,124,.35)}.htk-primary:hover{background:rgba(232,168,124,.35)}
.htk-danger{background:rgba(224,85,112,.15);border-color:rgba(224,85,112,.25);color:#c03050}.htk-danger:hover{background:rgba(224,85,112,.28)}
.htk-sm{padding:6px 14px;font-size:.78rem;border-radius:12px}.htk-xs{padding:4px 10px;font-size:.72rem;border-radius:10px}
.htk-sb-on{background:var(--active-bg) !important}
.htk-inp{background:var(--input-bg);border:1px solid var(--input-border);color:var(--text-1,rgba(255,255,255,.95));text-shadow:var(--text-shadow,none);padding:10px 16px;border-radius:14px;font-family:inherit;font-size:.86rem;width:100%;outline:none;transition:all .25s;backdrop-filter:blur(var(--blur-amount));-webkit-appearance:none;-moz-appearance:none;appearance:none;box-sizing:border-box}
.htk-inp:focus{border-color:var(--input-focus);box-shadow:0 0 0 3px rgba(232,168,124,.12)}
.htk-inp::placeholder{color:var(--text-3);text-shadow:none}
textarea.htk-inp{min-height:76px;resize:vertical}
select.htk-inp{appearance:none;cursor:pointer;padding-right:36px}
/* 旗鯖fork: grid item の min-width デフォルトが auto のため子要素の自然サイズで grid が広がり、
   モバイルでカードが画面幅を超えて横に見切れる問題を修正。grid item と各カードに min-width: 0 を強制し、
   カード内の overflow も明示的に hidden 化して横方向に膨らまないようにする。 */
.htk-panels{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.htk-calendar-page{align-items:start}
.htk-calendar-page > .htk-planner-shell{grid-column:1/-1;grid-row:1}
.htk-journal-page{display:block;min-width:0}
.htk-record-archive-list{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:6px}
.htk-record-archive-list li{padding:8px 10px;border:1px solid var(--htk-rule,rgba(127,127,127,.25));border-radius:10px}
.htk-record-archive-list summary{cursor:pointer}
.htk-record-archive-list dl{margin:10px 0 0;padding-left:16px}
.htk-record-archive-list dl div{display:flex;gap:8px;margin-top:4px}
.htk-record-archive-list dt{min-width:5em;opacity:.75}
.htk-record-archive-list time{margin-left:auto;font-size:.82em;opacity:.75}
@media(max-width:900px){.htk-panels{grid-template-columns:1fr}}
.htk-rsvp-b{padding:5px 10px;border-radius:8px;font-size:.7rem;font-weight:600;border:1px solid var(--fill-3);background:var(--fill);color:var(--text-2);cursor:pointer;transition:all .2s;font-family:inherit}
.htk-rsvp-summary{margin-top:12px;padding:14px;background:var(--fill);border-radius:14px;border:1px solid var(--hair)}
.htk-rsvp-sum-header{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.htk-rsvp-sum-title{font-size:.82rem;font-weight:700;color:var(--text-1)}
.htk-rsvp-open-badge{font-size:.7rem;padding:4px 10px;background:rgba(110,192,114,.12);color:#6ec072;border-radius:8px;display:inline-block;margin-bottom:10px;font-weight:600}
.htk-rsvp-closed-badge{font-size:.7rem;color:var(--text-3);padding:4px 10px;background:var(--fill);border-radius:8px;margin-bottom:10px;display:inline-block;font-weight:600}
.htk-rsvp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}
.htk-rsvp-stat-card{text-align:center;padding:10px 4px;border-radius:10px;background:var(--fill);border:1px solid var(--hair)}
.htk-rsvp-stat-card.going{border-color:rgba(110,192,114,.25)}
.htk-rsvp-stat-card.maybe{border-color:rgba(232,168,124,.25)}
.htk-rsvp-stat-card.declined{border-color:rgba(220,80,80,.2)}
.htk-rsvp-stat-card.total{border-color:var(--fill-3)}
.htk-rsvp-stat-n{font-size:1.3rem;font-weight:800;line-height:1.2}
.htk-rsvp-stat-card.going .htk-rsvp-stat-n{color:#6ec072}
.htk-rsvp-stat-card.maybe .htk-rsvp-stat-n{color:#e8a87c}
.htk-rsvp-stat-card.declined .htk-rsvp-stat-n{color:#dc5050}
.htk-rsvp-stat-card.total .htk-rsvp-stat-n{color:var(--text-1)}
.htk-rsvp-stat-l{font-size:.62rem;color:var(--text-3);font-weight:600;margin-top:2px}
.htk-rsvp-bar-wrap{margin-bottom:10px}
.htk-rsvp-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--fill)}
.htk-rsvp-bar-seg{height:100%;transition:width .3s ease}
.htk-rsvp-bar-seg.going{background:#6ec072}
.htk-rsvp-bar-seg.maybe{background:#e8a87c}
.htk-rsvp-bar-seg.declined{background:#dc5050}
.htk-rsvp-grp{margin-bottom:8px}
.htk-rsvp-grp-h{font-size:.72rem;font-weight:600;color:var(--text-2);display:flex;align-items:center;gap:6px;margin-bottom:4px}
.htk-rsvp-grp-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.htk-rsvp-grp-dot.going{background:#6ec072}
.htk-rsvp-grp-dot.maybe{background:#e8a87c}
.htk-rsvp-grp-dot.declined{background:#dc5050}
.htk-rsvp-grp-names{display:flex;flex-wrap:wrap;gap:4px}
.htk-rsvp-name{font-size:.68rem;padding:3px 8px;background:var(--fill);border-radius:6px;color:var(--text-3)}
.htk-rsvp-sum-empty{font-size:.72rem;opacity:.4;padding:8px 0;text-align:center}
/* (rsvp badges moved to dashboard) */
.htk-fl-ring{position:relative;width:120px;height:120px;margin:0 auto 8px}
.htk-fl-ring svg{width:100%;height:100%}
.htk-fl-track{fill:none;stroke:rgba(128,128,128,.2);stroke-width:4}
.htk-fl-bar{fill:none;stroke:var(--primary);stroke-width:4;stroke-linecap:round;transform:rotate(-90deg);transform-origin:center;stroke-dasharray:377}
.htk-fl-emo{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:2.6rem;text-shadow:none;animation:htkFlBr 4s ease-in-out infinite}
@keyframes htkFlBr{0%, 100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.06)}}
.htk-cal-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.htk-cal-ttl{font-size:1.08rem;font-weight:600}
.htk-cal-nav{display:flex;gap:5px}
.htk-cal-nb{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid var(--btn-border);background:var(--btn-bg);color:var(--text-1);cursor:pointer;font-size:.85rem;transition:all .2s;backdrop-filter:blur(6px)}
.htk-cal-nb:hover{background:var(--btn-hover);transform:scale(1.05)}
.htk-cal-wk{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px}
.htk-cal-wk-d{text-align:center;font-size:.7rem;font-weight:600;color:var(--text-3);padding:5px 0}
.htk-cal-wk-d.sun{color:#c03050}.htk-cal-wk-d.sat{color:#2060a0}
.htk-cal-days{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.htk-cal-d{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:var(--radius-xs);cursor:pointer;transition:all .2s;font-size:.86rem;position:relative;gap:1px}
.htk-cal-dots{display:flex;gap:2px;height:5px;align-items:center}.htk-cal-dot{width:4px;height:4px;border-radius:50%;flex-shrink:0}
.htk-dayev-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--hair);cursor:pointer;transition:background .2s}
.htk-dayev-row:hover{background:var(--fill);border-radius:8px;margin:0 -6px;padding:10px 6px}
.htk-dayev-row.active{background:var(--fill);border-radius:8px 8px 0 0;margin:0 -6px;padding:10px 6px;border-bottom-color:transparent}
.htk-dayev-row:last-child{border-bottom:none}
.htk-dayev-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.htk-dayev-body{flex:1;min-width:0}
.htk-dayev-title{font-size:.86rem;font-weight:600;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.htk-dayev-time{font-size:.72rem;color:var(--fg-3);margin-top:2px}
/* Event detail panel */
.htk-cal-d:hover{background:var(--hover-bg);transform:scale(1.05)}
.htk-cal-d.om{color:var(--text-3);opacity:.3}.htk-cal-d.td{background:var(--active-bg);font-weight:700}.htk-cal-d.sel{background:var(--active-bg);box-shadow:inset 0 0 0 2px var(--primary)}
.htk-cal-seg{display:inline-flex;width:max-content}
/* --- 季 --- */
/* --- 刷 --- */
/* --- 季 --- */
/* --- 刷 --- */
.htk-root[data-theme] .htk-sec-title{font-family:var(--htk-font-head);color:var(--fg)}

/* ---------- きもち: 5段階スケール ---------- */
/* きもち分析カード */

/* ---------- ごはん: スロット/レベル ---------- */

/* ---------- お庭: 成長リング/ギャラリー ---------- */
.htk-root[data-theme] .htk-fl-track{stroke:color-mix(in srgb,var(--fg) 12%,transparent)}

.htk-sr-only{position:absolute !important;width:1px !important;height:1px !important;padding:0 !important;margin:-1px !important;overflow:hidden !important;clip:rect(0,0,0,0) !important;white-space:nowrap !important;border:0 !important}
.htk-editor-fieldset{min-width:0;margin:0;padding:0;border:0}
.htk-editor-fieldset:disabled{opacity:.72}
.htk-fg{margin-bottom:13px}.htk-fl{display:block;font-size:.76rem;font-weight:600;color:var(--text-2);margin-bottom:4px}
.htk-fr{display:flex;gap:8px}.htk-fr > *{flex:1;min-width:0}
.htk-date-time-row{display:grid;grid-template-columns:minmax(3.5rem,auto) minmax(8rem,1fr) minmax(6.5rem,.7fr);align-items:center}
.htk-field-sub-label{font-size:.72rem;font-weight:700;color:var(--fg-2);white-space:nowrap;word-break:keep-all}
.htk-clr-row{display:flex;gap:6px;flex-wrap:wrap}
.htk-clr-o{width:44px;height:44px;border-radius:50%;cursor:pointer;border:8px solid var(--surface);outline:2px solid transparent;transition:transform .2s,outline-color .2s;box-shadow:0 0 0 1px var(--rule)}
.htk-clr-o:hover{transform:scale(1.15)}.htk-clr-o.on{border-color:var(--text-1);box-shadow:0 0 8px rgba(128,128,128,.3)}
.htk-vis-row{display:flex;gap:6px}
.htk-vis-o{flex:1;padding:10px;text-align:center;border-radius:var(--radius-xs);cursor:pointer;border:1px solid var(--btn-border);background:var(--btn-bg);transition:all .2s;font-size:.78rem;backdrop-filter:blur(4px)}
.htk-vis-o:hover{background:var(--btn-hover)}.htk-vis-o.on{background:rgba(232,168,124,.18);border-color:rgba(232,168,124,.35)}
.htk-vi{font-size:1.1rem;display:block;margin-bottom:2px;text-shadow:none}
.htk-tg-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--divider)}
.htk-tg-row:last-child{border:none}.htk-tg-lab{font-size:.82rem}
.htk-tg-sw{flex:0 0 52px;width:52px;height:44px;padding:0;background:transparent;border:0;border-radius:22px;cursor:pointer;position:relative}
.htk-tg-sw::before{content:'';position:absolute;width:44px;height:24px;top:10px;left:4px;background:rgba(128,128,128,.22);border:1px solid rgba(128,128,128,.35);border-radius:12px;transition:background .2s,border-color .2s}
.htk-tg-sw::after{content:'';position:absolute;width:18px;height:18px;background:rgba(128,128,128,.62);border-radius:50%;top:13px;left:7px;transition:left .3s var(--ease-spring),background .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.htk-tg-sw.on::before{background:color-mix(in srgb,var(--success) 72%,var(--surface));border-color:var(--success)}.htk-tg-sw.on::after{left:27px;background:var(--surface);box-shadow:0 1px 4px rgba(76,175,80,.4)}
.htk-nt-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}
.htk-nt-chip{min-height:44px;padding:7px 12px;border-radius:999px;font:inherit;font-size:.72rem;background:var(--btn-bg);color:var(--fg);border:1px solid var(--btn-border);cursor:pointer;transition:background .2s,border-color .2s}
.htk-nt-chip:hover{background:var(--btn-hover)}.htk-nt-chip.on{background:rgba(232,168,124,.18);border-color:rgba(232,168,124,.3)}
.htk-emp-row{display:flex;gap:5px;flex-wrap:wrap;padding:6px}
.htk-emp-i{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;padding:6px;border:1px solid transparent;background:transparent;color:inherit;font:inherit;font-size:1.15rem;cursor:pointer;border-radius:6px;transition:background .2s,transform .2s,border-color .2s;text-shadow:none}
.htk-emp-i:hover{background:var(--hover-bg);transform:scale(1.12)}.htk-emp-i.on{background:var(--active-bg)}
.htk-planner-shell{position:relative;min-width:0;margin-bottom:16px}
.htk-planner-status, .htk-planner-undo{display:flex;align-items:center;justify-content:center;gap:10px;min-height:52px;margin-bottom:10px;padding:8px 12px;border:1px solid var(--rule);border-radius:var(--card-radius);background:var(--surface);color:var(--fg-2);font-size:.78rem;line-height:1.5;text-align:center}
.htk-planner-status[data-state="blocked"], .htk-planner-status[data-state="conflict"]{border-color:color-mix(in srgb,var(--danger,#c43d4f) 55%,var(--rule));background:color-mix(in srgb,var(--danger,#c43d4f) 8%,var(--surface));color:var(--fg)}
.htk-planner-status .ti-loader-2{animation:htkPlannerSpin .9s linear infinite}
.htk-planner-undo{justify-content:space-between;border-color:color-mix(in srgb,var(--success) 55%,var(--rule));background:color-mix(in srgb,var(--success) 9%,var(--surface));color:var(--fg)}
.htk-planner-shell > :deep([data-mode="event"]), .htk-planner-shell > :deep([data-mode="todo"]){margin-bottom:14px}
.htk-todo-capture-row{display:contents}
.htk-todo-capture-row > :deep([data-mode="todo"]){margin-bottom:14px}
.htk-capture-detail{box-sizing:border-box;width:min(100%,760px);min-width:0;margin:0 auto 14px;padding:14px;border:1px solid var(--rule);border-radius:20px;background:color-mix(in srgb,var(--surface) 94%,transparent);box-shadow:0 14px 34px -28px rgba(0,0,0,.65)}
.htk-capture-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.htk-capture-grid label{min-width:0;display:grid;gap:4px}.htk-capture-grid label>span{color:var(--fg-3);font-size:.68rem;font-weight:750}.htk-capture-wide{grid-column:1/-1}.htk-folder-manager{display:grid;gap:7px}.htk-folder-manager>header{display:flex;align-items:center;justify-content:space-between;gap:10px}.htk-folder-manager .htk-fm-row{display:grid;grid-template-columns:32px minmax(0,1fr) auto auto;align-items:center;gap:7px;min-height:48px}.htk-folder-colored-icon{position:relative;width:30px;height:30px;display:grid;place-items:center;color:var(--folder-color);font-size:1.25rem}.htk-folder-colored-icon::after{content:'';position:absolute;inset:9px 7px 5px;border-radius:2px;background:color-mix(in srgb,var(--folder-color) 20%,var(--surface));border:1px solid color-mix(in srgb,var(--folder-color) 55%,var(--rule))}.htk-folder-colored-icon i{position:relative;z-index:1}.htk-folder-create{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:7px;margin-top:4px}.htk-icon-btn, .htk-icon-submit{width:44px;height:44px;display:grid;place-items:center;border:1px solid var(--btn-border,var(--rule));border-radius:50%;background:var(--btn-bg,var(--surface));color:var(--fg);font:inherit;cursor:pointer}.htk-icon-submit{background:var(--accent);border-color:var(--accent);color:var(--on-accent,#fff);font-size:1.05rem;box-shadow:0 9px 20px -12px var(--accent)}.htk-icon-btn:hover, .htk-icon-btn:focus-visible{background:var(--btn-hover,var(--fill-2));color:var(--accent)}.htk-icon-btn.htk-danger{color:var(--danger,#c43d4f)}.htk-editor-icon-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;margin-top:14px}.htk-complete-undo{position:sticky;z-index:12;bottom:calc(12px + env(safe-area-inset-bottom));width:min(100%,460px);margin:0 auto 12px;box-shadow:0 16px 38px -25px rgba(0,0,0,.7);backdrop-filter:blur(16px)}
.htk-pill-editor{display:grid;gap:10px}.htk-pill-editor-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.htk-pill-editor-head strong{display:flex;align-items:center;gap:7px;color:var(--fg);font-size:.82rem}.htk-pill-editor-head strong i{color:var(--accent);font-size:1rem}.htk-pill-time-grid{margin-top:2px}.htk-pill-clear{justify-self:start;min-height:44px;padding:7px 14px;border:1px solid var(--rule);border-radius:999px;background:var(--surface);color:var(--fg-2);font:inherit;font-size:.72rem;font-weight:750;cursor:pointer}.htk-pill-clear:hover, .htk-pill-clear:focus-visible{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,var(--surface));color:var(--fg)}
.htk-folder-manager{gap:12px}.htk-folder-manager-head>div:first-child{min-width:0;display:grid;gap:2px}.htk-folder-manager-head>div:first-child strong{font-size:.9rem}.htk-folder-manager-head>div:first-child span{color:var(--fg-3);font-size:.66rem}.htk-folder-manager-head-actions{display:flex;align-items:center;gap:6px}.htk-folder-manager-list{display:grid;gap:6px}.htk-folder-manager .htk-fm-row{min-height:58px;display:grid;grid-template-columns:38px minmax(0,1fr) 44px;align-items:center;gap:9px;margin:0;padding:6px 7px 6px 10px;border:1px solid var(--rule);border-radius:15px;background:color-mix(in srgb,var(--surface) 96%,var(--fill));transition:border-color .18s ease,background .18s ease,transform .2s var(--ease-smooth,ease)}.htk-folder-manager .htk-fm-row:hover{border-color:color-mix(in srgb,var(--folder-color,var(--accent)) 38%,var(--rule));background:color-mix(in srgb,var(--folder-color,var(--accent)) 6%,var(--surface))}.htk-fm-copy{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:10px}.htk-fm-copy strong{overflow:hidden;color:var(--fg);font-size:.8rem;text-overflow:ellipsis;white-space:nowrap}.htk-fm-copy span{flex:none;min-width:28px;padding:3px 7px;border-radius:999px;background:var(--fill-2);color:var(--fg-3);font-size:.65rem;font-weight:760;text-align:center}.htk-folder-row-more{width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;color:var(--fg-2);font:inherit;cursor:pointer}.htk-folder-row-more:hover, .htk-folder-row-more:focus-visible{background:var(--fill-2);color:var(--accent)}.htk-folder-manager-empty{min-height:110px;display:grid;place-items:center;align-content:center;gap:7px;border:1px dashed var(--rule);border-radius:15px;color:var(--fg-3);font-size:.72rem}.htk-folder-manager-empty i{font-size:1.35rem}.htk-folder-create-panel{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding-top:12px;border-top:1px solid var(--rule)}.htk-folder-create-panel>label{min-width:0;display:grid;gap:4px}.htk-folder-create-panel>label>span{color:var(--fg-3);font-size:.68rem;font-weight:750}.htk-folder-create-panel .htk-folder-clr-row{grid-column:1/-1;margin:0}.htk-folder-create-submit{align-self:end}
@keyframes htkPlannerSpin{to{transform:rotate(1turn)}}
.htk-todo-subtask-editor{flex:1 1 100%;min-width:100%;display:grid;gap:6px}
.htk-todo-subtask-editor > label{font-size:.68rem;color:var(--text-3);font-weight:700}
.htk-todo-subtask-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px}
.htk-todo-subtask-row > input[type="checkbox"]{width:24px;height:24px;margin:10px;accent-color:var(--accent)}
.htk-todo-subtask-row > .htk-inp{width:100%;min-width:0}
.htk-todo-subtask-row > #hatask-new-subtask{grid-column:1 / 3}
@container (max-width:620px){
	.htk-capture-grid{grid-template-columns:1fr}
	.htk-capture-wide{grid-column:auto}
	.htk-folder-manager .htk-fm-row{grid-template-columns:30px minmax(0,1fr) auto}
	.htk-date-time-row{grid-template-columns:minmax(0,1fr) minmax(0,.72fr)}
	.htk-date-time-row .htk-field-sub-label{grid-column:1 / -1}
	.htk-todo-subtask-row{grid-template-columns:auto minmax(0,1fr) auto}
}
.htk-fm-row{display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:var(--radius-xs);background:var(--btn-bg);border:1px solid var(--btn-border);margin-bottom:4px;backdrop-filter:blur(4px)}
.htk-folder-clr-row{display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap}
.htk-folder-clr-o{width:44px;height:44px;border-radius:50%;cursor:pointer;border:8px solid var(--surface);outline:2px solid transparent;transition:transform .2s,outline-color .2s;flex-shrink:0;box-shadow:0 0 0 1px var(--rule)}
.htk-folder-clr-o:hover{transform:scale(1.15)}
.htk-folder-clr-o.on{border-color:var(--text-1);box-shadow:0 0 0 2px var(--card-bg,rgba(0,0,0,.2)),0 0 6px rgba(0,0,0,.2)}
.htk-gal-e{font-size:2.2rem;display:block;margin-bottom:5px;text-shadow:none}
/* レア品種は両ギャラリーに同じ光の枠を表示。動きを止めても枠とラベルは残す。 */
.htk-flower-rare-label{display:flex;align-items:center;justify-content:center;gap:4px;margin:4px 0;font-size:.72rem;font-weight:700;color:var(--fg);line-height:1.5}
.htk-flower-rare-label i{color:var(--accent)}.htk-pager-t{min-width:2.5em;text-align:center;font-variant-numeric:tabular-nums}.htk-gal-state{display:flex;align-items:center;justify-content:center;gap:7px;min-height:74px;color:var(--text-3);font-size:.8rem;text-align:center}.htk-gal-state i{font-size:1.1rem}.htk-gal-error{flex-wrap:wrap;color:var(--danger, var(--text-2))}
.htk-sch-note{font-size:.68rem;color:var(--text-3);padding:8px 12px;background:rgba(128,128,128,.06);border:1px solid rgba(128,128,128,.1);border-radius:var(--radius-sm);margin-top:12px;line-height:1.4}
.htk-sch-note{border-radius:14px}
.htk-modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.3);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;z-index:3200000}
.htk-modal-c{max-width:500px;width:92%;max-height:85vh;overflow-y:auto;animation:htkScIn .4s var(--ease-spring) both;border-radius:28px !important}
.htk-event-editor-modal{width:min(92%,760px);max-width:760px;max-height:min(88dvh,780px);background:var(--surface);overscroll-behavior:contain}
.htk-event-editor-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:10px}
.htk-event-editor-head .htk-sec-title{min-width:0;margin:0}
.htk-popup-b{font-size:.82rem;color:var(--text-2);line-height:1.7}
/* Mood Analysis */
/* 旗鯖fork(v2 §06): モーダル内はテーマトークンで着色(旧・白固定を撤去。ライトテーマで文字が沈む問題を修正)。 */
.htk-modal-c select.htk-inp{border-radius:var(--radius-sm);appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23999999' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;color:var(--fg)}
.htk-modal-c .htk-gc{color:var(--fg)}
.htk-modal-c .htk-sec-title{color:var(--fg)}

/* ========== SETTINGS PANEL (Teleport to body - CSS変数が効かないため白固定) ========== */
/* 表示は常に成立させ、出現アニメの開始時だけ透明にする。新テーマでカードを消さない。 */
.htk-root[data-theme] .htk-anim{opacity:1}
.htk-anim:nth-child(2){animation-delay:.05s}.htk-anim:nth-child(3){animation-delay:.1s}.htk-anim:nth-child(4){animation-delay:.15s}.htk-anim:nth-child(5){animation-delay:.2s}.htk-anim:nth-child(6){animation-delay:.25s}.htk-anim:nth-child(7){animation-delay:.3s}.htk-anim:nth-child(n+8){animation-delay:.35s}
/* data-anim=off でも opacity:0 のまま消えないよう明示的に戻す */
.htk-root[data-anim="off"] .htk-anim{opacity:1 !important;animation:none !important}
@media (prefers-reduced-motion: reduce){ .htk-root[data-theme]:not([data-embedded="true"]) .htk-anim{opacity:1 !important;animation:none !important} }
@keyframes htkScIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
/* Mobile: hide desktop nav, add padding */
@media(max-width:1024px){
  .htk-app{padding-bottom:28px}
}
@media(max-width:640px){.htk-app{padding:12px;padding-bottom:24px}.htk-panels{grid-template-columns:1fr}
}
/* ========== LOGIN DAYS CARD ========== */
/* ========== APPS GRID ========== */
.htk-root :is([data-app-wordmark='hatadint'],[data-app-wordmark='hataintro']){font-family:'Righteous',system-ui,sans-serif;font-weight:400;font-synthesis:none;letter-spacing:.01em}
/* Dark mode overrides */
.htk-root[data-mode="dark"] .htk-danger{color:#ffa0b0}
.htk-root[data-mode="dark"] .htk-cal-wk-d.sun{color:#ffa0b0}
.htk-root[data-mode="dark"] .htk-cal-wk-d.sat{color:#90c8ff}

/* ========== TUTORIAL ========== */
/* ========== SPOTLIGHT TUTORIAL ========== */
.htk-tut-ov{position:fixed;inset:0;z-index:3200000}
.htk-tut-center{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;z-index:3200001}
/* 旗鯖fork(v2 §14): テーマ選択ステップ */
/* --- 季: 明朝＋罫線＋下線入力 --- */
/* --- 刷: 太罫入力＋ドット罫セクション＋青アイコン --- */

/* ============================================================
   旗鯖fork(v2 §14): テーマ選択(設計 .tpickwrap を忠実移植)
   ============================================================ */
.htk-tpick-ov{background:rgba(0,0,0,.66);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;padding:16px}
.tpickwrap{width:520px;max-width:calc(100vw - 32px);max-height:92dvh;overflow-y:auto;border-radius:24px;box-shadow:0 18px 50px -16px rgba(0,0,0,.5);background:#faf8f3;font-family:'Zen Kaku Gothic New',var(--htk-fallback);color:#211d18;padding:30px 28px 26px;position:relative;animation:htkTutIn .5s cubic-bezier(.34,1.56,.64,1) both}
.tpickwrap[data-mode="dark"]{background:#16151b;color:#ece7dc}
.tpick-cap{text-align:center;font-family:'Bebas Neue',sans-serif;letter-spacing:.26em;font-size:.72rem;opacity:.6}
.tpick-logo{display:flex;align-items:center;justify-content:center;gap:10px;font-family:'Righteous',system-ui,sans-serif;font-size:2.2rem;text-align:center;line-height:1.1}
.tpick-sub{font-size:.86rem;opacity:.8;margin:8px 0 18px;text-align:center;line-height:1.6}
.tpick-sub2{display:inline-block;font-size:.74rem;opacity:.55;margin-top:2px}
.tpick-seg{display:flex;gap:4px;justify-content:center;background:rgba(0,0,0,.06);border-radius:999px;padding:4px;width:max-content;margin:0 auto 20px}
.tpickwrap[data-mode="dark"] .tpick-seg{background:rgba(255,255,255,.1)}
.tpick-seg button{border:none;background:none;font-family:inherit;font-size:.78rem;font-weight:700;padding:6px 16px;border-radius:999px;cursor:pointer;color:inherit;display:flex;align-items:center;gap:5px}
.tpick-seg button.on{background:#211d18;color:#faf8f3}
.tpickwrap[data-mode="dark"] .tpick-seg button.on{background:#ece7dc;color:#16151b}
.tpick-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:18px}
.tp-card{border:2px solid transparent;border-radius:16px;padding:10px;cursor:pointer;background:rgba(0,0,0,.035);transition:transform .15s,border-color .15s,background .3s;font-family:inherit;color:inherit;text-align:left}
.tpickwrap[data-mode="dark"] .tp-card{background:rgba(255,255,255,.06)}
.tp-card:hover{transform:translateY(-3px)}
.tp-card.sel{border-color:#a8552f}
.tpickwrap[data-mode="dark"] .tp-card.sel{border-color:#e0966a}
.tp-name{font-weight:700;font-size:.84rem;margin-top:9px;display:flex;align-items:center;gap:5px}
.tp-check{margin-left:auto;color:#a8552f;opacity:0}
.tp-card.sel .tp-check{opacity:1}
.tp-desc{font-size:.67rem;opacity:.6;margin-top:2px;line-height:1.45}
.tpick-go{--accent:#b02e56;--on-accent:#fff;display:flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:14px;border:none;border-radius:14px;background:var(--accent);color:var(--on-accent);font-family:inherit;font-weight:700;font-size:.92rem;cursor:pointer}
.tpick-go[data-theme="akatsuki"][data-mode="dark"]{--accent:#ff7fa3;--on-accent:#26101c}
.tpick-note{text-align:center;font-size:.7rem;opacity:.5;margin-top:10px}
.tpick-skip{display:block;margin:8px auto 0;background:none;border:none;color:inherit;opacity:.45;font-size:.72rem;cursor:pointer;font-family:inherit}

/* ============================================================
   旗鯖fork(v2): ホーム 季/刷 のダークモード可読性
   設計はライト前提で紙面(地色)に黒文字を直書きしているため、ダークでは潰れる。
   ダーク時だけ、地色の上のテキスト/罫線/アクセントをトークン(--fg系/--accent/--rule/--ink-line/--blue/--pink)へ。
   色ブロック上の白/濃文字(時計・連続・Eye等)はそのまま。
   ============================================================ */
/* ---- 各ページ(きもち/ごはん/お庭/Eye)もダークで文字が潰れないよう見出し等をトークンへ ---- */
.htk-tut-welcome{text-align:center;max-width:420px;padding:20px;animation:htkTutIn .8s var(--ease-spring) both;position:relative;z-index:1}
.htk-tut-particles{position:absolute;inset:-50px;pointer-events:none;overflow:hidden}
.htk-tut-particles>span{position:absolute;width:4px;height:4px;border-radius:50%;background:rgba(232,168,124,.4);animation:htkParticle 6s linear infinite;opacity:0}
.htk-tut-hero-emoji{font-size:3.5rem;margin-bottom:12px;animation:htkTutFloat 3s ease-in-out infinite;text-shadow:none}
.htk-tut-catch{font-size:1.05rem;color:rgba(255,255,255,.55);margin-bottom:6px;font-weight:400;letter-spacing:3px;text-transform:uppercase}
.htk-tut-appname{font-size:2.8rem;font-weight:800;color:rgba(255,255,255,.95);margin-bottom:14px;letter-spacing:1px;text-shadow:0 2px 16px rgba(232,168,124,.35);background:linear-gradient(135deg,#e8a87c,#85cdca);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.htk-tut-ov[data-theme] .htk-tut-center{backdrop-filter:none;-webkit-backdrop-filter:none}
.htk-tut-ov[data-theme] .htk-tut-appname{background:none;-webkit-text-fill-color:currentColor;text-shadow:none;font-family:'Righteous',system-ui,sans-serif;font-weight:400}
.htk-tut-ov[data-theme] .htk-tut-hero-emoji{width:60px;height:60px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:1.9rem;margin:0 auto 16px;animation:none}
.htk-tut-ov[data-theme] .htk-tut-catch{text-transform:none}
/* --- 季 --- */
/* --- 刷 --- */
.htk-tut-sub{font-size:.84rem;color:rgba(255,255,255,.5);line-height:1.6;margin-bottom:28px}
.htk-tut-btns{display:flex;gap:10px;justify-content:center;margin-bottom:20px}
.htk-tut-btn{padding:12px 28px;border-radius:14px;font-family:inherit;font-size:.88rem;font-weight:700;cursor:pointer;border:none;transition:all .25s var(--ease-spring)}
.htk-tut-btn:hover{transform:translateY(-2px)}
.htk-tut-btn:active{transform:scale(.96)}
.htk-tut-btn-xs{padding:8px 18px;font-size:.78rem;border-radius:10px}
.htk-tut-btn-p{background:linear-gradient(135deg,rgba(232,168,124,.85),rgba(226,125,96,.7));color:#fff;box-shadow:0 4px 16px rgba(232,168,124,.3)}
.htk-tut-btn-p:hover{box-shadow:0 6px 24px rgba(232,168,124,.4)}
.htk-tut-btn-s{background:rgba(255,255,255,.08);color:rgba(255,255,255,.65);border:1px solid rgba(255,255,255,.12)}
.htk-tut-btn-s:hover{background:rgba(255,255,255,.15)}
.htk-tut-btn-finish{background:linear-gradient(135deg,rgba(110,192,114,.85),rgba(133,205,202,.75));color:#fff;box-shadow:0 4px 20px rgba(110,192,114,.3)}
.htk-tut-btn-finish:hover{box-shadow:0 6px 28px rgba(110,192,114,.4);transform:translateY(-3px)}
.htk-tut-dots{display:flex;gap:6px;justify-content:center}
.htk-tut-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.2);transition:all .3s}
.htk-tut-dot.on{background:rgba(232,168,124,.7);width:22px;border-radius:4px}
.htk-tut-skip{display:block;margin:6px auto 0;background:none;border:none;color:rgba(255,255,255,.25);font-size:.68rem;cursor:pointer;font-family:inherit;transition:color .2s}
.htk-tut-skip:hover{color:rgba(255,255,255,.55)}
/* 4-panel spotlight overlay */
.htk-spot-top, .htk-spot-bottom, .htk-spot-left, .htk-spot-right{position:fixed;background:rgba(0,0,0,.55);transition:all .4s cubic-bezier(.4,0,.2,1);cursor:pointer;z-index:3200002}
.htk-spot-top{top:0;left:0;right:0}
.htk-spot-bottom{left:0;right:0;bottom:0}
.htk-spot-left{left:0}
.htk-spot-right{right:0}
/* Highlight ring */
.htk-spot-ring{position:fixed;border-radius:16px;border:2.5px solid rgba(232,168,124,.6);box-shadow:0 0 24px rgba(232,168,124,.25),inset 0 0 16px rgba(232,168,124,.1);pointer-events:none;transition:all .4s cubic-bezier(.4,0,.2,1);animation:htkSpotPulse 2s ease-in-out infinite;z-index:3200003}
/* Tooltip */
.htk-spot-tip{position:fixed;background:rgba(18,18,28,.94);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:18px 16px 12px;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:0 16px 48px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.05);animation:htkSpotTipIn .45s cubic-bezier(.34,1.56,.64,1) both;z-index:3300000;color:#fff}
.htk-spot-tip-arrow{position:absolute;width:14px;height:14px;background:rgba(20,20,30,.92);border:1px solid rgba(255,255,255,.12);transform:rotate(45deg);border-radius:3px}
.htk-spot-tip-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.htk-spot-tip-emoji{font-size:1.4rem;text-shadow:none}
.htk-spot-tip-title{font-size:1rem;font-weight:700;color:rgba(255,255,255,.92);flex:1}
.htk-spot-tip-badge{font-size:.62rem;padding:3px 8px;border-radius:8px;background:rgba(232,168,124,.15);color:rgba(232,168,124,.8);font-weight:600;white-space:nowrap}
.htk-spot-tip-body{font-size:.8rem;color:rgba(255,255,255,.6);line-height:1.5;margin-bottom:10px}
.htk-spot-tip-extra{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.htk-spot-tip-row{display:flex;align-items:flex-start;gap:8px;font-size:.76rem;color:rgba(255,255,255,.7);line-height:1.4}
.htk-spot-tip-bullet{flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:.72rem;text-shadow:none;border-radius:6px;background:rgba(255,255,255,.06)}
.htk-spot-tip-nav{display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}
.htk-spot-tip-progress{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden}
.htk-spot-tip-bar{height:100%;background:linear-gradient(90deg,rgba(232,168,124,.7),rgba(133,205,202,.6));border-radius:2px;transition:width .4s ease}
@keyframes htkTutIn{from{opacity:0;transform:scale(.85) translateY(30px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes htkTutFloat{0%, 100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes htkParticle{0%{opacity:0;transform:translateY(0) scale(0)}15%{opacity:1;transform:scale(1)}100%{opacity:0;transform:translateY(-200px) scale(0)}}
@keyframes htkSpotPulse{0%, 100%{box-shadow:0 0 20px rgba(232,168,124,.2),inset 0 0 20px rgba(232,168,124,.1)}50%{box-shadow:0 0 30px rgba(232,168,124,.35),inset 0 0 25px rgba(232,168,124,.15)}}
@keyframes htkSpotTipIn{from{opacity:0;transform:translateY(14px) scale(.93)}to{opacity:1;transform:translateY(0) scale(1)}}

/* ===== 食事記録(meal)。3段階は等価に扱い、否定的な色強調はしない ===== */

/* 旗鯖fork(#36): HataFeed通知タイル / 地震・津波タイル */
.htk-shell{ display:contents; }
/* 板の内枠(木口の落ち影) */

/* --- 突風で舞う落ち葉 --- */

/* --- ヘッダー(タイトル紙 + 紙のボタン) --- */

/* --- タブ(画鋲つきの付箋) --- */
/* ⚠️タブを横スクロール(overflow-x:auto)にしてはいけない。
     Hatask は .htk-app に「横スワイプでタブ切替」のハンドラを持っている。
     横スクロール領域を作ると、指で払ったときにタブが切り替わってしまい
     スクロールできず、画面外のタブに永久に触れなくなる(モバイルで再現)。
   ⚠️既存3テーマも同じ理由で .htk-nav-top を flex-wrap:wrap にしている。ここも折り返しに揃える。
     設計HTMLは横スクロールだが、あちらはスワイプ操作を持たないプロトタイプなのでそのまま持ち込めない。 */

/* --- 石垣(masonry) と 機能タブの列 --- */
/* ホーム専用。短い紙だけを並べるので段組み(石垣)でよい。 */
/* ⚠️機能タブ(カレンダー/ToDo/きもち/ごはん/お庭/Eye)に段組みを使ってはいけない。
     段組みは中身を「分断」するので、ToDoリストや予定フォームのような背の高いカードが
     途中で切られて次の段へ飛び、画鋲(position:absolute)は分断境界で消える。
     break-inside:avoid は保証ではなく希望なので防げない。⚠️列はグリッドで固定する。
   ⚠️列数はベースの .htk-panels と同じ2列に揃える。設計HTMLは3列だが、あちらの紙は
     どれも短い。実際のフォームを3列に詰めると1列あたりが狭すぎて崩れる。 */
/* お庭だけ左右を独立して積む。ひとことの高さを右側の花カードと揃えず、情報はギャラリーの直下へ。
   他のテーマでは箱を作らず、従来どおり4枚を親のグリッドへ並べる。 */
.htk-garden-page{min-width:0}
/* 段組み(ホーム)側だけ、縦の隔たりをマージンで取る。グリッド側は gap が担う。 */
/* 共有マークアップのカード(.htk-lg)も、この板の上では同じ「紙」として振る舞わせる。 */
/* ⚠️ベースの .htk-lg は margin-bottom:16px を持つ。gap と二重になるので消す。 */
/* ⚠️ベースの .htk-lg:hover は translateY で transform を奪う。紙は傾きを保つ。 */
/* ベースの ::after は backdrop-filter 用。この板では画鋲として作り替える。 */

/* --- 紙(カード) --- */

/* --- 麻ひもに吊るした写真 --- */

/* --- 新テーマ案内モーダル --- */

/* --- モーション --- */
/* アニメOFFでは傾きだけ残して完全に止める */

/* ブート: 紙が画鋲で留まる */

/* Hatasaba UIのウィンドウ表示では、ブラウザ全体が広くてもHataskの表示領域だけが狭くなる。
   端末判定ではなく実際のHatask幅で、既存のモバイル相当レイアウトへ切り替える。 */
@container hatask-root (max-width:900px){
  .htk-app{padding-bottom:28px}
  .htk-panels{grid-template-columns:minmax(0,1fr)}
}
@container hatask-root (max-width:640px){
  .htk-app{padding:12px;padding-bottom:24px}
  .htk-panels{grid-template-columns:minmax(0,1fr)}
  .htk-planner-status, .htk-planner-undo{flex-wrap:wrap}
  .htk-capture-detail{padding:10px}
}

/* 承認済みのお花ストリーム。幅は Hatask の表示領域を基準にする。 */
.htk-garden-page[data-garden-layout='streams'] {
  container: hatask-flower-page / inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  gap: 18px;
  min-width: 0;
}
.htk-garden-page[data-garden-layout='streams'] .htk-lg { min-width: 0; margin-bottom: 0; }
.htk-garden-page .htk-gc { padding: 14px 18px 16px; }
.htk-garden-page .htk-lg:hover { transform: none; }
.htk-garden-collections { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; min-width: 0; }
.htk-seasonal-tree-panel .htk-flower-heading { margin-bottom: 8px; }
.htk-seasonal-tree-scene { width: min(100%, 560px); height: clamp(220px, 45cqw, 380px); margin-inline: auto; }
.htk-flower-heading { position: relative; display: flex; align-items: center; gap: 4px; min-height: 44px; margin-bottom: 4px; }
.htk-flower-heading > :first-child { flex: 1; min-width: 0; }
.htk-flower-heading .htk-sec-title { margin: 0; font-size: 1rem; line-height: 1.5; overflow-wrap: anywhere; }
.htk-growing-panel .htk-sec-title { font-size: .82rem; color: var(--fg-2); }
.htk-flower-summary { margin: 2px 0 0; color: var(--fg-2); font-size: .75rem; line-height: 1.5; overflow-wrap: anywhere; }
.htk-flower-icon-button, .htk-flower-visibility > summary {
  display: grid; place-items: center; flex: 0 0 44px; box-sizing: border-box; width: 44px; min-height: 44px;
  padding: 0; border: 0; border-radius: var(--radius-xs); font: inherit; color: var(--fg-2); background: transparent; cursor: pointer;
}
.htk-flower-icon-button:hover:not(:disabled), .htk-flower-visibility > summary:hover { background: var(--hover-bg); color: var(--fg); }
.htk-flower-icon-button[aria-pressed='true'] { color: var(--on-accent); background: var(--accent-ink, var(--accent)); }
.htk-flower-icon-button:disabled { opacity: .45; cursor: default; }
.htk-flower-icon-button:focus-visible, .htk-flower-visibility > summary:focus-visible, .htk-flower-visibility select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.htk-growing-content { display: grid; grid-template-columns: 110px minmax(0, 1fr); align-items: center; gap: 8px 22px; }
.htk-growing-ring { grid-column: 1; grid-row: 1 / span 2; width: 110px; height: 110px; margin: 0; }
.htk-growing-copy { grid-column: 2; min-width: 0; overflow-wrap: anywhere; }
.htk-growing-name { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 9px; }
.htk-growing-name > strong { font-family: var(--htk-font-head); font-size: 1.3rem; line-height: 1.4; }
.htk-growing-name .htk-flower-rare-label { margin: 0; }
.htk-growing-meaning, .htk-growing-note { margin: 4px 0 0; color: var(--fg-2); font-size: .75rem; line-height: 1.5; }
.htk-growing-remaining { margin: 8px 0 0; color: var(--fg); font-size: .88rem; font-weight: 700; line-height: 1.5; }
.htk-growing-progress { margin: 2px 0 0; color: var(--fg-2); font-size: .75rem; line-height: 1.5; font-variant-numeric: tabular-nums; }
.htk-growing-harvest { grid-column: 2; justify-self: start; min-height: 44px; max-width: 100%; white-space: normal; }
.htk-flower-visibility select { box-sizing: border-box; min-height: 44px; max-width: 100%; padding: 6px 8px; border: 1px solid var(--rule); border-radius: var(--radius-xs); font: inherit; font-size: .75rem; color: var(--fg); background: var(--surface); }
.htk-flower-visibility option { background: var(--masthead, var(--surface)); color: var(--fg); }
.htk-flower-visibility { flex: 0 0 44px; }
.htk-flower-visibility > summary { list-style: none; }
.htk-flower-visibility > summary::-webkit-details-marker { display: none; }
.htk-flower-visibility[open] > summary { background: var(--hover-bg); }
.htk-flower-visibility-panel { position: absolute; top: calc(100% + 6px); right: 0; z-index: 30; box-sizing: border-box; width: min(320px, 100%); padding: 14px; border: 1px solid var(--rule); border-radius: var(--radius-sm); background: var(--surface); color: var(--fg); box-shadow: 0 12px 32px #0002; }
.htk-flower-visibility-panel, .htk-flower-info {
  background: linear-gradient(var(--masthead, var(--surface)), var(--masthead, var(--surface))), var(--bg);
}
.htk-flower-info::before { background: none; }
.htk-flower-visibility-panel label { display: grid; gap: 7px; font-size: .8rem; font-weight: 700; }
.htk-flower-visibility-panel p { margin: 8px 0 0; font-size: .75rem; line-height: 1.6; color: var(--fg-2); }
.htk-garden-page [data-garden-group='personal']:has(.htk-flower-visibility[open]) { z-index: 30; }
.htk-community-garden > .htk-gc { padding-bottom: 10px; }
.htk-community-garden .htk-flower-heading { padding-inline: 2px; margin-bottom: 10px; }
.htk-root[data-theme] .htk-garden-page .htk-sec-title { font-family: var(--htk-font-head); }
@container hatask-flower-page (min-width: 1100px) {
  .htk-garden-collections { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}
@container hatask-flower-page (max-width: 519px) {
  .htk-garden-page .htk-gc { padding: 10px 10px 12px; }
  .htk-garden-collections { gap: 12px; }
  .htk-growing-content { grid-template-columns: 82px minmax(0, 1fr); gap: 6px 13px; }
  .htk-growing-ring { width: 82px; height: 82px; }
  .htk-growing-ring .htk-fl-emo { font-size: 2.3rem; }
  .htk-growing-name > strong { font-size: 1.1rem; }
  .htk-growing-remaining { font-size: .82rem; margin-top: 5px; }
  .htk-growing-harvest { grid-column: 1 / -1; justify-self: stretch; }
  .htk-flower-heading .htk-sec-title { font-size: .9rem; }
}

:deep(.htk-folder-create-enter-active),:deep(.htk-folder-create-leave-active){transition:opacity .18s ease,transform .24s var(--ease-smooth,ease)}
:deep(.htk-folder-create-enter-from),:deep(.htk-folder-create-leave-to){opacity:0;transform:translateY(-7px)}
:deep(.htk-capture-detail-enter-active),:deep(.htk-capture-detail-leave-active){transition:opacity .16s ease}
:deep(.htk-capture-detail-enter-from),:deep(.htk-capture-detail-leave-to){opacity:0}
.htk-spot-tip-bottom .htk-spot-tip-arrow{top:-8px;left:50%;margin-left:-7px;border-right:none;border-bottom:none}
.htk-spot-tip-top .htk-spot-tip-arrow{bottom:-8px;left:50%;margin-left:-7px;border-left:none;border-top:none}
.htk-root[data-theme]:not([data-theme="akatsuki"]) .htk-primary, .htk-modal-ov[data-theme]:not([data-theme="akatsuki"]) .htk-primary{color:var(--htk-on-ink)}
</style>

<style lang="scss">
@use "../components/hatask/hatask-fonts.scss";
</style>

<!-- グローバルスタイル: Hatask起動時にMisskeyの標準ナビバーを非表示にする -->
<style lang="scss">
/* JS側で data-htask-hidden を付与した要素を確実に非表示 */
[data-htask-hidden] {
  display: none !important;
}
/* 旗鯖fork(v2): モバイル下部固定ナビは廃止。上部ナビ(.htk-nav-top)に一本化。 */

/* 旗鯖fork(v2): Hatask はページ自前のヘッダー(検索/ロゴ/設定)を持つため、アプリ側の
   ページヘッダー(灰色バー = MkPageHeader, [swipable][popup])を Hatask 表示中のみ隠す。
   body[data-hatask-active] は hatask.vue が表示中のみ付与し、離脱時 cleanupHataskState で除去。 */
body[data-hatask-active="1"] [swipable][popup="false"] { display: none !important; }

/* 旗鯖fork(v2): 旧背景オーブ/波は撤去済み。reduced-motion では装飾アニメも停止。 */
@media (prefers-reduced-motion: reduce){
  .htk-fl-emo{animation:none !important}
  .htk-tut-particles{display:none !important}
}

</style>
