// Transformers prepare parsed data before a strategy renders it. They are kept
// explicit (looked up by name) so new preprocessing steps stay discoverable
// instead of turning into scattered conditionals in the render path.

const DEFAULT_DECODE = {
	maxDepth: 8,
	maxStringChars: 1_000_000,
};

export function applyTransformers(value, names) {
	let next = value;
	for (const name of names) {
		if (name === 'json_in_json') {
			next = decodeJsonStrings(next);
			continue;
		}
		throw new Error(`unknown transformer: ${name}`);
	}
	return next;
}

// Recursively parse string values that themselves contain JSON, so embedded
// payloads (a tool argument blob, a stringified response) are inspected rather
// than printed as opaque escaped text. Bounded by depth and string length to
// stay safe on untrusted input.
export function decodeJsonStrings(value, options = DEFAULT_DECODE, depth = 0) {
	if (depth >= options.maxDepth) {
		return value;
	}
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (
			trimmed.length <= options.maxStringChars &&
			((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
				(trimmed.startsWith('[') && trimmed.endsWith(']')))
		) {
			try {
				return decodeJsonStrings(JSON.parse(trimmed), options, depth + 1);
			} catch {
				return value;
			}
		}
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => decodeJsonStrings(item, options, depth + 1));
	}
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				decodeJsonStrings(item, options, depth + 1),
			]),
		);
	}
	return value;
}
