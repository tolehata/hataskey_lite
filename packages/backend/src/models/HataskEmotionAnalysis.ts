/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * 旗鯖fork: Hatask感情分析の集計結果。
 * 生本文や投稿単位の結果は保持せず、分析に必要な集計済みの値だけを保存する。
 */
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { id } from './util/id.js';

export type HataskEmotionAnalysisJson = Record<string, unknown>;

@Entity('hatask_emotion_analysis')
export class MiHataskEmotionAnalysis {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone')
	public createdAt: Date;

	@Column(id())
	public userId: string;

	@Column('varchar', { length: 64 })
	public analysisVersion: string;

	@Column('varchar', { length: 64 })
	public lexiconVersion: string;

	@Column('jsonb', { default: () => "'{}'::jsonb" })
	public scope: HataskEmotionAnalysisJson;

	@Column('jsonb', { default: () => "'{}'::jsonb" })
	public source: HataskEmotionAnalysisJson;

	@Column('jsonb', { default: () => "'{}'::jsonb" })
	public summary: HataskEmotionAnalysisJson;

	@Column('jsonb', { default: () => "'{}'::jsonb" })
	public result: HataskEmotionAnalysisJson;
}
