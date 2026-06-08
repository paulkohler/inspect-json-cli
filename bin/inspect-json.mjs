#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { exit, stderr, stdin, stdout } from 'node:process';
import { inspectJson, parseArgs, readStdin } from '../src/inspector.mjs';

try {
	const options = parseArgs(process.argv.slice(2), {
		colorDefault: Boolean(stdout.isTTY) && !process.env.NO_COLOR,
	});

	if (options.help) {
		stdout.write(`${options.helpText}\n`);
		exit(0);
	}

	const input = options.file
		? await readFile(options.file, 'utf8')
		: await readStdin(stdin);
	const output = inspectJson(input, options);
	stdout.write(`${output}\n`);
} catch (error) {
	stderr.write(`inspect-json: ${error.message}\n`);
	exit(1);
}
