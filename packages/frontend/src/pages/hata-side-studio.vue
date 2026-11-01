<!--
SPDX-FileCopyrightText: Tolehata and hatasaba-project
SPDX-License-Identifier: AGPL-3.0-only
-->
<template>
<div :class="$style.root" :data-deck-ui="isHatasabaDeckUi ? 'on' : undefined" :data-ui-s="isUiS ? 'true' : undefined" :data-goes-host="inHataGoes ? 'true' : undefined" :style="hk3ThemeContext">
	<header :class="[$style.header, tutorialStep?.target === 'save' && $style.tutorialFocus]">
		<div :class="$style.brand">
			<button v-if="!isHatasabaDeckUi" type="button" class="_button" :class="$style.backButton" :aria-label="copy.back" @click.stop="closeStudio"><i class="ti ti-chevron-left"></i></button>
			<strong :class="$style.logo">HataSideStudio</strong>
		</div>
		<div :class="$style.profileBar" :aria-label="copy.savedProfiles">
			<button v-for="profile in draft.profiles" :key="profile.id" type="button" class="_button" :class="$style.profileTab" :aria-pressed="profile.id === draft.activeProfileId" @click.stop="activateProfile(profile.id)">{{ profileDisplayName(profile.name) }}</button>
			<button type="button" class="_button" :class="$style.profileRename" :aria-label="copy.renameActiveProfile" @click.stop="renameProfile"><i class="ti ti-pencil"></i></button>
			<button type="button" class="_button" :class="$style.profileRename" :disabled="draft.profiles.length <= 1" :aria-label="copy.removeActiveProfile" @click.stop="removeProfile"><i class="ti ti-trash"></i></button>
			<button type="button" class="_button" :class="$style.profileAdd" :disabled="draft.profiles.length >= profileLimit" :aria-label="copyx.addProfileLimit({ limit: profileLimit.toString() })" @click.stop="addProfile"><i class="ti ti-plus"></i></button>
			<span :class="$style.profileLimit">{{ draft.profiles.length }} / {{ profileLimit }}</span>
		</div>
		<div :class="$style.headerActions">
			<span v-if="hasChanges" :class="$style.dirty"><i class="ti ti-device-floppy"></i>{{ copy.unsaved }}</span>
			<div :class="$style.headerControlGroup">
				<div :class="$style.historyActions">
					<div :class="$style.resetWrap">
						<button class="_button" :class="$style.historyButton" :aria-label="copy.restoreDefaults" @click="resetConfirmOpen = !resetConfirmOpen"><i class="ti ti-restore"></i></button>
						<Transition :enterActiveClass="$style.sheetEnterActive" :enterFromClass="$style.sheetEnterFrom" :leaveActiveClass="$style.sheetLeaveActive" :leaveToClass="$style.sheetLeaveTo"><div v-if="resetConfirmOpen" :class="$style.resetConfirm"><b>{{ copy.resetProfileQuestion }}</b><span>{{ copy.notFinalUntilSaved }}</span><div><button class="_button" @click="resetConfirmOpen = false">{{ copy.cancel }}</button><button class="_buttonPrimary" @click="resetProfile">{{ copy.reset }}</button></div></div></Transition>
					</div>
					<button class="_button" :class="$style.historyButton" :disabled="historyIndex <= 0" :aria-label="copy.undo" @click="undo"><i class="ti ti-arrow-back-up"></i></button>
					<button class="_button" :class="$style.historyButton" :disabled="historyIndex >= history.length - 1" :aria-label="copy.redo" @click="redo"><i class="ti ti-arrow-forward-up"></i></button>
				</div>
				<button type="button" class="_button" :class="$style.actionButton" :aria-label="hasChanges ? copy.saveChanges : copy.saved" @click.stop="save"><i class="ti ti-device-floppy"></i><span>{{ hasChanges ? copy.save : copy.saved }}</span></button>
				<button type="button" class="_button" :class="$style.actionButton" :aria-label="copy.showTutorial" @click.stop="startTutorial"><i class="ti ti-help"></i><span>{{ copy.howToUse }}</span></button>
			</div>
		</div>
	</header>

	<main :class="$style.main">
		<section :class="$style.pane" :aria-label="copy.sidebarPreview">
			<div :class="$style.paneHead">
				<div><h2>{{ copy.preview }}</h2><span>{{ previewCount }}</span></div>
				<div :class="$style.previewHeadActions">
					<div :class="$style.copyWrap">
						<button class="_button" :class="$style.copyButton" :aria-expanded="copyMenuOpen" @click="copyMenuOpen = !copyMenuOpen"><i class="ti ti-copy"></i>{{ copy.copyOrder }}<i class="ti ti-chevron-down"></i></button>
						<Transition :enterActiveClass="$style.sheetEnterActive" :enterFromClass="$style.sheetEnterFrom" :leaveActiveClass="$style.sheetLeaveActive" :leaveToClass="$style.sheetLeaveTo"><div v-if="copyMenuOpen" :class="$style.copyMenu">
							<button class="_button" @click="copyLayout('expandedToCollapsed')"><i class="ti ti-layout-sidebar-left-collapse"></i><span><b>{{ copy.expandedToCollapsed }}</b><small>{{ copy.copyButtonsIntoOneColumn }}</small></span></button>
							<button class="_button" @click="copyLayout('collapsedToExpanded')"><i class="ti ti-layout-sidebar-left-expand"></i><span><b>{{ copy.collapsedToExpanded }}</b><small>{{ copy.copyCollapsedOrderToExpanded }}</small></span></button>
							<button class="_button" @click="importCurrentSidebar"><i class="ti ti-list-check"></i><span><b>{{ copy.importCurrentOrder }}</b><small>{{ copy.applyExistingSidebarSettings }}</small></span></button>
						</div></Transition>
					</div>
					<div :class="$style.modeTabs"><button class="_button" :aria-pressed="editMode === 'expanded'" @click="setEditMode('expanded')">{{ copy.expanded }}</button><button class="_button" :aria-pressed="editMode === 'collapsed'" @click="setEditMode('collapsed')">{{ copy.collapsed }}</button></div>
				</div>
			</div>
			<div ref="stageEl" :class="$style.stage">
				<div :class="[$style.sideTools, tutorialStep?.target === 'create' && $style.tutorialFocus]" data-side="left" :aria-label="copy.addMenu">
					<button class="_button" :class="$style.addAction" :disabled="editMode === 'collapsed'" @click="openWidgetPicker"><i class="ti ti-app-window"></i><span>{{ copy.createWidget }}</span></button>
					<button class="_button" :class="$style.addAction" :disabled="editMode === 'collapsed'" @click="addGroup"><i class="ti ti-category-plus"></i><span>{{ copy.createGroup }}</span></button>
					<button class="_button" :class="$style.addAction" @click="openButtonPicker"><i class="ti ti-square-rounded-plus"></i><span>{{ copy.createButton }}</span></button>
				</div>
				<div :class="$style.sideTools" data-side="right">
					<button class="_button" :class="[$style.bulkAction, deleteDropArmed && $style.deleteDropArmed]" :aria-pressed="deleteMode" data-delete-drop @pointerenter="armDeleteDrop" @pointerleave="disarmDeleteDrop" @dragover.prevent="armDeleteDrop" @click="deleteMode = !deleteMode"><i :class="deleteMode ? 'ti ti-check' : 'ti ti-trash-x'"></i><span>{{ dragHintVisible ? copy.moveHereToDelete : deleteMode ? copy.finishEditing : copy.delete }}</span></button>
					<button class="_button" :class="$style.reorderAction" :aria-pressed="reorderOpen" @click="toggleReorder"><i class="ti ti-arrows-sort"></i><span>{{ copy.advancedReorder }}</span></button>
				</div>

				<Teleport to="body">
				<div v-show="!inHataGoes || hataGoesHost?.active.value" :class="$style.teleportTheme" :data-ui-s="isUiS ? 'true' : undefined" :data-goes-host="inHataGoes ? 'true' : undefined" :style="hk3ThemeContext">
				<Transition :enterActiveClass="$style.sheetEnterActive" :enterFromClass="$style.sheetEnterFrom" :leaveActiveClass="$style.sheetLeaveActive" :leaveToClass="$style.sheetLeaveTo">
				<div v-if="buttonPickerOpen" :class="$style.creationPicker">
					<div :class="$style.pickerHead"><strong>{{ copy.createButton }}</strong><button class="_button" @click="buttonPickerOpen = false"><i class="ti ti-x"></i></button></div>
					<label v-if="!inHataGoes">{{ copy.feature }}<select v-model="newButtonMenuId" :class="$style.select"><option v-for="item in availableMenuItems" :key="item.id" :value="item.id">{{ getHataSideStudioMenuDisplayLabel(item.id, item.label) }}</option></select></label>
						<template v-else><label>{{ copy.feature }}<input v-model="buttonSearch" type="search" :class="$style.input" placeholder="機能をさがす"></label><div :class="$style.featureList" role="radiogroup" :aria-label="copy.feature"><button v-for="item in filteredMenuItems" :key="item.id" type="button" class="_button" role="radio" :aria-checked="newButtonMenuId === item.id" @click="newButtonMenuId = item.id"><HataAppNavIcon v-if="hataAppForMenuIcon(item.id, item.icon)" :app="hataAppForMenuIcon(item.id, item.icon)!" :size="22" :monochrome="studioDark"/><i v-else :class="item.icon"></i><span>{{ getHataSideStudioMenuDisplayLabel(item.id, item.label) }}</span><i v-if="newButtonMenuId === item.id" class="ti ti-check"></i></button><p v-if="!filteredMenuItems.length">一致する機能はありません</p></div></template>
					<span v-if="!isUiS">{{ copy.buttonShape }}</span><div v-if="!isUiS" :class="$style.shapePicker"><button v-for="shape in buttonShapes" :key="shape.value" class="_button" :aria-pressed="newButtonShape === shape.value" @click="newButtonShape = shape.value"><span :data-shape="shape.value"></span><small>{{ shape.label }}</small></button></div>
					<div :class="$style.pickerActions"><button class="_button" @click="buttonPickerOpen = false">{{ copy.cancel }}</button><button class="_buttonPrimary" :disabled="!newButtonMenuId || (inHataGoes && !filteredMenuItems.some(item => item.id === newButtonMenuId))" @click="confirmAddButton">{{ copy.add }}</button></div>
				</div>
				</Transition>
				<Transition :enterActiveClass="$style.sheetEnterActive" :enterFromClass="$style.sheetEnterFrom" :leaveActiveClass="$style.sheetLeaveActive" :leaveToClass="$style.sheetLeaveTo">
				<div v-if="widgetPickerOpen" :class="$style.creationPicker">
					<div :class="$style.pickerHead"><strong>{{ copy.createWidget }}</strong><button class="_button" @click="widgetPickerOpen = false"><i class="ti ti-x"></i></button></div>
					<label v-if="!inHataGoes">{{ copy.type }}<select v-model="newWidgetKind" :class="$style.select"><option v-for="widget in availableWidgetChoices" :key="widget.kind" :value="widget.kind">{{ widget.label }}</option></select></label>
					<template v-else><label>{{ copy.type }}<input v-model="widgetSearch" type="search" :class="$style.input" placeholder="機能をさがす"></label><div :class="$style.featureList" role="radiogroup" :aria-label="copy.type"><button v-for="widget in filteredWidgetChoices" :key="widget.kind" type="button" class="_button" role="radio" :aria-checked="newWidgetKind === widget.kind" @click="newWidgetKind = widget.kind"><i :class="widget.icon"></i><span>{{ widget.label }}</span><i v-if="newWidgetKind === widget.kind" class="ti ti-check"></i></button><p v-if="!filteredWidgetChoices.length">一致する機能はありません</p></div></template>
					<div :class="$style.pickerActions"><button class="_button" @click="widgetPickerOpen = false">{{ copy.cancel }}</button><button class="_buttonPrimary" :disabled="inHataGoes && !filteredWidgetChoices.some(item => item.kind === newWidgetKind)" @click="confirmAddWidget">{{ copy.add }}</button></div>
				</div>
				</Transition>
				<Transition :enterActiveClass="$style.sheetEnterActive" :enterFromClass="$style.sheetEnterFrom" :leaveActiveClass="$style.sheetLeaveActive" :leaveToClass="$style.sheetLeaveTo">
				<div v-if="reorderOpen" :class="$style.reorderWindow">
					<div :class="$style.pickerHead"><div><strong>{{ copy.advancedReorder }}</strong><small>{{ copy.moveOneStepWithArrows }}</small></div><button class="_button" :aria-label="copy.close" @click="reorderOpen = false"><i class="ti ti-x"></i></button></div>
					<section v-for="section in reorderSections" :key="section.id" :class="$style.reorderSection" :data-container="section.id">
						<b>{{ section.label }}</b>
						<div v-for="(item, index) in section.items" :key="item.id" :class="$style.reorderRow">
							<i :class="item.icon"></i><span>{{ item.label }}</span>
							<button class="_button" :disabled="index === 0" :aria-label="copyx.moveItemUp({ item: item.label })" @click="moveReorderItem(section.id, index, -1)"><i class="ti ti-arrow-up"></i></button>
							<button class="_button" :disabled="index === section.items.length - 1" :aria-label="copyx.moveItemDown({ item: item.label })" @click="moveReorderItem(section.id, index, 1)"><i class="ti ti-arrow-down"></i></button>
						</div>
					</section>
				</div>
				</Transition>
				<Transition :enterActiveClass="$style.sheetEnterActive" :enterFromClass="$style.sheetEnterFrom" :leaveActiveClass="$style.sheetLeaveActive" :leaveToClass="$style.sheetLeaveTo">
				<div v-if="quickEditorOpen && selected != null" :class="$style.quickEditor">
					<p v-if="isUiS" :class="$style.uiSAppearanceNote">{{ uiSAppearanceNote }}</p>
					<div :class="$style.pickerHead"><div><strong>{{ selected.type === 'group' ? copy.adjustGroupHere : copy.adjustHere }}</strong><small>{{ selectedDisplayName }}</small></div><button class="_button" :aria-label="copy.close" @click="quickEditorOpen = false"><i class="ti ti-x"></i></button></div>
					<template v-if="selected.type === 'group'">
						<label :class="$style.quickField"><span>{{ copy.groupName }}</span><input v-model="selected.name" :class="$style.input" maxlength="80"></label>
						<label :class="$style.check"><input v-model="selected.showName" type="checkbox">{{ copy.showGroupName }}</label>
						<div :class="$style.quickSection"><b>{{ copy.layout }}</b><div :class="$style.layoutPicker"><button class="_button" :aria-pressed="selected.columns === 1 && (isUiS || !selected.masonry)" @click="setGroupLayout(selected, 1, false)"><i class="ti ti-layout-list"></i><span>{{ copy.oneColumn }}</span></button><button class="_button" :disabled="!canSetGroupColumns(selected, 2)" :aria-pressed="selected.columns === 2 && (isUiS || !selected.masonry)" @click="setGroupLayout(selected, 2, false)"><i class="ti ti-layout-grid"></i><span>{{ copy.grid }}</span></button><button class="_button" :disabled="!canSetGroupColumns(selected, 3)" :aria-pressed="selected.columns === 3 && (isUiS || !selected.masonry)" @click="setGroupLayout(selected, 3, false)"><i class="ti ti-layout-grid-add"></i><span>{{ copy.threeColumns }}</span></button><button v-if="!isUiS" class="_button" :disabled="!canSetGroupColumns(selected, Math.max(2, selected.columns) as 2 | 3)" :aria-pressed="selected.masonry" @click="setGroupLayout(selected, Math.max(2, selected.columns) as 2 | 3, true)"><i class="ti ti-layout-board-split"></i><span>{{ copy.masonry }}</span></button></div><small v-if="groupHasLargeItems(selected)">{{ copy.largeItemsPreventMultipleColumns }}</small></div>
						<div v-if="!isUiS" :class="$style.quickColors"><label>{{ copy.background }}<input type="color" :value="cssColor(selected.background)" @input="selected.background = ($event.target as HTMLInputElement).value"></label><label>{{ copy.border }}<input type="color" :value="cssColor(selected.border)" @input="selected.border = ($event.target as HTMLInputElement).value"></label></div>
					</template>
					<template v-else>
						<div v-if="!isUiS" :class="$style.quickSection"><b>{{ copy.shape }}</b><div :class="$style.shapePicker"><button v-for="shape in buttonShapes" :key="shape.value" class="_button" :aria-pressed="selected.shape === shape.value" @click="selected.shape = shape.value"><span :data-shape="shape.value"></span><small>{{ shape.label }}</small></button></div></div>
						<div v-if="editMode === 'expanded'" :class="$style.quickSection"><b>{{ copy.size }}</b><div :class="$style.choiceRow"><button v-for="size in sizes" :key="size.value" class="_button" :disabled="!canSetNodeSize(selected, size.value)" :data-active="selected.size === size.value" @click="setNodeSize(selected, size.value)">{{ size.label }}</button></div><small v-if="selectedParentColumns > 1">{{ copy.largeUnavailableInMultipleColumns }}</small></div>
						<label v-if="selected.type === 'button' && editMode === 'expanded'" :class="$style.check"><input v-model="selected.showLabel" type="checkbox">{{ copy.showLabel }}</label>
						<label v-if="!isUiS && selected.type === 'button' && editMode === 'expanded'" :class="$style.field"><span>{{ copy.rotation }}</span><input v-model.number="selected.rotation" type="range" min="-12" max="12" step="1"><output>{{ selected.rotation }}°</output></label>
						<label v-if="!isUiS && selected.type === 'button' && editMode === 'collapsed'" :class="$style.check"><input v-model="selected.borderVisible" type="checkbox">{{ copy.showBorder }}</label>
						<div v-if="!isUiS" :class="$style.quickColors"><label>{{ copy.background }}<input type="color" :value="cssColor(selected.background)" @input="selected.background = ($event.target as HTMLInputElement).value"></label><label>{{ copy.border }}<input type="color" :value="cssColor(selected.border)" @pointerdown="promptCollapsedBorderVisibility(selected, $event)" @keydown.enter.prevent="promptCollapsedBorderVisibility(selected, $event)" @input="selected.border = ($event.target as HTMLInputElement).value"></label><label>{{ copy.text }}<input type="color" :value="cssColor(selected.foreground)" @input="selected.foreground = ($event.target as HTMLInputElement).value"></label></div>
					</template>
					<label v-if="!isUiS" :class="$style.field"><span>{{ copy.border }}</span><input v-model.number="selected.borderWidth" type="range" min="0" max="5"><output>{{ selected.borderWidth }}px</output></label>
					<label v-if="!isUiS" :class="$style.quickField"><span>{{ copy.borderStyle }}</span><select v-model="selected.borderStyle" :class="$style.select"><option value="solid">{{ copy.solid }}</option><option value="dashed">{{ copy.dashed }}</option><option value="double">{{ copy.double }}</option></select></label>
					<GradientEditor v-if="!isUiS" :modelValue="selected"/>
					<div :class="$style.pickerActions"><button class="_button" @click="quickEditorOpen = false">{{ copy.close }}</button><button class="_buttonPrimary" @click="openSelectedInspector"><i class="ti ti-adjustments-horizontal"></i>{{ copy.advancedSettings }}</button></div>
				</div>
				</Transition>
				<div v-if="dragHintVisible" :class="$style.dragHint" :style="dragHintStyle"><i class="ti ti-hand-move"></i><span>{{ copy.dragTimelineHint }}</span></div>
				<aside v-if="dragHintVisible" :class="$style.dragTimeline" :style="dragTimelineStyle" :aria-label="copy.dragTimelineAria" @pointerleave="timelineDropTarget = null">
					<div :class="$style.dragTimelineHead"><i class="ti ti-timeline"></i><span><b>{{ copy.order }}</b><small>{{ copy.dropAtDesiredPosition }}</small></span></div>
					<button class="_button" :class="[$style.dragTimelineDelete, deleteDropArmed && $style.deleteDropArmed]" data-delete-drop @pointerenter="armDeleteDrop" @pointerleave="disarmDeleteDrop" @dragover.prevent="armDeleteDrop"><i class="ti ti-trash-x"></i><span><b>{{ copy.delete }}</b><small>{{ copy.dropHere }}</small></span></button>
					<section v-for="section in dragTimelineSections" :key="section.id" :class="$style.dragTimelineSection" :data-container="section.id">
						<strong @pointerenter="timelineDropTarget = null">{{ section.label }}</strong>
						<button class="_button" :class="$style.dragTimelineGap" :aria-disabled="!canUseTimelineContainer(section.id)" :data-disabled="!canUseTimelineContainer(section.id) ? 'true' : undefined" data-timeline-drop :data-container-id="section.id" :data-index="0" :data-active="timelineDropTarget?.containerId === section.id && timelineDropTarget?.index === 0" @pointerenter="armTimelineDrop(section.id, 0)" @dragover.prevent="armTimelineDrop(section.id, 0)"><i class="ti ti-plus"></i><span>{{ copy.insertAtStart }}</span></button>
						<template v-for="(entry, index) in section.items" :key="entry.id">
							<div :class="$style.dragTimelineItem" @pointerenter="timelineDropTarget = null"><i :class="entry.icon"></i><span>{{ entry.label }}</span></div>
							<button class="_button" :class="$style.dragTimelineGap" :aria-disabled="!canUseTimelineContainer(section.id)" :data-disabled="!canUseTimelineContainer(section.id) ? 'true' : undefined" data-timeline-drop :data-container-id="section.id" :data-index="index + 1" :data-active="timelineDropTarget?.containerId === section.id && timelineDropTarget?.index === index + 1" @pointerenter="armTimelineDrop(section.id, index + 1)" @dragover.prevent="armTimelineDrop(section.id, index + 1)"><i class="ti ti-plus"></i><span>{{ index === section.items.length - 1 ? copy.insertAtEnd : copy.insertInGap }}</span></button>
						</template>
					</section>
				</aside>
				</div>
				</Teleport>

				<div ref="sidebarPreviewEl" :class="[$style.sidebarPreview, editMode === 'expanded' && activeProfile.expanded.width === 'wide' && $style.sidebarPreviewWide, editMode === 'collapsed' && $style.sidebarPreviewCollapsed, tutorialStep?.target === 'arrange' && $style.tutorialFocus]">
					<div :class="$style.serverRow">
						<button class="_button" :class="$style.serverIcon" :aria-label="copy.serverMenu"><img v-if="instance.iconUrl" :src="instance.iconUrl"><i v-else class="ti ti-server"></i></button>
						<div v-if="!isUiS && editMode === 'expanded'" :class="$style.serverName"><small>{{ copy.thisIs }}</small><b>{{ instance.name ?? 'Hataskey' }}</b></div>
						<button v-if="!isUiS && editMode === 'expanded'" class="_button" :class="$style.serverAction" :aria-label="copy.timelineSettings"><i class="ti ti-adjustments"></i></button>
						<button v-if="!isUiS" class="_button" :class="$style.serverAction" :aria-label="editMode === 'expanded' ? copy.collapseMenu : copy.expandMenu" @click="togglePreviewWidth"><i :class="editMode === 'expanded' ? 'ti ti-chevron-left' : 'ti ti-chevron-right'"></i></button>
					</div>
					<div :class="$style.customArea" :data-parallax="!isUiS && activeProfile.expanded.parallax ? 'on' : 'off'">
						<draggable v-if="editMode === 'expanded'" v-model="activeProfile.expanded.nodes" itemKey="id" :group="expandedDragGroup" handle=".hssDrag" :move="allowExpandedMove" :animation="180" :fallbackOnBody="true" :forceFallback="isTouch" :delay="isTouch ? 140 : 0" :delayOnTouchOnly="true" :class="$style.expandedNodes" :style="{ '--hss-normal-columns': String(activeProfile.expanded.columns) }" @start="onDragStart" @end="onDragEnd">
							<template #item="{ element: node }">
								<div :class="[$style.previewNode, node.type === 'group' && $style.previewGroup, node.type === 'widget' && $style.previewWidget]" :style="nodeStyle(node)" :data-node-id="node.id" :data-group-id="node.type === 'group' ? node.id : undefined" :data-shape="!isUiS && node.type !== 'group' ? node.shape : undefined" :data-size="node.type !== 'group' ? node.size : undefined" :data-selected="selectedId === node.id" :data-masonry="!isUiS && node.type === 'group' && node.masonry ? 'on' : undefined" @click.stop="selectNode(node.id)">
									<div v-if="node.type === 'group'" :class="$style.groupHead" :data-show-name="node.showName ? 'true' : undefined">
						<span v-if="node.showName">{{ getHataSideStudioGroupDisplayName(node.name) }}</span>
										<div>
											<button v-if="groupContrastWarnings.get(node.id)?.low" class="_button" :class="$style.contrastWarning" :aria-expanded="contrastPopoverGroupId === node.id" :aria-label="copy.adjustTextReadability" @click.stop="toggleContrastPopover(node.id)"><i class="ti ti-contrast"></i></button>
											<button class="_button" :aria-label="copy.editGroup" @click.stop="openQuickEditor(node.id)"><i class="ti ti-settings"></i></button>
											<button class="_button hssDrag" :class="$style.dragHandle" :aria-label="copy.moveGroup"><i class="ti ti-grip-vertical"></i></button>
										</div>
									</div>
									<div v-if="contrastPopoverGroupId === node.id && groupContrastWarnings.get(node.id)?.low" :class="$style.contrastPopover" @click.stop>
										<header><i class="ti ti-eye-check"></i><b>{{ copy.lowContrastColors }}</b><button class="_button" :aria-label="copy.close" @click="contrastPopoverGroupId = null"><i class="ti ti-x"></i></button></header>
										<p>{{ copyx.minimumContrast({ ratio: groupContrastWarnings.get(node.id)?.minimumRatio.toFixed(1) ?? '0' }) }}</p>
										<div><button class="_buttonPrimary" @click="applyGroupTextColor(node, groupContrastWarnings.get(node.id)?.recommended ?? '#111111')"><i class="ti ti-wand"></i>{{ copy.applyRecommendedColor }}</button><label>{{ copy.customColor }}<input type="color" :value="cssColor(node.foreground)" @input="applyGroupTextColor(node, ($event.target as HTMLInputElement).value)"></label></div>
									</div>
									<draggable v-if="node.type === 'group'" v-model="node.children" itemKey="id" :group="groupChildDragGroup" handle=".hssDrag" :move="allowGroupChildMove" :animation="180" :fallbackOnBody="true" :forceFallback="isTouch" :delay="isTouch ? 180 : 0" :delayOnTouchOnly="true" :class="$style.groupGrid" :data-empty="node.children.length === 0 ? 'true' : undefined" :style="{ '--hss-columns': String(node.columns) }" @start="onDragStart" @end="onDragEnd">
										<template #item="{ element: child }">
											<div :class="child.type === 'button' ? $style.previewButton : $style.previewWidget" :data-node-id="child.id" :data-menu-id="child.type === 'button' ? child.menuId : undefined" :data-shape="isUiS ? undefined : child.shape" :data-size="child.size" :data-brand="child.type === 'button' && isBrandMenu(child.menuId) ? 'true' : undefined" :data-selected="selectedId === child.id" :style="nodeStyle(child)" @click.stop="selectNode(child.id)">
												<ButtonPreview v-if="child.type === 'button'" :button="child" @search="runPreviewSearch"/>
												<WidgetPreview v-else :widget="child"/>
												<button class="_button hssDrag" :class="$style.dragHandle" :aria-label="copy.moveItem"><i class="ti ti-grip-vertical"></i></button>
												<button v-if="!deleteMode" class="_button" :class="$style.quickTrigger" :aria-label="copy.editHere" @click.stop="openQuickEditor(child.id)"><i class="ti ti-pencil"></i></button>
												<button v-if="deleteMode" class="_button" :class="$style.deleteItem" :aria-label="copy.delete" @click.stop="requestRemoveNode(child.id)"><i class="ti ti-x"></i></button>
											</div>
										</template>
									</draggable>
									<div v-else-if="node.type === 'button'" :class="$style.previewButton" :data-menu-id="node.menuId" :data-shape="isUiS ? undefined : node.shape" :data-size="node.size" :data-brand="isBrandMenu(node.menuId) ? 'true' : undefined"><ButtonPreview :button="node" @search="runPreviewSearch"/></div>
									<div v-else><WidgetPreview :widget="node"/></div>
									<button v-if="node.type !== 'group'" class="_button hssDrag" :class="$style.dragHandle" :aria-label="node.type === 'button' ? copy.moveItem : copy.moveWidget"><i class="ti ti-grip-vertical"></i></button>
									<button v-if="node.type !== 'group' && !deleteMode" class="_button" :class="$style.quickTrigger" :aria-label="copy.editHere" @click.stop="openQuickEditor(node.id)"><i class="ti ti-pencil"></i></button>
									<button v-if="deleteMode" class="_button" :class="$style.deleteItem" :aria-label="copy.delete" @click.stop="requestRemoveNode(node.id)"><i class="ti ti-x"></i></button>
								</div>
							</template>
						</draggable>
						<draggable v-else v-model="activeProfile.collapsed.buttons" itemKey="id" handle=".hssDrag" :animation="180" :fallbackOnBody="true" :forceFallback="isTouch" :delay="isTouch ? 180 : 0" :delayOnTouchOnly="true" :class="$style.collapsedButtons" @start="onDragStart" @end="onDragEnd">
						<template #item="{ element: button }"><div class="_button hssDrag" :class="$style.collapsedButton" :data-node-id="button.id" :data-shape="isUiS ? undefined : button.shape" :data-selected="selectedId === button.id" :style="nodeStyle(button)" role="button" tabindex="0" :aria-label="getHataSideStudioMenuDisplayLabel(button.menuId, button.label)" @click.stop="selectNode(button.id)" @keydown.enter.stop="selectNode(button.id)"><HataAppNavIcon v-if="hataAppForMenuIcon(button.menuId, button.icon)" :app="hataAppForMenuIcon(button.menuId, button.icon)!" :size="20" :monochrome="studioDark"/><i v-else :class="button.icon"></i><button v-if="!deleteMode" class="_button" :class="$style.quickTrigger" :aria-label="copy.editHere" @click.stop="openQuickEditor(button.id)"><i class="ti ti-pencil"></i></button><button v-if="deleteMode" class="_button" :class="$style.deleteItem" :aria-label="copy.delete" @click.stop="requestRemoveNode(button.id)"><i class="ti ti-x"></i></button></div></template>
						</draggable>
					</div>
					<div v-if="!isUiS" :class="$style.fixedArea"><button class="_button"><i class="ti ti-dots"></i><span v-if="editMode === 'expanded'">{{ copy.more }}</span></button><button class="_button"><i class="ti ti-settings"></i><span v-if="editMode === 'expanded'">{{ copy.settings }}</span></button><button class="_button"><i class="ti ti-bolt"></i><span v-if="editMode === 'expanded'">{{ copy.realtime }}</span></button><button v-if="$i?.isAdmin || $i?.isModerator" class="_button"><i class="ti ti-dashboard"></i><span v-if="editMode === 'expanded'">{{ copy.controlPanel }}</span></button></div>
					<div v-if="!isUiS" :class="$style.bottomArea">
						<button class="_button" :class="$style.postButton" :style="postButtonStyle(activeProfile.postButton)"><i :class="postButtonIconClass(activeProfile.postButton.icon)"></i><span v-if="editMode === 'expanded'">{{ copy.note }}</span></button>
						<div :class="$style.modeToggle" :aria-label="copy.displayMode"><button class="_button" :aria-pressed="editMode === 'expanded'" :aria-label="copy.normalView" @click="setEditMode('expanded')"><i class="ti ti-device-mobile"></i></button><button class="_button" :aria-pressed="editMode === 'collapsed'" :aria-label="copy.deckView" @click="setEditMode('collapsed')"><i class="ti ti-layout-columns"></i></button></div>
						<button class="_button" :class="$style.accountButton"><img v-if="$i?.avatarUrl" :src="$i.avatarUrl"><i v-else class="ti ti-user-circle"></i><span v-if="editMode === 'expanded'"><b>{{ $i?.name || $i?.username || copy.account }}</b><small>@{{ $i?.username }}</small></span></button>
					</div>
					<div v-else :class="$style.uiSFooter" :data-collapsed="editMode === 'collapsed' ? 'true' : undefined">
						<button v-if="uiSPreviewDeck" type="button" class="_button" :class="$style.uiSPost" :aria-label="copy.note"><component :is="activeProfile.postButton.icon === 'paw' ? PawPrint : Pencil" :size="20"/></button>
						<div :class="$style.uiSFooterTrio">
							<button type="button" class="_button" :aria-label="$i?.isAdmin ? copy.controlPanel : uiSCopy.editSideMenu"><component :is="$i?.isAdmin ? Gauge : PanelsTopLeft" :size="18"/></button>
							<button type="button" class="_button" :aria-label="hk3ThemeContext?.['color-scheme'] === 'dark' ? uiSCopy.lightMode : uiSCopy.darkMode"><component :is="hk3ThemeContext?.['color-scheme'] === 'dark' ? Sun : Moon" :size="18"/></button>
							<button type="button" class="_button" :aria-label="copy.settings"><Settings :size="18"/></button>
						</div>
						<div :class="$style.uiSFooterPair" :aria-label="copy.displayMode">
							<button type="button" class="_button" :aria-label="copy.normalView" :aria-pressed="!uiSPreviewDeck" @click="uiSPreviewDeck = false"><RectangleVertical :size="18"/></button>
							<button type="button" class="_button" :aria-label="copy.deckView" :aria-pressed="uiSPreviewDeck" @click="uiSPreviewDeck = true"><Columns3 :size="18"/></button>
						</div>
						<button type="button" class="_button" :class="$style.uiSAccount" :aria-label="copy.account"><img v-if="$i?.avatarUrl" :src="$i.avatarUrl" alt=""><i v-else class="ti ti-user-circle"></i><span v-if="editMode === 'expanded'">@{{ $i?.username }}</span></button>
					</div>
				</div>
				<p v-if="editMode === 'collapsed'" :class="$style.collapsedNotice"><i class="ti ti-info-circle"></i>{{ copy.collapsedMenuNotice }}</p>
			</div>
		</section>

		<section ref="inspectorPaneEl" :class="[$style.pane, inspectorAttention && $style.inspectorAttention, tutorialStep?.target === 'customize' && $style.tutorialFocus]" :aria-label="copy.studioSettingsAria" tabindex="-1">
			<div :class="$style.paneHead"><div><h2>{{ copy.studioSettings }}</h2><span>{{ selected?.type === 'button' ? copy.button : selected?.type === 'widget' ? copy.widget : selected?.type === 'group' ? copy.group : copy.overall }}</span></div></div>
			<div :class="$style.inspector">
				<div :class="$style.selectedSummary"><HataAppNavIcon v-if="selected?.type === 'button' && hataAppForMenuIcon(selected.menuId, selected.icon)" :app="hataAppForMenuIcon(selected.menuId, selected.icon)!" :size="24" :monochrome="studioDark"/><i v-else :class="selected?.type === 'button' ? selected.icon : selected?.type === 'group' ? 'ti ti-category' : selected?.type === 'widget' ? 'ti ti-app-window' : 'ti ti-layout-sidebar-left'"></i><div><b><HataAppWordmark v-if="selected?.type === 'button' && hataAppForMenuLabel(selected.menuId, selectedDisplayName, selected.icon)" :app="hataAppForMenuLabel(selected.menuId, selectedDisplayName, selected.icon)!" :onDark="studioDark"/><template v-else>{{ selectedDisplayName }}</template></b><small>{{ copy.selectPreviewItemHint }}</small></div></div>
				<p v-if="isUiS" :class="$style.uiSAppearanceNote">{{ uiSAppearanceNote }}</p>
				<nav :class="$style.inspectorTabs"><button class="_button" :aria-pressed="inspectorTab === 'layout'" @click="inspectorTab = 'layout'">{{ copy.placement }}</button><button class="_button" :disabled="selected?.type !== 'button'" :aria-pressed="inspectorTab === 'button'" @click="inspectorTab = 'button'">{{ copy.button }}</button><button class="_button" :disabled="selected?.type !== 'widget'" :aria-pressed="inspectorTab === 'widget'" @click="inspectorTab = 'widget'">{{ copy.widget }}</button><button class="_button" :disabled="selected?.type !== 'group'" :aria-pressed="inspectorTab === 'group'" @click="inspectorTab = 'group'">{{ copy.group }}</button><button class="_button" :aria-pressed="inspectorTab === 'role'" @click="inspectorTab = 'role'">{{ copy.limits }}</button></nav>

				<div v-if="inspectorTab === 'layout'" :class="$style.bento">
					<InspectorCard :title="copy.menuToEdit"><div :class="$style.choiceRow"><button class="_button" :data-active="editMode === 'expanded'" @click="setEditMode('expanded')">{{ copy.expanded }}</button><button class="_button" :data-active="editMode === 'collapsed'" @click="setEditMode('collapsed')">{{ copy.collapsed }}</button></div></InspectorCard>
					<InspectorCard :title="copy.normalMenuColumns"><div :class="$style.choiceRow"><button v-for="columns in [1, 2, 3]" :key="columns" class="_button" :disabled="!canSetRootColumns(columns as 1 | 2 | 3)" :data-active="activeProfile.expanded.columns === columns" @click="setRootColumns(columns as 1 | 2 | 3)">{{ copyx.columnCount({ count: columns.toString() }) }}</button></div><small v-if="rootHasLargeItems">{{ copy.largeItemsPreventMultipleColumns }}</small></InspectorCard>
					<InspectorCard :title="copy.sidebarWidth"><div :class="$style.choiceRow"><button class="_button" :data-active="activeProfile.expanded.width === 'normal'" @click="activeProfile.expanded.width = 'normal'">{{ copy.currentSize }}</button><button class="_button" :data-active="activeProfile.expanded.width === 'wide'" @click="activeProfile.expanded.width = 'wide'">{{ copy.wide }}</button></div><small>{{ copy.appliesToPreviewAndPcSidebar }}</small></InspectorCard>
					<InspectorCard :title="copy.existingSettings"><button class="_button" :class="$style.currentSettingsButton" @click="importCurrentSidebar"><i class="ti ti-list-check"></i>{{ copy.importCurrentOrder }}</button><small>{{ copy.applyConfiguredVisibilityOrder }}</small></InspectorCard>
					<InspectorCard v-if="!isUiS" :title="copy.motion"><label :class="$style.check"><input v-model="activeProfile.expanded.parallax" type="checkbox">{{ copy.parallaxBeta }}</label><small>{{ copy.disabledWithReducedMotion }}</small></InspectorCard>
					<InspectorCard :title="copy.noteButtonCustomization">
						<small>{{ copy.noteButtonCustomizationDescription }}</small>
						<label :class="$style.field"><span>{{ copy.noteButtonIcon }}</span><span :class="$style.choiceRow"><button class="_button" :data-active="activeProfile.postButton.icon === 'pencil'" @click="activeProfile.postButton.icon = 'pencil'"><i class="ti ti-pencil"></i>{{ copy.pencilIcon }}</button><button class="_button" :data-active="activeProfile.postButton.icon === 'paw'" @click="activeProfile.postButton.icon = 'paw'"><i class="ti ti-paw"></i>{{ copy.pawIcon }}</button></span></label>
						<div v-if="!isUiS" :class="$style.colorGrid"><label :class="$style.colorField"><span>{{ copy.background }}</span><input type="color" :value="cssColor(activeProfile.postButton.background)" @input="activeProfile.postButton.background = ($event.target as HTMLInputElement).value"></label><label :class="$style.colorField"><span>{{ copy.text }}</span><input type="color" :value="cssColor(activeProfile.postButton.foreground)" @input="activeProfile.postButton.foreground = ($event.target as HTMLInputElement).value"></label></div>
						<GradientEditor v-if="!isUiS" :modelValue="activeProfile.postButton"/>
					</InspectorCard>
					<InspectorCard :title="copy.collapsedMenuRules"><p>{{ copy.collapsedMenuRulesDescription }}</p></InspectorCard>
				</div>
				<template v-else-if="inspectorTab === 'button' && selected?.type === 'button'">
					<InspectorTitle icon="ti ti-square-rounded" :title="getHataSideStudioMenuDisplayLabel(selected.menuId, selected.label)" :subtitle="copy.button"/>
					<div :class="$style.bento">
						<InspectorCard v-if="editMode === 'expanded'" :title="copy.location"><select :value="selectedParentGroupId" :class="$style.select" @change="moveSelectedTo(($event.target as HTMLSelectElement).value)"><option value="">{{ copy.normalMenu }}</option><option v-for="group in availableGroups" :key="group.id" :value="group.id">{{ getHataSideStudioGroupDisplayName(group.name) }}</option></select></InspectorCard>
						<InspectorCard v-if="!isUiS" :title="copy.shape"><div :class="$style.choiceRow"><button v-for="shape in buttonShapes" :key="shape.value" class="_button" :data-active="selected.shape === shape.value" @click="selected.shape = shape.value"><span :class="$style.shapeSample" :data-shape="shape.value"></span><small>{{ shape.label }}</small></button></div></InspectorCard>
						<InspectorCard :title="copy.size"><div :class="$style.choiceRow"><button v-for="size in sizes" :key="size.value" class="_button" :disabled="!canSetNodeSize(selected, size.value)" :data-active="selected.size === size.value" @click="setNodeSize(selected, size.value)">{{ size.label }}</button></div><small v-if="selectedParentColumns > 1">{{ copy.largeUnavailableInMultipleColumns }}</small></InspectorCard>
						<InspectorCard v-if="editMode === 'expanded'" :title="copy.display"><label :class="$style.check"><input v-model="selected.showLabel" type="checkbox">{{ copy.showTextUnderIcon }}</label><label v-if="!isUiS" :class="$style.field">{{ copy.rotation }} <input v-model.number="selected.rotation" type="range" min="-12" max="12" step="1"><output>{{ selected.rotation }}°</output></label></InspectorCard>
						<AppearanceEditor v-if="!isUiS" v-model="selected" :collapsedButton="editMode === 'collapsed'"/>
						<InspectorCard v-if="selected.menuId === 'lists' || selected.menuId === 'antennas'" :title="copy.directOpenItem"><button class="_buttonPrimary" @click="chooseDirectTarget(selected)"><i class="ti ti-list-search"></i>{{ selected.targetId ? copy.chooseAgain : copy.choose }}</button><small>{{ selected.targetId ? copy.opensSpecifiedItem : copy.opensLastItemWhenUnspecified }}</small></InspectorCard>
					</div>
				</template>
				<template v-else-if="inspectorTab === 'widget' && selected?.type === 'widget'">
					<InspectorTitle icon="ti ti-app-window" :title="widgetDisplayLabel(selected.kind, selected.label)" :subtitle="copy.widget"/>
					<div :class="$style.bento">
						<InspectorCard :title="copy.location"><select :value="selectedParentGroupId" :class="$style.select" @change="moveSelectedTo(($event.target as HTMLSelectElement).value)"><option value="">{{ copy.outsideGroup }}</option><option v-for="group in availableGroups" :key="group.id" :value="group.id">{{ getHataSideStudioGroupDisplayName(group.name) }}</option></select></InspectorCard>
						<InspectorCard :title="copy.type"><select :value="selected.kind" :class="$style.select" @change="changeWidgetKind(selected, ($event.target as HTMLSelectElement).value as HataSideWidgetKind)"><option v-for="widget in availableWidgetChoices" :key="widget.kind" :value="widget.kind">{{ widget.label }}</option></select></InspectorCard>
						<InspectorCard :title="copy.currentSizeLabel"><div :class="$style.choiceRow"><button v-for="size in sizes" :key="size.value" class="_button" :disabled="!canSetNodeSize(selected, size.value)" :data-active="selected.size === size.value" @click="setNodeSize(selected, size.value)">{{ size.label }}</button></div><small>{{ selectedParentColumns > 1 ? copy.largeUnavailableInMultipleColumns : copy.previewAndSidebarChangeTogether }}</small></InspectorCard>
						<InspectorCard v-if="widgetBaseSettingEntries(selected).length > 0" :title="copy.widgetContent">
							<template v-for="entry in widgetBaseSettingEntries(selected)" :key="entry.key">
								<label v-if="entry.type === 'boolean'" :class="$style.check"><input type="checkbox" :checked="entry.value === true" @change="setWidgetBaseSetting(selected, entry.key, ($event.target as HTMLInputElement).checked)">{{ entry.label }}</label>
								<label v-else-if="entry.type === 'multiline'" :class="$style.quickField"><span>{{ entry.label }}</span><textarea :class="$style.textarea" :value="String(entry.value ?? '')" rows="5" @input="setWidgetBaseSetting(selected, entry.key, ($event.target as HTMLTextAreaElement).value)"></textarea></label>
								<label v-else :class="$style.quickField"><span>{{ entry.label }}</span><input :class="$style.input" :value="String(entry.value ?? '')" @input="setWidgetBaseSetting(selected, entry.key, ($event.target as HTMLInputElement).value)"></label>
							</template>
						</InspectorCard>
						<InspectorCard v-for="size in sizes" :key="size.value" :title="copyx.sizeSpecificSettings({ size: size.label })">
							<label :class="$style.field"><span>{{ copy.minimumHeight }}</span><input v-model.number="selected.sizeSettings[size.value].minHeight" type="range" min="48" max="520" step="4"><output>{{ selected.sizeSettings[size.value].minHeight }}px</output></label>
							<small>{{ copy.contentGrowsWithoutClipping }}</small>
							<template v-for="entry in widgetSizeSettingEntries(selected, size.value)" :key="entry.key">
									<label v-if="entry.type === 'boolean'" :class="$style.check"><input type="checkbox" :checked="entry.value === true" @change="setWidgetSizeSetting(selected, size.value, entry.key, ($event.target as HTMLInputElement).checked)">{{ entry.label }}</label>
								<label v-else-if="entry.type === 'number'" :class="$style.field"><span>{{ entry.label }}</span><input type="number" :value="entry.value" @input="setWidgetSizeSetting(selected, size.value, entry.key, Number(($event.target as HTMLInputElement).value))"></label>
								<label v-else :class="$style.quickField"><span>{{ entry.label }}</span><input :class="$style.input" :value="entry.value" @input="setWidgetSizeSetting(selected, size.value, entry.key, ($event.target as HTMLInputElement).value)"></label>
							</template>
							<small v-if="widgetSizeSettingEntries(selected, size.value).length === 0">{{ copy.onlyMinimumHeightAdjustable }}</small>
						</InspectorCard>
						<AppearanceEditor v-if="!isUiS" v-model="selected"/>
					</div>
				</template>
				<template v-else-if="inspectorTab === 'group' && selected?.type === 'group'">
					<InspectorTitle icon="ti ti-category" :title="getHataSideStudioGroupDisplayName(selected.name)" :subtitle="copy.group"/>
					<div :class="$style.bento"><InspectorCard :title="copy.name"><input v-model="selected.name" :class="$style.input" maxlength="80"><label :class="$style.check"><input v-model="selected.showName" type="checkbox">{{ copy.showGroupNameTopLeft }}</label></InspectorCard><InspectorCard :title="copy.layout"><div :class="$style.layoutPicker"><button class="_button" :aria-pressed="selected.columns === 1 && (isUiS || !selected.masonry)" @click="setGroupLayout(selected, 1, false)"><i class="ti ti-layout-list"></i><span>{{ copy.oneColumn }}</span></button><button class="_button" :disabled="!canSetGroupColumns(selected, 2)" :aria-pressed="selected.columns === 2 && (isUiS || !selected.masonry)" @click="setGroupLayout(selected, 2, false)"><i class="ti ti-layout-grid"></i><span>{{ copy.grid }}</span></button><button class="_button" :disabled="!canSetGroupColumns(selected, 3)" :aria-pressed="selected.columns === 3 && (isUiS || !selected.masonry)" @click="setGroupLayout(selected, 3, false)"><i class="ti ti-layout-grid-add"></i><span>{{ copy.threeColumns }}</span></button><button v-if="!isUiS" class="_button" :disabled="!canSetGroupColumns(selected, Math.max(2, selected.columns) as 2 | 3)" :aria-pressed="selected.masonry" @click="setGroupLayout(selected, Math.max(2, selected.columns) as 2 | 3, true)"><i class="ti ti-layout-board-split"></i><span>{{ copy.masonry }}</span></button></div><small v-if="groupHasLargeItems(selected)">{{ copy.largeItemsPreventMultipleColumns }}</small></InspectorCard><GroupAppearanceEditor v-if="!isUiS" v-model="selected"/><InspectorCard :title="copy.itemsInGroup"><button v-for="child in selected.children" :key="child.id" class="_button" :class="$style.memberButton" @click="selectNode(child.id)"><i :class="child.type === 'button' ? child.icon : 'ti ti-app-window'"></i><span>{{ child.type === 'widget' ? widgetDisplayLabel(child.kind, child.label) : getHataSideStudioMenuDisplayLabel(child.menuId, child.label) }}</span><i class="ti ti-chevron-right"></i></button><small v-if="selected.children.length === 0">{{ copy.emptyGroupHint }}</small></InspectorCard><InspectorCard v-if="mergeTargets.length > 0" :title="copy.mergeIntoAnotherGroup"><select v-model="mergeTargetId" :class="$style.select"><option value="">{{ copy.selectMergeTarget }}</option><option v-for="group in mergeTargets" :key="group.id" :value="group.id">{{ getHataSideStudioGroupDisplayName(group.name) }}</option></select><button class="_button" :disabled="!mergeTargetId" @click="mergeSelectedGroup"><i class="ti ti-arrows-join"></i>{{ copy.merge }}</button></InspectorCard></div>
				</template>
				<div v-else-if="inspectorTab === 'role'" :class="$style.bento">
					<InspectorCard :title="copy.accountSaveLimit"><strong :class="$style.limitValue">{{ copyx.itemCount({ count: profileLimit.toString() }) }}</strong><small>{{ copy.profileLimitPerDevice }}</small></InspectorCard>
					<InspectorCard :title="copy.saveDestination"><p>{{ copy.savedOnlyOnDevice }}</p><button class="_button" :class="$style.currentSettingsButton" @click="openSettingsTransfer"><i class="ti ti-arrows-exchange"></i>{{ copy.exportImportSettings }}</button></InspectorCard>
					<InspectorCard v-if="$i?.isAdmin || $i?.isModerator" :title="copy.roleSettings"><button class="_button" :class="$style.currentSettingsButton" @click="openRoleSettings"><i class="ti ti-users-group"></i>{{ copy.configureInControlPanel }}</button><small>{{ copy.limitConfigurableInRoles }}</small></InspectorCard>
				</div>
				<div v-else :class="$style.emptyInspector"><i class="ti ti-pointer"></i><b>{{ copy.selectItemFromPreview }}</b><span>{{ copy.selectItemOpensSettings }}</span></div>
			</div>
		</section>
	</main>

	<Teleport to="body">
	<div v-show="!inHataGoes || hataGoesHost?.active.value" :class="$style.teleportTheme" :data-ui-s="isUiS ? 'true' : undefined" :style="hk3ThemeContext">
	<div v-if="studioDialog" :class="$style.studioDialogWindow" role="dialog" aria-modal="false" :aria-label="studioDialog.title">
		<header><span><i :class="studioDialog.icon"></i><b>{{ studioDialog.title }}</b></span><button class="_button" :aria-label="copy.close" @click="resolveStudioDialog(false)"><i class="ti ti-x"></i></button></header>
		<p>{{ studioDialog.text }}</p>
		<input v-if="studioDialog.kind === 'prompt'" ref="studioDialogControl" v-model="studioDialog.value" :class="$style.input" maxlength="80" @keydown.enter="resolveStudioDialog(true)">
		<select v-if="studioDialog.kind === 'select'" ref="studioDialogControl" v-model="studioDialog.value" :class="$style.select"><option v-for="option in studioDialog.options" :key="option.value" :value="option.value">{{ option.label }}</option></select>
		<div><button v-if="studioDialog.cancelLabel" class="_button" @click="resolveStudioDialog(false)">{{ studioDialog.cancelLabel }}</button><button class="_buttonPrimary" @click="resolveStudioDialog(true)">{{ studioDialog.confirmLabel }}</button></div>
	</div>
	<div v-if="leaveConfirmOpen" :class="$style.windowLayer"><div :class="$style.leaveDialog"><i class="ti ti-device-floppy"></i><h2>{{ copy.saveChangesQuestion }}</h2><p>{{ copy.unsavedChanges }}</p><div><button class="_button" @click="confirmLeave(false)">{{ copy.discardAndMove }}</button><button class="_buttonPrimary" @click="saveAndLeave">{{ copy.saveAndMove }}</button><button class="_button" @click="cancelLeave">{{ copy.back }}</button></div></div></div>
	<aside v-if="tutorialOpen && tutorialStep" :class="$style.tutorialWindow" role="dialog" aria-modal="false" :aria-label="copy.tutorialAria">
		<header><span>{{ copy.step }} {{ tutorialIndex + 1 }} / {{ tutorialSteps.length }}</span><button class="_button" :aria-label="copy.closeTutorial" @click="finishTutorial(true)"><i class="ti ti-x"></i></button></header>
		<div :class="$style.tutorialProgress"><span v-for="(_, index) in tutorialSteps" :key="index" :data-active="index <= tutorialIndex"></span></div>
		<i :class="tutorialStep.icon"></i><h2>{{ tutorialStep.title }}</h2><p>{{ tutorialStep.body }}</p>
		<div :class="$style.tutorialActions"><button class="_button" @click="finishTutorial(true)">{{ copy.skip }}</button><button class="_button" :disabled="tutorialIndex === 0" @click="tutorialIndex--"><i class="ti ti-chevron-left"></i>{{ copy.back }}</button><button class="_buttonPrimary" @click="advanceTutorial">{{ tutorialIndex === tutorialSteps.length - 1 ? copy.start : copy.next }}<i class="ti ti-chevron-right"></i></button></div>
	</aside>
	</div>
	</Teleport>
