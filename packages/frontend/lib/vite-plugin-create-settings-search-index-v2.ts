/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * The original search-index plugin deliberately indexes SearchMarker only.  It
 * is kept as-is for the legacy settings UI.  This plugin is a separate source
 * inventory for the redesigned UI: it reads the actual setting controls so a
 * missing marker can never silently remove a setting from search.
 */
import { parse as parseSfc } from 'vue/compiler-sfc';
import {
	NodeTypes,
	type AttributeNode,
	type DirectiveNode,
	type ElementNode,
	type TemplateChildNode,
} from '@vue/compiler-core';
import { glob } from 'glob';
import { normalizePath, type Plugin } from 'vite';
import path from 'node:path';
import fs from 'node:fs/promises';
import { minimatch } from 'minimatch';
import MagicString, { type SourceMap } from 'magic-string';

const CONTROL_COMPONENTS = new Set([
	'MkSwitch', 'MkInput', 'MkSelect', 'MkRadios', 'MkRange', 'MkTextarea', 'MkCodeEditor', 'MkColorInput',
	'input', 'select', 'textarea',
]);

const INTERACTIVE_COMPONENTS = new Set([...CONTROL_COMPONENTS, 'button', 'MkButton']);

/** Runtime rows with an existing click/menu affordance whose individual
 * identity is deliberately dynamic. They materialise one static group, never
 * a per-row catalog control. */
const RUNTIME_COLLECTION_COMPONENTS = new Set(['MkUserCardMini']);

/**
 * The raw population is deliberately broader than searchable controls. In
 * particular, a button is still accounted for even when it only opens a
 * dialog, saves/cancels, or operates a runtime collection.
 */
export type SettingsInteractiveClassificationV2 =
	| 'user-facing-setting'
	| 'navigation-action'
	| 'save-cancel'
	| 'destructive'
	| 'runtime-collection'
	| 'disabled-display-only';

export type SettingsInteractiveInventoryItemV2 = {
	sourceFile: string;
	sourceLine: number;
	component: string;
	/** Raw click expression retained for the classification audit. */
	actionExpression?: string;
	classification: SettingsInteractiveClassificationV2;
	reason: string;
	/** Search descriptors are intentionally limited to value controls. */
	searchableControl: boolean;
	/** Every raw action is resolved to a direct descriptor or named static group. */
	descriptorStableId?: string;
	/** Every raw action outside the descriptor set needs a concrete reason. */
	exclusionReason?: string;
	/** Semantic static host used when a runtime/action row has no own control descriptor. */
	staticGroupKey?: string;
	staticGroupLabel?: string;
};

/**
 * A static semantic host for dynamic rows. This is intentionally separate
 * from a form-control descriptor: one group can contain any number of
 * runtime-created items without inventing a per-row stable ID.
 */
export type SettingsInteractiveStaticGroupDescriptorV2 = {
	stableId: string;
	sourceFile: string;
	sourceLine: number;
	label: string;
	labelExpression?: string;
	labelI18nKeys?: string[];
	key: string;
	/** Groups are the searchable entry point for otherwise dynamic rows. */
	searchable: true;
};

/**
 * A settings result can require a category switch or an existing popup launch
 * before its control is present. This describes that existing path without
 * inventing a router location for a component that is not a page.
 */
/** The categories actually rendered by settings/hata-custom.vue. */
export type HataCustomCategoryV2 =
	| 'general'
	| 'font'
	| 'glassUi'
	| 'visual'
	| 'hatask'
	| 'hatady'
	| 'mascot'
	| 'earthquake'
	| 'accessibility';

export type SettingsPopupIdV2 =
	| 'hatasaba-ui2'
	| 'earthquake'
	| 'ui-setup'
	| 'settings-transfer'
	| 'hatask'
	| 'hatady'
	| 'mascot';

export type SettingsPersistenceV2 = 'device' | 'profile' | 'account';
export type SettingsSaveModeV2 = 'immediate' | 'buffered' | 'reload';
export type SettingsAvailabilityV2 = 'all' | 'desktop' | 'mobile';
/** Product area responsible for the setting, independent of storage scope. */
export type SettingsOwnerV2 = 'core' | 'cherrypick' | 'hatasaba';
/** Runtime UI modes in which the setting has an effect. */
export type SettingsApplicableUiValueV2 = 'all' | 'default' | 'deck' | 'simple' | 'simple-deck';
export type SettingsApplicableUiV2 = SettingsApplicableUiValueV2 | readonly SettingsApplicableUiValueV2[];

/** Storage provenance is kept distinct from the user-facing search aliases. */
export type SettingsStorageRefV2 =
	| { kind: 'pref'; key: string }
	| { kind: 'pizzax'; store: 'base' | 'deck'; key: string; scope: 'device' | 'account' | 'deviceAccount' }
	| { kind: 'local'; key: string; family?: boolean }
	| { kind: 'indexeddb'; database: string; store: string; key: string; fields: readonly string[] }
	| { kind: 'registry'; scope: readonly string[]; key: string }
	| { kind: 'api'; endpoint: string; fields?: readonly string[] };

/** The three persistent-key registries audited by the settings catalog. */
export type SettingsStorageKeyAuditKindV2 = 'preference' | 'pizzax' | 'local';
export type SettingsStorageKeyAuditDispositionV2 =
	| 'catalog-control'
	| 'catalog-group'
	| 'runtime'
	| 'migration'
	| 'cache'
	| 'deprecated'
	| 'internal';

export type SettingsStorageKeyAuditSourceV2 = {
	file: string;
	code: string;
};

export type SettingsStorageKeyAuditItemV2 = {
	kind: SettingsStorageKeyAuditKindV2;
	key: string;
	/** Pizzax entries keep the actual registry and scope, never an inferred one. */
	store?: 'base' | 'deck';
	scope?: 'device' | 'account' | 'deviceAccount';
	disposition: SettingsStorageKeyAuditDispositionV2;
	reason: string;
	descriptorStableIds: string[];
};

/** A reviewed non-catalog disposition.  This table is deliberately finite:
 * source text may help us *find* candidates, but never decides their final
 * audit class. */
type ExplicitStorageKeyAuditDispositionV2 = Pick<SettingsStorageKeyAuditItemV2, 'disposition' | 'reason'> & {
	evidence: readonly string[];
};

export type SettingsStorageKeyAuditInputV2 = {
	preferenceDefinition: string;
	pizzaxStores: readonly { store: 'base' | 'deck'; source: string }[];
	localStorageDefinition: string;
	/** Search-target SFCs, used to reject a visible key which lost its catalog target. */
	settingsSources: readonly SettingsStorageKeyAuditSourceV2[];
	/** Other runtime sources, used as concrete evidence for intentional non-catalog keys. */
	runtimeSources: readonly SettingsStorageKeyAuditSourceV2[];
	descriptors: readonly Pick<SettingsControlSearchDescriptorV2,
		'stableId' | 'searchable' | 'isGroup' | 'preferenceKeys' | 'storageRefs'>[];
};

export type SettingsStorageKeyAuditV2 = {
	items: SettingsStorageKeyAuditItemV2[];
	counts: Record<SettingsStorageKeyAuditKindV2, number>;
};

export type SettingsMetadataEvidenceV2 = {
	persistence: string;
	saveMode: string;
	availability: string;
	owner: string;
	applicableUi: string;
};

export type SettingsActivationStepV2 =
	| { kind: 'category'; id: HataCustomCategoryV2 }
	| { kind: 'popup'; id: SettingsPopupIdV2 }
	| { kind: 'reveal'; id: string };

export type SettingsActivationFocusV2 = { kind: 'control' | 'group'; id: string };
export type SettingsActivationUnmetV2 = { kind: 'policy' | 'consent' | 'preference' | 'runtime-data'; id: string; behavior: 'focus' | 'explain' };

export type SettingsControlActivationV2 =
	| { kind: 'hata-custom-category'; category: HataCustomCategoryV2; steps?: SettingsActivationStepV2[]; focus?: SettingsActivationFocusV2; unmet?: SettingsActivationUnmetV2[] }
	| { kind: 'popup'; category: HataCustomCategoryV2; popup: SettingsPopupIdV2; steps?: SettingsActivationStepV2[]; focus?: SettingsActivationFocusV2; unmet?: SettingsActivationUnmetV2[] };

export type SettingsControlSearchTargetV2 = {
	filePath: string;
	routeOverride?: string;
	activation?: SettingsControlActivationV2;
	/** Explicit source-level persistence contract for embedded/popup settings. */
	persistence?: SettingsPersistenceV2;
	saveMode?: SettingsSaveModeV2;
	availability?: SettingsAvailabilityV2;
	owner?: SettingsOwnerV2;
	applicableUi?: SettingsApplicableUiV2;
	/** Imported handlers whose concrete persistence is declared in the finite
	 * control binding manifest. They are never inferred from a name prefix. */
	persistentActionHandlers?: readonly string[];
};

export type SettingsControlSearchTargetMetadataV2 = Omit<SettingsControlSearchTargetV2, 'filePath'>;

export type SettingsControlSearchDescriptorV2 = {
	/** Stable semantic identity. It never incorporates a source line number. */
	stableId: string;
	route: string;
	sourceFile: string;
	sourceLine: number;
	component: string;
	/** A literal label when it is available without evaluating page-local state. */
	label: string;
	/** Original label expression/template, retained for i18n and dynamic labels. */
	labelExpression?: string;
	/** Safe property-only i18n expressions used by labelExpression. Never a function call. */
	labelI18nKeys?: string[];
	caption?: string;
	captionExpression?: string;
	captionI18nKeys?: string[];
	/** Explicit product vocabulary for an otherwise static semantic group. */
	aliases?: string[];
	/** Safe i18n labels inherited from runtime children; resolved by the catalog adapter. */
	aliasI18nKeys?: string[];
	/** An audited alias that deliberately wins exact-query ranking. */
	primaryAliases?: string[];
	/** The control had no own label, so this is its nearest SearchMarker label. */
	inheritedLabel?: boolean;
	modelExpression?: string;
	preferenceKeys: string[];
	legacyMarkerParentId?: string;
	/** Root-to-nearest SearchMarker ancestry for relation scoring in the redesigned UI. */
	legacyMarkerAncestorIds: string[];
	conditions: string[];
	/** A static semantic section which is a meaningful related-settings peer. */
	semanticGroupId?: string;
	/** A deliberately audited feature/source peer, considered after an exact static section. */
	sourceSemanticGroupId?: string;
	/** Internal source key used only to audit raw runtime rows against a materialised group. */
	staticGroupKey?: string;
	/** A group host focuses via data-settings-search-group-id when activated. */
	isGroup?: boolean;
	activation?: SettingsControlActivationV2;
	/** Static fallback focus for a conditionally unmounted individual control. */
	focusId?: string;
	/** Source evidence for a parent-owned focus host in another SFC. */
	focusHostSourceFile?: string;
	focusHostSourceLine?: number;
	focusHostConditions?: string[];
	/** Prerequisites which must be explained but never mutated by search. */
	unmet?: SettingsActivationUnmetV2[];
	persistence: SettingsPersistenceV2;
	saveMode: SettingsSaveModeV2;
	availability: SettingsAvailabilityV2;
	owner: SettingsOwnerV2;
	applicableUi: SettingsApplicableUiV2;
	/** Exact source provenance used by the metadata and key audit. */
	storageRefs?: SettingsStorageRefV2[];
	metadataEvidence: SettingsMetadataEvidenceV2;
	/** Exactly one element that can render this descriptor's related-settings affordance. */
	relatedHostId: string;
	searchable: boolean;
	intentionallyExcluded?: boolean;
	exclusionReason?: string;
	destructive: boolean;
};

export type SettingsSearchIndexV2Options = {
	/** Strings retain the page-glob shorthand; objects carry source-specific navigation metadata. */
	targetFilePaths: ReadonlyArray<string | SettingsControlSearchTargetV2>;
	mainVirtualModule: string;
	routerDefinitionPath: string;
	expectedControlCount: number;
	manualDescriptors?: readonly SettingsControlSearchDescriptorV2[];
	modulesToHmrOnUpdate?: string[];
};

type WalkContext = {
	markerId?: string;
	markerLabelTemplate?: string;
	markerLabelPath: string[];
	markerAncestorIds: string[];
	formSectionLabelPath: string[];
	formSlotLabelPath: string[];
	formFolderLabelPath: string[];
	/** Nearest statically visible row/card label, never an aggregate description. */
	rowLabelTemplate?: string;
	preferenceKeys: string[];
	conditions: string[];
	hasRuntimeCollection?: boolean;
	/** A runtime item row whose placeholders are stable per-field labels. */
	hasPlaceholderLabelCollection?: boolean;
};

export type SettingsSearchIdInjectionV2 = {
	code: string;
	map: SourceMap;
};

