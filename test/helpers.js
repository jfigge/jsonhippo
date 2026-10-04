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