</div>
</template>

<script lang="ts" setup>
import { computed, defineAsyncComponent, defineComponent, h, inject, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, resolveDynamicComponent, useCssModule, watch } from 'vue';
import draggable from 'vuedraggable';
import { Columns3, Gauge, Moon, PanelsTopLeft, PawPrint, Pencil, RectangleVertical, Settings, Sun } from '@lucide/vue';
import type { HataSideButton, HataSideButtonShape, HataSideButtonSize, HataSideGroup, HataSideNode, HataSidePostButtonAppearance, HataSidePostButtonIcon, HataSideStudioStore, HataSideWidget, HataSideWidgetKind } from '@/utility/hata-side-studio.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { instance } from '@/instance.js';
import { mainRouter, useRouter } from '@/router.js';
import { definePage } from '@/page.js';
import { navbarItemDef } from '@/navbar.js';
import { prefer } from '@/preferences.js';
import { miLocalStorage } from '@/local-storage.js';
import { claimAchievement } from '@/utility/achievements.js';
import { inspectHataSideContrast, parseHataSideRgb } from '@/utility/hata-side-studio-contrast.js';
import { HATA_SIDE_WIDGET_REGISTRY } from '@/utility/hata-side-studio-widgets.js';
import { antennasCache, userListsCache } from '@/cache.js';
import * as os from '@/os.js';
import {
	HATA_SIDE_STUDIO_DEFAULT_PROFILE_LIMIT, applyHataSideStudioStore, cloneHataSideStudioStore,
	copyCollapsedToExpanded, copyExpandedToCollapsed, createButton, createDefaultProfile, createGroup, createHataSideStudioSourceCatalog, createWidget,
	ensureHataSideStudioInitialized, findHataSideNodeParentGroup, getActiveHataSideProfile, getHataSideNodeContainerColumns, getHataSideStudioCacheLabelSize, getHataSideStudioGroupDisplayName, getHataSideStudioMenuDisplayLabel, getHataSideStudioProfileDisplayName,
	getHataSideWidgetDisplayLabel, gradientCss, hataSideStudioNodeContainsRequiredMenu, hataSideStudioStore, mergeHataSideGroups,
} from '@/utility/hata-side-studio.js';
import { SIDEBAR_ICON_OVERRIDES } from '@/utility/sidebar-icon-overrides.js';
import HataSideStudioEarthquake from '@/components/HataSideStudioEarthquake.vue';
import HataSideStudioFlowers from '@/components/HataSideStudioFlowers.vue';
import { HK3_THEME_CONTEXT } from '@/components/hataskey3/hk3-theme.js';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import { useHataGoesPopup } from '@/utility/hatagoes-popup.js';
import HataAppNavIcon from '@/components/HataAppNavIcon.vue';
import HataAppWordmark from '@/components/HataAppWordmark.vue';
import { hataAppForMenuIcon, hataAppForMenuLabel } from '@/utility/hata-app-brand.js';
import { store } from '@/store.js';

