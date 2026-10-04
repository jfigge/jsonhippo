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
import { detectAndUnescape, MAX_LEVELS } from "../src/js/smart-paste.js";
import { parse } from "../src/js/parser/parser.js";
import { catchError, fixtures, toJS } from "./helpers.js";

// Inputs are written with String.raw so what is in the test is exactly what
// would be pasted.
describe("acceptance table (docs/features/04-smart-paste.md)", () => {
  test(String.raw`"{\"a\":1}" → {"a":1}, 1 level`, () => {
    assert.deepEqual(detectAndUnescape(String.raw`"{\"a\":1}"`), { text: '{"a":1}', levels: 1, mode: "quoted" });
  });

  test(String.raw`"\"{\\\"a\\\":1}\"" → {"a":1}, 2 levels`, () => {
    assert.deepEqual(detectAndUnescape(String.raw`"\"{\\\"a\\\":1}\""`), { text: '{"a":1}', levels: 2, mode: "quoted" });
  });

  test(String.raw`{\"a\":\"x\\ny\"} (bare) → {"a":"x\ny"}, mode bare`, () => {
    const result = detectAndUnescape(String.raw`{\"a\":\"x\\ny\"}`);
    assert.deepEqual(result, { text: String.raw`{"a":"x\ny"}`, levels: 1, mode: "bare" });
    // …and that \n is a JSON escape: the value has a real newline in it.
    assert.equal(parse(result.text).ast.entries[0].value.value, "x\ny");
  });

  test('"hello" is left alone: not JSON inside', () => {
    assert.equal(detectAndUnescape('"hello"'), null);
  });

  test(String.raw`{"a":"say \"hi\""} (normal JSON) is left alone`, () => {
    assert.equal(detectAndUnescape(String.raw`{"a":"say \"hi\""}`), null);
  });

  test(String.raw`"{\"a\":1" unescapes, then the parser reports UNCLOSED_CONTAINER`, () => {
    const result = detectAndUnescape(String.raw`"{\"a\":1"`);
    assert.deepEqual(result, { text: '{"a":1', levels: 1, mode: "quoted" });
    assert.equal(catchError(() => parse(result.text)).code, "UNCLOSED_CONTAINER");
  });
});

describe("never alters normal JSON", () => {
  const untouched = [
    '{"a": 1}',
    "[1, 2, 3]",
    String.raw`{"msg": "{\"nested\": true}"}`,
    String.raw`["a", "b,\"c\""]`,
    String.raw`{"a":"x,\"y"}`,
    String.raw`[{"k": "\""}, {"k": "[\"x\"]"}]`,
    "42",
    "",
    "   ",
    '"',
  ];
  for (const input of untouched) {
    test(`unchanged: ${input}`, () => assert.equal(detectAndUnescape(input), null));
  }

  test("every valid fixture is left alone", () => {
    for (const [name, text] of fixtures("valid")) {
      const result = detectAndUnescape(text);
      // A top-level string fixture decodes to plain text, which is not JSON.
      assert.equal(result, null, name);
    }
  });
});

