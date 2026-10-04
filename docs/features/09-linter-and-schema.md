# JsonHippo — Feature Request: Linter Warnings + Schema Extraction

Two independent features for JsonHippo. They can be built and shipped separately; this document specifies both.

---

## Feature A: Linter Warnings

### Summary

Add a layer of **warnings** for JSON that is *valid* but suspect. This is distinct from the existing parser's **error** reporting, which only fires on JSON that fails to parse. Linting runs on successfully-parsed JSON and surfaces things that are legal but almost always mistakes.

### Where it hooks in

The hand-written parser already walks the input character by character and tracks object/array nesting. Lint checks should piggyback on that existing traversal wherever possible (e.g. duplicate-key detection is essentially free while building each object), rather than doing a second independent pass.

### Checks (initial set)

- **Duplicate keys** — the same key appears more than once in a single object. Legal JSON, but the second value silently wins. Flag every duplicate occurrence.
- **Empty keys** — a key that is the empty string `""`.
- **Number precision loss** — an integer outside the safe integer range (beyond ±2^53−1) or a float that will not round-trip, since it will silently lose precision.
- **Leave room to add more checks later** — structure the linter as a list of independent checks over the parsed tree so new rules can be added without reworking the traversal.

### UI / behaviour

- **Toggleable behind a checkbox.** A "Lint" (or "Warnings") checkbox lets the user turn the whole linter on or off. When off, no warnings are computed or shown.
- Default state: TBD — decide whether linting is on or off by default (see open questions).
- Warnings are presented distinctly from parse errors — errors mean "this isn't JSON", warnings mean "this is JSON but look here". Different styling/colour, and warnings never block rendering.
- Each warning should point at its location (key path and/or line/position) the same way parse errors do, so the user can jump to it.

### Open questions

- Should the linter be on or off by default?
- Where do warnings render — inline in the tree/text view, a summary list, a count badge, or some combination?

---

## Feature B: Schema Extraction / Inference

### Summary

Given a sample JSON document, infer a **JSON Schema** that describes it. Lets the user paste a representative blob and get back a reusable spec they can validate against elsewhere.

### Behaviour

- Walk the parsed structure and emit a JSON Schema describing it:
  - Objects → `type: object` with a `properties` map and (by default) a `required` list of the keys present.
  - Arrays → `type: array` with an `items` schema inferred from the elements. If elements differ, merge them (see below).
  - Primitives → the appropriate `type` (`string`, `number`/`integer`, `boolean`, `null`).
- **Merging across array elements and samples:** when an array holds objects with differing shapes, union their properties. A key present in only some elements is optional (omit from `required`); a key present in all is required.
- **Mixed primitive types** for the same position → emit a union (e.g. `type: ["string", "null"]`).
- Distinguish `integer` from `number` where all observed values are whole, but degrade to `number` if any float appears.

### Output

- Produce standard JSON Schema (target a specific draft — see open questions).
- Output is itself JSON, so it should render straight into JsonHippo's existing viewer/tree.

### Open questions

- Which JSON Schema draft to target (e.g. draft 2020-12 vs draft-07)?
- Is every present key `required` by default, or should required-inference be more conservative? Consider a toggle.
- How to surface the result — a new tab, a toggle on the current view, or replace-into the editor?

---

## Out of scope (for these requests)

- Diff mode — already specified and delivered separately.
- Shareable-URL state — rejected; does not fit JsonHippo's static single-page model.
- YamlHippo — possible future project, not part of JsonHippo.
