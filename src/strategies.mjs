// Strategies are the lenses inspect-json renders through. Each one declares how
// to detect a document shape (a heuristic score), which transformers to run,
// and how to render it. Detection scores let the highest-confidence strategy
// win when none is forced via --strategy.

import {
	classifyContent,
	color,
	formatJson,
	indent,
	isObject,
	Lines,
	previewText,
	summarizeValue,
} from './render.mjs';

export const STRATEGIES = {
	json: {
		name: 'json',
		detect: () => 1,
		transformers: ['json_in_json'],
		render: renderGeneric,
	},
	llm_request: {
		name: 'llm_request',
		detect: scoreLlmRequest,
		transformers: ['json_in_json'],
		render: renderLlmRequest,
	},
	llm_response: {
		name: 'llm_response',
		detect: scoreLlmResponse,
		transformers: ['json_in_json'],
		render: renderLlmResponse,
	},
};

function scoreLlmRequest(value) {
	if (!isObject(value)) {
		return 0;
	}
	let score = 0;
	if (typeof value.model === 'string') {
		score += 2;
	}
	if (Array.isArray(value.messages)) {
		score += 6;
	}
	if (Array.isArray(value.tools)) {
		score += 3;
	}
	if (value.response_format) {
		score += 2;
	}
	if (
		typeof value.url === 'string' &&
		value.url.includes('/chat/completions')
	) {
		score += 2;
	}
	return score;
}

function scoreLlmResponse(value) {
	if (!isObject(value)) {
		return 0;
	}
	let score = 0;
	if (Array.isArray(value.choices)) {
		score += 7;
	}
	if (value.usage) {
		score += 3;
	}
	if (typeof value.system_fingerprint === 'string') {
		score += 1;
	}
	if (value.error) {
		score += 3;
	}
	return score;
}

function renderLlmRequest(value, ctx) {
	const out = new Lines(ctx);
	out.heading('LLM Request');
	out.kv('model', value.model || '(unknown)');
	if (value.url) {
		out.kv('url', value.url);
	}
	if (value.provider) {
		out.kv('provider', value.provider);
	}
	if (value.response_format) {
		out.kv('response_format', responseFormatName(value.response_format));
	}
	out.blank();
	renderMessages(out, value.messages || [], ctx);
	if (Array.isArray(value.tools)) {
		out.blank();
		renderTools(out, value.tools, ctx);
	}
	if (ctx.verbose) {
		out.blank();
		out.heading('Raw');
		out.block(formatJson(value, ctx));
	}
	return out.toString();
}

function renderLlmResponse(value, ctx) {
	const out = new Lines(ctx);
	out.heading(value.error ? 'LLM Response Error' : 'LLM Response');
	if (value.model) {
		out.kv('model', value.model);
	}
	if (value.system_fingerprint) {
		out.kv('system_fingerprint', value.system_fingerprint);
	}
	if (value.usage) {
		out.kv('usage', formatUsage(value.usage));
	}
	if (value.error) {
		out.blank();
		out.heading('Error');
		out.block(renderContent(value.error, ctx));
	}
	for (const [index, choice] of (value.choices || []).entries()) {
		out.blank();
		out.heading(`choice[${index}]`);
		if (choice.finish_reason) {
			out.kv('finish', choice.finish_reason);
		}
		renderMessage(out, choice.message || choice.delta || {}, ctx, '  ');
	}
	if (ctx.verbose) {
		out.blank();
		out.heading('Raw');
		out.block(formatJson(value, ctx));
	}
	return out.toString();
}

function renderGeneric(value, ctx) {
	return formatJson(value, ctx);
}

function renderMessages(out, messages, ctx) {
	out.heading(`messages (${messages.length})`);
	for (const [index, message] of messages.entries()) {
		out.blank();
		out.heading(`message[${index}] ${message.role || ''}`.trim());
		renderMessage(out, message, ctx, '  ');
	}
}

