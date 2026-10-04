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
import { diffJson, pairItems, canonicalNumber, similarity, Hasher, totalDifferences } from "../src/js/diff/json-diff.js";
import { makeLargeObject, makeLargeText } from "./fixtures/generate.js";
import { bestTime } from "./helpers.js";

const ast = (value) => parse(typeof value === "string" ? value : JSON.stringify(value)).ast;
const diff = (a, b) => diffJson(ast(a), ast(b));

/** Every leaf difference as "status path" strings, for readable assertions. */
function leaves(result) {
  const out = [];
  const walk = (d, path) => {
    const key = d.leftEntry?.key ?? d.rightEntry?.key;
    const here = key === undefined ? path : `${path}.${key}`;
    if (d.status === "changed" && d.children) d.children.forEach((c) => walk(c, here));
    else if (d.status !== "equal") out.push(`${d.status} ${here}`);
  };
  walk(result.root, "$");
  return out.sort();
}

describe("order is never a difference", () => {
  test("same object, different key order → no differences", () => {
    const r = diff({ name: "A", age: 3 }, { age: 3, name: "A" });
    assert.equal(r.equal, true);
    assert.equal(totalDifferences(r.counts), 0);
  });

  test("same array of primitives, different order → no differences", () => {
    assert.equal(diff([1, "two", true, null, 3.5], [null, 3.5, true, 1, "two"]).equal, true);
  });

  test("same array of objects, different order → no differences", () => {
    const a = [{ id: 1, tags: ["x", "y"] }, { id: 2, tags: [] }, { id: 3, nested: { b: 1, a: 2 } }];
    const b = [{ nested: { a: 2, b: 1 }, id: 3 }, { tags: [], id: 2 }, { tags: ["y", "x"], id: 1 }];
    assert.equal(diff(a, b).equal, true);
  });

  test("duplicates still count: [1, 1, 2] is not [1, 2, 2]", () => {
    assert.deepEqual(leaves(diff([1, 1, 2], [1, 2, 2])), ["added $", "missing $"]);
  });
});

describe("difference types", () => {
  test("extra key on one side → added; on the other → missing", () => {
    const r = diff({ name: "Sam", age: 30, gender: "F" }, { name: "Sam", age: 30, email: "s@x" });
    assert.deepEqual(leaves(r), ["added $.email", "missing $.gender"]);
    assert.deepEqual(r.counts, { added: 1, missing: 1, changed: 0, type: 0 });
  });

  test("changed value under the same key", () => {
    assert.deepEqual(leaves(diff({ a: 1, b: "x" }, { b: "y", a: 1 })), ["changed $.b"]);
  });

  test('"3" vs 3 → type change, never loose equality', () => {
    const r = diff({ n: "3" }, { n: 3 });
    assert.deepEqual(leaves(r), ["type $.n"]);
    assert.equal(r.counts.type, 1);
  });

  test("object vs array, null vs 0, true vs \"true\" → type changes", () => {
    assert.deepEqual(leaves(diff({ a: {}, b: null, c: true }, { a: [], b: 0, c: "true" })), ["type $.a", "type $.b", "type $.c"]);
  });

  test("numbers compare as values: 1.0, 1 and 1e0 are equal; big integers keep every digit", () => {
    assert.equal(diffJson(ast("[1.0, -0, 2.50e1]"), ast("[1, 0, 25]")).equal, true);
    assert.equal(diffJson(ast("[12345678901234567890]"), ast("[12345678901234567891]")).equal, false);
  });

  test("strings compare as values: escapes do not matter", () => {
    assert.equal(diffJson(ast('{"s": "caf\\u00e9"}'), ast('{"s": "café"}')).equal, true);
  });

  test("a whole subtree on one side counts once", () => {
    assert.deepEqual(diff({ a: 1 }, { a: 1, b: { c: [1, 2, 3], d: {} } }).counts, { added: 1, missing: 0, changed: 0, type: 0 });
  });
});