const copy = i18n.ts._hata._hataSideStudio._main;
const copyx = i18n.tsx._hata._hataSideStudio._main;
const $style = useCssModule();
const emptyGroupDropText = JSON.stringify(copy.dropButtonOrWidgetHere);
const hk3ThemeContext = inject(HK3_THEME_CONTEXT, null);
const studioDark = computed(() => hk3ThemeContext != null ? hk3ThemeContext['color-scheme'] === 'dark' : store.r.darkMode.value);
const hataGoesHost = inject(HATA_GOES_HOST, null);
const inHataGoes = hataGoesHost != null;
const popup = useHataGoesPopup();
const studioRouter = inHataGoes ? useRouter() : mainRouter;
const isUiS = hk3ThemeContext != null;
const uiSCopy = i18n.ts._hata._hataskeyUi3;
const uiSPreviewDeck = ref(false);
const uiSAppearanceNote = 'UI Sでは配色と形をテーマに統一します';
const isBrandMenu = (id: string): boolean => ['hatask', 'hatady', 'hatafeed'].includes(id);
const isHatasabaDeckUi = computed(() => miLocalStorage.getItem('ui') === 'simple' && prefer.r['simpleUi.deckMode'].value === true);
const studioDialogControl = ref<HTMLInputElement | HTMLSelectElement | null>(null);

function widgetDisplayLabel(kind: HataSideWidgetKind, fallback: string): string {
	return getHataSideWidgetDisplayLabel(kind, fallback);
}

function profileDisplayName(name: string): string {
	const translated = getHataSideStudioProfileDisplayName(name);
	if (translated !== name) return translated;
	const numbered = /^プロファイル (\d+)$/.exec(name);
	return numbered == null ? name : copyx.numberedProfile({ number: numbered[1] });
}

const InspectorTitle = defineComponent({ props: { icon: String, title: String, subtitle: String }, setup: props => () => h('div', { class: $style.inspectorTitle }, [h('i', { class: props.icon }), h('div', [h('small', props.subtitle), h('h2', props.title)])]) });
const InspectorCard = defineComponent({ props: { title: String }, setup: (props, { slots }) => () => h('section', { class: $style.inspectorCard }, [h('h3', props.title), slots.default?.()]) });
const GradientEditor = defineComponent({ props: { modelValue: { type: Object, required: true } }, setup: props => () => {
	const value = props.modelValue as any;
	return [
		h('label', { class: $style.check }, [h('input', { type: 'checkbox', checked: value.gradientEnabled, onChange: (event: Event) => value.gradientEnabled = (event.target as HTMLInputElement).checked }), copy.twoColorGradient]),
		value.gradientEnabled ? h('div', { class: $style.gradientControls }, [
			h('div', { class: $style.quickGradientPreview, style: { background: gradientCss(value) } }),
			h('label', { class: $style.quickField }, [h('span', copy.secondColor), h('input', { type: 'color', value: cssColor(value.gradientTo), onInput: (event: Event) => value.gradientTo = (event.target as HTMLInputElement).value })]),
			h('label', { class: $style.field }, [h('span', copy.direction), h('input', { type: 'range', min: 0, max: 360, value: value.gradientAngle, onInput: (event: Event) => value.gradientAngle = Number((event.target as HTMLInputElement).value) }), h('output', `${value.gradientAngle}°`)]),
			h('label', { class: $style.quickField }, [h('span', copy.colorTransition), h('select', { class: $style.select, value: value.gradientEasing, onChange: (event: Event) => value.gradientEasing = (event.target as HTMLSelectElement).value }, [h('option', { value: 'linear' }, copy.even), h('option', { value: 'ease-in' }, copy.slowStart), h('option', { value: 'ease-out' }, copy.slowEnd), h('option', { value: 'ease-in-out' }, copy.smoothBothEnds)])]),
		]) : null,
	];
} });
const AppearanceEditor = defineComponent({ props: { modelValue: { type: Object, required: true }, collapsedButton: Boolean }, setup: props => () => h(InspectorCard, { title: copy.colorsAndGradient }, { default: () => [
	props.collapsedButton ? h('label', { class: $style.check }, [h('input', { type: 'checkbox', checked: (props.modelValue as HataSideButton).borderVisible, onChange: (event: Event) => (props.modelValue as HataSideButton).borderVisible = (event.target as HTMLInputElement).checked }), copy.showBorder]) : null,
	h('div', { class: $style.colorGrid }, [['background', copy.background], ['border', copy.border], ['foreground', copy.text]].map(([key, label]) => h('label', { class: $style.colorField }, [h('span', label), h('input', { type: 'color', value: cssColor((props.modelValue as any)[key]), onPointerdown: key === 'border' ? (event: PointerEvent) => promptCollapsedBorderVisibility(props.modelValue as HataSideNode, event) : undefined, onKeydown: key === 'border' ? (event: KeyboardEvent) => { if (event.key === 'Enter') { event.preventDefault(); void promptCollapsedBorderVisibility(props.modelValue as HataSideNode, event); } } : undefined, onInput: (e: Event) => (props.modelValue as any)[key] = (e.target as HTMLInputElement).value })]))),
	h('label', { class: $style.field }, [h('span', copy.borderWidth), h('input', { type: 'range', min: 0, max: 5, value: (props.modelValue as any).borderWidth ?? 1, onInput: (e: Event) => (props.modelValue as any).borderWidth = Number((e.target as HTMLInputElement).value) }), h('output', `${(props.modelValue as any).borderWidth ?? 1}px`)]),
	h('label', { class: $style.field }, [h('span', copy.borderStyle), h('select', { class: $style.select, value: (props.modelValue as any).borderStyle ?? 'solid', onChange: (e: Event) => (props.modelValue as any).borderStyle = (e.target as HTMLSelectElement).value }, [h('option', { value: 'solid' }, copy.solid), h('option', { value: 'dashed' }, copy.dashed), h('option', { value: 'double' }, copy.double)])]),
	h(GradientEditor, { modelValue: props.modelValue }),
] }) });
const GroupAppearanceEditor = defineComponent({ props: { modelValue: { type: Object, required: true } }, setup: props => () => h(InspectorCard, { title: copy.groupSurface }, { default: () => [
	h('div', { class: $style.colorGrid }, [['background', copy.background], ['border', copy.border]].map(([key, label]) => h('label', { class: $style.colorField }, [h('span', label), h('input', { type: 'color', value: cssColor((props.modelValue as any)[key]), onInput: (e: Event) => (props.modelValue as any)[key] = (e.target as HTMLInputElement).value })]))),
	h('label', { class: $style.field }, [h('span', copy.borderWidth), h('input', { type: 'range', min: 0, max: 5, value: (props.modelValue as any).borderWidth ?? 1, onInput: (e: Event) => (props.modelValue as any).borderWidth = Number((e.target as HTMLInputElement).value) }), h('output', `${(props.modelValue as any).borderWidth ?? 1}px`)]),
	h('label', { class: $style.field }, [h('span', copy.borderStyle), h('select', { class: $style.select, value: (props.modelValue as any).borderStyle ?? 'solid', onChange: (e: Event) => (props.modelValue as any).borderStyle = (e.target as HTMLSelectElement).value }, [h('option', { value: 'solid' }, copy.solid), h('option', { value: 'dashed' }, copy.dashed), h('option', { value: 'double' }, copy.double)])]),
	h(GradientEditor, { modelValue: props.modelValue }),
] }) });
const ButtonPreview = defineComponent({
	props: { button: { type: Object, required: true } },
	emits: ['search'],
	setup(props, { emit }) {
		const query = ref('');
		return () => {
			const button = props.button as HataSideButton;
			if (!isUiS && button.menuId === 'search' && button.size === 'large' && button.shape !== 'circle') {
				return h('form', { class: $style.searchButtonPreview, onSubmit: (event: Event) => { event.preventDefault(); emit('search', query.value); } }, [
					h('i', { class: button.icon }),
					h('input', { value: query.value, type: 'search', placeholder: copy.searchNotesOrUsers, 'aria-label': copy.searchQuery, onInput: (event: Event) => { query.value = (event.target as HTMLInputElement).value; }, onClick: (event: Event) => event.stopPropagation() }),
					h('button', { class: '_button', type: 'submit', 'aria-label': copy.search, onClick: (event: Event) => event.stopPropagation() }, [h('i', { class: 'ti ti-arrow-right' })]),
				]);
			}
			const large = button.size === 'large' && (isUiS || button.shape !== 'circle');
			const unreadCount = button.menuId === 'notifications' ? Number($i?.unreadNotificationsCount ?? 0) : 0;
			return h('div', { class: large ? $style.largeButtonPreview : $style.buttonPreviewBody }, [
				hataAppForMenuIcon(button.menuId, button.icon) ? h(HataAppNavIcon, { app: hataAppForMenuIcon(button.menuId, button.icon)!, size: 22, monochrome: studioDark.value }) : h('i', { class: button.icon }),
				button.showLabel || (!isUiS && large) ? h('span', [h('b', hataAppForMenuLabel(button.menuId, getHataSideStudioMenuDisplayLabel(button.menuId, button.label), button.icon) ? [h(HataAppWordmark, { app: hataAppForMenuLabel(button.menuId, getHataSideStudioMenuDisplayLabel(button.menuId, button.label), button.icon)!, onDark: studioDark.value })] : getHataSideStudioMenuDisplayLabel(button.menuId, button.label)), large ? h('small', buttonDetail(button.menuId)) : null]) : null,
				large && ['hatask', 'hatady', 'hatafeed'].includes(button.menuId) ? h('em', button.menuId === 'hatask' ? copy.scheduleAndTodo : button.menuId === 'hatady' ? copy.todayStudy : copy.applicationStatus) : null,
				unreadCount > 0 ? h('span', { class: $style.previewBadge, 'aria-label': copyx.unreadCount({ count: unreadCount.toString() }) }, unreadCount > 99 ? '99+' : String(unreadCount)) : null,
			]);
		};
	},
});
const WidgetPreview = defineComponent({
	props: { widget: { type: Object, required: true } },
	setup: props => () => {
		const widget = props.widget as HataSideWidget;
		const definition = HATA_SIDE_WIDGET_REGISTRY[widget.kind];
		const nativeKind = widget.kind === 'flowers' ? 'hataskFlowers' : widget.kind === 'announcements' ? null : widget.kind;
		const sizeSetting = widget.sizeSettings[widget.size];
		const registryMinHeight = definition.sizes[widget.size].minHeight;
		const effectiveMinHeight = widget.kind === 'aichan' ? Math.max(sizeSetting.minHeight, registryMinHeight) : sizeSetting.minHeight;
		const nativeData = { ...(widget.data ?? {}), ...(sizeSetting.data ?? {}) };
		if (widget.kind === 'serverMetric' && widget.size === 'small') nativeData.view = 3;
		const widgetStyle = {
			'--hss-widget-height': `${effectiveMinHeight}px`,
			...(widget.kind === 'aichan' ? { '--hss-aichan-scale': String(Math.min(1, effectiveMinHeight / 350)) } : {}),
		};
		if (widget.kind === 'hataskFlowers' || widget.kind === 'flowers') {
			return h('div', { class: $style.nativeWidgetPreview, 'data-hss-kind': 'hataskFlowers', 'data-hss-size': widget.size, style: widgetStyle }, [h(HataSideStudioFlowers, { size: widget.size })]);
		}
		if (widget.kind === 'earthquake') {
			return h('div', { class: $style.nativeWidgetPreview, 'data-hss-kind': 'earthquake', 'data-hss-size': widget.size, style: widgetStyle }, [h(HataSideStudioEarthquake, { size: widget.size })]);
		}
		if (nativeKind != null) {
			return h('div', {
				class: $style.nativeWidgetPreview,
				'data-hss-kind': widget.kind,
				'data-hss-size': widget.size,
				style: widgetStyle,
			}, [h('div', { class: $style.nativeWidgetFrame, onWheel: widget.kind === 'postForm' ? onPreviewPostFormWheel : undefined }, [
				h(resolveDynamicComponent(`widget-${nativeKind}`) as any, {
					key: `${widget.id}:${widget.size}:${JSON.stringify(nativeData)}`,
					widget: { id: widget.id, name: nativeKind, data: nativeData },
					onUpdateProps: (data: Record<string, unknown>) => { widget.data = { ...(widget.data ?? {}), ...data }; },
				}),
			])]);
		}
		return h('div', { class: $style.widgetBody }, [h('i', { class: definition.icon }), h('div', [h('b', widgetDisplayLabel(widget.kind, widget.label)), h('span', copy.showRecentAnnouncements), h('small', copy.summaryUntilDedicatedWidget)])]);
	},
});

function onPreviewPostFormWheel(event: WheelEvent) {
	const frame = event.currentTarget as HTMLElement | null;
	const footer = (event.target as HTMLElement | null)?.closest?.('.mkw-post-form footer') as HTMLElement | null;
	const target = footer && footer.scrollWidth > footer.clientWidth + 1 ? footer : frame;
	if (!target || target.scrollWidth <= target.clientWidth + 1) return;
	const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
	if (delta === 0) return;
	const before = target.scrollLeft;
	target.scrollLeft += delta;
	if (target.scrollLeft !== before) event.preventDefault();
}

