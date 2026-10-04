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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "../src/js/parser/parser.js";
import { JsonHippoError } from "../src/js/parser/errors.js";
import { makeMissingComma, makeMissingFinalBrace } from "./fixtures/generate.js";
import { FIXTURES, catchError, fixtures } from "./helpers.js";

const ALL_CODES = [
  "EXPECTED_VALUE",
  "EXPECTED_KEY",
  "EXPECTED_COLON",
  "EXPECTED_COMMA_OR_CLOSE",
  "TRAILING_COMMA",
  "MISMATCHED_CLOSE",
  "UNCLOSED_CONTAINER",
  "TRAILING_CONTENT",
  "EMPTY_INPUT",
  "MAX_DEPTH",
  "UNTERMINATED_STRING",
  "BAD_ESCAPE",
  "BAD_UNICODE_ESCAPE",
  "CONTROL_CHAR_IN_STRING",
  "BAD_NUMBER",
  "BAD_LITERAL",
  "UNEXPECTED_CHAR",
];

// [input, code, line, column, path, options?]
const CASES = [
  ["[1,,2]", "EXPECTED_VALUE", 1, 4, "$[1]"],
  ['{"a":}', "EXPECTED_VALUE", 1, 6, "$.a"],
  ['{"a": [1, 2], "b": {"c": :}}', "EXPECTED_VALUE", 1, 26, "$.b.c"],
  ["{a:1}", "EXPECTED_KEY", 1, 2, "$"],
  ["{1:2}", "EXPECTED_KEY", 1, 2, "$"],
  ["{'a':1}", "EXPECTED_KEY", 1, 2, "$"],
  ['{"a":1, b:2}', "EXPECTED_KEY", 1, 9, "$"],
  ['{"a" 1}', "EXPECTED_COLON", 1, 6, "$.a"],
  ['{"x": {"a"}}', "EXPECTED_COLON", 1, 11, "$.x.a"],
  ['{"a":1 "b":2}', "EXPECTED_COMMA_OR_CLOSE", 1, 8, "$"],
  ["[1 2]", "EXPECTED_COMMA_OR_CLOSE", 1, 4, "$"],
  ['{"items": [{"id": 1}, {"id": 2 "name": "x"}]}', "EXPECTED_COMMA_OR_CLOSE", 1, 32, "$.items[1]"],
  ["[1,2,]", "TRAILING_COMMA", 1, 5, "$"],
  ['{"a":1,}', "TRAILING_COMMA", 1, 7, "$"],
  ['{"a": [1,\n  2,\n]}', "TRAILING_COMMA", 2, 4, "$.a"],
  ["[1,2}", "MISMATCHED_CLOSE", 1, 5, "$"],
  ['{"a":1]', "MISMATCHED_CLOSE", 1, 7, "$"],
  ["[}", "MISMATCHED_CLOSE", 1, 2, "$"],
  ['{"a": [1, 2}', "MISMATCHED_CLOSE", 1, 12, "$.a"],
  ["[1,}", "MISMATCHED_CLOSE", 1, 4, "$"],
  ["{", "UNCLOSED_CONTAINER", 1, 1, "$"],
  ['{"a": [1, 2', "UNCLOSED_CONTAINER", 1, 7, "$.a"],
  ['{"a": {"b": ', "UNCLOSED_CONTAINER", 1, 7, "$.a"],
  ["[1,", "UNCLOSED_CONTAINER", 1, 1, "$"],
  ["{} {}", "TRAILING_CONTENT", 1, 4, "$"],
  ['{"a":1}x', "TRAILING_CONTENT", 1, 8, "$"],
  ["[]]", "TRAILING_CONTENT", 1, 3, "$"],
  ["", "EMPTY_INPUT", 1, 1, "$"],
  [" \n\t\r\n ", "EMPTY_INPUT", 1, 1, "$"],
  ["[[[[]]]]", "MAX_DEPTH", 1, 4, "$[0][0][0]", { maxDepth: 3 }],
  ['{"a": {"b": {}}}', "MAX_DEPTH", 1, 13, "$.a.b", { maxDepth: 2 }],
  ['{"a": "abc', "UNTERMINATED_STRING", 1, 7, "$.a"],
  ['[1, "x\\', "UNTERMINATED_STRING", 1, 5, "$[1]"],
  ['{"p": "C:\\dir"}', "BAD_ESCAPE", 1, 10, "$.p"],
  ['["\\u12G4"]', "BAD_UNICODE_ESCAPE", 1, 3, "$[0]"],
  ['{"t": "a\tb"}', "CONTROL_CHAR_IN_STRING", 1, 9, "$.t"],
  ['{"zip": 01234}', "BAD_NUMBER", 1, 9, "$.zip"],
  ["[1, 2, -]", "BAD_NUMBER", 1, 8, "$[2]"],
  ['{"ok": True}', "BAD_LITERAL", 1, 8, "$.ok"],
  ["[nul]", "BAD_LITERAL", 1, 2, "$[0]"],
  ["{\"a\": 'x'}", "UNEXPECTED_CHAR", 1, 7, "$.a"],
  ["[1, @]", "UNEXPECTED_CHAR", 1, 5, "$[1]"],
];

