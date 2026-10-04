# Using JsonHippo

JsonHippo is one page with four tabs. **Text** is where JSON goes in and where
errors are shown; **Tree** is where you explore it; **Schema** shows a
**JSON Schema** that describes it; **Diff** compares two documents side by
side. Valid JSON is also checked for likely mistakes (**warnings**). Everything happens in your browser: nothing you paste or load is
uploaded anywhere.

## Getting JSON in

- **Paste** into the Text tab, or type.
- **Load from file** reads a file from your computer (a leading byte order
  mark is dropped).
- The text area always accepts what you give it, valid or not. You have to
  see broken JSON to fix it.

JsonHippo checks the text when you paste, when you press Format or Minify, and
400 ms after you stop typing. Above 5 MB it stops checking while you type,
because the text area itself slows down at that size; the status bar offers
**Validate now** instead.

## Smart paste: escaped JSON

APIs and logs often return JSON as a *string*, with every quote escaped:

```
"{\"id\":7,\"tags\":[\"a\",\"b\"]}"
```

Paste that and JsonHippo unescapes it and shows the JSON inside. It handles:

- **quoted** strings like the one above;
- **bare** escaped JSON with no outer quotes, as copied out of the middle of a
  log line: `{\"id\":7}`;
- JSON that was **escaped more than once** (up to 5 levels);
- escaped JSON that was **pretty-printed before it was quoted**, so its line
  breaks were never escaped — they are kept as line breaks.

Only the escapes have to be right (`\"`, `\\`, `\n`, `é` and the rest).
Anything else odd in the pasted text, such as a stray unescaped `"`, is passed
through as it is, and the parser then reports it at its exact position, with
a hint that names a stray quote as one.

A notice says what happened ("Unescaped 2 levels of escaped JSON") with an
**Undo** that puts back exactly what you pasted. Undo stays available through
Format and Minify; typing in the text drops it, since restoring the original
would throw your edits away.

Smart paste only acts when the paste replaces all of the text (an empty box,
or everything selected). It never touches ordinary JSON, even JSON with `\"`
inside its strings, and it leaves a plain string such as `"hello"` alone — that
is valid JSON already.

- **Unescape** on the toolbar does the same thing on demand.
- **Auto-unescape** (the checkbox on the toolbar) turns the automatic
  behaviour off.

If the unescaped text is itself broken, the error is reported against the
unescaped text, and Undo is still there.

## Reading an error

When the JSON is invalid the status bar says exactly where and why:

```
Line 42, col 8: expected ',' or '}' but found string "name" (in $.items[3])
Missing comma after the previous value?
```

- **Line, col** — where the problem is. Columns count characters (an emoji
  counts as two, as it does everywhere in JavaScript).
- **expected … but found …** — what the parser needed at that point, and what
  was actually there.
- **(in $.items[3])** — the JSON path of the place it happened.
- The second line is a **hint**: a plain-English guess at the cause.

In the text, the line is marked in the gutter and highlighted, and the bad
token is underlined. **Click the error** to put the caret on the exact
character with the bad token selected — this works the same in a file of
several megabytes. For a bracket that does not match, or one that is never
closed, a second link, **Go to the opener**, jumps to the `{` or `[` involved.

Only the first error is reported. Fix it and the next one, if any, appears.

Valid JSON gets a summary instead — "Valid JSON — 1,284 keys, depth 7,
2.1 MB" — and the count of any warnings.

## Warnings

An **error** means "this is not JSON". A **warning** means "this is JSON, but
look here": something the grammar allows that is almost always a mistake.
With **Warnings** ticked in the Text toolbar — it is, until you untick it —
JsonHippo looks for:

| Warning | Example | Why it matters |
|---|---|---|
| **Duplicate key** | `{"id": 1, "id": 2}` | Only one of the values survives a parse — the last, in most parsers — and the other is lost without a word. Every repeat is flagged, with where the key was first defined. |
| **Empty key** | `{"": 1}` | Legal, but usually a field name that went missing. |
| **Precision loss** | `12345678901234567890`, `3.141592653589793238`, `1e400` | The number changes when it is read the way JavaScript — and most JSON libraries, by default — read every number: as a 64-bit float. The warning says what it becomes. |

Precision loss in detail:

- An **integer** (written without a fraction or an exponent) beyond
  ±9,007,199,254,740,991 (2^53 − 1): `12345678901234567890` becomes
  `12345678901234567000`. Even one that happens to be exact, such as
  `9007199254740992`, is flagged: past that point not every integer is.
- **Any other number** that does not survive the round trip — read as a
  64-bit float, then written back the shortest way that reads the same:
  too many digits (`3.141592653589793238` → `3.141592653589793`), too large
  (`1e400` → `Infinity`), too small (`1e-400` → `0`). `1.50` and `1E+2` are
  fine: written back they are `1.5` and `100`, the same numbers.
- Seventeen-digit numbers such as `0.10000000000000001`, the way C's `%.17g`
  writes them, are flagged too: they read back as `0.1`.

JsonHippo itself never rounds anything — Format and Minify keep every digit as
written. The warning is about what happens to the number elsewhere.

Warnings never get in the way: the tree, Format and everything else work as
usual. They show up:

- **In the status bar**: "⚠ 3 warnings", and the first one, which you can
  click to jump to it.
- **In a list**: click the count to see every warning — where it is, what
  kind, what it says, and its JSON path. Click one to put the caret on it.
  <kbd>Esc</kbd> or × closes the list. It shows the first 1,000; the count
  includes them all.
- **In the Text gutter**: the line number turns amber, with a ▲. Hover over
  it for what the warnings on that line are.
- **In the tree**: a ⚠ after the row. Select the row and the detail bar says
  what it is.

Untick **Warnings** to turn the checks off altogether: nothing is checked and
nothing is shown. The setting is remembered.

## Format, minify, copy

- **Format** pretty-prints with the indent chosen in the **Indent** menu
  (2 spaces, 4 spaces or a tab). Shortcut: <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd>.
- **Minify** removes all whitespace outside strings.
- Both are written from the parsed document, so numbers keep every digit
  (`12345678901234567890` stays as it is), strings keep their escapes, and keys
  stay in their original order, duplicates included.
- Neither changes invalid text; they show the error instead.
- **Copy** copies the text; **Clear** empties it.

## Inferring a JSON Schema

