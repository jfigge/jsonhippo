# Using JsonHippo

JsonHippo is one page with two tabs. **Text** is where JSON goes in and where
errors are shown; **Tree** is where you explore it. Everything happens in your
browser: nothing you paste or load is uploaded anywhere.

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
2.1 MB" — plus a warning if any object has the same key twice. Duplicate keys
are allowed by the JSON grammar but almost always a mistake; the warning links
to the second one.

## Format, minify, copy

- **Format** pretty-prints with the indent chosen in the **Indent** menu
  (2 spaces, 4 spaces or a tab). Shortcut: <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd>.
- **Minify** removes all whitespace outside strings.
- Both are written from the parsed document, so numbers keep every digit
  (`12345678901234567890` stays as it is), strings keep their escapes, and keys
  stay in their original order, duplicates included.
- Neither changes invalid text; they show the error instead.
- **Copy** copies the text; **Clear** empties it.

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

## Keyboard

| Where | Key | Does |
|---|---|---|
| Text | <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd> | Format |
| Tabs | <kbd>←</kbd> <kbd>→</kbd> | Switch between Text and Tree |
| Tree tab | <kbd>/</kbd> | Focus the filter |
| Filter | <kbd>Enter</kbd> / <kbd>Shift</kbd>+<kbd>Enter</kbd> | Next / previous match |
| Filter or tree | <kbd>Esc</kbd> | Clear the filter |
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

And one warning, which does not stop the JSON being valid:

| Code | Example | What it means | Fix |
|---|---|---|---|
| `DUPLICATE_KEY` | `{"id": 1, "id": 2}` | The same key twice in one object. Most programs keep only the last one. | Rename or remove one of them. |
