<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only

Hatask レシピ。一覧・詳細・調理中・料理の記録・作成編集を 1 つの画面内で切り替える。
デザイン参照: Hataskレシピ.dc.html (2026-09-22)。トークンは暁レイアウト / hatask-themes.scss から継承する。
レシピと料理の記録は連合しない。レシピの共有範囲は非公開 / フォロワー / 指定メンバー。
料理の記録の公開範囲には公開もある。
-->
<template>
<section ref="rootEl" :class="$style.root" :data-hatask-theme="theme" :data-hatask-mode="mode" :data-screen="screen" :aria-label="copy.title">
	<!-- 一覧 -->
	<div v-if="screen === 'list'" :class="$style.screen">
		<header :class="$style.pageHead">
			<div>
				<div :class="$style.kicker"><i class="ti ti-chef-hat" aria-hidden="true"></i>{{ copy.createKicker }}</div>
				<h1 :class="$style.pageTitle">{{ copy.title }}</h1>
				<p :class="$style.lede">{{ copy.lede }}</p>
			</div>
		</header>

		<div :class="$style.listToolbar">
			<div :class="$style.seg" role="group" :aria-label="copy.recipeScope">
				<button type="button" :class="$style.segItem" :aria-pressed="scope === 'mine'" :aria-label="copy.mine" :title="copy.mine" @click="selectScope('mine')"><i class="ti ti-user" aria-hidden="true"></i><span v-if="scope === 'mine'">{{ copy.mine }}</span></button>
				<button type="button" :class="$style.segItem" :aria-pressed="scope === 'shared'" :aria-label="copy.shared" :title="copy.shared" @click="selectScope('shared')"><i class="ti ti-users" aria-hidden="true"></i><span v-if="scope === 'shared'">{{ copy.shared }}</span></button>
			</div>
			<div :class="$style.listActions">
				<button type="button" :class="$style.primary" :aria-label="copy.write" :title="copy.write" @click="openEditor(null)"><i class="ti ti-plus" aria-hidden="true"></i><span>{{ copy.write }}</span></button>
				<button type="button" :class="$style.secondary" :aria-label="copy.recordFromRecipe" :title="copy.recordFromRecipe" @click="openRecord(null)"><i class="ti ti-tools-kitchen-2" aria-hidden="true"></i><span>{{ copy.recordFromRecipe }}</span></button>
			</div>
		</div>

		<div v-if="isEmpty" :class="[$style.card, $style.empty]">
			<i class="ti ti-chef-hat" aria-hidden="true"></i>
			<h2>{{ copy.noRecipes }}</h2>
			<p>{{ copy.emptyHint }}</p>
		</div>

		<template v-if="!isEmpty">
			<div :class="[$style.card, $style.filters]">
				<div :class="$style.searchRow">
					<label :class="$style.search"><i class="ti ti-search" aria-hidden="true"></i><input v-model="query" type="search" :placeholder="copy.searchPlaceholder" :aria-label="copy.search"></label>
					<button type="button" :class="$style.iconBox" :aria-label="copy.sortOrder" :title="copy.sortOrder" @click="openSortMenu"><i class="ti ti-adjustments-horizontal" aria-hidden="true"></i></button>
				</div>
				<div :class="$style.chips" role="group" :aria-label="copy.category">
					<button type="button" :class="$style.chip" :aria-pressed="category === null" @click="category = null">{{ copy.all }}<span>{{ list?.counts.all ?? '' }}</span></button>
					<button v-for="item in HATASK_RECIPE_CATEGORIES" :key="item.id" type="button" :class="$style.chip" :aria-pressed="category === item.id" @click="category = item.id">{{ item.label }}<span>{{ list?.counts[item.id] ?? '' }}</span></button>
				</div>
				<div v-if="list?.tags.length" :class="$style.tags" role="group" :aria-label="copy.tags">
					<button v-for="item in list.tags" :key="item" type="button" :class="$style.tag" :aria-pressed="tag === item" @click="tag = tag === item ? null : item"><i class="ti ti-hash" aria-hidden="true"></i>{{ item }}</button>
				</div>
			</div>

			<div :class="$style.listMeta">
				<span role="status">{{ loading ? copy.loading : listError ? copy.loadFailedShort : list ? i18n.tsx._hata._hatask._recipe.recipesCount({ count: String(list.total) }) : '' }}</span>
				<button type="button" :class="$style.sortButton" @click="openSortMenu">{{ i18n.tsx._hata._hatask._recipe.sortLabel({ sort: sortLabel }) }}<i class="ti ti-chevron-down" aria-hidden="true"></i></button>
			</div>

			<div v-if="listError" :class="$style.stateNotice" role="alert"><p>{{ copy.loadFailed }}</p><button type="button" :class="$style.secondary" @click="loadList()">{{ copy.retry }}</button></div>
			<p v-else-if="!loading && list && list.items.length === 0" :class="$style.stateNotice">{{ query.trim() || category || tag ? copy.noMatch : scope === 'shared' ? copy.sharedEmpty : copy.noMatch }}</p>
			<div v-if="!listError && list?.items.length" :class="$style.grid" :aria-busy="loading">
				<button v-for="recipe in list?.items ?? []" :key="recipe.id" type="button" :class="$style.recipeCard" @click="openDetail(recipe)">
					<div :class="$style.photo">
						<img v-if="recipe.photo" :src="recipe.photo.thumbnailUrl ?? recipe.photo.url" alt="" loading="lazy">
						<template v-else><i class="ti ti-photo" aria-hidden="true"></i><span>{{ copy.noPhoto }}</span></template>
					</div>
					<div :class="$style.cardBody">
						<div :class="$style.cardMeta"><span>{{ recipeCategoryLabel(recipe.category) }}</span><span>{{ i18n.tsx._hata._hatask._recipe.servings({ count: String(recipe.servings) }) }}</span><span v-if="recipe.minutes != null" :class="$style.num">{{ i18n.tsx._hata._hatask._recipe.minutes({ minutes: String(recipe.minutes) }) }}</span></div>
						<strong :class="$style.cardTitle">{{ recipe.title }}</strong>
						<p v-if="recipe.summary" :class="$style.cardSummary">{{ recipe.summary }}</p>
						<div :class="$style.cardFoot">
							<span v-if="recipe.isDraft" :class="$style.draft"><i class="ti ti-pencil" aria-hidden="true"></i>{{ copy.draft }}</span>
							<span v-else-if="recipe.isMine"><i :class="recipeVisibility(recipe.visibility).icon" aria-hidden="true"></i>{{ recipeVisibility(recipe.visibility).label }}</span>
							<span v-else><MkAvatar :user="recipe.user" :class="$style.miniAvatar" :link="false" :preview="false"/>{{ recipe.user.name ?? recipe.user.username }}</span>
							<span :class="$style.cooked"><i class="ti ti-tools-kitchen-2" aria-hidden="true"></i>{{ i18n.tsx._hata._hatask._recipe.times({ count: String(recipe.cookedCount) }) }}</span>
						</div>
					</div>
				</button>
			</div>
			<div v-if="!listError && list && list.items.length < list.total" :class="$style.more"><button type="button" :class="$style.secondary" :disabled="loading" @click="loadMore">{{ copy.more }}</button></div>
		</template>
	</div>

	<!-- 詳細 -->
	<div v-else-if="screen === 'detail' && current" :class="$style.screen">
		<div :class="$style.backRow"><button type="button" :class="$style.back" @click="showList"><i class="ti ti-arrow-left" aria-hidden="true"></i>{{ copy.backList }}</button></div>
		<div :class="$style.detailGrid">
			<div :class="$style.detailMain">
				<div :class="[$style.photo, $style.detailPhoto]">
					<img v-if="current.photo" :src="current.photo.url" alt="">
					<template v-else><i class="ti ti-photo" aria-hidden="true"></i><span>{{ copy.noPhoto }}</span></template>
				</div>
				<div :class="$style.facts">
					<span><i class="ti ti-bowl-spoon" aria-hidden="true"></i>{{ recipeCategoryLabel(current.category) }}</span>
					<span v-if="current.minutes != null"><i class="ti ti-clock" aria-hidden="true"></i>{{ i18n.tsx._hata._hatask._recipe.minutes({ minutes: String(current.minutes) }) }}</span>
					<span v-if="current.isDraft"><i class="ti ti-pencil" aria-hidden="true"></i>{{ copy.draft }}</span>
					<span v-else><i :class="recipeVisibility(current.visibility).icon" aria-hidden="true"></i>{{ visibilityFact(current.visibility) }}</span>
					<span><i class="ti ti-tools-kitchen-2" aria-hidden="true"></i>{{ i18n.tsx._hata._hatask._recipe.timesCooked({ count: String(current.cookedCount) }) }}</span>
				</div>
				<h1 :class="$style.detailTitle">{{ current.title }}</h1>
				<div v-if="!current.isMine" :class="$style.author"><MkAvatar :user="current.user" :class="$style.miniAvatar"/><MkUserName :user="current.user"/><span>@{{ current.user.username }}</span></div>
				<p v-if="current.summary" :class="$style.detailSummary">{{ current.summary }}</p>
				<div v-if="current.tags.length" :class="$style.tags"><span v-for="item in current.tags" :key="item" :class="$style.tag"><i class="ti ti-hash" aria-hidden="true"></i>{{ item }}</span></div>
				<div :class="$style.actions">
					<button type="button" :class="$style.primary" @click="startCooking"><i class="ti ti-player-play" aria-hidden="true"></i>{{ copy.startCooking }}</button>
					<template v-if="current.isMine">
						<button type="button" :class="$style.secondary" @click="openEditor(current)"><i class="ti ti-pencil" aria-hidden="true"></i>{{ copy.edit }}</button>
						<button type="button" :class="$style.secondary" :disabled="busy" @click="deleteRecipe"><i class="ti ti-trash" aria-hidden="true"></i>{{ copy.delete }}</button>
					</template>
				</div>
			</div>
			<div :class="$style.detailSide">
				<section :class="[$style.card, $style.section]" aria-labelledby="hatask-recipe-ingredients">
					<div :class="$style.sectionHead">
						<h2 id="hatask-recipe-ingredients" :class="$style.sectionTitle"><i class="ti ti-basket" aria-hidden="true"></i>{{ copy.ingredients }}</h2>
						<span>{{ current.scalable && servings !== current.servings ? copy.scaling : i18n.tsx._hata._hatask._recipe.baseServingsInfo({ count: String(current.servings) }) }}</span>
					</div>
					<div :class="$style.stepper">
						<span>{{ copy.amount }}</span>
						<button type="button" :class="$style.stepBtn" :disabled="!current.scalable || servings <= 1" :aria-label="copy.decreaseServing" @click="servings--"><i class="ti ti-minus" aria-hidden="true"></i></button>
						<strong aria-live="polite">{{ i18n.tsx._hata._hatask._recipe.servings({ count: String(servings) }) }}</strong>
						<button type="button" :class="$style.stepBtn" :disabled="!current.scalable || servings >= 50" :aria-label="copy.increaseServing" @click="servings++"><i class="ti ti-plus" aria-hidden="true"></i></button>
					</div>
					<p v-if="!current.scalable" :class="$style.hint">{{ i18n.tsx._hata._hatask._recipe.scalingDisabledInfo({ count: String(current.servings) }) }}</p>
					<dl :class="$style.ingredients">
						<div v-for="(item, index) in current.ingredients" :key="index"><dt>{{ item.name }}</dt><dd>{{ scaledAmount(item.amount) }}</dd></div>
					</dl>
					<p v-if="!current.ingredients.length" :class="$style.hint">{{ copy.noIngredients }}</p>
				</section>
				<section :class="[$style.card, $style.section]" aria-labelledby="hatask-recipe-steps">
					<h2 id="hatask-recipe-steps" :class="$style.sectionTitle"><i class="ti ti-list-numbers" aria-hidden="true"></i>{{ copy.steps }}</h2>
					<ol :class="$style.steps">
						<li v-for="(step, index) in current.steps" :key="index">
							<span :class="$style.stepNo">{{ index + 1 }}</span>
							<div>
								<p>{{ step.text }}</p>
								<span v-if="step.timerSeconds" :class="$style.timerTag"><i class="ti ti-alarm" aria-hidden="true"></i>{{ formatRecipeTimer(step.timerSeconds) }}<template v-if="step.timerLabel"> {{ step.timerLabel }}</template></span>
							</div>
						</li>
					</ol>
					<p v-if="!current.steps.length" :class="$style.hint">{{ copy.noSteps }}</p>
				</section>
				<section v-if="detailReferenceLinks.length" :class="[$style.card, $style.section]" aria-labelledby="hatask-recipe-references">
					<h2 id="hatask-recipe-references" :class="$style.sectionTitle"><i class="ti ti-link" aria-hidden="true"></i>{{ copy.referenceSites }}</h2>
					<ul :class="$style.referenceList">
						<li v-for="(link, index) in detailReferenceLinks" :key="index">
							<a :href="link.url" target="_blank" rel="noopener noreferrer" :class="$style.referenceLink"><strong>{{ link.title || link.url }}</strong><span v-if="link.title">{{ link.url }}</span></a>
						</li>
					</ul>
				</section>
			</div>
		</div>
	</div>

	<!-- 調理中 -->
	<div v-else-if="screen === 'cook' && current" :class="$style.screen">
		<div :class="$style.topBar">
			<button type="button" :class="$style.back" @click="screen = 'detail'"><i class="ti ti-arrow-left" aria-hidden="true"></i>{{ copy.backRecipe }}</button>
			<span :class="$style.barLabel">{{ copy.cooking }}</span>
		</div>
		<h1 :class="$style.screenTitle">{{ current.title }}</h1>
		<div :class="$style.cookFacts">
			<span><i class="ti ti-users" aria-hidden="true"></i>{{ i18n.tsx._hata._hatask._recipe.servings({ count: String(servings) }) }}</span>
			<span :class="$style.elapsed"><i class="ti ti-clock-play" aria-hidden="true"></i>{{ i18n.tsx._hata._hatask._recipe.elapsed({ time: formatRecipeTimer(elapsedSeconds) }) }}</span>
			<span>{{ i18n.tsx._hata._hatask._recipe.stepsDone({ done: String(doneSteps.size), total: String(current.steps.length) }) }}</span>
		</div>
		<div v-if="timedSteps.length" :class="$style.timerChips">
			<button v-for="item in timedSteps" :key="item.index" type="button" :class="$style.timerChip" :aria-pressed="timers.has(item.index)" @click="toggleTimer(item.index)">
				<i class="ti ti-alarm" aria-hidden="true"></i>{{ timers.has(item.index) ? formatRecipeTimer(timerRemaining(item.index)) : formatRecipeTimer(item.seconds) }}<template v-if="item.label"> {{ item.label }}</template>
			</button>
		</div>
		<div :class="$style.cookSteps">
			<button v-for="(step, index) in current.steps" :key="index" type="button" :class="$style.cookStep" :aria-pressed="doneSteps.has(index)" @click="toggleStep(index)">
				<span :class="$style.check"><i class="ti ti-check" aria-hidden="true"></i></span>
				<span :class="$style.cookStepBody">
					<small>STEP {{ index + 1 }}</small>
					<strong>{{ step.text }}</strong>
					<small v-if="step.timerSeconds" :class="$style.cookTimer"><i class="ti ti-alarm" aria-hidden="true"></i>{{ formatRecipeTimer(step.timerSeconds) }}<template v-if="step.timerLabel"> {{ step.timerLabel }}</template></small>
				</span>
			</button>
		</div>
		<div :class="$style.finish">
			<button type="button" :class="[$style.primary, $style.wide]" @click="finishCooking"><i class="ti ti-check" aria-hidden="true"></i>{{ copy.finishCooking }}</button>
			<p>{{ copy.finishHint }}</p>
		</div>
	</div>

	<!-- 料理の記録 -->
	<div v-else-if="screen === 'record'" :class="$style.screen">
		<div :class="$style.topBar">
			<button type="button" :class="$style.back" :disabled="busy || confirmPending" @click="leaveRecord"><i class="ti ti-arrow-left" aria-hidden="true"></i>{{ copy.back }}</button>
			<span :class="$style.barLabel">{{ copy.recordBar }}</span>
		</div>
		<h1 :class="$style.screenTitle">{{ copy.recordTitle }}</h1>
		<p :class="$style.lede">{{ copy.recordLede }}</p>
		<div :class="$style.stack">
			<section :class="[$style.card, $style.formCard]">
				<div :class="$style.recipePick">
					<span :class="$style.recipeIcon"><i class="ti ti-chef-hat" aria-hidden="true"></i></span>
					<span :class="$style.recipePickText"><small>{{ copy.title }}</small><strong>{{ recordRecipe?.title ?? copy.chooseRecipe }}</strong></span>
					<button type="button" :class="$style.smallButton" @click="chooseRecordRecipe">{{ recordRecipe ? copy.change : copy.choose }}</button>
				</div>
				<div :class="$style.photoPick">
					<button type="button" :class="$style.photoSlot" :aria-label="record.file ? copy.changePhoto : copy.addPhoto" @click="pickPhoto($event, 'record')">
						<img v-if="record.file" :src="record.file.thumbnailUrl ?? record.file.url" alt="">
						<template v-else><i class="ti ti-camera-plus" aria-hidden="true"></i><small>{{ copy.noPhoto }}</small></template>
					</button>
					<p>{{ copy.recordPhotoHelp }}<button v-if="record.file" type="button" :class="$style.linkButton" @click="record.file = null">{{ copy.removePhoto }}</button></p>
				</div>
			</section>
			<section :class="[$style.card, $style.formCard]">
				<label :class="$style.field"><span><i class="ti ti-calendar" aria-hidden="true"></i>{{ copy.cookedAt }}</span><input v-model="record.cookedAt" type="datetime-local" :class="$style.input"></label>
				<label :class="$style.field"><span><i class="ti ti-clock-play" aria-hidden="true"></i>{{ copy.duration }}</span><span :class="$style.inputWrap"><input v-model.number="record.minutes" type="number" min="0" max="1440" inputmode="numeric" :class="$style.input"><em>{{ copy.minuteUnit }}</em></span></label>
				<label :class="$style.field"><span><i class="ti ti-users" aria-hidden="true"></i>{{ copy.servingsAndAmount }}</span><span :class="$style.inputWrap"><input v-model.number="record.servings" type="number" min="1" max="50" inputmode="numeric" :class="$style.input"><em>{{ copy.servingUnit }}</em></span></label>
				<div :class="[$style.field, $style.mealField]"><span><i class="ti ti-soup" aria-hidden="true"></i>{{ copy.meal }}</span><div :class="$style.mealChoices" role="group" :aria-label="copy.meal"><button type="button" :class="$style.mealChip" :aria-pressed="record.mealSlot === null" :aria-label="copy.none" :title="copy.none" @click="record.mealSlot = null"><i class="ti ti-circle-off" aria-hidden="true"></i><span v-if="record.mealSlot === null">{{ copy.none }}</span></button><button v-for="slot in HATASK_COOKING_MEAL_SLOTS" :key="slot.id" type="button" :class="$style.mealChip" :aria-pressed="record.mealSlot === slot.id" :aria-label="slot.label" :title="slot.label" @click="record.mealSlot = slot.id"><i :class="slot.icon" aria-hidden="true"></i><span v-if="record.mealSlot === slot.id">{{ slot.label }}</span></button></div></div>
				<label :class="$style.field"><span><i class="ti ti-coin" aria-hidden="true"></i>{{ copy.ingredientCost }}</span><span :class="$style.inputWrap"><input v-model.number="record.cost" type="number" min="0" inputmode="numeric" :placeholder="copy.approximately" :class="$style.input"><em>{{ copy.yen }}</em></span></label>
				<label :class="$style.memo"><span><i class="ti ti-pencil" aria-hidden="true"></i>{{ copy.memo }}</span><textarea v-model="record.memo" maxlength="2000" rows="3" :class="$style.textarea"></textarea></label>
			</section>
			<section :class="[$style.card, $style.formCard]">
				<h2 :class="$style.smallTitle">{{ copy.visibility }}</h2>
				<div :class="$style.visChoices" role="group" :aria-label="copy.visibility">
					<button v-for="item in HATASK_COOKING_VISIBILITIES" :key="item.id" type="button" :class="$style.visChip" :aria-pressed="record.visibility === item.id" @click="record.visibility = item.id"><i :class="item.icon" aria-hidden="true"></i>{{ item.label }}</button>
				</div>
				<div v-if="record.visibility === 'specified'" :class="$style.members">
					<span v-for="id in record.visibleUserIds" :key="id" :class="$style.member">{{ memberNames[id] ?? id }}<button type="button" :aria-label="i18n.tsx._hata._hatask._recipe.removeMember({ name: memberNames[id] ?? id })" @click="record.visibleUserIds = record.visibleUserIds.filter(member => member !== id)"><i class="ti ti-x" aria-hidden="true"></i></button></span>
					<button type="button" :class="$style.smallButton" @click="addMember(record.visibleUserIds)"><i class="ti ti-user-plus" aria-hidden="true"></i>{{ copy.addMember }}</button>
				</div>
				<p :class="$style.hint">{{ copy.recordPrivacy }}</p>
			</section>
		</div>
		<div :class="$style.formActions">
			<button type="button" :class="[$style.primary, $style.grow]" :disabled="busy || confirmPending || !recordRecipe" @click="saveRecord"><i class="ti ti-device-floppy" aria-hidden="true"></i>{{ copy.saveMeal }}</button>
			<button type="button" :class="$style.secondary" :disabled="busy || confirmPending" @click="leaveRecord">{{ copy.later }}</button>
		</div>
	</div>

	<!-- 作成・編集 -->
	<div v-else-if="screen === 'edit'" :class="$style.screen">
		<div :class="$style.topBar">
			<button type="button" :class="$style.back" @click="leaveEditor"><i class="ti ti-arrow-left" aria-hidden="true"></i>{{ copy.backToList }}</button>
			<span v-if="!editor.id" :class="$style.barLabel">{{ copy.autoDraft }}</span>
		</div>
		<h1 :class="$style.screenTitle">{{ editor.id ? copy.editRecipe : copy.write }}</h1>
		<div :class="$style.editGrid">
			<section :class="$style.stack">
				<div :class="[$style.card, $style.formCard, $style.formGrid]">
					<label :class="$style.block"><span>{{ copy.recipeName }}</span><input v-model="editor.title" maxlength="128" :class="$style.input" required></label>
					<label :class="$style.block"><span>{{ copy.summary }}</span><textarea v-model="editor.summary" maxlength="512" rows="2" :class="$style.textarea"></textarea></label>
					<div :class="$style.block"><span>{{ copy.category }}</span><div :class="$style.chips" role="group" :aria-label="copy.category"><button v-for="item in HATASK_RECIPE_CATEGORIES" :key="item.id" type="button" :class="$style.chip" :aria-pressed="editor.category === item.id" @click="editor.category = item.id">{{ item.label }}</button></div></div>
					<div :class="$style.pair">
						<label :class="$style.block"><span>{{ copy.baseServings }}</span><span :class="$style.inputWrap"><input v-model.number="editor.servings" type="number" min="1" max="50" inputmode="numeric" :class="$style.input"><em>{{ copy.servingUnit }}</em></span></label>
						<label :class="$style.block"><span>{{ copy.estimatedTime }}</span><span :class="$style.inputWrap"><input v-model.number="editor.minutes" type="number" min="0" max="1440" inputmode="numeric" :class="$style.input"><em>{{ copy.minuteUnit }}</em></span></label>
					</div>
					<button type="button" role="switch" :aria-checked="editor.scalable" :class="$style.switchRow" @click="editor.scalable = !editor.scalable">
						<span :class="$style.switch"><span></span></span>
						<span><strong>{{ copy.scaleAllow }}</strong><small>{{ copy.scaleExplain }}</small></span>
					</button>
					<label :class="$style.block"><span>{{ copy.tagsHint }}</span><input v-model="editor.tags" :class="$style.input" :placeholder="copy.tagExample"></label>
					<div :class="$style.block">
						<span>{{ copy.photo }}</span>
						<div :class="$style.photoPick">
							<button type="button" :class="$style.photoSlot" :aria-label="editor.file ? copy.changePhoto : copy.addPhoto" @click="pickPhoto($event, 'editor')">
								<img v-if="editor.file" :src="editor.file.thumbnailUrl ?? editor.file.url" alt="">
								<template v-else><i class="ti ti-camera-plus" aria-hidden="true"></i><small>{{ copy.noPhoto }}</small></template>
							</button>
							<p>{{ copy.recipePhotoHelp }}<button v-if="editor.file" type="button" :class="$style.linkButton" @click="editor.file = null">{{ copy.removePhoto }}</button></p>
						</div>
					</div>
				</div>
				<div :class="[$style.card, $style.formCard]">
					<h2 :class="$style.sectionTitle"><i class="ti ti-basket" aria-hidden="true"></i>{{ copy.ingredients }}</h2>
					<div v-for="(item, index) in editor.ingredients" :key="item.key" :class="$style.ingredientRow" :data-dragging="dragIndex === index" @dragover.prevent @drop="dropIngredient(index)">
						<button type="button" :class="$style.grip" draggable="true" :aria-label="i18n.tsx._hata._hatask._recipe.ingredientOrder({ name: item.name || copy.ingredients })" @dragstart="dragIndex = index" @dragend="dragIndex = null" @keydown.up.prevent="moveIngredient(index, -1)" @keydown.down.prevent="moveIngredient(index, 1)"><i class="ti ti-grip-vertical" aria-hidden="true"></i></button>
						<input v-model="item.name" maxlength="64" :class="$style.input" :placeholder="copy.ingredients" :aria-label="copy.ingredientName">
						<input v-model="item.amount" maxlength="32" :class="[$style.input, $style.num]" :placeholder="copy.amount" :aria-label="copy.amount">
						<button type="button" :class="$style.iconButton" :aria-label="i18n.tsx._hata._hatask._recipe.removeIngredient({ name: item.name || copy.ingredients })" @click="editor.ingredients.splice(index, 1)"><i class="ti ti-trash" aria-hidden="true"></i></button>
					</div>
					<button type="button" :class="[$style.secondary, $style.wide, $style.addRow]" :disabled="editor.ingredients.length >= 60" @click="addIngredient"><i class="ti ti-plus" aria-hidden="true"></i>{{ copy.addIngredient }}</button>
				</div>
			</section>
			<section :class="$style.stack">
				<div :class="[$style.card, $style.formCard]">
					<h2 :class="$style.sectionTitle"><i class="ti ti-list-numbers" aria-hidden="true"></i>{{ copy.steps }}</h2>
					<div v-for="(step, index) in editor.steps" :key="step.key" :class="$style.stepRow">
						<span :class="$style.stepNo">{{ index + 1 }}</span>
						<div :class="$style.stepEdit">
							<textarea v-model="step.text" maxlength="1000" rows="2" :class="$style.textarea" :aria-label="i18n.tsx._hata._hatask._recipe.stepNumber({ number: String(index + 1) })"></textarea>
							<span v-if="step.timerSeconds" :class="$style.timerTag"><i class="ti ti-alarm" aria-hidden="true"></i>{{ formatRecipeTimer(step.timerSeconds) }}<template v-if="step.timerLabel"> {{ step.timerLabel }}</template></span>
						</div>
						<div :class="$style.stepTools">
							<button type="button" :class="$style.iconButton" :aria-label="i18n.tsx._hata._hatask._recipe.stepTimer({ number: String(index + 1) })" :aria-pressed="!!step.timerSeconds" @click="editTimer(step)"><i class="ti ti-alarm" aria-hidden="true"></i></button>
							<button type="button" :class="$style.iconButton" :aria-label="i18n.tsx._hata._hatask._recipe.removeStep({ number: String(index + 1) })" @click="editor.steps.splice(index, 1)"><i class="ti ti-trash" aria-hidden="true"></i></button>
						</div>
					</div>
					<button type="button" :class="[$style.secondary, $style.wide, $style.addRow]" :disabled="editor.steps.length >= 40" @click="addStep"><i class="ti ti-plus" aria-hidden="true"></i>{{ copy.addStep }}</button>
				</div>
				<section :class="[$style.card, $style.formCard]" aria-labelledby="hatask-recipe-reference-editor">
					<h2 id="hatask-recipe-reference-editor" :class="$style.sectionTitle"><i class="ti ti-link" aria-hidden="true"></i>{{ copy.referenceSites }}</h2>
					<p :class="$style.hint">{{ copy.referenceHelp }}</p>
					<div v-for="(link, index) in editor.referenceLinks" :key="link.key" :class="$style.referenceRow">
						<div :class="$style.referenceFields">
							<label :class="$style.field"><span>{{ i18n.tsx._hata._hatask._recipe.referenceSiteNumber({ number: String(index + 1) }) }} · {{ copy.referenceSiteName }}</span><input v-model="link.title" maxlength="120" :class="$style.input" :placeholder="copy.referenceSiteName"></label>
							<label :class="$style.field"><span>{{ i18n.tsx._hata._hatask._recipe.referenceSiteNumber({ number: String(index + 1) }) }} · {{ copy.referenceUrl }}</span><input v-model="link.url" type="url" maxlength="2048" :class="$style.input" placeholder="https://example.com/" autocapitalize="off" spellcheck="false"></label>
						</div>
						<button type="button" :class="$style.iconButton" :aria-label="i18n.tsx._hata._hatask._recipe.removeReferenceSite({ number: String(index + 1) })" @click="editor.referenceLinks.splice(index, 1)"><i class="ti ti-trash" aria-hidden="true"></i></button>
					</div>
					<button type="button" :class="[$style.secondary, $style.wide, $style.addRow]" :disabled="editor.referenceLinks.length >= 10" @click="addReferenceLink"><i class="ti ti-plus" aria-hidden="true"></i>{{ copy.addReferenceSite }}</button>
				</section>
				<div :class="[$style.card, $style.formCard]">
					<h2 :class="$style.smallTitle">{{ copy.visibility }}</h2>
					<div :class="$style.visChoices" role="group" :aria-label="copy.visibility">
						<button v-for="item in HATASK_RECIPE_VISIBILITIES" :key="item.id" type="button" :class="$style.visChip" :aria-pressed="editor.visibility === item.id" @click="editor.visibility = item.id"><i :class="item.icon" aria-hidden="true"></i>{{ item.label }}</button>
					</div>
					<div v-if="editor.visibility === 'specified'" :class="$style.members">
						<span v-for="id in editor.visibleUserIds" :key="id" :class="$style.member">{{ memberNames[id] ?? id }}<button type="button" :aria-label="i18n.tsx._hata._hatask._recipe.removeMember({ name: memberNames[id] ?? id })" @click="editor.visibleUserIds = editor.visibleUserIds.filter(member => member !== id)"><i class="ti ti-x" aria-hidden="true"></i></button></span>
						<button type="button" :class="$style.smallButton" @click="addMember(editor.visibleUserIds)"><i class="ti ti-user-plus" aria-hidden="true"></i>{{ copy.addMember }}</button>
					</div>
					<p :class="$style.hint">{{ copy.recipePrivacy }}</p>
				</div>
				<div :class="$style.formActions">
					<button type="button" :class="[$style.primary, $style.grow]" :disabled="busy || !editor.title.trim()" @click="saveRecipe(false)"><i class="ti ti-check" aria-hidden="true"></i>{{ copy.save }}</button>
					<button type="button" :class="$style.secondary" :disabled="busy || !editor.title.trim()" @click="saveRecipe(true)">{{ copy.saveDraft }}</button>
				</div>
			</section>
		</div>
	</div>

	<!-- 初回同意 -->
	<div v-if="settingsReady && !consented" :class="$style.overlay">
		<div :class="$style.dialog" role="dialog" aria-modal="true" aria-labelledby="hatask-recipe-consent-title">
			<div :class="$style.dialogKicker"><i class="ti ti-alert-triangle" aria-hidden="true"></i>{{ copy.firstUse }}</div>
			<h2 id="hatask-recipe-consent-title" :class="$style.dialogTitle">{{ copy.consentTitle }}</h2>
			<p>{{ copy.consentBody }}</p>
			<ul>
				<li>{{ copy.consentRights }}</li>
				<li>{{ copy.consentRemoval }}</li>
				<li>{{ copy.consentFederation }}</li>
			</ul>
			<div :class="$style.formActions">
				<button ref="consentButton" type="button" :class="[$style.primary, $style.grow]" @click="emit('consent')">{{ copy.consentUse }}</button>
				<button type="button" :class="$style.secondary" @click="emit('close')">{{ copy.close }}</button>
			</div>
		</div>
	</div>
