# Examples

Real request/response payloads captured from an OpenAI-compatible endpoint,
used both as a demo and as fixtures for verifying the renderer.

They were generated with [`scripts/generate-examples.mjs`](../scripts/generate-examples.mjs)
against [LM Studio](https://lmstudio.ai) running `nvidia/nemotron-3-nano-omni`.
To regenerate them yourself (with any model / endpoint):

```sh
node scripts/generate-examples.mjs
# or point at a different model:
LMSTUDIO_MODEL='your/model' node scripts/generate-examples.mjs
```

Each pair is the exact request body that was sent and the response that came
back. Re-render any of them with:

```sh
node bin/inspect-json.mjs examples/<file>.json
```

These came from a reasoning model, which is why the responses include
`reasoning_content` and a `reasoning` token count in `usage`.

## 1. Basic chat — `basic-chat-{request,response}.json`

A plain system + user exchange. Shows model, message rendering, and a usage
summary.

```
$ inspect-json examples/basic-chat-response.json
LLM Response
model: nvidia/nemotron-3-nano-omni
system_fingerprint: nvidia/nemotron-3-nano-omni
usage: 95 total / 32 prompt / 63 completion / 27 reasoning

choice[0]
finish: stop
  role: assistant
  content: text

A JSON log is a structured text record formatted as JSON that captures events or data with key‑value pairs, arrays, and nested objects for easy parsing and analysis.
```

## 2. Tool call — `tool-call-{request,response}.json`

The request exposes a `get_weather` tool; the response is a tool call. Tool
definitions render as terse signatures (`name(required, optional?)`), and the
tool call's `arguments` string is decoded from JSON-in-JSON into a compact
signature.

```
$ inspect-json examples/tool-call-request.json
LLM Request
model: nvidia/nemotron-3-nano-omni

messages (1)

message[0] user
  role: user
  content: text
    What is the weather in Paris, France? Use the get_weather tool.

tools (1)
  - get_weather(location, unit?)

$ inspect-json examples/tool-call-response.json
LLM Response
...
choice[0]
finish: tool_calls
  role: assistant
  content: empty string
  tool_calls: 1
    - get_weather({location: "Paris, France"})
```

## 3. Structured (JSON) output — `structured-output-{request,response}.json`

The assistant returns a JSON object as a string inside `message.content`.
`inspect-json` detects and decodes it, labelling the content `json object` and
pretty-printing the embedded JSON instead of showing an escaped blob.

```
$ inspect-json examples/structured-output-response.json
LLM Response
...
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
