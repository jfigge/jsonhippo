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
