/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { GlobalEventService, type HatadyTimelineSource } from './GlobalEventService.js';

/** A committed mutation only needs to identify the activity. Each viewer reloads and packs it. */
@Injectable()
export class HatadyStreamService {
	constructor(private globalEventService: GlobalEventService) {}

	public changed(source: HatadyTimelineSource, id: string): void {
		this.globalEventService.publishHatadyActivityStream(source, id);
	}

	public refresh(viewerId: string): void {
		this.globalEventService.publishHatadyTimelineRefresh(viewerId);
	}
}
