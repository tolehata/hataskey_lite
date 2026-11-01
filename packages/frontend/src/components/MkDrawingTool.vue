<!--
SPDX-FileCopyrightText: syuilo and misskey-project & Hata
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<MkModal
	ref="modal"
	preferType="dialog"
	@click="onModalClick"
	@closed="emit('closed')"
	@esc="onEscape"
>
	<div
		ref="rootEl"
		:class="$style.root"
		data-hatadint
		role="dialog"
		:data-hatagoes="!!hataGoesHost"
		aria-modal="true"
		aria-label="Hatadint"
		@pointerdown.capture="dismissOutside"
		@click.capture="dismissOutside"
		@click.stop
		@keydown="onKeyDown"
	>
		<header :class="$style.header">
			<button
				ref="nameButton"
				type="button"
				:class="$style.document"
				:title="ui.rename"
				:aria-label="`${ui.rename}: ${fileName}`"
				@click="openPopup('rename', $event)"
			>
				<i class="ti ti-brush"></i><span><strong :class="$style.wordmark">Hatadint</strong><small>{{ fileName }}</small></span>
			</button>
			<div :class="$style.headerActions">
				<div :class="$style.history">
					<button
						type="button"
						:aria-label="copy.undo"
						:title="copy.undo"
						:disabled="historyIndex <= 0 || saving"
						@click="undo"
					>
						<i class="ti ti-arrow-back-up"></i>
					</button><button
						type="button"
						:aria-label="copy.redo"
						:title="copy.redo"
						:disabled="historyIndex >= history.length - 1 || saving"
						@click="redo"
					>
						<i class="ti ti-arrow-forward-up"></i>
					</button>
				</div>
				<button
					type="button"
					:class="$style.iconButton"
					:aria-pressed="panMode"
					:aria-label="
						panMode ? `${ui.returnTool}: ${previousToolName}` : copy.handTool
					"
					:title="
						panMode ? `${ui.returnTool}: ${previousToolName}` : copy.handTool
					"
					@click="toggleHand"
				>
					<i :class="panMode ? previousToolIcon : 'ti ti-hand-stop'"></i>
				</button>
				<button
					type="button"
					:class="[$style.iconButton, $style.collapseButton]"
					:aria-pressed="collapsed"
					:aria-label="ui.panels"
					:title="ui.panels"
					@click="collapsed = !collapsed"
				>
					<i class="ti ti-layout-sidebar-right"></i>
				</button>
				<button
					type="button"
					:class="$style.exportButton"
					:disabled="saving"
					:aria-label="ui.export"
					@click="openPopup('export', $event)"
				>
					<i class="ti ti-upload"></i><span>{{ ui.export }}</span>
				</button>
				<button
					ref="closeButton"
					type="button"
					:class="$style.iconButton"
					:aria-label="copy.close"
					:title="copy.close"
					:disabled="saving"
					@click="onCloseClick($event)"
				>
					<i class="ti ti-x"></i>
				</button>
			</div>
		</header>
		<div
			:class="$style.body"
			:inert="saving || restoring"
			:data-collapsed="collapsed"
		>
			<aside :class="$style.toolColumn" :aria-label="copy.tools">
				<div :class="$style.toolCase">
					<section
						v-for="group in toolGroups"
						:key="group.label"
						:class="$style.toolGroup"
					>
						<span>{{ group.label }}</span>
						<div :class="$style.tools">
							<button
								v-for="t in group.items"
								:key="t.id"
								type="button"
								:data-active="activeTool === t.id"
								:aria-pressed="activeTool === t.id"
								:aria-label="t.name"
								:title="t.name"
								@click="selectTool(t.id)"
							>
								<i :class="t.icon"></i>
							</button>
						</div>
					</section>
				</div>
				<button
					type="button"
					:class="$style.quickColor"
					:style="{ background: color }"
					:aria-label="copy.color"
					:title="copy.color"
					@click="openPopup('color', $event)"
				></button>
			</aside>
			<section :class="$style.workspace" :aria-label="ui.canvas">
				<div :class="$style.context">
					<div :class="$style.contextPill">
						<button
							type="button"
							:aria-label="ui.changeTool"
							@click="openPopup('tools', $event)"
						>
							<i :class="activeToolInfo.icon"></i><strong>{{ activeToolInfo.name }}</strong><i class="ti ti-chevron-down"></i>
						</button><button
							type="button"
							:aria-label="copy.brushSize"
							@click="openPopup('size', $event)"
						>
							{{ brushSize }} px<i class="ti ti-chevron-down"></i>
						</button><button
							type="button"
							:aria-label="copy.opacity"
							@click="openPopup('opacity', $event)"
						>
							<i class="ti ti-droplet-half-2"></i>{{ Math.round(brushOpacity * 100) }}%<i
								class="ti ti-chevron-down"
							></i>
						</button>
					</div>
				</div>
				<div v-if="lasso" :class="$style.selectionBar">
					<span>{{ copy.editingSelection }}</span><label>{{ copy.scale
					}}<input
						v-model.number="lasso.scale"
						type="range"
						min="10"
						max="300"
					/>{{ lasso.scale }}%</label><label>{{ copy.rotation
					}}<input
						v-model.number="lasso.rotation"
						type="range"
						min="-180"
						max="180"
					/>{{ lasso.rotation }}°</label><button type="button" :aria-label="copy.cancel" :title="copy.cancel" @click="cancelLasso">
						<span aria-hidden="true">✖</span>
					</button><button type="button" :class="$style.primary" :aria-label="copy.apply" :title="copy.apply" @click="applyLasso"><span aria-hidden="true">✓</span></button>
				</div>
				<div
					ref="scroller"
					:class="$style.scroller"
					@wheel.prevent="onWheel"
					@pointerdown="onPtrDown"
					@pointermove="onPtrMove"
					@pointerup="onPtrUp"
					@pointercancel="cancelPointer"
					@lostpointercapture="cancelPointer"
				>
					<div
						:class="$style.canvasWrap"
						:style="{
							width: canvasWidth * zoom + 'px',
							height: canvasHeight * zoom + 'px',
							transform: `translate(${panX}px, ${panY}px)`,
							cursor: panMode ? (panning ? 'grabbing' : 'grab') : 'crosshair',
						}"
					>
						<canvas
							ref="canvas"
							:width="canvasWidth"
							:height="canvasHeight"
							:class="$style.canvas"
							:style="{
								background: bgMode === 'transparent' ? undefined : bgMode,
							}"
							:aria-label="ui.canvas"
						></canvas>
						<canvas
							ref="previewCanvas"
							:width="canvasWidth"
							:height="canvasHeight"
							:class="$style.preview"
							aria-hidden="true"
						></canvas>
						<div
							v-if="lasso"
							:class="$style.lassoBox"
							:style="{
								left: lasso.x * zoom + 'px',
								top: lasso.y * zoom + 'px',
								width: lasso.w * zoom + 'px',
								height: lasso.h * zoom + 'px',
								transform: `scale(${lasso.scale / 100}) rotate(${lasso.rotation}deg)`,
							}"
							@pointerdown.stop="startLassoDrag"
						>
							<canvas
								ref="lassoCanvas"
								:width="lasso.w"
								:height="lasso.h"
							></canvas>
							<svg :class="$style.lassoOutline" :viewBox="`0 0 ${lasso.w} ${lasso.h}`" aria-hidden="true">
								<polygon :points="lassoOutlinePoints" vector-effect="non-scaling-stroke"/>
								<polygon :points="lassoOutlinePoints" vector-effect="non-scaling-stroke"/>
							</svg>
						</div>
						<div
							v-if="transformMode && transform.img"
							:class="$style.placeBox"
							:style="{
								left: transform.x * zoom + 'px',
								top: transform.y * zoom + 'px',
								width: transform.w * zoom + 'px',
								height: transform.h * zoom + 'px',
								transform: `rotate(${transform.rotation}deg)`,
							}"
							@pointerdown.stop="beginPlace('move', $event)"
						>
							<img
								:src="transform.img.src"
								:class="$style.placeImg"
								draggable="false"
								alt=""
							/><button
								v-for="corner in placementCorners"
								:key="corner"
								type="button"
								:class="$style.placeHandle"
								:data-corner="corner"
								:aria-label="ui.resizeImage"
								@pointerdown.stop="beginPlace(corner, $event)"
							></button><button
								type="button"
								:class="$style.placeRotate"
								:aria-label="copy.rotation"
								@pointerdown.stop="beginPlace('rot', $event)"
							>
								<i class="ti ti-rotate"></i>
							</button>
						</div>
					</div>
					<div
						v-if="transformMode"
						:class="$style.placeBar"
						@pointerdown.stop
					>
						<span>{{ Math.round(transform.w) }} × {{ Math.round(transform.h) }} ·
							{{ transform.rotation }}°</span><button
							type="button"
							:aria-label="copy.resetPlacement"
							@click="resetPlace"
						>
							<i class="ti ti-refresh"></i>
						</button><button type="button" @click="cancelTransform">
							{{ copy.cancel }}
						</button><button type="button" @click="applyTransform">
							{{ copy.place }}
						</button>
					</div>
					<div
						v-show="showMinimap && (canvasView.clipped || miniDragging)"
						:class="$style.minimap"
						:style="{ width: miniWidth + 14 + 'px' }"
						:aria-label="ui.preview"
						@pointerdown.stop
						@pointermove.stop="onMiniMove"
						@pointerup.stop="onMiniUp"
						@pointercancel.stop="onMiniUp"
						@lostpointercapture.stop="onMiniUp"
					>
						<canvas
							ref="miniCanvas"
							:width="miniWidth"
							:height="canvasView.miniHeight"
							aria-hidden="true"
						></canvas><button
							v-if="canvasView.rect"
							type="button"
							:class="$style.miniRect"
							:style="miniRect"
							:aria-label="ui.moveView"
							@pointerdown.stop="onMiniDown"
							@keydown="onMiniKey"
						></button>
					</div>
				</div>
				<div :class="$style.canvasToolbar">
					<div :class="$style.colorStrip">
						<button
							v-for="c in palette.slice(0, 6)"
							:key="c"
							type="button"
							:style="{ '--swatch': c }"
							:data-active="color === c"
							:aria-label="`${copy.color} ${c}`"
							@click="setColor(c)"
						></button><button
							type="button"
							:aria-label="copy.palette"
							@click="openPopup('color', $event)"
						>
							<i class="ti ti-plus"></i>
						</button>
					</div>
					<div :class="$style.zoomBar">
						<button
							type="button"
							:aria-label="ui.zoomOut"
							@click="setZoom(zoom / 1.2)"
						>
							<i class="ti ti-minus"></i>
						</button><span>{{ Math.round(zoom * 100) }}%</span><button
							type="button"
							:aria-label="ui.zoomIn"
							@click="setZoom(zoom * 1.2)"
						>
							<i class="ti ti-plus"></i>
						</button><button
							type="button"
							:aria-label="ui.fit"
							:title="ui.fit"
							@click="fitCanvas"
						>
							<i class="ti ti-maximize"></i>
						</button><button
							type="button"
							:aria-label="copy.togglePreview"
							:title="copy.togglePreview"
							:aria-pressed="showMinimap"
							@click="toggleMinimap"
						>
							<i :class="showMinimap ? 'ti ti-eye' : 'ti ti-eye-off'"></i>
						</button>
					</div>
				</div>
				<div :class="$style.workspaceStatus">
					<span>{{ canvasWidth }} × {{ canvasHeight }} px</span><span role="status">{{ saveStatus }}</span>
				</div>
			</section>
			<aside :class="$style.inspector" :aria-label="ui.panels" :inert="collapsed" :aria-hidden="collapsed ? 'true' : undefined">
				<nav :class="$style.panelNavigation">
					<button
						v-for="p in panelTabs"
						:key="p.id"
						type="button"
						:data-active="desktopPanel === p.id"
						:aria-label="p.name"
						:title="p.name"
						:aria-pressed="desktopPanel === p.id"
						@click="choosePanel(p.id)"
					>
						<i :class="p.icon"></i>
					</button>
				</nav>
				<div :class="$style.inspectorScroll">
					<Teleport
						:to="popupPanelHost || 'body'"
						:disabled="!panelPopup || !popupPanelHost"
					>
						<section
							v-show="visiblePanel === 'brush'"
							:class="$style.propertyPanel"
						>
							<h3>{{ copy.brushSize }}</h3>
							<div :class="$style.brushPreview">
								<span
									:style="{
										width: Math.min(brushSize, 60) + 'px',
										height: Math.min(brushSize, 60) + 'px',
										background: color,
										opacity: brushOpacity,
									}"
								></span>
							</div>
							<div :class="$style.presets">
								<button
									v-for="p in brushPresets"
									:key="p.id"
									type="button"
									:data-active="brushPreset === p.id"
									@click="choosePreset(p.id)"
								>
									{{ p.name }}
								</button>
							</div>
							<label>{{ copy.brushSize }} <output>{{ brushSize }} px</output><input
								v-model.number="brushSize"
								type="range"
								min="1"
								max="100"
							/></label><label>{{ copy.opacity }}
								<output>{{ Math.round(brushOpacity * 100) }}%</output><input
									v-model.number="brushOpacity"
									type="range"
									min="0.05"
									max="1"
									step="0.01"
								/></label><label>{{ ui.smoothing
							}}<input
								v-model.number="smoothing"
								type="range"
								min="0"
								max="1"
								step="0.05"
							/></label><label :class="$style.check"><input v-model="usePressure" type="checkbox"/>{{
								ui.pressure
							}}</label>
							<p :class="$style.muted">{{ pressureText }}</p>
							<label :class="$style.check"><input v-model="penOnly" type="checkbox"/>{{
								ui.penOnly
							}}</label><label :class="$style.check"><input v-model="fillShape" type="checkbox"/>{{
								copy.fillShape
							}}</label>
						</section>
						<section
							v-show="visiblePanel === 'color'"
							:class="$style.propertyPanel"
						>
							<div :class="$style.panelHeading">
								<h3>{{ copy.color }}</h3>
								<button
									type="button"
									:class="$style.iconButton"
									:aria-pressed="colorLocked"
									:aria-label="ui.lockColor"
									:title="ui.lockColor"
									@click="toggleColorLock"
								>
									<i
										:class="colorLocked ? 'ti ti-lock' : 'ti ti-lock-open'"
									></i>
								</button>
							</div>
							<div
								ref="svBox"
								:class="$style.svBox"
								:data-locked="colorLocked"
								:style="{
									background: `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${hsv.h},100%,50%))`,
								}"
								@pointerdown="onSvPointerDown"
								@pointermove="onColorMove"
								@pointerup="endColorDrag"
								@pointercancel="endColorDrag"
								@lostpointercapture="endColorDrag"
							>
								<button
									type="button"
									:class="$style.svHandle"
									:style="{
										left: hsv.s + '%',
										top: 100 - hsv.v + '%',
										'--picked-color': color,
									}"
									:aria-label="`${ui.saturation} (${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)`"
									:aria-disabled="colorLocked"
									@keydown="onSvKey"
								></button>
							</div>
							<div
								ref="hueRing"
								:class="$style.hueBar"
								role="slider"
								tabindex="0"
								:aria-label="ui.hue"
								aria-valuemin="0"
								aria-valuemax="360"
								:aria-valuenow="Math.round(hsv.h)"
								:aria-disabled="colorLocked"
								@pointerdown="onHuePointerDown"
								@pointermove="onColorMove"
								@pointerup="endColorDrag"
								@pointercancel="endColorDrag"
								@lostpointercapture="endColorDrag"
								@keydown="onHueKey"
							>
								<span
									:style="{
										left: (hsv.h / 360) * 100 + '%',
										background: `hsl(${hsv.h},100%,50%)`,
									}"
								></span>
							</div>
							<p :class="$style.muted">
								{{ colorLocked ? ui.colorLocked : ui.colorDrag }}
							</p>
							<label>{{ ui.colorCode
							}}<input
								:value="color"
								type="text"
								maxlength="7"
								spellcheck="false"
								:aria-invalid="colorError"
								@change="onColorInput"
							/></label>
							<p v-if="colorError" :class="$style.error" role="alert">
								{{ ui.invalidColor }}
							</p>
							<div :class="$style.palette">
								<button
									v-for="c in palette"
									:key="c"
									type="button"
									:style="{ '--swatch': c }"
									:data-active="color === c"
									:aria-label="`${copy.color} ${c}`"
									@click="setColor(c)"
								></button>
							</div>
							<button
								type="button"
								:class="$style.button"
								@click="selectTool('eyedropper')"
							>
								<i class="ti ti-color-picker"></i>{{ ui.eyedropper }}
							</button>
						</section>
						<section
							v-show="visiblePanel === 'layers'"
							:inert="editingBlocked()"
							:class="$style.propertyPanel"
						>
							<div :class="$style.panelHeading">
								<h3>{{ copy.layers }}</h3>
								<button
									type="button"
									:class="$style.iconButton"
									:aria-label="ui.addLayer"
									@click="addLayer"
								>
									<i class="ti ti-plus"></i>
								</button>
							</div>
							<p :class="$style.muted">{{ copy.layerOrderHint }}</p>
							<div>
								<div
									v-for="(ly, i) in layers"
									:key="ly.id"
									:class="$style.layer"
									:data-active="curLayer === i"
								>
									<button
										type="button"
										:class="$style.layerSelect"
										:aria-pressed="curLayer === i"
										@click="selectLayer(i)"
									>
										<canvas
											:ref="(el) => updateThumb(el as HTMLCanvasElement, ly)"
											:class="$style.layerThumb"
											aria-hidden="true"
										></canvas><span>{{ ly.name }}</span>
									</button><button
										type="button"
										:class="$style.iconButton"
										:aria-label="ly.visible ? ui.hideLayer : ui.showLayer"
										@click="
											ly.visible = !ly.visible;
											layerChanged();
										"
									>
										<i
											:class="ly.visible ? 'ti ti-eye' : 'ti ti-eye-off'"
										></i>
									</button>
								</div>
							</div>
							<template v-if="getLayer()">
								<label>{{ ui.layerName
								}}<input
									:value="getLayer().name"
									maxlength="40"
									@change="renameLayer"
								/></label><label>{{ ui.blend
								}}<select v-model="getLayer().blend" @change="layerChanged">
									<option value="normal">{{ copy.blendNormal }}</option>
									<option value="multiply">{{ copy.blendMultiply }}</option>
									<option value="screen">{{ copy.blendScreen }}</option>
									<option value="overlay">{{ copy.blendOverlay }}</option>
								</select></label><label>{{ copy.opacity
								}}<output>{{ Math.round(getLayer().opacity * 100) }}%</output><input
									v-model.number="getLayer().opacity"
									type="range"
									min="0"
									max="1"
									step="0.01"
									@input="composite"
									@change="saveHistory()"
								/></label>
								<div :class="$style.layerActions">
									<button
										type="button"
										:aria-label="ui.copyLayer"
										@click="duplicateLayer"
									>
										<i class="ti ti-copy"></i>
									</button><button
										type="button"
										:aria-label="copy.moveLayerUp"
										:disabled="curLayer === 0"
										@click="moveLayer(curLayer, -1)"
									>
										<i class="ti ti-arrow-up"></i>
									</button><button
										type="button"
										:aria-label="copy.moveLayerDown"
										:disabled="curLayer === layers.length - 1"
										@click="moveLayer(curLayer, 1)"
									>
										<i class="ti ti-arrow-down"></i>
									</button><button
										type="button"
										:aria-label="copy.delete"
										:disabled="layers.length <= 1"
										@click="delLayer(curLayer)"
									>
										<i class="ti ti-trash"></i>
									</button>
								</div>
							</template>
						</section>
						<section
							v-show="visiblePanel === 'effects'"
							:class="$style.propertyPanel"
						>
							<h3>{{ copy.filters }}</h3>
							<div :class="$style.filters">
								<button
									v-for="f in filters"
									:key="f.id"
									type="button"
									@click="applyFilter(f.id)"
								>
									{{ f.name }}
								</button>
							</div>
						</section>
						<section
							v-show="visiblePanel === 'canvas'"
							:inert="editingBlocked()"
							:class="$style.propertyPanel"
						>
							<h3>{{ ui.canvas }}</h3>
							<label>{{ ui.artworkName
							}}<input
								:value="fileName"
								maxlength="60"
								@change="renameFromInput"
							/></label><button
								type="button"
								:class="$style.button"
								@click="openPopup('dimensions', $event)"
							>
								{{ canvasWidth }} × {{ canvasHeight
								}}<i class="ti ti-dimensions"></i>
							</button><label>{{ copy.background
							}}<select v-model="bgMode" @change="saveHistory()">
								<option value="white">{{ ui.white }}</option>
								<option value="black">{{ ui.black }}</option>
								<option value="transparent">{{ ui.transparent }}</option>
							</select></label><button
								type="button"
								:class="$style.button"
								@click="openPopup('import', $event)"
							>
								<i class="ti ti-photo-plus"></i>{{ copy.importImage }}
							</button><button
								type="button"
								:class="$style.button"
								@click="openPopup('effects', $event)"
							>
								<i class="ti ti-wand"></i>{{ copy.filters }}
							</button><button
								type="button"
								:class="$style.button"
								@click="restoreDraft"
							>
								<i class="ti ti-history"></i>{{ ui.restoreDraft }}
							</button><button
								type="button"
								:class="$style.button"
								@click="clearLayer($event)"
							>
								<i class="ti ti-trash"></i>{{ copy.clear }}
							</button><button
								type="button"
								:class="$style.button"
								@click="openPopup('help', $event)"
							>
								<i class="ti ti-help"></i>{{ copy.help }}
							</button>
						</section>
					</Teleport>
					<button
						v-if="desktopPanel !== 'layers'"
						type="button"
						:class="$style.layerSummary"
						@click="choosePanel('layers')"
					>
						<i class="ti ti-stack-2"></i><span>{{ getLayer()?.name }}</span><small>{{ layers.length }}</small>
					</button>
				</div>
			</aside>
		</div>
		<div :class="$style.mobileQuick">
			<div>
				<button
					v-for="id in mobileTools"
					:key="id"
					type="button"
					:aria-label="toolById(id).name"
					:aria-pressed="activeTool === id"
					:data-active="activeTool === id"
					@click="selectTool(id)"
				>
					<i :class="toolById(id).icon"></i>
				</button>
			</div>
			<div>
				<button
					type="button"
					:aria-label="copy.undo"
					:disabled="historyIndex <= 0"
					@click="undo"
				>
					<i class="ti ti-arrow-back-up"></i>
				</button><button
					type="button"
					:aria-label="copy.redo"
					:disabled="historyIndex >= history.length - 1"
					@click="redo"
				>
					<i class="ti ti-arrow-forward-up"></i>
				</button>
			</div>
		</div>
		<nav :class="$style.mobileDock">
			<button
				v-for="p in mobilePanels"
				:key="p.id"
				type="button"
				@click="openPopup(p.id, $event)"
			>
				<i :class="p.icon"></i><span>{{ p.name }}</span>
			</button>
		</nav>
		<dialog
			:id="popupTitleId + '-dialog'"
			ref="popupEl"
			:open="!!displayPopupKind"
			:class="$style.popover"
			:data-sheet="hostSheet"
			:data-closing="hostSheet && !popupKind"
			:inert="hostSheet && !popupKind"
			:style="popupStyle"
			:aria-labelledby="popupTitleId"
			:aria-describedby="displayPopupKind === 'draft' ? popupTitleId + '-draft-description' : undefined"
			aria-modal="false"
			@cancel.prevent="closePopup()"
			@click.stop
			@keydown.esc.stop.prevent="closePopup()"
		>
			<div :class="$style.popoverScroll">
				<div :class="$style.popupHeading">
					<h2 :id="popupTitleId">{{ popupTitle }}</h2>
					<button
						type="button"
						:class="$style.iconButton"
						:aria-label="copy.close"
						@click="closePopup()"
					>
						<i class="ti ti-x"></i>
					</button>
				</div>
				<div ref="popupPanelHost"></div>
				<div v-if="displayPopupKind === 'tools'" :class="$style.popupTools">
					<button
						v-for="t in tools"
						:key="t.id"
						type="button"
						:data-active="activeTool === t.id"
						@click="selectTool(t.id)"
					>
						<i :class="t.icon"></i><span>{{ t.name }}</span>
					</button>
				</div>
				<template v-if="displayPopupKind === 'size'">
					<label>{{ copy.brushSize
					}}<input
						v-model.number="brushSize"
						type="range"
						min="1"
						max="100"
					/></label><label>{{ ui.value
					}}<input
						:value="brushSize"
						type="number"
						min="1"
						max="100"
						@change="setBrushSize"
					/></label>
				</template>
				<template v-if="displayPopupKind === 'opacity'">
					<label>{{ copy.opacity
					}}<input
						v-model.number="brushOpacity"
						type="range"
						min="0.05"
						max="1"
						step="0.01"
					/></label><label>{{ ui.value }} (%)<input
						:value="Math.round(brushOpacity * 100)"
						type="number"
						min="5"
						max="100"
						@change="setBrushOpacity"
					/></label>
				</template>
				<form v-if="displayPopupKind === 'rename'" @submit.prevent="commitRename">
					<label>{{ ui.artworkName
					}}<input
						ref="renameInput"
						v-model="nameDraft"
						maxlength="60"
						autocomplete="off"
						@compositionstart="composingName = true"
						@compositionend="composingName = false"
					/></label>
					<div :class="$style.actions">
						<button type="button" @click="closePopup()">
							{{ copy.cancel }}
						</button><button type="submit" :class="$style.primary">
							{{ copy.apply }}
						</button>
					</div>
				</form>
				<form
					v-if="displayPopupKind === 'dimensions'"
					@submit.prevent="resizeCanvas"
				>
					<label>{{ copy.width
					}}<input
						v-model.number="sizeDraft.w"
						type="number"
						min="100"
						max="4096"
						required
					/></label><label>{{ copy.height
					}}<input
						v-model.number="sizeDraft.h"
						type="number"
						min="100"
						max="4096"
						required
					/></label>
					<div :class="$style.actions">
						<button type="button" @click="closePopup()">
							{{ copy.cancel }}
						</button><button type="submit" :class="$style.primary">
							{{ copy.apply }}
						</button>
					</div>
				</form>
				<div v-if="displayPopupKind === 'export'" :class="$style.destinations">
					<button
						type="button"
						:disabled="saving"
						@click="requestExport('device')"
					>
						<i class="ti ti-download"></i><span>{{ ui.saveDevice }}</span>
					</button><button
						type="button"
						:disabled="saving"
						@click="requestExport('drive')"
					>
						<i class="ti ti-cloud-upload"></i><span>{{ ui.saveDrive }}</span>
					</button><button
						type="button"
						:disabled="saving"
						@click="requestExport('note')"
					>
						<i class="ti ti-note"></i><span>{{ ui.attachNote }}</span>
					</button>
				</div>
				<template v-if="displayPopupKind === 'consent'">
					<p>{{ ui.terms }}</p>
					<a
						v-if="instance.tosUrl"
						:href="instance.tosUrl"
						target="_blank"
						rel="noopener noreferrer"
					>{{ ui.readTerms }}<i class="ti ti-external-link"></i></a><label :class="$style.check"><input
						v-model="consentChecked"
						type="checkbox"
						:disabled="saving"
					/>{{ ui.agree }}</label>
					<p :class="$style.muted">{{ ui.once }}</p>
					<div :class="$style.actions">
						<button type="button" :disabled="saving" @click="closePopup()">
							{{ copy.cancel }}
						</button><button
							type="button"
							:class="$style.primary"
							:disabled="!consentChecked || saving"
							@click="acceptConsent"
						>
							{{ saving ? ui.working : ui.agreeContinue }}
						</button>
					</div>
				</template>
				<div v-if="displayPopupKind === 'import'" :class="$style.destinations">
					<button type="button" @click="importFromDevice">
						<i class="ti ti-device-laptop"></i>{{ ui.fromDevice }}
					</button><button type="button" @click="importImage">
						<i class="ti ti-cloud"></i>{{ ui.fromDrive }}
					</button>
				</div>
				<template v-if="displayPopupKind === 'help'">
					<p>{{ ui.help }}</p>
					<p>B / E / I / H · Ctrl / ⌘ + Z</p>
					<p>
						{{ copy.development }}: {{ developmentCreditName }}<br/>{{
							copy.debuggingCooperation
						}}: {{ debuggingCreditName }}
					</p>
					<p :class="$style.muted">Righteous · SIL OFL 1.1</p>
				</template>
				<template v-if="displayPopupKind === 'confirm'">
					<p>{{ confirmText }}</p>
					<div :class="$style.actions">
						<button type="button" @click="closePopup()">
							{{ copy.cancel }}
						</button><button
							type="button"
							:class="$style.primary"
							@click="runConfirmation"
						>
							{{ copy.apply }}
						</button>
					</div>
				</template>
				<template v-if="displayPopupKind === 'draft'">
					<p :id="popupTitleId + '-draft-description'">{{ ui.draftLocalOnly }}</p>
					<p v-if="draftExists" :class="$style.muted">{{ ui.replaceDraft }}</p>
					<div :class="$style.draftActions">
						<button type="button" :class="$style.primary" @click="saveDraftAndClose">
							{{ ui.saveDraftAndClose }}
						</button>
						<button type="button" @click="closeWithoutSaving">
							{{ ui.closeWithoutSaving }}
						</button>
						<button ref="continueEditingButton" type="button" @click="closePopup()">
							{{ ui.continueEditing }}
						</button>
					</div>
					<p v-if="draftError" :class="$style.error" role="alert">{{ draftError }}</p>
				</template>
				<p v-if="exportError" :class="$style.error" role="alert">
					{{ exportError }}
				</p>
			</div>
		</dialog>
		<input
			ref="imageInput"
			type="file"
			accept="image/png,image/jpeg,image/webp"
			hidden
			@change="onDeviceImage"
		/>
		<p v-if="notice" :class="$style.notice" role="status">{{ notice }}</p>
	</div>
