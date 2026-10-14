# ─────────────────────────────────────────────────────────────────────────────
#  JsonHippo – a JSON viewer that tells you exactly where it broke
#  Static single-page web app (HTML + CSS + vanilla ES modules, no bundler),
#  plus an Electron shell that packages the same page as a desktop app
# ─────────────────────────────────────────────────────────────────────────────
#
# Recipes stick to POSIX sh and to what GNU make 3.81 (the one macOS ships)
# understands, so every target runs unchanged on macOS and Linux — and, for the
# desktop targets, on Windows under MSYS2, which is how the Release workflow
# runs them there.

WORKSPACE := $(realpath $(dir $(realpath $(firstword $(MAKEFILE_LIST)))))
SRC_DIR   := $(WORKSPACE)/src
DIST_DIR  := $(WORKSPACE)/dist
BUILD_DIR := $(WORKSPACE)/build
PAGE_DIR  := $(WORKSPACE)/site/product-page

PORT      ?= 8080
SITE_PORT ?= 8791

# A checkout of jfigge/hippoherd. The app is published at
# hippoherd.com/jsonhippo/: `make site` copies dist/ into its website/jsonhippo/.
HIPPOHERD ?= $(WORKSPACE)/../hippoherd

# hippoherd's own page ABOUT JsonHippo — features and the desktop downloads —
# lives in the same directory as the app, at website/jsonhippo/about/. It is
# generated there by hippoherd (`page` in its content/hippos.mjs), so the copy
# below must leave it alone: an rsync --delete of dist/ would remove it.
HIPPOHERD_PAGE := /about/

NODE_BIN  := $(WORKSPACE)/node_modules/.bin
HTML      := src/index.html src/docs/index.html site/product-page/jsonhippo.html

# ── Desktop (Electron) ────────────────────────────────────────────────────────
# electron/ holds the shell and its own package.json, so Electron and
# electron-builder (~400 MB once Electron has fetched its binary) are installed
# only by the desktop targets, never by `make check`. A build is staged in build/electron/ — the shell, plus dist/
# as web/ — and packaged from there; installers land in build/electron/dist/.
ELECTRON_DIR := $(WORKSPACE)/electron
DESKTOP_DIR  := $(BUILD_DIR)/electron

# The one version number is package.json's. desktop-setup stamps it into the
# staged electron/package.json, so the installers carry it, and the Release
# workflow publishes v<it> the first time main is pushed with it.
VERSION := $(shell cd "$(WORKSPACE)" && node -p "require('./package.json').version" 2>/dev/null)

# ── Release signing environment ───────────────────────────────────────────────
# The same variables, read the same way, as Rest Hippo's Makefile: credentials
# for SIGNED installers, all optional — with none set, electron-builder emits
# unsigned artifacts and skips notarization. Locally they come from release.env
# (git-ignored; see release.env.example). The certificates are the herd's, so
# the file a sibling already has works unchanged:
#
#     make dist-mac RELEASE_ENV=../resthippo/release.env
#
# In CI the same names come from repository secrets (.github/workflows/release.yml).
#
# Each is exported only when set AND non-empty, and unexported otherwise: an
# EMPTY CSC_LINK reads to electron-builder as "a certificate was given", and
# fails the build with "… not a file". `$(value …)` keeps the secret itself out
# of make's expansion.
RELEASE_ENV ?= $(WORKSPACE)/release.env
RELEASE_ENV_VARS := CSC_LINK CSC_KEY_PASSWORD CSC_IDENTITY_AUTO_DISCOVERY \
                    APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID \
                    APPLE_API_KEY APPLE_API_KEY_ID APPLE_API_ISSUER \
                    WIN_CSC_LINK WIN_CSC_KEY_PASSWORD
-include $(RELEASE_ENV)
$(foreach v,$(RELEASE_ENV_VARS),$(if $(strip $(value $(v))),$(eval export $(v)),$(eval unexport $(v))))

# Strip every credential from one electron-builder call and turn off keychain
# discovery, so the result is unsigned whatever release.env or the keychain
# holds. Paired with -c.mac.notarize=false where it is used.
UNSIGNED_ENV := env $(foreach v,$(filter-out CSC_IDENTITY_AUTO_DISCOVERY,$(RELEASE_ENV_VARS)),-u $(v)) CSC_IDENTITY_AUTO_DISCOVERY=false

.DEFAULT_GOAL := help

.PHONY: help install serve test lint validate check dist clean fixtures screenshots site preview-site \
        desktop desktop-setup desktop-pack dist-mac dist-linux dist-win icons sync-mac

