# JsonHippo — Remove standalone Electron app, rework make site

## Context
JsonHippo is live at hippoherd.com/jsonhippo. We started building a **standalone
Electron app** for it. That approach is now abandoned: JSON and YAML will instead be
bundled together in ONE shared desktop app called **ViewHippo** (built in the
hippoherd repo). This brief has two goals:

1. Remove every reference to a JsonHippo-specific Electron app, with all of its make
   targets and related code.
2. `make site` updates the website **and** sends the code the ViewHippo app needs
   over to it.

ViewHippo's specification is still being finalized. Anything below that depends on
it is marked **pending**.

## Goal 1 — Remove the standalone Electron app
Remove all of the following in one change:

- `electron/` — `main.js`, `policy.js`, `package.json`, `package-lock.json`, `icons/`.
- `test/desktop.test.js` — it imports `../electron/policy.js`, so leaving it behind
  turns `make check` red, and `make site` runs `check` first.
- `scripts/make-icons.mjs` — renders `electron/icons/`.
- `.github/workflows/release.yml` — builds and publishes the six installers.
- `release.env.example` — the signing-credential template.
- **Makefile:**
  - the `ELECTRON_DIR` / `DESKTOP_DIR` / `VERSION` block;
  - the release-signing block (`RELEASE_ENV`, `RELEASE_ENV_VARS`, the `-include`
    and export loop) and `UNSIGNED_ENV`;
  - the targets `desktop`, `desktop-setup`, `desktop-pack`, `dist-mac`, `dist-linux`,
    `dist-win`, `icons`, `sync-mac`, `electron/node_modules`, plus their
    `.PHONY` entries and the "Desktop (Electron)" section of `help`;
  - `electron` from the `lint` target's paths;
  - the header line "plus an Electron shell that packages the same page…", the
    "desktop targets … MSYS2" sentence, and the paragraph in the `site` comment about
    desktop installers.
  - Keep `BUILD_DIR`: `preview-site` uses it.
- `eslint.config.js` — the "Electron shell" block.
- `src/js/app.js:454-461` — the `?desktop=<version>` handling that shows
  "Version … · Desktop" in About. It exists only for the old shell. If ViewHippo's
  spec wants a version shown, it is added back under that spec.
- **Prose:** README (the "desktop app" paragraph, `make desktop`, the Desktop builds
  section and its make-target rows), `docs/USAGE.md:365`, and `src/docs/index.html`
  lines 6 and 530 (the desktop Help menu / desktop app's About).
- `docs/features/jsonhippo-electron-build.md` — mark it superseded by this brief.

Keep `package.json`'s `version`; it is not Electron-specific.

### Guard rails
- **`certs/` is not code — move it, do not delete it.** It holds the herd's real
  signing material (Developer ID and distribution `.p12`s, the App Store Connect
  `.p8`, provisioning profiles), which ViewHippo's App Store build needs. It is
  git-ignored; keep the credential patterns in `.gitignore` (`release.env`, `certs/`,
  `*.p12`, `*.p8`, `*.provisionprofile`) so nothing is committed by accident.
- **hippoherd also describes the standalone app.** `content/hippos.mjs` (JsonHippo's
  entry, ~lines 299-322) says JsonHippo "ships desktop builds" with downloads from
  jfigge/jsonhippo's Releases, lists `stack: "Electron · …"`, and its blurb says
  "install it: the desktop app is the same page". No release was ever published
  (`versions.json` has `latest: null`), so nothing needs retracting, but that text is
  a follow-up in the hippoherd repo.

## Goal 2 — `make site` feeds the website AND ViewHippo
- Today `make site` runs `check` and `dist`, then rsyncs `dist/` into
  `$(HIPPOHERD)/website/jsonhippo/`, leaving hippoherd's generated `about/` page
  alone. That stays as it is.
- It **also** delivers the viewer code into ViewHippo's build input, in the same run.
- JsonHippo is the **source of truth**: ViewHippo consumes JsonHippo's build output
  and never holds its own copy of the viewer code.
- **Pending ViewHippo's spec:** the destination path, the artifact's shape (all of
  `dist/`, or a subset), and any requirements on the page (e.g. working offline).
  Put the destination in a Makefile variable alongside `HIPPOHERD`, so it changes in
  one place once the spec settles.

**Implemented (2026-10-15):** `VIEWHIPPO_DIR ?= $(HIPPOHERD)/website/jsonhippo`.
ViewHippo's current draft build (hippoherd's `scripts/stage-desktop.mjs`) packages
`website/jsonhippo/` minus `about/`, so by default the site copy is the app's input
and nothing extra is copied. Set `VIEWHIPPO_DIR` to another directory and
`make site` mirrors `dist/` there too.

## Pending ViewHippo spec — viewer integration
The ViewHippo draft sketches a `window.hippoViewer` API (load / getText / export /
setTheme). It is not part of this brief. Two notes for when the spec settles:
- A host-driven load should go through `App.load(text, name)` (`src/js/app.js:222`,
  the Open-file path), not the paste path. Smart-paste auto-unescape would otherwise
  rewrite a file as it opens.
- `validate()` is async, so anything that needs a parse result returns a Promise.

## Out of scope
- No changes to the viewer's features, parser or UI. The only `src/` edits are the
  removals listed in Goal 1.
- Do not build any Electron shell here — the shell lives in the hippoherd repo.
