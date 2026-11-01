/* SPDX-License-Identifier: AGPL-3.0-only */
import { Inject, Injectable } from '@nestjs/common';
import { In, type EntityManager } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { MiDriveFile } from '@/models/DriveFile.js';
import type { DriveFilesRepository } from '@/models/_.js';
import type { Packed } from '@/misc/json-schema.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';

export const HATADY_ATTACHMENT_LIMIT = 16;
export const HATADY_ATTACHMENT_ERROR = 'INVALID_HATADY_ATTACHMENTS';
type RecordWithAttachments = { id: string; userId: string; fileIds?: string[] };

@Injectable()
export class HatadyAttachmentService {
	constructor(
		@Inject(DI.driveFilesRepository) private filesRepository: DriveFilesRepository,
		private driveFileEntityService: DriveFileEntityService,
	) {}

	public async validate(userId: string, fileIds: string[], retained: readonly string[] = [], manager?: EntityManager): Promise<string[]> {
		if (!Array.isArray(fileIds) || fileIds.length > HATADY_ATTACHMENT_LIMIT || new Set(fileIds).size !== fileIds.length
			|| fileIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9]{1,32}$/.test(id))) throw new Error(HATADY_ATTACHMENT_ERROR);
		if (fileIds.length === 0) return [];
		const repository = manager ? manager.getRepository(MiDriveFile) : this.filesRepository;
		const files = await repository.findBy({ id: In(fileIds) });
		const lookup = new Map(files.map(file => [file.id, file]));
		for (const id of fileIds) {
			const file = lookup.get(id);
			// Drive deletion leaves attachment IDs behind, as it does for notes. Keep a
			// previously attached missing ID without blocking unrelated record edits.
			if (file == null && retained.includes(id)) continue;
			if (file == null || file.userId !== userId || !file.type.startsWith('image/')) throw new Error(HATADY_ATTACHMENT_ERROR);
		}
		return [...fileIds];
	}

	/** Call only after the record's visibility/block/staff authorization. */
	public async packRecords(records: readonly RecordWithAttachments[]): Promise<Map<string, Packed<'DriveFile'>[]>> {
		const result = new Map<string, Packed<'DriveFile'>[]>();
		for (const record of records) result.set(record.id, []);
		const ids = [...new Set(records.flatMap(record => record.fileIds ?? []))];
		if (ids.length === 0) return result;
		const files = await this.filesRepository.findBy({ id: In(ids) });
		const byId = new Map(files.map(file => [file.id, file]));
		const allowed = new Set(records.flatMap(record => (record.fileIds ?? []).filter(id => {
			const file = byId.get(id);
			return file?.userId === record.userId && file.type.startsWith('image/');
		})));
		const packed = await this.driveFileEntityService.packMany(files.filter(file => allowed.has(file.id)), { self: false, detail: false });
		const packedById = new Map(packed.map(file => [file.id, file]));
		for (const record of records) {
			result.set(record.id, (record.fileIds ?? []).flatMap(id => {
				const file = byId.get(id), value = packedById.get(id);
				return file?.userId === record.userId && value ? [value] : [];
			}));
		}
		return result;
	}
}