help:
	@echo ""
	@echo "  JsonHippo — a JSON viewer that tells you exactly where it broke"
	@echo ""
	@echo "  Targets:"
	@echo "    help          List these targets (the default)"
	@echo "    install       Install the dev tooling (npm ci): eslint, html-validate"
	@echo "    serve         Serve src/ at http://localhost:$(PORT)  (PORT=…)"
	@echo "    test          Unit tests (node --test, no framework)"
	@echo "    lint          ESLint over src/js, test and scripts"
	@echo "    validate      html-validate over the app page and the parked product page"
	@echo "    check         lint + validate + test"
	@echo "    dist          Copy src/ to dist/, ready to publish (no bundling)"
	@echo "    clean         Remove dist/ and build/"
	@echo ""
	@echo "  Extras:"
	@echo "    fixtures      Write the large generated fixtures to test/fixtures/large/"
	@echo "    screenshots   Capture the product-page screenshots (needs Chrome)"
	@echo "    site          Publish: check, then copy the app into a hippoherd"
	@echo "                  checkout's website/jsonhippo/  (HIPPOHERD=…, default ../hippoherd)"
	@echo "    preview-site  Serve a hippoherd checkout with this app in it, at"
	@echo "                  http://localhost:$(SITE_PORT)/  — before running make site"
	@echo ""
	@echo "  Desktop (Electron):"
	@echo "    desktop       Run the desktop shell on src/ (no packaging)"
	@echo "    desktop-pack  Unsigned app for this machine, no installer (smoke test)"
	@echo "    dist-mac      macOS .dmg, arm64 + x64 — signed and notarized when the"
	@echo "                  credentials are set (RELEASE_ENV=…, default ./release.env)"
	@echo "    dist-win      Windows installers, x64 + arm64 (CI builds them on Windows)"
	@echo "    dist-linux    Linux AppImages, x64 + arm64 (CI builds them on Linux)"
	@echo "    icons         Re-render the app icons from the SVG sources"
	@echo "    sync-mac      Push the macOS signing credentials from RELEASE_ENV to"
	@echo "                  this repo's GitHub Actions secrets (needs gh)"
	@echo ""

# npm ci only re-runs when the lockfile changes; the touch stops make from
# re-running it because node_modules/ is older than package-lock.json.
node_modules: package.json package-lock.json
	npm ci
	@touch node_modules

install: node_modules

# scripts/serve.py is `python3 -m http.server` plus Cache-Control: no-store,
# so a plain reload always runs the modules on disk, never a cached copy.
serve:
	python3 scripts/serve.py $(PORT) "$(SRC_DIR)"