</MkModal>
</template>

<script lang="ts" setup>
import {
	ref,
	reactive,
	computed,
	watch,
	onMounted,
	onUnmounted,
	nextTick,
	inject,
	useCssModule,
	useId,
} from 'vue';
import type { CSSProperties } from 'vue';
import type { entities } from 'cherrypick-js';
import type { HatadintDraft } from '@/utility/hatadint-document.js';
import MkModal from '@/components/MkModal.vue';
import { HATA_GOES_HOST } from '@/utility/hatagoes-context.js';
import * as os from '@/os.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { instance } from '@/instance.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { uploadFile, chooseDriveFile } from '@/utility/drive.js';
import { getProxiedImageUrl } from '@/utility/media-proxy.js';
import { hatadintCopy as ui } from '@/utility/hatadint-copy.js';
import {
	penPressure,
	pointerSamples,
	getCanvasView,
	minimapPanFromDrag,
	hexToHsv,
	hsvToHex,
} from '@/utility/hatadint-input.js';
import {
	hatadintDraftKey,
	parseHatadintDraft,
	serializeHatadintDraft,
} from '@/utility/hatadint-document.js';

const props = withDefaults(defineProps<{ canAttach?: boolean }>(), {
	canAttach: false,
});
const hataGoesHost = inject(HATA_GOES_HOST, null);
const emit = defineEmits<{
	(ev: 'closed'): void;
	(ev: 'done', file: entities.DriveFile): void;
}>();
const style = useCssModule();
const copy = i18n.ts._hata._drawingTool;
const copyx = i18n.tsx._hata._drawingTool;
const layerName = (number: number): string =>
	copyx.layerName({ number: number.toString() });
const developmentCreditName = 'Tolehata';
const debuggingCreditName = 'くりきんとん';
const accountId = $i?.id ?? 'guest';
const draftKey = hatadintDraftKey(accountId);
const modal = ref<InstanceType<typeof MkModal>>();
const rootEl = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
const previewCanvas = ref<HTMLCanvasElement>();
const miniCanvas = ref<HTMLCanvasElement>();
const lassoCanvas = ref<HTMLCanvasElement>();
const hueRing = ref<HTMLElement>();
const svBox = ref<HTMLElement>();
const scroller = ref<HTMLElement>();
const nameButton = ref<HTMLButtonElement>();
const closeButton = ref<HTMLButtonElement>();
const continueEditingButton = ref<HTMLButtonElement>();
const renameInput = ref<HTMLInputElement>();
const imageInput = ref<HTMLInputElement>();
const popupEl = ref<HTMLDialogElement>();
const popupPanelHost = ref<HTMLElement>();
const canvasWidth = ref(1000),
	canvasHeight = ref(800),
	zoom = ref(1);
const fileName = ref(ui.untitled),
	nameDraft = ref(''),
	composingName = ref(false);
const sizeDraft = reactive({ w: 1000, h: 800 });
const brushSize = ref(12),
	brushOpacity = ref(1),
	smoothing = ref(0.3);
const color = ref('#248ba5'),
	colorError = ref(false),
	colorLocked = ref(false);
const usePressure = ref(true),
	penOnly = ref(false),
	pressureText = ref(ui.pressureWaiting);
const currentTool = ref('pen'),
	previousTool = ref('pen'),
	panMode = ref(false),
	panning = ref(false);
const fillShape = ref(false),
	brushPreset = ref('pen');
const bgMode = ref<'white' | 'black' | 'transparent'>('white');
// Exported PNGs do not retain editable layers; only a local draft saves those.
const draftDirty = ref(false),
	saving = ref(false),
	restoring = ref(false),
	drawing = ref(false);
const showMinimap = ref(true),
	miniDragging = ref(false),
	collapsed = ref(false),
	isMobile = ref(false);
const panX = ref(0),
	panY = ref(0),
	viewportSize = reactive({ width: 0, height: 0 });
const hsv = reactive({ h: 192, s: 78, v: 65 });
const startPt = reactive({ x: 0, y: 0 }),
	lastPt = reactive({ x: 0, y: 0 });
