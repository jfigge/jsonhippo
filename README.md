# JsonHippo

**A JSON viewer that tells you exactly where it broke.**

A single static web page for viewing, formatting and validating JSON — part of
the [Hippo family](https://hippoherd.com). It is inspired by
[jsonviewer.stack.hu](https://jsonviewer.stack.hu/) and adds the three things
that tool cannot do:

1. **Pinpoint errors.** A hand-written tokenizer and parser report the exact
   line and column, what was expected and what was found, the JSON path, and
   every container still open:
   `Line 42, col 8: expected ',' or '}' but found string "name" (in $.items[3])`.
   Click it and the caret lands on the bad character, even in a 5 MB file.
2. **Smart paste.** JSON that arrives as an escaped string —
   `"{\"id\":7}"` — is recognised and unescaped on paste, as many times as it
   was escaped, with an Undo.
3. **A filterable tree.** Narrow the tree to the keys or values that match
   (plain text, regex, or a `$.path`), with each match's ancestors kept so you
   can see where it sits.

And a **Diff** tab that compares two documents semantically: key order and
array order are never differences, both panes are editable, a member missing
on one side gets a placeholder row you can type straight into, and a
**Reorder** switch can lay either side out in the other's order so only the
real differences stand out.

Plus **warnings** for JSON that is valid but suspect (duplicate keys, empty
keys, numbers that lose precision), a **Schema** tab with the JSON Schema
inferred from a sample, format and minify that keep every digit and key order,
copy path, copy value, light and dark themes, and large-file handling. Nothing is uploaded:
it is a static page and all the work happens in the browser.

See **[docs/USAGE.md](docs/USAGE.md)** for the user guide and the reference of
every error code.

## Run it locally

Needs Python 3 (to serve the page) and Node 20.19+ (for the dev tooling).

```sh
make serve          # http://localhost:8080
make check          # lint + validate + test — run this before pushing
```

`make check` installs the dev tooling on first use (`npm ci`). There is no
build step: the browser loads `src/` as it is.

## Make targets

| Target | Does |
|---|---|
| `make` / `make help` | Lists the targets |
| `make serve` | Serves `src/` on `http://localhost:8080` with caching off, so a reload always runs the current code (`PORT=…` to change) |
| `make test` | Unit tests: `node --test`, no framework |
| `make lint` | ESLint over `src/js`, `test` and `scripts` |
| `make validate` | html-validate over the app page and the parked product page |
| `make check` | `lint` + `validate` + `test` |
| `make dist` | Copies `src/` to `dist/`, ready to publish (no bundling) |
| `make clean` | Removes `dist/` and `build/` |
| `make fixtures` | Writes the large generated test documents to `test/fixtures/large/` |
| `make screenshots` | Re-captures the product-page screenshots from the real app (needs Chrome) |
| `make site` | Publishes: runs `check`, then copies the app into a hippoherd checkout's `website/jsonhippo/` (`HIPPOHERD=…`, default `../hippoherd`), and into ViewHippo's input (`VIEWHIPPO_DIR=…`, default that same directory) |
| `make preview-site` | Serves a copy of the hippoherd site with this build of the app in it, before publishing |

## Where it runs

Live at **[hippoherd.com/jsonhippo](https://hippoherd.com/jsonhippo/)**. The
herd's index carries JsonHippo's card, which leads to its page,
**[hippoherd.com/jsonhippo/about](https://hippoherd.com/jsonhippo/about/)**:
the features and a **Launch** button that opens the app.

To publish a new version of the web app:

```sh
make site                       # check, then copy dist/ into ../hippoherd/website/jsonhippo/
cd ../hippoherd
git add -A website/jsonhippo && git commit -m "JsonHippo: …" && git push
```

hippoherd's CI deploys on every push to `main`. The page at `/jsonhippo/about/`
is hippoherd's, generated from JsonHippo's entry in its `content/hippos.mjs`
(`page` puts it there; `app` names `/jsonhippo/` as the app), so `make site`
copies around it and never deletes it.

The same `make site` feeds **ViewHippo**, the herd's desktop app, built in
hippoherd, which hosts JsonHippo alongside the other viewers. Its build
currently packages `website/jsonhippo/` itself (minus `about/`), so one copy
serves both and the commit above ships to the app too. `VIEWHIPPO_DIR` names
where ViewHippo takes the viewer from; set it to another directory and
`make site` mirrors `dist/` there as well. Either way this repository stays the
source of truth: ViewHippo never holds a copy of the viewer's code of its own.

## How it is built

- **No framework, no bundler.** HTML, CSS and class-based ES modules, loaded
  directly by the browser.
- **jQuery 4.0.0** (pinned, with an SRI hash, from cdnjs) for the tree and
  the filter. If the CDN is blocked, `app.js` loads the identical copy in
  `src/vendor/`.
- **No parsing library, and no `JSON.parse` / `JSON.stringify` in `src/`.**
  The custom parser is the source of truth; ESLint enforces this. Tests use
  `JSON.parse` as an oracle.
- **The parser, smart paste, formatter, tree search, linter, schema
  inference and the diff engine are pure JS** — no DOM, no jQuery — so they run under `node --test`. ESLint
  gives those files no browser globals, so a stray `document` or `$` fails the
  lint.

### Layout

```
src/
  index.html              page shell: header, tabs, panels, status bar
  css/app.css             both themes and every component
  js/
    app.js                wires the widgets together; owns the current parse
    parser/
      tokenizer.js        character-by-character lexer, positions on every token
      parser.js           grammar-shaped descent with an explicit container stack
      errors.js           JsonHippoError and how tokens and characters are described
    smart-paste.js        detect and unescape escaped JSON
    formatter.js          pretty-print / minify from the AST
    json-path.js          write paths; read $.path filter queries
    text-view.js          Text tab: textarea, virtual gutter, error marker
    status-bar.js         the status bar: summary, or the error and its jump links
    tree-view.js          Tree tab: lazy jQuery tree, toolbar, detail bar
    tree-search.js        the filter's search over the AST (pure)
    tree-filter.js        the filter bar (jQuery)
    schema-view.js        Schema tab: the inferred schema, read-only, and its options
    lint/                 warnings for valid but suspect JSON (pure)
      linter.js           runs the rules as the parser reads; collects warnings
      rules.js            the checks: duplicate key, empty key, precision loss
    warnings-view.js      the list of warnings above the status bar
    schema/
      infer.js            a JSON Schema from a sample document (pure)
    numbers.js            a number's exact value, from its source text (pure)
    diff/                 the Diff tab's logic (pure)
      json-diff.js        semantic diff: members by key, elements by content
      reorder.js          the Reorder switch: one side in the other's order
      align.js            the two documents as side-by-side rows, with placeholders
      pane-model.js       a pane's text with its render-only rows, following edits
      session.js          parse, reorder, diff, align; keeps the last good result
    diff-view.js          Diff tab: Reorder, navigation, debounce, pane actions
    diff-pane.js          one Diff pane: textarea, gutter, row highlights
    settings.js           remembered preferences (localStorage)
    theme.js              applies the saved theme before first paint
    util.js
  vendor/jquery.min.js    local fallback for the CDN copy
  img/                    the JsonHippo mark (SVG, and a 512 px PNG)
test/
  *.test.js               tokenizer, parser, parser errors, smart paste,
                          formatter, tree search, lint, schema, diff,
                          diff alignment, diff session
  fixtures/valid/         valid samples (compared against JSON.parse)
  fixtures/invalid/       one or more samples per error code; positions in
                          invalid-expected.json
  fixtures/escaped/       smart-paste samples
  fixtures/generate.js    the large (5 MB) documents, generated from a seed
scripts/
  browser.js              minimal headless-Chrome driver (Node built-ins only)
  screenshots.js          `make screenshots`
  serve.py                `make serve`: http.server with caching turned off
site/product-page/        a marketing page, parked for a future jsonhippo.com
                          (not published; see its README)
docs/
  USAGE.md                user guide and error reference
  features/               the feature specs this was built from
```

### Design notes

- **The parser does not recurse through the JS call stack.** Each nesting
  level would cost two stack frames, and V8 overflows at about 3,800 levels —
  well short of the 10,000-level depth guard. Nested containers are pushed
  onto an explicit stack instead, which is also exactly what the error
  messages need (the path, and the chain of unclosed containers). The
  formatter, the tree search and the tree's bulk renders are iterative for the
  same reason.
- **The large fixtures are generated, not committed.** A seeded PRNG makes the
  5 MB documents identical on every run, so tests can assert exact lines and
  columns in them. `make fixtures` writes them out for trying in the app.
- **Positions are UTF-16 offsets** — the units a `<textarea>` uses — so an
  error's offset goes straight into `setSelectionRange`.
- **The linter rides on the parse.** The parser already visits every key and
  value, so it calls the linter as it goes (`parse(text, { lint })`) rather
  than the linter walking the tree again; with Warnings off no linter is
  passed and no lint work is done. Each check is an independent rule with
  handlers for the events it needs (`lint/rules.js`), so a new check is one
  more rule.
- **The schema is written by the formatter.** Inference builds the schema as
  an AST in the parser's shape, and `formatter.js` writes it out — no
  `JSON.stringify`, and property names keep the exact text they had in the
  sample.
- **Diff placeholders are empty lines only the model knows about.** A Diff
  pane is a plain textarea, so a placeholder can only be an empty line in it.
  `diff/pane-model.js` keeps a metadata record per line, follows every edit
  (lines above keep theirs, lines below shift), and builds the pane's JSON
  without those lines — for the parser, the Copy button, native copy and cut,
  and the trip back to the Text tab.

## Licence

GPL-3.0-or-later — see [LICENSE](LICENSE). jQuery is MIT; see [NOTICE](NOTICE).
