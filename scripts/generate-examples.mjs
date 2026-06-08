#!/usr/bin/env node
// Generate real request/response fixtures by calling an OpenAI-compatible
// endpoint (LM Studio by default), then save each payload under examples/.
// These double as a demo of the inspect-json pipeline and as data you can
// re-render to verify behaviour:
//
//   node scripts/generate-examples.mjs
//   node bin/inspect-json.mjs examples/basic-chat-response.json
//
// Configurable via env:
//   LMSTUDIO_URL    base URL, default http://localhost:1234/v1
//   LMSTUDIO_MODEL  model id, default nvidia/nemotron-3-nano-omni

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.LMSTUDIO_URL || 'http://localhost:1234/v1';
const MODEL = process.env.LMSTUDIO_MODEL || 'nvidia/nemotron-3-nano-omni';

const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(here, '..', 'examples');

// Each scenario exercises a different part of the renderer: plain messages,
// tool definitions + tool calls, and JSON returned inside message content.
const scenarios = [
	{
		name: 'basic-chat',
		title: 'Basic chat',
		body: {
			model: MODEL,
			temperature: 0,
			max_tokens: 1024,
			messages: [
				{ role: 'system', content: 'You are a concise assistant.' },
				{
					role: 'user',
					content: 'In one sentence, what is a JSON log?',
				},
			],
		},
	},
	{
		name: 'tool-call',
		title: 'Tool call',
		body: {
			model: MODEL,
			temperature: 0,
			max_tokens: 1024,
			messages: [
				{
					role: 'user',
					content:
						'What is the weather in Paris, France? Use the get_weather tool.',
				},
			],
			tools: [
				{
					type: 'function',
					function: {
						name: 'get_weather',
						description: 'Get the current weather for a location.',
						parameters: {
							type: 'object',
							properties: {
								location: {
									type: 'string',
									description: 'City and country, e.g. "Paris, France"',
								},
								unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
							},
							required: ['location'],
						},
					},
				},
			],
			tool_choice: 'auto',
		},
	},
	{
		name: 'structured-output',
		title: 'Structured (JSON) output',
		body: {
			model: MODEL,
			temperature: 0,
			max_tokens: 1024,
			messages: [
				{
					role: 'user',
					content:
						'Return ONLY a JSON object (no prose, no markdown) with keys ' +
						'name (string), born (integer), occupation (string) for: ' +
						'Ada Lovelace, born 1815, mathematician.',
				},
			],
		},
	},
];

async function callChatCompletions(body) {
	const response = await fetch(`${BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
	}
	return JSON.parse(text);
}

async function writeJson(name, value) {
	const file = join(examplesDir, name);
	await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
	return file;
}

async function main() {
	await mkdir(examplesDir, { recursive: true });
	process.stdout.write(`Using ${MODEL} at ${BASE_URL}\n`);

	for (const scenario of scenarios) {
		process.stdout.write(`\n[${scenario.title}]\n`);
		await writeJson(`${scenario.name}-request.json`, scenario.body);

		const response = await callChatCompletions(scenario.body);
		const responseFile = await writeJson(
			`${scenario.name}-response.json`,
			response,
		);

		process.stdout.write(`  saved ${scenario.name}-request.json\n`);
		process.stdout.write(`  saved ${scenario.name}-response.json\n`);
		process.stdout.write(
			`  inspect: node bin/inspect-json.mjs ${responseFile}\n`,
		);
	}
}

main().catch((error) => {
	process.stderr.write(`generate-examples: ${error.message}\n`);
	process.stderr.write(
		'Is LM Studio running with a model loaded? See scripts header for env vars.\n',
	);
	process.exitCode = 1;
});