</section>
</template>

<script lang="ts" setup>
import { useHataGoesPickers } from '@/utility/hatagoes-pickers.js';
import { computed, nextTick, onBeforeUnmount, onDeactivated, reactive, ref, useTemplateRef, watch } from 'vue';
import type * as Misskey from 'cherrypick-js';
import * as os from '@/os.js';
import { useHataGoesDialogs } from '@/utility/hatagoes-dialogs.js';
import { useHataGoesPopupMenu } from '@/utility/hatagoes-popup.js';
import { i18n } from '@/i18n.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { selectFile } from '@/utility/drive.js';
import MkAvatar from '@/components/global/MkAvatar.vue';
import MkUserName from '@/components/global/MkUserName.vue';
import {
	HATASK_COOKING_MEAL_SLOTS,
	HATASK_COOKING_VISIBILITIES,
	HATASK_RECIPE_CATEGORIES,
	HATASK_RECIPE_VISIBILITIES,
	formatRecipeTimer,
	parseRecipeTimer,
	normalizeRecipeReferenceUrl,
	recipeCategoryLabel,
	recipeVisibility,
	scaleRecipeAmount,
} from '@/utility/hatask-recipe.js';
import type { HataskCookingMealSlot, HataskCookingVisibility, HataskRecipe, HataskRecipeCategory, HataskRecipeList, HataskRecipeVisibility } from '@/utility/hatask-recipe.js';

