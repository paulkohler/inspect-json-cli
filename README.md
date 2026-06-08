# inspect-json-cli

[![CI](https://github.com/paulkohler/inspect-json-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/paulkohler/inspect-json-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/inspect-json-cli.svg)](https://www.npmjs.com/package/inspect-json-cli)
[![node](https://img.shields.io/node/v/inspect-json-cli.svg)](https://nodejs.org)

`inspect-json` is a zero-dependency Node.js CLI for filtered pretty-printing of
JSON-heavy AI logs.

It is meant for files like:

- LLM request payloads (e.g. OpenAI / OpenRouter chat completions)
- LLM response payloads
- raw request/response artifacts captured from AI tooling
- JSONL logs
- generic JSON files
- JSON in JSON strings

It is not an interactive viewer. It is a terminal renderer that detects common
shapes, recursively decodes JSON embedded inside JSON strings, and prints the
useful parts first.

## At a glance

Given a real LLM response whose `message.content` is a JSON string,
`inspect-json` detects the response shape, decodes the embedded JSON, and shows
the useful parts:

```
$ inspect-json examples/structured-output-response.json
LLM Response
model: nvidia/nemotron-3-nano-omni
system_fingerprint: nvidia/nemotron-3-nano-omni
usage: 195 total / 58 prompt / 137 completion / 101 reasoning

choice[0]
finish: stop
  role: assistant
  content: json object
    {
      "name": "Ada Lovelace",
      "born": 1815,
      "occupation": "mathematician"
    }
```

More worked examples (basic chat, tool calls) live in
[`examples/`](examples/README.md).

## Requirements

- Node.js 22 or newer (uses built-ins only).

## Install Locally

```sh
npm run install-local
```

By default this writes an `inspect-json` shim to `~/.local/bin`.

You can choose a different destination or command name:

```sh
npm run install-local -- --dir ./bin --name inspect-json-dev
```

Global npm install also works:

```sh
npm install -g .
```

Or run directly:

```sh
node bin/inspect-json.mjs raw-response.json
```

## Examples

Let the tool auto-detect the strategy:

```sh
inspect-json raw-response.json
```

Force a request lens:

```sh
inspect-json --strategy llm_request raw-request.json
```

Force a response lens:

```sh
inspect-json --strategy llm_response raw-response.json
```

Use stdin:

```sh
cat raw-response.json | inspect-json
```

Include lower-level ids, raw payloads, and extra metadata:

```sh
inspect-json --verbose raw-response.json
```

Disable color:

```sh
inspect-json --no-color raw-response.json
```

Disable JSON-in-JSON decoding:

```sh
inspect-json --raw raw-response.json
```

## Options

```
--strategy <name>  Force a strategy: json, llm_request, llm_response
-v, --verbose      Include lower-level ids, raw payloads, and extra metadata
--raw              Disable JSON-in-JSON decoding and strategy transforms
--color            Force ANSI color
--no-color         Disable ANSI color
-h, --help         Show help
```

Color is on by default for TTY output. It is disabled automatically when output
is not a TTY or when the `NO_COLOR` environment variable is set.

## Concepts

The renderer is intentionally structured around named strategies and
transformers.

Strategies decide how to display a document:

- `json`: generic pretty JSON fallback
- `llm_request`: model, messages, tools, response format
- `llm_response`: choices, assistant content, tool calls, usage, errors

Transformers prepare data before rendering:

- `json_in_json`: recursively parses string values that contain valid JSON

The `--raw` flag skips transformers entirely, leaving values exactly as parsed.

When no strategy is supplied, `inspect-json` scores the input and chooses the
most specific strategy. You can override that with `--strategy`.

## Output Style

The output is a filtered pretty print, not a graph. It tries to answer:

- What model/provider was used?
- What messages were sent?
- What tools were exposed?
- What tool calls came back?
- What did `message.content` contain?
- Was embedded JSON returned as a string?
- What token/cost/usage fields were present?

## Development

```sh
npm test        # run the node:test suite
npm run check   # syntax check + biome lint
npm run format  # apply biome formatting
```

This project depends only on Node.js built-ins and has no runtime or dev
dependencies. [Biome](https://biomejs.dev) is used for formatting and linting
and is expected to be available on your `PATH` (e.g. installed globally).

## License

[MIT](LICENSE)
