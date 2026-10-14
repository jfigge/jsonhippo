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

/**
 * helpers.js — shared by the test files (not itself a test: `make test` runs
 * test/*.test.js only).
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonHippoError } from "../src/js/parser/errors.js";

export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/** [name, text] for every file in fixtures/<dir>. */
export function fixtures(dir) {
  return readdirSync(join(FIXTURES, dir))
    .sort()
    .map((name) => [name, readFileSync(join(FIXTURES, dir, name), "utf8")]);
}

/**
 * The plain JS value an AST stands for, built the way JSON.parse builds it —
 * numbers through Number(), later duplicate keys winning, and __proto__ as an
 * ordinary own property — so the two can be compared with deepStrictEqual.
 */
export function toJS(node) {
  switch (node.kind) {
    case "object": {
      const out = {};
      for (const { key, value } of node.entries) {
        Object.defineProperty(out, key, { value: toJS(value), enumerable: true, writable: true, configurable: true });
      }
      return out;
    }
    case "array":
      return node.items.map(toJS);
    case "number":
      return Number(node.raw);
    default:
      return node.value;
  }
}

/** The AST with positions stripped: what must survive a format round trip. */
export function shape(node) {
  switch (node.kind) {
    case "object":
      return { object: node.entries.map((e) => [e.key, shape(e.value)]) };
    case "array":
      return { array: node.items.map(shape) };
    default:
      return { [node.kind]: node.kind === "number" ? node.raw : node.value };
  }
}

/** Run fn, which must throw a JsonHippoError, and return the error. */
export function catchError(fn) {
  try {
    fn();
  } catch (err) {
    if (err instanceof JsonHippoError) return err;
    throw err;
  }
  throw new Error("expected a JsonHippoError, but nothing was thrown");
}

/** Best of `runs` timings, in ms — the least noisy figure for a budget check. */
export function bestTime(fn, runs = 3) {
  let best = Infinity;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}