function findAttribute(props: Array<AttributeNode | DirectiveNode>, name: string): AttributeNode | DirectiveNode | undefined {
	return props.find(prop => (prop.type === NodeTypes.ATTRIBUTE && prop.name === name)
		|| (prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind' && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content === name));
}

function endOfStartTag(node: ElementNode): number {
	let closing = -1;
	let quote: string | null = null;
	for (let index = 0; index < node.loc.source.length; index++) {
		const character = node.loc.source[index];
		if (quote != null) {
			if (character === quote && node.loc.source[index - 1] !== '\\') quote = null;
			continue;
		}
		if (character === '"' || character === "'" || character === '`') {
			quote = character;
			continue;
		}
		if (character === '>') {
			closing = index;
			break;
		}
	}
	if (closing < 0) throw new Error(`settings V2 cannot find start tag end at line ${node.loc.start.line}`);
	const insertAt = node.isSelfClosing && node.loc.source[closing - 1] === '/' ? closing - 1 : closing;
	return node.loc.start.offset + insertAt;
}

function isStaticDisabled(node: ElementNode): boolean {
	const disabled = findAttribute(node.props, 'disabled');
	return disabled?.type === NodeTypes.ATTRIBUTE || disabled?.exp?.content.trim() === 'true';
}

function isStaticReadOnly(node: ElementNode): boolean {
	const readonly = findAttribute(node.props, 'readonly');
	return readonly?.type === NodeTypes.ATTRIBUTE || readonly?.exp?.content.trim() === 'true';
}

/**
 * A destructive operation must be an explicit, high-impact action.  Words
 * such as `remove`, `clear`, and `reset` also occur in harmless appearance
 * and list-editing controls, so they never qualify by themselves.
 */
function isDirectDestructiveAction(node: ElementNode): boolean {
	if (explicitDestructive(node)) return true;
	const click = normalizedExpression(eventHandlerExpression(node, 'click')) ?? '';
	return /^(?:deleteAccount|logout(?:All)?|signOut(?:All)?|clearAll(?:Data|Settings)|deleteAll(?:Data)?|resetAllSettings)\b/u.test(click);
}

/** Persistent-looking handlers that only dismiss an internal prompt or change
 * a temporary view. They are explicitly audited so `store.set()` alone never
 * turns a banner-dismissal into a user setting. */
const EXPLICIT_NON_SETTING_ACTIONS_V2: Readonly<Record<string, ReadonlySet<string>>> = {
	'src/pages/settings/index.vue': new Set(['skipAutoBackup']),
	'src/pages/settings/external-account.vue': new Set(['section']),
};

function isExplicitNonSettingActionV2(sourceFile: string, click: string): boolean {
	const handler = /^([A-Za-z_$][\w$]*)\b/u.exec(click)?.[1];
	return handler != null && EXPLICIT_NON_SETTING_ACTIONS_V2[sourceFile]?.has(handler) === true;
}

function isUserFacingSettingActionNode(sourceFile: string, node: ElementNode, persistentHandlers: ReadonlySet<string> = new Set()): boolean {
	const click = normalizedExpression(eventHandlerExpression(node, 'click')) ?? '';
	if (click === '') return false;
	const handler = /^([A-Za-z_$][\w$]*)\b/u.exec(click)?.[1];
	if (isDirectDestructiveAction(node)) return true;
	if (isExplicitNonSettingActionV2(sourceFile, click)) return false;
	// Category/modal/temporary-state actions are navigation, not a saved setting.
	if (/^(?:activeCat|mode|deckPreviewOpen)=/u.test(click) || /^(?:open|goTo|close|cancel|submit|doExport|doImport)/u.test(click)) return false;
	// A handler name alone is not evidence.  Its parsed body or an inline
	// assignment must lead to a persisted setting/draft update.
	return isPersistentAssignment(click)
		|| (handler != null && persistentHandlers.has(handler))
		|| explicitControlStorageBindingV2(sourceFile, undefined, node) != null;
}

function isSearchDescriptorNode(sourceFile: string, node: ElementNode, persistentHandlers: ReadonlySet<string> = new Set()): boolean {
	return CONTROL_COMPONENTS.has(node.tag) || isUserFacingSettingActionNode(sourceFile, node, persistentHandlers);
}

function collectControlNodes(sourceFile: string, nodes: TemplateChildNode[], result: ElementNode[] = [], persistentHandlers: ReadonlySet<string> = new Set()): ElementNode[] {
	for (const child of nodes) {
		if (child.type !== NodeTypes.ELEMENT) continue;
		if (isSearchDescriptorNode(sourceFile, child, persistentHandlers)) result.push(child);
		collectControlNodes(sourceFile, child.children, result, persistentHandlers);
	}
	return result;
}

function hasAncestorRuntimeCollection(node: ElementNode, ancestors: readonly ElementNode[]): boolean {
	return ancestors.some(ancestor => directiveExpression(ancestor, 'for') != null || isDraggableItemCollection(ancestor));
}

function staticGroupKeyForNode(sourceFile: string, node: ElementNode): string {
	const explicit = expressionOf(findAttribute(node.props, 'data-settings-search-key'));
	const marker = expressionOf(findAttribute(node.props, 'markerId'));
	const labelledBy = expressionOf(findAttribute(node.props, 'aria-labelledby'));
	const labelTemplate = namedSlotTemplate(node, 'label') || expressionOf(findAttribute(node.props, 'label')) || '';
	// A source-level i18n alias (for example `visualCopy.noteSpacing`) is a
	// stable semantic identity even before it is canonicalised to `i18n.ts…`.
	// Treating every such label as the generic `unsafe` bucket merged unrelated
	// FormSections and made a category shortcut focus the wrong section.
	const identity = explicit || marker || labelledBy || (labelTemplate.trim() || semanticTemplateIdentity(labelTemplate));
	return `${sourceFile}|${node.tag}|${identity}`;
}

function staticGroupContext(sourceFile: string, ancestors: readonly ElementNode[]): { key: string; label: string } {
	for (let index = ancestors.length - 1; index >= 0; index--) {
		const ancestor = ancestors[index]!;
		// These finite radio options own one audited fieldset descriptor. Its
		// conditional focus is separately redirected to the permanent root;
		// retain the fieldset identity here so its raw rows cannot disappear.
		if (sourceFile === 'src/components/MkNoteCharmSettings.vue' && ancestor.tag === 'fieldset'
			&& normalizedExpression(expressionOf(findAttribute(ancestor.props, 'class'))) === '$style.patternField') {
			return { key: staticGroupKeyForNode(sourceFile, ancestor), label: 'チャームの模様' };
		}
		if (!['SearchMarker', 'MkFolder', 'FormSection', 'FormSlot', 'section', 'fieldset'].includes(ancestor.tag)) continue;
		// The candidate's own directives are not enough: an otherwise plain
		// FormSection below an outer `v-if` is just as absent as the branch that
		// contains it.  Inspect the full root-to-candidate path, then keep walking
		// outward until a labelled host that survives route navigation is found.
		const candidateConditions = ancestors
			.slice(0, index + 1)
			.map(candidate => directiveExpression(candidate, 'if') ?? directiveExpression(candidate, 'else-if') ?? directiveExpression(candidate, 'for'))
			.filter((condition): condition is string => condition != null);
		// A focus fallback must already exist after route navigation. A group
		// nested under a policy/choice/v-for branch would merely move the dead
		// target one level up, so continue until reaching an unconditional static
		// section. `$i` is the signed-in settings-shell invariant, not a user
		// prerequisite.
		if (!staticHostIsAlwaysMountedV2(candidateConditions)) continue;
		// Do not mine a descendant `SearchLabel` here. A keyword-only
		// SearchMarker often wraps several unrelated FormSections; treating the
		// first nested row label as the marker's identity merges that whole page
		// into one fake group. Only the marker's own label/slot is evidence.
		const labelTemplate = namedSlotTemplate(ancestor, 'label')
			|| expressionOf(findAttribute(ancestor.props, 'label'))
			|| '';
		const labelledBy = expressionOf(findAttribute(ancestor.props, 'aria-labelledby'));
		// An unlabeled structural wrapper (including nested SearchMarkers that
		// only contribute legacy keywords) is not a focusable semantic group.
		// Continue to its labelled static parent rather than merging unrelated
		// controls into the generic `literal` bucket.
		if (labelTemplate === '' && labelledBy == null) continue;
		const label = literalPart(labelTemplate).trim() || labelledBy || '設定グループ';
		return { key: staticGroupKeyForNode(sourceFile, ancestor), label };
	}
	return { key: `${sourceFile}|source-root`, label: '設定グループ' };
}

/**
 * Read complete function bodies instead of stopping at the first nested block.
 * The latter incorrectly treated controls such as Hatask's `toggle` and the
 * mascot display switches as navigation because their persistence call lives
 * inside an if/for block.
 */
function handlerBodies(source: string): ReadonlyMap<string, string> {
	const result = new Map<string, string>();
	const declaration = /(?:function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)|const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)\s*\{/gu;
	for (const match of source.matchAll(declaration)) {
		const name = match[1] ?? match[2];
		const opening = (match.index ?? 0) + match[0].length - 1;
		let depth = 0;
		let quote: string | undefined;
		let escaped = false;
		let closing = -1;
		for (let index = opening; index < source.length; index++) {
			const character = source[index];
			if (quote != null) {
				if (!escaped && character === quote) quote = undefined;
				escaped = !escaped && character === '\\';
				continue;
			}
			if (character === "'" || character === '"' || character === '`') {
				quote = character;
				continue;
			}
			if (character === '{') depth++;
			if (character === '}' && --depth === 0) {
				closing = index;
				break;
			}
		}
		if (closing > opening) result.set(name, source.slice(opening + 1, closing));
	}
	return result;
}

function persistentHandlerNames(source: string): ReadonlySet<string> {
	const bodies = handlerBodies(source);
	const persistent = new Set<string>();
	const visiting = new Set<string>();
	const persists = (name: string): boolean => {
		if (persistent.has(name)) return true;
		if (visiting.has(name)) return false;
		const body = bodies.get(name);
		if (body == null) return false;
		visiting.add(name);
		const direct = /(?:prefer\.(?:commit|model)|miLocalStorage\.(?:setItem|removeItem)|\bstore\.set\(|registry(?:Set|\.set)|save(?:HatadyDisplay|DisplaySettings|Settings)|write[A-Z]|updatePreferences|setDisplaySettings)/u.test(body)
			// Do not treat every ref write as a preference. The named models below
			// are persisted setting drafts; view/tab/preview refs are deliberately
			// excluded so a handler prefix alone can never make an action searchable.
			|| /\b(?:settings|displaySettings|preferences|activeChar|target|wallpaper|c|fontId|customFont(?:Url|Name)|botAllowlist|dataSaver|selectReaction)\b[^;\n]*=(?!=)/u.test(body)
			|| /\bhasChanged\.value\s*=\s*true/u.test(body);
		const callsAnotherPersistentHandler = [...bodies.keys()].some(candidate => candidate !== name && new RegExp(`\\b${candidate}\\s*\\(`, 'u').test(body) && persists(candidate));
		visiting.delete(name);
		if (direct || callsAnotherPersistentHandler) persistent.add(name);
		return direct || callsAnotherPersistentHandler;
	};
	for (const name of bodies.keys()) persists(name);
	return persistent;
}

/** Literal preference references are safe to retain as search aliases. Dynamic
 * keys are deliberately not guessed: they are represented by a semantic group
 * or an explicit audit disposition instead. */
function literalPreferenceKeysInV2(source: string): string[] {
	const keys = new Set<string>();
	for (const pattern of [
		/\bprefer\.(?:model|commit)\(\s*['"]([^'"]+)['"]/gu,
		/\bprefer\.[rs]\s*\[\s*['"]([^'"]+)['"]\s*\]/gu,
		/\bPREF_DEF\s*\[\s*['"]([^'"]+)['"]\s*\]/gu,
	]) {
		for (const match of source.matchAll(pattern)) keys.add(match[1]);
	}
	return [...keys];
}

function stripCommentsForSettingsAuditV2(source: string): string {
	let result = '';
	let mode: 'normal' | 'line' | 'block' | 'single' | 'double' | 'template' = 'normal';
	for (let index = 0; index < source.length; index++) {
		const current = source[index];
		const next = source[index + 1];
		if (mode === 'line') {
			if (current === '\n') {
				mode = 'normal';
				result += current;
			}
			continue;
		}
		if (mode === 'block') {
			if (current === '*' && next === '/') {
				mode = 'normal';
				index++;
			} else if (current === '\n') {
				result += current;
			}
			continue;
		}
		if (mode === 'single' || mode === 'double' || mode === 'template') {
			result += current;
			if (current === '\\') {
				if (next != null) result += next;
				index++;
				continue;
			}
			if ((mode === 'single' && current === "'") || (mode === 'double' && current === '"') || (mode === 'template' && current === '`')) mode = 'normal';
			continue;
		}
		if (current === '/' && next === '/') {
			mode = 'line';
			index++;
			continue;
		}
		if (current === '/' && next === '*') {
			mode = 'block';
			index++;
			continue;
		}
		result += current;
		if (current === "'") mode = 'single';
		else if (current === '"') mode = 'double';
		else if (current === '`') mode = 'template';
	}
	return result;
}

/** Extract only the direct children of definePreferences({ ... }). */
function preferenceDefinitionKeysForAuditV2(source: string): string[] {
	const anchor = source.indexOf('definePreferences({');
	if (anchor < 0) throw new Error('settings key audit: PREF_DEF definePreferences call is missing');
	const opening = source.indexOf('{', anchor);
	if (opening < 0) throw new Error('settings key audit: PREF_DEF object is missing');
	const keys = new Set<string>();
	let depth = 0;
	let lineStart = true;
	let mode: 'normal' | 'line' | 'block' | 'single' | 'double' | 'template' = 'normal';
	for (let index = opening; index < source.length; index++) {
		const current = source[index];
		const next = source[index + 1];
		if (mode === 'line') {
			if (current === '\n') {
				mode = 'normal';
				lineStart = true;
			}
			continue;
		}
		if (mode === 'block') {
			if (current === '*' && next === '/') {
				mode = 'normal';
				index++;
				continue;
			}
			lineStart = current === '\n';
			continue;
		}
		if (mode === 'single' || mode === 'double' || mode === 'template') {
			if (current === '\\') {
				index++;
				continue;
			}
			if ((mode === 'single' && current === "'") || (mode === 'double' && current === '"') || (mode === 'template' && current === '`')) mode = 'normal';
			lineStart = current === '\n';
			continue;
		}
		if (current === '/' && next === '/') {
			mode = 'line';
			index++;
			continue;
		}
		if (current === '/' && next === '*') {
			mode = 'block';
			index++;
			continue;
		}
		if (current === "'") {
			mode = 'single';
			lineStart = false;
			continue;
		}
		if (current === '"') {
			mode = 'double';
			lineStart = false;
			continue;
		}
		if (current === '`') {
			mode = 'template';
			lineStart = false;
			continue;
		}
		if (current === '{') {
			depth++;
			lineStart = false;
			continue;
		}
		if (current === '}') {
			depth--;
			if (depth === 0) break;
			lineStart = false;
			continue;
		}
		if (depth === 1 && lineStart) {
			const match = /^[ \t]*(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*:/u.exec(source.slice(index));
			if (match != null) keys.add(match[1] ?? match[2]);
		}
		lineStart = current === '\n';
	}
	return [...keys].sort();
}

function pizzaxKeysForAuditV2(source: string, store: 'base' | 'deck'): Array<{ key: string; store: 'base' | 'deck'; scope: Extract<SettingsStorageRefV2, { kind: 'pizzax' }>['scope'] }> {
	const keys = new Map<string, Extract<SettingsStorageRefV2, { kind: 'pizzax' }>['scope']>();
	const clean = stripCommentsForSettingsAuditV2(source);
	for (const match of clean.matchAll(/^[ \t]*(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*\{\s*\n[ \t]*where\s*:\s*'([^']+)'/gmu)) {
		const key = match[1] ?? match[2];
		const scope = match[3];
		if (scope !== 'device' && scope !== 'account' && scope !== 'deviceAccount') continue;
		if (keys.has(key)) throw new Error(`settings key audit: duplicate Pizzax ${store} key: ${key}`);
		keys.set(key, scope);
	}
	return [...keys].map(([key, scope]) => ({ key, store, scope })).sort((left, right) => left.key.localeCompare(right.key));
}

function localStorageKeysForAuditV2(source: string): string[] {
	const start = source.indexOf('export type Keys = (');
	if (start < 0) throw new Error('settings key audit: miLocalStorage.Keys type is missing');
	const end = source.indexOf('\n);', start);
	if (end < 0) throw new Error('settings key audit: miLocalStorage.Keys type is unterminated');
	const keys = new Set<string>();
	for (const match of source.slice(start, end).matchAll(/(?:^|\|)\s*(?:'([^']+)'|`([^`]+)`)/gmu)) {
		keys.add(match[1] ?? match[2]);
	}
	return [...keys].sort();
}

/** Only these reviewed preference families are allowed to use a wildcard.
 * Every other preference reference is an exact key identity. */
const AUDITED_PREFERENCE_KEY_FAMILIES_V2 = new Set(['sound.on.*']);

function storageKeyMatcherSourceV2(key: string): string {
	// Preserve reviewed wildcard forms before escaping. Template-key families use
	// different variable names in their type (`${string}`) and their control
	// evidence (`${accountId}`), but both describe the same one-key namespace.
	return key
		.replace(/\$\{[^}]+\}/gu, '\u0000')
		.replace(/\*/gu, '\u0001')
		.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
		.replace(/\u0000/gu, '.+')
		.replace(/\u0001/gu, '.+');
}

function storageKeyPatternV2(key: string): RegExp {
	return new RegExp(`^${storageKeyMatcherSourceV2(key)}$`, 'u');
}

function preferenceKeyMatchesV2(refKey: string, key: string): boolean {
	return refKey === key || (AUDITED_PREFERENCE_KEY_FAMILIES_V2.has(refKey) && storageKeyPatternV2(refKey).test(key));
}

function localKeyMatchesV2(ref: Extract<SettingsStorageRefV2, { kind: 'local' }>, key: string): boolean {
	if (!ref.family) return ref.key === key;
	return storageKeyPatternV2(ref.key).test(key);
}

function matchingAuditDescriptorsV2(
	descriptors: SettingsStorageKeyAuditInputV2['descriptors'],
	kind: SettingsStorageKeyAuditKindV2,
	key: string,
	store?: 'base' | 'deck',
): Array<SettingsStorageKeyAuditInputV2['descriptors'][number]> {
	return descriptors.filter(descriptor => {
		if (!descriptor.searchable) return false;
		return (descriptor.storageRefs ?? []).some(ref => {
			if (kind === 'preference') return ref.kind === 'pref' && preferenceKeyMatchesV2(ref.key, key);
			if (kind === 'pizzax') return ref.kind === 'pizzax' && ref.key === key && ref.store === store;
			return ref.kind === 'local' && localKeyMatchesV2(ref, key);
		});
	});
}

function keyMentionedBySourceV2(kind: SettingsStorageKeyAuditKindV2, key: string, code: string): boolean {
	const clean = stripCommentsForSettingsAuditV2(code);
	const keyPattern = storageKeyMatcherSourceV2(key);
	const quoted = `['"\`]${keyPattern}['"\`]`;
	if (kind === 'preference') {
		const property = /^[A-Za-z_$][\w$]*$/u.test(key) ? `|\\.(?:s|r)\\.${key}\\b` : '';
		return new RegExp(
			`\\bprefer\\.(?:model|commit|isSyncEnabled)\\(\\s*${quoted}|\\bprefer\\.(?:s|r)\\s*\\[\\s*${quoted}\\s*\\]|\\bPREF_DEF\\s*\\[\\s*${quoted}\\s*\\]|\\bMkPreferenceContainer\\b[^>]*\\bk\\s*=\\s*${quoted}${property}`,
			'u',
		).test(clean);
	}
	if (kind === 'pizzax') {
		return new RegExp(`\\b(?:store|deckStore)\\.(?:get|set|makeGetterSetter|remove)\\(\\s*${quoted}`, 'u').test(clean);
	}
	return new RegExp(`\\bmiLocalStorage\\.(?:getItem|setItem|removeItem)\\(\\s*${quoted}`, 'u').test(clean);
}

/** Evidence must contain the reviewed key itself, not merely point at an
 * existing source file. Registry definitions are valid evidence for a
 * deprecated compatibility value; runtime rows still need a concrete
 * consumer/source entry in their reviewed manifest. */
function explicitEvidenceMentionsStorageKeyV2(
	kind: SettingsStorageKeyAuditKindV2,
	key: string,
	source: SettingsStorageKeyAuditSourceV2,
): boolean {
	// A template-key type with a literal union has no single runtime spelling.
	// Its reviewed device helper must declare the exact family and use storage.
	if (kind === 'local' && key.includes("${'")) {
		const clean = stripCommentsForSettingsAuditV2(source.code);
		return clean.includes('`' + key + '`')
			&& /\bmiLocalStorage\.(?:getItem|setItem|removeItem)\(/u.test(clean);
	}
	if (keyMentionedBySourceV2(kind, key, source.code)) return true;
	const clean = stripCommentsForSettingsAuditV2(source.code);
	const keyPattern = storageKeyMatcherSourceV2(key);
	if (new RegExp("['\"`]" + keyPattern + "['\"`]", 'u').test(clean)) return true;
	if (/^[A-Za-z_$][\w$]*$/u.test(key)) {
		if (kind === 'preference' && new RegExp(`\\bprefer\\.(?:s|r)\\.${key}\\b`, 'u').test(clean)) return true;
		if (kind === 'pizzax' && new RegExp(`\\b(?:store|deckStore)\\.(?:s|r)\\.${key}\\b`, 'u').test(clean)) return true;
	}
	// Pizzax/preference registry entries are object keys rather than calls.
	if (/^[A-Za-z_$][\w$]*$/u.test(key)
		&& (source.file === 'src/preferences/def.ts' || source.file === 'src/store.ts' || source.file === 'src/ui/deck/deck-store.ts')) {
		return new RegExp(`\\b${key}\\s*:`, 'u').test(clean);
	}
	return false;
}

function storageAuditIdentityV2(kind: SettingsStorageKeyAuditKindV2, key: string, store?: 'base' | 'deck'): string {
	return kind === 'pizzax'
		? kind + ':' + (store ?? 'base') + ':' + key
		: kind + ':' + key;
}

function explicitStorageDispositionsV2(): ReadonlyMap<string, ExplicitStorageKeyAuditDispositionV2> {
	const dispositions = new Map<string, ExplicitStorageKeyAuditDispositionV2>();
	const keys = (value: string): string[] => value.trim().split(/\s+/u).filter(Boolean);
	const add = (
		kind: SettingsStorageKeyAuditKindV2,
		names: readonly string[],
		disposition: ExplicitStorageKeyAuditDispositionV2['disposition'],
		reason: string,
		evidence: readonly string[],
		store?: 'base' | 'deck',
	): void => {
		for (const key of names) {
			const identity = storageAuditIdentityV2(kind, key, store);
			if (dispositions.has(identity)) throw new Error('settings key audit: duplicate explicit disposition: ' + identity);
			dispositions.set(identity, { disposition, reason, evidence });
		}
	};

	// Preference registry. These reviewed lists are the final classification;
	// source text is not used as a fallback classifier.
	add('preference', keys('enableCondensedLine'), 'deprecated',
		'2026.9.0で設定UIを廃止。保存済みプロファイルを読むために残す互換定義', ['src/preferences/def.ts']);
	add('preference', keys('aiChanMode useSimpleTL simpleTLLastListId'), 'deprecated',
		'現行UI・runtimeに接続しない旧互換 preference 定義', ['src/preferences/def.ts']);
	add('preference', keys('hata.mutedReactionsNoticeShown'), 'deprecated',
		'旧ミュートリアクション案内の互換flagで、現行runtimeは端末local keyだけを利用する', ['src/preferences/def.ts']);
	add('preference', keys('hideMutedUserReactions'), 'migration',
		'旧preferenceから端末local keyへ移行済みの互換フラグ', ['src/boot/common.ts']);
	add('preference', keys('enableLongPressOpenAccountMenu'), 'deprecated',
		'現行UI・runtime参照がない旧表示操作の互換値', ['src/preferences/def.ts']);
	add('preference', keys('enableWidgetsArea'), 'runtime',
		'設定画面からは廃止されたが、通常UIのwidget領域表示を決めるruntime値', ['src/ui/universal.vue']);
	add('preference', keys('deck.profile'), 'runtime',
		'旧Deckプロファイルの選択状態。設定画面外のDeckメニューが更新する', ['src/deck.ts']);
	add('preference', keys('simpleUi.deckActiveProfileV2 simpleUi.deckClock simpleUi.deckLocked simpleUi.deckOnlineUsers simpleUi.deckProfilesV2 simpleUi.deckRssEnabled simpleUi.deckRssFeeds simpleUi.deckToolbarPos'), 'runtime',
		'Deck V2のプロフィール・表示・RSS実行時状態', ['src/ui/_common_/hatasaba-deck.vue']);
	add('preference', keys('simpleUi.deckTutorialDone'), 'runtime',
		'Deckチュートリアルのdismiss状態', ['src/ui/_common_/HatasabaDeckTutorial.vue']);
	add('preference', keys('hataskeyUi3ShortcutGuideShown'), 'runtime',
		'Hataskey UI S のショートカット案内をアカウントごとに一度だけ出すための表示済み印', ['src/components/hataskey3/Hk3Composer.vue']);
	add('preference', keys('simpleUi.sidebar simpleUi.sidebarCollapsed'), 'runtime',
		'Simple UIのsidebar構成・開閉状態', ['src/ui/simple.vue']);
	add('preference', keys('widgets'), 'runtime',
		'widgetランタイムが保持する構成値で、settings targetには固定controlがない', ['src/ui/_common_/widgets.vue']);
	add('preference', keys('game.dropAndFusion'), 'runtime',
		'ゲーム画面専用のBGM/SFX実行時設定オブジェクト', ['src/pages/drop-and-fusion.game.vue']);
	add('preference', keys('hataPinnedAnnouncementIds'), 'runtime',
		'お知らせ一覧で使うピン留め状態で、settings target外の操作が更新する', ['src/pages/announcements.vue']);
	add('preference', keys('notificationExcludeBots'), 'runtime',
		'通知画面のフィルターメニューが更新するBOT除外状態', ['src/pages/notifications.vue']);
	add('preference', keys('showEventButtonInPostForm'), 'runtime',
		'投稿面が参照する表示状態', ['src/components/MkPostForm.vue']);
	add('preference', keys('simpleUi.utageBadgeTipShown'), 'runtime',
		'ユーザーページの宴バッジtip dismiss状態', ['src/pages/user/home.vue']);
	add('preference', keys('nicknameMap'), 'runtime',
		'ユーザー名編集dialogが更新する表示上のニックネーム対応表', ['src/utility/edit-nickname.ts']);
	add('preference', keys('external.avatarUrl external.host external.token external.userId external.username'), 'internal',
		'MiAuth連携identityまたはcredentialの導出状態で、検索・表示対象にしてはいけない', ['src/pages/settings/external-account.vue']);
	add('preference', keys('hataConsent.customFont hataConsent.customFontDate hataConsent.externalTl hataConsent.externalTlDate hataFont.customFontConsent'), 'internal',
		'利用規約・同意dialogの結果または記録日時で、単独設定controlではない', ['src/pages/settings/hata-custom.vue', 'src/pages/settings/external-account.vue']);
	add('preference', keys('reportError'), 'deprecated',
		'設定UIから廃止済みで、保存済みプロファイルを読むために残す互換定義', ['src/preferences/def.ts']);
	add('preference', keys('showLikeButtonInNoteFooter'), 'migration',
		'boot時に既定値へ正規化される廃止UIトグル', ['src/boot/main-boot.ts']);
	add('preference', keys('renameTheButtonInPostFormToNyaManualSet'), 'internal',
		'「にゃ」表記を利用者が明示選択済みかを記録する補助flagで、変更対象は親の表示設定', ['src/pages/settings/cherrypick.vue']);
	add('preference', keys('simpleUi.deckActiveProfile simpleUi.deckColumns simpleUi.deckLayout simpleUi.deckProfiles'), 'migration',
		'Deck V2 profile形式へ移行する前の旧構造', ['src/utility/hata-settings-transfer.ts']);
	add('preference', keys('simpleUi.deckMode'), 'runtime',
		'Simple UI内のDeck表示状態で、hata-customは読取のみ', ['src/ui/simple.vue', 'src/pages/settings/hata-custom.vue']);
	add('preference', keys('simpleUi.disableBubbleInDeck simpleUi.disableBubbleInDefault simpleUi.disableBubbleInHatasabaNormal'), 'deprecated',
		'旧bubble無効化値で、現行UIから廃止済み', ['src/preferences/def.ts']);
	add('preference', keys('simpleUi.directProfile'), 'deprecated',
		'hata-13.0でユーザーパネルとともに廃止。保存済みプロファイルを読むために残す互換定義', ['src/preferences/def.ts']);
	add('preference', keys('smoothTransitionAnimations'), 'internal',
		'常時ONのdisabled表示用product policyで、利用者が変更できない', ['src/pages/settings/preferences.vue']);
	add('preference', keys('weatherEffect.firstTipShown.heavyRain weatherEffect.firstTipShown.rain weatherEffect.firstTipShown.shootingStar weatherEffect.firstTipShown.snow weatherEffect.firstTipShown.sunny weatherEffect.firstTipShown.windy'), 'deprecated',
		'季節演出の旧初回tipフラグ。現行runtimeの参照先ではない', ['src/preferences/def.ts']);
	add('preference', keys('weatherEffect.intensity weatherEffect.respectReducedMotion'), 'deprecated',
		'旧weather設定で、現行描画・設定controlに接続しない', ['src/preferences/def.ts', 'src/utility/hata-settings-transfer.ts']);
	add('preference', keys('weatherEffect.scope'), 'runtime',
		'天気演出の集計範囲を変えるruntime値。hata-customには可視controlがない', ['src/components/MkStreamingNotesTimeline.vue', 'src/pages/settings/hata-custom.vue']);

	// Pizzax mirrors are an explicit reviewed list. A same-named preference is
	// never sufficient evidence on its own.
	add('pizzax', keys('allMediaNoteCollapse alwaysShowCw autoLoadMoreConversation autoLoadMoreReplies bannerDisplay collapseDefault collapseLongNoteContent collapseReplies disableNyaize displayHeaderNavBarWhenScroll enableAbsoluteTime enableAntennaTimeline enableBubbleTimeline enableChannelTimeline enableGlobalTimeline enableHomeTimeline enableListTimeline enableLocalTimeline enableLongPressOpenAccountMenu enableMarkByDate enableMediaTimeline enableSocialTimeline enableWidgetsArea expandOnNoteClick expandOnNoteClickBehavior externalNavigationWarning filesGridLayoutInUserPage fontSize forceCollapseAllRenotes forceRenoteVisibilitySelection hideAvatarsInNote infoButtonForNoteActionsEnabled mobileHeaderChange newNoteReceivedNotificationBehavior nicknameEnabled nicknameMap nsfwOpenBehavior postFormVisibilityHotkey reactableRemoteReactionEnabled removeModalBgColorForBlur renameTheButtonInPostFormToNya renameTheButtonInPostFormToNyaManualSet renoteQuoteButtonSeparation renoteVisibilitySelection requireRefreshBehavior selectReaction setFederationAvatarShape showDoReactionButtonInNoteFooter showFixedPostFormInReplies showFollowingMessageInsteadOfButtonEnabled showGapBodyOfTheNote showingAnimatedImages showLikeButtonInNoteFooter showMoreButtonInNoteFooter showNoAltTextWarning showPreview showProfilePreview showQuoteButtonInNoteFooter showRenoteButtonInNoteFooter showRenoteConfirmPopup showReplyButtonInNoteFooter showReplyInNotification showReplyTargetNote showReplyTargetNoteInSemiTransparent showSubNoteFooterButton showUnreadNotificationsCount smoothTransitionAnimations trustedDomains useEnterToSend welcomeBackToast'), 'deprecated',
		'Pizzax baseに残る旧mirror。現行設定の正本は明示的なprefer.model/commit経路で、Pizzax利用交差は監査済み', ['src/store.ts', 'src/preferences/def.ts'], 'base');
	add('pizzax', keys('accountInfos accountTokens pluginTokens'), 'internal',
		'ログインaccount metadataまたはcredentialキャッシュで、設定検索に公開しない', ['src/accounts.ts', 'src/plugin.ts'], 'base');
	add('pizzax', keys('accountSetupWizard'), 'runtime',
		'初回セットアップwizardの実行時進捗', ['src/boot/main-boot.ts'], 'base');
	add('pizzax', keys('localOnly visibility postFormWithHashtags postFormHashtags'), 'runtime',
		'投稿フォームの実行時状態で、設定画面の固定controlではない', ['src/components/MkPostFormSimple.vue'], 'base');
	add('pizzax', keys('tl'), 'runtime',
		'TL種別・フィルターの実行時状態で、タイムライン面が更新する', ['src/pages/timeline.vue'], 'base');
	add('pizzax', keys('memo'), 'runtime',
		'widget内メモの実行時データで、設定画面の固定controlではない', ['src/widgets/WidgetMemo.vue'], 'base');
	add('pizzax', keys('mutedAds'), 'runtime',
		'広告の表示抑止操作が更新する実行時リスト', ['src/components/global/MkAd.vue'], 'base');
	add('pizzax', keys('tips'), 'runtime',
		'ヒント表示の実行時状態', ['src/tips.ts'], 'base');
	add('pizzax', keys('recentlyUsedEmojis recentlyUsedUsers'), 'cache',
		'最近使った絵文字・ユーザー履歴キャッシュ', ['src/store.ts'], 'base');
	add('pizzax', keys('showPreferencesAutoCloudBackupSuggestion'), 'internal',
		'一度だけ表示する自動バックアップ提案の状態', ['src/pages/settings/index.vue'], 'base');
	add('pizzax', keys('showMenuButtonInNavbar showHomeButtonInNavbar showExploreButtonInNavbar showSearchButtonInNavbar showNotificationButtonInNavbar showChatButtonInNavbar'), 'deprecated',
		'旧navbar表示flagで、現行設定writerを持たない', ['src/ui/_common_/mobile-footer-menu.vue'], 'base');
	add('pizzax', keys('showWidgetButtonInNavbar showPostButtonInNavbar'), 'deprecated',
		'旧navbar表示flagで、現行設定writerを持たない', ['src/store.ts'], 'base');
	add('pizzax', keys('columns layout profile'), 'migration',
		'deck-storeに残る移行済みの旧deviceAccount deck状態', ['src/ui/deck/deck-store.ts'], 'deck');

	const dynamicKey = '$' + '{string}';
	add('local', keys('v basedMisskeyVersion lastVersion lastBasedMisskeyVersion hata_ui_migrated hata_gap_body_migrated hata_classic_spacing_migrated hata_misskeyui_wide_spacing_migrated hata_weather_default_off_migrated hata_sidebar_v2_migrated hata_sidebar_v3_migrated hata_sidebar_v4_migrated hata_sidebar_v5_migrated hata_sidebar_v6_migrated hata_sidebar_v7_migrated hata_docs_cleanup_migrated hata_support_cleanup_migrated hata_muted_reactions_local_migrated hata_hask_tiles_v1_migrated'), 'migration',
		'端末保存形式・UI移行の一度だけ使うversion/marker', ['src/local-storage.ts', 'src/boot/common.ts']);
	add('local', ['hata_sound_default_migrated:' + dynamicKey], 'migration',
		'旧既定音の移行をプロファイル・設定キー・scopeごとに記録する完了印', ['src/utility/hataskey-sound-migration.ts']);
	add('local', ['hata_portal_cleanup_migrated:' + dynamicKey], 'migration',
		'廃止ポータルの保存メニュー移行をアカウント・プロファイルごとに記録する完了印', ['src/utility/retired-portal-migration.ts']);
	add('local', ['hata_external_notifications_sidebar_migrated:' + dynamicKey], 'migration',
		'外部通知を保存サイドバー項目へ移行したことをアカウント・プロファイルごとに記録する完了印', ['src/utility/external-notifications-sidebar-migration.ts']);
	add('local', ['fontSize', 'hatadyLang', 'miux:' + dynamicKey, 'themes:' + dynamicKey, 'lastEmojisFetchedAt', 'emojis'], 'deprecated',
		'旧端末UI保存値。現行の正本または互換経路へ置換済み', ['src/local-storage.ts', 'src/pages/settings/preferences.vue']);
	add('local', keys('hataPostDelayEnabled hataPostDelaySeconds hataSideStudio hataSideStudioUiS'), 'runtime',
		'独立feature内の実行時設定で、settings catalog target外', ['src/local-storage.ts']);
	add('local', [...keys('hataskeyUi3Tab hataskeyUi3Live hataskeyUi3DeckMode hataskeyUi3PaneTab hataskeyUi3MobileOrder'), 'hataskeyUi3MobileGuideShown:' + dynamicKey], 'runtime',
		'Hataskey UI S の画面内操作(タブ・LIVE・デッキ表示・右ペイン・モバイルTLの並びと初回案内)が更新する端末ローカルの表示状態', ['src/components/hataskey3/Hk3Timeline.vue', 'src/components/hataskey3/Hk3App.vue', 'src/components/hataskey3/Hk3RightPane.vue']);
	add('local', ['hataRightWidgetsCollapsed'], 'runtime',
		'右ウィジェットバーの開閉操作が更新する端末ローカルの表示状態', ['src/utility/hatasaba-device-prefs.ts']);
	add('local', ['hataNotificationView'], 'runtime',
		'通知画面のブランド・種別・BOT除外フィルターを保持する端末ローカル表示状態', ['src/utility/hatasaba-device-prefs.ts', 'src/pages/notifications.vue']);
	add('local', ['hataskAkatsukiUsage:' + dynamicKey], 'cache',
		'暁ホームの優先表示に使う端末・アカウント別のツール利用履歴で、設定項目ではない', ['src/utility/hatask-akatsuki-usage.ts']);
	add('local', ["hatagoes:${'state' | 'create' | 'scroll'}:" + dynamicKey], 'cache',
		'HataGoesの画面復元・最近の作成・スクロール位置を保持する端末・アカウント別キャッシュ', ['src/utility/hatasaba-device-prefs.ts']);
	add('local', [
		'account', 'aiscriptSecure:' + dynamicKey, 'debug', 'hataNotificationFilterPolicyNoticeShown:' + dynamicKey,
		'hataSideStudioTutorialDone', 'hataWhatsNewShownVersion', 'hata_muted_reactions_notice_shown', 'hatafeedIntroShown',
		'hatalyzeNoticeAcceptedV1:' + dynamicKey, 'hatalyzeNoticeSyncedV1:' + dynamicKey,
		'hidePreferencesRestoreSuggestion', 'isSafeMode', 'latestDonationInfoShownAt',
		'modifiedVersionMustProminentlyOfferInAgplV3Section13Read', 'neverShowDonationInfo', 'neverShowLocalOnlyInfo',
		'neverShowNoteEditInfo', 'showPushNotificationDialog', 'ui_setup_completed', 'ui_temp', 'hataGlassUi',
	], 'internal',
		'アカウント・consent・prompt・safe-mode・強制product policyの内部状態で、設定値そのものではない', ['src/local-storage.ts', 'src/utility/hatasaba-device-prefs.ts']);
	add('local', [
		'aiscript:' + dynamicKey, 'bootloaderLocales', 'channelLastReadedAt:' + dynamicKey, 'chatMessageDrafts',
		'colorScheme', 'drafts', 'hashtags',
		'hataFormDrafts:' + dynamicKey, 'hatalyzeCooldownV1:' + dynamicKey,
		'hatasabaLastAntennaId', 'hatasabaLastListId', 'hatasabaUiLastTab', 'idbfallback::' + dynamicKey,
		'instance', 'instanceCachedAt', 'lastUsed', 'latestPreferencesUpdate', 'loginBonusLastShown', 'preferences',
		'scratchpad', 'theme', 'themeCachedVersion', 'themeId', 'ui:folder:' + dynamicKey,
	], 'cache',
		'editor/history/cacheなどの実行時データ', ['src/local-storage.ts', 'src/utility/hata-form-draft.ts']);
	return dispositions;
}

const EXPLICIT_STORAGE_KEY_AUDIT_DISPOSITIONS_V2 = explicitStorageDispositionsV2();

const SETTINGS_STORAGE_KEY_AUDIT_REGISTRY_FILES_V2 = [
	'src/preferences/def.ts',
	'src/store.ts',
	'src/ui/deck/deck-store.ts',
	'src/local-storage.ts',
] as const;

const REDESIGNED_PREFERENCE_AUDIT_SOURCE_FILES_V2 = [
	'src/pages/settings-redesign/settings-preferences-catalog.ts',
	'src/pages/settings-redesign/settings-preferences-models.ts',
	'src/pages/settings-redesign/settings-preferences-search-index.ts',
	'src/pages/settings-redesign/SettingsPreferencesSurface.vue',
	'src/pages/settings-redesign/HataskeyUiSRssSettings.vue',
	'src/pages/settings-redesign/HataskeyUiSBottomNavSettings.vue',
	'src/utility/hatasaba-device-prefs.ts',
] as const;

/** These controls are owned by the redesigned surface, so they have no legacy
 * SFC descriptor. Bridge only reviewed keys to their real runtime catalog IDs;
 * missing inventory/model/render wiring must still fail the storage audit. */
function redesignedPreferenceAuditDescriptorsV2(
	input: SettingsStorageKeyAuditInputV2,
): SettingsStorageKeyAuditInputV2['descriptors'] {
	const registered = new Set(preferenceDefinitionKeysForAuditV2(input.preferenceDefinition));
	const destinations: Record<string, string> = {
		emojiAdditionNotice: 'notifications-preferences',
		hourlyTimeNotice: 'notifications-preferences',
		hataskeyUi3ComposerShortcut1: 'hataskey-ui-s',
		hataskeyUi3ComposerShortcut2: 'hataskey-ui-s',
		hataskeyUi3ComposerEmojiPosition: 'hataskey-ui-s',
		hataskeyUi3ComposerPosition: 'hataskey-ui-s',
		hataskeyUi3TimelineBackground: 'hataskey-ui-s',
		hataskeyUi3SideMenuBackground: 'hataskey-ui-s',
		hataskeyUi3RightPaneBackground: 'hataskey-ui-s',
		hataskeyUi3GlassDensity: 'hataskey-ui-s',
		hataskeyUi3BottomNav: 'hataskey-ui-s',
		hataskeyUi3RssEnabled: 'hataskey-ui-s',
		hataskeyUi3RssFeeds: 'hataskey-ui-s',
		hataskeyUi3RssAutoSwitch: 'hataskey-ui-s',
		hataskeyUi3RssReadSeconds: 'hataskey-ui-s',
		hataskeyUi3RssReadMode: 'hataskey-ui-s',
	};
	const keys = Object.keys(destinations).filter(key => registered.has(key));
	const hasUiSDisplaySize = localStorageKeysForAuditV2(input.localStorageDefinition).includes('hataskeyUiSDisplaySize');
	if (keys.length === 0 && !hasUiSDisplaySize) return [];
	const evidenceFiles = new Set<string>(REDESIGNED_PREFERENCE_AUDIT_SOURCE_FILES_V2);
	const sources = new Map([...input.settingsSources, ...input.runtimeSources]
		.filter(source => evidenceFiles.has(source.file))
		.map(source => [source.file, stripCommentsForSettingsAuditV2(source.code)]));
	const catalog = sources.get(REDESIGNED_PREFERENCE_AUDIT_SOURCE_FILES_V2[0]) ?? '';
	const models = sources.get(REDESIGNED_PREFERENCE_AUDIT_SOURCE_FILES_V2[1]) ?? '';
	const search = sources.get(REDESIGNED_PREFERENCE_AUDIT_SOURCE_FILES_V2[2]) ?? '';
	const surface = sources.get(REDESIGNED_PREFERENCE_AUDIT_SOURCE_FILES_V2[3]) ?? '';
	const rssSurface = sources.get(REDESIGNED_PREFERENCE_AUDIT_SOURCE_FILES_V2[4]) ?? '';
	const bottomNavSurface = sources.get(REDESIGNED_PREFERENCE_AUDIT_SOURCE_FILES_V2[5]) ?? '';
	const devicePrefs = sources.get(REDESIGNED_PREFERENCE_AUDIT_SOURCE_FILES_V2[6]) ?? '';
	const uiSDisplaySizeDescriptor = (() => {
		if (!hasUiSDisplaySize) return [];
		const connected = /:data-settings-search-id="uiSDisplaySizeSearchId"/u.test(surface)
			&& /:modelValue="hataskeyUiSDisplaySize"/u.test(surface)
			&& /@update:modelValue="setHataskeyUiSDisplaySize\(\$event\)"/u.test(surface)
			&& /miLocalStorage\.getItem\('hataskeyUiSDisplaySize'\)/u.test(devicePrefs)
			&& /miLocalStorage\.setItem\('hataskeyUiSDisplaySize', size\)/u.test(devicePrefs)
			&& /storageRefs:\s*\[\{ kind: 'local', key: 'hataskeyUiSDisplaySize' \}\]/u.test(search)
			&& /stableId:\s*uiSDisplaySizeSearchId/u.test(search);
		if (!connected) throw new Error('settings key audit: UI S display size has invalid device control evidence');
		return [{ stableId: 'settings.control.device.hataskey-ui-s-display-size', searchable: true, preferenceKeys: [], storageRefs: [{ kind: 'local' as const, key: 'hataskeyUiSDisplaySize' }] }];
	})();
	const inventory = /export\s+const\s+preferenceContainerKeys\s*=\s*\[([\s\S]*?)\]\s*as\s+const/u.exec(catalog)?.[1] ?? '';
	const mountedControl = (/v-for="control in visibleMountedControls"/u.test(surface)
		|| /v-for="control in controlGroup\.controls"/u.test(surface)
			&& /v-for="controlGroup in visibleControlGroups"/u.test(surface)
			&& /controls:\s*visibleMountedControls\.value\.filter/u.test(surface))
		&& /:data-settings-search-id="searchIdFor\(control\.key\)"/u.test(surface)
		&& /@update:modelValue="write\(control\.key, \$event\)"/u.test(surface)
		&& /return\s+models\.controls\[key\]\.value/u.test(surface)
		&& /models\.controls\[key\]\.value\s*=\s*value/u.test(surface);
	const runtimeCatalog = /\bpreferenceControls\b[^=;\n]*=\s*preferenceContainerKeys\.map/u.test(catalog)
		&& /canonicalSearchId:\s*generatedPreferenceSearchId\(key\)/u.test(catalog)
		&& /preferenceControls\.map\(control\s*=>/u.test(search)
		&& /const\s+stableId\s*=\s*generatedPreferenceSearchId\(entry\.key\)/u.test(search)
		&& /preferenceKeys:\s*\[entry\.key\]/u.test(search);
	return [...uiSDisplaySizeDescriptor, ...keys.map(key => {
		if (key === 'hataskeyUi3BottomNav') {
			const mounted = /<HataskeyUiSBottomNavSettings\s+v-if="destination\.id === 'hataskey-ui-s'(?: \|\| categoryId === 'appearance')?"/u.test(surface);
			const connected = /<MkPreferenceContainer\s+k="hataskeyUi3BottomNav"/u.test(bottomNavSurface)
				&& /prefer\.commit\('hataskeyUi3BottomNav',/u.test(bottomNavSurface)
				&& /resolveUiSBottomNav\(prefer\.r\.hataskeyUi3BottomNav\.value,/u.test(bottomNavSurface)
				&& /v-model="items"/u.test(bottomNavSurface)
				&& /computed\(\{ get: currentItems, set: commit \}\)/u.test(bottomNavSurface);
			const indexed = /const uiSBottomNavSearchId = generatedPreferenceSearchId\('simpleUi\.bottomNav'\)/u.test(search)
				&& /preferenceKeys:\s*\['hataskeyUi3BottomNav'\]/u.test(search);
			if (!mounted || !connected || !indexed) throw new Error(`settings key audit: redesigned preference control has invalid evidence: ${key}`);
			return { stableId: 'settings.control.preference.simpleui-bottomnav', searchable: true, preferenceKeys: [key], storageRefs: [{ kind: 'pref' as const, key }] };
		}
		const keyPattern = storageKeyMatcherSourceV2(key);
		const quotedKey = `['"]${keyPattern}['"]`;
		const hasInventory = new RegExp(quotedKey, 'u').test(inventory);
		const hasDestination = new RegExp(`\\b${keyPattern}\\s*:\\s*\\{\\s*destinationId:\\s*['"]${destinations[key]}['"]`, 'u').test(catalog);
		const hasLabel = new RegExp(`\\b${keyPattern}\\s*:\\s*i18n\\.ts\\.`, 'u').test(catalog);
		const hasModel = new RegExp(`\\b${keyPattern}\\s*:\\s*unknownRef\\(prefer\\.model\\(${quotedKey}\\)\\)`, 'u').test(models);
		const specializedRssRender = key.startsWith('hataskeyUi3Rss')
			&& /<HataskeyUiSRssSettings\s+v-if="destination\.id === 'hataskey-ui-s'(?: \|\| categoryId === 'appearance')?"/u.test(surface)
			&& new RegExp(`searchId\\(${quotedKey}\\)`, 'u').test(rssSurface)
			&& new RegExp(`(?:prefer\\.commit\\(${quotedKey}|prefer\\.r\\.${keyPattern}\\.value)`, 'u').test(rssSurface);
		if (!hasInventory || !hasDestination || !hasLabel || !hasModel || !(specializedRssRender || mountedControl && !key.startsWith('hataskeyUi3Rss')) || !runtimeCatalog) {
			throw new Error(`settings key audit: redesigned preference control has invalid evidence: ${key}`);
		}
		return {
			stableId: `settings.control.preference.${key.toLowerCase()}`,
			searchable: true,
			preferenceKeys: [key],
			storageRefs: [{ kind: 'pref', key }],
		};
	})];
}

/** Files whose content is evidence for a reviewed storage-key classification.
 * Vite must regenerate the virtual catalog when one changes: otherwise a
 * formerly justified exclusion could remain silently accepted during HMR. */
export const SETTINGS_STORAGE_KEY_AUDIT_EVIDENCE_FILES_V2 = Object.freeze([...new Set([
	...SETTINGS_STORAGE_KEY_AUDIT_REGISTRY_FILES_V2,
	...REDESIGNED_PREFERENCE_AUDIT_SOURCE_FILES_V2,
	...Array.from(EXPLICIT_STORAGE_KEY_AUDIT_DISPOSITIONS_V2.values()).flatMap(item => item.evidence),
])].sort());

/**
 * Audits all three storage-key registries. A key is either attached to an
 * actual searchable control/group, or has a concrete runtime/migration/cache
 * reason. A visible settings-source reference without a catalog target is a
 * hard error; absence of a UI hit alone is never used as an internal verdict.
 */
export function collectSettingsStorageKeyAuditV2(input: SettingsStorageKeyAuditInputV2): SettingsStorageKeyAuditV2 {
	const items: SettingsStorageKeyAuditItemV2[] = [];
	const unresolved: string[] = [];
	const catalogDescriptors = [...input.descriptors, ...redesignedPreferenceAuditDescriptorsV2(input)];
	const evidenceFiles = new Set([
		...input.settingsSources.map(source => source.file),
		...input.runtimeSources.map(source => source.file),
		'src/preferences/def.ts',
		'src/store.ts',
		'src/ui/deck/deck-store.ts',
		'src/local-storage.ts',
	]);
	const evidenceSources = new Map<string, SettingsStorageKeyAuditSourceV2>([
		...input.settingsSources,
		...input.runtimeSources,
		{ file: 'src/preferences/def.ts', code: input.preferenceDefinition },
		...input.pizzaxStores.map(registry => ({
			file: registry.store === 'deck' ? 'src/ui/deck/deck-store.ts' : 'src/store.ts',
			code: registry.source,
		})),
		{ file: 'src/local-storage.ts', code: input.localStorageDefinition },
	].map(source => [source.file, source]));
	const add = (kind: SettingsStorageKeyAuditKindV2, key: string, store?: 'base' | 'deck', scope?: Extract<SettingsStorageRefV2, { kind: 'pizzax' }>['scope']): void => {
		const descriptors = matchingAuditDescriptorsV2(catalogDescriptors, kind, key, store);
		const descriptorStableIds = descriptors.map(descriptor => descriptor.stableId).sort();
		const explicit = EXPLICIT_STORAGE_KEY_AUDIT_DISPOSITIONS_V2.get(storageAuditIdentityV2(kind, key, store));
		if (explicit != null && descriptors.length > 0) {
			unresolved.push(`contradictory ${kind} key classification: ${key} (${descriptorStableIds.join(', ')})`);
			return;
		}
		if (descriptors.length > 0) {
			items.push({
				kind,
				key,
				...(store == null ? {} : { store }),
				...(scope == null ? {} : { scope }),
				disposition: descriptors.some(descriptor => descriptor.isGroup !== true) ? 'catalog-control' : 'catalog-group',
				reason: `${descriptorStableIds.join(', ')} に実際の storageRef/preference key として結線済み`,
				descriptorStableIds,
			});
			return;
		}
		if (explicit != null) {
			const unknownEvidence = explicit.evidence.filter(file => !evidenceFiles.has(file));
			const missingKeyEvidence = explicit.evidence.filter(file => {
				const source = evidenceSources.get(file);
				return source == null || !explicitEvidenceMentionsStorageKeyV2(kind, key, source);
			});
			if (unknownEvidence.length > 0 || missingKeyEvidence.length === explicit.evidence.length) {
				const detail = unknownEvidence.length > 0
					? 'missing source evidence: ' + unknownEvidence.join(', ')
					: 'does not mention key: ' + missingKeyEvidence.join(', ');
				unresolved.push('explicit ' + kind + ' key has invalid evidence: ' + key + ' (' + detail + ')');
				return;
			}
			items.push({
				kind,
				key,
				...(store == null ? {} : { store }),
				...(scope == null ? {} : { scope }),
				disposition: explicit.disposition,
				reason: explicit.reason + ' [' + explicit.evidence.join(', ') + ']',
				descriptorStableIds: [],
			});
			return;
		}
		const visibleSource = input.settingsSources
			.filter(source => keyMentionedBySourceV2(kind, key, source.code))
			.map(source => source.file)
			.sort()
			.at(0);
		if (visibleSource != null) {
			unresolved.push(`visible ${kind} key has no catalog target: ${key} (${visibleSource})`);
			return;
		}
		unresolved.push(`unclassified ${kind} key: ${key}`);
	};
	for (const key of preferenceDefinitionKeysForAuditV2(input.preferenceDefinition)) add('preference', key);
	for (const registry of input.pizzaxStores) {
		for (const item of pizzaxKeysForAuditV2(registry.source, registry.store)) add('pizzax', item.key, item.store, item.scope);
	}
	for (const key of localStorageKeysForAuditV2(input.localStorageDefinition)) add('local', key);
	if (unresolved.length > 0) {
		throw new Error(`settings key audit: ${unresolved.sort().join('\nsettings key audit: ')}`);
	}
	const seen = new Set<string>();
	for (const item of items) {
		const identity = `${item.kind}:${item.store ?? ''}:${item.key}`;
		if (seen.has(identity)) throw new Error(`settings key audit: duplicate disposition: ${identity}`);
		seen.add(identity);
		if (item.reason.trim() === '') throw new Error(`settings key audit: missing reason: ${identity}`);
	}
	return {
		items,
		counts: {
			preference: items.filter(item => item.kind === 'preference').length,
			pizzax: items.filter(item => item.kind === 'pizzax').length,
			local: items.filter(item => item.kind === 'local').length,
		},
	};
}

function relativeSettingsSourcePathV2(root: string, file: string): string {
	const normalized = normalizePath(file);
	return path.posix.isAbsolute(normalized)
		? normalizePath(path.posix.relative(normalizePath(root), normalized))
		: normalized;
}

/**
 * Runs the storage-key XOR audit against the real repository inputs used by
 * the virtual module.  This intentionally lives on the production load path,
 * not only in a unit fixture: changing a registry, a target SFC, or reviewed
 * runtime evidence cannot leave an out-of-date catalog behind.
 */
export async function collectSettingsStorageKeyAuditFromRepositoryV2(
	root: string,
	targetSourceFiles: readonly string[],
	descriptors: readonly Pick<SettingsControlSearchDescriptorV2,
		'stableId' | 'searchable' | 'isGroup' | 'preferenceKeys' | 'storageRefs'>[],
): Promise<SettingsStorageKeyAuditV2> {
	const normalizedRoot = normalizePath(root);
	const settingsFiles = [...new Set(targetSourceFiles
		.map(file => relativeSettingsSourcePathV2(normalizedRoot, file)))].sort();
	const registryFiles = new Set<string>(SETTINGS_STORAGE_KEY_AUDIT_REGISTRY_FILES_V2);
	const settingsFileSet = new Set(settingsFiles);
	const allSourceFiles = (await glob('src/**/*.{ts,vue}', {
		cwd: normalizedRoot,
		nodir: true,
	})).map(normalizePath).sort();
	const runtimeFiles = allSourceFiles.filter(file => !settingsFileSet.has(file) && !registryFiles.has(file));
	const read = async (file: string): Promise<SettingsStorageKeyAuditSourceV2> => ({
		file,
		code: await fs.readFile(path.join(normalizedRoot, file), 'utf8'),
	});
	const [settingsSources, runtimeSources, preference, baseStore, deckStore, localStorage] = await Promise.all([
		Promise.all(settingsFiles.map(read)),
		Promise.all(runtimeFiles.map(read)),
		fs.readFile(path.join(normalizedRoot, 'src/preferences/def.ts'), 'utf8'),
		fs.readFile(path.join(normalizedRoot, 'src/store.ts'), 'utf8'),
		fs.readFile(path.join(normalizedRoot, 'src/ui/deck/deck-store.ts'), 'utf8'),
		fs.readFile(path.join(normalizedRoot, 'src/local-storage.ts'), 'utf8'),
	]);
	return collectSettingsStorageKeyAuditV2({
		preferenceDefinition: preference,
		pizzaxStores: [
			{ store: 'base', source: baseStore },
			{ store: 'deck', source: deckStore },
		],
		localStorageDefinition: localStorage,
		settingsSources,
		runtimeSources,
		descriptors,
	});
}

type SettingsTransitiveControlDispositionV2 = 'registered-target' | 'parent-contained' | 'nonsetting' | 'unreachable-excluded';

export type SettingsTransitiveControlAuditItemV2 = {
	sourceFile: string;
	parentSourceFiles: string[];
	disposition: SettingsTransitiveControlDispositionV2;
	reason: string;
	interactiveActions: string[];
};

/**
 * Shared controls are not automatically settings targets just because a
 * settings SFC imports them.  These two components intentionally operate on
 * their caller's data: indexing them alone would duplicate parent controls or
 * invent a route and preference key they do not own.
 */
type SettingsTransitiveControlDispositionDefinitionV2 = Pick<SettingsTransitiveControlAuditItemV2, 'disposition' | 'reason'> & {
	/** Explicit setting editor children may be recursively audited. Generic
	 * wrappers/nonsettings are terminal so their unrelated application import
	 * graph cannot be mistaken for the settings surface. */
	traverse?: boolean;
};

const TRANSITIVE_SETTINGS_COMPONENT_DISPOSITIONS_V2: Readonly<Record<string, SettingsTransitiveControlDispositionDefinitionV2>> = {
	'src/components/MkNoteCharmPreview.vue': {
		disposition: 'nonsetting',
		reason: 'MkNoteCharmPreviewはinert内でmockの実MkNoteにサンプルを渡す読取専用preview。設定値・保存先を所有せず、投稿やメディア操作のimport閉包は設定面ではない',
	},
	'src/components/MkCode.vue': {
		disposition: 'nonsetting',
		reason: 'MkCodeのcopy/showは表示中コードのコピー・展開だけで、prefer.s.dataSaver.codeは読取のみ。設定値を更新しない',
	},
	'src/components/MkCodeEditor.vue': {
		disposition: 'parent-contained',
		reason: 'MkCodeEditorは親v-modelの文字列を編集する汎用inputで、設定キー・保存先・routeは呼び出し元のcustom CSS・plugin・theme installが所有する',
	},
	'src/components/MkColorInput.vue': {
		disposition: 'parent-contained',
		reason: 'MkColorInputは親v-modelへ色値を返す汎用inputで、設定キー・保存先・routeは呼び出し元が所有する',
	},
	'src/components/MkEmojiPicker.vue': {
		disposition: 'parent-contained',
		reason: 'MkEmojiPickerは親へ選択した絵文字を返す汎用pickerで、設定キー・保存先・routeは呼び出し元のパレット・リアクション設定が所有する',
	},
	'src/components/MkEmojiPicker.section.vue': {
		disposition: 'parent-contained',
		reason: 'MkEmojiPicker.sectionはMkEmojiPicker内の実行時絵文字一覧を描画する子で、独立した設定値・到達先を持たない',
	},
	'src/components/global/MkCustomEmoji.vue': {
		disposition: 'nonsetting',
		reason: 'MkCustomEmojiは設定行内の絵文字を表示する共通rendererであり、そこから開く詳細・編集導線は管理・投稿文脈の一時操作で設定画面の独立targetではない',
	},
	'src/components/MkInput.vue': {
		disposition: 'parent-contained',
		reason: 'MkInputは親v-modelへ値を返す汎用inputで、設定キー・保存先・routeは呼び出し元が所有する',
	},
	'src/components/MkRadios.vue': {
		disposition: 'parent-contained',
		reason: 'MkRadiosは親v-modelへ選択値を返す汎用radio groupで、設定キー・保存先・routeは呼び出し元が所有する',
	},
	'src/components/MkRadio.vue': {
		disposition: 'parent-contained',
		reason: 'MkRadioはMkRadiosまたは親v-modelの一選択肢を描画する汎用radioで、設定キー・保存先・routeは呼び出し元が所有する',
	},
	'src/components/MkRange.vue': {
		disposition: 'parent-contained',
		reason: 'MkRangeは親v-modelへ数値を返す汎用range inputで、設定キー・保存先・routeは呼び出し元が所有する',
	},
	'src/components/MkSelect.vue': {
		disposition: 'parent-contained',
		reason: 'MkSelectは親v-modelへ選択値を返す汎用selectで、設定キー・保存先・routeは呼び出し元が所有する',
	},
	'src/components/MkSwitch.vue': {
		disposition: 'parent-contained',
		reason: 'MkSwitchは親v-modelへ真偽値を返す汎用switchで、設定キー・保存先・routeは呼び出し元が所有する',
	},
	'src/components/MkTextarea.vue': {
		disposition: 'parent-contained',
		reason: 'MkTextareaは親v-modelへ文章を返す汎用textareaで、設定キー・保存先・routeは呼び出し元が所有する',
	},
	'src/components/MkPreferenceContainer.vue': {
		disposition: 'parent-contained',
		reason: 'MkPreferenceContainerは親MkPreferenceContainer kのper-preference同期・端末上書きメタ操作であり、独立した設定キー・ラベル・到達先を持たない',
	},
	'src/components/MkPagination.vue': {
		disposition: 'nonsetting',
		reason: 'MkPaginationは設定一覧内の実行時データをページングする汎用collection rendererで、設定値を所有しない',
	},
	'src/components/MkPaginationControl.vue': {
		disposition: 'nonsetting',
		reason: 'MkPaginationControlの並替え・検索・日付・再読込は親paginatorの一覧表示状態だけを更新し、設定値を保存しない',
	},
	'src/components/MkSuperMenu.vue': {
		disposition: 'nonsetting',
		reason: 'MkSuperMenuは親が渡すlink/actionを描画するdata駆動ナビゲーションで、設定値や保存先を単独では所有しない',
	},
	'src/pages/settings-redesign/SettingsRelatedLinks.vue': {
		disposition: 'nonsetting',
		reason: 'SettingsRelatedLinksは検索済みの関連設定へ移動する表示部品で、設定値を変更せず独立した保存先を持たない',
	},
	'src/components/MkWatermarkEditorDialog.vue': {
		disposition: 'parent-contained',
		reason: 'MkWatermarkEditorDialogは選択済みpresetを受け取る一時popupで、保存先と到達先はdrive.vueの透かしpreset静的groupが所有する。検索からpreset選択やpopup起動を行わない',
		traverse: true,
	},
	'src/components/MkPositionSelector.vue': {
		disposition: 'parent-contained',
		reason: 'MkPositionSelectorは透かしlayer編集popupへx/y値を返す汎用位置選択で、保存先・選択済みpreset・安全な到達先は親の透かしpreset設定が所有する',
	},
	'src/components/MkWatermarkEditorDialog.Layer.vue': {
		disposition: 'parent-contained',
		reason: 'MkWatermarkEditorDialog.Layerは選択済み透かしpresetのlayerを編集するv-for子で、個別layerは実行時に決まり、検索は親の透かしpreset設定へ集約する',
		traverse: true,
	},
	'src/components/MkTokenGenerateWindow.vue': {
		disposition: 'nonsetting',
		reason: 'MkTokenGenerateWindowは連携トークンを生成する一時workflowであり、永続設定値の独立targetではない。検索から生成・同意を開始しない',
	},
	'src/components/HataFeedExportWindow.vue': {
		disposition: 'nonsetting',
		reason: 'HataFeedExportWindowは書き出し範囲・形式を一回のexport実行のために選ぶworkflowで、設定値・到達先を永続化しない',
	},
	'src/components/HataFeedProjectSettings.vue': {
		disposition: 'nonsetting',
		reason: 'HataFeedProjectSettingsは実行時に選んだ共有プロジェクトの作成・編集・停止・削除と書き出しを行うデータ管理workflow。表示設定値を所有せず、検索からプロジェクトの選択や更新を開始しない',
	},
	'src/components/HatadyExportDialog.vue': {
		disposition: 'nonsetting',
		reason: 'HatadyExportDialogは書き出し対象・期間を一回のexport実行のために選ぶworkflowで、設定値・到達先を永続化しない',
	},
	'src/components/HatadyTutorial.vue': {
		disposition: 'nonsetting',
		reason: 'HatadyTutorialは初回案内を進める一時workflowであり、検索から開始・完了状態を変更しない',
	},
	'src/components/HataFeedTutorial.vue': {
		disposition: 'nonsetting',
		reason: 'HataFeedTutorialは使い方と更新内容を読む一時workflow。設定からの再表示は確認状況や実データを変更しない',
	},
	'src/components/HyTutorial.vue': {
		disposition: 'parent-contained',
		reason: 'HyTutorialはHatadyとHataFeedの案内にページ送りと終了操作を提供する共通表示。設定値や独立した保存先を持たない',
	},
	'src/components/MkExternalReactionPicker.vue': {
		disposition: 'parent-contained',
		reason: 'MkExternalReactionPickerは外部アカウント画面の選択済みお気に入り絵文字へ値を返すpickerで、保存キー・条件・静的到達先は親の外部アカウント設定が所有する',
	},
	'src/components/MkHatasabaUi2EditWindow.vue': {
		disposition: 'parent-contained',
		reason: 'MkHatasabaUi2EditWindowは常設HatasabaUi2SettingsBodyと同じUI2下書きの旧popup面で、検索のcanonical到達先・保存根拠は常設surfaceが所有する',
	},
	'src/components/MkUrlPreview.vue': {
		disposition: 'nonsetting',
		reason: 'MkUrlPreviewの展開・プレーヤー操作は表示中URLだけの一時状態で、設定値・保存先・settings routeを所有しない',
	},
	'src/components/MkUrlPreviewPopup.vue': {
		disposition: 'nonsetting',
		reason: 'MkUrlPreviewPopupはURLプレビューを一時表示するだけで、設定値を変更しない',
	},
	'src/components/HatadySubjectManager.vue': {
		disposition: 'parent-contained',
		reason: 'HatadySubjectManagerはHatady表示設定から選択済み分野を管理する一時popupであり、検索は親のHatady管理セクションへ安全に到達する',
	},
	'src/components/MkMascotImportSelectDialog.vue': {
		disposition: 'nonsetting',
		reason: 'MkMascotImportSelectDialogは読み込み時に上限超過した表情・文言から残す項目を一度だけ選ぶ一時workflowで、設定値・保存先・安全な独立到達先を所有しない',
	},
	'src/pages/settings/avatar-decoration.decoration.vue': {
		disposition: 'nonsetting',
		reason: 'avatar-decoration.decorationは親の選択・プレビュー用ランチャーで、二つのv-for集合に表示される。装飾の保存値は親のアバター装飾グループが所有する',
	},
};

function localVueImportPathV2(sourceFile: string, specifier: string): string | undefined {
	if (specifier.startsWith('@/')) return normalizePath('src/' + specifier.slice(2));
	if (specifier.startsWith('./') || specifier.startsWith('../')) return normalizePath(path.posix.normalize(path.posix.join(path.posix.dirname(sourceFile), specifier)));
	return undefined;
}

function vueImportPathsV2(sourceFile: string, code: string): string[] {
	const imports = new Set<string>();
	for (const match of code.matchAll(/\b(?:from\s*|import\s*\(\s*)['"]([^'"]+\.vue)['"]/gu)) {
		const local = localVueImportPathV2(sourceFile, match[1]);
		if (local != null) imports.add(local);
	}
	return [...imports].sort();
}

/**
 * Checks the local-Vue import closure of settings targets. Any imported
 * component with its own user-facing setting/destructive action must be a
 * registered target, unless it is an explicitly reviewed generic wrapper.
 */
export async function collectSettingsTransitiveControlAuditV2(
	root: string,
	targetSourceFiles: readonly string[],
): Promise<SettingsTransitiveControlAuditItemV2[]> {
	const normalizedRoot = normalizePath(root);
	const targets = new Set(targetSourceFiles.map(file => relativeSettingsSourcePathV2(normalizedRoot, file)));
	const sourceByFile = new Map<string, string>();
	const parents = new Map<string, Set<string>>();
	const queue = [...targets].sort();
	for (let cursor = 0; cursor < queue.length; cursor++) {
		const sourceFile = queue[cursor];
		let source = sourceByFile.get(sourceFile);
		if (source == null) {
			source = await fs.readFile(path.join(normalizedRoot, sourceFile), 'utf8');
			sourceByFile.set(sourceFile, source);
		}
		for (const child of vueImportPathsV2(sourceFile, source)) {
			const childParents = parents.get(child) ?? new Set<string>();
			childParents.add(sourceFile);
			parents.set(child, childParents);
			const explicitChild = TRANSITIVE_SETTINGS_COMPONENT_DISPOSITIONS_V2[child];
			// Generic/nonsetting wrappers are still audited as direct imports, but
			// must not drag arbitrary post/admin popup graphs into settings coverage.
			// Editors explicitly marked `traverse` remain part of the bounded
			// settings subtree so their nested runtime controls cannot hide.
			if ((explicitChild == null || explicitChild.traverse === true) && !sourceByFile.has(child) && !queue.includes(child)) queue.push(child);
		}
	}
	const items: SettingsTransitiveControlAuditItemV2[] = [];
	for (const sourceFile of [...parents.keys()].sort()) {
		const source = sourceByFile.get(sourceFile) ?? await fs.readFile(path.join(normalizedRoot, sourceFile), 'utf8');
		const interactive = collectSettingsInteractiveInventoryV2(sourceFile, source)
			// Runtime rows are not independently searchable, but an imported child
			// which owns them still needs an explicit target or reviewed wrapper
			// disposition. Otherwise a v-for editor can disappear from the bounded
			// settings import closure without any audit failure.
			.filter(item => item.classification === 'user-facing-setting'
				|| item.classification === 'runtime-collection'
				|| item.classification === 'destructive');
		const explicit = TRANSITIVE_SETTINGS_COMPONENT_DISPOSITIONS_V2[sourceFile];
		const dynamicReachability = dynamicChildReachabilityForSourceV2(sourceFile);
		if (interactive.length === 0 && explicit == null && dynamicReachability == null) continue;
		const parentSourceFiles = [...(parents.get(sourceFile) ?? new Set<string>())].sort();
		const interactiveActions = interactive.map(item => `${item.component}:${item.actionExpression ?? item.sourceLine}`).sort();
		if (dynamicReachability != null) {
			items.push({
				sourceFile,
				parentSourceFiles,
				disposition: dynamicReachability.parentGroupId == null
					? dynamicReachability.disposition ?? 'nonsetting'
					: 'parent-contained',
				reason: dynamicReachability.exclusionReason,
				interactiveActions,
			});
			continue;
		}
		if (targets.has(sourceFile)) {
			items.push({
				sourceFile,
				parentSourceFiles,
				disposition: 'registered-target',
				reason: 'targetFilePathsに明示登録済みの独立設定操作',
				interactiveActions,
			});
			continue;
		}
		if (explicit != null) {
			items.push({ sourceFile, parentSourceFiles, ...explicit, interactiveActions });
			continue;
		}
		if (interactive.length > 0) {
			throw new Error(`unregistered transitive setting control: ${sourceFile} (imported by ${parentSourceFiles.join(', ')})`);
		}
	}
	return items;
}

function preferenceModelBindingsV2(source: string): ReadonlyMap<string, string[]> {
	const bindings = new Map<string, string[]>();
	const bind = (name: string, key: string): void => {
		const current = bindings.get(name) ?? [];
		bindings.set(name, [...new Set([...current, key])]);
	};
	for (const match of source.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*prefer\.model\(\s*['"]([^'"]+)['"]/gu)) {
		bind(match[1], match[2]);
	}
	// Several established setting editors wrap a preference value in `ref` or
	// `reactive(deepClone(...))` before exposing it to a form.  The binding is
	// still literal and source-local, so retain it rather than falling back to
	// the whole file merely because it is not `prefer.model()`.
	for (const match of source.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:ref|reactive)(?:<[^>]+>)?\s*\(\s*(?:deepClone\(\s*)?prefer\.[rs]\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/gu)) {
		bind(match[1], match[2]);
	}
	for (const match of source.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*prefer\.[rs]\.([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/gu)) {
		bind(match[1], match[2]);
	}
	for (const match of source.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*ref(?:<[^>]+>)?\s*\(\s*prefer\.isSyncEnabled\(\s*['"]([^'"]+)['"]/gu)) {
		bind(match[1], match[2]);
	}
	return bindings;
}

/** Literal typed-local-storage bindings use the same model-aware path as
 * preferences. They are deliberately kept separate so `fontSize` can remain
 * a profile preference while the legacy browser font flags stay device-only. */
function localStorageModelBindingsV2(source: string): ReadonlyMap<string, SettingsStorageRefV2[]> {
	const bindings = new Map<string, SettingsStorageRefV2[]>();
	// Declarations must start a source line.  A legacy migration is commonly
	// left as a commented-out `const`, and matching that comment would attach
	// its device key to the live profile model with the same name.
	for (const match of source.matchAll(/^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*ref(?:<[^>]+>)?\s*\(\s*miLocalStorage\.getItem\(\s*['"]([^'"]+)['"]/gmu)) {
		bindings.set(match[1], [{ kind: 'local', key: match[2] }]);
	}
	return bindings;
}

function preferenceKeysForControlV2(
	node: ElementNode,
	modelExpression: string | undefined,
	bindings: ReadonlyMap<string, string[]>,
	handlers: ReadonlyMap<string, string>,
): string[] {
	const keys = new Set<string>();
	const modelRoot = modelExpression?.split('.')[0] ?? '';
	for (const key of bindings.get(modelExpression ?? '') ?? bindings.get(modelRoot) ?? []) keys.add(key);
	for (const eventName of ['click', 'update:modelValue', 'input', 'change']) {
		const expression = eventHandlerExpression(node, eventName);
		if (expression == null) continue;
		for (const key of literalPreferenceKeysInV2(expression)) keys.add(key);
		const handler = /^([A-Za-z_$][\w$]*)\b/u.exec(normalizedExpression(expression) ?? '')?.[1];
		for (const key of literalPreferenceKeysInV2(handler == null ? '' : handlers.get(handler) ?? '')) keys.add(key);
	}
	return [...keys];
}

type PizzaxScopeV2 = Extract<SettingsStorageRefV2, { kind: 'pizzax' }>['scope'];

/**
 * These are the Pizzax values with a user-facing setting control in the
 * settings source inventory.  The scope is deliberately written beside the
 * source binding and checked against `store.ts` by the inventory audit: it is
 * not inferred from a route or from the variable name.
 */
const PIZZAX_SETTING_SCOPES_V2: Readonly<Record<string, PizzaxScopeV2>> = {
	darkMode: 'device',
	realtimeMode: 'device',
	menuDisplay: 'device',
	reactionAcceptance: 'account',
	searchEngine: 'device',
	searchEngineUrl: 'device',
	searchEngineUrlQuery: 'device',
};

function pizzaxRefV2(key: string): Extract<SettingsStorageRefV2, { kind: 'pizzax' }> | undefined {
	const scope = PIZZAX_SETTING_SCOPES_V2[key];
	return scope == null ? undefined : { kind: 'pizzax', store: 'base', key, scope };
}

/** `computed(store.makeGetterSetter('key'))` is the canonical Pizzax model
 * bridge in settings SFCs.  Keep it separate from `prefer.model` so an
 * account-scoped Pizzax key can never be misreported as a profile preference. */
function pizzaxModelBindingsV2(source: string): ReadonlyMap<string, string[]> {
	const bindings = new Map<string, string[]>();
	for (const match of source.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*computed\(\s*store\.makeGetterSetter\(\s*['"]([^'"]+)['"]/gu)) {
		if (pizzaxRefV2(match[2]) != null) bindings.set(match[1], [match[2]]);
	}
	return bindings;
}

function pizzaxRefsForControlV2(
	node: ElementNode,
	modelExpression: string | undefined,
	bindings: ReadonlyMap<string, string[]>,
	handlers: ReadonlyMap<string, string>,
): Extract<SettingsStorageRefV2, { kind: 'pizzax' }>[] {
	const keys = new Set<string>(bindings.get(modelExpression ?? '') ?? []);
	for (const eventName of ['click', 'update:modelValue', 'input', 'change']) {
		const expression = eventHandlerExpression(node, eventName);
		if (expression == null) continue;
		const handler = /^([A-Za-z_$][\w$]*)\b/u.exec(normalizedExpression(expression) ?? '')?.[1];
		const text = `${expression}\n${handler == null ? '' : handlers.get(handler) ?? ''}`;
		for (const match of text.matchAll(/\bstore\.set\(\s*['"]([^'"]+)['"]/gu)) {
			if (pizzaxRefV2(match[1]) != null) keys.add(match[1]);
		}
	}
	return [...keys].flatMap(key => {
		const ref = pizzaxRefV2(key);
		return ref == null ? [] : [ref];
	});
}

// The shared UI2 editor intentionally keeps persistence in a composable so it
// can buffer/reload atomically. This finite mapping is source evidence, not a
// route fallback; every draft field is named in that composable's save path.
const UI2_DRAFT_PREFERENCE_KEYS: Readonly<Record<string, readonly string[]>> = {
	'editor.draft.editedNormalNoBannerBg': ['simpleUi.normalNoBannerBg'],
	'editor.draft.editedProfileNoBannerBg': ['simpleUi.profileNoBannerBg'],
	'editor.draft.editedOpacity': ['simpleUi.glassUiCardOpacity'],
	'editor.draft.editedDisableBubbleInHatasabaDeck': ['simpleUi.disableBubbleInHatasabaDeck'],
	'editor.draft.editedShowTrendingTab': ['simpleUi.showTrendingTab'],
	'editor.draft.editedShowHatadyTab': ['simpleUi.showHatadyTab'],
	'editor.draft.editedTopNavMode': ['simpleUi.topNavMode'],
	'editor.draft.editedTopNav': ['simpleUi.topNav'],
	'editor.draft.editedBottomNav': ['simpleUi.bottomNav'],
};

const UI2_DRAFT_DEVICE_KEYS: Readonly<Record<string, readonly string[]>> = {
	'editor.draft.editedGlassUiBubble': ['hataGlassUiBubble'],
	'editor.draft.editedDeckIgnoreWidth': ['hatasabaDeckIgnoreWidth'],
	'editor.draft.editedTabSwipeEnabled': ['hatasabaTabSwipeEnabled'],
};

function isPersistentAssignment(click: string): boolean {
	// View/category/preview state makes existing UI reachable but does not alter
	// a user preference. Everything else that writes a local ref or model is a
	// setting draft, including `editTheme = …` and `showName = !showName`.
	if (/^(?:activeCat|mode|deckPreviewOpen|themeIndex|view|tab|activeCharIdx|preview(?:PhraseIdx|Mode)|notify2?PreviewMode|birthdayPreviewMode|charBirthdayPreviewMode|showOthers|fieldEditMode)\s*(?:=|\+=|-=)/u.test(click)) return false;
	return /(?:^|[;(])\s*(?:[A-Za-z_$][\w$]*(?:\.value)?|(?:settings|displaySettings|preferences|activeChar)(?:\.[A-Za-z_$][\w$]*)+)\s*=(?!=)/u.test(click);
}

function isSaveCancelHandler(click: string): boolean {
	return /^(?:save|cancel|close|submit|doExport|doImport|apply|reset)(?:\b|[A-Z_])/u.test(click);
}

function interactiveClassification(sourceFile: string, node: ElementNode, ancestors: readonly ElementNode[], persistentHandlers: ReadonlySet<string>): Pick<SettingsInteractiveInventoryItemV2, 'classification' | 'reason' | 'searchableControl'> {
	const click = normalizedExpression(eventHandlerExpression(node, 'click')) ?? '';
	const disabled = isStaticDisabled(node);
	if (disabled || isStaticReadOnly(node) || (!click && (node.tag === 'button' || node.tag === 'MkButton'))) {
		return { classification: 'disabled-display-only', reason: '常時無効・readonly、または操作を持たない表示専用コントロール', searchableControl: false };
	}
	const nonPersistentReason = nonPersistentFormControlExclusionV2(
		sourceFile,
		directiveExpression(node, 'model') ?? expressionOf(findAttribute(node.props, 'modelValue')),
	);
	if (nonPersistentReason != null) {
		return { classification: 'navigation-action', reason: nonPersistentReason, searchableControl: false };
	}
	if (node.tag === 'button' || node.tag === 'MkButton') {
		const handler = /^([A-Za-z_$][\w$]*)\b/u.exec(click)?.[1];
		if (isSaveCancelHandler(click)) {
			return { classification: 'save-cancel', reason: '保存・取消・確定・閉じるための操作で、設定項目そのものではない', searchableControl: false };
		}
		if (hasAncestorRuntimeCollection(node, ancestors)) {
			return { classification: 'runtime-collection', reason: 'v-for または draggable の実行時コレクションに属し、個別対象はビルド時に固定できない', searchableControl: false };
		}
		if (isDirectDestructiveAction(node)) {
			return { classification: 'destructive', reason: 'アカウント・全設定・ログイン状態を明示的に破棄する操作で、確認UIへ直接到達できる', searchableControl: true };
		}
		if (isExplicitNonSettingActionV2(sourceFile, click)) {
			return { classification: 'navigation-action', reason: '一度だけ表示する内部案内を閉じる操作で、設定値そのものではない', searchableControl: false };
		}
		if (explicitControlStorageBindingV2(sourceFile, undefined, node) != null
			|| isPersistentAssignment(click) || (handler != null && persistentHandlers.has(handler))) {
			return { classification: 'user-facing-setting', reason: '設定値を永続状態へ反映する選択・切替操作', searchableControl: true };
		}
		return { classification: 'navigation-action', reason: '画面遷移・ポップアップ起動・選択操作で、直接の設定値入力ではない', searchableControl: false };
	}
	if (hasAncestorRuntimeCollection(node, ancestors)) {
		return { classification: 'runtime-collection', reason: 'v-for または draggable の実行時コレクションに属し、個別対象はビルド時に固定できない', searchableControl: false };
	}
	return { classification: 'user-facing-setting', reason: '利用者が設定値を入力・選択・切替するフォームコントロール', searchableControl: true };
}

/** Collect every interactive node, independently of the narrower search extractor. */
export function collectSettingsInteractiveInventoryV2(sourceFile: string, code: string): SettingsInteractiveInventoryItemV2[] {
	const parsed = parseTargetSfc(sourceFile, code);
	if (parsed.descriptor.template?.ast == null) return [];
	const items: SettingsInteractiveInventoryItemV2[] = [];
	const scriptSource = [parsed.descriptor.script?.content, parsed.descriptor.scriptSetup?.content].filter((value): value is string => value != null).join('\n');
	const persistentHandlers = persistentHandlerNames(scriptSource);
	const handlerBodiesByName = handlerBodies(scriptSource);
	const preferenceBindings = preferenceModelBindingsV2(scriptSource);
	const walk = (nodes: TemplateChildNode[], ancestors: ElementNode[]): void => {
		for (const node of nodes) {
			if (node.type !== NodeTypes.ELEMENT) continue;
			if (INTERACTIVE_COMPONENTS.has(node.tag) || RUNTIME_COLLECTION_COMPONENTS.has(node.tag) || isUserFacingSettingActionNode(sourceFile, node, persistentHandlers)) {
				const group = staticGroupContext(sourceFile, ancestors);
				items.push({
					sourceFile,
					sourceLine: node.loc.start.line,
					component: node.tag,
					actionExpression: normalizedExpression(eventHandlerExpression(node, 'click')),
					staticGroupKey: group.key,
					staticGroupLabel: group.label,
					...interactiveClassification(sourceFile, node, ancestors, persistentHandlers),
				});
			}
			walk(node.children, [...ancestors, node]);
		}
	};
	walk(parsed.descriptor.template.ast.children, []);
	// The standalone collector is already complete: source callers that also
	// have control descriptors may call the resolver again to replace a group
	// fallback with the exact control ID on the same source location.
	return resolveSettingsInteractiveInventoryDispositionsV2(items, []);
}

export function collectSettingsInteractiveStaticGroupsV2(items: readonly SettingsInteractiveInventoryItemV2[]): SettingsInteractiveStaticGroupDescriptorV2[] {
	const groups = new Map<string, SettingsInteractiveStaticGroupDescriptorV2>();
	for (const item of items) {
		if (item.staticGroupKey == null) continue;
		if (groups.has(item.staticGroupKey)) continue;
		groups.set(item.staticGroupKey, {
			stableId: `settings.group.${slug(item.sourceFile)}-${shortStableHash(item.staticGroupKey)}`,
			sourceFile: item.sourceFile,
			sourceLine: item.sourceLine,
			label: item.staticGroupLabel || '設定グループ',
			key: item.staticGroupKey,
			searchable: true,
		});
	}
	return [...groups.values()];
}

/**
 * Resolves every raw interaction to exactly one search target or one explicit
 * exclusion. Form controls retain their actual descriptor; buttons and
 * runtime rows use their nearest named static group rather than a fabricated
 * line-based ID.
 */
export function resolveSettingsInteractiveInventoryDispositionsV2(
	items: readonly SettingsInteractiveInventoryItemV2[],
	descriptors: readonly Pick<SettingsControlSearchDescriptorV2, 'sourceFile' | 'sourceLine' | 'stableId' | 'searchable'>[],
	materializedGroups?: readonly Pick<SettingsInteractiveStaticGroupDescriptorV2, 'key' | 'stableId'>[],
): SettingsInteractiveInventoryItemV2[] {
	const descriptorByLocation = new Map<string, string>();
	for (const descriptor of descriptors) {
		if (!descriptor.searchable) continue;
		const key = `${descriptor.sourceFile}:${descriptor.sourceLine}`;
		if (!descriptorByLocation.has(key)) descriptorByLocation.set(key, descriptor.stableId);
	}
	const groups = new Map((materializedGroups ?? collectSettingsInteractiveStaticGroupsV2(items)).map(group => [group.key, group]));
	return items.map(item => {
		const dynamicChild = dynamicChildReachabilityForSourceV2(item.sourceFile);
		if (dynamicChild != null && (item.classification === 'user-facing-setting' || item.classification === 'runtime-collection' || item.classification === 'destructive')) {
			if (dynamicChild.parentGroupId != null) {
				return { ...item, descriptorStableId: dynamicChild.parentGroupId, exclusionReason: undefined };
			}
			return { ...item, descriptorStableId: undefined, exclusionReason: dynamicChild.exclusionReason };
		}
		const direct = descriptorByLocation.get(`${item.sourceFile}:${item.sourceLine}`);
		if ((item.classification === 'user-facing-setting' || item.classification === 'destructive') && direct != null) {
			return { ...item, descriptorStableId: direct, exclusionReason: undefined };
		}
		if (item.classification === 'user-facing-setting' || item.classification === 'runtime-collection') {
			const group = item.staticGroupKey == null ? undefined : groups.get(item.staticGroupKey);
			if (group == null) {
				// During real catalog assembly a dynamic row whose surrounding host is
				// not a safe static, user-facing heading must remain explicitly
				// excluded.  Do not invent a line-based group ID just to satisfy
				// coverage.  The standalone collector keeps throwing so the positive
				// audit fixture proves this branch is live.
				if (materializedGroups != null) {
					return {
						...item,
						descriptorStableId: undefined,
						exclusionReason: `${item.reason}（安全な静的設定グループを確定できないため検索対象外）`,
					};
				}
				throw new Error(`settings V2 unclassified interactive group: ${item.sourceFile}:${item.sourceLine}`);
			}
			return { ...item, descriptorStableId: group.stableId, exclusionReason: undefined };
		}
		if (item.classification === 'destructive') {
			// The standalone raw collector deliberately has no descriptor table yet.
			// Its caller can still audit this reason; the generated inventory test
			// asserts that every such entry is replaced by a direct descriptor.
			return { ...item, descriptorStableId: undefined, exclusionReason: `${item.reason}（検索descriptor未接続）` };
		}
		return { ...item, descriptorStableId: undefined, exclusionReason: item.reason };
	});
}

function collectElementNodes(nodes: TemplateChildNode[], result: ElementNode[] = []): ElementNode[] {
	for (const child of nodes) {
		if (child.type !== NodeTypes.ELEMENT) continue;
		result.push(child);
		collectElementNodes(child.children, result);
	}
	return result;
}

function expressionOf(attribute: AttributeNode | DirectiveNode | undefined): string | undefined {
	if (attribute?.type === NodeTypes.ATTRIBUTE) return attribute.value?.content;
	if (attribute?.type === NodeTypes.DIRECTIVE) return attribute.exp?.content;
	return undefined;
}

/** Render an attribute as the same safe template form used for slot text.
 * A bound `:label="copy.title"` is an expression, not a literal label. */
function templateOfAttribute(attribute: AttributeNode | DirectiveNode | undefined): string | undefined {
	if (attribute?.type === NodeTypes.ATTRIBUTE) return attribute.value?.content;
	if (attribute?.type === NodeTypes.DIRECTIVE && attribute.exp?.content != null) return `\${${attribute.exp.content}}`;
	return undefined;
}

function parseTargetSfc(sourceFile: string, code: string) {
	const parsed = parseSfc(code, { filename: sourceFile });
	if (parsed.errors.length > 0) {
		const details = parsed.errors.map(error => {
			if (typeof error === 'string') return error;
			if (error != null && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
			return String(error);
		}).join('; ');
		throw new Error(`settings V2 parse error in ${sourceFile}: ${details}`);
	}
	return parsed;
}

function directiveExpression(node: ElementNode, name: string): string | undefined {
	const directive = node.props.find(prop => prop.type === NodeTypes.DIRECTIVE && prop.name === name);
	return directive?.type === NodeTypes.DIRECTIVE ? directive.exp?.content : undefined;
}

/**
 * 旗鯖fork: 設定画面の右ペインへ埋め込めるよう、窓は
 * `<component :is="embedded ? SettingsEmbeddedWindow : MkWindow">` へ置き換えた。
 * ⚠️タグ名だけで節を見分けると、この付け替えで節ごと索引から消える。
 *   （実際に settings.group.hatady-display-settings が1件消えた）
 */
function isSettingsWindowRoot(node: ElementNode, tag: string): boolean {
	if (node.tag === tag) return true;
	if (node.tag !== 'component') return false;
	const is = node.props.find(prop => prop.type === NodeTypes.DIRECTIVE
		&& prop.name === 'bind'
		&& prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
		&& prop.arg.content === 'is');
	const expression = is?.type === NodeTypes.DIRECTIVE ? is.exp?.content ?? '' : '';
	return new RegExp(`\\b${tag}\\b`, 'u').test(expression);
}

function eventHandlerExpression(node: ElementNode, eventName: string): string | undefined {
	const handlers = node.props.filter((prop): prop is DirectiveNode => prop.type === NodeTypes.DIRECTIVE
		&& prop.name === 'on' && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content === eventName);
	if (handlers.length > 1) throw new Error(`settings V2 has duplicate @${eventName} handlers at line ${node.loc.start.line}`);
	return handlers[0]?.exp?.content;
}

/** Event handlers distinguish otherwise identical native value inputs without using source order. */
function eventHandlerIdentity(node: ElementNode): string {
	return node.props
		.filter((prop): prop is DirectiveNode => prop.type === NodeTypes.DIRECTIVE && prop.name === 'on' && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION)
		.map(prop => `${prop.arg!.content}:${normalizedExpression(prop.exp?.content) ?? ''}`)
		.sort()
		.join('|');
}

function normalizedExpression(expression: string | undefined): string | undefined {
	return expression?.replace(/\s+/gu, '');
}

function hasNamedSlot(node: ElementNode, slotName: string): boolean {
	return node.tag === 'template' && node.props.some(prop => prop.type === NodeTypes.DIRECTIVE
		&& prop.name === 'slot' && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content === slotName);
}

function isDraggableItemCollection(node: ElementNode): boolean {
	return node.tag === 'draggable' && node.children.some(child => child.type === NodeTypes.ELEMENT && hasNamedSlot(child, 'item'));
}

function hasPlaceholderDescendant(nodes: readonly TemplateChildNode[]): boolean {
	return nodes.some(child => child.type === NodeTypes.ELEMENT
		&& (findAttribute(child.props, 'placeholder') != null || hasPlaceholderDescendant(child.children)));
}

function isSortablePlaceholderCollection(node: ElementNode): boolean {
	return node.tag === 'Sortable'
		&& node.children.some(child => child.type === NodeTypes.ELEMENT && hasNamedSlot(child, 'item'))
		&& hasPlaceholderDescendant(node.children);
}

const ROW_LABEL_CLASS_NAMES_V2 = new Set(['label', 'colorLabel', 'bubbleCtrlLabel', 'idleManualLabel']);
const ROW_CONTAINER_CLASS_NAMES_V2 = new Set(['row', 'card', 'cardHead', 'colorRow', 'bubbleCtrlRow']);

function classNamesV2(node: ElementNode): string[] {
	const value = expressionOf(findAttribute(node.props, 'class')) ?? '';
	return value.split(/[^A-Za-z0-9_$-]+/u).filter(Boolean);
}

function hasClassNameV2(node: ElementNode, names: ReadonlySet<string>): boolean {
	const classes = classNamesV2(node);
	return classes.some(className => names.has(className) || [...names].some(name => className.endsWith(`.${name}`)));
}

function isDescriptionLikeNodeV2(node: ElementNode): boolean {
	if (node.tag === 'MkInfo' || node.tag === 'SearchText') return true;
	if (/(?:^|[.\s])(?:desc|description|caption|hint|help|notice|info|lead|ioDesc|warning|alert|error)(?:$|[.\s])/iu.test(classNamesV2(node).join(' '))) return true;
	// A few legacy settings pages use an unclassed, muted block for a caption.
	// Treat its presentation as description metadata when considering a sibling
	// label; a nearby caption must not displace the owning FormSection label.
	const style = expressionOf(findAttribute(node.props, 'style')) ?? '';
	return /(?:opacity|line-height)\s*:/iu.test(style);
}

function textOnlyLabelV2(node: ElementNode): string | undefined {
	if (isDescriptionLikeNodeV2(node)) return undefined;
	const value = textTemplate([node], true, true);
	return value.trim() === '' ? undefined : value;
}

function directLabelChildV2(node: ElementNode): string | undefined {
	for (const child of node.children) {
		if (child.type !== NodeTypes.ELEMENT || isDescriptionLikeNodeV2(child)) continue;
		if (hasClassNameV2(child, ROW_LABEL_CLASS_NAMES_V2)) return textOnlyLabelV2(child);
		if (child.tag === 'div' && hasClassNameV2(child, new Set(['cardHead']))) {
			const nested = directLabelChildV2(child);
			if (nested != null) return nested;
		}
	}
	return undefined;
}

/** Extract only a statically marked row/card label, never all visible copy. */
function explicitRowLabelTemplateV2(node: ElementNode): string | undefined {
	if (node.tag === 'label' || hasClassNameV2(node, ROW_LABEL_CLASS_NAMES_V2)) return textOnlyLabelV2(node);
	if (!hasClassNameV2(node, ROW_CONTAINER_CLASS_NAMES_V2)) return undefined;
	const direct = directLabelChildV2(node);
	if (direct != null) return direct;
	// Mascot's compact rows use an unclassed first span for the field label.
	if (hasClassNameV2(node, new Set(['row']))) {
		for (const child of node.children) {
			if (child.type !== NodeTypes.ELEMENT || child.tag !== 'span') continue;
			const value = textOnlyLabelV2(child);
			if (value != null) return value;
		}
	}
	return undefined;
}

function inlineSiblingLabelTemplateV2(siblings: readonly TemplateChildNode[], index: number): string | undefined {
	let previous: string | undefined;
	for (let cursor = index - 1; cursor >= 0; cursor--) {
		const sibling = siblings[cursor];
		if (sibling.type === NodeTypes.TEXT && sibling.content.trim() === '') continue;
		if (sibling.type === NodeTypes.INTERPOLATION) {
			previous = `\${${sibling.content.content}}`;
			break;
		}
		if (sibling.type === NodeTypes.ELEMENT) {
			previous = explicitRowLabelTemplateV2(sibling) ?? textOnlyLabelV2(sibling);
			break;
		}
		break;
	}
	let following: string | undefined;
	for (let cursor = index + 1; cursor < siblings.length; cursor++) {
		const sibling = siblings[cursor];
		if (sibling.type === NodeTypes.TEXT && sibling.content.trim() === '') continue;
		if (sibling.type === NodeTypes.INTERPOLATION) {
			const expression = sibling.content.content.trim();
			if (/(?:separator|range)/iu.test(expression)) continue;
			following = `\${${sibling.content.content}}`;
		}
		break;
	}
	const hasPreviousControl = siblings.slice(0, index).some(sibling => sibling.type === NodeTypes.ELEMENT && INTERACTIVE_COMPONENTS.has(sibling.tag));
	return hasPreviousControl && following != null ? following : previous ?? following;
}

function isMeaningfulPlaceholderV2(placeholder: string | undefined, rowLabel: string | undefined): boolean {
	if (placeholder == null || placeholder.trim() === '') return false;
	if (rowLabel == null) return true;
	const placeholderExpression = placeholder.match(/^\$\{([^{}]+)\}$/u)?.[1]?.trim();
	const rowExpression = rowLabel.match(/^\$\{([^{}]+)\}$/u)?.[1]?.trim();
	// A field-specific `namePlaceholder` beside the explicit `name` row label
	// is a hint, not a second setting name. Other placeholders remain useful
	// labels for raw controls such as expression text and optional labels.
	if (placeholderExpression != null && rowExpression != null
		&& placeholderExpression.replace(/Placeholder$/u, '') === rowExpression) return false;
	return true;
}

function textTemplate(nodes: TemplateChildNode[], skipNestedControls = true, skipNestedInteractive = false): string {
	const pieces: string[] = [];
	const visit = (node: TemplateChildNode): void => {
		if (node.type === NodeTypes.TEXT) {
			pieces.push(node.content);
			return;
		}
		if (node.type === NodeTypes.INTERPOLATION) {
			pieces.push(`\${${node.content.content}}`);
			return;
		}
		if (node.type !== NodeTypes.ELEMENT) return;
		if (skipNestedControls && (CONTROL_COMPONENTS.has(node.tag) || (skipNestedInteractive && INTERACTIVE_COMPONENTS.has(node.tag)))) return;
		// Native select options are values, not the control's visible label. The
		// parent row/preceding sibling is the only safe label source when a select
		// has no explicit aria-label or label slot.
		if (node.tag === 'option') return;
		if (node.tag === 'template' && node.props.some(prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'slot')) return;
		for (const child of node.children) visit(child);
	};
	for (const node of nodes) visit(node);
	return pieces.join('').replace(/\s+/gu, ' ').trim();
}

function namedSlotTemplate(node: ElementNode, name: string, skipNestedInteractive = false): string {
	const slot = node.children.find(child => child.type === NodeTypes.ELEMENT && hasNamedSlot(child, name));
	if (slot?.type !== NodeTypes.ELEMENT) return '';
	if (!skipNestedInteractive) return textTemplate(slot.children);
	const pieces: string[] = [];
	const visit = (child: TemplateChildNode): void => {
		if (child.type === NodeTypes.TEXT) {
			pieces.push(child.content);
			return;
		}
		if (child.type === NodeTypes.INTERPOLATION) {
			pieces.push(`\${${child.content.content}}`);
			return;
		}
		if (child.type !== NodeTypes.ELEMENT || INTERACTIVE_COMPONENTS.has(child.tag) || child.tag === 'option') return;
		for (const nested of child.children) visit(nested);
	};
	for (const child of slot.children) visit(child);
	return pieces.join('').replace(/\s+/gu, ' ').trim();
}

function markerSearchLabelTemplate(nodes: TemplateChildNode[]): string {
	for (const child of nodes) {
		if (child.type !== NodeTypes.ELEMENT) continue;
		if (child.tag === 'SearchMarker') continue;
		if (child.tag === 'SearchLabel') return textTemplate(child.children);
		const nested = markerSearchLabelTemplate(child.children);
		if (nested) return nested;
	}
	return '';
}

function markerLabelTemplate(node: ElementNode): string {
	const labelAttribute = findAttribute(node.props, 'label');
	if (labelAttribute?.type === NodeTypes.ATTRIBUTE) return labelAttribute.value?.content ?? '';
	if (labelAttribute?.type === NodeTypes.DIRECTIVE && labelAttribute.exp?.content) return `\${${labelAttribute.exp.content}}`;
	return markerSearchLabelTemplate(node.children);
}

function literalPart(value: string): string {
	return value.replace(/\$\{[^}]+\}/gu, '').replace(/\s+/gu, ' ').trim();
}

const I18N_PROPERTY_EXPRESSION = /^i18n\.ts(?:(?:\.[A-Za-z_$][A-Za-z0-9_$]*)|(?:\[['"][^'"\[\]]+['"]\]))*$/u;
const PROPERTY_ACCESS_TAIL = /^(?:(?:\.[A-Za-z_$][A-Za-z0-9_$]*)|(?:\[['"][^'"\[\]]+['"]\]))*$/u;

function canonicalI18nExpression(expression: string, aliases: ReadonlyMap<string, string>): string | null {
	if (I18N_PROPERTY_EXPRESSION.test(expression)) return expression;
	// Most aliases are local identifiers (`copy.foo`).  A small number of
	// shared settings surfaces intentionally receive an editor object as a prop
	// (`editor.copy.foo`).  Resolve the longest audited prefix first; executing
	// the prop would make source indexing depend on runtime state.
	for (const [alias, target] of [...aliases.entries()].sort(([left], [right]) => right.length - left.length)) {
		if (expression !== alias && !expression.startsWith(`${alias}.`)) continue;
		const suffix = expression.slice(alias.length);
		if (PROPERTY_ACCESS_TAIL.test(suffix)) return `${target}${suffix}`;
	}
	const match = expression.match(/^([A-Za-z_$][A-Za-z0-9_$]*)(.*)$/u);
	if (match == null || !PROPERTY_ACCESS_TAIL.test(match[2])) return null;
	const target = aliases.get(match[1]);
	return target == null ? null : `${target}${match[2]}`;
}

/**
 * Source-owned props which are demonstrably i18n property chains.  This is
 * deliberately not a generic prop evaluator: every entry points at the same
 * static copy object imported by the source's companion composable.
 */
const SOURCE_I18N_PROP_ALIASES_V2: Readonly<Record<string, Readonly<Record<string, string>>>> = {
	'src/components/HatasabaUi2SettingsBody.vue': {
		'editor.copy': 'i18n.ts._hata._hatasabaUi._editWindow',
	},
};

/** Accept only one-line `const alias = property.chain` declarations in script setup. */
function staticI18nAliases(sourceFile: string, scriptSetup: string | undefined): Map<string, string> {
	const aliases = new Map(Object.entries(SOURCE_I18N_PROP_ALIASES_V2[sourceFile] ?? {}));
	if (scriptSetup == null) return aliases;
	const declarations = /^\s*const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([^;\n]+);?\s*$/gmu;
	for (const match of scriptSetup.matchAll(declarations)) {
		const resolved = canonicalI18nExpression(match[2].trim(), aliases);
		if (resolved != null) aliases.set(match[1], resolved);
	}
	return aliases;
}

function canonicalizeTemplate(template: string, aliases: ReadonlyMap<string, string>): string {
	return template.replace(/\$\{([^}]+)\}/gu, (_whole, expression: string) => {
		const canonical = canonicalI18nExpression(expression.trim(), aliases);
		return canonical == null ? `\${${expression}}` : `\${${canonical}}`;
	});
}

/** A source-owned conditional label has two audited, translated variants.
 * Retain both without evaluating the selected theme or trusting arbitrary
 * computed strings as settings-search copy. */
function sourceControlLabelTemplateV2(sourceFile: string, node: ElementNode, template: string): string {
	if (sourceFile === 'src/pages/HataskSettings.vue'
		&& normalizedExpression(eventHandlerExpression(node, 'click')) === "toggle('autoTheme')"
		&& template === '${autoAppearanceLabel}') {
		return '${i18n.ts._hata._hatask._settings.autoAppearanceTheme} / ${i18n.ts._hata._hatask._settings.autoAppearance}';
	}
	if (sourceFile === 'src/components/MkNoteCharmSettings.vue') {
		if (normalizedExpression(eventHandlerExpression(node, 'click')) === 'chooseImage'
			&& template === '${draft.fileId ? i18n.ts._noteCharm.replaceImage : i18n.ts._noteCharm.chooseImage}') {
			return '${i18n.ts._noteCharm.chooseImage} / ${i18n.ts._noteCharm.replaceImage}';
		}
		if (directiveExpression(node, 'model') === 'draft.size'
			&& template === '${i18n.ts._noteCharm.width}${draft.size} px') {
			return '${i18n.ts._noteCharm.width}';
		}
	}
	return template;
}

function safeI18nKeys(template: string): string[] | null {
	const expressions = [...template.matchAll(/\$\{([^}]+)\}/gu)].map(([, expression]) => expression.trim());
	if (!expressions.every(expression => I18N_PROPERTY_EXPRESSION.test(expression))) return null;
	return [...new Set(expressions)];
}

function shortStableHash(value: string): string {
	let hash = 2166136261;
	for (const char of value) {
		hash ^= char.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

function slug(value: string): string {
	const result = value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/(^-|-$)/gu, '');
	return result || 'control';
}

function semanticTemplateIdentity(template: string): string {
	const i18nKeys = safeI18nKeys(template);
	if (i18nKeys == null) return 'unsafe';
	// Do not make a display-copy edit churn IDs. Literal labels still establish
	// a group boundary through their enclosing structure; duplicate semantics
	// must use an explicit data-settings-search-key instead of an ordinal.
	return i18nKeys.length === 0 ? 'literal' : `i18n:${i18nKeys.join(',')}`;
}

function activationIdentity(activation: SettingsControlActivationV2 | undefined): string {
	if (activation == null) return 'direct';
	return activation.kind === 'popup'
		? `popup:${activation.category}:${activation.popup}`
		: `category:${activation.category}`;
}

function explicitStableKey(node: ElementNode): string | undefined {
	const attribute = findAttribute(node.props, 'data-settings-search-key');
	if (attribute == null) return undefined;
	if (attribute.type !== NodeTypes.ATTRIBUTE || attribute.value == null || !/^[A-Za-z0-9._:-]+$/u.test(attribute.value.content)) {
		throw new Error(`settings V2 data-settings-search-key must be a static semantic key at line ${node.loc.start.line}`);
	}
	return attribute.value.content;
}

function explicitDestructive(node: ElementNode): boolean {
	const attribute = findAttribute(node.props, 'data-settings-search-destructive');
	if (attribute == null) return false;
	const enabled = attribute.type === NodeTypes.ATTRIBUTE
		? attribute.value?.content === 'true'
		: attribute.exp?.content.trim() === 'true';
	if (!enabled) throw new Error(`settings V2 data-settings-search-destructive must be explicitly true at line ${node.loc.start.line}`);
	return true;
}

function normalizeSettingsControlSearchTargetV2(target: string | SettingsControlSearchTargetV2): SettingsControlSearchTargetV2 {
	return typeof target === 'string' ? { filePath: target } : target;
}

function targetForSourceFileV2(sourceFile: string, targets: readonly SettingsControlSearchTargetV2[]): SettingsControlSearchTargetV2 | undefined {
	const matches = targets.filter(target => minimatch(sourceFile, target.filePath));
	const exactMatches = matches.filter(target => normalizePath(target.filePath) === sourceFile);
	if (exactMatches.length > 1) throw new Error(`settings V2 ambiguous exact target metadata for ${sourceFile}`);
	if (exactMatches.length === 1) return exactMatches[0];
	if (matches.length > 1) throw new Error(`settings V2 ambiguous target metadata for ${sourceFile}`);
	return matches[0];
}

/** Matches the legacy plugin's generated marker id without making V2 IDs line based. */
function legacyGeneratedMarkerId(file: string, line: number): string {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	const key = `${file}:${line}`;
	for (let i = 0; i < key.length; i++) {
		const char = key.charCodeAt(i);
		h1 = Math.imul(h1 ^ char, 2654435761);
		h2 = Math.imul(h2 ^ char, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	const value = 4294967296 * (2097151 & h2) + (h1 >>> 0);
	const digits = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
	let result = '';
	let remaining = value;
	do {
		result = digits[remaining % 62] + result;
		remaining = Math.floor(remaining / 62);
	} while (remaining > 0);
	return result;
}

export function readSettingsRoutesV2(routerSource: string): Map<string, string> {
	const routes = new Map<string, string>();
	// Keep the path and its settings import in the same route object.  The old
	// bounded-dot matcher could skip over the `/settings` parent object and pair
	// the preceding unrelated dynamic route with the first settings component.
	// In particular it made profile.vue resolve to `/instance-info/:host`.
	const expression = /path:\s*'([^']+)'(?:(?!\bpath\s*:)[\s\S]){0,500}?component:\s*page\(\(\)\s*=>\s*import\('@\/pages\/settings\/([^']+)\.vue'\)\)/gu;
	for (const match of routerSource.matchAll(expression)) {
		routes.set(match[2], `/settings${match[1]}`);
	}
	return routes;
}

function routeForFile(file: string, routes: Map<string, string>, target: SettingsControlSearchTargetMetadataV2): string | undefined {
	if (target.routeOverride != null) return target.routeOverride;
	const base = path.basename(file, '.vue');
	if (routes.has(base)) return routes.get(base);
	const dottedParent = base.split('.')[0];
	if (routes.has(dottedParent)) return routes.get(dottedParent);
	const knownEmbeddedParents: Record<string, string> = {
		'2fa': 'security',
		'2fa.qrdialog': 'security',
		'avatar-decoration.decoration': 'avatar-decoration',
		'avatar-decoration.dialog': 'avatar-decoration',
		'drive.WatermarkItem': 'drive',
		'emoji-palette.palette': 'emoji-palette',
		'hidden-reactions-manage': 'hidden-reactions',
		'migration': 'other',
		'mute-block.emoji-mute': 'mute-block',
		'mute-block.instance-mute': 'mute-block',
		'mute-block.word-mute': 'mute-block',
		'notifications.notification-config': 'notifications',
		'sounds.sound': 'sounds',
		'statusbar.statusbar': 'statusbar',
	};
	const parent = knownEmbeddedParents[base];
	return parent == null ? undefined : routes.get(parent);
}

// This screen is informational and requires a runtime host parameter.  It is
// deliberately kept in the raw inventory with a reason, but cannot create a
// stable, reloadable settings-search target.
const EXCLUDED_DYNAMIC_SETTINGS_ROUTE_REASONS: Readonly<Record<string, string>> = {
	'/settings/instance-info/:host': 'インスタンス情報は動的hostを必要とする情報画面で、設定検索から固定URLへ到達できない',
	'/settings/webhook/edit/:webhookId': 'Webhook編集は動的webhookIdを必要とし、検索から固定URLへ到達できない',
};

function excludedDynamicSettingsRouteReason(route: string | undefined): string | undefined {
	return route == null ? undefined : EXCLUDED_DYNAMIC_SETTINGS_ROUTE_REASONS[route];
}

function markerIdFor(node: ElementNode, sourceFile: string): string {
	const explicit = expressionOf(findAttribute(node.props, 'markerId'));
	return explicit ?? legacyGeneratedMarkerId(sourceFile, node.loc.start.line);
}

function hataCustomConditionActivation(sourceFile: string, conditions: readonly string[]): SettingsControlActivationV2 | undefined {
	if (sourceFile !== 'src/pages/settings/hata-custom.vue') return undefined;
	for (const condition of [...conditions].reverse()) {
		const category = /activeCat\s*===\s*['"](general|font|glassUi|visual|hatask|hatady|mascot|earthquake|accessibility)['"]/u.exec(condition)?.[1] as HataCustomCategoryV2 | undefined;
		if (category != null) return { kind: 'hata-custom-category', category };
	}
	return undefined;
}

/**
 * Source-aware metadata derivation.  `all` is an affirmative applicability
 * claim for shared controls; it is never used as a placeholder for an unknown
 * UI condition.
 */
function ownerForSettingsControlV2(
	sourceFile: string,
	route: string | undefined,
	target: SettingsControlSearchTargetMetadataV2,
): SettingsOwnerV2 {
	if (target.owner != null) return target.owner;
	if (route === '/settings/cherrypick') return 'cherrypick';
	if (route === '/settings/hata-custom'
		|| sourceFile.includes('HatasabaUi2')
		|| sourceFile.includes('HataSettings')
		|| sourceFile.endsWith('/HataskSettings.vue')
		|| sourceFile.endsWith('/HatadyDisplaySettings.vue')
		|| sourceFile.endsWith('/MkMascotSettings.vue')
		|| sourceFile.endsWith('/MkEarthquakeSettings.vue')
		|| sourceFile.endsWith('/MkUISetup.vue')) return 'hatasaba';
	return 'core';
}

function applicableUiForSettingsControlV2(
	sourceFile: string,
	route: string | undefined,
	conditions: readonly string[],
	target: SettingsControlSearchTargetMetadataV2,
): SettingsApplicableUiV2 {
	if (target.applicableUi != null) return target.applicableUi;
	if (sourceFile === 'src/components/HatasabaUi2SettingsBody.vue'
		|| sourceFile === 'src/components/HatasabaUi2ImmediateSettings.vue') return 'simple';
	if (route === '/settings/deck' || sourceFile.endsWith('/settings/deck.vue')) return 'deck';
	if (sourceFile === 'src/pages/settings/hata-custom.vue') {
		const conditionText = conditions.join(' ');
		if (/\b(?:isHatasabaDeck|isDeckLike)\b/u.test(conditionText)) return ['deck', 'simple-deck'];
		if (/\bisLegacyDeckUi\b/u.test(conditionText)) return 'deck';
		if (/\b(?:isHatasabaUi|isSimpleUi)\b|currentUi\s*===\s*['"]simple/u.test(conditionText)) return 'simple';
	}
	return 'all';
}

type SettingsDerivedMetadataV2 = Pick<SettingsControlSearchDescriptorV2,
	'persistence' | 'saveMode' | 'availability' | 'owner' | 'applicableUi' | 'storageRefs' | 'metadataEvidence'>;

const ACCOUNT_SETTINGS_ROUTES_V2 = new Set([
	'/settings/profile',
	'/settings/privacy',
	'/settings/email',
	'/settings/security',
	'/settings/external-account',
]);

// These popup editors hold a temporary value locally only until the parent
// confirms it through an account update. They do not import `prefer`, so their
// canonical storage is stated here rather than inferred from a variable name.
const EXPLICIT_ACCOUNT_PERSISTENCE_SOURCES_V2 = new Set([
	'src/pages/settings/avatar-decoration.dialog.vue',
	'src/pages/settings/mute-block.word-mute.vue',
	'src/pages/settings/notifications.notification-config.vue',
]);

const EXPLICIT_DEVICE_PERSISTENCE_SOURCES_V2 = new Set([
	'src/pages/settings/plugin.install.vue',
	'src/pages/settings/theme.install.vue',
]);

function excludedControlMetadataV2(
	sourceFile: string,
	route: string | undefined,
	target: SettingsControlSearchTargetMetadataV2,
	conditions: readonly string[],
): SettingsDerivedMetadataV2 {
	const persistence = target.persistence
		?? (route != null && ACCOUNT_SETTINGS_ROUTES_V2.has(route) ? 'account' : 'profile');
	const owner = ownerForSettingsControlV2(sourceFile, route, target);
	const applicableUi = applicableUiForSettingsControlV2(sourceFile, route, conditions, target);
	return {
		persistence,
		saveMode: target.saveMode ?? 'immediate',
		availability: target.availability ?? 'all',
		owner,
		applicableUi,
		metadataEvidence: {
			persistence: '非検索の実行時行または表示専用操作。検索可能な静的group/controlの保存根拠を参照',
			saveMode: '非検索操作のため保存モードは検索結果に公開しない',
			availability: '非検索操作のため端末幅限定を公開しない',
			owner: `source: ${sourceFile}`,
			applicableUi: `source/条件: ${sourceFile}${conditions.length ? ` (${conditions.join(' / ')})` : ''}`,
		},
	};
}

function localStorageRefsForSourceV2(
	sourceFile: string,
	modelExpression: string | undefined,
	bindings: ReadonlyMap<string, SettingsStorageRefV2[]>,
): SettingsStorageRefV2[] {
	// Local refs must match the exact v-model expression.  Unlike preference
	// models, a same-named sibling ref may be a legacy migration value
	// (`fontSizeBefore` alongside preference `fontSize`), so collapsing to the
	// root would invent a mixed persistence classification.
	const literalBinding = bindings.get(modelExpression ?? '');
	if (literalBinding != null) return [...literalBinding];
	if (sourceFile === 'src/pages/settings/custom-css.vue') return [{ kind: 'local', key: 'customCss' }];
	if (sourceFile === 'src/components/MkUISetup.vue') return [{ kind: 'local', key: 'ui' }];
	if (sourceFile === 'src/components/HatasabaUi2ImmediateSettings.vue') {
		if (modelExpression === 'foldableLayout') return [{ kind: 'local', key: 'hataFoldableLayout' }];
	}
	if (sourceFile === 'src/components/HatasabaUi2SettingsBody.vue') {
		return (UI2_DRAFT_DEVICE_KEYS[modelExpression ?? ''] ?? []).map(key => ({ kind: 'local' as const, key }));
	}
	if (sourceFile === 'src/components/MkEarthquakeSettings.vue') {
		if (modelExpression === 'prefModel') return [{ kind: 'local', key: 'hataEarthquakePref' }];
		if (modelExpression === 'pollModel') return [{ kind: 'local', key: 'hataEarthquakePollSec' }];
	}
	if (sourceFile === 'src/components/HatadyDisplaySettings.vue') return [{ kind: 'local', key: 'hatadyTheme' }];
	return [];
}

type ExplicitControlStorageBindingV2 = {
	refs: readonly SettingsStorageRefV2[];
	evidence: string;
};

/**
 * Some controls look like an editable form model but intentionally only pick
 * a runtime object for viewing, copying, or an adjacent destructive action.
 * They are not settings values, so they must be excluded explicitly instead
 * of receiving a made-up persistence scope.
 */
const NON_PERSISTENT_FORM_CONTROL_EXCLUSIONS_V2: Readonly<Record<string, Readonly<Record<string, string>>>> = {
	'src/components/concrnt/ConcrntSettings.vue': {
		domainDraft: 'Concrnt連携ウィザードの接続先候補。検索からドメイン確認や認証を開始しない',
		secretDraft: 'Concrnt認証専用の一時サブキー入力。秘密情報は検索項目・検索語へ含めない',
		saveDraft: 'Concrnt連携の確定前だけ保持する保存方法の下書き。連携後の保存方法設定を検索対象にする',
	},
	'src/pages/settings/external-account.vue': {
		selectedHost: 'MiAuth認証を始める前の接続先候補。検索から認証フローを開始しない',
	},
	'src/pages/settings/2fa.qrdialog.vue': {
		token: '二段階認証登録の一時確認コードであり、保存済み設定値ではない。検索から認証フローを開始しない',
	},
	'src/pages/settings/theme.manage.vue': {
		selectedThemeId: 'インストール済みテーマを閲覧・削除対象として選ぶ一時状態で、選択自体は保存しない',
	},
};

/**
 * Controls whose persistence is intentionally hidden behind a computed setter,
 * a child emit, or a request payload need a finite source/model proof.  This
 * is not a route default: every entry names the real existing write endpoint
 * or the exact local/profile key used by that control.
 */
const EXPLICIT_CONTROL_STORAGE_BINDINGS_V2: Readonly<Record<string, Readonly<Record<string, ExplicitControlStorageBindingV2>>>> = {
	'src/components/MkNoteCharmSettings.vue': {
		'model:draft.enabled': noteCharmAccountStorageBindingV2(),
		'model:draft.size': noteCharmAccountStorageBindingV2(),
		'model:draft.color': noteCharmAccountStorageBindingV2(),
		'click:chooseImage': noteCharmAccountStorageBindingV2(),
		'click:removeImage': noteCharmAccountStorageBindingV2(),
		'click:save': noteCharmAccountStorageBindingV2(),
		'model:noteCharmDisplay.show': { refs: [{ kind: 'local', key: 'noteCharmDisplay' }], evidence: 'setNoteCharmDisplay({ show }) は端末の noteCharmDisplay を即時更新する' },
		'model:noteCharmDisplay.showOthers': { refs: [{ kind: 'local', key: 'noteCharmDisplay' }], evidence: 'setNoteCharmDisplay({ showOthers }) は端末の noteCharmDisplay を即時更新する' },
		'model:noteCharmDisplay.motion': { refs: [{ kind: 'local', key: 'noteCharmDisplay' }], evidence: 'setNoteCharmDisplay({ motion }) は端末の noteCharmDisplay を即時更新する' },
		'model:noteCharmDisplay.wind': { refs: [{ kind: 'local', key: 'noteCharmDisplay' }], evidence: 'setNoteCharmDisplay({ wind }) は端末の noteCharmDisplay を即時更新する' },
	},
	'src/components/concrnt/ConcrntSettings.vue': {
		"change:updateBoolean('enabled',$event)": concrntSettingsStorageBindingV2('enabled'),
		"change:updateBoolean('notifications',$event)": concrntSettingsStorageBindingV2('notifications'),
		"change:updateBoolean('popups',$event)": concrntSettingsStorageBindingV2('popups'),
		"change:updateSave('device',$event)": concrntSettingsStorageBindingV2('save'),
		"change:updateSave('session',$event)": concrntSettingsStorageBindingV2('save'),
		'change:updateProfile': concrntSettingsStorageBindingV2('profile'),
	},
	'src/pages/settings/external-account.vue': {
		'change:onEnabledChange': { refs: [{ kind: 'pref', key: 'external.enabled' }], evidence: 'onEnabledChange() → onToggleEnabled() → externalEnabled は prefer.model(external.enabled) を更新する' },
		"change:onTimelineChange('external.enableOHTL',$event)": { refs: [{ kind: 'pref', key: 'external.enableOHTL' }], evidence: 'onTimelineChange() は引数の external.enableOHTL を prefer.commit で更新する' },
		"change:onTimelineChange('external.enableOLTL',$event)": { refs: [{ kind: 'pref', key: 'external.enableOLTL' }], evidence: 'onTimelineChange() は引数の external.enableOLTL を prefer.commit で更新する' },
		'change:onNotificationChange': { refs: [{ kind: 'pref', key: 'external.disableNotificationToast' }], evidence: 'onNotificationChange() は external.disableNotificationToast を prefer.commit で更新する' },
	},
	'src/components/HataFeedDisplaySettings.vue': {
		'click:choose(theme.value)': { refs: [{ kind: 'local', key: 'hatafeedTheme' }], evidence: 'choose() は setHataFeedTheme を通じて端末の hatafeedTheme を即時更新する' },
	},
	'src/components/HatadyDisplaySettings.vue': {
		// The carousel keeps the same buffered theme value as the former inline
		// editTheme assignment. Index its option row once; arrows remain alternate
		// carousel affordances represented by the static display-settings group.
		'click:choose(opt.value)': { refs: [{ kind: 'registry', scope: ['client', 'hatady'], key: 'display' }], evidence: 'choose() は editTheme を編集し、save() が saveHatadyDisplay で client/hatady:display へ明示保存する' },
	},
	'src/pages/settings/index.vue': {
		'click:enableAutoBackup': {
			refs: [{ kind: 'pizzax', store: 'base', key: 'enablePreferencesAutoCloudBackup', scope: 'device' }],
			evidence: 'enableAutoBackup() は既存のpreferences utilityを通じ、端末別Pizzax値 enablePreferencesAutoCloudBackup をtrueへ保存する',
		},
	},
	'src/pages/settings/avatar-decoration.dialog.vue': {
		'model:angle': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['avatarDecorations'] }], evidence: '親のattach/update emit は avatarDecorations を i/update へ保存する' },
		'model:offsetX': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['avatarDecorations'] }], evidence: '親のattach/update emit は avatarDecorations を i/update へ保存する' },
		'model:offsetY': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['avatarDecorations'] }], evidence: '親のattach/update emit は avatarDecorations を i/update へ保存する' },
		'model:scale': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['avatarDecorations'] }], evidence: '親のattach/update emit は avatarDecorations を i/update へ保存する' },
		'model:opacity': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['avatarDecorations'] }], evidence: '親のattach/update emit は avatarDecorations を i/update へ保存する' },
		'model:flipH': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['avatarDecorations'] }], evidence: '親のattach/update emit は avatarDecorations を i/update へ保存する' },
	},
	'src/pages/settings/2fa.vue': {
		'model:usePasswordLessLogin': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['usePasswordLessLogin'] }], evidence: 'updatePasswordLessLogin() は現在アカウントのパスワードレス設定を更新する' },
	},
	'src/pages/settings/account-data.vue': {
		'model:excludeMutingUsers': { refs: [{ kind: 'api', endpoint: 'export-following', fields: ['excludeMuting'] }], evidence: 'exportFollowing() の書き出し要求へ excludeMuting を渡す一時選択' },
		'model:excludeInactiveUsers': { refs: [{ kind: 'api', endpoint: 'export-following', fields: ['excludeInactive'] }], evidence: 'exportFollowing() の書き出し要求へ excludeInactive を渡す一時選択' },
	},
	'src/pages/settings/drive-cleaner.vue': {
		'model:sortModeSelect': { refs: [{ kind: 'api', endpoint: 'drive/files', fields: ['sort'] }], evidence: 'sortModeSelect の watcher は drive/files 一覧要求の sort を更新する' },
	},
	'src/pages/settings/drive.vue': {
		'model:alwaysMarkNsfw': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['alwaysMarkNsfw'] }], evidence: 'saveProfile() は alwaysMarkNsfw を i/update へ保存する' },
		'model:autoSensitive': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['autoSensitive'] }], evidence: 'saveProfile() は autoSensitive を i/update へ保存する' },
	},
	'src/pages/settings/hata-custom.vue': {
		'model:hideMutedReactions': { refs: [{ kind: 'local', key: 'hataHideMutedReactions' }], evidence: 'setHideMutedReactionsLocal() はこの端末の hataHideMutedReactions を更新する' },
		'model:foldableLayout': { refs: [{ kind: 'local', key: 'hataFoldableLayout' }], evidence: 'setFoldableLayoutMode() はこの端末の hataFoldableLayout を更新する' },
		'model:classicNoteSpacingDisplay': { refs: [{ kind: 'pref', key: 'simpleUi.classicNoteSpacing' }], evidence: 'classicNoteSpacingDisplay の setter は simpleUi.classicNoteSpacing を更新する' },
		'click:addBotAllowlistUser': { refs: [{ kind: 'pref', key: 'simpleUi.botAllowlist' }], evidence: 'addBotAllowlistUser() は simpleUi.botAllowlist を更新する' },
		'click:onFontChange(preset.id)': { refs: [{ kind: 'pref', key: 'hataFont.id' }], evidence: 'onFontChange() は hataFont.id を更新する' },
		"click:onFontChange('system')": { refs: [{ kind: 'pref', key: 'hataFont.id' }], evidence: 'onFontChange() は hataFont.id を更新する' },
		'click:resetToDefault': { refs: [{ kind: 'pref', key: 'hataFont.id' }, { kind: 'pref', key: 'hataFont.customUrl' }, { kind: 'pref', key: 'hataFont.customName' }], evidence: 'resetToDefault() はカスタムフォントの profile 値を初期化する' },
	},
	'src/pages/settings/migration.vue': {
		'model:moveToAccount': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['movedTo'] }], evidence: 'move() は移行先を現在アカウントの i/update 経路へ保存する' },
	},
	'src/pages/settings/mute-block.instance-mute.vue': {
		'model:instanceMutes': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['mutedInstances'] }], evidence: 'save() は mutedInstances を i/update へ保存する' },
	},
	'src/pages/settings/mute-block.word-mute.vue': {
		'model:mutedWords': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['mutedWords'] }], evidence: '親の saveMutedWords() は emit 値を i/update の mutedWords へ保存する' },
	},
	'src/pages/settings/notifications.notification-config.vue': {
		'model:type': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['notificationRecieveConfig'] }], evidence: '親の updateReceiveConfig() は type を notificationRecieveConfig として i/update へ保存する' },
		'model:userListId': { refs: [{ kind: 'api', endpoint: 'i/update', fields: ['notificationRecieveConfig'] }], evidence: '親の updateReceiveConfig() は userListId を notificationRecieveConfig として i/update へ保存する' },
	},
	'src/pages/settings/notifications.vue': {
		'model:sendReadMessage': { refs: [{ kind: 'api', endpoint: 'sw/update-registration', fields: ['sendReadMessage'] }], evidence: 'onChangeSendReadMessage() は端末の push registration を更新する' },
	},
	'src/components/MkPushNotificationAllowButton.vue': {
		'click:subscribe': { refs: [{ kind: 'api', endpoint: 'sw/register' }], evidence: 'subscribe() は既存のPushManager許可後に現在アカウントの sw/register を登録する' },
		'click:unsubscribe': { refs: [{ kind: 'api', endpoint: 'sw/unregister' }], evidence: 'unsubscribe() は現在端末のPush subscriptionを解除し、現在アカウントの sw/unregister を実行する' },
	},
	'src/pages/settings/other.vue': {
		'click:deleteAccount': { refs: [{ kind: 'api', endpoint: 'i/delete-account' }], evidence: 'deleteAccount() は既存のアカウント削除APIを確認後に実行する' },
	},
	'src/pages/settings/plugin.install.vue': {
		'model:code': { refs: [{ kind: 'pref', key: 'plugins' }], evidence: 'installPlugin() は解析済みコードを prefer.commit(plugins) で profile 設定へ保存する' },
	},
	'src/pages/settings/preferences.vue': {
		'model:deviceHorizontalSwipe': { refs: [{ kind: 'local', key: 'hatasabaTabSwipeEnabled' }], evidence: 'usesDeviceHorizontalSwipe 分岐の useHorizontalSwipeModel() setter は setTabSwipeEnabled() を通じ、miLocalStorage の hatasabaTabSwipeEnabled を即時更新する' },
		'click:enableAll': { refs: [{ kind: 'pref', key: 'reactionPickerSize' }], evidence: 'enableAll() は既存のリアクションpicker preference群を一括変更する' },
		'click:disableAll': { refs: [{ kind: 'pref', key: 'reactionPickerSize' }], evidence: 'disableAll() は既存のリアクションpicker preference群を一括変更する' },
		'click:enableAllDataSaver': { refs: [{ kind: 'pref', key: 'dataSaver' }], evidence: 'enableAllDataSaver() は dataSaver の全項目を profile preference として保存する' },
		'click:disableAllDataSaver': { refs: [{ kind: 'pref', key: 'dataSaver' }], evidence: 'disableAllDataSaver() は dataSaver の全項目を profile preference として保存する' },
		'model:dataSaver.media': { refs: [{ kind: 'pref', key: 'dataSaver' }], evidence: 'dataSaver watcher は media を含む dataSaver を prefer.commit で保存する' },
		'model:dataSaver.avatar': { refs: [{ kind: 'pref', key: 'dataSaver' }], evidence: 'dataSaver watcher は avatar を含む dataSaver を prefer.commit で保存する' },
		'model:dataSaver.disableUrlPreview': { refs: [{ kind: 'pref', key: 'dataSaver' }], evidence: 'dataSaver watcher は disableUrlPreview を含む dataSaver を prefer.commit で保存する' },
		'model:dataSaver.urlPreviewThumbnail': { refs: [{ kind: 'pref', key: 'dataSaver' }], evidence: 'dataSaver watcher は urlPreviewThumbnail を含む dataSaver を prefer.commit で保存する' },
		'model:dataSaver.code': { refs: [{ kind: 'pref', key: 'dataSaver' }], evidence: 'dataSaver watcher は code を含む dataSaver を prefer.commit で保存する' },
	},
	'src/pages/settings/sounds.sound.vue': {
		'model:type': { refs: [{ kind: 'pref', key: 'sound.on.*' }], evidence: '親Soundsの update() は選択した sound.on.* profile 値を保存する' },
		'model:volume': { refs: [{ kind: 'pref', key: 'sound.on.*' }], evidence: '親Soundsの update() は選択した sound.on.* profile 値を保存する' },
		'click:selectSound': { refs: [{ kind: 'pref', key: 'sound.on.*' }], evidence: 'selectSound() 後の emit は親Soundsの sound.on.* 保存へ渡る' },
	},
	'src/pages/settings/sounds.vue': {
		'click:reset': { refs: [{ kind: 'pref', key: 'sound.on.*' }], evidence: 'reset() は各 sound.on.* profile 値を既定値へ戻す' },
	},
	'src/pages/settings/theme.vue': {
		'model:lightThemeId': { refs: [{ kind: 'pref', key: 'lightTheme' }], evidence: 'lightThemeId の setter は prefer.commit(lightTheme) を実行する' },
		'model:darkThemeId': { refs: [{ kind: 'pref', key: 'darkTheme' }], evidence: 'darkThemeId の setter は prefer.commit(darkTheme) を実行する' },
	},
	'src/pages/settings/theme.install.vue': {
		'model:installThemeCode': { refs: [{ kind: 'pref', key: 'themes' }], evidence: 'installTheme() は addTheme() を通じて themes を prefer.commit で保存する' },
	},
	'src/pages/settings/webhook.edit.vue': {
		'model:name': { refs: [{ kind: 'api', endpoint: 'i/webhooks/update', fields: ['name'] }], evidence: 'save() は webhook name を i/webhooks/update へ保存する' },
		'model:url': { refs: [{ kind: 'api', endpoint: 'i/webhooks/update', fields: ['url'] }], evidence: 'save() は webhook url を i/webhooks/update へ保存する' },
		'model:secret': { refs: [{ kind: 'api', endpoint: 'i/webhooks/update', fields: ['secret'] }], evidence: 'save() は webhook secret を i/webhooks/update へ保存する' },
		'model:event_follow': { refs: [{ kind: 'api', endpoint: 'i/webhooks/update', fields: ['on'] }], evidence: 'save() は webhook event list を i/webhooks/update へ保存する' },
		'model:event_followed': { refs: [{ kind: 'api', endpoint: 'i/webhooks/update', fields: ['on'] }], evidence: 'save() は webhook event list を i/webhooks/update へ保存する' },
		'model:event_note': { refs: [{ kind: 'api', endpoint: 'i/webhooks/update', fields: ['on'] }], evidence: 'save() は webhook event list を i/webhooks/update へ保存する' },
		'model:event_reply': { refs: [{ kind: 'api', endpoint: 'i/webhooks/update', fields: ['on'] }], evidence: 'save() は webhook event list を i/webhooks/update へ保存する' },
		'model:event_renote': { refs: [{ kind: 'api', endpoint: 'i/webhooks/update', fields: ['on'] }], evidence: 'save() は webhook event list を i/webhooks/update へ保存する' },
		'model:event_mention': { refs: [{ kind: 'api', endpoint: 'i/webhooks/update', fields: ['on'] }], evidence: 'save() は webhook event list を i/webhooks/update へ保存する' },
		'model:active': { refs: [{ kind: 'api', endpoint: 'i/webhooks/update', fields: ['active'] }], evidence: 'save() は webhook active を i/webhooks/update へ保存する' },
	},
	'src/pages/settings/webhook.new.vue': {
		'model:name': { refs: [{ kind: 'api', endpoint: 'i/webhooks/create', fields: ['name'] }], evidence: 'create() は name を i/webhooks/create へ保存する' },
		'model:url': { refs: [{ kind: 'api', endpoint: 'i/webhooks/create', fields: ['url'] }], evidence: 'create() は url を i/webhooks/create へ保存する' },
		'model:secret': { refs: [{ kind: 'api', endpoint: 'i/webhooks/create', fields: ['secret'] }], evidence: 'create() は secret を i/webhooks/create へ保存する' },
		'model:event_follow': { refs: [{ kind: 'api', endpoint: 'i/webhooks/create', fields: ['on'] }], evidence: 'create() は選んだ event_follow を on として i/webhooks/create へ保存する' },
		'model:event_followed': { refs: [{ kind: 'api', endpoint: 'i/webhooks/create', fields: ['on'] }], evidence: 'create() は選んだ event_followed を on として i/webhooks/create へ保存する' },
		'model:event_note': { refs: [{ kind: 'api', endpoint: 'i/webhooks/create', fields: ['on'] }], evidence: 'create() は選んだ event_note を on として i/webhooks/create へ保存する' },
		'model:event_reply': { refs: [{ kind: 'api', endpoint: 'i/webhooks/create', fields: ['on'] }], evidence: 'create() は選んだ event_reply を on として i/webhooks/create へ保存する' },
		'model:event_renote': { refs: [{ kind: 'api', endpoint: 'i/webhooks/create', fields: ['on'] }], evidence: 'create() は選んだ event_renote を on として i/webhooks/create へ保存する' },
		'model:event_mention': { refs: [{ kind: 'api', endpoint: 'i/webhooks/create', fields: ['on'] }], evidence: 'create() は選んだ event_mention を on として i/webhooks/create へ保存する' },
	},
};