const pickers = useHataGoesPickers();
const copy = i18n.ts._hata._hatask._recipe;

const popupMenu = useHataGoesPopupMenu();
const dialogs = useHataGoesDialogs();

const props = defineProps<{
	theme: string;
	mode: 'light' | 'dark';
	/** The parent owns the persisted consent flag; the dialog waits until settings are loaded. */
	consented: boolean;
	settingsReady: boolean;
}>();
const emit = defineEmits<{ consent: []; close: []; hatadyCookingSaved: [] }>();

type Screen = 'list' | 'detail' | 'cook' | 'record' | 'edit';
type Scope = 'mine' | 'shared';
type Sort = 'cooked' | 'recent' | 'title';
type Photo = Pick<Misskey.entities.DriveFile, 'id' | 'url' | 'thumbnailUrl'>;
type EditorStep = { key: number; text: string; timerSeconds: number | null; timerLabel: string };

const PAGE_SIZE = 30;
const DRAFT_KEY = 'hatask:recipe-editor-draft';
const SORTS: { id: Sort; label: string }[] = [
	{ id: 'cooked', label: copy.sortCooked },
	{ id: 'recent', label: copy.sortRecent },
	{ id: 'title', label: copy.sortTitle },
];

const rootEl = useTemplateRef('rootEl');
const consentButton = useTemplateRef('consentButton');
const screen = ref<Screen>('list');
const scope = ref<Scope>('mine');
const category = ref<HataskRecipeCategory | null>(null);
const tag = ref<string | null>(null);
const query = ref('');
const sort = ref<Sort>('cooked');
const list = ref<HataskRecipeList | null>(null);
const loading = ref(false);
const listError = ref(false);
const busy = ref(false);
const confirmPending = ref(false);
const current = ref<HataskRecipe | null>(null);
const servings = ref(2);
const detailReferenceLinks = computed(() => (current.value?.referenceLinks ?? []).flatMap(link => {
	const url = normalizeRecipeReferenceUrl(link.url);
	return url ? [{ title: link.title.trim(), url }] : [];
}));
const memberNames = reactive<Record<string, string>>({});
let listRequest = 0;
let rowKey = 0;

