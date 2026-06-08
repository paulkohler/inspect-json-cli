// Core orchestration: parse input, pick a strategy, run its transformers, and
// render. This module is also the public entry point — the CLI and tests import
// everything they need from here, so the internal module layout can change
// without breaking callers.

import { STRATEGIES } from './strategies.mjs';
import { applyTransformers } from './transformers.mjs';

export { parseArgs, readStdin } from './cli.mjs';
export { applyTransformers, decodeJsonStrings } from './transformers.mjs';
export { STRATEGIES };

export function inspectJson(input, options = {}) {
	const parsed = parseJsonOrJsonl(input);
	const strategy = resolveStrategy(parsed, options.strategy);
	const transformed = options.raw
		? parsed
		: applyTransformers(parsed, strategy.transformers);
	const ctx = {
		color: options.color === true,
		verbose: options.verbose === true,
		raw: options.raw === true,
	};
	return strategy.render(transformed, ctx);
}

// Parse a document as JSON, falling back to JSONL (one JSON value per line)
// when the whole-text parse fails and there is more than one line.
export function parseJsonOrJsonl(input) {
	const text = input.trim();
	if (!text) {
		throw new Error('empty input');
	}
	try {
		return JSON.parse(text);
	} catch (jsonError) {
		const lines = text
			.split(/\r?\n/u)
			.map((line) => line.trim())
			.filter(Boolean);
		if (lines.length <= 1) {
			throw new Error(`invalid JSON: ${jsonError.message}`);
		}
		try {
			return lines.map((line) => JSON.parse(line));
		} catch (jsonlError) {
			throw new Error(`invalid JSON or JSONL: ${jsonlError.message}`);
		}
	}
}

// Use the requested strategy if given, otherwise score every strategy against
// the value and pick the highest. The generic `json` strategy always scores 1,
// so it wins only when nothing more specific matches.
export function resolveStrategy(value, requested = '') {
	if (requested) {
		return STRATEGIES[requested];
	}
	return Object.values(STRATEGIES)
		.map((strategy) => ({ score: strategy.detect(value), strategy }))
		.sort((left, right) => right.score - left.score)[0].strategy;
}
