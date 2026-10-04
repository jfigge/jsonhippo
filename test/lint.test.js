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
import { parse } from "../src/js/parser/parser.js";
import { Linter, MAX_WARNINGS } from "../src/js/lint/linter.js";
import { RULES } from "../src/js/lint/rules.js";
import { makeLargeText } from "./fixtures/generate.js";
import { bestTime, fixtures, toJS } from "./helpers.js";

const lint = (text) => parse(text, { lint: new Linter() });
const codes = (text) => lint(text).warnings.map((w) => w.code);

describe("duplicate keys", () => {
  test("every repeat is flagged, each pointing back at the first", () => {
    const { warnings } = lint('{\n  "id": 1,\n  "id": 2,\n  "id": 3\n}');
    assert.deepEqual(
      warnings.map((w) => [w.code, w.line, w.column, w.path, w.first.line]),
      [
        ["DUPLICATE_KEY", 3, 3, "$.id", 2],
        ["DUPLICATE_KEY", 4, 3, "$.id", 2],
      ],
    );
    assert.match(warnings[0].message, /duplicate key "id" \(first defined at line 2, col 3\)/);
  });

  test("each object is its own scope, before and after a nested one", () => {
    assert.deepEqual(codes('{"a": {"a": 1, "b": 2}, "b": 3}'), []);
    const { warnings } = lint('{"a": {"a": 1}, "a": 2}');
    assert.deepEqual(
      warnings.map((w) => [w.path, w.column]),
      [["$.a", 17]],
    );
    assert.deepEqual(codes('[{"a": 1, "a": 2}, {"a": 3}]'), ["DUPLICATE_KEY"]);
  });

  test("keys are compared decoded: \"a\" and \"\\u0061\" are the same key", () => {
    assert.deepEqual(codes('{"a": 1, "\\u0061": 2}'), ["DUPLICATE_KEY"]);
  });
});

describe("empty keys", () => {
  test('a "" key is flagged where it is', () => {
    const { warnings } = lint('{\n  "": 1\n}');
    assert.deepEqual(
      warnings.map((w) => [w.code, w.line, w.column, w.offset, w.endOffset, w.path]),
      [["EMPTY_KEY", 2, 3, 4, 6, '$[""]']],
    );
  });

  test("two of them: both empty, and the second a duplicate (rules report in RULES order)", () => {
    assert.deepEqual(codes('{"": 1, "": 2}'), ["EMPTY_KEY", "DUPLICATE_KEY", "EMPTY_KEY"]);
  });

  test("a key of spaces is not empty", () => {
    assert.deepEqual(codes('{" ": 1}'), []);
  });
});

describe("number precision", () => {
  // [literal, what a 64-bit float makes of it — or null for no warning]
  const CASES = [
    ["0", null],
    ["-0", null],
    ["-0.0", null],
    ["0.1", null],
    ["1.50", null],
    ["1E+2", null],
    ["123456789012345.6", null],
    ["9007199254740991", null],
    ["-9007199254740991", null],
    ["1.7976931348623157e308", null],
    ["2.2250738585072014e-308", null],
    ["5e-324", null],
    ["0e-400", null],
    ["100000000000000000000.0", null], // written as a float, and exact: not an integer literal
    ["9007199254740992", "9007199254740992"], // exact itself, but beyond the safe range
    ["-9007199254740992", "-9007199254740992"],
    ["9007199254740993", "9007199254740992"],
    ["12345678901234567890", "12345678901234567000"],
    ["3.141592653589793238", "3.141592653589793"],
    ["9007199254740993.5", "9007199254740994"],
    ["0.10000000000000001", "0.1"], // 17 significant digits: printf("%.17g") writes these
    ["1e400", "Infinity"],
    ["-1e400", "-Infinity"],
    ["1e-400", "0"],
  ];
  for (const [raw, becomes] of CASES) {
    test(`${raw} → ${becomes ?? "no warning"}`, () => {
      const { warnings } = lint(`[${raw}]`);
      if (becomes === null) {
        assert.deepEqual(warnings, []);
      } else {
        assert.equal(warnings.length, 1);
        assert.equal(warnings[0].code, "NUMBER_PRECISION");
        assert.equal(warnings[0].becomes, becomes);
        assert.equal(warnings[0].path, "$[0]");
      }
    });
  }

  test("the messages say what happens", () => {
    const m = (raw) => lint(raw).warnings[0].message;
    assert.equal(m("12345678901234567890"), "12345678901234567890 is beyond the safe integer range (±2^53−1): as a 64-bit float it becomes 12345678901234567000");
    assert.equal(m("9007199254740992"), "9007199254740992 is beyond the safe integer range (±2^53−1): exact as a 64-bit float, but its neighbours are not");
    assert.equal(m("3.141592653589793238"), "3.141592653589793238 has more digits than a 64-bit float holds: it becomes 3.141592653589793");
    assert.equal(m("1e400"), "1e400 is too large for a 64-bit float: it becomes Infinity");
    assert.equal(m("1e-400"), "1e-400 is too small for a 64-bit float: it becomes 0");
  });

  test("a warning covers its number exactly", () => {
    const text = '{\n  "big": 12345678901234567890\n}';
    const [w] = lint(text).warnings;
    assert.deepEqual([w.line, w.column, w.path], [2, 10, "$.big"]);
    assert.equal(text.slice(w.offset, w.endOffset), "12345678901234567890");
  });

  test("a huge literal is clipped in the message", () => {
    const [w] = lint(`1${"0".repeat(500)}`).warnings;
    assert.ok(w.message.length < 160, w.message);
  });
});