The **Schema** tab shows a [JSON Schema](https://json-schema.org/) inferred
from the JSON in the Text tab: paste a representative document, and take away
a spec to validate against elsewhere. It is worked out afresh each time you
open the tab, and your JSON is never changed. The schema is read-only;
**Copy** takes it. If the JSON is invalid, the tab shows the error instead,
with **Go to error**.

What the schema says, place by place:

- **Objects**: `"type": "object"`, their `"properties"` in the order the keys
  first appear, and `"required"`: the keys present in **every** object at
  that place.
- **Arrays**: `"type": "array"` and one `"items"` schema for all their
  elements. Elements that differ are merged: a key in only some of the
  objects is optional; a key in all of them is required.
- **Values**: `"string"`, `"boolean"`, `"null"`, and `"integer"` while every
  number at that place is written as an integer — `"number"` as soon as one is
  written with a fraction or an exponent (`1.0` included: written that way,
  it says the field is not an integer).
- **Several types** at one place make a list: `"type": ["string", "null"]`.

```json
[{"id": 1, "tag": "a"}, {"id": 2, "tag": null, "score": 9.5}]
```

becomes

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": { "type": "integer" },
      "tag": { "type": ["string", "null"] },
      "score": { "type": "number" }
    },
    "required": ["id", "tag"]
  }
}
```

(laid out more compactly here than Format writes it).

Two options sit in the Schema toolbar, and changing either infers the schema
again:

- **Draft**: 2020-12 (the default) or draft-07. Only the `$schema` line
  differs; everything else is written the same way in both.
- **Required keys**: untick it to leave out every `"required"` list, making
  every property optional.

Both are remembered. The schema is indented like Format (the **Indent** choice
in the Text toolbar).

## The tree

The Tree tab shows the document as a collapsible tree. It opens with the root
and its first level; containers fill in when you open them, so large
documents stay quick. Arrays with more than 10,000 items show them a page at a
time, with **Show more** and **Show all** at the end.

The tree is kept plain so the data reads first. An object or array row shows a
`{ }` or `[ ]` mark and its key; a value row shows a small dot, the key and the
value — the value itself says what type it is (`"text"`, `12`, `true`, `null`).
Array items are labelled with their index, and the root with **JSON**. Control
characters in strings are shown as symbols (a newline is `␊`).

The two buttons and the menu at the right of the toolbar:

- **Expand all** (the down-chevron) opens everything; it asks first above
  5,000 nodes.
- **Collapse all** (the up-chevron) closes everything but the root.
- **Level…** opens every container above the level you pick (level 1 is the
  root's children).

Select a row to see its **path** in the bar at the bottom, with its type and,
for an object or array, its size (`object · 5 keys`), plus:

- **Copy path** — e.g. `$.items[3]["first name"]`;
- **Copy value** — that node formatted on its own;
- **Show in text** — switches to Text with the node's key (or value) selected.

If the JSON is invalid, the Tree tab shows the error rather than a partial
tree, with **Go to error**.

## Filtering the tree

Type in the filter box (or press <kbd>/</kbd> on the Tree tab to jump to it).
The tree narrows to the nodes that match, each with the chain of containers
that leads to it; everything else is folded away, and a container that has
lost some children says how many it still shows: `1 of 9`.

- **Keys & values / Keys / Values** — the menu beside the box: what to match
  against. Values are strings, numbers (as written), `true`, `false` and
  `null`.
- **Aa** — match case. Off by default.
- **.\*** — treat the filter as a regular expression. A broken regex is
  reported under the box and the tree is left as it was.
- **Paths** — start the filter with `$` to match by path instead:
  `$.items[*].name`, `$["first name"]`, `$..zip` (`..` means "at any depth").

The search covers the whole document, including branches that are collapsed or
not yet drawn, so the match count is always complete. Where a filtered
container has more than 500 matching children it shows them a page at a time;
stepping to a match further down draws up to it.

- <kbd>Enter</kbd> / <kbd>Shift</kbd>+<kbd>Enter</kbd> (or the arrows) — next
  and previous match.
- <kbd>Esc</kbd> — clear the filter. The tree goes back exactly as it was
  before you started filtering.

## Comparing two documents (Diff)

The **Diff** tab splits the editor into two panes, **Left** and **Right**.
Whatever was in the Text editor goes into Left; Right starts empty (and keeps
what you put in it while you visit the other tabs). Switching back to Text or
Tree carries on with the Left pane's JSON.

The comparison is about content, never order:

- **Object members match by key.** `{"name": "A", "age": 3}` and
  `{"age": 3, "name": "A"}` are the same.
- **Array elements match by content.** `[1, 2]` and `[2, 1]` are the same
  array. Equal elements pair first; of what is left, an object pairs with the
  most similar object on the other side — shared keys and equal values count,
  and an equal `id` (or `uuid`, `key`, `code`…) pairs two records outright. So
  a record that moved *and* had one field changed shows as one changed field.
  Two objects with the same keys but no value in common are treated as
  different records.
- **Values compare as JSON values.** `"3"` and `3` are a **type change**;
  `1.0` and `1` are the same number; `"\u00e9"` and `"é"` are the same string.

Each difference is highlighted on its row and marked in the gutter:

| Mark | Colour | Means |
|---|---|---|
| `−` | red | **missing** — only on the Left |
| `+` | green | **added** — only on the Right |
| `~` | amber | **changed** — same key (or paired element), different value |
| `≠` | purple | **type change** — e.g. a string on one side, a number on the other |

The status bar sums them up — "3 differences: 1 added, 1 missing, 1 changed"
— or says **Documents match**. ▲/▼ (or <kbd>Alt</kbd>+<kbd>↑</kbd> /
<kbd>Alt</kbd>+<kbd>↓</kbd>) step from one difference to the next, and the two
panes scroll together.

### Both panes are editors

Type, paste and delete in either pane. The panes are compared again about 1.5
seconds after you stop typing — not on every keystroke. If a pane's JSON is
invalid at that point, the status bar shows the parser's exact error for that
pane (click it to jump there), and the last good comparison stays on screen
until it is fixed.

A pasted, loaded or carried-over document is laid out one value per line, so
the two sides can line up row for row; what you type is never reformatted.
Each pane has its own **Format**, **Unescape**, **Copy**, **Clear** and **Load
from file** buttons, and smart paste works in each one.

### Placeholders

Where one side has a member or element the other lacks, the other side shows
a **hatched placeholder** row, so both panes stay aligned and the gap is easy
to see. Placeholders are only drawn: they are never part of the pane's JSON,
and they are left out of Copy, of a copy or cut you make yourself, and of the
text carried back to the Text tab.

**Typing into a placeholder turns it into a real line** on the first
keystroke. JsonHippo indents it like the line opposite and adds the comma the
document will need — on the line above if the new member is now the last one,
after your text if more follow. Paste the missing member in, pause, and the
difference disappears.

### Reorder

```
Reorder   ( Left master | [Off] | Right master )
```

- **Off** (the default): each pane keeps its own order. Reordered members are
  still not counted as differences; they just sit on different rows.
- **Left master**: Left is the reference, and the **Right pane is rewritten**
  in Left's order — keys and array elements, at every level. Anything only on
  the Right goes after the matched members, in its own order. Now everything
  lines up row for row and only the real differences stand out.
- **Right master**: the same the other way round.

Reordering changes order only: every key, string (escapes included) and number
(as written) is kept exactly. The rewritten pane keeps following the master as
you edit the master. Once you edit the rewritten pane yourself, it is left
alone. Moving back to Off restores its original order — unless you have edited
it, in which case your edits are kept.

## Keyboard

| Where | Key | Does |
|---|---|---|
| Text, or a Diff pane | <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd> | Format |
| Tabs | <kbd>←</kbd> <kbd>→</kbd> | Switch between Tree, Text, Schema and Diff |
| Diff | <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>Alt</kbd>+<kbd>↓</kbd> | Previous / next difference |
| Tree tab | <kbd>/</kbd> | Focus the filter |
| Filter | <kbd>Enter</kbd> / <kbd>Shift</kbd>+<kbd>Enter</kbd> | Next / previous match |
| Filter or tree | <kbd>Esc</kbd> | Clear the filter |
| Warnings list | <kbd>Esc</kbd> | Close it |
| Tree | <kbd>↑</kbd> <kbd>↓</kbd> | Previous / next row |
| Tree | <kbd>→</kbd> | Open a container, or move into it |
| Tree | <kbd>←</kbd> | Close a container, or move to its parent |
| Tree | <kbd>Enter</kbd> or <kbd>Space</kbd> | Select the row |
| Tree | <kbd>Home</kbd> / <kbd>End</kbd> | First / last row |

## Themes

The theme follows your system's light or dark setting. The button in the
header cycles **System → Light → Dark**, and the choice is remembered.

## Error reference

Every error JsonHippo reports, with an example that causes it and how to fix
it. The first ten come from the parser (structure); the last seven from the
tokenizer (the characters themselves).

| Code | Example | What it means | Fix |
|---|---|---|---|
| `EXPECTED_VALUE` | `[1,,2]`, `{"a":}` | A value was needed and something else was there. | Put a value in the gap, or remove the extra comma. |
| `EXPECTED_KEY` | `{a:1}`, `{'a':1}`, `{1:2}` | An object member must start with a key, and keys must be double-quoted strings. | Write the key in double quotes: `{"a":1}`. |
| `EXPECTED_COLON` | `{"a" 1}` | A key must be followed by `:`. | Add the colon: `{"a": 1}`. |
| `EXPECTED_COMMA_OR_CLOSE` | `{"a":1 "b":2}`, `[1 2]` | After a value comes `,` or the closing bracket. Most often a comma is missing. | Add the comma between the two values. |
| `TRAILING_COMMA` | `[1,2,]`, `{"a":1,}` | JSON does not allow a comma after the last item. | Delete the comma before the closing bracket. |
| `MISMATCHED_CLOSE` | `[1,2}` | A closing bracket does not match the one that opened the container. The hint says where that one was opened. | Use the matching closer (`]` for `[`, `}` for `{`), or add the missing opener. |
| `UNCLOSED_CONTAINER` | `{"a": [1, 2` | The input ended with a `{` or `[` still open. The error points at that opener, not the end of the file. | Add the missing `}` or `]`. The hint lists every container still open. |
| `TRAILING_CONTENT` | `{} {}`, `{"a":1}x` | Something follows the end of the JSON value. | Remove it, or wrap several values in an array: `[{}, {}]`. |
| `EMPTY_INPUT` | (only whitespace) | There is no JSON at all. Reported by Format and Minify. | Paste or type some JSON. |
| `MAX_DEPTH` | 10,001 nested `[` | Nesting deeper than 10,000 levels. | Almost certainly generated by mistake; flatten the structure. |
| `UNTERMINATED_STRING` | `{"name": "Ada` and the line ends | A string has no closing quote before the end of its line. The error points at the **opening** quote. | Add the closing `"`. |
| `BAD_ESCAPE` | `"C:\Users"` | A backslash is followed by something that is not a JSON escape. JSON allows `\" \\ \/ \b \f \n \r \t \uXXXX`. | Escape the backslash itself: `"C:\\Users"`. |
| `BAD_UNICODE_ESCAPE` | `"caf\u00g9"` | `\u` must be followed by exactly four hex digits. | Fix the digits: `"caf\u00e9"`. |
| `CONTROL_CHAR_IN_STRING` | a raw tab or line break inside `"…"` | Control characters must be escaped inside strings. | Write `\t` for a tab and `\n` for a line break. |
| `BAD_NUMBER` | `01`, `1.`, `-`, `1e`, `0x1F` | A number that breaks JSON's number rules: no leading zeros, digits after a decimal point and in an exponent, no hex. | Write it as JSON allows: `1`, `1.0`, `-1`, `1e5`, `31`. |
| `BAD_LITERAL` | `tru`, `True`, `undefined`, `NaN` | A bare word that is not `true`, `false` or `null`. | Fix the spelling (lower-case), use `null` for undefined, or quote it if it is text. |
| `UNEXPECTED_CHAR` | `'`, `#`, `@`, a no-break space | A character that cannot start anything in JSON. The hint names the usual causes: single quotes, comments, curly quotes, invisible characters. | Delete it or replace it, as the hint suggests. |

And the warnings, which do not stop the JSON being valid (see
[Warnings](#warnings)):

| Code | Example | What it means | Fix |
|---|---|---|---|
| `DUPLICATE_KEY` | `{"id": 1, "id": 2}` | The same key twice in one object. Most programs keep only the last one. | Rename or remove one of them. |
| `EMPTY_KEY` | `{"": 1}` | A key that is the empty string. | Give it its name. |
| `NUMBER_PRECISION` | `12345678901234567890`, `1e400` | A number that changes when read as a 64-bit float. | If every digit matters, send it as a string: `"12345678901234567890"`. |
