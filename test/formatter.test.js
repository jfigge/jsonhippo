/*
 * Copyright 2026 Jason Figge
 *
 * This file is part of JsonHippo.
 *
 * JsonHippo is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * JsonHippo is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with JsonHippo. If not, see <https://www.gnu.org/licenses/>.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parse } from "../src/js/parser/parser.js";
import { format, minify, INDENTS } from "../src/js/formatter.js";
import { makeDeep, makeLargeText } from "./fixtures/generate.js";
import { fixtures, shape } from "./helpers.js";

describe("round trip", () => {
  for (const [name, text] of fixtures("valid")) {
    test(`valid/${name}: format and minify parse back to the same AST`, () => {
      const ast = parse(text).ast;
      for (const out of [format(ast), format(ast, { indent: "\t" }), minify(ast)]) {
        assert.deepStrictEqual(shape(parse(out).ast), shape(ast));
      }
    });
  }
});

describe("output", () => {
  test("matches JSON.stringify(…, null, 2) where the two can agree", () => {
    const text = makeLargeText(512 * 1024, 3);
    const canonical = JSON.stringify(JSON.parse(text.replaceAll("12345678901234567890", "1")), null, 2);
    assert.equal(format(parse(canonical).ast), canonical);
    assert.equal(minify(parse(canonical).ast), JSON.stringify(JSON.parse(canonical)));
  });

  test("{\"n\": 12345678901234567890} keeps every digit", () => {
    const { ast } = parse('{"n": 12345678901234567890}');
    assert.equal(format(ast), '{\n  "n": 12345678901234567890\n}');
    assert.equal(minify(ast), '{"n":12345678901234567890}');
  });

  test("key order and duplicate keys survive Format and Minify", () => {
    const { ast } = parse('{"z": 1, "a": 2, "z": 3}');
    assert.equal(minify(ast), '{"z":1,"a":2,"z":3}');
    assert.equal(format(ast), '{\n  "z": 1,\n  "a": 2,\n  "z": 3\n}');
  });

  test("strings keep their source escapes", () => {
    const { ast } = parse(String.raw`["café", "a\/b", "🦛"]`);
    assert.equal(minify(ast), String.raw`["café","a\/b","🦛"]`);
  });

  test("indent settings", () => {
    const { ast } = parse('{"a":[1,{}],"b":[]}');
    assert.equal(format(ast, { indent: INDENTS[2] }), '{\n  "a": [\n    1,\n    {}\n  ],\n  "b": []\n}');
    assert.equal(format(ast, { indent: INDENTS[4] }), '{\n    "a": [\n        1,\n        {}\n    ],\n    "b": []\n}');
    assert.equal(format(ast, { indent: INDENTS.tab }), '{\n\t"a": [\n\t\t1,\n\t\t{}\n\t],\n\t"b": []\n}');
  });

  test("a subtree formats on its own (Copy value in the tree)", () => {
    const { ast } = parse('{"a": {"b": [true, null]}}');
    assert.equal(format(ast.entries[0].value), '{\n  "b": [\n    true,\n    null\n  ]\n}');
    assert.equal(format(ast.entries[0].value.entries[0].value.items[0]), "true");
  });

  test("10,000 levels deep formats without overflowing the call stack", () => {
    const { ast } = parse(makeDeep(10000));
    assert.equal(minify(ast), makeDeep(10000));
    assert.equal(format(ast).split("\n").length, 10000 * 2 - 1);
  });
});