describe("the linter", () => {
  test("warnings come in document order, whatever the rule", () => {
    const { warnings } = lint('{"x": 12345678901234567890, "": 1, "x": 2}');
    assert.deepEqual(
      warnings.map((w) => w.code),
      ["NUMBER_PRECISION", "EMPTY_KEY", "DUPLICATE_KEY"],
    );
  });

  test("each warning knows the key token or node it is about (the tree marks those rows)", () => {
    const { ast, warnings } = lint('{"a": 1, "a": 12345678901234567890}');
    assert.equal(warnings[0].target, ast.entries[1].keyToken);
    assert.equal(warnings[1].target, ast.entries[1].value);
  });

  test("a new check is one more rule: the parser does not change", () => {
    const opened = [];
    const longStrings = {
      code: "LONG_STRING",
      label: "Long string",
      create(report) {
        return {
          open: (node) => opened.push(node.kind),
          close: () => opened.pop(),
          value(node) {
            if (node.kind === "string" && node.value.length > 5) report(node, `string of ${node.value.length} characters`);
          },
        };
      },
    };
    const { warnings } = parse('{"a": ["short", "much longer"], "b": {}}', { lint: new Linter([...RULES, longStrings]) });
    assert.deepEqual(
      warnings.map((w) => [w.code, w.path, w.label]),
      [["LONG_STRING", "$.a[1]", "Long string"]],
    );
    assert.deepEqual(opened, [], "every open has its close, empty containers included");
  });

  test(`the list stops at ${MAX_WARNINGS}; the count does not`, () => {
    const members = Array.from({ length: 1500 }, (_, i) => `"k": ${i}`).join(", ");
    const r = lint(`{"k": -1, ${members}}`);
    assert.equal(r.warnings.length, MAX_WARNINGS);
    assert.equal(r.warningTotal, 1500);
  });

  test("invalid JSON is still an error, never a warning", () => {
    assert.throws(() => lint('{"a": 1, "a": 2,}'), { code: "TRAILING_COMMA" });
  });

  test("linting does not change the tree (every valid fixture)", () => {
    for (const [name, text] of fixtures("valid")) {
      assert.deepStrictEqual(toJS(lint(text).ast), JSON.parse(text), name);
    }
  });

  test("the fixtures that should warn, do", () => {
    const byName = new Map(fixtures("valid"));
    assert.deepEqual(codes(byName.get("duplicate-keys.json")), ["DUPLICATE_KEY"]);
    assert.deepEqual(
      lint(byName.get("numbers.json")).warnings.map((w) => w.becomes),
      ["12345678901234567000", "9007199254740992"],
    );
  });

  test("linting a 5 MB document adds little to the parse", () => {
    const text = makeLargeText(5 * 1024 * 1024, 42);
    const plain = bestTime(() => parse(text));
    const linted = bestTime(() => lint(text));
    assert.ok(linted < 600, `took ${linted.toFixed(0)} ms (plain parse ${plain.toFixed(0)} ms)`);
  });
});
