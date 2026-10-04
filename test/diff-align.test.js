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
import { diffJson } from "../src/js/diff/json-diff.js";
import { alignDocuments, PLACEHOLDER, SPACER } from "../src/js/diff/align.js";
import { PaneModel, offsetOfRow } from "../src/js/diff/pane-model.js";
import { DiffSession, layOut } from "../src/js/diff/session.js";

const pretty = (value) => layOut(JSON.stringify(value));
const lines = (text) => text.split("\n").length;

function align(left, right) {
  const L = pretty(left);
  const R = pretty(right);
  const d = diffJson(parse(L).ast, parse(R).ast);
  return { L, R, ...alignDocuments(d, parse(L).ast, parse(R).ast, lines(L), lines(R)) };
}

/** Two laid-out panes, as the Diff tab shows them. */
function panes(left, right) {
  const a = align(left, right);
  const lm = new PaneModel();
  const rm = new PaneModel();
  assert.ok(lm.layout(a.L, a.rows.map((r) => r[0]), a.classes.left));
  assert.ok(rm.layout(a.R, a.rows.map((r) => r[1]), a.classes.right));
  return { ...a, lm, rm };
}

/** Side-by-side picture: "line | line", with ░ for a placeholder and · for a spacer. */
function picture(lm, rm) {
  const cell = (m, t) => (m.fill === "placeholder" ? "░" : m.fill === "spacer" ? "·" : t.trim());
  const ll = lm.raw.split("\n");
  const rl = rm.raw.split("\n");
  return ll.map((t, i) => `${cell(lm.meta[i], t)} | ${cell(rm.meta[i], rl[i])}`);
}

describe("rows", () => {
  test("every line of each side appears exactly once, in order", () => {
    const { rows, L, R } = align(
      { name: "Sam", tags: ["a", "b"], items: [{ id: 1, v: 1 }, { id: 2 }], gone: { deep: [1, 2] } },
      { tags: ["b", "a", "c"], name: "Sam", items: [{ id: 2 }, { id: 1, v: 2 }], extra: true },
    );
    for (const [side, n] of [[0, lines(L)], [1, lines(R)]]) {
      const real = rows.map((r) => r[side]).filter((c) => c > 0);
      assert.deepEqual(real, Array.from({ length: n }, (_, i) => i + 1));
    }
  });

  test("identical documents: one row per line, nothing filled in", () => {
    const { rows } = align({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] });
    assert.ok(rows.every(([l, r]) => l > 0 && l === r));
  });
});