function renderMessage(out, message, ctx, prefix = '') {
	if (message.role) {
		out.kv(`${prefix}role`, message.role);
	}
	if (message.name && ctx.verbose) {
		out.kv(`${prefix}name`, message.name);
	}
	if (message.tool_call_id && ctx.verbose) {
		out.kv(`${prefix}tool_call_id`, message.tool_call_id);
	}
	if (message.content !== undefined && message.content !== null) {
		const kind = classifyContent(message.content);
		out.kv(`${prefix}content`, kind);
		const rendered = renderContent(message.content, ctx);
		// Prose (text/markdown) reads best flush-left as the raw text; structured
		// content (decoded JSON) stays indented under its key for scannability.
		if (kind === 'text' || kind === 'markdown') {
			out.block(rendered);
		} else {
			out.block(indent(rendered, prefix ? 4 : 2));
		}
	}
	const toolCalls = message.tool_calls || message.toolCalls;
	if (Array.isArray(toolCalls) && toolCalls.length > 0) {
		out.kv(`${prefix}tool_calls`, `${toolCalls.length}`);
		for (const call of toolCalls) {
			out.line(
				`${prefix}  - ${color(ctx, 'path', toolCallSignature(call, ctx))}`,
			);
		}
	}
	if (message.reasoning_content && ctx.verbose) {
		out.kv(`${prefix}reasoning_content`, 'text');
		out.block(indent(String(message.reasoning_content), prefix ? 4 : 2));
	}
}

function renderTools(out, tools, ctx) {
	out.heading(`tools (${tools.length})`);
	for (const tool of tools) {
		const fn = tool.function || {};
		const params = fn.parameters || {};
		const props = params.properties ? Object.keys(params.properties) : [];
		const args = props
			.map((name) => {
				const required = Array.isArray(params.required)
					? params.required.includes(name)
					: false;
				return required ? name : `${name}?`;
			})
			.join(', ');
		out.line(`  - ${color(ctx, 'path', `${fn.name || '(unnamed)'}(${args})`)}`);
		if (ctx.verbose && fn.description) {
			out.line(`    ${fn.description}`);
		}
	}
}

function renderContent(content, ctx) {
	if (typeof content === 'string') {
		return ctx.verbose ? content : previewText(content);
	}
	return formatJson(content, ctx);
}

function toolCallSignature(call, ctx) {
	const fn = call.function || {};
	const name = fn.name || call.name || '(unknown)';
	// In raw mode, leave a stringified arguments blob exactly as received rather
	// than decoding it, matching the "no JSON-in-JSON" promise of --raw.
	const args =
		!ctx.raw && typeof fn.arguments === 'string'
			? safeJson(fn.arguments)
			: fn.arguments;
	const compact = summarizeValue(args);
	if (ctx.verbose && call.id) {
		return `${name}(${compact}) id=${call.id}`;
	}
	return `${name}(${compact})`;
}

function safeJson(text) {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

function responseFormatName(format) {
	if (typeof format === 'string') {
		return format;
	}
	if (format?.json_schema?.name) {
		return format.json_schema.name;
	}
	if (format?.type) {
		return format.type;
	}
	return summarizeValue(format);
}

function formatUsage(usage) {
	const total = usage.total_tokens ?? usage.total ?? '';
	const prompt = usage.prompt_tokens ?? usage.input_tokens ?? '';
	const completion = usage.completion_tokens ?? usage.output_tokens ?? '';
	const details = [];
	if (total !== '') {
		details.push(`${total} total`);
	}
	if (prompt !== '') {
		details.push(`${prompt} prompt`);
	}
	if (completion !== '') {
		details.push(`${completion} completion`);
	}
	if (usage.cost !== undefined) {
		details.push(`cost ${usage.cost}`);
	}
	const reasoning = usage.completion_tokens_details?.reasoning_tokens;
	if (reasoning !== undefined) {
		details.push(`${reasoning} reasoning`);
	}
	return details.length > 0 ? details.join(' / ') : summarizeValue(usage);
}