const transformMode = ref(false);
const transform = reactive({
	img: null as HTMLImageElement | null,
	x: 0,
	y: 0,
	w: 0,
	h: 0,
	rotation: 0,
});
const placementCorners = ['nw', 'ne', 'sw', 'se'] as const;
const tools = [
	{ id: 'pen', name: ui.pen, icon: 'ti ti-brush' },
	{ id: 'eraser', name: copy.toolEraser, icon: 'ti ti-eraser' },
	{ id: 'fill', name: copy.toolFill, icon: 'ti ti-paint' },
	{ id: 'eyedropper', name: ui.eyedropper, icon: 'ti ti-color-picker' },
	{ id: 'line', name: copy.toolLine, icon: 'ti ti-line' },
	{ id: 'rect', name: copy.toolRectangle, icon: 'ti ti-square' },
	{ id: 'circle', name: copy.toolCircle, icon: 'ti ti-circle' },
	{ id: 'blur', name: copy.toolBlur, icon: 'ti ti-blur' },
	{ id: 'lasso', name: copy.toolLasso, icon: 'ti ti-lasso' },
	{ id: 'transform', name: ui.transform, icon: 'ti ti-transform' },
	{ id: 'crop', name: copy.toolCrop, icon: 'ti ti-crop' },
	{ id: 'hand', name: copy.handTool, icon: 'ti ti-hand-stop' },
];
const toolGroups = [
	{ label: ui.draw, items: tools.slice(0, 4) },
	{ label: ui.shapes, items: tools.slice(4, 7) },
	{ label: ui.edit, items: tools.slice(7, 11) },
	{ label: ui.view, items: tools.slice(11) },
];
const toolById = (id: string) => tools.find((t) => t.id === id) ?? tools[0];
const activeTool = computed(() => (panMode.value ? 'hand' : currentTool.value));
const activeToolInfo = computed(() => toolById(activeTool.value));
const previousToolName = computed(() => toolById(previousTool.value).name);
const previousToolIcon = computed(() => toolById(previousTool.value).icon);
const mobileTools = ['pen', 'eraser', 'hand'];
const brushPresets = [
	{ id: 'pen', name: ui.pen },
	{ id: 'pencil', name: ui.pencil },
	{ id: 'marker', name: ui.marker },
	{ id: 'airbrush', name: ui.airbrush },
];
const panelTabs = [
	{ id: 'brush', name: copy.brushSize, icon: 'ti ti-brush' },
	{ id: 'color', name: copy.color, icon: 'ti ti-palette' },
	{ id: 'layers', name: copy.layers, icon: 'ti ti-stack-2' },
	{ id: 'effects', name: copy.filters, icon: 'ti ti-wand' },
	{ id: 'canvas', name: ui.canvas, icon: 'ti ti-adjustments' },
];
const mobilePanels = [
	{ id: 'tools', name: copy.tools, icon: 'ti ti-brush' },
	...panelTabs.slice(1, 2),
	panelTabs[0],
	panelTabs[2],
	{ id: 'canvas', name: ui.more, icon: 'ti ti-dots' },
];
const desktopPanel = ref('color'),
	popupKind = ref('');
const renderedPopupKind = ref('');
const hostSheet = computed(() => !!hataGoesHost && isMobile.value);
const displayPopupKind = computed(() => popupKind.value || (hostSheet.value ? renderedPopupKind.value : ''));
let popupCloseTimer: number | undefined;
const panelPopup = computed(() =>
	panelTabs.some((p) => p.id === displayPopupKind.value),
);
const visiblePanel = computed(() =>
	panelPopup.value ? displayPopupKind.value : desktopPanel.value,
);
const popupTitle = computed(
	() =>
		panelTabs.find((p) => p.id === displayPopupKind.value)?.name ??
		(
			{
				rename: ui.rename,
				dimensions: copy.canvasSize,
				tools: copy.tools,
				size: copy.brushSize,
				opacity: copy.opacity,
				export: ui.export,
				consent: ui.consentTitle,
				import: copy.importImage,
				help: copy.help,
				confirm: copy.confirmation,
				draft: ui.draftTitle,
			} as Record<string, string>
		)[displayPopupKind.value],
);
const popupTitleId = `hatadint-popup-${useId()}`;
const popupStyle = ref<CSSProperties>({});
let popupAnchor: HTMLElement | null = null;
let popupAnchorBounds: { left: number; top: number; width: number; height: number } | null = null;
const confirmText = ref('');
let confirmation: (() => void) | null = null;
const consentChecked = ref(false),
	exportError = ref('');
const draftExists = ref(false),
	draftError = ref('');
type Destination = 'device' | 'drive' | 'note';
let pendingDestination: Destination | null = null;
let abortUpload: (() => void) | null = null;
const filters = [
	{ id: 'gray', name: copy.filterGrayscale },
	{ id: 'sepia', name: copy.filterSepia },
	{ id: 'invert', name: copy.filterInvert },
	{ id: 'bright+', name: copy.filterBrighter },
	{ id: 'bright-', name: copy.filterDarker },
	{ id: 'contrast+', name: copy.filterContrastUp },
	{ id: 'contrast-', name: copy.filterContrastDown },
	{ id: 'saturate+', name: copy.filterSaturationUp },
	{ id: 'saturate-', name: copy.filterSaturationDown },
	{ id: 'blur', name: copy.filterBlur },
	{ id: 'sharpen', name: copy.filterSharpen },
	{ id: 'noise', name: copy.filterNoise },
];
const palette = [
	'#2e4049',
	'#ffffff',
	'#248ba5',
	'#78bfca',
	'#d98d88',
	'#e7bb7e',
	'#799d8a',
	'#9c8aaf',
	'#356aac',
	'#d95570',
	'#846347',
	'#bcc8cb',
];
type Layer = {
	id: number;
	name: string;
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	visible: boolean;
	opacity: number;
	blend: 'normal' | 'multiply' | 'screen' | 'overlay';
};
const layers = ref<Layer[]>([]),
	curLayer = ref(0);
let nextLayerId = 1;
type Snapshot = {
	width: number;
	height: number;
	name: string;
	bg: typeof bgMode.value;
	active: number;
	layers: {
		id: number;
		name: string;
		visible: boolean;
		opacity: number;
		blend: Layer['blend'];
		pixels: ImageData;
	}[];
};
const history = ref<Snapshot[]>([]),
	historyIndex = ref(-1);
const lassoPath = ref<{ x: number; y: number }[]>([]);
const lasso = ref<{
	x: number;
	y: number;
	w: number;
	h: number;
	scale: number;
	rotation: number;
	data: ImageData;
	pts: { x: number; y: number }[];
} | null>(null);
const lassoOutlinePoints = computed(() => lasso.value?.pts.map(p => `${p.x},${p.y}`).join(' ') ?? '');
const draggingLasso = ref(false);
const previewCtx = computed(() => previewCanvas.value?.getContext('2d'));
const miniWidth = computed(() =>
	Math.max(
		1,
		Math.min(
			160,
			Math.max(1, viewportSize.width - 40),
			(Math.max(1, Math.min(128, viewportSize.height - 40)) *
				canvasWidth.value) /
				canvasHeight.value,
		),
	),
);
const canvasView = computed(() =>
	getCanvasView(
		canvasWidth.value,
		canvasHeight.value,
		zoom.value,
		panX.value,
		panY.value,
		viewportSize.width,
		viewportSize.height,
		miniWidth.value,
	),
);
const miniRect = computed(() => {
	const r = canvasView.value.rect;
	return r
		? {
			left: `${r.left + 6}px`,
			top: `${r.top + 6}px`,
			width: `${r.width}px`,
			height: `${r.height}px`,
		}
		: {};
});
const saveStatus = ref(ui.unsaved),
	notice = ref('');
let noticeTimer: number | undefined;
let observer: ResizeObserver | undefined,
	disposed = false;

function tell(text: string) {
	notice.value = text;
	window.clearTimeout(noticeTimer);
	noticeTimer = window.setTimeout(() => {
		notice.value = '';
	}, 4200);
}

function getLayer() {
	return layers.value[curLayer.value];
}

function makeLayer(
	name: string,
	width = canvasWidth.value,
	height = canvasHeight.value,
): Layer {
	const c = window.document.createElement('canvas');
	c.width = width;
	c.height = height;
	return {
		id: nextLayerId++,
		name,
		canvas: c,
		ctx: c.getContext('2d', { willReadFrequently: true })!,
		visible: true,
		opacity: 1,
		blend: 'normal',
	};
}

function assertAccount() {
	if (($i?.id ?? 'guest') !== accountId) throw new Error(ui.accountChanged);
}

function editingBlocked() {
	return (
		saving.value ||
		restoring.value ||
		drawing.value ||
		!!lasso.value ||
		transformMode.value
	);
}

function fitCanvas() {
	if (!scroller.value) return;
	zoom.value = Math.min(
		1,
		Math.max(
			0.05,
			Math.min(
				(scroller.value.clientWidth - 28) / canvasWidth.value,
				(scroller.value.clientHeight - 28) / canvasHeight.value,
			),
		),
	);
	panX.value = 0;
	panY.value = 0;
}

function setZoom(value: number) {
	if (Number.isFinite(value)) zoom.value = Math.max(0.05, Math.min(10, value));
}

function choosePanel(id: string) {
	closePopup(false);
	desktopPanel.value = id;
}

function selectTool(id: string) {
	if (saving.value || restoring.value || drawing.value) return;
	if (id === 'hand') {
		if (!panMode.value) previousTool.value = currentTool.value;
		panMode.value = true;
	} else {
		panMode.value = false;
		currentTool.value = id;
		previousTool.value = id;
	}
	if (
		id === 'transform' &&
		!lasso.value &&
		!transformMode.value &&
		getLayer()
	) {
		lassoPath.value = [
			{ x: 0, y: 0 },
			{ x: canvasWidth.value, y: 0 },
			{ x: canvasWidth.value, y: canvasHeight.value },
			{ x: 0, y: canvasHeight.value },
		];
		createLasso(getLayer());
		lassoPath.value = [];
	}
	closePopup();
}

function toggleHand() {
	selectTool(panMode.value ? previousTool.value : 'hand');
}

function choosePreset(id: string) {
	brushPreset.value = id;
	brushSize.value =
		(
			{ pen: 12, pencil: 4, marker: 28, airbrush: 40 } as Record<string, number>
		)[id] ?? 12;
	brushOpacity.value =
		(
			{ pen: 1, pencil: 0.8, marker: 0.5, airbrush: 0.25 } as Record<
				string,
				number
			>
		)[id] ?? 1;
	panMode.value = false;
	currentTool.value = 'pen';
	previousTool.value = 'pen';
}

function setBrushSize(event: Event) {
	const input = event.target as HTMLInputElement;
	const n = Number(input.value);
	if (input.value.trim() && Number.isFinite(n)) brushSize.value = Math.max(1, Math.min(100, Math.round(n)));
	input.value = String(brushSize.value);
}

function setBrushOpacity(event: Event) {
	const input = event.target as HTMLInputElement;
	const n = Number(input.value);
	if (input.value.trim() && Number.isFinite(n)) brushOpacity.value = Math.max(0.05, Math.min(1, n / 100));
	input.value = String(Math.round(brushOpacity.value * 100));
}

function setName(name: string) {
	if (editingBlocked()) return;
	const next = name.trim().slice(0, 60) || ui.untitled;
	if (next !== fileName.value) {
		fileName.value = next;
		saveHistory();
	}
}

function renameFromInput(event: Event) {
	const input = event.target as HTMLInputElement;
	setName(input.value);
	input.value = fileName.value;
}

function commitRename() {
	if (composingName.value) return;
	setName(nameDraft.value);
	closePopup();
}

function addLayer() {
	if (editingBlocked()) return;
	if (layers.value.length >= 32) return tell(ui.layerLimit);
	layers.value.splice(curLayer.value, 0, makeLayer(layerName(nextLayerId)));
	composite();
	saveHistory();
}

function duplicateLayer() {
	if (editingBlocked()) return;
	if (layers.value.length >= 32) return tell(ui.layerLimit);
	const ly = getLayer();
	if (!ly) return;
	const c = makeLayer(`${ly.name} ${ui.copyLayer}`.slice(0, 40));
	c.ctx.drawImage(ly.canvas, 0, 0);
	c.opacity = ly.opacity;
	c.blend = ly.blend;
	layers.value.splice(curLayer.value, 0, c);
	composite();
	saveHistory();
}

function delLayer(i: number) {
	if (editingBlocked() || layers.value.length <= 1) return;
	layers.value.splice(i, 1);
	curLayer.value = Math.min(curLayer.value, layers.value.length - 1);
	composite();
	saveHistory();
}

function moveLayer(i: number, dir: number) {
	if (editingBlocked()) return;
	const next = i + dir;
	if (next < 0 || next >= layers.value.length) return;
	[layers.value[i], layers.value[next]] = [layers.value[next], layers.value[i]];
	curLayer.value = next;
	composite();
	saveHistory();
}

function renameLayer(event: Event) {
	const input = event.target as HTMLInputElement;
	if (editingBlocked()) return;
	getLayer().name =
		input.value.trim().slice(0, 40) || layerName(curLayer.value + 1);
	input.value = getLayer().name;
	saveHistory();
}

function layerChanged() {
	if (editingBlocked()) return;
	composite();
	saveHistory();
}

function blendToOp(b: string): GlobalCompositeOperation {
	return b === 'multiply'
		? 'multiply'
		: b === 'screen'
			? 'screen'
			: b === 'overlay'
				? 'overlay'
				: 'source-over';
}

function composite() {
	if (!canvas.value) return;
	const ctx = canvas.value.getContext('2d')!;
	ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
	if (bgMode.value !== 'transparent') {
		ctx.fillStyle = bgMode.value;
		ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value);
	}
	for (let i = layers.value.length - 1; i >= 0; i--) {
		const ly = layers.value[i];
		if (!ly.visible) continue;
		ctx.globalAlpha = ly.opacity;
		ctx.globalCompositeOperation = blendToOp(ly.blend);
		ctx.drawImage(ly.canvas, 0, 0);
	}
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = 'source-over';
	updateMinimap();
	nextTick(updateThumbnails);
}

function updateMinimap() {
	if (!miniCanvas.value || !canvas.value) return;
	const mx = miniCanvas.value.getContext('2d')!;
	mx.clearRect(0, 0, miniCanvas.value.width, miniCanvas.value.height);
	if (bgMode.value !== 'transparent') {
		mx.fillStyle = bgMode.value;
		mx.fillRect(0, 0, miniCanvas.value.width, miniCanvas.value.height);
	}
	mx.drawImage(
		canvas.value,
		0,
		0,
		miniCanvas.value.width,
		miniCanvas.value.height,
	);
}

function updateThumb(el: HTMLCanvasElement | null, ly: Layer) {
	if (!el?.getContext) return;
	el.width = 76;
	el.height = 68;
	el.getContext('2d')!.drawImage(ly.canvas, 0, 0, 76, 68);
}

function updateThumbnails() {
	rootEl.value
		?.querySelectorAll<HTMLCanvasElement>(`.${style.layerThumb}`)
		.forEach((el, i) => {
			if (layers.value[i]) updateThumb(el, layers.value[i]);
		});
}

function snapshot(): Snapshot {
	return {
		width: canvasWidth.value,
		height: canvasHeight.value,
		name: fileName.value,
		bg: bgMode.value,
		active: curLayer.value,
		layers: layers.value.map((ly) => ({
			id: ly.id,
			name: ly.name,
			visible: ly.visible,
			opacity: ly.opacity,
			blend: ly.blend,
			pixels: ly.ctx.getImageData(0, 0, canvasWidth.value, canvasHeight.value),
		})),
	};
}

function saveHistory(persist = true) {
	const next = snapshot();
	history.value = history.value.slice(0, historyIndex.value + 1);
	history.value.push(next);
	while (
		history.value.length > 1 &&
		(history.value.length > 32 ||
			history.value.reduce(
				(sum, s) => sum + s.width * s.height * 4 * s.layers.length,
				0,
			) > 96_000_000)
	) history.value.shift();
	historyIndex.value = history.value.length - 1;
	if (persist) {
		markDraftDirty();
	}
}

async function restoreHistory() {
	const s = history.value[historyIndex.value];
	if (!s) return;
	restoring.value = true;
	const restored = s.layers.map((ly) => {
		const c = makeLayer(ly.name, s.width, s.height);
		c.id = ly.id;
		c.visible = ly.visible;
		c.opacity = ly.opacity;
		c.blend = ly.blend;
		c.ctx.putImageData(ly.pixels, 0, 0);
		return c;
	});
	layers.value = restored;
	canvasWidth.value = s.width;
	canvasHeight.value = s.height;
	fileName.value = s.name;
	bgMode.value = s.bg;
	curLayer.value = Math.min(s.active, restored.length - 1);
	nextLayerId = Math.max(...restored.map((l) => l.id)) + 1;
	await nextTick();
	composite();
	markDraftDirty();
	restoring.value = false;
}

function undo() {
	if (editingBlocked()) return;
	if (historyIndex.value > 0) {
		historyIndex.value--;
		void restoreHistory();
	}
}

function redo() {
	if (editingBlocked()) return;
	if (historyIndex.value < history.value.length - 1) {
		historyIndex.value++;
		void restoreHistory();
	}
}