function explicitControlStorageBindingV2(
	sourceFile: string,
	modelExpression: string | undefined,
	node: ElementNode,
): ExplicitControlStorageBindingV2 | undefined {
	const sourceBindings = EXPLICIT_CONTROL_STORAGE_BINDINGS_V2[sourceFile];
	if (sourceBindings == null) return undefined;
	const click = normalizedExpression(eventHandlerExpression(node, 'click'));
	const clickHandler = click == null ? undefined : /^([A-Za-z_$][\w$]*)\b/u.exec(click)?.[1];
	const change = normalizedExpression(eventHandlerExpression(node, 'change'));
	return (modelExpression == null ? undefined : sourceBindings[`model:${modelExpression}`])
		?? (click == null ? undefined : sourceBindings[`click:${click}`])
		?? (clickHandler == null ? undefined : sourceBindings[`click:${clickHandler}`])
		?? (change == null ? undefined : sourceBindings[`change:${change}`]);
}

function noteCharmAccountStorageBindingV2(): ExplicitControlStorageBindingV2 {
	return {
		refs: [{ kind: 'api', endpoint: 'i/update', fields: ['noteCharm'] }],
		evidence: 'draftの画像・有効状態・幅・模様・色はsave()がpayload()をi/update.noteCharmへ明示保存する',
	};
}

