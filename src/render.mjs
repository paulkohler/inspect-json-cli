// Presentation primitives: ANSI color, JSON formatting, value summaries, and
// the small line buffer used to assemble strategy output. Nothing here knows
// about specific document shapes — that lives in strategies.mjs.

const RESET = '\u001b[0m';
const COLORS = {
	dim: '\u001b[2m',
	key: '\u001b[36m',
	string: '\u001b[32m',
	number: '\u001b[33m',
	bool: '\u001b[35m',
	nullish: '\u001b[90m',
	heading: '\u001b[1m',
	path: '\u001b[34m',
	error: '\u001b[31m',
};

const DEFAULT_TEXT_PREVIEW = {
	maxChars: 1600,
	maxLines: 18,
};

export function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function color(ctx, name, text) {
	if (!ctx.color) {
		return text;
	}
	return `${COLORS[name] || ''}${text}${RESET}`;
}

export function indent(text, spaces) {
	const pad = ' '.repeat(spaces);
	return text
		.split('\n')
		.map((line) => `${pad}${line}`)
		.join('\n');
}

export function formatJson(value, ctx) {
	return colorizeJson(JSON.stringify(value, null, 2), ctx);
}

function colorizeJson(json, ctx) {
	if (!ctx.color) {
		return json;
	}
	return json
		.replace(/^(\s*)"([^"]+)":/gmu, (_, spaces, key) => {
			return `${spaces}${color(ctx, 'key', `"${key}"`)}:`;
		})
		.replace(/: "([^"\\]*(?:\\.[^"\\]*)*)"/gu, (_, text) => {
			return `: ${color(ctx, 'string', `"${text}"`)}`;
		})
		.replace(/: (-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/giu, (_, text) => {
			return `: ${color(ctx, 'number', text)}`;
		})
		.replace(/: (true|false)/gu, (_, text) => {
			return `: ${color(ctx, 'bool', text)}`;
		})
		.replace(/: null/gu, () => `: ${color(ctx, 'nullish', 'null')}`);
}

function formatScalar(value, ctx) {
	if (typeof value === 'number') {
		return color(ctx, 'number', String(value));
	}
	if (typeof value === 'boolean') {
		return color(ctx, 'bool', String(value));
	}
	if (value === null) {
		return color(ctx, 'nullish', 'null');
	}
	return String(value);
}

// A short, single-line description of an arbitrary value, used for compact
// signatures (tool calls, usage fallbacks, response formats).
export function summarizeValue(value) {
	if (value === null) {
		return 'null';
	}
	if (value === undefined) {
		return '';
	}
	if (typeof value === 'string') {
		return JSON.stringify(value);
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	if (Array.isArray(value)) {
		return `[${value.length} items]`;
	}
	if (isObject(value)) {
		const entries = Object.entries(value).slice(0, 4);
		return `{${entries.map(([key, item]) => `${key}: ${summarizeValue(item)}`).join(', ')}}`;
	}
	return String(value);
}

// Trim long text to a previewable size, noting how much was omitted.
export function previewText(text, limits = DEFAULT_TEXT_PREVIEW) {
	const lines = text.split('\n');
	const limitedLines = lines.slice(0, limits.maxLines);
	let preview = limitedLines.join('\n');
	const omitted = [];
	if (lines.length > limits.maxLines) {
		omitted.push(`${lines.length - limits.maxLines} line(s)`);
	}
	if (preview.length > limits.maxChars) {
		const omittedChars = preview.length - limits.maxChars;
		preview = preview.slice(0, limits.maxChars);
		omitted.push(`${omittedChars} char(s)`);
	}
	if (omitted.length > 0) {
		preview = `${preview}\n... omitted ${omitted.join(', ')}; use --verbose for full content`;
	}
	return preview;
}

// Label the shape of a message's content so the reader knows what follows.
export function classifyContent(content) {
	if (typeof content !== 'string') {
		return Array.isArray(content) ? 'json array' : 'json object';
	}
	const trimmed = content.trim();
	if (!trimmed) {
		return 'empty string';
	}
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
		return 'json string';
	}
	if (/^#{1,6}\s|```|\n[-*]\s/u.test(trimmed)) {
		return 'markdown';
	}
	return 'text';
}

// An ordered line buffer. Strategies push headings, key/value pairs, and
// pre-rendered blocks, then call toString() once.
export class Lines {
	constructor(ctx) {
		this.ctx = ctx;
		this.lines = [];
	}

	heading(text) {
		this.line(color(this.ctx, 'heading', text));
	}

	kv(key, value) {
		this.line(
			`${color(this.ctx, 'key', key)}: ${formatScalar(value, this.ctx)}`,
		);
	}

	block(text) {
		this.lines.push(...String(text).split('\n'));
	}

	blank() {
		this.line('');
	}

	line(text) {
		this.lines.push(text);
	}

	toString() {
		return this.lines.join('\n').trimEnd();
	}
}
