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
import { parse, MAX_DEPTH } from "../src/js/parser/parser.js";
import { makeDeep, makeLargeText } from "./fixtures/generate.js";
import { bestTime, fixtures, toJS } from "./helpers.js";

describe("JSON.parse as the oracle", () => {
  for (const [name, text] of fixtures("valid")) {
    test(`valid/${name} matches JSON.parse`, () => {
      const { ast } = parse(text);
      assert.deepStrictEqual(toJS(ast), JSON.parse(text));
    });
  }

  test("a 5 MB generated document matches JSON.parse", () => {
    const text = makeLargeText(5 * 1024 * 1024, 42);
    assert.deepStrictEqual(toJS(parse(text).ast), JSON.parse(text));
  });
});

describe("AST", () => {
  test("node shapes and positions", () => {
    const { ast } = parse('{\n  "a": [1, "x", true, null]\n}');
    assert.equal(ast.kind, "object");
    assert.deepEqual(ast.start, { line: 1, column: 1, offset: 0 });
    assert.deepEqual(ast.end, { line: 3, column: 2, offset: 31 });

    const [entry] = ast.entries;
    assert.equal(entry.key, "a");
    assert.equal(entry.keyToken.raw, '"a"');
    assert.deepEqual([entry.keyToken.line, entry.keyToken.column], [2, 3]);

    const arr = entry.value;
    assert.equal(arr.kind, "array");
    assert.deepEqual(arr.start, { line: 2, column: 8, offset: 9 });
    assert.deepEqual(
      arr.items.map((n) => [n.kind, n.value, n.raw, n.start.column, n.end.column]),
      [
        ["number", "1", "1", 9, 10],
        ["string", "x", '"x"', 12, 15],
        ["boolean", true, "true", 17, 21],
        ["null", null, "null", 23, 27],
      ],
    );
  });

  test("numbers keep their raw text", () => {
    const { ast } = parse('{"n": 12345678901234567890, "f": 1.50, "e": 1E+2}');
    assert.deepEqual(ast.entries.map((e) => e.value.raw), ["12345678901234567890", "1.50", "1E+2"]);
  });

  test("keys keep source order, and duplicates are kept", () => {
    const { ast } = parse('{"z": 1, "a": 2, "z": 3}');
    assert.deepEqual(ast.entries.map((e) => [e.key, e.value.raw]), [["z", "1"], ["a", "2"], ["z", "3"]]);
  });

  test("top-level scalars are documents too", () => {
    assert.equal(parse('"s"').ast.value, "s");
    assert.equal(parse(" 42 ").ast.raw, "42");
    assert.equal(parse("null").ast.kind, "null");
  });
});

describe("warnings and stats", () => {
  test("duplicate keys are warnings, not errors", () => {
    const { warnings } = parse('{\n  "id": 1,\n  "x": {"id": 2},\n  "id": 3\n}');
    assert.equal(warnings.length, 1);
    const [w] = warnings;
    assert.equal(w.code, "DUPLICATE_KEY");
    assert.equal(w.key, "id");
    assert.deepEqual([w.line, w.column, w.path], [4, 3, "$.id"]);
    assert.deepEqual([w.first.line, w.first.column], [2, 3]);
    assert.match(w.message, /first defined at line 2, col 3/);
  });

  test("the same key in different objects is not a duplicate", () => {
    assert.equal(parse('[{"a":1},{"a":2}]').warnings.length, 0);
  });

  test("stats count nodes, keys and depth", () => {
    assert.deepEqual(parse('{"a": [1, {"b": null}], "c": "x"}').stats, { nodes: 6, keys: 3, depth: 3 });
    assert.deepEqual(parse("7").stats, { nodes: 1, keys: 0, depth: 0 });
  });
});

describe("depth", () => {
  test(`nesting exactly ${MAX_DEPTH.toLocaleString()} deep parses (no call-stack overflow)`, () => {
    const { stats } = parse(makeDeep(MAX_DEPTH));
    assert.equal(stats.depth, MAX_DEPTH);
  });

  test("one more is MAX_DEPTH", () => {
    assert.throws(() => parse(makeDeep(MAX_DEPTH + 1)), { code: "MAX_DEPTH", line: 1, column: MAX_DEPTH + 1 });
  });
});

describe("performance", () => {
  test("a 5 MB document parses in well under a second", () => {
    const text = makeLargeText(5 * 1024 * 1024, 42);
    const ms = bestTime(() => parse(text));
    assert.ok(ms < 500, `took ${ms.toFixed(0)} ms`);
  });
});