test:
	node --test test/*.test.js

lint: node_modules
	"$(NODE_BIN)/eslint" src/js test scripts electron

validate: node_modules
	"$(NODE_BIN)/html-validate" $(HTML)

check: lint validate test

dist: clean
	mkdir -p "$(DIST_DIR)"
	cp -R "$(SRC_DIR)/." "$(DIST_DIR)/"
	@echo "dist/ is ready to publish."

clean:
	rm -rf "$(DIST_DIR)" "$(BUILD_DIR)"

fixtures:
	node test/fixtures/generate.js test/fixtures/large

screenshots:
	node scripts/screenshots.js

# Publish the app to hippoherd.com/jsonhippo/. hippoherd's generator never
# writes website/jsonhippo/index.html — JsonHippo's entry in its
# content/hippos.mjs puts the page about it at /jsonhippo/about/ and names
# /jsonhippo/ as the app — so the copy made here is the only source of the
# app: --delete keeps it an exact mirror of dist/, except for that page
# (HIPPOHERD_PAGE, above), and `check` runs first so a red build never reaches
# the site. Commit and push in hippoherd afterwards; its CI deploys on push.
#
# The desktop installers are NOT copied: they are published to this repo's
# GitHub Releases by the Release workflow, and hippoherd's page links to them
# from there (its versions.json), like every other hippo's downloads. Each one
# is ~100 MB or more, and GitHub refuses a push with a file over 100 MB.
site: check dist
	@test -d "$(HIPPOHERD)/website" || { echo "No hippoherd checkout at $(HIPPOHERD) — set HIPPOHERD=…"; exit 1; }
	mkdir -p "$(HIPPOHERD)/website/jsonhippo"
	rsync -a --delete --exclude .DS_Store --exclude "$(HIPPOHERD_PAGE)" "$(DIST_DIR)/" "$(HIPPOHERD)/website/jsonhippo/"
	@echo "Published to $(HIPPOHERD)/website/jsonhippo/ — review, commit and push it in hippoherd."

# The whole hippoherd site with this build of the app in it — the index card,
# the page about the app, and the app — without touching the hippoherd checkout.
preview-site: dist
	@test -d "$(HIPPOHERD)/website" || { echo "No hippoherd checkout at $(HIPPOHERD) — set HIPPOHERD=…"; exit 1; }
	rm -rf "$(BUILD_DIR)/site"
	mkdir -p "$(BUILD_DIR)/site"
	cp -R "$(HIPPOHERD)/website/." "$(BUILD_DIR)/site/"
	rsync -a --delete --exclude .DS_Store --exclude "$(HIPPOHERD_PAGE)" "$(DIST_DIR)/" "$(BUILD_DIR)/site/jsonhippo/"
	@echo "hippoherd with this JsonHippo at http://localhost:$(SITE_PORT)/  (app at /jsonhippo/, its page at /jsonhippo$(HIPPOHERD_PAGE))"
	python3 scripts/serve.py $(SITE_PORT) "$(BUILD_DIR)/site"

# ── Desktop (Electron) ───────────────────────────────────────────────────────

# Same idiom as node_modules above, for the shell's own dependencies.
electron/node_modules: electron/package.json electron/package-lock.json
	cd "$(ELECTRON_DIR)" && npm ci --no-audit --no-fund
	@touch "$(ELECTRON_DIR)/node_modules"

# Run the shell straight from electron/ against src/, so a reload (⌘R) picks
# up an edit to the app. DevTools are in the View menu in this mode only.
desktop: electron/node_modules
	cd "$(ELECTRON_DIR)" && JSONHIPPO_WEB_DIR="$(SRC_DIR)" npx electron .

# Stage a packageable copy in build/electron/: the shell, the app as web/, its
# dependencies, and package.json's version. `dist` starts from `clean`, so the
# stage is rebuilt from scratch every time.
desktop-setup: dist
	@test -n "$(VERSION)" || { echo "Could not read the version from package.json."; exit 1; }
	mkdir -p "$(DESKTOP_DIR)"
	rsync -a --exclude node_modules --exclude dist --exclude .DS_Store "$(ELECTRON_DIR)/" "$(DESKTOP_DIR)/"
	rsync -a --exclude .DS_Store "$(DIST_DIR)/" "$(DESKTOP_DIR)/web/"
	cd "$(DESKTOP_DIR)" && npm ci --no-audit --no-fund
	cd "$(DESKTOP_DIR)" && npm pkg set version="$(VERSION)"

# A fast, unsigned `--dir` package for this machine: the whole electron-builder
# pack (asar, file list, icons) without an installer or any signing.
desktop-pack: desktop-setup
	cd "$(DESKTOP_DIR)" && $(UNSIGNED_ENV) npx electron-builder --dir --publish never -c.mac.notarize=false
	@echo "  → $(DESKTOP_DIR)/dist/"

# The release installers, one recipe per platform — the entry points the
# Release workflow runs, each on its own platform's runner. A Mac can also
# cross-build the Windows and Linux ones (unsigned), handy for checking names
# and contents; the shipped ones come from CI.
#
# Signing follows the environment and is never forced off here: with
# CSC_LINK/CSC_KEY_PASSWORD set, the macOS app is signed with that Developer ID
# certificate, and with Apple's notarization credentials as well (APPLE_ID +
# APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID, or APPLE_API_KEY +
# APPLE_API_KEY_ID + APPLE_API_ISSUER) it is notarized and stapled. Without
# CSC_LINK, electron-builder signs with a Developer ID identity from the login
# keychain if it finds one, and builds unsigned if not;
# CSC_IDENTITY_AUTO_DISCOVERY=false forces unsigned.
dist-mac: desktop-setup
	cd "$(DESKTOP_DIR)" && npx electron-builder --mac --publish never
	@echo "  → $(DESKTOP_DIR)/dist/"

dist-linux: desktop-setup
	cd "$(DESKTOP_DIR)" && npx electron-builder --linux --publish never
	@echo "  → $(DESKTOP_DIR)/dist/"

# Windows signing happens in CI, out of band (SignPath, see release.yml), not
# here — unless WIN_CSC_LINK names a code-signing certificate, which no hippo
# has yet.
dist-win: desktop-setup
	cd "$(DESKTOP_DIR)" && npx electron-builder --win --publish never
	@echo "  → $(DESKTOP_DIR)/dist/"

# Re-render electron/icons/ from src/img/jsonhippo.svg and the macOS variant,
# electron/icons/jsonhippo-mac-icon.svg. Runs under Electron (see the script).
icons: electron/node_modules
	cd "$(ELECTRON_DIR)" && npx electron ../scripts/make-icons.mjs

# Copy the macOS signing credentials from RELEASE_ENV into this repository's
# Actions secrets, where the Release workflow reads them — the same recipe as
# Rest Hippo's sync-mac. Each value is read with $(…), which drops the trailing
# newline, and piped to `gh secret set`, never echoed; an empty one is skipped
# rather than stored, because an empty CSC_LINK breaks the build. For the API
# key route to notarization, set APPLE_API_KEY_ID, APPLE_API_ISSUER and
# APPLE_API_KEY_BASE64 by hand (see the header of release.yml).
sync-mac:
	@test -f "$(RELEASE_ENV)" || { echo "No $(RELEASE_ENV) — copy release.env.example, or set RELEASE_ENV=…"; exit 1; }
	@echo "Pushing the macOS signing secrets from $(RELEASE_ENV) to GitHub…"
	@for k in CSC_LINK CSC_KEY_PASSWORD APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID; do \
		v=$$(grep "^$$k=" "$(RELEASE_ENV)" | head -1 | cut -d= -f2-); \
		if [ -z "$$v" ]; then echo "  ! $$k is missing or empty — skipped"; continue; fi; \
		printf '%s' "$$v" | gh secret set "$$k" --repo jfigge/jsonhippo && echo "  ✓ $$k"; \
	done