function packDraft(): HatadintDraft {
	return {
		version: 1,
		width: canvasWidth.value,
		height: canvasHeight.value,
		name: fileName.value,
		bg: bgMode.value,
		active: curLayer.value,
		layers: layers.value.map((ly) => ({
			id: ly.id,
			name: ly.name,
			visible: ly.visible,
			opacity: ly.opacity,
			blend: ly.blend,
			data: ly.canvas.toDataURL('image/png'),
		})),
	};
}

function markDraftDirty() {
	draftDirty.value = true;
	saveStatus.value = ui.unsaved;
}

function saveDraft(): boolean {
	if (disposed || editingBlocked()) return false;
	try {
		assertAccount();
		const serialized = serializeHatadintDraft(packDraft());
		// Deliberately use the browser-only key, outside preferences and cloud backup.
		localStorage.setItem(draftKey, serialized);
		saveStatus.value = ui.draftSaved;
		draftDirty.value = false;
		draftError.value = '';
		return true;
	} catch (error) {
		saveStatus.value = ui.draftFailed;
		draftError.value = error instanceof Error && error.message === ui.accountChanged ? ui.accountChanged : ui.draftFailed;
		return false;
	}
}

function saveDraftAndClose() {
	if (popupKind.value !== 'draft' || !saveDraft()) return;
	closePopup(false);
	modal.value?.close();
}

function closeWithoutSaving() {
	if (popupKind.value !== 'draft' || editingBlocked()) return;
	// Preserve any previously saved draft; this session has made no storage writes.
	closePopup(false);
	modal.value?.close();
}

async function loadDraft(raw: string) {
	if (editingBlocked()) return;
	restoring.value = true;
	try {
		const data = parseHatadintDraft(raw);
		const restored = await Promise.all(
			data.layers.map(async (ly) => {
				const img = await decodeImage(ly.data);
				if (
					img.naturalWidth !== data.width ||
					img.naturalHeight !== data.height
				) throw new Error('invalid dimensions');
				const c = makeLayer(ly.name, data.width, data.height);
				c.id = ly.id;
				c.visible = ly.visible;
				c.opacity = ly.opacity;
				c.blend = ly.blend;
				c.ctx.drawImage(img, 0, 0);
				return c;
			}),
		);
		if (disposed) return;
		layers.value = restored;
		canvasWidth.value = data.width;
		canvasHeight.value = data.height;
		fileName.value = data.name;
		bgMode.value = data.bg;
		curLayer.value = data.active;
		nextLayerId = Math.max(...restored.map((l) => l.id)) + 1;
		await nextTick();
		composite();
		saveHistory();
		draftDirty.value = false;
		saveStatus.value = ui.draftSaved;
		fitCanvas();
	} catch {
		tell(ui.restoreFailed);
	} finally {
		restoring.value = false;
	}
}

function restoreDraft() {
	if (editingBlocked()) return tell(ui.finishEdit);
	try {
		const raw = localStorage.getItem(draftKey);
		if (!raw) return tell(ui.noDraft);
		askConfirmation(ui.restoreWarning, () => {
			void loadDraft(raw);
		});
	} catch {
		tell(ui.restoreFailed);
	}
}

function askConfirmation(text: string, fn: () => void, event?: Event) {
	void openPopup('confirm', event).then((opened) => {
		if (opened) {
			confirmText.value = text;
			confirmation = fn;
		}
	});
}

function runConfirmation() {
	const fn = confirmation;
	closePopup();
	fn?.();
}

function clearLayer(event?: Event) {
	if (editingBlocked()) return tell(ui.finishEdit);
	askConfirmation(
		copy.confirmClearLayer,
		() => {
			getLayer().ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
			composite();
			saveHistory();
		},
		event,
	);
}

async function resizeCanvas() {
	if (editingBlocked()) return;
	const w = Math.max(100, Math.min(4096, Math.round(sizeDraft.w))),
		h = Math.max(100, Math.min(4096, Math.round(sizeDraft.h)));
	if (!Number.isFinite(w) || !Number.isFinite(h)) return;
	for (const ly of layers.value) {
		const tmp = window.document.createElement('canvas');
		tmp.width = ly.canvas.width;
		tmp.height = ly.canvas.height;
		tmp.getContext('2d')!.drawImage(ly.canvas, 0, 0);
		ly.canvas.width = w;
		ly.canvas.height = h;
		ly.ctx.drawImage(tmp, 0, 0);
	}
	canvasWidth.value = w;
	canvasHeight.value = h;
	await nextTick();
	composite();
	saveHistory();
	fitCanvas();
	closePopup();
}

// Pointer ownership keeps palm input and canceled gestures out of the artwork.
type Point = { x: number; y: number };
type Stroke = {
	id: number;
	type: string;
	tool: string;
	layer: Layer;
	backup: ImageData | null;
	pressure: number;
	x: number;
	y: number;
	panX: number;
	panY: number;
};
let stroke: Stroke | null = null;
const fingers = new Map<number, Point>();
let pinch: {
	distance: number;
	center: Point;
	zoom: number;
	panX: number;
	panY: number;
} | null = null;
let gestureConsumed = false;
const clamp = (v: number, min: number, max: number) =>
	Math.max(min, Math.min(max, v));

function capture(el: HTMLElement | undefined, id: number) {
	try {
		el?.setPointerCapture(id);
	} catch {
		/* Synthetic events and detached elements have no active pointer. */
	}
}

function release(el: HTMLElement | undefined, id: number) {
	if (el?.hasPointerCapture(id)) el.releasePointerCapture(id);
}

function canvasPoint(e: Pick<PointerEvent, 'clientX' | 'clientY'>): Point {
	const r = canvas.value!.getBoundingClientRect();
	return {
		x: ((e.clientX - r.left) * canvasWidth.value) / r.width,
		y: ((e.clientY - r.top) * canvasHeight.value) / r.height,
	};
}

function boundedPoint(p: Point): Point {
	return {
		x: clamp(p.x, 0, canvasWidth.value),
		y: clamp(p.y, 0, canvasHeight.value),
	};
}

function viewScale() {
	const el = scroller.value;
	return el && el.clientWidth
		? el.getBoundingClientRect().width / el.clientWidth || 1
		: 1;
}

function touchGeometry() {
	const [a, b] = Array.from(fingers.values());
	return {
		distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
		center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
	};
}

function rollbackStroke(keepCapture = false) {
	const old = stroke;
	stroke = null;
	drawing.value = false;
	panning.value = false;
	if (old?.backup) {
		old.layer.ctx.putImageData(old.backup, 0, 0);
		composite();
	}
	clearPreview();
	lassoPath.value = [];
	if (old && !keepCapture) release(scroller.value, old.id);
}

function updatePressure(e: PointerEvent) {
	if (e.pointerType !== 'pen') return;
	pressureText.value =
		Number.isFinite(e.pressure) && e.pressure >= 0 && e.pressure <= 1
			? `${Math.round(e.pressure * 100)}%`
			: ui.pressureUnavailable;
}

function paintSegment(p: Point, pressure: number, dot = false) {
	if (!stroke) return;
	const ctx = stroke.layer.ctx;
	const preset = brushPreset.value;
	const width =
		brushSize.value *
		(usePressure.value && stroke.type === 'pen' ? 0.15 + 0.85 * pressure : 1);
	ctx.save();
	ctx.globalCompositeOperation =
		stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
	ctx.globalAlpha = brushOpacity.value;
	ctx.fillStyle = color.value;
	ctx.strokeStyle = color.value;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.lineWidth = width;
	if (preset === 'airbrush' && stroke.tool !== 'eraser') {
		ctx.shadowColor = color.value;
		ctx.shadowBlur = width / 2;
	}
	if (dot) {
		ctx.beginPath();
		ctx.arc(p.x, p.y, width / 2, 0, Math.PI * 2);
		ctx.fill();
	} else {
		ctx.beginPath();
		ctx.moveTo(lastPt.x, lastPt.y);
		ctx.lineTo(p.x, p.y);
		ctx.stroke();
	}
	ctx.restore();
	lastPt.x = p.x;
	lastPt.y = p.y;
}

function onPtrDown(e: PointerEvent) {
	if (
		saving.value ||
		restoring.value ||
		popupKind.value ||
		!canvas.value ||
		e.button > 1 ||
		(e.target as HTMLElement).closest('button')
	) return;
	if (e.pointerType === 'touch') {
		if (stroke?.type === 'pen' || fingers.size >= 2) return;
		fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		capture(scroller.value, e.pointerId);
		if (fingers.size >= 2) {
			rollbackStroke(true);
			pinch = {
				...touchGeometry(),
				zoom: zoom.value,
				panX: panX.value,
				panY: panY.value,
			};
			gestureConsumed = true;
			e.preventDefault();
			return;
		}
		if (gestureConsumed || (penOnly.value && !panMode.value)) return;
	} else if (
		e.pointerType === 'pen' &&
		(stroke?.type === 'touch' || fingers.size || pinch)
	) {
		rollbackStroke();
		const ids = Array.from(fingers.keys());
		fingers.clear();
		pinch = null;
		gestureConsumed = false;
		for (const id of ids) release(scroller.value, id);
	}
	if (stroke) return;
	const hand = panMode.value || e.button === 1;
	if (!hand && (lasso.value || transformMode.value)) return;
	const layer = getLayer();
	if (!layer) return;
	const p = canvasPoint(e);
	if (
		!hand &&
		(p.x < 0 || p.y < 0 || p.x > canvasWidth.value || p.y > canvasHeight.value)
	) return;
	if (!hand && !layer.visible) return tell(ui.hiddenLayer);
	e.preventDefault();
	capture(scroller.value, e.pointerId);
	updatePressure(e);
	stroke = {
		id: e.pointerId,
		type: e.pointerType,
		tool: hand ? 'hand' : currentTool.value,
		layer,
		backup: hand
			? null
			: layer.ctx.getImageData(0, 0, canvasWidth.value, canvasHeight.value),
		pressure: penPressure(e, usePressure.value),
		x: e.clientX,
		y: e.clientY,
		panX: panX.value,
		panY: panY.value,
	};
	Object.assign(startPt, p);
	Object.assign(lastPt, p);
	if (hand) {
		panning.value = true;
		return;
	}
	drawing.value = true;
	if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
		paintSegment(p, stroke.pressure, true);
		composite();
	} else if (stroke.tool === 'lasso') lassoPath.value = [boundedPoint(p)];
	else if (stroke.tool === 'eyedropper') {
		const pixel = canvas.value
			.getContext('2d')!
			.getImageData(
				Math.min(canvasWidth.value - 1, Math.floor(p.x)),
				Math.min(canvasHeight.value - 1, Math.floor(p.y)),
				1,
				1,
			).data;
		setColor(
			pixel[3]
				? '#' +
						Array.from(pixel.slice(0, 3))
							.map((v) => v.toString(16).padStart(2, '0'))
							.join('')
				: bgMode.value === 'black'
					? '#000000'
					: '#ffffff',
		);
	}
}

function onPtrMove(e: PointerEvent) {
	if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
	if (pinch && fingers.size >= 2) {
		const next = touchGeometry(),
			scale = viewScale();
		setZoom((pinch.zoom * next.distance) / pinch.distance);
		const ratio = zoom.value / pinch.zoom,
			r = scroller.value!.getBoundingClientRect(),
			cx = r.left + r.width / 2,
			cy = r.top + r.height / 2;
		panX.value =
			pinch.panX * ratio +
			(next.center.x - cx - (pinch.center.x - cx) * ratio) / scale;
		panY.value =
			pinch.panY * ratio +
			(next.center.y - cy - (pinch.center.y - cy) * ratio) / scale;
		return;
	}
	if (!stroke || e.pointerId !== stroke.id) return;
	e.preventDefault();
	if (stroke.tool === 'hand') {
		panX.value = stroke.panX + (e.clientX - stroke.x) / viewScale();
		panY.value = stroke.panY + (e.clientY - stroke.y) / viewScale();
		return;
	}
	for (const sample of pointerSamples(e)) {
		updatePressure(sample);
		stroke.pressure = penPressure(sample, usePressure.value);
		const p = canvasPoint(sample);
		if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
			const factor = 1 - smoothing.value * 0.75;
			paintSegment(
				{
					x: lastPt.x + (p.x - lastPt.x) * factor,
					y: lastPt.y + (p.y - lastPt.y) * factor,
				},
				stroke.pressure,
			);
		} else if (stroke.tool === 'blur') {
			applyBlurStroke(stroke.layer, lastPt.x, lastPt.y, p.x, p.y);
			Object.assign(lastPt, p);
		} else if (stroke.tool === 'lasso') {
			lassoPath.value.push(boundedPoint(p));
			drawLassoPreview();
		} else if (['line', 'rect', 'circle', 'crop'].includes(stroke.tool)) drawShapePreview(
			stroke.tool === 'crop' ? boundedPoint(p).x : p.x,
			stroke.tool === 'crop' ? boundedPoint(p).y : p.y,
		);
	}
	if (['pen', 'eraser', 'blur'].includes(stroke.tool)) composite();
}

function finishFinger(e: PointerEvent) {
	fingers.delete(e.pointerId);
	if (fingers.size < 2) pinch = null;
	if (!fingers.size) gestureConsumed = false;
}

function onPtrUp(e: PointerEvent) {
	const wasGesture = gestureConsumed;
	finishFinger(e);
	if (!stroke || stroke.id !== e.pointerId) {
		release(scroller.value, e.pointerId);
		return;
	}
	const ended = stroke;
	if (wasGesture) {
		rollbackStroke();
		return;
	}
	const p = canvasPoint(e);
	if (ended.tool === 'pen' || ended.tool === 'eraser') paintSegment(p, ended.pressure);
	else if (['line', 'rect', 'circle'].includes(ended.tool)) {
		drawShapePreview(p.x, p.y);
		ended.layer.ctx.save();
		ended.layer.ctx.globalAlpha = 1;
		ended.layer.ctx.drawImage(previewCanvas.value!, 0, 0);
		ended.layer.ctx.restore();
	} else if (ended.tool === 'fill') floodFill(
		ended.layer,
		Math.min(canvasWidth.value - 1, Math.floor(p.x)),
		Math.min(canvasHeight.value - 1, Math.floor(p.y)),
	);
	stroke = null;
	drawing.value = false;
	panning.value = false;
	clearPreview();
	release(scroller.value, e.pointerId);
	if (ended.tool === 'hand') return;
	if (ended.tool === 'crop') {
		const q = boundedPoint(p);
		void doCrop(q.x, q.y);
		return;
	}
	if (ended.tool === 'lasso') {
		createLasso(ended.layer);
		lassoPath.value = [];
		return;
	}
	if (ended.tool === 'eyedropper') {
		selectTool('pen');
		return;
	}
	composite();
	saveHistory();
}

function cancelPointer(e: PointerEvent) {
	finishFinger(e);
	if (stroke?.id === e.pointerId) rollbackStroke();
}

function onWheel(e: WheelEvent) {
	if (drawing.value || saving.value || restoring.value) return;
	const r = scroller.value!.getBoundingClientRect(),
		before = zoom.value;
	setZoom(before * Math.exp(-e.deltaY * 0.0015));
	const ratio = zoom.value / before;
	panX.value =
		panX.value * ratio +
		((e.clientX - r.left - r.width / 2) * (1 - ratio)) / viewScale();
	panY.value =
		panY.value * ratio +
		((e.clientY - r.top - r.height / 2) * (1 - ratio)) / viewScale();
}

let miniDrag: {
	id: number;
	el: HTMLElement;
	x: number;
	y: number;
	panX: number;
	panY: number;
	width: number;
} | null = null;

function onMiniDown(e: PointerEvent) {
	if (e.button !== 0 || !miniCanvas.value || saving.value || drawing.value) return;
	e.preventDefault();
	const el = miniCanvas.value.parentElement!;
	miniDrag = {
		id: e.pointerId,
		el,
		x: e.clientX,
		y: e.clientY,
		panX: panX.value,
		panY: panY.value,
		width: miniCanvas.value.getBoundingClientRect().width,
	};
	miniDragging.value = true;
	capture(el, e.pointerId);
}

function onMiniMove(e: PointerEvent) {
	if (!miniDrag || miniDrag.id !== e.pointerId) return;
	const p = minimapPanFromDrag(
		miniDrag.panX,
		miniDrag.panY,
		e.clientX - miniDrag.x,
		e.clientY - miniDrag.y,
		canvasWidth.value,
		canvasHeight.value,
		zoom.value,
		miniDrag.width,
	);
	panX.value = p.x;
	panY.value = p.y;
}

function onMiniUp(e?: PointerEvent) {
	if (!miniDrag || (e && e.pointerId !== miniDrag.id)) return;
	const old = miniDrag;
	miniDrag = null;
	miniDragging.value = false;
	release(old.el, old.id);
}

function onMiniKey(e: KeyboardEvent) {
	const step = e.shiftKey ? 100 : 20;
	const moves: Record<string, Point> = {
		ArrowLeft: { x: step, y: 0 },
		ArrowRight: { x: -step, y: 0 },
		ArrowUp: { x: 0, y: step },
		ArrowDown: { x: 0, y: -step },
	};
	const d = moves[e.key];
	if (!d) return;
	e.preventDefault();
	panX.value += d.x;
	panY.value += d.y;
}

function toggleMinimap() {
	onMiniUp();
	showMinimap.value = !showMinimap.value;
}

