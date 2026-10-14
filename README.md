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

The same page also ships as a **desktop app** for macOS, Windows and Linux
(arm64 and x64 each): a thin Electron shell around `src/`, unmodified, that
makes no network request at all. See [Desktop builds](#desktop-builds).

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

`make desktop` opens the same `src/` in the desktop shell (it installs
Electron into `electron/node_modules/` on first use).

## Make targets

| Target | Does |
|---|---|
| `make` / `make help` | Lists the targets |
| `make serve` | Serves `src/` on `http://localhost:8080` with caching off, so a reload always runs the current code (`PORT=…` to change) |
| `make test` | Unit tests: `node --test`, no framework |
| `make lint` | ESLint over `src/js`, `test`, `scripts` and `electron` |
| `make validate` | html-validate over the app page and the parked product page |
| `make check` | `lint` + `validate` + `test` |
| `make dist` | Copies `src/` to `dist/`, ready to publish (no bundling) |
| `make clean` | Removes `dist/` and `build/` |
| `make fixtures` | Writes the large generated test documents to `test/fixtures/large/` |
| `make screenshots` | Re-captures the product-page screenshots from the real app (needs Chrome) |
| `make site` | Publishes: runs `check`, then copies the app into a hippoherd checkout's `website/jsonhippo/` (`HIPPOHERD=…`, default `../hippoherd`) |
| `make preview-site` | Serves a copy of the hippoherd site with this build of the app in it, before publishing |
| `make desktop` | Runs the desktop shell on `src/`, no packaging (⌘R reloads an edit) |
| `make desktop-pack` | An unsigned app for this machine in `build/electron/dist/`, no installer — the quick smoke test |
| `make dist-mac` | The two macOS `.dmg`s (arm64, x64); signed and notarized when the credentials are set (`RELEASE_ENV=…`) |
| `make dist-win` | The two Windows installers (x64, arm64). CI builds them on Windows, under MSYS2; a Mac can cross-build them, unsigned |
| `make dist-linux` | The two Linux AppImages (x64, arm64). CI builds them on Linux; a Mac can cross-build them |
| `make icons` | Re-renders `electron/icons/` from `src/img/jsonhippo.svg` and the macOS variant |
| `make sync-mac` | Copies the macOS signing credentials from `RELEASE_ENV` into this repo's Actions secrets (needs `gh`) |

`make dist` is the web app's copy step, as before; the per-platform `dist-*`
targets are named after Rest Hippo's and Chip Hippo's, which the Release
workflow follows.

## Where it runs

Live at **[hippoherd.com/jsonhippo](https://hippoherd.com/jsonhippo/)**. The
herd's index carries JsonHippo's card, which leads to its page,
**[hippoherd.com/jsonhippo/about](https://hippoherd.com/jsonhippo/about/)**:
the features, the desktop downloads, and a **Launch** button that opens the
app.

To publish a new version of the web app:

```sh
make site                       # check, then copy dist/ into ../hippoherd/website/jsonhippo/
cd ../hippoherd
git add -A website/jsonhippo && git commit -m "JsonHippo: …" && git push
```

hippoherd's CI deploys on every push to `main`. The page at `/jsonhippo/about/`
is hippoherd's, generated from JsonHippo's entry in its `content/hippos.mjs`
(`page` puts it there; `app` names `/jsonhippo/` as the app), so `make site`
copies around it and never deletes it. Its downloads come from this repo's
GitHub Releases, through hippoherd's `versions.json`, like every other hippo's
— the installers are never copied into hippoherd (each is over 100 MB, which
GitHub refuses in a push).

## Desktop builds

`electron/` is the whole desktop app apart from the page itself: `main.js`
(the window, the menu, and what the page may do), `policy.js` (where it may
navigate, pure so `test/desktop.test.js` covers it), the icons, and a
`package.json` holding Electron, electron-builder and the packaging config.
The page is loaded **unmodified**: the build copies `dist/` in as `web/`.

What the shell changes about the page's surroundings, and why:

- **No network.** Every http(s) request is cancelled. The only one the page
  makes is for jQuery on cdnjs; it fails, and `app.js` loads the vendored copy
  — the path the page already takes when the CDN is blocked. The desktop app
  works offline from its first launch.
- **Links open in the system browser.** A page written for a tab navigates
  away on a link; in a window with no address bar that would strand the user.
  `href="./"` (the header's logo) reloads the page instead of opening a
  directory listing. Other local files are not navigable.
- **Sandboxed renderer, no preload, no Node** — the page needs none of them.
  The only permission it is granted is writing to the clipboard (Copy).

The version is `package.json`'s; the staged build is stamped with it
(`electron/package.json` stays at `0.0.0`). Six installers come out:

| Platform | arm64 | x64 |
|---|---|---|
| macOS | `JsonHippo-<v>-arm64.dmg` | `JsonHippo-<v>-x64.dmg` |
| Windows | `JsonHippo-Setup-<v>-arm64.exe` | `JsonHippo-Setup-<v>-x64.exe` |
| Linux | `JsonHippo-<v>-arm64.AppImage` | `JsonHippo-<v>-x86_64.AppImage` |

### Releasing

`.github/workflows/release.yml` builds all six on every push to `main`, on
native runners (Chip Hippo's build job, with Rest Hippo's Windows signing
steps). It **publishes** them as the GitHub Release `v<version>` when that tag
does not exist yet — so a release is: bump `"version"` in `package.json`,
push. A push that does not change the version builds, signs and keeps the
installers as run artifacts for a week, and publishes nothing.

### Signing

| Platform | How | Status |
|---|---|---|
| macOS | Developer ID Application certificate + notarization — the herd's, as Rest Hippo and Chip Hippo use | Needs this repo's secrets: `CSC_LINK`, `CSC_KEY_PASSWORD`, and `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` (or the `APPLE_API_KEY_*` trio). `make sync-mac RELEASE_ENV=../resthippo/release.env` sets the first five. |
| Windows | Authenticode through SignPath Foundation (Rest Hippo's steps) | **Not available.** No hippo has a Windows certificate: Rest Hippo's SignPath setup was never configured, and Chip Hippo ships unsigned. JsonHippo would need its own SignPath Foundation project. Until then the installers are unsigned and SmartScreen warns. |
| Linux | — | AppImages are unsigned, as every hippo's are. |

**No release is published until the macOS secrets are set** — every run says
so in a warning. Rest Hippo and Chip Hippo publish unsigned builds when
their secrets are missing, but they release on a pushed tag; here any push to
`main` can release, so an unconfigured repository would otherwise put an
unsigned Mac build in front of users. When signing is configured, CI checks
both Mac apps for a Developer ID signature and a stapled notarization ticket
before uploading them.

Locally, `make dist-mac` signs with whatever `RELEASE_ENV` names
(`release.env` by default; see `release.env.example`). Without it,
electron-builder falls back to a Developer ID identity in the login keychain,
or builds unsigned if there is none.

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
                          diff alignment, diff session, desktop shell
  fixtures/valid/         valid samples (compared against JSON.parse)
  fixtures/invalid/       one or more samples per error code; positions in
                          invalid-expected.json
  fixtures/escaped/       smart-paste samples
  fixtures/generate.js    the large (5 MB) documents, generated from a seed
scripts/
  browser.js              minimal headless-Chrome driver (Node built-ins only)
  screenshots.js          `make screenshots`
  serve.py                `make serve`: http.server with caching turned off
  make-icons.mjs          `make icons` (runs under Electron)
site/product-page/        a marketing page, parked for a future jsonhippo.com
                          (not published; see its README)
electron/                 the desktop shell (see Desktop builds)
  main.js                 window, menu, network and navigation policy
  policy.js               where the page may navigate (pure)
  icons/                  macOS, Windows and Linux icons; `make icons`
  package.json            Electron, electron-builder, the six targets
.github/workflows/
  release.yml             build, sign and publish the installers
release.env.example       local signing credentials, template
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
