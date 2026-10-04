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
import { walk } from "../src/js/tree-search.js";
import { reorderToFollow } from "../src/js/diff/reorder.js";
import { DiffSession, layOut } from "../src/js/diff/session.js";
import { format } from "../src/js/formatter.js";

const LEFT = `{
  "name": "Sam",
  "price": 1.50,
  "big": 12345678901234567890,
  "note": "caf\\u00e9 \\/ \\"quoted\\"",
  "tags": ["b", "a"],
  "items": [{"id": 1, "v": "x"}, {"id": 2, "v": "y"}]
}`;
// Same content, shuffled at every level, plus one key only here.
const RIGHT = `{
  "items": [{"v": "y", "id": 2}, {"v": "x", "id": 1}],
  "only_right": 1E+2,
  "tags": ["a", "b"],
  "note": "caf\\u00e9 \\/ \\"quoted\\"",
  "big": 12345678901234567890,
  "price": 1.50,
  "name": "Sam"
}`;

/** Every key and scalar's source text, sorted: what reordering must not change. */
function sourceTokens(text) {
  const out = [];
  walk(parse(text).ast, (node, key, _segments, frames) => {
    const parent = frames[frames.length - 1]?.node;
    if (parent?.kind === "object") out.push(`key ${parent.entries.find((e) => e.value === node).keyToken.raw}`);
    if (node.kind !== "object" && node.kind !== "array") out.push(`value ${node.raw}`);
  });
  return out.sort();
}

const keysOf = (text) => parse(text).ast.entries.map((e) => e.key);

describe("Reorder switch", () => {
  test("Left master: Right is rewritten in Left's order; content byte-for-byte the same", () => {
    const s = new DiffSession();
    s.setMode("left");
    const r = s.compare({ left: LEFT, right: RIGHT });
    assert.equal(r.texts.left, LEFT, "the master is untouched");
    assert.deepEqual(keysOf(r.texts.right), ["name", "price", "big", "note", "tags", "items", "only_right"]);
    assert.deepEqual(sourceTokens(r.texts.right), sourceTokens(RIGHT));
    // nested order follows too
    const items = parse(r.texts.right).ast.entries.find((e) => e.key === "items").value.items;
    assert.deepEqual(items.map((o) => o.entries.map((e) => e.key)), [["id", "v"], ["id", "v"]]);
    assert.deepEqual(items.map((o) => o.entries[0].value.raw), ["1", "2"]);
    assert.match(r.texts.right, /"price": 1\.50/);
    assert.match(r.texts.right, /"only_right": 1E\+2/);
    assert.match(r.texts.right, /"caf\\u00e9 \\\/ \\"quoted\\""/);
  });

  test("Right master: Left is rewritten in Right's order", () => {
    const s = new DiffSession();
    s.setMode("right");
    const r = s.compare({ left: LEFT, right: RIGHT });
    assert.equal(r.texts.right, RIGHT);
    assert.deepEqual(keysOf(r.texts.left), ["items", "tags", "note", "big", "price", "name"]);
    assert.deepEqual(sourceTokens(r.texts.left), sourceTokens(LEFT));
  });

  test("with the slave in the master's order, only real differences remain — row for row", () => {
    // The Diff tab lays both sides out one value per line; so does this test.
    const s = new DiffSession();
    s.setMode("left");
    const r = s.compare({ left: layOut(LEFT), right: layOut(RIGHT) });
    assert.deepEqual(r.result.counts, { added: 1, missing: 0, changed: 0, type: 0 });
    const spacers = r.result.rows.filter(([a, b]) => a === -1 || b === -1);
    assert.equal(spacers.length, 0);
  });

  test("back to Off: an untouched slave reverts to its own order", () => {
    const s = new DiffSession();
    s.setMode("left");
    const r1 = s.compare({ left: LEFT, right: RIGHT });
    s.setMode("off");
    const r2 = s.compare(r1.texts);
    assert.equal(r2.texts.right, RIGHT);
  });

  test("back to Off: an edited slave keeps its edits (and its new order)", () => {
    const s = new DiffSession();
    s.setMode("left");
    const r1 = s.compare({ left: LEFT, right: RIGHT });
    const edited = r1.texts.right.replace('"Sam"', '"Samuel"');
    s.setMode("off");
    const r2 = s.compare({ left: r1.texts.left, right: edited });
    assert.equal(r2.texts.right, edited);
  });

  test("Left master → Right master in one move: Right reverts, Left is reordered", () => {
    const s = new DiffSession();
    s.setMode("left");
    const r1 = s.compare({ left: LEFT, right: RIGHT });
    s.setMode("right");
    const r2 = s.compare(r1.texts);
    assert.equal(r2.texts.right, RIGHT);
    assert.deepEqual(keysOf(r2.texts.left), ["items", "tags", "note", "big", "price", "name"]);
  });

  test("the slave keeps following while the master is edited, until the slave is edited", () => {
    const s = new DiffSession();
    s.setMode("left");
    const r1 = s.compare({ left: LEFT, right: RIGHT });
    const master = r1.texts.left.replace('"name": "Sam",\n', "").replace("{\n", '{\n  "name": "Sam",\n');
    const r2 = s.compare({ left: master, right: r1.texts.right });
    assert.equal(keysOf(r2.texts.right)[0], "name");
  });

  test("reorderToFollow on its own: slave-only members go last, in their own order", () => {
    const slave = parse('{"z": 1, "b": 2, "y": 3, "a": 4}').ast;
    const master = parse('{"a": 0, "b": 0}').ast;
    assert.deepEqual(reorderToFollow(slave, master).entries.map((e) => e.key), ["a", "b", "z", "y"]);
    assert.equal(format(reorderToFollow(parse("[3, 1, 2]").ast, parse("[1, 2, 3]").ast), { indent: "" }), "[1,2,3]");
  });
});

describe("compare states", () => {
  test("Documents match: equal, with no differences", () => {
    const r = new DiffSession().compare({ left: '{"a": [1, 2]}', right: '{"a": [2, 1]}' });
    assert.equal(r.state, "ok");
    assert.equal(r.result.equal, true);
  });

  test("invalid JSON mid-edit: the error is reported and the last good diff is kept", () => {
    const s = new DiffSession();
    const good = s.compare({ left: '{"a": 1, "b": 2}', right: '{"a": 1}' });
    assert.equal(good.state, "ok");
    const bad = s.compare({ left: '{"a": 1, "b": 2}', right: '{"a": 1,' });
    assert.equal(bad.state, "error");
    assert.equal(bad.errors.left, null);
    assert.equal(bad.errors.right.code, "UNCLOSED_CONTAINER");
    assert.deepEqual([bad.errors.right.line, bad.errors.right.column], [1, 1]);
    assert.equal(bad.result, good.result, "the same last-good result, not a new one");
    assert.equal(bad.stale, true);
  });

  test("a blank side is not an error: nothing to compare yet", () => {
    const r = new DiffSession().compare({ left: '{"a": 1}', right: "   " });
    assert.equal(r.state, "empty");
    assert.deepEqual(r.errors, { left: null, right: null });
    assert.equal(r.result, null);
  });

  test("layOut pretty-prints valid JSON and leaves invalid text alone", () => {
    assert.equal(layOut('{"a":[1,2]}'), '{\n  "a": [\n    1,\n    2\n  ]\n}');
    assert.equal(layOut('{"a":'), '{"a":');
  });
});
