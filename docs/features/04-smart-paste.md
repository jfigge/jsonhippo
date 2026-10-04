# 04 — Smart Paste (Auto-Unescape)

## Context
The owner often gets JSON back from APIs and logs as an *escaped string*: it starts with a quote and every inner quote is written `\"`. Stack.hu can't handle this. JsonHippo should spot it and unescape it automatically.

## Goal
When the input is an escaped JSON string, unescape it (repeatedly if it was escaped more than once) and parse the result. Tell the user clearly what was done, and let them undo it.

## Design

### Detection (`smart-paste.js`, pure JS)
```js
export function detectAndUnescape(text) // returns { text, levels, mode } or null
```
After trimming the input:

1. **Quoted form.** The input starts and ends with `"`. Decode it as one JSON string literal, using the tokenizer's string decoder so the same escape rules apply. That is one level. If the result trimmed starts with `"` again, repeat. Stop at a limit of 5 levels.
2. **Bare escaped form.** The input starts with `{\"` or `[\"`, or contains `\"` immediately after `{`, `[` or `,`, but has no outer quotes. Wrap it in quotes and decode it as in (1). This is common when a log line is copied from the middle.
3. After unescaping, the result is used only if it trimmed starts with `{` or `[`. If it is a plain string (for example `"hello"`), leave the input alone. A plain string is valid JSON in its own right.

### Behaviour in the app
- Detection runs on paste and on an explicit **Unescape** button. It does not run on every keystroke.
- On success, the Text view shows the unescaped text and a notice reads *"Unescaped 2 levels of escaped JSON"* with an **Undo** link that restores the original.
- If the unescaped result does not parse, show the parser error against the **unescaped** text, and keep Undo available.
- A setting (on by default) turns auto-unescape on paste on or off.

### Escapes to handle
Everything in `\" \\ \/ \b \f \n \r \t \uXXXX`. For example, an embedded `\n` becomes a real newline, so the pretty-printed result is readable.

## Steps
1. Implement `detectAndUnescape` using the tokenizer's string decoder.
2. Add the multi-level loop with its limit.
3. Add bare-form detection.
4. Wire it to paste plus the button, and add the notice, Undo and setting.
5. Write `test/smart-paste.test.js`.

## Acceptance
| Input | Result |
|---|---|
| `"{\"a\":1}"` | `{"a":1}`, 1 level |
| `"\"{\\\"a\\\":1}\""` | `{"a":1}`, 2 levels |
| `{\"a\":\"x\\ny\"}` (bare) | `{"a":"x\ny"}`, mode bare |
| `"hello"` | Unchanged (null), since it is not JSON inside |
| `{"a":"say \"hi\""}` (normal JSON) | Unchanged (null) |
| `"{\"a\":1"` (unescaped but broken) | Unescaped, then the parser reports `UNCLOSED_CONTAINER` |
- Undo restores the exact original text.
- Normal JSON containing escaped quotes inside its values is never altered.

## Constraints
- Pure JS, unit-testable in Node.
- Never silently change the input. Every change shows the notice with Undo.

## Verify
- `make test`
- Paste each acceptance input into the app and check the notice, the result and Undo.
