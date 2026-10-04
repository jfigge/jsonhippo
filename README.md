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

Plus format and minify that keep every digit and key order, copy path, copy
value, light and dark themes, and large-file handling. Nothing is uploaded:
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
| `make validate` | html-validate over the app page and the hippoherd page |
| `make check` | `lint` + `validate` + `test` |
| `make dist` | Copies `src/` to `dist/`, ready to publish (no bundling) |
| `make clean` | Removes `dist/` and `build/` |
| `make fixtures` | Writes the large generated test documents to `test/fixtures/large/` |
| `make screenshots` | Re-captures the product-page screenshots from the real app (needs Chrome) |
| `make site` | Syncs the product page into a hippoherd checkout's `website/jsonhippo/` (`HIPPOHERD=…`, default `../hippoherd`) |
| `make preview-site` | Serves the product page inside a hippoherd checkout, before syncing |

## How it is built

- **No framework, no bundler.** HTML, CSS and class-based ES modules, loaded
  directly by the browser.
- **jQuery 4.0.0** (pinned, with an SRI hash, from cdnjs) for the tree and
  the filter. If the CDN is blocked, `app.js` loads the identical copy in
  `src/vendor/`.
- **No parsing library, and no `JSON.parse` / `JSON.stringify` in `src/`.**
  The custom parser is the source of truth; ESLint enforces this. Tests use
  `JSON.parse` as an oracle.
- **The parser, smart paste, formatter and tree search are pure JS** — no DOM,
  no jQuery — so they run under `node --test`. ESLint gives those files no
  browser globals, so a stray `document` or `$` fails the lint.

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
    settings.js           remembered preferences (localStorage)
    theme.js              applies the saved theme before first paint
    util.js
  vendor/jquery.min.js    local fallback for the CDN copy
  img/                    the JsonHippo mark (SVG, and a 512 px PNG)
test/
  *.test.js               tokenizer, parser, parser errors, smart paste,
                          formatter, tree search
  fixtures/valid/         valid samples (compared against JSON.parse)
  fixtures/invalid/       one or more samples per error code; positions in
                          invalid-expected.json
  fixtures/escaped/       smart-paste samples
  fixtures/generate.js    the large (5 MB) documents, generated from a seed
scripts/
  browser.js              minimal headless-Chrome driver (Node built-ins only)
  screenshots.js          `make screenshots`
  serve.py                `make serve`: http.server with caching turned off
site/hippoherd/           the hippoherd.com product page; `make site` publishes it
                          (see its README)
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

## Licence

Apache-2.0 — see [LICENSE](LICENSE). jQuery is MIT; see [NOTICE](NOTICE).