const editMode = ref<'expanded' | 'collapsed'>('expanded');
const inspectorTab = ref<'layout' | 'button' | 'widget' | 'group' | 'role'>('layout');
const deleteMode = ref(false);
const resetConfirmOpen = ref(false);
const copyMenuOpen = ref(false);
const buttonPickerOpen = ref(false);
const widgetPickerOpen = ref(false);
const quickEditorOpen = ref(false);
const reorderOpen = ref(false);
const inspectorPaneEl = ref<HTMLElement | null>(null);
const stageEl = ref<HTMLElement | null>(null);
const sidebarPreviewEl = ref<HTMLElement | null>(null);
const inspectorAttention = ref(false);
const dragHintVisible = ref(false);
const dragPointer = ref({ x: 24, y: 24 });
const dragTimelinePosition = ref({ left: 12, top: 12, maxHeight: 360 });
const draggingNodeId = ref<string | null>(null);
let dragConstraintNoticeShown = false;
const deleteDropArmed = ref(false);
const timelineDropTarget = ref<{ containerId: string; index: number } | null>(null);
const newButtonMenuId = ref('');
const buttonSearch = ref('');
const widgetSearch = ref('');
const newButtonShape = ref<HataSideButtonShape>('rounded');
const newWidgetKind = ref<HataSideWidgetKind>('clock');
const selectedId = ref<string | null>(null);
const mergeTargetId = ref('');
const contrastPopoverGroupId = ref<string | null>(null);
type StudioDialogState = {
	kind: 'confirm' | 'prompt' | 'select';
	title: string;
	text: string;
	icon: string;
	confirmLabel: string;
	cancelLabel: string;
	value: string;
	options: Array<{ value: string; label: string }>;
	resolve: (result: { confirmed: boolean; value: string }) => void;
};
const studioDialog = ref<StudioDialogState | null>(null);
const tutorialSteps = [
	{ target: 'welcome', icon: 'ti ti-sparkles', title: copy.tutorialWelcomeTitle, body: copy.tutorialWelcomeBody },
	{ target: 'create', icon: 'ti ti-square-rounded-plus', title: copy.tutorialCreateTitle, body: copy.tutorialCreateBody },
	{ target: 'arrange', icon: 'ti ti-hand-move', title: copy.tutorialArrangeTitle, body: copy.tutorialArrangeBody },
	{ target: 'customize', icon: 'ti ti-adjustments-horizontal', title: copy.tutorialCustomizeTitle, body: copy.tutorialCustomizeBody },
	{ target: 'save', icon: 'ti ti-device-floppy', title: copy.tutorialSaveTitle, body: copy.tutorialSaveBody },
] as const;
const tutorialOpen = ref(false);
const tutorialIndex = ref(0);
const tutorialStep = computed(() => tutorialOpen.value ? tutorialSteps[tutorialIndex.value] : null);
const isTouch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const profileLimit = computed(() => Math.max(1, Number(($i?.policies as Record<string, unknown> | undefined)?.hataSideStudioProfileLimit ?? HATA_SIDE_STUDIO_DEFAULT_PROFILE_LIMIT)));
// UIの親レイアウトがStudioより先に初期化されない直接アクセスでも、
// 従来のサイドメニュ順を最初のプロファイルに取り込んでからdraftを作る。
ensureHataSideStudioInitialized(prefer.r['simpleUi.sidebar'].value as any[]);
const original = ref(cloneHataSideStudioStore(hataSideStudioStore.value));
const draft = ref(cloneHataSideStudioStore(original.value));
const history = ref<HataSideStudioStore[]>([cloneHataSideStudioStore(draft.value)]);
const historyIndex = ref(0);
let historyTimer: number | null = null;
let historyLocked = false;
const hasChanges = computed(() => JSON.stringify(draft.value) !== JSON.stringify(original.value));
const activeProfile = computed(() => getActiveHataSideProfile(draft.value));
const selected = computed<HataSideNode | null>(() => findNode(selectedId.value));
const selectedDisplayName = computed(() => selected.value == null ? copy.overallLayout : selected.value.type === 'group' ? getHataSideStudioGroupDisplayName(selected.value.name) : selected.value.type === 'widget' ? widgetDisplayLabel(selected.value.kind, selected.value.label) : getHataSideStudioMenuDisplayLabel(selected.value.menuId, selected.value.label));
const mergeTargets = computed(() => activeProfile.value.expanded.nodes.filter((node): node is HataSideGroup => node.type === 'group' && node.id !== selectedId.value));
const availableGroups = computed(() => activeProfile.value.expanded.nodes.filter((node): node is HataSideGroup => node.type === 'group'));
const availableWidgetChoices = computed(() => Object.entries(HATA_SIDE_WIDGET_REGISTRY)
	.filter(([kind, definition]) => kind !== 'flowers' && (!definition.availability.requiresFederation || instance.federation !== 'none') && (!definition.availability.adminOnly || $i?.isAdmin || $i?.isModerator))
	.map(([kind, definition]) => ({ kind: kind as HataSideWidgetKind, label: widgetDisplayLabel(kind as HataSideWidgetKind, definition.label), icon: definition.icon })));
const filteredWidgetChoices = computed(() => availableWidgetChoices.value.filter(item => item.label.toLocaleLowerCase().includes(widgetSearch.value.trim().toLocaleLowerCase())));
const buttonShapes: { value: HataSideButtonShape; label: string }[] = [{ value: 'rounded', label: copy.rounded }, { value: 'circle', label: copy.circle }, { value: 'pill', label: copy.capsule }];
const sizes: { value: HataSideButtonSize; label: string }[] = [{ value: 'small', label: copy.small }, { value: 'normal', label: copy.normal }, { value: 'large', label: copy.large }];
const expandedDragGroup = { name: 'hata-side-items', pull: true, put: true };
const groupChildDragGroup = { name: 'hata-side-items', pull: true, put: true };

const menuCatalog = computed(() => {
	const source = prefer.r['simpleUi.sidebar'].value as any[];
	const launchPadItems = Object.entries(navbarItemDef)
		.filter(([id, definition]) => !['more', 'whatsNew'].includes(id) && ((definition as any).show == null || (definition as any).show === true))
		.map(([id, definition]) => ({ id, icon: (definition as any).icon ?? 'ti ti-point', label: String((definition as any).title ?? id), group: 'more' }));
	return createHataSideStudioSourceCatalog(source, launchPadItems).all.map(item => ({ ...item, icon: SIDEBAR_ICON_OVERRIDES[item.id] ?? item.icon }));
});
const usedMenuIds = computed(() => new Set(editMode.value === 'collapsed'
	? activeProfile.value.collapsed.buttons.map(button => button.menuId)
	: activeProfile.value.expanded.nodes.flatMap(node => node.type === 'button' ? [node.menuId] : node.type === 'group' ? node.children.filter((child): child is HataSideButton => child.type === 'button').map(child => child.menuId) : [])));
const availableMenuItems = computed(() => menuCatalog.value.filter(item => !usedMenuIds.value.has(item.id)));
const filteredMenuItems = computed(() => availableMenuItems.value.filter(item => `${getHataSideStudioMenuDisplayLabel(item.id, item.label)} ${item.id}`.toLocaleLowerCase().includes(buttonSearch.value.trim().toLocaleLowerCase())));
const previewCount = computed(() => {
	const nodes = activeProfile.value.expanded.nodes;
	const buttons = nodes.reduce((count, node) => count + (node.type === 'button' ? 1 : node.type === 'group' ? node.children.filter(child => child.type === 'button').length : 0), 0);
	const widgets = nodes.reduce((count, node) => count + (node.type === 'widget' ? 1 : node.type === 'group' ? node.children.filter(child => child.type === 'widget').length : 0), 0);
	const groups = nodes.filter(node => node.type === 'group').length;
	return editMode.value === 'collapsed' ? copyx.collapsedPreviewCount({ buttons: activeProfile.value.collapsed.buttons.length.toString() }) : copyx.expandedPreviewCount({ buttons: buttons.toString(), groups: groups.toString(), widgets: widgets.toString() });
});
const selectedParentGroupId = computed(() => {
	if (!selectedId.value) return '';
	return findHataSideNodeParentGroup(activeProfile.value, selectedId.value)?.id ?? '';
});
const selectedParentColumns = computed(() => {
	if (editMode.value === 'collapsed' || selected.value?.type === 'group') return 1;
	return selectedId.value == null ? activeProfile.value.expanded.columns : getHataSideNodeContainerColumns(activeProfile.value, selectedId.value);
});
const rootHasLargeItems = computed(() => activeProfile.value.expanded.nodes.some(node => node.type !== 'group' && node.size === 'large'));
const dragHintStyle = computed(() => ({
	left: `${Math.max(8, Math.min(window.innerWidth - 260, dragPointer.value.x + 8))}px`,
	top: `${Math.max(8, Math.min(window.innerHeight - 82, dragPointer.value.y + 8))}px`,
}));
const dragTimelineStyle = computed(() => ({
	left: `${dragTimelinePosition.value.left}px`,
	top: `${dragTimelinePosition.value.top}px`,
	maxHeight: `${dragTimelinePosition.value.maxHeight}px`,
}));
const reorderSections = computed(() => {
	const summarize = (items: HataSideNode[]) => items.map(item => ({ id: item.id, label: item.type === 'group' ? copyx.groupNamed({ name: getHataSideStudioGroupDisplayName(item.name) }) : item.type === 'widget' ? widgetDisplayLabel(item.kind, item.label) : getHataSideStudioMenuDisplayLabel(item.menuId, item.label), icon: item.type === 'group' ? 'ti ti-category' : item.type === 'widget' ? 'ti ti-app-window' : item.icon }));
	if (editMode.value === 'collapsed') return [{ id: 'collapsed', label: copy.collapsedMenu, items: summarize(activeProfile.value.collapsed.buttons) }];
	return [
		{ id: 'root', label: copy.outsideGroupsAndGroupOrder, items: summarize(activeProfile.value.expanded.nodes) },
		...availableGroups.value.map(group => ({ id: group.id, label: copyx.insideGroup({ name: getHataSideStudioGroupDisplayName(group.name) }), items: summarize(group.children) })),
	];
});
const dragTimelineSections = computed(() => {
	const draggingId = draggingNodeId.value;
	const summarize = (items: HataSideNode[]) => items
		.filter(item => item.id !== draggingId)
		.map(item => ({
			id: item.id,
			label: item.type === 'group' ? copyx.groupNamed({ name: getHataSideStudioGroupDisplayName(item.name) }) : item.type === 'widget' ? widgetDisplayLabel(item.kind, item.label) : getHataSideStudioMenuDisplayLabel(item.menuId, item.label),
			icon: item.type === 'group' ? 'ti ti-category' : item.type === 'widget' ? 'ti ti-app-window' : item.icon,
		}));
	if (editMode.value === 'collapsed') return [{ id: 'collapsed', label: copy.collapsedMenu, items: summarize(activeProfile.value.collapsed.buttons) }];
	const dragging = draggingNodeId.value ? findNode(draggingNodeId.value) : null;
	return [
		{ id: 'root', label: copy.wholeMenu, items: summarize(activeProfile.value.expanded.nodes) },
		...availableGroups.value.filter(() => dragging?.type !== 'group').map(group => ({ id: group.id, label: getHataSideStudioGroupDisplayName(group.name), items: summarize(group.children) })),
	];
});
const groupContrastWarnings = computed(() => isUiS
	? new Map<string, ReturnType<typeof inspectGroupContrast>>()
	: new Map(availableGroups.value.map(group => [group.id, inspectGroupContrast(group)])));

watch(draft, () => {
	if (historyLocked) return;
	if (historyTimer) window.clearTimeout(historyTimer);
	historyTimer = window.setTimeout(() => {
		const next = cloneHataSideStudioStore(draft.value);
		if (JSON.stringify(next) === JSON.stringify(history.value[historyIndex.value])) return;
		history.value = [...history.value.slice(0, historyIndex.value + 1), next].slice(-50);
		historyIndex.value = history.value.length - 1;
	}, 180);
}, { deep: true });

