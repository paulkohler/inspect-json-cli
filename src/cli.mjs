// Command-line surface: argument parsing, the --help text, and reading stdin.
// All terminal-facing concerns live here; the rest of src/ is plain functions.

import { once } from 'node:events';
import { STRATEGIES } from './strategies.mjs';

export function parseArgs(argv, env = {}) {
	const options = {
		color: env.colorDefault !== false,
		file: '',
		help: false,
		helpText: usage(),
		raw: false,
		strategy: '',
		verbose: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '-h' || arg === '--help') {
			options.help = true;
			return options;
		}
		if (arg === '-v' || arg === '--verbose') {
			options.verbose = true;
			continue;
		}
		if (arg === '--no-color') {
			options.color = false;
			continue;
		}
		if (arg === '--color') {
			options.color = true;
			continue;
		}
		if (arg === '--raw') {
			options.raw = true;
			continue;
		}
		if (arg === '--strategy') {
			index += 1;
			if (!argv[index]) {
				throw new Error('--strategy requires a value');
			}
			options.strategy = argv[index];
			continue;
		}
		if (arg.startsWith('--strategy=')) {
			options.strategy = arg.slice('--strategy='.length);
			continue;
		}
		if (arg.startsWith('-')) {
			throw new Error(`unknown option: ${arg}`);
		}
		if (options.file) {
			throw new Error('only one input file is supported');
		}
		options.file = arg;
	}

	if (options.strategy && !STRATEGIES[options.strategy]) {
		throw new Error(`unknown strategy: ${options.strategy}`);
	}

	return options;
}

export async function readStdin(stream) {
	let text = '';
	stream.setEncoding('utf8');
	stream.on('data', (chunk) => {
		text += chunk;
	});
	if (!stream.readableEnded) {
		await once(stream, 'end');
	}
	return text;
}

export function usage() {
	return `inspect-json: filtered pretty-printer for JSON-heavy AI logs

Usage:
  inspect-json [options] <file>
  cat raw-response.json | inspect-json [options]

Options:
  --strategy <name>  Force a strategy: json, llm_request, llm_response
  -v, --verbose      Include lower-level ids, raw payloads, and extra metadata
  --raw              Disable JSON-in-JSON decoding and strategy transforms
  --color            Force ANSI color
  --no-color         Disable ANSI color
  -h, --help         Show help`;
}
