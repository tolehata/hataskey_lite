#!/bin/bash

# SPDX-FileCopyrightText: syuilo and misskey-project
# SPDX-License-Identifier: AGPL-3.0-only

# Use the same configuration and working directory as the backend, including
# CHERRYPICK_CONFIG_YML, NODE_ENV=test, PORT and relative Unix socket paths.
cd "$(dirname "${BASH_SOURCE[0]}")/packages/backend" || exit 1
exec node --input-type=module <<'NODE'
import { spawnSync } from 'node:child_process';
import { loadConfig } from './built/config.js';

const { port, socket } = loadConfig();
const args = ['--fail', '--silent', '--show-error', '--output', '/dev/null', '--noproxy', '*', '--connect-timeout', '5', '--max-time', '10'];
if (socket) {
	args.push('--unix-socket', socket, 'http://localhost/healthz');
} else {
	args.push(`http://127.0.0.1:${port}/healthz`);
}
const result = spawnSync('curl', args, { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
NODE
