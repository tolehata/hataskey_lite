/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { HataskPlannerTodo } from '@/utility/hatask-planner-storage.js';
import { createNextRecurringTodo } from '@/utility/hatask-planner-recurrence.js';

/** 完了の取り消しに使う、完了前後と繰り返しで生成した次回分の記録。 */
export type HataskTodoCompletionUndo = { before: HataskPlannerTodo; after: HataskPlannerTodo; generated?: HataskPlannerTodo };

export function clonePlannerTodo(todo: HataskPlannerTodo): HataskPlannerTodo {
	return { ...todo, subtasks: (todo.subtasks || []).map(subtask => ({ ...subtask })), recurrence: { ...(todo.recurrence || { frequency: 'none', interval: 1 }) } };
}

export function generateHataskTodoId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * ToDoを完了にした次の一覧を作る。Hatask本体と Hataskey UI 3 の右ペインで共有する。
 * 「今日終わった分」を数えるため完了時刻を残し、繰り返しToDoは次回分をまだ作っていなければ先頭に加える。
 * ⚠️過去に完了した分には doneAt が無い(遡って埋められない)。その分は今日の件数に入らない。
 */
export function completeHataskTodos(
	source: readonly HataskPlannerTodo[],
	ids: readonly string[],
	options: { generateId?: () => string; now?: Date } = {},
): { next: HataskPlannerTodo[]; undo: HataskTodoCompletionUndo[] } {
	const generateId = options.generateId ?? generateHataskTodoId;
	const completedAt = options.now ?? new Date();
	const next = source.map(clonePlannerTodo);
	const undo: HataskTodoCompletionUndo[] = [];
	for (const id of ids) {
		const index = next.findIndex(item => item.id === id);
		if (index < 0 || next[index].done || next[index].archivedAt != null) continue;
		const before = clonePlannerTodo(next[index]);
		const after = clonePlannerTodo(next[index]);
		after.done = true;
		after.doneAt = completedAt.toISOString();
		let generated: HataskPlannerTodo | undefined;
		if (after.recurrence?.frequency !== 'none' && !next.some(item => item.recurrenceParentId === after.id)) {
			const recurrence = createNextRecurringTodo(after, generateId(), completedAt);
			if (recurrence) {
				generated = recurrence;
				next.unshift(generated);
			}
		}
		const completedIndex = next.findIndex(item => item.id === id);
		next.splice(completedIndex, 1, after);
		undo.push({ before, after: clonePlannerTodo(after), ...(generated ? { generated: clonePlannerTodo(generated) } : {}) });
	}
	return { next, undo };
}