function concrntSettingsStorageBindingV2(field: 'enabled' | 'save' | 'profile' | 'notifications' | 'popups'): ExplicitControlStorageBindingV2 {
	return {
		refs: [{ kind: 'indexeddb', database: 'HataskeyConcrnt', store: 'private', key: '${encodeURIComponent(owner)}:connection', fields: [`settings.${field}`] }],
		evidence: `updateConcrntSettings() → ConcrntStorage.saveConnection() が HataskeyConcrnt/private の owner 別 connection レコード内 settings.${field} を更新する。クラウド同期・設定バックアップには含めない`,
	};
}

function nonPersistentFormControlExclusionV2(sourceFile: string, modelExpression: string | undefined): string | undefined {
	return modelExpression == null ? undefined : NON_PERSISTENT_FORM_CONTROL_EXCLUSIONS_V2[sourceFile]?.[modelExpression];
}

function storageRefIdentityV2(ref: SettingsStorageRefV2): string {
	switch (ref.kind) {
		case 'pref': return `pref:${ref.key}`;
		case 'pizzax': return `pizzax:${ref.store}:${ref.scope}:${ref.key}`;
		case 'local': return `local:${ref.key}`;
		case 'indexeddb': return `indexeddb:${ref.database}:${ref.store}:${ref.key}:${ref.fields.join(',')}`;
		case 'registry': return `registry:${ref.scope.join('/')}:${ref.key}`;
		case 'api': return `api:${ref.endpoint}:${(ref.fields ?? []).join(',')}`;
	}
}