const sortLabel = computed(() => SORTS.find(item => item.id === sort.value)!.label);
const isEmpty = computed(() => scope.value === 'mine' && !loading.value && !listError.value && list.value?.total === 0 && !query.value.trim() && !category.value && !tag.value);

async function loadList(append = false): Promise<void> {
	const request = ++listRequest;
	loading.value = true;
	listError.value = false;
	if (!append) list.value = null;
	try {
		const result = await misskeyApi('hatask/recipes/list', {
			scope: scope.value,
			category: category.value,
			tag: tag.value,
			query: query.value.trim() || null,
			sort: sort.value,
			limit: PAGE_SIZE,
			offset: append ? list.value?.items.length ?? 0 : 0,
		});
		if (request !== listRequest) return;
		list.value = append && list.value ? { ...result, items: [...list.value.items, ...result.items] } : result;
	} catch {
		if (request === listRequest) listError.value = true;
	} finally {
		if (request === listRequest) loading.value = false;
	}
}

function loadMore(): void { void loadList(true); }

let queryTimer: number | null = null;
watch(query, () => {
	if (queryTimer) window.clearTimeout(queryTimer);
	listRequest++;
	list.value = null;
	listError.value = false;
	loading.value = true;
	queryTimer = window.setTimeout(() => { queryTimer = null; void loadList(); }, 300);
}, { flush: 'sync' });
watch([scope, category, tag, sort], () => {
	if (queryTimer) window.clearTimeout(queryTimer);
	queryTimer = null;
	listRequest++;
	list.value = null;
	listError.value = false;
	loading.value = true;
}, { flush: 'sync' });
watch([scope, category, tag, sort], () => { void loadList(); });
void loadList();

function selectScope(next: Scope): void {
	if (scope.value === next) return;
	category.value = null;
	tag.value = null;
	scope.value = next;
}

function openSortMenu(ev: MouseEvent): void {
	popupMenu(SORTS.map(item => ({ text: item.label, active: sort.value === item.id, action: () => { sort.value = item.id; } })), ev.currentTarget ?? ev.target);
}

function visibilityFact(visibility: HataskRecipeVisibility): string {
	return visibility === 'followers' ? copy.followersPublic : visibility === 'specified' ? copy.specifiedPublic : copy.visibilityPrivate;
}

async function showScreen(next: Screen): Promise<void> {
	screen.value = next;
	await nextTick();
	// Only pull the view back when the new screen would start above the viewport.
	if ((rootEl.value?.getBoundingClientRect().top ?? 0) < 0) rootEl.value?.scrollIntoView({ block: 'start' });
}

function showList(): void {
	void showScreen('list');
	void loadList();
}

async function openDetail(recipe: HataskRecipe): Promise<void> {
	current.value = recipe;
	servings.value = recipe.servings;
	void showScreen('detail');
	try {
		const fresh = await misskeyApi('hatask/recipes/show', { recipeId: recipe.id });
		if (current.value?.id === fresh.id) current.value = fresh;
	} catch { /* The list copy is still usable when a refresh fails. */ }
}

function scaledAmount(amount: string): string {
	const recipe = current.value;
	if (!recipe || !recipe.scalable) return amount;
	return scaleRecipeAmount(amount, servings.value / recipe.servings);
}

async function deleteRecipe(): Promise<void> {
	const recipe = current.value;
	if (!recipe || busy.value) return;
	const { canceled } = await dialogs.confirm({ type: 'warning', text: i18n.tsx._hata._hatask._recipe.recipeDeleteConfirm({ title: recipe.title }) });
	if (canceled) return;
	busy.value = true;
	try {
		await misskeyApi('hatask/recipes/delete', { recipeId: recipe.id });
		current.value = null;
		showList();
	} catch {
		dialogs.alert({ type: 'error', text: copy.deleteFailed });
	} finally {
		busy.value = false;
	}
}

