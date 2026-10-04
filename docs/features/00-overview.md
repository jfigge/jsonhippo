# JsonHippo — Overview

## Context
JsonHippo is a single-page web app for viewing, formatting and validating JSON. It is part of the Hippo family of open-source apps (github.com/jfigge, hippoherd.com). It is inspired by jsonviewer.stack.hu, which the owner has used for years. The aim is not to compete with it. The aim is to add three things that tool cannot do:

1. A **tree view that can be filtered**.
2. A **smart paste** that recognises escaped JSON (a string wrapped in quotes with `\"` inside) and unescapes it automatically.
3. A **hand-written parser** that reports exactly where invalid JSON breaks (line, column, context, expected vs found), so errors in very large strings can be found.

This is a plain static web page. It is **not** an Electron app.

## Goal
Ship a small, fast, dependency-light static site with:
- a Text view and a Tree view;
- a custom tokenizer and recursive-descent parser with precise errors;
- smart paste;
- a filterable tree;
- light makefile, validation and docs, matching other Hippo projects but scaled down;
- a product page for hippoherd.com.

## Design

### Tech stack
- HTML + CSS + vanilla JavaScript using **class-based ES modules**. There is no framework and no bundler.
- **jQuery** (loaded from cdnjs, pinned version) is used for the tree view and filter DOM work. The owner asked for jQuery specifically.
- The parser and smart-paste code are **pure JS with no DOM and no jQuery**, so they can be unit-tested in Node.
- **No parsing library and no `JSON.parse` for validation.** The custom parser is the source of truth.

### Hippo conventions
- Element naming uses a prefix: `jh-` (for example `jh-input`, `jh-tree`, `jh-filter`).
- State classes use the `block--modifier` pattern (for example `jh-node--collapsed`, `jh-node--match`, `jh-tab--active`).
- Widgets owned by a parent get their callbacks through the constructor (for example `new TreeView(el, { onSelect })`).
- Accessible SVG icons use `currentColor` and are distinguished by shape, not colour alone.
- Feature docs use the format Context / Goal / Design / Steps / Acceptance / Constraints / Verify.

### Proposed layout
```
jsonhippo/
├── Makefile
├── README.md
├── LICENSE
├── package.json          # dev tooling only (eslint, html-validate); no runtime deps
├── src/
│   ├── index.html
│   ├── css/app.css
│   └── js/
│       ├── app.js            # wires everything together
│       ├── parser/
│       │   ├── tokenizer.js
│       │   ├── parser.js
│       │   └── errors.js     # JsonHippoError class + formatting
│       ├── smart-paste.js
│       ├── formatter.js      # pretty-print / minify from the AST
│       ├── text-view.js
│       ├── tree-view.js
│       └── tree-filter.js
├── test/
│   ├── tokenizer.test.js
│   ├── parser.test.js
│   ├── parser-errors.test.js
│   ├── smart-paste.test.js
│   └── fixtures/             # valid/invalid samples, including one large file
├── docs/
│   └── features/             # these feature files
└── site/
    └── hippoherd/            # product page for hippoherd.com
```

### Feature breakdown (build in this order)
| # | File | Summary |
|---|------|---------|
| 01 | `01-scaffold-and-makefile.md` | Repo, page shell, Makefile, lint/validate/test |
| 02 | `02-tokenizer.md` | Character-by-character lexer with line/column on every token |
| 03 | `03-parser-and-errors.md` | Recursive-descent parser, AST, precise error reporting |
| 04 | `04-smart-paste.md` | Detect and unescape escaped JSON |
| 05 | `05-text-view-and-formatting.md` | Text tab, format/minify, error highlighting |
| 06 | `06-tree-view.md` | Collapsible tree rendered from the AST |
| 07 | `07-tree-filter.md` | Live filter on the tree (jQuery) |
| 08 | `08-hippoherd-page-and-docs.md` | Product page and light docs |

## Acceptance
- Every feature file's acceptance criteria pass.
- `make check` passes with no errors.
- The app works when opened through `make serve`. No network is needed except the pinned jQuery CDN, with a local fallback copy.

## Constraints
- No runtime dependencies other than jQuery.
- No `JSON.parse` / `JSON.stringify` in the parse or validate path. They are allowed in tests only, as an oracle to compare results.
- Must handle inputs of several MB without freezing the page.

## Verify
- `make check`
- Manual run-through of each feature's Verify section.

## Open questions (owner to confirm)
- Hosting: is this GitHub Pages on its own domain (like porthippo.com / Cloudflare), or only a page under hippoherd.com? The default assumption is GitHub Pages with its own domain, plus a product page on hippoherd.com.
- Light/dark theme: the default assumption is that it follows the system setting, with a manual toggle.
