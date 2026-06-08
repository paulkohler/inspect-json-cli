import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	decodeJsonStrings,
	inspectJson,
	parseArgs,
	parseJsonOrJsonl,
	resolveStrategy,
} from '../src/inspector.mjs';

describe('inspect-json', () => {
	it('parses args for strategy, verbose, color, and file', () => {
		const options = parseArgs(
			['--strategy', 'llm_request', '--verbose', '--no-color', 'raw.json'],
			{ colorDefault: true },
		);

		assert.equal(options.strategy, 'llm_request');
		assert.equal(options.verbose, true);
		assert.equal(options.color, false);
		assert.equal(options.file, 'raw.json');
	});

	it('disables color when the TTY default is false', () => {
		// Mirrors a piped stdout / NO_COLOR run: the bin passes colorDefault:false
		// and color must end up off (regression: undefined !== false stayed true).
		const options = parseArgs([], { colorDefault: false });
		assert.equal(options.color, false);

		const fallback = parseArgs([]);
		assert.equal(fallback.color, true);
	});

	it('keeps tool-call arguments as a raw string in --raw mode', () => {
		const document = JSON.stringify({
			choices: [
				{
					message: {
						role: 'assistant',
						content: null,
						tool_calls: [
							{
								id: 'call_1',
								function: {
									name: 'read_file',
									arguments: '{"path":"src/app.mjs"}',
								},
							},
						],
					},
				},
			],
		});

		const decoded = inspectJson(document, { color: false });
		assert.match(decoded, /read_file\(\{path: "src\/app.mjs"\}\)/u);

		const raw = inspectJson(document, { color: false, raw: true });
		assert.match(raw, /read_file\("\{\\"path\\":\\"src\/app.mjs\\"\}"\)/u);
	});

	it('decodes JSON inside JSON strings recursively', () => {
		const value = decodeJsonStrings({
			content: '{"status":"OK","nested":"{\\"count\\":2}"}',
		});

		assert.deepEqual(value, {
			content: { status: 'OK', nested: { count: 2 } },
		});
	});

	it('detects LLM requests', () => {
		const strategy = resolveStrategy({
			model: 'model-a',
			messages: [{ role: 'user', content: 'hello' }],
			tools: [],
		});

		assert.equal(strategy.name, 'llm_request');
	});

	it('renders request messages and terse tool signatures', () => {
		const output = inspectJson(
			JSON.stringify({
				model: 'model-a',
				messages: [
					{ role: 'system', content: 'You are a helpful assistant.' },
					{ role: 'user', content: '{"task":"build"}' },
				],
				tools: [
					{
						type: 'function',
						function: {
							name: 'read_file',
							parameters: {
								type: 'object',
								properties: { path: { type: 'string' } },
								required: ['path'],
							},
						},
					},
				],
			}),
			{ color: false },
		);

		assert.match(output, /LLM Request/u);
		assert.match(output, /model: model-a/u);
		assert.match(output, /read_file\(path\)/u);
		assert.match(output, /"task": "build"/u);
	});

	it('renders LLM response usage and decoded assistant JSON content', () => {
		const output = inspectJson(
			JSON.stringify({
				choices: [
					{
						finish_reason: 'stop',
						message: {
							role: 'assistant',
							content: '{"status":"OK","files":["src/app.mjs"]}',
						},
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 5,
					total_tokens: 15,
				},
			}),
			{ color: false },
		);

		assert.match(output, /LLM Response/u);
		assert.match(output, /usage: 15 total \/ 10 prompt \/ 5 completion/u);
		assert.match(output, /content: json object/u);
		assert.match(output, /"files": \[/u);
	});

	it('renders prose flush-left but keeps decoded JSON indented', () => {
		const prose = inspectJson(
			JSON.stringify({
				choices: [
					{ message: { role: 'assistant', content: 'Plain prose answer.' } },
				],
			}),
			{ color: false },
		);
		// Text content sits at column 0, not indented under the content key.
		assert.match(prose, /^Plain prose answer\.$/mu);

		const json = inspectJson(
			JSON.stringify({
				choices: [
					{ message: { role: 'assistant', content: '{"status":"OK"}' } },
				],
			}),
			{ color: false },
		);
		// Decoded JSON stays indented for scannability.
		assert.match(json, /^ {4}\{$/mu);
		assert.match(json, /^ {6}"status": "OK"$/mu);
	});

	it('previews long string content by default', () => {
		const output = inspectJson(
			JSON.stringify({
				model: 'model-a',
				messages: [
					{
						role: 'system',
						content: Array.from(
							{ length: 40 },
							(_, index) => `line ${index}`,
						).join('\n'),
					},
				],
			}),
			{ color: false },
		);

		assert.match(output, /line 0/u);
		assert.doesNotMatch(output, /line 39/u);
		assert.match(output, /use --verbose for full content/u);
	});

	it('parses JSONL as an array fallback', () => {
		const value = parseJsonOrJsonl('{"a":1}\n{"b":2}\n');
		assert.deepEqual(value, [{ a: 1 }, { b: 2 }]);
	});

	it('renders an LLM response error block without crashing', () => {
		const output = inspectJson(
			JSON.stringify({
				choices: [],
				error: { message: 'bad request', type: 'invalid_request_error' },
			}),
			{ color: false },
		);

		assert.match(output, /LLM Response Error/u);
		assert.match(output, /"message": "bad request"/u);
		assert.match(output, /"type": "invalid_request_error"/u);
	});

	it('renders assistant tool calls with decoded arguments', () => {
		const output = inspectJson(
			JSON.stringify({
				choices: [
					{
						finish_reason: 'tool_calls',
						message: {
							role: 'assistant',
							content: null,
							tool_calls: [
								{
									id: 'call_1',
									function: {
										name: 'read_file',
										arguments: '{"path":"src/app.mjs"}',
									},
								},
							],
						},
					},
				],
			}),
			{ color: false },
		);

		assert.match(output, /tool_calls: 1/u);
		assert.match(output, /read_file\(\{path: "src\/app.mjs"\}\)/u);
	});

	it('summarizes anthropic-style usage tokens', () => {
		const output = inspectJson(
			JSON.stringify({
				choices: [{ message: { role: 'assistant', content: 'hi' } }],
				usage: { input_tokens: 12, output_tokens: 8 },
			}),
			{ color: false },
		);

		assert.match(output, /usage: 12 prompt \/ 8 completion/u);
	});

	it('falls back to the generic json strategy', () => {
		const strategy = resolveStrategy({ anything: true });
		assert.equal(strategy.name, 'json');

		const output = inspectJson(JSON.stringify({ anything: true }), {
			color: false,
		});
		assert.match(output, /"anything": true/u);
	});

	it('leaves embedded JSON strings untouched in --raw mode', () => {
		const output = inspectJson(JSON.stringify({ payload: '{"nested":1}' }), {
			color: false,
			raw: true,
			strategy: 'json',
		});

		assert.match(output, /"payload": "\{\\"nested\\":1\}"/u);
	});

	it('emits ANSI escapes only when color is enabled', () => {
		const document = JSON.stringify({ value: 1 });

		const colored = inspectJson(document, { color: true, strategy: 'json' });
		const plain = inspectJson(document, { color: false, strategy: 'json' });

		const escapeChar = String.fromCharCode(27);
		assert.ok(colored.includes(escapeChar));
		assert.ok(!plain.includes(escapeChar));
	});

	it('honors an explicit --strategy override during detection', () => {
		const strategy = resolveStrategy(
			{ messages: [], model: 'model-a' },
			'json',
		);
		assert.equal(strategy.name, 'json');
	});

	it('reports an unknown strategy', () => {
		assert.throws(() => parseArgs(['--strategy', 'nope']), /unknown strategy/u);
	});

	it('reports a missing --strategy value', () => {
		assert.throws(() => parseArgs(['--strategy']), /requires a value/u);
	});

	it('reports unknown options and extra files', () => {
		assert.throws(() => parseArgs(['--bogus']), /unknown option/u);
		assert.throws(
			() => parseArgs(['a.json', 'b.json']),
			/only one input file/u,
		);
	});

	it('rejects empty and invalid input', () => {
		assert.throws(() => parseJsonOrJsonl('   '), /empty input/u);
		assert.throws(() => parseJsonOrJsonl('{ not json'), /invalid JSON/u);
	});

	it('stops decoding JSON strings past the max depth', () => {
		const nested = decodeJsonStrings(
			{ a: '{"b":"{\\"c\\":1}"}' },
			{ maxDepth: 1, maxStringChars: 1000 },
		);
		// Depth 1 is reached before the inner object is parsed, so it stays a string.
		assert.equal(typeof nested.a, 'string');
	});
});