// ===== 調理中 =====
const doneSteps = ref(new Set<number>());
const cookStartedAt = ref(0);
const now = ref(Date.now());
const timers = ref(new Map<number, number>());
let ticker: number | null = null;

const elapsedSeconds = computed(() => cookStartedAt.value ? Math.max(0, Math.floor((now.value - cookStartedAt.value) / 1000)) : 0);
const timedSteps = computed(() => (current.value?.steps ?? []).flatMap((step, index) => step.timerSeconds ? [{ index, seconds: step.timerSeconds, label: step.timerLabel }] : []));

function startTicker(): void {
	if (ticker) return;
	ticker = window.setInterval(() => {
		now.value = Date.now();
		for (const [index, endsAt] of timers.value) {
			if (endsAt > now.value) continue;
			const next = new Map(timers.value);
			next.delete(index);
			timers.value = next;
			const step = current.value?.steps[index];
			os.toast(i18n.tsx._hata._hatask._recipe.timerDone({ label: step?.timerLabel ? `${copy.timerLabelSeparator}${step.timerLabel}` : '', step: String(index + 1) }), 'ti ti-alarm');
		}
	}, 1000);
}

function stopTicker(): void {
	if (ticker) window.clearInterval(ticker);
	ticker = null;
}

function startCooking(): void {
	doneSteps.value = new Set();
	timers.value = new Map();
	cookStartedAt.value = Date.now();
	now.value = cookStartedAt.value;
	startTicker();
	void showScreen('cook');
}

function toggleStep(index: number): void {
	const next = new Set(doneSteps.value);
	if (next.has(index)) next.delete(index); else next.add(index);
	doneSteps.value = next;
}

function toggleTimer(index: number): void {
	const step = current.value?.steps[index];
	if (!step?.timerSeconds) return;
	const next = new Map(timers.value);
	if (next.has(index)) next.delete(index); else next.set(index, Date.now() + step.timerSeconds * 1000);
	timers.value = next;
	now.value = Date.now();
}

function timerRemaining(index: number): number {
	return Math.max(0, Math.ceil(((timers.value.get(index) ?? 0) - now.value) / 1000));
}

function finishCooking(): void {
	const minutes = cookStartedAt.value ? Math.max(1, Math.round((Date.now() - cookStartedAt.value) / 60000)) : null;
	stopTicker();
	timers.value = new Map();
	openRecord(current.value, minutes);
}

watch(screen, next => { if (next !== 'cook') stopTicker(); });

// ===== 料理の記録 =====
const recordRecipe = ref<HataskRecipe | null>(null);
const recordReturn = ref<Screen>('list');
const record = reactive({
	cookedAt: '',
	minutes: null as number | null,
	servings: 2,
	mealSlot: null as HataskCookingMealSlot | null,
	cost: null as number | null,
	memo: '',
	file: null as Photo | null,
	visibility: 'private' as HataskCookingVisibility,
	visibleUserIds: [] as string[],
});
let recordBaseline = '';
let recordPrefilled = false;
let returnToHatadyAfterRecord = false;

function recordSignature(): string {
	return JSON.stringify({
		recipeId: recordRecipe.value?.id ?? null,
		cookedAt: record.cookedAt, minutes: record.minutes, servings: record.servings,
		mealSlot: record.mealSlot, cost: record.cost, memo: record.memo, fileId: record.file?.id ?? null,
		visibility: record.visibility, visibleUserIds: record.visibleUserIds,
	});
}

function localDateTime(date: Date): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function openRecord(recipe: HataskRecipe | null, minutes: number | null = null, fromHatady = false): void {
	returnToHatadyAfterRecord = fromHatady;
	recordReturn.value = screen.value === 'cook' ? 'detail' : screen.value;
	recordRecipe.value = recipe;
	Object.assign(record, {
		cookedAt: localDateTime(new Date()),
		minutes,
		servings: recipe && current.value?.id === recipe.id ? servings.value : recipe?.servings ?? 2,
		mealSlot: null,
		cost: null,
		memo: '',
		file: null,
		visibility: 'private',
		visibleUserIds: [],
	});
	recordBaseline = recordSignature();
	recordPrefilled = recipe != null || minutes != null;
	void showScreen('record');
}

function finishRecordScreen(): void {
	if (recordReturn.value === 'detail' && current.value) void showScreen('detail');
	else showList();
}

async function confirmDiscard(): Promise<boolean> {
	if (confirmPending.value || busy.value) return false;
	confirmPending.value = true;
	try {
		const { canceled } = await dialogs.confirm({ type: 'warning', text: copy.discardConfirm });
		return !canceled && !busy.value;
	} finally {
		confirmPending.value = false;
	}
}

async function leaveRecord(): Promise<void> {
	if (busy.value || confirmPending.value) return;
	if ((recordPrefilled || recordSignature() !== recordBaseline) && !await confirmDiscard()) return;
	returnToHatadyAfterRecord = false;
	finishRecordScreen();
}

async function chooseRecordRecipe(): Promise<void> {
	let recipes: HataskRecipe[];
	try {
		recipes = (await misskeyApi('hatask/recipes/list', { scope: 'mine', sort: 'cooked', limit: 100 })).items.filter(recipe => !recipe.isDraft);
	} catch {
		dialogs.alert({ type: 'error', text: copy.loadFailed });
		return;
	}
	if (!recipes.length) {
		dialogs.alert({ type: 'info', text: copy.noRecordRecipe });
		return;
	}
	const { canceled, result } = await dialogs.select({ title: copy.chooseCookedRecipe, default: recordRecipe.value?.id ?? recipes[0].id, items: recipes.map(recipe => ({ value: recipe.id, label: recipe.title })) });
	if (canceled || result == null) return;
	const chosen = recipes.find(recipe => recipe.id === result) ?? null;
	if (chosen && chosen.id !== recordRecipe.value?.id) record.servings = chosen.servings;
	recordRecipe.value = chosen;
}

async function saveRecord(): Promise<void> {
	if (!recordRecipe.value || busy.value || confirmPending.value) return;
	const cookedAt = new Date(record.cookedAt).getTime();
	if (!Number.isFinite(cookedAt)) {
		dialogs.alert({ type: 'error', text: copy.invalidCookedAt });
		return;
	}
	if (record.visibility === 'specified' && !record.visibleUserIds.length) {
		dialogs.alert({ type: 'error', text: copy.memberRequired });
		return;
	}
	busy.value = true;
	try {
		await misskeyApi('hatask/recipes/cooked/create', {
			recipeId: recordRecipe.value.id,
			cookedAt,
			durationSeconds: typeof record.minutes === 'number' && record.minutes >= 0 ? Math.min(1440, Math.round(record.minutes)) * 60 : null,
			servings: Math.min(50, Math.max(1, Math.round(Number(record.servings) || 1))),
			mealSlot: record.mealSlot,
			cost: typeof record.cost === 'number' && record.cost >= 0 ? Math.round(record.cost) : null,
			memo: record.memo,
			fileId: record.file?.id ?? null,
			visibility: record.visibility,
			visibleUserIds: record.visibility === 'specified' ? record.visibleUserIds : [],
		});
		os.toast(copy.recordSaved, 'ti ti-tools-kitchen-2');
		if (current.value?.id === recordRecipe.value.id) current.value = { ...current.value, cookedCount: current.value.cookedCount + 1 };
		finishRecordScreen();
		if (returnToHatadyAfterRecord) {
			returnToHatadyAfterRecord = false;
			emit('hatadyCookingSaved');
		}
	} catch {
		dialogs.alert({ type: 'error', text: copy.recordSaveFailed });
	} finally {
		busy.value = false;
	}
}

// ===== 作成・編集 =====
const editor = reactive({
	id: null as string | null,
	title: '',
	summary: '',
	category: 'main' as HataskRecipeCategory,
	servings: 2,
	minutes: null as number | null,
	scalable: true,
	tags: '',
	file: null as Photo | null,
	ingredients: [] as { key: number; name: string; amount: string }[],
	steps: [] as EditorStep[],
	referenceLinks: [] as { key: number; title: string; url: string }[],
	visibility: 'private' as HataskRecipeVisibility,
	visibleUserIds: [] as string[],
});
const dragIndex = ref<number | null>(null);

function blankEditor() {
	return {
		id: null, title: '', summary: '', category: 'main' as HataskRecipeCategory, servings: 2, minutes: null, scalable: true, tags: '', file: null,
		ingredients: [{ key: ++rowKey, name: '', amount: '' }],
		steps: [{ key: ++rowKey, text: '', timerSeconds: null, timerLabel: '' }],
		referenceLinks: [],
		visibility: 'private' as HataskRecipeVisibility, visibleUserIds: [],
	};
}

function readDraft(): Partial<typeof editor> | null {
	try {
		const raw = window.localStorage.getItem(DRAFT_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function clearDraft(): void {
	try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* Storage can be unavailable in private windows. */ }
}

function openEditor(recipe: HataskRecipe | null): void {
	returnToHatadyAfterRecord = false;
	if (recipe) {
		Object.assign(editor, {
			id: recipe.id, title: recipe.title, summary: recipe.summary, category: recipe.category, servings: recipe.servings, minutes: recipe.minutes,
			scalable: recipe.scalable, tags: recipe.tags.join(' '), file: recipe.photo,
			ingredients: recipe.ingredients.map(item => ({ key: ++rowKey, ...item })),
			steps: recipe.steps.map(step => ({ key: ++rowKey, ...step })),
			referenceLinks: (recipe.referenceLinks ?? []).map(link => ({ key: ++rowKey, ...link })),
			visibility: recipe.visibility, visibleUserIds: [...recipe.visibleUserIds],
		});
	} else {
		const draft = readDraft();
		Object.assign(editor, blankEditor(), draft ?? {}, { id: null });
		editor.ingredients = editor.ingredients.map(item => ({ ...item, key: ++rowKey }));
		editor.steps = editor.steps.map(step => ({ ...step, key: ++rowKey }));
		editor.referenceLinks = (editor.referenceLinks ?? []).map(link => ({ ...link, key: ++rowKey }));
	}
	void showScreen('edit');
}

let draftTimer: number | null = null;
watch(editor, () => {
	if (screen.value !== 'edit' || editor.id) return;
	if (draftTimer) window.clearTimeout(draftTimer);
	draftTimer = window.setTimeout(() => {
		draftTimer = null;
		try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(editor)); } catch { /* Autosave is a convenience only. */ }
	}, 800);
}, { deep: true });

