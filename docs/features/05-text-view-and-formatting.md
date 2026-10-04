# 05 — Text View and Formatting

## Context
The Text tab is where JSON is pasted. Unlike stack.hu, it must **always** accept input, even when the input is invalid, because the user needs to see the bad text in order to fix it. It is also where parser errors are shown in place.

## Goal
A text editor area that accepts any input, offers the standard tools (format, minify, copy, clear) and highlights parse errors at the exact position.

## Design
- A `<textarea>` with a line-number gutter (`jh-input`, `jh-gutter`), kept in sync on scroll.
- **Toolbar** (`jh-toolbar`) with these buttons:
  - **Format**: pretty-print from the AST, with an indent of 2 or 4 spaces or a tab (setting).
  - **Minify**: compact output from the AST.
  - **Unescape**: see `04-smart-paste.md`.
  - **Copy**: copy to the clipboard.
  - **Clear**.
  - **Load from file**: a file picker, read locally.
- `formatter.js` builds output from the **AST**, not from `JSON.stringify`, so raw number text and key order are kept exactly.
- **Validation** runs on paste, on Format, and debounced (about 400 ms) while typing.
- **Error display**:
  - The status bar (`jh-status--error`) shows `error.toString()` and the hint.
  - The gutter line is marked (`jh-gutter-line--error`).
  - Clicking the error moves the caret to the error offset, selects the bad token and scrolls it into view.
  - For `UNCLOSED_CONTAINER` and `MISMATCHED_CLOSE`, a second link jumps to the opener.
- When the input is valid, the status bar shows a summary such as "Valid JSON — 1,284 keys, depth 7, 2.1 MB" and any duplicate-key warnings.

## Steps
1. Build the `TextView` class with the textarea, gutter and toolbar.
2. Implement `formatter.js` (pretty-print and minify from the AST).
3. Wire up validation and the error display.
4. Add the jump-to-error and jump-to-opener behaviour.

## Acceptance
- Invalid input stays in the Text tab and is never cleared or rejected.
- Clicking the error places the caret on the exact bad character, including in a file of several MB.
- Format on valid input produces output that the custom parser parses back to the same AST.
- `{"n": 12345678901234567890}` formats with the number unchanged.
- Key order is preserved through Format and Minify.

## Constraints
- No code-editor library for v1. A plain textarea and a gutter are enough.
- Typing must stay responsive on large inputs. The debounce, plus skipping live validation above a size threshold (for example 5 MB, validating on Format only), is acceptable.

## Verify
- Manual: paste a valid file, then format, minify and copy it.
- Paste each fixture in `test/fixtures/invalid/`, click the error, and confirm the caret position.
