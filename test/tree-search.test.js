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
import { searchAst, SearchError, isPathQuery } from "../src/js/tree-search.js";
import { formatPath, parsePathQuery } from "../src/js/json-path.js";
import { makeLargeObject, makeLargeText } from "./fixtures/generate.js";
import { bestTime } from "./helpers.js";

const DOC = parse(`{
  "name": "Directory",
  "people": [
    {"name": "Ada", "zip": "10001", "tags": ["Math"]},
    {"name": "Zipporah", "zip": null, "address": {"zip": "94105"}}
  ],
  "zipCodes": 2,
  "first name": "x"
}`).ast;

const paths = (result) => result.matches.map((m) => formatPath(m.segments));

describe("text search", () => {
  test("both keys and values by default, case-insensitive", () => {
    assert.deepEqual(paths(searchAst(DOC, "zip")), [
      "$.people[0].zip",
      "$.people[1].name", // Zipporah
      "$.people[1].zip",
      "$.people[1].address.zip",
      "$.zipCodes",
    ]);
  });

  test("keys only", () => {
    assert.deepEqual(paths(searchAst(DOC, "zip", { scope: "keys" })), ["$.people[0].zip", "$.people[1].zip", "$.people[1].address.zip", "$.zipCodes"]);
  });

  test("values only — numbers, null and booleans match by their text", () => {
    assert.deepEqual(paths(searchAst(DOC, "zip", { scope: "values" })), ["$.people[1].name"]);
    assert.deepEqual(paths(searchAst(DOC, "null", { scope: "values" })), ["$.people[1].zip"]);
    assert.deepEqual(paths(searchAst(DOC, "1000", { scope: "values" })), ["$.people[0].zip"]);
  });

  test("case-sensitive", () => {
    assert.deepEqual(paths(searchAst(DOC, "Zip", { caseSensitive: true })), ["$.people[1].name"]);
    assert.deepEqual(paths(searchAst(DOC, "math", { caseSensitive: true })), []);
  });

  test("ranges for highlighting", () => {
    const [m] = searchAst(DOC, "PORA", { scope: "values" }).matches;
    assert.deepEqual([m.key, m.value], [null, [3, 7]]);
    const key = searchAst(DOC, "codes").matches[0];
    assert.deepEqual([key.key, key.value], [[3, 8], null]);
  });

  test("array items have no key to match", () => {
    assert.deepEqual(paths(searchAst(parse('["0", 0]').ast, "0", { scope: "keys" })), []);
  });
});

describe("regex", () => {
  test("matches with the regex, honouring case", () => {
    assert.deepEqual(paths(searchAst(DOC, "^\\d{5}$", { regex: true, scope: "values" })), ["$.people[0].zip", "$.people[1].address.zip"]);
    assert.deepEqual(paths(searchAst(DOC, "^ada$", { regex: true })), ["$.people[0].name"]);
    assert.deepEqual(paths(searchAst(DOC, "^ada$", { regex: true, caseSensitive: true })), []);
  });

  test("an invalid regex is a SearchError, never anything else", () => {
    assert.throws(() => searchAst(DOC, "(unclosed", { regex: true }), SearchError);
    assert.throws(() => searchAst(DOC, "[", { regex: true }), /Invalid regex/);
  });

  test("$ in regex mode is an anchor, not a path", () => {
    assert.equal(isPathQuery("$", { regex: true }), false);
    assert.deepEqual(paths(searchAst(DOC, "x$", { regex: true, scope: "values" })), ["$[\"first name\"]"]);
  });
});

describe("ancestors and parents", () => {
  test("every container above a match is an ancestor; nothing else is", () => {
    const result = searchAst(DOC, "94105");
    const people = DOC.entries[1].value;
    const zipporah = people.items[1];
    const address = zipporah.entries[2].value;
    assert.deepEqual(new Set(result.ancestors), new Set([DOC, people, zipporah, address]));
    const match = result.matches[0].node;
    assert.equal(result.parents.get(match), address);
    assert.equal(result.parents.get(address), zipporah);
    assert.equal(result.parents.get(people), DOC);
  });
});

describe("path queries", () => {
  test("isPathQuery", () => {
    assert.equal(isPathQuery("$"), true);
    assert.equal(isPathQuery("$.a"), true);
    assert.equal(isPathQuery("$[0]"), true);
    assert.equal(isPathQuery("$100"), false);
    assert.equal(isPathQuery("price"), false);
  });

  test("$.people[*].name", () => {
    assert.deepEqual(paths(searchAst(DOC, "$.people[*].name")), ["$.people[0].name", "$.people[1].name"]);
  });

  test("$..zip finds zips at any depth", () => {
    assert.deepEqual(paths(searchAst(DOC, "$..zip")), ["$.people[0].zip", "$.people[1].zip", "$.people[1].address.zip"]);
  });

  test('quoted keys, indices and .*', () => {
    assert.deepEqual(paths(searchAst(DOC, '$["first name"]')), ['$["first name"]']);
    assert.deepEqual(paths(searchAst(DOC, "$.people[1].address.*")), ["$.people[1].address.zip"]);
    assert.deepEqual(paths(searchAst(DOC, "$")), ["$"]);
  });

  test("a bad path is a SearchError with a position", () => {
    assert.throws(() => searchAst(DOC, "$.people[x]"), /Invalid path: .*at character 10/);
    assert.throws(() => searchAst(DOC, "$."), SearchError);
    assert.throws(() => parsePathQuery("$.."), /after '\.\.'/);
  });
});

describe("formatPath", () => {
  test("dots for identifiers, brackets for the rest", () => {
    assert.equal(formatPath([]), "$");
    assert.equal(formatPath(["items", 3, "name"]), "$.items[3].name");
    assert.equal(formatPath(["first name", "a.b", 'q"uote', "", "_ok$"]), '$["first name"]["a.b"]["q\\"uote"][""]._ok$');
  });

  test("a formatted path reads back as the same path query", () => {
    const segments = ["a b", 0, "c"];
    assert.deepEqual(parsePathQuery(formatPath(segments)), [
      { type: "key", key: "a b" },
      { type: "index", index: 0 },
      { type: "key", key: "c" },
    ]);
  });
});

describe("large document", () => {
  const text = makeLargeText(5 * 1024 * 1024, 42);
  const { ast } = parse(text);
  const people = makeLargeObject(5 * 1024 * 1024, 42).people.length;

  test("'zip' on a large address list finds every zip key, with its ancestors, in under ~500 ms", () => {
    let result;
    const ms = bestTime(() => (result = searchAst(ast, "zip", { scope: "keys" })));
    assert.equal(result.matches.length, people);
    assert.ok(result.matches.every((m) => m.segments.at(-1) === "zip"));
    // root, the people array, and each person and each address
    assert.equal(result.ancestors.size, 2 + people * 2);
    assert.ok(ms < 500, `took ${ms.toFixed(0)} ms`);
  });

  test("a value search over every node stays inside the budget", () => {
    const ms = bestTime(() => searchAst(ast, "lovelace"));
    assert.ok(ms < 500, `took ${ms.toFixed(0)} ms`);
  });
});
