# JsonHippo — Feature Request: Diff Mode

## Summary

Add a **Diff** view to JsonHippo that compares two JSON documents side by side. The comparison is *semantic*, not textual: key order and array order never count as differences, because order is not meaningful in JSON. Both panes are fully editable, and the diff re-runs automatically when the user pauses typing.

The goal is to fix the two biggest annoyances with existing text-compare tools:

1. They report false differences when fields or array elements are in a different order ("name doesn't match age, age doesn't match name").
2. The panes you look at are read-only, with the editable source buried below the fold.

---

## 1. Entry point

- Add a third tab, **Diff**, alongside the existing **Tree** and **Text** tabs.
- Tabs are *views* of the data; the toolbar is *actions*. Diff is a view, so it lives in the tab row.
- Switching to Diff splits the editor into two panes: **Left** and **Right**.
- Whatever is currently in the single editor is carried over into the **Left** pane, so the user has a head start. The Right pane starts empty.
- Switching back to Text/Tree uses the Left pane's content.

---

## 2. Matching rules (always on)

Matching is always active, regardless of the Reorder slider. The diff must always be correct; the slider only affects layout.

### Objects
- Match properties **by key name**, never by position.
- `{"name": "A", "age": 3}` and `{"age": 3, "name": "A"}` are **identical** — no differences reported.

### Arrays
- Array order is **irrelevant**. Elements are paired by **best similarity**, not position.
- Primitives (string, number, boolean, null) pair by equality.
- Objects/arrays pair with the most similar element on the other side (e.g. a score based on shared keys and matching values, recursively).
- Pairing should be one-to-one; an element can't be matched twice.
- Elements with no acceptable match are reported as **added** (only on one side) or **removed**.
- Paired elements that are similar but not equal are reported as **changed**, with the inner differences highlighted.

### Difference types to highlight
- **Added / missing** — key or element exists on one side only.
- **Changed value** — same key (or paired element), different value.
- **Type change** — e.g. `"3"` vs `3`, object vs array.

Values must be compared exactly as JSON values (no loose equality between string and number).

---

## 3. Reorder slider

A three-position slider in the Diff view's control area.

```
            Left master     Off     Right master
Reorder   [ ●───────────────○───────────────○ ]
```

- A **"Reorder"** label sits to the **left** of the slider.
- The current state label sits **above** the slider positions: **Left master**, **Off**, **Right master**.
- **Off (centre, default)**: no reordering. Each pane shows its own original order. Matching still runs, so reordered-but-equal fields are **not** flagged.
- **Left master (slider left)**: the Left pane is the reference; the **Right pane is rearranged** so its keys and array elements follow the Left pane's order.
- **Right master (slider right)**: the opposite — the **Left pane is rearranged** to follow the Right.

Rules for rearranging:
- Reordering applies recursively (nested objects and arrays).
- Keys/elements that exist only on the slave side go **after** the matched ones, keeping their relative original order.
- Reordering **never changes content**: values, string escapes, and number formatting are preserved exactly. Only order changes.
- Purpose: produce a clean line-by-line visual read so only genuine differences stand out.

---

## 4. Placeholder rows for missing fields

When a key or array element exists on one side but not the other, render a **blank placeholder row** on the missing side, aligned with the row on the other side.

Example — Left has `name`, `age`, `gender`; Right has `name`, `age`:

```
Left                         Right
{                            {
  "name": "Sam",               "name": "Sam",
  "age": 30,                   "age": 30,
  "gender": "F"                ░░░░░░░░░░░░░░   ← placeholder
}                            }
```

- Placeholders are **render-only**. They are *not* part of the pane's JSON text and must never be written into the data, copied, or exported.
- Purpose: keep both panes aligned line-for-line, and give the user an obvious target to paste the missing field into.
- **Typing into a placeholder promotes it to a real field.** On the first keystroke, the placeholder becomes actual text in that pane's JSON (including any needed comma handling so the document stays valid once the user finishes).
- Applies in all slider positions, including Off.

---

## 5. Both panes are editable

- The two diff panes **are** the editors. There is no separate read-only render with source boxes below it (the main shortcoming of the usual online text-compare tools).
- Users can type, paste, and delete directly in either pane, including into placeholder rows.
- The existing smart paste behaviour (auto-unescape of escaped JSON) should work in each pane.
- Each pane should support the existing Format / Minify / Copy / Clear / Load from file actions where sensible (per pane, or with a Left/Right target).

---

## 6. Re-compare on pause (debounced)

- Do **not** re-run the diff on every keystroke.
- Re-parse and re-diff after the user **stops typing for a short idle period** (default ~1.5 seconds; make it a single constant that's easy to tune).
- When a difference is fixed, its highlight disappears on the next compare. When the two documents are semantically equal, show a clear **"Documents match"** status.

### Invalid JSON while editing
- Use the existing hand-written parser for both panes.
- If a pane is invalid after the pause, show the parser's precise error (line/column) for that pane, and **keep the last valid diff displayed** rather than clearing or flickering.

---

## 7. Status / summary

- Status bar shows a count summary, e.g. `3 differences: 1 added, 1 missing, 1 changed` or `Documents match`.
- Nice to have: next/previous difference navigation.

---

## 8. Non-functional

- Stays within the single-page JsonHippo site on hippoherd.com; no new framework.
- Match the existing JsonHippo look and feel (dark theme, toolbar style, tab underline).
- Should cope with large documents without locking the UI noticeably; array similarity matching is the expensive part, so keep it reasonable for big arrays (e.g. exact-match pass first, then similarity matching only on the leftovers).
- Usual light level of makefile targets and validation.
- Light documentation: update the README / help text to describe the Diff tab, the Reorder slider, and placeholder behaviour.

---

## 9. Tests to include

- Same object, different key order → no differences.
- Same array, different element order (primitives and objects) → no differences.
- Extra key on one side → added/missing + placeholder on the other side.
- Array of objects where one object has a changed value → paired correctly, single "changed" reported.
- `"3"` vs `3` → type change.
- Slider Left master / Right master → slave pane reordered, content byte-for-byte preserved apart from order.
- Placeholder is absent from Copy output and from the pane's underlying text.
- Typing into a placeholder creates a real field; after the pause, the difference clears.
- Invalid JSON mid-edit → error shown, last good diff retained.

---

## Open questions for implementation

- When the slider returns to **Off**, should the rearranged pane revert to its original order, or keep the new order? (Suggest: revert if the user hasn't edited since reordering.)
- Exact similarity threshold below which two array elements are treated as added/removed rather than changed.

---

## Out of scope (future)

- Schema extraction / inference from a sample — planned as the next JsonHippo feature, separate request.