let colorDrag: {
	id: number;
	kind: 'sv' | 'hue';
	el: HTMLElement;
	dx: number;
	dy: number;
} | null = null;

function setColor(value: string) {
	const parsed = hexToHsv(value, hsv);
	if (!parsed) return false;
	endColorDrag();
	Object.assign(hsv, parsed);
	color.value = hsvToHex(hsv.h, hsv.s, hsv.v);
	colorError.value = false;
	return true;
}

function onColorInput(e: Event) {
	const el = e.target as HTMLInputElement;
	colorError.value = !setColor(el.value.trim());
	if (!colorError.value) el.value = color.value;
}

function beginColor(e: PointerEvent, kind: 'sv' | 'hue') {
	if (colorLocked.value || e.button !== 0 || colorDrag || saving.value) return;
	e.preventDefault();
	const el = e.currentTarget as HTMLElement,
		r = el.getBoundingClientRect(),
		handle = (e.target as HTMLElement).closest('button,span');
	colorDrag = {
		id: e.pointerId,
		kind,
		el,
		dx: handle
			? e.clientX -
				r.left -
				(kind === 'sv' ? hsv.s / 100 : hsv.h / 360) * r.width
			: 0,
		dy: handle ? e.clientY - r.top - (1 - hsv.v / 100) * r.height : 0,
	};
	capture(el, e.pointerId);
	onColorMove(e);
}

function onSvPointerDown(e: PointerEvent) {
	beginColor(e, 'sv');
}

function onHuePointerDown(e: PointerEvent) {
	beginColor(e, 'hue');
}

function onColorMove(e: PointerEvent) {
	if (!colorDrag || colorDrag.id !== e.pointerId || colorLocked.value) return;
	const d = colorDrag,
		r = d.el.getBoundingClientRect();
	if (!r.width || !r.height) return;
	if (d.kind === 'sv') {
		hsv.s = clamp(((e.clientX - r.left - d.dx) / r.width) * 100, 0, 100);
		hsv.v = clamp((1 - (e.clientY - r.top - d.dy) / r.height) * 100, 0, 100);
	} else hsv.h = clamp(((e.clientX - r.left - d.dx) / r.width) * 360, 0, 360);
	color.value = hsvToHex(hsv.h, hsv.s, hsv.v);
	colorError.value = false;
}

function endColorDrag(e?: PointerEvent) {
	if (!colorDrag || (e && e.pointerId !== colorDrag.id)) return;
	const old = colorDrag;
	colorDrag = null;
	release(old.el, old.id);
}

function toggleColorLock() {
	endColorDrag();
	colorLocked.value = !colorLocked.value;
}

function onSvKey(e: KeyboardEvent) {
	if (colorLocked.value) return;
	const n = e.shiftKey ? 10 : 1;
	if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
	e.preventDefault();
	hsv.s = clamp(
		hsv.s + (e.key === 'ArrowRight' ? n : e.key === 'ArrowLeft' ? -n : 0),
		0,
		100,
	);
	hsv.v = clamp(
		hsv.v + (e.key === 'ArrowUp' ? n : e.key === 'ArrowDown' ? -n : 0),
		0,
		100,
	);
	color.value = hsvToHex(hsv.h, hsv.s, hsv.v);
}

function onHueKey(e: KeyboardEvent) {
	if (
		colorLocked.value ||
		![
			'ArrowLeft',
			'ArrowRight',
			'ArrowUp',
			'ArrowDown',
			'Home',
			'End',
		].includes(e.key)
	) return;
	e.preventDefault();
	const n = e.shiftKey ? 10 : 1;
	hsv.h =
		e.key === 'Home'
			? 0
			: e.key === 'End'
				? 360
				: clamp(
					hsv.h + (['ArrowRight', 'ArrowUp'].includes(e.key) ? n : -n),
					0,
					360,
				);
	color.value = hsvToHex(hsv.h, hsv.s, hsv.v);
}

async function openPopup(
	kind: string,
	event?: Event | HTMLElement,
): Promise<boolean> {
	if (saving.value || restoring.value) return false;
	if (
		['rename', 'dimensions', 'export', 'import'].includes(kind) &&
		editingBlocked()
	) {
		tell(ui.finishEdit);
		return false;
	}
	const candidate =
		event instanceof HTMLElement
			? event
			: event?.currentTarget instanceof HTMLElement
				? event.currentTarget
				: null;
	const anchor =
		candidate && !popupEl.value?.contains(candidate)
			? candidate
			: popupAnchor || nameButton.value || null;
	if (popupKind.value === kind && anchor === popupAnchor) {
		closePopup();
		return false;
	}
	// Panel contents can move into the popup and hide the original button on the next tick.
	const anchorBounds = measurePopupAnchor(anchor) ?? popupAnchorBounds;
	closePopup(false);
	if (popupCloseTimer != null) window.clearTimeout(popupCloseTimer);
	popupCloseTimer = undefined;
	renderedPopupKind.value = kind;
	popupAnchor = anchor;
	popupAnchorBounds = anchorBounds;
	popupKind.value = kind;
	exportError.value = '';
	if (kind === 'consent') consentChecked.value = false;
	if (kind === 'draft') draftError.value = '';
	if (kind === 'rename') nameDraft.value = fileName.value;
	if (kind === 'dimensions') Object.assign(sizeDraft, { w: canvasWidth.value, h: canvasHeight.value });
	anchor?.setAttribute('aria-expanded', 'true');
	anchor?.setAttribute('aria-controls', popupTitleId + '-dialog');
	anchor?.setAttribute('aria-haspopup', 'dialog');
	await nextTick();
	if (disposed || popupKind.value !== kind) return false;
	positionPopup();
	await nextTick();
	const focus =
		kind === 'rename'
			? renameInput.value
			: kind === 'draft'
				? continueEditingButton.value
				: popupEl.value?.querySelector<HTMLElement>(
					'input:not([disabled]),button:not([disabled]),select',
				);
	focus?.focus({ preventScroll: true });
	if (kind === 'rename') renameInput.value?.select();
	return true;
}

function closePopup(restoreFocus = true) {
	if (saving.value) return;
	endColorDrag();
	const anchor = popupAnchor;
	popupAnchor = null;
	popupAnchorBounds = null;
	popupKind.value = '';
	if (popupCloseTimer != null) window.clearTimeout(popupCloseTimer);
	if (hostSheet.value && renderedPopupKind.value) {
		popupCloseTimer = window.setTimeout(() => { renderedPopupKind.value = ''; popupCloseTimer = undefined; }, 140);
	} else {
		renderedPopupKind.value = '';
		popupCloseTimer = undefined;
	}
	pendingDestination = null;
	confirmation = null;
	anchor?.setAttribute('aria-expanded', 'false');
	if (restoreFocus) {
		void nextTick(() => {
			if (!disposed && !popupKind.value && anchor?.isConnected) anchor.focus({ preventScroll: true });
		});
	}
}

function measurePopupAnchor(anchor: HTMLElement | null) {
	const root = rootEl.value;
	if (!root || !anchor || !anchor.isConnected || popupEl.value?.contains(anchor)) return null;
	const a = anchor.getBoundingClientRect();
	if (!a.width || !a.height) return null;
	const r = root.getBoundingClientRect(), scale = r.width / root.clientWidth || 1;
	return { left: (a.left - r.left) / scale, top: (a.top - r.top) / scale, width: a.width / scale, height: a.height / scale };
}

function positionPopup() {
	const root = rootEl.value,
		el = popupEl.value;
	if (!root || !el || !popupKind.value) return;
	if (hostSheet.value) {
		popupStyle.value = { left: '0', top: 'auto', bottom: '0', width: '100%', maxHeight: 'min(78dvh, 620px)', '--popup-height': 'min(78dvh, 620px)' } as CSSProperties;
		return;
	}
	const r = root.getBoundingClientRect(), scale = r.width / root.clientWidth || 1;
	popupAnchorBounds = measurePopupAnchor(popupAnchor) ?? popupAnchorBounds;
	const a = popupAnchorBounds ?? { left: 0, top: 0, width: root.clientWidth, height: 0 };
	const vv = window.visualViewport,
		top = Math.max(8, ((vv?.offsetTop ?? 0) - r.top) / scale + 8),
		bottom = Math.min(
			root.clientHeight - 8,
			((vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - r.top) /
				scale -
				8,
		);
	const width = Math.min(324, root.clientWidth - 16),
		height = Math.min(580, Math.max(100, bottom - top)),
		x = clamp(
			a.left + a.width / 2 - width / 2,
			8,
			Math.max(8, root.clientWidth - width - 8),
		);
	popupStyle.value = {
		width: `${width}px`,
		maxHeight: `${height}px`,
		'--popup-height': `${height}px`,
		left: `${x}px`,
		top: `${top}px`,
	};
	void nextTick(() => {
		if (!popupKind.value) return;
		const h = Math.min(el.offsetHeight, height),
			below = a.top + a.height + 10,
			above = a.top - 10 - h,
			side = below + h <= bottom ? 'bottom' : above >= top ? 'top' : 'bottom';
		const y = clamp(
			side === 'bottom' ? below : above,
			top,
			Math.max(top, bottom - h),
		);
		popupStyle.value = {
			...popupStyle.value,
			top: `${y}px`,
			'--arrow-x': `${clamp(a.left + a.width / 2 - x, 20, width - 20)}px`,
		} as CSSProperties;
		el.dataset.side = side;
	});
}

function dismissOutside(e: Event) {
	if (!popupKind.value || saving.value) return;
	const target = e.target as Node;
	if (popupEl.value?.contains(target) || popupAnchor?.contains(target)) return;
	closePopup(false);
	if (scroller.value?.contains(target)) {
		e.preventDefault();
		e.stopPropagation();
	}
}

function onKeyDown(e: KeyboardEvent) {
	if (e.key === 'Escape') {
		e.stopPropagation();
		e.preventDefault();
		if (popupKind.value) closePopup();
		else if (lasso.value) cancelLasso();
		else if (transformMode.value) cancelTransform();
		else onCloseClick();
		return;
	}
	if (
		e.isComposing ||
		(e.target instanceof HTMLElement &&
			e.target.closest('input,select,textarea,[contenteditable="true"]')) ||
		popupKind.value ||
		saving.value
	) return;
	if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
		e.preventDefault();
		e.shiftKey ? redo() : undo();
		return;
	}
	if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
		e.preventDefault();
		redo();
		return;
	}
	if (e.ctrlKey || e.metaKey || e.altKey) return;
	const tool = (
		{
			b: 'pen',
			e: 'eraser',
			i: 'eyedropper',
			h: 'hand',
			g: 'fill',
			l: 'lasso',
			r: 'rect',
			o: 'circle',
		} as Record<string, string>
	)[e.key.toLowerCase()];
	if (tool) {
		e.preventDefault();
		tool === 'hand' ? toggleHand() : selectTool(tool);
	}
}

function onEscape() {
	if (popupKind.value) closePopup();
	else onCloseClick();
}

function onModalClick() {
	if (popupKind.value) closePopup();
	else onCloseClick();
}

function onCloseClick(event?: Event) {
	if (saving.value || restoring.value) return;
	if (lasso.value || transformMode.value || drawing.value) return tell(ui.finishEdit);
	if (draftDirty.value) {
		try {
			draftExists.value = localStorage.getItem(draftKey) !== null;
		} catch {
			draftExists.value = false;
		}
		void openPopup('draft', event ?? closeButton.value);
	} else modal.value?.close();
}

function decodeImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(copy.importFailed));
		img.src = src;
	});
}

async function stageImage(src: string) {
	if (editingBlocked()) return;
	restoring.value = true;
	try {
		const img = await decodeImage(src);
		if (disposed) return;
		if (
			img.naturalWidth <= 0 ||
			img.naturalHeight <= 0 ||
			img.naturalWidth * img.naturalHeight > 67_108_864
		) throw new Error(ui.tooLarge);
		transform.img = img;
		transformMode.value = true;
		restoring.value = false;
		resetPlace();
	} catch (error) {
		tell(error instanceof Error ? error.message : copy.importFailed);
	} finally {
		restoring.value = false;
	}
}

function importFromDevice() {
	if (editingBlocked()) return tell(ui.finishEdit);
	closePopup();
	imageInput.value?.click();
}

async function onDeviceImage(e: Event) {
	const el = e.target as HTMLInputElement,
		file = el.files?.[0];
	el.value = '';
	if (!file) return;
	if (
		file.size > 20 * 1024 * 1024 ||
		!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
	) return tell(ui.tooLarge);
	const url = URL.createObjectURL(file);
	try {
		await stageImage(url);
	} finally {
		if (disposed || transform.img?.src !== url) URL.revokeObjectURL(url);
	}
}

async function importImage() {
	if (editingBlocked()) return tell(ui.finishEdit);
	const anchor = popupAnchor || nameButton.value;
	closePopup();
	try {
		const files = await chooseDriveFile({ multiple: false });
		if (disposed || !files.length) return;
		const file = files[0];
		if (!file.type.startsWith('image/')) return tell(copy.importFailed);
		await stageImage(getProxiedImageUrl(file.url, undefined, true));
	} catch {
		if (!disposed) tell(copy.importFailed);
	} finally {
		anchor?.focus({ preventScroll: true });
	}
}

function updateLayout() {
	const root = rootEl.value,
		s = scroller.value;
	if (!root || !s) return;
	const mobile = root.clientWidth < 700;
	if (mobile !== isMobile.value) {
		isMobile.value = mobile;
		closePopup(false);
	}
	viewportSize.width = s.clientWidth;
	viewportSize.height = s.clientHeight;
	positionPopup();
}

watch([canvasWidth, canvasHeight, zoom, panX, panY, bgMode, miniWidth], () => {
	void nextTick(updateMinimap);
});
watch(bgMode, composite);
watch(collapsed, () => {
	if (collapsed.value) closePopup(false);
	void nextTick(updateLayout);
});
onMounted(async () => {
	layers.value = [makeLayer(layerName(1))];
	setColor(color.value);
	await nextTick();
	if (disposed) return;
	composite();
	saveHistory(false);
	observer = new ResizeObserver(updateLayout);
	if (rootEl.value) observer.observe(rootEl.value);
	if (scroller.value) observer.observe(scroller.value);
	updateLayout();
	fitCanvas();
	window.addEventListener('resize', updateLayout);
	window.visualViewport?.addEventListener('resize', positionPopup);
	window.visualViewport?.addEventListener('scroll', positionPopup);
});
onUnmounted(() => {
	disposed = true;
	if (popupCloseTimer != null) window.clearTimeout(popupCloseTimer);
	observer?.disconnect();
	window.clearTimeout(noticeTimer);
	abortUpload?.();
	rollbackStroke();
	onMiniUp();
	endColorDrag();
	cleanupEngineDrags();
	fingers.clear();
	window.removeEventListener('resize', updateLayout);
	window.visualViewport?.removeEventListener('resize', positionPopup);
	window.visualViewport?.removeEventListener('scroll', positionPopup);
});

function selectLayer(index: number) {
	if (editingBlocked()) return tell(ui.finishEdit);
	curLayer.value = index;
}

function createExportPng(): Promise<Blob> {
	const output = window.document.createElement('canvas');
	output.width = canvasWidth.value;
	output.height = canvasHeight.value;
	const context = output.getContext('2d');
	if (!context) return Promise.reject(new Error(copy.saveFailed));
	if (bgMode.value !== 'transparent') {
		context.fillStyle = bgMode.value;
		context.fillRect(0, 0, output.width, output.height);
	}
	for (let i = layers.value.length - 1; i >= 0; i--) {
		const layer = layers.value[i];
		if (!layer.visible) continue;
		context.globalAlpha = layer.opacity;
		context.globalCompositeOperation = blendToOp(layer.blend);
		context.drawImage(layer.canvas, 0, 0);
	}
	context.globalAlpha = 1;
	context.globalCompositeOperation = 'source-over';
	return new Promise((resolve, reject) => {
		output.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error(copy.saveFailed))),
			'image/png',
		);
	});
}

function setExportFailure(error: unknown, fallback: string) {
	if (disposed) return;
	exportError.value =
		error instanceof Error &&
		[ui.accountChanged, ui.loginRequired].includes(error.message)
			? error.message
			: fallback;
}

async function requestExport(destination: Destination) {
	if (disposed || saving.value) return;
	if (editingBlocked()) return tell(ui.finishEdit);
	exportError.value = '';
	const anchor = popupAnchor;
	saving.value = true;
	try {
		assertAccount();
		if (destination === 'device') {
			await performExport(destination);
			if (disposed) return;
			assertAccount();
			return;
		}
		if (!$i) throw new Error(ui.loginRequired);
		let result;
		try {
			result = await misskeyApi('hata/consent/get', {});
			if (disposed) return;
			assertAccount();
			if (typeof result?.agreed !== 'boolean') throw new Error(ui.consentFailed);
		} catch (error) {
			setExportFailure(error, ui.consentFailed);
			return;
		}
		if (result.agreed === true) {
			await performExport(destination);
			if (disposed) return;
			assertAccount();
		} else {
			consentChecked.value = false;
			saving.value = false;
			const opened = await openPopup('consent', anchor ?? undefined);
			if (disposed) return;
			assertAccount();
			if (opened) pendingDestination = destination;
		}
	} catch (error) {
		setExportFailure(error, copy.saveFailed);
	} finally {
		if (!disposed) saving.value = false;
	}
}

