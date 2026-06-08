import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';
import { installLocal } from '../src/install-local.mjs';

const execFileAsync = promisify(execFile);

describe('local install', () => {
	it('installed temp shim runs inspect-json', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'inspect-json-bin-'));
		const result = await installLocal(process.cwd(), {
			dir,
			name: 'inspect-json-test',
		});
		const input = join(dir, 'input.json');
		await writeFile(input, '{"ok":true}', 'utf8');

		const { stdout } = await execFileAsync(result.path, [
			'--no-color',
			'--strategy',
			'json',
			input,
		]);

		assert.match(stdout, /"ok": true/u);
	});
});