function cssColor(value: unknown): string { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#6c63ff'; }

function resolveCssRgb(value: string, fallback = 'var(--MI_THEME-navBg)') {
	if (typeof window === 'undefined') return null;
	const probe = window.document.createElement('span');
	probe.style.position = 'fixed';
	probe.style.pointerEvents = 'none';
	probe.style.opacity = '0';
	probe.style.color = value === 'transparent' ? fallback : value;
	window.document.body.appendChild(probe);
	const resolved = parseHataSideRgb(window.getComputedStyle(probe).color);
	probe.remove();
	return resolved;
}

function inspectGroupContrast(group: HataSideGroup) {
	const backgrounds = [group.background, ...(group.gradientEnabled ? [group.gradientTo] : [])]
		.map(value => resolveCssRgb(value))
		.filter((value): value is NonNullable<typeof value> => value != null);
	const foregroundValues = [group.foreground, ...group.children.filter(child => child.background === 'transparent').map(child => child.foreground)];
	const foregrounds = foregroundValues
		.map(value => resolveCssRgb(value, 'var(--MI_THEME-fg)'))
		.filter((value): value is NonNullable<typeof value> => value != null);
	if (backgrounds.length === 0 || foregrounds.length === 0) return { low: false, minimumRatio: Number.POSITIVE_INFINITY, recommended: '#111111' as const, recommendedRatio: Number.POSITIVE_INFINITY };
	return inspectHataSideContrast(foregrounds, backgrounds);
}

function toggleContrastPopover(groupId: string) {
	contrastPopoverGroupId.value = contrastPopoverGroupId.value === groupId ? null : groupId;
}

function applyGroupTextColor(group: HataSideGroup, color: string) {
	group.foreground = color;
	for (const child of group.children) child.foreground = color;
	contrastPopoverGroupId.value = null;
	os.toast(copy.groupTextColorChanged, 'ti ti-contrast');
}

function openStudioDialog(config: Omit<StudioDialogState, 'resolve'>): Promise<{ confirmed: boolean; value: string }> {
	if (studioDialog.value) studioDialog.value.resolve({ confirmed: false, value: studioDialog.value.value });
	return new Promise(resolve => {
		studioDialog.value = { ...config, resolve };
		void nextTick(() => studioDialogControl.value?.focus({ preventScroll: true }));
	});
}

function resolveStudioDialog(confirmed: boolean) {
	const current = studioDialog.value;
	if (!current) return;
	studioDialog.value = null;
	current.resolve({ confirmed, value: current.value });
}

async function askStudioConfirm(title: string, text: string, confirmLabel = copy.continue, icon = 'ti ti-alert-circle'): Promise<boolean> {
	return (await openStudioDialog({ kind: 'confirm', title, text, icon, confirmLabel, cancelLabel: copy.cancel, value: '', options: [] })).confirmed;
}

async function promptCollapsedBorderVisibility(node: HataSideNode, event?: Event) {
	if (node.type !== 'button' || editMode.value !== 'collapsed' || node.borderVisible) return;
	event?.preventDefault();
	const confirmed = await askStudioConfirm(
		copy.showBorderFirstQuestion,
		copy.collapsedBorderHiddenDescription,
		copy.showBorderAction,
		'ti ti-border-corner-i',
	);
	if (confirmed) node.borderVisible = true;
}

async function askStudioPrompt(title: string, text: string, initialValue = ''): Promise<string | null> {
	const result = await openStudioDialog({ kind: 'prompt', title, text, icon: 'ti ti-pencil', confirmLabel: copy.change, cancelLabel: copy.cancel, value: initialValue, options: [] });
	return result.confirmed ? result.value.trim() : null;
}

async function askStudioSelect(title: string, text: string, options: Array<{ value: string; label: string }>): Promise<string | null> {
	const result = await openStudioDialog({ kind: 'select', title, text, icon: 'ti ti-list-search', confirmLabel: copy.choose, cancelLabel: copy.cancel, value: options[0]?.value ?? '', options });
	return result.confirmed ? result.value : null;
}

function findNode(id: string | null): HataSideNode | null { if (!id) return null; const rootNode = activeProfile.value.expanded.nodes.find(node => node.id === id); if (rootNode) return rootNode; for (const node of activeProfile.value.expanded.nodes) { if (node.type === 'group') { const child = node.children.find(item => item.id === id); if (child) return child; } } return activeProfile.value.collapsed.buttons.find(button => button.id === id) ?? null; }

function selectNode(id: string) {
	selectedId.value = id;
	mergeTargetId.value = '';
	const node = findNode(id);
	if (node?.type === 'button') inspectorTab.value = 'button';
	else if (node?.type === 'widget') inspectorTab.value = 'widget';
	else if (node?.type === 'group') inspectorTab.value = 'group';
}

function selectAfterDrag() { if (selectedId.value && !findNode(selectedId.value)) selectedId.value = null; }

function updateDragPointer(event: PointerEvent | DragEvent | TouchEvent) {
	const touch = 'touches' in event ? event.touches[0] : null;
	dragPointer.value = { x: touch?.clientX ?? ('clientX' in event ? event.clientX : dragPointer.value.x), y: touch?.clientY ?? ('clientY' in event ? event.clientY : dragPointer.value.y) };
	updateDragDropTargetFromPoint();
}

function pointTarget(selector: string): HTMLElement | null {
	for (const element of window.document.elementsFromPoint(dragPointer.value.x, dragPointer.value.y)) {
		const target = element.closest<HTMLElement>(selector);
		if (target) return target;
	}
	return null;
}

function updateDragDropTargetFromPoint() {
	if (!dragHintVisible.value) return;
	if (pointTarget('[data-delete-drop]')) {
		armDeleteDrop();
		return;
	}
	const target = pointTarget('[data-timeline-drop]');
	const containerId = target?.dataset.containerId;
	const index = Number(target?.dataset.index);
	if (target && containerId && Number.isInteger(index)) {
		armTimelineDrop(containerId, index);
		return;
	}
	deleteDropArmed.value = false;
	timelineDropTarget.value = null;
}

function updateDragTimelinePosition() {
	if (typeof window === 'undefined') return;
	const previewRect = sidebarPreviewEl.value?.getBoundingClientRect() ?? stageEl.value?.getBoundingClientRect();
	if (!previewRect) return;
	const compact = (stageEl.value?.clientWidth ?? window.innerWidth) <= 720;
	const width = Math.min(compact ? 300 : 224, window.innerWidth - 24);
	const gap = 12;
	let left = previewRect.right + gap;
	if (left + width > window.innerWidth - 12) left = previewRect.left - width - gap;
	if (left < 12) left = Math.max(12, Math.min(window.innerWidth - width - 12, previewRect.left + 12));
	const top = Math.max(12, Math.min(window.innerHeight - 220, previewRect.top));
	dragTimelinePosition.value = { left, top, maxHeight: Math.max(200, window.innerHeight - top - 12) };
}

function onDragStart(event: any) {
	dragHintVisible.value = true;
	dragConstraintNoticeShown = false;
	draggingNodeId.value = event?.item?.dataset?.nodeId ?? event?.item?.closest?.('[data-node-id]')?.dataset?.nodeId ?? null;
	deleteDropArmed.value = false;
	timelineDropTarget.value = null;
	window.addEventListener('pointermove', updateDragPointer);
	window.document.addEventListener('dragover', updateDragPointer);
	window.addEventListener('touchmove', updateDragPointer, { passive: true });
	window.addEventListener('resize', updateDragTimelinePosition);
	void nextTick(updateDragTimelinePosition);
}

async function onDragEnd() {
	window.removeEventListener('pointermove', updateDragPointer);
	window.document.removeEventListener('dragover', updateDragPointer);
	window.removeEventListener('touchmove', updateDragPointer);
	window.removeEventListener('resize', updateDragTimelinePosition);
	// touch dragでは pointerenter / dragover が発火しないため、指を離した
	// 最終座標でもう一度簡易タイムラインの対象を確定する。
	updateDragDropTargetFromPoint();
	const sourceId = draggingNodeId.value;
	const shouldDelete = deleteDropArmed.value;
	const timelineTarget = timelineDropTarget.value == null ? null : { ...timelineDropTarget.value };
	const pointedGroupId = window.document.elementFromPoint(dragPointer.value.x, dragPointer.value.y)?.closest<HTMLElement>('[data-group-id]')?.dataset.groupId;
	dragHintVisible.value = false;
	deleteDropArmed.value = false;
	timelineDropTarget.value = null;
	draggingNodeId.value = null;
	dragConstraintNoticeShown = false;
	if (sourceId && shouldDelete) {
		await requestRemoveNode(sourceId);
		selectAfterDrag();
		return;
	}
	if (sourceId && timelineTarget) {
		moveNodeToTimeline(sourceId, timelineTarget.containerId, timelineTarget.index);
		selectAfterDrag();
		return;
	}
	const source = sourceId ? activeProfile.value.expanded.nodes.find(node => node.id === sourceId) : null;
	if (sourceId && source?.type === 'group') {
		const targetId = pointedGroupId;
		if (targetId && targetId !== sourceId) {
				const confirmed = await askStudioConfirm(copy.mergeGroups, copyx.mergeDraggedGroupDescription({ name: source.name }), copy.mergeAction, 'ti ti-arrows-join');
				if (confirmed) {
					const merged = mergeHataSideGroups(activeProfile.value, sourceId, targetId);
					replaceActiveProfile(merged);
					selectedId.value = targetId;
					os.toast(copy.groupsMerged, 'ti ti-arrows-join');
				}
		}
	}
	selectAfterDrag();
}

function armDeleteDrop() { if (dragHintVisible.value) { deleteDropArmed.value = true; timelineDropTarget.value = null; } }

function disarmDeleteDrop() { if (dragHintVisible.value) deleteDropArmed.value = false; }

function containerColumns(containerId: string): 1 | 2 | 3 {
	if (containerId === 'root') return activeProfile.value.expanded.columns;
	return availableGroups.value.find(group => group.id === containerId)?.columns ?? 1;
}

function canPlaceNodeInContainer(node: HataSideNode | null, containerId: string): boolean {
	if (!node) return false;
	if (containerId === 'collapsed') return node.type === 'button';
	if (node.type === 'group') return containerId === 'root';
	return node.size !== 'large' || containerColumns(containerId) === 1;
}

function canUseTimelineContainer(containerId: string): boolean {
	return canPlaceNodeInContainer(findNode(draggingNodeId.value), containerId);
}

function armTimelineDrop(containerId: string, index: number) {
	if (!dragHintVisible.value) return;
	if (!canUseTimelineContainer(containerId)) {
		notifyDragConstraint();
		return;
	}
	timelineDropTarget.value = { containerId, index };
	deleteDropArmed.value = false;
}

function detachNode(id: string): HataSideNode | null {
	if (editMode.value === 'collapsed') {
		const index = activeProfile.value.collapsed.buttons.findIndex(button => button.id === id);
		if (index < 0) return null;
		return activeProfile.value.collapsed.buttons.splice(index, 1)[0];
	}
	const rootIndex = activeProfile.value.expanded.nodes.findIndex(node => node.id === id);
	if (rootIndex >= 0) return activeProfile.value.expanded.nodes.splice(rootIndex, 1)[0];
	for (const group of availableGroups.value) {
		const childIndex = group.children.findIndex(child => child.id === id);
		if (childIndex >= 0) return group.children.splice(childIndex, 1)[0];
	}
	return null;
}

function moveNodeToTimeline(id: string, containerId: string, requestedIndex: number) {
	if (!canPlaceNodeInContainer(findNode(id), containerId)) {
		os.toast(copy.cannotMoveLargeIntoMultipleColumns, 'ti ti-layout-grid');
		return;
	}
	const moving = detachNode(id);
	if (!moving) return;
	if (containerId === 'collapsed' && moving.type === 'button') {
		activeProfile.value.collapsed.buttons.splice(Math.min(requestedIndex, activeProfile.value.collapsed.buttons.length), 0, moving);
		return;
	}
	if (containerId === 'root') {
		activeProfile.value.expanded.nodes.splice(Math.min(requestedIndex, activeProfile.value.expanded.nodes.length), 0, moving);
		return;
	}
	const group = availableGroups.value.find(item => item.id === containerId);
	if (group && moving.type !== 'group') group.children.splice(Math.min(requestedIndex, group.children.length), 0, moving);
	else activeProfile.value.expanded.nodes.push(moving);
}

function allowNodeMove(evt: any, fallbackContainerId: string): boolean {
	const moving = evt?.draggedContext?.element as HataSideNode | undefined;
	const targetGroupId = evt?.to?.closest?.('[data-group-id]')?.dataset?.groupId as string | undefined;
	const allowed = canPlaceNodeInContainer(moving ?? null, targetGroupId ?? fallbackContainerId);
	if (!allowed && moving?.type !== 'group' && moving?.size === 'large') notifyDragConstraint();
	return allowed;
}

function notifyDragConstraint() {
	if (dragConstraintNoticeShown) return;
	dragConstraintNoticeShown = true;
	os.toast(copy.cannotMoveLargeIntoMultipleColumns, 'ti ti-layout-grid');
}

function allowExpandedMove(evt: any) { return allowNodeMove(evt, 'root'); }

function allowGroupChildMove(evt: any) { return allowNodeMove(evt, 'root') && evt?.draggedContext?.element?.type !== 'group'; }

function nodeStyle(node: HataSideNode) {
	if (isUiS) return {
		...(node.type === 'button' && node.menuId === 'cacheClear' ? { '--hk3-cache-label-size': getHataSideStudioCacheLabelSize(getHataSideStudioMenuDisplayLabel(node.menuId, node.label)) } : {}),
		'--hss-bg': 'transparent',
		'--hss-border': 'var(--hk3-divider)',
		'--hss-border-width': '1px',
		'--hss-border-style': 'solid',
		'--hss-fg': 'var(--hk3-text)',
		'--hss-rotation': '0deg',
		'--hss-rotation-space': '0px',
	};
	const rotation = node.type === 'button' ? Number(node.rotation ?? 0) : 0;
	const borderVisible = node.type !== 'button' || node.borderVisible !== false;
	const radians = Math.abs(rotation) * Math.PI / 180;
	const visualWidth = node.type === 'button' && node.shape === 'circle' ? (node.size === 'large' ? 54 : node.size === 'small' ? 36 : 44) : 260;
	const visualHeight = node.type === 'button' && node.size === 'large' ? 66 : 38;
	// 回転後の外接矩形ぶんだけ上下を広げる。通常時の間隔は従来どおり増やさない。
	const rotationSpace = rotation === 0 ? 0 : Math.ceil(Math.max(0, ((visualWidth * Math.sin(radians)) + (visualHeight * Math.cos(radians)) - visualHeight) / 2) + 3);
	return {
		'--hss-bg': gradientCss(node),
		'--hss-border': node.border,
		'--hss-border-width': `${borderVisible ? (node.borderWidth ?? 1) : 0}px`,
		'--hss-border-style': node.borderStyle ?? 'solid',
		'--hss-fg': node.foreground,
		'--hss-rotation': `${rotation}deg`,
		'--hss-rotation-space': `${rotationSpace}px`,
	};
}

function postButtonIconClass(icon: HataSidePostButtonIcon): string {
	return icon === 'paw' ? 'ti ti-paw' : 'ti ti-pencil';
}

function postButtonStyle(postButton: HataSidePostButtonAppearance) {
	if (isUiS) return { background: 'var(--hk3-accent)', color: 'var(--hk3-bg)' };
	return {
		background: gradientCss(postButton),
		color: postButton.foreground,
	};
}

function activeProfileIndex() { return draft.value.profiles.findIndex(profile => profile.id === draft.value.activeProfileId); }

function replaceActiveProfile(profile: ReturnType<typeof getActiveHataSideProfile>) { const index = activeProfileIndex(); if (index >= 0) draft.value.profiles[index] = profile; }

function removeNode(id: string) { if (editMode.value === 'collapsed') activeProfile.value.collapsed.buttons = activeProfile.value.collapsed.buttons.filter(button => button.id !== id); else { activeProfile.value.expanded.nodes = activeProfile.value.expanded.nodes.filter(node => node.id !== id).map(node => node.type === 'group' ? { ...node, children: node.children.filter(child => child.id !== id) } : node); } if (selectedId.value === id) selectedId.value = null; }

async function requestRemoveNode(id: string) {
	const node = findNode(id);
	if (!node) return;
	if (hataSideStudioNodeContainsRequiredMenu(node)) {
		os.toast(i18n.ts._hata._sidebarEditor.alwaysVisible, 'ti ti-lock');
		return;
	}
	const label = node.type === 'group' ? copyx.groupQuoted({ name: getHataSideStudioGroupDisplayName(node.name) }) : copyx.itemQuoted({ name: node.type === 'widget' ? widgetDisplayLabel(node.kind, node.label) : getHataSideStudioMenuDisplayLabel(node.menuId, node.label) });
	const detail = node.type === 'group' && node.children.length > 0 ? copyx.deleteChildrenTogether({ count: node.children.length.toString() }) : copy.notFinalUntilSaved;
	if (await askStudioConfirm(copyx.deleteNamed({ name: label }), detail, copy.deleteAction, 'ti ti-trash')) removeNode(id);
}

function activateProfile(id: string) { draft.value.activeProfileId = id; selectedId.value = null; inspectorTab.value = 'layout'; closeFloatingMenus(); }

function setEditMode(mode: 'expanded' | 'collapsed') { editMode.value = mode; selectedId.value = null; inspectorTab.value = 'layout'; closeFloatingMenus(); }

function togglePreviewWidth() { setEditMode(editMode.value === 'expanded' ? 'collapsed' : 'expanded'); }

function closeFloatingMenus() { copyMenuOpen.value = false; buttonPickerOpen.value = false; widgetPickerOpen.value = false; quickEditorOpen.value = false; reorderOpen.value = false; }

function openQuickEditor(id: string) { selectNode(id); quickEditorOpen.value = true; buttonPickerOpen.value = false; widgetPickerOpen.value = false; reorderOpen.value = false; }

async function openSelectedInspector() {
	const type = selected.value?.type;
	if (type === 'button' || type === 'widget' || type === 'group') inspectorTab.value = type;
	quickEditorOpen.value = false;
	inspectorAttention.value = true;
	await nextTick();
	inspectorPaneEl.value?.focus({ preventScroll: true });
	inspectorPaneEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	window.setTimeout(() => { inspectorAttention.value = false; }, 800);
}

function groupHasLargeItems(group: HataSideGroup): boolean {
	return group.children.some(child => child.size === 'large');
}

function canSetRootColumns(columns: 1 | 2 | 3): boolean {
	return columns === 1 || !rootHasLargeItems.value;
}

function setRootColumns(columns: 1 | 2 | 3) {
	if (!canSetRootColumns(columns)) return;
	activeProfile.value.expanded.columns = columns;
}

function canSetGroupColumns(group: HataSideGroup, columns: 1 | 2 | 3): boolean {
	return columns === 1 || !groupHasLargeItems(group);
}

function canSetNodeSize(node: HataSideButton | HataSideWidget, size: HataSideButtonSize): boolean {
	if (editMode.value === 'collapsed') return size === 'small';
	if (size !== 'large') return true;
	return getHataSideNodeContainerColumns(activeProfile.value, node.id) === 1;
}

function setNodeSize(node: HataSideButton | HataSideWidget, size: HataSideButtonSize) {
	if (!canSetNodeSize(node, size)) return;
	node.size = size;
}

function setGroupLayout(group: HataSideGroup, columns: 1 | 2 | 3, masonry: boolean) {
	if (!canSetGroupColumns(group, columns)) return;
	group.columns = columns;
	if (!isUiS) group.masonry = masonry;
}

function toggleReorder() {
	reorderOpen.value = !reorderOpen.value;
	buttonPickerOpen.value = false;
	widgetPickerOpen.value = false;
	quickEditorOpen.value = false;
}

function moveReorderItem(sectionId: string, index: number, direction: -1 | 1) {
	function moveWithin<T>(items: T[]) {
		const targetIndex = index + direction;
		if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return;
		const [moving] = items.splice(index, 1);
		items.splice(targetIndex, 0, moving);
	}

	if (sectionId === 'collapsed') moveWithin(activeProfile.value.collapsed.buttons);
	else if (sectionId === 'root') moveWithin(activeProfile.value.expanded.nodes);
	else {
		const group = availableGroups.value.find(item => item.id === sectionId);
		if (group) moveWithin(group.children);
	}
}

function openButtonPicker() {
	widgetPickerOpen.value = false;
	buttonPickerOpen.value = true;
	buttonSearch.value = '';
	newButtonMenuId.value = availableMenuItems.value[0]?.id ?? '';
	newButtonShape.value = editMode.value === 'collapsed' ? 'circle' : 'rounded';
}

function confirmAddButton() {
	if (!availableMenuItems.value.some(item => item.id === newButtonMenuId.value)) return;
	const source = menuCatalog.value.find(item => item.id === newButtonMenuId.value);
	if (!source) return;
	const button = createButton(source, editMode.value === 'collapsed' ? { shape: newButtonShape.value, size: 'small', showLabel: false, borderVisible: false } : { shape: newButtonShape.value });
	if (editMode.value === 'collapsed') activeProfile.value.collapsed.buttons.push(button);
	else activeProfile.value.expanded.nodes.push(button);
	buttonPickerOpen.value = false;
	selectNode(button.id);
}

function openWidgetPicker() {
	if (editMode.value === 'collapsed') return;
	buttonPickerOpen.value = false;
	widgetPickerOpen.value = true;
	widgetSearch.value = '';
}

function confirmAddWidget() {
	if (!availableWidgetChoices.value.some(item => item.kind === newWidgetKind.value)) return;
	const widget = createWidget(newWidgetKind.value);
	activeProfile.value.expanded.nodes.push(widget);
	widgetPickerOpen.value = false;
	selectNode(widget.id);
}

const widgetSettingLabels: Record<string, string> = {
	label: copy.displayLabel,
	colored: copy.useAccentColor,
	script: copy.aiScriptToRun,
	showHeader: copy.showHeading,
	height: copy.contentHeight,
	maxEntries: copy.displayItemCount,
	size: copy.clockFaceSize,
	fontSize: copy.fontSize,
	showMs: copy.showMilliseconds,
	showLabel: copy.showAuxiliaryLabel,
	maxItems: copy.flowerCount,
};

function widgetBaseSettingEntries(widget: HataSideWidget) {
	return Object.entries(widget.data ?? {}).map(([key, value]) => ({
		key,
		label: widget.kind === 'button' && key === 'label' ? copy.buttonText : widgetSettingLabels[key] ?? key,
		value,
		type: key === 'script' ? 'multiline' : typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'text',
	}));
}

function setWidgetBaseSetting(widget: HataSideWidget, key: string, value: unknown) {
	widget.data = { ...(widget.data ?? {}), [key]: value };
}

function widgetSizeSettingEntries(widget: HataSideWidget, size: HataSideButtonSize) {
	const values = widget.sizeSettings[size].data ?? {};
	return Object.entries(values).map(([key, value]) => ({
		key,
		label: widgetSettingLabels[key] ?? key,
		value,
		type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'text',
	}));
}

function setWidgetSizeSetting(widget: HataSideWidget, size: HataSideButtonSize, key: string, value: unknown) {
	widget.sizeSettings[size].data = { ...(widget.sizeSettings[size].data ?? {}), [key]: value };
}

function changeWidgetKind(widget: HataSideWidget, kind: HataSideWidgetKind) {
	const replacement = createWidget(kind);
	widget.kind = replacement.kind;
	widget.label = replacement.label;
	widget.data = replacement.data;
	widget.sizeSettings = replacement.sizeSettings;
	widget.content = replacement.content;
}

function addGroup() { if (editMode.value === 'collapsed') return; const group = createGroup(); activeProfile.value.expanded.nodes.push(group); openQuickEditor(group.id); }

async function copyLayout(direction: 'expandedToCollapsed' | 'collapsedToExpanded') {
	const target = direction === 'expandedToCollapsed' ? copy.collapsedMenu : copy.expandedMenu;
	if (!await askStudioConfirm(copyx.copyToMenu({ target }), copyx.replaceCurrentOrder({ target }), copy.copyAction, 'ti ti-copy')) return;
	replaceActiveProfile(direction === 'expandedToCollapsed' ? copyExpandedToCollapsed(activeProfile.value) : copyCollapsedToExpanded(activeProfile.value));
	setEditMode(direction === 'expandedToCollapsed' ? 'collapsed' : 'expanded');
}

async function importCurrentSidebar() {
	copyMenuOpen.value = false;
	if (!await askStudioConfirm(copy.importCurrentOrder, copy.rebuildFromCurrentSidebar, copy.importAction, 'ti ti-list-check')) return;
	const profile = createDefaultProfile(prefer.r['simpleUi.sidebar'].value as any[], activeProfile.value.name);
	profile.id = activeProfile.value.id;
	replaceActiveProfile(profile);
	setEditMode('expanded');
}

function openSettingsTransfer() {
	const { dispose } = popup(defineAsyncComponent(() => import('@/components/MkHataSettingsTransfer.vue')), {}, { closed: () => dispose() });
}

function moveSelectedTo(groupId: string) {
	if (!selected.value || selected.value.type === 'group' || editMode.value === 'collapsed') return;
	const moving = selected.value;
	const containerId = groupId || 'root';
	if (!canPlaceNodeInContainer(moving, containerId)) {
		os.toast(copy.cannotMoveLargeIntoMultipleColumns, 'ti ti-layout-grid');
		return;
	}
	activeProfile.value.expanded.nodes = activeProfile.value.expanded.nodes
		.filter(node => node.id !== moving.id)
		.map(node => node.type === 'group' ? { ...node, children: node.children.filter(child => child.id !== moving.id) } : node);
	if (groupId) {
		const target = activeProfile.value.expanded.nodes.find((node): node is HataSideGroup => node.type === 'group' && node.id === groupId);
		target?.children.push(moving);
	} else {
		activeProfile.value.expanded.nodes.push(moving);
	}
}

async function mergeSelectedGroup() { if (!selectedId.value || !mergeTargetId.value) return; if (!await askStudioConfirm(copy.mergeGroups, copy.mergeSelectedGroupDescription, copy.mergeAction, 'ti ti-arrows-join')) return; const sourceId = selectedId.value; const targetId = mergeTargetId.value; const merged = mergeHataSideGroups(activeProfile.value, sourceId, targetId); merged.expanded.nodes = merged.expanded.nodes.filter(node => node.id !== sourceId); replaceActiveProfile(merged); selectedId.value = targetId; mergeTargetId.value = ''; }

async function chooseDirectTarget(button: HataSideButton) { const collection = button.menuId === 'lists' ? await userListsCache.fetch().catch(() => []) : await antennasCache.fetch().catch(() => []); if (collection.length === 0) { await openStudioDialog({ kind: 'confirm', title: copy.noSelectableItems, text: button.menuId === 'lists' ? copy.noListsCreateFirst : copy.noAntennasCreateFirst, icon: 'ti ti-info-circle', confirmLabel: copy.close, cancelLabel: '', value: '', options: [] }); return; } const result = await askStudioSelect(button.menuId === 'lists' ? copy.directList : copy.directAntenna, copy.selectDirectTargetDescription, collection.map((item: any) => ({ value: item.id, label: item.name }))); if (result) button.targetId = result; }

async function renameProfile() { const result = await askStudioPrompt(copy.profileName, copy.profileNameDescription, activeProfile.value.name); if (result) activeProfile.value.name = result.slice(0, 80); }

async function addProfile() { if (draft.value.profiles.length >= profileLimit.value) { await openStudioDialog({ kind: 'confirm', title: copy.profileLimit, text: copyx.profileLimitDescription({ limit: profileLimit.value.toString() }), icon: 'ti ti-alert-circle', confirmLabel: copy.close, cancelLabel: '', value: '', options: [] }); return; } const profile = createDefaultProfile(prefer.r['simpleUi.sidebar'].value as any[], `プロファイル ${draft.value.profiles.length + 1}`); draft.value.profiles.push(profile); draft.value.activeProfileId = profile.id; selectedId.value = null; }

async function removeProfile() { if (draft.value.profiles.length <= 1) return; if (!await askStudioConfirm(copy.deleteProfile, copyx.deleteProfileDescription({ name: profileDisplayName(activeProfile.value.name) }), copy.deleteAction, 'ti ti-trash')) return; const index = activeProfileIndex(); draft.value.profiles.splice(index, 1); draft.value.activeProfileId = draft.value.profiles[Math.max(0, index - 1)].id; selectedId.value = null; }

function resetProfile() { const profile = createDefaultProfile(prefer.r['simpleUi.sidebar'].value as any[], activeProfile.value.name); profile.id = activeProfile.value.id; replaceActiveProfile(profile); resetConfirmOpen.value = false; selectedId.value = null; }

function restoreHistory(index: number) { if (index < 0 || index >= history.value.length) return; historyLocked = true; historyIndex.value = index; draft.value = cloneHataSideStudioStore(history.value[index]); selectedId.value = null; queueMicrotask(() => { historyLocked = false; }); }

function undo() { restoreHistory(historyIndex.value - 1); }

function redo() { restoreHistory(historyIndex.value + 1); }

function save() {
	if (draft.value.profiles.length > profileLimit.value) {
		void openStudioDialog({ kind: 'confirm', title: copy.cannotSave, text: copyx.profileLimitShort({ limit: profileLimit.value.toString() }), icon: 'ti ti-alert-circle', confirmLabel: copy.close, cancelLabel: '', value: '', options: [] });
		return false;
	}
	for (const profile of draft.value.profiles) profile.updatedAt = new Date().toISOString();
	applyHataSideStudioStore(draft.value);
	// 保存時の安全補正後に実際に使われる値を編集画面へ戻し、見た目と保存結果の
	// 食い違い・保存ボタンの再点灯を防ぐ。
	historyLocked = true;
	const saved = cloneHataSideStudioStore(hataSideStudioStore.value);
	draft.value = saved;
	original.value = cloneHataSideStudioStore(saved);
	history.value = [cloneHataSideStudioStore(saved)];
	historyIndex.value = 0;
	queueMicrotask(() => { historyLocked = false; });
	os.toast(copy.savedToThisDevice, 'ti ti-device-floppy');
	return true;
}

function buttonDetail(menuId: string): string {
	if (menuId === 'hatafeed') return ($i?.isAdmin || $i?.isModerator) ? copy.hatafeedAdminDetail : copy.hatafeedUserDetail;
	if (menuId === 'hatask') return copy.hataskDetail;
	if (menuId === 'hatady') return copy.hatadyDetail;
	if (menuId === 'notifications') return Number($i?.unreadNotificationsCount ?? 0) > 0 ? copyx.recentNotificationsUnread({ count: String($i?.unreadNotificationsCount) }) : copy.noNewNotifications;
	if (menuId === 'announcements') return copy.announcementsDetail;
	if (menuId === 'search') return copy.searchBox;
	if (menuId === 'chat') return copy.chatDetail;
	if (menuId === 'channels') return copy.channelsDetail;
	return copy.open;
}

function runPreviewSearch(query: string) {
	const normalized = query.trim();
	studioRouter.pushByPath(normalized ? `/search?q=${encodeURIComponent(normalized)}` : '/search');
}

function startTutorial() {
	closeFloatingMenus();
	tutorialIndex.value = 0;
	tutorialOpen.value = true;
}

function advanceTutorial() {
	if (tutorialIndex.value < tutorialSteps.length - 1) {
		tutorialIndex.value++;
		return;
	}
	finishTutorial(false);
}

function finishTutorial(skipped: boolean) {
	tutorialOpen.value = false;
	miLocalStorage.setItem('hataSideStudioTutorialDone', '1');
	claimAchievement('hataSideStudioPioneer');
	os.toast(skipped ? copy.tutorialSkipped : copy.studioReady, skipped ? 'ti ti-player-skip-forward' : 'ti ti-confetti');
}

const leaveConfirmOpen = ref(false);
const pendingPath = ref<string | null>(null);
const pendingNavigationMode = ref<'push' | 'replace'>('push');
const previousNavHook = studioRouter.navHook;
let bypassNavigation = false;
let studioPageActive = true;
const studioNavHook: NonNullable<typeof studioRouter.navHook> = (fullPath, flag) => {
	if (studioPageActive && !bypassNavigation && hasChanges.value && (!inHataGoes || hataGoesHost?.active.value)) {
		pendingPath.value = fullPath;
		pendingNavigationMode.value = 'push';
		leaveConfirmOpen.value = true;
		return true;
	}
	return previousNavHook?.(fullPath, flag) ?? false;
};
studioRouter.navHook = studioNavHook;

function onBeforeUnload(event: BeforeUnloadEvent) { if (!studioPageActive || !hasChanges.value) return; event.preventDefault(); event.returnValue = ''; }

window.addEventListener('beforeunload', onBeforeUnload);
onMounted(() => {
	if (miLocalStorage.getItem('hataSideStudioTutorialDone') !== '1') startTutorial();
});
// RouterView keeps editors alive after navigation. Their retained hook must
// pass through while another page is visible, then protect edits on re-entry.
onActivated(() => { studioPageActive = true; });
onDeactivated(() => { studioPageActive = false; cancelLeave(); });
onBeforeUnmount(() => { studioPageActive = false; if (historyTimer) window.clearTimeout(historyTimer); if (studioRouter.navHook === studioNavHook) studioRouter.navHook = previousNavHook; window.removeEventListener('beforeunload', onBeforeUnload); window.removeEventListener('pointermove', updateDragPointer); window.document.removeEventListener('dragover', updateDragPointer); window.removeEventListener('touchmove', updateDragPointer); window.removeEventListener('resize', updateDragTimelinePosition); });

function navigatePending() { const path = pendingPath.value ?? '/settings/hata-custom'; const mode = pendingNavigationMode.value; pendingPath.value = null; pendingNavigationMode.value = 'push'; leaveConfirmOpen.value = false; bypassNavigation = true; try { if (mode === 'replace' && path === '/settings/hata-custom') studioRouter.replace('/settings/hata-custom'); else studioRouter.pushByPath(path); } finally { bypassNavigation = false; } }

function confirmLeave(saveFirst: boolean) { if (saveFirst && !save()) return; navigatePending(); }

function saveAndLeave() { confirmLeave(true); }

function cancelLeave() { pendingPath.value = null; pendingNavigationMode.value = 'push'; leaveConfirmOpen.value = false; }

function closeStudio() { if (hasChanges.value) { pendingPath.value = '/settings/hata-custom'; pendingNavigationMode.value = 'replace'; leaveConfirmOpen.value = true; } else studioRouter.replace('/settings/hata-custom'); }

function openRoleSettings() { studioRouter.push('/admin/roles'); }

definePage(() => ({
	title: 'HataSideStudio',
	icon: 'ti ti-layout-sidebar-left-expand',
}));
</script>

<style lang="scss" module>
@use '../components/hataskey3/side-nav-item' as sideNavItem;
.root[data-goes-host="true"] .sheetEnterActive,.root[data-goes-host="true"] .sheetLeaveActive,.teleportTheme[data-goes-host="true"] .sheetEnterActive,.teleportTheme[data-goes-host="true"] .sheetLeaveActive { transition:opacity .16s ease,transform .16s ease !important; }
.root[data-goes-host="true"] .sheetEnterFrom,.root[data-goes-host="true"] .sheetLeaveTo,.teleportTheme[data-goes-host="true"] .sheetEnterFrom,.teleportTheme[data-goes-host="true"] .sheetLeaveTo { opacity:0; }
.featureList { display:grid;gap:4px;max-height:250px;overflow:auto;padding:4px;border:1px solid var(--studioLine);border-radius:11px;background:var(--studioSurface); }
.featureList button { display:grid;grid-template-columns:24px minmax(0,1fr) 18px;align-items:center;gap:8px;min-height:42px;padding:8px;text-align:left;border-radius:8px; }
.featureList button[aria-checked="true"] { color:var(--studioAccentFg);background:var(--studioAccent); }
.featureList button span { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.featureList p { margin:8px;color:var(--studioMuted);font-size:.8rem; }
.root[data-goes-host="true"] .copyMenu,.root[data-goes-host="true"] .resetConfirm { position:fixed;z-index:3500010;top:auto;right:0;bottom:0;left:0;width:auto;max-height:75dvh;overflow:auto;padding:20px;border-radius:20px 20px 0 0;box-shadow:0 -14px 42px #0004; }
.teleportTheme[data-goes-host="true"] .creationPicker,.teleportTheme[data-goes-host="true"] .quickEditor,.teleportTheme[data-goes-host="true"] .reorderWindow { top:auto;bottom:0;left:50%;width:min(100%,560px);max-height:78dvh;border-radius:20px 20px 0 0;transform:translateX(-50%);box-shadow:0 -14px 42px #0004; }
.root[data-goes-host="true"] .sheetEnterFrom,.root[data-goes-host="true"] .sheetLeaveTo,.teleportTheme[data-goes-host="true"] .sheetEnterFrom,.teleportTheme[data-goes-host="true"] .sheetLeaveTo { transform:translateY(6px); }
.teleportTheme[data-goes-host="true"] .sheetEnterFrom,.teleportTheme[data-goes-host="true"] .sheetLeaveTo { transform:translate(-50%,6px); }

@font-face {
	font-family:'Righteous';
	font-style:normal;
	font-weight:400;
	font-display:swap;
	src:url('/client-assets/Righteous-Regular.woff2') format('woff2');
}

/* HataSideStudio本番画面。合意済みモックと実サイドバーの構造を同じ順に組む。 */
.root {
	--studioControlSize:34px;
	--studioRailWidth:76px;
	--studioRailHeight:64px;
	--studioBg: light-dark(#f5f1eb, #15171c);
	--studioSurface: light-dark(#fffdf9, #21242b);
	--studioRaised: light-dark(#fff, #292d35);
	--studioMuted: light-dark(#6c655c, #c0b8ad);
	--studioLine: light-dark(#ddd4c8, #40454f);
	--studioAccent: light-dark(#7156c5, #ac98f2);
	--studioAccentFg: light-dark(#fff, #181320);
	--studioAccentSoft: light-dark(#eee8ff, #39314f);
	--studioDanger: light-dark(#b54751, #f0929a);
	--studioDangerSoft: light-dark(#fff0f1, #4b292e);
	--studioSuccess: light-dark(#337b64, #79c5ad);
	min-height:100%;
	padding:0;
	color:var(--MI_THEME-fg);
	background:var(--studioBg);
	container-type:inline-size;
}
.teleportTheme {
	/* Hataskey UIデッキやHataskの全画面層より上、通知トーストより下。
	   全Teleportをビューポート基準にし、デッキ内のoverflowとスタッキングから切り離す。 */
	position:fixed;
	z-index:3500000;
	inset:0;
	pointer-events:none;
	--studioBg: light-dark(#f5f1eb, #15171c);
	--studioSurface: light-dark(#fffdf9, #21242b);
	--studioRaised: light-dark(#fff, #292d35);
	--studioMuted: light-dark(#6c655c, #c0b8ad);
	--studioLine: light-dark(#ddd4c8, #40454f);
	--studioAccent: light-dark(#7156c5, #ac98f2);
	--studioAccentFg: light-dark(#fff, #181320);
	--studioAccentSoft: light-dark(#eee8ff, #39314f);
	--studioDanger: light-dark(#b54751, #f0929a);
	color:var(--MI_THEME-fg);
}
.creationPicker,.quickEditor,.reorderWindow,.dragTimeline,.studioDialogWindow,.windowLayer,.tutorialWindow { pointer-events:auto; }
.header {
	display:grid;
	grid-template-columns:minmax(250px,auto) minmax(260px,1fr) auto;
	align-items:center;
	gap:14px;
	max-width:none;
	margin:0;
	padding:14px 18px;
	border:0;
	border-bottom:1px solid var(--studioLine);
	border-radius:0;
	background:var(--studioRaised);
	box-shadow:none;
}
.brand { display:flex;align-items:center;gap:10px;min-width:0; }
.backButton,.profileRename,.profileAdd,.historyButton { display:grid;place-items:center;flex:0 0 auto;width:34px;height:34px;padding:0;border:1px solid var(--studioLine);border-radius:10px;background:var(--studioSurface); }
.logo { font-family:'Righteous',system-ui,sans-serif;font-size:1.28rem;font-weight:400;letter-spacing:.02em;white-space:nowrap; }
.profileBar { display:flex;align-items:center;justify-content:center;gap:6px;min-width:0;flex-wrap:wrap; }
.profileTab,.profileAdd { min-height:34px;padding:6px 11px;color:var(--studioMuted);border:1px solid var(--studioLine);border-radius:999px;background:var(--studioSurface); }
.profileTab[aria-pressed="true"] { color:var(--studioAccentFg);border-color:var(--studioAccent);background:var(--studioAccent); }
.profileRename,.profileAdd { width:var(--studioControlSize);height:var(--studioControlSize);min-height:var(--studioControlSize);padding:0;border-radius:999px;color:var(--studioAccent); }
.profileAdd { border-color:var(--studioAccent); }
.profileLimit { color:var(--studioMuted);font-size:.78rem;white-space:nowrap; }
.headerActions { display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0;flex-wrap:wrap; }
.headerControlGroup { display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0; }
.dirty { display:inline-flex;align-items:center;gap:5px;color:var(--studioDanger);font-size:.78rem; }
.historyActions { display:flex;align-items:center;gap:3px;padding:3px;border:1px solid var(--studioLine);border-radius:12px;background:var(--studioBg); }
.historyButton { border:0;background:transparent;color:var(--studioMuted); }
.historyButton:hover:not(:disabled) { color:var(--MI_THEME-fg);background:var(--studioSurface); }
.historyButton:disabled { opacity:.35; }
.actionButton { display:flex;align-items:center;gap:6px;min-height:38px;padding:8px 12px;border:1px solid var(--studioLine);border-radius:11px; }
.resetWrap { position:relative; }
.resetConfirm { position:absolute;z-index:80;top:43px;right:0;width:270px;padding:14px;border:1px solid var(--studioLine);border-radius:14px;background:var(--studioRaised);box-shadow:0 16px 44px #0005;display:grid;gap:8px; }
.resetConfirm span { color:var(--studioMuted);font-size:.78rem; }
.resetConfirm > div { display:flex;justify-content:flex-end;gap:8px; }
.main { display:grid;grid-template-columns:minmax(390px,1fr) minmax(430px,1fr);gap:1px;background:var(--studioLine); }
.pane { min-width:0;padding:18px;background:var(--studioSurface); }
.paneHead { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px; }
.paneHead > div:first-child { display:flex;align-items:baseline;gap:10px; }
.paneHead h2 { margin:0;font-size:1.05rem;font-weight:600; }
.paneHead span { color:var(--studioMuted);font-size:.76rem; }
.previewHeadActions { display:flex;align-items:center;gap:8px; }
.copyWrap { position:relative; }
.copyButton { display:flex;align-items:center;gap:6px;min-height:36px;padding:7px 10px;border:1px solid var(--studioLine);border-radius:10px;background:var(--studioRaised); }
.copyMenu { position:absolute;z-index:70;top:42px;right:0;width:300px;padding:6px;border:1px solid var(--studioLine);border-radius:14px;background:var(--studioRaised);box-shadow:0 16px 46px #0005;display:grid;gap:3px; }
.copyMenu button { display:grid;grid-template-columns:28px 1fr;align-items:center;gap:8px;width:100%;padding:9px;text-align:left;border-radius:9px; }
.copyMenu button:hover { background:var(--studioAccentSoft); }
.copyMenu button > i { font-size:20px;color:var(--studioAccent); }
.copyMenu button span { display:grid;color:var(--MI_THEME-fg); }
.copyMenu small { color:var(--studioMuted);font-size:.7rem; }
.modeTabs { display:flex;align-items:center;gap:3px;padding:3px;border:1px solid var(--studioLine);border-radius:11px;background:var(--studioBg); }
.modeTabs button { min-height:30px;padding:5px 9px;border-radius:8px;font-size:.76rem; }
.modeTabs button[aria-pressed="true"] { color:var(--studioAccentFg);background:var(--studioAccent); }
.stage { position:relative;display:grid;place-items:start center;min-height:900px;padding:20px 74px 20px 104px;border-radius:20px;background:radial-gradient(circle at 18% 14%,color-mix(in srgb,var(--studioAccent) 18%,transparent),transparent 31%),radial-gradient(circle at 84% 78%,color-mix(in srgb,var(--studioSuccess) 16%,transparent),transparent 34%),var(--studioBg); }
.sideTools { position:absolute;top:50%;z-index:25;display:grid;gap:8px;transform:translateY(-50%); }
.sideTools[data-side="left"] { left:10px; }
.sideTools[data-side="right"] { right:10px; }
.addAction { display:grid;place-items:center;gap:4px;width:var(--studioRailWidth);height:var(--studioRailHeight);min-height:var(--studioRailHeight);padding:7px;color:var(--studioAccent);border:1px solid color-mix(in srgb,var(--studioAccent) 48%,var(--studioLine));border-radius:12px;background:var(--studioAccentSoft); }
.addAction i { font-size:1.25rem; }
.addAction span,.bulkAction span,.reorderAction span { font-size:.7rem;line-height:1.25;text-align:center;overflow-wrap:anywhere; }
.addAction:disabled { opacity:.42;cursor:not-allowed; }
.bulkAction { display:grid;place-items:center;gap:3px;width:var(--studioRailWidth);height:var(--studioRailHeight);min-height:var(--studioRailHeight);padding:6px;color:var(--studioDanger);border:1px solid color-mix(in srgb,var(--studioDanger) 45%,var(--studioLine));border-radius:13px;background:var(--studioDangerSoft);transition:transform .16s ease,box-shadow .16s ease; }
.bulkAction[aria-pressed="true"] { color:#fff;border-color:var(--studioDanger);background:var(--studioDanger); }
.deleteDropArmed { transform:scale(1.07);box-shadow:0 0 0 4px color-mix(in srgb,var(--studioDanger) 28%,transparent),0 12px 30px #0004; }
.reorderAction { display:grid;place-items:center;gap:3px;width:var(--studioRailWidth);height:var(--studioRailHeight);min-height:var(--studioRailHeight);padding:6px;color:var(--studioAccent);border:1px solid color-mix(in srgb,var(--studioAccent) 45%,var(--studioLine));border-radius:13px;background:var(--studioAccentSoft); }
.reorderAction[aria-pressed="true"] { color:var(--studioAccentFg);border-color:var(--studioAccent);background:var(--studioAccent); }
.creationPicker { position:fixed;z-index:10030;top:50%;left:50%;width:min(340px,calc(100% - 24px));max-height:calc(100dvh - 24px);padding:14px;box-sizing:border-box;border:1px solid var(--studioLine);border-radius:15px;background:var(--studioRaised);box-shadow:0 18px 52px #0005;display:grid;gap:11px;overflow:auto;transform:translate(-50%,-50%); }
.quickEditor { position:fixed;z-index:10030;top:50%;left:50%;width:min(430px,calc(100% - 24px));max-height:calc(100dvh - 24px);padding:14px;box-sizing:border-box;border:1px solid var(--studioLine);border-radius:15px;background:var(--studioRaised);box-shadow:0 18px 52px #0005;display:grid;gap:11px;overflow:auto;transform:translate(-50%,-50%); }
.quickSection { display:grid;gap:7px; }
.quickSection > b,.quickField > span { color:var(--studioMuted);font-size:.72rem;font-weight:600; }
.quickField { display:grid;gap:5px; }
.quickColors { display:grid;grid-template-columns:repeat(3,1fr);gap:8px; }
.quickColors label { display:grid;gap:4px;color:var(--studioMuted);font-size:.7rem; }
.quickColors input { width:100%;height:34px;padding:0;border:0;background:none; }
.gradientControls { display:grid;gap:8px;padding:10px;border:1px solid var(--studioLine);border-radius:12px;background:var(--studioSurface); }
.quickGradientPreview { height:42px;border:1px solid var(--studioLine);border-radius:10px; }
.layoutPicker { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px; }
.layoutPicker button { display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;padding:7px;border:1px solid var(--studioLine);border-radius:10px; }
.layoutPicker button[aria-pressed="true"] { color:var(--studioAccentFg);border-color:var(--studioAccent);background:var(--studioAccent); }
.layoutPicker button:disabled,.choiceRow button:disabled { opacity:.34;cursor:not-allowed; }
.reorderWindow { position:fixed;z-index:10030;top:50%;left:50%;width:min(410px,calc(100% - 24px));max-height:calc(100dvh - 24px);padding:14px;box-sizing:border-box;border:1px solid var(--studioLine);border-radius:15px;background:var(--studioRaised);box-shadow:0 18px 52px #0005;display:grid;gap:12px;overflow:auto;transform:translate(-50%,-50%); }
.pickerHead > div { display:grid;gap:2px; }.pickerHead small { color:var(--studioMuted);font-size:.68rem; }
.reorderSection { display:grid;gap:6px;padding:10px;border:1px solid var(--studioLine);border-radius:12px;background:color-mix(in srgb,var(--studioSurface) 76%,transparent); }
.reorderSection:not([data-container="root"]):not([data-container="collapsed"]) { border-color:color-mix(in srgb,var(--studioAccent) 60%,var(--studioLine));background:color-mix(in srgb,var(--studioAccentSoft) 50%,var(--studioSurface));box-shadow:inset 3px 0 0 color-mix(in srgb,var(--studioAccent) 74%,transparent); }
.reorderSection > b { display:flex;align-items:center;min-height:24px;padding:0 3px 5px;color:var(--studioMuted);border-bottom:1px solid color-mix(in srgb,var(--studioLine) 72%,transparent);font-size:.72rem; }
.reorderRow { display:grid;grid-template-columns:22px minmax(0,1fr) 30px 30px;align-items:center;gap:6px;padding:6px;border-radius:9px;background:var(--studioSurface); }
.reorderRow span { min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.76rem; }
.reorderRow button { display:grid;place-items:center;width:30px;height:30px;border:1px solid var(--studioLine);border-radius:8px; }
.reorderRow button:disabled { opacity:.3; }
.dragHint { position:fixed;z-index:10040;display:flex;align-items:center;gap:7px;width:min(240px,calc(100% - 16px));padding:8px 10px;border:1px solid var(--studioAccent);border-radius:12px;color:var(--studioAccentFg);background:var(--studioAccent);box-shadow:0 10px 28px #0005;font-size:.68rem;line-height:1.35;pointer-events:none; }
.dragTimeline { position:fixed;z-index:10035;right:auto;bottom:auto;display:grid;gap:9px;width:min(224px,calc(100% - 24px));padding:10px;box-sizing:border-box;border:1px solid color-mix(in srgb,var(--studioAccent) 65%,var(--studioLine));border-radius:15px;background:color-mix(in srgb,var(--studioRaised) 94%,transparent);box-shadow:0 18px 52px #0005;overflow:auto;backdrop-filter:blur(14px); }
.dragTimelineHead { display:flex;align-items:center;gap:8px;padding:2px 3px 7px;border-bottom:1px solid var(--studioLine); }
.dragTimelineHead > i { color:var(--studioAccent);font-size:20px; }.dragTimelineHead > span { display:grid; }.dragTimelineHead small { color:var(--studioMuted);font-size:.62rem; }
.dragTimelineDelete { position:sticky;z-index:2;top:0;display:grid;grid-template-columns:24px minmax(0,1fr);align-items:center;gap:7px;min-height:46px;padding:7px 9px;color:var(--studioDanger);border:1px solid color-mix(in srgb,var(--studioDanger) 55%,var(--studioLine));border-radius:10px;background:var(--studioDangerSoft);text-align:left; }
.dragTimelineDelete > i { font-size:20px; }.dragTimelineDelete > span { display:grid; }.dragTimelineDelete small { color:inherit;font-size:.62rem;opacity:.72; }
.dragTimelineSection { display:grid;gap:3px;padding:7px;border:1px solid var(--studioLine);border-radius:11px;background:color-mix(in srgb,var(--studioSurface) 78%,transparent); }
.dragTimelineSection:not([data-container="root"]):not([data-container="collapsed"]) { border-color:color-mix(in srgb,var(--studioAccent) 62%,var(--studioLine));background:color-mix(in srgb,var(--studioAccentSoft) 54%,var(--studioSurface));box-shadow:inset 3px 0 0 color-mix(in srgb,var(--studioAccent) 72%,transparent); }
.dragTimelineSection > strong { margin-bottom:2px;padding-inline:2px;color:var(--studioMuted);font-size:.65rem; }
.dragTimelineItem { display:grid;grid-template-columns:18px minmax(0,1fr);align-items:center;gap:6px;min-height:29px;padding:4px 7px;color:var(--MI_THEME-fg);border:1px solid var(--studioLine);border-radius:8px;background:var(--studioSurface);font-size:.67rem; }
.dragTimelineItem span { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.dragTimelineGap { display:grid;grid-template-columns:16px minmax(0,1fr);align-items:center;gap:4px;min-height:22px;margin:0 7px;padding:2px 6px;color:var(--studioMuted);border:1px dashed color-mix(in srgb,var(--studioAccent) 38%,var(--studioLine));border-radius:7px;background:color-mix(in srgb,var(--studioAccentSoft) 55%,transparent);text-align:left;font-size:.59rem;transition:min-height .12s ease,margin .12s ease,background .12s ease; }
.dragTimelineGap span { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }.dragTimelineGap[data-active="true"] { min-height:32px;margin-block:2px;color:var(--studioAccentFg);border-style:solid;border-color:var(--studioAccent);background:var(--studioAccent); }
.dragTimelineGap[data-disabled="true"] { opacity:.3;cursor:not-allowed; }
.creationPicker label { display:grid;gap:5px;font-size:.78rem;color:var(--studioMuted); }
.pickerHead,.pickerActions { display:flex;align-items:center;justify-content:space-between;gap:8px; }
.pickerHead button { width:30px;height:30px;border-radius:9px; }
.pickerActions { justify-content:flex-end; }
.pickerActions button { min-height:34px;padding:7px 11px;border-radius:9px; }
.select,.input,.textarea { width:100%;min-width:0;box-sizing:border-box;padding:9px 11px;border:1px solid var(--studioLine);border-radius:10px;color:var(--MI_THEME-fg);background:var(--studioSurface); }
.textarea { resize:vertical;font:inherit;line-height:1.45; }
.shapePicker { display:grid;grid-template-columns:repeat(3,1fr);gap:7px; }
.shapePicker button { display:grid;place-items:center;gap:4px;min-height:64px;padding:7px;border:1px solid var(--studioLine);border-radius:11px; }
.shapePicker button[aria-pressed="true"] { border-color:var(--studioAccent);background:var(--studioAccentSoft); }
.shapePicker button > span,.shapeSample { display:block;width:30px;height:24px;border:2px solid currentColor;border-radius:7px; }
.shapePicker [data-shape="circle"],.shapeSample[data-shape="circle"] { width:25px;border-radius:50%;aspect-ratio:1; }
.shapePicker [data-shape="pill"],.shapeSample[data-shape="pill"] { width:38px;border-radius:999px; }
.shapePicker small { font-size:.68rem; }
.sidebarPreview { width:min(100%,300px);height:780px;margin:0 auto;padding:11px;box-sizing:border-box;display:flex;flex-direction:column;border:1px solid var(--studioLine);border-radius:20px;background:color-mix(in srgb,var(--MI_THEME-navBg) 94%,var(--studioAccent));box-shadow:0 12px 34px #0003;overflow:hidden;transition:width .2s ease,padding .2s ease; }
.sidebarPreviewWide { width:min(100%,380px); }
.sidebarPreviewCollapsed { width:64px;padding-inline:8px; }
.serverRow { display:grid;grid-template-columns:40px minmax(0,1fr) 34px 34px;align-items:center;gap:4px;margin-bottom:10px; }
.serverIcon { display:grid;place-items:center;width:40px;height:40px;padding:0;overflow:hidden;border:0;border-radius:12px;background:var(--studioAccent);color:#fff; }
.serverIcon img { width:100%;height:100%;object-fit:cover; }
.serverName { display:grid;gap:1px;min-width:0;padding-inline:7px;text-align:left;line-height:1.08; }
.serverName small { font-size:.6rem;opacity:.58; }
.serverName b { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem; }
.serverAction { display:grid;place-items:center;width:34px;height:34px;padding:0;border-radius:9px; }
.sidebarPreviewCollapsed .serverRow { display:flex;flex-direction:column;gap:6px; }
.sidebarPreviewCollapsed .serverAction { flex:0 0 34px; }
.customArea { flex:1;min-height:0;padding:3px 5px 10px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin; }
.customArea[data-parallax="on"] .expandedNodes { transform:translateY(var(--hss-parallax,0)); }
.expandedNodes { display:grid;grid-template-columns:repeat(var(--hss-normal-columns,1),minmax(0,1fr));align-items:start;gap:4px;min-width:0;padding:10px;box-sizing:border-box;overflow:visible; }
.previewNode { position:relative;min-width:0;box-sizing:border-box;overflow:visible; }
.previewNode[data-selected="true"],.previewButton[data-selected="true"],.previewWidget[data-selected="true"],.collapsedButton[data-selected="true"] { outline:2px solid var(--studioAccent);outline-offset:2px;box-shadow:0 0 0 1px color-mix(in srgb,var(--studioAccent) 42%,transparent); }
.previewGroup { grid-column:1/-1;padding:9px;color:var(--hss-fg);border:var(--hss-border-width,1px) var(--hss-border-style,solid) var(--hss-border);border-radius:15px;background:var(--hss-bg);background-clip:padding-box;overflow:visible; }
.groupHead { display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:26px;margin-bottom:6px;font-size:.72rem;font-weight:600; }
.groupHead > div { display:flex;align-items:center;gap:4px; }
.groupHead button { display:grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid var(--studioLine);border-radius:8px;background:var(--studioSurface); }
.groupHead .hssDrag { cursor:grab;touch-action:none; }
.contrastWarning { color:#684300!important;border-color:#e0a92f!important;background:#fff0ba!important;animation:contrastPulse 2.4s ease-in-out infinite; }
@keyframes contrastPulse { 0%,100% { box-shadow:0 0 0 0 #e0a92f00; } 45% { box-shadow:0 0 0 4px #e0a92f35; } }
.contrastPopover { position:absolute;z-index:45;top:44px;left:8px;right:8px;display:grid;gap:9px;padding:12px;color:var(--MI_THEME-fg);border:1px solid #e0a92f;border-radius:13px;background:var(--studioRaised);box-shadow:0 16px 42px #0005; }
.contrastPopover header { display:grid;grid-template-columns:22px minmax(0,1fr) 28px;align-items:center;gap:7px;color:#a26b00; }
.contrastPopover header button { width:28px;height:28px;border-radius:8px; }.contrastPopover p { margin:0;color:var(--studioMuted);font-size:.7rem;line-height:1.45; }
.contrastPopover > div { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }.contrastPopover > div > button { min-height:34px;padding:7px 10px;border-radius:9px; }.contrastPopover label { display:flex;align-items:center;gap:6px;color:var(--studioMuted);font-size:.68rem; }.contrastPopover input { width:38px;height:30px;padding:0;border:0;background:none; }
.groupGrid { position:relative;display:grid;grid-template-columns:repeat(var(--hss-columns,1),minmax(0,1fr));align-items:start;gap:4px;min-width:0;min-height:46px;padding:4px;box-sizing:border-box;border-radius:10px; }
.groupGrid[data-empty="true"]::before { content:v-bind(emptyGroupDropText);position:absolute;inset:0;display:grid;place-items:center;padding:8px;border:1px dashed var(--studioLine);border-radius:10px;color:var(--studioMuted);font-size:.62rem;text-align:center;pointer-events:none; }
.previewGroup[data-masonry="on"] .groupGrid { display:block;columns:var(--hss-columns,1);column-gap:7px; }
.previewGroup[data-masonry="on"] .previewButton,.previewGroup[data-masonry="on"] .previewWidget { width:100%;margin:0 0 7px;break-inside:avoid; }
.previewGroup[data-masonry="on"] .previewWidget { column-span:all; }
.previewButton { position:relative;display:flex;align-items:center;gap:7px;width:100%;min-width:0;min-height:38px;margin-block:var(--hss-rotation-space,0);padding:6px 8px;box-sizing:border-box;color:var(--hss-fg);border:var(--hss-border-width,1px) var(--hss-border-style,solid) var(--hss-border);border-radius:11px;background:var(--hss-bg);background-clip:padding-box;transform:rotate(var(--hss-rotation));transform-origin:center;overflow:visible; }
.buttonPreviewBody { display:flex;align-items:center;gap:7px;min-width:0;width:100%; }
.buttonPreviewBody > i,.largeButtonPreview > i { flex:0 0 auto;font-size:18px; }
.buttonPreviewBody > span,.largeButtonPreview > span { display:grid;min-width:0; }
.buttonPreviewBody b,.buttonPreviewBody small,.largeButtonPreview b { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.buttonPreviewBody b { font-size:.82rem;font-weight:550; }.buttonPreviewBody small,.largeButtonPreview small { font-size:.68rem;opacity:.7; }
.largeButtonPreview small { overflow:visible;white-space:normal;line-height:1.35;writing-mode:horizontal-tb;word-break:normal;overflow-wrap:break-word; }
.largeButtonPreview { display:grid;grid-template-columns:minmax(0,1fr);align-items:start;justify-items:start;gap:4px;min-width:0;width:100%;text-align:left; }
.largeButtonPreview > i { width:auto;font-size:20px; }.largeButtonPreview > span { width:100%; }.largeButtonPreview b { font-size:.88rem;white-space:normal;overflow-wrap:anywhere; }
.largeButtonPreview em { justify-self:start;padding:3px 7px;border-radius:999px;background:color-mix(in srgb,var(--hss-fg) 10%,transparent);font-size:.61rem;font-style:normal;white-space:nowrap; }
.previewBadge { position:absolute;z-index:9;top:-4px;right:-4px;display:grid;place-items:center;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;color:#fff;border:2px solid var(--studioRaised);border-radius:999px;background:var(--studioDanger);font-size:.55rem;font-weight:700;line-height:1; }
.searchButtonPreview { display:grid;grid-template-columns:22px minmax(0,1fr) 27px;align-items:center;gap:6px;width:100%;min-width:0; }
.searchButtonPreview input { width:100%;min-width:0;padding:7px 8px;color:var(--hss-fg);border:1px solid color-mix(in srgb,var(--hss-fg) 24%,transparent);border-radius:9px;background:color-mix(in srgb,var(--studioSurface) 92%,transparent);font-size:.68rem; }
.searchButtonPreview button { display:grid;place-items:center;width:27px;height:27px;border-radius:8px;background:color-mix(in srgb,var(--hss-fg) 12%,transparent); }
.previewButton[data-shape="circle"] { width:44px;min-width:44px;height:44px;min-height:44px;margin-inline:auto;border-radius:50%;aspect-ratio:auto;justify-content:center;padding:7px;overflow:visible; }
.previewButton[data-shape="circle"][data-size="small"] { width:36px;min-width:36px;height:36px;min-height:36px; }
.previewButton[data-shape="circle"][data-size="large"] { display:flex;width:54px;min-width:54px;height:54px;min-height:54px; }
.previewButton[data-shape="circle"] .buttonPreviewBody > span,.previewButton[data-shape="circle"] .largeButtonPreview > span,.previewButton[data-shape="circle"] .largeButtonPreview > em { display:none; }
.previewButton[data-shape="pill"] { width:calc(100% - 8px);margin-inline:4px;border-radius:999px; }
.previewButton[data-size="small"] { min-height:34px;padding:6px;font-size:.8em; }
.previewButton[data-size="large"] { grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr);grid-auto-rows:auto;min-height:86px;align-items:start;padding:10px 11px; }
.previewButton[data-shape="circle"][data-size="large"] { display:flex;grid-column:auto;grid-template-columns:none;grid-template-rows:none;min-height:54px;padding:7px; }
.previewButton[data-menu-id="earthquake"] { container-type:inline-size; }
.previewButton[data-menu-id="earthquake"] .buttonPreviewBody b,
.previewButton[data-menu-id="earthquake"] .largeButtonPreview b { font-size:clamp(9px,11cqi,11px);letter-spacing:-.04em;white-space:normal;overflow-wrap:anywhere;text-overflow:clip;overflow:visible; }
.previewWidget { position:relative;grid-column:1/-1;width:100%;min-width:0;box-sizing:border-box;padding:9px 10px;color:var(--hss-fg);border:var(--hss-border-width,1px) var(--hss-border-style,solid) var(--hss-border);border-radius:13px;background:var(--hss-bg);overflow:visible; }
.previewWidget[data-shape="circle"] { width:58px;min-width:58px;height:58px;min-height:58px;margin-inline:auto;border-radius:50%; }
.previewWidget[data-shape="circle"] .widgetBody > div { display:none; }
.previewWidget[data-shape="pill"] { width:calc(100% - 8px);margin-inline:4px;border-radius:999px;overflow:visible; }
.previewWidget[data-shape="pill"] > :not(button),.previewWidget[data-shape="circle"] > :not(button) { border-radius:inherit;overflow:hidden; }
.widgetBody { display:flex;align-items:center;gap:9px;min-width:0; }
.widgetBody > i { flex:0 0 auto;font-size:22px; }
.widgetBody > div { display:grid;min-width:0; }
.widgetBody span,.widgetBody small { overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.66rem;opacity:.65; }
.nativeWidgetPreview { width:100%;height:auto;min-width:0;min-height:var(--hss-widget-height,160px);box-sizing:border-box;border-radius:10px;overflow:visible;overscroll-behavior:auto; }
.nativeWidgetPreview > * { width:100%;min-width:0;box-sizing:border-box; }
.nativeWidgetFrame { width:100%;height:auto;min-width:0;min-height:var(--hss-widget-height,160px);box-sizing:border-box;overflow:visible;overscroll-behavior:auto;touch-action:auto; }
.nativeWidgetFrame > * { width:100%;min-width:0;box-sizing:border-box; }
.nativeWidgetPreview[data-hss-kind="announcements"] { display:grid;place-items:center;text-align:center; }
.nativeWidgetPreview[data-hss-kind="postForm"] .nativeWidgetFrame { overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;touch-action:pan-x;scroll-behavior:smooth;scrollbar-width:thin; }
.nativeWidgetPreview[data-hss-kind="postForm"] :global(.mkw-post-form) { width:max(100%,260px)!important;min-width:260px!important; }
.nativeWidgetPreview[data-hss-kind="postForm"] :global(.mkw-post-form footer) { display:block!important;width:100%!important;max-width:none!important;overflow-x:auto!important;overflow-y:hidden!important;overscroll-behavior-x:contain;touch-action:pan-x;padding-inline:8px!important;box-sizing:border-box;scrollbar-width:thin; }
.nativeWidgetPreview[data-hss-kind="postForm"] :global(.mkw-post-form footer > div) { display:flex!important;flex-wrap:nowrap!important;width:max-content!important;min-width:100%!important;max-width:none!important;overflow:visible!important; }
.nativeWidgetPreview[data-hss-kind="postForm"] :global(.mkw-post-form footer > div > button) { flex:0 0 38px!important;width:38px!important;min-width:38px!important;height:40px!important; }
.nativeWidgetPreview[data-hss-kind="digitalClock"] .nativeWidgetFrame,
.nativeWidgetPreview[data-hss-kind="clock"] .nativeWidgetFrame,
.nativeWidgetPreview[data-hss-kind="rssTicker"] .nativeWidgetFrame,
.nativeWidgetPreview[data-hss-kind="onlineUsers"] .nativeWidgetFrame { display:grid;place-items:center;overflow:clip; }
.nativeWidgetPreview[data-hss-kind="digitalClock"] :global([data-testid="mkw-digitalClock"]),
.nativeWidgetPreview[data-hss-kind="clock"] :global([data-testid="mkw-clock"]),
.nativeWidgetPreview[data-hss-kind="onlineUsers"] :global([data-testid="mkw-onlineUsers"]) { display:grid!important;place-items:center!important;width:100%!important;height:100%!important;min-height:0!important;padding-block:0!important;box-sizing:border-box; }
.nativeWidgetPreview[data-hss-kind="digitalClock"] :global([data-testid="mkw-digitalClock"]) { padding-block:0!important; }
.nativeWidgetPreview[data-hss-kind="rssTicker"] :global(.mkw-rss-ticker) { width:100%!important;min-height:0!important; }
.nativeWidgetPreview[data-hss-kind="notifications"] :global(.mkw-notifications),
.nativeWidgetPreview[data-hss-kind="externalNotifications"] :global(.mkw-externalNotifications),
.nativeWidgetPreview[data-hss-kind="timeline"] :global(.mkw-timeline) { width:100%!important;height:auto!important;min-height:var(--hss-widget-height,112px)!important;box-sizing:border-box;overflow:clip!important; }
.nativeWidgetPreview[data-hss-kind="notifications"] :global(.mkw-notifications > div:last-child),
.nativeWidgetPreview[data-hss-kind="externalNotifications"] :global(.mkw-externalNotifications > div:last-child),
.nativeWidgetPreview[data-hss-kind="timeline"] :global(.mkw-timeline > div:last-child) { overflow:visible!important; }
.nativeWidgetPreview[data-hss-kind="notifications"] :global(.mkw-notifications > div:last-child > div > div > div > button),
.nativeWidgetPreview[data-hss-kind="timeline"] :global(.mkw-timeline > div:last-child > div > div > div > button) { display:none!important; }
.nativeWidgetPreview[data-hss-kind="notifications"][data-hss-size="small"] :global([data-scroll-anchor]:nth-child(n+2)),
.nativeWidgetPreview[data-hss-kind="timeline"][data-hss-size="small"] :global([data-scroll-anchor]:nth-child(n+2)),
.nativeWidgetPreview[data-hss-kind="notifications"][data-hss-size="normal"] :global([data-scroll-anchor]:nth-child(n+3)),
.nativeWidgetPreview[data-hss-kind="timeline"][data-hss-size="normal"] :global([data-scroll-anchor]:nth-child(n+3)),
.nativeWidgetPreview[data-hss-kind="notifications"][data-hss-size="large"] :global([data-scroll-anchor]:nth-child(n+4)),
.nativeWidgetPreview[data-hss-kind="timeline"][data-hss-size="large"] :global([data-scroll-anchor]:nth-child(n+4)) { display:none!important; }
.nativeWidgetPreview[data-hss-kind="externalNotifications"][data-hss-size="small"] :global(.mkw-externalNotifications > div:last-child > div > div > div:nth-child(n+2)),
.nativeWidgetPreview[data-hss-kind="externalNotifications"][data-hss-size="normal"] :global(.mkw-externalNotifications > div:last-child > div > div > div:nth-child(n+3)),
.nativeWidgetPreview[data-hss-kind="externalNotifications"][data-hss-size="large"] :global(.mkw-externalNotifications > div:last-child > div > div > div:nth-child(n+4)) { display:none!important; }
.nativeWidgetPreview[data-hss-kind="externalNotifications"] :global(.mkw-externalNotifications) div:has(> .ti-plug-connected-x) { display:flex!important;flex-direction:column;align-items:center;justify-content:center;min-height:var(--hss-widget-height,88px)!important;padding:4px 8px!important;box-sizing:border-box;overflow:clip!important;text-align:center; }
.nativeWidgetPreview[data-hss-kind="trends"] :global(.wbrkwala),
.nativeWidgetPreview[data-hss-kind="federation"] :global(.wbrkwalb) { height:auto!important;max-height:none!important;overflow:visible!important; }
.nativeWidgetPreview[data-hss-kind="rss"] :global(.mkw-rss a) { padding:5px 9px!important;font-size:.8rem; }
.nativeWidgetPreview[data-hss-kind="trends"] :global(.tags > div) { min-height:0!important;padding:7px 9px!important; }
.nativeWidgetPreview[data-hss-kind="federation"] :global(.instances > .instance) { min-height:0!important;padding:7px 9px!important; }
.nativeWidgetPreview[data-hss-kind="trends"][data-hss-size="small"] :global(.tags > div:nth-child(n+2)),
.nativeWidgetPreview[data-hss-kind="federation"][data-hss-size="small"] :global(.instances > .instance:nth-child(n+2)),
.nativeWidgetPreview[data-hss-kind="trends"][data-hss-size="normal"] :global(.tags > div:nth-child(n+3)),
.nativeWidgetPreview[data-hss-kind="federation"][data-hss-size="normal"] :global(.instances > .instance:nth-child(n+3)),
.nativeWidgetPreview[data-hss-kind="trends"][data-hss-size="large"] :global(.tags > div:nth-child(n+4)),
.nativeWidgetPreview[data-hss-kind="federation"][data-hss-size="large"] :global(.instances > .instance:nth-child(n+4)) { display:none!important; }
.nativeWidgetPreview[data-hss-kind="photos"][data-hss-size="small"] :global(.mkw-photos [style*="background-image"]:nth-child(n+4)),
.nativeWidgetPreview[data-hss-kind="photos"][data-hss-size="normal"] :global(.mkw-photos [style*="background-image"]:nth-child(n+7)) { display:none!important; }
.nativeWidgetPreview[data-hss-kind="userList"][data-hss-size="small"] :global(.mkw-userList .users > .user:nth-child(n+5)),
.nativeWidgetPreview[data-hss-kind="userList"][data-hss-size="normal"] :global(.mkw-userList .users > .user:nth-child(n+9)),
.nativeWidgetPreview[data-hss-kind="userList"][data-hss-size="large"] :global(.mkw-userList .users > .user:nth-child(n+13)) { display:none!important; }
.nativeWidgetPreview[data-hss-kind="chat"][data-hss-size="small"] :global(.mkw-chat ._gaps_s > a:nth-child(n+2)),
.nativeWidgetPreview[data-hss-kind="chat"][data-hss-size="normal"] :global(.mkw-chat ._gaps_s > a:nth-child(n+3)),
.nativeWidgetPreview[data-hss-kind="chat"][data-hss-size="large"] :global(.mkw-chat ._gaps_s > a:nth-child(n+4)) { display:none!important; }
.nativeWidgetPreview[data-hss-kind="birthdayFollowings"][data-hss-size="small"] :global(.mkw-bdayfollowings a:nth-child(n+7)),
.nativeWidgetPreview[data-hss-kind="birthdayFollowings"][data-hss-size="normal"] :global(.mkw-bdayfollowings a:nth-child(n+13)) { display:none!important; }
.nativeWidgetPreview[data-hss-kind="instanceCloud"] :global(.mkw-instance-cloud canvas) { width:100%!important;height:var(--hss-widget-height,128px)!important;max-height:var(--hss-widget-height,128px)!important; }
.nativeWidgetPreview[data-hss-kind="profile"] .nativeWidgetFrame,
.nativeWidgetPreview[data-hss-kind="profile"] .nativeWidgetFrame > *,
.nativeWidgetPreview[data-hss-kind="profile"] .nativeWidgetFrame > * > * { width:100%!important;max-width:none!important;box-sizing:border-box; }
.nativeWidgetPreview[data-hss-kind="serverMetric"] :global([data-testid="mkw-serverMetric"]),
.nativeWidgetPreview[data-hss-kind="serverMetric"] :global([data-testid="mkw-serverMetric"]) * { min-width:0!important;max-width:100%;box-sizing:border-box;font-variant-numeric:tabular-nums; }
.nativeWidgetPreview[data-hss-kind="serverMetric"] :global([data-testid="mkw-serverMetric"] > div) { width:100%!important;overflow:hidden; }
.nativeWidgetPreview[data-hss-kind="serverMetric"] :global([data-testid="mkw-serverMetric"] svg) { max-width:100%!important;height:auto!important; }
.nativeWidgetPreview[data-hss-kind="aichan"] .nativeWidgetFrame { position:relative;height:var(--hss-widget-height,168px);min-height:var(--hss-widget-height,168px);overflow:hidden; }
.nativeWidgetPreview[data-hss-kind="aichan"] .nativeWidgetFrame > * { position:relative;height:var(--hss-widget-height,168px)!important;overflow:hidden!important; }
.nativeWidgetPreview[data-hss-kind="aichan"] .nativeWidgetFrame iframe { position:absolute;top:0;left:50%;width:300px!important;height:350px!important;max-width:none!important;transform:translateX(-50%) scale(var(--hss-aichan-scale,1));transform-origin:top center; }
.nativeWidgetPreview[data-hss-kind="mascot"][data-hss-size="small"] .nativeWidgetFrame > *,
.nativeWidgetPreview[data-hss-kind="dice"][data-hss-size="small"] .nativeWidgetFrame > * { width:125%!important;transform:scale(.8);transform-origin:top left; }
.nativeWidgetPreview[data-hss-kind="mascot"][data-hss-size="normal"] .nativeWidgetFrame > *,
.nativeWidgetPreview[data-hss-kind="dice"][data-hss-size="normal"] .nativeWidgetFrame > * { width:111.12%!important;transform:scale(.9);transform-origin:top left; }
.dragHandle { position:absolute;z-index:10;top:-9px;left:-9px!important;display:grid!important;place-items:center;width:26px!important;height:26px!important;min-height:26px!important;padding:0!important;border:1px solid var(--studioLine);border-radius:50%!important;color:var(--studioMuted);background:var(--studioRaised);box-shadow:0 2px 7px #0003;cursor:grab;touch-action:none;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease,transform .12s ease,visibility .12s;transform:scale(.88); }
.dragHandle:active { cursor:grabbing; }
.deleteItem { position:absolute;z-index:12;top:2px;right:2px;display:grid;place-items:center;width:26px;height:26px;padding:0;border-radius:50%;color:#fff;background:var(--studioDanger);box-shadow:0 2px 8px #0004; }
.quickTrigger { position:absolute;z-index:11;top:-9px;right:-9px;display:grid;place-items:center;width:26px;height:26px;padding:0;border:1px solid var(--studioLine);border-radius:50%;color:var(--studioAccent);background:var(--studioRaised);box-shadow:0 2px 7px #0003;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease,transform .12s ease,visibility .12s;transform:scale(.88); }
[data-node-id]:hover > .dragHandle,[data-node-id]:focus-within > .dragHandle,[data-node-id][data-selected="true"] > .dragHandle,
[data-node-id]:hover > .quickTrigger,[data-node-id]:focus-within > .quickTrigger,[data-node-id][data-selected="true"] > .quickTrigger,
.previewGroup:hover > .groupHead .dragHandle,.previewGroup:focus-within > .groupHead .dragHandle,.previewGroup[data-selected="true"] > .groupHead .dragHandle,
.sortable-chosen > .dragHandle,.sortable-ghost > .dragHandle { opacity:1;visibility:visible;pointer-events:auto;transform:scale(1); }
.collapsedButtons { display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;min-width:0;padding:4px 1px;box-sizing:border-box;overflow:visible; }
.collapsedButton { position:relative;display:grid!important;place-items:center;align-self:center;flex:0 0 44px!important;width:44px!important;min-width:44px!important;max-width:44px!important;height:44px;min-height:44px;margin:0;padding:0!important;box-sizing:border-box;color:var(--hss-fg);border:var(--hss-border-width,1px) var(--hss-border-style,solid) var(--hss-border);border-radius:11px;background:var(--hss-bg);background-clip:padding-box;overflow:visible; }
.collapsedButton[data-shape="circle"] { border-radius:50%; }
.collapsedButton[data-shape="pill"] { height:38px;min-height:38px;flex-basis:38px;border-radius:999px; }
.collapsedButton .deleteItem { top:1px;right:1px;width:18px;height:18px;font-size:.7rem; }
.collapsedButton .quickTrigger { top:1px;right:1px;width:18px;height:18px;font-size:.66rem; }
.fixedArea { display:flex;flex-direction:column;gap:2px;padding-top:6px;border-top:1px solid var(--studioLine); }
.fixedArea button { display:flex;align-items:center;gap:9px;min-height:32px;padding:5px 8px;border-radius:9px;font-size:.74rem; }
.sidebarPreviewCollapsed .fixedArea button { justify-content:center;width:46px;padding:5px; }
.bottomArea { display:flex;flex-direction:column;align-items:stretch;gap:7px;padding-top:8px;border-top:1px solid var(--studioLine); }
.postButton { display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:42px;border-radius:13px;color:#fff;background:var(--MI_THEME-accent); }
.modeToggle { display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;box-sizing:border-box;border:1px solid var(--studioLine);border-radius:10px;background:color-mix(in srgb,var(--MI_THEME-panel) 85%,transparent); }
.modeToggle button { display:grid;place-items:center;width:100%;min-width:0;min-height:29px;margin:0;padding:0;border-radius:7px; }
.modeToggle button[aria-pressed="true"] { color:var(--MI_THEME-accent);background:var(--MI_THEME-accentedBg);box-shadow:0 1px 4px #0002; }
.accountButton { display:flex;align-items:center;gap:8px;width:100%;min-width:0;padding:5px;border-radius:10px;text-align:left; }
.accountButton img,.accountButton > i { display:grid;place-items:center;flex:0 0 auto;width:30px;height:30px;border-radius:50%;object-fit:cover;background:var(--studioAccentSoft); }
.accountButton span { display:grid;min-width:0;line-height:1.1; }
.accountButton b,.accountButton small { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.accountButton b { font-size:.72rem; }.accountButton small { font-size:.58rem;opacity:.58; }
.sidebarPreviewCollapsed .postButton { width:46px;height:46px;min-height:46px;border-radius:13px; }
.sidebarPreviewCollapsed .modeToggle { width:44px;margin-inline:auto;grid-template-columns:1fr;padding:3px;justify-self:center; }
.sidebarPreviewCollapsed .accountButton { justify-content:center;width:46px;padding:5px; }
.collapsedNotice { display:flex;gap:8px;max-width:420px;margin:12px auto 0;padding:10px 12px;border-radius:12px;font-size:.76rem;background:var(--studioAccentSoft); }
.inspector { display:grid;gap:12px; }
.inspectorAttention { animation:inspectorAttention .75s ease;scroll-margin-top:12px;outline:none; }
@keyframes inspectorAttention { 0%,100% { box-shadow:inset 0 0 0 0 transparent; } 35% { box-shadow:inset 0 0 0 3px var(--studioAccent); } }
.selectedSummary { display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--studioLine);border-radius:14px;background:var(--studioRaised); }
.selectedSummary > i { display:grid;place-items:center;width:38px;height:38px;border-radius:11px;color:var(--studioAccent);background:var(--studioAccentSoft);font-size:21px; }
.selectedSummary > div { display:grid;min-width:0; }
.selectedSummary small { color:var(--studioMuted);font-size:.72rem; }
.inspectorTabs { display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:5px;border:1px solid var(--studioLine);border-radius:13px;background:var(--studioBg); }
.inspectorTabs button { min-height:34px;border-radius:9px; }
.inspectorTabs button[aria-pressed="true"] { color:var(--studioAccentFg);background:var(--studioAccent); }
.inspectorTabs button:disabled { opacity:.35; }
.inspectorTitle { display:flex;align-items:center;gap:10px;padding:2px 2px 0; }
.inspectorTitle > i { font-size:26px;color:var(--studioAccent); }
.inspectorTitle small { color:var(--studioMuted);font-size:.68rem; }.inspectorTitle h2 { margin:0;font-size:1.05rem; }
.bento { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px; }
.inspectorCard { min-width:0;padding:14px;border:1px solid var(--studioLine);border-radius:15px;background:color-mix(in srgb,var(--studioRaised) 92%,var(--studioAccentSoft)); }
.inspectorCard > button,.inspectorCard > ._button,.inspectorCard > ._buttonPrimary { display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;margin-top:4px;padding:8px 12px;border:1px solid var(--studioLine);border-radius:10px;background:var(--studioSurface);box-shadow:0 2px 7px #0001; }
.inspectorCard > ._buttonPrimary { color:var(--studioAccentFg);border-color:var(--studioAccent);background:var(--studioAccent); }
.currentSettingsButton { display:inline-flex!important;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:8px 12px!important;color:var(--MI_THEME-fg)!important;border:1px solid var(--studioLine)!important;border-radius:10px!important;background:var(--studioSurface)!important;box-shadow:0 2px 7px #0001;opacity:1!important; }
.currentSettingsButton:hover,.currentSettingsButton:focus-visible { color:var(--studioAccentFg)!important;border-color:var(--studioAccent)!important;background:var(--studioAccent)!important; }
.inspectorCard h3 { margin:0 0 11px;font-size:.8rem;color:var(--studioMuted); }
.inspectorCard p { margin:0;font-size:.78rem;line-height:1.55; }
.inspectorCard small { display:block;margin-top:8px;color:var(--studioMuted);font-size:.7rem;line-height:1.45; }
.choiceRow { display:flex;align-items:center;gap:7px;flex-wrap:wrap; }
.choiceRow button { display:grid;place-items:center;gap:3px;min-height:36px;padding:7px 10px;border:1px solid var(--studioLine);border-radius:10px; }
.choiceRow button[data-active="true"] { color:var(--studioAccentFg);border-color:var(--studioAccent);background:var(--studioAccent); }
.choiceRow button small { margin:0;color:inherit;font-size:.64rem; }
.check,.field,.colorField { display:flex;align-items:center;gap:8px;margin-top:9px;font-size:.78rem; }
.field { justify-content:space-between; }.field input[type="range"] { flex:1;min-width:60px; }
.fieldStack { display:grid;gap:5px; }
.colorGrid { display:grid;grid-template-columns:repeat(3,1fr);gap:8px; }
.colorField { flex-direction:column;align-items:stretch;margin:0; }
.colorField input { width:100%;height:36px;padding:0;border:0;background:none; }
.memberButton { display:grid;grid-template-columns:24px 1fr auto;align-items:center;gap:7px;width:100%;padding:8px;border-radius:9px;text-align:left; }
.memberButton:hover { background:var(--studioAccentSoft); }
.limitValue { display:block;color:var(--studioAccent);font-family:'Righteous',system-ui,sans-serif;font-size:2rem;font-weight:400; }
.emptyInspector { min-height:360px;display:grid;place-content:center;justify-items:center;gap:8px;text-align:center; }
.emptyInspector > i { font-size:40px;color:var(--studioAccent); }.emptyInspector span { max-width:360px;color:var(--studioMuted);font-size:.78rem; }
.studioDialogWindow { position:fixed;z-index:3200100;top:50%;left:50%;display:grid;gap:12px;width:min(390px,calc(100% - 24px));max-height:calc(100dvh - 24px);padding:14px;box-sizing:border-box;color:var(--MI_THEME-fg);border:1px solid var(--studioLine);border-radius:16px;background:var(--studioRaised);box-shadow:0 24px 70px #0007;overflow:auto;transform:translate(-50%,-50%); }
.studioDialogWindow > header { display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:9px;border-bottom:1px solid var(--studioLine); }.studioDialogWindow > header > span { display:flex;align-items:center;gap:8px; }.studioDialogWindow > header > span > i { color:var(--studioAccent);font-size:21px; }.studioDialogWindow > header button { width:30px;height:30px;border-radius:9px; }
.studioDialogWindow > p { margin:0;color:var(--studioMuted);font-size:.8rem;line-height:1.55; }.studioDialogWindow > div { display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap; }.studioDialogWindow > div button { min-height:36px;padding:7px 12px;border:1px solid var(--studioLine);border-radius:10px; }
.windowLayer { position:fixed;z-index:3200080;inset:0;display:grid;place-items:center;padding:14px;pointer-events:none; }
.leaveDialog { width:min(420px,100%);padding:24px;border:1px solid var(--studioLine);border-radius:20px;background:var(--studioRaised);box-shadow:0 24px 80px #0007;text-align:center;pointer-events:auto; }
.leaveDialog > i { font-size:40px;color:var(--studioAccent); }.leaveDialog h2 { margin:10px 0 4px; }.leaveDialog p { color:var(--studioMuted); }.leaveDialog > div { display:flex;justify-content:center;gap:8px;flex-wrap:wrap; }.leaveDialog button { padding:9px 13px;border-radius:10px; }
.tutorialWindow { position:fixed;z-index:3200090;top:50%;left:50%;display:grid;grid-template-rows:auto auto auto auto minmax(76px,1fr) auto;gap:9px;width:min(390px,calc(100% - 24px));min-height:min(350px,calc(100dvh - 24px));max-height:calc(100dvh - 24px);padding:16px;box-sizing:border-box;color:var(--MI_THEME-fg);border:1px solid var(--studioAccent);border-radius:18px;background:var(--studioRaised);box-shadow:0 24px 72px #0007;overflow:auto;transform:translate(-50%,-50%); }
.tutorialWindow > header { display:flex;align-items:center;justify-content:space-between;color:var(--studioAccent);font-size:.68rem;font-weight:700;letter-spacing:.06em; }.tutorialWindow > header button { width:30px;height:30px;border-radius:9px; }.tutorialWindow > i { color:var(--studioAccent);font-size:30px; }.tutorialWindow h2 { margin:0;font-size:1.08rem; }.tutorialWindow p { margin:0;color:var(--studioMuted);font-size:.78rem;line-height:1.55; }
.tutorialProgress { display:grid;grid-template-columns:repeat(5,1fr);gap:4px; }.tutorialProgress span { height:4px;border-radius:999px;background:var(--studioLine); }.tutorialProgress span[data-active="true"] { background:var(--studioAccent); }
.tutorialActions { display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap;margin-top:4px; }.tutorialActions button { display:flex;align-items:center;gap:5px;min-height:36px;padding:7px 11px;border:1px solid var(--studioLine);border-radius:10px; }.tutorialActions ._buttonPrimary { border-color:var(--studioAccent); }
.tutorialFocus { z-index:8;outline:3px solid color-mix(in srgb,var(--studioAccent) 82%,#fff);outline-offset:3px;box-shadow:0 0 0 7px color-mix(in srgb,var(--studioAccent) 18%,transparent); }
.header.tutorialFocus,.sidebarPreview.tutorialFocus { position:relative; }
/* UI S uses the live hk3 palette and the same straight-edged navigation rhythm. */
.root[data-ui-s="true"],.teleportTheme[data-ui-s="true"] {
	--studioBg:var(--hk3-bg);
	--studioSurface:var(--hk3-bg);
	--studioRaised:var(--hk3-surface);
	--studioMuted:var(--hk3-neutral-700);
	--studioLine:var(--hk3-divider);
	--studioAccent:var(--hk3-accent);
	--studioAccentFg:var(--hk3-bg);
	--studioAccentSoft:var(--hk3-accent-100);
	color:var(--hk3-text);
	font-family:'LINE Seed JP',var(--MI-font,sans-serif);
}
.root[data-ui-s="true"] .header,
.root[data-ui-s="true"] .pane,
.root[data-ui-s="true"] .stage { background:var(--hk3-bg); }
.root[data-ui-s="true"] .header { border-bottom:2px solid var(--hk3-divider); }
.root[data-ui-s="true"] .stage { border:1px solid var(--hk3-divider);border-radius:0;min-height:760px; }
.root[data-ui-s="true"] .pane { padding:14px; }
.root[data-ui-s="true"] .logo { font-family:'Righteous',system-ui,sans-serif;font-weight:400; }
.root[data-ui-s="true"] .sidebarPreview { width:200px;max-width:100%;height:740px;padding:0;border:0;border-right:2px solid var(--hk3-divider);outline:1px solid var(--hk3-divider);border-radius:0;background:var(--hk3-bg);color:var(--hk3-text);box-shadow:none; }
.root[data-ui-s="true"] .sidebarPreviewWide { width:232px; }
.root[data-ui-s="true"] .sidebarPreviewCollapsed { width:64px; }
.root[data-ui-s="true"] .serverRow { display:flex;justify-content:center;align-items:center;flex:0 0 58px;margin:0;border-bottom:2px solid var(--hk3-divider); }
.root[data-ui-s="true"] .serverIcon { width:32px;height:32px;border-radius:0;color:var(--hk3-bg);background:var(--hk3-accent); }
.root[data-ui-s="true"] .customArea { padding:0;scrollbar-width:none; }
.root[data-ui-s="true"] .expandedNodes { gap:0;padding:0; }
.root[data-ui-s="true"] .previewNode { min-height:0; }
.root[data-ui-s="true"] .previewWidget { grid-column:auto; }
.root[data-ui-s="true"] .previewNode[data-size="large"],.root[data-ui-s="true"] .previewWidget[data-size="large"] { grid-column:1/-1; }
.root[data-ui-s="true"] .previewWidget { border:0;border-right:1px solid var(--hk3-divider);border-bottom:1px solid var(--hk3-divider);border-radius:0;background:transparent;color:var(--hk3-text);box-shadow:none;transform:none; }
.root[data-ui-s="true"] .previewNode[data-size]:not(.previewWidget) { display:flex;align-items:stretch;height:72px;min-height:72px; }
.root[data-ui-s="true"] .previewNode[data-size="small"]:not(.previewWidget) { height:52px;min-height:52px; }
.root[data-ui-s="true"] .previewNode[data-size="large"]:not(.previewWidget) { height:84px;min-height:84px; }
.root[data-ui-s="true"] .previewButton { @include sideNavItem.frame; margin:0;transform:none;box-shadow:none;overflow:visible; }
.root[data-ui-s="true"] .previewNode[data-size] > .previewButton { flex:1; }
.root[data-ui-s="true"] .buttonPreviewBody,
.root[data-ui-s="true"] .largeButtonPreview { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;width:100%;min-width:0; }
.root[data-ui-s="true"] .buttonPreviewBody > i,.root[data-ui-s="true"] .largeButtonPreview > i { @include sideNavItem.icon; }
.root[data-ui-s="true"] .buttonPreviewBody > span,.root[data-ui-s="true"] .largeButtonPreview > span { width:100%; }
.root[data-ui-s="true"] .buttonPreviewBody b,.root[data-ui-s="true"] .largeButtonPreview b { @include sideNavItem.label;overflow:visible; }
.root[data-ui-s="true"] .previewButton[data-menu-id="cacheClear"] .buttonPreviewBody b,
.root[data-ui-s="true"] .previewButton[data-menu-id="cacheClear"] .largeButtonPreview b { @include sideNavItem.cache-clear-label; }
.root[data-ui-s="true"] .previewButton[data-menu-id="earthquake"] .buttonPreviewBody b,
.root[data-ui-s="true"] .previewButton[data-menu-id="earthquake"] .largeButtonPreview b { @include sideNavItem.earthquake-label; }
.root[data-ui-s="true"] .previewButton[data-shape="circle"] .buttonPreviewBody > span,
.root[data-ui-s="true"] .previewButton[data-shape="circle"] .largeButtonPreview > span { display:grid; }
.root[data-ui-s="true"] .previewNode[data-size="small"] .buttonPreviewBody > span,
.root[data-ui-s="true"] .previewButton[data-size="small"] .buttonPreviewBody > span,
.root[data-ui-s="true"] .largeButtonPreview small,
.root[data-ui-s="true"] .largeButtonPreview em { display:none; }
.root[data-ui-s="true"] [data-brand="true"] .buttonPreviewBody b,
.root[data-ui-s="true"] [data-brand="true"] .largeButtonPreview b { font-family:'Righteous',system-ui,sans-serif;font-weight:400;letter-spacing:.02em; }
.root[data-ui-s="true"] .previewGroup { padding:0;border:0;border-bottom:2px solid var(--hk3-divider);border-radius:0;background:transparent;color:var(--hk3-text); }
.root[data-ui-s="true"] .groupHead { position:relative;height:0;min-height:0;margin:0;padding:0;color:var(--hk3-neutral-700);font-size:11px;font-weight:800;letter-spacing:.08em;justify-content:center; }
.root[data-ui-s="true"] .groupHead[data-show-name] { @include sideNavItem.heading; height:auto;box-sizing:border-box; }
.root[data-ui-s="true"] .groupHead > div { position:absolute;z-index:11;top:0;right:2px; }
.root[data-ui-s="true"] .groupGrid { gap:0;padding:0;border-radius:0; }
.root[data-ui-s="true"] .groupGrid .previewButton { border-right:1px solid var(--hk3-divider);border-bottom:1px solid var(--hk3-divider); }
.root[data-ui-s="true"] .previewWidget { padding:0; }
.root[data-ui-s="true"] .collapsedButtons { gap:0;padding:0; }
.root[data-ui-s="true"] .collapsedButton,
.root[data-ui-s="true"] .collapsedButton[data-shape="circle"],
.root[data-ui-s="true"] .collapsedButton[data-shape="pill"] { align-self:stretch;flex:0 0 56px!important;width:100%!important;min-width:0!important;max-width:none!important;height:56px;min-height:56px;border:0;border-bottom:1px solid var(--hk3-divider);border-radius:0;background:transparent;color:var(--hk3-text); }
.root[data-ui-s="true"] .selectedSummary,
.root[data-ui-s="true"] .inspectorTabs,
.root[data-ui-s="true"] .inspectorCard,
.root[data-ui-s="true"] .copyButton,
.root[data-ui-s="true"] .modeTabs,
.root[data-ui-s="true"] .actionButton,
.root[data-ui-s="true"] .addAction,
.root[data-ui-s="true"] .bulkAction,
.root[data-ui-s="true"] .reorderAction,
.root[data-ui-s="true"] .profileTab,
.root[data-ui-s="true"] .historyActions,
.root[data-ui-s="true"] .choiceRow button,
.root[data-ui-s="true"] .layoutPicker button,
.root[data-ui-s="true"] .select,
.root[data-ui-s="true"] .input,
.root[data-ui-s="true"] .textarea,
.teleportTheme[data-ui-s="true"] .creationPicker,
.teleportTheme[data-ui-s="true"] .quickEditor,
.teleportTheme[data-ui-s="true"] .reorderWindow,
.teleportTheme[data-ui-s="true"] .studioDialogWindow,
.teleportTheme[data-ui-s="true"] .tutorialWindow { border-radius:4px;box-shadow:none; }
.teleportTheme[data-ui-s="true"] .uiSAppearanceNote,
.root[data-ui-s="true"] .uiSAppearanceNote { margin:0;padding:8px 10px;border-left:2px solid var(--hk3-accent);background:var(--hk3-accent-100);color:var(--hk3-text);font-size:.76rem; }

.uiSFooter { flex:none;border-top:2px solid var(--hk3-divider); }
.uiSFooterTrio { display:grid;grid-template-columns:repeat(3,minmax(0,1fr)); }
.uiSFooterPair { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid var(--hk3-divider); }
.uiSFooterTrio button,.uiSFooterPair button { display:grid;place-items:center;min-width:0;min-height:42px;border:0;border-right:1px solid var(--hk3-divider);border-radius:0;color:var(--hk3-text);background:transparent; }
.uiSFooterTrio button:last-child,.uiSFooterPair button:last-child { border-right:0; }
.uiSFooterPair button[aria-pressed="true"] { color:var(--hk3-bg);background:var(--hk3-text); }
.uiSFooter[data-collapsed] .uiSFooterTrio,.uiSFooter[data-collapsed] .uiSFooterPair { grid-template-columns:minmax(0,1fr); }
.uiSFooter[data-collapsed] .uiSFooterTrio button,.uiSFooter[data-collapsed] .uiSFooterPair button { border-right:0;border-bottom:1px solid var(--hk3-divider); }
.uiSPost { display:grid;place-items:center;width:100%;min-height:46px;border-radius:0;color:var(--hk3-bg);background:var(--hk3-accent); }
.uiSAccount { display:flex;align-items:center;gap:8px;min-height:52px;width:100%;padding:8px 12px;border-top:1px solid var(--hk3-divider);color:var(--hk3-text); }
.uiSAccount img,.uiSAccount > i { width:30px;height:30px;flex:none;border-radius:50%;object-fit:cover; }
.uiSAccount span { min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px; }
.uiSFooter[data-collapsed] .uiSAccount { justify-content:center; }
.root[data-ui-s="true"] .backButton,.root[data-ui-s="true"] .profileRename,.root[data-ui-s="true"] .profileAdd,.root[data-ui-s="true"] .profileBar,.root[data-ui-s="true"] .historyButton,.root[data-ui-s="true"] .inspectorTabs button,.root[data-ui-s="true"] .copyMenu,.root[data-ui-s="true"] .resetConfirm,.root[data-ui-s="true"] .selectedSummary > i,.root[data-ui-s="true"] .groupHead button,
.teleportTheme[data-ui-s="true"] .select,.teleportTheme[data-ui-s="true"] .input,.teleportTheme[data-ui-s="true"] .textarea,.teleportTheme[data-ui-s="true"] .layoutPicker button,.teleportTheme[data-ui-s="true"] .choiceRow button,.teleportTheme[data-ui-s="true"] .pickerActions button,.teleportTheme[data-ui-s="true"] .pickerHead button,.teleportTheme[data-ui-s="true"] .leaveDialog { border-radius:4px;box-shadow:none; }
@container (min-width:961px) {
	.root[data-ui-s="true"] .main { grid-template-columns:minmax(0,1fr) minmax(390px,1fr); }
}
@container (max-width:960px) {
	.root[data-ui-s="true"] .main { grid-template-columns:1fr; }
	.root[data-ui-s="true"] .stage { min-height:700px;padding:16px 72px 16px 88px; }
}
@container (max-width:720px) {
	.root[data-ui-s="true"] .stage { min-height:680px;padding:154px 8px 16px; }
}
@container (max-width:1120px) {
	.header { grid-template-columns:minmax(0,1fr) auto; }
	.profileBar { grid-column:1/-1;grid-row:2;justify-content:flex-start; }
	.main { grid-template-columns:1fr; }
	.stage { min-height:850px; }
}
@container (max-width:720px) {
	.header { grid-template-columns:1fr;align-items:stretch;gap:8px;padding:10px 12px; }
	.brand { min-height:36px; }
	.profileBar { width:100%;padding:4px;box-sizing:border-box;justify-content:flex-start;flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;border:1px solid var(--studioLine);border-radius:13px;background:var(--studioBg);scrollbar-width:thin; }
	.profileBar > * { flex:0 0 auto; }
	.headerActions { width:100%;justify-content:space-between;flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none; }
	.headerActions::-webkit-scrollbar { display:none; }
	.headerControlGroup { margin-left:auto;flex:0 0 auto; }
	.pane { padding:12px; }
	.paneHead { align-items:flex-start;flex-direction:column; }
	.previewHeadActions { width:100%;justify-content:space-between; }
	.stage { padding:168px 8px 20px; }
	.sideTools { top:10px;transform:none; }
	.sideTools[data-side="left"] { left:8px;display:flex;flex-wrap:wrap;max-width:calc(100% - 16px); }
	.sideTools[data-side="right"] { top:91px;right:auto;left:8px;display:flex;justify-content:flex-start; }
	.addAction { width:76px;min-height:62px; }
	.bulkAction,.reorderAction { width:76px;min-height:62px; }
	.creationPicker { top:166px;left:50%;width:calc(100% - 24px);transform:translateX(-50%); }
	.quickEditor,.reorderWindow { position:fixed;top:50%;left:50%;right:auto;width:min(430px,calc(100% - 24px));max-height:calc(100dvh - 24px);transform:translate(-50%,-50%); }
	.dragTimeline { width:min(300px,calc(100% - 24px)); }
	.dragTimelineGap { min-height:38px;margin:2px 4px;padding:6px 8px;font-size:.67rem;touch-action:none; }
	.studioDialogWindow,.tutorialWindow { top:50%;right:auto;bottom:auto;left:50%;max-height:calc(100dvh - 24px);transform:translate(-50%,-50%); }
	.bento { grid-template-columns:1fr; }
	.resetConfirm { position:fixed;top:50%;left:50%;right:auto;transform:translate(-50%,-50%); }
}
@container (max-width:480px) {
	.logo { font-size:1.1rem; }
	.actionButton { display:grid;place-items:center;width:36px;height:36px;min-height:36px;padding:0; }.actionButton > span { display:none; }.actionButton i { font-size:1rem; }
	.previewHeadActions { align-items:stretch;flex-direction:column; }
	.copyButton,.modeTabs { width:100%;justify-content:center; }
	.copyMenu { position:fixed;top:50%;left:50%;right:auto;width:min(330px,calc(100% - 24px));transform:translate(-50%,-50%); }
	.stage { padding-inline:8px; }
	.inspectorTabs { grid-template-columns:repeat(2,1fr); }
}
</style>