describe("error table", () => {
  for (const [input, code, line, column, path, options] of CASES) {
    test(`${code} at ${line}:${column} in ${path} for ${JSON.stringify(input)}`, () => {
      const err = catchError(() => parse(input, options));
      assert.equal(err.code, code, err.toString());
      assert.equal(err.line, line, "line");
      assert.equal(err.column, column, "column");
      assert.equal(err.path, path, "path");
    });
  }

  test("every error code is covered by the table", () => {
    const covered = new Set(CASES.map(([, code]) => code));
    assert.deepEqual(ALL_CODES.filter((c) => !covered.has(c)), []);
  });
});

describe("fixtures in test/fixtures/invalid", () => {
  const expected = JSON.parse(readFileSync(join(FIXTURES, "invalid-expected.json"), "utf8"));

  for (const [name, text] of fixtures("invalid")) {
    test(`invalid/${name}`, () => {
      const want = expected[name];
      assert.ok(want, `${name} is missing from invalid-expected.json`);
      const err = catchError(() => parse(text));
      assert.equal(err.code, want.code, err.toString());
      assert.equal(err.line, want.line, "line");
      assert.equal(err.column, want.column, "column");
      if (want.path) assert.equal(err.path, want.path, "path");
    });
  }

  test("every fixture listed in the manifest exists", () => {
    const names = new Set(fixtures("invalid").map(([name]) => name));
    assert.deepEqual(Object.keys(expected).filter((n) => !names.has(n)), []);
  });
});

describe("error details", () => {
  test("toString reads as one line with position and path", () => {
    const err = catchError(() => parse('{"items": [{"name": "a"}, {"id": 1 "name": "b"}]}'));
    assert.equal(err.toString(), `Line 1, col 36: expected ',' or '}' but found string "name" (in $.items[1])`);
    assert.deepEqual(err.expected, ["','", "'}'"]);
    assert.equal(err.found, 'string "name"');
    assert.equal(err.hint, "Missing comma after the previous value?");
  });

  test("[1,2} — MISMATCHED_CLOSE at the '}', hint and opener point at the '['", () => {
    const err = catchError(() => parse("[\n  1,\n  2}"));
    assert.equal(err.code, "MISMATCHED_CLOSE");
    assert.deepEqual([err.line, err.column], [3, 4]);
    assert.match(err.hint, /Opened with '\[' at line 1 col 1/);
    assert.deepEqual(err.opener, { line: 1, column: 1, offset: 0 });
  });

  test("UNCLOSED_CONTAINER lists the whole unclosed chain", () => {
    const err = catchError(() => parse('{\n  "a": [\n    {"b": 1'));
    assert.deepEqual(err.openStack.map((f) => [f.kind, f.line, f.column]), [
      ["object", 1, 1],
      ["array", 2, 8],
      ["object", 3, 5],
    ]);
    assert.deepEqual([err.line, err.column, err.path], [3, 5, "$.a[0]"]);
    assert.match(err.hint, /3 containers still open: '\{' 1:1 → '\[' 2:8 → '\{' 3:5/);
  });

  test("lexical errors pass through unchanged, with the path added", () => {
    const err = catchError(() => parse('{"list": [1, 2, {"deep": tru}]}'));
    assert.ok(err instanceof JsonHippoError);
    assert.equal(err.code, "BAD_LITERAL");
    assert.equal(err.path, "$.list[2].deep");
    assert.equal(err.openStack.length, 3);
  });

  test("TRAILING_COMMA selects the comma; the hint says to remove it", () => {
    const err = catchError(() => parse("[1,2,]"));
    assert.deepEqual([err.offset, err.endOffset], [4, 5]);
    assert.match(err.hint, /Remove the trailing comma/);
  });

  test("bare-word keys and comments explain themselves", () => {
    assert.match(catchError(() => parse("{a:1}")).hint, /double-quoted/);
    assert.match(catchError(() => parse('{\n  // note\n  "a": 1}')).hint, /comments/);
    assert.match(catchError(() => parse("{} // done")).hint, /comments/);
  });

  test("a 40,000-character path is clipped in toString but kept whole on .path", () => {
    const deep = "[".repeat(10001) + "]".repeat(10001);
    const err = catchError(() => parse(deep));
    assert.equal(err.path.length, 1 + "[0]".length * 10000);
    assert.ok(err.toString().length < 300);
  });
});

describe("large inputs", () => {
  const size = 5 * 1024 * 1024;

  test("one missing comma deep inside: exact line, column and path of the token after the gap", () => {
    const { text, line, column, path, offset } = makeMissingComma(size, 42, 4321);
    const err = catchError(() => parse(text));
    assert.equal(err.code, "EXPECTED_COMMA_OR_CLOSE");
    assert.deepEqual([err.line, err.column, err.offset, err.path], [line, column, offset, path]);
    assert.ok(line > 100_000, `the gap is deep in the file (line ${line})`);
  });

  test("missing final '}': UNCLOSED_CONTAINER at the OPENING brace, not the end of the file", () => {
    const { text } = makeMissingFinalBrace(size, 42);
    const err = catchError(() => parse(text));
    assert.equal(err.code, "UNCLOSED_CONTAINER");
    assert.deepEqual([err.line, err.column, err.offset, err.path], [1, 1, 0, "$"]);
  });
});