async function acceptConsent() {
	if (disposed || saving.value || !consentChecked.value || !pendingDestination) return;
	const destination = pendingDestination;
	exportError.value = '';
	saving.value = true;
	try {
		assertAccount();
		if (!$i) throw new Error(ui.loginRequired);
		await misskeyApi('hata/consent/update', { type: 'drawing', agree: true });
		if (disposed) return;
		assertAccount();
		const result = await misskeyApi('hata/consent/get', {});
		if (disposed) return;
		assertAccount();
		if (result.agreed !== true) throw new Error(ui.consentFailed);
	} catch (error) {
		setExportFailure(error, ui.consentFailed);
		if (!disposed) saving.value = false;
		return;
	}
	try {
		await performExport(destination);
		if (disposed) return;
		assertAccount();
	} catch (error) {
		if (!disposed) {
			// Consent was recorded. Retrying a failed upload must not ask for it again.
			const anchor = popupAnchor;
			saving.value = false;
			await openPopup('export', anchor ?? undefined);
			if (disposed) return;
			let failure = error;
			try {
				assertAccount();
			} catch (accountError) {
				failure = accountError;
			}
			setExportFailure(failure, copy.saveFailed);
		}
	} finally {
		if (!disposed) saving.value = false;
	}
}

async function performExport(destination: Destination) {
	if (disposed) return;
	assertAccount();
	const name =
		(fileName.value
			.trim()
			.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '_')
			.replace(/\.png$/i, '') || ui.untitled) + '.png';
	const blob = await createExportPng();
	if (disposed) return;
	assertAccount();
	if (destination === 'device') {
		const objectUrl = URL.createObjectURL(blob);
		const link = window.document.createElement('a');
		link.href = objectUrl;
		link.download = name;
		window.document.body.append(link);
		try {
			link.click();
		} finally {
			link.remove();
			// Keep the object alive until the browser has picked up the download.
			window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
		}
		saving.value = false;
		closePopup();
		tell(ui.downloaded);
		return;
	}
	if (!$i) throw new Error(ui.loginRequired);
	const task = uploadFile(blob, { name, source: 'hatadint' });
	abortUpload = task.abort;
	let file: entities.DriveFile;
	try {
		file = await task.filePromise;
		if (disposed) return;
		assertAccount();
	} finally {
		abortUpload = null;
	}
	if (destination === 'note') {
		if (props.canAttach) {
			emit('done', file);
			saving.value = false;
			closePopup();
			onCloseClick();
		} else {
			// os.post resolves when its composer closes; opening it is the action here.
			void os
				.post({ initialFiles: [file] })
				.catch((error) => setExportFailure(error, copy.saveFailed));
			saving.value = false;
			closePopup();
		}
	} else {
		saving.value = false;
		closePopup();
		tell(ui.savedDrive);
	}
}

function drawLassoPreview() {
	const ctx = previewCtx.value;
	if (!ctx || !lassoPath.value.length) return;
	clearPreview();
	ctx.save();
	ctx.strokeStyle = color.value;
	ctx.lineWidth = 1.5 / zoom.value;
	ctx.setLineDash([6 / zoom.value, 4 / zoom.value]);
	ctx.beginPath();
	ctx.moveTo(lassoPath.value[0].x, lassoPath.value[0].y);
	for (const point of lassoPath.value) ctx.lineTo(point.x, point.y);
	ctx.stroke();
	ctx.restore();
}

function drawShapePreview(x: number, y: number) {
	const p = { x, y };
	const ctx = previewCtx.value;
	if (!ctx || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
	clearPreview();
	const isCrop = currentTool.value === 'crop';
	ctx.save();
	ctx.strokeStyle = color.value;
	ctx.fillStyle = color.value;
	ctx.globalAlpha = isCrop ? 1 : brushOpacity.value;
	ctx.lineWidth = isCrop ? 1.5 / zoom.value : brushSize.value;
	ctx.lineCap = 'round';
	if (isCrop) ctx.setLineDash([6 / zoom.value, 4 / zoom.value]);
	if (currentTool.value === 'line') {
		ctx.beginPath();
		ctx.moveTo(startPt.x, startPt.y);
		ctx.lineTo(p.x, p.y);
		ctx.stroke();
	} else if (currentTool.value === 'rect' || isCrop) {
		if (fillShape.value && !isCrop) ctx.fillRect(startPt.x, startPt.y, p.x - startPt.x, p.y - startPt.y);
		else ctx.strokeRect(startPt.x, startPt.y, p.x - startPt.x, p.y - startPt.y);
	} else if (currentTool.value === 'circle') {
		ctx.beginPath();
		ctx.arc(
			startPt.x,
			startPt.y,
			Math.hypot(p.x - startPt.x, p.y - startPt.y),
			0,
			Math.PI * 2,
		);
		if (fillShape.value) ctx.fill();
		else ctx.stroke();
	}
	ctx.restore();
}

function clearPreview() {
	previewCtx.value?.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
}

function applyBlurStroke(
	ly: Layer,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
) {
	if (
		!ly ||
		!ly.visible ||
		saving.value ||
		restoring.value ||
		![x1, y1, x2, y2].every(Number.isFinite)
	) return;
	const dist = Math.hypot(x2 - x1, y2 - y1),
		steps = Math.max(1, Math.ceil(dist / 4));
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		blurAt(ly, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, brushSize.value);
	}
}

function blurAt(ly: Layer, cx: number, cy: number, size: number) {
	const rr = Math.ceil(size);
	if (
		rr <= 0 ||
		cx + rr <= 0 ||
		cy + rr <= 0 ||
		cx - rr >= canvasWidth.value ||
		cy - rr >= canvasHeight.value
	) return;
	const sx = Math.max(0, Math.floor(cx - rr)),
		sy = Math.max(0, Math.floor(cy - rr));
	const ex = Math.min(canvasWidth.value, Math.ceil(cx + rr)),
		ey = Math.min(canvasHeight.value, Math.ceil(cy + rr));
	const sw = ex - sx,
		sh = ey - sy;
	if (sw <= 0 || sh <= 0) return;
	const img = ly.ctx.getImageData(sx, sy, sw, sh),
		d = img.data,
		w = img.width,
		h = img.height;
	const out = new Uint8ClampedArray(d),
		k = Math.max(1, Math.floor(size / 6));
	for (let yy = k; yy < h - k; yy++) {
		for (let xx = k; xx < w - k; xx++) {
			let tr = 0,
				tg = 0,
				tb = 0,
				ta = 0,
				count = 0;
			for (let ky = -k; ky <= k; ky++) {
				for (let kx = -k; kx <= k; kx++) {
					const i = ((yy + ky) * w + (xx + kx)) * 4;
					tr += d[i];
					tg += d[i + 1];
					tb += d[i + 2];
					ta += d[i + 3];
					count++;
				}
			}
			const i = (yy * w + xx) * 4;
			out[i] = tr / count;
			out[i + 1] = tg / count;
			out[i + 2] = tb / count;
			out[i + 3] = ta / count;
		}
	}
	d.set(out);
	ly.ctx.putImageData(img, sx, sy);
}

function floodFill(ly: Layer, fx: number, fy: number) {
	if (
		!ly ||
		!ly.visible ||
		saving.value ||
		restoring.value ||
		!Number.isFinite(fx) ||
		!Number.isFinite(fy)
	) return;
	fx = Math.floor(fx);
	fy = Math.floor(fy);
	const w = canvasWidth.value,
		h = canvasHeight.value;
	if (fx < 0 || fx >= w || fy < 0 || fy >= h) return;
	const img = ly.ctx.getImageData(0, 0, w, h),
		d = img.data;
	const initial = (fy * w + fx) * 4;
	const target = [d[initial], d[initial + 1], d[initial + 2], d[initial + 3]];
	const fill = hexToRgb(color.value),
		opacity = brushOpacity.value;
	if (
		opacity <= 0 ||
		(target[0] === fill[0] &&
			target[1] === fill[1] &&
			target[2] === fill[2] &&
			target[3] === 255)
	) return;
	// Scan whole connected spans instead of keeping several point arrays per pixel.
	const visited = new Uint8Array(w * h),
		stack = [fy * w + fx],
		tolerance = 32;
	const matches = (x: number, y: number) => {
		const key = y * w + x,
			i = key * 4;
		return (
			x >= 0 &&
			x < w &&
			y >= 0 &&
			y < h &&
			!visited[key] &&
			Math.abs(d[i] - target[0]) <= tolerance &&
			Math.abs(d[i + 1] - target[1]) <= tolerance &&
			Math.abs(d[i + 2] - target[2]) <= tolerance &&
			Math.abs(d[i + 3] - target[3]) <= tolerance
		);
	};
	while (stack.length) {
		const key = stack.pop()!,
			y = Math.floor(key / w);
		let x = key % w;
		if (!matches(x, y)) continue;
		while (matches(x - 1, y)) x--;
		let above = false,
			below = false;
		for (; x < w && matches(x, y); x++) {
			const i = (y * w + x) * 4;
			visited[y * w + x] = 1;
			const oldAlpha = d[i + 3] / 255,
				alpha = opacity + oldAlpha * (1 - opacity);
			for (let channel = 0; channel < 3; channel++) d[i + channel] =
					(fill[channel] * opacity +
						d[i + channel] * oldAlpha * (1 - opacity)) /
					alpha;
			d[i + 3] = alpha * 255;
			const nextAbove = matches(x, y - 1),
				nextBelow = matches(x, y + 1);
			if (nextAbove && !above) stack.push((y - 1) * w + x);
			if (nextBelow && !below) stack.push((y + 1) * w + x);
			above = nextAbove;
			below = nextBelow;
		}
	}
	ly.ctx.putImageData(img, 0, 0);
}

function hexToRgb(hex: string): [number, number, number] {
	const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return match
		? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)]
		: [0, 0, 0];
}

async function doCrop(endX: number, endY: number) {
	const cx = startPt.x,
		cy = startPt.y,
		cw = endX - cx,
		ch = endY - cy;
	if (
		saving.value ||
		restoring.value ||
		lasso.value ||
		transformMode.value ||
		![cx, cy, cw, ch].every(Number.isFinite)
	) return;
	const left = Math.max(0, Math.floor(Math.min(cx, cx + cw))),
		top = Math.max(0, Math.floor(Math.min(cy, cy + ch)));
	const right = Math.min(canvasWidth.value, Math.ceil(Math.max(cx, cx + cw))),
		bottom = Math.min(canvasHeight.value, Math.ceil(Math.max(cy, cy + ch)));
	const width = right - left,
		height = bottom - top;
	if (
		width < 1 ||
		height < 1 ||
		(left === 0 &&
			top === 0 &&
			width === canvasWidth.value &&
			height === canvasHeight.value)
	) return;
	restoring.value = true;
	try {
		// Keep layer order, hidden content and blend metadata while changing bounds.
		const cropped = layers.value.map((ly) => {
			const c = makeLayer(ly.name, width, height);
			c.id = ly.id;
			c.visible = ly.visible;
			c.opacity = ly.opacity;
			c.blend = ly.blend;
			c.ctx.drawImage(ly.canvas, left, top, width, height, 0, 0, width, height);
			return c;
		});
		layers.value = cropped;
		canvasWidth.value = width;
		canvasHeight.value = height;
		clearPreview();
		await nextTick();
		if (disposed) return;
		composite();
		saveHistory();
		fitCanvas();
	} finally {
		restoring.value = false;
	}
}

let lassoSource: {
	layerId: number;
	x: number;
	y: number;
	pixels: ImageData;
} | null = null;
let lassoDrag: {
	pointerId: number;
	target: HTMLElement;
	clientX: number;
	clientY: number;
	x: number;
	y: number;
	scale: number;
} | null = null;

function createLasso(ly: Layer) {
	if (
		saving.value ||
		restoring.value ||
		lasso.value ||
		transformMode.value ||
		!ly.visible
	) return;
	const pts = lassoPath.value;
	if (
		pts.length < 3 ||
		pts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
	) return;
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	for (const p of pts) {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	}
	const x = Math.max(0, Math.floor(minX)),
		y = Math.max(0, Math.floor(minY));
	const right = Math.min(canvasWidth.value, Math.ceil(maxX)),
		bottom = Math.min(canvasHeight.value, Math.ceil(maxY));
	const w = right - x,
		h = bottom - y;
	if (w < 1 || h < 1) return;
	const tc = window.document.createElement('canvas');
	tc.width = w;
	tc.height = h;
	const ctx = tc.getContext('2d')!;
	ctx.save();
	ctx.beginPath();
	ctx.moveTo(pts[0].x - x, pts[0].y - y);
	for (const p of pts) ctx.lineTo(p.x - x, p.y - y);
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(ly.canvas, -x, -y);
	ctx.restore();
	const data = ctx.getImageData(0, 0, w, h);
	lassoSource = {
		layerId: ly.id,
		x,
		y,
		pixels: ly.ctx.getImageData(x, y, w, h),
	};
	ly.ctx.save();
	ly.ctx.globalAlpha = 1;
	ly.ctx.globalCompositeOperation = 'destination-out';
	ly.ctx.beginPath();
	ly.ctx.moveTo(pts[0].x, pts[0].y);
	for (const p of pts) ly.ctx.lineTo(p.x, p.y);
	ly.ctx.closePath();
	ly.ctx.fill();
	ly.ctx.restore();
	lasso.value = { x, y, w, h, scale: 100, rotation: 0, data, pts: pts.map(p => ({ x: p.x - x, y: p.y - y })) };
	composite();
	nextTick(() => {
		if (lassoCanvas.value && lasso.value) lassoCanvas.value.getContext('2d')!.putImageData(lasso.value.data, 0, 0);
	});
}

function startLassoDrag(event: PointerEvent) {
	if (panMode.value) return onPtrDown(event);
	if (
		event.button !== 0 ||
		!lasso.value ||
		lassoDrag ||
		saving.value ||
		restoring.value ||
		drawing.value ||
		placeDrag ||
		!Number.isFinite(event.clientX) ||
		!Number.isFinite(event.clientY)
	) return;
	event.preventDefault();
	const target = event.currentTarget as HTMLElement;
	lassoDrag = {
		pointerId: event.pointerId,
		target,
		clientX: event.clientX,
		clientY: event.clientY,
		x: lasso.value.x,
		y: lasso.value.y,
		scale:
			(canvas.value?.getBoundingClientRect().width ??
				canvasWidth.value * zoom.value) / canvasWidth.value,
	};
	draggingLasso.value = true;
	window.document.addEventListener('pointermove', onLassoDrag);
	window.document.addEventListener('pointerup', stopLassoDrag);
	window.document.addEventListener('pointercancel', stopLassoDrag);
	target.addEventListener('lostpointercapture', stopLassoDrag);
	try {
		target.setPointerCapture(event.pointerId);
	} catch {
		/* Document listeners still handle this drag. */
	}
}

function onLassoDrag(event: PointerEvent) {
	const drag = lassoDrag;
	if (
		!drag ||
		event.pointerId !== drag.pointerId ||
		!lasso.value ||
		saving.value ||
		restoring.value ||
		!Number.isFinite(event.clientX) ||
		!Number.isFinite(event.clientY)
	) return;
	event.preventDefault();
	lasso.value.x = drag.x + (event.clientX - drag.clientX) / drag.scale;
	lasso.value.y = drag.y + (event.clientY - drag.clientY) / drag.scale;
}

function stopLassoDrag(event?: PointerEvent) {
	const drag = lassoDrag;
	if (!drag || (event && event.pointerId !== drag.pointerId)) return;
	if (event?.type === 'pointerup') onLassoDrag(event);
	else if (lasso.value) {
		lasso.value.x = drag.x;
		lasso.value.y = drag.y;
	}
	lassoDrag = null;
	draggingLasso.value = false;
	window.document.removeEventListener('pointermove', onLassoDrag);
	window.document.removeEventListener('pointerup', stopLassoDrag);
	window.document.removeEventListener('pointercancel', stopLassoDrag);
	drag.target.removeEventListener('lostpointercapture', stopLassoDrag);
	if (drag.target.hasPointerCapture(drag.pointerId)) drag.target.releasePointerCapture(drag.pointerId);
}

function applyLasso() {
	if (
		!lasso.value ||
		!lassoSource ||
		saving.value ||
		restoring.value ||
		drawing.value ||
		draggingLasso.value
	) return;
	const selected = lasso.value,
		ly = layers.value.find((layer) => layer.id === lassoSource?.layerId);
	if (
		!ly ||
		![selected.scale, selected.rotation, selected.x, selected.y].every(
			Number.isFinite,
		)
	) return;
	if (
		selected.x === lassoSource.x &&
		selected.y === lassoSource.y &&
		selected.scale === 100 &&
		selected.rotation === 0
	) {
		ly.ctx.putImageData(lassoSource.pixels, lassoSource.x, lassoSource.y);
		lasso.value = null;
		lassoSource = null;
		composite();
		return;
	}
	const tc = window.document.createElement('canvas');
	tc.width = selected.w;
	tc.height = selected.h;
	tc.getContext('2d')!.putImageData(selected.data, 0, 0);
	ly.ctx.save();
	ly.ctx.globalAlpha = 1;
	ly.ctx.globalCompositeOperation = 'source-over';
	ly.ctx.translate(selected.x + selected.w / 2, selected.y + selected.h / 2);
	ly.ctx.rotate((selected.rotation * Math.PI) / 180);
	ly.ctx.scale(selected.scale / 100, selected.scale / 100);
	ly.ctx.drawImage(tc, -selected.w / 2, -selected.h / 2);
	ly.ctx.restore();
	lasso.value = null;
	lassoSource = null;
	composite();
	saveHistory();
}

