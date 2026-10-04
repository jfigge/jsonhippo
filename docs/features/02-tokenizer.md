# 02 — Tokenizer (Lexer)

## Context
The owner wants a **hand-written** parser, not a library or a parser generator. A grammar-driven approach was considered and rejected because it gives too little control over error wording and escaped-string handling. The parser has two stages: tokenizer, then parser. This file covers stage one.

## Goal
Turn raw input text into a stream of tokens. Every token records where it started, so any later error can point at the exact line and column.

## Design

### Token shape
```js
{ type, value, raw, line, column, offset, endOffset }
```
- `type` is one of: `LBRACE {`, `RBRACE }`, `LBRACKET [`, `RBRACKET ]`, `COLON :`, `COMMA ,`, `STRING`, `NUMBER`, `TRUE`, `FALSE`, `NULL`, `EOF`.
- `line` and `column` are **1-based**. `offset` is a 0-based character index.
- For `STRING`, `value` is the decoded string and `raw` is the source text including the quotes.
- For `NUMBER`, `value` is the raw numeric text, kept as-is so large integers don't lose precision. Converting to a JS number is done later, for display only.

### Class
```js
export class Tokenizer {
  constructor(text)
  next()          // returns the next token, or throws JsonHippoError
  peek()
  *[Symbol.iterator]()
}
```
- Track `line`, `column` and `offset` while walking. `\n` increments the line. `\r\n` counts as a single newline.
- Skip whitespace: space, tab, CR, LF.

### Lexical rules (strict RFC 8259)
- **Strings**: `"` … `"`. The allowed escapes are `\" \\ \/ \b \f \n \r \t \uXXXX`, and surrogate pairs are combined. Raw control characters (below U+0020) are not allowed inside a string.
- **Numbers**: `-? (0 | [1-9][0-9]*) (\.[0-9]+)? ([eE][+-]?[0-9]+)?`.
- **Literals**: exactly `true`, `false` or `null`.
- Anything else is an error.

### Lexical errors
Throw `JsonHippoError` (defined in `03-parser-and-errors.md`) with a `code` and a position.

| Code | Example | Position reported |
|---|---|---|
| `UNTERMINATED_STRING` | `"abc` then EOF or a newline | The **opening** quote |
| `BAD_ESCAPE` | `"\x"` | The backslash |
| `BAD_UNICODE_ESCAPE` | `"\u12G4"` | The backslash |
| `CONTROL_CHAR_IN_STRING` | A raw tab or newline inside a string | That character |
| `BAD_NUMBER` | `01`, `1.`, `-`, `1e` | The start of the number |
| `BAD_LITERAL` | `tru`, `nul`, `True` | The start of the word |
| `UNEXPECTED_CHAR` | `'`, `#`, `}` alone is fine but `@` is not | That character |

## Steps
1. Implement the position tracking and the `advance()` / `peekChar()` helpers.
2. Implement each token type.
3. Implement string decoding, including `\u` and surrogate pairs.
4. Implement the lexical errors with the codes above.
5. Write `test/tokenizer.test.js`.

## Acceptance
- Valid input produces the right token types, values and positions. For example, `{"a":1}` on line 3 gives `LBRACE` at 3:1, `STRING "a"` at 3:2, and so on.
- Every error code in the table has at least one test, and each test asserts the exact line and column.
- An unterminated string reports the line and column of the **opening** quote, not EOF. This matters most for huge inputs.
- A 5 MB valid file tokenizes in under about 300 ms in Node.

## Constraints
- No regex for the main scan loop. Walk character by character, as the owner wants to be able to follow it line by line. A small regex for validating a number after it has been scanned is acceptable.
- No DOM and no jQuery. The module must run in Node.

## Verify
- `make test`
- Step through a short input in the debugger and confirm the positions.
