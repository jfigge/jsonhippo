/*
 * Copyright 2026 Jason Figge
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Tokenizer, TokenType as T, decodeStringLiteral, decodeEscapesLoosely } from "../src/js/parser/tokenizer.js";
import { makeLargeText } from "./fixtures/generate.js";
import { bestTime, catchError } from "./helpers.js";

const tokens = (text) => [...new Tokenizer(text)];
const brief = (text) => tokens(text).map((t) => [t.type, t.value, t.line, t.column]);

describe("tokens", () => {
  test("{\"a\":1} on line 3 has exact positions", () => {
    const toks = tokens('\n\n{"a":1}');
    assert.deepEqual(
      toks.map(({ type, value, raw, line, column, offset, endOffset }) => ({ type, value, raw, line, column, offset, endOffset })),
      [
        { type: T.LBRACE, value: "{", raw: "{", line: 3, column: 1, offset: 2, endOffset: 3 },
        { type: T.STRING, value: "a", raw: '"a"', line: 3, column: 2, offset: 3, endOffset: 6 },
        { type: T.COLON, value: ":", raw: ":", line: 3, column: 5, offset: 6, endOffset: 7 },
        { type: T.NUMBER, value: "1", raw: "1", line: 3, column: 6, offset: 7, endOffset: 8 },
        { type: T.RBRACE, value: "}", raw: "}", line: 3, column: 7, offset: 8, endOffset: 9 },
        { type: T.EOF, value: null, raw: "", line: 3, column: 8, offset: 9, endOffset: 9 },
      ],
    );
  });

  test("every token type", () => {
    assert.deepEqual(
      tokens('[ ] { } : , "s" -1.5e3 true false null').map((t) => t.type),
      [T.LBRACKET, T.RBRACKET, T.LBRACE, T.RBRACE, T.COLON, T.COMMA, T.STRING, T.NUMBER, T.TRUE, T.FALSE, T.NULL, T.EOF],
    );
  });

  test("literal values", () => {
    assert.deepEqual(brief("true false null"), [
      [T.TRUE, true, 1, 1],
      [T.FALSE, false, 1, 6],
      [T.NULL, null, 1, 12],
      [T.EOF, null, 1, 16],
    ]);
  });

  test("numbers keep their raw text", () => {
    const values = tokens("0 -0 12345678901234567890 1.50 1E+2 -1e-7").filter((t) => t.type === T.NUMBER).map((t) => t.value);
    assert.deepEqual(values, ["0", "-0", "12345678901234567890", "1.50", "1E+2", "-1e-7"]);
  });

  test("empty and whitespace-only input give EOF", () => {
    assert.deepEqual(brief(""), [[T.EOF, null, 1, 1]]);
    assert.deepEqual(brief(" \t\n \r\n  "), [[T.EOF, null, 3, 3]]);
  });

  test("peek does not consume; next and the iterator agree", () => {
    const t = new Tokenizer("[1]");
    assert.equal(t.peek().type, T.LBRACKET);
    assert.equal(t.peek().type, T.LBRACKET);
    assert.equal(t.next().type, T.LBRACKET);
    assert.equal(t.next().value, "1");
    assert.equal(t.peek().type, T.RBRACKET);
    assert.deepEqual([...t].map((x) => x.type), [T.RBRACKET, T.EOF]);
  });
});

describe("line and column tracking", () => {
  test("\\n starts a new line", () => {
    assert.deepEqual(brief("[\n  1,\n  2\n]").slice(0, 5), [
      [T.LBRACKET, "[", 1, 1],
      [T.NUMBER, "1", 2, 3],
      [T.COMMA, ",", 2, 4],
      [T.NUMBER, "2", 3, 3],
      [T.RBRACKET, "]", 4, 1],
    ]);
  });

  test("\\r\\n counts as one newline", () => {
    assert.deepEqual(brief("[\r\n1,\r\n\r\n2]").map(([type, , line, column]) => [type, line, column]), [
      [T.LBRACKET, 1, 1],
      [T.NUMBER, 2, 1],
      [T.COMMA, 2, 2],
      [T.NUMBER, 4, 1],
      [T.RBRACKET, 4, 2],
      [T.EOF, 4, 3],
    ]);
  });

  test("a lone \\r is a newline too", () => {
    assert.deepEqual(brief("[\r1]").map(([, , line, column]) => [line, column]), [
      [1, 1],
      [2, 1],
      [2, 2],
      [2, 3],
    ]);
  });

  test("columns count UTF-16 code units, matching textarea offsets", () => {
    const [, , , after] = tokens('["🦛", 1]');
    // 🦛 is two code units, so the string token is 4 wide and 1 starts at column 8.
    assert.equal(after.value, "1");
    assert.equal(after.column, 8);
    assert.equal(after.offset, 7);
  });
});

describe("strings", () => {
  const value = (literal) => tokens(literal)[0].value;

  test("every simple escape", () => {
    assert.equal(value(String.raw`"\" \\ \/ \b \f \n \r \t"`), '" \\ / \b \f \n \r \t');
  });

  test("\\u escapes, upper and lower case hex", () => {
    assert.equal(value(String.raw`"caf\u00e9 \u00C9"`), "café É");
  });

  test("surrogate pairs combine into one character", () => {
    const s = value(String.raw`"\ud83e\udd9b"`);
    assert.equal(s, "🦛");
    assert.equal([...s].length, 1);
  });

  test("lone surrogates are kept, as JSON.parse keeps them", () => {
    assert.equal(value(String.raw`"\ud800x"`), JSON.parse(String.raw`"\ud800x"`));
    assert.equal(value(String.raw`"\udc00"`), "\udc00");
  });

  test("raw non-ASCII passes through", () => {
    assert.equal(value('"日本語 🦛"'), "日本語 🦛");
  });

  test("raw is the source text including quotes", () => {
    assert.equal(tokens(String.raw`"a\nb"`)[0].raw, String.raw`"a\nb"`);
  });

  test("decodeEscapesLoosely: the same escapes, raw characters passed through", () => {
    assert.equal(decodeEscapesLoosely(String.raw`\"a\" \\ \/ \n é 🦛`), '"a" \\ / \n é 🦛');
    assert.equal(decodeEscapesLoosely('raw\nline "quote"\ttab'), 'raw\nline "quote"\ttab');
    assert.throws(() => decodeEscapesLoosely(String.raw`bad \x`), { code: "BAD_ESCAPE" });
    assert.throws(() => decodeEscapesLoosely(String.raw`bad \u12G4`), { code: "BAD_UNICODE_ESCAPE" });
    assert.throws(() => decodeEscapesLoosely("ends in a backslash \\"));
  });

  test("decodeStringLiteral uses the same rules", () => {
    assert.equal(decodeStringLiteral(String.raw`"{\"a\":1}"`), '{"a":1}');
    assert.throws(() => decodeStringLiteral(String.raw`"a" "b"`));
    assert.throws(() => decodeStringLiteral("123"));
    assert.throws(() => decodeStringLiteral(String.raw`"bad \x"`), { code: "BAD_ESCAPE" });
  });
});

describe("lexical errors", () => {
  // [input, code, line, column] — every code at least once, exact positions.
  const cases = [
    ['"abc', "UNTERMINATED_STRING", 1, 1],
    ['[1,\n  "abc\n]', "UNTERMINATED_STRING", 2, 3],
    ['{"a": "abc,\n "b": 2}', "UNTERMINATED_STRING", 1, 7],
    ['"ends in a backslash\\', "UNTERMINATED_STRING", 1, 1],
    [String.raw`"\x"`, "BAD_ESCAPE", 1, 2],
    [String.raw`["ok", "C:\Users"]`, "BAD_ESCAPE", 1, 11],
    [String.raw`"\u12G4"`, "BAD_UNICODE_ESCAPE", 1, 2],
    [String.raw`"ab\u12"`, "BAD_UNICODE_ESCAPE", 1, 4],
    ['"a\tb"', "CONTROL_CHAR_IN_STRING", 1, 3],
    ['"a\u0001b"', "CONTROL_CHAR_IN_STRING", 1, 3],
    ['{"a": "line\nline"}', "CONTROL_CHAR_IN_STRING", 1, 12],
    ["01", "BAD_NUMBER", 1, 1],
    ["1.", "BAD_NUMBER", 1, 1],
    ["-", "BAD_NUMBER", 1, 1],
    ["1e", "BAD_NUMBER", 1, 1],
    ["[1, 0x1F]", "BAD_NUMBER", 1, 5],
    ["  -Infinity", "BAD_NUMBER", 1, 3],
    ["tru", "BAD_LITERAL", 1, 1],
    ["nul", "BAD_LITERAL", 1, 1],
    ["True", "BAD_LITERAL", 1, 1],
    ["[\n  undefined]", "BAD_LITERAL", 2, 3],
    ["'", "UNEXPECTED_CHAR", 1, 1],
    ["#", "UNEXPECTED_CHAR", 1, 1],
    ["[1, @]", "UNEXPECTED_CHAR", 1, 5],
    ["\u00a0[]", "UNEXPECTED_CHAR", 1, 1],
  ];

  for (const [input, code, line, column] of cases) {
    test(`${code} at ${line}:${column} for ${JSON.stringify(input)}`, () => {
      const err = catchError(() => tokens(input));
      assert.equal(err.code, code);
      assert.equal(err.line, line, "line");
      assert.equal(err.column, column, "column");
    });
  }

  test("'}' alone is a token, '@' is not", () => {
    assert.equal(tokens("}")[0].type, T.RBRACE);
    assert.equal(catchError(() => tokens("@")).code, "UNEXPECTED_CHAR");
  });

  test("an unterminated string reports its OPENING quote, however far EOF is", () => {
    const text = `{\n  "a": 1,\n  "big": "${"x".repeat(1_000_000)}`;
    const err = catchError(() => tokens(text));
    assert.equal(err.code, "UNTERMINATED_STRING");
    assert.deepEqual([err.line, err.column, err.offset], [3, 10, text.indexOf('"x')]);
  });

  test("errors carry the offending range, for selecting it", () => {
    const err = catchError(() => tokens("[1, tru]"));
    assert.deepEqual([err.offset, err.endOffset], [4, 7]);
  });

  test("hints name the likely mistake", () => {
    assert.match(catchError(() => tokens("True")).hint, /lower-case/);
    assert.match(catchError(() => tokens("01")).hint, /leading zeros/);
    assert.match(catchError(() => tokens("// c")).hint, /comments/);
    assert.match(catchError(() => tokens("\u00a0")).hint, /invisible/i);
    assert.match(catchError(() => tokens(String.raw`{\"a\":1}`.slice(1))).hint, /Unescape/);
  });
});

describe("performance", () => {
  test("a 5 MB document tokenizes in under ~300 ms", () => {
    const text = makeLargeText(5 * 1024 * 1024, 42);
    assert.ok(text.length >= 5 * 1024 * 1024, `fixture is ${text.length} chars`);
    let count = 0;
    const ms = bestTime(() => {
      const tokenizer = new Tokenizer(text);
      count = 1;
      while (tokenizer.next().type !== T.EOF) count++;
    });
    assert.ok(count > 500_000);
    assert.ok(ms < 300, `took ${ms.toFixed(0)} ms`);
  });
});