function cancelLasso() {
	if (!lasso.value || saving.value || restoring.value) return;
	stopLassoDrag();
	const source = lassoSource,
		ly = layers.value.find((layer) => layer.id === source?.layerId);
	if (source && ly) ly.ctx.putImageData(source.pixels, source.x, source.y);
	lasso.value = null;
	lassoSource = null;
	composite();
}

function applyFilter(id: string) {
	if (editingBlocked()) return;
	const ly = getLayer();
	if (!ly || !ly.visible || !filters.some((filter) => filter.id === id)) return;
	const img = ly.ctx.getImageData(0, 0, canvasWidth.value, canvasHeight.value),
		d = img.data;
	switch (id) {
		case 'gray':
			for (let i = 0; i < d.length; i += 4) {
				const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
				d[i] = d[i + 1] = d[i + 2] = g;
			}
			break;
		case 'sepia':
			for (let i = 0; i < d.length; i += 4) {
				const rr = d[i],
					gg = d[i + 1],
					bb = d[i + 2];
				d[i] = Math.min(255, rr * 0.393 + gg * 0.769 + bb * 0.189);
				d[i + 1] = Math.min(255, rr * 0.349 + gg * 0.686 + bb * 0.168);
				d[i + 2] = Math.min(255, rr * 0.272 + gg * 0.534 + bb * 0.131);
			}
			break;
		case 'invert':
			for (let i = 0; i < d.length; i += 4) {
				d[i] = 255 - d[i];
				d[i + 1] = 255 - d[i + 1];
				d[i + 2] = 255 - d[i + 2];
			}
			break;
		case 'bright+':
			for (let i = 0; i < d.length; i += 4) {
				d[i] = Math.min(255, d[i] + 30);
				d[i + 1] = Math.min(255, d[i + 1] + 30);
				d[i + 2] = Math.min(255, d[i + 2] + 30);
			}
			break;
		case 'bright-':
			for (let i = 0; i < d.length; i += 4) {
				d[i] = Math.max(0, d[i] - 30);
				d[i + 1] = Math.max(0, d[i + 1] - 30);
				d[i + 2] = Math.max(0, d[i + 2] - 30);
			}
			break;
		case 'contrast+':
			for (let i = 0; i < d.length; i += 4) {
				d[i] = Math.min(255, Math.max(0, (d[i] - 128) * 1.2 + 128));
				d[i + 1] = Math.min(255, Math.max(0, (d[i + 1] - 128) * 1.2 + 128));
				d[i + 2] = Math.min(255, Math.max(0, (d[i + 2] - 128) * 1.2 + 128));
			}
			break;
		case 'contrast-':
			for (let i = 0; i < d.length; i += 4) {
				d[i] = (d[i] - 128) * 0.8 + 128;
				d[i + 1] = (d[i + 1] - 128) * 0.8 + 128;
				d[i + 2] = (d[i + 2] - 128) * 0.8 + 128;
			}
			break;
		case 'saturate+':
		case 'saturate-': {
			const ss = id === 'saturate+' ? 1.3 : 0.7;
			for (let i = 0; i < d.length; i += 4) {
				const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
				d[i] = Math.min(255, Math.max(0, gray + (d[i] - gray) * ss));
				d[i + 1] = Math.min(255, Math.max(0, gray + (d[i + 1] - gray) * ss));
				d[i + 2] = Math.min(255, Math.max(0, gray + (d[i + 2] - gray) * ss));
			}
			break;
		}
		case 'blur':
			applyFullBlur(ly);
			return;
		case 'sharpen':
			applySharpen(img);
			break;
		case 'noise':
			for (let i = 0; i < d.length; i += 4) {
				const n = (Math.random() - 0.5) * 60;
				d[i] = Math.min(255, Math.max(0, d[i] + n));
				d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
				d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
			}
			break;
	}
	ly.ctx.putImageData(img, 0, 0);
	composite();
	saveHistory();
}

function applyFullBlur(ly: Layer) {
	if (
		saving.value ||
		restoring.value ||
		drawing.value ||
		lasso.value ||
		transformMode.value ||
		!ly.visible
	) return;
	const img = ly.ctx.getImageData(0, 0, canvasWidth.value, canvasHeight.value),
		d = img.data,
		w = canvasWidth.value,
		h = canvasHeight.value;
	const out = new Uint8ClampedArray(d),
		k = 3;
	for (let yy = k; yy < h - k; yy++) {
		for (let xx = k; xx < w - k; xx++) {
			let tr = 0,
				tg = 0,
				tb = 0,
				ta = 0,
				cnt = 0;
			for (let ky = -k; ky <= k; ky++) {
				for (let kx = -k; kx <= k; kx++) {
					const i = ((yy + ky) * w + (xx + kx)) * 4;
					tr += d[i];
					tg += d[i + 1];
					tb += d[i + 2];
					ta += d[i + 3];
					cnt++;
				}
			}
			const i = (yy * w + xx) * 4;
			out[i] = tr / cnt;
			out[i + 1] = tg / cnt;
			out[i + 2] = tb / cnt;
			out[i + 3] = ta / cnt;
		}
	}
	for (let i = 0; i < d.length; i++) d[i] = out[i];
	ly.ctx.putImageData(img, 0, 0);
	composite();
	saveHistory();
}

function applySharpen(img: ImageData) {
	const d = img.data,
		w = img.width,
		h = img.height,
		out = new Uint8ClampedArray(d);
	const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
	for (let yy = 1; yy < h - 1; yy++) {
		for (let xx = 1; xx < w - 1; xx++) {
			for (let c = 0; c < 3; c++) {
				let sum = 0;
				for (let ky = -1; ky <= 1; ky++) {
					for (let kx = -1; kx <= 1; kx++) {
						sum +=
							d[((yy + ky) * w + (xx + kx)) * 4 + c] *
							kernel[(ky + 1) * 3 + (kx + 1)];
					}
				}
				out[(yy * w + xx) * 4 + c] = Math.min(255, Math.max(0, sum));
			}
		}
	}
	for (let i = 0; i < d.length; i++) d[i] = out[i];
}

function resetPlace() {
	const img = transform.img;
	if (!img || saving.value || restoring.value || drawing.value) return;
	endPlace();
	const width = img.naturalWidth || img.width,
		height = img.naturalHeight || img.height;
	if (width <= 0 || height <= 0) return;
	const fit = Math.min(
		1,
		(canvasWidth.value * 0.8) / width,
		(canvasHeight.value * 0.8) / height,
	);
	transform.w = width * fit;
	transform.h = height * fit;
	transform.x = (canvasWidth.value - transform.w) / 2;
	transform.y = (canvasHeight.value - transform.h) / 2;
	transform.rotation = 0;
}

type PlaceMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'rot';
let placeDrag: {
	mode: PlaceMode;
	pointerId: number;
	target: HTMLElement;
	sx: number;
	sy: number;
	zoom: number;
	ox: number;
	oy: number;
	ow: number;
	oh: number;
	orot: number;
	ccx: number;
	ccy: number;
	startAngle: number;
} | null = null;

function beginPlace(mode: PlaceMode, event: PointerEvent) {
	if (panMode.value) return onPtrDown(event);
	if (
		event.button !== 0 ||
		!transformMode.value ||
		!transform.img ||
		!canvas.value ||
		placeDrag ||
		lassoDrag ||
		saving.value ||
		restoring.value ||
		drawing.value ||
		!Number.isFinite(event.clientX) ||
		!Number.isFinite(event.clientY)
	) return;
	event.preventDefault();
	const rect = canvas.value.getBoundingClientRect(),
		target = event.currentTarget as HTMLElement;
	const scale = rect.width / canvasWidth.value;
	if (!(scale > 0)) return;
	const ccx = rect.left + (transform.x + transform.w / 2) * scale,
		ccy = rect.top + (transform.y + transform.h / 2) * scale;
	placeDrag = {
		mode,
		pointerId: event.pointerId,
		target,
		sx: event.clientX,
		sy: event.clientY,
		zoom: scale,
		ox: transform.x,
		oy: transform.y,
		ow: transform.w,
		oh: transform.h,
		orot: transform.rotation,
		ccx,
		ccy,
		startAngle:
			(Math.atan2(event.clientY - ccy, event.clientX - ccx) * 180) / Math.PI,
	};
	window.document.addEventListener('pointermove', onPlaceMove);
	window.document.addEventListener('pointerup', endPlace);
	window.document.addEventListener('pointercancel', endPlace);
	target.addEventListener('lostpointercapture', endPlace);
	try {
		target.setPointerCapture(event.pointerId);
	} catch {
		/* Document listeners still handle this drag. */
	}
}

function onPlaceMove(event: PointerEvent) {
	const drag = placeDrag;
	if (
		!drag ||
		event.pointerId !== drag.pointerId ||
		!transform.img ||
		saving.value ||
		restoring.value ||
		!Number.isFinite(event.clientX) ||
		!Number.isFinite(event.clientY)
	) return;
	event.preventDefault();
	const dx = (event.clientX - drag.sx) / drag.zoom,
		dy = (event.clientY - drag.sy) / drag.zoom;
	if (drag.mode === 'move') {
		transform.x = drag.ox + dx;
		transform.y = drag.oy + dy;
		return;
	}
	if (drag.mode === 'rot') {
		const angle =
			(Math.atan2(event.clientY - drag.ccy, event.clientX - drag.ccx) * 180) /
			Math.PI;
		let rotation = drag.orot + angle - drag.startAngle;
		if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
		transform.rotation = Math.round((((rotation % 360) + 540) % 360) - 180);
		return;
	}
	const rad = (drag.orot * Math.PI) / 180,
		localX = dx * Math.cos(rad) + dy * Math.sin(rad),
		localY = -dx * Math.sin(rad) + dy * Math.cos(rad);
	const signX = drag.mode === 'nw' || drag.mode === 'sw' ? -1 : 1,
		signY = drag.mode === 'nw' || drag.mode === 'ne' ? -1 : 1;
	const width = drag.ow + signX * localX * 2,
		height = drag.oh + signY * localY * 2;
	const factor =
		Math.abs(width - drag.ow) >= Math.abs(height - drag.oh)
			? width / drag.ow
			: height / drag.oh;
	const scale = Math.max(
		1 / Math.min(drag.ow, drag.oh),
		Math.min(8192 / Math.max(drag.ow, drag.oh), factor),
	);
	transform.w = drag.ow * scale;
	transform.h = drag.oh * scale;
	transform.x = drag.ox + drag.ow / 2 - transform.w / 2;
	transform.y = drag.oy + drag.oh / 2 - transform.h / 2;
}

function endPlace(event?: PointerEvent) {
	const drag = placeDrag;
	if (!drag || (event && event.pointerId !== drag.pointerId)) return;
	if (event?.type === 'pointerup') onPlaceMove(event);
	else Object.assign(transform, {
		x: drag.ox,
		y: drag.oy,
		w: drag.ow,
		h: drag.oh,
		rotation: drag.orot,
	});
	placeDrag = null;
	window.document.removeEventListener('pointermove', onPlaceMove);
	window.document.removeEventListener('pointerup', endPlace);
	window.document.removeEventListener('pointercancel', endPlace);
	drag.target.removeEventListener('lostpointercapture', endPlace);
	if (drag.target.hasPointerCapture(drag.pointerId)) drag.target.releasePointerCapture(drag.pointerId);
}

function applyTransform() {
	if (
		!transform.img ||
		saving.value ||
		restoring.value ||
		drawing.value ||
		placeDrag
	) return;
	const ly = getLayer();
	if (
		!ly ||
		!ly.visible ||
		![
			transform.x,
			transform.y,
			transform.w,
			transform.h,
			transform.rotation,
		].every(Number.isFinite) ||
		transform.w <= 0 ||
		transform.h <= 0
	) return;
	ly.ctx.save();
	ly.ctx.globalAlpha = 1;
	ly.ctx.globalCompositeOperation = 'source-over';
	ly.ctx.translate(
		transform.x + transform.w / 2,
		transform.y + transform.h / 2,
	);
	ly.ctx.rotate((transform.rotation * Math.PI) / 180);
	ly.ctx.drawImage(
		transform.img,
		-transform.w / 2,
		-transform.h / 2,
		transform.w,
		transform.h,
	);
	ly.ctx.restore();
	transformMode.value = false;
	releaseImportedImage();
	composite();
	saveHistory();
}

function releaseImportedImage() {
	if (transform.img?.src.startsWith('blob:')) URL.revokeObjectURL(transform.img.src);
	transform.img = null;
}

function cancelTransform() {
	if (saving.value || restoring.value) return;
	endPlace();
	transformMode.value = false;
	releaseImportedImage();
}

/** Call when the editor unmounts so document listeners and captures do not survive. */
function cleanupEngineDrags() {
	stopLassoDrag();
	endPlace();
	const source = lassoSource,
		ly = layers.value.find((layer) => layer.id === source?.layerId);
	if (source && ly) ly.ctx.putImageData(source.pixels, source.x, source.y);
	lasso.value = null;
	lassoSource = null;
	lassoPath.value = [];
	transformMode.value = false;
	releaseImportedImage();
}
</script>

