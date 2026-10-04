# 01 — Scaffold, Makefile and Validation

## Context
JsonHippo is a single static page (see `00-overview.md`). It needs the usual light Hippo tooling: a Makefile as the single entry point, linting, HTML validation and unit tests. All of it should be scaled down for a one-page project.

## Goal
Create the repo skeleton, the empty page shell and a Makefile so that `make check` gives a reliable green or red signal from day one.

## Design

### Page shell (`src/index.html`)
- A header with the JsonHippo name and logo placeholder.
- A tab bar with **Text** and **Tree** tabs (`jh-tab`, `jh-tab--active`).
- A status/error bar (`jh-status`).
- jQuery loaded from cdnjs, using a pinned version with an SRI hash. If it fails to load, fall back to `src/vendor/jquery.min.js`.
- `<script type="module" src="js/app.js">`.

### Makefile targets
| Target | Does |
|---|---|
| `make serve` | Serves `src/` locally, for example `python3 -m http.server 8080 -d src` |
| `make test` | `node --test test/` (built-in runner, no test framework) |
| `make lint` | ESLint over `src/js` and `test` |
| `make validate` | `html-validate` over `src/index.html` and the hippoherd page |
| `make check` | `lint` + `validate` + `test` |
| `make dist` | Copies `src/` to `dist/` ready to publish (no bundling) |
| `make clean` | Removes `dist/` |
| `make help` | Lists the targets (this is the default target) |

### Dev tooling
- `package.json` contains only devDependencies (`eslint`, `html-validate`). There are no runtime deps.
- ESLint: flat config, ES2022, browser and node globals, `no-undef`, `no-unused-vars`.

## Steps
1. Create the directory layout from the overview.
2. Add `index.html` with the shell above and empty module stubs.
3. Add `package.json`, the ESLint config and the html-validate config.
4. Write the Makefile with the targets above.
5. Add one placeholder test so `make test` runs.
6. Add `README.md` (short) and `LICENSE` (match the other Hippo repos).

## Acceptance
- `make help` lists all the targets.
- `make serve` serves the page, and both tabs are visible and switch.
- `make check` passes on the fresh scaffold.
- The page loads with jQuery from the CDN, and also with the CDN blocked (it uses the local fallback).

## Constraints
- No bundler and no transpiler. The browser loads the ES modules directly.
- Makefile recipes must work on macOS and Linux.

## Verify
- Run `make check`.
- Open `make serve` in a browser, switch tabs, and check the devtools console for errors.
