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
import { format } from "../src/js/formatter.js";
import { inferSchema, DRAFTS } from "../src/js/schema/infer.js";
import { makeDeep, makeLargeText } from "./fixtures/generate.js";
import { bestTime, fixtures } from "./helpers.js";

/** The schema's text, as the Schema button writes it. */
const schemaText = (sample, options) => format(inferSchema(parse(sample).ast, options).schema);
/** The schema as a plain object (JSON.parse is fine in tests), without $schema. */
function schemaOf(sample, options) {
  const { $schema: _uri, ...rest } = JSON.parse(schemaText(sample, options));
  return rest;
}

/**
 * Does `value` validate against `schema`? Just the keywords inference
 * writes — type, properties, required, items — with JSON Schema's meaning:
 * "integer" is a number with no fractional part, and an integer is also a
 * "number".
 */
function validates(schema, value) {
  const kind = (v) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" ? "number" : typeof v);
  const types = schema.type === undefined ? null : [].concat(schema.type);
  if (types && !types.some((t) => t === kind(value) || (t === "integer" && Number.isInteger(value)))) return false;
  if (kind(value) === "object") {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) return false;
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key) && !validates(sub, value[key])) return false;
    }
  }
  if (kind(value) === "array" && schema.items) return value.every((v) => validates(schema.items, v));
  return true;
}

describe("inferring a schema", () => {
  test("an object: its properties, in order, all required", () => {
    assert.deepEqual(schemaOf('{"name": "Ada", "age": 36, "admin": true, "boss": null}'), {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "integer" },
        admin: { type: "boolean" },
        boss: { type: "null" },
      },
      required: ["name", "age", "admin", "boss"],
    });
  });

  test("array elements merge: a key in every element is required, the rest optional", () => {
    const s = schemaOf('[{"id": 1, "tag": "a"}, {"id": 2, "note": "x"}, {"id": 3, "tag": null}]');
    assert.deepEqual(s, {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          tag: { type: ["string", "null"] },
          note: { type: "string" },
        },
        required: ["id"],
      },
    });
  });

  test("mixed primitives at one position are a union", () => {
    assert.deepEqual(schemaOf('["a", null, true]').items, { type: ["string", "boolean", "null"] });
  });

  test("integer while every number is written as one; number once any is not", () => {
    assert.deepEqual(schemaOf("[1, 2, -3, 12345678901234567890]").items, { type: "integer" });
    assert.deepEqual(schemaOf("[1, 2.5]").items, { type: "number" });
    assert.deepEqual(schemaOf("[1, 1.0]").items, { type: "number" }, "1.0 is written as a float");
    assert.deepEqual(schemaOf("[1, 1e3]").items, { type: "number" });
    assert.deepEqual(schemaOf('[1, "x", 2.5]').items, { type: ["string", "number"] });
  });

  test("objects and other types at one position: one schema, keywords for each", () => {
    assert.deepEqual(schemaOf('[{"a": 1}, "x", null]').items, {
      type: ["object", "string", "null"],
      properties: { a: { type: "integer" } },
      required: ["a"],
    });
  });

  test("nested arrays, and arrays of arrays, merge all the way down", () => {
    assert.deepEqual(schemaOf('{"grid": [[1, 2], [3.5], []]}').properties.grid, {
      type: "array",
      items: { type: "array", items: { type: "number" } },
    });
  });

  test("empty containers say only their type", () => {
    assert.deepEqual(schemaOf('{"list": [], "map": {}}').properties, { list: { type: "array" }, map: { type: "object" } });
  });

  test("objects merge across arrays at the same position", () => {
    const s = schemaOf('{"a": [{"x": 1}], "b": 2, "c": [{"x": 2, "y": 3}]}');
    assert.deepEqual(s.properties.c.items.required, ["x", "y"]);
    assert.deepEqual(s.properties.a.items.required, ["x"]);
  });

  test("a duplicate key counts once towards required", () => {
    const s = schemaOf('[{"a": 1, "a": 2}, {"b": 1}]');
    assert.equal(s.items.required, undefined, "neither key is in both objects");
    assert.deepEqual(Object.keys(s.items.properties), ["a", "b"]);
  });

  test("property names keep the text they were written with", () => {
    const text = schemaText('{"caf\\u00e9": 1, "say \\"hi\\"": 2}');
    assert.match(text, /"caf\\u00e9": \{/);
    assert.match(text, /"say \\"hi\\"": \{/);
    assert.match(text, /"required": \[\n\s+"caf\\u00e9",\n\s+"say \\"hi\\""\n/);
  });

  test("required can be left out altogether", () => {
    const text = schemaText('[{"a": {"b": 1}}]', { required: false });
    assert.doesNotMatch(text, /required/);
  });

  test("$schema names the draft, at the root only", () => {
    assert.equal(JSON.parse(schemaText("{}")).$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(JSON.parse(schemaText("{}", { draft: "07" })).$schema, "http://json-schema.org/draft-07/schema#");
    assert.equal(schemaText('{"a": {"b": {}}}').match(/\$schema/g).length, 1);
    assert.deepEqual(Object.keys(DRAFTS), ["2020-12", "07"]);
  });

  test("a scalar document gets a scalar schema", () => {
    assert.deepEqual(schemaOf('"just text"'), { type: "string" });
  });
});

describe("the schema accepts the JSON it came from", () => {
  for (const [name, text] of fixtures("valid")) {
    test(`valid/${name}`, () => {
      for (const options of [{}, { required: false }, { draft: "07" }]) {
        const out = schemaText(text, options);
        assert.doesNotThrow(() => parse(out), "the schema is valid JSON to our own parser");
        assert.ok(validates(JSON.parse(out), JSON.parse(text)), `${name} validates against its schema`);
      }
    });
  }

  test("…and does not accept just anything", () => {
    const schema = JSON.parse(schemaText('[{"id": 1, "name": "a"}]'));
    assert.ok(!validates(schema, [{ id: 1 }]), "missing a required key");
    assert.ok(!validates(schema, [{ id: "1", name: "a" }]), "wrong type");
    assert.ok(!validates(schema, [{ id: 1.5, name: "a" }]), "not an integer");
  });
});

describe("large and deep documents", () => {
  test(`nesting ${MAX_DEPTH.toLocaleString()} deep: types only below the limit, and still parseable`, () => {
    const { schema, depthLimited } = inferSchema(parse(makeDeep(MAX_DEPTH)).ast);
    assert.equal(depthLimited, true);
    const out = format(schema, { indent: "" });
    assert.ok(parse(out).stats.depth <= MAX_DEPTH);
  });

  test("a 5 MB document's schema in well under a second", () => {
    const { ast } = parse(makeLargeText(5 * 1024 * 1024, 42));
    const ms = bestTime(() => format(inferSchema(ast).schema));
    assert.ok(ms < 300, `took ${ms.toFixed(0)} ms`);
    const s = JSON.parse(format(inferSchema(ast).schema));
    assert.ok(validates(s, JSON.parse(makeLargeText(5 * 1024 * 1024, 42))));
  });
});