describe("forgiving about everything but the escapes", () => {
  const lines = (...l) => l.join("\n");
  // Pretty-printed JSON quoted without escaping its line breaks — how escaped
  // JSON usually looks in a log, or as a string constant in source code.
  const pretty = lines(String.raw`"{`, String.raw`  \"id\": 7,`, String.raw`  \"tags\": [\"a\"]`, String.raw`}"`);
  const prettyDecoded = lines("{", '  "id": 7,', '  "tags": ["a"]', "}");

  test("raw line breaks inside the quotes are kept as line breaks", () => {
    assert.deepEqual(detectAndUnescape(pretty), { text: prettyDecoded, levels: 1, mode: "quoted" });
  });

  test("raw tabs too", () => {
    assert.equal(detectAndUnescape(`"{\t${String.raw`\"a\": 1`}}"`).text, '{\t"a": 1}');
  });

  test("bare escaped JSON with raw line breaks", () => {
    assert.deepEqual(detectAndUnescape(pretty.slice(1, -1)), { text: prettyDecoded, levels: 1, mode: "bare" });
  });

  test("a stray unescaped quote is kept, so the parser can point at it", () => {
    const pasted = lines(String.raw`"{`, String.raw`  \"rate\": null"`, String.raw`}"`);
    const result = detectAndUnescape(pasted);
    assert.equal(result.text, lines("{", '  "rate": null"', "}"));
    const err = catchError(() => parse(result.text));
    assert.deepEqual([err.code, err.line, err.column, err.path], ["UNTERMINATED_STRING", 2, 15, "$"]);
    assert.match(err.hint, /stray/);
  });

  test("the paste that prompted this: escaped twice over, once by hand", () => {
    const [, text] = fixtures("escaped").find(([name]) => name === "broken-stray-quote.txt");
    const err = catchError(() => parse(detectAndUnescape(text).text));
    assert.deepEqual([err.code, err.line, err.column, err.path], ["UNTERMINATED_STRING", 11, 23, "$.metrics"]);
  });

  test("an invalid escape still means it is not escaped JSON", () => {
    assert.equal(detectAndUnescape(String.raw`"{\"path\": \"C:\x\"}"`), null);
  });

  test("quoted text that is not JSON inside is still left alone", () => {
    assert.equal(detectAndUnescape('"a" and "b"'), null);
    assert.equal(detectAndUnescape(lines('"line one', 'line two"')), null);
  });

  test("the bare form never touches JSON that has unescaped quotes", () => {
    assert.equal(detectAndUnescape(lines("{", String.raw`  "a": "x,\"y"`, "}")), null);
    assert.equal(detectAndUnescape(lines("[", String.raw`  "a",\"b"`, "]")), null);
  });
});

describe("details", () => {
  test("surrounding whitespace is ignored", () => {
    assert.equal(detectAndUnescape(`\n  ${String.raw`"[1,\"two\"]"`}  \n`).text, '[1,"two"]');
  });

  test("bare form with whitespace after the opener", () => {
    assert.equal(detectAndUnescape(String.raw`{ \"a\": [ \"b\" ] }`).text, '{ "a": [ "b" ] }');
  });

  test("bare arrays", () => {
    assert.deepEqual(detectAndUnescape(String.raw`[\"a\",\"b\"]`), { text: '["a","b"]', levels: 1, mode: "bare" });
  });

  test("bare JSON escaped twice", () => {
    assert.deepEqual(detectAndUnescape(String.raw`{\\\"a\\\":1}`), { text: '{"a":1}', levels: 2, mode: "bare" });
  });

  test("every escape is decoded, \\u included", () => {
    const result = detectAndUnescape(String.raw`"{\"s\":\"caf\u00e9 \/ \\t\"}"`);
    assert.equal(result.text, String.raw`{"s":"café / \t"}`);
  });

  test(`stops after ${MAX_LEVELS} levels`, () => {
    let text = '{"deep":true}';
    for (let i = 0; i < MAX_LEVELS + 2; i++) text = JSON.stringify(text);
    const result = detectAndUnescape(text);
    assert.equal(result, null, "still a quoted string after the limit, so nothing to show");

    let five = '{"deep":true}';
    for (let i = 0; i < MAX_LEVELS; i++) five = JSON.stringify(five);
    assert.deepEqual(detectAndUnescape(five), { text: '{"deep":true}', levels: MAX_LEVELS, mode: "quoted" });
  });

  test("the input string is not modified (Undo restores it exactly)", () => {
    const original = String.raw`  "{\"a\":1}"  `;
    const copy = `${original}`;
    detectAndUnescape(original);
    assert.equal(original, copy);
  });

  test("escaped fixtures unescape to valid JSON, except the deliberately broken one", () => {
    for (const [name, text] of fixtures("escaped")) {
      const result = detectAndUnescape(text);
      assert.ok(result, `${name} is detected`);
      if (name.startsWith("broken")) {
        assert.throws(() => parse(result.text));
      } else {
        assert.deepStrictEqual(toJS(parse(result.text).ast), JSON.parse(result.text), name);
      }
    }
  });
});