function leaveEditor(): void {
	if (editor.id && current.value?.id === editor.id) void showScreen('detail');
	else showList();
}

function addIngredient(): void { editor.ingredients.push({ key: ++rowKey, name: '', amount: '' }); }

function addReferenceLink(): void {
	if (editor.referenceLinks.length < 10) editor.referenceLinks.push({ key: ++rowKey, title: '', url: '' });
}

function addStep(): void { editor.steps.push({ key: ++rowKey, text: '', timerSeconds: null, timerLabel: '' }); }

function moveIngredient(index: number, delta: number): void {
	const target = index + delta;
	if (target < 0 || target >= editor.ingredients.length) return;
	const [item] = editor.ingredients.splice(index, 1);
	editor.ingredients.splice(target, 0, item);
	void nextTick(() => {
		const grips = rootEl.value?.querySelectorAll<HTMLButtonElement>('[draggable="true"]');
		grips?.[target]?.focus();
	});
}

function dropIngredient(index: number): void {
	if (dragIndex.value == null || dragIndex.value === index) return;
	const [item] = editor.ingredients.splice(dragIndex.value, 1);
	editor.ingredients.splice(index, 0, item);
	dragIndex.value = null;
}

async function editTimer(step: EditorStep): Promise<void> {
	const time = await dialogs.inputText({ title: copy.timer, text: copy.timerHelp, default: step.timerSeconds ? formatRecipeTimer(step.timerSeconds) : '' });
	if (time.canceled) return;
	const seconds = parseRecipeTimer(time.result ?? '');
	if (seconds == null) {
		if ((time.result ?? '').trim()) dialogs.alert({ type: 'error', text: copy.timerInvalid });
		step.timerSeconds = null;
		step.timerLabel = '';
		return;
	}
	const label = await dialogs.inputText({ title: copy.timerName, text: copy.timerNameHelp, default: step.timerLabel, maxLength: 32 });
	step.timerSeconds = seconds;
	step.timerLabel = label.canceled ? step.timerLabel : (label.result ?? '').trim();
}

