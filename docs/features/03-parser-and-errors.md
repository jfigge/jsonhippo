# 03 — Parser and Error Reporting

## Context
This is the headline feature. With large JSON strings, "invalid JSON" is useless. The owner wants to know **exactly** where the input breaks, what was expected and where in the structure it happened. The parser is hand-written recursive descent over the token stream from `02-tokenizer.md`.

## Goal
Parse tokens into an AST. On failure, throw a single precise, human-readable error carrying the position, expected vs found, the JSON path and the stack of open containers.

## Design

### AST nodes
Every node carries its source position so the views can link back to it.
```js
{ kind: 'object', entries: [{ key, keyToken, value }], start, end }
{ kind: 'array',  items: [node...], start, end }
{ kind: 'string' | 'number' | 'boolean' | 'null', value, raw, start, end }
// start/end = { line, column, offset }
```
Object entries keep **source order**. Duplicate keys are kept and recorded as **warnings**, not errors.

### Grammar
```
document := value EOF
value    := object | array | STRING | NUMBER | TRUE | FALSE | NULL
object   := '{' ( member ( ',' member )* )? '}'
member   := STRING ':' value
array    := '[' ( value ( ',' value )* )? ']'
```

### Container stack and path
- The parser keeps a stack of open containers: `{ kind: 'object' | 'array', openToken, key | index }`.
- From that stack it can build the **path** at any point, for example `$.items[3].address.zip`.
- When EOF arrives with containers still open, the error points at the **opening** `{` or `[` of the innermost unclosed container. It also lists the whole unclosed chain.

### `JsonHippoError` (in `errors.js`)
```js
class JsonHippoError extends Error {
  code        // e.g. 'EXPECTED_COMMA_OR_CLOSE'
  line, column, offset
  expected    // e.g. [',', '}']
  found       // e.g. 'STRING "name"'
  path        // e.g. '$.items[3]'
  openStack   // [{ kind, line, column }]
  hint        // optional plain-English suggestion
  toString()  // "Line 42, col 8: expected ',' or '}' but found string \"name\" (in $.items[3])"
}
```

### Parser error codes
| Code | Typical cause | Hint example |
|---|---|---|
| `EXPECTED_VALUE` | `[1,,2]`, `{"a":}` | — |
| `EXPECTED_KEY` | `{a:1}`, `{1:2}` | "Object keys must be double-quoted strings" |
| `EXPECTED_COLON` | `{"a" 1}` | — |
| `EXPECTED_COMMA_OR_CLOSE` | `{"a":1 "b":2}` | "Missing comma after the previous value?" |
| `TRAILING_COMMA` | `[1,2,]`, `{"a":1,}` | "Remove the trailing comma" |
| `MISMATCHED_CLOSE` | `[1,2}` | "Opened with '[' at line X col Y" |
| `UNCLOSED_CONTAINER` | EOF with `{` or `[` still open | Points at the opener |
| `TRAILING_CONTENT` | `{} {}`, `{"a":1}x` | "Only one top-level value is allowed" |
| `EMPTY_INPUT` | Only whitespace | — |
| `MAX_DEPTH` | Nesting deeper than 10,000 | — |

Lexical errors from the tokenizer pass through unchanged, with the parser's current path added.

### API
```js
export function parse(text) // returns { ast, warnings } or throws JsonHippoError
```

## Steps
1. Implement `JsonHippoError` and `toString()`.
2. Implement recursive descent with the container stack and path tracking.
3. Implement each error code, with special handling for trailing commas and mismatched closers.
4. Add the depth guard.
5. Write `test/parser.test.js`. Use `JSON.parse` as an oracle: valid fixtures must produce an AST equivalent to what `JSON.parse` returns.
6. Write `test/parser-errors.test.js` as a table of input, expected code, line and column.

## Acceptance
- Every error code has at least one test asserting the code, line, column and path.
- `[1,2}` gives `MISMATCHED_CLOSE` at the `}`, and the hint references the `[`.
- A large file with one missing comma deep inside reports the exact line and column of the token after the gap, along with the correct path.
- A large file missing its final `}` reports `UNCLOSED_CONTAINER` and points at the **opening** brace, not the end of the file.
- For every valid fixture, the parser's result matches `JSON.parse` (except that numbers keep their raw text).

## Constraints
- No parser libraries and no `JSON.parse` in `src/`.
- The parser is pure JS. It must not use the DOM or jQuery.
- Stop at the first error. Do not attempt recovery or report multiple errors in v1.

## Verify
- `make test`
- Paste the fixtures in `test/fixtures/invalid/` into the app and confirm each message reads clearly.