describe("array pairing", () => {
  test("array of objects, one value changed → paired, one 'changed'", () => {
    const left = [{ id: 1, name: "Ada" }, { id: 2, name: "Grace" }, { id: 3, name: "Alan" }];
    const right = [{ id: 3, name: "Alan" }, { id: 2, name: "Grace H." }, { id: 1, name: "Ada" }];
    const r = diff(left, right);
    assert.deepEqual(leaves(r), ["changed $.name"]);
    assert.deepEqual(r.counts, { added: 0, missing: 0, changed: 1, type: 0 });
  });

  test("pairing is one-to-one: an element is never matched twice", () => {
    const { pairs, leftOnly, rightOnly } = pairItems(ast([{ a: 1, b: 2 }]).items, ast([{ a: 1, b: 3 }, { a: 1, b: 4 }]).items);
    assert.equal(pairs.length, 1);
    assert.deepEqual([leftOnly, rightOnly.length], [[], 1]);
  });

  test("unequal primitives never pair: [1, 2, 3] vs [1, 2, 4] → missing 3, added 4", () => {
    assert.deepEqual(diff([1, 2, 3], [1, 2, 4]).counts, { added: 1, missing: 1, changed: 0, type: 0 });
  });

  test("objects with nothing in common are added/removed, not changed", () => {
    const r = diff([{ x: 1, y: 2 }], [{ x: 9, y: 8 }]);
    assert.deepEqual(r.counts, { added: 1, missing: 1, changed: 0, type: 0 });
  });

  test("an equal id pairs two records even when most fields changed", () => {
    const r = diff([{ id: 7, a: 1, b: 2, c: 3 }], [{ id: 7, a: 9, b: 8, c: 7 }]);
    assert.deepEqual(r.counts, { added: 0, missing: 0, changed: 3, type: 0 });
  });

  test("similarity: shared keys earn half credit, equal values the rest", () => {
    const h = new Hasher();
    assert.equal(similarity(ast({ a: 1, b: 2 }), ast({ a: 1, b: 3 }), h), 0.75);
    assert.equal(similarity(ast({ a: 1 }), ast({ a: 2 }), h), 0.5);
    assert.equal(similarity(ast({ a: 1 }), ast({ b: 1 }), h), 0);
    assert.equal(similarity(ast([1, 2, 3, 4]), ast([4, 3, 9, 9]), h), 0.5);
    assert.equal(similarity(ast({ a: 1 }), ast([1]), h), 0);
  });
});

describe("canonicalNumber", () => {
  test("one spelling per value", () => {
    for (const [a, b] of [["1", "1.0"], ["1", "1e0"], ["100", "1e2"], ["0.5", "5e-1"], ["-0", "0"], ["0.000", "0"], ["12.340", "1234E-2"]]) {
      assert.equal(canonicalNumber(a), canonicalNumber(b), `${a} vs ${b}`);
    }
    assert.notEqual(canonicalNumber("1"), canonicalNumber("-1"));
    assert.notEqual(canonicalNumber("12345678901234567890"), canonicalNumber("12345678901234567891"));
  });
});

describe("large documents", () => {
  test("two 5 MB documents, shuffled, one field changed: exactly one difference", () => {
    const left = makeLargeObject(5 * 1024 * 1024, 42);
    const right = structuredClone(left);
    right.people.reverse();
    right.people[100].address.city = "Atlantis";
    const a = ast(JSON.stringify(left, null, 2));
    const b = ast(JSON.stringify(right, null, 2));
    let result;
    const ms = bestTime(() => (result = diffJson(a, b)), 2);
    assert.deepEqual(result.counts, { added: 0, missing: 0, changed: 1, type: 0 });
    assert.ok(ms < 2000, `took ${ms.toFixed(0)} ms`);
  });

  test("identical 5 MB documents compare equal fast", () => {
    const text = makeLargeText(5 * 1024 * 1024, 42);
    const a = ast(text);
    const b = ast(text);
    let result;
    const ms = bestTime(() => (result = diffJson(a, b)), 2);
    assert.equal(result.equal, true);
    assert.ok(ms < 1500, `took ${ms.toFixed(0)} ms`);
  });
});
