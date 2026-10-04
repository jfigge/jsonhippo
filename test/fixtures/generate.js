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
 * generate.js — the large fixtures, generated rather than committed.
 *
 * A seeded PRNG makes every run byte-for-byte identical, so tests can assert
 * exact lines and columns in a 5 MB document without 5 MB living in git.
 *
 *   node test/fixtures/generate.js test/fixtures/large     (make fixtures)
 *
 * writes the documents below for trying in the app by hand. Tests import the
 * functions and build the same documents in memory.
 *
 * Test-only code, so JSON.stringify is fair game here.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** mulberry32 — tiny, fast, good enough for test data. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Ada", "Grace", "Alan", "Edsger", "Barbara", "Donald", "Margaret", "Ken", "Dennis", "Frances", "Linus", "Radia", "Niklaus", "Anita", "Tim", "Hedy"];
const LAST = ["Lovelace", "Hopper", "Turing", "Dijkstra", "Liskov", "Knuth", "Hamilton", "Thompson", "Ritchie", "Allen", "Torvalds", "Perlman", "Wirth", "Borg", "Berners-Lee", "Lamarr"];
const STREETS = ["Oak", "Maple", "Cedar", "Pine", "Elm", "Birch", "Willow", "Aspen"];
const CITIES = ["Springfield", "Riverton", "Fairview", "Kingsport", "Lakeside", "Georgetown", "Ashland", "Clinton"];
const TAGS = ["admin", "beta", "staff", "vip", "trial", "legacy", "émigré", "日本", "ops", "qa"];

/**
 * A people directory of roughly `targetBytes` (pretty-printed, 2-space
 * indent). Every person has an address with a zip — the filter's test case.
 */
export function makeLargeObject(targetBytes = 5 * 1024 * 1024, seed = 42) {
  const r = rng(seed);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const people = [];
  const doc = { meta: { generator: "jsonhippo test fixtures", seed, version: 1 }, people };
  // A person pretty-prints to ~620 bytes on average (measured at seed 42).
  const count = Math.ceil(targetBytes / 620);
  for (let i = 0; i < count; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    people.push({
      id: i,
      guid: `${Math.floor(r() * 1e12).toString(16)}-${i.toString(16).padStart(6, "0")}`,
      name: `${first} ${last}`,
      email: `${first}.${last}${i}@example.com`.toLowerCase(),
      active: r() < 0.7,
      score: Math.round(r() * 100000) / 100,
      balance: i % 97 === 0 ? "BIG" : Math.round(r() * 1e6) / 100,
      tags: Array.from({ length: 1 + Math.floor(r() * 3) }, () => pick(TAGS)),
      address: {
        street: `${1 + Math.floor(r() * 9999)} ${pick(STREETS)} St`,
        city: pick(CITIES),
        zip: String(10000 + Math.floor(r() * 89999)),
        geo: { lat: Math.round((r() * 180 - 90) * 1e6) / 1e6, lng: Math.round((r() * 360 - 180) * 1e6) / 1e6 },
      },
      friends: Array.from({ length: Math.floor(r() * 3) }, (_, k) => ({ id: (i * 7 + k * 13) % count, name: `${pick(FIRST)} ${pick(LAST)}` })),
      notes: r() < 0.5 ? null : `Joined in ${2000 + Math.floor(r() * 26)}. Says "hi" \\ waves.\nLikes tabs\tand newlines.`,
    });
  }
  return doc;
}

/**
 * Pretty-printed text of makeLargeObject. Every 97th balance becomes the bare
 * number 12345678901234567890, which JSON.stringify cannot write and a double
 * cannot hold — so the formatter's keep-the-digits promise is exercised.
 */
export function makeLargeText(targetBytes, seed) {
  return JSON.stringify(makeLargeObject(targetBytes, seed), null, 2).replaceAll('"balance": "BIG"', '"balance": 12345678901234567890');
}

/** 1-based line and column of `offset` in `text`. */
export function lineColumnOf(text, offset) {
  let line = 1;
  let lineStart = 0;
  for (let i = text.indexOf("\n"); i !== -1 && i < offset; i = text.indexOf("\n", i + 1)) {
    line++;
    lineStart = i + 1;
  }
  return { line, column: offset - lineStart + 1 };
}

/**
 * The large document with ONE comma removed, deep inside: the one after the
 * city of the person at `index`. Returns the text and where the parser must
 * report the gap: at the token after it ("zip"), with that person's address
 * as the path.
 */
export function makeMissingComma(targetBytes, seed, index) {
  const text = makeLargeText(targetBytes, seed);
  const person = text.indexOf(`"id": ${index},`);
  const city = text.indexOf('"city": ', person);
  const comma = text.indexOf(",", city);
  const broken = text.slice(0, comma) + text.slice(comma + 1);
  const zip = broken.indexOf('"zip"', comma);
  return { text: broken, offset: zip, ...lineColumnOf(broken, zip), path: `$.people[${index}].address` };
}

/** The large document missing its final '}'. */
export function makeMissingFinalBrace(targetBytes, seed) {
  const text = makeLargeText(targetBytes, seed);
  return { text: text.slice(0, text.lastIndexOf("}")), line: 1, column: 1, path: "$" };
}

/** `depth` nested arrays: [[[…]]] */
export function makeDeep(depth) {
  return "[".repeat(depth) + "]".repeat(depth);
}

// ── CLI: write the documents for manual testing ─────────────────────────────

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ?? "test/fixtures/large";
  mkdirSync(dir, { recursive: true });
  const size = 5 * 1024 * 1024;
  const files = {
    "large.json": makeLargeText(size, 42),
    "large-minified.json": JSON.stringify(makeLargeObject(size, 42)),
    "large-missing-comma.json": makeMissingComma(size, 42, 4321).text,
    "large-missing-final-brace.json": makeMissingFinalBrace(size, 42).text,
    "large-escaped.txt": JSON.stringify(JSON.stringify(makeLargeObject(256 * 1024, 7))),
    "deep-5000.json": makeDeep(5000),
  };
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(dir, name), text);
    console.log(`  ${join(dir, name)}  ${(text.length / 1024 / 1024).toFixed(2)} MB`);
  }
}