async function saveRecipe(isDraft: boolean): Promise<void> {
	if (busy.value || !editor.title.trim()) return;
	if (editor.visibility === 'specified' && !editor.visibleUserIds.length) {
		dialogs.alert({ type: 'error', text: copy.memberRequired });
		return;
	}
	const tags = [...new Set(editor.tags.split(/[\s,、]+/).map(item => item.replace(/^#+/, '').trim()).filter(Boolean))];
	if (tags.length > 10 || tags.some(item => item.length > 32)) {
		dialogs.alert({ type: 'error', text: copy.tagsInvalid });
		return;
	}
	const referenceLinks: { title: string; url: string }[] = [];
	for (const [index, link] of editor.referenceLinks.entries()) {
		const title = link.title.trim();
		if (!title && !link.url.trim()) continue;
		const number = String(index + 1);
		if (title.length > 120) {
			dialogs.alert({ type: 'error', text: i18n.tsx._hata._hatask._recipe.referenceTitleInvalid({ number }) });
			return;
		}
		const url = normalizeRecipeReferenceUrl(link.url);
		if (!url) {
			dialogs.alert({ type: 'error', text: i18n.tsx._hata._hatask._recipe.referenceUrlInvalid({ number }) });
			return;
		}
		referenceLinks.push({ title, url });
	}
	if (referenceLinks.length > 10) {
		dialogs.alert({ type: 'error', text: copy.referenceLimit });
		return;
	}
	const params = {
		referenceLinks,
		title: editor.title.trim(),
		summary: editor.summary,
		category: editor.category,
		servings: Math.min(50, Math.max(1, Math.round(Number(editor.servings) || 1))),
		minutes: typeof editor.minutes === 'number' && editor.minutes >= 0 ? Math.min(1440, Math.round(editor.minutes)) : null,
		scalable: editor.scalable,
		ingredients: editor.ingredients.filter(item => item.name.trim()).map(item => ({ name: item.name, amount: item.amount })),
		steps: editor.steps.filter(step => step.text.trim()).map(step => ({ text: step.text, timerSeconds: step.timerSeconds, timerLabel: step.timerLabel })),
		tags,
		fileId: editor.file?.id ?? null,
		visibility: editor.visibility,
		visibleUserIds: editor.visibility === 'specified' ? editor.visibleUserIds : [],
		isDraft,
	};
	busy.value = true;
	try {
		const saved = editor.id
			? await misskeyApi('hatask/recipes/update', { recipeId: editor.id, ...params })
			: await misskeyApi('hatask/recipes/create', params);
		if (!editor.id) clearDraft();
		os.toast(isDraft ? copy.draftSaved : copy.recipeSaved, 'ti ti-check');
		current.value = saved;
		servings.value = saved.servings;
		void showScreen('detail');
	} catch {
		dialogs.alert({ type: 'error', text: copy.recipeSaveFailed });
	} finally {
		busy.value = false;
	}
}

// ===== 共通 =====
async function pickPhoto(ev: MouseEvent, target: 'record' | 'editor'): Promise<void> {
	let file: Misskey.entities.DriveFile;
	try {
		file = await selectFile({ anchorElement: ev.currentTarget, multiple: false, label: copy.photo });
	} catch {
		return;
	}
	if (!file.type.startsWith('image/')) {
		dialogs.alert({ type: 'error', text: copy.chooseImage });
		return;
	}
	const photo = { id: file.id, url: file.url, thumbnailUrl: file.thumbnailUrl };
	if (target === 'record') record.file = photo; else editor.file = photo;
}

async function addMember(ids: string[]): Promise<void> {
	if (ids.length >= 100) return;
	const user = await pickers.selectUser({ localOnly: true, includeSelf: false });
	if (!user) return;
	memberNames[user.id] = user.name ? `${user.name} (@${user.username})` : `@${user.username}`;
	if (!ids.includes(user.id)) ids.push(user.id);
}

watch(() => [...editor.visibleUserIds, ...record.visibleUserIds], async ids => {
	const missing = ids.filter(id => !memberNames[id]);
	if (!missing.length) return;
	try {
		for (const user of await misskeyApi('users/show', { userIds: missing })) memberNames[user.id] = user.name ? `${user.name} (@${user.username})` : `@${user.username}`;
	} catch { /* Keep IDs removable even if a member can no longer be resolved. */ }
});

watch(() => props.settingsReady && !props.consented, open => {
	if (open) void nextTick(() => consentButton.value?.focus());
}, { immediate: true });

onDeactivated(stopTicker);
onBeforeUnmount(() => {
	stopTicker();
	if (queryTimer) window.clearTimeout(queryTimer);
	if (draftTimer) window.clearTimeout(draftTimer);
});

defineExpose({
	async openById(id: string): Promise<void> {
		// Resolve through the existing permission-checked endpoint before showing
		// data from a search result. The current editing fields stay untouched.
		const recipe = await misskeyApi('hatask/recipes/show', { recipeId: id });
		current.value = recipe;
		servings.value = recipe.servings;
		await showScreen('detail');
	},
	/** Opens the cooking record sheet from Hatask's record menu. */
	openCreate: () => openEditor(null),
	openRecord: () => openRecord(current.value),
	openRecordFromHatady: () => openRecord(null, null, true),
});
</script>

<style lang="scss" module>
.root {
	container-type: inline-size;
	position: relative;
	min-width: 0;
	color: var(--fg);
	font-family: var(--htk-font-body);
	button { font-family: inherit; }
	:global(.ti) { line-height: 1; }
}
.screen { min-width: 0; padding-bottom: 20px; }
.card { border: var(--border); border-radius: var(--card-radius); background: var(--paper); box-shadow: var(--shadow); }
.num { font-family: Archivo, var(--htk-font-body); font-variant-numeric: tabular-nums; }

.pageHead { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding-bottom: 20px; }
.kicker { display: flex; align-items: center; gap: 7px; color: var(--accent-ink); font-size: 12px; font-weight: 700; }
.pageTitle { margin: 5px 0 0; font-family: var(--htk-font-head); font-size: 28px; font-weight: 800; line-height: 1.45; letter-spacing: .02em; color: var(--fg); }
.lede { margin: 5px 0 0; color: var(--fg-2); font-size: 13px; line-height: 1.9; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; }
.listToolbar { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.listActions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.listActions :is(.primary, .secondary) { min-height: 44px; padding: 6px 12px; font-size: 12px; }
.primary, .secondary {
	display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 8px 18px;
	border-radius: var(--control-radius); font-size: 15px; font-weight: 800; line-height: 1.4; cursor: pointer;
	:global(.ti) { font-size: 18px; }
	&:disabled { opacity: .5; cursor: not-allowed; }
}
.primary { padding-inline: 20px; border: 2px solid transparent; background: var(--accent); color: var(--on-accent); box-shadow: var(--shadow); }
.secondary { border: var(--button-border); background: none; color: var(--fg); }
.wide { width: 100%; }
.grow { flex: 1; min-width: 150px; min-height: 52px; font-size: 16px; }
.linkButton { margin-left: 6px; padding: 0; border: 0; background: none; color: var(--accent-ink); font-size: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
.smallButton { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 0 12px; border: var(--button-border); border-radius: var(--control-radius); background: none; color: var(--fg); font-size: 11px; font-weight: 800; cursor: pointer; }
.iconButton { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border: 0; border-radius: var(--control-radius); background: none; color: var(--fg-2); cursor: pointer; :global(.ti) { font-size: 17px; } &:hover, &[aria-pressed='true'] { background: var(--fill-2); color: var(--accent-ink); } }

.empty {
	display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 55px 20px; text-align: center; color: var(--fg-2); border: 1px solid var(--rule);
	> :global(.ti) { font-size: 32px; color: var(--accent-ink); }
	h2 { margin: 0; font-family: var(--htk-font-head); font-size: 17px; font-weight: 700; color: var(--fg); }
	p { max-width: 34ch; margin: 0; font-size: 12px; line-height: 1.9; }
	.actions { justify-content: center; margin-top: 4px; }
}

.seg { display: flex; align-items: center; gap: 2px; width: max-content; max-width: 100%; padding: 4px 6px; border: var(--border); border-radius: var(--case-radius); background: var(--masthead); box-shadow: var(--shadow); overflow-x: auto; }
.segItem, .chip {
	display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 7px 10px;
	border: 1px solid transparent; border-radius: var(--control-radius); background: transparent; color: var(--fg-2); font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer;
	&[aria-pressed='true'] { border-color: var(--rule2); background: var(--fill-2); color: var(--accent-ink); font-weight: 700; }
	:global(.ti) { font-size: 17px; }
}
@container (max-width: 599px) {
	.listToolbar { gap: 4px; }
	.listActions { gap: 4px; flex-wrap: nowrap; }
	.listActions :is(.primary, .secondary) { width: 44px; min-width: 44px; padding: 0; }
	.listActions :is(.primary, .secondary) > span { display: none; }
	.seg { padding-inline: 4px; }
	.segItem { min-width: 44px; box-sizing: border-box; padding-inline: 4px; gap: 4px; font-size: 11px; }
}
.chip > span { font-family: Archivo, sans-serif; font-size: 11px; font-weight: 600; }
.filters { padding: 16px; border: 1px solid var(--rule); }
.searchRow { display: flex; gap: 8px; }
.search {
	display: flex; flex: 1; min-width: 0; align-items: center; gap: 10px; padding-inline: 12px; border: 1px solid var(--rule); border-radius: var(--control-radius); background: var(--fill); color: var(--fg-2);
	input { width: 100%; min-width: 0; height: 44px; border: 0; background: none; color: var(--fg); font: 14px/1.5 var(--htk-font-body); outline: none; }
	&:focus-within { outline: 3px solid var(--accent-ink); outline-offset: 2px; }
}
.iconBox { width: 44px; min-width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--rule); border-radius: var(--control-radius); background: none; color: var(--fg-2); cursor: pointer; }
.chips { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 12px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--rule); }
.tag {
	display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 0 12px; border: var(--button-border); border-radius: var(--control-radius); background: none; color: var(--fg-2); font-size: 11px; font-weight: 800;
	:global(.ti) { font-size: 13px; }
	&[aria-pressed='true'] { border-color: var(--accent-ink); background: var(--fill-2); color: var(--accent-ink); }
}
button.tag { cursor: pointer; }
.detailMain .tags { margin: 0 0 18px; padding: 0; border: 0; }
.listMeta { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 48px; color: var(--fg-2); font-size: 11px; }
.sortButton { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0; border: 0; background: none; color: var(--fg-2); font-size: 11px; cursor: pointer; :global(.ti) { font-size: 13px; } }
.stateNotice { min-height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; margin: 0 0 12px; padding: 16px; border-radius: var(--card-radius); background: var(--fill); color: var(--fg-2); font-size: 12px; line-height: 1.8; text-align: center; }
.stateNotice p { margin: 0; }
.more { display: flex; justify-content: center; margin-top: 16px; }

.grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; min-width: 0; }
@container (min-width: 560px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (min-width: 900px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.recipeCard { display: flex; flex-direction: column; align-items: stretch; padding: 0; overflow: hidden; border: 1px solid var(--rule); border-radius: var(--card-radius); background: var(--paper); box-shadow: var(--shadow); color: var(--fg); text-align: start; cursor: pointer; }
.photo {
	position: relative; display: grid; place-items: center; align-content: center; gap: 4px; height: 132px; overflow: hidden;
	border-bottom: 1px solid var(--rule); background: color-mix(in srgb, var(--accent) 10%, var(--paper)); color: var(--fg-2);
	> :global(.ti) { font-size: 22px; opacity: .55; }
	> span { font-size: 10px; font-weight: 800; letter-spacing: .08em; }
	img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
}
.cardBody { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding: 14px 16px 16px; }
.cardMeta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 5px 9px; color: var(--fg-2); font-size: 10px; .num { margin-left: auto; } }
.cardTitle { font-family: var(--htk-font-head); font-size: 15px; font-weight: 800; line-height: 1.5; color: var(--fg); overflow-wrap: anywhere; }
.cardSummary { margin: 0; color: var(--fg-2); font-size: 11px; line-height: 1.7; overflow-wrap: anywhere; }
.cardFoot {
	display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 6px;
	> span { display: inline-flex; align-items: center; gap: 4px; min-width: 0; color: var(--fg-2); font-size: 10px; }
	:global(.ti) { font-size: 13px; }
}
.cooked { margin-left: auto; color: var(--accent-ink) !important; font-weight: 800; }
.draft { color: var(--accent-ink) !important; font-weight: 800; }
.miniAvatar { width: 18px; height: 18px; flex: none; }

.backRow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding-bottom: 16px; }
.back { display: inline-flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 18px 0 14px; border: var(--button-border); border-radius: var(--control-radius); background: var(--masthead); color: var(--fg); font-size: 14px; font-weight: 800; line-height: 1.4; box-shadow: var(--shadow); cursor: pointer; :global(.ti) { font-size: 19px; } &:disabled { opacity: .5; cursor: not-allowed; } }
.topBar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid var(--rule); }
.barLabel { color: var(--fg-2); font-size: 11px; font-weight: 800; letter-spacing: .08em; }
.screenTitle { margin: 16px 0 6px; font-family: var(--htk-font-head); font-size: 24px; font-weight: 800; line-height: 1.4; color: var(--fg); overflow-wrap: anywhere; }
.screen > .lede { margin: 0 0 18px; }
[data-screen='edit'] .screenTitle { margin-bottom: 18px; }

.detailGrid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; align-items: start; min-width: 0; }
@container (min-width: 640px) { .detailGrid { grid-template-columns: minmax(0, 1.05fr) minmax(300px, .95fr); } }
.detailMain, .detailSide { min-width: 0; }
.detailSide { display: flex; flex-direction: column; gap: 12px; }
.detailPhoto { height: 200px; border: 1px solid var(--rule); border-radius: var(--card-radius); > :global(.ti) { font-size: 30px; opacity: .5; } > span { font-size: 11px; } }
@container (min-width: 640px) { .detailPhoto { height: 300px; } }
.facts, .cookFacts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; color: var(--fg-2); font-size: 11px; > span { display: inline-flex; align-items: center; gap: 5px; } :global(.ti) { font-size: 14px; } }
.facts { margin-top: 16px; }
.detailTitle { margin: 10px 0 6px; font-family: var(--htk-font-head); font-size: 26px; font-weight: 800; line-height: 1.4; color: var(--fg); overflow-wrap: anywhere; }
.author { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; color: var(--fg-2); font-size: 12px; > span:last-child { color: var(--fg-3); } }
.detailSummary { margin: 0 0 18px; color: var(--fg-2); font-size: 13px; line-height: 1.9; overflow-wrap: anywhere; }
.section { padding: 18px 20px; }
.sectionHead { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 12px; margin-bottom: 14px; > span { color: var(--fg-2); font-size: 12px; } }
.sectionTitle { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; font-family: var(--htk-font-head); font-size: 18px; color: var(--fg); :global(.ti) { font-size: 19px; } }
.sectionHead .sectionTitle { margin: 0; }
.formCard .sectionTitle { margin-bottom: 12px; font-size: 16px; :global(.ti) { font-size: 18px; } }
.stepper {
	display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--rule); border-radius: var(--control-radius); background: var(--fill);
	> span { flex: 1; min-width: 0; font-size: 12px; font-weight: 800; color: var(--fg); }
	> strong { min-width: 4.5em; font-family: Archivo, sans-serif; font-variant-numeric: tabular-nums; font-size: 17px; font-weight: 800; text-align: center; color: var(--fg); }
}
.stepBtn { width: 44px; height: 44px; display: grid; place-items: center; border: var(--button-border); border-radius: var(--control-radius); background: none; color: var(--fg); cursor: pointer; :global(.ti) { font-size: 17px; } &:disabled { opacity: .5; cursor: not-allowed; } }
.hint { margin: 10px 0 0; padding: 10px; border-radius: min(var(--card-radius), 10px); background: var(--fill); color: var(--fg-2); font-size: 11px; line-height: 1.8; }
.ingredients {
	margin: 14px 0 0; border-top: 1px solid var(--rule);
	> div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--rule); font-size: 13px; }
	dt { color: var(--fg); overflow-wrap: anywhere; }
	dd { margin: 0; font-family: Archivo, var(--htk-font-body); font-variant-numeric: tabular-nums; font-weight: 800; color: var(--fg); white-space: nowrap; }
}
.steps {
	margin: 0; padding: 0; list-style: none;
	li { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--rule); }
	p { margin: 0; font-size: 13px; line-height: 1.9; color: var(--fg); overflow-wrap: anywhere; }
}
.stepNo { width: 30px; height: 30px; display: grid; place-items: center; border-radius: min(var(--card-radius), 10px); background: var(--fill-2); color: var(--accent-ink); font: 800 13px Archivo, sans-serif; }
.timerTag { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; min-height: 32px; padding: 0 12px; border: 1px solid var(--rule); border-radius: var(--control-radius); background: var(--fill); color: var(--accent-ink); font: 800 11px Archivo, var(--htk-font-body); :global(.ti) { font-size: 14px; } }

