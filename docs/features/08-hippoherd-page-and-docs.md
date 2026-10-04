# 08 — HippoHerd Page and Docs

## Context
Every Hippo app gets a product page on hippoherd.com and light documentation. JsonHippo is a single page, so the docs stay small.

## Goal
A JsonHippo product page ready to add to hippoherd.com, plus a README and short user docs.

## Design

### HippoHerd page (`site/hippoherd/jsonhippo.html`)
- Follows the layout and styling of the existing Hippo product pages on hippoherd.com. Claude Code should look at an existing page and match it.
- Sections:
  - **Hero**: name, one-line pitch ("A JSON viewer that tells you exactly where it broke") and a "Launch JsonHippo" button.
  - **The three differentiators**: filterable tree, smart paste of escaped JSON, and pinpoint error reporting. Each gets a screenshot or short animation.
  - **Also included**: format, minify, copy path, large-file handling.
  - **Credit**: a line acknowledging jsonviewer.stack.hu as the inspiration.
  - **Links**: GitHub repo (jfigge) and licence.
- Screenshots go in `site/hippoherd/img/`.

### Docs
- `README.md`: what it is, the three features, `make` targets, how to run locally, and the project layout.
- `docs/USAGE.md`: a one-page user guide covering paste, smart paste and Undo, reading error messages, the tree, the filter and its options, and keyboard shortcuts.
- `docs/features/`: this set of feature files, kept up to date as the design record.
- An **Error reference** table, either in USAGE or in its own short file, listing each error code with an example and a fix.

## Steps
1. Review an existing hippoherd.com product page for its structure and styles.
2. Build `jsonhippo.html` to match, with screenshots taken from the finished app.
3. Write the README and USAGE, including the error reference.
4. Add the page to the hippoherd validation (`make validate`).

## Acceptance
- The product page passes `make validate` and matches the look of the other Hippo pages.
- The README is enough for a new contributor to run `make serve` and `make check`.
- Every error code in `03-parser-and-errors.md` appears in the error reference.

## Constraints
- Keep it light: there is no docs site generator.
- The page must work as static HTML that can be dropped into hippoherd.com.

## Verify
- Run `make validate`.
- Open the product page locally and compare it with an existing Hippo page.