function uniqueStorageRefsV2(refs: readonly SettingsStorageRefV2[]): SettingsStorageRefV2[] {
	const seen = new Set<string>();
	return refs.filter(ref => {
		const identity = storageRefIdentityV2(ref);
		if (seen.has(identity)) return false;
		seen.add(identity);
		return true;
	});
}

function registryRefsForSourceV2(sourceFile: string): SettingsStorageRefV2[] {
	if (sourceFile === 'src/pages/HataskSettings.vue') return [{ kind: 'registry', scope: ['client', 'hatask'], key: 'settings' }];
	if (sourceFile === 'src/components/HatadyDisplaySettings.vue') return [{ kind: 'registry', scope: ['client', 'hatady'], key: 'display' }];
	if (sourceFile === 'src/pages/MkMascotSettings.vue') return [{ kind: 'registry', scope: ['client', 'hataMascot'], key: 'displaySettings' }];
	return [];
}

function apiRefsForControlV2(sourceFile: string, route: string | undefined, sourceCode: string, node: ElementNode): SettingsStorageRefV2[] {
	const click = eventHandlerExpression(node, 'click') ?? '';
	const handler = /^([A-Za-z_$][\w$]*)\b/u.exec(normalizedExpression(click) ?? '')?.[1];
	const text = `${click}\n${handler == null ? '' : handlerBodies(sourceCode).get(handler) ?? ''}`;
	const endpoint = /(?:misskeyApi|(?:os\.)?apiWithDialog)\(\s*['"]([^'"]+)['"]/u.exec(text)?.[1];
	if (endpoint != null) return [{ kind: 'api', endpoint }];
	if (sourceFile === 'src/components/MkEarthquakeSettings.vue' && /notif/i.test(`${node.loc.source} ${text}`)) return [{ kind: 'api', endpoint: 'hata/earthquake/notification-settings-update' }];
	if (sourceFile === 'src/pages/MkMascotSettings.vue') return [{ kind: 'api', endpoint: 'hata/mascot/update' }];
	if (route != null && ['/settings/profile', '/settings/privacy', '/settings/email', '/settings/security', '/settings/external-account'].includes(route) && /(?:misskeyApi|(?:os\.)?apiWithDialog)\(/u.test(sourceCode)) return [{ kind: 'api', endpoint: 'i/update' }];
	return [];
}

function deriveSettingsMetadataV2(
	sourceFile: string,
	route: string | undefined,
	target: SettingsControlSearchTargetMetadataV2,
	modelExpression: string | undefined,
	preferenceKeys: readonly string[],
	pizzaxRefs: readonly Extract<SettingsStorageRefV2, { kind: 'pizzax' }>[],
	conditions: readonly string[],
	sourceCode: string,
	node: ElementNode,
	localStorageBindings: ReadonlyMap<string, SettingsStorageRefV2[]>,
): SettingsDerivedMetadataV2 {
	const localRefs = localStorageRefsForSourceV2(sourceFile, modelExpression, localStorageBindings);
	const explicitBinding = explicitControlStorageBindingV2(sourceFile, modelExpression, node);
	const registryRefs = registryRefsForSourceV2(sourceFile);
	// A preference/local model is the storage operation for this exact control.
	// The surrounding page may also contain API calls for an unrelated submit
	// button, so do not turn a source-level API import into a false mixed scope.
	const apiRefs = explicitBinding == null && preferenceKeys.length === 0 && pizzaxRefs.length === 0 && localRefs.length === 0
		? apiRefsForControlV2(sourceFile, route, sourceCode, node)
		: [];
	const storageRefs = uniqueStorageRefsV2([
		...preferenceKeys.map(key => ({ kind: 'pref' as const, key })),
		...pizzaxRefs,
		...localRefs,
		...registryRefs,
		...apiRefs,
		...(explicitBinding?.refs ?? []),
	]);
	const hasProfile = storageRefs.some(ref => ref.kind === 'pref');
	const hasDevice = storageRefs.some(ref => ref.kind === 'local' || ref.kind === 'indexeddb' || (ref.kind === 'pizzax' && ref.scope !== 'account'));
	const hasAccount = storageRefs.some(ref => ref.kind === 'registry' || ref.kind === 'api' || (ref.kind === 'pizzax' && ref.scope === 'account'));
	// Hatady deliberately keeps a device cache for an account-registry source of
	// truth. That is not a mixed user choice, but it must be named explicitly.
	const accountWithDeviceCache = sourceFile === 'src/components/HatadyDisplaySettings.vue' && hasAccount && hasDevice;
	if ((hasProfile && hasDevice) || (hasProfile && hasAccount) || (hasAccount && hasDevice && !accountWithDeviceCache)) {
		throw new Error(`settings V2 mixed persistence requires an explicit semantic split: ${sourceFile}:${node.loc.start.line}`);
	}
	let persistence: SettingsPersistenceV2;
	let persistenceEvidence: string;
	if (hasAccount) {
		persistence = 'account';
		persistenceEvidence = `アカウントAPI/Registry: ${storageRefs.filter(ref => ref.kind === 'api' || ref.kind === 'registry').map(ref => ref.kind === 'api' ? ref.endpoint : `${ref.scope.join('/')}:${ref.key}`).join(', ')}${accountWithDeviceCache ? '（miLocalStorageは初期表示用キャッシュ）' : ''}`;
	} else if (hasDevice) {
		persistence = 'device';
		persistenceEvidence = `端末保存値: ${storageRefs.filter(ref => ref.kind === 'local' || ref.kind === 'indexeddb' || ref.kind === 'pizzax').map(ref => storageRefIdentityV2(ref)).join(', ')}`;
	} else if (hasProfile) {
		persistence = 'profile';
		persistenceEvidence = `prefer設定値: ${preferenceKeys.join(', ')}`;
	} else if (sourceCode.trim() === '') {
		// Unit fixtures deliberately supply only a template.  Production targets
		// are never allowed through this branch because their SFC script is read.
		persistence = target.persistence ?? 'profile';
		persistenceEvidence = 'テンプレート単体fixture。実SFCの保存根拠監査は対象外';
	} else {
		throw new Error(`settings V2 missing persistence evidence: ${sourceFile}:${node.loc.start.line} (${normalizedExpression(eventHandlerExpression(node, 'click')) ?? modelExpression ?? node.tag})`);
	}
	const handlerText = [eventHandlerExpression(node, 'click'), eventHandlerExpression(node, 'update:modelValue'), eventHandlerExpression(node, 'input')].filter(Boolean).join(' ');
	const buffered = (sourceFile === 'src/components/MkNoteCharmSettings.vue' && hasAccount)
		|| sourceFile === 'src/components/HatasabaUi2SettingsBody.vue'
		|| /\b(?:save|saveDisplaySettings|saveSettings|applyHataSettingsTransfer)\b/u.test(handlerText)
		|| (sourceFile === 'src/pages/MkMascotSettings.vue');
	const reload = sourceFile === 'src/components/HatasabaUi2SettingsBody.vue'
		|| sourceFile === 'src/pages/settings/custom-css.vue'
		|| sourceFile === 'src/components/MkUISetup.vue';
	const saveMode: SettingsSaveModeV2 = reload ? 'reload' : buffered ? 'buffered' : target.saveMode ?? 'immediate';
	const availability: SettingsAvailabilityV2 = /\b(?:isMobile|mobileLayout|matchMedia\([^)]*max-width)\b/u.test(conditions.join(' ') || node.loc.source)
		? 'mobile'
		: /\b(?:isDesktop|desktop)\b/u.test(conditions.join(' ') || node.loc.source) ? 'desktop' : target.availability ?? 'all';
	const owner = ownerForSettingsControlV2(sourceFile, route, target);
	const applicableUi = applicableUiForSettingsControlV2(sourceFile, route, conditions, target);
	return {
		persistence,
		saveMode,
		availability,
		owner,
		applicableUi,
		...(storageRefs.length ? { storageRefs } : {}),
		metadataEvidence: {
		persistence: explicitBinding?.evidence ?? persistenceEvidence,
			saveMode: reload ? '既存の保存完了後reloading経路' : buffered ? '既存の下書き/明示保存経路' : '既存のモデル更新経路',
			availability: availability === 'all' ? 'templateに端末幅限定条件なし' : `template条件: ${conditions.join(' / ') || node.loc.source}`,
			owner: `source: ${sourceFile}`,
			applicableUi: `source/条件: ${sourceFile}${conditions.length ? ` (${conditions.join(' / ')})` : ''}`,
		},
	};
}

function applicableUiValuesV2(value: SettingsApplicableUiV2): SettingsApplicableUiValueV2[] {
	return [...new Set(Array.isArray(value) ? value : [value])];
}

function assertApplicableUiMetadataV2(value: SettingsApplicableUiV2, stableId: string): void {
	const values = applicableUiValuesV2(value);
	if (values.length === 0 || values.some(item => item == null || item === '')) {
		throw new Error(`settings V2 applicable UI is empty: ${stableId}`);
	}
	if (values.length > 1 && values.includes('all')) {
		throw new Error(`settings V2 applicable UI mixes all with a condition: ${stableId}`);
	}
}

function withActivationFocus(activation: SettingsControlActivationV2 | undefined, stableId: string): SettingsControlActivationV2 | undefined {
	if (activation == null) return undefined;
	const steps = activation.steps ?? (activation.kind === 'popup'
		? [{ kind: 'category' as const, id: activation.category }, { kind: 'popup' as const, id: activation.popup }]
		: [{ kind: 'category' as const, id: activation.category }]);
	return { ...activation, steps, focus: activation.focus ?? { kind: 'control', id: stableId } };
}

export function collectSettingsControlDescriptorsV2(
	sourceFile: string,
	code: string,
	routes: ReadonlyMap<string, string>,
	target: SettingsControlSearchTargetMetadataV2 = {},
): SettingsControlSearchDescriptorV2[] {
	const parsed = parseTargetSfc(sourceFile, code);
	if (parsed.descriptor.template?.ast == null) return [];
	const route = routeForFile(sourceFile, new Map(routes), target);
	const dynamicRouteExclusionReason = excludedDynamicSettingsRouteReason(route);
	const aliases = staticI18nAliases(sourceFile, parsed.descriptor.scriptSetup?.content);
	const scriptSource = [parsed.descriptor.script?.content, parsed.descriptor.scriptSetup?.content]
		.filter((value): value is string => value != null)
		.join('\n');
	const persistentHandlers = persistentHandlerNames(scriptSource);
	const handlerBodiesByName = handlerBodies(scriptSource);
	const preferenceBindings = preferenceModelBindingsV2(scriptSource);
	const pizzaxBindings = pizzaxModelBindingsV2(scriptSource);
	const localStorageBindings = localStorageModelBindingsV2(scriptSource);
	const descriptors: SettingsControlSearchDescriptorV2[] = [];
	const semanticSources = new Set<string>();
	const walk = (nodes: TemplateChildNode[], context: WalkContext): void => {
		for (const child of nodes) {
			if (child.type !== NodeTypes.ELEMENT) continue;
			const node = child;
			const next: WalkContext = {
				markerId: context.markerId,
				markerLabelTemplate: context.markerLabelTemplate,
				markerLabelPath: context.markerLabelPath,
				markerAncestorIds: context.markerAncestorIds,
				formSectionLabelPath: context.formSectionLabelPath,
				formSlotLabelPath: context.formSlotLabelPath,
				formFolderLabelPath: context.formFolderLabelPath,
				rowLabelTemplate: context.rowLabelTemplate,
				preferenceKeys: context.preferenceKeys,
				conditions: context.conditions,
				hasRuntimeCollection: context.hasRuntimeCollection,
				hasPlaceholderLabelCollection: context.hasPlaceholderLabelCollection,
			};
			if (node.tag === 'SearchMarker') {
				next.markerId = markerIdFor(node, sourceFile);
				next.markerAncestorIds = [...context.markerAncestorIds, next.markerId];
				const displayLabel = canonicalizeTemplate(markerLabelTemplate(node), aliases);
				if (displayLabel) {
					next.markerLabelTemplate = displayLabel;
					next.markerLabelPath = [...context.markerLabelPath, displayLabel];
				}
			}
			if (node.tag === 'FormSection') {
				const groupLabel = canonicalizeTemplate(namedSlotTemplate(node, 'label'), aliases);
				if (groupLabel) next.formSectionLabelPath = [...context.formSectionLabelPath, groupLabel];
			}
			if (node.tag === 'FormSlot') {
				const slotLabel = canonicalizeTemplate(namedSlotTemplate(node, 'label'), aliases);
				if (slotLabel) next.formSlotLabelPath = [...context.formSlotLabelPath, slotLabel];
			}
			if (node.tag === 'MkFolder') {
				const folderLabel = canonicalizeTemplate(namedSlotTemplate(node, 'label'), aliases);
				if (folderLabel) next.formFolderLabelPath = [...context.formFolderLabelPath, folderLabel];
			}
			if (node.tag === 'MkPreferenceContainer') {
				const preferenceKey = expressionOf(findAttribute(node.props, 'k'));
				if (preferenceKey != null) next.preferenceKeys = [...context.preferenceKeys, preferenceKey];
			}
			const forExpression = directiveExpression(node, 'for');
			const condition = directiveExpression(node, 'if') ?? directiveExpression(node, 'else-if') ?? forExpression;
			if (condition != null) next.conditions = [...context.conditions, condition];
			if (forExpression != null || isDraggableItemCollection(node)) next.hasRuntimeCollection = true;
			if (isSortablePlaceholderCollection(node)) next.hasPlaceholderLabelCollection = true;
			const rowLabel = explicitRowLabelTemplateV2(node);
			if (rowLabel != null) next.rowLabelTemplate = canonicalizeTemplate(rowLabel, aliases);

			if (isSearchDescriptorNode(sourceFile, node, persistentHandlers)) {
				const modelExpression = directiveExpression(node, 'model') ?? expressionOf(findAttribute(node.props, 'modelValue'));
				const directPreferenceKeys = preferenceKeysForControlV2(node, modelExpression, preferenceBindings, handlerBodiesByName);
				// Native change handlers need their exact preference identity. Existing
				// click-action IDs keep their previous label-based identity.
				const explicitPreferenceKeys = eventHandlerExpression(node, 'change') == null ? []
					: explicitControlStorageBindingV2(sourceFile, modelExpression, node)?.refs.flatMap(ref => ref.kind === 'pref' ? [ref.key] : []) ?? [];
				const pizzaxRefs = pizzaxRefsForControlV2(node, modelExpression, pizzaxBindings, handlerBodiesByName);
				const ui2PreferenceKeys = sourceFile === 'src/components/HatasabaUi2SettingsBody.vue'
					? UI2_DRAFT_PREFERENCE_KEYS[modelExpression ?? ''] ?? []
					: [];
				const profilePreferenceKeys = [...new Set([...next.preferenceKeys, ...directPreferenceKeys, ...explicitPreferenceKeys, ...ui2PreferenceKeys])];
				const preferenceKeys = [...new Set([...profilePreferenceKeys, ...pizzaxRefs.map(ref => ref.key)])];
				const namedLabelTemplate = namedSlotTemplate(node, 'label', true);
				const nativeControl = node.tag === 'input' || node.tag === 'select' || node.tag === 'textarea';
				const ariaLabelTemplate = nativeControl ? templateOfAttribute(findAttribute(node.props, 'aria-label')) : '';
				// Runtime metadata rows (and other unlabeled inputs) may expose their
				// only user-facing name as placeholder copy. An explicit slot/ARIA
				// label still wins; a field-specific hint such as `namePlaceholder`
				// yields to an explicit row label.
				const inlineRowLabel = inlineSiblingLabelTemplateV2(nodes, nodes.indexOf(child));
				const rowLabelTemplate = canonicalizeTemplate(inlineRowLabel ?? next.rowLabelTemplate ?? '', aliases) || undefined;
				const rawPlaceholderTemplate = templateOfAttribute(findAttribute(node.props, 'placeholder'));
				const placeholderTemplate = rawPlaceholderTemplate == null
					? undefined
					: canonicalizeTemplate(rawPlaceholderTemplate, aliases);
				const meaningfulPlaceholderTemplate = isMeaningfulPlaceholderV2(placeholderTemplate, rowLabelTemplate)
					? placeholderTemplate
					: undefined;
				const ownLabelTemplate = ariaLabelTemplate || namedLabelTemplate || meaningfulPlaceholderTemplate || (nativeControl ? '' : textTemplate(node.children));
				// Only explicit row copy participates here. Broad ancestor text and
				// MkInfo/description siblings are intentionally absent.
				const fallbackCandidates = [
					rowLabelTemplate,
					next.formSlotLabelPath.at(-1),
					next.formFolderLabelPath.at(-1),
					next.formSectionLabelPath.at(-1),
					next.markerLabelTemplate,
				];
				const nonEmptyFallbackCandidates = fallbackCandidates.filter((value): value is string => value != null && value.trim().length > 0);
				// A page-local marker label must not hide a safe enclosing FormSection
				// label that can actually be displayed by the redesigned search UI.
				const fallbackLabelTemplate = nonEmptyFallbackCandidates.find(value => safeI18nKeys(value) != null) ?? nonEmptyFallbackCandidates[0];
				const inheritedLabel = !ownLabelTemplate && fallbackLabelTemplate != null;
				const labelTemplate = sourceControlLabelTemplateV2(sourceFile, node, canonicalizeTemplate(ownLabelTemplate || fallbackLabelTemplate || '', aliases));
				const captionTemplate = canonicalizeTemplate(namedSlotTemplate(node, 'caption'), aliases);
				const label = literalPart(labelTemplate);
				const labelI18nKeys = safeI18nKeys(labelTemplate);
				const captionI18nKeys = safeI18nKeys(captionTemplate);
				const labelCanSearch = labelTemplate.length > 0 && labelI18nKeys != null;
				const routeIsValid = (route === '/settings' || route?.startsWith('/settings/') === true) && dynamicRouteExclusionReason == null;
				const stableKey = explicitStableKey(node);
				const nonPersistentFormControlReason = nonPersistentFormControlExclusionV2(sourceFile, modelExpression);
				const dynamicChildReachability = dynamicChildReachabilityForSourceV2(sourceFile);
				// Source lines and ordinal placement are intentionally absent. Group paths
				// distinguish repeated slot controls, and a true duplicate must declare an
				// explicit semantic key instead of changing every following control ID.
				const activation = target.activation ?? hataCustomConditionActivation(sourceFile, next.conditions);
				const semanticSource = [
					route ?? 'unrouted',
					sourceFile,
					activationIdentity(activation),
					node.tag,
					modelExpression ?? '',
					eventHandlerIdentity(node),
					preferenceKeys.join('|'),
					// Runtime rows are aggregated into their static host; their local
					// copy must not manufacture a second descriptor identity merely
					// because a nearby row label became more precise.
					next.hasRuntimeCollection ? 'runtime-row' : labelI18nKeys?.join('|') ?? 'dynamic',
					next.markerLabelPath.map(semanticTemplateIdentity).join('>'),
					next.formSectionLabelPath.map(semanticTemplateIdentity).join('>'),
					next.conditions.join('&'),
					stableKey ?? '',
				].join('|');
				if (semanticSources.has(semanticSource)) {
					// A v-for row has one semantic setting group, not one catalog
					// entry per runtime member. The first descriptor is its audited
					// aggregate; individual values remain intentionally unavailable.
					if (next.hasRuntimeCollection) continue;
					throw new Error(`settings V2 duplicate semantic identity in ${sourceFile}:${node.loc.start.line}; add a static data-settings-search-key`);
				}
				semanticSources.add(semanticSource);
				const readable = slug((modelExpression ?? preferenceKeys.at(-1) ?? labelI18nKeys?.[0]) || node.tag);
				const primaryAliases = primaryAliasesForSettingsControlV2(sourceFile, modelExpression, preferenceKeys);
					const exclusionReason = !routeIsValid
						? dynamicRouteExclusionReason ?? 'router.definition.ts にこの設定コンポーネントの到達可能なルートがない'
						: dynamicChildReachability != null
							? dynamicChildReachability.exclusionReason
						: isStaticDisabled(node)
							? '常時 disabled の表示専用コントロールで、設定値を変更できない'
						: isStaticReadOnly(node)
							? 'readonly の表示専用コントロールで、設定値を変更できない'
						: nonPersistentFormControlReason
							? nonPersistentFormControlReason
						: next.hasRuntimeCollection
						? 'v-for 内の設定グループで、個別対象識別子は実行時に決まる'
					: !labelCanSearch
						? 'ラベルがページローカル状態に依存し、ビルド時に安全な検索語へ評価できない'
						: undefined;
				const stableId = `settings.control.${readable}-${shortStableHash(semanticSource)}`;
				const activationWithFocus = withActivationFocus(activation, stableId);
				const metadata = exclusionReason != null
					? excludedControlMetadataV2(sourceFile, route, target, next.conditions)
					: deriveSettingsMetadataV2(
						sourceFile,
						route,
						target,
						modelExpression,
						profilePreferenceKeys,
						pizzaxRefs,
						next.conditions,
						scriptSource,
						node,
						localStorageBindings,
					);
				descriptors.push({
					stableId,
					route: route ?? '/settings',
					sourceFile,
					sourceLine: node.loc.start.line,
					component: node.tag,
					label,
					...(labelTemplate && labelTemplate !== label ? { labelExpression: labelTemplate } : {}),
					...(labelI18nKeys?.length ? { labelI18nKeys } : {}),
					...(captionTemplate ? { caption: literalPart(captionTemplate), captionExpression: captionTemplate } : {}),
					...(captionI18nKeys?.length ? { captionI18nKeys } : {}),
					...(inheritedLabel ? { inheritedLabel: true } : {}),
					...(modelExpression ? { modelExpression } : {}),
					...(primaryAliases.length ? { primaryAliases } : {}),
					preferenceKeys,
					...(next.markerAncestorIds.at(-1) ? { legacyMarkerParentId: next.markerAncestorIds.at(-1) } : {}),
					legacyMarkerAncestorIds: next.markerAncestorIds,
					conditions: next.conditions,
					...(activationWithFocus ? { activation: activationWithFocus } : {}),
					...metadata,
					relatedHostId: stableId,
					searchable: exclusionReason == null,
					...(exclusionReason ? { intentionallyExcluded: true, exclusionReason } : {}),
					destructive: isDirectDestructiveAction(node),
				});
			}
			walk(node.children, next);
		}
	};
	walk(parsed.descriptor.template.ast.children, {
		markerLabelPath: [],
		markerAncestorIds: [],
		formSectionLabelPath: [],
		formSlotLabelPath: [],
		formFolderLabelPath: [],
		preferenceKeys: [],
		conditions: [],
		hasPlaceholderLabelCollection: false,
	});
	return descriptors;
}

const STATIC_GROUP_TAGS = new Set(['SearchMarker', 'MkFolder', 'FormSection', 'FormSlot', 'section', 'fieldset']);

/**
 * A dynamic child component is not an independently mountable settings
 * screen merely because the target glob found its SFC.  These mappings name
 * the one static parent section which is present after route navigation. The
 * search flow may focus that section and explain the prerequisite, but it
 * must never click a row, select data, grant consent, or start a workflow to
 * manufacture a target.
 */
type StaticReachabilityGroupSpecV2 = {
	stableId: string;
	sourceFile: string;
	labelExpression: string;
	labelI18nKeys: readonly string[];
	aliases: readonly string[];
	sourceSemanticGroupId: string;
	unmet?: readonly SettingsActivationUnmetV2[];
	/** A static focus-only host keeps conditional individual results reachable
	 * without inventing a second, mixed-persistence category result. */
	materialize?: boolean;
	matches: (node: ElementNode, isRoot: boolean, labelI18nKeys: readonly string[]) => boolean;
};

const STATIC_REACHABILITY_GROUP_SPECS_V2: readonly StaticReachabilityGroupSpecV2[] = [
	{
		stableId: 'settings.group.note-charm-settings',
		sourceFile: 'src/components/MkNoteCharmSettings.vue',
		labelExpression: 'i18n.ts._noteCharm.title',
		labelI18nKeys: ['i18n.ts._noteCharm.title'],
		aliases: ['ノートチャーム'],
		sourceSemanticGroupId: 'settings.semantic.feature.note-charm',
		unmet: [{ kind: 'policy', id: 'note-charm-role-and-ui', behavior: 'explain' }],
		materialize: false,
		matches: (node, isRoot) => isRoot && node.tag === 'section',
	},
	{
		stableId: 'settings.group.note-charm-pattern',
		sourceFile: 'src/components/MkNoteCharmSettings.vue',
		labelExpression: 'i18n.ts._noteCharm.pattern',
		labelI18nKeys: ['i18n.ts._noteCharm.pattern'],
		aliases: ['チャームの模様', '切り抜き', '透明', 'ドット', 'ストライプ', 'チェック'],
		sourceSemanticGroupId: 'settings.semantic.feature.note-charm',
		matches: node => node.tag === 'fieldset' && normalizedExpression(expressionOf(findAttribute(node.props, 'class'))) === '$style.patternField',
	},
	{
		stableId: 'settings.group.concrnt-connection-settings',
		sourceFile: 'src/components/concrnt/ConcrntSettings.vue',
		labelExpression: 'コンカレント連携(BETA)',
		labelI18nKeys: [],
		aliases: ['Concrnt', 'コンカレント', 'CTL', 'コンカレントの通知', 'プロフィール', '端末に保存'],
		sourceSemanticGroupId: 'settings.semantic.feature.concrnt-linking',
		unmet: [{ kind: 'runtime-data', id: 'concrnt-account-and-section', behavior: 'explain' }],
		matches: (node, isRoot) => isRoot && node.tag === 'div',
	},
	{
		stableId: 'settings.group.preference-profile-backups',
		sourceFile: 'src/pages/settings/profiles.vue',
		labelExpression: 'i18n.ts._preferencesProfile.manageProfiles',
		labelI18nKeys: ['i18n.ts._preferencesProfile.manageProfiles'],
		aliases: ['設定プロファイル', 'クラウドバックアップ', 'プロフィールの管理', 'backup'],
		sourceSemanticGroupId: 'settings.semantic.feature.preference-profiles',
		unmet: [{ kind: 'runtime-data', id: 'preference-profile-selection', behavior: 'explain' }],
		matches: (node, _isRoot, labels) => node.tag === 'SearchMarker' && labels.includes('i18n.ts._preferencesProfile.manageProfiles'),
	},
	{
		stableId: 'settings.group.external-favorite-emoji-settings',
		sourceFile: 'src/pages/settings/external-account.vue',
		labelExpression: 'i18n.ts._hata._externalAccount.favoriteEmojiSection',
		labelI18nKeys: ['i18n.ts._hata._externalAccount.favoriteEmojiSection'],
		aliases: ['外部アカウント', 'お気に入り絵文字', '外部リアクション', 'emoji picker'],
		sourceSemanticGroupId: 'settings.semantic.feature.external-account-linking',
		unmet: [{ kind: 'preference', id: 'external-account-link', behavior: 'explain' }, { kind: 'runtime-data', id: 'external-favorite-emoji-selection', behavior: 'explain' }],
		matches: (node, _isRoot, labels) => node.tag === 'SearchMarker' && labels.includes('i18n.ts._hata._externalAccount.title'),
	},
	{
		stableId: 'settings.group.security-key-runtime-settings',
		sourceFile: 'src/pages/settings/2fa.vue',
		labelExpression: 'i18n.ts.securityKeyAndPasskey',
		labelI18nKeys: ['i18n.ts.securityKeyAndPasskey'],
		aliases: ['2段階', 'セキュリティキー', 'パスキー', 'security key', 'passkey'],
		sourceSemanticGroupId: 'settings.semantic.feature.security-key-settings',
		unmet: [{ kind: 'runtime-data', id: 'security-key-selection', behavior: 'explain' }],
		matches: (node, _isRoot, labels) => node.tag === 'MkFolder' && labels.includes('i18n.ts.securityKeyAndPasskey'),
	},
	{
		stableId: 'settings.group.earthquake-notification-settings',
		sourceFile: 'src/components/MkEarthquakeSettings.vue',
		labelExpression: '地震・津波の通知',
		labelI18nKeys: [],
		aliases: ['地震通知', '津波通知', '震度通知', 'お住いの都道府県で揺れたら通知'],
		sourceSemanticGroupId: 'settings.semantic.feature.earthquake-tsunami-alerts',
		unmet: [{ kind: 'preference', id: 'earthquake-notification-enabled', behavior: 'explain' }],
		materialize: false,
		// This static card is deliberately narrower than the whole dialog: its
		// conditional children are server notification settings, while the dialog
		// also contains unrelated device-only polling and prefecture choices.
		matches: node => node.tag === 'div' && normalizedExpression(expressionOf(findAttribute(node.props, 'class'))) === '$style.section',
	},
	{
		stableId: 'settings.group.preferences-backup-suggestion',
		sourceFile: 'src/pages/settings/index.vue',
		labelExpression: '設定プロファイルの自動バックアップ',
		labelI18nKeys: [],
		aliases: ['設定の自動バックアップ', 'クラウドバックアップを有効化'],
		sourceSemanticGroupId: 'settings.semantic.feature.preference-profiles',
		unmet: [{ kind: 'preference', id: 'preferences-auto-backup-suggestion', behavior: 'explain' }],
		materialize: false,
		matches: node => node.tag === 'div' && staticAttributeValue(node, 'class') === 'body',
	},
	{
		stableId: 'settings.group.hatask-runtime-settings',
		sourceFile: 'src/pages/HataskSettings.vue',
		labelExpression: 'Hatask の設定',
		labelI18nKeys: [],
		aliases: ['Hatask', 'タスク設定', 'デザインテーマ', 'Hatakyu'],
		sourceSemanticGroupId: 'settings.semantic.feature.hatask-settings',
		unmet: [{ kind: 'runtime-data', id: 'hatask-view-or-theme-selection', behavior: 'explain' }],
		materialize: false,
		matches: node => node.tag === 'div' && normalizedExpression(expressionOf(findAttribute(node.props, 'class'))) === '$style.root',
	},
	{
		stableId: 'settings.group.mascot-runtime-settings',
		sourceFile: 'src/pages/MkMascotSettings.vue',
		labelExpression: 'マスコットの設定',
		labelI18nKeys: [],
		aliases: ['マスコット', '通知文言', '誕生日', '表情', 'キャラクター'],
		sourceSemanticGroupId: 'settings.semantic.feature.mascot-display-settings',
		unmet: [{ kind: 'consent', id: 'mascot-terms', behavior: 'explain' }, { kind: 'runtime-data', id: 'mascot-character-selection', behavior: 'explain' }],
		matches: node => node.tag === 'div' && normalizedExpression(expressionOf(findAttribute(node.props, 'class'))) === '$style.root',
	},
	{
		stableId: 'settings.group.avatar-decoration-adjustment',
		sourceFile: 'src/pages/settings/avatar-decoration.vue',
		labelExpression: 'i18n.ts.avatarDecorations',
		labelI18nKeys: ['i18n.ts.avatarDecorations'],
		aliases: ['アバター装飾の調整', '角度', '位置', '拡大縮小', '不透明度', '反転'],
		sourceSemanticGroupId: 'settings.semantic.feature.avatar-decoration-adjustment',
		unmet: [{ kind: 'runtime-data', id: 'avatar-decoration-selection', behavior: 'explain' }],
		matches: (node, _isRoot, labels) => node.tag === 'SearchMarker' && labels.includes('i18n.ts.avatarDecorations'),
	},
	{
		stableId: 'settings.group.notification-receive-config',
		sourceFile: 'src/pages/settings/notifications.vue',
		labelExpression: 'i18n.ts.notificationRecieveConfig',
		labelI18nKeys: ['i18n.ts.notificationRecieveConfig'],
		aliases: ['通知の受信方法', '通知の種類ごとの設定'],
		sourceSemanticGroupId: 'settings.semantic.feature.notification-delivery',
		unmet: [{ kind: 'runtime-data', id: 'notification-type-selection', behavior: 'explain' }],
		matches: (node, _isRoot, labels) => node.tag === 'FormSection' && labels.includes('i18n.ts.notificationRecieveConfig'),
	},
	{
		stableId: 'settings.group.statusbar-runtime-settings',
		sourceFile: 'src/pages/settings/statusbar.vue',
		labelExpression: 'i18n.ts.statusbar',
		labelI18nKeys: ['i18n.ts.statusbar'],
		aliases: ['ステータスバーの項目', 'status bar'],
		sourceSemanticGroupId: 'settings.semantic.feature.statusbar-editor',
		unmet: [{ kind: 'runtime-data', id: 'statusbar-selection', behavior: 'explain' }],
		matches: (node, isRoot) => isRoot && node.tag === 'div',
	},
	{
		stableId: 'settings.group.sound-event-config',
		sourceFile: 'src/pages/settings/sounds.vue',
		labelExpression: 'i18n.ts.sounds',
		labelI18nKeys: ['i18n.ts.sounds'],
		aliases: ['通知音ごとの設定', 'サウンドイベント'],
		sourceSemanticGroupId: 'settings.semantic.feature.sound-settings',
		unmet: [{ kind: 'runtime-data', id: 'sound-event-selection', behavior: 'explain' }],
		matches: (node, _isRoot, labels) => node.tag === 'FormSection' && labels.includes('i18n.ts.sounds'),
	},
	{
		stableId: 'settings.group.word-mute-runtime-settings',
		sourceFile: 'src/pages/settings/mute-block.vue',
		labelExpression: 'i18n.ts.muteAndBlock',
		labelI18nKeys: ['i18n.ts.muteAndBlock'],
		aliases: ['ワードミュート', 'ハードワードミュート'],
		sourceSemanticGroupId: 'settings.semantic.feature.mute-block',
		matches: (node, _isRoot, labels) => node.tag === 'SearchMarker' && labels.includes('i18n.ts.muteAndBlock'),
	},
	{
		stableId: 'settings.group.instance-mute-settings',
		sourceFile: 'src/pages/settings/mute-block.vue',
		labelExpression: 'i18n.ts.instanceMute',
		labelI18nKeys: ['i18n.ts.instanceMute'],
		aliases: ['インスタンスミュート', 'サーバーミュート'],
		sourceSemanticGroupId: 'settings.semantic.feature.mute-block',
		unmet: [{ kind: 'policy', id: 'instance-federation', behavior: 'explain' }],
		matches: (node, _isRoot, labels) => node.tag === 'SearchMarker' && labels.includes('i18n.ts.instanceMute'),
	},
	{
		stableId: 'settings.group.watermark-presets',
		sourceFile: 'src/pages/settings/drive.vue',
		labelExpression: 'i18n.ts.watermark',
		labelI18nKeys: ['i18n.ts.watermark'],
		aliases: ['透かし', 'ウォーターマーク', 'watermark preset'],
		sourceSemanticGroupId: 'settings.semantic.feature.watermark-presets',
		unmet: [{ kind: 'policy', id: 'watermark-availability', behavior: 'explain' }, { kind: 'runtime-data', id: 'watermark-preset-selection', behavior: 'explain' }],
		// MkFolder itself is absent when the server policy disables watermarks.
		// The enclosing image FormSection is always mounted and is therefore the
		// only safe focus host for a result that must explain that policy.
		matches: (node, _isRoot, labels) => node.tag === 'FormSection' && labels.includes('i18n.ts.image'),
	},
	{
		stableId: 'settings.group.emoji-palette-runtime-settings',
		sourceFile: 'src/pages/settings/emoji-palette.vue',
		labelExpression: 'i18n.ts._emojiPalette.palettes',
		labelI18nKeys: ['i18n.ts._emojiPalette.palettes'],
		aliases: ['絵文字パレット', 'パレットの編集'],
		sourceSemanticGroupId: 'settings.semantic.feature.emoji-palette',
		unmet: [{ kind: 'runtime-data', id: 'emoji-palette-selection', behavior: 'explain' }],
		matches: (node, _isRoot, labels) => node.tag === 'FormSection' && labels.includes('i18n.ts._emojiPalette.palettes'),
	},
	{
		stableId: 'settings.group.webhook-management',
		sourceFile: 'src/pages/settings/connect.vue',
		labelExpression: 'i18n.ts._settings.webhook',
		labelI18nKeys: ['i18n.ts._settings.webhook'],
		aliases: ['Webhook管理', 'Webhook編集', 'Webhookの作成', 'webhook', 'webhook secret'],
		sourceSemanticGroupId: 'settings.semantic.feature.webhook-editor',
		unmet: [{ kind: 'runtime-data', id: 'webhook-selection', behavior: 'explain' }],
		matches: (node, _isRoot, labels) => node.tag === 'FormSection' && labels.includes('i18n.ts._settings.webhook'),
	},
	{
		stableId: 'settings.group.hatady-display-settings',
		sourceFile: 'src/components/HatadyDisplaySettings.vue',
		labelExpression: 'Hatady表示設定',
		aliases: ['Hatady', 'テーマ', '表示設定'],
		sourceSemanticGroupId: 'settings.semantic.feature.hatady-display-settings',
		// Native content survives both popup and embedded HyDialog rendering.
		// A component-root attribute could otherwise land on MkModal's teleport
		// wrapper instead of a focusable element in the settings surface.
		matches: node => isSettingsWindowRoot(node, 'MkWindow')
			|| (node.tag === 'div' && staticAttributeValue(node, 'data-settings-search-group-id') === 'settings.group.hatady-display-settings'),
	},
];

type DynamicChildReachabilityV2 = {
	parentGroupId?: string;
	unmet?: readonly SettingsActivationUnmetV2[];
	disposition?: Extract<SettingsTransitiveControlDispositionV2, 'nonsetting' | 'unreachable-excluded'>;
	/**
	 * The parent page's settings-search context reaches this runtime child.  Its
	 * controls must show the parent's related links, but must not receive the
	 * parent's focus ID themselves: a v-for would duplicate it at runtime.
	 */
	renderRelatedInChild?: boolean;
	exclusionReason: string;
};

/**
 * Direct controls in these children either belong to a parent `v-for` row or
 * are one-shot workflow input.  Keeping a stable descriptor for their source
 * node would inject the same ID into every runtime row (or no row at all), so
 * only the named parent group may be searchable.
 */
const DYNAMIC_CHILD_REACHABILITY_V2: Readonly<Record<string, DynamicChildReachabilityV2>> = {
	'src/pages/settings/avatar-decoration.dialog.vue': {
		parentGroupId: 'settings.group.avatar-decoration-adjustment',
		unmet: [{ kind: 'runtime-data', id: 'avatar-decoration-selection', behavior: 'explain' }],
		exclusionReason: '選択済みのアバター装飾を編集する一時popup内の値で、検索は親のアバター装飾グループへ安全に到達する',
	},
	'src/pages/settings/notifications.notification-config.vue': {
		parentGroupId: 'settings.group.notification-receive-config',
		unmet: [{ kind: 'runtime-data', id: 'notification-type-selection', behavior: 'explain' }],
		renderRelatedInChild: true,
		exclusionReason: '通知種類ごとのv-for行で同じ子SFCが複製されるため、検索は通知受信設定グループへ集約する',
	},
	'src/pages/settings/statusbar.statusbar.vue': {
		parentGroupId: 'settings.group.statusbar-runtime-settings',
		unmet: [{ kind: 'runtime-data', id: 'statusbar-selection', behavior: 'explain' }],
		renderRelatedInChild: true,
		exclusionReason: '選択済みステータスバーごとのv-for行で同じ子SFCが複製されるため、検索はステータスバー設定グループへ集約する',
	},
	'src/pages/settings/sounds.sound.vue': {
		parentGroupId: 'settings.group.sound-event-config',
		unmet: [{ kind: 'runtime-data', id: 'sound-event-selection', behavior: 'explain' }],
		renderRelatedInChild: true,
		exclusionReason: 'サウンドイベントごとのv-for行で同じ子SFCが複製されるため、検索はサウンド設定グループへ集約する',
	},
	'src/pages/settings/mute-block.word-mute.vue': {
		parentGroupId: 'settings.group.word-mute-runtime-settings',
		renderRelatedInChild: true,
		exclusionReason: 'ソフト・ハードの二つの親設定で同じ子SFCが使われるため、検索はワードミュート設定グループへ集約する',
	},
	'src/pages/settings/mute-block.instance-mute.vue': {
		parentGroupId: 'settings.group.instance-mute-settings',
		unmet: [{ kind: 'policy', id: 'instance-federation', behavior: 'explain' }],
		renderRelatedInChild: true,
		exclusionReason: '連合有効時だけ表示されるインスタンスミュートの子SFCで、検索は親設定グループへ安全に到達する',
	},
	'src/pages/settings/2fa.qrdialog.vue': {
		disposition: 'nonsetting',
		exclusionReason: '二段階認証登録フローの確認コード入力であり、設定値ではない。検索から認証・登録フローを開始しない',
	},
	'src/pages/settings/webhook.edit.vue': {
		parentGroupId: 'settings.group.webhook-management',
		unmet: [{ kind: 'runtime-data', id: 'webhook-selection', behavior: 'explain' }],
		exclusionReason: 'Webhook編集は実行時のwebhookIdを必要とするため、検索は連携画面のWebhook管理グループへ安全に到達し、編集するWebhookの選択を案内する',
	},
	'src/pages/settings/drive.WatermarkItem.vue': {
		parentGroupId: 'settings.group.watermark-presets',
		unmet: [{ kind: 'policy', id: 'watermark-availability', behavior: 'explain' }, { kind: 'runtime-data', id: 'watermark-preset-selection', behavior: 'explain' }],
		renderRelatedInChild: true,
		exclusionReason: '透かしpresetごとのv-for行で同じ子SFCが複製され、編集popupは選択済みpresetを必要とするため、検索は透かし設定グループへ集約する',
	},
	'src/pages/settings/emoji-palette.palette.vue': {
		parentGroupId: 'settings.group.emoji-palette-runtime-settings',
		unmet: [{ kind: 'runtime-data', id: 'emoji-palette-selection', behavior: 'explain' }],
		renderRelatedInChild: true,
		exclusionReason: '絵文字パレットごとのv-for行で同じ子SFCが複製されるため、検索は絵文字パレット設定グループへ集約する',
	},
};

/**
 * These editors are reached only after selecting runtime data in a settings
 * page.  They are not target files: the catalog intentionally keeps their
 * vocabulary on the parent group rather than manufacturing a dead popup
 * focus target.  Keeping this finite list beside the dynamic-child map makes
 * a future imported editor fail the transitive audit until it receives the
 * same explicit review.
 */
const PARENT_CONTAINED_VOCABULARY_V2: Readonly<Record<string, DynamicChildReachabilityV2>> = {
	'src/components/MkWatermarkEditorDialog.vue': {
		parentGroupId: 'settings.group.watermark-presets',
		unmet: [{ kind: 'policy', id: 'watermark-availability', behavior: 'explain' }, { kind: 'runtime-data', id: 'watermark-preset-selection', behavior: 'explain' }],
		exclusionReason: '選択済み透かしpresetを編集する一時popupで、検索は親の透かしpreset設定グループへ安全に到達する',
	},
	'src/components/MkWatermarkEditorDialog.Layer.vue': {
		parentGroupId: 'settings.group.watermark-presets',
		unmet: [{ kind: 'policy', id: 'watermark-availability', behavior: 'explain' }, { kind: 'runtime-data', id: 'watermark-preset-selection', behavior: 'explain' }],
		exclusionReason: '透かしpreset内のlayerを編集するv-for子で、検索は親の透かしpreset設定グループへ安全に到達する',
	},
	'src/components/MkPositionSelector.vue': {
		parentGroupId: 'settings.group.watermark-presets',
		unmet: [{ kind: 'policy', id: 'watermark-availability', behavior: 'explain' }, { kind: 'runtime-data', id: 'watermark-preset-selection', behavior: 'explain' }],
		exclusionReason: '透かしlayerの実行時位置を返す共通selectorで、検索は親の透かしpreset設定グループへ安全に到達する',
	},
};

function dynamicChildReachabilityForSourceV2(sourceFile: string): DynamicChildReachabilityV2 | undefined {
	return DYNAMIC_CHILD_REACHABILITY_V2[sourceFile] ?? PARENT_CONTAINED_VOCABULARY_V2[sourceFile];
}

/**
 * A small number of independently-targeted, transitive controls are mounted
 * inside a static parent settings section. Their own SFC cannot receive the
 * focus attribute: the one truthful DOM host belongs to the parent source.
 */
type CrossSourceStaticParentFocusV2 = {
	stableId: string;
	sourceFile: string;
	unmet: readonly SettingsActivationUnmetV2[];
};

const CROSS_SOURCE_STATIC_PARENT_FOCUS_V2: Readonly<Record<string, CrossSourceStaticParentFocusV2>> = {
	'src/components/MkPushNotificationAllowButton.vue': {
		stableId: 'settings.group.notification-receive-config',
		sourceFile: 'src/pages/settings/notifications.vue',
		unmet: [{ kind: 'runtime-data', id: 'push-registration-state', behavior: 'explain' }],
	},
};

function staticReachabilityGroupSpecV2(
	sourceFile: string,
	node: ElementNode,
	isRoot: boolean,
	labelI18nKeys: readonly string[],
): StaticReachabilityGroupSpecV2 | undefined {
	return STATIC_REACHABILITY_GROUP_SPECS_V2.find(spec => spec.sourceFile === sourceFile && spec.matches(node, isRoot, labelI18nKeys));
}

// These section IDs are product-owned, static headings in the shared UI2
// body.  Its actual text is exposed through the `editor.copy` proxy, which is
// intentionally not evaluated by the generator.  Mapping the stable heading
// ID to its semantic label keeps the runtime row searchable without executing
// page-local state or fabricating a per-row descriptor.
const STATIC_GROUP_LABEL_OVERRIDES: Readonly<Record<string, string>> = {
	'hatasaba-ui2-basic': 'ナビゲーション',
	'hatasaba-ui2-opacity': 'ガラスとぼかし',
	'hatasaba-ui2-bubble': 'バブルデザイン',
	'hatasaba-ui2-blur': 'ヘッダーのぼかし',
	'hatasaba-ui2-note-title': 'ノート表示とデッキ',
	'hatasaba-ui2-top-nav': '上部ナビゲーション',
	'hatasaba-ui2-bottom-nav': '下部ナビゲーション',
	'hatasaba-ui2-side-menu-title': 'サイドメニュー',
};

const STATIC_GROUP_ALIASES: Readonly<Record<string, string[]>> = {
	'hatasaba-ui2-bottom-nav': ['simpleUi.bottomNav', '下のバー', '下部ナビゲーション'],
	'hatasaba-ui2-top-nav': ['simpleUi.topNav', '上のバー', '上部ナビゲーション'],
	'hatasaba-ui2-opacity': ['simpleUi.glassUiCardOpacity', '透過', 'opacity'],
	'hatasaba-ui2-bubble': ['吹き出し', 'バブル'],
};

/**
 * Only terms with an audited, single primary destination belong here.  Normal
 * aliases deliberately keep ordinary ranking so a short shared word cannot
 * overwrite a more precise user query.
 */
const STATIC_GROUP_PRIMARY_ALIASES: Readonly<Record<string, string[]>> = {
	// The permanent surface is mounted under glassUi.  These are deliberately
	// attached to its top-level static host, not to the retired popup launcher
	// in hata-custom.vue: a result must focus an element that exists after the
	// category opens.
	'hatasaba-ui2-immediate-title': ['UI', 'Hataskey UI'],
	'hatasaba-ui2-foldable-title': ['折りたたみ', 'foldable'],
	'hatasaba-ui2-opacity': ['simpleUi.glassUiCardOpacity', '透過', 'opacity', '角丸カード'],
	'hatasaba-ui2-blur': ['ぼかし'],
	'hatasaba-ui2-bottom-nav': ['ナビ', 'タブ', '下のバー', 'simpleUi.bottomNav'],
};

/**
 * Terms from the 2e migration copy whose product owner designated one
 * destination. Keying these by persistence makes wording changes unable to
 * silently redirect a query. Generic aliases intentionally stay ordinary.
 */
const CONTROL_PRIMARY_ALIASES_BY_PREFERENCE_KEY_V2: Readonly<Record<string, string[]>> = {
	'showGapBetweenNotesInTimeline': ['間隔', '詰める', '余白'],
	'simpleUi.hideBotsInTimeline': ['bot', '自動投稿', 'ノイズ'],
	'nicknameEnabled': ['ニックネーム', 'ニャ', 'nicknameEnabled'],
	'chat.sendOnEnter': ['Enterで送信'],
	'hataBranding.useHatakyu': ['ハタキュ', 'アイコン', 'ブランディング'],
	'weatherEffect.enabled': ['天気', '雨', '雪', '若葉', '演出'],
	'deck.columnAlign': ['カラム', 'deck.columnAlign'],
	'deck.wallpaper': ['壁紙'],
	'deck.menuPosition': ['メニュー位置'],
};

function primaryAliasesForSettingsControlV2(
	sourceFile: string,
	modelExpression: string | undefined,
	preferenceKeys: readonly string[],
): string[] {
	// The permanent UI2 companion is the canonical mounted host for branding.
	// Preserve the legacy h-c descriptor for old hashes, but do not let its
	// duplicate preference win a fresh search and focus an unmounted branch.
	if (sourceFile === 'src/pages/settings/hata-custom.vue'
		&& preferenceKeys.includes('hataBranding.useHatakyu')) return [];
	const ui2DraftAliases = sourceFile === 'src/components/HatasabaUi2SettingsBody.vue'
		&& modelExpression === 'editor.draft.editedGlassUiBubble'
		? ['吹き出し', 'バブル']
		: [];
	return [...new Set([
		...preferenceKeys.flatMap(key => CONTROL_PRIMARY_ALIASES_BY_PREFERENCE_KEY_V2[key] ?? []),
		...ui2DraftAliases,
	])];
}

/**
 * Old hata-custom tabs were names, not independent routes.  Their aliases
 * must therefore reopen an exact, static host in the category where the
 * setting now lives; a route-only fallback would always reopen the default
 * `general` tab and hide the requested section.
 */
type HataCustomLegacyCategoryShortcutV2 = {
	category: HataCustomCategoryV2;
	aliases: readonly string[];
	primaryAliases: readonly string[];
};

function hataCustomLegacyCategoryShortcutV2(
	sourceFile: string,
	host: Pick<StaticGroupHostV2, 'node' | 'labelI18nKeys'>,
): HataCustomLegacyCategoryShortcutV2 | undefined {
	if (sourceFile !== 'src/pages/settings/hata-custom.vue') return undefined;
	const labels = new Set(host.labelI18nKeys ?? []);
	// The root marker is the durable host for the former general/other tabs:
	// it exists before any category is selected and is the only honest focus
	// target for a category landing, rather than an unrelated first setting.
	if (host.node.tag === 'SearchMarker' && labels.has('i18n.ts._hata._customSettings.title')) {
		return { category: 'general', aliases: ['Hataskey全体', '旗鯖全体', 'その他'], primaryAliases: ['Hataskey全体', 'その他'] };
	}
	if (host.node.tag !== 'FormSection') return undefined;
	if (labels.has('i18n.ts._hata._customSettings._ui.hatasabaUi2Settings')) {
		// This former launcher stays discoverable for a legacy deep-link, but its
		// broad tab aliases rank behind the permanent UI2 surface.  That surface
		// is the only exact-one host after the new glassUi category mounts.
		return { category: 'glassUi', aliases: ['UI', 'Hataskey UI'], primaryAliases: [] };
	}
	if (labels.has('i18n.ts._hata._customSettings._visual.noteSpacing')) {
		return { category: 'visual', aliases: ['ビジュアル'], primaryAliases: ['ビジュアル'] };
	}
	return undefined;
}

// These are deliberately named product sections, not a route/category
// fallback.  They cover compact popup sources whose controls share a visible
// panel heading but have no static FormSection/SearchMarker node to host a
// separate group descriptor.  Keeping the mapping finite makes any new
// source prove its own relation evidence instead of inheriting a broad route.
const EXPLICIT_SOURCE_SEMANTIC_GROUPS: Readonly<Record<string, string>> = {
	'src/components/MkNoteCharmSettings.vue': 'settings.semantic.feature.note-charm',
	// A compact dialog/popup has a visible feature heading, but no static
	// FormSection host spanning its controls. These are hand-audited feature
	// scopes, never a generic route/category fallback.
	'src/pages/settings/avatar-decoration.dialog.vue': 'settings.semantic.feature.avatar-decoration-adjustment',
	'src/pages/settings/2fa.vue': 'settings.semantic.feature.security-key-settings',
	'src/components/MkEarthquakeSettings.vue': 'settings.semantic.feature.earthquake-tsunami-alerts',
	'src/pages/settings/email.vue': 'settings.semantic.feature.email-account',
	'src/pages/settings/mute-block.vue': 'settings.semantic.feature.mute-block',
	'src/pages/settings/mute-block.instance-mute.vue': 'settings.semantic.feature.mute-block',
	'src/pages/settings/mute-block.word-mute.vue': 'settings.semantic.feature.mute-block',
	'src/pages/settings/mute-block.emoji-mute.vue': 'settings.semantic.feature.mute-block',
	// Notification controls intentionally retain their local marker/visible
	// evidence; a route-wide feature would join unrelated external timelines.
	// Browser push subscription is a concrete notification-delivery setting;
	// subscribe and unsubscribe are peers of the notification receive section,
	// not generic button actions.
	'src/components/MkPushNotificationAllowButton.vue': 'settings.semantic.feature.notification-delivery',
	'src/pages/settings/sounds.vue': 'settings.semantic.feature.sound-settings',
	'src/pages/settings/sounds.sound.vue': 'settings.semantic.feature.sound-settings',
	// These screens are self-contained feature editors.  Their templates predate
	// FormSection/SearchMarker, so a source-local feature scope is the only
	// static, user-visible relation evidence.  This is intentionally a finite
	// list of named features -- it must not become a route/category catch-all.
	'src/components/HatadyDisplaySettings.vue': 'settings.semantic.feature.hatady-display-settings',
	'src/components/HataFeedDisplaySettings.vue': 'settings.semantic.feature.hatafeed-display-settings',
	'src/components/concrnt/ConcrntSettings.vue': 'settings.semantic.feature.concrnt-linking',
	// The permanent surface is a named, user-visible feature area. Its root
	// category landing and the three child groups are genuine peers, unlike a
	// route-wide fallback, so it supplies relation evidence for the canonical
	// "Hataskey UI" destination.
	'src/components/HatasabaUi2ImmediateSettings.vue': 'settings.semantic.feature.hatasaba-ui2-immediate-surface',
	'src/components/MkUISetup.vue': 'settings.semantic.feature.ui-selection',
	'src/pages/HataskSettings.vue': 'settings.semantic.feature.hatask-settings',
	'src/pages/MkMascotSettings.vue': 'settings.semantic.feature.mascot-display-settings',
	'src/pages/settings/emoji-palette.vue': 'settings.semantic.feature.emoji-palette',
	'src/pages/settings/external-account.vue': 'settings.semantic.feature.external-account-linking',
	'src/pages/settings/hidden-reactions-manage.vue': 'settings.semantic.feature.hidden-reactions',
	'src/pages/settings/migration.vue': 'settings.semantic.feature.account-migration',
	// Switching/adding an account and exporting its account data are the two
	// user-visible parts of the account-management feature. This narrow pair is
	// deliberately not assigned to every profile/privacy control.
	'src/pages/settings/accounts.vue': 'settings.semantic.feature.account-management',
	'src/pages/settings/account-data.vue': 'settings.semantic.feature.account-management',
	// The auto-backup suggestion is the entry point for the existing preference
	// profile/backup manager. It must relate to that named feature even though
	// the banner button itself has the generic label "Enable".
	'src/pages/settings/index.vue': 'settings.semantic.feature.preference-profiles',
	// Runtime plugin rows are related to the install editor, not to a broad
	// route/category coincidence.
	'src/pages/settings/plugin.vue': 'settings.semantic.feature.plugin-install',
	'src/pages/settings/plugin.install.vue': 'settings.semantic.feature.plugin-install',
	'src/pages/settings/statusbar.statusbar.vue': 'settings.semantic.feature.statusbar-editor',
	// Installing a theme and choosing its light/dark application are separate
	// operations within the visible theme-customisation feature, not merely
	// co-located on a route. This gives the install editor a real peer without
	// relying on the generic word "theme".
	'src/pages/settings/theme.install.vue': 'settings.semantic.feature.theme-customization',
	'src/pages/settings/theme.vue': 'settings.semantic.feature.theme-customization',
	'src/pages/settings/theme.manage.vue': 'settings.semantic.feature.theme-editor',
	// The navbar editor has four controls spread across a small template with
	// no named SearchMarker. This finite feature identity keeps them together
	// without joining every display-notes setting.
	'src/pages/settings/navbar.vue': 'settings.semantic.feature.navbar-editor',
	'src/pages/settings/webhook.edit.vue': 'settings.semantic.feature.webhook-editor',
	'src/pages/settings/webhook.new.vue': 'settings.semantic.feature.webhook-editor',
	// This route has one select and no local peer. Its truthful peer is the
	// explicitly registered cleaner route entry, never the broad drive page.
	'src/pages/settings/drive-cleaner.vue': 'settings.semantic.feature.drive-cleaner',
};

function explicitFeatureSemanticGroupV2(
	sourceFile: string,
	modelExpression?: string,
	preferenceKeys: readonly string[] = [],
	labelIdentity = '',
): string | undefined {
	const sourceGroup = EXPLICIT_SOURCE_SEMANTIC_GROUPS[sourceFile];
	if (sourceGroup != null) return sourceGroup;
	if (sourceFile === 'src/components/HatasabaUi2SettingsBody.vue') {
		// The shared UI2 body has a finite set of visible product sections. Its
		// `editor.copy` labels are now resolvable, so direct controls must retain
		// the same narrow section evidence as the static group hosts rather than
		// falling back to a route-wide UI2 relation.
		if (/\bedited(?:GlassUiBubble|NormalNoBannerBg|ProfileNoBannerBg)\b/u.test(modelExpression ?? '')) {
			return 'settings.semantic.feature.hatasaba-ui2-glass-appearance';
		}
		if (/\bedited(?:ShowTrendingTab|ShowHatadyTab|TopNavMode|DeckIgnoreWidth|TabSwipeEnabled|DisableBubbleInHatasabaDeck)\b/u.test(modelExpression ?? '')) {
			return 'settings.semantic.feature.hatasaba-ui2-navigation-deck';
		}
	}
	if (sourceFile === 'src/pages/settings/hata-custom.vue') {
		const identity = `${modelExpression ?? ''} ${preferenceKeys.join(' ')} ${labelIdentity}`;
		// These are named, visible product sections or paired settings.  They
		// are deliberately narrower than the hata-custom route and its tabs:
		// a relation from a singleton should lead to an actual nearby setting,
		// not merely to an arbitrary item in the same category.
		if (/\bhideMutedReactions\b/u.test(identity)) return 'settings.semantic.feature.hidden-reactions';
		if (/\btimelineAnimationDirection\b/u.test(identity)) return 'settings.semantic.feature.timeline-motion';
		if (/\bshowLoginBonusPopup\b/u.test(identity)) return 'settings.semantic.feature.welcome-notices';
		if (/_font\.(?:resetDefault|uiFontSelection)/u.test(identity)) return 'settings.semantic.feature.font-customization';
		if (/\b(?:foldableLayout|hataBranding\.useHatakyu)\b/u.test(identity)) return 'settings.semantic.feature.hatasaba-ui2';
		if (/\bsimpleUi\.showTimelineDateOnMobile\b/u.test(identity)) return 'settings.semantic.feature.timeline-display';
		if (/\b(?:hatafeed\.leaves|weatherEffect\.)\b/u.test(identity)) return 'settings.semantic.feature.seasonal-display-effects';
		if (/hatady|ハタディ/iu.test(identity)) return 'settings.semantic.feature.hatady-display-settings';
		if (/\bsimpleUi\.(?:widgetBorder|glassEffect|deckNoBannerBg|showPageHeader)\b/u.test(identity)) return 'settings.semantic.feature.hatasaba-ui-surface';
	}
	if (sourceFile === 'src/pages/settings/preferences.vue') {
		if (preferenceKeys.includes('animation') || preferenceKeys.includes('smoothTransitionAnimations')) return 'settings.semantic.feature.timeline-motion';
		if (preferenceKeys.includes('welcomeBackToast')) return 'settings.semantic.feature.welcome-notices';
		if (preferenceKeys.includes('showProfilePreview')) return 'settings.semantic.feature.profile-interaction';
	}
	if (sourceFile === 'src/pages/settings/privacy.vue') {
		// These two controls govern who can access direct messages/content. Their
		// visible labels share no precise token after generic UI words are removed,
		// so retain the explicit, narrow privacy-access feature evidence.
		if (modelExpression === 'chatScope' || modelExpression === 'requireSigninToViewContents') return 'settings.semantic.feature.privacy-access';
	}
	if (sourceFile === 'src/pages/settings/drive.vue' && (/(?:defaultImageCompressionLevel|defaultVideoCompressionLevel)/u.test(`${modelExpression ?? ''} ${labelIdentity}`) || preferenceKeys.some(key => /(?:defaultImageCompressionLevel|defaultVideoCompressionLevel)/u.test(key)))) {
		return 'settings.semantic.feature.media-compression';
	}
	if (sourceFile === 'src/pages/settings/drive.vue' && (/watermark/i.test(`${modelExpression ?? ''} ${labelIdentity}`) || preferenceKeys.some(key => /watermark/i.test(key)))) {
		return 'settings.semantic.feature.watermark-presets';
	}
	if (sourceFile === 'src/pages/settings/other.vue' && (/^(?:devMode|enable(?:CondensedLine|NoteRender|StackingRouterView|FolderPageView|HapticFeedback|WebTranslatorApi))$/u.test(modelExpression ?? ''))) {
		return 'settings.semantic.feature.developer-experimental';
	}
	return undefined;
}

function explicitFeatureSemanticGroupForHostV2(sourceFile: string, host: Pick<StaticGroupHostV2, 'key' | 'labelTemplate' | 'labelI18nKeys'>): string | undefined {
	const sourceGroup = EXPLICIT_SOURCE_SEMANTIC_GROUPS[sourceFile];
	if (sourceGroup != null) return sourceGroup;
	if (sourceFile === 'src/pages/settings/hata-custom.vue') {
		const labelKeys = new Set(host.labelI18nKeys ?? []);
		if (/hatady/iu.test(`${host.key} ${host.labelTemplate}`)) return 'settings.semantic.feature.hatady-display-settings';
		if (host.key.includes('|SearchMarker|') && labelKeys.has('i18n.ts._hata._customSettings.title')) return 'settings.semantic.feature.hata-custom-general';
		if (labelKeys.has('i18n.ts._hata._customSettings._general.hideBotPosts')) return 'settings.semantic.feature.hata-custom-general';
		if (labelKeys.has('i18n.ts._hata._customSettings._font.uiFontSelection')) return 'settings.semantic.feature.font-customization';
		if (labelKeys.has('i18n.ts._hata._customSettings._ui.hatasabaUi2Settings')) return 'settings.semantic.feature.hatasaba-ui2';
		if (labelKeys.has('i18n.ts._hata._customSettings._visual.noteSpacing')) return 'settings.semantic.feature.timeline-display';
	}
	if (sourceFile === 'src/components/HatasabaUi2SettingsBody.vue') {
		const headingId = /hatasaba-ui2-(?:basic|opacity|bubble|blur|note-title|top-nav|bottom-nav|side-menu-title)/u.exec(host.key)?.[0];
		if (headingId != null) {
			if (['hatasaba-ui2-basic', 'hatasaba-ui2-note-title', 'hatasaba-ui2-top-nav', 'hatasaba-ui2-bottom-nav', 'hatasaba-ui2-side-menu-title'].includes(headingId)) {
				return 'settings.semantic.feature.hatasaba-ui2-navigation-deck';
			}
			return 'settings.semantic.feature.hatasaba-ui2-glass-appearance';
		}
	}
	const identity = `${host.key} ${host.labelTemplate} ${(host.labelI18nKeys ?? []).join(' ')}`;
	if (sourceFile === 'src/pages/settings/drive.vue' && /watermark/i.test(identity)) return 'settings.semantic.feature.watermark-presets';
	if (sourceFile === 'src/pages/settings/preferences.vue' && /additionalEmojiDictionary/u.test(identity)) return 'settings.semantic.feature.emoji-input';
	return undefined;
}

/**
 * The runtime adapter resolves property-only i18n expressions inside `${...}`
 * templates. Static reachability specs intentionally store the property
 * expression without template syntax so they can be compared to template
 * AST labels; materialize that expression only at the catalog boundary.
 */
function materializeStaticGroupLabelExpressionV2(template: string): string {
	if (I18N_PROPERTY_EXPRESSION.test(template.trim())) return `\${${template.trim()}}`;
	const keys = safeI18nKeys(template);
	return keys?.length === 1 && template.trim() === keys[0] ? `\${${template}}` : template;
}

type StaticGroupHostV2 = {
	node: ElementNode;
	sourceFile: string;
	key: string;
	stableId: string;
	labelTemplate: string;
	label: string;
	labelI18nKeys?: string[];
	conditions: string[];
	legacyMarkerAncestorIds: string[];
	reachabilitySpec?: StaticReachabilityGroupSpecV2;
};

type StaticGroupMetadataOverrideV2 = SettingsDerivedMetadataV2;

function staticGroupMetadataOverrideV2(
	persistence: SettingsPersistenceV2,
	saveMode: SettingsSaveModeV2,
	availability: SettingsAvailabilityV2,
	owner: SettingsOwnerV2,
	applicableUi: SettingsApplicableUiV2,
	evidence: string,
	storageRefs: readonly SettingsStorageRefV2[] = [],
): StaticGroupMetadataOverrideV2 {
	return {
		persistence,
		saveMode,
		availability,
		owner,
		applicableUi,
		...(storageRefs.length ? { storageRefs: [...storageRefs] } : {}),
		metadataEvidence: {
			persistence: evidence,
			saveMode: evidence,
			availability: evidence,
			owner: evidence,
			applicableUi: evidence,
		},
	};
}

/**
 * Static group hosts without an individual, same-host control need explicit
 * storage evidence.  This is intentionally a small source/stable-ID table:
 * an unknown dynamic group must fail, not inherit a route-wide `profile/all`
 * default and make the device-only filter lie.
 */
const STATIC_GROUP_METADATA_OVERRIDES_V2: Readonly<Record<string, StaticGroupMetadataOverrideV2>> = {
	'settings.group.hatafeed-theme': staticGroupMetadataOverrideV2(
		'device', 'immediate', 'all', 'hatasaba', 'all',
		'HataFeedのテーマは setHataFeedTheme が miLocalStorage の hatafeedTheme へ即時保存する',
		[{ kind: 'local', key: 'hatafeedTheme' }],
	),
	'settings.group.hatady-display-settings': staticGroupMetadataOverrideV2(
		'account', 'buffered', 'all', 'hatasaba', 'all',
		'Hatadyのテーマを明示保存する設定グループ。client/hatady:display が正本で、hatadyTheme は初期表示用の端末キャッシュ',
		[{ kind: 'registry', scope: ['client', 'hatady'], key: 'display' }, { kind: 'local', key: 'hatadyTheme' }],
	),
	// This is a category landing rather than a value itself. Its children are
	// intentionally mixed device/profile controls, so it cannot inherit one
	// child's storage. The explicit evidence keeps the UI filter honest: only
	// concrete child controls/groups advertise their own storage class.
	'settings.group.hatasaba-ui2-immediate': staticGroupMetadataOverrideV2(
		'profile', 'immediate', 'all', 'hatasaba', 'simple',
		'常設 Hataskey UI のカテゴリ入口。自身は値を保存せず、常設glassUi面のexact-one group hostへfocusする',
	),
	// The popup editor buffers every one of these fields and reloads only when
	// its existing save action completes. The runtime rows do not expose an
	// individual stable model, so their section owns this evidence.
	'settings.group.src-components-hatasabaui2settingsbody-vue-wroy7y': staticGroupMetadataOverrideV2(
		'profile', 'reload', 'all', 'hatasaba', 'simple',
		'UI2 draft の glassUiCardOpacity は prefer 保存後に既存UI2 save/reloadを通る',
		[{ kind: 'pref', key: 'simpleUi.glassUiCardOpacity' }],
	),
	'settings.group.src-components-hatasabaui2settingsbody-vue-itxj1w': staticGroupMetadataOverrideV2(
		'profile', 'reload', 'all', 'hatasaba', 'simple',
		'UI2 draft の上部ナビ並び替えは simpleUi.topNav を既存save/reload経路で保存する',
		[{ kind: 'pref', key: 'simpleUi.topNav' }],
	),
	'settings.group.src-components-hatasabaui2settingsbody-vue-1xtmw3e': staticGroupMetadataOverrideV2(
		'profile', 'reload', 'all', 'hatasaba', 'simple',
		'UI2 draft の下部ナビ並び替えは simpleUi.bottomNav を既存save/reload経路で保存する',
		[{ kind: 'pref', key: 'simpleUi.bottomNav' }],
	),
	'settings.group.src-pages-settings-external-account-vue-10ophv2': staticGroupMetadataOverrideV2(
		'profile', 'immediate', 'all', 'core', 'all',
		'外部TLのお気に入り絵文字は external.* preference の既存即時保存group',
		[{ kind: 'pref', key: 'external.favoriteEmojis' }],
	),
	'settings.group.src-pages-settings-hata-custom-vue-28qg9w': staticGroupMetadataOverrideV2(
		'profile', 'immediate', 'all', 'hatasaba', 'all',
		'旧「Hataskey全体」(旧称: 旗鯖全体)カテゴリの静的landing host。自身は値を変更せず、general内のprofile設定へ到達する',
	),
	'settings.group.src-pages-settings-hata-custom-vue-t8wtlz': staticGroupMetadataOverrideV2(
		'profile', 'immediate', 'all', 'hatasaba', 'all',
		'旧「UI」カテゴリの静的landing host。自身は値を変更せず、glassUi設定への到達だけを担う',
	),
	'settings.group.src-pages-settings-hidden-reactions-manage-vue-613pvu': staticGroupMetadataOverrideV2(
		'device', 'immediate', 'all', 'core', 'all',
		'非表示リアクションの動的集合は端末local storageを即時更新する',
		[{ kind: 'local', key: 'hiddenReactions' }],
	),
	'settings.group.src-pages-settings-migration-vue-bnr9op': staticGroupMetadataOverrideV2(
		'account', 'buffered', 'all', 'core', 'all',
		'アカウント移行先は i/update へ明示保存する下書きgroup',
		[{ kind: 'api', endpoint: 'i/update' }],
	),
	'settings.group.src-pages-settings-mute-block-vue-q1f52r': staticGroupMetadataOverrideV2(
		'account', 'immediate', 'all', 'core', 'all',
		'リノートミュートの動的一覧は既存アカウントAPIで即時更新する',
	),
	'settings.group.src-pages-settings-mute-block-vue-12mr3a': staticGroupMetadataOverrideV2(
		'account', 'immediate', 'all', 'core', 'all',
		'ミュートの動的一覧は既存アカウントAPIで即時更新する',
	),
	'settings.group.src-pages-settings-mute-block-vue-1slhga5': staticGroupMetadataOverrideV2(
		'account', 'immediate', 'all', 'core', 'all',
		'ブロックの動的一覧は既存アカウントAPIで即時更新する',
	),
	'settings.group.src-pages-settings-preferences-vue-pu703b': staticGroupMetadataOverrideV2(
		'device', 'immediate', 'all', 'core', 'all',
		'追加絵文字辞書の実行時コレクションは Pizzax base の端末値を即時更新する',
		[{ kind: 'pizzax', store: 'base', key: 'additionalUnicodeEmojiIndexes', scope: 'device' }],
	),
};

/**
 * These two groups are not inferred from a broad route. Their rows are
 * dynamic or v-for based, so the storage write is recorded beside the exact
 * static, user-visible host that contains it.
 */
function sourceScopedStaticGroupMetadataV2(host: StaticGroupHostV2): StaticGroupMetadataOverrideV2 | undefined {
	if (host.reachabilitySpec?.stableId === 'settings.group.note-charm-pattern') {
		return staticGroupMetadataOverrideV2(
			'account', 'buffered', 'all', 'hatasaba', 'all',
			'模様のradio選択肢はdraft.patternを編集し、save()がi/update.noteCharmへ明示保存する',
			[{ kind: 'api', endpoint: 'i/update', fields: ['noteCharm'] }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.concrnt-connection-settings') {
		return staticGroupMetadataOverrideV2(
			'device', 'immediate', 'all', 'hatasaba', 'all',
			'Concrntの連携設定は独立した端末IndexedDBに保持する。検索は常設設定画面へ移動し、認証・連携・カプセル選択を自動実行しない',
			[{ kind: 'indexeddb', database: 'HataskeyConcrnt', store: 'private', key: '${encodeURIComponent(owner)}:connection', fields: ['settings'] }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.preference-profile-backups') {
		return staticGroupMetadataOverrideV2(
			'account', 'immediate', 'all', 'core', 'all',
			'クラウド設定プロファイルの実行時一覧は i/registry/remove で既存アカウントのbackupを削除する',
			[{ kind: 'api', endpoint: 'i/registry/remove', fields: ['client/preferences/backups'] }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.external-favorite-emoji-settings') {
		return staticGroupMetadataOverrideV2(
			'profile', 'immediate', 'all', 'core', 'all',
			'外部アカウントのお気に入り絵文字の実行時一覧は external.favoriteEmojis preference へ即時保存する',
			[{ kind: 'pref', key: 'external.favoriteEmojis' }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.mascot-runtime-settings') {
		return staticGroupMetadataOverrideV2(
			'profile', 'immediate', 'all', 'hatasaba', 'all',
			'マスコットの実行時キャラクター・表情・文言は hataMascot.displaySettings registry へ保存する',
			[{ kind: 'registry', scope: ['client', 'hataMascot'], key: 'displaySettings' }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.security-key-runtime-settings') {
		return staticGroupMetadataOverrideV2(
			'account', 'immediate', 'all', 'core', 'all',
			'セキュリティキーの登録・名称変更・削除は i/2fa/register-key・update-key・remove-key の既存アカウントAPIで保存する',
			[{ kind: 'api', endpoint: 'i/2fa/update-key' }, { kind: 'api', endpoint: 'i/2fa/remove-key' }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.avatar-decoration-adjustment') {
		return staticGroupMetadataOverrideV2(
			'account', 'immediate', 'all', 'core', 'all',
			'選択済みアバター装飾の角度・位置・拡大縮小・不透明度は親の i/update.avatarDecorations 経路で保存する',
			[{ kind: 'api', endpoint: 'i/update', fields: ['avatarDecorations'] }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.notification-receive-config') {
		return staticGroupMetadataOverrideV2(
			'account', 'immediate', 'all', 'core', 'all',
			'通知種類ごとの受信条件は親 notifications.vue の i/update.notificationRecieveConfig 経路で保存する',
			[{ kind: 'api', endpoint: 'i/update', fields: ['notificationRecieveConfig'] }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.statusbar-runtime-settings') {
		return staticGroupMetadataOverrideV2(
			'profile', 'immediate', 'all', 'core', 'all',
			'選択済みステータスバーの動的行は prefer.commit(statusbars) でprofileへ保存する',
			[{ kind: 'pref', key: 'statusbars' }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.sound-event-config') {
		return staticGroupMetadataOverrideV2(
			'profile', 'immediate', 'all', 'core', 'all',
			'サウンドイベントごとの動的行は親 sounds.vue の prefer.commit(sound.on.*) でprofileへ保存する',
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.word-mute-runtime-settings') {
		return staticGroupMetadataOverrideV2(
			'account', 'immediate', 'all', 'core', 'all',
			'ソフト・ハードワードミュートは親 mute-block.vue のアカウント更新経路で保存する',
			[{ kind: 'api', endpoint: 'i/update', fields: ['mutedWords', 'hardMutedWords'] }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.instance-mute-settings') {
		return staticGroupMetadataOverrideV2(
			'account', 'immediate', 'all', 'core', 'all',
			'インスタンスミュートは既存 i/update.mutedInstances 経路で保存する',
			[{ kind: 'api', endpoint: 'i/update', fields: ['mutedInstances'] }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.watermark-presets') {
		return staticGroupMetadataOverrideV2(
			'profile', 'immediate', 'all', 'core', 'all',
			'透かしpresetの追加・編集・削除は親 drive.vue の watermarkPresets preference 保存経路で更新する',
			[{ kind: 'pref', key: 'watermarkPresets' }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.emoji-palette-runtime-settings') {
		return staticGroupMetadataOverrideV2(
			'profile', 'immediate', 'all', 'core', 'all',
			'絵文字パレットの追加・名称・並びは親 emoji-palette.vue の emojiPalettes preference 保存経路で更新する',
			[{ kind: 'pref', key: 'emojiPalettes' }],
		);
	}
	if (host.reachabilitySpec?.stableId === 'settings.group.webhook-management') {
		return staticGroupMetadataOverrideV2(
			'account', 'buffered', 'all', 'core', 'all',
			'Webhookの作成・編集は選択済みWebhookを i/webhooks/create・update へ明示保存する。管理group自身は選択・保存を実行しない',
			[{ kind: 'api', endpoint: 'i/webhooks/update' }, { kind: 'api', endpoint: 'i/webhooks/create' }],
		);
	}
	const labels = new Set(host.labelI18nKeys ?? []);
	if (host.sourceFile === 'src/pages/settings/accounts.vue' && labels.has('i18n.ts.accounts')) {
		return staticGroupMetadataOverrideV2(
			'profile', 'immediate', 'all', 'core', 'all',
			'アカウント切替・追加・削除の動的一覧は src/accounts.ts の prefer.commit(accounts) で保存する',
			[{ kind: 'pref', key: 'accounts' }],
		);
	}
	if (host.sourceFile === 'src/pages/settings/hata-custom.vue' && labels.has('i18n.ts._hata._customSettings._visual.noteSpacing')) {
		return staticGroupMetadataOverrideV2(
			'profile', 'immediate', 'all', 'hatasaba', 'all',
			'ノート間隔のv-for選択肢は simpleUi.noteSpacing を prefer.model で即時保存する',
			[{ kind: 'pref', key: 'simpleUi.noteSpacing' }],
		);
	}
	return undefined;
}

function metadataForStaticGroupV2(
	host: StaticGroupHostV2,
	controls: readonly SettingsControlSearchDescriptorV2[],
	raw: readonly SettingsInteractiveInventoryItemV2[],
	target: SettingsControlSearchTargetMetadataV2,
): SettingsDerivedMetadataV2 {
	const override = STATIC_GROUP_METADATA_OVERRIDES_V2[host.stableId] ?? sourceScopedStaticGroupMetadataV2(host);
	if (override != null) return override;
	const rawMembers = raw.filter(item => item.staticGroupKey === host.key);
	// An implicit group exists because at least one child cannot receive a stable
	// direct descriptor (usually a v-for row). Its storage metadata must describe
	// that represented runtime concept, not every unrelated direct control under
	// the same broad SearchMarker. Otherwise a device-only dark-mode switch made
	// the profile-backed theme-choice group look like a mixed persistence value.
	const unavailableLines = new Set(rawMembers
		.filter(item => item.classification === 'runtime-collection'
			|| !controls.some(control => control.sourceLine === item.sourceLine && control.searchable))
		.map(item => item.sourceLine));
	const lines = unavailableLines.size > 0
		? unavailableLines
		: new Set(rawMembers.map(item => item.sourceLine));
	const members = controls.filter(control => lines.has(control.sourceLine));
	if (members.length === 0) {
		// A raw native/runtime fixture (and any future intentionally-grouped raw
		// control) may have no direct descriptor from which to derive storage.
		// Permit it only when the target declares the full metadata contract; do
		// not smuggle in profile/immediate/all defaults for a real source.
		if (target.persistence != null && target.saveMode != null && target.availability != null && target.owner != null && target.applicableUi != null) {
			return staticGroupMetadataOverrideV2(
				target.persistence,
				target.saveMode,
				target.availability,
				target.owner,
				target.applicableUi,
				`target明示metadata: ${host.sourceFile} のraw/static group ${host.stableId} は個別descriptorを持たない`,
			);
		}
		throw new Error(`settings V2 missing static group metadata evidence: ${host.stableId}`);
	}
	const values = <T,>(field: (member: SettingsControlSearchDescriptorV2) => T): T[] => [...new Set(members.map(field))];
	const [persistence] = values(member => member.persistence);
	const [saveMode] = values(member => member.saveMode);
	const [availability] = values(member => member.availability);
	const [owner] = values(member => member.owner);
	const [applicableUi] = values(member => JSON.stringify(member.applicableUi));
	if (values(member => member.persistence).length !== 1
		|| values(member => member.saveMode).length !== 1
		|| values(member => member.availability).length !== 1
		|| values(member => member.owner).length !== 1
		|| values(member => JSON.stringify(member.applicableUi)).length !== 1) {
		throw new Error(`settings V2 mixed static group metadata requires an explicit override: ${host.stableId} (${members.map(member => `${member.stableId}:${member.persistence}/${member.saveMode}/${member.availability}/${member.owner}/${JSON.stringify(member.applicableUi)}`).join(', ')})`);
	}
	const storageRefs = members.flatMap(member => member.storageRefs ?? []);
	const evidence = `同一静的groupの${members.length}件のcontrolから導出: ${members.map(member => member.stableId).join(', ')}`;
	return staticGroupMetadataOverrideV2(
		persistence!, saveMode!, availability!, owner!, JSON.parse(applicableUi!) as SettingsApplicableUiV2,
		evidence,
		storageRefs,
	);
}

function staticAttributeValue(node: ElementNode, name: string): string | undefined {
	const attribute = findAttribute(node.props, name);
	return attribute?.type === NodeTypes.ATTRIBUTE ? attribute.value?.content : undefined;
}

function staticGroupStableId(sourceFile: string, key: string, node: ElementNode): string {
	const explicit = staticAttributeValue(node, 'data-settings-search-group-id');
	if (explicit != null) {
		if (!/^settings\.group\.[A-Za-z0-9._:-]+$/u.test(explicit)) throw new Error(`settings V2 data-settings-search-group-id must be a stable group id at ${sourceFile}:${node.loc.start.line}`);
		return explicit;
	}
	// A product-owned static related host is already the exact semantic DOM
	// target. Reuse that ID instead of inventing a second generated one: this
	// preserves a one-descriptor/one-host invariant and lets the transform add
	// the matching focus ID without changing the source SFC.
	const relatedHost = staticAttributeValue(node, 'data-settings-related-host');
	if (relatedHost != null) {
		if (!/^settings\.group\.[A-Za-z0-9._:-]+$/u.test(relatedHost)) throw new Error(`settings V2 data-settings-related-host must be a stable group id at ${sourceFile}:${node.loc.start.line}`);
		return relatedHost;
	}
	return `settings.group.${slug(sourceFile)}-${shortStableHash(key)}`;
}

function staticGroupHeadingTemplates(nodes: readonly ElementNode[], aliases: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
	const headings = new Map<string, string>();
	for (const node of nodes) {
		const id = staticAttributeValue(node, 'id');
		if (id == null) continue;
		const text = canonicalizeTemplate(textTemplate(node.children), aliases);
		if (text) headings.set(id, text);
	}
	return headings;
}

function staticGroupLabelTemplate(
	node: ElementNode,
	headings: ReadonlyMap<string, string>,
	aliases: ReadonlyMap<string, string>,
): string {
	const labelledBy = staticAttributeValue(node, 'aria-labelledby');
	const fallback = labelledBy == null ? undefined : STATIC_GROUP_LABEL_OVERRIDES[labelledBy];
	const heading = labelledBy == null ? undefined : headings.get(labelledBy);
	// `editor.copy.*` is intentionally not executable at build time. When the
	// product owns a static heading ID, prefer its audited literal fallback over
	// pretending that this dynamic proxy is a safe searchable label.
	const safeHeading = heading != null && safeI18nKeys(heading) != null ? heading : undefined;
	const template = namedSlotTemplate(node, 'label')
		|| templateOfAttribute(findAttribute(node.props, 'label'))
		|| safeHeading
		|| fallback
		|| (node.tag === 'SearchMarker' ? markerLabelTemplate(node) : undefined)
		|| '';
	return canonicalizeTemplate(template, aliases);
}

function staticGroupAliasesV2(host: Pick<StaticGroupHostV2, 'node' | 'reachabilitySpec'>): string[] {
	const spec = host.reachabilitySpec;
	if (spec != null) return [...spec.aliases];
	const labelledBy = staticAttributeValue(host.node, 'aria-labelledby');
	return labelledBy == null ? [] : [...(STATIC_GROUP_ALIASES[labelledBy] ?? [])];
}

function staticGroupPrimaryAliasesV2(host: Pick<StaticGroupHostV2, 'node' | 'reachabilitySpec'>): string[] {
	const labelledBy = staticAttributeValue(host.node, 'aria-labelledby');
	return labelledBy == null ? [] : [...(STATIC_GROUP_PRIMARY_ALIASES[labelledBy] ?? [])];
}

function groupActivation(
	activation: SettingsControlActivationV2 | undefined,
	stableId: string,
): SettingsControlActivationV2 | undefined {
	const focused = withActivationFocus(activation, stableId);
	return focused == null ? undefined : { ...focused, focus: { kind: 'group', id: stableId } };
}

/**
 * A normal route can contain a control behind a choice, policy, or runtime
 * datum. Keep the individual result searchable, but use the enclosing static
 * group as the focus target instead of trying to mutate the prerequisite.
 */
function conditionNeedsStaticParentFocusV2(
	control: Pick<SettingsControlSearchDescriptorV2, 'stableId' | 'conditions' | 'activation' | 'searchable' | 'isGroup'>,
): boolean {
	if (!control.searchable) return false;
	// This reviewed runtime-radio group has the same canEdit prerequisite as
	// individual controls and must participate in the static-focus audit.
	if (control.isGroup === true && control.stableId !== 'settings.group.note-charm-pattern') return false;
	// Activation opens only its exact category/popup surface. It must not mask
	// a second v-if inside it (consent, selected character, policy, runtime row,
	// and so on), but the category selector itself is a verified prerequisite
	// that search has already satisfied without changing a preference.
	return control.conditions.some(condition => !conditionIsMountedByActivationV2(condition, control.activation));
}

function conditionIsMountedByActivationV2(
	condition: string,
	activation: SettingsControlActivationV2 | undefined,
): boolean {
	const normalized = condition.replace(/\s+/gu, '');
	// The signed-in settings shell owns this invariant; it is not a
	// user-selectable prerequisite whose absence should change focus.
	if (normalized === '$i' || normalized === 'true') return true;
	if (activation?.kind !== 'hata-custom-category') return false;
	const category = /^(?:\()?activeCat===['"](general|font|glassUi|visual|hatask|hatady|mascot|earthquake|accessibility)['"](?:\))?$/u.exec(normalized)?.[1];
	return category === activation.category;
}

function staticHostIsAlwaysMountedV2(
	conditions: readonly string[],
	activation?: SettingsControlActivationV2,
): boolean {
	return conditions.every(condition => conditionIsMountedByActivationV2(condition, activation));
}

function staticFocusHostForConditionalControlV2(
	control: Pick<SettingsControlSearchDescriptorV2, 'sourceLine' | 'activation'>,
	nearestStaticGroup: StaticGroupHostV2 | undefined,
	allHosts: readonly StaticGroupHostV2[],
): StaticGroupHostV2 | undefined {
	if (nearestStaticGroup != null && staticHostIsAlwaysMountedV2(nearestStaticGroup.conditions, control.activation)) return nearestStaticGroup;
	// `staticGroupContext` deliberately returns only labelled semantic hosts.
	// A popup/card root may be the first safe host when a conditional control is
	// wrapped in plain div/template elements, so fall back to a registered host
	// that structurally contains the source node.  The shortest source span is
	// the nearest stable ancestor; no source line participates in its ID.
	return allHosts
		.filter(host => staticHostIsAlwaysMountedV2(host.conditions, control.activation)
			&& host.node.loc.start.line <= control.sourceLine
			&& host.node.loc.end.line >= control.sourceLine)
		.sort((left, right) => {
			const leftSpan = left.node.loc.end.line - left.node.loc.start.line;
			const rightSpan = right.node.loc.end.line - right.node.loc.start.line;
			return leftSpan - rightSpan;
		})[0];
}

function withConditionalParentFocusV2(
	activation: SettingsControlActivationV2 | undefined,
	focusId: string,
	unmet: readonly SettingsActivationUnmetV2[],
): SettingsControlActivationV2 | undefined {
	if (activation == null) return undefined;
	const existing = activation.unmet ?? [];
	const mergedUnmet = [...existing];
	for (const item of unmet) {
		if (!mergedUnmet.some(candidate => candidate.kind === item.kind && candidate.id === item.id && candidate.behavior === item.behavior)) {
			mergedUnmet.push(item);
		}
	}
	// Navigation resolves activation.focus before a descriptor-level focusId.
	// Keep both values in sync so an activated-but-hidden control cannot win
	// over the verified static group fallback.
	return {
		...activation,
		focus: { kind: 'group', id: focusId },
		...(mergedUnmet.length ? { unmet: mergedUnmet } : {}),
	};
}

function unmetForConditionalControlV2(
	sourceFile: string,
	conditions: readonly string[],
): SettingsActivationUnmetV2[] {
	const condition = conditions.join(' ');
	if (sourceFile === 'src/components/MkNoteCharmSettings.vue' && /\bcanEdit\b/u.test(condition)) {
		return [{ kind: 'policy', id: 'note-charm-role-and-ui', behavior: 'explain' }];
	}
	if (sourceFile === 'src/components/concrnt/ConcrntSettings.vue') {
		return [{ kind: 'runtime-data', id: 'concrnt-account-and-section', behavior: 'explain' }];
	}
	if (sourceFile === 'src/pages/settings/2fa.vue') {
		return [{ kind: 'preference', id: 'two-factor-authentication', behavior: 'explain' }];
	}
	if (sourceFile === 'src/pages/settings/external-account.vue') {
		return [{ kind: 'preference', id: 'external-account-link', behavior: 'explain' }];
	}
	if (sourceFile === 'src/pages/settings/preferences.vue' && /searchEngine/u.test(condition)) {
		return [{ kind: 'preference', id: 'search-engine-other', behavior: 'explain' }];
	}
	if (sourceFile === 'src/pages/settings/preferences.vue' && /useBlurEffect.*modal|modal.*useBlurEffect/u.test(condition)) {
		return [{ kind: 'runtime-data', id: 'modal-background-option', behavior: 'explain' }];
	}
	if (sourceFile === 'src/pages/settings/privacy.vue') {
		return [{ kind: 'preference', id: 'privacy-selection', behavior: 'explain' }];
	}
	if (sourceFile === 'src/pages/settings/email.vue') {
		return [{ kind: 'policy', id: 'email-availability', behavior: 'explain' }];
	}
	if (sourceFile === 'src/pages/settings/mute-block.vue') {
		return [{ kind: 'policy', id: 'instance-federation', behavior: 'explain' }];
	}
	if (sourceFile === 'src/pages/settings/drive.vue') {
		return [{ kind: 'policy', id: 'drive-feature-availability', behavior: 'explain' }];
	}
	return [{ kind: 'runtime-data', id: 'conditional-setting', behavior: 'explain' }];
}

export function collectStaticGroupHostsV2(
	sourceFile: string,
	code: string,
	target: SettingsControlSearchTargetMetadataV2,
): StaticGroupHostV2[] {
	const parsed = parseTargetSfc(sourceFile, code);
	if (parsed.descriptor.template?.ast == null) return [];
	const aliases = staticI18nAliases(sourceFile, parsed.descriptor.scriptSetup?.content);
	const nodes = collectElementNodes(parsed.descriptor.template.ast.children);
	const headings = staticGroupHeadingTemplates(nodes, aliases);
	const hosts: StaticGroupHostV2[] = [];
	const keys = new Set<string>();
	const walk = (children: TemplateChildNode[], conditions: string[], markerAncestors: string[], rootChildren = false): void => {
		for (const child of children) {
			if (child.type !== NodeTypes.ELEMENT) continue;
			const condition = directiveExpression(child, 'if') ?? directiveExpression(child, 'else-if') ?? directiveExpression(child, 'for');
			const nextConditions = condition == null ? conditions : [...conditions, condition];
			const nextMarkerAncestors = child.tag === 'SearchMarker'
				? [...markerAncestors, markerIdFor(child, sourceFile)]
				: markerAncestors;
			const preliminaryTemplate = staticGroupLabelTemplate(child, headings, aliases);
			const preliminaryLabelI18nKeys = safeI18nKeys(preliminaryTemplate) ?? [];
			const reachabilitySpec = staticReachabilityGroupSpecV2(sourceFile, child, rootChildren, preliminaryLabelI18nKeys);
			if (STATIC_GROUP_TAGS.has(child.tag) || reachabilitySpec != null) {
				const key = staticGroupKeyForNode(sourceFile, child);
				const labelTemplate = reachabilitySpec?.labelExpression ?? preliminaryTemplate;
				const labelI18nKeys = reachabilitySpec?.labelI18nKeys ?? safeI18nKeys(labelTemplate);
				const label = literalPart(labelTemplate);
				// A section with page-local/unsafe copy cannot become a searchable
				// host. Its raw members are retained with a reasoned exclusion instead.
				if (labelTemplate !== '' && labelI18nKeys != null && !keys.has(key)) {
					keys.add(key);
						hosts.push({
							node: child,
							sourceFile,
							key,
							stableId: reachabilitySpec?.stableId ?? staticGroupStableId(sourceFile, key, child),
							labelTemplate,
							label,
							...(labelI18nKeys.length ? { labelI18nKeys } : {}),
							conditions: nextConditions,
							legacyMarkerAncestorIds: nextMarkerAncestors,
							...(reachabilitySpec ? { reachabilitySpec } : {}),
						});
				}
			}
			walk(child.children, nextConditions, nextMarkerAncestors);
		}
	};
	walk(parsed.descriptor.template.ast.children, [], [], true);
	return hosts;
}

/**
 * Materialise only semantic static section hosts which are represented by a
 * user-facing control or runtime collection.  The descriptor is a genuine
 * catalog item (not just audit metadata), so its focus ID has exactly one
 * injected DOM host.
 */
export function collectSettingsSearchDescriptorsV2(
	sourceFile: string,
	code: string,
	routes: ReadonlyMap<string, string>,
	target: SettingsControlSearchTargetMetadataV2 = {},
): SettingsControlSearchDescriptorV2[] {
	const controls = collectSettingsControlDescriptorsV2(sourceFile, code, routes, target);
	const route = routeForFile(sourceFile, new Map(routes), target);
	if (excludedDynamicSettingsRouteReason(route) != null) return controls;
	const raw = collectSettingsInteractiveInventoryV2(sourceFile, code);
	const hostsByKey = new Map(collectStaticGroupHostsV2(sourceFile, code, target).map(host => [host.key, host]));
	const searchableControlLocations = new Set(controls.filter(control => control.searchable).map(control => `${control.sourceFile}:${control.sourceLine}`));
	const relevantGroupKeys = new Set(raw
		.filter(item => (item.classification === 'user-facing-setting' || item.classification === 'runtime-collection')
			&& !searchableControlLocations.has(`${item.sourceFile}:${item.sourceLine}`))
		.flatMap(item => item.staticGroupKey == null ? [] : [item.staticGroupKey]));
	const rawByLocation = new Map(raw.map(item => [`${item.sourceFile}:${item.sourceLine}`, item]));
	// Product-owned hosts which have already declared a stable group ID are a
	// deliberate search section even when their child control is direct.  Other
	// ordinary FormSection/MkFolder controls stay individual to avoid a second,
	// redundant search result for every row.
	for (const host of hostsByKey.values()) {
		if (host.reachabilitySpec?.materialize !== false && host.reachabilitySpec != null) relevantGroupKeys.add(host.key);
		if (staticAttributeValue(host.node, 'data-settings-search-group-id') != null) relevantGroupKeys.add(host.key);
		// A section with a deliberately-audited primary alias (for example the
		// two header-blur controls) is a real semantic destination in addition
		// to its individual controls. Ordinary FormSection rows do not take this
		// path, so direct controls are never doubled just for a broad heading.
		if (staticGroupPrimaryAliasesV2(host).length > 0) relevantGroupKeys.add(host.key);
		// A historic category label has no standalone route. Materialise only its
		// audited static landing host so an old query can activate the correct
		// category and focus a real DOM node.
		if (hataCustomLegacyCategoryShortcutV2(sourceFile, host) != null) relevantGroupKeys.add(host.key);
	}
	const relevantHosts = [...hostsByKey.values()].filter(host => relevantGroupKeys.has(host.key));
	const groups: SettingsControlSearchDescriptorV2[] = relevantHosts.map(host => {
			const categoryShortcut = hataCustomLegacyCategoryShortcutV2(sourceFile, host);
			const activation = groupActivation(categoryShortcut == null
				? target.activation ?? hataCustomConditionActivation(sourceFile, host.conditions)
				: { kind: 'hata-custom-category', category: categoryShortcut.category }, host.stableId);
			const sourceSemanticGroupId = host.reachabilitySpec?.sourceSemanticGroupId ?? explicitFeatureSemanticGroupForHostV2(sourceFile, host);
			const metadata = metadataForStaticGroupV2(host, controls, raw, target);
			const labelExpression = materializeStaticGroupLabelExpressionV2(host.labelTemplate);
			return {
				stableId: host.stableId,
				route: route ?? '/settings',
				sourceFile,
				sourceLine: host.node.loc.start.line,
				component: 'SettingsGroup',
				label: host.label,
				...(labelExpression !== host.label ? { labelExpression } : {}),
				...(host.labelI18nKeys?.length ? { labelI18nKeys: host.labelI18nKeys } : {}),
				...((staticGroupAliasesV2(host).length || categoryShortcut != null) ? {
					aliases: [...new Set([...staticGroupAliasesV2(host), ...(categoryShortcut?.aliases ?? [])])],
				} : {}),
				...((staticGroupPrimaryAliasesV2(host).length || categoryShortcut != null) ? {
					primaryAliases: [...new Set([...staticGroupPrimaryAliasesV2(host), ...(categoryShortcut?.primaryAliases ?? [])])],
				} : {}),
				preferenceKeys: [],
				staticGroupKey: host.key,
				...(sourceSemanticGroupId ? { sourceSemanticGroupId } : {}),
				legacyMarkerAncestorIds: host.legacyMarkerAncestorIds,
				conditions: host.conditions,
				...(activation ? { activation } : {}),
				...(host.reachabilitySpec?.unmet?.length ? { unmet: [...host.reachabilitySpec.unmet] } : {}),
				...metadata,
				relatedHostId: host.stableId,
				searchable: true,
				isGroup: true,
				destructive: false,
			} satisfies SettingsControlSearchDescriptorV2;
		});
	const groupByKey = new Map(relevantHosts.map((host, index) => [host.key, groups[index]!]));
	for (const control of controls) {
		const item = rawByLocation.get(`${control.sourceFile}:${control.sourceLine}`);
		const host = item?.staticGroupKey == null ? undefined : hostsByKey.get(item.staticGroupKey);
		const group = item?.staticGroupKey == null ? undefined : groupByKey.get(item.staticGroupKey);
		// A host key is semantic evidence even when it is not itself exposed as a
		// separate result.  This preserves relatedness among sibling controls
		// without manufacturing a redundant group card.
		if (group != null) control.semanticGroupId = group.stableId;
		else if (host != null) control.semanticGroupId = `settings.semantic.${shortStableHash(host.key)}`;
		const sourceSemanticGroupId = explicitFeatureSemanticGroupV2(
			sourceFile,
			control.modelExpression,
			control.preferenceKeys,
			`${control.labelExpression ?? control.label} ${(control.labelI18nKeys ?? []).join(' ')}`,
		);
		if (sourceSemanticGroupId != null) {
			// Keep exact static-host evidence as the primary relation. The feature
			// scope is a lower-priority, audited fallback for isolated siblings.
			if (control.semanticGroupId == null) control.semanticGroupId = sourceSemanticGroupId;
			else control.sourceSemanticGroupId = sourceSemanticGroupId;
		}
		const focusHost = conditionNeedsStaticParentFocusV2(control)
			? staticFocusHostForConditionalControlV2(control, host, [...hostsByKey.values()])
			: undefined;
		if (focusHost != null) {
			const unmet = unmetForConditionalControlV2(sourceFile, control.conditions);
			control.focusId = focusHost.stableId;
			control.focusHostSourceFile = focusHost.sourceFile;
			control.focusHostSourceLine = focusHost.node.loc.start.line;
			control.focusHostConditions = [...focusHost.conditions];
			control.unmet = unmet;
			control.activation = withConditionalParentFocusV2(control.activation, focusHost.stableId, unmet);
		} else if (conditionNeedsStaticParentFocusV2(control)) {
			const crossSourceParent = CROSS_SOURCE_STATIC_PARENT_FOCUS_V2[sourceFile];
			if (crossSourceParent != null) {
				control.focusId = crossSourceParent.stableId;
				control.focusHostSourceFile = crossSourceParent.sourceFile;
				control.focusHostConditions = [];
				control.unmet = [...crossSourceParent.unmet];
				control.activation = withConditionalParentFocusV2(control.activation, crossSourceParent.stableId, crossSourceParent.unmet);
			}
		}
	}
	for (const group of groups.filter(candidate => candidate.stableId === 'settings.group.note-charm-pattern')) {
		if (!conditionNeedsStaticParentFocusV2(group)) continue;
		const focusHost = staticFocusHostForConditionalControlV2(group, undefined, [...hostsByKey.values()]);
		if (focusHost == null) throw new Error('settings V2 note charm pattern has no static parent focus');
		const unmet = unmetForConditionalControlV2(sourceFile, group.conditions);
		group.focusId = focusHost.stableId;
		group.focusHostSourceFile = focusHost.sourceFile;
		group.focusHostSourceLine = focusHost.node.loc.start.line;
		group.focusHostConditions = [...focusHost.conditions];
		group.unmet = unmet;
		group.activation = withConditionalParentFocusV2(group.activation, focusHost.stableId, unmet);
	}
	return [...controls, ...groups];
}

type ParentContainedVocabularySourceV2 = {
	sourceFile: string;
	parentGroupId: string;
};

function parentContainedVocabularySourcesV2(): ParentContainedVocabularySourceV2[] {
	return [...new Map([
		...Object.entries(DYNAMIC_CHILD_REACHABILITY_V2),
		...Object.entries(PARENT_CONTAINED_VOCABULARY_V2),
	]
		.filter((entry): entry is [string, DynamicChildReachabilityV2] => entry[1].parentGroupId != null)
		.map(([sourceFile, reachability]) => [sourceFile, {
			sourceFile,
			parentGroupId: reachability.parentGroupId!,
		}] as const))
		.values()];
}

function mergeParentContainedVocabularyV2(
	parent: SettingsControlSearchDescriptorV2,
	children: readonly SettingsControlSearchDescriptorV2[],
	extra: { aliases: readonly string[]; aliasI18nKeys: readonly string[]; preferenceKeys: readonly string[] },
): void {
	const aliases = new Set(parent.aliases ?? []);
	const aliasI18nKeys = new Set(parent.aliasI18nKeys ?? []);
	const preferenceKeys = new Set([
		...parent.preferenceKeys,
		...(parent.storageRefs ?? []).flatMap(ref => ref.kind === 'pref' || ref.kind === 'pizzax' || ref.kind === 'local' ? [ref.key] : []),
	]);
	for (const child of children) {
		// The extracted descriptor already rejected dynamic/executable label
		// expressions. Preserve only literal user-facing copy and approved i18n
		// property keys; model expressions such as `editor.draft.*` never become
		// relation/search vocabulary through this path.
		for (const value of [child.label, child.caption ?? '', ...(child.aliases ?? [])]) {
			const normalized = value.replace(/\s+/gu, ' ').trim();
			if (normalized) aliases.add(normalized);
		}
		for (const key of [
			...(child.labelI18nKeys ?? []),
			...(child.captionI18nKeys ?? []),
			...(child.aliasI18nKeys ?? []),
		]) aliasI18nKeys.add(key);
		for (const key of child.preferenceKeys) preferenceKeys.add(key);
	}
	for (const value of extra.aliases) aliases.add(value);
	for (const key of extra.aliasI18nKeys) aliasI18nKeys.add(key);
	for (const key of extra.preferenceKeys) preferenceKeys.add(key);
	parent.aliases = [...aliases].sort((left, right) => left.localeCompare(right));
	parent.aliasI18nKeys = [...aliasI18nKeys].sort((left, right) => left.localeCompare(right));
	parent.preferenceKeys = [...preferenceKeys].sort((left, right) => left.localeCompare(right));
}

const PARENT_CONTAINED_VOCABULARY_TAGS_V2 = new Set([
	...INTERACTIVE_COMPONENTS,
	'FormLink', 'MkFolder', 'FormSection', 'FormSlot',
]);

function collectSafeParentContainedVocabularyV2(
	sourceFile: string,
	code: string,
	routes: ReadonlyMap<string, string>,
	parentRoute: string,
): { aliases: string[]; aliasI18nKeys: string[]; preferenceKeys: string[]; descriptors: SettingsControlSearchDescriptorV2[] } {
	const parsed = parseTargetSfc(sourceFile, code);
	if (parsed.descriptor.template?.ast == null) return { aliases: [], aliasI18nKeys: [], preferenceKeys: [], descriptors: [] };
	const aliases = staticI18nAliases(sourceFile, parsed.descriptor.scriptSetup?.content);
	const literalAliases = new Set<string>();
	const aliasI18nKeys = new Set<string>();
	const addTemplate = (template: string): void => {
		if (template === '') return;
		const canonical = canonicalizeTemplate(template, aliases);
		const keys = safeI18nKeys(canonical);
		// A parent group may inherit only static copy or i18n property chains.
		// Do not turn selected preset names, arbitrary URLs, or handler
		// expressions into global search vocabulary.
		if (keys == null) return;
		const literal = literalPart(canonical).replace(/\s+/gu, ' ').trim();
		if (literal) literalAliases.add(literal);
		for (const key of keys) aliasI18nKeys.add(key);
	};
	const walk = (nodes: readonly TemplateChildNode[]): void => {
		for (const node of nodes) {
			if (node.type !== NodeTypes.ELEMENT) continue;
			if (PARENT_CONTAINED_VOCABULARY_TAGS_V2.has(node.tag)) {
				addTemplate(namedSlotTemplate(node, 'label'));
				addTemplate(namedSlotTemplate(node, 'caption'));
				if (INTERACTIVE_COMPONENTS.has(node.tag) || node.tag === 'FormLink') addTemplate(textTemplate(node.children));
			}
			walk(node.children);
		}
	};
	walk(parsed.descriptor.template.ast.children);
	const descriptors = collectSettingsControlDescriptorsV2(sourceFile, code, routes, { routeOverride: parentRoute });
	return {
		aliases: [...literalAliases].sort((left, right) => left.localeCompare(right)),
		aliasI18nKeys: [...aliasI18nKeys].sort((left, right) => left.localeCompare(right)),
		preferenceKeys: [...new Set(descriptors.flatMap(descriptor => descriptor.preferenceKeys))].sort((left, right) => left.localeCompare(right)),
		descriptors,
	};
}

/**
 * Runtime row children and popup editors are intentionally not focus targets:
 * a child can be rendered zero times, many times, or only after the user has
 * selected data. Their safe static vocabulary must nevertheless remain
 * searchable. This moves every resolved label/caption/preference key onto the
 * one audited, always-mounted parent group without creating a dead child
 * descriptor or evaluating page-local expressions.
 */
export async function aggregateParentContainedSettingsVocabularyV2(
	root: string,
	routes: ReadonlyMap<string, string>,
	descriptors: readonly SettingsControlSearchDescriptorV2[],
): Promise<SettingsControlSearchDescriptorV2[]> {
	const copied = descriptors.map(descriptor => ({
		...descriptor,
		...(descriptor.aliases != null ? { aliases: [...descriptor.aliases] } : {}),
		...(descriptor.aliasI18nKeys != null ? { aliasI18nKeys: [...descriptor.aliasI18nKeys] } : {}),
		preferenceKeys: [...descriptor.preferenceKeys],
	}));
	const parentByStableId = new Map(copied.map(descriptor => [descriptor.stableId, descriptor]));
	for (const { sourceFile, parentGroupId } of parentContainedVocabularySourcesV2()) {
		const parent = parentByStableId.get(parentGroupId);
		if (parent == null || !parent.searchable || !parent.isGroup) {
			throw new Error(`settings V2 parent-contained vocabulary group is missing: ${sourceFile} -> ${parentGroupId}`);
		}
		const source = await fs.readFile(path.join(root, sourceFile), 'utf8');
		const vocabulary = collectSafeParentContainedVocabularyV2(sourceFile, source, routes, parent.route);
		mergeParentContainedVocabularyV2(parent, vocabulary.descriptors, vocabulary);
	}
	return copied;
}

function requiredAttributeNeedsInjection(
	node: ElementNode,
	attributeName: string,
	expectedValue: string,
	sourceFile: string,
	bound = false,
): boolean {
	const existing = findAttribute(node.props, attributeName);
	if (existing != null) {
		const isExpectedBinding = bound ? existing.type === NodeTypes.DIRECTIVE : existing.type === NodeTypes.ATTRIBUTE;
		if (!isExpectedBinding || expressionOf(existing) !== expectedValue) {
			throw new Error(`settings V2 conflicting ${attributeName} at ${sourceFile}:${node.loc.start.line}`);
		}
		return false;
	}
	return true;
}

function appendRequiredAttribute(
	magic: MagicString,
	node: ElementNode,
	attributeName: string,
	expectedValue: string,
	sourceFile: string,
	bound = false,
): void {
	if (!requiredAttributeNeedsInjection(node, attributeName, expectedValue, sourceFile, bound)) return;
	const renderedName = bound ? `:${attributeName}` : attributeName;
	magic.appendRight(endOfStartTag(node), ` ${renderedName}="${expectedValue}"`);
}

function injectHataCustomActivationTargetsV2(
	sourceFile: string,
	rootNodes: TemplateChildNode[],
	magic: MagicString,
	activations: readonly SettingsControlActivationV2[],
): void {
	if (sourceFile !== 'src/pages/settings/hata-custom.vue' || activations.length === 0) return;
	const nodes = collectElementNodes(rootNodes);
	const categoryButtons = nodes.filter(node => node.tag === 'button'
		&& normalizedExpression(directiveExpression(node, 'for')) === 'catincategories'
		&& normalizedExpression(eventHandlerExpression(node, 'click')) === 'activeCat=cat.id');
	if (categoryButtons.length !== 1) {
		throw new Error(`settings V2 expected exactly one hata-custom category button, found ${categoryButtons.length}`);
	}
	appendRequiredAttribute(magic, categoryButtons[0], 'data-settings-category-id', 'cat.id', sourceFile, true);

	const popupHandlers: Record<Extract<SettingsControlActivationV2, { kind: 'popup' }>['popup'], string> = {
		'hatasaba-ui2': 'openHatasabaUi2EditWindow',
		earthquake: 'openEarthquakeSettings',
		'ui-setup': 'openUiSetup',
		'settings-transfer': 'openSettingsTransfer',
		hatask: 'openHataskSettings',
		hatady: 'openHatadySettings',
		mascot: 'openMascotSettings',
	};
	const popups = [...new Set(activations.flatMap(activation => activation.kind === 'popup' ? [activation.popup] : []))];
	for (const popup of popups) {
		const buttons = nodes.filter(node => node.tag === 'button'
			&& normalizedExpression(eventHandlerExpression(node, 'click')) === popupHandlers[popup]);
		if (buttons.length !== 1) {
			throw new Error(`settings V2 expected exactly one ${popup} popup launcher, found ${buttons.length}`);
		}
		appendRequiredAttribute(magic, buttons[0], 'data-settings-popup-launcher', popup, sourceFile);
	}
}

function injectFolderReachabilityV2(
	sourceFile: string,
	rootNodes: TemplateChildNode[],
	magic: MagicString,
	descriptorByControl: ReadonlyMap<ElementNode, SettingsControlSearchDescriptorV2>,
	descriptorByGroupHost: ReadonlyMap<ElementNode, SettingsControlSearchDescriptorV2>,
	focusHostIds: ReadonlyMap<ElementNode, string>,
): void {
	type FolderReachabilityTargetV2 = Pick<SettingsControlSearchDescriptorV2, 'stableId' | 'legacyMarkerAncestorIds'>;
	const collectDescendants = (node: ElementNode, result: FolderReachabilityTargetV2[] = []): FolderReachabilityTargetV2[] => {
		for (const child of node.children) {
			if (child.type !== NodeTypes.ELEMENT) continue;
			const descriptor = descriptorByControl.get(child) ?? descriptorByGroupHost.get(child);
			if (descriptor != null) result.push(descriptor);
			const focusId = focusHostIds.get(child);
			if (focusId != null) result.push({ stableId: focusId, legacyMarkerAncestorIds: [] });
			collectDescendants(child, result);
		}
		return result;
	};
	for (const node of collectElementNodes(rootNodes).filter(candidate => candidate.tag === 'MkFolder')) {
		const descendants = collectDescendants(node);
		const ids = [...new Set(descendants.map(descriptor => descriptor.stableId))];
		const markers = [...new Set(descendants.flatMap(descriptor => descriptor.legacyMarkerAncestorIds))].filter(marker => !/\s/u.test(marker));
		if (ids.length > 0) appendRequiredAttribute(magic, node, 'data-settings-search-descendant-ids', ids.join(' '), sourceFile);
		if (markers.length > 0) appendRequiredAttribute(magic, node, 'data-settings-search-descendant-markers', markers.join(' '), sourceFile);
	}
}

type ElementNodeContextV2 = {
	node: ElementNode;
	ancestors: ElementNode[];
	siblings: TemplateChildNode[];
	rootNodes: TemplateChildNode[];
};

type ControlNodeContextV2 = ElementNodeContextV2;

function collectElementNodeContextsV2(
	nodes: TemplateChildNode[],
	rootNodes: TemplateChildNode[] = nodes,
	ancestors: ElementNode[] = [],
	result: ElementNodeContextV2[] = [],
): ElementNodeContextV2[] {
	for (const child of nodes) {
		if (child.type !== NodeTypes.ELEMENT) continue;
		result.push({ node: child, ancestors, siblings: nodes, rootNodes });
		collectElementNodeContextsV2(child.children, rootNodes, [...ancestors, child], result);
	}
	return result;
}

function collectControlNodeContextsV2(
	sourceFile: string,
	nodes: TemplateChildNode[],
	persistentHandlers: ReadonlySet<string>,
): ControlNodeContextV2[] {
	return collectElementNodeContextsV2(nodes)
		.filter(context => isSearchDescriptorNode(sourceFile, context.node, persistentHandlers));
}

function isBuiltInRelatedControl(node: ElementNode): boolean {
	return ['MkSwitch', 'MkInput', 'MkSelect', 'MkRadios', 'MkRange', 'MkTextarea', 'MkCodeEditor', 'MkColorInput'].includes(node.tag);
}

function relatedInsertionHostContextV2(context: ElementNodeContextV2): ElementNodeContextV2 {
	if (!['label', 'button', 'MkButton'].includes(context.ancestors.at(-1)?.tag ?? '')) return context;
	const host = [...context.ancestors].reverse().find(ancestor => !['label', 'button', 'MkButton', 'template'].includes(ancestor.tag));
	if (host == null) throw new Error(`settings V2 cannot place related settings outside label/button at line ${context.node.loc.start.line}`);
	const index = context.ancestors.indexOf(host);
	if (index < 0) throw new Error(`settings V2 related host context is missing at line ${context.node.loc.start.line}`);
	return {
		node: host,
		ancestors: context.ancestors.slice(0, index),
		siblings: index === 0 ? context.rootNodes : context.ancestors[index - 1].children,
		rootNodes: context.rootNodes,
	};
}

function injectSettingsRelatedImportV2(
	magic: MagicString,
	parsed: ReturnType<typeof parseTargetSfc>,
	code: string,
): void {
	if (/\bimport\s+SettingsControlRelated\b/u.test(code)) return;
	const statement = "import SettingsControlRelated from '@/components/settings-redesign/SettingsControlRelated.vue';\n";
	if (parsed.descriptor.scriptSetup != null) {
		magic.appendLeft(parsed.descriptor.scriptSetup.loc.start.offset, statement);
		return;
	}
	// A separate script-setup block is valid next to an existing classic script
	// and avoids mutating component option registration in legacy SFCs.
	magic.append(`\n<script setup lang="ts">\n${statement}</script>\n`);
}

type ConditionalDirectiveKindV2 = 'if' | 'else-if' | 'else';

function conditionalDirectiveKindV2(node: ElementNode): ConditionalDirectiveKindV2 | undefined {
	for (const kind of ['if', 'else-if', 'else'] as const) {
		if (node.props.some(prop => prop.type === NodeTypes.DIRECTIVE && prop.name === kind)) return kind;
	}
	return undefined;
}

function previousMeaningfulSiblingIndexV2(siblings: readonly TemplateChildNode[], from: number): number | undefined {
	for (let index = from; index >= 0; index--) {
		const sibling = siblings[index];
		if (sibling.type === NodeTypes.TEXT && sibling.content.trim() === '') continue;
		if (sibling.type === NodeTypes.COMMENT) continue;
		return sibling.type === NodeTypes.ELEMENT ? index : undefined;
	}
	return undefined;
}

function nextMeaningfulSiblingIndexV2(siblings: readonly TemplateChildNode[], from: number): number | undefined {
	for (let index = from; index < siblings.length; index++) {
		const sibling = siblings[index];
		if (sibling.type === NodeTypes.TEXT && sibling.content.trim() === '') continue;
		if (sibling.type === NodeTypes.COMMENT) continue;
		return sibling.type === NodeTypes.ELEMENT ? index : undefined;
	}
	return undefined;
}

type ConditionalBranchInsertionV2 = { anchor: ElementNode; condition?: string };

/**
 * Inserting a sibling directly after `v-if` breaks Vue's `v-else-if` chain.
 * Instead, append after the whole chain and mirror the branch predicate on a
 * harmless template wrapper. This keeps the related links hidden whenever the
 * underlying control is absent, including an `else` branch.
 */
function conditionalBranchInsertionV2(context: ElementNodeContextV2): ConditionalBranchInsertionV2 {
	const selfIndex = context.siblings.indexOf(context.node);
	const selfKind = conditionalDirectiveKindV2(context.node);
	if (selfIndex < 0 || selfKind == null) return { anchor: context.node };
	let firstIndex = selfIndex;
	if (selfKind !== 'if') {
		let cursor = previousMeaningfulSiblingIndexV2(context.siblings, selfIndex - 1);
		while (cursor != null) {
			const candidate = context.siblings[cursor];
			if (candidate.type !== NodeTypes.ELEMENT) break;
			const kind = conditionalDirectiveKindV2(candidate);
			if (kind === 'if') {
				firstIndex = cursor;
				break;
			}
			if (kind !== 'else-if') return { anchor: context.node };
			firstIndex = cursor;
			cursor = previousMeaningfulSiblingIndexV2(context.siblings, cursor - 1);
		}
		if (conditionalDirectiveKindV2(context.siblings[firstIndex] as ElementNode) !== 'if') return { anchor: context.node };
	}
	const chain: ElementNode[] = [];
	let cursor = firstIndex;
	while (cursor != null) {
		const candidate = context.siblings[cursor];
		if (candidate.type !== NodeTypes.ELEMENT) break;
		const kind = conditionalDirectiveKindV2(candidate);
		if (chain.length === 0 ? kind !== 'if' : kind !== 'else-if' && kind !== 'else') break;
		chain.push(candidate);
		if (kind === 'else') break;
		cursor = nextMeaningfulSiblingIndexV2(context.siblings, cursor + 1);
	}
	const position = chain.indexOf(context.node);
	if (position < 0) return { anchor: context.node };
	const conditions: string[] = [];
	for (const branch of chain.slice(0, position)) {
		const expression = directiveExpression(branch, 'if') ?? directiveExpression(branch, 'else-if');
		if (expression != null) conditions.push(`!(${expression})`);
	}
	const ownExpression = directiveExpression(context.node, 'if') ?? directiveExpression(context.node, 'else-if');
	if (ownExpression != null) conditions.push(`(${ownExpression})`);
	return {
		anchor: chain.at(-1)!,
		...(conditions.length ? { condition: conditions.join(' && ') } : {}),
	};
}

function escapeTemplateAttributeV2(value: string): string {
	return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;');
}

function injectRelatedComponentAfterV2(
	magic: MagicString,
	context: ElementNodeContextV2,
	stableId: string,
): void {
	// Raw hosts can be flex rows (for example UI2 range controls).  The related
	// affordance must occupy a fresh row rather than becoming a third inline
	// control beside a slider or button.
	const insertion = conditionalBranchInsertionV2(context);
	const component = `<SettingsControlRelated full-width data-settings-search-id="${stableId}" />`;
	const rendered = insertion.condition == null
		? component
		: `<template v-if="${escapeTemplateAttributeV2(insertion.condition)}">${component}</template>`;
	magic.appendRight(insertion.anchor.loc.end.offset, `\n${rendered}`);
}

/**
 * A runtime child is rendered once in source but may become zero or many rows
 * at runtime.  Giving those controls the parent group's focus ID would create
 * duplicate focus targets.  Inject only the related-links component after each
 * user-facing row instead; it reads the parent ID from its own inert attribute
 * and never becomes a focus host.
 */
function injectDynamicChildRelatedComponentsV2(
	sourceFile: string,
	code: string,
	magic: MagicString,
	elementContexts: readonly ElementNodeContextV2[],
): boolean {
	const dynamic = dynamicChildReachabilityForSourceV2(sourceFile);
	if (dynamic?.parentGroupId == null || dynamic.renderRelatedInChild !== true) return false;
	const raw = collectSettingsInteractiveInventoryV2(sourceFile, code)
		.filter(item => item.classification === 'user-facing-setting' || item.classification === 'runtime-collection');
	const contextsByLocation = new Map<string, ElementNodeContextV2[]>();
	for (const context of elementContexts) {
		const key = `${context.node.loc.start.line}:${context.node.tag}`;
		const queue = contextsByLocation.get(key) ?? [];
		queue.push(context);
		contextsByLocation.set(key, queue);
	}
	const insertedHosts = new Set<ElementNode>();
	for (const item of raw) {
		const queue = contextsByLocation.get(`${item.sourceLine}:${item.component}`);
		const context = queue?.shift();
		if (context == null) {
			throw new Error(`settings V2 dynamic child related host is missing at ${sourceFile}:${item.sourceLine} (${item.component})`);
		}
		const host = relatedInsertionHostContextV2(context);
		// Two controls can share a safe row host (notably label/button composite
		// controls). One related section per rendered row is both valid markup and
		// the exact UI contract; the individual controls retain no duplicated ID.
		if (insertedHosts.has(host.node)) continue;
		insertedHosts.add(host.node);
		injectRelatedComponentAfterV2(magic, host, dynamic.parentGroupId);
	}
	return insertedHosts.size > 0;
}

/**
 * Adds only inert data attributes to compiled settings controls and existing
 * hata-custom activation affordances. The source SFCs stay untouched; the
 * stable IDs and activation metadata come from the same source inventory.
 */
export function injectSettingsSearchIdsV2(
	sourceFile: string,
	code: string,
	routes: ReadonlyMap<string, string>,
	target: SettingsControlSearchTargetMetadataV2 = {},
	activationTargets: readonly SettingsControlActivationV2[] = [],
): SettingsSearchIdInjectionV2 {
	const parsed = parseTargetSfc(sourceFile, code);
	const magic = new MagicString(code);
	if (parsed.descriptor.template?.ast == null) {
		return { code, map: magic.generateMap({ source: sourceFile, includeContent: true }) };
	}
	const descriptors = collectSettingsSearchDescriptorsV2(sourceFile, code, routes, target);
	const persistentHandlers = persistentHandlerNames([parsed.descriptor.script?.content, parsed.descriptor.scriptSetup?.content].filter((value): value is string => value != null).join('\n'));
	const controlContexts = collectControlNodeContextsV2(sourceFile, parsed.descriptor.template.ast.children, persistentHandlers);
	const elementContextsByNode = new Map(collectElementNodeContextsV2(parsed.descriptor.template.ast.children).map(context => [context.node, context]));
	const descriptorQueues = new Map<number, SettingsControlSearchDescriptorV2[]>();
	for (const descriptor of descriptors.filter(descriptor => !descriptor.isGroup)) {
		const queue = descriptorQueues.get(descriptor.sourceLine) ?? [];
		queue.push(descriptor);
		descriptorQueues.set(descriptor.sourceLine, queue);
	}
	const descriptorByControl = new Map<ElementNode, SettingsControlSearchDescriptorV2>();
	let requiresRelatedImport = false;
	for (const controlContext of controlContexts) {
		const { node: control } = controlContext;
		const descriptor = descriptorQueues.get(control.loc.start.line)?.shift();
		// A duplicated runtime/alternate affordance shares the semantic setting
		// group and intentionally has no independent search target.
		if (descriptor == null || !descriptor.searchable) continue;
		descriptorByControl.set(control, descriptor);
		const current = expressionOf(findAttribute(control.props, 'data-settings-search-id'));
		if (current != null) {
			if (current !== descriptor.stableId) throw new Error(`settings V2 duplicate data-settings-search-id at ${sourceFile}:${control.loc.start.line}`);
			continue;
		}
		magic.appendRight(endOfStartTag(control), ` data-settings-search-id="${descriptor.stableId}"`);
		magic.appendRight(endOfStartTag(control), ` data-settings-related-host="${descriptor.relatedHostId}"`);
		if (!descriptor.destructive && !isBuiltInRelatedControl(control)) {
			injectRelatedComponentAfterV2(magic, relatedInsertionHostContextV2(controlContext), descriptor.stableId);
			requiresRelatedImport = true;
		}
	}
	const groupHosts = collectStaticGroupHostsV2(sourceFile, code, target);
	const groupsById = new Map(descriptors.filter((descriptor): descriptor is SettingsControlSearchDescriptorV2 & { isGroup: true } => descriptor.isGroup === true).map(descriptor => [descriptor.stableId, descriptor]));
	const descriptorByGroupHost = new Map<ElementNode, SettingsControlSearchDescriptorV2>();
	const focusHostIds = new Map<ElementNode, string>();
	// A reachability spec and a product-owned explicit group attribute can point
	// at the same physical host.  The descriptor map deliberately coalesces
	// their stable ID, but the injection loop must coalesce the node too: adding
	// the same attribute three times makes an otherwise valid SFC uncompilable.
	const injectedGroupHostIds = new Map<ElementNode, string>();
	for (const host of groupHosts) {
		const descriptor = groupsById.get(host.stableId);
		if (descriptor == null) continue;
		const previousId = injectedGroupHostIds.get(host.node);
		if (previousId != null) {
			if (previousId !== descriptor.stableId) {
				throw new Error(`settings V2 one group host cannot represent multiple stable IDs at ${sourceFile}:${host.node.loc.start.line} (${previousId}, ${descriptor.stableId})`);
			}
			continue;
		}
		injectedGroupHostIds.set(host.node, descriptor.stableId);
		descriptorByGroupHost.set(host.node, descriptor);
		// MagicString preserves a single insertion at a start-tag boundary more
		// reliably than several appendRight calls at that exact offset.  Batch the
		// three host attributes so a group never becomes
		// `data-settings-search-group-id` three times in the emitted SFC.
		const groupAttributes = [
			['data-settings-search-group-id', descriptor.stableId],
			['data-settings-search-id', descriptor.stableId],
			['data-settings-related-host', descriptor.relatedHostId],
		] as const;
		const pendingGroupAttributes = groupAttributes.filter(([name, value]) => requiredAttributeNeedsInjection(host.node, name, value, sourceFile));
		if (pendingGroupAttributes.length > 0) {
			magic.appendRight(endOfStartTag(host.node), pendingGroupAttributes.map(([name, value]) => ` ${name}="${value}"`).join(''));
		}
		const hostContext = elementContextsByNode.get(host.node);
		if (hostContext == null) throw new Error(`settings V2 group host context is missing at ${sourceFile}:${host.node.loc.start.line}`);
		injectRelatedComponentAfterV2(magic, hostContext, descriptor.stableId);
		requiresRelatedImport = true;
	}
	if (injectDynamicChildRelatedComponentsV2(sourceFile, code, magic, [...elementContextsByNode.values()])) {
		requiresRelatedImport = true;
	}
	for (const descriptor of descriptors.filter(descriptor => descriptor.searchable && descriptor.focusId != null)) {
		// The exact static host is injected when its owning parent SFC is
		// transformed. Never manufacture the same ID inside a transitive child.
		if (descriptor.focusHostSourceFile != null && descriptor.focusHostSourceFile !== sourceFile) continue;
		const host = groupHosts.find(candidate => candidate.stableId === descriptor.focusId);
		if (host == null) {
			throw new Error(`settings V2 conditional focus host is missing at ${sourceFile}:${descriptor.sourceLine} -> ${descriptor.focusId}`);
		}
		if (!staticHostIsAlwaysMountedV2(host.conditions, descriptor.activation)) {
			throw new Error(`settings V2 conditional focus host is not statically mounted at ${sourceFile}:${descriptor.sourceLine} -> ${descriptor.focusId}`);
		}
		// Searchable dynamic/runtime groups already receive the full host contract
		// above. Ordinary conditional controls keep their own catalog item and
		// need only an inert focus target; creating a second group descriptor here
		// would duplicate results and invent mixed persistence metadata.
		if (descriptorByGroupHost.has(host.node)) continue;
		const previousFocusId = focusHostIds.get(host.node);
		if (previousFocusId != null) {
			if (previousFocusId !== descriptor.focusId) {
				throw new Error(`settings V2 one conditional focus host cannot represent multiple IDs at ${sourceFile}:${host.node.loc.start.line} (${previousFocusId}, ${descriptor.focusId})`);
			}
			continue;
		}
		appendRequiredAttribute(magic, host.node, 'data-settings-search-group-id', descriptor.focusId, sourceFile);
		// Profile results have no popup activation, so navigation resolves their
		// fallback controlId through the ordinary control selector as well.
		if (sourceFile === 'src/components/MkNoteCharmSettings.vue' && host.stableId === 'settings.group.note-charm-settings') {
			appendRequiredAttribute(magic, host.node, 'data-settings-search-id', descriptor.focusId, sourceFile);
		}
		focusHostIds.set(host.node, descriptor.focusId);
	}
	if (requiresRelatedImport) injectSettingsRelatedImportV2(magic, parsed, code);
	injectFolderReachabilityV2(sourceFile, parsed.descriptor.template.ast.children, magic, descriptorByControl, descriptorByGroupHost, focusHostIds);
	injectHataCustomActivationTargetsV2(sourceFile, parsed.descriptor.template.ast.children, magic, activationTargets);
	return { code: magic.toString(), map: magic.generateMap({ source: sourceFile, includeContent: true }) };
}

export type SettingsDescriptorReachabilityDispositionV2 = 'route-static' | 'activation' | 'parent-static-group' | 'intentionally-excluded';

export type SettingsDescriptorReachabilityAuditItemV2 = {
	stableId: string;
	sourceFile: string;
	disposition: SettingsDescriptorReachabilityDispositionV2;
	reason: string;
	focusId?: string;
};

/**
 * Proves that a generated result has one safe focus path. It deliberately
 * refuses to treat a route string as sufficient evidence for dynamic dialogs,
 * runtime child components, or parameterised edit routes.
 */
export function collectSettingsDescriptorReachabilityAuditV2(
	descriptors: readonly SettingsControlSearchDescriptorV2[],
): SettingsDescriptorReachabilityAuditItemV2[] {
	const byStableId = new Map(descriptors.map(descriptor => [descriptor.stableId, descriptor]));
	const audit: SettingsDescriptorReachabilityAuditItemV2[] = [];
	for (const descriptor of descriptors) {
		const dynamic = dynamicChildReachabilityForSourceV2(descriptor.sourceFile);
		if (!descriptor.searchable) {
			if (!descriptor.intentionallyExcluded || descriptor.exclusionReason == null) {
				throw new Error(`settings V2 reachability exclusion is incomplete: ${descriptor.stableId}`);
			}
			if (dynamic?.parentGroupId != null) {
				const parent = byStableId.get(dynamic.parentGroupId);
				if (parent == null || !parent.searchable || !parent.isGroup) {
					throw new Error(`settings V2 reachability parent group is missing: ${descriptor.stableId} -> ${dynamic.parentGroupId}`);
				}
				if (!staticHostIsAlwaysMountedV2(parent.conditions, descriptor.activation ?? parent.activation)) {
					throw new Error(`settings V2 reachability parent group is not statically mounted: ${descriptor.stableId} -> ${dynamic.parentGroupId}`);
				}
				for (const unmet of dynamic.unmet ?? []) {
					if (!parent.unmet?.some(candidate => candidate.kind === unmet.kind && candidate.id === unmet.id && candidate.behavior === unmet.behavior)) {
						throw new Error(`settings V2 reachability parent group lacks unmet explanation: ${descriptor.stableId} -> ${dynamic.parentGroupId} (${unmet.id})`);
					}
				}
				audit.push({
					stableId: descriptor.stableId,
					sourceFile: descriptor.sourceFile,
					disposition: 'parent-static-group',
					reason: descriptor.exclusionReason,
					focusId: parent.stableId,
				});
			} else {
				audit.push({
					stableId: descriptor.stableId,
					sourceFile: descriptor.sourceFile,
					disposition: 'intentionally-excluded',
					reason: descriptor.exclusionReason,
				});
			}
			continue;
		}
		if (dynamic != null) {
			throw new Error(`settings V2 dynamically mounted child remains searchable: ${descriptor.stableId}`);
		}
		if (descriptor.route.includes('/:')) {
			throw new Error(`settings V2 parameterised route remains searchable without a parent group: ${descriptor.stableId} (${descriptor.route})`);
		}
		if (conditionNeedsStaticParentFocusV2(descriptor)) {
			if (descriptor.focusId == null) {
				throw new Error(`settings V2 conditional control has no static parent focus: ${descriptor.stableId}`);
			}
			const parent = byStableId.get(descriptor.focusId);
			if (parent != null) {
				if (!parent.searchable || !parent.isGroup) {
					throw new Error(`settings V2 conditional parent group is invalid: ${descriptor.stableId} -> ${descriptor.focusId}`);
				}
				if (!staticHostIsAlwaysMountedV2(parent.conditions, descriptor.activation ?? parent.activation)) {
					throw new Error(`settings V2 conditional parent group is not statically mounted: ${descriptor.stableId} -> ${descriptor.focusId}`);
				}
			} else if (descriptor.focusHostSourceFile !== descriptor.sourceFile
				|| descriptor.focusHostSourceLine == null
				|| !staticHostIsAlwaysMountedV2(descriptor.focusHostConditions ?? [], descriptor.activation)) {
				throw new Error(`settings V2 conditional static focus evidence is incomplete: ${descriptor.stableId} -> ${descriptor.focusId}`);
			}
			if (descriptor.unmet == null || descriptor.unmet.length === 0) {
				throw new Error(`settings V2 conditional control has no unmet explanation: ${descriptor.stableId}`);
			}
			if (descriptor.activation?.focus?.kind === 'control' && descriptor.activation.focus.id === descriptor.stableId) {
				throw new Error(`settings V2 conditional activation still focuses hidden control: ${descriptor.stableId}`);
			}
				audit.push({
					stableId: descriptor.stableId,
					sourceFile: descriptor.sourceFile,
					disposition: 'parent-static-group',
					reason: '条件付きcontrolは既存の静的parent groupへfocusし、必要条件を説明する',
					focusId: descriptor.focusId,
				});
			continue;
		}
		if (descriptor.activation != null) {
			audit.push({ stableId: descriptor.stableId, sourceFile: descriptor.sourceFile, disposition: 'activation', reason: '既存のcategory/popup/reveal activationで到達する' });
		} else {
			audit.push({ stableId: descriptor.stableId, sourceFile: descriptor.sourceFile, disposition: 'route-static', reason: 'route遷移後に静的にmountされるcontrolまたはgroup' });
		}
	}
	return audit;
}

export function validateSettingsControlDescriptorsV2(descriptors: SettingsControlSearchDescriptorV2[], expectedCount?: number): void {
	if (expectedCount != null && descriptors.length !== expectedCount) throw new Error(`settings V2 control count regression: expected ${expectedCount}, got ${descriptors.length}`);
	const ids = new Set<string>();
	for (const descriptor of descriptors) {
		if (ids.has(descriptor.stableId)) throw new Error(`settings V2 duplicate stable id: ${descriptor.stableId}`);
		ids.add(descriptor.stableId);
		if (descriptor.route !== '/settings' && !descriptor.route.startsWith('/settings/')) throw new Error(`settings V2 invalid route: ${descriptor.route} (${descriptor.sourceFile})`);
		if (descriptor.searchable && descriptor.intentionallyExcluded) throw new Error(`settings V2 contradictory classification: ${descriptor.stableId}`);
		if (descriptor.searchable && !descriptor.label && !(descriptor.labelI18nKeys?.length)) throw new Error(`settings V2 searchable control has no display label: ${descriptor.stableId}`);
		if (!descriptor.searchable && !(descriptor.intentionallyExcluded && descriptor.exclusionReason)) throw new Error(`settings V2 unclassified control: ${descriptor.stableId}`);
		if (descriptor.intentionallyExcluded && !descriptor.exclusionReason) throw new Error(`settings V2 excluded control has no reason: ${descriptor.stableId}`);
		if (!['core', 'cherrypick', 'hatasaba'].includes(descriptor.owner)) throw new Error(`settings V2 unknown owner: ${descriptor.stableId}`);
		assertApplicableUiMetadataV2(descriptor.applicableUi, descriptor.stableId);
		const evidence = descriptor.metadataEvidence;
		if ([evidence.persistence, evidence.saveMode, evidence.availability, evidence.owner, evidence.applicableUi].some(value => value.trim() === '')) {
			throw new Error(`settings V2 metadata evidence is incomplete: ${descriptor.stableId}`);
		}
	}
}

function generateVirtualModule(descriptors: SettingsControlSearchDescriptorV2[]): string {
	return `export const settingsControlSearchIndexV2 = ${JSON.stringify(descriptors)};\n`;
}

type ResolvedSettingsControlSearchTargetV2 = {
	sourceFile: string;
	target: SettingsControlSearchTargetV2;
};

async function resolveSettingsControlSearchTargetsV2(
	targets: readonly SettingsControlSearchTargetV2[],
): Promise<ResolvedSettingsControlSearchTargetV2[]> {
	const resolved = (await Promise.all(targets.map(async target => {
		const files = await glob(target.filePath);
		if (files.length === 0) throw new Error(`settings V2 target matched no SFC: ${target.filePath}`);
		return files.map(sourceFile => ({ sourceFile: normalizePath(sourceFile), target }));
	}))).flat();
	const sourceFiles = [...new Set(resolved.map(entry => entry.sourceFile))];
	return sourceFiles
		.map(sourceFile => {
			const target = targetForSourceFileV2(sourceFile, targets);
			if (target == null) throw new Error(`settings V2 target metadata is missing for ${sourceFile}`);
			return { sourceFile, target };
		})
		.sort((left, right) => left.sourceFile.localeCompare(right.sourceFile));
}

export default function pluginCreateSettingsSearchIndexV2(options: SettingsSearchIndexV2Options): Plugin {
	const root = normalizePath(process.cwd());
	const targets = options.targetFilePaths.map(normalizeSettingsControlSearchTargetV2);
	const activationTargets = targets.flatMap(target => target.activation == null ? [] : [target.activation]);
	const targetForFile = (file: string) => targetForSourceFileV2(path.posix.relative(root, normalizePath(file)), targets);
	const isTarget = (file: string) => targetForFile(file) != null;
	const isStorageAuditEvidence = (file: string) => SETTINGS_STORAGE_KEY_AUDIT_EVIDENCE_FILES_V2
		.includes(relativeSettingsSourcePathV2(root, file));
	const isPotentialTransitiveSettingsComponent = (file: string) => {
		const relative = relativeSettingsSourcePathV2(root, file);
		return relative.endsWith('.vue')
			&& (relative.startsWith('src/components/') || relative.startsWith('src/pages/settings-redesign/'));
	};
	return {
		name: 'generateSettingsControlSearchIndexV2',
		enforce: 'pre',
		async transform(code, id) {
			// Vite invokes every SFC sub-request as well (style/template/script).
			// Only the source .vue module contains a complete SFC; parsing a style
			// request after stripping its query turns CSS into a broken SFC.
			if (id.includes('?')) return null;
			const file = normalizePath(id.split('?')[0]);
			const target = targetForFile(file);
			if (!file.endsWith('.vue') || target == null) return null;
			const sourceFile = path.posix.relative(root, file);
			const routes = readSettingsRoutesV2(await fs.readFile(path.join(root, options.routerDefinitionPath), 'utf8'));
			return injectSettingsSearchIdsV2(sourceFile, code, routes, target, activationTargets);
		},
		resolveId(id) {
			return id === options.mainVirtualModule ? `\0${id}` : undefined;
		},
		async load(id) {
			if (id !== `\0${options.mainVirtualModule}`) return null;
			const [routerSource, files] = await Promise.all([
				fs.readFile(path.join(root, options.routerDefinitionPath), 'utf8'),
				resolveSettingsControlSearchTargetsV2(targets),
			]);
			await collectSettingsTransitiveControlAuditV2(root, files.map(file => file.sourceFile));
			const routes = readSettingsRoutesV2(routerSource);
			const sourceDescriptors = (await Promise.all(files.map(async ({ sourceFile, target }) => collectSettingsSearchDescriptorsV2(
				sourceFile, await fs.readFile(sourceFile, 'utf8'), routes, target,
			)))).flat().concat(options.manualDescriptors ?? []);
			const descriptors = await aggregateParentContainedSettingsVocabularyV2(root, routes, sourceDescriptors);
			validateSettingsControlDescriptorsV2(descriptors, options.expectedControlCount);
			collectSettingsDescriptorReachabilityAuditV2(descriptors);
			await collectSettingsStorageKeyAuditFromRepositoryV2(root, files.map(file => file.sourceFile), descriptors);
			return generateVirtualModule(descriptors);
		},
		hotUpdate(context) {
			if (!isTarget(context.file)
				&& normalizePath(context.file) !== normalizePath(path.join(root, options.routerDefinitionPath))
				&& !isStorageAuditEvidence(context.file)
				&& !isPotentialTransitiveSettingsComponent(context.file)) return context.modules;
			const virtual = context.server.moduleGraph.getModuleById(`\0${options.mainVirtualModule}`);
			const consumers = (options.modulesToHmrOnUpdate ?? [])
				.map(id => context.server.moduleGraph.getModuleById(normalizePath(path.join(root, id))))
				.filter((module): module is NonNullable<typeof module> => module != null);
			return [...new Set([...context.modules, ...(virtual == null ? [] : [virtual]), ...consumers])];
		},
	};
}