.cookFacts { margin-bottom: 18px; font-size: 12px; }
.elapsed { font-family: Archivo, sans-serif; font-variant-numeric: tabular-nums; font-weight: 800; color: var(--accent-ink); :global(.ti) { font-size: 15px; } }
.timerChips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.timerChip {
	display: inline-flex; align-items: center; gap: 7px; min-height: 44px; padding: 0 16px; border: var(--button-border); border-radius: var(--control-radius); background: none; color: var(--fg);
	font: 800 13px Archivo, var(--htk-font-body); font-variant-numeric: tabular-nums; cursor: pointer;
	:global(.ti) { font-size: 17px; color: var(--accent-ink); }
	&[aria-pressed='true'] { border-color: var(--accent); background: var(--accent); color: var(--on-accent); :global(.ti) { color: inherit; } }
}
.cookSteps { display: flex; flex-direction: column; gap: 10px; }
.cookStep {
	width: 100%; display: flex; align-items: flex-start; gap: 13px; padding: 16px 18px; border: 1px solid var(--rule); border-radius: var(--card-radius); background: var(--paper); box-shadow: var(--shadow); color: var(--fg); text-align: start; cursor: pointer;
	&[aria-pressed='true'] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--paper)); opacity: .78; .check { background: var(--accent); color: var(--on-accent); } }
}
.check { width: 24px; height: 24px; margin-top: 3px; flex: none; display: grid; place-items: center; border: var(--button-border); border-radius: 50%; background: transparent; color: transparent; :global(.ti) { font-size: 15px; } }
.cookStepBody {
	flex: 1; min-width: 0;
	> small:first-child { display: block; margin-bottom: 4px; color: var(--fg-2); font: 800 10px Archivo, sans-serif; letter-spacing: .1em; }
	> strong { display: block; font-size: 15px; font-weight: 700; line-height: 1.8; color: var(--fg); overflow-wrap: anywhere; }
}
.cookTimer { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; color: var(--accent-ink); font: 800 11px Archivo, var(--htk-font-body); :global(.ti) { font-size: 14px; } }
.finish {
	position: sticky; bottom: 0; margin-top: 20px; padding: 14px 0 4px; background: linear-gradient(to top, var(--bg, var(--paper)) 60%, transparent);
	.primary { min-height: 52px; font-size: 16px; :global(.ti) { font-size: 20px; } }
	p { margin: 10px 0 0; text-align: center; color: var(--fg-2); font-size: 11px; }
}

.stack { min-width: 0; display: flex; flex-direction: column; gap: 12px; }
.formCard { padding: 16px 18px; }
.recipePick { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid var(--rule); }
.recipeIcon { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border-radius: min(var(--card-radius), 12px); background: var(--fill-2); color: var(--accent-ink); :global(.ti) { font-size: 21px; } }
.recipePickText { flex: 1; min-width: 0; small { display: block; color: var(--fg-2); font-size: 10px; font-weight: 800; letter-spacing: .08em; } strong { display: block; font-family: var(--htk-font-head); font-size: 15px; font-weight: 800; color: var(--fg); overflow-wrap: anywhere; } }
.photoPick { display: flex; align-items: center; gap: 14px; padding-top: 16px; p { margin: 0; color: var(--fg-2); font-size: 12px; line-height: 1.8; } }
.block .photoPick { padding-top: 0; }
.photoSlot {
	position: relative; width: 84px; height: 84px; flex: none; display: grid; place-items: center; align-content: center; gap: 4px; overflow: hidden;
	border: 1px dashed var(--rule2); border-radius: min(var(--card-radius), 14px); background: var(--fill); color: var(--fg-2); cursor: pointer;
	:global(.ti) { font-size: 22px; } small { font-size: 10px; }
	img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
}
.field {
	display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px; align-items: center; padding: 13px 0; border-bottom: 1px solid var(--rule);
	> span:first-child { display: inline-flex; align-items: center; gap: 6px; color: var(--fg-2); font-size: 11px; font-weight: 800; :global(.ti) { font-size: 15px; } }
}
@container (max-width: 599px) { .mealField { grid-template-columns: minmax(0, 1fr); } }
.memo { display: grid; gap: 8px; padding: 14px 0 0; > span { display: inline-flex; align-items: center; gap: 6px; color: var(--fg-2); font-size: 11px; font-weight: 800; :global(.ti) { font-size: 15px; } } }
.input, .textarea {
	width: 100%; min-width: 0; box-sizing: border-box; border: 1px solid var(--rule); background: var(--fill); color: var(--fg); font: 700 13px var(--htk-font-body);
	&:focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 2px; }
}
.input { min-height: 44px; padding: 0 12px; border-radius: var(--control-radius); }
.textarea { min-height: 72px; padding: 12px; border-radius: min(var(--card-radius), 14px); font-weight: 500; line-height: 1.9; resize: vertical; }
.inputWrap { display: flex; align-items: center; gap: 8px; min-width: 0; em { flex: none; color: var(--fg-2); font-size: 12px; font-style: normal; font-weight: 700; } }
.mealChoices { display: flex; align-items: center; gap: 2px; width: max-content; max-width: 100%; min-width: 0; box-sizing: border-box; padding: 4px 6px; border: var(--border); border-radius: var(--case-radius); background: var(--masthead); box-shadow: var(--shadow); overflow-x: auto; }
.mealChip { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: 6px; min-width: 44px; min-height: 44px; padding: 0 10px; border: 1px solid transparent; border-radius: var(--control-radius); background: transparent; color: var(--fg-2); font-size: 12px; font-weight: 800; white-space: nowrap; cursor: pointer; :global(.ti) { font-size: 17px; } &[aria-pressed='true'] { border-color: var(--rule2); background: var(--fill-2); color: var(--accent-ink); } }
.smallTitle { margin: 0 0 12px; font-family: var(--htk-font-head); font-size: 14px; font-weight: 800; color: var(--fg); }
.visChoices { display: flex; flex-wrap: wrap; gap: 6px; }
.visChip {
	display: inline-flex; align-items: center; gap: 7px; min-height: 44px; padding: 0 14px; border: 1px solid var(--rule); border-radius: var(--control-radius); background: transparent; color: var(--fg-2); font-size: 12px; font-weight: 800; cursor: pointer;
	:global(.ti) { font-size: 16px; }
	&[aria-pressed='true'] { border-color: var(--accent-ink); background: var(--accent-ink); color: var(--htk-on-ink, var(--on-accent)); }
}
.members { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 12px; }
.member {
	display: inline-flex; align-items: center; gap: 2px; max-width: 100%; padding-left: 12px; border-radius: var(--control-radius); background: var(--fill-2); color: var(--fg); font-size: 12px; overflow-wrap: anywhere;
	button { width: 36px; height: 36px; flex: none; display: grid; place-items: center; border: 0; border-radius: var(--control-radius); background: none; color: var(--fg-2); cursor: pointer; }
}
.formActions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.stack .formActions { margin-top: 0; }

.editGrid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-items: start; min-width: 0; }
@container (min-width: 900px) { .editGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.formGrid { display: grid; gap: 14px; }
.block { display: grid; gap: 6px; min-width: 0; > span:first-child { color: var(--fg-2); font-size: 11px; font-weight: 800; } .chips { margin-top: 0; gap: 4px; } }
.block .chip { padding-inline: 12px; }
.pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
.formGrid .input { font-size: 14px; }
.switchRow {
	width: 100%; display: flex; align-items: flex-start; gap: 12px; padding: 12px; border: 1px solid var(--rule); border-radius: min(var(--card-radius), 16px); background: transparent; color: var(--fg); text-align: start; cursor: pointer;
	strong { display: block; font-size: 13px; font-weight: 800; color: var(--fg); }
	small { display: block; margin-top: 3px; color: var(--fg-2); font-size: 11px; line-height: 1.7; }
	&[aria-checked='true'] { background: var(--fill-2); }
}
.switch {
	width: 44px; height: 26px; flex: none; display: flex; align-items: center; justify-content: flex-start; box-sizing: border-box; padding: 3px; border-radius: 999px; background: var(--rule2);
	span { width: 20px; height: 20px; border-radius: 999px; background: #fff; }
	[aria-checked='true'] > & { justify-content: flex-end; background: var(--accent); }
}
.ingredientRow {
	display: grid; grid-template-columns: 22px minmax(0, 1fr) 96px 40px; gap: 8px; align-items: center; padding: 6px 0;
	&[data-dragging='true'] { opacity: .5; }
}
.referenceRow { display: grid; grid-template-columns: minmax(0, 1fr) 44px; gap: 8px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--rule); }
.referenceFields { min-width: 0; display: grid; gap: 8px; }
.referenceList { margin: 0; padding-left: 1.2em; li + li { margin-top: 12px; } }
.referenceLink { display: block; overflow-wrap: anywhere; color: var(--accent-ink); line-height: 1.7; span { display: block; color: var(--fg-2); font-size: 12px; } }
.grip { width: 22px; height: 44px; display: grid; place-items: center; padding: 0; border: 0; background: none; color: var(--fg-3); cursor: grab; :global(.ti) { font-size: 17px; } }
.addRow { margin-top: 10px; min-height: 44px; font-size: 13px; :global(.ti) { font-size: 17px; } }
.stepRow { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; gap: 10px; align-items: start; padding: 8px 0; border-bottom: 1px solid var(--rule); }
.stepEdit { min-width: 0; .textarea { min-height: 44px; padding: 10px 12px; font-size: 13px; line-height: 1.8; } }
.stepTools { display: flex; flex-direction: column; }

.overlay { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; padding: 20px; background: color-mix(in srgb, var(--fg) 42%, transparent); }
.dialog {
	width: min(460px, 100%); max-height: 100%; box-sizing: border-box; overflow: auto; padding: 22px; border: var(--border); border-radius: var(--card-radius); background: var(--masthead); box-shadow: var(--shadow);
	p { margin: 0 0 12px; color: var(--fg-2); font-size: 13px; line-height: 1.95; }
	ul { margin: 0 0 14px; padding-left: 1.2em; color: var(--fg-2); font-size: 12px; line-height: 1.95; }
	.formActions { margin-top: 14px; }
}
.dialogKicker { display: flex; align-items: center; gap: 10px; color: var(--accent-ink); font-size: 11px; font-weight: 800; letter-spacing: .08em; :global(.ti) { font-size: 20px; } }
.dialogTitle { margin: 10px 0 12px; font-family: var(--htk-font-head); font-size: 20px; font-weight: 800; line-height: 1.5; color: var(--fg); }

.root :is(button, input, select, textarea):focus-visible { outline: 3px solid var(--accent-ink); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .root * { scroll-behavior: auto !important; } }
</style>