describe("placeholders", () => {
  test("extra key on the left → a placeholder on the right, on the same row", () => {
    const { lm, rm } = panes({ name: "Sam", age: 30, gender: "F" }, { name: "Sam", age: 30 });
    assert.deepEqual(picture(lm, rm), ['{ | {', '"name": "Sam", | "name": "Sam",', '"age": 30, | "age": 30', '"gender": "F" | ░', "} | }"]);
    const row = lm.raw.split("\n").findIndex((t) => t.includes("gender"));
    assert.equal(lm.meta[row].cls, "missing");
    assert.equal(rm.meta[row].fill, "placeholder");
  });

  test("a missing array element gets one placeholder row per line of it", () => {
    const { lm, rm } = panes([{ id: 1 }], [{ id: 1 }, { id: 2, x: true }]);
    const holes = lm.meta.filter((m) => m.fill === "placeholder").length;
    assert.equal(holes, 4); // {, "id": 2, "x": true, }
    assert.equal(rm.meta.filter((m) => m.cls === "added").length, 4);
  });

  test("the placeholder is not in the pane's text, nor in what a copy takes", () => {
    const { R, rm } = panes({ name: "Sam", age: 30, gender: "F" }, { name: "Sam", age: 30 });
    assert.equal(rm.logicalText(), R);
    assert.equal(rm.textBetween(0, rm.raw.length), R);
    assert.notEqual(rm.raw, R, "the textarea itself does hold the empty line");
  });

  test("typing into a placeholder makes it a real field — comma above, indent given — and the difference clears", () => {
    const { L, rm } = panes({ name: "Sam", age: 30, gender: "F" }, { name: "Sam", age: 30 });
    const row = rm.meta.findIndex((m) => m.fill === "placeholder");
    const at = offsetOfRow(rm.raw, row);

    // The browser inserts the first keystroke…
    const typed = `${rm.raw.slice(0, at)}"${rm.raw.slice(at)}`;
    const { promoted } = rm.edit(typed, at);
    assert.equal(promoted, row);
    // …and the pane finishes the promotion.
    const { raw, caret } = rm.promote(row, at + 1, "  ");
    assert.equal(raw.split("\n")[row], '  "');
    assert.equal(caret, offsetOfRow(raw, row) + 3);
    assert.match(raw.split("\n")[row - 1], /"age": 30,$/);

    // The user types the rest; after the pause the two sides compare equal.
    const finished = `${raw.slice(0, caret)}gender": "F"${raw.slice(caret)}`;
    rm.edit(finished, caret);
    const session = new DiffSession();
    const result = session.compare({ left: L, right: rm.logicalText() });
    assert.equal(result.state, "ok");
    assert.equal(result.result.equal, true);
  });

  test("a placeholder with members after it gets the comma after the new text", () => {
    const { lm } = panes({ age: 30 }, { name: "Sam", age: 30 });
    const row = lm.meta.findIndex((m) => m.fill === "placeholder");
    const at = offsetOfRow(lm.raw, row);
    lm.edit(`${lm.raw.slice(0, at)}"name": "Sam"${lm.raw.slice(at)}`, at);
    const { raw } = lm.promote(row, at + '"name": "Sam"'.length, "  ");
    assert.equal(raw.split("\n")[row], '  "name": "Sam",');
    assert.equal(parse(raw).ast.entries.length, 2);
  });

  test("pasting a whole member that already ends in a comma adds no second one", () => {
    const { lm } = panes({ age: 30 }, { name: "Sam", age: 30 });
    const row = lm.meta.findIndex((m) => m.fill === "placeholder");
    const at = offsetOfRow(lm.raw, row);
    const paste = '  "name": "Sam",';
    lm.edit(`${lm.raw.slice(0, at)}${paste}${lm.raw.slice(at)}`, at);
    const { raw } = lm.promote(row, at + paste.length, "  ");
    assert.equal(raw.split("\n")[row], paste);
  });
});

describe("following the user's edits", () => {
  test("lines added above shift the placeholders down with them", () => {
    const { rm } = panes({ a: 1, b: 2 }, { a: 1 });
    const before = rm.meta.findIndex((m) => m.fill);
    const at = offsetOfRow(rm.raw, 1);
    rm.edit(`${rm.raw.slice(0, at)}  "x": 0,\n${rm.raw.slice(at)}`, at);
    assert.equal(rm.meta.findIndex((m) => m.fill), before + 1);
  });

  test("Enter on a placeholder leaves it a placeholder; Backspace on it removes it", () => {
    const { rm } = panes({ a: 1, b: 2 }, { a: 1 });
    const row = rm.meta.findIndex((m) => m.fill);
    const at = offsetOfRow(rm.raw, row);
    rm.edit(`${rm.raw.slice(0, at)}\n${rm.raw.slice(at)}`, at);
    assert.equal(rm.meta[row].fill, "placeholder");
    assert.equal(rm.logicalText().split("\n").length, 4, "the new empty line is real");

    const { rm: again } = panes({ a: 1, b: 2 }, { a: 1 });
    const r2 = again.meta.findIndex((m) => m.fill);
    const at2 = offsetOfRow(again.raw, r2);
    again.edit(again.raw.slice(0, at2 - 1) + again.raw.slice(at2), at2);
    assert.ok(!again.meta.some((m) => m.fill));
    assert.equal(again.logicalText(), pretty({ a: 1 }));
  });

  test("a layout that would drop a line is refused", () => {
    const m = new PaneModel();
    assert.equal(m.layout("a\nb\nc", [1, PLACEHOLDER, 3]), false);
    assert.equal(m.raw, "a\nb\nc");
    assert.equal(m.layout("a\nb", [1, SPACER, 2]), true);
  });

  test("raw ↔ logical positions skip the filler rows", () => {
    const { rm, R } = panes({ a: 1, b: 2, c: 3 }, { a: 1, c: 3 });
    const cAt = R.indexOf('"c"');
    assert.equal(rm.raw.slice(rm.rawOffset(cAt), rm.rawOffset(cAt) + 3), '"c"');
    const row = rm.rowOfLine(3);
    assert.equal(rm.lineOfRow(row), 3);
    assert.equal(rm.lineOfRow(rm.meta.findIndex((m) => m.fill)), null);
  });
});
