/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export interface HataigoChatPolicy { readonly retentionDays: number; readonly disclosureVersion: string }
export const HATAIGO_CHAT_POLICY = Symbol('HATAIGO_CHAT_POLICY');
/** Approved 2026-10-20: normal chat expires after 30 days. Reports use existing abuse records;
 * operators access them for reports/abuse response, and external disclosure is decided individually.
 * No environment/API activation or retention override exists.
 */
export const hataigoChatRetentionPolicy: HataigoChatPolicy | null = { retentionDays: 30, disclosureVersion: 'hataigo-chat-2026-10-20-v1' };