<style lang="scss" module>
@font-face {
	font-family: 'HatadintRighteous';
	src: url('/client-assets/Righteous-Regular.woff2') format('woff2');
	font-style: normal;
	font-weight: 400;
	font-display: swap;
}
.root {
	position: relative;
	container: hatadint / inline-size;
	box-sizing: border-box;
	width: min(1500px, 100%);
	height: min(920px, 100%);
	max-height: 100%;
	min-width: 0;
	margin: auto;
	flex-shrink: 1;
	display: flex;
	flex-direction: column;
	color: var(--MI_THEME-fg);
	background: var(--MI_THEME-bg);
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 30px;
	isolation: isolate;
	--hd-panel: var(--MI_THEME-panel);
	--hd-muted: var(--MI_THEME-fg);
}
.root *,
.popover * {
	box-sizing: border-box;
	scrollbar-width: none;
}
.root *::-webkit-scrollbar {
	display: none;
	width: 0;
	height: 0;
}
.root button,
.root input,
.root select {
	font: inherit;
	color: inherit;
}
.root button {
	cursor: pointer;
	border: 0;
	background: transparent;
	min-width: 44px;
	min-height: 44px;
	border-radius: 16px;
	touch-action: manipulation;
}
.root button:hover:not(:disabled) {
	background: var(--MI_THEME-buttonHoverBg);
}
.root button:disabled {
	opacity: 0.4;
	cursor: default;
}
.root button:focus-visible,
.root input:focus-visible,
.root select:focus-visible,
.root [tabindex]:focus-visible {
	outline: 2px solid var(--MI_THEME-accent);
	outline-offset: 2px;
}
.root button[data-active='true'],
.root button[aria-pressed='true'] {
	background: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
}
.root i {
	font-size: 21px;
	flex: none;
}
.root label {
	display: block;
	font-size: 12px;
	margin: 12px 0;
}
.root output {
	float: right;
	font-variant-numeric: tabular-nums;
}
.root input[type='text'],
.root input:not([type]),
.root input[type='number'],
.root select {
	width: 100%;
	min-width: 0;
	min-height: 44px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 14px;
	background: var(--MI_THEME-panelHighlight);
	padding: 8px 10px;
}
.root input[type='range'] {
	display: block;
	width: 100%;
	min-width: 0;
	height: 32px;
	accent-color: var(--MI_THEME-accent);
}
.root input[type='checkbox'] {
	flex: none;
	width: 18px;
	height: 18px;
	accent-color: var(--MI_THEME-accent);
}
.root h3 {
	font-size: 13px;
	margin: 0 0 14px;
}
.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 18px 20px 12px;
}
.root .document {
	display: flex;
	align-items: center;
	gap: 10px;
	height: 48px;
	padding: 3px 18px 3px 8px;
	background: var(--MI_THEME-panel);
	border-radius: 999px;
	min-width: 0;
	text-align: left;
}
.document > i {
	display: grid;
	place-items: center;
	width: 40px;
	height: 40px;
	border-radius: 50%;
	background: var(--MI_THEME-accentedBg);
	color: var(--MI_THEME-accent);
}
.document > span {
	min-width: 0;
}
.wordmark {
	font:
		400 22px/1 'HatadintRighteous',
		system-ui,
		sans-serif;
	font-synthesis: none;
	letter-spacing: 0.02em;
}
.document small {
	display: block;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 260px;
	font-size: 10px;
	margin-top: 3px;
}
.headerActions {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: none;
}
.root .iconButton {
	width: 44px;
	height: 44px;
	min-width: 44px;
	padding: 0;
	display: inline-grid;
	place-items: center;
	border-radius: 50%;
}
.headerActions > .iconButton {
	width: 48px;
	height: 48px;
	background: var(--MI_THEME-panel);
}
.history {
	display: flex;
	height: 48px;
	padding: 2px;
	border-radius: 999px;
	background: var(--MI_THEME-panel);
}
.root .exportButton {
	display: flex;
	align-items: center;
	gap: 8px;
	height: 48px;
	padding: 0 18px;
	border-radius: 999px;
	color: var(--MI_THEME-fgOnAccent);
	background: var(--MI_THEME-accent);
	font-weight: 700;
}
.root .exportButton:hover,
.root .primary:hover {
	background: var(--MI_THEME-accent);
	opacity: 0.9;
}
.body {
	--tool-column-width: 120px;
	--inspector-width: 284px;
	min-height: 0;
	flex: 1;
	display: grid;
	grid-template-columns: var(--tool-column-width) minmax(0, 1fr) var(--inspector-width);
	transition: grid-template-columns 240ms cubic-bezier(0.2, 0, 0, 1);
	gap: 16px;
	padding: 2px 20px 20px;
}
.toolColumn {
	min-height: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 14px;
}
.toolCase {
	width: 100%;
	overflow: auto;
	min-height: 0;
	padding: 12px 8px;
	background: var(--MI_THEME-panel);
	border-radius: 32px;
}
.toolGroup > span {
	display: block;
	text-align: center;
	font-size: 10px;
	margin-bottom: 6px;
	opacity: 0.75;
}
.toolGroup + .toolGroup {
	margin-top: 9px;
	border-top: 1px solid var(--MI_THEME-divider);
	padding-top: 9px;
}
.tools {
	display: grid;
	grid-template-columns: repeat(2, 44px);
	gap: 8px;
	justify-content: center;
}
.root .quickColor {
	flex: none;
	width: 52px;
	height: 52px;
	border: 6px solid var(--MI_THEME-panel);
	border-radius: 50%;
}
.workspace {
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
}
.context {
	display: flex;
	justify-content: center;
	min-height: 48px;
}
.contextPill {
	display: flex;
	align-items: center;
	padding: 2px;
	background: var(--MI_THEME-panel);
	border-radius: 999px;
	font-size: 12px;
	max-width: 100%;
}
.contextPill button {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	border-radius: 999px;
	padding: 5px 9px;
	white-space: nowrap;
}
.contextPill strong {
	max-width: 92px;
	overflow: hidden;
	text-overflow: ellipsis;
}
.contextPill i {
	font-size: 17px;
}
.contextPill i:last-child {
	font-size: 12px;
}
.scroller {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	flex: 1;
	min-height: 60px;
	overflow: hidden;
	margin: 10px 0;
	border-radius: 20px;
	background: radial-gradient(var(--MI_THEME-divider) 1px, transparent 1px) 0
		0 / 18px 18px;
	touch-action: none;
}
.canvasWrap {
	position: relative;
	flex: none;
	background: repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 18px 18px;
	box-shadow: 0 8px 32px #0002;
}
.canvas,
.preview {
	display: block;
	width: 100%;
	height: 100%;
	touch-action: none;
}
.preview {
	position: absolute;
	inset: 0;
	pointer-events: none;
}
.canvasToolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}
.colorStrip,
.zoomBar {
	display: flex;
	align-items: center;
	border-radius: 999px;
	background: var(--MI_THEME-panel);
	padding: 2px;
}
.root .colorStrip button {
	min-width: 32px;
	width: 32px;
	height: 40px;
	min-height: 40px;
	border-radius: 50%;
}
.colorStrip button[style]::before,
.palette button::before {
	content: '';
	display: block;
	width: 22px;
	height: 22px;
	margin: auto;
	border-radius: 50%;
	background: var(--swatch);
	box-shadow: inset 0 0 0 1px #0002;
}
.zoomBar {
	gap: 0;
	font-size: 12px;
}
.zoomBar span {
	min-width: 46px;
	text-align: center;
}
.root .zoomBar button {
	min-width: 36px;
	width: 36px;
	padding: 0;
	border-radius: 50%;
}
.workspaceStatus {
	display: flex;
	justify-content: space-between;
	gap: 8px;
	font-size: 10px;
	padding: 10px 4px 0;
}
.inspector {
	min-height: 0;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 12px;
	overflow: hidden;
	opacity: 1;
	visibility: visible;
	transition: opacity 160ms ease, transform 240ms cubic-bezier(0.2, 0, 0, 1), visibility 0s;
}
.inspector > * {
	box-sizing: border-box;
	width: var(--inspector-width);
}
.panelNavigation {
	display: flex;
	flex-shrink: 0;
	justify-content: space-between;
	padding: 2px 6px;
	border-radius: 999px;
	background: var(--MI_THEME-panel);
}
.inspectorScroll {
	min-height: 0;
	overflow: auto;
	padding: 2px;
}
.propertyPanel {
	padding: 18px;
	border-radius: 26px;
	background: var(--MI_THEME-panel);
}
.panelHeading,
.popupHeading {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}
.panelHeading h3 {
	margin: 0;
}
.muted {
	font-size: 11px;
	line-height: 1.7;
	opacity: 0.8;
}
.root .check {
	display: flex;
	align-items: center;
	gap: 9px;
	min-height: 44px;
}
.brushPreview {
	height: 72px;
	display: grid;
	place-items: center;
	border-radius: 18px;
	background: var(--MI_THEME-panelHighlight);
	margin-bottom: 12px;
}
.brushPreview span {
	border-radius: 50%;
}
.presets,
.filters {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
}
.presets button,
.filters button {
	background: var(--MI_THEME-panelHighlight);
	font-size: 12px;
}
.svBox {
	position: relative;
	height: 144px;
	margin: 16px 10px 8px;
	border-radius: 16px;
	touch-action: none;
}
.root .svHandle {
	position: absolute;
	width: 44px;
	height: 44px;
	padding: 0;
	transform: translate(-50%, -50%);
	border-radius: 50%;
	background: transparent;
	touch-action: none;
}
.root .svHandle:hover {
	background: transparent;
}
.svHandle::before {
	content: '';
	position: absolute;
	inset: 12px;
	border: 2px solid white;
	border-radius: 50%;
	background: var(--picked-color);
	box-shadow: 0 0 0 1px #0009;
}
.hueBar {
	position: relative;
	height: 44px;
	margin: 0 10px;
	touch-action: none;
	border-radius: 16px;
}
.hueBar::before {
	content: '';
	position: absolute;
	inset: 14px 0;
	border-radius: 999px;
	background: linear-gradient(
		to right,
		#f00,
		#ff0,
		#0f0,
		#0ff,
		#00f,
		#f0f,
		#f00
	);
}
.hueBar span {
	position: absolute;
	top: 50%;
	width: 22px;
	height: 22px;
	border-radius: 50%;
	border: 3px solid #fff;
	box-shadow: 0 0 0 1px #0009;
	transform: translate(-50%, -50%);
	pointer-events: none;
}
.palette {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 8px;
	margin: 12px 0;
}
.palette button::before {
	width: 28px;
	height: 28px;
}
.root .button {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	width: 100%;
	margin-top: 8px;
	background: var(--MI_THEME-panelHighlight);
}
.layer {
	display: flex;
	align-items: center;
	border-radius: 16px;
	margin: 6px 0;
}
.layer[data-active='true'] {
	background: var(--MI_THEME-accentedBg);
}
.root .layerSelect {
	display: flex;
	align-items: center;
	gap: 8px;
	text-align: left;
	flex: 1;
	min-width: 0;
	padding: 6px;
}
.layerSelect span {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 12px;
}
.layerThumb {
	width: 38px;
	height: 34px;
	flex: none;
	border-radius: 8px;
	background: repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 8px 8px;
}
.layerActions {
	display: flex;
	justify-content: space-between;
}
.root .layerSummary {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 14px;
	margin-top: 12px;
	width: 100%;
	background: var(--MI_THEME-panel);
	border-radius: 22px;
}
.layerSummary span {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.minimap {
	position: absolute;
	right: 12px;
	top: 12px;
	width: 174px;
	padding: 6px;
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 18px;
	background: var(--MI_THEME-panel);
	z-index: 1;
	touch-action: none;
}
.minimap canvas {
	display: block;
	width: 100%;
	height: auto;
	background: repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 12px 12px;
	border-radius: 10px;
}
.root .miniRect {
	position: absolute;
	min-width: 0;
	min-height: 0;
	border: 2px solid var(--MI_THEME-accent);
	background: color-mix(in srgb, var(--MI_THEME-accent) 12%, transparent);
	padding: 0;
	border-radius: 0;
	cursor: grab;
	touch-action: none;
}
.selectionBar,
.placeBar {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	padding: 6px;
	border-radius: 18px;
	background: var(--MI_THEME-panel);
	font-size: 11px;
}
.selectionBar label {
	flex: 1;
	min-width: 100px;
	margin: 0;
}
.placeBar {
	position: absolute;
	bottom: 10px;
	left: 10px;
	right: 10px;
	z-index: 1;
}
.lassoBox,
.placeBox {
	position: absolute;
	cursor: move;
	touch-action: none;
}
.placeBox {
	border: 2px dashed var(--MI_THEME-accent);
}
.lassoOutline {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	overflow: visible;
	fill: none;
	stroke: #fff;
	stroke-width: 1.5;
	stroke-linejoin: round;
	pointer-events: none;
}
.lassoOutline polygon:last-child {
	stroke: #222;
	stroke-dasharray: 5 5;
}
.selectionBar button {
	font-size: 20px;
}
.lassoBox canvas,
.placeImg {
	display: block;
	width: 100%;
	height: 100%;
	pointer-events: none;
}
.root .placeHandle {
	position: absolute;
	width: 44px;
	height: 44px;
	border: 14px solid transparent;
	background: var(--MI_THEME-accent);
	background-clip: padding-box;
	transform: translate(-50%, -50%);
	padding: 0;
	touch-action: none;
}
.placeHandle[data-corner='nw'] {
	left: 0;
	top: 0;
}
.placeHandle[data-corner='ne'] {
	left: 100%;
	top: 0;
}
.placeHandle[data-corner='sw'] {
	left: 0;
	top: 100%;
}
.placeHandle[data-corner='se'] {
	left: 100%;
	top: 100%;
}
.placeRotate {
	position: absolute;
	top: -52px;
	left: calc(50% - 22px);
	background: var(--MI_THEME-panel) !important;
}
.popover {
	position: absolute;
	inset: auto;
	margin: 0;
	padding: 0;
	z-index: 3;
	width: 324px;
	max-width: calc(100% - 16px);
	max-height: var(--popup-height);
	border: 1px solid var(--MI_THEME-divider);
	border-radius: 24px;
	color: var(--MI_THEME-fg);
	background: var(--MI_THEME-panel);
	box-shadow: 0 12px 42px #0003;
	overflow: visible;
}
.popover[data-sheet='true'] { right:0; margin:0; max-width:none; border-radius:24px 24px 0 0; transform:translateY(0); opacity:1; transition:transform 140ms ease, opacity 140ms ease; }
.popover[data-sheet='true'][data-closing='true'] { transform:translateY(18px); opacity:0; pointer-events:none; }
.popover[data-sheet='true']::before { display:none; }
.popover::before {
	content: '';
	position: absolute;
	width: 12px;
	height: 12px;
	left: var(--arrow-x);
	top: -7px;
	transform: rotate(45deg);
	background: var(--MI_THEME-panel);
	border-left: 1px solid var(--MI_THEME-divider);
	border-top: 1px solid var(--MI_THEME-divider);
}
.popover[data-side='top']::before {
	top: auto;
	bottom: -7px;
	transform: rotate(225deg);
}
.popoverScroll {
	overflow: auto;
	max-height: var(--popup-height);
	padding: 18px;
	border-radius: inherit;
}
.popover .propertyPanel {
	padding: 0;
	border-radius: 0;
}
.popupHeading h2 {
	margin: 0;
	font-size: 16px;
}
.popupTools {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 8px;
}
.popupTools button {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-direction: column;
	font-size: 10px;
	gap: 5px;
	min-height: 64px;
}
.actions {
	display: flex;
	justify-content: center;
	gap: 8px;
	margin-top: 18px;
}
.actions button {
	padding: 8px 16px;
}
.draftActions {
	display: grid;
	gap: 8px;
	margin-top: 18px;
}
.draftActions button {
	padding: 10px 16px;
}
.root .primary {
	color: var(--MI_THEME-fgOnAccent);
	background: var(--MI_THEME-accent);
	border-radius: 999px;
}
.destinations {
	display: grid;
	gap: 10px;
	margin-top: 16px;
}
.destinations button {
	display: flex;
	align-items: center;
	gap: 14px;
	text-align: left;
	padding: 16px;
	background: var(--MI_THEME-panelHighlight);
}
.error {
	color: var(--MI_THEME-error);
	font-size: 13px;
}
.notice {
	position: absolute;
	bottom: 20px;
	left: 50%;
	transform: translateX(-50%);
	width: max-content;
	max-width: calc(100% - 24px);
	padding: 12px 18px;
	border-radius: 24px;
	background: var(--MI_THEME-fg);
	color: var(--MI_THEME-panel);
	z-index: 4;
	font-size: 13px;
	pointer-events: none;
}
.mobileDock,
.mobileQuick {
	display: none;
}
.body[data-collapsed='true'] {
	grid-template-columns: 68px minmax(0, 1fr) 0px;
}
.body[data-collapsed='true'] .tools {
	grid-template-columns: 44px;
}
.body[data-collapsed='true'] .inspector {
	opacity: 0;
	transform: translateX(8px);
	visibility: hidden;
	transition-delay: 0s, 0s, 240ms;
}
@container hatadint (max-width: 1100px) {
	.body {
		--tool-column-width: 68px;
		--inspector-width: 256px;
		gap: 12px;
		padding-inline: 14px;
	}
	.tools {
		grid-template-columns: 44px;
	}
	.colorStrip button:nth-child(n + 4) {
		display: none;
	}
}
@container hatadint (min-width: 700px) and (max-width: 850px) {
	.body {
		--tool-column-width: 60px;
		--inspector-width: 232px;
		gap: 8px;
		padding-inline: 10px;
	}
	.header {
		padding-inline: 12px;
	}
	.contextPill button {
		gap: 4px;
		padding-inline: 6px;
	}
	.contextPill strong {
		max-width: 68px;
	}
	.propertyPanel {
		padding: 14px;
	}
	.colorStrip {
		display: none;
	}
	.canvasToolbar {
		justify-content: flex-end;
	}
}
@container hatadint (max-width: 699px) {
	.header {
		padding: 12px;
		gap: 8px;
	}
	.root .document {
		height: 44px;
		padding: 2px 4px;
		background: transparent;
		gap: 6px;
	}
	.document > i {
		width: 32px;
		height: 32px;
	}
	.wordmark {
		font-size: 19px;
	}
	.document small {
		max-width: 124px;
	}
	.headerActions {
		gap: 4px;
	}
	.history,
	.root .collapseButton {
		display: none;
	}
	.headerActions > .iconButton {
		width: 44px;
		height: 44px;
	}
	.root .exportButton {
		width: 44px;
		height: 44px;
		padding: 0;
		justify-content: center;
	}
	.exportButton span {
		display: none;
	}
	.body,
	.body[data-collapsed='true'] {
		display: flex;
		padding: 0 10px;
	}
	.toolColumn,
	.inspector {
		display: none;
	}
	.workspace {
		flex: 1;
	}
	.contextPill {
		width: 100%;
		justify-content: center;
		padding: 0;
	}
	.context { min-height: 44px; }
	.contextPill button {
		gap: 4px;
		padding-inline: 7px;
	}
	.contextPill strong {
		max-width: 80px;
	}
	.colorStrip {
		display: none;
	}
	.canvasToolbar { justify-content: center; }
	.workspaceStatus {
		padding-top: 6px;
	}
	.mobileQuick {
		display: flex;
		flex: none;
		justify-content: space-between;
		padding: 6px 18px;
	}
	.mobileQuick > div {
		display: flex;
		border-radius: 999px;
		background: var(--MI_THEME-panel);
		padding: 2px;
	}
	.mobileDock {
		display: flex;
		flex: none;
		justify-content: space-around;
		gap: 4px;
		margin: 0 10px calc(10px + env(safe-area-inset-bottom, 0px));
		padding: 5px;
		border-radius: 28px;
		background: var(--MI_THEME-panel);
	}
	.mobileDock button {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		font-size: 10px;
		min-width: 48px;
		min-height: 52px;
	}
	.minimap {
		transform: scale(0.75);
		transform-origin: top right;
	}
	.selectionBar > span {
		display: none;
	}
	.notice {
		bottom: 130px;
	}
}
@container hatadint (max-width: 360px) {
	.document > i {
		display: none;
	}
	.document small {
		max-width: 100px;
	}
	.contextPill button {
		padding-inline: 5px;
	}
	.contextPill strong {
		max-width: 62px;
	}
}
@media (prefers-reduced-motion: reduce) {
	.root *,
	.root *::before {
		transition: none !important;
		animation: none !important;
	}
}
</style>
